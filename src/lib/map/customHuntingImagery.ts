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
 * Kongshov-bildet er i UTM33 (EPSG:25833) og georeferert mot vann/veier i
 * Kartverkets topokart. scripts/slice-hunting-imagery.py reprojiserer det til
 * Web Mercator-fliser: public/imagery/<id>/{z}/{x}/{y}.png. `bounds` er bare
 * flisenes ytre ramme (fra skriptets utskrift); selve plasseringen ligger i flisene.
 */
export const CUSTOM_HUNTING_IMAGERY: CustomHuntingImagery[] = [
  {
    id: 'kongshov',
    match: /kongshov/i,
    tileUrl: '/imagery/kongshov/{z}/{x}/{y}.png',
    layerKey: 'imagery_kongshov_v2', // ny nøkkel: gamle, feilplasserte fliser i IndexedDB brukes ikke
    bounds: {
      south: 60.415803,
      west: 12.386563,
      north: 60.461878,
      east: 12.471179,
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

export function imageryTileUrl(
  cfg: CustomHuntingImagery,
  z: number,
  x: number,
  y: number
): string {
  return cfg.tileUrl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}
