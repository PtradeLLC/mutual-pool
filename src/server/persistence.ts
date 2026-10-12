// Write-behind persistence for the single-instance Node server.
//
// The server keeps working state in memory (module-level arrays in server.ts and
// chatManager.ts). In production that state is hydrated from the storage backend
// (src/server/storage) at boot, and every registered collection is diffed per
// document and flushed back: shortly after any change is signalled, on an
// interval as a safety net, and on SIGTERM/SIGINT before exit. Only changed or
// deleted documents are written.
//
// This is only correct while exactly ONE server instance runs (e.g. Cloud Run
// with max-instances=1). Running several instances would let them overwrite
// each other's state.

import type { StorageAdapter, StorageWrite } from './storage/types';

interface CollectionSource {
  collection: string;
  get: () => Array<{ id?: string } | null | undefined>;
  set: (docs: any[]) => void;
}

const sources: CollectionSource[] = [];
// collection -> (docId -> serialized JSON last written / loaded)
const snapshots = new Map<string, Map<string, string>>();

let storage: StorageAdapter | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let intervalTimer: NodeJS.Timeout | null = null;
let flushing: Promise<void> | null = null;
let rerunRequested = false;

const health = {
  enabled: false,
  backend: null as string | null,
  lastFlushAt: null as string | null,
  lastError: null as string | null,
  consecutiveFailures: 0,
};

// Docs the backend rejected (or that exceed its limits); skipped, and logged
// once, until they change.
const quarantined = new Map<string, string>();

function stripUndefined(value: any): any {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out;
  }
  return value;
}

function hasNestedArray(value: any, insideArray = false): boolean {
  if (Array.isArray(value)) {
    if (insideArray) return true;
    return value.some(v => hasNestedArray(v, true));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(v => hasNestedArray(v, false));
  }
  return false;
}

function isValidDocId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 700 && !id.includes('/') && id !== '.' && id !== '..';
}

export function registerCollection(source: CollectionSource): void {
  sources.push(source);
}

export function isPersistenceEnabled(): boolean {
  return health.enabled;
}

export function getPersistenceHealth() {
  return { ...health, collections: sources.map(s => s.collection), quarantined: Array.from(quarantined.keys()) };
}

// Flush immediately and report whether everything is durable.
// Used before irreversible side effects (e.g. a Stripe transfer).
export async function persistNow(): Promise<boolean> {
  if (!health.enabled) return true;
  await flushNow();
  return health.lastError === null;
}

let shutdownHooks: Array<() => Promise<void>> = [];
export function onBeforeShutdown(hook: () => Promise<void>): void {
  shutdownHooks.push(hook);
}

// Load every registered collection from storage, replacing in-memory state.
export async function hydrateFromStorage(adapter: StorageAdapter): Promise<void> {
  storage = adapter;
  for (const source of sources) {
    const docs = await adapter.loadAll(source.collection);
    source.set(docs);
    const snapshot = new Map<string, string>();
    for (const doc of source.get()) {
      if (doc && isValidDocId(doc.id)) snapshot.set(doc.id, JSON.stringify(stripUndefined(doc)));
    }
    snapshots.set(source.collection, snapshot);
    console.log(`[persistence] Loaded ${docs.length} ${source.collection} document(s) from ${adapter.name}`);
  }
  health.backend = adapter.name;
  health.enabled = true;
}

interface PendingWrite {
  key: string;
  write: StorageWrite;
  // Called once the write is durable so the snapshot advances per document.
  commit: () => void;
}

async function commitWrites(writes: PendingWrite[]): Promise<void> {
  if (!storage) return;
  try {
    await storage.commit(writes.map(w => w.write));
    writes.forEach(w => w.commit());
  } catch (err: any) {
    // Transient failures (outage, timeout, permissions) are retried unchanged.
    if (!storage.isRejection(err)) throw err;
    if (writes.length === 1) {
      // A single document the backend refuses: quarantine it so it can't block the rest.
      const w = writes[0];
      if (!quarantined.has(w.key)) {
        console.error(`[persistence] ${storage.name} rejected ${w.key}; quarantined until it changes:`, err?.message || err);
      }
      quarantined.set(w.key, 'rejected');
      w.commit();
      health.lastError = `rejected ${w.key}: ${err?.message || err}`;
      return;
    }
    // Retry one document at a time so a single bad document only loses itself.
    for (const w of writes) await commitWrites([w]);
  }
}

async function flushOnce(): Promise<void> {
  if (!storage) return;
  const { limits } = storage;
  const writes: PendingWrite[] = [];

  for (const source of sources) {
    const collection = source.collection;
    const previous = snapshots.get(collection) || new Map<string, string>();
    const next = new Map<string, string>(previous);
    snapshots.set(collection, next);
    const seen = new Set<string>();

    for (const doc of source.get()) {
      if (!doc || !isValidDocId(doc.id)) continue;
      const id = doc.id;
      seen.add(id);
      const clean = stripUndefined(doc);
      const serialized = JSON.stringify(clean);
      const key = `${collection}/${id}`;
      if (previous.get(id) === serialized) continue;
      if (quarantined.get(key) === serialized) continue;
      quarantined.delete(key);

      const bytes = Buffer.byteLength(serialized);
      const nested = limits.rejectsNestedArrays && hasNestedArray(clean);
      if (bytes > limits.maxDocBytes || nested) {
        if (!quarantined.has(key)) {
          console.error(`[persistence] ${key} is not storable in ${storage.name} (${bytes} bytes, nestedArray=${nested}); quarantined until it changes.`);
        }
        quarantined.set(key, serialized);
        next.set(id, serialized);
        continue;
      }
      writes.push({
        key,
        write: { collection, id, op: 'set', doc: clean, bytes },
        commit: () => next.set(id, serialized),
      });
    }
    for (const id of previous.keys()) {
      if (seen.has(id)) continue;
      writes.push({
        key: `${collection}/${id}`,
        write: { collection, id, op: 'delete', bytes: 64 },
        commit: () => next.delete(id),
      });
    }
  }

  // Group into commits bounded by both write count and payload size.
  const groups: PendingWrite[][] = [];
  let group: PendingWrite[] = [];
  let groupBytes = 0;
  for (const w of writes) {
    if (group.length > 0 && (group.length >= limits.maxBatchWrites || groupBytes + w.write.bytes > limits.maxBatchBytes)) {
      groups.push(group);
      group = [];
      groupBytes = 0;
    }
    group.push(w);
    groupBytes += w.write.bytes;
  }
  if (group.length) groups.push(group);

  health.lastError = null;
  for (const g of groups) await commitWrites(g);
  if (health.lastError) throw new Error(health.lastError);
}

export function flushNow(): Promise<void> {
  if (!health.enabled) return Promise.resolve();
  if (flushing) {
    rerunRequested = true;
    return flushing;
  }
  flushing = (async () => {
    try {
      do {
        rerunRequested = false;
        await flushOnce();
      } while (rerunRequested);
      health.lastFlushAt = new Date().toISOString();
      health.lastError = null;
      health.consecutiveFailures = 0;
    } catch (err: any) {
      health.lastError = err?.message || String(err);
      health.consecutiveFailures += 1;
      console.error(`[persistence] ${storage?.name} flush failed (will retry):`, health.lastError);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

// Debounced flush; call after mutating state.
export function requestFlush(): void {
  if (!health.enabled || flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushNow();
  }, 200);
}

export function startAutoFlush(intervalMs = 30_000): void {
  if (intervalTimer) return;
  intervalTimer = setInterval(() => void flushNow(), intervalMs);
  intervalTimer.unref();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[persistence] ${signal} received, draining connections and flushing state to ${storage?.name}...`);
    for (const hook of shutdownHooks) {
      try { await hook(); } catch (err) { console.error('[persistence] shutdown hook failed:', err); }
    }
    if (flushTimer) clearTimeout(flushTimer);
    await flushNow();
    process.exit(health.lastError ? 1 : 0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
