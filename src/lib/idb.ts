export interface PendingTrackSegment {
  id: string | null;
  createdAt: string;
  points: Array<{ lat: number; lng: number; heading?: number }>;
}

export interface CachedTile {
  key: string; // format: "layer/z/x/y"
  blob: Blob;
  timestamp: number;
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
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aware-db', 2); // Increment version for schema change
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

export async function saveTile(layer: string, z: number, x: number, y: number, blob: Blob): Promise<void> {
  const db = await openDB();
  const key = `${layer}/${z}/${x}/${y}`;
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tiles', 'readwrite');
    const store = tx.objectStore('tiles');
    store.put({ key, blob, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
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
  const db = await openDB();
  const area = await getOfflineArea(areaId);
  if (!area) return;

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tiles', 'readwrite');
    const store = tx.objectStore('tiles');
    
    // Delete all tiles for this layer within the area bounds
    const layerPrefix = `${area.layer}/`;
    const req = store.openCursor();
    
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (cursor.key.toString().startsWith(layerPrefix)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    
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
    tx.oncomplete = () => resolve();
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
    const tx = db.transaction('offlineAreas', 'readwrite');
    const store = tx.objectStore('offlineAreas');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}


