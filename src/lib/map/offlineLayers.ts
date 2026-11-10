export const OFFLINE_MAP_LAYER = 'kartverket_topo';

export const OFFLINE_LAYER_URLS: Record<string, (z: number, x: number, y: number) => string> = {
  kartverket_topo: (z, x, y) =>
    `https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/${z}/${y}/${x}.png`,
  esri: (z, x, y) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  osm: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  opentopo: (z, x, y) => `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`,
};

export function isOfflineMapLayer(layer: string): layer is keyof typeof OFFLINE_LAYER_URLS {
  return Object.prototype.hasOwnProperty.call(OFFLINE_LAYER_URLS, layer);
}

export function offlineStorageLayer(layerKey: string): string {
  return isOfflineMapLayer(layerKey) ? layerKey : OFFLINE_MAP_LAYER;
}

export function mapTileProxyUrl(layer: string, z: number, x: number, y: number): string {
  return `/api/map-tiles/${encodeURIComponent(offlineStorageLayer(layer))}/${z}/${x}/${y}`;
}

export function elevationTileProxyUrl(z: number, x: number, y: number): string {
  return `/api/terrarium/${z}/${x}/${y}`;
}
