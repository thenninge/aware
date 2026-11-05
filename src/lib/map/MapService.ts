import {
  Coordinate,
  ElevatedCoordinate,
  bearing,
  destination,
  distance,
  interpolatePath,
} from '../geo/coordinates';
import { DEM_ZOOM } from '../terrain/decode';
import { TerrainEngine } from '../terrain/TerrainEngine';
import { TileProvider } from '../terrain/TileProvider';
import { ViewshedData, ViewshedParams, calculateViewshed } from '../terrain/los';

/**
 * Single entry point for coordinates, elevation and LOS.
 * Presentation (Leaflet/MapLibre) should call this — not Google Elevation.
 */
export class MapService {
  readonly engine: TerrainEngine;

  constructor(zoom: number = DEM_ZOOM) {
    this.engine = new TerrainEngine(new TileProvider(), zoom);
  }

  getElevation(coord: Coordinate): Promise<number | null> {
    return this.engine.getElevation(coord);
  }

  getElevations(coords: Coordinate[]): Promise<Array<number | null>> {
    return this.engine.getElevations(coords);
  }

  getElevationProfile(path: Coordinate[], samples: number): Promise<ElevatedCoordinate[]> {
    return this.engine.getElevationProfile(path, samples);
  }

  calculateLOS(origin: Coordinate, params: ViewshedParams): Promise<ViewshedData> {
    return calculateViewshed(this.engine, origin, params);
  }

  getSlope(coord: Coordinate): Promise<number | null> {
    return this.engine.getSlope(coord);
  }

  getAspect(coord: Coordinate): Promise<number | null> {
    return this.engine.getAspect(coord);
  }

  distance(a: Coordinate, b: Coordinate): number {
    return distance(a, b);
  }

  bearing(a: Coordinate, b: Coordinate): number {
    return bearing(a, b);
  }

  destination(origin: Coordinate, bearingDeg: number, distanceM: number): Coordinate {
    return destination(origin, bearingDeg, distanceM);
  }

  interpolatePath(path: Coordinate[], samples: number): Coordinate[] {
    return interpolatePath(path, samples);
  }
}

let singleton: MapService | null = null;

export function getMapService(): MapService {
  if (!singleton) singleton = new MapService();
  return singleton;
}
