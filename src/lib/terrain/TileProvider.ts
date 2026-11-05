import { TileCoordinate } from '../geo/coordinates';
import { DEM_TILE_SIZE, terrariumTileUrl } from './decode';

export type TilePixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

const MAX_CACHE = 64;
const FETCH_CONCURRENCY = 6;

function tileKey(tile: TileCoordinate): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

async function blobToPixels(blob: Blob): Promise<TilePixels | null> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    return {
      width: imageData.width,
      height: imageData.height,
      data: imageData.data,
    };
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || DEM_TILE_SIZE;
      canvas.height = img.height || DEM_TILE_SIZE;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({
        width: imageData.width,
        height: imageData.height,
        data: imageData.data,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Loads Terrarium DEM tiles: memory → IndexedDB → AWS Terrain Tiles.
 * Never talks to Google.
 */
export class TileProvider {
  private cache = new Map<string, TilePixels>();
  private inflight = new Map<string, Promise<TilePixels | null>>();

  async getTile(tile: TileCoordinate): Promise<TilePixels | null> {
    const key = tileKey(tile);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const load = this.loadTile(tile, key);
    this.inflight.set(key, load);
    try {
      return await load;
    } finally {
      this.inflight.delete(key);
    }
  }

  async getTiles(tiles: TileCoordinate[]): Promise<Map<string, TilePixels>> {
    const unique = new Map<string, TileCoordinate>();
    for (const tile of tiles) unique.set(tileKey(tile), tile);

    const result = new Map<string, TilePixels>();
    const list = [...unique.entries()];
    for (let i = 0; i < list.length; i += FETCH_CONCURRENCY) {
      const batch = list.slice(i, i + FETCH_CONCURRENCY);
      const loaded = await Promise.all(
        batch.map(async ([key, tile]) => {
          const pixels = await this.getTile(tile);
          return { key, pixels };
        })
      );
      for (const { key, pixels } of loaded) {
        if (pixels) result.set(key, pixels);
      }
    }
    return result;
  }

  clearCache() {
    this.cache.clear();
  }

  private remember(key: string, pixels: TilePixels) {
    if (this.cache.size >= MAX_CACHE) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, pixels);
  }

  private async loadTile(tile: TileCoordinate, key: string): Promise<TilePixels | null> {
    const fromDisk = await this.loadFromIndexedDb(tile);
    if (fromDisk) {
      this.remember(key, fromDisk);
      return fromDisk;
    }

    const fromNetwork = await this.loadFromNetwork(tile);
    if (fromNetwork) {
      this.remember(key, fromNetwork.pixels);
      void this.saveToIndexedDb(tile, fromNetwork.blob);
      return fromNetwork.pixels;
    }

    return null;
  }

  private async loadFromIndexedDb(tile: TileCoordinate): Promise<TilePixels | null> {
    if (typeof indexedDB === 'undefined') return null;
    try {
      const { getElevationTile } = await import('../idb');
      const blob = await getElevationTile(tile.z, tile.x, tile.y);
      if (!blob) return null;
      return blobToPixels(blob);
    } catch {
      return null;
    }
  }

  private async saveToIndexedDb(tile: TileCoordinate, blob: Blob): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
      const { saveElevationTile } = await import('../idb');
      await saveElevationTile(tile.z, tile.x, tile.y, blob);
    } catch {
      // Cache write is best-effort
    }
  }

  private async loadFromNetwork(
    tile: TileCoordinate
  ): Promise<{ pixels: TilePixels; blob: Blob } | null> {
    try {
      // Browser: same-origin proxy (AWS Terrarium has no CORS). Node tests hit AWS directly.
      const url =
        typeof window === 'undefined'
          ? terrariumTileUrl(tile.z, tile.x, tile.y)
          : `/api/terrarium/${tile.z}/${tile.x}/${tile.y}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      const pixels = await blobToPixels(blob);
      if (!pixels) return null;
      return { pixels, blob };
    } catch {
      return null;
    }
  }
}
