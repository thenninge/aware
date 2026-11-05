/** WGS84 geographic coordinate. This is the only coordinate type used in Aware. */
export interface Coordinate {
  lat: number;
  lng: number;
}

export interface ElevatedCoordinate extends Coordinate {
  elevation: number;
}

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export const EARTH_RADIUS_M = 6371000;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function coordToTile(coord: Coordinate, zoom: number): TileCoordinate {
  const n = 2 ** zoom;
  const x = Math.floor(((coord.lng + 180) / 360) * n);
  const latRad = toRad(coord.lat);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { z: zoom, x, y };
}

export function tileToCoord(tile: TileCoordinate): Coordinate {
  const n = 2 ** tile.z;
  const lng = (tile.x / n) * 360 - 180;
  const lat = toDeg(Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n))));
  return { lat, lng };
}

/** Fractional pixel inside a Web Mercator tile (tileSize × tileSize). */
export function coordToTilePixel(
  coord: Coordinate,
  tile: TileCoordinate,
  tileSize: number
): { x: number; y: number } {
  const n = 2 ** tile.z;
  const x = (((coord.lng + 180) / 360) * n - tile.x) * tileSize;
  const latRad = toRad(coord.lat);
  const y =
    (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n -
      tile.y) *
    tileSize;
  return { x, y };
}

export function distance(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bearing from A to B in degrees, 0 = north. */
export function bearing(a: Coordinate, b: Coordinate): number {
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function destination(
  origin: Coordinate,
  bearingDeg: number,
  distanceM: number
): Coordinate {
  const brng = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const d = distanceM / EARTH_RADIUS_M;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

/** Approximate ground resolution of a Web Mercator tile pixel. */
export function metersPerPixel(latDeg: number, zoom: number, tileSize = 256): number {
  return (40075016.686 * Math.cos(toRad(latDeg))) / (tileSize * 2 ** zoom);
}

/** Even samples along a polyline, inclusive of start and end. */
export function interpolatePath(path: Coordinate[], samples: number): Coordinate[] {
  if (path.length === 0) return [];
  if (path.length === 1 || samples <= 1) return [path[0]];

  const segDist: number[] = [0];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += distance(path[i - 1], path[i]);
    segDist.push(total);
  }

  if (total === 0) return Array.from({ length: samples }, () => path[0]);

  const out: Coordinate[] = [];
  for (let i = 0; i < samples; i++) {
    const target = (total * i) / (samples - 1);
    let s = 1;
    while (s < segDist.length && segDist[s] < target) s++;
    const a = path[s - 1];
    const b = path[Math.min(s, path.length - 1)];
    const segStart = segDist[s - 1];
    const segLen = Math.max(segDist[s] - segStart, 1e-9);
    const t = Math.max(0, Math.min(1, (target - segStart) / segLen));
    out.push({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    });
  }
  return out;
}
