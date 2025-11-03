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

// Normalize degrees to 0-360
function normalizeDeg(x: number): number {
  let d = x % 360;
  if (d < 0) d += 360;
  return d;
}

// Exponential Moving Average smoothing
function makeSmoother(alpha = 0.25) {
  let prev: number | null = null;
  return (v: number) => {
    if (prev == null) {
      prev = v;
      return v;
    }
    // Find shortest path around 0/360
    let diff = v - prev;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const smoothed = normalizeDeg(prev + alpha * diff);
    prev = smoothed;
    return smoothed;
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
  
  const smootherRef = useRef(makeSmoother(smoothingAlpha));
  const listenerActive = useRef(false);
  const lastEventTime = useRef<number>(0);
  const isSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  // Compute heading from device orientation event
  const computeHeading = useCallback((evt: DeviceOrientationEvent): number | null => {
    // iOS legacy webkitCompassHeading
    const anyEvt: any = evt as any;
    if (typeof anyEvt.webkitCompassHeading === 'number' && !isNaN(anyEvt.webkitCompassHeading)) {
      // webkitCompassHeading er allerede "sann nord" (0 = nord, øker med klokka)
      return normalizeDeg(anyEvt.webkitCompassHeading);
    }

    // Standard alpha (må justeres med screen orientation)
    if (typeof evt.alpha === 'number' && evt.alpha != null) {
      const alpha = evt.alpha; // 0–360
      
      // Korriger for skjermrotasjon
      const orientationAngle =
        (window.screen.orientation && typeof window.screen.orientation.angle === 'number')
          ? window.screen.orientation.angle
          : (window.orientation as number) || 0;

      // Kompass = 360 - (alpha + orientationAngle)
      const heading = normalizeDeg(360 - (alpha + (orientationAngle || 0)));
      return heading;
    }

    return null;
  }, []);

  // Compass event handler
  const handleCompass = useCallback((event: DeviceOrientationEvent) => {
    const now = Date.now();
    lastEventTime.current = now;
    
    const raw = computeHeading(event);
    
    console.log('[useCompass] Event fired at', now, '- raw:', raw, 'alpha:', event.alpha, 'webkitCompassHeading:', (event as any).webkitCompassHeading);
    
    if (raw == null || isNaN(raw)) {
      console.warn('[useCompass] Invalid heading computed');
      return;
    }
    
    // Apply EMA smoothing
    const smoothed = smootherRef.current(raw);
    
    // Update state
    setRawHeading(raw);
    setCurrentHeading(smoothed);
    setLastValidHeading(smoothed);
    onHeadingChange?.(smoothed);
    
    console.log('[useCompass] Heading updated:', { raw, smoothed, timestamp: now });
  }, [computeHeading, onHeadingChange]);

  // Start compass function
  const startCompass = useCallback(async () => {
    // Already active?
    if (listenerActive.current) {
      console.log('[useCompass] Already active');
      return;
    }

    if (!isSupported) {
      const msg = 'DeviceOrientation ikke støttet';
      console.warn('[useCompass]', msg);
      setError(msg);
      setPermissionState('denied');
      throw new Error('Kompass ikke støttet på denne enheten');
    }

    // iOS permission flow
    const needsPermission = (DeviceOrientationEvent as any).requestPermission instanceof Function;

    try {
      if (needsPermission) {
        console.log('[useCompass] Requesting iOS permission...');
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res !== 'granted') {
          const msg = 'Permission not granted';
          console.warn('[useCompass]', msg);
          setError(msg);
          setPermissionState('denied');
          throw new Error('Ingen tilgang til kompass');
        }
        setPermissionState('granted');
      } else {
        setPermissionState('not-required');
      }
      
      setError(undefined);
      setIsActive(true);
      listenerActive.current = true;
      console.log('[useCompass] Compass started successfully');
    } catch (e: any) {
      const msg = e?.message || 'Permission error';
      console.error('[useCompass]', msg);
      setError(msg);
      setPermissionState('denied');
      throw e;
    }
  }, [isSupported]);

  // Stop compass function
  const stopCompass = useCallback(() => {
    console.log('[useCompass] Stopping compass');
    setIsActive(false);
    listenerActive.current = false;
    setCurrentHeading(null);
    setRawHeading(null);
  }, []);

  // Event listener management with iOS-specific keep-alive
  useEffect(() => {
    if (!isActive || !isEnabled) {
      return;
    }

    console.log('[useCompass] Setting up compass listeners');
    
    const onOrientation = (evt: DeviceOrientationEvent) => handleCompass(evt);

    // Add deviceorientation listener with passive for better performance
    window.addEventListener('deviceorientation', onOrientation, { passive: true } as AddEventListenerOptions);
    listenerActive.current = true;

    // iOS keep-alive: re-subscribe when page becomes visible
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !listenerActive.current) {
        console.log('[useCompass] Page visible, re-adding listener');
        window.addEventListener('deviceorientation', onOrientation, { passive: true } as AddEventListenerOptions);
        listenerActive.current = true;
      }
    };

    // iOS: remove listener when hidden (prevents freezing)
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && listenerActive.current) {
        console.log('[useCompass] Page hidden, removing listener');
        window.removeEventListener('deviceorientation', onOrientation as any);
        listenerActive.current = false;
      }
    };

    // Handle page show/hide (iOS back/forward cache)
    const onPageShow = () => {
      console.log('[useCompass] Page show event');
      if (!listenerActive.current) {
        window.addEventListener('deviceorientation', onOrientation, { passive: true } as AddEventListenerOptions);
        listenerActive.current = true;
      }
    };

    const onPageHide = () => {
      console.log('[useCompass] Page hide event');
      if (listenerActive.current) {
        window.removeEventListener('deviceorientation', onOrientation as any);
        listenerActive.current = false;
      }
    };

    // Reset smoother when screen orientation changes
    const onOrientationChange = () => {
      console.log('[useCompass] Screen orientation changed, resetting smoother');
      smootherRef.current = makeSmoother(smoothingAlpha);
    };

    // Add all lifecycle listeners
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('orientationchange', onOrientationChange);

    // Heartbeat: Check if events are still coming (iOS debugging)
    const heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastEvent = now - lastEventTime.current;
      
      if (timeSinceLastEvent > 2000) {
        console.warn('[useCompass] ⚠️ No compass events for', timeSinceLastEvent, 'ms - listener may be dead');
        console.log('[useCompass] listenerActive:', listenerActive.current, 'visibility:', document.visibilityState);
      } else {
        console.log('[useCompass] ✓ Heartbeat OK - last event', timeSinceLastEvent, 'ms ago');
      }
    }, 3000); // Check every 3 seconds

    // Cleanup
    return () => {
      console.log('[useCompass] Cleaning up all listeners');
      clearInterval(heartbeatInterval);
      window.removeEventListener('deviceorientation', onOrientation as any);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('orientationchange', onOrientationChange);
      listenerActive.current = false;
    };
  }, [isActive, isEnabled, handleCompass, smoothingAlpha]);

  // Cleanup when disabled
  useEffect(() => {
    if (!isEnabled && isActive) {
      stopCompass();
    }
  }, [isEnabled, isActive, stopCompass]);

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

