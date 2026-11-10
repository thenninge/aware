export interface PendingTrackSegment {
  id: string | null;
  createdAt: string;
  points: Array<{ lat: number; lng: number; heading?: number }>;
}

export interface CachedTile {
  key: string; // format: "layer/z/x/y" or "elevation/z/x/y"
  blob: Blob;
  timestamp: number;
  type?: 'map' | 'elevation'; // Type of tile
}

export interface OfflineArea {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoomLevels: number[];
  layer: string;
  createdAt: number;
  tileCount: number;
  elevationTileCount: number; // Number of elevation tiles downloaded
  includesElevation: boolean; // Whether elevation data is included
  huntingAreaId?: string;
  placeCount?: number;
  polygon?: Array<[number, number]>;
}

export interface OfflinePlacesBundle {
  areaId: string;
  places: Array<{
    id: number;
    type: string;
    lat: number;
    lng: number;
    name?: string;
    category: string;
    tags: Record<string, string>;
  }>;
  updatedAt: number;
}

export function huntingAreaOfflineId(huntingAreaId: string): string {
  return `hunting-area-${huntingAreaId}`;
}

export function isOfflineForHuntingArea(area: OfflineArea, huntingAreaId: string): boolean {
  return area.huntingAreaId === huntingAreaId || area.id === huntingAreaOfflineId(huntingAreaId);
}

function notifyOfflineAreasChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('aware-offline-areas-changed'));
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aware-db', 3);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      
      // Create tracksPending if it doesn't exist
      if (!db.objectStoreNames.contains('tracksPending')) {
        db.createObjectStore('tracksPending', { keyPath: 'createdAt' });
      }
      
      // Create tiles store (new in version 2)
      if (oldVersion < 2 && !db.objectStoreNames.contains('tiles')) {
        const tilesStore = db.createObjectStore('tiles', { keyPath: 'key' });
        tilesStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Create offlineAreas store (new in version 2)
      if (oldVersion < 2 && !db.objectStoreNames.contains('offlineAreas')) {
        db.createObjectStore('offlineAreas', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('offlinePlaces')) {
        db.createObjectStore('offlinePlaces', { keyPath: 'areaId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePendingTrack(segment: PendingTrackSegment) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tracksPending', 'readwrite');
    const store = tx.objectStore('tracksPending');
    store.put(segment);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============= TILE CACHING FUNCTIONS =============

export async function saveTile(layer: string, z: number, x: number, y: number, blob: Blob, type: 'map' | 'elevation' = 'map'): Promise<void> {
  const db = await openDB();
  const key = type === 'elevation' ? `elevation/${z}/${x}/${y}` : `${layer}/${z}/${x}/${y}`;
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tiles', 'readwrite');
    const store = tx.objectStore('tiles');
    store.put({ key, blob, timestamp: Date.now(), type });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveElevationTile(z: number, x: number, y: number, blob: Blob): Promise<void> {
  return saveTile('elevation', z, x, y, blob, 'elevation');
}

export async function getElevationTile(z: number, x: number, y: number): Promise<Blob | null> {
  const db = await openDB();
  const key = `elevation/${z}/${x}/${y}`;
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction('tiles', 'readonly');
    const store = tx.objectStore('tiles');
    const req = store.get(key);
    req.onsuccess = () => {
      const result = req.result as CachedTile | undefined;
      resolve(result?.blob || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getTile(layer: string, z: number, x: number, y: number): Promise<Blob | null> {
  const db = await openDB();
  const key = `${layer}/${z}/${x}/${y}`;
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction('tiles', 'readonly');
    const store = tx.objectStore('tiles');
    const req = store.get(key);
    req.onsuccess = () => {
      const result = req.result as CachedTile | undefined;
      resolve(result?.blob || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTilesForArea(areaId: string): Promise<void> {
  const area = await getOfflineArea(areaId);
  if (!area) return;
  const { tilesInBounds } = await import('./geo/tiles');
  const { offlineStorageLayer } = await import('./map/offlineLayers');
  const layer = offlineStorageLayer(area.layer);
  const keys = new Set<string>();
  for (const zoom of area.zoomLevels || []) {
    for (const tile of tilesInBounds(area.bounds, zoom)) {
      keys.add(`${layer}/${tile.z}/${tile.x}/${tile.y}`);
    }
  }
  if (area.includesElevation) {
    const { DEM_ZOOM } = await import('./terrain/decode');
    for (const tile of tilesInBounds(area.bounds, DEM_ZOOM)) {
      keys.add(`elevation/${tile.z}/${tile.x}/${tile.y}`);
    }
  }

  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tiles', 'readwrite');
    const store = tx.objectStore('tiles');
    for (const key of keys) store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCacheSize(): Promise<number> {
  const db = await openDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction('tiles', 'readonly');
    const store = tx.objectStore('tiles');
    const req = store.getAll();
    
    req.onsuccess = () => {
      const tiles = req.result as CachedTile[];
      const totalSize = tiles.reduce((sum, tile) => sum + tile.blob.size, 0);
      resolve(totalSize);
    };
    req.onerror = () => reject(req.error);
  });
}

// ============= OFFLINE AREA FUNCTIONS =============

export async function saveOfflineArea(area: OfflineArea): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('offlineAreas', 'readwrite');
    const store = tx.objectStore('offlineAreas');
    store.put(area);
    tx.oncomplete = () => {
      notifyOfflineAreasChanged();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineAreas(): Promise<OfflineArea[]> {
  const db = await openDB();
  return new Promise<OfflineArea[]>((resolve, reject) => {
    const tx = db.transaction('offlineAreas', 'readonly');
    const store = tx.objectStore('offlineAreas');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as OfflineArea[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineArea(id: string): Promise<OfflineArea | null> {
  const db = await openDB();
  return new Promise<OfflineArea | null>((resolve, reject) => {
    const tx = db.transaction('offlineAreas', 'readonly');
    const store = tx.objectStore('offlineAreas');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as OfflineArea || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineArea(id: string): Promise<void> {
  await deleteTilesForArea(id);
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const names = ['offlineAreas', 'offlinePlaces'].filter((name) => db.objectStoreNames.contains(name));
    const tx = db.transaction(names, 'readwrite');
    tx.objectStore('offlineAreas').delete(id);
    if (names.includes('offlinePlaces')) tx.objectStore('offlinePlaces').delete(id);
    tx.oncomplete = () => {
      notifyOfflineAreasChanged();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveOfflinePlaces(bundle: OfflinePlacesBundle): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('offlinePlaces', 'readwrite');
    tx.objectStore('offlinePlaces').put(bundle);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllOfflinePlaces(): Promise<OfflinePlacesBundle[]> {
  const db = await openDB();
  if (!db.objectStoreNames.contains('offlinePlaces')) return [];
  return new Promise<OfflinePlacesBundle[]>((resolve, reject) => {
    const tx = db.transaction('offlinePlaces', 'readonly');
    const req = tx.objectStore('offlinePlaces').getAll();
    req.onsuccess = () => resolve((req.result as OfflinePlacesBundle[]) || []);
    req.onerror = () => reject(req.error);
  });
}


