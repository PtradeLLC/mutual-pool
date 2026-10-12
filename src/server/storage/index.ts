import { getDb, hasFirestoreCredentials } from '../../config/firebase';
import { createFirestoreAdapter } from './firestore';
import type { StorageAdapter } from './types';

export type { StorageAdapter, StorageWrite, StoredDoc, StorageLimits } from './types';
export { createMemoryAdapter } from './memory';

// The configured backend (STORAGE_BACKEND, default "firestore").
// To add a store, implement StorageAdapter (see ./types.ts) and add a case here.
export function getStorageBackend(): string {
  return (process.env.STORAGE_BACKEND || 'firestore').toLowerCase();
}

// Credentials/settings the configured backend needs, for the production boot check.
export function storageConfigProblems(): string[] {
  switch (getStorageBackend()) {
    case 'firestore':
      return hasFirestoreCredentials()
        ? []
        : ['STORAGE_BACKEND=firestore needs FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS (not required on Cloud Run, which provides default credentials)'];
    default:
      return [`Unknown STORAGE_BACKEND "${getStorageBackend()}"`];
  }
}

export function createStorageAdapter(): StorageAdapter {
  const backend = getStorageBackend();
  switch (backend) {
    case 'firestore': {
      const db = getDb();
      if (!db) throw new Error('Firestore is not available: set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.');
      return createFirestoreAdapter(db);
    }
    default:
      throw new Error(`Unknown STORAGE_BACKEND "${backend}"`);
  }
}
