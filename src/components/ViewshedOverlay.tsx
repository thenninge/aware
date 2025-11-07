'use client';

import { useEffect, useRef } from 'react';
import type { ViewshedData } from './useViewshed';

export function ViewshedOverlay({
  map,
  data,
  strokeColor = '#00FFAA',
  fillColor = '#00FFAA',
}: {
  map: google.maps.Map | undefined;
  data: ViewshedData | null;
  strokeColor?: string;
  fillColor?: string;
}) {
  const polyRef = useRef<google.maps.Polygon | null>(null);
  const dotRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    // clear old
    polyRef.current?.setMap(null);
    polyRef.current = null;
    dotRef.current?.setMap(null);
    dotRef.current = null;

    if (!data) return;
    polyRef.current = new google.maps.Polygon({
      paths: data.path,
      strokeColor,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor,
      fillOpacity: 0.2,
      map,
    });
    // center dot using a symbol circle marker
    dotRef.current = new google.maps.Marker({
      position: data.origin,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: '#ff0000',
        fillOpacity: 1,
        strokeOpacity: 0,
      } as google.maps.Symbol,
      zIndex: 1000,
      map,
    });
    return () => {
      polyRef.current?.setMap(null);
      polyRef.current = null;
      dotRef.current?.setMap(null);
      dotRef.current = null;
    };
  }, [map, data, strokeColor, fillColor]);

  return null;
}


