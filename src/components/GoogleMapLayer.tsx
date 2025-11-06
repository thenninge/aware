"use client";

import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

export default function GoogleMapLayer() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      console.warn('Google Maps API key missing (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)');
      return;
    }
    if (!mapRef.current) return;

    const loader = new Loader({ apiKey, version: 'weekly' });
    let isCancelled = false;

    loader
      .load()
      .then((google: any) => {
        if (isCancelled || !mapRef.current) return;
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 59.91, lng: 10.75 },
          zoom: 12,
          mapTypeId: 'satellite',
          disableDefaultUI: true,
        });
        return map;
      })
      .catch((err) => {
        console.error('Failed to load Google Maps:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}


