'use client';

import { Polygon, CircleMarker } from 'react-leaflet';
import type { ViewshedData } from './useViewshed';

export default function ViewshedLeafletOverlay({
  data,
  color = '#00FFAA',
  holeColor = '#ef4444',
  visibleOpacity = 0.25,
  holeOpacity = 0.12,
  centerDotColor = '#ff0000',
}: {
  data: ViewshedData | null;
  color?: string;
  holeColor?: string;
  visibleOpacity?: number;
  holeOpacity?: number;
  centerDotColor?: string;
}) {
  if (!data) return null;
  return (
    <>
      {/* Outer outline: stroke only, no fill */}
      {data.path && data.path.length > 1 && (
        <Polygon
          positions={data.path.map((p) => [p.lat, p.lng]) as [number, number][]}
          color={color}
          weight={2}
          opacity={0.8}
          fillOpacity={0}
        />
      )}
      {/* Visible quads: fill only, no internal strokes */}
      {data.quads && data.quads.length > 0 ? (
        data.quads.map((quad, idx) => (
          <Polygon
            key={`los-quad-${idx}`}
            positions={quad.map(p => [p.lat, p.lng]) as [number, number][]}
            color={color}
            weight={0}
            opacity={0}
            fillColor={color}
            fillOpacity={visibleOpacity}
          />
        ))
      ) : (
        // Fallback: draw full wedge with stroke+fill (legacy)
        <Polygon
          positions={data.path.map((p) => [p.lat, p.lng]) as [number, number][]}
          color={color}
          weight={2}
          opacity={0.8}
          fillColor={color}
          fillOpacity={visibleOpacity}
        />
      )}
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
      <CircleMarker
        center={[data.origin.lat, data.origin.lng]}
        radius={2.5}
        pathOptions={{ color: centerDotColor, fillColor: centerDotColor, fillOpacity: 1, opacity: 1 }}
      />
    </>
  );
}
 

