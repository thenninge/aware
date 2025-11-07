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
  const outlineRef = useRef<google.maps.Polygon | null>(null);
  const quadRefs = useRef<google.maps.Polygon[]>([]);
  const wedgeRef = useRef<google.maps.Polygon | null>(null);
  const internalOutlineRefs = useRef<google.maps.Polygon[]>([]);
  const holeRefs = useRef<google.maps.Polygon[]>([]);
  const dotRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    // clear old
    outlineRef.current?.setMap(null); outlineRef.current = null;
    quadRefs.current.forEach(p => p.setMap(null)); quadRefs.current = [];
    wedgeRef.current?.setMap(null); wedgeRef.current = null;
    internalOutlineRefs.current.forEach(p => p.setMap(null)); internalOutlineRefs.current = [];
    holeRefs.current.forEach(p => p.setMap(null)); holeRefs.current = [];
    dotRef.current?.setMap(null);
    dotRef.current = null;

    if (!data) return;
    // Outer outline stroke only
    if (data.path && data.path.length > 1) {
      outlineRef.current = new google.maps.Polygon({
        paths: data.path,
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillOpacity: 0,
        map,
      });
    }
    if (data.quads && data.quads.length > 0) {
      quadRefs.current = data.quads.map(path => new google.maps.Polygon({
        paths: path,
        strokeOpacity: 0,
        strokeWeight: 0,
        fillColor,
        fillOpacity: 0.25,
        map
      }));
    } else {
      wedgeRef.current = new google.maps.Polygon({
        paths: data.path,
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor,
        fillOpacity: 0.2,
        map,
      });
    }
    // Internal hole outlines (stroke only)
    // Replaced by holes fill
    if (data.holes && data.holes.length > 0) {
      holeRefs.current = data.holes.map(path => new google.maps.Polygon({
        paths: path,
        strokeColor: '#ef4444',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.12,
        map
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
      outlineRef.current?.setMap(null); outlineRef.current = null;
      quadRefs.current.forEach(p => p.setMap(null)); quadRefs.current = [];
      wedgeRef.current?.setMap(null); wedgeRef.current = null;
      internalOutlineRefs.current.forEach(p => p.setMap(null)); internalOutlineRefs.current = [];
      holeRefs.current.forEach(p => p.setMap(null)); holeRefs.current = [];
      dotRef.current?.setMap(null);
      dotRef.current = null;
    };
  }, [map, data, strokeColor, fillColor]);

  return null;
}


