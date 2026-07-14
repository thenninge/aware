import { OfflineArea, saveOfflineArea, saveTile, saveElevationTile } from './idb';

export interface DownloadProgress {
  current: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

// Calculate tile coordinates for a given lat/lng at a specific zoom level
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { x, y };
}

// Get all tile coordinates within bounds for a zoom level
function getTilesInBounds(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number
): Array<{ x: number; y: number; z: number }> {
  const nw = latLngToTile(bounds.north, bounds.west, zoom);
  const se = latLngToTile(bounds.south, bounds.east, zoom);
  
  const tiles: Array<{ x: number; y: number; z: number }> = [];
  
  for (let x = Math.min(nw.x, se.x); x <= Math.max(nw.x, se.x); x++) {
    for (let y = Math.min(nw.y, se.y); y <= Math.max(nw.y, se.y); y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  
  return tiles;
}

// Calculate total number of tiles for given bounds and zoom levels
export function calculateTileCount(
  bounds: { north: number; south: number; east: number; west: number },
  zoomLevels: number[]
): number {
  let total = 0;
  for (const zoom of zoomLevels) {
    const tiles = getTilesInBounds(bounds, zoom);
    total += tiles.length;
  }
  return total;
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

// Download tiles for an offline area (both map tiles and elevation data)
export async function downloadOfflineArea(
  area: Omit<OfflineArea, 'createdAt' | 'tileCount' | 'elevationTileCount' | 'includesElevation'>,
  tileUrlTemplate: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  includeElevation: boolean = true
): Promise<void> {
  // Calculate all tiles needed (map tiles + elevation tiles if requested)
  const mapTiles: Array<{ x: number; y: number; z: number; type: 'map' }> = [];
  const elevationTiles: Array<{ x: number; y: number; z: number; type: 'elevation' }> = [];
  
  for (const zoom of area.zoomLevels) {
    const tiles = getTilesInBounds(area.bounds, zoom);
    mapTiles.push(...tiles.map(t => ({ ...t, type: 'map' as const })));
    
    // Also download elevation tiles if requested
    if (includeElevation) {
      elevationTiles.push(...tiles.map(t => ({ ...t, type: 'elevation' as const })));
    }
  }
  
  const allTiles = [...mapTiles, ...elevationTiles];
  const total = allTiles.length;
  let completed = 0;
  let failed = 0;

  // Download tiles with concurrency limit
  const CONCURRENT_DOWNLOADS = 4;
  const RETRY_ATTEMPTS = 2;
  const DELAY_BETWEEN_BATCHES = 100; // ms
  
  for (let i = 0; i < allTiles.length; i += CONCURRENT_DOWNLOADS) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }
    
    const batch = allTiles.slice(i, i + CONCURRENT_DOWNLOADS);
    
    await Promise.all(
      batch.map(async ({ x, y, z, type }) => {
        let attempts = 0;
        let success = false;
        
        while (attempts < RETRY_ATTEMPTS && !success) {
          try {
            if (signal?.aborted) {
              throw new Error('Download cancelled');
            }
            
            // Use appropriate URL based on tile type
            const url = type === 'elevation' 
              ? formatTileUrl(ELEVATION_TILE_URL, x, y, z)
              : formatTileUrl(tileUrlTemplate, x, y, z);
            
            const response = await fetch(url, { signal });
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            
            const blob = await response.blob();
            
            // Save to appropriate store
            if (type === 'elevation') {
              await saveElevationTile(z, x, y, blob);
            } else {
              await saveTile(area.layer, z, x, y, blob);
            }
            
            success = true;
            completed++;
            
            if (onProgress) {
              onProgress({
                current: completed,
                total,
                percentage: Math.round((completed / total) * 100),
              });
            }
          } catch (error) {
            attempts++;
            if (attempts >= RETRY_ATTEMPTS) {
              console.warn(`Failed to download ${type} tile ${z}/${x}/${y} after ${RETRY_ATTEMPTS} attempts:`, error);
              failed++;
              completed++; // Count as completed to move progress forward
              
              if (onProgress) {
                onProgress({
                  current: completed,
                  total,
                  percentage: Math.round((completed / total) * 100),
                });
              }
            } else {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 500 * attempts));
            }
          }
        }
      })
    );
    
    // Small delay between batches to avoid overwhelming the server
    if (i + CONCURRENT_DOWNLOADS < allTiles.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  // Save offline area metadata
  const offlineArea: OfflineArea = {
    ...area,
    createdAt: Date.now(),
    tileCount: mapTiles.length,
    elevationTileCount: elevationTiles.length,
    includesElevation: includeElevation,
  };
  
  await saveOfflineArea(offlineArea);
  
  if (failed > 0) {
    console.warn(`Download completed with ${failed} failed tiles out of ${total}`);
  }
}

// Estimate storage size for an area
// Map tiles: ~30KB per tile
// Elevation tiles: ~15KB per tile (PNG with elevation data)
export function estimateStorageSize(tileCount: number, includeElevation: boolean = true): number {
  const mapTileSize = tileCount * 30 * 1024; // 30KB per map tile
  const elevationTileSize = includeElevation ? tileCount * 15 * 1024 : 0; // 15KB per elevation tile
  return mapTileSize + elevationTileSize;
}

// Format bytes to human-readable format
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
