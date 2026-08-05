import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

let app: App;
let db: Firestore;
let auth: Auth;
let storage: Storage;

export function initializeFirebase(): void {
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    // Check for service account credentials
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : undefined;
    
    if (serviceAccount) {
      app = initializeApp({
        credential: cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    } else {
      // Use default credentials (works in Cloud Run, Cloud Functions, etc.)
      app = initializeApp({
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    }
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  // Configure Firestore settings
  db.settings({
    ignoreUndefinedProperties: true,
  });
}

export function getAuthAdmin(): Auth {
  if (!auth) {
    initializeFirebase();
  }
  return auth;
}

export function getDb(): Firestore {
  if (!db) {
    initializeFirebase();
  }
  return db;
}

export function getStorageAdmin(): Storage {
  if (!storage) {
    initializeFirebase();
  }
  return storage;
}

// Helper to convert Firestore Timestamp to ISO string
export function timestampToISO(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  if (timestamp.toDate) return timestamp.toDate().toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  return new Date(timestamp).toISOString();
}

// Helper to convert ISO string to Firestore Timestamp
export function isoToTimestamp(isoString: string): any {
  const { Timestamp } = require('firebase-admin/firestore');
  return Timestamp.fromDate(new Date(isoString));
}

// Batch write helper
export async function batchWrite(operations: Array<{ ref: any; data: any; type: 'set' | 'update' | 'delete' }>): Promise<void> {
  const batch = db.batch();
  
  for (const op of operations) {
    switch (op.type) {
      case 'set':
        batch.set(op.ref, op.data);
        break;
      case 'update':
        batch.update(op.ref, op.data);
        break;
      case 'delete':
        batch.delete(op.ref);
        break;
    }
  }
  
  await batch.commit();
}

// Transaction helper with retry
export async function runTransaction<T>(
  updateFn: (transaction: any) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let attempt = 0;
  
  while (true) {
    try {
      return await db.runTransaction(updateFn);
    } catch (error: any) {
      attempt++;
      if (attempt >= maxAttempts || !error.message?.includes('ABORTED')) {
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 50));
    }
  }
}

// Collection references
export const COLLECTIONS = {
  USERS: 'users',
  PODS: 'pods',
  DEPOSITS: 'deposits',
  REPRIORITIZATION_REQUESTS: 'reprioritizationRequests',
  AUDIT_LOGS: 'auditLogs',
  PERKS: 'perks',
  REDEMPTIONS: 'redemptions',
  WEEKLY_CYCLES: 'weeklyCycles',
  IDEMPOTENCY_KEYS: 'idempotencyKeys',
} as const;

export type CollectionName = keyof typeof COLLECTIONS;