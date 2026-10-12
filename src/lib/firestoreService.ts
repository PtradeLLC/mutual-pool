import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';
import { User, Pod, Perk, AuditLogEntry, Redemption, isDemoPod, calculateAccountAgeDays } from '../types';

// The server is the only writer of application data (see firestore.rules).
// The browser may read its own user document directly from Firestore for live
// updates; pods, perks and audit logs come from the authenticated /api
// endpoints. The save*/add* helpers below are kept as no-ops so existing call
// sites keep working: changes must go through the corresponding API route.

function wrapError(operation: string, err: unknown): Error {
  const code = err instanceof FirebaseError ? err.code : 'unknown';
  console.error(`[firestoreService] ${operation} failed (${code}):`, err);
  return new Error(`${operation} failed: ${code}`);
}

const POLL_INTERVAL_MS = 15_000;

// Poll an API endpoint and hand each successful result to the callback.
function pollApi<T>(url: string, parse: (data: any) => T, callback: (value: T) => void, onError?: (err: Error) => void) {
  let stopped = false;
  const tick = async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      const data = await res.json();
      if (!stopped) callback(parse(data));
    } catch (err) {
      if (!stopped) onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };
  void tick();
  const timer = setInterval(tick, POLL_INTERVAL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

// --- SEED DATA ---
// Seeding is a development concern handled by the server; the client never seeds.
export async function seedInitialFirestoreData(): Promise<void> {}

// --- USERS ---
export async function getUserFromFirestore(userId: string): Promise<User | null> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) return null;
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;
    const userData = userDoc.data() as User;
    if (userData) {
      userData.accountAgeDays = calculateAccountAgeDays(userData.createdAt, userData.accountAgeDays);
    }
    return userData;
  } catch (err) {
    if ((err as any)?.code === 'permission-denied') return null;
    throw wrapError(`getUserFromFirestore(${userId})`, err);
  }
}

// No-op: profile changes are saved through POST /api/users/sync.
export async function saveUserToFirestore(_user: User): Promise<void> {}

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
    (docSnap) => {
      if (!docSnap.exists()) {
        callback(null);
        return;
      }
      const u = docSnap.data() as User;
      if (u) {
        u.accountAgeDays = calculateAccountAgeDays(u.createdAt, u.accountAgeDays);
      }
      callback(u);
    },
    (err) => onError?.(wrapError(`subscribeToUser(${userId})`, err))
  );
}

// --- PODS ---
function parsePods(data: any): Pod[] {
  return (Array.isArray(data) ? data : []).filter((p: Pod) => p && p.id && !isDemoPod(p));
}

export async function getPodsFromFirestore(): Promise<Pod[]> {
  try {
    const res = await fetch('/api/pods');
    if (!res.ok) return [];
    return parsePods(await res.json());
  } catch (err) {
    console.warn('[firestoreService] getPodsFromFirestore error:', err);
    return [];
  }
}

export function subscribeToPods(
  callback: (pods: Pod[]) => void,
  onError?: (err: Error) => void
) {
  return pollApi('/api/pods', parsePods, callback, onError);
}

// No-op: pods are changed through the /api/pods routes.
export async function savePodToFirestore(_podDataInput: any): Promise<void> {}

// --- PERKS ---
export function subscribeToPerks(
  callback: (perks: Perk[]) => void,
  onError?: (err: Error) => void
) {
  return pollApi('/api/perks', (data) => (Array.isArray(data) ? data as Perk[] : []), callback, onError);
}

// No-op: perks are submitted/managed through /api/perks/* and /api/admin/perks/*.
export async function savePerkToFirestore(_perk: Perk): Promise<void> {}
export async function deletePerkFromFirestore(_perkId: string): Promise<void> {}

// --- AUDIT LOGS ---
export function subscribeToAuditLogs(
  callback: (logs: AuditLogEntry[]) => void,
  onError?: (err: Error) => void,
  podId?: string
) {
  const url = podId ? `/api/audit-logs?podId=${encodeURIComponent(podId)}` : '/api/audit-logs';
  return pollApi(url, (data) => (Array.isArray(data) ? (data as AuditLogEntry[]).slice(0, 100) : []), callback, onError);
}

// No-op: the server writes audit logs.
export async function addAuditLogToFirestore(
  _log: Omit<AuditLogEntry, 'createdAt'> & { createdAt?: unknown }
): Promise<void> {}

// --- REDEMPTIONS ---
// No-op: redemptions are recorded by POST /api/perks/redeem.
export async function addRedemptionToFirestore(_redemption: Redemption): Promise<void> {}
