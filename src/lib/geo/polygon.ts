import { distance, type Coordinate } from './coordinates';

export const PLACES_BUFFER_M = 3000;

type LatLng = [number, number];

function toCoord(point: LatLng | Coordinate): Coordinate {
  if (Array.isArray(point)) return { lat: point[0], lng: point[1] };
  return point;
}

function ring(coordinates: LatLng[]): LatLng[] {
  if (coordinates.length < 3) return coordinates;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coordinates;
  return [...coordinates, first];
}

/** Ray-casting. Coordinates are [lat, lng]. */
export function pointInPolygon(point: Coordinate, coordinates: LatLng[]): boolean {
  const closed = ring(coordinates);
  if (closed.length < 4) return false;
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  for (let i = 1; i < closed.length; i++) {
    const [y1, x1] = closed[i - 1];
    const [y2, x2] = closed[i];
    const intersect = y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1 + 1e-18) + x1;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToSegmentMeters(point: Coordinate, a: Coordinate, b: Coordinate): number {
  const metersPerLat = 111000;
  const metersPerLng = 111000 * Math.max(0.2, Math.cos((point.lat * Math.PI) / 180));
  const px = 0;
  const py = 0;
  const ax = (a.lng - point.lng) * metersPerLng;
  const ay = (a.lat - point.lat) * metersPerLat;
  const bx = (b.lng - point.lng) * metersPerLng;
  const by = (b.lat - point.lat) * metersPerLat;
  const abx = bx - ax;
  const aby = by - ay;
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 < 1) return Math.hypot(ax, ay);
  const t = Math.max(0, Math.min(1, (-ax * abx - ay * aby) / abLen2));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

/** 0 if inside the polygon, otherwise meters to the nearest edge. */
export function distanceToPolygon(point: Coordinate, coordinates: LatLng[]): number {
  if (coordinates.length < 3) return Number.POSITIVE_INFINITY;
  if (pointInPolygon(point, coordinates)) return 0;
  const closed = ring(coordinates);
  let min = Number.POSITIVE_INFINITY;
  for (let i = 1; i < closed.length; i++) {
    const a = toCoord(closed[i - 1]);
    const b = toCoord(closed[i]);
    min = Math.min(min, distanceToSegmentMeters(point, a, b));
  }
  return min;
}

export function isWithinPolygonBuffer(
  point: Coordinate,
  coordinates: LatLng[],
  bufferM: number = PLACES_BUFFER_M
): boolean {
  return distanceToPolygon(point, coordinates) <= bufferM;
}

export function polygonFromBounds(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): LatLng[] {
  return [
    [bounds.north, bounds.west],
    [bounds.north, bounds.east],
    [bounds.south, bounds.east],
    [bounds.south, bounds.west],
  ];
}

export function nearestWithinRadius<T extends Coordinate>(
  places: T[],
  center: Coordinate,
  radiusM: number,
  limit = 50
): T[] {
  return places
    .map((place) => ({ place, d: distance(center, place) }))
    .filter((item) => item.d <= radiusM)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((item) => item.place);
}
