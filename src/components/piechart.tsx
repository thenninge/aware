'use client';

import { useMemo } from 'react';
import { Polygon } from 'react-leaflet';

interface PlaceData {
  id: number;
  type: string;
  lat: number;
  lng: number;
  name?: string;
  category: string;
  tags: Record<string, string>;
}

interface PieChartProps {
  places: PlaceData[];
  categoryConfigs: Record<string, { color: string; opacity: number; icon: string }>;
  centerLat: number;
  centerLng: number;
  angleRange: number; // in degrees, for ±angleRange
  radius: number; // radius in meters
}

export default function PieChart({
  places,
  categoryConfigs,
  centerLat,
  centerLng,
  angleRange,
  radius
}: PieChartProps) {
  


  const placeDirections = useMemo(() => {
    return places
      .map(place => {
        const lat1 = centerLat * Math.PI / 180;
        const lat2 = place.lat * Math.PI / 180;
        const lng1 = centerLng * Math.PI / 180;
        const lng2 = place.lng * Math.PI / 180;
        
        const dLng = lng2 - lng1;
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        const normalizedBearing = (bearing + 360) % 360;
        
        const distance = Math.sqrt(
          Math.pow((place.lat - centerLat) * 111000, 2) + 
          Math.pow((place.lng - centerLng) * 111000 * Math.cos(centerLat * Math.PI / 180), 2)
        );

        return {
          ...place,
          bearing: normalizedBearing,
          distance
        };
      })
      .filter(place => place.distance <= radius);
  }, [places, centerLat, centerLng, radius]);

  const directionGroups = useMemo(() => {
    const groups: Array<{
      startAngle: number;
      endAngle: number;
      category: string;
      color: string;
      opacity: number;
    }> = [];

    placeDirections.forEach(place => {
      const startAngle = place.bearing - angleRange;
      const endAngle = place.bearing + angleRange;
      const config = categoryConfigs[place.category];

      groups.push({
        startAngle,
        endAngle,
        category: place.category,
        color: config?.color || '#999',
        opacity: config?.opacity || 0.8
      });
    });

    return groups;
  }, [placeDirections, angleRange, categoryConfigs]);

  if (places.length === 0) return null;

  return (
    <>
      {directionGroups.map((group, index) => {
        const points: [number, number][] = [];
        points.push([centerLat, centerLng]); // center of the pie

        // create arc points
        const step = 5; // degrees between points on the arc
        for (let angle = group.startAngle; angle <= group.endAngle; angle += step) {
          const rad = (angle * Math.PI) / 180;
          const lat = centerLat + (radius * Math.cos(rad)) / 111000;
          const lng = centerLng + (radius * Math.sin(rad)) / (111000 * Math.cos(centerLat * Math.PI / 180));
          points.push([lat, lng]);
        }

        // close back to center
        points.push([centerLat, centerLng]);

        return (
          <Polygon
            key={`slice-${index}`}
            positions={points}
            pathOptions={{
              color: group.color,
              fillColor: group.color,
              fillOpacity: group.opacity,
              weight: 1,
            }}
          />
        );
      })}
    </>
  );
}
