'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

type LatLng = google.maps.LatLngLiteral;

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function destPoint(o: LatLng, bearing: number, distM: number): LatLng {
  const br = toRad(bearing);
  const φ1 = toRad(o.lat);
  const λ1 = toRad(o.lng);
  const δ = distM / R;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) +
      Math.cos(φ1) * Math.sin(δ) * Math.cos(br)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(br) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

function hav(a: LatLng, b: LatLng) {
  const dφ = toRad(b.lat - a.lat);
  const dλ = toRad(b.lng - a.lng);
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const h =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Bruk Maps JS SDK – ingen CORS
async function fetchProfile(
  origin: google.maps.LatLngLiteral,
  end: google.maps.LatLngLiteral,
  samples: number
) {
  const maybeLib = (google.maps as any).importLibrary?.bind(google.maps);
  let ElevationServiceCtor: any = (google.maps as any).ElevationService;
  if (maybeLib) {
    try {
      const lib = (await (google.maps as any).importLibrary('elevation')) as google.maps.ElevationLibrary;
      if ((lib as any)?.ElevationService) {
        ElevationServiceCtor = (lib as any).ElevationService;
      }
    } catch {
      // fall back
    }
  }
  const svc = ElevationServiceCtor ? new ElevationServiceCtor() : new (google.maps as any).ElevationService();

  return new Promise<Array<{ location: { lat: number; lng: number }; elevation: number }>>((resolve, reject) => {
    svc.getElevationAlongPath(
      { path: [origin, end], samples },
      (results: any, status: any) => {
        if (status === 'OK' && results) {
          resolve(
            results.map((r: any) => ({
              location: { lat: r.location.lat(), lng: r.location.lng() },
              elevation: r.elevation,
            }))
          );
        } else {
          reject(new Error(status));
        }
      }
    );
  });
}

function visibleEndpoint(
  origin: LatLng,
  prof: Array<{ location: LatLng; elevation: number }>,
  hObs: number,
  hTgt: number
) {
  if (!prof.length) return origin;
  const h0 = prof[0].elevation + hObs;
  let maxSlope = -Infinity;
  let vis = 0;
  let prev = prof[0].location;
  let acc = 0;
  const eps = 1e-4;
  for (let i = 1; i < prof.length; i++) {
    const cur = prof[i].location;
    acc += hav(prev, cur);
    const slope = (prof[i].elevation + hTgt - h0) / Math.max(acc, 1e-6);
    if (slope > maxSlope + eps) {
      maxSlope = slope;
      vis = i;
    }
    prev = cur;
  }
  return prof[vis].location;
}

export type ViewshedParams = {
  radiusM?: number;
  rays?: number;
  samples?: number;
  observerHeightM?: number;
  targetHeightM?: number;
  batchSize?: number;
  apiKey: string;
};

type Sample = { location: LatLng; elevation: number };
type RayProfile = { locations: LatLng[]; visible: boolean[] };

function losMaskAlongRay(profile: Sample[], observerHeightM: number, targetHeightM: number) {
  const n = profile.length;
  const visible = new Array<boolean>(n).fill(false);
  if (n === 0) return { visible };
  const h0 = profile[0].elevation + observerHeightM;
  let maxSlope = -Infinity;
  let prev = profile[0].location;
  let acc = 0;
  const eps = 1e-4;
  visible[0] = true;
  for (let i = 1; i < n; i++) {
    const cur = profile[i].location;
    acc += hav(prev, cur);
    const elevTarget = profile[i].elevation + targetHeightM;
    const slope = (elevTarget - h0) / Math.max(acc, 1e-6);
    if (slope > maxSlope + eps) {
      visible[i] = true;
      maxSlope = slope;
    } else {
      visible[i] = false;
    }
    prev = cur;
  }
  return { visible };
}

function buildVisibleQuads(profiles: RayProfile[], closeRing = true) {
  const rays = profiles.length;
  const quads: LatLng[][] = [];
  for (let j = 0; j < rays; j++) {
    const j2 = (j + 1) % rays;
    if (!closeRing && j === rays - 1) break;
    const A = profiles[j];
    const B = profiles[j2];
    if (!A || !B) continue;
    const n = Math.min(A.visible.length, B.visible.length);
    for (let k = 0; k < n - 1; k++) {
      const v00 = A.visible[k];
      const v01 = A.visible[k + 1];
      const v10 = B.visible[k];
      const v11 = B.visible[k + 1];
      if (v00 && v01 && v10 && v11) {
        quads.push([A.locations[k], A.locations[k + 1], B.locations[k + 1], B.locations[k]]);
      }
    }
  }
  return quads;
}

export type ViewshedData = {
  origin: LatLng;
  endpoints: LatLng[];
  path: LatLng[];
  quads?: LatLng[][];
  outlines?: LatLng[][];
};

export function useViewshed(params: ViewshedParams) {
  const {
    radiusM = 200,
    rays = 180,
    samples = 64,
    observerHeightM = 5,
    targetHeightM = 0,
    batchSize = 12,
    apiKey,
  } = params;

  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ViewshedData | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const clear = useCallback(() => {
    setData(null);
    setStatus('idle');
    setError(null);
  }, []);

  const runAt = useCallback(
    async (origin: LatLng) => {
      setStatus('running');
      setError(null);
      abortRef.current = { aborted: false };
      try {
        const endpoints: LatLng[] = new Array(rays);
        const profiles: RayProfile[] = new Array(rays);
        for (let start = 0; start < rays; start += batchSize) {
          if (abortRef.current.aborted) throw new Error('aborted');
          const jobs: Promise<void>[] = [];
          for (let i = start; i < Math.min(start + batchSize, rays); i++) {
            const bearing = (i * 360) / rays;
            const end = destPoint(origin, bearing, radiusM);
            jobs.push((async () => {
              let p;
              const hasGoogle = typeof window !== 'undefined' && (window as any).google && (window as any).google.maps;
              if (hasGoogle) {
                p = await fetchProfile(origin as any, end as any, samples);
              } else {
                const url = new URL('/api/elevation', window.location.origin);
                url.searchParams.set('path', `${origin.lat},${origin.lng}|${end.lat},${end.lng}`);
                url.searchParams.set('samples', String(samples));
                const r = await fetch(url.toString());
                const j = await r.json();
                if (j.status !== 'OK') throw new Error(j.status || 'ELEVATION_ERROR');
                p = j.results as Array<{ location: LatLng; elevation: number }>;
              }
              endpoints[i] = visibleEndpoint(origin, p, observerHeightM, targetHeightM);
              const vis = losMaskAlongRay(p as Sample[], observerHeightM, targetHeightM);
              profiles[i] = { locations: (p as Sample[]).map(s => s.location), visible: vis.visible };
            })());
          }
          await Promise.all(jobs);
        }
        // Use endpoints ring only to avoid a radial seam from origin
        const path = [...endpoints, endpoints[0]];
        const quads = buildVisibleQuads(profiles, true);
        // Build outline segments along visibility transitions
        const outlines: LatLng[][] = [];
        const raysCount = profiles.length;
        for (let j = 0; j < raysCount; j++) {
          const A = profiles[j];
          if (!A) continue;
          // along ray (radial) where visibility toggles between k and k+1
          for (let k = 0; k < A.visible.length - 1; k++) {
            if (A.visible[k] !== A.visible[k + 1]) {
              outlines.push([A.locations[k], A.locations[k + 1]]);
            }
          }
          // across rays at same ring index
          const j2 = (j + 1) % raysCount;
          const B = profiles[j2];
          if (!B) continue;
          const n = Math.min(A.visible.length, B.visible.length);
          for (let k = 0; k < n; k++) {
            if (A.visible[k] !== B.visible[k]) {
              outlines.push([A.locations[k], B.locations[k]]);
            }
          }
        }
        setData({ origin, endpoints, path, quads, outlines });
        setStatus('done');
      } catch (e: any) {
        if (e?.message === 'aborted') return;
        setError(e?.message || 'LOS_ERROR');
        setStatus('error');
      }
    },
    [apiKey, batchSize, observerHeightM, radiusM, rays, samples, targetHeightM]
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


