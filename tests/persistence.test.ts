// Persistence engine tests, run against the in-memory storage adapter so they
// hold for any backend that honours the StorageAdapter contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerCollection, hydrateFromStorage, flushNow, getPersistenceHealth } from '../src/server/persistence';
import { createMemoryAdapter } from '../src/server/storage/memory';
import type { StorageAdapter } from '../src/server/storage/types';

const memory = createMemoryAdapter(
  { users: { u1: { balance: 10 }, u2: { balance: 5 } } },
  // Small limits so batching and size checks are exercised.
  { maxBatchWrites: 2, maxDocBytes: 10_000, rejectsNestedArrays: true }
);

let failing = false;
let commits = 0;
let writes = 0;
// Wrap the adapter to simulate outages and a document the backend refuses.
const adapter: StorageAdapter = {
  ...memory,
  async commit(batch) {
    if (failing) throw new Error('simulated outage');
    if (batch.some(w => w.id === 'poison')) throw new Error('invalid write: simulated bad document');
    commits += 1;
    writes += batch.length;
    return memory.commit(batch);
  },
};
const stored = () => memory.data.get('users')!;

let users: any[] = [];
registerCollection({ collection: 'users', get: () => users, set: docs => { users = docs; } });

test('hydrates in-memory state from storage', async () => {
  await hydrateFromStorage(adapter);
  assert.deepEqual(users.map(u => u.id).sort(), ['u1', 'u2']);
  assert.equal(getPersistenceHealth().enabled, true);
  assert.equal(getPersistenceHealth().backend, 'memory');
});

test('flush writes only changed, new and deleted documents', async () => {
  const before = writes;
  await flushNow();
  assert.equal(writes, before, 'no-op flush should not write');

  users.find(u => u.id === 'u1').balance = 25;              // changed
  users.push({ id: 'u3', balance: 1, note: undefined });     // new (undefined stripped)
  users = users.filter(u => u.id !== 'u2');                  // deleted
  await flushNow();

  assert.equal(writes - before, 3);
  assert.equal(stored().get('u1')!.balance, 25);
  assert.deepEqual(stored().get('u3'), { id: 'u3', balance: 1 });
  assert.equal(stored().has('u2'), false);
});

test('writes are split into batches within the backend limits', async () => {
  const commitsBefore = commits;
  for (let i = 0; i < 5; i++) users.push({ id: `bulk${i}`, n: i });
  await flushNow();
  assert.equal(commits - commitsBefore, 3, '5 writes with maxBatchWrites=2 -> 3 commits');
  users = users.filter(u => !String(u.id).startsWith('bulk'));
  await flushNow();
});

test('failed flushes are retried on the next flush', async () => {
  users.find(u => u.id === 'u1').balance = 99;
  failing = true;
  await flushNow();
  assert.equal(stored().get('u1')!.balance, 25, 'write should not have landed');
  assert.ok(getPersistenceHealth().lastError);

  failing = false;
  await flushNow();
  assert.equal(stored().get('u1')!.balance, 99);
  assert.equal(getPersistenceHealth().lastError, null);
});

test('a document the backend rejects is quarantined without blocking the others', async () => {
  users.push({ id: 'poison', balance: 1 });
  users.push({ id: 'u4', balance: 4 });
  await flushNow();
  assert.equal(stored().get('u4')!.balance, 4, 'good document in the same batch must still land');
  assert.equal(stored().has('poison'), false);
  assert.ok(getPersistenceHealth().quarantined.includes('users/poison'));

  // A later flush with no changes is clean again (the bad doc is not retried every time).
  await flushNow();
  assert.equal(getPersistenceHealth().lastError, null);
});

test('documents outside the backend limits are never sent', async () => {
  users.push({ id: 'nested', tags: [[1, 2]] });
  users.push({ id: 'huge', blob: 'x'.repeat(20_000) });
  await flushNow();
  assert.equal(stored().has('nested'), false);
  assert.equal(stored().has('huge'), false);
  assert.ok(getPersistenceHealth().quarantined.includes('users/nested'));
  assert.ok(getPersistenceHealth().quarantined.includes('users/huge'));
});

test('documents without a valid id are skipped', async () => {
  users.push({ id: 'bad/id', balance: 1 }, { balance: 2 });
  await flushNow();
  assert.equal(stored().has('bad/id'), false);
  assert.deepEqual(Array.from(stored().keys()).sort(), ['u1', 'u3', 'u4']);
});
