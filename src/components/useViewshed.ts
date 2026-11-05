'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { getMapService } from '@/lib/map/MapService';
import type { ViewshedData, ViewshedParams as TerrainViewshedParams } from '@/lib/terrain/los';

export type { ViewshedData } from '@/lib/terrain/los';

export type ViewshedParams = TerrainViewshedParams;

export function useViewshed(params: ViewshedParams) {
  const {
    radiusM = 350,
    rays = 180,
    samples = 64,
    observerHeightM = 5,
    targetHeightM = 0,
  } = params;

  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ViewshedData | null>(null);
  const abortRef = useRef({ aborted: false });

  const clear = useCallback(() => {
    setData(null);
    setStatus('idle');
    setError(null);
  }, []);

  const runAt = useCallback(
    async (origin: { lat: number; lng: number }) => {
      setStatus('running');
      setError(null);
      abortRef.current = { aborted: false };
      try {
        const result = await getMapService().calculateLOS(origin, {
          radiusM,
          rays,
          samples,
          observerHeightM,
          targetHeightM,
        });
        if (abortRef.current.aborted) return;
        setData(result);
        setStatus('done');
      } catch (e: unknown) {
        if (abortRef.current.aborted) return;
        const message = e instanceof Error ? e.message : 'LOS_ERROR';
        setError(message);
        setStatus('error');
      }
    },
    [observerHeightM, radiusM, rays, samples, targetHeightM]
  );

  const cancel = useCallback(() => {
    abortRef.current.aborted = true;
  }, []);

  const meta = useMemo(
    () => ({ radiusM, rays, samples, observerHeightM, targetHeightM }),
    [radiusM, rays, samples, observerHeightM, targetHeightM]
  );

  return { status, error, data, runAt, cancel, clear, meta };
}
