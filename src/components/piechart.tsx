"use client";

import { useMemo } from 'react';
import { Polygon } from 'react-leaflet';

type Tags = Record<string, string>;

export interface PlaceData {
  id: number;
  type: string;
  lat: number;
  lng: number;
  name?: string;
  category: string;
  tags: Tags;
}

export interface CategoryConfig {
  color: string;
  opacity: number;
  icon: string;
}

interface CategoryFilter {
  city: boolean;
  town: boolean;
  village: boolean;
  hamlet: boolean;
  farm: boolean;
  isolated_dwelling: boolean;
}

interface PieChartProps {
  places: PlaceData[] | undefined | null;
  categoryConfigs: Record<string, CategoryConfig> | undefined | null;
  categoryFilters?: CategoryFilter;
  centerLat: number;
  centerLng: number;
  angleRange: number; // ± degrees
  radius: number; // meters
  stepDeg?: number; // resolution of arc (default 4°)
  globalOpacity?: number; // optional user override multiplier (0..1)
}

const clampOpacity = (v: number) => Math.max(0, Math.min(1, v));
const toRad = (deg: number) => (deg * Math.PI) / 180;
const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

function arcPoints(
  centerLat: number,
  centerLng: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  stepDeg: number
): [number, number][] {
  const points: [number, number][] = [];

  const a0 = norm360(startAngleDeg);
  let a1 = norm360(endAngleDeg);
  if (a1 < a0) a1 += 360; // wrap over 360

  const step = Math.max(0.5, stepDeg); // avoid 0 / too fine
  for (let a = a0; a <= a1 + 1e-6; a += step) {
    const rad = toRad(norm360(a));
    const lat = centerLat + (radius * Math.cos(rad)) / 111000;
    const lng = centerLng + (radius * Math.sin(rad)) / (111000 * Math.cos(toRad(centerLat)));
    points.push([lat, lng]);
  }
  return points;
}

export default function PieChart(props: PieChartProps) {
  const {
    places,
    categoryConfigs,
    categoryFilters,
    centerLat,
    centerLng,
    angleRange,
    radius,
    stepDeg = 4,
    globalOpacity,
  } = props;

  const safePlaces = useMemo<PlaceData[]>(
    () => (Array.isArray(places) ? places : []),
    [places]
  );

  const cfg = useMemo<Record<string, CategoryConfig>>(
    () => (categoryConfigs ?? {}),
    [categoryConfigs]
  );

  const placeDirections = useMemo(
    () =>
      safePlaces.map((place) => {
        const lat1 = toRad(centerLat);
        const lat2 = toRad(place.lat);
        const dLng = toRad(place.lng - centerLng);

        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        const bearing = (Math.atan2(y, x) * 180) / Math.PI;
        const normalizedBearing = norm360(bearing);

        const dy = (place.lat - centerLat) * 111000;
        const dx =
          (place.lng - centerLng) * 111000 * Math.cos(toRad(centerLat));
        const distance = Math.sqrt(dx * dx + dy * dy);

        return { ...place, bearing: normalizedBearing, distance };
      }),
    [safePlaces, centerLat, centerLng]
  );

  const slices = useMemo(() => {
    return placeDirections
      .filter((p) => {
        // Filter by distance
        if (!Number.isFinite(p.distance) || p.distance > radius) return false;
        
        // Filter by category filter
        if (categoryFilters && p.category in categoryFilters) {
          return categoryFilters[p.category as keyof CategoryFilter];
        }
        
        return true;
      })
      .map((p) => {
        const startAngle = p.bearing - angleRange;
        const endAngle = p.bearing + angleRange;

        const catCfg = cfg[p.category];
        const color = catCfg?.color ?? '#999999';
        const baseOpacity = catCfg?.opacity ?? 0.3;
        const fillOpacity = clampOpacity(
          (globalOpacity ?? 1) * baseOpacity
        );

        const edge = arcPoints(centerLat, centerLng, radius, startAngle, endAngle, stepDeg);
        const positions: [number, number][] = [
          [centerLat, centerLng],
          ...edge,
          [centerLat, centerLng],
        ];

        return {
          key: `slice-${p.id}-${p.bearing.toFixed(2)}`,
          positions,
          color,
          fillOpacity,
        };
      });
  }, [placeDirections, radius, angleRange, cfg, centerLat, centerLng, stepDeg, globalOpacity, categoryFilters]);

  // Render (kan returnere null etter hooks er kalt)
  if (slices.length === 0) return null;

  return (
    <>
      {slices.map((s) => (
        <Polygon
          key={s.key}
          positions={Array.isArray(s.positions) ? s.positions : []}
          pathOptions={{
            fillColor: s.color,
            fillOpacity: s.fillOpacity,
            weight: 0,
            color: 'transparent',
          }}
        />
      ))}
    </>
  );
}
