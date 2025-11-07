'use client';

import { Polygon } from 'react-leaflet';
import type { ViewshedData } from './useViewshed';

export default function ViewshedLeafletOverlay({
  data,
  color = '#00FFAA',
}: {
  data: ViewshedData | null;
  color?: string;
}) {
  if (!data) return null;
  const positions = data.path.map((p) => [p.lat, p.lng]) as [number, number][];
  return (
    <Polygon
      positions={positions}
      pathOptions={{ color, weight: 2, opacity: 0.8, fillColor: color, fillOpacity: 0.2 }}
    />
  );
}


