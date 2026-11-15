import type { LatLngBoundsExpression } from 'leaflet';
import type { GeoBounds } from '@/lib/geo/tiles';

export type CustomHuntingImagery = {
  id: string;
  /** Match mot jaktfeltnavn på laget, f.eks. "Kongshov skog". */
  match: RegExp;
  tileUrl: string;
  layerKey: string;
  bounds: GeoBounds;
  minZoom: number;
  maxNativeZoom: number;
  attribution: string;
};

/**
 * Eget flyfoto som XYZ-fliser over jaktfeltet (Google-satellitt-laget).
 * Dulpetorpet legges inn her når underlaget er klart.
 *
 * Kongshov-bounds er georeferert mot hogstflatene i
 * public/hogst/kongshov_skog.geojson. Fliser: public/imagery/<id>/{z}/{x}/{y}.png
 */
export const CUSTOM_HUNTING_IMAGERY: CustomHuntingImagery[] = [
  {
    id: 'kongshov',
    match: /kongshov/i,
    tileUrl: '/imagery/kongshov/{z}/{x}/{y}.png',
    layerKey: 'imagery_kongshov',
    bounds: {
      south: 60.414954,
      west: 12.383394,
      north: 60.458911,
      east: 12.469397,
    },
    minZoom: 11,
    maxNativeZoom: 15,
    attribution: 'Flyfoto Kongshov 2022–2025',
  },
];

export function customImageryForHuntingAreas(
  names: string[] | undefined | null
): CustomHuntingImagery[] {
  if (!names?.length) return [];
  return CUSTOM_HUNTING_IMAGERY.filter((cfg) => names.some((name) => cfg.match.test(name)));
}

export function leafletBounds(cfg: CustomHuntingImagery): LatLngBoundsExpression {
  return [
    [cfg.bounds.south, cfg.bounds.west],
    [cfg.bounds.north, cfg.bounds.east],
  ];
}

export function imageryTileUrl(
  cfg: CustomHuntingImagery,
  z: number,
  x: number,
  y: number
): string {
  return cfg.tileUrl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}
