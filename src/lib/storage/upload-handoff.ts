/**
 * IndexedDB Upload Handoff
 * Replaces sessionStorage with a 30-minute expiring client-side store
 * that survives new tabs (e.g. Magic Link email authentication).
 */

const DB_NAME = 'trace_storage';
const DB_VERSION = 1;
const STORE_NAME = 'pending_handoff';
const RECORD_ID = 'current_upload';
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export class StorageQuotaError extends Error {
  constructor(message = 'Your browser storage is full. Please clear space or sign in first.') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

export interface StoredUploadRecord {
  id: string;
  fileBlob: Blob;
  fileName: string;
  fileType: string;
  jobInput: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Saves a file and jobInput to IndexedDB with 30-minute expiry.
 * Handles QuotaExceededError cleanly.
 */
export async function savePendingUpload(file: File, jobInput: string): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch (err) {
    console.warn('IndexedDB unavailable:', err);
    return;
  }

  const record: StoredUploadRecord = {
    id: RECORD_ID,
    fileBlob: file,
    fileName: file.name,
    fileType: file.type || 'application/pdf',
    jobInput,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(record);

      putReq.onsuccess = () => resolve();
      putReq.onerror = (e) => {
        const error = (e.target as IDBRequest).error;
        if (
          error &&
          (error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            error.code === 22)
        ) {
          reject(new StorageQuotaError());
        } else {
          reject(error || new Error('Failed to save pending upload'));
        }
      };

      tx.onerror = (e) => {
        const error = (e.target as IDBTransaction).error;
        if (
          error &&
          (error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            error.code === 22)
        ) {
          reject(new StorageQuotaError());
        } else {
          reject(error || new Error('Transaction failed'));
        }
      };
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.name === 'QuotaExceededError' ||
          err.message.includes('QuotaExceeded') ||
          (err as { code?: number }).code === 22)
      ) {
        reject(new StorageQuotaError());
      } else {
        reject(err);
      }
    }
  });
}

/**
 * Retrieves the pending upload if present and within the 30-minute expiry window.
 * Returns null if missing or expired. Expired records are deleted immediately.
 */
export async function getPendingUpload(): Promise<{ file: File; jobInput: string } | null> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(RECORD_ID);

      getReq.onsuccess = async () => {
        const record = getReq.result as StoredUploadRecord | undefined;
        if (!record) {
          return resolve(null);
        }

        const age = Date.now() - record.createdAt;
        if (age > EXPIRY_MS) {
          // Expired: delete record and return null
          await clearPendingUpload();
          return resolve(null);
        }

        const reconstructedFile = new File([record.fileBlob], record.fileName, {
          type: record.fileType || 'application/pdf',
        });

        resolve({
          file: reconstructedFile,
          jobInput: record.jobInput,
        });
      };

      getReq.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Checks if a valid, non-expired pending upload exists.
 */
export async function hasPendingUpload(): Promise<boolean> {
  const upload = await getPendingUpload();
  return upload !== null;
}

/**
 * Clears the pending upload record from IndexedDB.
 */
export async function clearPendingUpload(): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const delReq = store.delete(RECORD_ID);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
