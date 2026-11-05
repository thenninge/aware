import {
  Coordinate,
  ElevatedCoordinate,
  TileCoordinate,
  coordToTile,
  coordToTilePixel,
  interpolatePath,
  metersPerPixel,
} from '../geo/coordinates';
import { DEM_TILE_SIZE, DEM_ZOOM, decodeTerrainRGB, isValidElevation } from './decode';
import { TilePixels, TileProvider } from './TileProvider';

function samplePixel(pixels: TilePixels, x: number, y: number): number {
  const xi = Math.max(0, Math.min(pixels.width - 1, Math.floor(x)));
  const yi = Math.max(0, Math.min(pixels.height - 1, Math.floor(y)));
  const i = (yi * pixels.width + xi) * 4;
  return decodeTerrainRGB(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]);
}

function sampleBilinear(pixels: TilePixels, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;
  const e00 = samplePixel(pixels, x0, y0);
  const e10 = samplePixel(pixels, x1, y0);
  const e01 = samplePixel(pixels, x0, y1);
  const e11 = samplePixel(pixels, x1, y1);
  const e0 = e00 * (1 - fx) + e10 * fx;
  const e1 = e01 * (1 - fx) + e11 * fx;
  return e0 * (1 - fy) + e1 * fy;
}

function elevationAt(
  pixels: TilePixels,
  coord: Coordinate,
  tile: TileCoordinate
): number | null {
  const pixel = coordToTilePixel(coord, tile, pixels.width || DEM_TILE_SIZE);
  const value = sampleBilinear(pixels, pixel.x, pixel.y);
  return isValidElevation(value) ? value : null;
}

export class TerrainEngine {
  constructor(
    private tileProvider: TileProvider,
    private zoom: number = DEM_ZOOM
  ) {}

  async getElevation(coord: Coordinate): Promise<number | null> {
    const [value] = await this.getElevations([coord]);
    return value;
  }

  async getElevations(coords: Coordinate[]): Promise<Array<number | null>> {
    if (coords.length === 0) return [];

    const tiles: TileCoordinate[] = coords.map((c) => coordToTile(c, this.zoom));
    const loaded = await this.tileProvider.getTiles(tiles);
    return coords.map((coord, i) => {
      const tile = tiles[i];
      const pixels = loaded.get(`${tile.z}/${tile.x}/${tile.y}`);
      if (!pixels) return null;
      return elevationAt(pixels, coord, tile);
    });
  }

  async getElevationProfile(
    path: Coordinate[],
    samples: number
  ): Promise<ElevatedCoordinate[]> {
    const points = interpolatePath(path, samples);
    const elevations = await this.getElevations(points);
    return points.map((point, i) => ({
      ...point,
      elevation: elevations[i] ?? 0,
    }));
  }

  coverage(elevations: Array<number | null>): number {
    if (elevations.length === 0) return 0;
    const ok = elevations.filter((e) => e !== null).length;
    return ok / elevations.length;
  }

  async getSlope(coord: Coordinate): Promise<number | null> {
    const grads = await this.gradients(coord);
    if (!grads) return null;
    return (Math.atan(Math.sqrt(grads.dx * grads.dx + grads.dy * grads.dy)) * 180) / Math.PI;
  }

  async getAspect(coord: Coordinate): Promise<number | null> {
    const grads = await this.gradients(coord);
    if (!grads) return null;
    let aspect = (Math.atan2(grads.dx, -grads.dy) * 180) / Math.PI;
    if (aspect < 0) aspect += 360;
    return aspect;
  }

  private async gradients(coord: Coordinate): Promise<{ dx: number; dy: number } | null> {
    const tile = coordToTile(coord, this.zoom);
    const pixels = await this.tileProvider.getTile(tile);
    if (!pixels) return null;
    const pixel = coordToTilePixel(coord, tile, pixels.width || DEM_TILE_SIZE);
    const x = Math.floor(pixel.x);
    const y = Math.floor(pixel.y);
    const meters = metersPerPixel(coord.lat, this.zoom, pixels.width || DEM_TILE_SIZE);
    const dx = (samplePixel(pixels, x + 1, y) - samplePixel(pixels, x - 1, y)) / (2 * meters);
    const dy = (samplePixel(pixels, x, y + 1) - samplePixel(pixels, x, y - 1)) / (2 * meters);
    return { dx, dy };
  }
}
