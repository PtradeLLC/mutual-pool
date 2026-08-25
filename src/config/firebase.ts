import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

// NOTE: We intentionally do NOT statically import a JSON config file here.
// A top-level `import x from './some.json'` runs at module-load time, outside
// any try/catch in this file — if that file is missing from the deployed
// bundle (e.g. gitignored, or outside the traced serverless function tree),
// the whole module fails to load and takes every route in server.ts down
// with it. Environment variables are the correct source of truth for a
// serverless deployment; this optional, guarded fallback below is only for
// local development convenience and can be deleted once env vars are set
// in Vercel.
function loadOptionalLocalConfig(): { projectId?: string; storageBucket?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const local = require('../../firebase-applet-config.json');
    return { projectId: local?.projectId, storageBucket: local?.storageBucket };
  } catch {
    return { projectId: 'gen-lang-client-0970051758' };
  }
}

let app: App | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: Storage | null = null;

export function initializeFirebase(): void {
  try {
    if (getApps().length > 0) {
      app = getApps()[0];
    } else {
      // Check for service account credentials
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : undefined;

      const localConfig = loadOptionalLocalConfig();
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || localConfig.projectId || 'gen-lang-client-0970051758';
      const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || localConfig.storageBucket;

      if (serviceAccount) {
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId,
          storageBucket,
        });
      } else {
        // Use default credentials / project if available
        app = initializeApp({
          projectId,
          storageBucket,
        });
      }
    }
    
    if (app) {
      try { auth = getAuth(app); } catch {}
      try { 
        db = getFirestore(app);
        db.settings({ ignoreUndefinedProperties: true });
      } catch {}
      try { storage = getStorage(app); } catch {}
    }
  } catch (err) {
    // Graceful fallback for environments without GCP default credentials
  }
}

export function getAuthAdmin(): Auth | null {
  if (!auth) {
    initializeFirebase();
  }
  return auth || null;
}

export function getDb(): Firestore | null {
  if (!db) {
    initializeFirebase();
  }
  return db || null;
}

export function getStorageAdmin(): Storage | null {
  if (!storage) {
    initializeFirebase();
  }
  return storage || null;
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
  const activeDb = getDb();
  if (!activeDb) {
    console.warn('[Firebase Admin] batchWrite skipped — Admin DB not initialized.');
    return;
  }
  const batch = activeDb.batch();
  
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
  const activeDb = getDb();
  if (!activeDb) {
    throw new Error('Firebase Admin DB not initialized — cannot run transaction.');
  }
  let attempt = 0;
  
  while (true) {
    try {
      return await activeDb.runTransaction(updateFn);
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
