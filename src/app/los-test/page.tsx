'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useViewshed } from '@/components/useViewshed';
import { ViewshedOverlay } from '@/components/ViewshedOverlay';

export default function LosTestPage() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map>();

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined;

  const los = useViewshed({
    apiKey: apiKey || '',
    radiusM: 200,
    rays: 180,
    samples: 64,
    observerHeightM: 5,
    targetHeightM: 0,
    batchSize: 12,
  });

  useEffect(() => {
    (async () => {
      if (!mapDiv.current) return;
      const loader = new Loader({ apiKey: apiKey || '', version: 'weekly' });
      const { Map } = (await loader.importLibrary('maps')) as google.maps.MapsLibrary;
      setMap(
        new Map(mapDiv.current, {
          center: { lat: 59.91, lng: 10.75 },
          zoom: 14,
          mapTypeId: 'satellite',
          gestureHandling: 'greedy',
        })
      );
    })();
  }, [apiKey]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      if (los.status === 'running') return;
      los.clear();
      los.runAt({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
    return () => listener.remove();
  }, [map, los]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />
      <ViewshedOverlay map={map} data={los.data} />
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 5,
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 12,
          color: '#111827',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>LOS-test</div>
        {!apiKey && (
          <div style={{ color: '#b91c1c' }}>Mangler NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</div>
        )}
        <div>Radius: {los.meta.radiusM} m</div>
        <div>Rays: {los.meta.rays}</div>
        <div>Samples: {los.meta.samples}</div>
        <div>hObs: {los.meta.observerHeightM} m</div>
        <div>hTgt: {los.meta.targetHeightM} m</div>
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => los.clear()}
            disabled={los.status === 'running'}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc' }}
          >
            {los.status === 'running' ? 'Beregner…' : 'Tøm LOS'}
          </button>
        </div>
        <div style={{ marginTop: 6, color: '#374151' }}>
          Klikk i kartet for LOS
        </div>
        {los.error && (
          <div style={{ marginTop: 6, color: '#b91c1c' }}>
            Feil: {los.error}
          </div>
        )}
      </div>
    </div>
  );
}


