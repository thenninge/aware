export interface PendingTrackSegment {
  id: string | null;
  createdAt: string;
  points: Array<{ lat: number; lng: number; heading?: number }>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aware-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('tracksPending')) {
        db.createObjectStore('tracksPending', { keyPath: 'createdAt' });
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


