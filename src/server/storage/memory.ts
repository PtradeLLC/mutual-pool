import type { StorageAdapter, StorageLimits, StoredDoc, StorageWrite } from './types';

// In-process storage backend: used by tests, and a reference implementation of
// the StorageAdapter contract. Data is lost when the process exits.
export interface MemoryAdapter extends StorageAdapter {
  data: Map<string, Map<string, StoredDoc>>;
}

export function createMemoryAdapter(
  initial: Record<string, Record<string, Record<string, unknown>>> = {},
  limits: Partial<StorageLimits> = {}
): MemoryAdapter {
  const data = new Map<string, Map<string, StoredDoc>>();
  for (const [collection, docs] of Object.entries(initial)) {
    data.set(collection, new Map(Object.entries(docs).map(([id, doc]) => [id, { ...structuredClone(doc), id }])));
  }

  return {
    name: 'memory',
    data,
    limits: {
      maxDocBytes: Infinity,
      maxBatchWrites: Infinity,
      maxBatchBytes: Infinity,
      rejectsNestedArrays: false,
      ...limits,
    },

    async loadAll(collection: string): Promise<StoredDoc[]> {
      return Array.from(data.get(collection)?.values() || []).map(d => structuredClone(d));
    },

    async commit(writes: StorageWrite[]): Promise<void> {
      // Validate first so the batch is all-or-nothing.
      for (const w of writes) {
        if (w.op === 'set' && (!w.doc || w.doc.id !== w.id)) {
          throw new Error(`invalid write for ${w.collection}/${w.id}`);
        }
      }
      for (const w of writes) {
        if (!data.has(w.collection)) data.set(w.collection, new Map());
        if (w.op === 'delete') data.get(w.collection)!.delete(w.id);
        else data.get(w.collection)!.set(w.id, structuredClone(w.doc!));
      }
    },

    isRejection(err: any): boolean {
      return /invalid write/.test(String(err?.message || ''));
    },
  };
}
