import { createMemoryAdapter } from './memory';
import { createPostgresAdapter, createPostgresPool, ensureSchema } from './postgres';
import type { StorageAdapter } from './types';

export type { StorageAdapter, StorageWrite, StoredDoc, StorageLimits } from './types';
export { createMemoryAdapter } from './memory';

// The configured backend (STORAGE_BACKEND, default "postgres").
//   postgres  Fly Postgres (or any Postgres) via DATABASE_URL
//   memory    in-process only; development and tests
// To add a store, implement StorageAdapter (see ./types.ts) and add a case here.
export function getStorageBackend(): string {
  return (process.env.STORAGE_BACKEND || 'postgres').toLowerCase();
}

// Settings the configured backend needs, for the production boot check.
export function storageConfigProblems(): string[] {
  switch (getStorageBackend()) {
    case 'postgres':
      return /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || '')
        ? []
        : ['STORAGE_BACKEND=postgres needs DATABASE_URL (on Fly: `fly postgres attach` sets it)'];
    case 'memory':
      return ['STORAGE_BACKEND=memory loses all data on restart and is not allowed in production'];
    default:
      return [`Unknown STORAGE_BACKEND "${getStorageBackend()}"`];
  }
}

// Connects and prepares the backend (schema) so it is ready for hydration.
export async function createStorageAdapter(): Promise<StorageAdapter> {
  const backend = getStorageBackend();
  switch (backend) {
    case 'postgres': {
      const url = process.env.DATABASE_URL || '';
      if (!url) throw new Error('DATABASE_URL is not set.');
      const pool = createPostgresPool(url);
      await ensureSchema(pool);
      return createPostgresAdapter(pool);
    }
    case 'memory':
      return createMemoryAdapter();
    default:
      throw new Error(`Unknown STORAGE_BACKEND "${backend}"`);
  }
}
