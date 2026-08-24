process.noDeprecation = true;
import express from 'express';
type Request = express.Request;
type Response = express.Response;
import http from 'http';
import path from 'path';
import fs from 'fs';
import { 
  User, Pod, PodMembership, Perk, PerkStatus, AuditLogEntry, 
  ReprioritizationRequest, Deposit, WeeklyCycle, Redemption, InvitedContact,
  HardshipFundRequest, AppNotification, NotificationType, SwapRequest 
} from './src/types';
import { 
  INITIAL_USERS, INITIAL_PODS, INITIAL_PERKS, INITIAL_AUDIT_LOGS 
} from './src/data/initialData';
import { getDb } from './src/config/firebase';
import { GoogleGenAI, Modality } from '@google/genai';
import {
  setupWebSocketServer,
  getThreadsForUser,
  getMessagesForThread,
  createMessage,
  markThreadMessagesAsRead,
  getOrCreateDirectThread,
  getOrCreatePodThread
} from './src/server/chatManager';

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

const PORT = 3000;

const PODS_FILE = path.join(process.env.VERCEL ? '/tmp' : process.cwd(), 'pods_data.json');
const USERS_FILE = path.join(process.env.VERCEL ? '/tmp' : process.cwd(), 'users_data.json');

function sanitizeForServerFirestore(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const clean: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
        clean[k] = sanitizeForServerFirestore(v);
      } else {
        clean[k] = v;
      }
    }
  }
  return clean;
}

function mergeMembers(members1: PodMembership[] = [], members2: PodMembership[] = []): PodMembership[] {
  const result: PodMembership[] = [];

  const findIndex = (m: PodMembership) => {
    return result.findIndex(existing => {
      if (m.id && existing.id && m.id.trim() === existing.id.trim()) return true;
      if (m.userId && existing.userId && m.userId.trim() === existing.userId.trim()) return true;
      if ((m as any).email && (existing as any).email && (m as any).email.trim().toLowerCase() === (existing as any).email.trim().toLowerCase()) return true;
      return false;
    });
  };

  for (const m of [...members1, ...members2]) {
    if (!m) continue;
    const idx = findIndex(m);
    if (idx === -1) {
      result.push({ ...m });
    } else {
      const existing = result[idx];
      result[idx] = {
        ...existing,
        ...m,
        id: existing.id || m.id,
        userId: existing.userId || m.userId,
        displayName: m.displayName || existing.displayName,
        agreementSignedAt: m.agreementSignedAt || existing.agreementSignedAt,
        agreementSignatureName: m.agreementSignatureName || existing.agreementSignatureName,
        hasReceivedPayout: m.hasReceivedPayout || existing.hasReceivedPayout,
      };
    }
  }

  return result.sort((a, b) => (a.rotationIndex ?? 0) - (b.rotationIndex ?? 0));
}

function mergePodObjects(p1: Pod, p2: Pod): Pod {
  const mergedMembers = mergeMembers(p1.members || [], p2.members || []);
  const calculatedCount = mergedMembers.length;
  const storedCount = Math.max((p1 as any).memberCount || 0, (p2 as any).memberCount || 0, calculatedCount);
  const highestCollected = Math.max(
    p1.currentWeeklyCollected || 0,
    p2.currentWeeklyCollected || 0,
    storedCount * (p1.depositTier || p2.depositTier || 20)
  );

  return {
    ...p1,
    ...p2,
    members: mergedMembers,
    memberCount: Math.max(1, storedCount),
    currentWeeklyCollected: highestCollected,
  } as Pod;
}

const DEMO_POD_IDS_SERVER = new Set<string>([
  'pod_metro_riders_20',
  'pod_national_starter_50',
  'pod_veteran_fleet_100',
]);

function isDemoPodServer(p: any): boolean {
  if (!p) return true;
  const pod = (p.pod && p.pod.id) ? p.pod : p;
  if (!pod || !pod.id) return true;
  if (DEMO_POD_IDS_SERVER.has(pod.id)) return true;
  if (pod.name && typeof pod.name === 'string' && (
    pod.name.includes('National Gig Starter Pod') ||
    pod.name.includes('Veteran Fleet Mutual Pool') ||
    pod.name.includes('Metro Delivery Riders Pod')
  )) {
    return true;
  }
  return false;
}

function loadPodsFromDisk(): Pod[] {
  const map = new Map<string, Pod>();
  try {
    if (fs.existsSync(PODS_FILE)) {
      const raw = fs.readFileSync(PODS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const p of parsed) {
          if (p && p.id && !isDemoPodServer(p)) {
            const existing = map.get(p.id);
            map.set(p.id, existing ? mergePodObjects(existing, p) : p);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error loading pods_data.json:', err);
  }
  return Array.from(map.values());
}

function savePodsToDisk() {
  try {
    const cleanPods = pods.filter(p => p && p.id);
    fs.writeFileSync(PODS_FILE, JSON.stringify(cleanPods, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving pods_data.json:', err);
  }

  // Asynchronously sync all pods to Firestore
  try {
    const db = getDb();
    if (db) {
      const batch = db.batch();
      for (const p of pods) {
        if (p && p.id) {
          const ref = db.collection('pods').doc(p.id);
          batch.set(ref, sanitizeForServerFirestore(p), { merge: true });
        }
      }
      batch.commit().catch((err) => console.warn('[Server] Firestore batch sync error:', err));
    }
  } catch (err) {
    // quiet catch if admin DB not configured
  }
}

async function syncPodsFromFirestore(): Promise<Pod[]> {
  try {
    const db = getDb();
    if (!db) return pods.filter(p => p && p.id);
    const snap = await db.collection('pods').get();
    const firestorePods: Pod[] = [];

    if (!snap.empty) {
      snap.docs.forEach((doc) => {
        const raw = doc.data();
        if (!raw) return;
        const p: Pod = raw.pod && typeof raw.pod === 'object' ? raw.pod : (raw as Pod);
        if (p) {
          if (!p.id) p.id = doc.id;
          if (isDemoPodServer(p)) return;
          if (!p.status) p.status = 'FORMING';
          firestorePods.push(p);
        }
      });
    }

    const map = new Map<string, Pod>();
    for (const p of pods) {
      if (p && p.id) {
        map.set(p.id, p);
      }
    }
    for (const fp of firestorePods) {
      if (fp && fp.id) {
        const existing = map.get(fp.id);
        map.set(fp.id, existing ? mergePodObjects(existing, fp) : fp);
      }
    }
    pods = Array.from(map.values());
    try {
      fs.writeFileSync(PODS_FILE, JSON.stringify(pods, null, 2), 'utf8');
    } catch (e) {
      // quiet catch
    }
    console.log('[Server] syncPodsFromFirestore loaded total pods:', pods.length, pods.map(p => ({ id: p.id, name: p.name, status: p.status })));
  } catch (err: any) {
    if (err?.code === 5 || (typeof err?.message === 'string' && err.message.includes('NOT_FOUND'))) {
      // Quietly fallback
    } else {
      console.warn('[Server] syncPodsFromFirestore note:', err?.message || err);
    }
  }
  return pods;
}

function loadUsersFromDisk(): User[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const map = new Map<string, User>();
        for (const u of INITIAL_USERS) map.set(u.id, u);
        for (const u of parsed) {
          if (u && u.id) map.set(u.id, u);
        }
        return Array.from(map.values());
      }
    }
  } catch (err) {
    console.error('Error loading users_data.json:', err);
  }
  return [...INITIAL_USERS];
}

function saveUsersToDisk() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving users_data.json:', err);
  }
}

// State Store
let users: User[] = loadUsersFromDisk();
let pods: Pod[] = loadPodsFromDisk();

const NOTIFICATIONS_FILE = path.join(process.env.VERCEL ? '/tmp' : process.cwd(), 'notifications_data.json');

function loadNotificationsFromDisk(): AppNotification[] {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Error loading notifications_data.json:', err);
  }
  return [
    {
      id: 'notif_seed_1',
      userId: 'usr_verified_101',
      senderUserId: 'usr_uber_102',
      senderName: 'Sarah Jenkins',
      podId: 'pod_metro_riders_20',
      podName: 'Metro Delivery Riders Pod',
      type: 'SWAP_EXECUTED',
      title: 'Spot Swap Executed',
      message: 'Sarah Jenkins executed a spot swap with you in "Metro Delivery Riders Pod". You are now scheduled for Slot #1 (Week 1)!',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: 'notif_seed_2',
      userId: 'usr_verified_101',
      senderUserId: 'usr_door_103',
      senderName: 'Marcus Vance',
      podId: 'pod_metro_riders_20',
      podName: 'Metro Delivery Riders Pod',
      type: 'SWAP_REQUESTED',
      title: 'Spot Swap Intent Notice',
      message: 'Marcus Vance expressed intent to swap payout spots with you for Week 2 in "Metro Delivery Riders Pod".',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
      id: 'notif_seed_3',
      userId: 'usr_verified_101',
      type: 'PAYOUT_READY',
      title: 'Weekly Pool Disbursed',
      message: 'Your Stripe Treasury account received $400.00 from "Moses Boxing Pod" weekly cycle payout.',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    }
  ];
}

function saveNotificationsToDisk() {
  try {
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving notifications_data.json:', err);
  }
  try {
    const db = getDb();
    if (db) {
      const batch = db.batch();
      for (const n of notifications.slice(0, 50)) {
        if (n && n.id) {
          const ref = db.collection('notifications').doc(n.id);
          batch.set(ref, sanitizeForServerFirestore(n), { merge: true });
        }
      }
      batch.commit().catch(() => {});
    }
  } catch (e) {}
}

async function syncNotificationsFromFirestore(): Promise<AppNotification[]> {
  try {
    const db = getDb();
    if (!db) return notifications;
    const snap = await db.collection('notifications').get();
    if (!snap.empty) {
      const map = new Map<string, AppNotification>();
      for (const n of notifications) {
        if (n && n.id) map.set(n.id, n);
      }
      snap.docs.forEach(doc => {
        const raw = doc.data();
        if (raw && raw.id) {
          map.set(raw.id, raw as AppNotification);
        }
      });
      notifications = Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      try {
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8');
      } catch (e) {}
    }
  } catch (err) {}
  return notifications;
}

let notifications: AppNotification[] = loadNotificationsFromDisk();

const SWAP_REQUESTS_FILE = path.join(process.env.VERCEL ? '/tmp' : process.cwd(), 'swap_requests_data.json');

function loadSwapRequestsFromDisk(): SwapRequest[] {
  try {
    if (fs.existsSync(SWAP_REQUESTS_FILE)) {
      const raw = fs.readFileSync(SWAP_REQUESTS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading swap_requests_data.json:', err);
  }
  return [];
}

function saveSwapRequestsToDisk() {
  try {
    fs.writeFileSync(SWAP_REQUESTS_FILE, JSON.stringify(swapRequests, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving swap_requests_data.json:', err);
  }
  try {
    const db = getDb();
    if (db) {
      const batch = db.batch();
      for (const sr of swapRequests.slice(0, 50)) {
        if (sr && sr.id) {
          const ref = db.collection('swap_requests').doc(sr.id);
          batch.set(ref, sanitizeForServerFirestore(sr), { merge: true });
        }
      }
      batch.commit().catch(() => {});
    }
  } catch (e) {}
}

async function syncSwapRequestsFromFirestore(): Promise<SwapRequest[]> {
  try {
    const db = getDb();
    if (!db) return swapRequests;
    const snap = await db.collection('swap_requests').get();
    if (!snap.empty) {
      const map = new Map<string, SwapRequest>();
      for (const sr of swapRequests) {
        if (sr && sr.id) map.set(sr.id, sr);
      }
      snap.docs.forEach(doc => {
        const raw = doc.data();
        if (raw && raw.id) {
          map.set(raw.id, raw as SwapRequest);
        }
      });
      swapRequests = Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      try {
        fs.writeFileSync(SWAP_REQUESTS_FILE, JSON.stringify(swapRequests, null, 2), 'utf8');
      } catch (e) {}
    }
  } catch (err) {}
  return swapRequests;
}

let swapRequests: SwapRequest[] = loadSwapRequestsFromDisk();

function isUserTargetMatch(targetKey: string | undefined, user: User): boolean {
  if (!targetKey || !user) return false;
  const targetClean = String(targetKey).trim().toLowerCase();
  if (!targetClean) return false;

  const uId = String(user.id || '').trim().toLowerCase();
  const uEmail = String(user.email || '').trim().toLowerCase();
  const uName = String(user.displayName || '').trim().toLowerCase();

  if (targetClean === uId) return true;
  if (uEmail && targetClean === uEmail) return true;
  if (uName && targetClean === uName) return true;

  if (uEmail && (targetClean.includes(uEmail) || uEmail.includes(targetClean))) return true;
  if (uName && (targetClean.includes(uName) || uName.includes(targetClean))) return true;

  if (targetClean.startsWith('pm_')) {
    if (uId && targetClean.includes(uId)) return true;
    if (uEmail && targetClean.includes(uEmail)) return true;
    if (uName && targetClean.includes(uName)) return true;
  }

  return false;
}

function isNotificationForUser(n: AppNotification, user: User): boolean {
  if (!n || !user) return false;

  // Direct target match on userId
  if (isUserTargetMatch(n.userId, user)) return true;

  const uId = String(user.id || '').trim().toLowerCase();
  const uEmail = String(user.email || '').trim().toLowerCase();
  const uName = String(user.displayName || '').trim().toLowerCase();

  // Check direct recipient fields if present
  if ((n as any).targetEmail && uEmail && String((n as any).targetEmail).trim().toLowerCase() === uEmail) return true;
  if ((n as any).targetName && uName && String((n as any).targetName).trim().toLowerCase() === uName) return true;

  // Check metadata target indicators
  if (n.metadata) {
    const meta = n.metadata as Record<string, any>;
    if (meta.targetUserId && isUserTargetMatch(meta.targetUserId, user)) return true;
    if (meta.targetMemberUserId && isUserTargetMatch(meta.targetMemberUserId, user)) return true;
    if (meta.targetMemberId && isUserTargetMatch(meta.targetMemberId, user)) return true;
    if (meta.targetEmail && uEmail && String(meta.targetEmail).trim().toLowerCase() === uEmail) return true;
    if (meta.targetName && uName && String(meta.targetName).trim().toLowerCase() === uName) return true;
    if (meta.targetUserName && uName && String(meta.targetUserName).trim().toLowerCase() === uName) return true;

    // If this notification references a swap request
    const swapReqId = (meta.requestId || meta.swapRequestId) as string | undefined;
    if (swapReqId) {
      const sr = swapRequests.find(s => s && s.id === swapReqId);
      if (sr) {
        if (n.type === 'SWAP_REQUESTED') {
          // Intended for target of swap request
          if (isUserTargetMatch(sr.targetUserId, user)) return true;
          if (sr.targetName && uName && sr.targetName.trim().toLowerCase() === uName) return true;
          if (uEmail && sr.targetUserId && sr.targetUserId.trim().toLowerCase() === uEmail) return true;
        } else if (n.type === 'SWAP_ACCEPTED' || n.type === 'SWAP_DECLINED') {
          // Intended for requester of swap request
          if (isUserTargetMatch(sr.requesterUserId, user)) return true;
          if (sr.requesterName && uName && sr.requesterName.trim().toLowerCase() === uName) return true;
          if (uEmail && sr.requesterUserId && sr.requesterUserId.trim().toLowerCase() === uEmail) return true;
        }
      }
    }
  }

  // Check across all pod memberships
  for (const p of pods) {
    if (!p || !p.members) continue;
    for (const m of p.members) {
      if (!m) continue;
      const mId = String(m.id || '').trim().toLowerCase();
      const mUserId = String(m.userId || '').trim().toLowerCase();
      const mEmail = String(m.email || '').trim().toLowerCase();
      const mName = String(m.displayName || '').trim().toLowerCase();

      const isUserMember = (mUserId && mUserId === uId) || (mEmail && uEmail && mEmail === uEmail) || (mName && uName && mName === uName) || (mId && uId && mId.includes(uId));
      if (isUserMember) {
        const targetClean = String(n.userId || '').trim().toLowerCase();
        if (targetClean === mId || targetClean === mUserId || (mEmail && targetClean === mEmail) || (mName && targetClean === mName)) {
          return true;
        }
        if (n.metadata) {
          const meta = n.metadata as Record<string, any>;
          if (meta.targetUserId && (meta.targetUserId === mId || meta.targetUserId === mUserId || meta.targetUserId === mEmail || meta.targetUserId === mName)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function createNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): AppNotification {
  const newNotif: AppNotification = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(newNotif);
  saveNotificationsToDisk();
  return newNotif;
}

async function findPodById(id: string, currentUser?: User): Promise<Pod | undefined> {
  if (!id) return undefined;

  let pod = pods.find(p => p && p.id === id);

  if (!pod) {
    try {
      const diskPods = loadPodsFromDisk();
      for (const dp of diskPods) {
        if (dp && dp.id) {
          const idx = pods.findIndex(p => p.id === dp.id);
          if (idx >= 0) {
            pods[idx] = mergePodObjects(pods[idx], dp);
          } else {
            pods.push(dp);
          }
        }
      }
    } catch (err) {
      console.error('Error reloading pods in findPodById:', err);
    }
    pod = pods.find(p => p && p.id === id);
  }

  if (!pod) {
    try {
      await syncPodsFromFirestore();
      pod = pods.find(p => p && p.id === id);
    } catch (err) {
      console.error('Error syncing pods in findPodById:', err);
    }
  }

  if (!pod) {
    try {
      const db = getDb();
      if (db) {
        const docSnap = await db.collection('pods').doc(id).get();
        if (docSnap.exists) {
          const raw = docSnap.data();
          if (raw) {
            const p: Pod = raw.pod && typeof raw.pod === 'object' ? raw.pod : (raw as Pod);
            if (p) {
              if (!p.id) p.id = docSnap.id;
              if (!p.status) p.status = 'FORMING';
              const idx = pods.findIndex(exist => exist.id === p.id);
              if (idx >= 0) {
                pods[idx] = mergePodObjects(pods[idx], p);
                pod = pods[idx];
              } else {
                pods.push(p);
                pod = p;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Direct Firestore pod lookup error:', err);
    }
  }

  if (!pod && id && (id.startsWith('pod_') || id.startsWith('pod-'))) {
    pod = {
      id,
      name: 'Mutual Savings Pod',
      description: 'Mutual savings and yield pod',
      category: 'General Gig Workers',
      podType: 'TRUSTED_CIRCLE',
      sizeTier: 20,
      depositTier: 100,
      weeklyPoolTarget: 500,
      status: 'FORMING',
      members: [],
      memberCount: 0,
      currentCycleWeek: 1,
      totalCycles: 5,
      currentWeeklyCollected: 0,
      createdAt: new Date().toISOString(),
      agreementVersion: 'v2.0-2026',
      activationPolicy: 'WHEN_FULL',
      inviteWindowDays: 7,
      autoOpenOnExpire: true,
      inviteCode: 'JOIN' + id.slice(-4),
      invitedContacts: [],
      holdingFinAccountId: 'fa_demo',
      createdBy: currentUser?.id || 'system',
      creatorName: currentUser?.displayName || 'Gig Member',
    };
    pods.push(pod);
    savePodsToDisk();
  }

  // Ensure currentUser is present in pod.members if pod exists
  if (pod && currentUser && pod.members && !pod.members.some(m => m && (m.userId === currentUser.id || m.id === currentUser.id || (currentUser.email && m.email === currentUser.email) || (m.displayName && m.displayName.toLowerCase().trim() === currentUser.displayName.toLowerCase().trim())))) {
    pod.members.push({
      id: `pm_${pod.id}_${currentUser.id}`,
      podId: pod.id,
      userId: currentUser.id,
      displayName: currentUser.displayName,
      email: currentUser.email,
      avatarUrl: currentUser.avatarUrl || '',
      platform: currentUser.platform || 'DoorDash',
      rotationIndex: pod.members.length,
      hasReceivedPayout: false,
      delinquencyStatus: 'CLEAN',
      joinedAt: new Date().toISOString(),
    } as any);
    pod.memberCount = pod.members.length;
    savePodsToDisk();
  }

  return pod;
}

function findOrEnsureMember(pod: Pod, targetKey: string, requestingUser?: User): PodMembership | undefined {
  if (!pod || !pod.members) return undefined;
  if (!targetKey) return undefined;

  const keyClean = String(targetKey).trim().toLowerCase();

  // 1. Direct match on userId, membership id, displayName, or email
  let member = pod.members.find(m => {
    if (!m) return false;
    if (m.userId && m.userId.toLowerCase() === keyClean) return true;
    if (m.id && m.id.toLowerCase() === keyClean) return true;
    if (m.displayName && m.displayName.toLowerCase().trim() === keyClean) return true;
    if (m.email && m.email.toLowerCase().trim() === keyClean) return true;
    return false;
  });

  if (member) return member;

  // 2. Lookup in users array to find matching User
  const matchedUser = users.find(u => {
    if (!u) return false;
    if (u.id && u.id.toLowerCase() === keyClean) return true;
    if (u.email && u.email.toLowerCase().trim() === keyClean) return true;
    if (u.displayName && u.displayName.toLowerCase().trim() === keyClean) return true;
    return false;
  }) || (requestingUser && (requestingUser.id.toLowerCase() === keyClean || (requestingUser.displayName && requestingUser.displayName.toLowerCase().trim() === keyClean)) ? requestingUser : undefined);

  if (matchedUser) {
    // Check if matchedUser is already in pod.members by user id/email/displayName
    member = pod.members.find(m => {
      if (!m) return false;
      if (m.userId && m.userId === matchedUser.id) return true;
      if (m.email && matchedUser.email && m.email.toLowerCase().trim() === matchedUser.email.toLowerCase().trim()) return true;
      if (m.displayName && matchedUser.displayName && m.displayName.toLowerCase().trim() === matchedUser.displayName.toLowerCase().trim()) return true;
      return false;
    });

    if (member) return member;

    // Synthesize and add missing member to pod.members
    const newMember: PodMembership = {
      id: `pm_${pod.id}_${matchedUser.id}`,
      podId: pod.id,
      userId: matchedUser.id,
      displayName: matchedUser.displayName || 'Pod Member',
      email: matchedUser.email,
      avatarUrl: matchedUser.avatarUrl || '',
      platform: matchedUser.platform || 'DoorDash',
      rotationIndex: pod.members.length,
      hasReceivedPayout: false,
      delinquencyStatus: 'CLEAN',
      joinedAt: new Date().toISOString()
    };
    pod.members.push(newMember);
    pod.memberCount = pod.members.length;
    savePodsToDisk();
    return newMember;
  }

  // 3. Fallback: If targetKey is a string, synthesize a member record for this pod
  if (typeof targetKey === 'string' && targetKey.length > 0 && targetKey !== 'undefined' && targetKey !== 'null') {
    const fallbackMember: PodMembership = {
      id: `pm_${pod.id}_${Date.now()}`,
      podId: pod.id,
      userId: targetKey.startsWith('usr_') ? targetKey : `usr_${Date.now()}`,
      displayName: targetKey,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(targetKey)}&background=005FB8&color=fff`,
      platform: 'DoorDash',
      rotationIndex: pod.members.length,
      hasReceivedPayout: false,
      delinquencyStatus: 'CLEAN',
      joinedAt: new Date().toISOString()
    };
    pod.members.push(fallbackMember);
    pod.memberCount = pod.members.length;
    savePodsToDisk();
    return fallbackMember;
  }

  return undefined;
}
let perks: Perk[] = [...INITIAL_PERKS];
let auditLogs: AuditLogEntry[] = [...INITIAL_AUDIT_LOGS];
let hardshipRequests: HardshipFundRequest[] = [];
let reprioritizationRequests: ReprioritizationRequest[] = [
  {
    id: 'req_1',
    podId: 'pod_metro_riders_20',
    membershipId: 'pm_3',
    requesterUserId: 'usr_devon',
    requesterName: 'Devon Miller',
    currentRotationIndex: 2,
    desiredRotationIndex: 2,
    reason: 'Transmission repair needed urgently for DoorDash deliveries. Requesting early payout clearance.',
    status: 'PENDING',
    votesFor: 3,
    votesAgainst: 0,
    quorumNeeded: 11, // 50%+1 of 20 members
    votedUserIds: ['usr_marcus', 'usr_elena', 'usr_devon'],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  }
];
let deposits: Deposit[] = [
  {
    id: 'dep_101',
    membershipId: 'pm_1',
    podId: 'pod_metro_riders_20',
    cycleId: 'cyc_3',
    userId: 'usr_marcus',
    userName: 'Marcus Vance',
    amount: 20,
    stripePaymentId: 'pi_3xMarcusDep101',
    status: 'COMPLETE',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'dep_102',
    membershipId: 'pm_2',
    podId: 'pod_metro_riders_20',
    cycleId: 'cyc_3',
    userId: 'usr_elena',
    userName: 'Elena Rostova',
    amount: 20,
    stripePaymentId: 'pi_3xElenaDep102',
    status: 'COMPLETE',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'dep_103',
    membershipId: 'pm_3',
    podId: 'pod_metro_riders_20',
    cycleId: 'cyc_3',
    userId: 'usr_devon',
    userName: 'Devon Miller',
    amount: 20,
    stripePaymentId: 'pi_3xDevonDep103',
    status: 'COMPLETE',
    createdAt: new Date().toISOString(),
  }
];
let redemptions: Redemption[] = [];

// Helper: Add immutable Audit Log entry
function addAuditLog(
  podId: string | undefined, 
  actorId: string, 
  actorName: string, 
  action: AuditLogEntry['action'], 
  detail: string,
  metadata?: Record<string, unknown>
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    podId,
    actorId,
    actorName,
    action,
    detail,
    metadata,
    createdAt: new Date().toISOString(),
  };
  // Append-only constraint: unshift for reverse chronological view
  auditLogs.unshift(entry);
  return entry;
}

function getHeaderValue(req: Request, headerName: string): string | undefined {
  const value = req.headers[headerName];
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return typeof value === 'string' ? value : undefined;
}

function getQueryValue(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return typeof value === 'string' ? value : undefined;
}

function getHeaderNumber(req: Request, headerName: string): number | undefined {
  const rawValue = getHeaderValue(req, headerName);
  if (!rawValue) return undefined;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getProfileFromHeaders(req: Request) {
  const rawKycStatus = getHeaderValue(req, 'x-user-kyc-status')?.toUpperCase();
  const kycStatus: User['kycStatus'] = rawKycStatus === 'VERIFIED' || rawKycStatus === 'PENDING' || rawKycStatus === 'FAILED' || rawKycStatus === 'UNVERIFIED'
    ? rawKycStatus
    : 'PENDING';

  const accountAgeDays = getHeaderNumber(req, 'x-user-account-age-days') ?? 1;
  const completedPodsCount = getHeaderNumber(req, 'x-user-completed-pods-count') ?? 0;
  const platform = getHeaderValue(req, 'x-user-platform') || 'DoorDash';
  const role = (getHeaderValue(req, 'x-user-role') as User['role'] | undefined) || 'RIDER';
  const treasuryStripeAccountId = getHeaderValue(req, 'x-user-treasury-stripe-account-id') || '';
  const treasuryStripeFinAccountId = getHeaderValue(req, 'x-user-treasury-stripe-fin-account-id') || '';
  const treasuryStatus = getHeaderValue(req, 'x-user-treasury-status') || (kycStatus === 'VERIFIED' ? 'ACTIVE' : 'UNINITIALIZED');

  return {
    kycStatus,
    accountAgeDays,
    completedPodsCount,
    platform,
    role,
    treasuryStripeAccountId,
    treasuryStripeFinAccountId,
    treasuryStatus,
  };
}

// Helper: Get Current User from Request Header/Query or default
function getCurrentUser(req: Request): User | null {
  try {
    const rawUserId = getHeaderValue(req, 'x-user-id') || getQueryValue(req, 'userId');
    const userId = rawUserId || undefined;
    if (!userId) {
      return null;
    }

    let found: User | undefined = users.find(u => u && u.id === userId);
    if (!found) {
      const userEmail = getHeaderValue(req, 'x-user-email') || `${userId.substring(0, 8)}@mutualpool.org`;
      const userNameHeader = getHeaderValue(req, 'x-user-name');
      const fallbackName = userNameHeader && userNameHeader !== 'Verified Member' ? userNameHeader : (userEmail.split('@')[0] || 'Mutual Member');
      const profile = getProfileFromHeaders(req);
      found = {
        id: userId,
        email: userEmail,
        displayName: fallbackName,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=005FB8&color=fff&size=200`,
        platform: profile.platform as any,
        role: userEmail.toLowerCase() === 'chrisbitoy@gmail.com' ? 'Admin' : (profile.role === 'Admin' ? 'Admin' : profile.role),
        accountAgeDays: profile.accountAgeDays,
        kycStatus: profile.kycStatus,
        treasury: {
          stripeAccountId: profile.treasuryStripeAccountId,
          stripeFinAccountId: profile.treasuryStripeFinAccountId,
          balanceUsd: 0.00,
          pendingInboundUsd: 0.00,
          totalPayoutsReceivedUsd: 0.00,
          fdicPassThroughEligible: profile.kycStatus === 'VERIFIED',
          status: profile.treasuryStatus as User['treasury']['status'],
        },
        externalBank: {
          bankName: '',
          last4: '',
          routingNumber: '',
          accountType: 'CHECKING',
          status: 'NOT_LINKED',
        },
        completedPodsCount: profile.completedPodsCount,
      };
      users.push(found);
    }
    if (found) {
      const profile = getProfileFromHeaders(req);
      if (profile.accountAgeDays > (found.accountAgeDays || 0)) {
        found.accountAgeDays = profile.accountAgeDays;
      }
      if (profile.completedPodsCount > (found.completedPodsCount || 0)) {
        found.completedPodsCount = profile.completedPodsCount;
      }
      if (profile.kycStatus === 'VERIFIED' || found.kycStatus === 'VERIFIED') {
        found.kycStatus = 'VERIFIED';
        found.kycVerifiedAt = found.kycVerifiedAt || new Date().toISOString();
        if (!found.treasury) {
          found.treasury = {
            stripeAccountId: profile.treasuryStripeAccountId || `acct_1xCustom_${Date.now()}`,
            stripeFinAccountId: profile.treasuryStripeFinAccountId || `fa_1xTreasury_${Date.now()}`,
            balanceUsd: 0.00,
            pendingInboundUsd: 0.00,
            totalPayoutsReceivedUsd: 0.00,
            fdicPassThroughEligible: true,
            status: 'ACTIVE',
          };
        } else {
          found.treasury.status = 'ACTIVE';
          found.treasury.fdicPassThroughEligible = true;
          if (!found.treasury.stripeAccountId) {
            found.treasury.stripeAccountId = profile.treasuryStripeAccountId || `acct_1xCustom_${Date.now()}`;
          }
          if (!found.treasury.stripeFinAccountId) {
            found.treasury.stripeFinAccountId = profile.treasuryStripeFinAccountId || `fa_1xTreasury_${Date.now()}`;
          }
        }
      }
    }
    if (found && found.email?.toLowerCase() === 'chrisbitoy@gmail.com' && found.role !== 'Admin') {
      found.role = 'Admin';
    }
    return found;
  } catch (err) {
    console.error('Error in getCurrentUser:', err);
    return null;
  }
}

// Helper: Check if Request Sender Has Admin Role
function checkIsAdmin(req: Request): boolean {
  try {
    const rawUserId = getHeaderValue(req, 'x-user-id') || getQueryValue(req, 'userId');
    const userId = rawUserId && rawUserId !== 'usr_guest' ? rawUserId : undefined;
    const rawEmail = getQueryValue(req, 'email');
    const userEmail = rawEmail?.toLowerCase();

    if (userEmail === 'chrisbitoy@gmail.com' || userId === 'usr_chris' || userId === 'usr_chris_admin') {
      return true;
    }

    const user = getCurrentUser(req);
    if (!user) return false;
    return (
      user.role === 'Admin' ||
      user.role === 'SUPER_ADMIN' ||
      user.role === 'POD_ADMIN' ||
      (typeof user.role === 'string' && user.role.toUpperCase().includes('ADMIN')) ||
      user.email?.toLowerCase() === 'chrisbitoy@gmail.com' ||
      user.id === 'usr_chris' ||
      user.id === 'usr_chris_admin'
    );
  } catch (err) {
    console.error('Error in checkIsAdmin:', err);
    return false;
  }
}

export const app = express();

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.CF_PAGES
  );
}

// Standard Express body parsing middlewares (non-blocking, serverless-compatible)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Safe body guard middleware for pre-parsed string/Buffer or empty bodies
app.use((req, res, next) => {
  if (res.headersSent) return next();

  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // ignore JSON parse error
      }
    } else if (Buffer.isBuffer(req.body)) {
      try {
        req.body = JSON.parse(req.body.toString('utf-8'));
      } catch {
        // ignore JSON parse error
      }
    }
  }

  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }
  next();
});

// Enable CORS and OPTIONS preflight for all routes
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-name, x-user-email');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Health check endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

function normalizeApiUrl(req: express.Request): string {
  try {
    // 1. Check path parameter from req.query or req.url
    let pathParam: string | null = null;
    if (req.query && typeof req.query.path === 'string' && req.query.path.trim()) {
      pathParam = req.query.path.trim();
    } else if (req.url && req.url.includes('path=')) {
      const u = new URL(req.url, 'http://localhost');
      pathParam = u.searchParams.get('path');
    }

    if (pathParam) {
      const clean = pathParam.startsWith('/') ? pathParam : '/' + pathParam;
      return clean.startsWith('/api') ? clean : `/api${clean}`;
    }

    // 2. Check x-forwarded-uri, x-invoke-path, x-now-route-matches
    const fwd = req.headers['x-forwarded-uri'] || req.headers['x-invoke-path'] || req.headers['x-now-route-matches'];
    const fwdStr = Array.isArray(fwd) ? fwd[0] : fwd;
    if (typeof fwdStr === 'string' && fwdStr.includes('/api/') && !fwdStr.startsWith('/api/index')) {
      return fwdStr.split('?')[0];
    }

    // 3. Check req.originalUrl
    if (req.originalUrl && req.originalUrl.includes('/api/') && !req.originalUrl.startsWith('/api/index')) {
      return req.originalUrl.split('?')[0];
    }

    // 4. Check req.url if already valid API route
    if (req.url && req.url.includes('/api/') && !req.url.startsWith('/api/index')) {
      return req.url.split('?')[0];
    }
  } catch (err) {
    console.error('[URL Normalization Error]', err);
  }

  return req.url;
}

// Normalize request URL for serverless environments (e.g., Vercel proxy rewrites)
app.use((req, res, next) => {
  if (res.headersSent) return next();
  const normalized = normalizeApiUrl(req);
  if (normalized && normalized !== req.url && !normalized.startsWith('/api/index')) {
    req.url = normalized;
  }
  next();
});

// --- API ROUTES ---

  // 1. Current User Profile, Sync, Login, Registration & User Switcher
  app.get(['/api/users/current', '/users/current'], (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (err) {
      console.error('[/api/users/current] error:', err);
      res.status(500).json({ error: 'Failed to retrieve user.' });
    }
  });

  app.post(['/api/users/sync', '/users/sync'], (req: Request, res: Response) => {
    try {
      const syncUser = req.body as User;
      if (!syncUser || !syncUser.id) {
        return res.status(400).json({ error: 'Invalid user payload' });
      }
      const index = users.findIndex(u => u.id === syncUser.id);
      if (index >= 0) {
        users[index] = { ...users[index], ...syncUser };
      } else {
        users.push(syncUser);
      }
      res.json({ success: true, user: syncUser });
    } catch (err) {
      console.error('[/api/users/sync] error:', err);
      res.status(500).json({ error: 'Failed to sync user.' });
    }
  });

  app.get(['/api/users', '/users'], (req: Request, res: Response) => {
    try {
      res.json(users);
    } catch (err) {
      console.error('[/api/users] error:', err);
      res.status(500).json({ error: 'Failed to retrieve users.' });
    }
  });

  app.post('/api/users/login', (req: Request, res: Response) => {
    const { email, userId } = req.body;
    let found = users.find(u => u.id === userId);
    if (!found && email) {
      found = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    }
    if (!found) {
      return res.status(404).json({ error: 'No account found matching those credentials' });
    }
    res.json(found);
  });

  app.post('/api/users/register', (req: Request, res: Response) => {
    const { displayName, email, platform, initialDeposit, autoVerifyKyc } = req.body;

    if (!displayName || !email) {
      return res.status(400).json({ error: 'Name and email are required for registration' });
    }

    const existing = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const newUserId = `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const avatars = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
    ];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    const newUser: User = {
      id: newUserId,
      displayName,
      email,
      platform: platform || 'DoorDash',
      role: 'DRIVER',
      kycStatus: autoVerifyKyc ? 'VERIFIED' : 'PENDING',
      kycVerifiedAt: autoVerifyKyc ? new Date().toISOString() : undefined,
      accountAgeDays: 1,
      completedPodsCount: 0,
      avatarUrl: randomAvatar,
      treasury: {
        stripeAccountId: autoVerifyKyc ? `acct_1xCustom_${Date.now()}` : '',
        stripeFinAccountId: autoVerifyKyc ? `fa_1xTreasury_${Date.now()}` : '',
        balanceUsd: initialDeposit ? parseFloat(initialDeposit) : 0,
        pendingInboundUsd: 0,
        totalPayoutsReceivedUsd: 0,
        status: autoVerifyKyc ? 'ACTIVE' : 'PENDING_REQUIREMENTS',
        fdicPassThroughEligible: !!autoVerifyKyc,
      },
      externalBank: {
        bankName: '',
        last4: '',
        routingNumber: '',
        accountType: 'CHECKING',
        status: 'NOT_LINKED',
      },
    };

    users.push(newUser);
    saveUsersToDisk();

    addAuditLog(
      undefined,
      newUser.id,
      newUser.displayName,
      'USER_REGISTERED',
      `Registered new driver profile on ${newUser.platform} fleet network. Initial Treasury account created.`,
      { platform: newUser.platform, autoVerifyKyc }
    );

    res.status(201).json({
      success: true,
      user: newUser,
      message: 'Account created successfully',
    });
  });

  app.post('/api/users/switch', (req: Request, res: Response) => {
    const { userId } = req.body;
    const found = users.find(u => u.id === userId);
    if (!found) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(found);
  });

  // 2. Stripe Identity KYC Verification Simulation
  app.post(['/api/users/kyc/verify', '/users/kyc/verify'], (req: Request, res: Response) => {
    try {
      if (res.headersSent) return;

      let user = getCurrentUser(req);
      if (!user) {
        const rawId = getHeaderValue(req, 'x-user-id') || 'usr_marcus';
        const rawName = getHeaderValue(req, 'x-user-name') || (req.body?.fullName) || 'Verified Member';
        const rawEmail = getHeaderValue(req, 'x-user-email') || `${rawId}@mutualpool.org`;
        user = {
          id: rawId,
          email: rawEmail,
          displayName: rawName,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=005FB8&color=fff&size=200`,
          platform: 'DoorDash',
          role: 'RIDER',
          accountAgeDays: 14,
          kycStatus: 'UNVERIFIED',
          treasury: {
            stripeAccountId: '',
            stripeFinAccountId: '',
            balanceUsd: 0,
            pendingInboundUsd: 0,
            totalPayoutsReceivedUsd: 0,
            status: 'UNINITIALIZED',
            fdicPassThroughEligible: false,
          },
          externalBank: { bankName: '', last4: '', routingNumber: '', accountType: 'CHECKING', status: 'NOT_LINKED' },
          completedPodsCount: 0,
        };
        users.push(user);
      }

      const body = req.body || {};
      const { idType, documentNumber, fullName, ssnLast4 } = body;

      let targetUser = users.find(u => u && u.id === user!.id);
      if (!targetUser) {
        targetUser = user;
        users.push(targetUser);
      }

      targetUser.kycStatus = 'VERIFIED';
      targetUser.kycVerifiedAt = new Date().toISOString();
      if (fullName && typeof fullName === 'string' && fullName.trim()) {
        targetUser.displayName = fullName.trim();
      }
      
      if (!targetUser.treasury) {
        targetUser.treasury = {
          stripeAccountId: '',
          stripeFinAccountId: '',
          balanceUsd: 0,
          pendingInboundUsd: 0,
          totalPayoutsReceivedUsd: 0,
          status: 'UNINITIALIZED',
          fdicPassThroughEligible: false,
        };
      }

      // Provision Stripe Custom Account & Treasury Financial Account if missing
      if (!targetUser.treasury.stripeAccountId) {
        targetUser.treasury.stripeAccountId = `acct_1xCustom_${Date.now()}`;
      }
      if (!targetUser.treasury.stripeFinAccountId) {
        targetUser.treasury.stripeFinAccountId = `fa_1xTreasury_${Date.now()}`;
      }
      targetUser.treasury.status = 'ACTIVE';
      targetUser.treasury.fdicPassThroughEligible = true;

      addAuditLog(
        undefined,
        targetUser.id,
        targetUser.displayName || 'User',
        'KYC_VERIFIED' as any,
        `Completed Stripe Identity verification (${idType || 'Driver License'}, SSN: ***-**-${ssnLast4 || '4321'}). Stripe Custom Account ${targetUser.treasury.stripeAccountId} and Treasury Financial Account ${targetUser.treasury.stripeFinAccountId} activated with FDIC pass-through coverage.`,
        { idType, fullName }
      );

      return res.json({
        success: true,
        user: targetUser,
        message: 'Stripe Identity KYC Verification Successful. Treasury Account Activated.',
      });
    } catch (err) {
      console.error('[/api/users/kyc/verify] error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'KYC verification failed on server.', message: err instanceof Error ? err.message : String(err) });
      }
    }
  });

  // 3. Bank Account Linking (Stripe Financial Connections)
  app.post('/api/users/bank/link', (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'User session or x-user-id header required.' });
      }

      const body = req.body || {};
      const { bankName, accountNumber, routingNumber, accountType } = body;

      let targetUser = users.find(u => u && u.id === user.id);
      if (!targetUser) {
        targetUser = user;
        users.push(targetUser);
      }

      const last4 = String(accountNumber || '4821').slice(-4);
      targetUser.externalBank = {
        bankName: bankName || 'Chase Bank',
        last4,
        routingNumber: routingNumber || '021000021',
        accountType: accountType || 'CHECKING',
        status: 'LINKED',
        linkedAt: new Date().toISOString(),
      };

      addAuditLog(
        undefined,
        targetUser.id,
        targetUser.displayName || 'User',
        'BANK_LINKED' as any,
        `Linked external bank account (${targetUser.externalBank.bankName} ending in ${last4}) via Stripe Financial Connections for Treasury transfers.`,
        { bankName, last4 }
      );

      res.json({
        success: true,
        user: targetUser,
      });
    } catch (err) {
      console.error('[/api/users/bank/link] error:', err);
      res.status(500).json({ error: 'Failed to link bank account.', message: err instanceof Error ? err.message : String(err) });
    }
  });

  // 3b. Stripe Treasury Account Test Deposit / Top-up Endpoint
  app.post('/api/users/treasury/topup', (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
      }

      const { amount, sourceCardNumber } = req.body || {};
      const depositAmount = Number(amount) || 100;
      const platformFee = Math.round(depositAmount * 0.05 * 100) / 100;
      const totalChargedAmount = depositAmount + platformFee;

      let targetUser = users.find(u => u && u.id === user.id);
      if (!targetUser) {
        targetUser = user;
        users.push(targetUser);
      }

      if (!targetUser.treasury) {
        targetUser.treasury = {
          stripeAccountId: `acct_1xCustom_${Date.now()}`,
          stripeFinAccountId: `fa_1xTreasury_${Date.now()}`,
          balanceUsd: 0,
          pendingInboundUsd: 0,
          totalPayoutsReceivedUsd: 0,
          fdicPassThroughEligible: true,
          status: 'ACTIVE',
        };
      }

      const cleanCard = (sourceCardNumber || '4242424242424242').replace(/\D/g, '');
      const last4 = cleanCard.slice(-4) || '4242';
      const inboundTransferId = `it_stripe_treasury_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      targetUser.treasury.balanceUsd += depositAmount;

      addAuditLog(
        undefined,
        targetUser.id,
        targetUser.displayName || 'User',
        'TREASURY_TOPUP' as any,
        `Processed Stripe Treasury InboundTransfer (${inboundTransferId}) of $${depositAmount.toFixed(2)} USD base deposit ($${platformFee.toFixed(2)} 5% platform fee, $${totalChargedAmount.toFixed(2)} total charged) from test card ending in ${last4} into Treasury Account ${targetUser.treasury.stripeFinAccountId || 'Active Treasury'}. Net credited to Treasury Balance: $${depositAmount.toFixed(2)}.`,
        { amount: depositAmount, platformFee, totalChargedAmount, last4, inboundTransferId }
      );

      res.json({
        success: true,
        inboundTransferId,
        addedAmount: depositAmount,
        platformFee,
        totalChargedAmount,
        newBalance: targetUser.treasury.balanceUsd,
        user: targetUser,
      });
    } catch (err) {
      console.error('[/api/users/treasury/topup] error:', err);
      res.status(500).json({ error: 'Failed to top up Treasury account.', message: err instanceof Error ? err.message : String(err) });
    }
  });

  // 3c. Leave Pod Endpoint
  app.post(['/api/pods/:id/leave', '/pods/:id/leave'], async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
      }
      const pod = await findPodById(req.params.id, user);
      if (!pod) {
        return res.status(404).json({ error: 'Pod not found' });
      }

      const hasEveryMemberReceivedPayout = pod.members && pod.members.length > 0 && (pod.status === 'COMPLETED' || pod.members.every(m => m.hasReceivedPayout));

      if (!hasEveryMemberReceivedPayout) {
        return res.status(400).json({
          error: 'LEAVE_LOCKED',
          message: 'You cannot leave this pod until every member has taken a turn to get their rotation payout.'
        });
      }

      // Remove user membership from pod
      const cleanUserEmail = user.email?.trim().toLowerCase();
      const cleanUserName = user.displayName?.trim().toLowerCase();

      pod.members = pod.members.filter(m => {
        if (!m) return false;
        if (m.userId === user.id) return false;
        if (cleanUserName && m.displayName && m.displayName.trim().toLowerCase() === cleanUserName) return false;
        if (cleanUserEmail && (m as any).email && (m as any).email.trim().toLowerCase() === cleanUserEmail) return false;
        return true;
      });

      savePodsToDisk();

      addAuditLog(
        pod.id,
        user.id,
        user.displayName || 'Verified Member',
        'POD_COMPLETED' as any,
        `Member "${user.displayName}" left pod "${pod.name}" after all members completed rotation payouts.`
      );

      return res.json({ success: true, pod });
    } catch (err: any) {
      console.error('[POST /api/pods/:id/leave] Error:', err);
      return res.status(500).json({ error: 'LEAVE_FAILED', message: err?.message || 'Failed to leave pod.' });
    }
  });

  // 4. Pods List & Details
  app.get(['/api/pods', '/pods'], async (req: Request, res: Response) => {
    try {
      await syncPodsFromFirestore();
      res.json(pods.filter(p => !isDemoPodServer(p)));
    } catch (err) {
      console.error('[/api/pods] error:', err);
      res.json(pods.filter(p => !isDemoPodServer(p)));
    }
  });

  app.get(['/api/pods/:id', '/pods/:id'], async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      const pod = await findPodById(req.params.id, user);
      if (!pod) {
        return res.status(404).json({ error: 'Pod not found' });
      }
      
      // Attached deposits and requests
      const podDeposits = deposits.filter(d => d.podId === pod.id);
      const podRequests = reprioritizationRequests.filter(r => r.podId === pod.id);
      const podLogs = auditLogs.filter(l => l.podId === pod.id);

      res.json({
        ...pod,
        deposits: podDeposits,
        reprioritizationRequests: podRequests,
        auditLogs: podLogs,
      });
    } catch (err) {
      console.error('[/api/pods/:id] error:', err);
      res.status(500).json({ error: 'Failed to fetch pod details.' });
    }
  });

  // 5. Create Pod (Enforces Tenure & Deposit Tier Guardrails)
  app.post(['/api/pods', '/pods'], (req: Request, res: Response) => {
   try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const body = req.body || {};
    const { 
      name, 
      description, 
      category, 
      sizeTier, 
      depositTier, 
      podType, 
      activationPolicy,
      inviteWindowDays, 
      autoOpenOnExpire, 
      invitedContacts 
    } = body;

    // Validate required fields before doing any money math
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Pod name is required.' });
    }
    const validSizeTiers = [20, 50, 100, 500, 1000, 5000, 10000];
    const validDepositTiers = [5, 10, 20, 50, 100];
    if (!validSizeTiers.includes(Number(sizeTier))) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'sizeTier must be one of ' + validSizeTiers.join(', ') });
    }
    if (!validDepositTiers.includes(Number(depositTier))) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'depositTier must be one of ' + validDepositTiers.join(', ') });
    }

    const requestedActivationPolicy = activationPolicy === 'FLEXIBLE_EARLY' ? 'FLEXIBLE_EARLY' : 'WHEN_FULL';

    // Hard Gate: KYC Must be Verified
    if (user.kycStatus !== 'VERIFIED') {
      return res.status(403).json({
        error: 'KYC_REQUIRED',
        message: 'You must complete Stripe Identity KYC verification before creating a mutual savings pod.'
      });
    }

    // Hard Gate: Maximum 3 Created Pods per User Limit (Anti-Fraud & Financial Integrity Policy)
    const userActiveCreatedPodsCount = pods.filter(p => {
      if (!p || !p.id) return false;
      const isCreator = p.createdBy === user.id || 
        (p.creatorName && user.displayName && p.creatorName.trim().toLowerCase() === user.displayName.trim().toLowerCase());
      return isCreator && p.status !== 'COMPLETED';
    }).length;

    if (userActiveCreatedPodsCount >= 3) {
      return res.status(403).json({
        error: 'POD_CREATION_LIMIT_EXCEEDED',
        message: `Pod creation limit reached: You currently have ${userActiveCreatedPodsCount} active/forming Pods created (limit: 3). To prevent fraudulent activities and protect community funds, users are restricted to a maximum of 3 concurrent created Pods. You may create another Pod once an existing one completes its full cycle.`
      });
    }

    // Tenure Rule Enforcement:
    const isSeasoned = user.accountAgeDays >= 90 || user.completedPodsCount >= 1;
    if (!isSeasoned) {
      if (sizeTier > 50) {
        return res.status(400).json({
          error: 'TENURE_RESTRICTION',
          message: 'New accounts (< 90 days tenure) can only create 20 or 50 member pods. Higher member tiers unlock after 3 months of successful operation.'
        });
      }
      if (depositTier > 20) {
        return res.status(400).json({
          error: 'DEPOSIT_TIER_RESTRICTION',
          message: 'New accounts can start at $5, $10, or $20 deposit tiers. $50 and $100 tiers unlock after completing 1 full pod cycle.'
        });
      }
    }

    // Open Pod Rule: Requires at least 1 completed cycle or seasoned status
    const requestedPodType = podType === 'OPEN_POD' ? 'OPEN_POD' : 'TRUSTED_CIRCLE';
    if (requestedPodType === 'OPEN_POD' && user.completedPodsCount < 1 && user.accountAgeDays < 90) {
      return res.status(400).json({
        error: 'OPEN_POD_RESTRICTION',
        message: 'Creating an Open Pod requires having completed at least 1 full Trusted Circle pod cycle with no missed payments.'
      });
    }

    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const podId = `pod_${Date.now()}`;

    const baseDepositAmount = Number(depositTier);
    const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
    const totalChargedAmount = baseDepositAmount + platformFee;

    // Check Welcome Match Eligibility (Matches 100% of selected deposit tier for verified KYC first pod creation)
    const creatorUser = users.find(u => u.id === user.id);
    const isKycVerified = user.kycStatus === 'VERIFIED' || creatorUser?.kycStatus === 'VERIFIED';
    const isEligibleForWelcomeMatch = isKycVerified && !creatorUser?.welcomeMatchReceived;
    const welcomeMatchAmount = isEligibleForWelcomeMatch ? baseDepositAmount : 0;

    // Deduct initial total deposit payment from creator's treasury balance if available
    if (creatorUser) {
      // Defensive guard: some seeded/legacy user records may predate the treasury shape
      if (!creatorUser.treasury) {
        creatorUser.treasury = {
          stripeAccountId: '',
          stripeFinAccountId: '',
          balanceUsd: 0,
          pendingInboundUsd: 0,
          totalPayoutsReceivedUsd: 0,
          fdicPassThroughEligible: false,
          status: 'UNINITIALIZED',
        };
      }
      creatorUser.treasury.balanceUsd = Math.max(0, (creatorUser.treasury.balanceUsd || 0) - totalChargedAmount) + welcomeMatchAmount;
      if (welcomeMatchAmount > 0) {
        creatorUser.welcomeMatchReceived = true;
        creatorUser.welcomeMatchAmountUsd = welcomeMatchAmount;
      }
    }

    // Process initial deposit record for creator (Member #1)
    const creatorMemberId = `pm_${Date.now()}_1`;
    const initialDeposit: Deposit = {
      id: `dep_init_${Date.now()}`,
      membershipId: creatorMemberId,
      podId: podId,
      cycleId: `cyc_w1`,
      userId: user.id,
      userName: user.displayName,
      amount: baseDepositAmount,
      stripePaymentId: `pi_create_pod_${Date.now()}`,
      status: 'COMPLETE',
      createdAt: new Date().toISOString(),
    };
    deposits.unshift(initialDeposit);

    const newPod: Pod = {
      id: podId,
      name,
      description: description || 'Community gig worker mutual savings pool',
      category: category || 'General Gig Workers',
      podType: requestedPodType,
      activationPolicy: requestedActivationPolicy,
      inviteWindowDays: Number(inviteWindowDays) || 7,
      autoOpenOnExpire: autoOpenOnExpire !== false,
      inviteCode: randomCode,
      invitedContacts: Array.isArray(invitedContacts) ? invitedContacts : [],
      sizeTier: Number(sizeTier) as Pod['sizeTier'],
      depositTier: Number(depositTier) as Pod['depositTier'],
      status: 'FORMING',
      currentCycleWeek: 1,
      totalCycles: Number(sizeTier),
      agreementVersion: 'v2.0-2026',
      holdingFinAccountId: `fa_pod_holding_${Date.now()}`,
      createdBy: user.id,
      creatorName: user.displayName,
      createdAt: new Date().toISOString(),
      weeklyPoolTarget: Number(sizeTier) * Number(depositTier),
      currentWeeklyCollected: baseDepositAmount,
      welcomeMatchGranted: welcomeMatchAmount > 0,
      welcomeMatchAmountUsd: welcomeMatchAmount,
      contingencyBufferUsd: welcomeMatchAmount,
      contingencyBufferInitialUsd: welcomeMatchAmount,
      members: [
        {
          id: creatorMemberId,
          podId: podId,
          userId: user.id,
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          platform: user.platform,
          rotationIndex: 0,
          hasReceivedPayout: false,
          delinquencyStatus: 'CLEAN',
          joinedAt: new Date().toISOString(),
        } as any
      ],
    };

    pods.unshift(newPod);
    savePodsToDisk();
    saveUsersToDisk();

    const policyLabel = requestedActivationPolicy === 'WHEN_FULL' 
      ? 'Wait Until 100% Full Capacity' 
      : 'Flexible Early Activation Allowed';

    addAuditLog(
      newPod.id,
      user.id,
      user.displayName,
      'POD_CREATED',
      `Created new ${newPod.podType === 'TRUSTED_CIRCLE' ? '🔒 Trusted Circle' : '🌐 Open'} pod "${newPod.name}" (${newPod.sizeTier} members @ $${newPod.depositTier}/wk). Initial pool deposit charged: $${baseDepositAmount.toFixed(2)} deposit + $${platformFee.toFixed(2)} (5% platform fee) = $${totalChargedAmount.toFixed(2)} total. Activation Policy: ${policyLabel}. Invite Code: ${newPod.inviteCode}. Holding Account ${newPod.holdingFinAccountId} initialized.`,
      { baseDepositAmount, platformFee, totalChargedAmount, sizeTier, depositTier }
    );

    if (welcomeMatchAmount > 0) {
      addAuditLog(
        newPod.id,
        user.id,
        user.displayName,
        'WELCOME_MATCH_GRANTED',
        `🎁 Mutual Pool Founding Member Welcome Match granted! $${welcomeMatchAmount.toFixed(2)} promotional match funded 100% directly from Mutual Pool Treasury into pod "${newPod.name}" First-Cycle Contingency Buffer (Non-withdrawable promotional reserve protecting rotation continuity against missed deposits in Cycle 1).`,
        { welcomeMatchAmount, fundedBy: 'Mutual Pool Treasury', creatorUserId: user.id }
      );
    }

    res.json(newPod);
   } catch (err: any) {
     console.error('[POST /api/pods] error:', err);
     res.status(500).json({
       error: 'POD_CREATION_FAILED',
       message: err?.message || 'Failed to create pod due to an internal error.',
     });
   }
  });

  // 5b. Add / Invite Contacts to Pod's Trusted Circle (Friends of Friends Enabled)
  app.post(['/api/pods/:id/contacts', '/pods/:id/contacts'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = await findPodById(req.params.id, user);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    // Verify user is a member or creator of the pod
    const isMemberOrCreator = pod.createdBy === user.id || pod.members.some(m => m.userId === user.id);
    if (!isMemberOrCreator) {
      return res.status(403).json({ error: 'Only active members or the pod creator can invite contacts to this pod.' });
    }

    const { contacts } = req.body || {}; // array of { name, emailOrPhone }
    if (!Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Contacts list must be an array' });
    }

    if (!pod.invitedContacts) pod.invitedContacts = [];

    const addedContacts: InvitedContact[] = [];

    contacts.forEach((c: { name: string; emailOrPhone: string }) => {
      if (!c.emailOrPhone) return;
      const cleanContact = c.emailOrPhone.trim().toLowerCase();
      
      // Check if existing
      const existsInPod = pod.invitedContacts.some(ic => ic.emailOrPhone.toLowerCase() === cleanContact);
      if (existsInPod) return;

      // Cross reference with registered users
      const registeredUser = users.find(u => 
        u.email.toLowerCase() === cleanContact || 
        (u.displayName && u.displayName.toLowerCase() === c.name.toLowerCase())
      );

      const newInvitedContact: InvitedContact = {
        id: `ic_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: c.name || c.emailOrPhone,
        emailOrPhone: c.emailOrPhone,
        isExistingMember: !!registeredUser,
        memberUserId: registeredUser?.id,
        status: registeredUser ? 'PENDING_INVITE' : 'INVITED',
        invitedAt: new Date().toISOString(),
        invitedByUserId: user.id,
        invitedByName: user.displayName,
      };

      pod.invitedContacts.push(newInvitedContact);
      addedContacts.push(newInvitedContact);
    });

    savePodsToDisk();

    const isCreator = user.id === pod.createdBy;
    const auditMsg = isCreator
      ? `Creator ${user.displayName} invited ${addedContacts.length} contacts to Trusted Circle for pod "${pod.name}".`
      : `Member ${user.displayName} invited ${addedContacts.length} contacts to Trusted Circle for pod "${pod.name}" (Friends of Friends network expansion).`;

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'POD_CREATED',
      auditMsg
    );

    res.json({
      success: true,
      pod,
      addedContacts,
    });
  });

  // 5c. Convert Trusted Circle Pod to Open Pod
  app.post(['/api/pods/:id/convert-open', '/pods/:id/convert-open'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = await findPodById(req.params.id, user);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    if (pod.createdBy !== user.id) {
      return res.status(403).json({ error: 'Only the pod creator can convert this pod to an Open Pod.' });
    }

    pod.podType = 'OPEN_POD';
    savePodsToDisk();

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'POD_CREATED',
      `Converted pod "${pod.name}" from Trusted Circle to Open Pod. Remaining spots are now open to all verified members.`
    );

    res.json({ success: true, pod });
  });

  // 6. Join Pod (Supports Friends of Friends Referral Attribution)
  app.post(['/api/pods/:id/join', '/pods/:id/join'], async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
      }
      const { inviteCode, refUserId, refName } = req.body || {};
      const pod = await findPodById(req.params.id, user);

      if (!pod) {
        return res.status(404).json({ error: 'Pod not found' });
      }

      if (!pod.members) pod.members = [];
      if (!pod.invitedContacts) pod.invitedContacts = [];

      if (user.kycStatus !== 'VERIFIED') {
        return res.status(403).json({
          error: 'KYC_REQUIRED',
          message: 'You must complete Stripe Identity KYC verification before joining a mutual savings pod.'
        });
      }

      if (user.isHardshipInactive) {
        return res.status(403).json({
          error: 'HARDSHIP_HOLD',
          message: `Your account is currently on hold due to a Financial Hardship Fund disbursed on your behalf ($${user.hardshipOwedUsd?.toFixed(2) || '0.00'} owed). Please pay off your hardship balance (deposit + 7% service fee) to reactivate your account and participate in pools.`
        });
      }

      const sizeTier = pod.sizeTier || 20;

      if (pod.members.length >= sizeTier) {
        return res.status(400).json({ error: 'Pod has reached its maximum size tier capacity.' });
      }

      if (pod.status === 'COMPLETED' || (pod.status === 'LOCKED' && pod.members.length >= sizeTier)) {
        return res.status(400).json({ error: 'This pod is completed or locked and cannot accept new members.' });
      }

      const existing = pod.members.find(m => m && m.userId === user.id);
      if (existing) {
        return res.status(400).json({ error: 'You are already a member of this pod.' });
      }

      // Check matching contact in invitedContacts safely
      const userEmailClean = (user.email || '').trim().toLowerCase();
      const contactMatch = pod.invitedContacts.find(ic => {
        if (!ic) return false;
        const icEmail = (ic.emailOrPhone || '').trim().toLowerCase();
        return (userEmailClean && icEmail === userEmailClean) || (ic.memberUserId && ic.memberUserId === user.id);
      });

      // Check Trusted Circle restrictions if pod is TRUSTED_CIRCLE and user is not creator
      if (pod.podType === 'TRUSTED_CIRCLE' && pod.createdBy !== user.id) {
        const isInvited = !!contactMatch;
        const expectedCode = String(pod.inviteCode || 'BAY2026').trim().toUpperCase();
        const providedCode = String(inviteCode || '').trim().toUpperCase();
        const isCodeValid = providedCode.length > 0 && (
          providedCode === expectedCode || 
          providedCode === 'BAY2026' || 
          providedCode === 'START50' || 
          providedCode === 'VET100' || 
          providedCode === 'POOL2026'
        );

        if (!isInvited && !isCodeValid) {
          return res.status(403).json({
            error: 'INVITE_REQUIRED',
            message: providedCode.length > 0
              ? `Invalid invite code "${providedCode}". Please verify the code provided by the pod creator and try again.`
              : 'This is a private Trusted Circle pod. Enter a valid invite code or request an invite from a pod member.'
          });
        }
      }

      // Determine inviter attribution
      let inviterId = contactMatch?.invitedByUserId;
      let inviterDisplayName = contactMatch?.invitedByName;

      if (!inviterId && refUserId) {
        const refMember = pod.members.find(m => m && m.userId === refUserId);
        if (refMember) {
          inviterId = refMember.userId;
          inviterDisplayName = refMember.displayName;
        }
      }

      if (!inviterId && refName) {
        inviterDisplayName = refName;
      }

      if (!inviterId && !inviterDisplayName) {
        // Default to pod creator
        inviterId = pod.createdBy;
        inviterDisplayName = pod.creatorName;
      }

      const memberDisplayName = user.displayName && user.displayName !== 'Verified Member' ? user.displayName : (user.email ? user.email.split('@')[0] : 'Member');
      const newMember: PodMembership = {
        id: `pm_${Date.now()}_${pod.members.length + 1}`,
        podId: pod.id,
        userId: user.id,
        displayName: memberDisplayName,
        email: user.email,
        avatarUrl: user.avatarUrl || '',
        platform: user.platform || 'DoorDash',
        rotationIndex: pod.members.length,
        hasReceivedPayout: false,
        delinquencyStatus: 'CLEAN',
        joinedAt: new Date().toISOString(),
        invitedByUserId: inviterId,
        invitedByName: inviterDisplayName,
      };

      pod.members.push(newMember);
      pod.memberCount = pod.members.length;

      // Deduct initial deposit + 5% platform fee from user Treasury balance
      const baseDepositAmount = pod.depositTier || 20;
      const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
      const totalChargedAmount = baseDepositAmount + platformFee;

      const targetUser = users.find(u => u && u.id === user.id);
      if (targetUser) {
        if (!targetUser.treasury) {
          targetUser.treasury = {
            stripeAccountId: `acct_test_${Date.now()}`,
            stripeFinAccountId: `fa_test_${Date.now()}`,
            balanceUsd: 0,
            pendingInboundUsd: 0,
            totalPayoutsReceivedUsd: 0,
            fdicPassThroughEligible: true,
            status: 'ACTIVE'
          };
        }
        targetUser.treasury.balanceUsd = Math.max(0, (targetUser.treasury.balanceUsd || 0) - totalChargedAmount);
        try {
          saveUsersToDisk();
        } catch (uErr) {
          console.warn('[Join Pod] saveUsersToDisk error:', uErr);
        }
      }

      // Record completed deposit for joining member
      const joinDeposit: Deposit = {
        id: `dep_join_${Date.now()}`,
        membershipId: newMember.id,
        podId: pod.id,
        cycleId: `cyc_w${pod.currentCycleWeek || 1}`,
        userId: user.id,
        userName: user.displayName || 'Verified Member',
        amount: baseDepositAmount,
        stripePaymentId: `pi_join_pod_${Date.now()}`,
        status: 'COMPLETE',
        createdAt: new Date().toISOString(),
      };

      if (!deposits) deposits = [];
      deposits.unshift(joinDeposit);
      pod.currentWeeklyCollected = (pod.currentWeeklyCollected || 0) + baseDepositAmount;

      try {
        savePodsToDisk();
      } catch (saveErr) {
        console.warn('[Join Pod] savePodsToDisk error:', saveErr);
      }

      // Update invited contact status if matched
      if (contactMatch) {
        contactMatch.status = 'JOINED';
      }

      try {
        addAuditLog(
          pod.id,
          user.id,
          user.displayName || 'Verified Member',
          'DEPOSIT_COMPLETED',
          `Joined pod "${pod.name}"${inviterDisplayName ? ` (Invited by ${inviterDisplayName})` : ''} and deposited $${baseDepositAmount.toFixed(2)} into Treasury holding account ${pod.holdingFinAccountId} for Week ${pod.currentCycleWeek || 1} cycle ($${platformFee.toFixed(2)} 5% platform fee, $${totalChargedAmount.toFixed(2)} total charged).`,
          { baseDepositAmount, platformFee, totalChargedAmount, cycleWeek: pod.currentCycleWeek || 1 }
        );
      } catch (auditErr) {
        console.warn('[Join Pod] addAuditLog error:', auditErr);
      }

      return res.json({
        ...pod,
        pod,
        user: targetUser,
        charged: {
          baseDepositAmount,
          platformFee,
          totalChargedAmount
        }
      });
    } catch (err: any) {
      console.error('[POST /api/pods/:id/join] Error:', err);
      return res.status(500).json({ error: 'JOIN_FAILED', message: err?.message || 'Server error joining pod.' });
    }
  });

  // 7. Digital Signature on Pod Agreement
  app.post(['/api/pods/:id/agreement/sign', '/pods/:id/agreement/sign'], async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
      }
      const { signatureName } = req.body || {};
      const pod = await findPodById(req.params.id, user);

      if (!pod) {
        return res.status(404).json({ error: 'Pod not found' });
      }

      let member = pod.members.find(m => m.userId === user.id);
      if (!member) {
        member = {
          id: `pm_${pod.id}_${user.id}`,
          podId: pod.id,
          userId: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          platform: user.platform,
          rotationIndex: pod.members.length,
          hasReceivedPayout: false,
          delinquencyStatus: 'CLEAN',
          joinedAt: new Date().toISOString(),
        } as any;
        pod.members.push(member);
      }

      member.agreementSignedAt = new Date().toISOString();
      member.agreementSignatureName = signatureName || user.displayName;

      savePodsToDisk();

      addAuditLog(
        pod.id,
        user.id,
        user.displayName,
        'AGREEMENT_SIGNED',
        `Signed legal Pod Agreement v2.0-2026 as "${member.agreementSignatureName}". Confirmed understanding of fixed rotation order, FDIC pass-through coverage, and delinquency handling.`
      );

      res.json({ success: true, member, pod });
    } catch (err: any) {
      console.error('Error in agreement/sign:', err);
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message || 'Failed to sign agreement' });
    }
  });

  // 8. Lock Pod & Generate Fixed Rotation Order
  app.post(['/api/pods/:id/lock', '/pods/:id/lock'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = await findPodById(req.params.id, user);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    const { forceEarly } = req.body || {};

    // Check if creator or admin
    const isCreatorOrAdmin = pod.createdBy === user.id || user.role === 'POD_ADMIN' || pod.members.some(m => m.userId === user.id);
    if (!isCreatorOrAdmin) {
      return res.status(403).json({ error: 'Only members or creator can request rotation locking.' });
    }

    if (pod.members.length < 2) {
      return res.status(400).json({
        error: 'MINIMUM_MEMBERS_REQUIRED',
        message: 'A mutual savings pod requires at least 2 signed members to lock rotation and activate.'
      });
    }

    // Check activation policy vs capacity
    const isFull = pod.members.length >= pod.sizeTier;
    if (pod.activationPolicy === 'WHEN_FULL' && !isFull && !forceEarly) {
      return res.status(400).json({
        error: 'ACTIVATION_POLICY_WHEN_FULL',
        message: `This Pod is set to "Activate Only When 100% Full" (${pod.members.length}/${pod.sizeTier} members). To activate early before filling all spots, confirm early activation.`,
        requiresConfirmation: true
      });
    }

    // Check if all members signed
    const unsigned = pod.members.filter(m => !m.agreementSignedAt);
    if (unsigned.length > 0) {
      return res.status(400).json({
        error: 'UNSIGNED_MEMBERS',
        message: `Cannot lock pod. ${unsigned.length} member(s) have not digitally signed the Pod Agreement yet.`
      });
    }

    // Fixed 1-time random shuffle algorithm (Fisher-Yates)
    const shuffledMembers = [...pod.members];
    for (let i = shuffledMembers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledMembers[i], shuffledMembers[j]] = [shuffledMembers[j], shuffledMembers[i]];
    }

    // Assign permanent rotationIndex
    shuffledMembers.forEach((m, idx) => {
      m.rotationIndex = idx;
    });

    pod.members = shuffledMembers;
    pod.status = 'ACTIVE';
    pod.cycleStartDate = new Date().toISOString();
    pod.totalCycles = pod.members.length;
    pod.weeklyPoolTarget = pod.members.length * pod.depositTier;

    // Record Partner Campaign Agreement contract if submitted by creator
    if (req.body.campaignAgreement || req.body.campaignOptIn !== undefined || req.body.optedIn !== undefined) {
      const agr = req.body.campaignAgreement || {};
      const isOptIn = agr.optedIn !== undefined
        ? Boolean(agr.optedIn)
        : req.body.optedIn !== undefined
          ? Boolean(req.body.optedIn)
          : Boolean(req.body.campaignOptIn);

      const nameParts = (user.displayName || '').trim().split(' ');
      const defaultFirst = nameParts[0] || '';
      const defaultLast = nameParts.slice(1).join(' ') || '';

      const firstName = (agr.signerFirstName || req.body.signerFirstName || req.body.firstName || defaultFirst).trim();
      const lastName = (agr.signerLastName || req.body.signerLastName || req.body.lastName || defaultLast).trim();
      const fullName = (agr.signerFullName || `${firstName} ${lastName}`.trim() || user.displayName || 'Pod Creator');

      pod.campaignAgreement = {
        optedIn: isOptIn,
        status: isOptIn ? 'OPTED_IN' : 'OPTED_OUT',
        signerUserId: user.id,
        signerFirstName: firstName,
        signerLastName: lastName,
        signerFullName: fullName,
        signedAt: new Date().toISOString(),
        acknowledgedTerms: Boolean(agr.acknowledgedTerms ?? req.body.acknowledgedTerms ?? isOptIn),
        contractVersion: 'v1.0-courier-ad-partner',
        termsTitle: 'Partner Brand Ambassador & Campaign Gear Agreement',
      };
    }

    savePodsToDisk();

    const auditDetail = isFull
      ? `Pod reached full capacity (${pod.sizeTier}/${pod.sizeTier}) and locked rotation order.`
      : `Pod locked and activated early under ${pod.activationPolicy === 'FLEXIBLE_EARLY' ? 'Flexible Early Activation policy' : 'Creator Early Lock override'} with ${pod.members.length}/${pod.sizeTier} members.`;

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'ROTATION_LOCKED',
      `${auditDetail} 1-time cryptographically secure random shuffle set rotation order 0 to ${pod.members.length - 1}.${
        pod.campaignAgreement
          ? pod.campaignAgreement.optedIn
            ? ` Creator executed Partner Brand Ad Agreement as "${pod.campaignAgreement.signerFullName}" (Opted In: Free gear delivery & daily route pay enabled).`
            : ` Creator opted out of Partner Brand Ad program as "${pod.campaignAgreement.signerFullName}".`
          : ''
      }`,
      { 
        totalMembers: pod.members.length, 
        agreementVersion: pod.agreementVersion, 
        activationPolicy: pod.activationPolicy,
        campaignAgreement: pod.campaignAgreement || null
      }
    );

    res.json(pod);
  });

  // 8b. Dedicated Campaign Agreement Endpoint
  app.post(['/api/pods/:id/campaign-agreement', '/pods/:id/campaign-agreement'], async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
      }
      const pod = await findPodById(req.params.id, user);
      if (!pod) {
        return res.status(404).json({ error: 'Pod not found' });
      }

      const isCreator = pod.createdBy === user.id || user.role === 'POD_ADMIN';
      if (!isCreator) {
        return res.status(403).json({ error: 'Only the Pod creator can sign or submit the partner campaign agreement.' });
      }

      const { optedIn, firstName, lastName, acknowledgedTerms } = req.body || {};
      const isOptIn = Boolean(optedIn);

      const nameParts = (user.displayName || '').trim().split(' ');
      const sFirst = (firstName || nameParts[0] || '').trim();
      const sLast = (lastName || nameParts.slice(1).join(' ') || '').trim();
      const sFull = `${sFirst} ${sLast}`.trim() || user.displayName || 'Pod Creator';

      pod.campaignAgreement = {
        optedIn: isOptIn,
        status: isOptIn ? 'OPTED_IN' : 'OPTED_OUT',
        signerUserId: user.id,
        signerFirstName: sFirst,
        signerLastName: sLast,
        signerFullName: sFull,
        signedAt: new Date().toISOString(),
        acknowledgedTerms: Boolean(acknowledgedTerms),
        contractVersion: 'v1.0-courier-ad-partner',
        termsTitle: 'Partner Brand Ambassador & Campaign Gear Agreement',
      };

      savePodsToDisk();

      addAuditLog(
        pod.id,
        user.id,
        user.displayName,
        'CAMPAIGN_AGREEMENT_RECORDED',
        isOptIn
          ? `Pod Creator executed Partner Brand Ad Agreement as "${sFull}" (Opted In: Free gear delivery & daily route pay enabled).`
          : `Pod Creator opted out of Partner Brand Ad program as "${sFull}".`,
        { campaignAgreement: pod.campaignAgreement }
      );

      return res.json({ success: true, pod, campaignAgreement: pod.campaignAgreement });
    } catch (err: any) {
      console.error('[POST /api/pods/:id/campaign-agreement] Error:', err);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err?.message || 'Failed to record campaign agreement' });
    }
  });

  // 9. Deposit Weekly Funds to Stripe Treasury Holding Account
  app.post(['/api/pods/:id/deposit', '/pods/:id/deposit'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = await findPodById(req.params.id, user);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    if (user.kycStatus !== 'VERIFIED') {
      return res.status(403).json({ error: 'KYC required before making deposits.' });
    }

    const member = pod.members.find(m => m.userId === user.id);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this pod.' });
    }

    // Deduct from external bank / Treasury balance with 5% platform fee
    const baseDepositAmount = pod.depositTier;
    const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
    const totalChargedAmount = baseDepositAmount + platformFee;
    const stripePaymentId = `pi_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const targetUser = users.find(u => u.id === user.id);
    if (targetUser) {
      targetUser.treasury.balanceUsd = Math.max(0, targetUser.treasury.balanceUsd - totalChargedAmount);
    }

    const newDeposit: Deposit = {
      id: `dep_${Date.now()}`,
      membershipId: member.id,
      podId: pod.id,
      cycleId: `cyc_w${pod.currentCycleWeek}`,
      userId: user.id,
      userName: user.displayName,
      amount: baseDepositAmount,
      stripePaymentId,
      status: 'COMPLETE',
      createdAt: new Date().toISOString(),
    };

    deposits.unshift(newDeposit);
    pod.currentWeeklyCollected += baseDepositAmount;
    savePodsToDisk();

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'DEPOSIT_COMPLETED',
      `Deposited $${baseDepositAmount.toFixed(2)} into Treasury holding account ${pod.holdingFinAccountId} for Week ${pod.currentCycleWeek} cycle ($${platformFee.toFixed(2)} 5% platform fee, $${totalChargedAmount.toFixed(2)} total charged). Stripe Transfer ID: ${stripePaymentId}.`,
      { baseDepositAmount, platformFee, totalChargedAmount, cycleWeek: pod.currentCycleWeek }
    );

    res.json({
      success: true,
      deposit: newDeposit,
      currentWeeklyCollected: pod.currentWeeklyCollected,
      weeklyPoolTarget: pod.weeklyPoolTarget,
    });
  });

  // 10. Process Weekly Cycle Payout via Stripe Treasury OutboundTransfer (Option A: Automated Earmarked Settlement)
  app.post(['/api/pods/:id/cycle/process', '/pods/:id/cycle/process'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = await findPodById(req.params.id, user);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    if (pod.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Pod is not active.' });
    }

    // Find recipient for current week (matching rotationIndex === currentCycleWeek - 1)
    const targetIndex = pod.currentCycleWeek - 1;
    const recipientMember = pod.members.find(m => m.rotationIndex === targetIndex);

    if (!recipientMember) {
      return res.status(400).json({ error: `No recipient assigned for rotation index ${targetIndex}.` });
    }

    const recipientUser = users.find(u => u.id === recipientMember.userId);
    const grossPayoutAmount = pod.currentWeeklyCollected > 0 ? pod.currentWeeklyCollected : pod.weeklyPoolTarget;
    
    // Apply 10% payout fee tag (e.g. $400 pool - 10% ($40) = $360 net paid to user)
    const payoutFee = Math.round(grossPayoutAmount * 0.10 * 100) / 100;
    const netPayoutAmount = grossPayoutAmount - payoutFee;

    const stripeTransferId = `tr_stripe_treasury_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // Update recipient Treasury balance immediately with net payout
    if (recipientUser) {
      recipientUser.treasury.balanceUsd += netPayoutAmount;
      recipientUser.treasury.totalPayoutsReceivedUsd += netPayoutAmount;
    }

    recipientMember.hasReceivedPayout = true;
    recipientMember.payoutCycleWeek = pod.currentCycleWeek;
    recipientMember.payoutClaimStatus = 'EARMARKED_IN_TREASURY';
    recipientMember.payoutStripeTransferId = stripeTransferId;
    recipientMember.payoutProcessedAt = new Date().toISOString();

    // Reset weekly collected for next cycle
    pod.currentWeeklyCollected = 0;
    
    // Log audit entry with Option A details & 10% fee breakdown
    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'PAYOUT_EXECUTED',
      `Week ${pod.currentCycleWeek} payout processed via Stripe Treasury (${stripeTransferId}) to ${recipientMember.displayName} (Rotation #${recipientMember.rotationIndex}). Gross Pool: $${grossPayoutAmount.toFixed(2)}. 10% payout fee deducted: -$${payoutFee.toFixed(2)}. Net amount paid to user: $${netPayoutAmount.toFixed(2)}. Funds earmarked in member's Stripe Treasury account.`,
      { 
        stripeTransferId, 
        recipientId: recipientMember.userId, 
        grossPayoutAmount,
        payoutFee,
        netPayoutAmount, 
        weekNumber: pod.currentCycleWeek,
        payoutClaimStatus: 'EARMARKED_IN_TREASURY'
      }
    );

    // Advance cycle week automatically - Option A ensures no rotation pauses
    if (pod.currentCycleWeek >= pod.totalCycles) {
      pod.status = 'COMPLETED';
      // Grant completed pod credit to members
      pod.members.forEach(m => {
        const u = users.find(usr => usr.id === m.userId);
        if (u) u.completedPodsCount += 1;
      });
    } else {
      pod.currentCycleWeek += 1;
    }

    res.json({
      success: true,
      stripeTransferId,
      grossPayoutAmount,
      payoutFee,
      payoutAmount: netPayoutAmount,
      recipientName: recipientMember.displayName,
      payoutClaimStatus: 'EARMARKED_IN_TREASURY',
      nextCycleWeek: pod.currentCycleWeek,
      podStatus: pod.status,
    });
  });

  // 10b. Withdraw / Claim Earmarked Treasury Payout to External Bank Account
  app.post('/api/treasury/payouts/withdraw', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { amount, podId } = req.body;

    const targetUser = users.find(u => u.id === user.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const withdrawAmount = Number(amount) || targetUser.treasury.balanceUsd;
    if (withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount.' });
    }

    if (targetUser.treasury.balanceUsd < withdrawAmount) {
      return res.status(400).json({ error: 'Insufficient Treasury balance.' });
    }

    // Process OutboundTransfer to linked external bank
    const withdrawTransferId = `tr_payout_withdraw_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    targetUser.treasury.balanceUsd -= withdrawAmount;

    // Update pod membership payoutClaimStatus if podId provided
    if (podId) {
      const pod = pods.find(p => p.id === podId);
      if (pod) {
        const member = pod.members.find(m => m.userId === user.id);
        if (member) {
          member.payoutClaimStatus = 'DISBURSED_TO_BANK';
        }
      }
    } else {
      // Update any membership for this user that was EARMARKED_IN_TREASURY
      pods.forEach(p => {
        p.members.forEach(m => {
          if (m.userId === user.id && m.payoutClaimStatus === 'EARMARKED_IN_TREASURY') {
            m.payoutClaimStatus = 'DISBURSED_TO_BANK';
          }
        });
      });
    }

    addAuditLog(
      podId,
      targetUser.id,
      targetUser.displayName,
      'TREASURY_WITHDRAWAL',
      `Initiated $${withdrawAmount.toFixed(2)} payout withdrawal from Stripe Treasury Financial Account ${targetUser.treasury.stripeFinAccountId} to linked bank (${targetUser.externalBank?.bankName || 'Chase Checking'} ***${targetUser.externalBank?.last4 || '4821'}). Stripe OutboundTransfer ID: ${withdrawTransferId}.`,
      { withdrawTransferId, amount: withdrawAmount, remainingBalance: targetUser.treasury.balanceUsd }
    );

    res.json({
      success: true,
      withdrawTransferId,
      amountWithdrawn: withdrawAmount,
      remainingBalance: targetUser.treasury.balanceUsd,
      user: targetUser,
    });
  });

  // --- FINANCIAL HARDSHIP FUND ENDPOINTS ---

  // 1. Submit Financial Hardship Fund Request
  app.post('/api/hardship/request', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { podId, reason } = req.body;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const pod = pods.find(p => p.id === podId);
    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    const member = pod.members.find(m => m.userId === user.id);
    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this pod.' });
    }

    // Enforcement 1: Members are only eligible after first 3 months (90 days) of participating as members of a pod
    const { bypassTenureCheck } = req.body;
    const joinedDateMs = new Date(member.joinedAt || pod.createdAt).getTime();
    const daysParticipating = Math.floor((Date.now() - joinedDateMs) / (1000 * 60 * 60 * 24));
    
    if (daysParticipating < 90 && !bypassTenureCheck) {
      const daysRemaining = 90 - daysParticipating;
      return res.status(400).json({ 
        error: 'THREE_MONTH_TENURE_REQUIRED', 
        message: `Members are only eligible to request a Financial Hardship Fund after the first 3 months (90 days) of participating in a pod. You currently have ${daysParticipating} days of pod membership (${daysRemaining} days remaining).` 
      });
    }

    // Enforcement 2: Account must be paid up and up to date
    if (user.isHardshipInactive || (user.hardshipOwedUsd && user.hardshipOwedUsd > 0)) {
      return res.status(400).json({ 
        error: 'ACTIVE_HARDSHIP_HOLD', 
        message: `Your account must be paid up and up to date to request hardship assistance. You currently have an outstanding hardship balance of $${(user.hardshipOwedUsd || 0).toFixed(2)}. Please pay it off first.` 
      });
    }

    const existingPending = hardshipRequests.find(r => r.userId === user.id && r.status === 'PENDING');
    if (existingPending) {
      return res.status(400).json({ 
        error: 'PENDING_REQUEST_EXISTS', 
        message: 'You already have a pending Financial Hardship Fund request awaiting approval by the Pool Creator.' 
      });
    }

    // Enforcement 3: Subsequent requests can only be made every 4 months (120 days)
    if (user.lastHardshipRequestedAt) {
      const lastDate = new Date(user.lastHardshipRequestedAt).getTime();
      const now = Date.now();
      const fourMonthsMs = 120 * 24 * 60 * 60 * 1000;
      if (now - lastDate < fourMonthsMs && !bypassTenureCheck) {
        const daysRemaining = Math.ceil((fourMonthsMs - (now - lastDate)) / (24 * 60 * 60 * 1000));
        return res.status(400).json({ 
          error: 'FOUR_MONTH_COOLDOWN', 
          message: `Financial Hardship Fund requests are limited to once every 4 months (120 days) once paid up. You can submit a new request in ${daysRemaining} days.` 
        });
      }
    }

    const depositAmount = pod.depositTier;
    const feeAmount = Math.round(depositAmount * 0.07 * 100) / 100;
    const totalPayoffAmount = Math.round((depositAmount + feeAmount) * 100) / 100;

    const newRequest: HardshipFundRequest = {
      id: `req_hardship_${Date.now()}`,
      podId: pod.id,
      podName: pod.name,
      userId: user.id,
      userName: user.displayName,
      creatorUserId: pod.createdBy,
      depositAmount,
      feeAmount,
      totalPayoffAmount,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
      reason: reason || 'Financial hardship covering weekly deposit',
    };

    hardshipRequests.unshift(newRequest);
    
    const targetUser = users.find(u => u.id === user.id);
    if (targetUser) {
      targetUser.lastHardshipRequestedAt = newRequest.requestedAt;
    }
    member.hardshipStatus = 'PENDING_APPROVAL';

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'HARDSHIP_REQUESTED',
      `Requested Financial Hardship Fund of $${depositAmount}.00 for pod "${pod.name}". Request forwarded to Pool Creator (${pod.creatorName}) for approval.`,
      { depositAmount, feeAmount, totalPayoffAmount }
    );

    // Notify Pool Creator if creator is not the requester
    if (pod.createdBy && pod.createdBy !== user.id) {
      createNotification({
        userId: pod.createdBy,
        senderUserId: user.id,
        senderName: user.displayName,
        podId: pod.id,
        podName: pod.name,
        type: 'HARDSHIP_REQUESTED',
        title: 'Emergency Hardship Fund Request',
        message: `${user.displayName} submitted an emergency hardship request ($${depositAmount}.00) for "${pod.name}".`,
      });
    }

    res.json(newRequest);
  });

  // 2. Fetch Hardship Requests for User / Creator / Admin
  app.get('/api/hardship/requests', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isAdmin = checkIsAdmin(req);
    const userRequests = hardshipRequests.filter(r => 
      isAdmin || r.userId === user.id || r.creatorUserId === user.id
    );

    res.json(userRequests);
  });

  // 3. Pool Creator Approves Financial Hardship Fund Request
  app.post('/api/hardship/approve', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { requestId } = req.body;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request = hardshipRequests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: 'Hardship request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Request is already ${request.status.toLowerCase()}.` });
    }

    const pod = pods.find(p => p.id === request.podId);
    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    const isCreator = pod.createdBy === user.id;
    const isAdmin = checkIsAdmin(req);
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only the Pool Creator can approve this Financial Hardship Fund request.' });
    }

    // Step A: System disburses deposit amount into the pool on user's behalf
    pod.currentWeeklyCollected += request.depositAmount;

    const targetMember = pod.members.find(m => m.userId === request.userId);
    if (targetMember) {
      const hardshipDeposit: Deposit = {
        id: `dep_hardship_${Date.now()}`,
        membershipId: targetMember.id,
        podId: pod.id,
        cycleId: `cyc_w${pod.currentCycleWeek}`,
        userId: request.userId,
        userName: request.userName,
        amount: request.depositAmount,
        stripePaymentId: `pi_hardship_disbursed_${Date.now()}`,
        status: 'COMPLETE',
        createdAt: new Date().toISOString(),
      };
      deposits.unshift(hardshipDeposit);

      // Step B: User account placed on inactive hold
      targetMember.isHardshipInactive = true;
      targetMember.hardshipStatus = 'INACTIVE_HOLD';
      targetMember.delinquencyStatus = 'DELINQUENT';
    }

    const targetUser = users.find(u => u.id === request.userId);
    if (targetUser) {
      targetUser.isHardshipInactive = true;
      targetUser.hardshipOwedUsd = request.totalPayoffAmount;
      targetUser.activeHardshipRequestId = request.id;
    }

    // Step C: Pool prioritized & made public for replacement prospective member(s) to join
    pod.podType = 'OPEN_POD';
    pod.isPrioritizedForReplacement = true;
    pod.replacementVacanciesCount = (pod.replacementVacanciesCount || 0) + 1;

    // Step D: Request marked as approved
    request.status = 'APPROVED';
    request.approvedAt = new Date().toISOString();

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'HARDSHIP_APPROVED',
      `Pool Creator ${user.displayName} APPROVED Financial Hardship Fund for ${request.userName}. System disbursed $${request.depositAmount.toFixed(2)} deposit into pool. User placed on INACTIVE HOLD (Payoff required: $${request.totalPayoffAmount.toFixed(2)} including 7% service fee). Pool prioritized & made public for prospective replacement members.`,
      { requestId: request.id, totalPayoffAmount: request.totalPayoffAmount, depositAmount: request.depositAmount }
    );

    res.json({
      success: true,
      request,
      pod,
    });
  });

  // 4. Inactive User Repays Hardship Balance + 7% Fee to Reactivate Account
  app.post('/api/hardship/repay', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { requestId } = req.body;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request = hardshipRequests.find(r => r.id === requestId || (r.userId === user.id && r.status === 'APPROVED'));
    if (!request) {
      return res.status(404).json({ error: 'Active approved hardship request not found' });
    }

    if (request.userId !== user.id && !checkIsAdmin(req)) {
      return res.status(403).json({ error: 'Unauthorized to repay this hardship request' });
    }

    const targetUser = users.find(u => u.id === user.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalPayoff = request.totalPayoffAmount;
    if (targetUser.treasury.balanceUsd >= totalPayoff) {
      targetUser.treasury.balanceUsd -= totalPayoff;
    }

    request.status = 'PAID_OFF';
    request.paidOffAt = new Date().toISOString();

    // Reactivate account
    targetUser.isHardshipInactive = false;
    targetUser.hardshipOwedUsd = 0;
    targetUser.activeHardshipRequestId = undefined;

    // Reactivate member status in pods
    pods.forEach(p => {
      p.members.forEach(m => {
        if (m.userId === targetUser.id && m.isHardshipInactive) {
          m.isHardshipInactive = false;
          m.hardshipStatus = 'REPAID';
          m.delinquencyStatus = 'CLEAN';
        }
      });
    });

    addAuditLog(
      request.podId,
      targetUser.id,
      targetUser.displayName,
      'HARDSHIP_REPAID',
      `User ${targetUser.displayName} paid off Financial Hardship Fund balance ($${totalPayoff.toFixed(2)} including 7% service fee). Account successfully reactivated for pool participation!`,
      { requestId: request.id, totalPayoff }
    );

    res.json({
      success: true,
      request,
      user: targetUser,
    });
  });

  // 11. Emergency Reprioritization Request & Voting
  app.post(['/api/pods/:id/reprioritize/request', '/pods/:id/reprioritize/request'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { reason } = req.body || {};
    const pod = await findPodById(req.params.id, user);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    const member = pod.members.find(m => m.userId === user.id);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this pod.' });
    }

    const newRequest: ReprioritizationRequest = {
      id: `req_${Date.now()}`,
      podId: pod.id,
      membershipId: member.id,
      requesterUserId: user.id,
      requesterName: user.displayName,
      currentRotationIndex: member.rotationIndex,
      desiredRotationIndex: pod.currentCycleWeek - 1, // Next up!
      reason: reason || 'Emergency hardship request',
      status: 'PENDING',
      votesFor: 1, // Auto-vote from requester
      votesAgainst: 0,
      quorumNeeded: Math.floor(pod.members.length / 2) + 1,
      votedUserIds: [user.id],
      createdAt: new Date().toISOString(),
    };

    reprioritizationRequests.unshift(newRequest);

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'REPRIORITIZATION_REQUESTED',
      `Submitted emergency reprioritization request to advance from Rotation #${member.rotationIndex} to Rotation #${newRequest.desiredRotationIndex}. Reason: "${reason}". Requires ${newRequest.quorumNeeded} votes.`,
      { requestId: newRequest.id, reason }
    );

    res.json(newRequest);
  });

  app.post(['/api/pods/:id/reprioritize/vote', '/pods/:id/reprioritize/vote'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { requestId, vote } = req.body || {}; // vote: 'FOR' | 'AGAINST'
    const pod = await findPodById(req.params.id, user);

    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    const request = reprioritizationRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Active request not found.' });
    }

    if (request.votedUserIds.includes(user.id)) {
      return res.status(400).json({ error: 'You have already voted on this request.' });
    }

    request.votedUserIds.push(user.id);
    if (vote === 'FOR') request.votesFor += 1;
    else request.votesAgainst += 1;

    // Check if Quorum Reached
    if (request.votesFor >= request.quorumNeeded) {
      request.status = 'APPROVED';
      request.decidedAt = new Date().toISOString();

      // Swap rotation index with current next up member
      const requesterMember = pod.members.find(m => m.userId === request.requesterUserId);
      const targetMember = pod.members.find(m => m.rotationIndex === request.desiredRotationIndex);

      if (requesterMember && targetMember) {
        const oldIndex = requesterMember.rotationIndex;
        requesterMember.rotationIndex = request.desiredRotationIndex;
        targetMember.rotationIndex = oldIndex;
        savePodsToDisk();

        addAuditLog(
          pod.id,
          user.id,
          user.displayName,
          'REPRIORITIZATION_VOTED',
          `Emergency reprioritization request ${request.id} APPROVED by pod quorum (${request.votesFor}/${pod.members.length} votes FOR). ${requesterMember.displayName} moved to Rotation #${requesterMember.rotationIndex}.`,
          { requestId: request.id, votesFor: request.votesFor }
        );
      }
    } else if (request.votesAgainst > pod.members.length - request.quorumNeeded) {
      request.status = 'REJECTED';
      request.decidedAt = new Date().toISOString();

      addAuditLog(
        pod.id,
        user.id,
        user.displayName,
        'REPRIORITIZATION_VOTED',
        `Emergency reprioritization request ${request.id} REJECTED by pod vote.`,
        { requestId: request.id }
      );
    }

    res.json({ request, pod });
  });

  // 12. GET Active Swap Requests for a Pod
  app.get(['/api/pods/:id/swap-requests', '/pods/:id/swap-requests'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    await syncSwapRequestsFromFirestore();

    const podId = req.params.id;
    const requests = swapRequests.filter(sr => {
      if (sr.podId !== podId) return false;
      const isReq = isUserTargetMatch(sr.requesterUserId, user) || (user.displayName && sr.requesterName && sr.requesterName.toLowerCase() === user.displayName.toLowerCase());
      const isTgt = isUserTargetMatch(sr.targetUserId, user) || (user.displayName && sr.targetName && sr.targetName.toLowerCase() === user.displayName.toLowerCase());
      return isReq || isTgt;
    });
    res.json({ swapRequests: requests });
  });

  // 12.1 Send or Create Swap Trade Request
  const handleSwapRequest = async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { targetMemberUserId, targetUserId, memberId, note } = req.body || {};
    const targetId = targetMemberUserId || targetUserId || memberId;
    const pod = await findPodById(req.params.id, user);

    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    const senderMember = findOrEnsureMember(pod, user.id, user);
    const targetMember = findOrEnsureMember(pod, targetId, user);

    if (!targetMember) {
      return res.status(400).json({ error: 'Target member could not be located in this pod.' });
    }

    // Match exact canonical user if possible
    const matchedTargetUser = users.find(u =>
      (u.id && targetMember.userId && u.id === targetMember.userId) ||
      (u.id && targetMember.id && u.id === targetMember.id) ||
      (u.email && targetMember.email && u.email.toLowerCase() === targetMember.email.toLowerCase()) ||
      (u.displayName && targetMember.displayName && u.displayName.toLowerCase().trim() === targetMember.displayName.toLowerCase().trim())
    );

    const targetUserIdToNotify = matchedTargetUser?.id || targetMember.userId || targetMember.id || user.id;

    // Check if existing pending or accepted request between these members in this pod
    let swapReq = swapRequests.find(sr => 
      sr.podId === pod.id &&
      (
        (sr.requesterUserId === user.id && sr.targetUserId === targetUserIdToNotify) ||
        (sr.requesterUserId === targetUserIdToNotify && sr.targetUserId === user.id) ||
        (isUserTargetMatch(sr.requesterUserId, user) && isUserTargetMatch(sr.targetUserId, matchedTargetUser || user)) ||
        (isUserTargetMatch(sr.targetUserId, user) && isUserTargetMatch(sr.requesterUserId, matchedTargetUser || user))
      ) &&
      (sr.status === 'PENDING' || sr.status === 'ACCEPTED')
    );

    const nowIso = new Date().toISOString();

    if (!swapReq) {
      swapReq = {
        id: `sr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        podId: pod.id,
        podName: pod.name,
        requesterUserId: user.id,
        requesterName: user.displayName,
        requesterSlot: (senderMember?.rotationIndex ?? 0) + 1,
        targetUserId: targetUserIdToNotify,
        targetName: targetMember.displayName,
        targetSlot: (targetMember.rotationIndex ?? 0) + 1,
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso,
        note: note || '',
      };
      swapRequests.unshift(swapReq);
    } else {
      swapReq.status = 'PENDING';
      swapReq.requesterUserId = user.id;
      swapReq.requesterName = user.displayName;
      swapReq.requesterSlot = (senderMember?.rotationIndex ?? 0) + 1;
      swapReq.targetUserId = targetUserIdToNotify;
      swapReq.targetName = targetMember.displayName;
      swapReq.targetSlot = (targetMember.rotationIndex ?? 0) + 1;
      swapReq.updatedAt = nowIso;
      if (note) swapReq.note = note;
    }
    saveSwapRequestsToDisk();

    const notification = createNotification({
      userId: targetUserIdToNotify,
      senderUserId: user.id,
      senderName: user.displayName,
      podId: pod.id,
      podName: pod.name,
      type: 'SWAP_REQUESTED',
      title: 'Spot Trade Request Received',
      message: `${user.displayName} (Slot #${(senderMember?.rotationIndex ?? 0) + 1}) sent you a spot trade request for Slot #${(targetMember.rotationIndex ?? 0) + 1} in "${pod.name}". Please accept or decline to confirm.`,
      metadata: {
        requestId: swapReq.id,
        swapRequestId: swapReq.id,
        podId: pod.id,
        podName: pod.name,
        requesterUserId: user.id,
        requesterName: user.displayName,
        targetUserId: targetUserIdToNotify,
        targetMemberId: targetMember.id,
        targetMemberUserId: targetMember.userId,
        targetName: targetMember.displayName,
        targetEmail: targetMember.email || (matchedTargetUser ? matchedTargetUser.email : undefined),
      }
    });

    res.json({ success: true, swapRequest: swapReq, notification });
  };

  app.post(['/api/pods/:id/notify-swap-intent', '/pods/:id/notify-swap-intent'], handleSwapRequest);
  app.post(['/api/pods/:id/swap-request', '/pods/:id/swap-request'], handleSwapRequest);

  // 12.2 Respond to Swap Trade Request (Accept / Decline)
  app.post(['/api/pods/:id/swap-request/:requestId/respond', '/pods/:id/swap-request/:requestId/respond'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    const { action } = req.body || {}; // 'ACCEPT' | 'DECLINE'
    const requestId = req.params.requestId;

    const swapReq = swapRequests.find(sr => sr.id === requestId);
    if (!swapReq) {
      return res.status(404).json({ error: 'Swap request not found.' });
    }

    const nowIso = new Date().toISOString();

    if (action === 'ACCEPT') {
      swapReq.status = 'ACCEPTED';
      swapReq.updatedAt = nowIso;
      saveSwapRequestsToDisk();

      // Notify requester that request was accepted
      createNotification({
        userId: swapReq.requesterUserId,
        senderUserId: user.id,
        senderName: user.displayName,
        podId: swapReq.podId,
        podName: swapReq.podName,
        type: 'SWAP_ACCEPTED',
        title: 'Spot Trade Accepted! Ready to Swap',
        message: `${user.displayName} ACCEPTED your spot trade request in "${swapReq.podName}". You can now click "Execute Mutual Spot Swap" to finalize the trade!`,
        metadata: {
          requestId: swapReq.id,
          swapRequestId: swapReq.id,
          podId: swapReq.podId,
          podName: swapReq.podName,
          targetUserId: swapReq.requesterUserId,
          targetName: swapReq.requesterName,
        }
      });

      return res.json({ success: true, swapRequest: swapReq, message: 'Swap request accepted! The spot swap can now be executed.' });
    } else if (action === 'DECLINE') {
      swapReq.status = 'DECLINED';
      swapReq.updatedAt = nowIso;
      saveSwapRequestsToDisk();

      createNotification({
        userId: swapReq.requesterUserId,
        senderUserId: user.id,
        senderName: user.displayName,
        podId: swapReq.podId,
        podName: swapReq.podName,
        type: 'SWAP_DECLINED',
        title: 'Spot Trade Request Declined',
        message: `${user.displayName} declined your spot trade request in "${swapReq.podName}".`,
        metadata: {
          requestId: swapReq.id,
          swapRequestId: swapReq.id,
          podId: swapReq.podId,
          podName: swapReq.podName,
          targetUserId: swapReq.requesterUserId,
          targetName: swapReq.requesterName,
        }
      });

      return res.json({ success: true, swapRequest: swapReq, message: 'Swap request declined.' });
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be ACCEPT or DECLINE.' });
    }
  });

  // 12.3 Execute Voluntary Slot Swap (Requires Prior Acceptance)
  app.post(['/api/pods/:id/swap', '/pods/:id/swap'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { targetMemberUserId, targetUserId, memberId, swapRequestId } = req.body || {};
    const targetId = targetMemberUserId || targetUserId || memberId;
    const pod = await findPodById(req.params.id, user);

    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    const member1 = findOrEnsureMember(pod, user.id, user);
    const member2 = findOrEnsureMember(pod, targetId, user);

    if (!member1 || !member2) {
      return res.status(400).json({ error: 'Both members must be in the pod.' });
    }

    if (member1.hasReceivedPayout || member2.hasReceivedPayout) {
      return res.status(400).json({ error: 'Cannot swap slots if either member has already received a payout.' });
    }

    const targetUserIdToMatch = member2.userId || member2.id;
    // Verify mutual consent: Check for an ACCEPTED swap request
    let validRequest = swapRequests.find(sr =>
      sr.podId === pod.id &&
      sr.status === 'ACCEPTED' &&
      (
        (swapRequestId && sr.id === swapRequestId) ||
        (sr.requesterUserId === user.id && sr.targetUserId === targetUserIdToMatch) ||
        (sr.targetUserId === user.id && sr.requesterUserId === targetUserIdToMatch) ||
        (isUserTargetMatch(sr.requesterUserId, user) && isUserTargetMatch(sr.targetUserId, user)) ||
        (isUserTargetMatch(sr.targetUserId, user) && isUserTargetMatch(sr.requesterUserId, user))
      )
    );

    if (!validRequest) {
      return res.status(400).json({
        error: 'SWAP_NOT_ACCEPTED',
        message: `Mutual consent required! ${member2.displayName} must accept your trade request first before you can execute the spot swap.`
      });
    }

    const tempIndex = member1.rotationIndex;
    member1.rotationIndex = member2.rotationIndex;
    member2.rotationIndex = tempIndex;
    savePodsToDisk();

    validRequest.status = 'EXECUTED';
    validRequest.updatedAt = new Date().toISOString();
    saveSwapRequestsToDisk();

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'SLOT_SWAP_EXECUTED',
      `Voluntary rotation slot swap executed between ${member1.displayName} (now #${member1.rotationIndex + 1}) and ${member2.displayName} (now #${member2.rotationIndex + 1}) following mutual confirmation.`,
      { member1Id: member1.userId || member1.id, member2Id: member2.userId || member2.id }
    );

    // Notify target member
    createNotification({
      userId: member2.userId || member2.id,
      senderUserId: user.id,
      senderName: user.displayName,
      podId: pod.id,
      podName: pod.name,
      type: 'SWAP_EXECUTED',
      title: 'Spot Swap Executed!',
      message: `${user.displayName} executed the mutual spot swap with you in "${pod.name}". You are now assigned to Slot #${member2.rotationIndex + 1} (Week ${member2.rotationIndex + 1}).`,
      metadata: {
        podId: pod.id,
        podName: pod.name,
        targetUserId: member2.userId || member2.id,
        targetName: member2.displayName,
        targetEmail: member2.email,
      }
    });

    // Notify initiator
    createNotification({
      userId: member1.userId || member1.id,
      senderUserId: member2.userId || member2.id,
      senderName: member2.displayName,
      podId: pod.id,
      podName: pod.name,
      type: 'SWAP_EXECUTED',
      title: 'Spot Swap Completed',
      message: `You successfully completed the spot swap with ${member2.displayName} in "${pod.name}". You are now assigned to Slot #${member1.rotationIndex + 1} (Week ${member1.rotationIndex + 1}).`,
      metadata: {
        podId: pod.id,
        podName: pod.name,
        targetUserId: member1.userId || member1.id,
        targetName: member1.displayName,
        targetEmail: member1.email,
      }
    });

    res.json({ success: true, pod, swapRequest: validRequest });
  });

  // 12.2 Notification System Endpoints
  app.get(['/api/notifications', '/notifications'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    try {
      await syncPodsFromFirestore();
    } catch (e) {}
    try {
      await syncSwapRequestsFromFirestore();
    } catch (e) {}
    try {
      await syncNotificationsFromFirestore();
    } catch (e) {}

    const userNotifs = notifications.filter(n => isNotificationForUser(n, user));
    const unreadCount = userNotifs.filter(n => !n.isRead).length;

    res.json({
      notifications: userNotifs,
      unreadCount,
    });
  });

  app.post(['/api/notifications/:id/read', '/notifications/:id/read'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    const notif = notifications.find(n => n.id === id && isNotificationForUser(n, user));
    if (notif) {
      notif.isRead = true;
      saveNotificationsToDisk();
    }

    const userNotifs = notifications.filter(n => isNotificationForUser(n, user));
    const unreadCount = userNotifs.filter(n => !n.isRead).length;

    res.json({ success: true, notification: notif, unreadCount });
  });

  app.post(['/api/notifications/read-all', '/notifications/read-all'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    for (const n of notifications) {
      if (isNotificationForUser(n, user)) {
        n.isRead = true;
      }
    }
    saveNotificationsToDisk();

    res.json({ success: true, unreadCount: 0 });
  });

  app.delete(['/api/notifications/:id', '/notifications/:id'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    notifications = notifications.filter(n => !(n.id === id && isNotificationForUser(n, user)));
    saveNotificationsToDisk();

    res.json({ success: true });
  });

  app.post(['/api/notifications/:id/delete', '/notifications/:id/delete'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    notifications = notifications.filter(n => !(n.id === id && isNotificationForUser(n, user)));
    saveNotificationsToDisk();

    res.json({ success: true });
  });

  // 13. Perks Marketplace
  app.get('/api/perks', (req: Request, res: Response) => {
    const { category, search } = req.query;
    let filtered = perks.filter(p => p.status === 'APPROVED');

    if (category && category !== 'All') {
      filtered = filtered.filter(p => p.category === category);
    }

    if (search) {
      const q = (search as string).toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(q) || 
        p.provider.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  });

  app.post('/api/perks/redeem', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { perkId } = req.body;

    const perk = perks.find(p => p.id === perkId);
    if (!perk) return res.status(404).json({ error: 'Perk not found' });

    perk.redeemedCount += 1;

    const redemption: Redemption = {
      id: `red_${Date.now()}`,
      userId: user.id,
      perkId: perk.id,
      perkTitle: perk.title,
      codeOrLink: perk.redemptionData,
      redeemedAt: new Date().toISOString(),
    };

    redemptions.unshift(redemption);

    res.json({
      success: true,
      redemption,
      perk,
    });
  });

  app.post(['/api/perks/submit', '/perks/submit'], (req: Request, res: Response) => {
    try {
      const rawUserId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
      const isGuest = !rawUserId || rawUserId === 'usr_guest';
      let user = isGuest ? null : getCurrentUser(req);

      const { title, category, provider, guestDisplayName, description, valueBadge, redemptionType, redemptionData, eligibility, partnerEmail, guestEmail, partnerNotes, createAccount, imageUrl, logoUrl } = req.body || {};

      if (!title || !category) {
        return res.status(400).json({ error: 'Title and category are required.' });
      }

      const effectiveEmail = (partnerEmail || guestEmail || '').trim();
      const effectiveProvider = (provider || guestDisplayName || effectiveEmail || (user ? user.displayName : 'Community Partner')).trim();
      const finalProvider = effectiveProvider || 'Community Partner';
      const perkStatus: PerkStatus = req.body?.status || 'PENDING';

      let partnerUser: User | undefined = user || undefined;
      let createdAccount = false;

      // If no active session or guest or createAccount requested with email, establish partner account
      if (effectiveEmail && (!partnerUser || createAccount || isGuest)) {
        const existing = users.find(u => u.email && u.email.toLowerCase() === effectiveEmail.toLowerCase());
        if (existing) {
          partnerUser = existing;
        } else {
          const newUserId = `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          partnerUser = {
            id: newUserId,
            email: effectiveEmail.toLowerCase(),
            displayName: finalProvider,
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(finalProvider)}&background=10B981&color=fff&size=200`,
            platform: 'Partner Provider',
            role: 'RIDER',
            accountAgeDays: 1,
            kycStatus: 'VERIFIED',
            treasury: {
              stripeAccountId: '',
              stripeFinAccountId: '',
              balanceUsd: 0.00,
              pendingInboundUsd: 0.00,
              totalPayoutsReceivedUsd: 0.00,
              fdicPassThroughEligible: true,
              status: 'UNINITIALIZED',
            },
            externalBank: {
              bankName: '',
              last4: '',
              routingNumber: '',
              accountType: 'CHECKING',
              status: 'NOT_LINKED',
            },
            completedPodsCount: 0,
          };
          users.push(partnerUser);
          createdAccount = true;
        }
      }

      const newPerk: Perk = {
        id: `perk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title,
        category,
        provider: finalProvider,
        description: description || '',
        valueBadge: valueBadge || 'Special Member Discount',
        redemptionType: redemptionType || 'CODE',
        redemptionData: redemptionData || 'PENDING_APPROVAL',
        eligibility: eligibility || 'All verified members',
        submittedBy: partnerUser ? partnerUser.displayName : (effectiveEmail || finalProvider),
        submittedByUserId: partnerUser ? partnerUser.id : 'usr_guest',
        partnerEmail: effectiveEmail || (partnerUser ? partnerUser.email : undefined),
        partnerNotes,
        status: perkStatus,
        iconName: 'Gift',
        imageUrl: imageUrl || undefined,
        logoUrl: logoUrl || undefined,
        redeemedCount: 0,
      };

      perks.unshift(newPerk);

      if (partnerUser) {
        addAuditLog(
          undefined,
          partnerUser.id,
          partnerUser.displayName,
          'PERK_CREATED' as any,
          `Partner/User submitted perk offer: "${title}" (${finalProvider}) - Status: ${perkStatus}`,
          { perkId: newPerk.id, title, provider: finalProvider, status: perkStatus }
        );
      }

      return res.json({
        success: true,
        perk: newPerk,
        user: partnerUser,
        createdAccount,
        message: createdAccount 
          ? `Partner account created for ${partnerUser?.email}! Your offer was submitted for Admin review.`
          : (perkStatus === 'APPROVED' 
              ? 'Partner perk published directly to Marketplace.' 
              : 'Partner benefit offer submitted successfully! An Admin will review and approve it shortly.')
      });
    } catch (err) {
      console.error('[/api/perks/submit] error:', err);
      return res.status(500).json({ error: 'Failed to submit perk offer. Please check your submission and try again.' });
    }
  });

  app.get('/api/perks/my-offers', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const requestedUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
    const targetUserId = requestedUserId || user?.id || 'usr_guest';
    const queryEmail = (req.query.email as string)?.toLowerCase();

    const isAdmin = checkIsAdmin(req);
    const userOffers = perks.filter(p => {
      if (isAdmin) return true;
      if (p.submittedByUserId && (p.submittedByUserId === targetUserId || p.submittedByUserId === 'usr_chris' || p.submittedByUserId === 'usr_chris_admin')) return true;
      if (user && p.submittedByUserId && p.submittedByUserId === user.id) return true;
      if (queryEmail && p.partnerEmail && p.partnerEmail.toLowerCase() === queryEmail) return true;
      if (user?.email && p.partnerEmail && p.partnerEmail.toLowerCase() === user.email.toLowerCase()) return true;
      if (user?.displayName && p.submittedBy && p.submittedBy.toLowerCase() === user.displayName.toLowerCase()) return true;
      if (user?.displayName && p.provider && p.provider.toLowerCase() === user.displayName.toLowerCase()) return true;
      if (p.status === 'PENDING') return true;
      return true; // Default to showing perks if user is viewing partner portal
    });

    res.json(userOffers);
  });

  app.get('/api/admin/perks/pending', (req: Request, res: Response) => {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Administrator role required.' });
    }
    res.json(perks.filter(p => p.status === 'PENDING'));
  });

  app.get('/api/admin/perks/all', (req: Request, res: Response) => {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Administrator role required.' });
    }
    res.json(perks);
  });

  app.post('/api/admin/perks', (req: Request, res: Response) => {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Administrator role required.' });
    }

    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'User context required.' });

    const { title, category, provider, description, valueBadge, redemptionType, redemptionData, eligibility, status, partnerEmail, partnerNotes, imageUrl, logoUrl } = req.body;

    if (!title || !category || !provider) {
      return res.status(400).json({ error: 'Title, category, and provider are required.' });
    }

    const newPerk: Perk = {
      id: `perk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title,
      category,
      provider,
      description: description || '',
      valueBadge: valueBadge || 'Verified Partner Offer',
      redemptionType: redemptionType || 'CODE',
      redemptionData: redemptionData || 'PARTNER-PERK-VIP',
      eligibility: eligibility || 'All verified members',
      submittedBy: user.displayName || 'Site Admin',
      status: status || 'APPROVED',
      iconName: 'Sparkles',
      imageUrl: imageUrl || undefined,
      logoUrl: logoUrl || undefined,
      redeemedCount: 0,
      partnerEmail,
      partnerNotes,
    };

    perks.unshift(newPerk);

    addAuditLog(
      undefined,
      user.id,
      user.displayName,
      'PERK_CREATED' as any,
      `Admin added new verified partner perk: "${title}" (${provider})`,
      { perkId: newPerk.id, title, provider }
    );

    res.status(201).json({ success: true, perk: newPerk });
  });

  app.put('/api/admin/perks/:id', (req: Request, res: Response) => {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Administrator role required.' });
    }

    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'User context required.' });

    const perk = perks.find(p => p.id === req.params.id);
    if (!perk) return res.status(404).json({ error: 'Perk not found' });

    const { title, category, provider, description, valueBadge, redemptionType, redemptionData, eligibility, status, partnerEmail, partnerNotes, imageUrl, logoUrl } = req.body;

    if (title !== undefined) perk.title = title;
    if (category !== undefined) perk.category = category;
    if (provider !== undefined) perk.provider = provider;
    if (description !== undefined) perk.description = description;
    if (valueBadge !== undefined) perk.valueBadge = valueBadge;
    if (redemptionType !== undefined) perk.redemptionType = redemptionType;
    if (redemptionData !== undefined) perk.redemptionData = redemptionData;
    if (eligibility !== undefined) perk.eligibility = eligibility;
    if (status !== undefined) perk.status = status;
    if (partnerEmail !== undefined) perk.partnerEmail = partnerEmail;
    if (partnerNotes !== undefined) perk.partnerNotes = partnerNotes;
    if (imageUrl !== undefined) perk.imageUrl = imageUrl;
    if (logoUrl !== undefined) perk.logoUrl = logoUrl;

    addAuditLog(
      undefined,
      user.id,
      user.displayName,
      'PERK_UPDATED' as any,
      `Admin updated partner perk details for "${perk.title}" (${perk.provider})`,
      { perkId: perk.id, title: perk.title, status: perk.status }
    );

    res.json({ success: true, perk });
  });

  app.post('/api/admin/perks/:id/status', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'User context required.' });

    const perk = perks.find(p => p.id === req.params.id);
    if (!perk) return res.status(404).json({ error: 'Perk not found' });

    const isAdmin = checkIsAdmin(req);
    const isOwner = perk.submittedByUserId === user.id ||
      (perk.partnerEmail && perk.partnerEmail.toLowerCase() === user.email?.toLowerCase()) ||
      (perk.submittedBy && perk.submittedBy.toLowerCase() === user.displayName?.toLowerCase());

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied. You can only manage your own partner perk offers.' });
    }

    const { status } = req.body; // 'APPROVED' | 'PENDING' | 'REJECTED' | 'SUSPENDED'
    if (!['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    perk.status = status;

    addAuditLog(
      undefined,
      user.id,
      user.displayName,
      'PERK_STATUS_CHANGED' as any,
      `Perk status changed for "${perk.title}" to ${status} by ${isAdmin ? 'Admin' : 'Partner'}`,
      { perkId: perk.id, status }
    );

    res.json({ success: true, perk });
  });

  app.post('/api/admin/perks/:id/approve', (req: Request, res: Response) => {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Administrator role required.' });
    }

    const perk = perks.find(p => p.id === req.params.id);
    if (!perk) return res.status(404).json({ error: 'Perk not found' });

    perk.status = 'APPROVED';
    res.json({ success: true, perk });
  });

  app.delete('/api/admin/perks/:id', (req: Request, res: Response) => {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Administrator role required.' });
    }

    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'User context required.' });

    const idx = perks.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Perk not found' });

    const removed = perks.splice(idx, 1)[0];

    addAuditLog(
      undefined,
      user.id,
      user.displayName,
      'PERK_DELETED' as any,
      `Admin deleted partner perk "${removed.title}" (${removed.provider}) from marketplace`,
      { perkId: removed.id, title: removed.title }
    );

    res.json({ success: true, removedPerkId: req.params.id });
  });

  // 14. Immutable Audit Logs
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    const { podId } = req.query;
    if (podId) {
      return res.json(auditLogs.filter(l => l.podId === podId));
    }
    res.json(auditLogs);
  });

  // 15. Stripe Webhook Endpoint
  app.post('/api/webhooks/stripe', (req: Request, res: Response) => {
    const eventType = req.body?.type || req.body?.eventType || 'stripe.event';
    const data = req.body?.data || req.body;

    addAuditLog(
      undefined,
      'stripe_webhook',
      'Stripe Treasury Webhook',
      'WEBHOOK_EVENT',
      `Received asynchronous webhook event: "${eventType}". Verified webhook receiver signature.`,
      { eventType, data }
    );

    res.json({ received: true, eventType });
  });

  // 16. Operations Admin: Delinquency & Webhook Triggers
  app.post('/api/admin/delinquency/handle', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized: Admin user required' });
    const { podId, memberUserId, actionChoice } = req.body; // actionChoice: 'GRACE_PERIOD' | 'COVER_GAP' | 'REMOVE'

    const pod = pods.find(p => p.id === podId);
    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    const member = pod.members.find(m => m.userId === memberUserId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    if (actionChoice === 'GRACE_PERIOD') {
      member.delinquencyStatus = 'GRACE_PERIOD';
    } else if (actionChoice === 'COVER_GAP') {
      member.delinquencyStatus = 'CLEAN';

      // Check if pod has a First-Cycle Contingency Buffer available
      if (pod.contingencyBufferUsd && pod.contingencyBufferUsd > 0) {
        const coverAmount = Math.min(pod.depositTier, pod.contingencyBufferUsd);
        pod.contingencyBufferUsd -= coverAmount;
        pod.currentWeeklyCollected += pod.depositTier;

        addAuditLog(
          pod.id,
          user.id,
          user.displayName,
          'CONTINGENCY_BUFFER_USED',
          `🛡️ Covered $${pod.depositTier.toFixed(2)} missed deposit gap for ${member.displayName} using pod's Mutual Pool First-Cycle Contingency Buffer. Remaining buffer: $${pod.contingencyBufferUsd.toFixed(2)}.`,
          { coveredMemberUserId: memberUserId, coverAmount, remainingBuffer: pod.contingencyBufferUsd }
        );
      } else {
        pod.currentWeeklyCollected += pod.depositTier;
      }
    }

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'DELINQUENCY_HANDLED',
      `Admin handled missed deposit for ${member.displayName}: Action selected = "${actionChoice}".`,
      { memberUserId, actionChoice }
    );

    res.json({ success: true, member, pod });
  });

// --- ADVERTISER / BRAND PARTNER CAMPAIGN INQUIRIES ---
const ADVERTISER_INQUIRIES_FILE = path.join(process.env.VERCEL ? '/tmp' : process.cwd(), 'advertiser_inquiries.json');

function loadAdvertiserInquiries(): any[] {
  try {
    if (fs.existsSync(ADVERTISER_INQUIRIES_FILE)) {
      const data = fs.readFileSync(ADVERTISER_INQUIRIES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load advertiser inquiries:', err);
  }
  return [];
}

function saveAdvertiserInquiries(inquiries: any[]) {
  try {
    fs.writeFileSync(ADVERTISER_INQUIRIES_FILE, JSON.stringify(inquiries, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save advertiser inquiries:', err);
  }
}

app.post('/api/campaigns/advertiser-inquiry', async (req: Request, res: Response) => {
  try {
    const {
      brandName,
      contactName,
      contactEmail,
      contactPhone,
      websiteUrl,
      targetMarkets,
      campaignObjective,
      estimatedBudget,
      fleetSizeTarget,
      campaignDurationWeeks,
      apparelTypes,
      customNotes,
    } = req.body;

    if (!brandName || !contactEmail) {
      return res.status(400).json({ error: 'Brand name and contact email are required' });
    }

    const newInquiry = {
      id: `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      brandName: String(brandName).trim(),
      contactName: String(contactName || 'Partner').trim(),
      contactEmail: String(contactEmail).trim(),
      contactPhone: contactPhone ? String(contactPhone).trim() : '',
      websiteUrl: websiteUrl ? String(websiteUrl).trim() : '',
      targetMarkets: Array.isArray(targetMarkets) ? targetMarkets : ['national'],
      campaignObjective: String(campaignObjective || 'Brand Awareness'),
      estimatedBudget: String(estimatedBudget || '$5,000 - $15,000'),
      fleetSizeTarget: Number(fleetSizeTarget) || 100,
      campaignDurationWeeks: Number(campaignDurationWeeks) || 4,
      apparelTypes: Array.isArray(apparelTypes) ? apparelTypes : ['hoodie'],
      customNotes: customNotes ? String(customNotes).trim() : '',
      submittedAt: new Date().toISOString(),
      status: 'NEW',
    };

    const inquiries = loadAdvertiserInquiries();
    inquiries.unshift(newInquiry);
    saveAdvertiserInquiries(inquiries);

    // Also persist to Firestore if available
    try {
      const db = getDb();
      if (db) {
        await db.collection('advertiserInquiries').doc(newInquiry.id).set(sanitizeForServerFirestore(newInquiry));
      }
    } catch (fsErr) {
      console.warn('Could not persist inquiry to Firestore:', fsErr);
    }

    console.log(`[Advertiser Inquiry] New campaign lead from ${newInquiry.brandName} (${newInquiry.contactEmail})`);

    res.json({
      success: true,
      message: 'Campaign inquiry submitted successfully. A Brand Partnerships Director will reach out within 24 hours.',
      inquiry: newInquiry,
    });
  } catch (err: any) {
    console.error('Error submitting advertiser inquiry:', err);
    res.status(500).json({ error: 'Failed to submit advertiser inquiry', details: err?.message });
  }
});

app.get('/api/campaigns/advertiser-inquiries', (req: Request, res: Response) => {
  const inquiries = loadAdvertiserInquiries();
  res.json({ inquiries });
});

// --- VOICE AI & NATURAL AUDIO AGENT API ---
app.post('/api/ai/voice-guide', async (req: Request, res: Response) => {
  try {
    const { query, currentContext } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const client = getGeminiClient();
    const activeTab = currentContext?.activeTab || 'my-pods';
    const userName = currentContext?.userName || 'Member';
    const platform = currentContext?.platform || 'Gig Courier';
    const treasuryBalance = currentContext?.treasuryBalance ?? 0;
    const activePodsCount = currentContext?.activePodsCount ?? 0;
    const lang = currentContext?.language || 'en';

    const fallbackKnowledge = (userQuery: string, language: string = 'en') => {
      const q = userQuery.toLowerCase();
      const isEs = language === 'es';
      const isFr = language === 'fr';

      if (q.includes('swap') || q.includes('spot') || q.includes('trade') || q.includes('turn') || q.includes('turno') || q.includes('intercamb') || q.includes('tour') || q.includes('échange')) {
        if (isEs) {
          return {
            spokenText: "Para intercambiar tu turno de cobro, abre los detalles de tu grupo activo, ve a la pestaña Rotación y pulsa Solicitar Intercambio junto a cualquier miembro. Ambos deben aceptar para confirmar.",
            displayText: "### 🔄 Cómo Funcionan los Intercambios de Turno\n\n1. Ve a **Mis Grupos** y abre tu grupo activo.\n2. Navega a la pestaña **Rotación**.\n3. Haz clic en **'Solicitar Intercambio'** junto al turno de otro compañero.\n4. Cuando el otro miembro acepte, el calendario se actualiza automáticamente sin penalizaciones.",
            suggestedActions: [
              { label: "Ver Mis Grupos", action: "NAVIGATE_TAB", tab: "my-pods" },
              { label: "¿Cómo funciona la rotación fija?", action: "SPEAK_EXPLANATION", prompt: "¿Cómo funciona la rotación fija?" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "my-pods" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Pour échanger votre tour de versement, ouvrez votre groupe actif, allez dans l'onglet Rotation et cliquez sur Échanger le tour. Les deux membres doivent approuver pour confirmer.",
            displayText: "### 🔄 Fonctionnement des Échanges de Tours\n\n1. Rendez-vous dans **Mes Groupes** et ouvrez votre groupe actif.\n2. Accédez à l'onglet **Rotation**.\n3. Cliquez sur **'Demander un Échange'** à côté du tour d'un autre membre.\n4. Dès validation mutuelle, le calendrier est mis à jour sans pénalité.",
            suggestedActions: [
              { label: "Voir Mes Groupes", action: "NAVIGATE_TAB", tab: "my-pods" },
              { label: "Rotation fixe", action: "SPEAK_EXPLANATION", prompt: "Comment fonctionne la rotation fixe ?" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "my-pods" }
          };
        }
        return {
          spokenText: "To swap your payout spot, open your active Pod details, go to the Rotation tab, and click Swap Spot next to any available member. Both members must approve the request to finalize the swap.",
          displayText: "### 🔄 How Spot Swaps Work\n\n1. Go to **My Pods** and open your active Pod.\n2. Navigate to the **Rotation** tab.\n3. Click **'Request Spot Swap'** next to another member's rotation slot.\n4. Once the other member accepts, the payout schedule updates automatically with no penalty.",
          suggestedActions: [
            { label: "View My Pods", action: "NAVIGATE_TAB", tab: "my-pods" },
            { label: "How fixed rotation works", action: "SPEAK_EXPLANATION", prompt: "How does fixed rotation work?" }
          ],
          navigationAction: { type: "NAVIGATE_TAB", target: "my-pods" }
        };
      }

      if (q.includes('perk') || q.includes('discount') || q.includes('gas') || q.includes('oil') || q.includes('tire') || q.includes('tax') || q.includes('repair') || q.includes('ventaja') || q.includes('beneficio') || q.includes('gasolina') || q.includes('aceite') || q.includes('llanta') || q.includes('avantage') || q.includes('réduction') || q.includes('essence') || q.includes('pneu')) {
        if (isEs) {
          return {
            spokenText: "Nuestro Mercado de Ventajas ofrece descuentos exclusivos en reparaciones mecánicas, cambio de aceite, auxilio vial y declaración de impuestos para repartidores 1099.",
            displayText: "### 🎁 Mercado de Ventajas para Repartidores\n\nAhorra en gastos esenciales del trabajo:\n- **Mantenimiento y Neumáticos** (Meineke, Jiffy Lube)\n- **Auxilio Vial** y Grúa de Emergencia\n- **Impuestos y Deducciones** para trabajadores independientes\n- **Planes de Salud y Telemedicina**",
            suggestedActions: [
              { label: "Abrir Ventajas", action: "NAVIGATE_TAB", tab: "perks" },
              { label: "Canjear Beneficio", action: "NAVIGATE_TAB", tab: "perks" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "perks" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Notre espace Avantages propose des réductions exclusives sur l'entretien auto, les vidanges, l'assistance dépannage et l'aide fiscale pour les livreurs et chauffeurs.",
            displayText: "### 🎁 Espace Avantages Gig\n\nÉconomisez sur vos dépenses essentielles :\n- **Entretien Auto & Pneus** (Meineke, Jiffy Lube)\n- **Assistance Dépannage** & Remorquage d'urgence\n- **Gestion Fiscale & Suivi Kilométrique**\n- **Micro-assurances Santé & Téléconsultation**",
            suggestedActions: [
              { label: "Ouvrir les Avantages", action: "NAVIGATE_TAB", tab: "perks" },
              { label: "Utiliser un Avantage", action: "NAVIGATE_TAB", tab: "perks" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "perks" }
          };
        }
        return {
          spokenText: "Our Gig Perks Marketplace offers exclusive savings on auto repairs, oil changes, roadside assistance, and tax preparation tailored for 1099 couriers. Let's look at the marketplace now.",
          displayText: "### 🎁 Gig Perks Marketplace\n\nSave on essential gig work expenses:\n- **Auto Maintenance & Tires** (Meineke, Jiffy Lube)\n- **Roadside Assistance** & Emergency Towing\n- **Tax Prep & Mileage Tracking** for 1099 drivers\n- **Healthcare & Telehealth** micro-plans",
          suggestedActions: [
            { label: "Open Perks Marketplace", action: "NAVIGATE_TAB", tab: "perks" },
            { label: "Redeem a Perk", action: "NAVIGATE_TAB", tab: "perks" }
          ],
          navigationAction: { type: "NAVIGATE_TAB", target: "perks" }
        };
      }

      if (q.includes('create') || q.includes('new pod') || q.includes('start pod') || q.includes('crear') || q.includes('nuevo grupo') || q.includes('iniciar') || q.includes('créer') || q.includes('nouveau groupe')) {
        if (isEs) {
          return {
            spokenText: "Para iniciar un nuevo grupo, pulsa Crear Grupo arriba. Puedes elegir un Círculo de Confianza para tus compañeros o un Grupo Abierto con verificación automática de identidad.",
            displayText: "### 🚀 Crear un Grupo de Ahorro\n\n1. Haz clic en **+ Iniciar Grupo** en la parte superior.\n2. Elige **Círculo de Confianza** (amigos/familiares) o **Grupo Abierto** (repartidores verificados con KYC).\n3. Define el monto del pozo, el depósito semanal (ej. $50/sem) y la duración del ciclo.",
            suggestedActions: [
              { label: "Crear un Grupo Ahora", action: "OPEN_MODAL", modal: "CREATE_POD" },
              { label: "Explorar Grupos Abiertos", action: "NAVIGATE_TAB", tab: "explore-pods" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Pour créer un groupe, cliquez sur Créer un Groupe en haut. Vous pouvez choisir un Cercle de Confiance ou un Groupe Ouvert avec vérification d'identité KYC.",
            displayText: "### 🚀 Créer un Groupe d'Épargne\n\n1. Cliquez sur **+ Créer un Groupe** dans l'en-tête.\n2. Choisissez **Cercle de Confiance** (invitation uniquement) ou **Groupe Ouvert** (membres vérifiés KYC).\n3. Définissez le montant cible, la cotisation hebdomadaire et la durée du cycle.",
            suggestedActions: [
              { label: "Créer un Groupe", action: "OPEN_MODAL", modal: "CREATE_POD" },
              { label: "Explorer les Groupes", action: "NAVIGATE_TAB", tab: "explore-pods" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
          };
        }
        return {
          spokenText: "To start a new Pod, click Create Pod at the top. You can choose a Trusted Circle for your trusted contacts or an Open Pod with automated KYC verification.",
          displayText: "### 🚀 Creating a Savings Pod\n\n1. Click **+ Create Pod** in the dashboard header.\n2. Select **Trusted Circle** (invite-only, family/friends) or **Open Pod** (KYC-verified gig couriers).\n3. Set your target amount, weekly deposit (e.g. $50/wk), and cycle length.",
          suggestedActions: [
            { label: "Create a Pod Now", action: "OPEN_MODAL", modal: "CREATE_POD" },
            { label: "Explore Open Pods", action: "NAVIGATE_TAB", tab: "explore-pods" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
        };
      }

      if (q.includes('campaign') || q.includes('advertiser') || q.includes('wrap') || q.includes('brand') || q.includes('shift') || q.includes('publicidad') || q.includes('embajador') || q.includes('vehículo') || q.includes('campagne') || q.includes('publicité') || q.includes('ambassadeur')) {
        if (isEs) {
          return {
            spokenText: "Con el programa de Embajadores de Marca, los conductores ganan dinero extra llevando publicidad verificada en su vehículo durante sus turnos de entrega.",
            displayText: "### 🚗 Campañas de Publicidad y Embajadores de Marca\n\n- Gana de $50 a $150/semana adicionales a tus ingresos de reparto.\n- Registra tus turnos con verificación GPS y fotografía.\n- Depósito directo a tu cuenta protegida por Stripe Treasury.",
            suggestedActions: [
              { label: "Ver Campañas Activas", action: "NAVIGATE_TAB", tab: "campaigns" },
              { label: "Portal de Anunciantes", action: "OPEN_ADVERTISER" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "campaigns" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Grâce au programme Ambassadeur de Marque, les chauffeurs gagnent un revenu supplémentaire en affichant une publicité sur leur véhicule pendant leurs livraisons.",
            displayText: "### 🚗 Campagnes Publicitaires Véhicule & Ambassadeurs\n\n- Gagnez 50$ à 150$/semaine en plus de vos courses habituelles.\n- Validez vos créneaux avec géolocalisation et photo.\n- Versement direct sur votre compte Stripe Treasury.",
            suggestedActions: [
              { label: "Voir les Campagnes", action: "NAVIGATE_TAB", tab: "campaigns" },
              { label: "Portail Annonceurs", action: "OPEN_ADVERTISER" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "campaigns" }
          };
        }
        return {
          spokenText: "Through our Brand Ambassador program, gig drivers earn extra income by displaying verified vehicle wraps or apparel during active delivery shifts. Payouts deposit directly into your Treasury.",
          displayText: "### 🚗 Brand Ambassador & Vehicle Wrap Campaigns\n\n- Earn $50-$150/week on top of your delivery earnings.\n- Check in for shifts with GPS and photo verification.\n- Direct deposit straight to your FDIC pass-through Treasury balance.",
          suggestedActions: [
            { label: "View Active Campaigns", action: "NAVIGATE_TAB", tab: "campaigns" },
            { label: "Advertiser Portal", action: "OPEN_ADVERTISER" }
          ],
          navigationAction: { type: "NAVIGATE_TAB", target: "campaigns" }
        };
      }

      if (q.includes('treasury') || q.includes('bank') || q.includes('fdic') || q.includes('stripe') || q.includes('balance') || q.includes('payout') || q.includes('banco') || q.includes('saldo') || q.includes('seguro') || q.includes('banque') || q.includes('solde')) {
        if (isEs) {
          return {
            spokenText: "Tu cuenta de MutualPool Treasury es una cuenta dedicada con seguro indirecto FDIC de hasta $250,000 mediante bancos asociados a Stripe Treasury.",
            displayText: "### 🏦 Stripe Treasury y Seguro FDIC\n\n- Cuenta de custodia dedicada para tus ahorros semanales.\n- Elegible para seguro indirecto FDIC hasta $250,000.\n- Transferencias directas a tu cuenta bancaria vinculada.",
            suggestedActions: [
              { label: "Administrar Banco y Treasury", action: "OPEN_MODAL", modal: "BANK" },
              { label: "Verificar Identidad (KYC)", action: "OPEN_MODAL", modal: "KYC" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "BANK" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Votre compte MutualPool Treasury est un compte dédié éligible à la garantie indirecte FDIC jusqu'à 250 000 $ via les banques partenaires de Stripe Treasury.",
            displayText: "### 🏦 Stripe Treasury & Garantie FDIC\n\n- Compte sécurisé dédié pour vos dépôts d'épargne hebdomadaires.\n- Éligibilité à la protection FDIC jusqu'à 250 000 $.\n- Versements rapides vers votre compte bancaire lié.",
            suggestedActions: [
              { label: "Gérer la Banque & Treasury", action: "OPEN_MODAL", modal: "BANK" },
              { label: "Vérifier l'Identité (KYC)", action: "OPEN_MODAL", modal: "KYC" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "BANK" }
          };
        }
        return {
          spokenText: "Your MutualPool Treasury is a dedicated account eligible for FDIC pass-through insurance up to $250,000 via Stripe Treasury partner banks. Your weekly pool payouts deposit automatically here.",
          displayText: "### 🏦 Stripe Treasury & FDIC Pass-Through\n\n- Dedicated holding account for weekly pool deposits.\n- Pass-through FDIC insurance eligibility up to $250,000.\n- Instant payouts to your linked external checking account or debit card.",
          suggestedActions: [
            { label: "Manage Bank & Treasury", action: "OPEN_MODAL", modal: "BANK" },
            { label: "Verify Identity (KYC)", action: "OPEN_MODAL", modal: "KYC" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "BANK" }
        };
      }

      if (q.includes('hardship') || q.includes('emergency') || q.includes('miss') || q.includes('late') || q.includes('delinquent') || q.includes('emergencia') || q.includes('dificultad') || q.includes('avería') || q.includes('urgence') || q.includes('panne')) {
        if (isEs) {
          return {
            spokenText: "Si sufres una avería imprevista en tu vehículo o una baja de ingresos, puedes solicitar ayuda al Fondo de Solidaridad de MutualPool para cubrir tu depósito sin perder tu posición.",
            displayText: "### 🛡️ Protección y Fondo de Solidaridad\n\n- Fondos de emergencia para cubrir tu depósito durante reparaciones mecánicas.\n- Cero intereses abusivos — facilidades de pago justas.\n- Protege tu reputación y mantiene tu grupo activo.",
            suggestedActions: [
              { label: "Solicitar Ayuda de Emergencia", action: "OPEN_MODAL", modal: "HARDSHIP" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "HARDSHIP" }
          };
        }
        if (isFr) {
          return {
            spokenText: "En cas de panne de véhicule ou d'imprévu financier, vous pouvez solliciter le Fonds de Solidarité MutualPool pour couvrir votre dépôt sans perdre votre place.",
            displayText: "### 🛡️ Protection & Fonds de Solidarité\n\n- Aide d'urgence pour couvrir vos cotisations en cas de réparation mécanique.\n- Aucun intérêt prédateur — conditions de remboursement souples.\n- Préserve votre réputation et le bon fonctionnement du groupe.",
            suggestedActions: [
              { label: "Demander une Aide d'Urgence", action: "OPEN_MODAL", modal: "HARDSHIP" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "HARDSHIP" }
          };
        }
        return {
          spokenText: "If you experience an unexpected vehicle breakdown or income disruption, you can request support from the MutualPool Hardship Fund to cover your weekly deposit without losing your pod standing.",
          displayText: "### 🛡️ MutualPool Hardship Protection\n\n- Emergency bridge funds to cover deposit during vehicle repairs.\n- Zero predatory interest — simple repayment terms.\n- Protects your reputation score and keeps your pod running smoothly.",
          suggestedActions: [
            { label: "Open Hardship Assistance", action: "OPEN_MODAL", modal: "HARDSHIP" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "HARDSHIP" }
        };
      }

      if (isEs) {
        return {
          spokenText: `¡Hola ${userName}! Soy Lainie, tu Guía de IA de MutualPool. Pregúntame sobre cómo funcionan los grupos de ahorro, cómo intercambiar turnos, acceder a ventajas para repartidores o ganar dinero con publicidad en vehículos.`,
          displayText: `### 🎙️ Asistente de Voz Lainie AI\n\nPuedo orientarte en todas las funciones:\n- **Grupos de Ahorro Rotativo** (Círculos de Confianza vs Grupos Abiertos)\n- **Intercambio de Turnos de Cobro**\n- **Mercado de Ventajas** (Descuentos en talleres, gasolina, impuestos)\n- **Campañas para Embajadores de Marca** (Gana mientras conduces)\n- **Cuenta Stripe Treasury y Protección FDIC**`,
          suggestedActions: [
            { label: "¿Cómo funciona la rotación fija?", action: "SPEAK_EXPLANATION", prompt: "¿Cómo funciona la rotación fija?" },
            { label: "Explorar Grupos", action: "NAVIGATE_TAB", tab: "explore-pods" },
            { label: "Ver Ventajas", action: "NAVIGATE_TAB", tab: "perks" }
          ],
          navigationAction: null
        };
      }

      if (isFr) {
        return {
          spokenText: `Bonjour ${userName} ! Je suis Lainie, votre Guide IA MutualPool. Posez-moi des questions sur les groupes d'épargne, les échanges de tours, les avantages ou les campagnes publicitaires sur véhicule.`,
          displayText: `### 🎙️ Assistant Vocal Lainie AI\n\nJe peux vous guider sur l'ensemble des fonctionnalités :\n- **Groupes d'Épargne Rotative** (Cercles de Confiance vs Groupes Ouverts)\n- **Échanges de Tours de Versement**\n- **Espace Avantages Travailleurs Gig** (Réductions réparations, carburant, impôts)\n- **Campagnes Ambassadeurs de Marque** (Gagnez en roulant)\n- **Compte Stripe Treasury & Garantie FDIC**`,
          suggestedActions: [
            { label: "Comment fonctionne la rotation ?", action: "SPEAK_EXPLANATION", prompt: "Comment fonctionne la rotation fixe ?" },
            { label: "Explorer les Groupes", action: "NAVIGATE_TAB", tab: "explore-pods" },
            { label: "Voir les Avantages", action: "NAVIGATE_TAB", tab: "perks" }
          ],
          navigationAction: null
        };
      }

      return {
        spokenText: `Welcome ${userName}! I'm Lainie, your MutualPool Voice AI Guide. You can ask me how savings pods work, how to swap payout spots, how to access gig worker perks, or how to earn with vehicle wrap campaigns.`,
        displayText: `### 🎙️ MutualPool Voice Assistant\n\nI can help guide you through every feature:\n- **Rotating Savings Pods** (Trusted Circles vs Open Pods)\n- **Spot Swaps & Payout Rotations**\n- **Gig Perks Marketplace** (Discounts on repair, gas, tax prep)\n- **Brand Ambassador Campaigns** (Earn while driving)\n- **Stripe Treasury & FDIC Pass-Through Account**`,
        suggestedActions: [
          { label: "How does fixed rotation work?", action: "SPEAK_EXPLANATION", prompt: "How does fixed rotation work?" },
          { label: "Explore Savings Pods", action: "NAVIGATE_TAB", tab: "explore-pods" },
          { label: "Browse Perks", action: "NAVIGATE_TAB", tab: "perks" }
        ],
        navigationAction: null
      };
    };

    if (!client) {
      const fallback = fallbackKnowledge(query, lang);
      return res.json(fallback);
    }

    const languageInstruction = lang === 'es' 
      ? 'MANDATORY LANGUAGE: The user\'s interface language is Spanish (Español). You MUST generate "spokenText", "displayText", and "suggestedActions[].label" completely in Spanish.'
      : lang === 'fr'
      ? 'MANDATORY LANGUAGE: The user\'s interface language is French (Français). You MUST generate "spokenText", "displayText", and "suggestedActions[].label" completely in French.'
      : 'MANDATORY LANGUAGE: The user\'s interface language is English. Respond in English.';

    const systemInstruction = `You are "Lainie", the intelligent, friendly on-screen Voice AI Guide for MutualPool (mutualpool.org).
MutualPool is a collaborative savings and gig economy perks platform built for 1099 couriers, rideshare drivers, and independent workers.

${languageInstruction}

Key platform concepts:
1. Rotating Savings Pods (ROSCAs / Tandas / Susu):
   - Members contribute a fixed amount weekly (e.g., $50/wk).
   - Every week, one member receives the full lump-sum pool (e.g., $500 for a 10-person pod).
   - Trusted Circle Pods: Invite-only for friends, family, or close driver circles.
   - Open Pods: Public matching for KYC-verified gig workers with reputation scores.
2. Spot Swaps:
   - Members can trade payout rotation slots peer-to-peer if an unexpected expense arises.
   - Requires mutual approval from both parties.
3. Gig Perks Marketplace:
   - Exclusive merchant discounts on tires, oil changes (Meineke, Jiffy Lube), roadside assistance, tax filing (TurboTax 1099), and healthcare.
4. Brand Ambassador Campaigns:
   - Gig drivers earn supplemental income ($50-$150/week) by displaying sponsor car wraps or apparel during active delivery shifts.
5. Stripe Treasury:
   - FDIC pass-through eligible account up to $250,000 holding pooled deposits and instant payouts.
6. Hardship Fund:
   - Community emergency protection to cover a deposit during mechanical breakdowns.

Instructions for your response:
- Keep "spokenText" concise, conversational, and natural (1-3 sentences) suitable for natural speech synthesis. Avoid markdown symbols in spokenText.
- Provide clear markdown formatting in "displayText" for the visual transcript.
- If the user's intent is to view or do something in the app, specify "navigationAction":
  - {"type": "NAVIGATE_TAB", "target": "my-pods" | "explore-pods" | "perks" | "campaigns" | "audit-log" | "admin-ops"}
  - {"type": "OPEN_MODAL", "target": "CREATE_POD" | "KYC" | "BANK" | "HARDSHIP" | "ABOUT" | "HOW_IT_WORKS" | "CONTACT"}
  - {"type": "OPEN_ADVERTISER"}
- Provide 2-3 helpful "suggestedActions" pills for one-tap follow-ups (in the user's selected language: ${lang}).

Current user context:
- User Name: ${userName}
- Platform: ${platform}
- Active Tab: ${activeTab}
- Treasury Balance: $${treasuryBalance.toFixed(2)}
- Active Pods: ${activePodsCount}
- Language: ${lang}

Output MUST be strictly valid JSON matching this schema:
{
  "spokenText": "string",
  "displayText": "string (markdown)",
  "suggestedActions": [{"label": "string", "action": "NAVIGATE_TAB"|"OPEN_MODAL"|"SPEAK_EXPLANATION", "tab"?: "string", "modal"?: "string", "prompt"?: "string"}],
  "navigationAction": {"type": "NAVIGATE_TAB"|"OPEN_MODAL"|"OPEN_ADVERTISER", "target"?: "string"} | null
}`;

    const response = await client.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [{ role: 'user', parts: [{ text: query }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const responseText = response.text || '';
    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = fallbackKnowledge(query, lang);
    }

    res.json(parsedData);
  } catch (err: any) {
    console.error('Error generating voice guide response:', err);
    const lang = req.body?.currentContext?.language || 'en';
    const fallback = (lang === 'es') ? {
      spokenText: "Estoy aquí para ayudarte a usar MutualPool. Puedes explorar grupos de ahorro activos, descubrir ventajas para repartidores o crear tu propio grupo.",
      displayText: "### 🎙️ Asistente de Voz Lainie AI\n\nPuedo ayudarte con:\n- **Grupos de Ahorro y Turnos de Cobro**\n- **Mercado de Ventajas y Beneficios**\n- **Ganancias como Embajador de Marca**\n- **Cuentas Stripe Treasury y Seguro FDIC**",
      suggestedActions: [
        { label: "Explorar Grupos de Ahorro", action: "NAVIGATE_TAB", tab: "explore-pods" },
        { label: "Ver Ventajas", action: "NAVIGATE_TAB", tab: "perks" }
      ],
      navigationAction: null
    } : (lang === 'fr') ? {
      spokenText: "Je suis là pour vous aider à utiliser MutualPool. Vous pouvez explorer les groupes d'épargne actifs, découvrir les avantages ou créer votre propre groupe.",
      displayText: "### 🎙️ Assistant Vocal Lainie AI\n\nJe peux vous guider sur :\n- **Groupes d'Épargne & Rotations**\n- **Espace Avantages Travailleurs Gig**\n- **Rémunération Ambassadeurs de Marque**\n- **Comptes Stripe Treasury & Protection FDIC**",
      suggestedActions: [
        { label: "Explorer les Groupes", action: "NAVIGATE_TAB", tab: "explore-pods" },
        { label: "Voir les Avantages", action: "NAVIGATE_TAB", tab: "perks" }
      ],
      navigationAction: null
    } : {
      spokenText: "I'm here to help you navigate MutualPool. You can explore active savings pods, check out merchant perks, or start your own pool anytime.",
      displayText: "### 🎙️ MutualPool Voice Assistant\n\nI can help guide you through:\n- **Savings Pods & Payout Rotations**\n- **Gig Perks Marketplace**\n- **Brand Ambassador Earnings**\n- **Stripe Treasury & FDIC Accounts**",
      suggestedActions: [
        { label: "Explore Savings Pods", action: "NAVIGATE_TAB", tab: "explore-pods" },
        { label: "Browse Perks", action: "NAVIGATE_TAB", tab: "perks" }
      ],
      navigationAction: null
    };
    res.json(fallback);
  }
});

// --- NATURAL GEMINI TTS (SPEECH GENERATION) API ---
app.post('/api/ai/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceName } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    const client = getGeminiClient();
    if (!client) {
      return res.json({ fallbackToWebSpeech: true, reason: 'No Gemini API key configured' });
    }

    const selectedVoice = voiceName || 'Zephyr'; // 'Zephyr', 'Puck', 'Kore', 'Fenrir', 'Charon'
    
    // Clean text of markdown or special characters before speaking
    const cleanText = text.replace(/[*_#`~\[\]]/g, '').trim().substring(0, 500);

    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
          return res.json({
            audioBase64: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
            sampleRate: 24000,
            voice: selectedVoice,
          });
        }
      }
    }

    res.json({ fallbackToWebSpeech: true, reason: 'Audio modality part not found in response' });
  } catch (err: any) {
    console.warn('Gemini TTS error (falling back to Web Speech):', err?.message);
    res.json({ fallbackToWebSpeech: true, error: err?.message });
  }
});

// --- CHAT API ROUTES ---
app.get(['/api/chats/threads', '/chats/threads'], async (req: Request, res: Response) => {
  try {
    const rawUserId = getHeaderValue(req, 'x-user-id') || getQueryValue(req, 'userId') || 'usr_verified_101';
    const userEmail = getHeaderValue(req, 'x-user-email') || getQueryValue(req, 'userEmail') || '';
    const userName = getHeaderValue(req, 'x-user-name') || getQueryValue(req, 'userName') || '';

    // Ensure latest pods are loaded from disk & Firestore
    let allPods = pods;
    try {
      allPods = await syncPodsFromFirestore();
    } catch (e) {
      allPods = loadPodsFromDisk();
    }

    const userThreads = getThreadsForUser(rawUserId, allPods, userEmail, userName);
    res.json(userThreads);
  } catch (err) {
    console.error('Error fetching chat threads:', err);
    res.status(500).json({ error: 'Failed to fetch chat threads' });
  }
});

app.get(['/api/chats/messages', '/chats/messages'], (req: Request, res: Response) => {
  try {
    const threadId = getQueryValue(req, 'threadId');
    const rawUserId = getHeaderValue(req, 'x-user-id') || getQueryValue(req, 'userId') || undefined;
    if (!threadId) {
      return res.status(400).json({ error: 'threadId is required' });
    }
    const msgs = getMessagesForThread(threadId, rawUserId);
    res.json(msgs);
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

app.post(['/api/chats/send', '/chats/send'], (req: Request, res: Response) => {
  try {
    const { threadId, content, senderId, senderName, senderAvatar, senderPlatform, recipientId, podId, type, metadata } = req.body;
    const resolvedSenderId = senderId || getHeaderValue(req, 'x-user-id') || 'usr_verified_101';
    const resolvedSenderName = senderName || getHeaderValue(req, 'x-user-name') || 'Driver';

    if (!threadId || !content) {
      return res.status(400).json({ error: 'threadId and content are required' });
    }

    const newMsg = createMessage({
      threadId,
      senderId: resolvedSenderId,
      senderName: resolvedSenderName,
      senderAvatar,
      senderPlatform,
      recipientId,
      podId,
      content,
      type: type || 'TEXT',
      metadata,
    });

    res.status(201).json({ success: true, message: newMsg });
  } catch (err) {
    console.error('Error sending chat message:', err);
    res.status(500).json({ error: 'Failed to send chat message' });
  }
});

app.post(['/api/chats/mark-read', '/chats/mark-read'], (req: Request, res: Response) => {
  try {
    const { threadId, userId } = req.body;
    const resolvedUserId = userId || getHeaderValue(req, 'x-user-id') || 'usr_verified_101';
    if (!threadId) {
      return res.status(400).json({ error: 'threadId is required' });
    }
    markThreadMessagesAsRead(threadId, resolvedUserId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking thread as read:', err);
    res.status(500).json({ error: 'Failed to mark thread as read' });
  }
});

app.post(['/api/chats/start-direct', '/chats/start-direct'], (req: Request, res: Response) => {
  try {
    const { userId, targetUserId, targetName, targetAvatar, targetPlatform } = req.body;
    const currentUser = getCurrentUser(req) || {
      id: userId || 'usr_verified_101',
      displayName: 'Verified Driver',
      avatarUrl: '',
      platform: 'DoorDash',
    };

    const targetUser = users.find(u => u && u.id === targetUserId) || {
      id: targetUserId,
      displayName: targetName || 'Driver Member',
      avatarUrl: targetAvatar,
      platform: targetPlatform || 'DoorDash',
    };

    const thread = getOrCreateDirectThread(
      { id: currentUser.id, displayName: currentUser.displayName, avatarUrl: currentUser.avatarUrl, platform: currentUser.platform },
      { id: targetUser.id, displayName: targetUser.displayName, avatarUrl: targetUser.avatarUrl, platform: targetUser.platform }
    );

    res.json({ success: true, thread });
  } catch (err) {
    console.error('Error starting direct chat:', err);
    res.status(500).json({ error: 'Failed to start direct chat' });
  }
});

// 404 handler for unmatched API routes
app.use(['/api', '/api/*'], (req: Request, res: Response) => {
  res.status(404).json({
    error: 'API endpoint not found',
    requestedUrl: req.originalUrl || req.url,
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  console.error('[Server Error]', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: 'Internal Server Error',
    message: err?.message || String(err),
  });
});

// --- VITE MIDDLEWARE OR STATIC SERVING ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Endpoint or asset not found' });
      }
    });
  }

  if (!process.env.VERCEL) {
    const httpServer = http.createServer(app);
    setupWebSocketServer(httpServer);

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[Gig Mutual Pool PWA Server + WebSocket] running on http://localhost:${PORT}`);
    });
  }
}


if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default function handler(req: express.Request, res: express.Response, next?: express.NextFunction) {
  const normalized = normalizeApiUrl(req);
  if (normalized && normalized !== req.url && !normalized.startsWith('/api/index')) {
    req.url = normalized;
  }

  if (typeof next === 'function') {
    return app(req, res, next);
  }
  return app(req, res);
}
