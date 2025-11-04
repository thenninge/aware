// useCompass.ts
// Smooth, resilient compass hook for iOS/Android web (Next/Vercel friendly)

import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseCompassOptions {
  isEnabled: boolean;
  onHeadingChange?: (heading: number) => void;

  // Smoothing (EMA)
  smoothingAlpha?: number;        // default 0.22 (0..1, lavere = roligere)

  // Stall/recovery
  stallMs?: number;               // default 650 ms: hvor lenge uten events før vi antar stall
  watchdogPeriodMs?: number;      // default 220 ms: hvor ofte vi sjekker for stall
  onStall?: () => void;           // valgfri callback når stall oppdages

  // Tegnehastighet/ro
  minRenderIntervalMs?: number;   // default 50 ms: maks ~20 fps for UI-oppdatering
  minDeltaDeg?: number;           // default 0.8°: deadband – ignorer små endringer
  enableTiltGuard?: boolean;      // default true: dropp målinger ved ekstrem tilt
}

export interface UseCompassReturn {
  // Tilstand
  isActive: boolean;
  isSupported: boolean;
  permissionState: 'unknown' | 'granted' | 'denied' | 'not-required';
  error?: string;

  // Verdier
  currentHeading: number | null;  // smoothed [0..360)
  rawHeading: number | null;      // siste rå vinkel [0..360)
  lastValidHeading: number | null;

  // Kontroll
  startCompass: () => Promise<void>;  // kall i bruker-gest (onClick)
  stopCompass: () => void;
}

// ---------- Utils ----------
function normalizeDeg(x: number): number {
  let d = x % 360;
  if (d < 0) d += 360;
  return d;
}

function wrapDiff(a: number, b: number): number {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function angAbsDiff(a: number, b: number): number {
  return Math.abs(wrapDiff(a, b));
}

// EMA smoothing som tar hensyn til 0/360-wrap
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

  // Defaults tunet for “smud” nål og rask recovery
  smoothingAlpha = 0.22,
  stallMs = 650,
  watchdogPeriodMs = 220,
  onStall,

  minRenderIntervalMs = 50,
  minDeltaDeg = 0.8,
  enableTiltGuard = true,
}: UseCompassOptions): UseCompassReturn {
  // Offentlig state
  const [isActive, setIsActive] = useState(false);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [rawHeading, setRawHeading] = useState<number | null>(null);
  const [lastValidHeading, setLastValidHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] =
    useState<'unknown' | 'granted' | 'denied' | 'not-required'>('unknown');
  const [error, setError] = useState<string | undefined>(undefined);

  const isSupported =
    typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  // Interne refs
  const smootherRef = useRef(makeSmoother(smoothingAlpha));
  const lastEventTsRef = useRef<number>(0);
  const lastRawRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const rafRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const removeOrientationRef = useRef<(() => void) | null>(null);

  const lastRenderTsRef = useRef(0);
  const lastSentHeadingRef = useRef<number | null>(null);

  // Oppdater smoother hvis alpha endres
  useEffect(() => {
    smootherRef.current = makeSmoother(smoothingAlpha);
  }, [smoothingAlpha]);

  // Heading fra event (bruk iOS webkitCompassHeading om tilgjengelig)
  const computeHeading = useCallback((evt: DeviceOrientationEvent): number | null => {
    const anyEvt: any = evt as any;

    // Tilt guard (ved ekstrem tilt gir mange enheter dårlig heading)
    if (enableTiltGuard) {
      const { beta, gamma } = evt;
      if (typeof beta === 'number' && typeof gamma === 'number') {
        const absTilt = Math.max(Math.abs(beta), Math.abs(gamma));
        if (absTilt > 75) return null; // dropp oppdatering
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

  // Lytter
  const attachListener = useCallback(() => {
    if (activeRef.current) return;

    const onOrientation = (evt: DeviceOrientationEvent) => {
      const raw = computeHeading(evt);
      console.log('[useCompass] Event received:', { raw, alpha: evt.alpha, webkitHeading: (evt as any).webkitCompassHeading });
      if (raw == null || Number.isNaN(raw)) {
        console.warn('[useCompass] Invalid heading:', raw);
        return;
      }
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

  // Start
  const startCompass = useCallback(async () => {
    if (!isSupported) {
      const msg = 'DeviceOrientation ikke støttet';
      setError(msg);
      setPermissionState('denied');
      throw new Error(msg);
    }

    // Må kalles fra bruker-gest i iOS
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

    console.log('[useCompass] Starting compass...');
    setError(undefined);
    setIsActive(true);

    // Koble på sensoren
    attachListener();
    console.log('[useCompass] Listener attached, starting RAF loop');

    // rAF-tegneloop med throttling + deadband
    if (rafRef.current == null) {
      const tick = () => {
        const now = performance.now();
        const raw = lastRawRef.current;

        if (raw != null && now - lastRenderTsRef.current >= minRenderIntervalMs) {
          const smooth = smootherRef.current(raw);
          const lastSent = lastSentHeadingRef.current;

          if (lastSent == null || angAbsDiff(smooth, lastSent) >= minDeltaDeg) {
            console.log('[useCompass] RAF updating heading:', { raw, smooth });
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
    }

    // Watchdog: re-attach ved stall, pause når skjult
    if (watchdogRef.current == null) {
      watchdogRef.current = window.setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        const idle = performance.now() - (lastEventTsRef.current || 0);
        if (idle > stallMs) {
          onStall?.();
          // Soft kick
          detachListener();
          smootherRef.current = makeSmoother(smoothingAlpha);
          attachListener();

          // Hard kick hvis fortsatt dødt
          setTimeout(() => {
            const stillIdle = performance.now() - (lastEventTsRef.current || 0);
            if (stillIdle > stallMs * 1.25) {
              detachListener();
              smootherRef.current = makeSmoother(smoothingAlpha);
              setTimeout(attachListener, 0);
            }
          }, Math.min(120, stallMs * 0.2));
        }
      }, watchdogPeriodMs);
    }
  }, [
    isSupported,
    attachListener,
    detachListener,
    onHeadingChange,
    stallMs,
    watchdogPeriodMs,
    onStall,
    smoothingAlpha,
    minRenderIntervalMs,
    minDeltaDeg,
  ]);

  // Stop
  const stopCompass = useCallback(() => {
    setIsActive(false);
    detachListener();
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (watchdogRef.current != null) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
    setCurrentHeading(null);
    setRawHeading(null);
    // bevar lastValidHeading
  }, [detachListener]);

  // Lifecycle (with iOS permission loss detection)
  useEffect(() => {
    if (!isEnabled) {
      if (isActive) stopCompass();
      return;
    }

    let permissionCheckTimeout: NodeJS.Timeout | null = null;

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isActive) {
        // Note: iOS kan ha revoked permissions mens app var i bakgrunnen
        const lastEventBeforeResume = lastEventTsRef.current;
        
        attachListener();

        // Sjekk om vi får nye events innen 2 sek (kun hvis vi hadde events før)
        if (lastEventBeforeResume > 0) {
          permissionCheckTimeout = setTimeout(() => {
            if (lastEventTsRef.current === lastEventBeforeResume) {
              // Ingen nye events → permissions tapt
              console.warn('[useCompass] No events after resume - permissions lost');
              stopCompass();
              setError('Compass permissions lost - tap compass button to restart');
            }
          }, 2000);
        }
      } else if (document.visibilityState === 'hidden') {
        detachListener();
        if (permissionCheckTimeout) {
          clearTimeout(permissionCheckTimeout);
          permissionCheckTimeout = null;
        }
      }
    };

    const onPageShow = () => {
      if (isActive) {
        const lastEventBeforePageShow = lastEventTsRef.current;
        
        attachListener();

        // Sjekk om vi får nye events etter pageshow
        if (lastEventBeforePageShow > 0) {
          permissionCheckTimeout = setTimeout(() => {
            if (lastEventTsRef.current === lastEventBeforePageShow) {
              console.warn('[useCompass] No events after pageshow - permissions lost');
              stopCompass();
              setError('Compass permissions lost - tap compass button to restart');
            }
          }, 2000);
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      if (permissionCheckTimeout) {
        clearTimeout(permissionCheckTimeout);
      }
    };
  }, [isEnabled, isActive, attachListener, detachListener, stopCompass]);

  // Gesture-kick med cooldown (vekker stream raskt ved berøring)
  useEffect(() => {
    if (!isActive) return;

    let lastKick = 0;
    const kickCooldownMs = 300;

    const poke = () => {
      const now = performance.now();
      if (now - lastKick < kickCooldownMs) return;
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
    error,
    currentHeading,
    rawHeading,
    lastValidHeading,
    startCompass,
    stopCompass,
  };
}
