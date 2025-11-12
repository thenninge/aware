'use client';

import { Polygon, CircleMarker } from 'react-leaflet';
import type { ViewshedData } from './useViewshed';
import { extractContours, contoursToLatLng, simplifyPathLatLng } from './viewshedContours';

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
  if (data.profiles && data.profiles.length > 0) {
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

  // Prepare hole rings for diff rendering
  const holeRings: Array<Array<[number, number]>> =
    (data.holes || []).map(poly => poly.map(p => [p.lat, p.lng]) as [number, number][]);

  return (
    <>
      {/* Visible area as one or few simplified rings with stroke + fill; include holes as "cutouts" */}
      {rings.map((ring, idx) => {
        const positions = [ring, ...holeRings] as unknown as Array<Array<[number, number]>>;
        return (
          <Polygon
            key={`los-ring-${idx}`}
            positions={positions}
            color={color}
            weight={2}
            opacity={0.8}
            fillColor={color}
            fillOpacity={visibleOpacity}
          />
        );
      })}

      {/* Non-visible holes: soft red fill, no stroke */}
      {data.holes && data.holes.map((quad, idx) => (
        <Polygon
          key={`los-hole-${idx}`}
          positions={quad.map(p => [p.lat, p.lng]) as [number, number][]}
          color={holeColor}
          weight={0}
          opacity={0}
          fillColor={holeColor}
          fillOpacity={holeOpacity}
        />
      ))}

      {/* Center dot */}
      <CircleMarker
        center={[data.origin.lat, data.origin.lng]}
        radius={2.5}
        pathOptions={{ color: centerDotColor, fillColor: centerDotColor, fillOpacity: 1, opacity: 1 }}
      />
    </>
  );
}
 

