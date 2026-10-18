// Postgres storage adapter: SQL it issues and its all-or-nothing batches,
// against a fake pg pool that understands just the statements the adapter
// uses. Set TEST_DATABASE_URL to also run the same checks against a real
// Postgres (e.g. a local `postgres://localhost/mutual_pool_test`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresAdapter, createPostgresPool, ensureSchema, DOCUMENTS_TABLE, PgClientLike, PgPoolLike } from '../src/server/storage/postgres';
import type { StorageWrite } from '../src/server/storage/types';

// Minimal transactional fake: statements inside BEGIN/COMMIT apply to a staging
// copy that replaces the committed data only on COMMIT.
function createFakePool() {
  const committed = new Map<string, Map<string, any>>();
  const log: string[] = [];
  let failOnId: string | null = null;

  const apply = (store: Map<string, Map<string, any>>, text: string, params: unknown[]) => {
    if (/^INSERT INTO/i.test(text)) {
      const [collection, id, json] = params as [string, string, string];
      if (id === failOnId) throw Object.assign(new Error('invalid input syntax for type json'), { code: '22P02' });
      if (!store.has(collection)) store.set(collection, new Map());
      store.get(collection)!.set(id, JSON.parse(json));
      return { rows: [] };
    }
    if (/^DELETE FROM/i.test(text)) {
      const [collection, id] = params as [string, string];
      store.get(collection)?.delete(id);
      return { rows: [] };
    }
    if (/^SELECT id, doc/i.test(text)) {
      const [collection] = params as [string];
      return { rows: Array.from(store.get(collection)?.entries() || []).map(([id, doc]) => ({ id, doc })) };
    }
    if (/^CREATE TABLE/i.test(text)) return { rows: [] };
    throw new Error(`fake pool: unexpected statement ${text}`);
  };

  const pool: PgPoolLike & { committed: typeof committed; log: string[]; failOn(id: string | null): void } = {
    committed,
    log,
    failOn(id) { failOnId = id; },
    async query(text, params = []) {
      log.push(text.split(/\s+/).slice(0, 2).join(' '));
      return apply(committed, text, params);
    },
    async connect(): Promise<PgClientLike> {
      let staging: Map<string, Map<string, any>> | null = null;
      return {
        async query(text, params = []) {
          log.push(text.split(/\s+/).slice(0, 2).join(' '));
          if (text === 'BEGIN') { staging = new Map(Array.from(committed.entries()).map(([c, m]) => [c, new Map(m)])); return { rows: [] }; }
          if (text === 'COMMIT') { if (staging) { committed.clear(); for (const [c, m] of staging) committed.set(c, m); } staging = null; return { rows: [] }; }
          if (text === 'ROLLBACK') { staging = null; return { rows: [] }; }
          return apply(staging || committed, text, params);
        },
        release() {},
      };
    },
  };
  return pool;
}

const set = (collection: string, id: string, doc: Record<string, unknown>): StorageWrite => ({ collection, id, op: 'set', doc: { ...doc, id }, bytes: 10 });
const del = (collection: string, id: string): StorageWrite => ({ collection, id, op: 'delete', bytes: 1 });

test('ensureSchema creates the documents table if missing', async () => {
  const pool = createFakePool();
  await ensureSchema(pool);
  assert.ok(pool.log.includes('CREATE TABLE'));
});

test('commit upserts and deletes inside one transaction; loadAll returns documents with their ids', async () => {
  const pool = createFakePool();
  const adapter = createPostgresAdapter(pool);
  await adapter.commit([set('users', 'u1', { name: 'A' }), set('users', 'u2', { name: 'B' }), set('pods', 'p1', { name: 'Pod' })]);
  await adapter.commit([set('users', 'u1', { name: 'A2', tags: [['nested'], ['arrays']] }), del('users', 'u2')]);

  const users = await adapter.loadAll('users');
  assert.deepEqual(users.map(u => u.id).sort(), ['u1']);
  assert.equal(users[0].name, 'A2');
  assert.deepEqual(users[0].tags, [['nested'], ['arrays']], 'nested arrays are fine in jsonb');
  assert.equal((await adapter.loadAll('pods')).length, 1);
  assert.deepEqual(await adapter.loadAll('missing'), []);
  assert.deepEqual(pool.log.filter(l => l === 'BEGIN' || l === 'COMMIT' || l === 'ROLLBACK'), ['BEGIN', 'COMMIT', 'BEGIN', 'COMMIT']);
});

test('a refused write rolls the whole batch back', async () => {
  const pool = createFakePool();
  const adapter = createPostgresAdapter(pool);
  await adapter.commit([set('users', 'u1', { v: 1 })]);
  pool.failOn('bad');
  await assert.rejects(adapter.commit([set('users', 'u1', { v: 2 }), set('users', 'bad', { v: 0 })]), (err: any) => adapter.isRejection(err));
  assert.equal((await adapter.loadAll('users'))[0].v, 1, 'earlier write in the same batch was not applied');
  assert.ok(pool.log.includes('ROLLBACK'));
});

test('isRejection distinguishes bad content from outages', () => {
  const adapter = createPostgresAdapter(createFakePool());
  assert.equal(adapter.isRejection({ code: '22P02' }), true);   // invalid JSON
  assert.equal(adapter.isRejection({ code: '23505' }), true);   // unique violation
  assert.equal(adapter.isRejection({ code: '42P01' }), true);   // missing table
  assert.equal(adapter.isRejection({ code: 'ECONNRESET' }), false);
  assert.equal(adapter.isRejection({ code: '57P01' }), false);  // admin shutdown
  assert.equal(adapter.isRejection(new Error('timeout')), false);
});

test('limits allow nested arrays and are generous', () => {
  const adapter = createPostgresAdapter(createFakePool());
  assert.equal(adapter.limits.rejectsNestedArrays, false);
  assert.ok(adapter.limits.maxBatchWrites >= 100);
});

test('against a real Postgres (TEST_DATABASE_URL)', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = createPostgresPool(process.env.TEST_DATABASE_URL!);
  try {
    await ensureSchema(pool);
    const adapter = createPostgresAdapter(pool);
    const collection = `t_${Date.now()}`;
    await adapter.commit([set(collection, 'a', { n: 1 }), set(collection, 'b', { n: 2 })]);
    await adapter.commit([del(collection, 'b'), set(collection, 'a', { n: 3 })]);
    const rows = await adapter.loadAll(collection);
    assert.deepEqual(rows, [{ id: 'a', n: 3 }]);
    await pool.query(`DELETE FROM ${DOCUMENTS_TABLE} WHERE collection = $1`, [collection]);
  } finally {
    await pool.end();
  }
});
