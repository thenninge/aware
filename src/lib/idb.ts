import { elevationTileKey, mapTileKey, tileKeysForArea } from './tileMath';

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
  failedTileCount?: number; // Fliser som ikke lot seg laste ned
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDBUncached().then((db) => {
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      return db;
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function openDBUncached(): Promise<IDBDatabase> {
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

export async function saveTile(layer: string, z: number, x: number, y: number, blob: Blob, type: 'map' | 'elevation' = 'map'): Promise<void> {
  const db = await openDB();
  const key = type === 'elevation' ? elevationTileKey(z, x, y) : mapTileKey(layer, z, x, y);
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
  const key = elevationTileKey(z, x, y);
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
  const key = mapTileKey(layer, z, x, y);
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

// Sletter kun fliser som tilhører dette området og ikke et annet lagret område
export async function deleteTilesForArea(areaId: string): Promise<void> {
  const areas = await getOfflineAreas();
  const area = areas.find((a) => a.id === areaId);
  if (!area) return;

  const keep = new Set<string>();
  for (const other of areas) {
    if (other.id === areaId) continue;
    for (const key of tileKeysForArea(other)) keep.add(key);
  }
  const keysToDelete = [...tileKeysForArea(area)].filter((key) => !keep.has(key));

  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tiles', 'readwrite');
    const store = tx.objectStore('tiles');
    for (const key of keysToDelete) store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCacheSize(): Promise<number> {
  const db = await openDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction('tiles', 'readonly');
    const req = tx.objectStore('tiles').openCursor();
    let total = 0;
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        total += (cursor.value as CachedTile).blob.size;
        cursor.continue();
      } else {
        resolve(total);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export interface StorageInfo {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const info: StorageInfo = { usage: null, quota: null, persisted: null };
  if (typeof navigator === 'undefined' || !navigator.storage) return info;
  try {
    const estimate = await navigator.storage.estimate();
    info.usage = estimate.usage ?? null;
    info.quota = estimate.quota ?? null;
  } catch {
    // estimate støttes ikke
  }
  try {
    info.persisted = await navigator.storage.persisted();
  } catch {
    // persisted støttes ikke
  }
  return info;
}

// iOS Safari sletter ellers nettsidedata etter ca. 7 dagers inaktivitet. Best effort.
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // ikke støttet
  }
  return false;
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


