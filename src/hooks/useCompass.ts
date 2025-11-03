import { useState, useCallback, useEffect, useRef } from 'react';

interface Position {
  lat: number;
  lng: number;
  heading?: number;
}

interface UseCompassOptions {
  isEnabled: boolean;
  onHeadingChange?: (heading: number) => void;
  averagingSamples?: number; // Number of samples to average (default 3)
  throttleMs?: number; // Throttle updates (default 100ms)
}

interface UseCompassReturn {
  isActive: boolean;
  currentHeading: number | null;
  lastValidHeading: number | null;
  startCompass: () => Promise<void>;
  stopCompass: () => void;
  isSupported: boolean;
  permissionState: 'unknown' | 'granted' | 'denied' | 'not-required';
}

export function useCompass({
  isEnabled,
  onHeadingChange,
  averagingSamples = 3,
  throttleMs = 100,
}: UseCompassOptions): UseCompassReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [lastValidHeading, setLastValidHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied' | 'not-required'>('unknown');
  
  const headingHistory = useRef<number[]>([]);
  const lastUpdateTime = useRef<number>(0);
  const isSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  // Compass event handler
  const handleCompass = useCallback((event: DeviceOrientationEvent) => {
    console.log('[useCompass] Compass event received:', {
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      webkitCompassHeading: (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading,
      absolute: event.absolute
    });
    
    let heading: number | null = null;

    // iOS Safari har webkitCompassHeading (0 = nord, med klokka)
    const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    if (webkitHeading !== undefined && webkitHeading !== null) {
      heading = webkitHeading;
      console.log('[useCompass] Using webkitCompassHeading:', heading);
    } else if (event.alpha !== null) {
      // Android / Chrome - inverter for å få med klokka
      heading = 360 - event.alpha;
      console.log('[useCompass] Using alpha:', event.alpha, '-> heading:', heading);
    }

    if (heading !== null && !isNaN(heading)) {
      heading = (heading + 360) % 360;
      
      // Throttle oppdateringer
      const now = Date.now();
      if (now - lastUpdateTime.current < throttleMs) {
        return;
      }
      lastUpdateTime.current = now;
      
      // Lagre for debugging
      setLastValidHeading(heading);
      
      // Beregn gjennomsnitt for stabilisering
      const currentHistory = headingHistory.current;
      const allReadings = [...currentHistory, heading];
      const avgHeading = allReadings.reduce((sum, h) => sum + h, 0) / allReadings.length;
      
      // Oppdater historikk
      headingHistory.current = [...currentHistory, heading].slice(-averagingSamples);
      
      // Oppdater current heading
      setCurrentHeading(avgHeading);
      onHeadingChange?.(avgHeading);
      
      console.log('[useCompass] Heading updated:', { raw: heading, averaged: avgHeading });
    } else {
      console.log('[useCompass] Invalid compass data:', { webkitHeading, alpha: event.alpha });
    }
  }, [onHeadingChange, throttleMs, averagingSamples]);

  // Start compass function
  const startCompass = useCallback(async () => {
    if (!isSupported) {
      console.warn('[useCompass] DeviceOrientationEvent not available');
      throw new Error('Kompass ikke støttet på denne enheten');
    }

    try {
      // Request permission on iOS 13+ - må trigges av brukerklikk
      const requestPermission = (DeviceOrientationEvent as typeof DeviceOrientationEvent & { 
        requestPermission?: () => Promise<string> 
      }).requestPermission;
      
      if (typeof requestPermission === 'function') {
        console.log('[useCompass] Requesting iOS compass permission...');
        try {
          const response = await requestPermission();
          if (response === 'granted') {
            console.log('[useCompass] iOS compass permission granted');
            setPermissionState('granted');
            setIsActive(true);
          } else {
            console.warn('[useCompass] iOS compass permission denied:', response);
            setPermissionState('denied');
            throw new Error('Ingen tilgang til kompass');
          }
        } catch (err) {
          console.error('[useCompass] Error requesting iOS compass permission:', err);
          setPermissionState('denied');
          throw new Error('Kunne ikke be om kompass-tillatelse');
        }
      } else {
        // Android eller gamle iOS – bare start kompass
        console.log('[useCompass] No permission required, starting compass');
        setPermissionState('not-required');
        setIsActive(true);
      }
    } catch (error) {
      console.error('[useCompass] Error starting compass:', error);
      throw error;
    }
  }, [isSupported]);

  // Stop compass function
  const stopCompass = useCallback(() => {
    console.log('[useCompass] Stopping compass');
    setIsActive(false);
    headingHistory.current = [];
    lastUpdateTime.current = 0;
    setCurrentHeading(null);
  }, []);

  // Event listener management
  useEffect(() => {
    if (!isActive || !isEnabled) {
      return;
    }

    console.log('[useCompass] Adding deviceorientation listener');
    const listener = (e: DeviceOrientationEvent) => handleCompass(e);
    window.addEventListener('deviceorientation', listener, true);

    return () => {
      console.log('[useCompass] Removing deviceorientation listener');
      window.removeEventListener('deviceorientation', listener, true);
    };
  }, [isActive, isEnabled, handleCompass]);

  // Cleanup when disabled
  useEffect(() => {
    if (!isEnabled && isActive) {
      stopCompass();
    }
  }, [isEnabled, isActive, stopCompass]);

  return {
    isActive,
    currentHeading,
    lastValidHeading,
    startCompass,
    stopCompass,
    isSupported,
    permissionState,
  };
}

