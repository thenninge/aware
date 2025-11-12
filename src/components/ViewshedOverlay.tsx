'use client';

import { useEffect, useRef } from 'react';
import type { ViewshedData } from './useViewshed';
import { extractContours, contoursToLatLng, simplifyPathLatLng } from './viewshedContours';

export function ViewshedOverlay({
  map,
  data,
  strokeColor = '#00FFAA',
  fillColor = '#00FFAA',
  fillOpacity = 0.25,
  simplifyToleranceM = 3,
}: {
  map: google.maps.Map | undefined;
  data: ViewshedData | null;
  strokeColor?: string;
  fillColor?: string;
  fillOpacity?: number;
  simplifyToleranceM?: number;
}) {
  const polyRef = useRef<google.maps.Polygon | null>(null);
  const dotRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    // clear old
    polyRef.current?.setMap(null); polyRef.current = null;
    dotRef.current?.setMap(null); dotRef.current = null;

    if (!data) return;

    let rings: google.maps.LatLngLiteral[][] = [];
    if (data.profiles && data.profiles.length > 0) {
      const mask = data.profiles.map(p => p.visible.slice());
      const contours = extractContours(mask, true);
      const latlngRings = contoursToLatLng(contours, data.profiles);
      rings = latlngRings.map(r => simplifyPathLatLng(r, simplifyToleranceM));
    } else if (data.path && data.path.length > 1) {
      // Fallback to endpoints ring
      const path = data.path.slice();
      rings = [simplifyPathLatLng(path, simplifyToleranceM)];
    }

    if (rings.length > 0) {
      polyRef.current = new google.maps.Polygon({
        paths: rings,
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor,
        fillOpacity,
        map,
      });
    }

    // center dot using a symbol circle marker
    dotRef.current = new google.maps.Marker({
      position: data.origin,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 2.5,
        fillColor: '#ff0000',
        fillOpacity: 1,
        strokeOpacity: 0,
      } as google.maps.Symbol,
      zIndex: 1000,
      map,
    });
    return () => {
      polyRef.current?.setMap(null); polyRef.current = null;
      dotRef.current?.setMap(null); dotRef.current = null;
    };
  }, [map, data, strokeColor, fillColor, fillOpacity, simplifyToleranceM]);

  return null;
}


