'use client';

import { useEffect, useRef } from 'react';
import type { ViewshedData } from './useViewshed';
import { extractContours, contoursToLatLng, simplifyPathLatLng, unifyQuadsToRings } from './viewshedContours';

export function ViewshedOverlay({
  map,
  data,
  strokeColor = '#00FFAA',
  fillColor = '#00FFAA',
  fillOpacity = 0.25,
  holeColor = '#ef4444',
  holeOpacity = 0.12,
  simplifyToleranceM = 3,
}: {
  map: google.maps.Map | undefined;
  data: ViewshedData | null;
  strokeColor?: string;
  fillColor?: string;
  fillOpacity?: number;
  holeColor?: string;
  holeOpacity?: number;
  simplifyToleranceM?: number;
}) {
  const polyRef = useRef<google.maps.Polygon | null>(null);
  const dotRef = useRef<google.maps.Marker | null>(null);
  const holeRefs = useRef<google.maps.Polygon[]>([]);

  function estimateAreaMeters2(rings: google.maps.LatLngLiteral[][], origin: google.maps.LatLngLiteral) {
    if (!rings || rings.length === 0) return 0;
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const lat0 = toRad(origin.lat);
    const lon0 = toRad(origin.lng);
    const cosLat0 = Math.cos(lat0);
    const toXY = (p: google.maps.LatLngLiteral) => ({
      x: R * (toRad(p.lng) - lon0) * cosLat0,
      y: R * (toRad(p.lat) - lat0),
    });
    const polyArea = (pts: google.maps.LatLngLiteral[]) => {
      let a = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = toXY(pts[i]);
        const q = toXY(pts[i + 1]);
        a += p.x * q.y - q.x * p.y;
      }
      return Math.abs(a) / 2;
    };
    return rings.reduce((acc, r) => acc + polyArea(r), 0);
  }

  useEffect(() => {
    if (!map) return;
    // clear old
    polyRef.current?.setMap(null); polyRef.current = null;
    holeRefs.current.forEach(p => p.setMap(null)); holeRefs.current = [];
    dotRef.current?.setMap(null); dotRef.current = null;

    if (!data) return;

    let rings: google.maps.LatLngLiteral[][] = [];
    if (data.quads && data.quads.length > 0) {
      // Build accurate visible area from quads, but collapse to few rings
      rings = unifyQuadsToRings(data.quads, simplifyToleranceM);
    } else if (data.profiles && data.profiles.length > 0) {
      const mask = data.profiles.map(p => p.visible.slice());
      const contours = extractContours(mask, true);
      const latlngRings = contoursToLatLng(contours, data.profiles);
      rings = latlngRings.map(r => simplifyPathLatLng(r, simplifyToleranceM));
    } else if (data.path && data.path.length > 1) {
      // Fallback to endpoints ring
      const path = data.path.slice();
      rings = [simplifyPathLatLng(path, simplifyToleranceM)];
    }

    // Sanity: fallback to endpoint ring if merged rings look suspicious (area too big)
    if (rings.length > 0 && data.path && data.path.length > 2) {
      const areaRings = estimateAreaMeters2(rings, data.origin);
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const lat0 = toRad(data.origin.lat);
      const lon0 = toRad(data.origin.lng);
      const cosLat0 = Math.cos(lat0);
      const toXY = (p: google.maps.LatLngLiteral) => ({
        x: R * (toRad(p.lng) - lon0) * cosLat0,
        y: R * (toRad(p.lat) - lat0),
      });
      const first = data.path[0];
      const dist = Math.hypot(toXY(first).x - 0, toXY(first).y - 0);
      const circleArea = Math.PI * dist * dist;
      if (!Number.isFinite(areaRings) || areaRings <= 0 || areaRings > circleArea * 1.2) {
        rings = [simplifyPathLatLng(data.path.slice(), simplifyToleranceM)];
      }
    }

    if (rings.length > 0) {
      // Build hole contours as merged rings to avoid many small quads
      const holeRings = unifyQuadsToRings((data.holes || []), simplifyToleranceM);
      polyRef.current = new google.maps.Polygon({
        paths: [...rings, ...holeRings],
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor,
        fillOpacity,
        map,
      });
    }

    // Draw merged hole rings on top for visibility (fill-only).
    const mergedHoleRings = unifyQuadsToRings((data.holes || []), simplifyToleranceM);
    if (mergedHoleRings.length > 0) {
      holeRefs.current = mergedHoleRings.map(path => new google.maps.Polygon({
        paths: path,
        strokeOpacity: 0,
        strokeWeight: 0,
        fillColor: holeColor,
        fillOpacity: holeOpacity,
        map,
      }));
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
      holeRefs.current.forEach(p => p.setMap(null)); holeRefs.current = [];
      dotRef.current?.setMap(null); dotRef.current = null;
    };
  }, [map, data, strokeColor, fillColor, fillOpacity, holeColor, holeOpacity, simplifyToleranceM]);

  return null;
}


