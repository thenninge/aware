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
  mode?: 'aware' | 'track';
}

export default function PieChart(props: PieChartProps) {
  if (props.mode === 'track') return null;
  


  const placeDirections = useMemo(() => {
    return props.places
      .map(place => {
        const lat1 = props.centerLat * Math.PI / 180;
        const lat2 = place.lat * Math.PI / 180;
        const lng1 = props.centerLng * Math.PI / 180;
        const lng2 = place.lng * Math.PI / 180;
        
        const dLng = lng2 - lng1;
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        const normalizedBearing = (bearing + 360) % 360;
        
        const distance = Math.sqrt(
          Math.pow((place.lat - props.centerLat) * 111000, 2) + 
          Math.pow((place.lng - props.centerLng) * 111000 * Math.cos(props.centerLat * Math.PI / 180), 2)
        );

        return {
          ...place,
          bearing: normalizedBearing,
          distance
        };
      })
      .filter(place => place.distance <= props.radius);
  }, [props.places, props.centerLat, props.centerLng, props.radius]);

  // Helper function to convert hex to rgba
  // const hexToRgba = (hex: string, opacity: number) => {
  //   const r = parseInt(hex.slice(1, 3), 16);
  //   const g = parseInt(hex.slice(3, 5), 16);
  //   const b = parseInt(hex.slice(5, 7), 16);
  //   const rgbaColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  //   console.log(`Converting ${hex} with opacity ${opacity} to ${rgbaColor}`); // Debug log
  //   return rgbaColor;
  // };

  const directionGroups = useMemo(() => {
    const groups: Array<{
      startAngle: number;
      endAngle: number;
      category: string;
      color: string;
      opacity: number;
    }> = [];

    placeDirections.forEach(place => {
      const startAngle = place.bearing - props.angleRange;
      const endAngle = place.bearing + props.angleRange;
      const config = props.categoryConfigs[place.category];
      
      groups.push({
        startAngle,
        endAngle,
        category: place.category,
        color: config?.color || '#999', // hex only
        opacity: config?.opacity ?? 0.8
      });
    });

    return groups;
  }, [placeDirections, props.angleRange, props.categoryConfigs]);

  const safePlaces = Array.isArray(props.places) ? props.places : [];
  if (safePlaces.length === 0) return null;

  return (
    <>
      {directionGroups.map((group, index) => {
        const points: [number, number][] = [];
        points.push([props.centerLat, props.centerLng]); // center of the pie

        // create arc points
        const step = 5; // degrees between points on the arc
        for (let angle = group.startAngle; angle <= group.endAngle; angle += step) {
          const rad = (angle * Math.PI) / 180;
          const lat = props.centerLat + (props.radius * Math.cos(rad)) / 111000;
          const lng = props.centerLng + (props.radius * Math.sin(rad)) / (111000 * Math.cos(props.centerLat * Math.PI / 180));
          points.push([lat, lng]);
        }

        // close back to center
        points.push([props.centerLat, props.centerLng]);

        return (
          <Polygon
            key={`slice-${index}`}
            positions={points}
            pathOptions={{
              color: group.color,
              fillColor: group.color,
              fillOpacity: group.opacity,
              weight: 0,
            }}
          />
        );
      })}
    </>
  );
}
