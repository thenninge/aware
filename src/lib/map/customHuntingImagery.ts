import type { LatLngBoundsExpression } from 'leaflet';

export type CustomHuntingImagery = {
  id: string;
  /** Match mot jaktfeltnavn på laget, f.eks. "Kongshov skog". */
  match: RegExp;
  url: string;
  bounds: LatLngBoundsExpression;
  attribution: string;
};

/**
 * Eget flyfoto som erstatter Google-satellitt over jaktfeltet.
 * Dulpetorpet legges inn her når underlaget er klart.
 *
 * Kongshov-bounds er georeferert mot hogstflatene i
 * public/hogst/kongshov_skog.geojson (samme utsnitt som flyfotoet).
 */
export const CUSTOM_HUNTING_IMAGERY: CustomHuntingImagery[] = [
  {
    id: 'kongshov',
    match: /kongshov/i,
    url: '/imagery/kongshov.jpg',
    bounds: [
      [60.414954, 12.383394],
      [60.458911, 12.469397],
    ],
    attribution: 'Flyfoto Kongshov 2022–2025',
  },
];

export function customImageryForHuntingAreas(
  names: string[] | undefined | null
): CustomHuntingImagery[] {
  if (!names?.length) return [];
  return CUSTOM_HUNTING_IMAGERY.filter((cfg) => names.some((name) => cfg.match.test(name)));
}
