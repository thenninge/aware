"use client";

import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

export default function GoogleMapLayer({ centerLat, centerLng, zoom }: { centerLat: number; centerLng: number; zoom: number; }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<any>(null);

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
          center: { lat: centerLat, lng: centerLng },
          zoom,
          mapTypeId: 'satellite',
          disableDefaultUI: true,
        });
        googleMapRef.current = map;
        return map;
      })
      .catch((err) => {
        console.error('Failed to load Google Maps:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Sync center/zoom when props change
  useEffect(() => {
    const map = googleMapRef.current;
    if (map && Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      map.setCenter({ lat: centerLat, lng: centerLng });
    }
    if (map && Number.isFinite(zoom)) {
      map.setZoom(zoom);
    }
  }, [centerLat, centerLng, zoom]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}


