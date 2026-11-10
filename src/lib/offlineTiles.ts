import { OfflineArea, saveOfflineArea, saveTile, saveElevationTile } from './idb';
import { DEM_ZOOM } from './terrain/decode';
import { tileCountForZooms, tilesInBounds, type GeoBounds } from './geo/tiles';
import { elevationTileProxyUrl, mapTileProxyUrl, offlineStorageLayer } from './map/offlineLayers';

export interface DownloadProgress {
  current: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export const MAX_OFFLINE_MAP_TILES = 3500;

export function calculateTileCount(bounds: GeoBounds, zoomLevels: number[]): number {
  return tileCountForZooms(bounds, zoomLevels);
}

export function estimateOfflineJob(bounds: GeoBounds, zoomLevels: number[], includeElevation: boolean) {
  const mapTiles = tileCountForZooms(bounds, zoomLevels);
  const elevationTiles = includeElevation ? tilesInBounds(bounds, DEM_ZOOM).length : 0;
  return { mapTiles, elevationTiles, total: mapTiles + elevationTiles };
}

export async function downloadOfflineArea(
  area: Omit<OfflineArea, 'createdAt' | 'tileCount' | 'elevationTileCount' | 'includesElevation'>,
  _tileUrlTemplate: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  includeElevation: boolean = true
): Promise<void> {
  const layer = offlineStorageLayer(area.layer);
  const mapTiles = area.zoomLevels.flatMap((zoom) =>
    tilesInBounds(area.bounds, zoom).map((tile) => ({ ...tile, type: 'map' as const }))
  );
  const elevationTiles = includeElevation
    ? tilesInBounds(area.bounds, DEM_ZOOM).map((tile) => ({ ...tile, type: 'elevation' as const }))
    : [];

  if (mapTiles.length > MAX_OFFLINE_MAP_TILES) {
    throw new Error(
      `Området er for stort (${mapTiles.length} kartfliser). Velg færre zoom-nivåer eller et mindre rektangel.`
    );
  }

  const allTiles = [...mapTiles, ...elevationTiles];
  const total = allTiles.length;
  let completed = 0;
  let failed = 0;

  const CONCURRENT_DOWNLOADS = 4;
  const RETRY_ATTEMPTS = 2;

  for (let i = 0; i < allTiles.length; i += CONCURRENT_DOWNLOADS) {
    if (signal?.aborted) throw new Error('Download cancelled');
    const batch = allTiles.slice(i, i + CONCURRENT_DOWNLOADS);

    await Promise.all(
      batch.map(async ({ x, y, z, type }) => {
        let attempts = 0;
        let success = false;
        while (attempts < RETRY_ATTEMPTS && !success) {
          try {
            if (signal?.aborted) throw new Error('Download cancelled');
            const url =
              type === 'elevation' ? elevationTileProxyUrl(z, x, y) : mapTileProxyUrl(layer, z, x, y);
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            if (type === 'elevation') await saveElevationTile(z, x, y, blob);
            else await saveTile(layer, z, x, y, blob);
            success = true;
            completed++;
            onProgress?.({
              current: completed,
              total,
              percentage: total ? Math.round((completed / total) * 100) : 100,
            });
          } catch (error) {
            attempts++;
            if (attempts >= RETRY_ATTEMPTS) {
              console.warn(`Failed to download ${type} tile ${z}/${x}/${y}:`, error);
              failed++;
              completed++;
              onProgress?.({
                current: completed,
                total,
                percentage: total ? Math.round((completed / total) * 100) : 100,
              });
            } else {
              await new Promise((resolve) => setTimeout(resolve, 400 * attempts));
            }
          }
        }
      })
    );
  }

  const offlineArea: OfflineArea = {
    ...area,
    layer,
    huntingAreaId: area.huntingAreaId,
    createdAt: Date.now(),
    tileCount: mapTiles.length,
    elevationTileCount: elevationTiles.length,
    includesElevation: includeElevation,
  };
  if (total > 0 && failed === total) {
    throw new Error('Ingen fliser ble lastet ned. Sjekk nettet og prøv igjen.');
  }

  await saveOfflineArea(offlineArea);

  if (failed > 0) {
    console.warn(`Download completed with ${failed} failed tiles out of ${total}`);
  }
}

export function estimateStorageSize(mapTiles: number, elevationTiles: number = 0): number {
  return mapTiles * 30 * 1024 + elevationTiles * 15 * 1024;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
