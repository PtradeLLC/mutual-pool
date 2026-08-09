import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';
import { User, Pod, Perk, AuditLogEntry, Redemption } from '../types';
import { INITIAL_USERS, INITIAL_PODS, INITIAL_PERKS, INITIAL_AUDIT_LOGS } from '../data/initialData';

// Helper to strip undefined fields so Firestore setDoc never throws on undefined values
function sanitizeForFirestore<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  const clean: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        clean[key] = sanitizeForFirestore(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean as T;
}

// --- SHARED ERROR HELPER ---
// Wraps a Firestore error with the operation name so callers know
// exactly what failed. Using `FirebaseError` from 'firebase/app' ensures
// `instanceof` works at runtime to extract error codes like 'permission-denied'.
function wrapError(operation: string, err: unknown): Error {
  const code = err instanceof FirebaseError ? err.code : 'unknown';
  console.error(`[firestoreService] ${operation} failed (${code}):`, err);
  return new Error(`${operation} failed: ${code}`);
}

// --- SEED INITIAL DATA IF EMPTY ---
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    const perksSnap = await getDocs(collection(db, 'perks'));
    if (perksSnap.empty && INITIAL_PERKS.length > 0) {
      console.log('Seeding initial perks into Firestore...');
      const batch = writeBatch(db);
      for (const perk of INITIAL_PERKS) {
        batch.set(doc(db, 'perks', perk.id), sanitizeForFirestore(perk));
      }
      await batch.commit();
    }

    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty && INITIAL_USERS.length > 0) {
      console.log('Seeding initial users into Firestore...');
      const batch = writeBatch(db);
      for (const user of INITIAL_USERS) {
        batch.set(doc(db, 'users', user.id), sanitizeForFirestore(user));
      }
      await batch.commit();
    }

    const podsSnap = await getDocs(collection(db, 'pods'));
    if (podsSnap.empty && INITIAL_PODS.length > 0) {
      console.log('Seeding initial pods into Firestore...');
      const batch = writeBatch(db);
      for (const pod of INITIAL_PODS) {
        batch.set(doc(db, 'pods', pod.id), sanitizeForFirestore(pod));
      }
      await batch.commit();
    }

    const logsSnap = await getDocs(collection(db, 'auditLogs'));
    if (logsSnap.empty && INITIAL_AUDIT_LOGS.length > 0) {
      console.log('Seeding initial audit logs into Firestore...');
      const batch = writeBatch(db);
      for (const log of INITIAL_AUDIT_LOGS) {
        batch.set(doc(db, 'auditLogs', log.id), sanitizeForFirestore(log));
      }
      await batch.commit();
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
      console.debug('Firestore seeding skipped (rules require auth or permission denied)');
    } else {
      console.warn('Seed error:', err);
    }
  }
}

// --- USERS ---
export async function getUserFromFirestore(userId: string): Promise<User | null> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) return null;
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    return userDoc.exists() ? (userDoc.data() as User) : null;
  } catch (err) {
    if ((err as any)?.code === 'permission-denied') return null;
    throw wrapError(`getUserFromFirestore(${userId})`, err);
  }
}

export async function saveUserToFirestore(user: User): Promise<void> {
  if (!user || !user.id || typeof user.id !== 'string' || !user.id.trim()) return;
  try {
    await setDoc(doc(db, 'users', user.id), sanitizeForFirestore(user), { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
      console.debug(`saveUserToFirestore(${user.id}) skipped (permission required)`);
    } else {
      throw wrapError(`saveUserToFirestore(${user.id})`, err);
    }
  }
}

export function subscribeToUser(
  userId: string,
  callback: (user: User | null) => void,
  onError?: (err: Error) => void
) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    callback(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'users', userId),
    (docSnap) => callback(docSnap.exists() ? (docSnap.data() as User) : null),
    (err) => onError?.(wrapError(`subscribeToUser(${userId})`, err))
  );
}

// --- PODS ---
export async function getPodsFromFirestore(): Promise<Pod[]> {
  try {
    const snap = await getDocs(collection(db, 'pods'));
    console.log('[Firestore Service] getPodsFromFirestore raw docs count:', snap.docs.length, snap.docs.map(d => ({ id: d.id, data: d.data() })));
    const podsList: Pod[] = [];
    for (const d of snap.docs) {
      const raw: any = d.data();
      if (!raw) continue;
      const actualPod: Pod = (raw.pod && typeof raw.pod === 'object' && (raw.pod.id || raw.pod.name))
        ? raw.pod
        : (raw as Pod);
      if (actualPod) {
        if (!actualPod.id) actualPod.id = d.id;
        if (!actualPod.status) actualPod.status = 'FORMING';
        podsList.push(actualPod);
      }
    }
    console.log('[Firestore Service] getPodsFromFirestore parsed podsList:', podsList.length, podsList);
    return podsList;
  } catch (err) {
    console.warn('[Firestore Service] getPodsFromFirestore error:', err);
    return [];
  }
}

export function subscribeToPods(
  callback: (pods: Pod[]) => void,
  onError?: (err: Error) => void
) {
  return onSnapshot(
    collection(db, 'pods'),
    (snapshot) => {
      console.log('[Firestore Service] subscribeToPods snapshot docs count:', snapshot.docs.length, snapshot.docs.map(d => ({ id: d.id, data: d.data() })));
      const podsList: Pod[] = [];
      for (const d of snapshot.docs) {
        const raw: any = d.data();
        if (!raw) continue;
        const actualPod: Pod = (raw.pod && typeof raw.pod === 'object' && (raw.pod.id || raw.pod.name))
          ? raw.pod
          : (raw as Pod);
        if (actualPod) {
          if (!actualPod.id) actualPod.id = d.id;
          if (!actualPod.status) actualPod.status = 'FORMING';
          podsList.push(actualPod);
        }
      }
      console.log('[Firestore Service] subscribeToPods parsed podsList:', podsList.length, podsList);
      callback(podsList);
    },
    (err) => onError?.(wrapError('subscribeToPods', err))
  );
}

export async function savePodToFirestore(podDataInput: any): Promise<void> {
  if (!podDataInput) return;
  const pod: Pod = (podDataInput.pod && typeof podDataInput.pod === 'object' && podDataInput.pod.id)
    ? podDataInput.pod
    : podDataInput;
  if (!pod || !pod.id || typeof pod.id !== 'string' || !pod.id.trim()) return;
  if (!pod.memberCount || pod.memberCount < (pod.members?.length || 0)) {
    pod.memberCount = Math.max(1, pod.memberCount || 0, pod.members ? pod.members.length : 0);
  }
  try {
    await setDoc(doc(db, 'pods', pod.id), sanitizeForFirestore(pod), { merge: true });
    console.log('[firestoreService] Pod saved to Firestore:', pod.id, pod.name);
  } catch (err) {
    throw wrapError(`savePodToFirestore(${pod.id})`, err);
  }
}

// --- PERKS ---
export function subscribeToPerks(
  callback: (perks: Perk[]) => void,
  onError?: (err: Error) => void
) {
  return onSnapshot(
    collection(db, 'perks'),
    (snapshot) => callback(snapshot.docs.map((d) => d.data() as Perk)),
    (err) => onError?.(wrapError('subscribeToPerks', err))
  );
}

export async function savePerkToFirestore(perk: Perk): Promise<void> {
  if (!perk || !perk.id || typeof perk.id !== 'string' || !perk.id.trim()) return;
  try {
    const clean = sanitizeForFirestore(perk);
    await setDoc(doc(db, 'perks', clean.id), clean, { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
      console.debug(`savePerkToFirestore(${perk.id}) skipped (permission required)`);
    } else {
      throw wrapError(`savePerkToFirestore(${perk.id})`, err);
    }
  }
}

export async function deletePerkFromFirestore(perkId: string): Promise<void> {
  if (!perkId || typeof perkId !== 'string' || !perkId.trim()) return;
  try {
    await deleteDoc(doc(db, 'perks', perkId));
  } catch (err) {
    throw wrapError(`deletePerkFromFirestore(${perkId})`, err);
  }
}

// --- AUDIT LOGS ---
export function subscribeToAuditLogs(
  callback: (logs: AuditLogEntry[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => d.data() as AuditLogEntry)),
    (err) => onError?.(wrapError('subscribeToAuditLogs', err))
  );
}

export async function addAuditLogToFirestore(
  log: Omit<AuditLogEntry, 'createdAt'> & { createdAt?: unknown }
): Promise<void> {
  try {
    const clean = sanitizeForFirestore(log);
    await setDoc(doc(db, 'auditLogs', clean.id), {
      ...clean,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    throw wrapError(`addAuditLogToFirestore(${log.id})`, err);
  }
}

// --- REDEMPTIONS ---
export async function addRedemptionToFirestore(redemption: Redemption): Promise<void> {
  try {
    const clean = sanitizeForFirestore(redemption);
    await setDoc(doc(db, 'redemptions', clean.id), clean);
  } catch (err) {
    throw wrapError(`addRedemptionToFirestore(${redemption.id})`, err);
  }
}
