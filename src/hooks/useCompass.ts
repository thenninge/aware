import { useState, useCallback, useEffect, useRef } from 'react';

interface UseCompassOptions {
  isEnabled: boolean;
  onHeadingChange?: (heading: number) => void;
  smoothingAlpha?: number; // EMA smoothing factor (0-1, default 0.25)
}

interface UseCompassReturn {
  isActive: boolean;
  currentHeading: number | null;
  rawHeading: number | null;
  lastValidHeading: number | null;
  startCompass: () => Promise<void>;
  stopCompass: () => void;
  isSupported: boolean;
  permissionState: 'unknown' | 'granted' | 'denied' | 'not-required';
  error?: string;
}

// Normalize 0..360
function normalizeDeg(x: number): number {
  let d = x % 360;
  if (d < 0) d += 360;
  return d;
}

// Wrap-aware EMA
function makeSmoother(alpha = 0.25) {
  let prev: number | null = null;
  return (v: number) => {
    if (prev == null) { prev = v; return v; }
    let diff = v - prev;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const out = normalizeDeg(prev + alpha * diff);
    prev = out;
    return out;
  };
}

export function useCompass({
  isEnabled,
  onHeadingChange,
  smoothingAlpha = 0.25,
}: UseCompassOptions): UseCompassReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [rawHeading, setRawHeading] = useState<number | null>(null);
  const [lastValidHeading, setLastValidHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied' | 'not-required'>('unknown');
  const [error, setError] = useState<string | undefined>(undefined);

  const isSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  // Refs for internals
  const smootherRef = useRef(makeSmoother(smoothingAlpha));
  const lastEventTsRef = useRef<number>(0);
  const lastRawRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const rafRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const removeOrientationRef = useRef<(() => void) | null>(null);

  // Recreate smoother if alpha changes
  useEffect(() => {
    smootherRef.current = makeSmoother(smoothingAlpha);
  }, [smoothingAlpha]);

  // Compute heading from event
  const computeHeading = useCallback((evt: DeviceOrientationEvent): number | null => {
    const anyEvt: any = evt as any;
    if (typeof anyEvt.webkitCompassHeading === 'number' && !isNaN(anyEvt.webkitCompassHeading)) {
      return normalizeDeg(anyEvt.webkitCompassHeading);
    }
    if (typeof evt.alpha === 'number' && evt.alpha != null) {
      const ang =
        (window.screen.orientation && typeof window.screen.orientation.angle === 'number')
          ? window.screen.orientation.angle
          : ((window as any).orientation || 0);
      return normalizeDeg(360 - (evt.alpha + (ang || 0)));
    }
    return null;
  }, []);

  // Attach/remove deviceorientation listener
  const attachListener = useCallback(() => {
    if (activeRef.current) return;

    const onOrientation = (evt: DeviceOrientationEvent) => {
      const raw = computeHeading(evt);
      if (raw == null || Number.isNaN(raw)) return;
      lastRawRef.current = raw;
      lastEventTsRef.current = performance.now();
    };

    window.addEventListener('deviceorientation', onOrientation, { passive: true } as AddEventListenerOptions);
    activeRef.current = true;

    removeOrientationRef.current = () => {
      window.removeEventListener('deviceorientation', onOrientation as any);
      activeRef.current = false;
    };
  }, [computeHeading]);

  const detachListener = useCallback(() => {
    removeOrientationRef.current?.();
    removeOrientationRef.current = null;
  }, []);

  // Start compass
  const startCompass = useCallback(async () => {
    if (!isSupported) {
      const msg = 'DeviceOrientation ikke støttet';
      setError(msg);
      setPermissionState('denied');
      throw new Error(msg);
    }

    // iOS permission model (must be called from a user gesture)
    try {
      const D: any = DeviceOrientationEvent;
      if (typeof D?.requestPermission === 'function') {
        const res = await D.requestPermission();
        if (res !== 'granted') {
          setPermissionState('denied');
          setError('Permission not granted');
          throw new Error('Permission not granted');
        }
        setPermissionState('granted');
      } else {
        setPermissionState('not-required');
      }
    } catch (e: any) {
      setPermissionState('denied');
      setError(e?.message || 'Permission error');
      throw e;
    }

    setError(undefined);
    setIsActive(true);

    // Attach sensor listener
    attachListener();

    // RAF render loop (decouples UI from event cadence)
    if (rafRef.current == null) {
      const tick = () => {
        const now = performance.now();
        const raw = lastRawRef.current;
        const stale = lastEventTsRef.current ? now - lastEventTsRef.current : Infinity;

        if (raw != null) {
          const smooth = smootherRef.current(raw);
          setRawHeading(raw);
          setCurrentHeading(smooth);
          setLastValidHeading(smooth);
          onHeadingChange?.(smooth);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    // Watchdog: re-attach if no events for >1.2s (iOS stall)
    if (watchdogRef.current == null) {
      watchdogRef.current = window.setInterval(() => {
        const idle = performance.now() - (lastEventTsRef.current || 0);
        if (idle > 1200) {
          // re-kick the stream
          detachListener();
          setTimeout(attachListener, 0);
        }
      }, 800);
    }
  }, [attachListener, detachListener, isSupported, onHeadingChange]);

  // Stop compass
  const stopCompass = useCallback(() => {
    setIsActive(false);
    detachListener();
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (watchdogRef.current != null) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
    setCurrentHeading(null);
    setRawHeading(null);
    // keep lastValidHeading as last known good value
  }, [detachListener]);

  // Lifecycle: visibility/pageshow
  useEffect(() => {
    if (!isEnabled) {
      if (isActive) stopCompass();
      return;
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isActive) {
        attachListener();
      } else if (document.visibilityState === 'hidden') {
        // optional: drop listener to save energy; watchdog will revive anyway
        detachListener();
      }
    };
    const onPageShow = () => { if (isActive) attachListener(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [isEnabled, isActive, attachListener, detachListener, stopCompass]);

  return {
    isActive,
    currentHeading,
    rawHeading,
    lastValidHeading,
    startCompass,
    stopCompass,
    isSupported,
    permissionState,
    error,
  };
}