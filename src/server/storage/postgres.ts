// Postgres storage backend for src/server/persistence.ts (Fly Postgres in
// production). One table holds every collection as JSON documents:
//
//   app_documents(collection text, id text, doc jsonb, updated_at timestamptz)
//
// The persistence engine keeps all state in memory and only needs to (1) load
// a whole collection at boot and (2) apply a batch of upserts/deletes
// atomically, so a single transaction per batch is all the SQL there is.
import { Pool } from 'pg';
import type { StorageAdapter, StoredDoc, StorageWrite } from './types';

export const DOCUMENTS_TABLE = 'app_documents';

// The slice of the pg API the adapter uses, so tests can supply a fake.
export interface PgQueryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}
export interface PgClientLike extends PgQueryable {
  release(): void;
}
export interface PgPoolLike extends PgQueryable {
  connect(): Promise<PgClientLike>;
}

export function createPostgresPool(databaseUrl: string): Pool {
  // Fly's internal network (*.flycast / *.internal) is private and does not
  // use TLS; external URLs (or DATABASE_SSL=true) do.
  const needsSsl = process.env.DATABASE_SSL === 'true' || /sslmode=require/i.test(databaseUrl);
  return new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export async function ensureSchema(db: PgQueryable): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS ${DOCUMENTS_TABLE} (
    collection text NOT NULL,
    id text NOT NULL,
    doc jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (collection, id)
  )`);
}

export function createPostgresAdapter(pool: PgPoolLike): StorageAdapter {
  return {
    name: 'postgres',
    limits: {
      // jsonb documents can be far larger; these keep single documents and
      // batches comfortably inside one transaction.
      maxDocBytes: 4 * 1024 * 1024,
      maxBatchWrites: 500,
      maxBatchBytes: 16 * 1024 * 1024,
      rejectsNestedArrays: false,
    },

    async loadAll(collection: string): Promise<StoredDoc[]> {
      const { rows } = await pool.query(`SELECT id, doc FROM ${DOCUMENTS_TABLE} WHERE collection = $1`, [collection]);
      return rows.map(r => ({ ...(r.doc as Record<string, unknown>), id: r.id }));
    },

    async commit(writes: StorageWrite[]): Promise<void> {
      if (writes.length === 0) return;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const w of writes) {
          if (w.op === 'delete') {
            await client.query(`DELETE FROM ${DOCUMENTS_TABLE} WHERE collection = $1 AND id = $2`, [w.collection, w.id]);
          } else {
            await client.query(
              `INSERT INTO ${DOCUMENTS_TABLE} (collection, id, doc, updated_at) VALUES ($1, $2, $3::jsonb, now())
               ON CONFLICT (collection, id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
              [w.collection, w.id, JSON.stringify(w.doc)]
            );
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* connection may already be gone */ }
        throw err;
      } finally {
        client.release();
      }
    },

    isRejection(err: any): boolean {
      // SQLSTATE classes: 22 data exception (e.g. invalid JSON), 23 integrity
      // constraint, 42 syntax/access: the content or statement itself is
      // refused and retrying the same write will not help. Everything else
      // (connection reset, timeout, 53/57/58 resource and operator errors) is
      // transient.
      const code = String(err?.code || '');
      return /^(22|23|42)/.test(code);
    },
  };
}
