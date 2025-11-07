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
      {data.quads && data.quads.length > 0 ? (
        data.quads.map((quad, idx) => (
          <Polygon
            key={`los-quad-${idx}`}
            positions={quad.map(p => [p.lat, p.lng]) as [number, number][]}
            pathOptions={{ color, weight: 1, opacity: 0.5, fillColor: color, fillOpacity: 0.25 }}
          />
        ))
      ) : (
        <Polygon
          positions={data.path.map((p) => [p.lat, p.lng]) as [number, number][]}
          pathOptions={{ color, weight: 2, opacity: 0.8, fillColor: color, fillOpacity: 0.2 }}
        />
      )}
      <CircleMarker
        center={[data.origin.lat, data.origin.lng]}
        radius={5}
        pathOptions={{ color: centerDotColor, fillColor: centerDotColor, fillOpacity: 1, opacity: 1 }}
      />
    </>
  );
}
 

