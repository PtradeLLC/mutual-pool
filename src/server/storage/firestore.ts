import type { Firestore } from 'firebase-admin/firestore';
import type { StorageAdapter, StoredDoc, StorageWrite } from './types';

// Firestore Timestamps (e.g. legacy serverTimestamp() values) become ISO strings
// so in-memory state only ever holds JSON-serialisable values.
function normalizeFromFirestore(value: any): any {
  if (Array.isArray(value)) return value.map(normalizeFromFirestore);
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try { return value.toDate().toISOString(); } catch { return null; }
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeFromFirestore(v);
    return out;
  }
  return value;
}

export function createFirestoreAdapter(db: Firestore): StorageAdapter {
  return {
    name: 'firestore',
    // Firestore limits: 1 MiB per document, 500 writes and 10 MiB per commit.
    // Stay well under each.
    limits: {
      maxDocBytes: 900 * 1024,
      maxBatchWrites: 400,
      maxBatchBytes: 8 * 1024 * 1024,
      rejectsNestedArrays: true,
    },

    async loadAll(collection: string): Promise<StoredDoc[]> {
      const snap = await db.collection(collection).get();
      return snap.docs.map(d => ({ ...normalizeFromFirestore(d.data()), id: d.id }));
    },

    async commit(writes: StorageWrite[]): Promise<void> {
      const batch = db.batch();
      for (const w of writes) {
        const ref = db.collection(w.collection).doc(w.id);
        if (w.op === 'delete') batch.delete(ref);
        else batch.set(ref, w.doc!);
      }
      await batch.commit();
    },

    isRejection(err: any): boolean {
      // gRPC INVALID_ARGUMENT (3): Firestore refused the content itself.
      return err?.code === 3 || /INVALID_ARGUMENT/i.test(String(err?.message || ''));
    },
  };
}
