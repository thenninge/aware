export interface TileBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

// Terrarium-fliser finnes til og med z15. Alle høyde-oppslag bruker samme zoom.
export const ELEVATION_ZOOM = 14;

export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
  );
  return { x, y };
}

export function getTilesInBounds(bounds: TileBounds, zoom: number): TileCoord[] {
  const nw = latLngToTile(bounds.north, bounds.west, zoom);
  const se = latLngToTile(bounds.south, bounds.east, zoom);
  const tiles: TileCoord[] = [];
  for (let x = Math.min(nw.x, se.x); x <= Math.max(nw.x, se.x); x++) {
    for (let y = Math.min(nw.y, se.y); y <= Math.max(nw.y, se.y); y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  return tiles;
}

export function mapTileKey(layer: string, z: number, x: number, y: number): string {
  return `${layer}/${z}/${x}/${y}`;
}

export function elevationTileKey(z: number, x: number, y: number): string {
  return `elevation/${z}/${x}/${y}`;
}

export function elevationTilesInBounds(bounds: TileBounds): TileCoord[] {
  return getTilesInBounds(bounds, ELEVATION_ZOOM);
}

// Alle lagringsnøkler et nedlastet område består av (brukes til å slette kun områdets egne fliser)
export function tileKeysForArea(area: {
  bounds: TileBounds;
  zoomLevels: number[];
  layer: string;
  includesElevation: boolean;
}): Set<string> {
  const keys = new Set<string>();
  for (const zoom of area.zoomLevels) {
    for (const t of getTilesInBounds(area.bounds, zoom)) {
      keys.add(mapTileKey(area.layer, t.z, t.x, t.y));
    }
  }
  if (area.includesElevation) {
    for (const t of elevationTilesInBounds(area.bounds)) {
      keys.add(elevationTileKey(t.z, t.x, t.y));
    }
  }
  return keys;
}
