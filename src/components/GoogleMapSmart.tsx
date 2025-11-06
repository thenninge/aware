"use client";

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

type Props = {
  center?: { lat: number; lng: number };
  zoom?: number;
  mapTypeId?: 'satellite' | 'roadmap' | 'hybrid' | 'terrain';
  className?: string;
};

export default function GoogleMapSmart({
  center = { lat: 59.91, lng: 10.75 },
  zoom = 12,
  mapTypeId = 'satellite',
  className,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'loading' | 'ok' | 'error'>('idle');

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    setStatus('waiting');

    let ready = false;

    const hasSize = () => {
      const r = node.getBoundingClientRect();
      return r.width > 20 && r.height > 20 && document.visibilityState === 'visible';
    };

    const init = async () => {
      try {
        setStatus('loading');
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
        if (!apiKey) throw new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
        const loader = new Loader({ apiKey, version: 'weekly' });
        const mapsLib = (await loader.importLibrary('maps')) as any;
        const GMap = mapsLib.Map;
        mapRef.current = new GMap(node, { center, zoom, mapTypeId, disableDefaultUI: true });
        setStatus('ok');
      } catch (e) {
        console.error('Google Maps init error:', e);
        setStatus('error');
      }
    };

    const io = new IntersectionObserver(() => {
      if (!ready && hasSize()) {
        ready = true;
        void init();
      }
    }, { root: null, threshold: 0.01 });

    const ro = new ResizeObserver(() => {
      if (!ready && hasSize()) {
        ready = true;
        void init();
      }
      if (mapRef.current) {
        const c = mapRef.current.getCenter?.();
        // @ts-ignore
        if ((window as any).google?.maps?.event) (window as any).google.maps.event.trigger(mapRef.current, 'resize');
        if (c) mapRef.current.setCenter(c);
      }
    });

    io.observe(node);
    ro.observe(node);

    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, [center.lat, center.lng, zoom, mapTypeId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && mapRef.current) {
        const c = mapRef.current.getCenter?.();
        // @ts-ignore
        if ((window as any).google?.maps?.event) (window as any).google.maps.event.trigger(mapRef.current, 'resize');
        if (c) mapRef.current.setCenter(c);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return (
    <div
      ref={boxRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
      data-status={status}
    />
  );
}


