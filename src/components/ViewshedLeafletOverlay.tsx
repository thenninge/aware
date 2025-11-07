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
  const positions = data.path.map((p) => [p.lat, p.lng]) as [number, number][];
  return (
    <>
      <Polygon
        positions={positions}
        pathOptions={{ color, weight: 2, opacity: 0.8, fillColor: color, fillOpacity: 0.2 }}
      />
      <CircleMarker
        center={[data.origin.lat, data.origin.lng]}
        radius={5}
        pathOptions={{ color: centerDotColor, fillColor: centerDotColor, fillOpacity: 1, opacity: 1 }}
      />
    </>
  );
}
 

