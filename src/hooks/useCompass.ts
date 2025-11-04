// useCompass.ts — resilient compass (startup handshake + first-event watchdog)
// Paste this whole file. API: startCompass/stopCompass + currentHeading etc.

import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseCompassOptions {
  isEnabled: boolean;
  onHeadingChange?: (heading: number) => void;

  // Smoothing
  smoothingAlpha?: number;        // default 0.22

  // Recovery (runtime stall)
  stallMs?: number;               // default 600 ms
  watchdogPeriodMs?: number;      // default 200 ms
  onStall?: () => void;

  // Startup reliability
  firstEventDeadlineMs?: number;  // default 1200 ms (time to wait for first event)
  startRetryDelayMs?: number;     // default 80 ms (small delay between re-attaches)
  startTimeoutMs?: number;        // default 6000 ms (overall startup guard)

  // Render pacing
  minRenderIntervalMs?: number;   // default 50 ms (~20 fps)
  minDeltaDeg?: number;           // default 0.8°
  enableTiltGuard?: boolean;      // default true
}

export interface UseCompassReturn {
  // State
  isActive: boolean;
  isSupported: boolean;
  permissionState: 'unknown' | 'granted' | 'denied' | 'not-required';
  phase: 'idle' | 'requesting-permission' | 'starting' | 'running' | 'stalled';
  error?: string;

  // Values
  currentHeading: number | null;  // smoothed
  rawHeading: number | null;      // last raw
  lastValidHeading: number | null;

  // Control
  startCompass: () => Promise<void>; // call from a user gesture (tap)
  stopCompass: () => void;
}

// ---------- Utils ----------
function normalizeDeg(x: number): number {
  let d = x % 360;
  if (d < 0) d += 360;
  return d;
}
function wrapDiff(a: number, b: number): number {
  let d = a - b; if (d > 180) d -= 360; if (d < -180) d += 360; return d;
}
function angAbsDiff(a: number, b: number): number { return Math.abs(wrapDiff(a, b)); }

function makeSmoother(alpha = 0.22) {
  let prev: number | null = null;
  return (v: number) => {
    if (prev == null) { prev = v; return v; }
    const out = normalizeDeg(prev + alpha * wrapDiff(v, prev));
    prev = out;
    return out;
  };
}

// ---------- Hook ----------
export function useCompass({
  isEnabled,
  onHeadingChange,

  smoothingAlpha = 0.22,

  stallMs = 600,
  watchdogPeriodMs = 200,
  onStall,

  firstEventDeadlineMs = 1200,
  startRetryDelayMs = 80,
  startTimeoutMs = 6000,

  minRenderIntervalMs = 50,
  minDeltaDeg = 0.8,
  enableTiltGuard = true,
}: UseCompassOptions): UseCompassReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [rawHeading, setRawHeading] = useState<number | null>(null);
  const [lastValidHeading, setLastValidHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] =
    useState<'unknown' | 'granted' | 'denied' | 'not-required'>('unknown');
  const [phase, setPhase] = useState<'idle' | 'requesting-permission' | 'starting' | 'running' | 'stalled'>('idle');
  const [error, setError] = useState<string | undefined>(undefined);

  const isSupported =
    typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  // Internals
  const smootherRef = useRef(makeSmoother(smoothingAlpha));
  const lastEventTsRef = useRef<number>(0);
  const lastRawRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const rafRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const removeOrientationRef = useRef<(() => void) | null>(null);

  const lastRenderTsRef = useRef(0);
  const lastSentHeadingRef = useRef<number | null>(null);

  const startLockRef = useRef(false);            // single-flight start
  const startBeginTsRef = useRef<number>(0);     // guard against endless start
  const firstEventSeenRef = useRef(false);       // startup handshake

  // Update smoother if alpha changes
  useEffect(() => { smootherRef.current = makeSmoother(smoothingAlpha); }, [smoothingAlpha]);

  // Compute heading
  const computeHeading = useCallback((evt: DeviceOrientationEvent): number | null => {
    const anyEvt: any = evt as any;

    if (enableTiltGuard) {
      const { beta, gamma } = evt;
      if (typeof beta === 'number' && typeof gamma === 'number') {
        const absTilt = Math.max(Math.abs(beta), Math.abs(gamma));
        if (absTilt > 75) return null; // drop extreme tilt
      }
    }

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
  }, [enableTiltGuard]);

  // Attach/remove listener
  const attachListener = useCallback(() => {
    if (activeRef.current) return;

    const onOrientation = (evt: DeviceOrientationEvent) => {
      const raw = computeHeading(evt);
      if (raw == null || Number.isNaN(raw)) return;
      lastRawRef.current = raw;
      lastEventTsRef.current = performance.now();
      if (!firstEventSeenRef.current) firstEventSeenRef.current = true;
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

  // rAF drawing loop
  const ensureRAF = useCallback(() => {
    if (rafRef.current != null) return;

    const tick = () => {
      const now = performance.now();
      const raw = lastRawRef.current;

      if (raw != null && now - lastRenderTsRef.current >= minRenderIntervalMs) {
        const smooth = smootherRef.current(raw);
        const lastSent = lastSentHeadingRef.current;

        if (lastSent == null || angAbsDiff(smooth, lastSent) >= minDeltaDeg) {
          setRawHeading(raw);
          setCurrentHeading(smooth);
          setLastValidHeading(smooth);
          onHeadingChange?.(smooth);

          lastSentHeadingRef.current = smooth;
          lastRenderTsRef.current = now;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [minRenderIntervalMs, minDeltaDeg, onHeadingChange]);

  // Runtime watchdog (stall)
  const ensureWatchdog = useCallback(() => {
    if (watchdogRef.current != null) return;

    watchdogRef.current = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || !isActive) return;
      const idle = performance.now() - (lastEventTsRef.current || 0);
      if (idle > stallMs) {
        setPhase('stalled');
        onStall?.();
        // soft kick
        detachListener();
        smootherRef.current = makeSmoother(smoothingAlpha);
        attachListener();

        // hard kick if still dead
        setTimeout(() => {
          const stillIdle = performance.now() - (lastEventTsRef.current || 0);
          if (stillIdle > stallMs * 1.25) {
            detachListener();
            smootherRef.current = makeSmoother(smoothingAlpha);
            setTimeout(attachListener, 0);
          }
        }, Math.min(120, stallMs * 0.2));
      } else if (phase !== 'running' && isActive) {
        setPhase('running');
      }
    }, watchdogPeriodMs);
  }, [attachListener, detachListener, isActive, onStall, phase, smoothingAlpha, stallMs, watchdogPeriodMs]);

  // Start (call from user gesture)
  const startCompass = useCallback(async () => {
    if (!isSupported) {
      const msg = 'DeviceOrientation ikke støttet';
      setError(msg);
      setPermissionState('denied');
      setPhase('idle');
      throw new Error(msg);
    }
    if (startLockRef.current) return; // prevent concurrent starts
    startLockRef.current = true;

    try {
      setPhase('requesting-permission');
      const D: any = DeviceOrientationEvent;
      if (typeof D?.requestPermission === 'function') {
        const res = await D.requestPermission();
        if (res !== 'granted') {
          setPermissionState('denied');
          setError('Permission not granted');
          setPhase('idle');
          throw new Error('Permission not granted');
        }
        setPermissionState('granted');
      } else {
        setPermissionState('not-required');
      }

      // Begin startup sequence
      setError(undefined);
      setIsActive(true);
      setPhase('starting');

      // Prepare for handshake
      firstEventSeenRef.current = false;
      lastEventTsRef.current = 0;
      lastRawRef.current = null;
      smootherRef.current = makeSmoother(smoothingAlpha);

      // Attach + RAF + watchdog
      attachListener();
      ensureRAF();
      ensureWatchdog();

      // Wait for first event with deadline; retry attach if needed
      startBeginTsRef.current = performance.now();

      const tryUntil = async (deadlineMs: number) => {
        while (performance.now() - startBeginTsRef.current < deadlineMs) {
          if (firstEventSeenRef.current) {
            setPhase('running');
            return true;
          }
          await new Promise(r => setTimeout(r, startRetryDelayMs));
          if (!firstEventSeenRef.current) { // kick the stream if still no event
            detachListener();
            attachListener();
          }
        }
        return false;
      };

      const gotFirst = await tryUntil(firstEventDeadlineMs);
      if (!gotFirst) {
        // As a last attempt, give it a slightly longer window before failing:
        const gotAfter = await tryUntil(startTimeoutMs);
        if (!gotAfter) {
          setError('Ingen kompassdata mottatt ved oppstart');
          setPhase('idle');
          throw new Error('No sensor events on start');
        }
      }
      // success → phase set to 'running' by watchdog or above
    } finally {
      startLockRef.current = false;
    }
  }, [attachListener, detachListener, ensureRAF, ensureWatchdog, isSupported, smoothingAlpha, startRetryDelayMs, firstEventDeadlineMs, startTimeoutMs]);

  // Stop
  const stopCompass = useCallback(() => {
    setIsActive(false);
    setPhase('idle');
    detachListener();
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (watchdogRef.current != null) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
    // keep lastValidHeading
  }, [detachListener]);

  // Lifecycle (visibility/pageshow)
  useEffect(() => {
    if (!isEnabled) {
      if (isActive) stopCompass();
      return;
    }
    
    let resumeTimeoutRef: NodeJS.Timeout | null = null;
    
    const onVisibility = () => {
      if (!isActive) return;
      if (document.visibilityState === 'visible') {
        // iOS kan ha resatt permissions når vi kommer tilbake
        // Prøv å attachListener, men stopp kompasset hvis vi ikke får events
        const lastEventBefore = lastEventTsRef.current;
        attachListener();
        
        // Hvis vi ikke får nye events innen 2 sekunder, permissions er tapt
        resumeTimeoutRef = setTimeout(() => {
          if (lastEventTsRef.current === lastEventBefore) {
            console.warn('[useCompass] No events after resume - permissions likely lost. Stopping compass.');
            stopCompass();
            setError('Compass permissions lost - tap compass button to restart');
          }
        }, 2000);
      } else {
        // App går i bakgrunnen
        detachListener();
        if (resumeTimeoutRef) {
          clearTimeout(resumeTimeoutRef);
          resumeTimeoutRef = null;
        }
      }
    };
    
    const onPageShow = () => { 
      if (isActive) {
        const lastEventBefore = lastEventTsRef.current;
        attachListener();
        
        // Check if we get events after pageshow
        resumeTimeoutRef = setTimeout(() => {
          if (lastEventTsRef.current === lastEventBefore) {
            console.warn('[useCompass] No events after pageshow - permissions likely lost. Stopping compass.');
            stopCompass();
            setError('Compass permissions lost - tap compass button to restart');
          }
        }, 2000);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      if (resumeTimeoutRef) {
        clearTimeout(resumeTimeoutRef);
      }
    };
  }, [isEnabled, isActive, attachListener, detachListener, stopCompass]);

  // Gesture kick with cooldown (wake quickly on touch if stalled)
  useEffect(() => {
    if (!isActive) return;
    let lastKick = 0;
    const cooldown = 300;
    const poke = () => {
      const now = performance.now();
      if (now - lastKick < cooldown) return;
      const idle = now - (lastEventTsRef.current || 0);
      if (idle > stallMs) {
        lastKick = now;
        detachListener();
        attachListener();
      }
    };
    window.addEventListener('pointerdown', poke, { passive: true } as AddEventListenerOptions);
    return () => window.removeEventListener('pointerdown', poke as any);
  }, [isActive, stallMs, attachListener, detachListener]);

  return {
    isActive,
    isSupported,
    permissionState,
    phase,
    error,
    currentHeading,
    rawHeading,
    lastValidHeading,
    startCompass,
    stopCompass,
  };
}
