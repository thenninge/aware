/**
 * Terrarium RGB encoding used by AWS Terrain Tiles and Mapterhorn.
 * elevation_m = R * 256 + G + B / 256 - 32768
 */
export function decodeTerrainRGB(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export function isValidElevation(meters: number): boolean {
  return Number.isFinite(meters) && meters > -500 && meters < 9000;
}

export const TERRARIUM_TILE_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export const DEM_ZOOM = 13;
export const DEM_TILE_SIZE = 256;

export function terrariumTileUrl(z: number, x: number, y: number): string {
  return TERRARIUM_TILE_URL.replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}
