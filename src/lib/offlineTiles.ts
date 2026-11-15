import { OfflineArea, saveOfflineArea, saveTile, saveElevationTile } from './idb';
import { DEM_ZOOM } from './terrain/decode';
import { tileCountForZooms, tilesInBounds, type GeoBounds } from './geo/tiles';
import { elevationTileProxyUrl, mapTileProxyUrl, offlineStorageLayer } from './map/offlineLayers';
import {
  customImageryForHuntingAreas,
  imageryTileUrl,
} from './map/customHuntingImagery';

export interface DownloadProgress {
  current: number;
  total: number;
  percentage: number;
  label?: string;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export const DOWNLOAD_CANCELLED = 'Download cancelled';

function isDownloadAborted(signal?: AbortSignal, error?: unknown): boolean {
  if (signal?.aborted) return true;
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && (error.name === 'AbortError' || error.message === DOWNLOAD_CANCELLED);
}

export const MAX_OFFLINE_MAP_TILES = 3500;

export function calculateTileCount(bounds: GeoBounds, zoomLevels: number[]): number {
  return tileCountForZooms(bounds, zoomLevels);
}

export function estimateOfflineJob(
  bounds: GeoBounds,
  zoomLevels: number[],
  includeElevation: boolean,
  areaNames?: string[]
) {
  const mapTiles = tileCountForZooms(bounds, zoomLevels);
  const elevationTiles = includeElevation ? tilesInBounds(bounds, DEM_ZOOM).length : 0;
  const imageryTiles = customImageryForHuntingAreas(areaNames).reduce((sum, cfg) => {
    const zooms: number[] = [];
    for (let z = cfg.minZoom; z <= cfg.maxNativeZoom; z++) zooms.push(z);
    return sum + tileCountForZooms(cfg.bounds, zooms);
  }, 0);
  return { mapTiles, elevationTiles, imageryTiles, total: mapTiles + elevationTiles + imageryTiles };
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
  const imagery = customImageryForHuntingAreas([area.name]);
  const imageryTiles = imagery.flatMap((cfg) => {
    const zooms: number[] = [];
    for (let z = cfg.minZoom; z <= cfg.maxNativeZoom; z++) zooms.push(z);
    return zooms.flatMap((zoom) =>
      tilesInBounds(cfg.bounds, zoom).map((tile) => ({
        ...tile,
        type: 'imagery' as const,
        layerKey: cfg.layerKey,
        url: imageryTileUrl(cfg, tile.z, tile.x, tile.y),
      }))
    );
  });

  if (mapTiles.length > MAX_OFFLINE_MAP_TILES) {
    throw new Error(
      `Området er for stort (${mapTiles.length} kartfliser). Velg færre zoom-nivåer eller et mindre rektangel.`
    );
  }

  type JobTile =
    | { x: number; y: number; z: number; type: 'map' }
    | { x: number; y: number; z: number; type: 'elevation' }
    | { x: number; y: number; z: number; type: 'imagery'; layerKey: string; url: string };

  const allTiles: JobTile[] = [...mapTiles, ...elevationTiles, ...imageryTiles];
  const total = allTiles.length + 1;
  let completed = 0;
  let failed = 0;

  const CONCURRENT_DOWNLOADS = 4;
  const RETRY_ATTEMPTS = 2;

  for (let i = 0; i < allTiles.length; i += CONCURRENT_DOWNLOADS) {
    if (signal?.aborted) throw new Error(DOWNLOAD_CANCELLED);
    const batch = allTiles.slice(i, i + CONCURRENT_DOWNLOADS);

    await Promise.all(
      batch.map(async (tile) => {
        const { x, y, z, type } = tile;
        let attempts = 0;
        let success = false;
        while (attempts < RETRY_ATTEMPTS && !success) {
          try {
            if (signal?.aborted) throw new Error(DOWNLOAD_CANCELLED);
            const url =
              type === 'elevation'
                ? elevationTileProxyUrl(z, x, y)
                : type === 'imagery'
                  ? tile.url
                  : mapTileProxyUrl(layer, z, x, y);
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            if (type === 'elevation') await saveElevationTile(z, x, y, blob);
            else if (type === 'imagery') await saveTile(tile.layerKey, z, x, y, blob);
            else await saveTile(layer, z, x, y, blob);
            success = true;
            completed++;
            onProgress?.({
              current: completed,
              total,
              percentage: total ? Math.round((completed / total) * 100) : 100,
              label: type === 'imagery' ? 'Laster ned flyfoto…' : 'Laster ned kartfliser…',
            });
          } catch (error) {
            if (isDownloadAborted(signal, error)) throw new Error(DOWNLOAD_CANCELLED);
            attempts++;
            if (attempts >= RETRY_ATTEMPTS) {
              console.warn(`Failed to download ${type} tile ${z}/${x}/${y}:`, error);
              failed++;
              completed++;
              onProgress?.({
                current: completed,
                total,
                percentage: total ? Math.round((completed / total) * 100) : 100,
              label: type === 'imagery' ? 'Laster ned flyfoto…' : 'Laster ned kartfliser…',
            });
          } else {
              await new Promise((resolve) => setTimeout(resolve, 400 * attempts));
            }
          }
        }
      })
    );
  }

  const tileTotal = mapTiles.length + elevationTiles.length + imageryTiles.length;
  if (tileTotal > 0 && failed === tileTotal) {
    throw new Error('Ingen fliser ble lastet ned. Sjekk nettet og prøv igjen.');
  }

  onProgress?.({
    current: completed,
    total,
    percentage: total ? Math.round((completed / total) * 100) : 100,
    label: 'Henter bebyggelse (3 km utenfor jaktgrensen)…',
  });

  let placeCount = 0;
  try {
    if (signal?.aborted) throw new Error(DOWNLOAD_CANCELLED);
    const { downloadPlacesForArea } = await import('./places/offlinePlaces');
    placeCount = await downloadPlacesForArea({
      areaId: area.id,
      bounds: area.bounds,
      polygon: area.polygon,
      signal,
    });
  } catch (error) {
    if (isDownloadAborted(signal, error)) throw new Error(DOWNLOAD_CANCELLED);
    console.warn('Bebyggelse could not be downloaded:', error);
  }
  completed++;
  onProgress?.({
    current: completed,
    total,
    percentage: 100,
    label: placeCount ? `Bebyggelse: ${placeCount} punkt` : 'Kart lastet (bebyggelse mangler)',
  });

  const offlineArea: OfflineArea = {
    ...area,
    layer,
    huntingAreaId: area.huntingAreaId,
    createdAt: Date.now(),
    tileCount: mapTiles.length + imageryTiles.length,
    elevationTileCount: elevationTiles.length,
    includesElevation: includeElevation,
    placeCount,
    imageryIds: imagery.map((cfg) => cfg.id),
  };

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
