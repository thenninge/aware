'use client';

import { Polygon, CircleMarker } from 'react-leaflet';
import type { ViewshedData } from './useViewshed';

export default function ViewshedLeafletOverlay({
  data,
  color = '#00FFAA',
  centerDotColor = '#ff0000',
}: {
  data: ViewshedData | null;
  color?: string;
  centerDotColor?: string;
}) {
  if (!data) return null;
  return (
    <>
      {/* Outer outline: stroke only, no fill */}
      {data.path && data.path.length > 1 && (
        <Polygon
          positions={data.path.map((p) => [p.lat, p.lng]) as [number, number][]}
          pathOptions={{ color, weight: 2, opacity: 0.8, fillOpacity: 0 }}
        />
      )}
      {/* Visible quads: fill only, no internal strokes */}
      {data.quads && data.quads.length > 0 ? (
        data.quads.map((quad, idx) => (
          <Polygon
            key={`los-quad-${idx}`}
            positions={quad.map(p => [p.lat, p.lng]) as [number, number][]}
            pathOptions={{ color, weight: 0, opacity: 0, fillColor: color, fillOpacity: 0.25 }}
          />
        ))
      ) : (
        // Fallback: draw full wedge with stroke+fill (legacy)
        <Polygon
          positions={data.path.map((p) => [p.lat, p.lng]) as [number, number][]}
          pathOptions={{ color, weight: 2, opacity: 0.8, fillColor: color, fillOpacity: 0.2 }}
        />
      )}
      {/* Non-visible holes: soft red fill, no stroke */}
      {data.holes && data.holes.map((quad, idx) => (
        <Polygon
          key={`los-hole-${idx}`}
          positions={quad.map(p => [p.lat, p.lng]) as [number, number][]}
          pathOptions={{ color: '#ef4444', weight: 2, opacity: 0.8, fillColor: '#ef4444', fillOpacity: 0.12 }}
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
 

