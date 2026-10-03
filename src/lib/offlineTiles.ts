import { OfflineArea, saveOfflineArea, saveTile, saveElevationTile, requestPersistentStorage } from './idb';
import { TileBounds, TileCoord, getTilesInBounds, elevationTilesInBounds } from './tileMath';

export interface DownloadProgress {
  current: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export interface DownloadResult {
  total: number;
  failed: number;
}

// full = masselastning tillatt, view = kun fliser brukeren faktisk ser caches, none = ingen lagring.
// Google og Esri tillater ikke lagring av fliser; OSM/OpenTopoMap fraråder masselastning.
export type OfflinePolicy = 'full' | 'view' | 'none';

const OFFLINE_POLICY: Record<string, OfflinePolicy> = {
  kartverket_topo: 'full',
  osm: 'view',
  opentopo: 'view',
  esri: 'none',
  google_sat: 'none',
};

export function getOfflinePolicy(layerKey: string): OfflinePolicy {
  return OFFLINE_POLICY[layerKey] ?? 'none';
}

// Øvre grense for én nedlasting (kart + høyde)
export const MAX_TILES_PER_DOWNLOAD = 20000;

// Calculate total number of map tiles for given bounds and zoom levels
export function calculateTileCount(bounds: TileBounds, zoomLevels: number[]): number {
  let total = 0;
  for (const zoom of zoomLevels) {
    total += getTilesInBounds(bounds, zoom).length;
  }
  return total;
}

export function calculateElevationTileCount(bounds: TileBounds): number {
  return elevationTilesInBounds(bounds).length;
}

// Format tile URL based on template
function formatTileUrl(urlTemplate: string, x: number, y: number, z: number): string {
  return urlTemplate
    .replace('{x}', x.toString())
    .replace('{y}', y.toString())
    .replace('{z}', z.toString())
    .replace('{s}', ['a', 'b', 'c'][Math.floor(Math.random() * 3)]); // Random subdomain for load balancing
}

// AWS Terrain Tiles URL template for elevation data
const ELEVATION_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

type TypedTile = TileCoord & { type: 'map' | 'elevation' };

// Download tiles for an offline area (both map tiles and elevation data)
export async function downloadOfflineArea(
  area: Omit<OfflineArea, 'createdAt' | 'tileCount' | 'elevationTileCount' | 'includesElevation' | 'failedTileCount'>,
  tileUrlTemplate: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  includeElevation: boolean = true
): Promise<DownloadResult> {
  if (getOfflinePolicy(area.layer) !== 'full') {
    throw new Error('Dette kartlaget kan ikke lastes ned for offline bruk');
  }

  const mapTiles: TypedTile[] = [];
  for (const zoom of area.zoomLevels) {
    mapTiles.push(...getTilesInBounds(area.bounds, zoom).map((t) => ({ ...t, type: 'map' as const })));
  }
  const elevationTiles: TypedTile[] = includeElevation
    ? elevationTilesInBounds(area.bounds).map((t) => ({ ...t, type: 'elevation' as const }))
    : [];

  const allTiles = [...mapTiles, ...elevationTiles];
  const total = allTiles.length;
  if (total > MAX_TILES_PER_DOWNLOAD) {
    throw new Error(`For mange fliser (${total}). Maks ${MAX_TILES_PER_DOWNLOAD} per nedlasting.`);
  }

  // Be nettleseren om å ikke slette lagrede fliser (best effort)
  void requestPersistentStorage();

  let completed = 0;
  let failed = 0;

  // Download tiles with concurrency limit
  const CONCURRENT_DOWNLOADS = 4;
  const RETRY_ATTEMPTS = 2;
  const DELAY_BETWEEN_BATCHES = 100; // ms

  const report = () => {
    onProgress?.({
      current: completed,
      total,
      percentage: Math.round((completed / total) * 100),
    });
  };

  for (let i = 0; i < allTiles.length; i += CONCURRENT_DOWNLOADS) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }

    const batch = allTiles.slice(i, i + CONCURRENT_DOWNLOADS);

    await Promise.all(
      batch.map(async ({ x, y, z, type }) => {
        for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
          try {
            if (signal?.aborted) {
              throw new Error('Download cancelled');
            }

            const url =
              type === 'elevation'
                ? formatTileUrl(ELEVATION_TILE_URL, x, y, z)
                : formatTileUrl(tileUrlTemplate, x, y, z);

            const response = await fetch(url, { signal });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const blob = await response.blob();

            if (type === 'elevation') {
              await saveElevationTile(z, x, y, blob);
            } else {
              await saveTile(area.layer, z, x, y, blob);
            }

            completed++;
            report();
            return;
          } catch (error) {
            if (signal?.aborted) throw error;
            if (attempt >= RETRY_ATTEMPTS) {
              console.warn(`Failed to download ${type} tile ${z}/${x}/${y} after ${RETRY_ATTEMPTS} attempts:`, error);
              failed++;
              completed++; // Flytt fremdriften videre
              report();
            } else {
              await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            }
          }
        }
      })
    );

    if (i + CONCURRENT_DOWNLOADS < allTiles.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  if (failed === total) {
    throw new Error('Ingen fliser kunne lastes ned. Sjekk nettverket.');
  }

  const offlineArea: OfflineArea = {
    ...area,
    createdAt: Date.now(),
    tileCount: mapTiles.length,
    elevationTileCount: elevationTiles.length,
    includesElevation: includeElevation,
    failedTileCount: failed,
  };
  await saveOfflineArea(offlineArea);

  return { total, failed };
}

// Estimate storage size for an area
// Map tiles: ~65KB per tile (målt for Kartverket topo), elevation tiles: ~15KB per tile
export function estimateStorageSize(tileCount: number, elevationTileCount: number = 0): number {
  return tileCount * 65 * 1024 + elevationTileCount * 15 * 1024;
}

// Format bytes to human-readable format
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
