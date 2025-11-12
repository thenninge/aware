'use client';

import { Polygon, CircleMarker } from 'react-leaflet';
import type { ViewshedData } from './useViewshed';
import { extractContours, contoursToLatLng, simplifyPathLatLng, unifyQuadsToRings } from './viewshedContours';

export default function ViewshedLeafletOverlay({
  data,
  color = '#00FFAA',
  holeColor = '#ef4444',
  visibleOpacity = 0.25,
  holeOpacity = 0.12,
  centerDotColor = '#ff0000',
  simplifyToleranceM = 3,
}: {
  data: ViewshedData | null;
  color?: string;
  holeColor?: string;
  visibleOpacity?: number;
  holeOpacity?: number;
  centerDotColor?: string;
  simplifyToleranceM?: number;
}) {
  if (!data) return null;

  // Build simplified contour rings (visible area)
  let rings: Array<Array<[number, number]>> = [];
  if (data.quads && data.quads.length > 0) {
    const merged = unifyQuadsToRings(data.quads, simplifyToleranceM);
    // Sanity: if merged is empty, fallback to endpoint ring
    if (merged.length === 0 && data.path && data.path.length > 1) {
      const path = simplifyPathLatLng(data.path, simplifyToleranceM);
      rings = [path.map(p => [p.lat, p.lng]) as [number, number][]];
    } else {
      rings = merged.map(r => r.map(p => [p.lat, p.lng]) as [number, number][]);
    }
  } else if (data.profiles && data.profiles.length > 0) {
    const mask = data.profiles.map(p => p.visible.slice());
    const contours = extractContours(mask, true);
    const latlngRings = contoursToLatLng(contours, data.profiles);
    rings = latlngRings
      .map(r => simplifyPathLatLng(r, simplifyToleranceM))
      .map(r => r.map(p => [p.lat, p.lng]) as [number, number][]);
  } else if (data.path && data.path.length > 1) {
    const path = simplifyPathLatLng(data.path, simplifyToleranceM);
    rings = [path.map(p => [p.lat, p.lng]) as [number, number][]];
  }

  // Focus on drawing only green visible area; non-visible inside circle is transparent

  return (
    <>
      {/* Visible area as one or few simplified rings with stroke + fill */}
      {rings.map((ring, idx) => (
        <Polygon
          key={`los-ring-${idx}`}
          positions={ring}
          color={color}
          weight={2}
          opacity={0.8}
          fillColor={color}
          fillOpacity={visibleOpacity}
        />
      ))}

      {/* No red hole overlays – transparency shows where LOS is missing */}

      {/* Center dot */}
      <CircleMarker
        center={[data.origin.lat, data.origin.lng]}
        radius={2.5}
        pathOptions={{ color: centerDotColor, fillColor: centerDotColor, fillOpacity: 1, opacity: 1 }}
      />
    </>
  );
}
 

