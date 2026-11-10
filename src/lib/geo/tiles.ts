import { coordToTile } from './coordinates';

export type GeoBounds = { north: number; south: number; east: number; west: number };

export function tilesInBounds(bounds: GeoBounds, zoom: number): Array<{ x: number; y: number; z: number }> {
  const nw = coordToTile({ lat: bounds.north, lng: bounds.west }, zoom);
  const se = coordToTile({ lat: bounds.south, lng: bounds.east }, zoom);
  const tiles: Array<{ x: number; y: number; z: number }> = [];
  const minX = Math.min(nw.x, se.x);
  const maxX = Math.max(nw.x, se.x);
  const minY = Math.min(nw.y, se.y);
  const maxY = Math.max(nw.y, se.y);
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  return tiles;
}

export function boundsFromPolygon(coordinates: Array<[number, number]>): GeoBounds | null {
  if (!coordinates.length) return null;
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const [lat, lng] of coordinates) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    north = Math.max(north, lat);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    west = Math.min(west, lng);
  }
  if (north < south || east < west) return null;
  const padLat = Math.max(0.002, (north - south) * 0.08);
  const padLng = Math.max(0.003, (east - west) * 0.08);
  return {
    north: Math.min(90, north + padLat),
    south: Math.max(-90, south - padLat),
    east: Math.min(180, east + padLng),
    west: Math.max(-180, west - padLng),
  };
}

export function padBounds(bounds: GeoBounds, meters = 200): GeoBounds {
  const padLat = meters / 111000;
  const midLat = (bounds.north + bounds.south) / 2;
  const padLng = meters / (111000 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
  return {
    north: Math.min(90, bounds.north + padLat),
    south: Math.max(-90, bounds.south - padLat),
    east: Math.min(180, bounds.east + padLng),
    west: Math.max(-180, bounds.west - padLng),
  };
}

export function tileCountForZooms(bounds: GeoBounds, zoomLevels: number[]): number {
  return zoomLevels.reduce((sum, zoom) => sum + tilesInBounds(bounds, zoom).length, 0);
}
