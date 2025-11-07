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

  useEffect(() => {
    if (!map) return;
    // clear old
    polyRef.current?.setMap(null);
    polyRef.current = null;

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
    return () => {
      polyRef.current?.setMap(null);
      polyRef.current = null;
    };
  }, [map, data, strokeColor, fillColor]);

  return null;
}


