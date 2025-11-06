"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

type WakeLockSentinel = any; // Navigator.wakeLock types not in DOM lib in some envs

export function useWakeLock() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const shouldBeActiveRef = useRef(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && !!(navigator as any).wakeLock);
  }, []);

  const acquire = useCallback(async () => {
    try {
      if (!supported) return false;
      if ((document as any).visibilityState !== 'visible') {
        shouldBeActiveRef.current = true;
        return false;
      }
      const wl = await (navigator as any).wakeLock.request('screen');
      sentinelRef.current = wl;
      shouldBeActiveRef.current = true;
      setActive(true);
      wl.addEventListener?.('release', () => {
        setActive(false);
      });
      return true;
    } catch (e) {
      // Some browsers throw when already active or on lock denial
      console.warn('WakeLock acquire failed:', e);
      return false;
    }
  }, [supported]);

  const release = useCallback(async () => {
    try {
      shouldBeActiveRef.current = false;
      if (sentinelRef.current) {
        await sentinelRef.current.release?.();
      }
    } catch (e) {
      console.warn('WakeLock release failed:', e);
    } finally {
      sentinelRef.current = null;
      setActive(false);
    }
  }, []);

  useEffect(() => {
    const onVisibility = async () => {
      if ((document as any).visibilityState === 'visible' && shouldBeActiveRef.current) {
        await acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onVisibility);
    };
  }, [acquire]);

  return { supported, active, acquire, release };
}


