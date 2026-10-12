// Storage backend contract for src/server/persistence.ts.
//
// The persistence engine keeps all state in memory and only needs a document
// store that can (1) load every document of a collection at boot and (2) apply
// a batch of upserts/deletes. Each collection is a set of JSON documents keyed
// by `id`. Any store can implement this: Firestore, Postgres (one JSONB table per
// collection, or one table with a (collection, id) key), SQLite, etc.

export type StoredDoc = Record<string, unknown> & { id: string };

export interface StorageWrite {
  collection: string;
  id: string;
  op: 'set' | 'delete';
  // Full document for 'set' (replaces any existing document with this id).
  doc?: StoredDoc;
  // Serialized size in bytes, for batching against the backend's limits.
  bytes: number;
}

export interface StorageLimits {
  // Largest single document the backend accepts.
  maxDocBytes: number;
  // Most writes / bytes the backend accepts in one commit.
  maxBatchWrites: number;
  maxBatchBytes: number;
  // Firestore cannot store an array directly inside another array.
  rejectsNestedArrays: boolean;
}

export interface StorageAdapter {
  readonly name: string;
  readonly limits: StorageLimits;

  // Every document in the collection, as plain JSON values (no backend-specific
  // types such as timestamps). An unknown collection returns [].
  loadAll(collection: string): Promise<StoredDoc[]>;

  // Apply the writes. Must be all-or-nothing per call: either every write lands
  // or the call throws and none does.
  commit(writes: StorageWrite[]): Promise<void>;

  // True when the error means the backend permanently refused the content (bad
  // document), as opposed to a transient failure (outage, timeout) that should
  // be retried unchanged.
  isRejection(err: unknown): boolean;
}
