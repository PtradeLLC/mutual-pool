import { User, Pod, Perk, AuditLogEntry, Redemption, isDemoPod, calculateAccountAgeDays } from '../types';

// Client data access. Despite the file name (kept so existing imports work),
// nothing here talks to Firestore any more: the server is the only writer and
// stores everything in Postgres; the browser reads through the authenticated
// /api endpoints and polls for live updates. The save*/add* helpers are no-ops
// kept for existing call sites: changes must go through the API routes.

const POLL_INTERVAL_MS = 15_000;

// Poll an API endpoint and hand each successful result to the callback.
function pollApi<T>(url: string, parse: (data: any) => T, callback: (value: T) => void, onError?: (err: Error) => void, intervalMs = POLL_INTERVAL_MS) {
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
  const timer = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

// --- SEED DATA ---
// Seeding is a development concern handled by the server; the client never seeds.
export async function seedInitialFirestoreData(): Promise<void> {}

// --- USERS ---
function parseUser(data: any): User | null {
  const u = data && data.id ? (data as User) : null;
  if (u) u.accountAgeDays = calculateAccountAgeDays(u.createdAt, u.accountAgeDays);
  return u;
}

// The signed-in member's own record (the server derives identity from the
// Firebase token; `userId` is only used to refuse obviously bad calls).
export async function getUserFromFirestore(userId: string): Promise<User | null> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) return null;
  try {
    const res = await fetch('/api/users/current');
    if (!res.ok) return null;
    return parseUser(await res.json());
  } catch (err) {
    console.warn('[dataService] getUser error:', err);
    return null;
  }
}

// No-op: profile changes are saved through POST /api/users/sync.
export async function saveUserToFirestore(_user: User): Promise<void> {}

// Live balance/profile updates for the signed-in member, by polling.
export function subscribeToUser(
  userId: string,
  callback: (user: User | null) => void,
  onError?: (err: Error) => void
) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    callback(null);
    return () => {};
  }
  return pollApi('/api/users/current', parseUser, callback, onError, 10_000);
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
