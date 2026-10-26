'use client';

import { useEffect, useRef, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import type L from 'leaflet';

// Hogstflater fra Sentinel-2 (se public/hogst/). Filnavn utledes fra jaktfeltets navn,
// f.eks. "Kongshov skog" -> /hogst/kongshov_skog.geojson
function slugFor(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, '_');
}

const ATTRIBUTION = 'Hogst: Contains modified Copernicus Sentinel data 2024–2026';

interface HogstOverlayProps {
  areaName: string;
  color?: string;
  opacity?: number; // 0-1, fyllopasitet for hogst etter høsten 2025
}

export default function HogstOverlay({ areaName, color = '#eb143c', opacity = 0.35 }: HogstOverlayProps) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  // Nyeste hogst: hel kant. Eldre (høst 2024–25): stiplet kant og halv fyll.
  const styleFor = (feature?: Feature) =>
    feature?.properties?.periode === 'etter_host_2025'
      ? { color, weight: 2, opacity: Math.min(1, opacity + 0.4), fillColor: color, fillOpacity: opacity, dashArray: undefined }
      : { color, weight: 2, opacity: Math.min(1, opacity + 0.2), fillColor: color, fillOpacity: opacity * 0.5, dashArray: '6 4' };

  useEffect(() => {
    layerRef.current?.setStyle((f) => styleFor(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, opacity]);
  const [data, setData] = useState<FeatureCollection | null>(null);
  const slug = slugFor(areaName);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/hogst/${slug}.geojson`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        // Ingen hogstdata for dette feltet (eller offline uten cache)
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    map.attributionControl?.addAttribution(ATTRIBUTION);
    return () => {
      map.attributionControl?.removeAttribution(ATTRIBUTION);
    };
  }, [map, data]);

  // Kun i utvikling med ?demo=...: zoom til hogstflatene når de er lastet
  useEffect(() => {
    if (!data || process.env.NODE_ENV !== 'development') return;
    if (!new URLSearchParams(window.location.search).get('demo')) return;
    const bounds = layerRef.current?.getBounds();
    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, data]);

  if (!data) return null;

  return (
    <GeoJSON
      key={slug}
      ref={layerRef}
      data={data}
      style={styleFor}
      onEachFeature={(feature, layer) => {
        const p = feature.properties || {};
        const periode = p.periode === 'etter_host_2025' ? 'Hogd etter høsten 2025' : 'Hogd høst 2024 – høst 2025';
        layer.bindPopup(
          `<div style="text-align:center"><b>${periode}</b><br/>${p.areal_ha} ha<br/><span style="color:#666">Sentinel-2, observert ${p.observert}</span></div>`
        );
      }}
    />
  );
}
