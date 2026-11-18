/**
 * Felles regler for hvor store symboler tegnes på kartet.
 *
 * Tre typer:
 *  1. Områder (rekkevidde, sikt/LOS, jaktfelt, ikke-jakt-soner): ekte størrelse i meter.
 *     De betyr noe i terrenget og skal zoome med kartet.
 *  2. Punkter med størrelse i meter (standplass, treffpunkt, observasjon, funn):
 *     ekte størrelse i meter, men på skjermen alltid mellom `min` og `max` piksler.
 *     Da synes de når man har zoomet ut, og dekker ikke kartet når man zoomer inn.
 *  3. Markører (egen posisjon, GPS, sporpunkter, punkter man tegner): fast størrelse i piksler.
 *
 * Alle mål her er radius i piksler.
 */

export const SYMBOL_PX = {
  /** Standplass, treffpunkt, observasjon */
  point: { min: 6, max: 18 },
  /** Funn (+) bruker samme grenser, men som halv diagonal */
  find: { min: 7, max: 18 },
  /** Punkter i lagrede og aktive spor */
  trackDot: { min: 2, max: 4 },
  /** Hjørner man tegner inn (jaktfelt, ikke-jakt-sone) */
  vertex: 7,
  /** Usynlig trykkflate rundt punkter, så de er lette å treffe med fingeren */
  hit: 22,
} as const;

/** Meter per skjermpiksel i Web Mercator ved gitt breddegrad og zoom. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

/** Radius i piksler for et punkt med radius `meters`, begrenset til [min, max]. */
export function clampedRadiusPx(
  meters: number,
  lat: number,
  zoom: number,
  range: { min: number; max: number } = SYMBOL_PX.point
): number {
  const px = meters / Math.max(metersPerPixel(lat, zoom), 1e-6);
  return Math.min(range.max, Math.max(range.min, px));
}
