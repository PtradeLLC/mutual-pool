// Firestore storage adapter: translation between the StorageAdapter contract
// and the Firestore Admin API, using an in-memory stand-in for Firestore.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFirestoreAdapter } from '../src/server/storage/firestore';

function createFakeFirestore(initial: Record<string, Record<string, any>>) {
  const data: Record<string, Map<string, any>> = {};
  for (const [col, docs] of Object.entries(initial)) data[col] = new Map(Object.entries(docs));
  let rejectNext: Error | null = null;
  const db: any = {
    collection(name: string) {
      data[name] = data[name] || new Map();
      return {
        async get() {
          return { docs: Array.from(data[name].entries()).map(([id, value]) => ({ id, data: () => value })) };
        },
        doc(id: string) {
          return { col: name, id };
        },
      };
    },
    batch() {
      const ops: Array<() => void> = [];
      return {
        set(ref: any, value: any) { ops.push(() => data[ref.col].set(ref.id, structuredClone(value))); },
        delete(ref: any) { ops.push(() => data[ref.col].delete(ref.id)); },
        async commit() {
          if (rejectNext) {
            const err = rejectNext;
            rejectNext = null;
            throw err;
          }
          ops.forEach(op => op());
        },
      };
    },
  };
  return { db, data, rejectWith: (err: Error) => { rejectNext = err; } };
}

test('loadAll returns plain JSON with ids and converts Timestamps to ISO strings', async () => {
  const fakeTimestamp = { toDate: () => new Date('2026-01-02T03:04:05.000Z') };
  const fake = createFakeFirestore({ auditLogs: { l1: { action: 'X', createdAt: fakeTimestamp, nested: { at: fakeTimestamp } } } });
  const adapter = createFirestoreAdapter(fake.db);

  const docs = await adapter.loadAll('auditLogs');
  assert.deepEqual(docs, [{ id: 'l1', action: 'X', createdAt: '2026-01-02T03:04:05.000Z', nested: { at: '2026-01-02T03:04:05.000Z' } }]);
  assert.deepEqual(await adapter.loadAll('missing'), []);
});

test('commit applies sets and deletes in one batch', async () => {
  const fake = createFakeFirestore({ users: { a: { id: 'a' }, b: { id: 'b' } } });
  const adapter = createFirestoreAdapter(fake.db);

  await adapter.commit([
    { collection: 'users', id: 'a', op: 'set', doc: { id: 'a', balance: 3 }, bytes: 20 },
    { collection: 'users', id: 'b', op: 'delete', bytes: 64 },
  ]);
  assert.deepEqual(fake.data.users.get('a'), { id: 'a', balance: 3 });
  assert.equal(fake.data.users.has('b'), false);
});

test('only INVALID_ARGUMENT errors count as permanent rejections', async () => {
  const adapter = createFirestoreAdapter(createFakeFirestore({}).db);
  assert.equal(adapter.isRejection(Object.assign(new Error('3 INVALID_ARGUMENT: bad'), { code: 3 })), true);
  assert.equal(adapter.isRejection(Object.assign(new Error('14 UNAVAILABLE'), { code: 14 })), false);
  assert.equal(adapter.isRejection(Object.assign(new Error('4 DEADLINE_EXCEEDED'), { code: 4 })), false);
});

test('limits reflect Firestore constraints', () => {
  const { limits } = createFirestoreAdapter(createFakeFirestore({}).db);
  assert.ok(limits.maxDocBytes < 1024 * 1024);
  assert.ok(limits.maxBatchWrites <= 500);
  assert.ok(limits.maxBatchBytes < 10 * 1024 * 1024);
  assert.equal(limits.rejectsNestedArrays, true);
});
