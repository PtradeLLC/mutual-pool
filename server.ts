import 'dotenv/config';
process.noDeprecation = true;
// An uncaught exception leaves in-memory state undefined: persist what we can and
// let the platform restart the instance.
process.on('uncaughtException', (err) => {
  console.error('[Process UncaughtException]', err);
  flushNow().finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process UnhandledRejection]', reason);
});
import express from 'express';
type Request = express.Request;
type Response = express.Response;
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { 
  User, Pod, PodMembership, Perk, PerkStatus, AuditLogEntry, 
  ReprioritizationRequest, Deposit, WeeklyCycle, Redemption, InvitedContact,
  HardshipFundRequest, AppNotification, NotificationType, SwapRequest,
  PlatformScheduleStatus, SweepExecutionResult, PaymentHistoryItem
} from './src/types';
import {
  getNextThursdayMidnight,
  getNextFridayMidnight,
  getPlatformScheduleStatus,
  PLATFORM_SCHEDULE_CONFIG
} from './src/utils/platformSchedule';
import { 
  INITIAL_USERS, INITIAL_PODS, INITIAL_PERKS, INITIAL_AUDIT_LOGS 
} from './src/data/initialData';
import { getAuthAdmin } from './src/config/firebase';
import { IS_PRODUCTION, DEMO_MODE, DATA_DIR, assertProductionConfig, getAllowedOrigins, parseMoneyAmount } from './src/server/runtime';
import { createStorageAdapter, storageConfigProblems } from './src/server/storage';
import { assessHardshipRisk } from './src/server/hardshipRisk';
import { isTraditionId } from './src/data/roscaTraditions';
import { TREASURY_PROGRAM_ENABLED, sanitizeVoiceGuidePayload } from './src/lib/treasuryClaims';
import { registerCollection, hydrateFromStorage, isPersistenceEnabled, requestFlush, flushNow, persistNow, startAutoFlush, getPersistenceHealth, onBeforeShutdown } from './src/server/persistence';
import { apiRateLimiter, authRateLimiter, aiRateLimiter, publicFormRateLimiter, moneyRateLimiter, countryContextMiddleware, validateCountryCurrency } from './src/middleware';
import { SUPPORTED_COUNTRIES, US_CONFIG } from './src/config/countries';
import { PaymentProviderFactory } from './src/services/payments/factory';
import {
  getStripe,
  createDepositPaymentIntent,
  createConnectOnboardingLink,
  createConnectAccount,
  createDepositCheckoutSession,
  transferToConnectedAccount,
} from './src/services/stripe';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import Groq from 'groq-sdk';
import {
  setupWebSocketServer,
  configureChatManager,
  getThreadsForUser,
  getMessagesForThread,
  createMessage,
  markThreadMessagesAsRead,
  getOrCreateDirectThread,
  isThreadParticipant,
  ensureThreadForUser,
  getChatThreads,
  setChatThreads,
  getChatMessages,
  setChatMessages,
} from './src/server/chatManager';
import { FOURTHWALL_GEAR_CATALOG, INITIAL_GEAR_DESIGNS, dispatchOrderToFourthwall } from './src/services/fourthwall';
import { GearDesignOrder } from './src/types';

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

let groqClient: Groq | null = null;
function getGroqClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groqClient) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return groqClient;
}

const PORT = Number(process.env.PORT) || 3000;

const PODS_FILE = path.join(DATA_DIR, 'pods_data.json');
const USERS_FILE = path.join(DATA_DIR, 'users_data.json');

function safeWriteFile(filePath: string, data: string): void {
  // Production state lives in the storage backend (src/server/persistence.ts); JSON files are a dev convenience.
  if (IS_PRODUCTION) return;
  try {
    // Skip no-op writes: they churn the disk and trigger file watchers for nothing.
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === data) return;
    fs.writeFileSync(filePath, data, 'utf8');
  } catch {
    try {
      const tmpPath = path.join('/tmp', path.basename(filePath));
      fs.writeFileSync(tmpPath, data, 'utf8');
    } catch {
      // Quietly ignore in read-only serverless
    }
  }
}

function safeReadFile(filePath: string): string | null {
  if (IS_PRODUCTION) return null;
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch {}
  try {
    const tmpPath = path.join('/tmp', path.basename(filePath));
    if (fs.existsSync(tmpPath)) {
      return fs.readFileSync(tmpPath, 'utf8');
    }
  } catch {}
  return null;
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
    const raw = safeReadFile(PODS_FILE);
    if (raw) {
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
  if (isPersistenceEnabled()) {
    requestFlush();
    return;
  }
  try {
    safeWriteFile(PODS_FILE, JSON.stringify(pods.filter(p => p && p.id), null, 2));
  } catch (err) {
    console.error('Error saving pods_data.json:', err);
  }
}

// Storage is read once at boot (hydrateFromStorage); memory is the source of truth.
async function syncPodsFromFirestore(): Promise<Pod[]> {
  return pods;
}

function loadUsersFromDisk(): User[] {
  if (IS_PRODUCTION) return [];
  try {
    const raw = safeReadFile(USERS_FILE);
    if (raw) {
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
  if (isPersistenceEnabled()) {
    requestFlush();
    return;
  }
  try {
    safeWriteFile(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users_data.json:', err);
  }
}

// State Store
let users: User[] = loadUsersFromDisk();
let pods: Pod[] = loadPodsFromDisk();

const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications_data.json');

function loadNotificationsFromDisk(): AppNotification[] {
  if (IS_PRODUCTION) return [];
  try {
    const raw = safeReadFile(NOTIFICATIONS_FILE);
    if (raw) {
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
  if (isPersistenceEnabled()) {
    requestFlush();
    return;
  }
  try {
    safeWriteFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
  } catch (err) {
    console.error('Error saving notifications_data.json:', err);
  }
}

async function syncNotificationsFromFirestore(): Promise<AppNotification[]> {
  return notifications;
}

let notifications: AppNotification[] = loadNotificationsFromDisk();

const SWAP_REQUESTS_FILE = path.join(DATA_DIR, 'swap_requests_data.json');

function loadSwapRequestsFromDisk(): SwapRequest[] {
  try {
    const raw = safeReadFile(SWAP_REQUESTS_FILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading swap_requests_data.json:', err);
  }
  return [];
}

function saveSwapRequestsToDisk() {
  if (isPersistenceEnabled()) {
    requestFlush();
    return;
  }
  try {
    safeWriteFile(SWAP_REQUESTS_FILE, JSON.stringify(swapRequests, null, 2));
  } catch (err) {
    console.error('Error saving swap_requests_data.json:', err);
  }
}

async function syncSwapRequestsFromFirestore(): Promise<SwapRequest[]> {
  return swapRequests;
}

let swapRequests: SwapRequest[] = loadSwapRequestsFromDisk();

// Records are matched to users by exact user id only. Matching on display
// names or emails (and substrings of them) let users read and act on each
// other's notifications, swaps and payments.
function isUserTargetMatch(targetKey: string | undefined, user: User): boolean {
  return Boolean(targetKey && user && user.id && targetKey === user.id);
}

function isNotificationForUser(n: AppNotification, user: User): boolean {
  if (!n || !user) return false;
  if (isUserTargetMatch(n.userId, user)) return true;

  const meta = (n.metadata || {}) as Record<string, any>;
  if (isUserTargetMatch(meta.targetUserId, user) || isUserTargetMatch(meta.targetMemberUserId, user)) return true;

  // Notifications addressed to a pod membership id belong to that membership's user.
  for (const p of pods) {
    const membership = p?.members?.find(m => m && m.userId === user.id);
    if (membership && membership.id && (n.userId === membership.id || meta.targetMemberId === membership.id)) return true;
  }
  return false;
}

function createNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): AppNotification {
  const newNotif: AppNotification = {
    ...notif,
    id: `notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(newNotif);
  saveNotificationsToDisk();
  return newNotif;
}

// Pure lookup. This must never create pods or add the caller as a member:
// membership checks throughout the routes depend on it.
async function findPodById(id: string, _currentUser?: User): Promise<Pod | undefined> {
  if (!id) return undefined;

  let pod = pods.find(p => p && p.id === id);
  // With Firestore persistence enabled, memory is the source of truth.
  if (pod || isPersistenceEnabled()) return pod;

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

  return pod;
}

// Only store the contact fields we define, never arbitrary client objects.
function sanitizeInvitedContacts(raw: unknown, inviter: User): InvitedContact[] {
  if (!Array.isArray(raw)) return [];
  const out: InvitedContact[] = [];
  for (const c of raw.slice(0, 200)) {
    if (!c || typeof c !== 'object') continue;
    const emailOrPhone = typeof (c as any).emailOrPhone === 'string' ? (c as any).emailOrPhone.trim().slice(0, 254) : '';
    if (!emailOrPhone) continue;
    const name = typeof (c as any).name === 'string' ? (c as any).name.trim().slice(0, 120) : '';
    out.push({
      id: `ic_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      name: name || emailOrPhone,
      emailOrPhone,
      isExistingMember: false,
      status: 'INVITED',
      invitedAt: new Date().toISOString(),
      invitedByUserId: inviter.id,
      invitedByName: inviter.displayName,
    } as InvitedContact);
  }
  return out;
}

// Exact lookup of a pod member by user id or membership id. Never adds members.
function findPodMember(pod: Pod, targetKey: string | undefined): PodMembership | undefined {
  if (!pod || !pod.members || !targetKey) return undefined;
  return pod.members.find(m => m && (m.userId === targetKey || m.id === targetKey));
}

function isPodMember(pod: Pod | undefined, user: User | null | undefined): boolean {
  return Boolean(pod && user && pod.members?.some(m => m && m.userId === user.id));
}

// --- ANTI-COLLUSION ---
// Hardship caps: platform money a single pod can draw through hardship requests.
const HARDSHIP_MAX_APPROVED_PER_POD_PER_CYCLE = 1;
const HARDSHIP_MAX_OUTSTANDING_PER_POD = 2;

// Stable identifiers for the real person behind an account. In production these
// are the Stripe bank-account fingerprints captured from Connect onboarding, so
// a second account paid out to the same bank counts as the same person. Without
// any (demo/dev), the account id stands in.
function getIdentityKeys(user: User | null | undefined): string[] {
  if (!user) return [];
  const fingerprints = (user.identityFingerprints || []).filter(Boolean).map(f => `bank:${f}`);
  if (fingerprints.length) return fingerprints;
  return IS_PRODUCTION ? [] : [`user:${user.id}`];
}

function sharesIdentity(a: User | null | undefined, b: User | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  const keysA = new Set((a.identityFingerprints || []).filter(Boolean));
  return (b.identityFingerprints || []).some(f => keysA.has(f));
}

// The creator's 3% host reward applies once the pod has at least one other
// member who is KYC-verified and is not the creator under a second account.
function isHostRewardEligible(pod: Pod): boolean {
  const creator = users.find(u => u && u.id === pod.createdBy);
  return (pod.members || []).some(m => {
    if (!m || !m.userId || m.userId === pod.createdBy) return false;
    const memberUser = users.find(u => u && u.id === m.userId);
    return Boolean(memberUser && memberUser.kycStatus === 'VERIFIED' && !sharesIdentity(creator, memberUser));
  });
}

// --- ROTATION ORDER ---
// The creator is placed in the final rotation slot when the pod locks: being paid
// last is what makes members trust the pod. The 3% host reward is the incentive
// for holding that slot, so it always belongs to whoever holds the final slot:
// the creator, or a member who took it over through a swap or reprioritization.
function getFinalSlotMember(pod: Pod): PodMembership | undefined {
  let last: PodMembership | undefined;
  for (const m of pod.members || []) {
    if (m && m.userId && (!last || m.rotationIndex > last.rotationIndex)) last = m;
  }
  return last;
}

// Keep the stored reward recipient (used in audit logs/notifications) in step
// with the final slot. Unset means the creator holds it.
function syncHostRewardRecipient(pod: Pod): void {
  const last = getFinalSlotMember(pod);
  if (!last || last.userId === pod.createdBy) {
    delete pod.hostRewardRecipientUserId;
    delete pod.hostRewardRecipientName;
  } else {
    pod.hostRewardRecipientUserId = last.userId;
    pod.hostRewardRecipientName = last.displayName;
  }
}

// Remove a member without disturbing anyone else's turn. Slots already paid out
// keep their week numbers; only unpaid slots after the removed one move up by
// one week, so nobody is paid twice or skipped and the final slot stays final.
function removeMemberFromRotation(pod: Pod, userId: string): void {
  const removed = pod.members.find(m => m && m.userId === userId);
  if (!removed) return;
  pod.members = pod.members.filter(m => m && m.userId !== userId);
  pod.memberCount = pod.members.length;

  if (pod.status === 'ACTIVE') {
    const currentSlot = (pod.currentCycleWeek || 1) - 1; // this week's (unpaid) recipient
    if (removed.rotationIndex >= currentSlot) {
      for (const m of pod.members) {
        if (m.rotationIndex > removed.rotationIndex) m.rotationIndex -= 1;
      }
      pod.totalCycles = Math.max(0, (pod.totalCycles || pod.members.length + 1) - 1);
    }
    pod.weeklyPoolTarget = pod.members.length * pod.depositTier;
  }
  pod.members.sort((a, b) => a.rotationIndex - b.rotationIndex);
  syncHostRewardRecipient(pod);
}

// When a pod completes, any welcome-match cushion it didn't need goes back to
// the platform (it is never paid out as a bonus).
function releaseContingencyBuffer(pod: Pod): void {
  const remaining = roundCents(Number(pod.contingencyBufferUsd) || 0);
  const initial = roundCents(Number(pod.contingencyBufferInitialUsd) || 0);
  const grant = welcomeMatchGrants.find(g => g.podId === pod.id && g.status === 'ACTIVE');
  pod.contingencyBufferUsd = 0;
  for (const g of welcomeMatchGrants.filter(g => g.podId === pod.id && g.status === 'ACTIVE')) {
    g.usedUsd = roundCents(Math.max(0, initial - remaining));
    g.releasedUsd = remaining;
    g.status = 'RELEASED';
    g.releasedAt = new Date().toISOString();
  }
  if (initial > 0 || grant) {
    addAuditLog(pod.id, 'SYSTEM', 'MutualPool Treasury', 'WELCOME_MATCH_RELEASED' as any,
      `Pod "${pod.name}" completed. Welcome match cushion: $${roundCents(initial - remaining).toFixed(2)} used to cover missed deposits; $${remaining.toFixed(2)} unused, returned to the platform.`,
      { initialUsd: initial, usedUsd: roundCents(initial - remaining), returnedUsd: remaining });
  }
}

function assessHardshipRequest(request: HardshipFundRequest) {
  const others = hardshipRequests.filter(r => r.id !== request.id && r.userId === request.userId && r.status !== 'REJECTED');
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const requester = users.find(u => u.id === request.userId);
  return assessHardshipRisk({
    priorRequestsWithSameCreator: others.filter(r => r.creatorUserId === request.creatorUserId).length,
    priorRequestsTotal: others.length,
    creatorRecentApprovals: hardshipRequests.filter(r =>
      r.id !== request.id && r.creatorUserId === request.creatorUserId && r.userId !== request.userId &&
      (r.status === 'APPROVED' || r.status === 'PAID_OFF') && new Date(r.approvedAt || r.requestedAt).getTime() >= ninetyDaysAgo
    ).length,
    memberDepositsInPod: deposits.filter(d => d && d.podId === request.podId && d.userId === request.userId && d.status === 'COMPLETE' && !String(d.stripePaymentId || '').startsWith('ledger_hardship')).length,
    accountAgeDays: calculateAccountAgeDays(requester?.createdAt, requester?.accountAgeDays),
    requesterIsCreator: request.userId === request.creatorUserId,
  });
}

// Why a pod can't take on another approved hardship right now (null = ok).
function hardshipCapProblem(pod: Pod): string | null {
  const forPod = hardshipRequests.filter(r => r.podId === pod.id);
  const approvedThisCycle = forPod.filter(r => (r.status === 'APPROVED' || r.status === 'PAID_OFF') && r.approvedCycleWeek === pod.currentCycleWeek).length;
  if (approvedThisCycle >= HARDSHIP_MAX_APPROVED_PER_POD_PER_CYCLE) {
    return `This pod has already used its hardship allowance for week ${pod.currentCycleWeek}.`;
  }
  const outstanding = forPod.filter(r => r.status === 'APPROVED').length;
  if (outstanding >= HARDSHIP_MAX_OUTSTANDING_PER_POD) {
    return `This pod already has ${outstanding} unpaid hardship advances; one must be repaid first.`;
  }
  return null;
}

// --- INTERNAL LEDGER ---
// Pod deposits and payouts move money between members' Treasury ledger
// balances. Real money only enters via verified Stripe webhooks and only leaves
// via Stripe transfers (withdrawals), so a ledger debit must never go negative.
function newLedgerId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function debitLedger(user: User, amount: number): boolean {
  if (!user.treasury || !Number.isFinite(amount) || amount <= 0) return false;
  const balance = Number(user.treasury.balanceUsd) || 0;
  if (balance + 1e-9 < amount) return false;
  user.treasury.balanceUsd = roundCents(balance - amount);
  return true;
}

function creditLedger(user: User, amount: number): void {
  if (!user.treasury) user.treasury = createUserRecord(user.id, user.email, user.displayName).treasury;
  user.treasury.balanceUsd = roundCents((Number(user.treasury.balanceUsd) || 0) + amount);
}

function insufficientFunds(res: Response, required: number, user: User) {
  return res.status(402).json({
    error: 'INSUFFICIENT_FUNDS',
    message: `This requires $${required.toFixed(2)} but your Treasury balance is $${(Number(user.treasury?.balanceUsd) || 0).toFixed(2)}. Add funds first.`,
    requiredUsd: required,
  });
}

function isPodCreator(pod: Pod | undefined, user: User | null | undefined): boolean {
  return Boolean(pod && user && pod.createdBy === user.id);
}

// Non-members see a pod's public listing only: no invite code, contacts,
// member emails or payout transfer ids.
function toPodView(pod: Pod, viewer: User | null, viewerIsAdmin: boolean): Pod {
  if (viewerIsAdmin || isPodMember(pod, viewer) || isPodCreator(pod, viewer)) return pod;
  const { inviteCode: _code, invitedContacts: _contacts, holdingFinAccountId: _fa, ...rest } = pod as any;
  return {
    ...rest,
    inviteCode: '',
    invitedContacts: [],
    holdingFinAccountId: '',
    members: (pod.members || []).map(m => {
      const { email: _email, payoutStripeTransferId: _tr, ...publicMember } = m as any;
      return publicMember;
    }),
  } as Pod;
}

// Seed data is for local development only; production state is hydrated from Firestore at boot.
let perks: Perk[] = IS_PRODUCTION ? [] : [...INITIAL_PERKS];
let auditLogs: AuditLogEntry[] = IS_PRODUCTION ? [] : [...INITIAL_AUDIT_LOGS];
let hardshipRequests: HardshipFundRequest[] = [];
let reprioritizationRequests: ReprioritizationRequest[] = IS_PRODUCTION ? [] : [
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
let deposits: Deposit[] = IS_PRODUCTION ? [] : [
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
// Stripe objects (Checkout sessions / PaymentIntents) already credited to a
// member's ledger. Makes webhook redelivery idempotent.
let processedPayments: Array<{ id: string; userId: string; amountUsd: number; processedAt: string }> = [];
// Member withdrawals (Stripe transfers). Persisted BEFORE the transfer is created so
// a crash or ambiguous Stripe error can be reconciled instead of paying twice.
interface WithdrawalRecord {
  id: string;
  userId: string;
  amountUsd: number;
  destinationAccountId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'NEEDS_REVIEW';
  stripeTransferId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
let withdrawals: WithdrawalRecord[] = [];
// One welcome match per verified person, keyed on identity (see getIdentityKeys).
interface WelcomeMatchGrant {
  id: string;
  identityKey: string;
  userId: string;
  podId: string;
  amountUsd: number;
  usedUsd: number;
  releasedUsd: number;
  status: 'ACTIVE' | 'RELEASED';
  grantedAt: string;
  releasedAt?: string;
}
let welcomeMatchGrants: WelcomeMatchGrant[] = [];

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
    id: `log_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
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
  if (!req || !req.headers) return undefined;
  const lowerName = headerName.toLowerCase();
  const value = req.headers[lowerName] !== undefined ? req.headers[lowerName] : req.headers[headerName];
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return typeof value === 'string' ? value : (value !== undefined && value !== null ? String(value) : undefined);
}

function getQueryValue(req: Request, key: string): string | undefined {
  if (!req) return undefined;
  if (req.query && req.query[key] !== undefined) {
    const value = req.query[key];
    if (Array.isArray(value)) {
      return value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
    return typeof value === 'string' ? value : String(value);
  }
  try {
    if (req.url && req.url.includes('?')) {
      const u = new URL(req.url, 'http://localhost');
      const param = u.searchParams.get(key);
      if (param !== null) return param;
    }
  } catch {}
  return undefined;
}

function calculateAccountAgeDays(createdAt?: string, fallbackDays: number = 1): number {
  const fallback = typeof fallbackDays === 'number' && !isNaN(fallbackDays) && fallbackDays > 0 ? fallbackDays : 1;
  if (!createdAt) return fallback;
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime) || createdTime <= 0) return fallback;
  const diffMs = Date.now() - createdTime;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(fallback, days, 1);
}

function getHeaderNumber(req: Request, headerName: string): number | undefined {
  const rawValue = getHeaderValue(req, headerName);
  if (!rawValue) return undefined;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// --- IDENTITY ---
// Identity comes only from a verified Firebase ID token (see the auth middleware
// below). Admin rights come only from the `admin` custom claim on that token,
// set with scripts/set-admin-claim.ts.
//
// DEMO_MODE (development only) additionally accepts x-user-id / demo tokens and
// x-user-* profile headers so the integration tests can simulate many users.

function getDemoProfileFromHeaders(req: Request) {
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

function createUserRecord(id: string, email: string, displayName: string, avatarUrl?: string | null): User {
  const nowIso = new Date().toISOString();
  return {
    id,
    email,
    displayName,
    avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=005FB8&color=fff&size=200`,
    platform: 'DoorDash',
    role: 'RIDER',
    createdAt: nowIso,
    accountAgeDays: calculateAccountAgeDays(nowIso, 1),
    kycStatus: 'UNVERIFIED',
    treasury: {
      stripeAccountId: '',
      stripeFinAccountId: '',
      balanceUsd: 0,
      pendingInboundUsd: 0,
      totalPayoutsReceivedUsd: 0,
      fdicPassThroughEligible: false,
      status: 'UNINITIALIZED' as User['treasury']['status'],
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
}

// DEMO_MODE only: lets tests seed KYC status, account age, etc. through x-user-* headers.
function applyDemoProfileHeaders(found: User, req: Request): void {
  const profile = getDemoProfileFromHeaders(req);
  found.platform = found.platform || (profile.platform as any);
  if (profile.role && !found.role) found.role = profile.role;
  if (profile.accountAgeDays > (found.accountAgeDays || 0)) {
    found.accountAgeDays = profile.accountAgeDays;
  }
  if (found.accountAgeDays && found.accountAgeDays > 1) {
    const createdTime = found.createdAt ? new Date(found.createdAt).getTime() : NaN;
    const elapsed = isNaN(createdTime) ? 0 : Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
    if (elapsed < found.accountAgeDays) {
      found.createdAt = new Date(Date.now() - found.accountAgeDays * 24 * 60 * 60 * 1000).toISOString();
    }
  } else if (!found.createdAt) {
    found.createdAt = new Date().toISOString();
  }
  found.accountAgeDays = calculateAccountAgeDays(found.createdAt, found.accountAgeDays);
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

// Scheduled jobs (cycle payouts, settlement sweeps) may be triggered by an admin
// or by the scheduler presenting CRON_SECRET in the x-cron-secret header.
function isSystemRequest(req: Request): boolean {
  if (checkIsAdmin(req)) return true;
  const secret = process.env.CRON_SECRET;
  const provided = getHeaderValue(req, 'x-cron-secret');
  if (!secret || !provided || secret.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
}

// Routes that only exist to simulate money/KYC flows in development.
function requireDemoMode(_req: Request, res: Response, next: express.NextFunction) {
  if (!DEMO_MODE) {
    return res.status(404).json({ error: 'NOT_AVAILABLE', message: 'This endpoint is only available in demo mode.' });
  }
  next();
}

function isAdminRole(role: unknown): boolean {
  return typeof role === 'string' && role.toUpperCase().includes('ADMIN');
}

function getCurrentUser(req: Request): User | null {
  return ((req as any).authenticatedUser as User | undefined) || null;
}

function checkIsAdmin(req: Request): boolean {
  return (req as any).authIsAdmin === true;
}

export const app = express();
app.set('trust proxy', 1);


// Serverless & Standard Express socket / connection stabilizer
app.use((req, res, next) => {
  if (!req.socket) {
    (req as any).socket = { remoteAddress: '127.0.0.1' };
  }
  if (!(req as any).connection) {
    (req as any).connection = (req as any).socket;
  }
  if (!req.socket.remoteAddress) {
    (req.socket as any).remoteAddress = '127.0.0.1';
  }
  next();
});

// Serverless & Standard Express body parsing middlewares
app.use((req, res, next) => {
  if (res.headersSent) return next();

  // If already parsed as object by platform (e.g. Vercel), skip re-reading stream
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0) {
    return next();
  }

  // GET/HEAD/OPTIONS requests don't need body parsing stream listeners
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    if (!req.body || typeof req.body !== 'object') {
      req.body = {};
    }
    return next();
  }

  express.json({
    limit: '10mb',
    // Keep the exact bytes: Stripe/Fourthwall webhook signatures are computed over the raw body.
    verify: (r, _res, buf) => { (r as any).rawBody = buf; },
  })(req, res, () => {
    express.urlencoded({ extended: true, limit: '10mb' })(req, res, () => {
      if (req.body !== undefined && req.body !== null) {
        if (typeof req.body === 'string' && req.body.trim().length > 0) {
          try {
            req.body = JSON.parse(req.body);
          } catch {}
        } else if (Buffer.isBuffer(req.body)) {
          try {
            req.body = JSON.parse(req.body.toString('utf-8'));
          } catch {}
        }
      }
      if (!req.body || typeof req.body !== 'object') {
        req.body = {};
      }
      next();
    });
  });
});

// CORS (allowlisted origins only) + security headers
const allowedOrigins = new Set(getAllowedOrigins());
app.use((req, res, next) => {
  if (res.headersSent) return next();
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-App-Language');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (req.method === 'OPTIONS') {
    return res.status(origin && allowedOrigins.has(origin) ? 204 : 403).end();
  }
  next();
});

// Never leak internal error details to clients in production: strip
// message/details/stack from generic 500 JSON bodies. Other 5xx codes (502/503)
// carry deliberate, user-facing messages.
if (IS_PRODUCTION) {
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 500 && body && typeof body === 'object' && !Array.isArray(body)) {
        const { message: _m, details: _d, stack: _s, ...rest } = body;
        return originalJson({ ...rest, error: rest.error || 'SERVER_ERROR' });
      }
      return originalJson(body);
    };
    next();
  });
}

// Attach Server-Side Country Context (derived strictly from host / domain)
app.use(countryContextMiddleware);

// Dynamic Web App Manifest - Adapts name, short_name, scope, and description based on incoming country domain
app.get(['/manifest.json', '/site.webmanifest'], (req: Request, res: Response) => {
  const country = req.country || US_CONFIG;
  const manifest = {
    id: `/?country=${country.countryCode}`,
    name: country.pwa.name,
    short_name: country.pwa.shortName,
    description: country.pwa.description,
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    theme_color: country.pwa.themeColor,
    background_color: country.pwa.backgroundColor,
    display: 'standalone',
    start_url: '/',
    scope: '/',
  };
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(manifest);
});

// Country configuration endpoints
app.get('/api/country/current', (req: Request, res: Response) => {
  res.json({
    success: true,
    country: req.country || US_CONFIG,
  });
});

app.get('/api/country/all', (_req: Request, res: Response) => {
  res.json({
    success: true,
    countries: SUPPORTED_COUNTRIES,
  });
});

// Several routes are also registered without the /api prefix; limiters must cover both.
const API_PATH = /^\/(api\/)?(admin|campaigns|chats|fourthwall|health|notifications|perks|platform|pods|user|users|treasury|hardship|audit-logs|ai|webhooks|country)(\/|$)/;
const MONEY_PATH = /^\/(api\/)?(users\/treasury|treasury|pods\/[^/]+\/(join|deposit)|hardship|perks\/(redeem|submit))(\/|$)/;
const AI_PATH = /^\/(api\/)?(ai\/|campaigns\/gear-verify)/;
const limitWhen = (pattern: RegExp, limiter: express.RequestHandler): express.RequestHandler =>
  (req, res, next) => (pattern.test(req.path) ? limiter(req, res, next) : next());

// Pre-auth limiter for the (demo-only) credential routes.
app.use(['/api/users/login', '/api/users/register', '/api/users/switch'], authRateLimiter);

// Firebase ID token verification for all routes. This is the ONLY place identity
// is established; handlers read it through getCurrentUser()/checkIsAdmin().
app.use(async (req: Request, res: Response, next) => {
  let uid: string | null = null;
  let email: string | null = null;
  let emailVerified = false;
  let name: string | null = null;
  let picture: string | null = null;
  let isAdmin = false;

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

  if (token && !(DEMO_MODE && (token.startsWith('demo_token_') || token.startsWith('usr_')))) {
    const authAdmin = getAuthAdmin();
    if (!authAdmin) {
      console.error('[Auth] Firebase Admin is not initialised; cannot verify ID tokens.');
      return res.status(503).json({ error: 'AUTH_UNAVAILABLE', message: 'Authentication is temporarily unavailable.' });
    }
    try {
      const decoded = await authAdmin.verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email || null;
      emailVerified = decoded.email_verified === true;
      name = (decoded.name as string) || null;
      picture = (decoded.picture as string) || null;
      isAdmin = decoded.admin === true;
    } catch (err: any) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Your session has expired. Please sign in again.' });
    }
  }

  if (!uid && DEMO_MODE) {
    const demoToken = token.startsWith('demo_token_') ? token.replace('demo_token_', '') : token.startsWith('usr_') ? token : '';
    uid = demoToken || getHeaderValue(req, 'x-user-id') || getQueryValue(req, 'userId') || null;
    email = getHeaderValue(req, 'x-user-email') || null;
    emailVerified = Boolean(email);
    name = getHeaderValue(req, 'x-user-name') || null;
  }

  if (uid) {
    let found = users.find(u => u && u.id === uid);
    if (!found) {
      const userEmail = email || '';
      const displayName = (name && name !== 'Verified Member' ? name : '') || userEmail.split('@')[0] || 'Mutual Member';
      found = createUserRecord(uid, userEmail, displayName, picture);
      found.emailVerified = emailVerified;
      users.push(found);
      saveUsersToDisk();
    } else if (email && (found.email !== email || found.emailVerified !== emailVerified)) {
      // An unverified address must not be able to claim another member's invites.
      found.email = email;
      found.emailVerified = emailVerified;
    }

    if (DEMO_MODE) {
      applyDemoProfileHeaders(found, req);
      isAdmin = isAdmin || isAdminRole(found.role) || isAdminRole(getHeaderValue(req, 'x-user-role'));
    } else if (isAdmin) {
      found.role = 'Admin';
      found.isAdmin = true;
    } else if (isAdminRole(found.role) || found.isAdmin) {
      // Stored roles never grant admin; only the verified custom claim does.
      found.role = 'RIDER';
      found.isAdmin = false;
    }

    // Language signals (used to decide which translations to add). Only the
    // primary tag is kept, e.g. "vi" or "zh-tw"; nothing else from the headers.
    const langTag = (v: string | undefined) => {
      const tag = (v || '').split(',')[0].split(';')[0].trim().toLowerCase();
      return /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(tag) ? tag : undefined;
    };
    const browserLanguage = langTag(getHeaderValue(req, 'accept-language'));
    const preferredLanguage = langTag(getHeaderValue(req, 'x-app-language'));
    if (browserLanguage && found.browserLanguage !== browserLanguage) {
      found.browserLanguage = browserLanguage;
      requestFlush();
    }
    if (preferredLanguage && found.preferredLanguage !== preferredLanguage) {
      found.preferredLanguage = preferredLanguage;
      requestFlush();
    }

    (req as any).authenticatedUser = found;
    (req as any).authIsAdmin = isAdmin;
    (req as any).user = { uid: found.id, email: found.email, displayName: found.displayName };
  }
  next();
});

// After any mutating API request, persist changed state promptly.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.on('finish', () => requestFlush());
  }
  next();
});

// Limiters keyed by the authenticated user (falling back to IP for anonymous callers).
app.use(limitWhen(API_PATH, apiRateLimiter));
app.use(limitWhen(AI_PATH, aiRateLimiter));
app.use(['/api/campaigns/advertiser-inquiry'], publicFormRateLimiter);
app.use(limitWhen(MONEY_PATH, moneyRateLimiter));

// Production-ready Health check endpoint
app.get(['/api/health', '/health'], (req, res) => {
  const persistence = getPersistenceHealth();
  const healthy = !IS_PRODUCTION || (persistence.enabled && persistence.consecutiveFailures < 3);
  const body: Record<string, unknown> = {
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
  };
  if (checkIsAdmin(req)) {
    Object.assign(body, {
      persistence,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      uptime: Math.floor(process.uptime()),
      mode: process.env.NODE_ENV || 'development',
      demoMode: DEMO_MODE,
    });
  }
  res.status(healthy ? 200 : 503).json(body);
});

// --- API ROUTES ---

  // 1. Current user profile & member directory
  app.get(['/api/users/current', '/users/current'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    user.accountAgeDays = calculateAccountAgeDays(user.createdAt, user.accountAgeDays);
    res.json(user);
  });

  // Members may only edit plain profile fields on their own record. Balances,
  // KYC, roles, Stripe and bank details are server-controlled.
  app.post(['/api/users/sync', '/users/sync'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const body = (req.body || {}) as Partial<User>;
    const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

    const displayName = text(body.displayName, 80);
    if (displayName) user.displayName = displayName;
    const name = text(body.name, 120);
    if (name) user.name = name;
    const city = text(body.city, 120);
    if (city !== undefined) user.city = city;
    const avatarUrl = text(body.avatarUrl, 2048);
    if (avatarUrl && /^https:\/\//i.test(avatarUrl)) user.avatarUrl = avatarUrl;
    const platform = text(body.platform, 40);
    if (platform) user.platform = platform as User['platform'];
    if (Array.isArray(body.deliveryPlatforms)) {
      user.deliveryPlatforms = body.deliveryPlatforms.filter(p => typeof p === 'string').map(p => p.slice(0, 40)).slice(0, 10);
    }
    if (body.traditionId === null || body.traditionId === '') {
      user.traditionId = undefined;
    } else if (isTraditionId(body.traditionId)) {
      user.traditionId = body.traditionId;
    }
    saveUsersToDisk();
    res.json({ success: true, user });
  });

  app.get(['/api/users', '/users'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    if (checkIsAdmin(req)) {
      users.forEach(u => {
        if (u) u.accountAgeDays = calculateAccountAgeDays(u.createdAt, u.accountAgeDays);
      });
      return res.json(users);
    }
    // Public directory only: no emails, balances, bank or KYC details.
    res.json(users.filter(Boolean).map(u => ({
      id: u.id,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      platform: u.platform,
      city: u.city,
      role: isAdminRole(u.role) ? 'RIDER' : u.role,
      completedPodsCount: u.completedPodsCount,
    })));
  });

  // --- DEMO_MODE-only simulations (development & integration tests) ---
  // In production, sign-in is Firebase Auth, KYC and bank linking happen in
  // Stripe Connect onboarding, and deposits go through Stripe Checkout.
  app.post('/api/users/login', requireDemoMode, (req: Request, res: Response) => {
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

  app.post('/api/users/register', requireDemoMode, (req: Request, res: Response) => {
    const { displayName, email, platform, initialDeposit, autoVerifyKyc } = req.body;

    if (!displayName || !email) {
      return res.status(400).json({ error: 'Name and email are required for registration' });
    }

    const existing = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const newUserId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const avatars = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
    ];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    const nowIso = new Date().toISOString();
    const newUser: User = {
      id: newUserId,
      displayName,
      email,
      platform: platform || 'DoorDash',
      role: 'DRIVER',
      kycStatus: autoVerifyKyc ? 'VERIFIED' : 'PENDING',
      kycVerifiedAt: autoVerifyKyc ? nowIso : undefined,
      createdAt: nowIso,
      accountAgeDays: calculateAccountAgeDays(nowIso, 1),
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

  app.post('/api/users/switch', requireDemoMode, (req: Request, res: Response) => {
    const { userId } = req.body;
    const found = users.find(u => u.id === userId);
    if (!found) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(found);
  });

  // 2. Stripe Identity KYC Verification Simulation
  app.post(['/api/users/kyc/verify', '/users/kyc/verify'], requireDemoMode, (req: Request, res: Response) => {
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

      saveUsersToDisk();

      addAuditLog(
        undefined,
        targetUser.id,
        targetUser.displayName || 'User',
        'KYC_VERIFIED' as any,
        `Completed Stripe Identity verification (${idType || 'Driver License'}, SSN: ***-**-${ssnLast4 || '4321'}). Stripe Custom Account ${targetUser.treasury.stripeAccountId} and Treasury Financial Account ${targetUser.treasury.stripeFinAccountId} activated${TREASURY_PROGRAM_ENABLED ? ' with FDIC pass-through coverage' : ''}.`,
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
  app.post('/api/users/bank/link', requireDemoMode, (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Please sign in.' });
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

      saveUsersToDisk();

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
  app.post('/api/users/treasury/topup', requireDemoMode, (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
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
      const { paymentIntentId } = req.body || {};
      const inboundTransferId = paymentIntentId || `it_stripe_treasury_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      targetUser.treasury.balanceUsd += depositAmount;
      saveUsersToDisk();

      addAuditLog(
        undefined,
        targetUser.id,
        targetUser.displayName || 'User',
        'TREASURY_TOPUP' as any,
        `Processed Stripe Treasury InboundTransfer (${inboundTransferId}) of $${depositAmount.toFixed(2)} USD base deposit ($${platformFee.toFixed(2)} 5% platform fee, $${totalChargedAmount.toFixed(2)} total charged) from test card ending in ${last4} into Treasury Account ${targetUser.treasury.stripeFinAccountId || 'Active Treasury'}. Net credited to Treasury Balance: $${depositAmount.toFixed(2)}.`,
        { amount: depositAmount, platformFee, totalChargedAmount, last4, inboundTransferId, paymentIntentId }
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

  // 3a. Stripe Checkout session for Treasury top-ups (production deposit flow)
  app.post('/api/users/treasury/checkout-session', async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
      }
      const depositAmount = parseMoneyAmount(req.body?.amount, { max: 10_000 });
      if (depositAmount === null || depositAmount < 1) {
        return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Enter an amount between $1 and $10,000.' });
      }
      const country = req.country || US_CONFIG;
      const feePercentage = country.payment.payoutFeePercentage || 0.05;
      const platformFee = Math.round(depositAmount * feePercentage * 100) / 100;

      const session = await createDepositCheckoutSession({
        userId: user.id,
        email: user.email,
        depositAmountUsd: depositAmount,
        platformFeeUsd: platformFee,
      });
      res.json({ success: true, url: session.url, sessionId: session.id, depositAmount, platformFee, totalCharged: depositAmount + platformFee });
    } catch (err: any) {
      console.error('[/api/users/treasury/checkout-session] error:', err);
      res.status(500).json({ error: 'FAILED_TO_CREATE_CHECKOUT_SESSION' });
    }
  });

  // 3b-1. Create Stripe PaymentIntent for secure client-side Elements checkout (PCI SAQ A Compliant)
  app.post('/api/users/treasury/create-payment-intent', validateCountryCurrency, async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
      }

      const country = req.country || US_CONFIG;
      const { amount, podId, description } = req.body || {};
      const depositAmount = parseMoneyAmount(amount, { max: 10_000 });
      if (depositAmount === null) {
        return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Enter an amount between $0.01 and $10,000.' });
      }
      const feePercentage = country.payment.payoutFeePercentage || 0.05;
      const platformFee = Math.round(depositAmount * feePercentage * 100) / 100;
      const totalCharged = depositAmount + platformFee;

      // In non-US countries or when country-specific provider is active
      if (country.countryCode !== 'US') {
        const provider = PaymentProviderFactory.getProvider(country);
        const providerIntent = await provider.createDepositIntent({
          amountMinorUnits: Math.round(depositAmount * 100),
          currency: country.currency.code,
          userId: user.id,
          userEmail: user.email,
          podId,
          description: description || `${country.countryName} Pod Deposit for ${user.displayName || user.email}`,
        });

        return res.json({
          success: true,
          provider: provider.providerId,
          clientSecret: providerIntent.clientSecret,
          redirectUrl: providerIntent.redirectUrl,
          paymentIntentId: providerIntent.paymentIntentId,
          currency: country.currency.code,
          depositAmount,
          platformFee,
          totalCharged,
        });
      }

      // Default US Stripe Treasury flow
      const intent = await createDepositPaymentIntent(
        totalCharged,
        user.id,
        podId,
        description || `MutualPool Treasury Top-up for ${user.displayName || user.email}`,
        depositAmount
      );

      return res.json({
        success: true,
        provider: 'stripe_treasury',
        currency: 'USD',
        clientSecret: intent.clientSecret,
        paymentIntentId: intent.paymentIntentId,
        depositAmount,
        platformFee,
        totalCharged,
      });
    } catch (err: any) {
      console.error('[/api/users/treasury/create-payment-intent] error:', err);
      return res.status(500).json({ error: 'FAILED_TO_CREATE_PAYMENT_INTENT', message: err?.message });
    }
  });

  // 3b-2. Stripe Connect onboarding (identity verification + payout bank account)
  app.post('/api/users/connect/onboarding-link', async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
      }

      if (!user.treasury) {
        user.treasury = createUserRecord(user.id, user.email, user.displayName).treasury;
      }
      let accountId = user.treasury.stripeAccountId;
      if (!accountId || (!DEMO_MODE && !accountId.startsWith('acct_')) || accountId.startsWith('acct_1xCustom_')) {
        if (DEMO_MODE) {
          accountId = `acct_1xCustom_${Date.now()}`;
        } else {
          const account = await createConnectAccount(user.id, user.email, user.displayName);
          accountId = account.id;
        }
        user.treasury.stripeAccountId = accountId;
        user.treasury.status = 'PENDING_REQUIREMENTS';
        saveUsersToDisk();
      }

      const onboardingUrl = await createConnectOnboardingLink(accountId);
      return res.json({ success: true, url: onboardingUrl, accountId });
    } catch (err: any) {
      console.error('[/api/users/connect/onboarding-link] error:', err);
      return res.status(500).json({ error: 'FAILED_TO_GENERATE_ONBOARDING_LINK' });
    }
  });

  // 3b-3. Refresh Stripe Connect status (called when the member returns from onboarding;
  // the account.updated webhook keeps it current afterwards).
  app.post('/api/users/connect/refresh', async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const accountId = user.treasury?.stripeAccountId || '';
    if (DEMO_MODE || !accountId.startsWith('acct_')) {
      return res.json({ success: true, user });
    }
    try {
      const account = await getStripe().accounts.retrieve(accountId, { expand: ['external_accounts'] });
      applyConnectAccountUpdate(account);
      return res.json({ success: true, user });
    } catch (err: any) {
      console.error('[/api/users/connect/refresh] error:', err?.message);
      return res.status(502).json({ error: 'STRIPE_UNAVAILABLE', message: 'Could not refresh your verification status. Please try again shortly.' });
    }
  });

  // 3c. Leave Pod Endpoint
  app.post(['/api/pods/:id/leave', '/pods/:id/leave'], async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
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

      if (!isPodMember(pod, user)) {
        return res.status(403).json({ error: 'NOT_A_MEMBER', message: 'You are not a member of this pod.' });
      }
      pod.members = pod.members.filter(m => m && m.userId !== user.id);

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
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    try {
      await syncPodsFromFirestore();
    } catch (err) {
      console.error('[/api/pods] sync error:', err);
    }
    const isAdmin = checkIsAdmin(req);
    res.json(pods.filter(p => !isDemoPodServer(p)).map(p => toPodView(p, user, isAdmin)));
  });

  app.get(['/api/pods/:id', '/pods/:id'], async (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
      }
      const pod = await findPodById(req.params.id, user);
      if (!pod) {
        return res.status(404).json({ error: 'Pod not found' });
      }
      const isAdmin = checkIsAdmin(req);
      if (!isAdmin && !isPodMember(pod, user) && !isPodCreator(pod, user)) {
        return res.json(toPodView(pod, user, false));
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
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
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
    if (!name || typeof name !== 'string' || !name.trim() || name.length > 120) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Pod name is required (max 120 characters).' });
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > 2000)) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Description must be at most 2000 characters.' });
    }
    if (invitedContacts !== undefined && (!Array.isArray(invitedContacts) || invitedContacts.length > 200)) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'invitedContacts must be a list of at most 200 contacts.' });
    }
    if (category !== undefined && (typeof category !== 'string' || category.length > 80)) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'category must be at most 80 characters.' });
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
      return p.createdBy === user.id && p.status !== 'COMPLETED';
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

    const randomCode = crypto.randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase().padEnd(6, 'X');
    const podId = `pod_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const baseDepositAmount = Number(depositTier);
    const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
    const totalChargedAmount = baseDepositAmount + platformFee;

    // Check Welcome Match Eligibility (Matches 100% of selected deposit tier for verified KYC first pod creation)
    const creatorUser = users.find(u => u.id === user.id);
    const isKycVerified = user.kycStatus === 'VERIFIED' || creatorUser?.kycStatus === 'VERIFIED';
    // One welcome match per verified person: checked against every identity key
    // (bank fingerprint) this person has, not just this account.
    const creatorIdentityKeys = getIdentityKeys(creatorUser || user);
    const identityAlreadyMatched = creatorIdentityKeys.some(key => welcomeMatchGrants.some(g => g.identityKey === key));
    const isEligibleForWelcomeMatch = isKycVerified && !creatorUser?.welcomeMatchReceived && creatorIdentityKeys.length > 0 && !identityAlreadyMatched;
    const welcomeMatchAmount = isEligibleForWelcomeMatch ? baseDepositAmount : 0;

    // Charge the creator's first deposit from their Treasury balance. The welcome
    // match goes only to the pod's non-withdrawable contingency buffer.
    if (!creatorUser || !debitLedger(creatorUser, totalChargedAmount)) {
      return insufficientFunds(res, totalChargedAmount, creatorUser || user);
    }
    if (welcomeMatchAmount > 0) {
      creatorUser.welcomeMatchReceived = true;
      creatorUser.welcomeMatchAmountUsd = welcomeMatchAmount;
      const grantedAt = new Date().toISOString();
      for (const identityKey of creatorIdentityKeys) {
        welcomeMatchGrants.push({
          id: newLedgerId('wm'),
          identityKey,
          userId: creatorUser.id,
          podId,
          amountUsd: welcomeMatchAmount,
          usedUsd: 0,
          releasedUsd: 0,
          status: 'ACTIVE',
          grantedAt,
        });
      }
    }

    // Process initial deposit record for creator (Member #1)
    const creatorMemberId = `pm_${Date.now()}_1`;
    const initialDeposit: Deposit = {
      id: newLedgerId('dep_init'),
      membershipId: creatorMemberId,
      podId: podId,
      cycleId: `cyc_w1`,
      userId: user.id,
      userName: user.displayName,
      amount: baseDepositAmount,
      stripePaymentId: newLedgerId('ledger_create_pod'),
      status: 'COMPLETE',
      createdAt: new Date().toISOString(),
    };
    deposits.unshift(initialDeposit);

    const newPod: Pod = {
      id: podId,
      name: name.trim(),
      description: description || 'Community gig worker mutual savings pool',
      category: category || 'General Gig Workers',
      podType: requestedPodType,
      activationPolicy: requestedActivationPolicy,
      inviteWindowDays: Number(inviteWindowDays) || 7,
      autoOpenOnExpire: autoOpenOnExpire !== false,
      inviteCode: randomCode,
      invitedContacts: sanitizeInvitedContacts(invitedContacts, user),
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
      stewardshipMode: 'CREATOR_MANAGED',
      managedBy: 'CREATOR',
      creatorLastInRotation: true,
      systemEscrowActive: false,
      systemEscrowDrawnUsd: 0,
      members: [
        {
          id: creatorMemberId,
          podId: podId,
          userId: user.id,
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          platform: user.platform,
          rotationIndex: Number(sizeTier) - 1, // Pod creator is placed in the final rotation slot (Slot #N) by default
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
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
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
    if (!Array.isArray(contacts) || contacts.length > 100) {
      return res.status(400).json({ error: 'Contacts list must be an array of at most 100 contacts' });
    }

    if (!pod.invitedContacts) pod.invitedContacts = [];

    const addedContacts: InvitedContact[] = [];

    contacts.forEach((c: { name: string; emailOrPhone: string }) => {
      if (!c || typeof c.emailOrPhone !== 'string' || !c.emailOrPhone.trim() || c.emailOrPhone.length > 254) return;
      if (c.name !== undefined && (typeof c.name !== 'string' || c.name.length > 120)) return;
      const cleanContact = c.emailOrPhone.trim().toLowerCase();
      
      // Check if existing
      const existsInPod = pod.invitedContacts.some(ic => ic.emailOrPhone.toLowerCase() === cleanContact);
      if (existsInPod) return;

      // Cross reference with registered users
      const registeredUser = users.find(u => u && u.email && u.email.toLowerCase() === cleanContact);

      const newInvitedContact: InvitedContact = {
        id: `ic_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
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
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
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
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
      }
      const { inviteCode, refUserId, refName } = req.body || {};
      const pod = await findPodById(req.params.id);

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

      if (pod.status !== 'FORMING') {
        return res.status(400).json({ error: 'POD_NOT_FORMING', message: 'This pod is no longer accepting new members.' });
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
        return (user.emailVerified && userEmailClean && icEmail === userEmailClean) || (ic.memberUserId && ic.memberUserId === user.id);
      });

      // Check Trusted Circle restrictions if pod is TRUSTED_CIRCLE and user is not creator
      if (pod.podType === 'TRUSTED_CIRCLE' && pod.createdBy !== user.id) {
        const isInvited = !!contactMatch;
        const expectedCode = String(pod.inviteCode || '').trim().toUpperCase();
        const providedCode = String(inviteCode || '').trim().toUpperCase();
        const isCodeValid = expectedCode.length > 0 && providedCode === expectedCode;

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

      // Charge the first deposit + 5% platform fee before adding the member.
      const baseDepositAmount = pod.depositTier || 20;
      const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
      const totalChargedAmount = baseDepositAmount + platformFee;
      const targetUser = users.find(u => u && u.id === user.id) || user;
      if (!debitLedger(targetUser, totalChargedAmount)) {
        return insufficientFunds(res, totalChargedAmount, targetUser);
      }
      saveUsersToDisk();

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

      // Record completed deposit for joining member
      const joinDeposit: Deposit = {
        id: newLedgerId('dep_join'),
        membershipId: newMember.id,
        podId: pod.id,
        cycleId: `cyc_w${pod.currentCycleWeek || 1}`,
        userId: user.id,
        userName: user.displayName || 'Verified Member',
        amount: baseDepositAmount,
        stripePaymentId: newLedgerId('ledger_join_pod'),
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
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
      }
      const { signatureName } = req.body || {};
      const pod = await findPodById(req.params.id, user);

      if (!pod) {
        return res.status(404).json({ error: 'Pod not found' });
      }

      // Signing never adds members: joining (with invite, KYC and payment checks) does.
      const member = pod.members.find(m => m.userId === user.id);
      if (!member) {
        return res.status(403).json({ error: 'NOT_A_MEMBER', message: 'Join this pod before signing its agreement.' });
      }

      member.agreementSignedAt = new Date().toISOString();
      member.agreementSignatureName = (typeof signatureName === 'string' && signatureName.trim() ? signatureName.trim().slice(0, 120) : '') || user.displayName;

      savePodsToDisk();

      addAuditLog(
        pod.id,
        user.id,
        user.displayName,
        'AGREEMENT_SIGNED',
        `Signed legal Pod Agreement v2.0-2026 as "${member.agreementSignatureName}". Confirmed understanding of fixed rotation order, automated weekly deposit withdrawals (Thursdays), automated rotation payouts (Fridays), ${TREASURY_PROGRAM_ENABLED ? 'FDIC pass-through coverage, ' : ''}and delinquency handling.`
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
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const pod = await findPodById(req.params.id, user);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    const { forceEarly } = req.body || {};

    if (pod.createdBy !== user.id && !checkIsAdmin(req)) {
      return res.status(403).json({ error: 'Only the pod creator can lock rotation and activate the pod.' });
    }
    if (pod.status !== 'FORMING') {
      return res.status(400).json({ error: 'POD_NOT_FORMING', message: 'This pod has already been activated.' });
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

    // Separate creator from non-creator members to guarantee creator is assigned to the final rotation slot (skin-in-the-game)
    const creatorMember = pod.members.find(m => m.userId === pod.createdBy);
    const nonCreatorMembers = pod.members.filter(m => m.userId !== pod.createdBy);

    // Fixed 1-time random shuffle algorithm (Fisher-Yates) on non-creator members
    const shuffledNonCreators = [...nonCreatorMembers];
    for (let i = shuffledNonCreators.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [shuffledNonCreators[i], shuffledNonCreators[j]] = [shuffledNonCreators[j], shuffledNonCreators[i]];
    }

    // Assign rotation indices: 0 to N-2 for non-creators
    shuffledNonCreators.forEach((m, idx) => {
      m.rotationIndex = idx;
    });

    const finalOrderedMembers: PodMembership[] = [...shuffledNonCreators];
    if (creatorMember) {
      creatorMember.rotationIndex = finalOrderedMembers.length; // Final slot (e.g. slot 4 in 5-member pod, slot 19 in 20-member pod)
      finalOrderedMembers.push(creatorMember);
    }

    pod.members = finalOrderedMembers;
    pod.creatorLastInRotation = true;
    syncHostRewardRecipient(pod);
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
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
      }
      const pod = await findPodById(req.params.id, user);
      if (!pod) {
        return res.status(404).json({ error: 'Pod not found' });
      }

      const isCreator = pod.createdBy === user.id || checkIsAdmin(req);
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
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
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
    if (pod.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'POD_NOT_ACTIVE', message: 'Deposits can only be made into an active pod.' });
    }
    const cycleId = `cyc_w${pod.currentCycleWeek}`;
    if (deposits.some(d => d && d.podId === pod.id && d.userId === user.id && d.cycleId === cycleId && d.status === 'COMPLETE')) {
      return res.status(409).json({ error: 'ALREADY_DEPOSITED', message: 'You have already made this week\'s deposit.' });
    }

    // Deduct from Treasury balance with 5% platform fee
    const baseDepositAmount = pod.depositTier;
    const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
    const totalChargedAmount = baseDepositAmount + platformFee;
    const stripePaymentId = newLedgerId('ledger_deposit');

    const targetUser = users.find(u => u.id === user.id) || user;
    if (!debitLedger(targetUser, totalChargedAmount)) {
      return insufficientFunds(res, totalChargedAmount, targetUser);
    }

    const newDeposit: Deposit = {
      id: newLedgerId('dep'),
      membershipId: member.id,
      podId: pod.id,
      cycleId,
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
    saveUsersToDisk();

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

  // Concurrency Lock Map to eliminate race conditions on cycle processing and withdrawals
  const activeCycleLocks = new Set<string>();

  // 10. Process Weekly Cycle Payout via Stripe Treasury OutboundTransfer (Option A: Automated Earmarked Settlement)
  app.post(['/api/pods/:id/cycle/process', '/pods/:id/cycle/process'], async (req: Request, res: Response) => {
    if (!isSystemRequest(req)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Cycle payouts are processed by the platform scheduler or an administrator.' });
    }
    const user = getCurrentUser(req) || ({ id: 'system', displayName: 'Platform Scheduler' } as User);

    const podId = req.params.id;
    if (activeCycleLocks.has(podId)) {
      return res.status(409).json({ error: 'LOCKED', message: 'A payout cycle is already being processed for this pod. Please retry in a moment.' });
    }

    activeCycleLocks.add(podId);
    try {
      const pod = await findPodById(podId, user);

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

      // Atomic idempotent protection against double-payout
      if (recipientMember.hasReceivedPayout && recipientMember.payoutCycleWeek === pod.currentCycleWeek) {
        return res.status(400).json({ 
          error: 'ALREADY_PAID', 
          message: `Payout for cycle week ${pod.currentCycleWeek} has already been processed for ${recipientMember.displayName}.` 
        });
      }

      const recipientUser = users.find(u => u.id === recipientMember.userId);
      if (!recipientUser) {
        return res.status(400).json({ error: 'RECIPIENT_NOT_FOUND', message: 'The rotation recipient has no account record.' });
      }
      // Only pay out what was actually collected this cycle.
      const grossPayoutAmount = roundCents(Number(pod.currentWeeklyCollected) || 0);
      if (grossPayoutAmount <= 0) {
        return res.status(400).json({ error: 'NOTHING_COLLECTED', message: 'No deposits have been collected for this cycle yet.' });
      }
      
      // Apply 10% payout fee tag (e.g. $400 pool - 10% ($40) = $360 net paid to user)
      const totalPayoutFee = Math.round(grossPayoutAmount * 0.10 * 100) / 100;
      const netPayoutAmount = grossPayoutAmount - totalPayoutFee;

      const isAutonomousAI = pod.stewardshipMode === 'AUTONOMOUS_AI';
      // Identify active 3% weekly reward beneficiary (defaults to creator; transfers if creator switches spot)
      // 3% host reward: whoever holds the final rotation slot (normally the creator).
      const activeRewardRecipientUserId = getFinalSlotMember(pod)?.userId || pod.createdBy;
      const hostRewardUser = users.find(u => u.id === activeRewardRecipientUserId);
      const isBeneficiaryActiveInPod = pod.members.some(m => m.userId === activeRewardRecipientUserId) && isHostRewardEligible(pod);
      const isTransferredFromCreator = activeRewardRecipientUserId !== pod.createdBy;

      let creatorHostReward = 0;
      let platformFeeRetained = totalPayoutFee;

      if (!isAutonomousAI && hostRewardUser && isBeneficiaryActiveInPod) {
        creatorHostReward = Math.round(grossPayoutAmount * 0.03 * 100) / 100; // 3% of gross pool
        platformFeeRetained = Math.round((totalPayoutFee - creatorHostReward) * 100) / 100; // 7% retained by platform
        
        // Credit Active Host/Spot Beneficiary Treasury ledger with 3% host stewardship reward
        creditLedger(hostRewardUser, creatorHostReward);
        hostRewardUser.treasury.totalPayoutsReceivedUsd = roundCents((hostRewardUser.treasury.totalPayoutsReceivedUsd || 0) + creatorHostReward);
        pod.creatorStewardshipEarningsUsd = (pod.creatorStewardshipEarningsUsd || 0) + creatorHostReward;

        // Notify Beneficiary of Host Reward disbursement
        const rewardTitle = isTransferredFromCreator
          ? '🎉 3% Weekly Spot Stewardship Reward Disbursed'
          : '🎉 3% Host Stewardship Reward Disbursed';
        const rewardMsg = isTransferredFromCreator
          ? `You earned +$${creatorHostReward.toFixed(2)} (3% of $${grossPayoutAmount.toFixed(2)} pool) for holding the final rotation stewardship spot in "${pod.name}" (Week ${pod.currentCycleWeek} payout)! Funds added to your Stripe Treasury.`
          : `You earned +$${creatorHostReward.toFixed(2)} (3% of $${grossPayoutAmount.toFixed(2)} pool) for hosting "${pod.name}" Week ${pod.currentCycleWeek} payout! Funds added to your Stripe Treasury.`;

        createNotification({
          userId: hostRewardUser.id,
          type: 'PAYOUT_RECEIVED',
          title: rewardTitle,
          message: rewardMsg,
          podId: pod.id,
        });

        addAuditLog(
          pod.id,
          hostRewardUser.id,
          hostRewardUser.displayName,
          'CREATOR_HOST_REWARD_DISBURSED',
          `🎉 Disbursed 3% Host Stewardship Reward ($${creatorHostReward.toFixed(2)}) to ${isTransferredFromCreator ? 'Spot Beneficiary (Transferred via Creator Swap)' : 'Pod Creator'} ${hostRewardUser.displayName} for Week ${pod.currentCycleWeek} payout. Remaining 7% ($${platformFeeRetained.toFixed(2)}) retained for Platform Treasury.`,
          { 
            recipientUserId: hostRewardUser.id,
            isTransferredFromCreator,
            creatorHostReward, 
            platformFeeRetained, 
            grossPayoutAmount, 
            totalPayoutFee,
            weekNumber: pod.currentCycleWeek 
          }
        );
      }

      // The payout is credited to the recipient's Treasury ledger ("earmarked").
      // Real money leaves only when the member withdraws (Stripe transfer), so
      // paying here AND transferring would pay twice.
      const stripeTransferId = newLedgerId('ledger_payout');
      creditLedger(recipientUser, netPayoutAmount);
      recipientUser.treasury.totalPayoutsReceivedUsd = roundCents((recipientUser.treasury.totalPayoutsReceivedUsd || 0) + netPayoutAmount);

      recipientMember.hasReceivedPayout = true;
      recipientMember.payoutCycleWeek = pod.currentCycleWeek;
      recipientMember.payoutClaimStatus = 'EARMARKED_IN_TREASURY';
      recipientMember.payoutStripeTransferId = stripeTransferId;
      recipientMember.payoutProcessedAt = new Date().toISOString();
      recipientMember.payoutNetAmountUsd = netPayoutAmount;

      // Reset weekly collected for next cycle
      pod.currentWeeklyCollected = 0;
    
    // Log audit entry with Option A details & 10% fee breakdown
    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'PAYOUT_EXECUTED',
      `Week ${pod.currentCycleWeek} payout credited to Treasury ledger (${stripeTransferId}) for ${recipientMember.displayName} (Rotation #${recipientMember.rotationIndex}). Gross Pool: $${grossPayoutAmount.toFixed(2)}. 10% payout fee deducted: -$${totalPayoutFee.toFixed(2)} (${creatorHostReward > 0 ? `3% / $${creatorHostReward.toFixed(2)} to Creator Host, 7% / $${platformFeeRetained.toFixed(2)} to Platform` : `100% / $${totalPayoutFee.toFixed(2)} to Platform System Escrow`}). Net amount paid to user: $${netPayoutAmount.toFixed(2)}. Funds earmarked in member's Stripe Treasury account.`,
      { 
        stripeTransferId, 
        recipientId: recipientMember.userId, 
        grossPayoutAmount,
        payoutFee: totalPayoutFee,
        creatorHostReward,
        platformFeeRetained,
        stewardshipMode: pod.stewardshipMode || 'CREATOR_MANAGED',
        netPayoutAmount, 
        weekNumber: pod.currentCycleWeek,
        payoutClaimStatus: 'EARMARKED_IN_TREASURY'
      }
    );

    // Advance cycle week automatically - Option A ensures no rotation pauses
    if (pod.currentCycleWeek >= pod.totalCycles) {
      pod.status = 'COMPLETED';
      releaseContingencyBuffer(pod);
      // Grant completed pod credit to members
      pod.members.forEach(m => {
        const u = users.find(usr => usr.id === m.userId);
        if (u) u.completedPodsCount += 1;
      });
    } else {
      pod.currentCycleWeek += 1;
    }

    savePodsToDisk();
    saveUsersToDisk();

    res.json({
      success: true,
      stripeTransferId,
      grossPayoutAmount,
      payoutFee: totalPayoutFee,
      creatorHostReward,
      platformFeeRetained,
      creatorStewardshipEarningsUsd: pod.creatorStewardshipEarningsUsd || 0,
      payoutAmount: netPayoutAmount,
      recipientName: recipientMember.displayName,
      payoutClaimStatus: 'EARMARKED_IN_TREASURY',
      nextCycleWeek: pod.currentCycleWeek,
      podStatus: pod.status,
    });
  } catch (cycleErr: any) {
    console.error('[/api/pods/:id/cycle/process] error:', cycleErr);
    res.status(500).json({ error: 'CYCLE_PROCESSING_FAILED', message: cycleErr?.message || 'Failed to process cycle payout' });
  } finally {
    activeCycleLocks.delete(podId);
  }
  });

  // 10b. Withdraw Treasury ledger balance to the member's bank via their Stripe
  // Connect account (Stripe pays out to the bank collected during onboarding).
  const activeWithdrawals = new Set<string>();
  app.post('/api/treasury/payouts/withdraw', async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const { podId } = req.body || {};
    const targetUser = users.find(u => u.id === user.id) || user;
    const balance = Number(targetUser.treasury?.balanceUsd) || 0;
    const withdrawAmount = req.body?.amount === undefined ? roundCents(balance) : parseMoneyAmount(req.body.amount);
    if (withdrawAmount === null || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Enter a valid withdrawal amount.' });
    }

    const accountId = targetUser.treasury?.stripeAccountId || '';
    const payoutsReady = targetUser.kycStatus === 'VERIFIED' && targetUser.treasury?.status === 'ACTIVE' && accountId.startsWith('acct_');
    if (!payoutsReady) {
      return res.status(400).json({ error: 'PAYOUT_ACCOUNT_REQUIRED', message: 'Finish Stripe onboarding (identity + bank account) before withdrawing.' });
    }

    if (activeWithdrawals.has(targetUser.id)) {
      return res.status(409).json({ error: 'WITHDRAWAL_IN_PROGRESS', message: 'A withdrawal is already being processed.' });
    }
    activeWithdrawals.add(targetUser.id);
    try {
      if (withdrawals.some(w => w.userId === targetUser.id && w.status === 'NEEDS_REVIEW')) {
        return res.status(409).json({ error: 'WITHDRAWAL_UNDER_REVIEW', message: 'A previous withdrawal is being verified. Please contact support before withdrawing again.' });
      }
      // Debit first so concurrent requests can't spend the same balance.
      if (!debitLedger(targetUser, withdrawAmount)) {
        return insufficientFunds(res, withdrawAmount, targetUser);
      }
      const nowIso = new Date().toISOString();
      const withdrawal: WithdrawalRecord = {
        id: newLedgerId('wd'),
        userId: targetUser.id,
        amountUsd: withdrawAmount,
        destinationAccountId: accountId,
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      withdrawals.unshift(withdrawal);

      // The debit and the pending record must be durable before money leaves.
      if (!(await persistNow())) {
        creditLedger(targetUser, withdrawAmount);
        withdrawals = withdrawals.filter(w => w.id !== withdrawal.id);
        return res.status(503).json({ error: 'WITHDRAWAL_UNAVAILABLE', message: 'Withdrawals are temporarily unavailable. Your balance has not changed.' });
      }

      let withdrawTransferId: string;
      try {
        if (DEMO_MODE) {
          withdrawTransferId = `tr_demo_${withdrawal.id}`;
        } else {
          const transfer = await transferToConnectedAccount({
            destinationAccountId: accountId,
            amountUsd: withdrawAmount,
            idempotencyKey: withdrawal.id,
            description: 'MutualPool member withdrawal',
            metadata: { userId: targetUser.id, withdrawalId: withdrawal.id },
          });
          withdrawTransferId = transfer.id;
        }
      } catch (stripeErr: any) {
        withdrawal.updatedAt = new Date().toISOString();
        withdrawal.error = String(stripeErr?.message || stripeErr).slice(0, 500);
        // Stripe definitively refused the request: nothing was transferred, so refund the ledger.
        const definitelyRejected = ['StripeInvalidRequestError', 'StripeCardError', 'StripePermissionError', 'StripeAuthenticationError'].includes(stripeErr?.type)
          || (typeof stripeErr?.statusCode === 'number' && stripeErr.statusCode >= 400 && stripeErr.statusCode < 500 && stripeErr.statusCode !== 408 && stripeErr.statusCode !== 429);
        if (definitelyRejected) {
          withdrawal.status = 'FAILED';
          creditLedger(targetUser, withdrawAmount);
          saveUsersToDisk();
          console.error('[Withdrawal] Stripe rejected transfer; ledger debit rolled back:', withdrawal.error);
          return res.status(502).json({ error: 'WITHDRAWAL_FAILED', message: 'The transfer could not be completed. Your balance has not changed.' });
        }
        // Ambiguous (timeout, outage): the transfer may have gone through. Keep the
        // debit and flag for reconciliation against Stripe using the idempotency key.
        withdrawal.status = 'NEEDS_REVIEW';
        saveUsersToDisk();
        console.error('[Withdrawal] Ambiguous Stripe failure; withdrawal flagged for review:', withdrawal.id, withdrawal.error);
        return res.status(502).json({ error: 'WITHDRAWAL_PENDING_REVIEW', message: 'We could not confirm the transfer with Stripe. Your withdrawal is being verified and your balance will be corrected if it did not go through.' });
      }

      withdrawal.status = 'COMPLETED';
      withdrawal.stripeTransferId = withdrawTransferId;
      withdrawal.updatedAt = new Date().toISOString();

      if (podId) {
        const member = pods.find(p => p.id === podId)?.members.find(m => m.userId === targetUser.id);
        if (member) member.payoutClaimStatus = 'DISBURSED_TO_BANK';
      } else {
        pods.forEach(p => p.members.forEach(m => {
          if (m.userId === targetUser.id && m.payoutClaimStatus === 'EARMARKED_IN_TREASURY') {
            m.payoutClaimStatus = 'DISBURSED_TO_BANK';
          }
        }));
      }

      savePodsToDisk();
      saveUsersToDisk();

      addAuditLog(
        podId,
        targetUser.id,
        targetUser.displayName,
        'PAYOUT_EXECUTED',
        `Withdrew $${withdrawAmount.toFixed(2)} from Treasury ledger to connected Stripe account (transfer ${withdrawTransferId}).`,
        { withdrawTransferId, withdrawAmount }
      );

      res.json({
        success: true,
        withdrawTransferId,
        amountWithdrawn: withdrawAmount,
        remainingBalance: targetUser.treasury.balanceUsd,
        user: targetUser,
      });
    } finally {
      activeWithdrawals.delete(targetUser.id);
    }
  });

  // =========================================================================
  // 10c. Synchronized Platform Settlement Heartbeat (Thursdays 12AM Deposits / Fridays 12AM Payouts)
  // =========================================================================
  let lastThursdaySweepDate = '';
  let lastFridaySweepDate = '';
  let lastThursdaySweepResult: SweepExecutionResult | null = null;
  let lastFridaySweepResult: SweepExecutionResult | null = null;

  async function executeThursdayDepositSweep(): Promise<SweepExecutionResult> {
    const executedAt = new Date().toISOString();
    const details: string[] = [];
    let activePodsEvaluated = 0;
    let totalTransactionsCount = 0;
    let totalVolumeUsd = 0;
    let failedCount = 0;

    let activePods = pods.filter(p => p && p.status === 'ACTIVE');

    // DEMO_MODE only: auto-activate a pod so the sweep can be exercised locally.
    if (DEMO_MODE && activePods.length === 0) {
      const candidatePod = pods.find(p => p && Array.isArray(p.members) && p.members.length >= 2) ||
                           pods.find(p => p && Array.isArray(p.members) && p.members.length >= 1);
      if (candidatePod) {
        candidatePod.status = 'ACTIVE';
        candidatePod.currentCycleWeek = 1;
        candidatePod.currentWeeklyCollected = 0;
        candidatePod.activatedAt = new Date().toISOString();
        // Clear previous simulation deposits for this candidate pod so fresh sweeps can be tested repeatedly
        deposits = deposits.filter(d => !d || d.podId !== candidatePod.id);
        if (Array.isArray(candidatePod.members)) {
          candidatePod.members.forEach((m, idx) => {
            m.rotationIndex = idx;
            m.hasReceivedPayout = false;
            m.payoutCycleWeek = undefined;
            m.payoutClaimStatus = undefined;
          });
        }
        activePods = [candidatePod];
        details.push(`[${candidatePod.name}] Auto-activated for cycle rotation (Week 1) for sweep simulation.`);
      }
    }

    activePodsEvaluated = activePods.length;

    if (activePodsEvaluated === 0) {
      details.push('Notice: There are currently no pods available in rotation. Create a pod to simulate weekly member deposit sweeps.');
      return {
        sweepType: 'THURSDAY_DEPOSITS',
        executedAt,
        success: true,
        activePodsEvaluated: 0,
        totalTransactionsCount: 0,
        totalVolumeUsd: 0,
        failedCount: 0,
        details,
      };
    }

    for (const pod of activePods) {
      if (!pod || !Array.isArray(pod.members) || pod.members.length === 0) continue;
      const cycleWeek = pod.currentCycleWeek || 1;
      const baseDepositAmount = pod.depositTier || 20;
      const platformFee = Math.round(baseDepositAmount * 0.05 * 100) / 100;
      const totalChargedAmount = baseDepositAmount + platformFee;

      for (const member of pod.members) {
        if (!member || !member.userId) continue;

        // Check if member already deposited for this pod's current cycle week
        const alreadyDeposited = (deposits || []).some(d =>
          d &&
          d.podId === pod.id &&
          d.userId === member.userId &&
          d.cycleId === `cyc_w${cycleWeek}` &&
          d.status === 'COMPLETE'
        );

        if (alreadyDeposited) {
          continue;
        }

        const targetUser = users.find(u => u && u.id === member.userId);
        if (DEMO_MODE && targetUser) {
          if (!targetUser.treasury) {
            targetUser.treasury = createUserRecord(targetUser.id, targetUser.email, targetUser.displayName).treasury;
          }
          if ((targetUser.treasury.balanceUsd || 0) < totalChargedAmount) {
            // DEMO_MODE only: replenish test balances so sweeps simulate smoothly
            targetUser.treasury.balanceUsd = Math.max(100, (targetUser.treasury.balanceUsd || 0) + totalChargedAmount * 2);
          }
        }
        const userBalance = targetUser?.treasury?.balanceUsd || 0;

        if (targetUser && debitLedger(targetUser, totalChargedAmount)) {
          const stripePaymentId = newLedgerId('ledger_auto_thu');
          const newDeposit: Deposit = {
            id: `dep_thu_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            membershipId: member.id || `mem_${Date.now()}`,
            podId: pod.id,
            cycleId: `cyc_w${cycleWeek}`,
            userId: member.userId,
            userName: member.displayName || targetUser?.displayName || 'Member',
            amount: baseDepositAmount,
            stripePaymentId,
            status: 'COMPLETE',
            createdAt: new Date().toISOString(),
            scheduledSweepType: 'THURSDAY_AUTOMATED',
          };

          deposits.unshift(newDeposit);
          pod.currentWeeklyCollected = (pod.currentWeeklyCollected || 0) + baseDepositAmount;
          totalTransactionsCount += 1;
          totalVolumeUsd += baseDepositAmount;

          try {
            createNotification({
              userId: member.userId,
              type: 'DEPOSIT_CONFIRMED',
              title: '🗓️ Thursday Automated Deposit Debited',
              message: `Your weekly contribution of $${baseDepositAmount.toFixed(2)} was successfully auto-debited for "${pod.name}" (Week ${cycleWeek}). Funds secured in Treasury escrow for Friday payout settlement.`,
              podId: pod.id,
            });
          } catch (notifErr) {
            console.warn('[Sweep Notification Warning]', notifErr);
          }

          try {
            addAuditLog(
              pod.id,
              member.userId,
              member.displayName || targetUser?.displayName || 'Member',
              'THURSDAY_AUTOMATED_DEPOSIT_SWEEP',
              `Thursday 12:00 AM Automated Sweep: Auto-debited $${baseDepositAmount.toFixed(2)} ($${platformFee.toFixed(2)} fee, $${totalChargedAmount.toFixed(2)} total) from ${member.displayName || member.userId} for Week ${cycleWeek}. Stripe Ref: ${stripePaymentId}.`,
              { baseDepositAmount, platformFee, totalChargedAmount, cycleWeek, scheduledSweep: 'THURSDAY_12AM' }
            );
          } catch (auditErr) {
            console.warn('[Sweep AuditLog Warning]', auditErr);
          }

          details.push(`[${pod.name}] Auto-debited $${baseDepositAmount} from ${member.displayName || member.userId} (Week ${cycleWeek})`);
        } else {
          failedCount += 1;
          let bufferDrawn = false;
          if (pod.contingencyBufferUsd && pod.contingencyBufferUsd >= baseDepositAmount) {
            pod.contingencyBufferUsd -= baseDepositAmount;
            pod.currentWeeklyCollected = (pod.currentWeeklyCollected || 0) + baseDepositAmount;
            bufferDrawn = true;

            try {
              addAuditLog(
                pod.id,
                'SYSTEM',
                'MutualPool Contingency Engine',
                'CONTINGENCY_BUFFER_BRIDGED_DEPOSIT',
                `🛡️ First-Cycle Contingency Buffer bridged $${baseDepositAmount.toFixed(2)} deposit for ${member.displayName || member.userId} during Thursday sweep so Friday payout remains 100% on schedule. Remaining buffer: $${pod.contingencyBufferUsd.toFixed(2)}.`,
                { bridgedUserId: member.userId, amount: baseDepositAmount, cycleWeek }
              );
            } catch (auditErr) {
              console.warn('[Sweep AuditLog Warning]', auditErr);
            }
          }

          try {
            createNotification({
              userId: member.userId,
              type: 'PAYMENT_FAILED',
              title: '⚠️ Thursday Deposit Attention Required',
              message: `Thursday auto-debit for "${pod.name}" had insufficient balance ($${userBalance.toFixed(2)}). 24-hour grace active before Friday 12:00 AM payout settlement. Please fund your Treasury balance.`,
              podId: pod.id,
            });
          } catch (notifErr) {
            console.warn('[Sweep Notification Warning]', notifErr);
          }

          details.push(`[${pod.name}] Incomplete debit for ${member.displayName || member.userId}: Balance $${userBalance} < $${totalChargedAmount}${bufferDrawn ? ' (Contingency buffer bridged)' : ''}`);
        }
      }
    }

    try {
      savePodsToDisk();
      saveUsersToDisk();
    } catch (saveErr) {
      console.warn('[Sweep Save Warning]', saveErr);
    }

    return {
      sweepType: 'THURSDAY_DEPOSITS',
      executedAt,
      success: true,
      activePodsEvaluated,
      totalTransactionsCount,
      totalVolumeUsd,
      failedCount,
      details,
    };
  }

  async function executeFridayPayoutSweep(): Promise<SweepExecutionResult> {
    const executedAt = new Date().toISOString();
    const details: string[] = [];
    let activePodsEvaluated = 0;
    let totalTransactionsCount = 0;
    let totalVolumeUsd = 0;
    let failedCount = 0;

    let activePods = pods.filter(p => p && p.status === 'ACTIVE');

    // DEMO_MODE only: auto-activate a funded pod so the sweep can be exercised locally.
    if (DEMO_MODE && activePods.length === 0) {
      const candidatePod = pods.find(p => p && Array.isArray(p.members) && p.members.length >= 2) ||
                           pods.find(p => p && Array.isArray(p.members) && p.members.length >= 1);
      if (candidatePod) {
        candidatePod.status = 'ACTIVE';
        candidatePod.currentCycleWeek = 1;
        const tier = candidatePod.depositTier || 20;
        candidatePod.currentWeeklyCollected = tier * (candidatePod.members?.length || 2);
        if (Array.isArray(candidatePod.members)) {
          candidatePod.members.forEach((m, idx) => {
            m.rotationIndex = idx;
            m.hasReceivedPayout = false;
            m.payoutCycleWeek = undefined;
            m.payoutClaimStatus = undefined;
          });
        }
        activePods = [candidatePod];
        details.push(`[${candidatePod.name}] Auto-activated for cycle rotation with funded pot for Friday payout simulation.`);
      }
    }

    activePodsEvaluated = activePods.length;

    if (activePodsEvaluated === 0) {
      details.push('Notice: There are currently no pods available in rotation. Create a pod to simulate weekly member payout disbursements.');
      return {
        sweepType: 'FRIDAY_PAYOUTS',
        executedAt,
        success: true,
        activePodsEvaluated: 0,
        totalTransactionsCount: 0,
        totalVolumeUsd: 0,
        failedCount: 0,
        details,
      };
    }

    for (const pod of activePods) {
      if (!pod || !Array.isArray(pod.members) || pod.members.length === 0) continue;
      const cycleWeek = pod.currentCycleWeek || 1;
      const targetIndex = cycleWeek - 1;
      const recipientMember = pod.members.find(m => m && m.rotationIndex === targetIndex);

      if (!recipientMember) {
        failedCount += 1;
        details.push(`[${pod.name}] No member assigned for rotation index ${targetIndex}.`);
        continue;
      }

      if (recipientMember.hasReceivedPayout && recipientMember.payoutCycleWeek === cycleWeek) {
        details.push(`[${pod.name}] Recipient ${recipientMember.displayName || recipientMember.userId} already received Week ${cycleWeek} payout.`);
        continue;
      }

      const recipientUser = users.find(u => u && u.id === recipientMember.userId);
      // Only pay out what was actually collected this cycle.
      const grossPayoutAmount = roundCents(Number(pod.currentWeeklyCollected) || 0);
      if (!recipientUser || grossPayoutAmount <= 0) {
        failedCount += 1;
        details.push(`[${pod.name}] Skipped Week ${cycleWeek} payout: ${!recipientUser ? 'recipient account not found' : 'no deposits collected'}.`);
        continue;
      }
      const totalPayoutFee = Math.round(grossPayoutAmount * 0.10 * 100) / 100;
      const netPayoutAmount = Math.max(0, grossPayoutAmount - totalPayoutFee);

      const isAutonomousAI = pod.stewardshipMode === 'AUTONOMOUS_AI';
      // 3% host reward: whoever holds the final rotation slot (normally the creator).
      const activeRewardRecipientUserId = getFinalSlotMember(pod)?.userId || pod.createdBy;
      const hostRewardUser = users.find(u => u && u.id === activeRewardRecipientUserId);
      const isBeneficiaryActiveInPod = pod.members.some(m => m && m.userId === activeRewardRecipientUserId) && isHostRewardEligible(pod);
      const isTransferredFromCreator = activeRewardRecipientUserId !== pod.createdBy;

      let creatorHostReward = 0;
      let platformFeeRetained = totalPayoutFee;

      if (!isAutonomousAI && hostRewardUser && isBeneficiaryActiveInPod) {
        creatorHostReward = Math.round(grossPayoutAmount * 0.03 * 100) / 100;
        platformFeeRetained = Math.round((totalPayoutFee - creatorHostReward) * 100) / 100;

        if (!hostRewardUser.treasury) {
          hostRewardUser.treasury = {
            stripeAccountId: '',
            stripeFinAccountId: '',
            balanceUsd: 0,
            pendingInboundUsd: 0,
            totalPayoutsReceivedUsd: 0,
            fdicPassThroughEligible: true,
            status: 'ACTIVE',
          };
        }
        hostRewardUser.treasury.balanceUsd = (hostRewardUser.treasury.balanceUsd || 0) + creatorHostReward;
        hostRewardUser.treasury.totalPayoutsReceivedUsd = (hostRewardUser.treasury.totalPayoutsReceivedUsd || 0) + creatorHostReward;
        pod.creatorStewardshipEarningsUsd = (pod.creatorStewardshipEarningsUsd || 0) + creatorHostReward;

        try {
          const rewardTitle = isTransferredFromCreator
            ? '🎉 Friday 3% Spot Stewardship Reward Disbursed'
            : '🎉 Friday 3% Host Stewardship Reward Disbursed';
          const rewardMsg = isTransferredFromCreator
            ? `You earned +$${creatorHostReward.toFixed(2)} (3% of $${grossPayoutAmount.toFixed(2)} pool) for holding the final rotation stewardship spot in "${pod.name}" Week ${cycleWeek} Friday payout! Funds added to your Stripe Treasury.`
            : `You earned +$${creatorHostReward.toFixed(2)} (3% of $${grossPayoutAmount.toFixed(2)} pool) for hosting "${pod.name}" Week ${cycleWeek} Friday payout! Funds added to your Stripe Treasury.`;

          createNotification({
            userId: hostRewardUser.id,
            type: 'PAYOUT_RECEIVED',
            title: rewardTitle,
            message: rewardMsg,
            podId: pod.id,
          });
        } catch (notifErr) {
          console.warn('[Sweep Notification Warning]', notifErr);
        }
      }

      const stripeTransferId = newLedgerId('ledger_payout_fri');

      if (recipientUser) {
        if (!recipientUser.treasury) {
          recipientUser.treasury = {
            stripeAccountId: '',
            stripeFinAccountId: '',
            balanceUsd: 0,
            pendingInboundUsd: 0,
            totalPayoutsReceivedUsd: 0,
            fdicPassThroughEligible: true,
            status: 'ACTIVE',
          };
        }
        recipientUser.treasury.balanceUsd = (recipientUser.treasury.balanceUsd || 0) + netPayoutAmount;
        recipientUser.treasury.totalPayoutsReceivedUsd = (recipientUser.treasury.totalPayoutsReceivedUsd || 0) + netPayoutAmount;
      }

      recipientMember.hasReceivedPayout = true;
      recipientMember.payoutCycleWeek = cycleWeek;
      recipientMember.payoutClaimStatus = 'EARMARKED_IN_TREASURY';
      recipientMember.payoutStripeTransferId = stripeTransferId;
      recipientMember.payoutProcessedAt = new Date().toISOString();
      recipientMember.payoutNetAmountUsd = netPayoutAmount;

      pod.currentWeeklyCollected = 0;

      try {
        createNotification({
          userId: recipientMember.userId,
          type: 'PAYOUT_READY',
          title: '🎉 Friday Automated Payout Disbursed!',
          message: `Your rotating lump-sum savings payout of $${netPayoutAmount.toFixed(2)} net ($${grossPayoutAmount.toFixed(2)} gross pool - 10% platform fee) for "${pod.name}" has been transferred into your Stripe Treasury account!`,
          podId: pod.id,
        });
      } catch (notifErr) {
        console.warn('[Sweep Notification Warning]', notifErr);
      }

      try {
        addAuditLog(
          pod.id,
          recipientMember.userId,
          recipientMember.displayName || 'Member',
          'FRIDAY_AUTOMATED_PAYOUT_SWEEP',
          `Friday 12:00 AM Automated Payout Sweep: Disbursed $${netPayoutAmount.toFixed(2)} net ($${grossPayoutAmount.toFixed(2)} gross pool, -$${totalPayoutFee.toFixed(2)} 10% fee) to ${recipientMember.displayName || recipientMember.userId} (Rotation #${recipientMember.rotationIndex + 1}) via Stripe Treasury. Transfer Ref: ${stripeTransferId}.`,
          {
            stripeTransferId,
            recipientId: recipientMember.userId,
            grossPayoutAmount,
            payoutFee: totalPayoutFee,
            creatorHostReward,
            platformFeeRetained,
            netPayoutAmount,
            weekNumber: cycleWeek,
            scheduledSweep: 'FRIDAY_12AM',
            payoutClaimStatus: 'EARMARKED_IN_TREASURY',
          }
        );
      } catch (auditErr) {
        console.warn('[Sweep AuditLog Warning]', auditErr);
      }

      const totalCycles = pod.totalCycles || (pod.members ? pod.members.length : 1);
      if (cycleWeek >= totalCycles) {
        pod.status = 'COMPLETED';
        releaseContingencyBuffer(pod);
        pod.members.forEach(m => {
          if (!m || !m.userId) return;
          const u = users.find(usr => usr && usr.id === m.userId);
          if (u) u.completedPodsCount = (u.completedPodsCount || 0) + 1;
        });
        details.push(`[${pod.name}] Final Week ${cycleWeek} payout complete. Pod marked COMPLETED!`);
      } else {
        pod.currentCycleWeek = cycleWeek + 1;
        details.push(`[${pod.name}] Disbursed $${netPayoutAmount.toFixed(2)} to ${recipientMember.displayName || recipientMember.userId}. Advanced to Week ${pod.currentCycleWeek}.`);
      }

      totalTransactionsCount += 1;
      totalVolumeUsd += netPayoutAmount;
    }

    try {
      savePodsToDisk();
      saveUsersToDisk();
    } catch (saveErr) {
      console.warn('[Sweep Save Warning]', saveErr);
    }

    return {
      sweepType: 'FRIDAY_PAYOUTS',
      executedAt,
      success: true,
      activePodsEvaluated,
      totalTransactionsCount,
      totalVolumeUsd,
      failedCount,
      details,
    };
  }

  // Periodic Background Clock: Checks for Thursday 12:00 AM and Friday 12:00 AM sweep windows
  // (server-local time; set TZ for the intended time zone)
  const sweepInterval = setInterval(() => {
    try {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const dateStr = now.toISOString().slice(0, 10);

      // Thursday 12:00 AM Midnight: day 4, hour 0, minute < 5
      if (day === 4 && hour === 0 && minute < 5 && lastThursdaySweepDate !== dateStr) {
        lastThursdaySweepDate = dateStr;
        console.log(`[Scheduled Heartbeat] Executing Thursday 12:00 AM deposit sweep (${dateStr})...`);
        executeThursdayDepositSweep()
          .then(res => {
            lastThursdaySweepResult = res;
            console.log(`[Scheduled Heartbeat] Thursday sweep completed: ${res.totalTransactionsCount} deposits, $${res.totalVolumeUsd}`);
          })
          .catch(err => console.error('[Scheduled Heartbeat] Thursday sweep error:', err));
      }

      // Friday 12:00 AM Midnight: day 5, hour 0, minute < 5
      if (day === 5 && hour === 0 && minute < 5 && lastFridaySweepDate !== dateStr) {
        lastFridaySweepDate = dateStr;
        console.log(`[Scheduled Heartbeat] Executing Friday 12:00 AM payout sweep (${dateStr})...`);
        executeFridayPayoutSweep()
          .then(res => {
            lastFridaySweepResult = res;
            console.log(`[Scheduled Heartbeat] Friday sweep completed: ${res.totalTransactionsCount} payouts, $${res.totalVolumeUsd}`);
          })
          .catch(err => console.error('[Scheduled Heartbeat] Friday sweep error:', err));
      }
    } catch (schedErr) {
      console.error('[Scheduled Heartbeat] Clock tick error:', schedErr);
    }
  }, 60000);
  if (typeof sweepInterval.unref === 'function') {
    sweepInterval.unref();
  }

  // Endpoint: Get Real-Time Platform Settlement Schedule Status
  app.get(['/api/platform/schedule', '/platform/schedule'], (req: Request, res: Response) => {
    if (!getCurrentUser(req)) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const status = getPlatformScheduleStatus(new Date());
    const activePods = pods.filter(p => p && p.status === 'ACTIVE');
    status.activePodsCount = activePods.length;
    status.totalWeeklyTargetVolumeUsd = activePods.reduce((sum, p) => sum + (p.weeklyPoolTarget || (p.depositTier * (p.members?.length || p.sizeTier))), 0);
    status.lastThursdaySweepAt = lastThursdaySweepResult?.executedAt;
    status.lastFridaySweepAt = lastFridaySweepResult?.executedAt;

    // Sweep details name members and amounts: admins only.
    const summarize = (r: SweepExecutionResult | null) => (r && !checkIsAdmin(req) ? { ...r, details: [] } : r);
    res.json({
      ...status,
      lastThursdaySweepResult: summarize(lastThursdaySweepResult),
      lastFridaySweepResult: summarize(lastFridaySweepResult),
    });
  });

  // Endpoint: Manually / Test Trigger Scheduled Sweep
  app.post(['/api/platform/schedule/sweep', '/platform/schedule/sweep'], async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    if (!isSystemRequest(req)) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Sweeps are run by the platform scheduler or an administrator.' });
    }
    const { sweepType } = req.body || {};

    if (sweepType !== 'THURSDAY_DEPOSITS' && sweepType !== 'FRIDAY_PAYOUTS') {
      return res.status(400).json({ 
        success: false,
        error: 'INVALID_SWEEP_TYPE', 
        message: 'sweepType must be THURSDAY_DEPOSITS or FRIDAY_PAYOUTS' 
      });
    }

    try {
      let result: SweepExecutionResult;
      if (sweepType === 'THURSDAY_DEPOSITS') {
        result = await executeThursdayDepositSweep();
        lastThursdaySweepResult = result;
      } else {
        result = await executeFridayPayoutSweep();
        lastFridaySweepResult = result;
      }

      return res.json({
        success: true,
        sweepType,
        result,
      });
    } catch (err: any) {
      console.error(`[Manual Sweep Trigger: ${sweepType}] Error:`, err);
      return res.status(500).json({ 
        success: false,
        error: 'SWEEP_FAILED', 
        message: err?.message || 'Sweep execution failed' 
      });
    }
  });

  // Endpoint: Get Pod Settlement Schedule
  app.get(['/api/pods/:id/settlement-schedule', '/pods/:id/settlement-schedule'], async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const pod = await findPodById(req.params.id, user);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }
    if (!isPodMember(pod, user) && !isPodCreator(pod, user) && !checkIsAdmin(req)) {
      return res.status(403).json({ error: 'NOT_A_MEMBER', message: 'You are not a member of this pod.' });
    }

    const schedule = getPlatformScheduleStatus(new Date());
    const cycleWeek = pod.currentCycleWeek || 1;
    const targetIndex = cycleWeek - 1;
    const recipientMember = pod.members.find(m => m.rotationIndex === targetIndex);

    let userDepositCompleted = false;
    if (user) {
      userDepositCompleted = deposits.some(d =>
        d.podId === pod.id &&
        d.userId === user.id &&
        d.cycleId === `cyc_w${cycleWeek}` &&
        d.status === 'COMPLETE'
      );
    }

    res.json({
      podId: pod.id,
      podName: pod.name,
      currentCycleWeek: cycleWeek,
      weeklyDepositAmount: pod.depositTier,
      currentTurnRecipient: recipientMember ? {
        userId: recipientMember.userId,
        displayName: recipientMember.displayName,
        rotationIndex: recipientMember.rotationIndex,
        hasReceivedPayout: recipientMember.hasReceivedPayout,
      } : null,
      userDepositCompleted,
      schedule,
    });
  });

  // Endpoint: Get Authenticated User Payment & Payout History
  app.get(['/api/user/payment-history', '/user/payment-history'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session required.' });
    }

    const history: PaymentHistoryItem[] = [];

    // 1. User deposits
    for (const d of (deposits || [])) {
      if (d.userId === user.id) {
        const pod = pods.find(p => p.id === d.podId);
        let parsedWeek = 1;
        if (d.cycleId) {
          const match = d.cycleId.match(/\d+/);
          if (match) parsedWeek = parseInt(match[0], 10);
        }

        history.push({
          id: d.id,
          type: 'DEPOSIT',
          podId: d.podId,
          podName: pod?.name || 'Mutual Savings Pod',
          amount: d.amount,
          status: d.status === 'COMPLETE' ? 'COMPLETED' : (d.status === 'PENDING' ? 'PENDING' : 'FAILED'),
          date: d.createdAt,
          cycleWeek: parsedWeek,
          stripePaymentId: d.stripePaymentId,
          description: `Weekly contribution for ${pod?.name || 'Mutual Pod'} (Cycle Week ${parsedWeek})`,
          paymentMethod: 'Stripe Treasury / Bank',
        });
      }
    }

    // 2. User rotation payouts across all pods
    for (const pod of pods) {
      const member = (pod.members || []).find(m => m.userId === user.id);

      if (member && member.hasReceivedPayout) {
        const weekNum = member.payoutCycleWeek || (member.rotationIndex + 1);
        history.push({
          id: member.payoutStripeTransferId || `payout_${pod.id}_${user.id}`,
          type: 'PAYOUT',
          podId: pod.id,
          podName: pod.name,
          amount: member.payoutNetAmountUsd ?? (pod.weeklyPoolTarget || (pod.depositTier * (pod.members?.length || pod.sizeTier))),
          status: 'COMPLETED',
          date: member.payoutProcessedAt || pod.cycleStartDate || pod.createdAt || new Date().toISOString(),
          cycleWeek: weekNum,
          stripeTransferId: member.payoutStripeTransferId,
          description: `Rotating lump-sum payout for ${pod.name} (Cycle Week ${weekNum})`,
          paymentMethod: 'Stripe Treasury Account',
        });
      }
    }

    // Sort descending by date (most recent first)
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      success: true,
      totalCount: history.length,
      history,
    });
  });

  // 10d. AI LLM Vision Gear Verification Against Active Campaign Rotation
  app.post(['/api/campaigns/gear-verify', '/campaigns/gear-verify'], async (req: Request, res: Response) => {
    try {
      if (!getCurrentUser(req)) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
      }
      const { courierPhoto, campaign, checkedGear } = req.body || {};
      const sampleTag = DEMO_MODE ? req.body?.sampleTag : undefined;
      // Photos must be uploaded inline. Fetching arbitrary URLs from the server
      // would let callers probe internal services (SSRF).
      if (courierPhoto !== undefined && (typeof courierPhoto !== 'string' || !courierPhoto.startsWith('data:image/') || courierPhoto.length > 8_000_000)) {
        return res.status(400).json({ error: 'INVALID_PHOTO', message: 'Upload the photo as an image (max ~6MB).' });
      }

      if (!campaign || !campaign.id) {
        return res.status(400).json({ error: 'Campaign details are required for gear verification.' });
      }

      const expectedBrand = campaign.brandName || 'Brand Partner';
      const campaignTitle = campaign.title || 'Brand Ambassador Campaign';
      const gearRequired = Array.isArray(campaign.gearRequired) && campaign.gearRequired.length > 0 
        ? campaign.gearRequired 
        : ['Branded Waterproof 45L Delivery Bag', 'Official Partner Thermal Hoodie', 'High-Visibility Reflective Armband'];

      let imageUrlForGroq = typeof courierPhoto === 'string' ? courierPhoto : '';

      const client = getGeminiClient();
      if (client && courierPhoto) {
        try {
          const parts: any[] = [];

          // Parse inline base64 image
          if (typeof courierPhoto === 'string' && courierPhoto.startsWith('data:image/')) {
            imageUrlForGroq = courierPhoto;
            const match = courierPhoto.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2],
                }
              });
            }
          }

          const prompt = `You are an AI Vision Verification Auditor for MutualPool Gig Delivery Ad Campaigns.
Your job is to compare the courier's uploaded gear selfie photo against the CURRENT ACTIVE CAMPAIGN in rotation this week.

CONTEXT & ACTIVE ROTATION RULE:
- Active Campaign in Rotation: "${campaignTitle}"
- Expected Brand Name: "${expectedBrand}"
- Brand Colors / Aesthetic: ${campaign.brandColor || 'Official Brand'}
- Required Campaign Gear Items: ${gearRequired.join(', ')}
- Description: ${campaign.description || 'Active brand promotional rotation for gig delivery ambassadors.'}
- Target Metro: ${campaign.targetMetro || 'National'}
${sampleTag ? `- Photo Metadata / Test Tag: ${sampleTag}` : ''}

CRITICAL VERIFICATION OBJECTIVE:
- We must prevent Couriers from uploading gear from OLD EXPIRED CAMPAIGNS (e.g. wearing last week's Campaign A gear when Campaign B is active this week), competitor brands, or unbranded personal apparel.
- Check if the apparel, bag, hoodie, jacket, cap, or decals in the photo visually match the CURRENT ACTIVE CAMPAIGN brand ("${expectedBrand}").
- If the photo exhibits gear or logos from another brand or an expired campaign (or is tagged MISMATCH_EXPIRED_CAMPAIGN), or if it is unbranded civilian clothes (or tagged UNBRANDED), mark matched as FALSE and status as REJECTED.
- If the photo matches the active campaign brand ("${expectedBrand}"), mark matched as TRUE and status as VERIFIED.

Output strictly a JSON object conforming to:
  {
  "matched": boolean,
  "status": "VERIFIED" | "REJECTED",
  "confidenceScore": number (0-100),
  "detectedBrand": string,
  "expectedBrand": "${expectedBrand}",
  "matchedCampaignTitle": "${campaignTitle}",
  "gearItemsDetected": string[],
  "visualFindings": string,
  "decisionReason": string
}`;

          parts.push({ text: prompt });

          const response = await client.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: [{ role: 'user', parts }],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  matched: { type: Type.BOOLEAN },
                  status: { type: Type.STRING },
                  confidenceScore: { type: Type.INTEGER },
                  detectedBrand: { type: Type.STRING },
                  expectedBrand: { type: Type.STRING },
                  matchedCampaignTitle: { type: Type.STRING },
                  gearItemsDetected: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  visualFindings: { type: Type.STRING },
                  decisionReason: { type: Type.STRING }
                },
                required: ['matched', 'status', 'confidenceScore', 'detectedBrand', 'expectedBrand', 'decisionReason']
              }
            }
          });

          const text = response.text || '{}';
          const parsed = JSON.parse(text);

          return res.json({
            success: true,
            modelUsed: 'gemini-3.7-flash (Multimodal Vision)',
            comparedAt: new Date().toISOString(),
            ...parsed,
            expectedBrand,
            matchedCampaignTitle: campaignTitle,
          });

        } catch (geminiErr: any) {
          console.warn('Gemini vision evaluation warning, trying Groq fallback:', geminiErr?.message);
        }
      }

      // Groq Vision Fallback (e.g. qwen/qwen3.6-27b) using GROQ_API_KEY
      const groq = getGroqClient();
      if (groq && imageUrlForGroq) {
        try {
          const groqPrompt = `You are an AI Vision Verification Auditor for MutualPool Gig Delivery Ad Campaigns.
Compare the courier's uploaded gear photo against the CURRENT ACTIVE CAMPAIGN in rotation this week.

CONTEXT & ACTIVE ROTATION RULE:
- Active Campaign in Rotation: "${campaignTitle}"
- Expected Brand Name: "${expectedBrand}"
- Brand Colors / Aesthetic: ${campaign.brandColor || 'Official Brand'}
- Required Campaign Gear Items: ${gearRequired.join(', ')}
- Description: ${campaign.description || 'Active brand promotional rotation for gig delivery ambassadors.'}
- Target Metro: ${campaign.targetMetro || 'National'}
${sampleTag ? `- Photo Metadata / Test Tag: ${sampleTag}` : ''}

CRITICAL VERIFICATION OBJECTIVE:
- Prevent couriers from uploading gear from OLD EXPIRED CAMPAIGNS (e.g. wearing last week's expired campaign rotation when "${expectedBrand}" is active), competitor brands, or unbranded personal clothes.
- Check if the apparel, bag, hoodie, jacket, cap, or decals in the photo visually match the CURRENT ACTIVE CAMPAIGN brand ("${expectedBrand}").
- If the photo exhibits gear or logos from another brand or an expired campaign (or is tagged MISMATCH_EXPIRED_CAMPAIGN), or if it is unbranded civilian clothes (or tagged UNBRANDED), mark matched as false and status as "REJECTED".
- If the photo matches the active campaign brand ("${expectedBrand}"), mark matched as true and status as "VERIFIED".

Return ONLY a valid JSON object in this exact schema:
  {
  "matched": boolean,
  "status": "VERIFIED" | "REJECTED",
  "confidenceScore": number (between 0 and 100),
  "detectedBrand": string,
  "expectedBrand": "${expectedBrand}",
  "matchedCampaignTitle": "${campaignTitle}",
  "gearItemsDetected": string[],
  "visualFindings": string,
  "decisionReason": string
}`;

          const completion = await groq.chat.completions.create({
            model: 'qwen/qwen3.6-27b',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: groqPrompt,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageUrlForGroq,
                    },
                  },
                ],
              },
            ],
            temperature: 0.6,
            max_completion_tokens: 2048,
            top_p: 0.95,
          });

          const rawContent = completion.choices[0]?.message?.content || '';
          const cleanedContent = rawContent
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/```(?:json)?\s*|```/g, '')
            .trim();
          
          if (cleanedContent) {
            const parsedGroq = JSON.parse(cleanedContent);
            return res.json({
              success: true,
              modelUsed: 'qwen/qwen3.6-27b (Groq Vision Fallback)',
              comparedAt: new Date().toISOString(),
              ...parsedGroq,
              expectedBrand,
              matchedCampaignTitle: campaignTitle,
            });
          }
        } catch (groqErr: any) {
          console.warn('Groq vision evaluation fallback warning, using smart rule evaluator:', groqErr?.message);
        }
      }

      // Fail closed: without a model verdict, never report the gear as verified.
      if (!DEMO_MODE) {
        return res.status(503).json({
          error: 'VERIFICATION_UNAVAILABLE',
          message: 'Gear verification is temporarily unavailable. Please try again shortly.',
        });
      }

      // DEMO_MODE rule evaluator / fallback
      const isMismatchTest = sampleTag === 'MISMATCH_EXPIRED_CAMPAIGN' || 
        (typeof courierPhoto === 'string' && (courierPhoto.includes('mismatch') || courierPhoto.includes('liquiddeath') || courierPhoto.includes('expired') || courierPhoto.includes('0a1dd7228f2d')));
      const isUnbrandedTest = sampleTag === 'UNBRANDED' ||
        (typeof courierPhoto === 'string' && (courierPhoto.includes('casual') || courierPhoto.includes('unbranded')));

      if (isMismatchTest) {
        return res.json({
          success: true,
          matched: false,
          status: 'REJECTED',
          confidenceScore: 96,
          detectedBrand: 'Expired Campaign Gear / Competitor',
          expectedBrand: expectedBrand,
          matchedCampaignTitle: campaignTitle,
          gearItemsDetected: ['Legacy Delivery Backpack', 'Non-matching apparel'],
          visualFindings: `Vision analysis detected legacy brand apparel from an expired weekly rotation. Visual emblems do not match active campaign "${expectedBrand}".`,
          decisionReason: `Campaign Mismatch Detected: The photo shows gear from a previous or different campaign. Only active rotation "${expectedBrand}" gear qualifies for daily payout.`,
          modelUsed: 'gemini-3.7-flash (Vision Engine Fallback)',
          comparedAt: new Date().toISOString(),
        });
      }

      if (isUnbrandedTest) {
        return res.json({
          success: true,
          matched: false,
          status: 'REJECTED',
          confidenceScore: 92,
          detectedBrand: 'Unbranded / Civilian Attire',
          expectedBrand: expectedBrand,
          matchedCampaignTitle: campaignTitle,
          gearItemsDetected: ['Civilian jacket', 'Generic bag'],
          visualFindings: `No official campaign insignia, thermal logos, or partner decals detected for "${expectedBrand}".`,
          decisionReason: `Unbranded Gear: Courier must wear official "${expectedBrand}" ambassador gear before shift payout can be released.`,
          modelUsed: 'gemini-3.7-flash (Vision Engine Fallback)',
          comparedAt: new Date().toISOString(),
        });
      }

      // Approved match
      return res.json({
        success: true,
        matched: true,
        status: 'VERIFIED',
        confidenceScore: 98,
        detectedBrand: expectedBrand,
        expectedBrand: expectedBrand,
        matchedCampaignTitle: campaignTitle,
        gearItemsDetected: gearRequired,
        visualFindings: `Vision model verified official "${expectedBrand}" campaign logo, colorway, and required delivery apparel in photo.`,
        decisionReason: `Full Visual Match: Courier is actively equipped with current rotation gear for "${expectedBrand}" (${campaignTitle}). Payout release authorized.`,
        modelUsed: 'gemini-3.7-flash (Vision Engine Fallback)',
        comparedAt: new Date().toISOString(),
      });

    } catch (err: any) {
      console.error('Error in /api/campaigns/gear-verify:', err);
      return res.status(500).json({
        error: 'VISION_VERIFICATION_ERROR',
        message: err?.message || 'Failed to complete gear verification'
      });
    }
  });

  // 10d. Verify Courier Gear and Release Daily Shift Payout
  // DEMO_MODE only: the shift amount comes from the client and there is no
  // advertiser-funded payout source yet, so this would mint money in production.
  app.post(['/api/campaigns/shifts/verify-payout', '/campaigns/shifts/verify-payout'], requireDemoMode, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }

    const { shift, gearVerification } = req.body;
    const targetUser = users.find(u => u.id === user.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const payoutEarned = Number(shift?.courierPayoutEarned) || 65;
    const payoutTransferId = shift?.payoutTransferId || `tr_gear_payout_${Date.now()}`;

    // Credit user Treasury balance
    if (!targetUser.treasury) {
      targetUser.treasury = {
        stripeAccountId: `acct_courier_${targetUser.id}`,
        stripeFinAccountId: `fa_courier_${targetUser.id}`,
        balanceUsd: 0,
        pendingInboundUsd: 0,
        totalPayoutsReceivedUsd: 0,
        fdicPassThroughEligible: true,
        status: 'ACTIVE',
      };
    }

    targetUser.treasury.balanceUsd = (targetUser.treasury.balanceUsd || 0) + payoutEarned;
    targetUser.treasury.totalPayoutsReceivedUsd = (targetUser.treasury.totalPayoutsReceivedUsd || 0) + payoutEarned;

    addAuditLog(
      'CAMPAIGN_EARNINGS',
      targetUser.id,
      targetUser.displayName,
      'COURIER_GEAR_VERIFIED_PAYOUT',
      `Courier Gear Verified for campaign "${shift?.campaignTitle || 'Brand Ambassador'}". Daily wage of $${payoutEarned.toFixed(2)} disbursed to Stripe Treasury (${payoutTransferId}). Gear items equipped: ${gearVerification?.gearItems?.length || 3}.`,
      {
        payoutTransferId,
        payoutEarned,
        campaignId: shift?.campaignId,
        gearVerificationStatus: 'VERIFIED',
        newBalance: targetUser.treasury.balanceUsd
      }
    );

    res.json({
      success: true,
      payoutTransferId,
      payoutEarned,
      gearVerificationStatus: 'VERIFIED',
      newBalance: targetUser.treasury.balanceUsd,
      user: targetUser
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
    const bypassTenureCheck = DEMO_MODE && Boolean(req.body?.bypassTenureCheck);
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

    if (pod.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'POD_NOT_ACTIVE', message: 'Hardship assistance is only available while the pod is active.' });
    }
    const capProblem = hardshipCapProblem(pod);
    if (capProblem) {
      return res.status(400).json({ error: 'HARDSHIP_CAP_REACHED', message: capProblem });
    }

    const depositAmount = pod.depositTier;
    const feeAmount = Math.round(depositAmount * 0.07 * 100) / 100;
    const totalPayoffAmount = Math.round((depositAmount + feeAmount) * 100) / 100;

    const newRequest: HardshipFundRequest = {
      id: newLedgerId('req_hardship'),
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
      reason: (typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 1000) : '') || 'Financial hardship covering weekly deposit',
    };

    const risk = assessHardshipRequest(newRequest);
    newRequest.riskScore = risk.score;
    newRequest.riskLevel = risk.level;
    newRequest.riskReasons = risk.reasons;
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
      `Requested Financial Hardship Fund of $${depositAmount}.00 for pod "${pod.name}". Request sent to MutualPool for review.`,
      { depositAmount, feeAmount, totalPayoffAmount, riskLevel: risk.level, riskScore: risk.score }
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
        message: `${user.displayName} submitted an emergency hardship request ($${depositAmount}.00) for "${pod.name}". MutualPool is reviewing it.`,
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
    if (isAdmin) {
      for (const r of userRequests) {
        if (r.status !== 'PENDING') continue;
        const risk = assessHardshipRequest(r);
        r.riskScore = risk.score;
        r.riskLevel = risk.level;
        r.riskReasons = risk.reasons;
      }
      return res.json(userRequests);
    }
    // Risk details are for reviewers only.
    res.json(userRequests.map(({ riskScore: _s, riskLevel: _l, riskReasons: _r, ...rest }) => rest));
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

    const isAutonomous = pod.stewardshipMode === 'AUTONOMOUS_AI';
    // Approval puts platform money into the pot, so it is never left to the pod
    // creator (who could collude with the member): an administrator decides.
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Hardship requests are reviewed and approved by MutualPool.' });
    }
    if (pod.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'POD_NOT_ACTIVE', message: 'The pod is no longer active.' });
    }
    const capProblem = hardshipCapProblem(pod);
    if (capProblem) {
      return res.status(400).json({ error: 'HARDSHIP_CAP_REACHED', message: capProblem });
    }
    const cycleId = `cyc_w${pod.currentCycleWeek}`;
    if (deposits.some(d => d && d.podId === pod.id && d.userId === request.userId && d.cycleId === cycleId && d.status === 'COMPLETE')) {
      return res.status(400).json({ error: 'ALREADY_DEPOSITED', message: 'This member has already deposited for the current week; there is nothing to cover.' });
    }

    // Step A: System disburses deposit amount into the pool on user's behalf
    pod.currentWeeklyCollected += request.depositAmount;

    const targetMember = pod.members.find(m => m.userId === request.userId);
    if (targetMember) {
      const hardshipDeposit: Deposit = {
        id: newLedgerId('dep_hardship'),
        membershipId: targetMember.id,
        podId: pod.id,
        cycleId: `cyc_w${pod.currentCycleWeek}`,
        userId: request.userId,
        userName: request.userName,
        amount: request.depositAmount,
        stripePaymentId: newLedgerId('ledger_hardship_disbursed'),
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

    // If the person going on Hardship Inactive Hold is the Creator:
    // Autonomous AI Custodian / System Stewardship immediately takes over!
    if (pod.createdBy === request.userId) {
      pod.stewardshipMode = 'AUTONOMOUS_AI';
      pod.managedBy = 'SYSTEM_AI';
      pod.stewardName = '🤖 Lainie (Autonomous System Custodian)';
      pod.systemEscrowActive = true;
      pod.creatorDefaultedAt = new Date().toISOString();
      pod.systemEscrowDrawnUsd = (pod.systemEscrowDrawnUsd || 0) + request.depositAmount;

      addAuditLog(
        pod.id,
        'usr_system_escrow_liquidity',
        '🤖 Lainie (Autonomous System Custodian)',
        'AUTONOMOUS_STEWARDSHIP_ACTIVATED',
        `🤖 Pod Creator ${request.userName} entered Financial Hardship Inactive Hold. Autonomous AI Custodian (Lainie) and System Deposits Escrow have assumed full pod management. Weekly payouts and deposits are 100% platform guaranteed.`,
        { creatorUserId: request.userId, totalPayoffAmount: request.totalPayoffAmount }
      );
    }

    // Step C: Pool prioritized & made public for replacement prospective member(s) to join
    pod.podType = 'OPEN_POD';
    pod.isPrioritizedForReplacement = true;
    pod.replacementVacanciesCount = (pod.replacementVacanciesCount || 0) + 1;

    // Step D: Request marked as approved
    request.status = 'APPROVED';
    request.approvedAt = new Date().toISOString();
    request.approvedByUserId = user.id;
    request.approvedCycleWeek = pod.currentCycleWeek;

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'HARDSHIP_APPROVED',
      `${isAutonomous ? '🤖 Autonomous AI Custodian' : 'Pool Creator ' + user.displayName} APPROVED Financial Hardship Fund for ${request.userName}. System disbursed $${request.depositAmount.toFixed(2)} deposit into pool. User placed on INACTIVE HOLD (Payoff required: $${request.totalPayoffAmount.toFixed(2)} including 7% service fee). Pool prioritized & made public for prospective replacement members.`,
      { requestId: request.id, totalPayoffAmount: request.totalPayoffAmount, depositAmount: request.depositAmount }
    );

    res.json({
      success: true,
      request,
      pod,
    });
  });

  // 3b. Administrator rejects a hardship request
  app.post('/api/hardship/reject', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Hardship requests are reviewed by MutualPool.' });
    }
    const { requestId, reason } = req.body || {};
    const request = hardshipRequests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: 'Hardship request not found' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Request is already ${request.status.toLowerCase()}.` });
    }

    request.status = 'REJECTED';
    request.rejectedAt = new Date().toISOString();
    request.rejectedByUserId = user.id;
    request.rejectionReason = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : undefined;

    const pod = pods.find(p => p.id === request.podId);
    const member = pod?.members.find(m => m.userId === request.userId);
    if (member && member.hardshipStatus === 'PENDING_APPROVAL') member.hardshipStatus = 'NONE';
    // A rejected request should not start the 4-month cooldown.
    const requester = users.find(u => u.id === request.userId);
    if (requester && requester.lastHardshipRequestedAt === request.requestedAt) requester.lastHardshipRequestedAt = undefined;

    addAuditLog(request.podId, user.id, user.displayName, 'HARDSHIP_REJECTED' as any,
      `Hardship request from ${request.userName} rejected by MutualPool review.${request.rejectionReason ? ` Reason: ${request.rejectionReason}` : ''}`,
      { requestId: request.id, riskLevel: request.riskLevel, riskScore: request.riskScore });
    createNotification({
      userId: request.userId,
      podId: request.podId,
      podName: request.podName,
      type: 'HARDSHIP_REJECTED' as any,
      title: 'Hardship request not approved',
      message: `Your hardship request for "${request.podName}" was not approved.${request.rejectionReason ? ` ${request.rejectionReason}` : ''} Your regular weekly deposit is still due.`,
    } as any);

    res.json({ success: true, request });
  });

  // 4. Inactive User Repays Hardship Balance + 7% Fee to Reactivate Account
  app.post('/api/hardship/repay', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { requestId } = req.body;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request = requestId
      ? hardshipRequests.find(r => r.id === requestId)
      : hardshipRequests.find(r => r.userId === user.id && r.status === 'APPROVED');
    if (!request || request.status !== 'APPROVED') {
      return res.status(404).json({ error: 'Active approved hardship request not found' });
    }

    // Repayment is paid by the member who received the hardship fund.
    if (request.userId !== user.id) {
      return res.status(403).json({ error: 'Unauthorized to repay this hardship request' });
    }

    const targetUser = users.find(u => u.id === request.userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalPayoff = request.totalPayoffAmount;
    if (!debitLedger(targetUser, totalPayoff)) {
      return insufficientFunds(res, totalPayoff, targetUser);
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
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
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
    if (pod.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'POD_NOT_ACTIVE', message: 'Reprioritization is only available while the pod is active.' });
    }
    if (reprioritizationRequests.some(r => r.podId === pod.id && r.requesterUserId === user.id && r.status === 'PENDING')) {
      return res.status(409).json({ error: 'PENDING_REQUEST_EXISTS', message: 'You already have a pending reprioritization request for this pod.' });
    }

    const newRequest: ReprioritizationRequest = {
      id: newLedgerId('req'),
      podId: pod.id,
      membershipId: member.id,
      requesterUserId: user.id,
      requesterName: user.displayName,
      currentRotationIndex: member.rotationIndex,
      desiredRotationIndex: pod.currentCycleWeek - 1, // Next up!
      reason: (typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 1000) : '') || 'Emergency hardship request',
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
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const { requestId, vote } = req.body || {}; // vote: 'FOR' | 'AGAINST'
    const pod = await findPodById(req.params.id, user);

    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    const request = reprioritizationRequests.find(r => r.id === requestId && r.podId === pod.id);
    if (!request || request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Active request not found.' });
    }
    if (!isPodMember(pod, user)) {
      return res.status(403).json({ error: 'Only members of this pod can vote.' });
    }
    if (vote !== 'FOR' && vote !== 'AGAINST') {
      return res.status(400).json({ error: 'vote must be FOR or AGAINST.' });
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
        // If the final slot changed hands, the 3% host reward moves with it.
        syncHostRewardRecipient(pod);
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
    const requests = swapRequests.filter(sr =>
      sr.podId === podId && (sr.requesterUserId === user.id || sr.targetUserId === user.id)
    );
    res.json({ swapRequests: requests });
  });

  // 12.1 Send or Create Swap Trade Request
  const handleSwapRequest = async (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const { targetMemberUserId, targetUserId, memberId, note } = req.body || {};
    const targetId = targetMemberUserId || targetUserId || memberId;
    const pod = await findPodById(req.params.id, user);

    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    const senderMember = findPodMember(pod, user.id);
    const targetMember = findPodMember(pod, targetId);

    if (!senderMember || senderMember.userId !== user.id) {
      return res.status(403).json({ error: 'NOT_A_MEMBER', message: 'You are not a member of this pod.' });
    }
    if (!targetMember || !targetMember.userId || targetMember.userId === user.id) {
      return res.status(400).json({ error: 'Target member could not be located in this pod.' });
    }

    const targetUserIdToNotify = targetMember.userId;

    // Check if existing pending or accepted request between these members in this pod
    let swapReq = swapRequests.find(sr =>
      sr.podId === pod.id &&
      (
        (sr.requesterUserId === user.id && sr.targetUserId === targetUserIdToNotify) ||
        (sr.requesterUserId === targetUserIdToNotify && sr.targetUserId === user.id)
      ) &&
      (sr.status === 'PENDING' || sr.status === 'ACCEPTED')
    );

    const nowIso = new Date().toISOString();

    if (!swapReq) {
      swapReq = {
        id: `sr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
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
        note: typeof note === 'string' ? note.slice(0, 500) : '',
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
      if (typeof note === 'string' && note) swapReq.note = note.slice(0, 500);
    }
    saveSwapRequestsToDisk();

    const isCreatorInvolved = (pod.createdBy && (user.id === pod.createdBy || targetUserIdToNotify === pod.createdBy));
    const creatorMemberInPod = pod.members.find(m => m.userId === pod.createdBy);
    const creatorSlot = (creatorMemberInPod?.rotationIndex ?? (pod.members.length - 1)) + 1;
    let creatorNoteSuffix = '';
    if (isCreatorInvolved) {
      if (user.id === pod.createdBy) {
        creatorNoteSuffix = ` 🌟 Notice: As Pod Creator requesting to switch spots, your 3% weekly Host Stewardship Reward on all teammate payouts will automatically transfer to ${targetMember.displayName} upon execution.`;
      } else {
        creatorNoteSuffix = ` 🌟 Notice: You are trading spots with Pod Creator ${user.displayName}. If accepted, the Creator's 3% weekly Host Stewardship Reward on all teammate payouts will transfer to YOU!`;
      }
    }

    const notification = createNotification({
      userId: targetUserIdToNotify,
      senderUserId: user.id,
      senderName: user.displayName,
      podId: pod.id,
      podName: pod.name,
      type: 'SWAP_REQUESTED',
      title: 'Spot Trade Request Received',
      message: `${user.displayName} (Slot #${(senderMember?.rotationIndex ?? 0) + 1}) sent you a spot trade request for Slot #${(targetMember.rotationIndex ?? 0) + 1} in "${pod.name}". Please accept or decline to confirm.${creatorNoteSuffix}`,
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
        isCreatorInvolved,
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

    const swapReq = swapRequests.find(sr => sr.id === requestId && sr.podId === req.params.id);
    if (!swapReq) {
      return res.status(404).json({ error: 'Swap request not found.' });
    }
    // Only the member who received the request can accept or decline it.
    if (swapReq.targetUserId !== user.id) {
      return res.status(403).json({ error: 'Only the requested member can respond to this swap request.' });
    }
    if (swapReq.status !== 'PENDING') {
      return res.status(400).json({ error: `This swap request is already ${String(swapReq.status).toLowerCase()}.` });
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
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const { targetMemberUserId, targetUserId, memberId, swapRequestId } = req.body || {};
    const targetId = targetMemberUserId || targetUserId || memberId;
    const pod = await findPodById(req.params.id, user);

    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    const member1 = findPodMember(pod, user.id);
    const member2 = findPodMember(pod, targetId);

    if (!member1 || !member2 || member1.userId !== user.id || !member2.userId || member1.userId === member2.userId) {
      return res.status(400).json({ error: 'Both members must be in the pod.' });
    }

    if (member1.hasReceivedPayout || member2.hasReceivedPayout) {
      return res.status(400).json({ error: 'Cannot swap slots if either member has already received a payout.' });
    }

    // Verify mutual consent: an ACCEPTED request between exactly these two members.
    const validRequest = swapRequests.find(sr =>
      sr.podId === pod.id &&
      sr.status === 'ACCEPTED' &&
      (!swapRequestId || sr.id === swapRequestId) &&
      (
        (sr.requesterUserId === member1.userId && sr.targetUserId === member2.userId) ||
        (sr.requesterUserId === member2.userId && sr.targetUserId === member1.userId)
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

    // The 3% host reward belongs to whoever now holds the final slot.
    const oldRewardRecipientId = pod.hostRewardRecipientUserId || pod.createdBy;
    syncHostRewardRecipient(pod);
    const newRewardRecipientId = pod.hostRewardRecipientUserId || pod.createdBy;
    const newRewardRecipientName = pod.hostRewardRecipientName || pod.creatorName;
    const hostRewardTransferred = newRewardRecipientId !== oldRewardRecipientId;

    savePodsToDisk();

    validRequest.status = 'EXECUTED';
    validRequest.updatedAt = new Date().toISOString();
    saveSwapRequestsToDisk();

    const auditMessage = hostRewardTransferred
      ? `Voluntary rotation slot swap executed between ${member1.displayName} (now #${member1.rotationIndex + 1}) and ${member2.displayName} (now #${member2.rotationIndex + 1}) following mutual confirmation. 🌟 Pod Creator switched places: 3% weekly Host Stewardship Reward on all teammate payouts successfully transferred to ${newRewardRecipientName}.`
      : `Voluntary rotation slot swap executed between ${member1.displayName} (now #${member1.rotationIndex + 1}) and ${member2.displayName} (now #${member2.rotationIndex + 1}) following mutual confirmation.`;

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'SLOT_SWAP_EXECUTED',
      auditMessage,
      { 
        member1Id: member1.userId || member1.id, 
        member2Id: member2.userId || member2.id,
        hostRewardTransferred,
        hostRewardRecipientUserId: pod.hostRewardRecipientUserId,
        hostRewardRecipientName: pod.hostRewardRecipientName,
      }
    );

    // Notify target member
    const targetRewardExtraMsg = (hostRewardTransferred && newRewardRecipientId === (member2.userId || member2.id))
      ? ` 🌟 As part of this spot swap with the Pod Creator, you are now the active beneficiary of the 3% weekly Host Stewardship Reward on all teammate payouts!`
      : '';

    createNotification({
      userId: member2.userId || member2.id,
      senderUserId: user.id,
      senderName: user.displayName,
      podId: pod.id,
      podName: pod.name,
      type: 'SWAP_EXECUTED',
      title: 'Spot Swap Executed!',
      message: `${user.displayName} executed the mutual spot swap with you in "${pod.name}". You are now assigned to Slot #${member2.rotationIndex + 1} (Week ${member2.rotationIndex + 1}).${targetRewardExtraMsg}`,
      metadata: {
        podId: pod.id,
        podName: pod.name,
        targetUserId: member2.userId || member2.id,
        targetName: member2.displayName,
        hostRewardTransferred,
        newRewardRecipientId,
      }
    });

    // Notify initiator
    const initiatorRewardExtraMsg = (hostRewardTransferred && newRewardRecipientId === (member1.userId || member1.id))
      ? ` 🌟 As part of this spot swap with the Pod Creator, you are now the active beneficiary of the 3% weekly Host Stewardship Reward on all teammate payouts!`
      : (hostRewardTransferred && user.id === pod.createdBy)
      ? ` 🌟 Notice: You traded spots for an early payout. Your 3% weekly Host Stewardship Reward has been transferred to ${member2.displayName}.`
      : '';

    createNotification({
      userId: member1.userId || member1.id,
      senderUserId: member2.userId || member2.id,
      senderName: member2.displayName,
      podId: pod.id,
      podName: pod.name,
      type: 'SWAP_EXECUTED',
      title: 'Spot Swap Completed',
      message: `You successfully completed the spot swap with ${member2.displayName} in "${pod.name}". You are now assigned to Slot #${member1.rotationIndex + 1} (Week ${member1.rotationIndex + 1}).${initiatorRewardExtraMsg}`,
      metadata: {
        podId: pod.id,
        podName: pod.name,
        targetUserId: member1.userId || member1.id,
        targetName: member1.displayName,
        hostRewardTransferred,
        newRewardRecipientId,
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

    // Redemption codes/links are a member benefit, revealed through /api/perks/redeem.
    res.json(filtered.map(({ redemptionData: _code, partnerEmail: _email, partnerNotes: _notes, ...publicPerk }) => publicPerk));
  });

  app.post('/api/perks/redeem', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const { perkId } = req.body;

    const perk = perks.find(p => p.id === perkId);
    if (!perk || perk.status !== 'APPROVED') return res.status(404).json({ error: 'Perk not found' });

    const existingRedemption = redemptions.find(r => r.userId === user.id && r.perkId === perk.id);
    if (existingRedemption) {
      return res.json({ success: true, redemption: existingRedemption, perk });
    }

    perk.redeemedCount += 1;

    const redemption: Redemption = {
      id: newLedgerId('red'),
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

  // Partners may submit offers with or without an account. Submissions are always
  // PENDING admin review, and never create, link to or return user accounts.
  app.post(['/api/perks/submit', '/perks/submit'], publicFormRateLimiter, (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      const body = req.body || {};
      const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

      const title = text(body.title, 140);
      const category = text(body.category, 60);
      if (!title || !category) {
        return res.status(400).json({ error: 'Title and category are required.' });
      }
      const effectiveEmail = text(body.partnerEmail, 254) || text(body.guestEmail, 254) || '';
      if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail)) {
        return res.status(400).json({ error: 'A valid contact email is required.' });
      }
      const finalProvider = text(body.provider, 120) || text(body.guestDisplayName, 120) || (user ? user.displayName : '') || effectiveEmail || 'Community Partner';
      const httpsUrl = (v: unknown) => {
        const url = text(v, 2048);
        return url && /^https:\/\//i.test(url) ? url : undefined;
      };

      const newPerk: Perk = {
        id: `perk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        title,
        category: category as Perk['category'],
        provider: finalProvider,
        description: text(body.description, 2000) || '',
        valueBadge: text(body.valueBadge, 80) || 'Special Member Discount',
        redemptionType: body.redemptionType === 'LINK' ? 'LINK' : (text(body.redemptionType, 20) as Perk['redemptionType']) || 'CODE',
        redemptionData: text(body.redemptionData, 500) || 'PENDING_APPROVAL',
        eligibility: text(body.eligibility, 300) || 'All verified members',
        submittedBy: user ? user.displayName : (effectiveEmail || finalProvider),
        submittedByUserId: user ? user.id : 'usr_guest',
        partnerEmail: effectiveEmail || user?.email,
        partnerNotes: text(body.partnerNotes, 2000),
        status: 'PENDING',
        iconName: 'Gift',
        imageUrl: httpsUrl(body.imageUrl),
        logoUrl: httpsUrl(body.logoUrl),
        redeemedCount: 0,
      };

      perks.unshift(newPerk);

      addAuditLog(
        undefined,
        user ? user.id : 'usr_guest',
        user ? user.displayName : finalProvider,
        'PERK_CREATED' as any,
        `Partner/User submitted perk offer: "${title}" (${finalProvider}) - Status: PENDING`,
        { perkId: newPerk.id, title, provider: finalProvider, status: 'PENDING' }
      );

      return res.json({
        success: true,
        perk: newPerk,
        createdAccount: false,
        message: 'Partner benefit offer submitted successfully! An Admin will review and approve it shortly.',
      });
    } catch (err) {
      console.error('[/api/perks/submit] error:', err);
      return res.status(500).json({ error: 'Failed to submit perk offer. Please check your submission and try again.' });
    }
  });

  app.get('/api/perks/my-offers', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const isAdmin = checkIsAdmin(req);
    res.json(perks.filter(p => isAdmin || p.submittedByUserId === user.id));
  });

  // Which languages members use: guides which translations to add next.
  app.get('/api/admin/language-stats', (req: Request, res: Response) => {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Administrator role required.' });
    }
    const count = (pick: (u: User) => string | undefined) => {
      const counts: Record<string, number> = {};
      for (const u of users) {
        const v = u && pick(u);
        if (v) counts[v] = (counts[v] || 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([language, members]) => ({ language, members }));
    };
    const traditions: Record<string, number> = {};
    for (const u of users) {
      if (u?.traditionId) traditions[u.traditionId] = (traditions[u.traditionId] || 0) + 1;
    }
    res.json({
      totalMembers: users.filter(Boolean).length,
      appLanguage: count(u => u.preferredLanguage),
      deviceLanguage: count(u => u.browserLanguage),
      traditions: Object.entries(traditions).sort((a, b) => b[1] - a[1]).map(([traditionId, members]) => ({ traditionId, members })),
    });
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
      id: `perk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
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
    const isOwner = perk.submittedByUserId === user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied. You can only manage your own partner perk offers.' });
    }

    const { status } = req.body; // 'APPROVED' | 'PENDING' | 'REJECTED' | 'SUSPENDED'
    if (!['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    // Owners can pause their own offer; publishing or rejecting requires an admin.
    if (!isAdmin && status !== 'SUSPENDED' && !(status === 'PENDING' && perk.status === 'SUSPENDED')) {
      return res.status(403).json({ error: 'Only an administrator can approve or reject perk offers.' });
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
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const isAdmin = checkIsAdmin(req);
    const { podId } = req.query;
    if (podId) {
      const pod = pods.find(p => p.id === podId);
      if (!isAdmin && !(pod && (isPodMember(pod, user) || isPodCreator(pod, user)))) {
        return res.status(403).json({ error: 'NOT_A_MEMBER', message: 'You are not a member of this pod.' });
      }
      return res.json(auditLogs.filter(l => l.podId === podId));
    }
    res.json(isAdmin ? auditLogs : auditLogs.filter(l => l.actorId === user.id));
  });

  // 15. Stripe webhook. Every event must carry a valid signature over the raw
  // body; this is the only place real money is credited to member ledgers.
  // Returns false when the event could not be applied yet (Stripe should retry).
  function creditTopup(paymentId: string, userId: string | undefined, amountUsd: number, source: string): boolean {
    if (!userId || !Number.isFinite(amountUsd) || amountUsd <= 0) {
      console.error(`[Stripe Webhook] ${source} ${paymentId} is missing userId/amount metadata; not credited.`);
      return true; // malformed for good: retrying will not help
    }
    if (processedPayments.some(p => p.id === paymentId)) return true;
    const target = users.find(u => u && u.id === userId);
    if (!target) {
      console.error(`[Stripe Webhook] ${source} ${paymentId} references unknown user ${userId}; will retry.`);
      return false;
    }
    const amount = roundCents(amountUsd);
    creditLedger(target, amount);
    processedPayments.push({ id: paymentId, userId, amountUsd: amount, processedAt: new Date().toISOString() });
    saveUsersToDisk();
    addAuditLog(undefined, target.id, target.displayName, 'TREASURY_TOPUP' as any,
      `Treasury top-up of $${amount.toFixed(2)} confirmed by Stripe (${paymentId}).`, { paymentId, amount, source });
    createNotification({
      userId: target.id,
      type: 'DEPOSIT_CONFIRMED',
      title: 'Funds added',
      message: `$${amount.toFixed(2)} was added to your Treasury balance.`,
    } as any);
    return true;
  }

  function applyConnectAccountUpdate(account: any): void {
    const target = users.find(u => u?.treasury?.stripeAccountId === account?.id);
    if (!target) return;
    const ready = Boolean(account.details_submitted && account.payouts_enabled && account.capabilities?.transfers === 'active');
    target.kycStatus = ready ? 'VERIFIED' : (account.details_submitted ? 'PENDING' : target.kycStatus);
    if (ready && !target.kycVerifiedAt) target.kycVerifiedAt = new Date().toISOString();
    target.treasury.status = (ready ? 'ACTIVE' : 'PENDING_REQUIREMENTS') as User['treasury']['status'];
    target.treasury.fdicPassThroughEligible = false;
    const bank = account.external_accounts?.data?.find((x: any) => x?.object === 'bank_account');
    const fingerprints = (account.external_accounts?.data || [])
      .map((x: any) => x?.fingerprint)
      .filter((f: unknown): f is string => typeof f === 'string' && f.length > 0);
    if (fingerprints.length) {
      target.identityFingerprints = Array.from(new Set([...(target.identityFingerprints || []), ...fingerprints]));
    }
    if (bank) {
      target.externalBank = {
        bankName: bank.bank_name || 'Bank account',
        last4: bank.last4 || '',
        routingNumber: '',
        accountType: 'CHECKING',
        status: 'LINKED',
        linkedAt: target.externalBank?.linkedAt || new Date().toISOString(),
      } as User['externalBank'];
    }
    saveUsersToDisk();
  }

  app.post('/api/webhooks/stripe', async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    // Account (platform) and Connect webhook endpoints each have their own secret.
    const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];
    const rawBody: Buffer | undefined = (req as any).rawBody;

    if (secrets.length === 0 || !sig || !rawBody) {
      return res.status(400).send('Webhook Error: missing signature or webhook secret');
    }
    let event: any = null;
    for (const secret of secrets) {
      try {
        event = getStripe().webhooks.constructEvent(rawBody, sig as string, secret);
        break;
      } catch {
        // try the next secret
      }
    }
    if (!event) {
      console.error('[Stripe Webhook] Signature verification failed');
      return res.status(400).send('Webhook Error: invalid signature');
    }

    try {
      const obj = event.data?.object || {};
      let applied = true;
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          if (obj.metadata?.kind === 'treasury_topup' && obj.payment_status === 'paid') {
            applied = creditTopup(obj.id, obj.metadata.userId, Number(obj.metadata.depositAmountUsd), 'checkout.session');
          }
          break;
        case 'payment_intent.succeeded':
          if (obj.metadata?.kind === 'treasury_topup') {
            applied = creditTopup(obj.id, obj.metadata.userId, Number(obj.metadata.depositAmountUsd), 'payment_intent');
          }
          break;
        case 'account.updated':
          applyConnectAccountUpdate(obj);
          break;
        default:
          break;
      }
      if (!applied) {
        return res.status(500).json({ error: 'WEBHOOK_NOT_APPLIED' });
      }
    } catch (whErr) {
      // Let Stripe retry: the handlers are idempotent.
      console.error('[Stripe Webhook] Error in event handler:', whErr);
      return res.status(500).json({ error: 'WEBHOOK_HANDLER_FAILED' });
    }

    // Only acknowledge once the credit is durable; otherwise Stripe retries.
    if (!(await persistNow())) {
      return res.status(500).json({ error: 'WEBHOOK_PERSIST_FAILED' });
    }
    res.json({ received: true });
  });

  // 16. Operations & Member Recovery: Delinquency & Missed Deposit Auto-Deduction Engine
  app.post(['/api/admin/delinquency/handle', '/api/pods/:podId/recover-missed-deposit'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized: User session required' });
    const podId = req.params.podId || req.body.podId;
    const { memberUserId, actionChoice = 'COVER_GAP' } = req.body; // actionChoice: 'GRACE_PERIOD' | 'COVER_GAP' | 'REMOVE'

    const pod = pods.find(p => p.id === podId);
    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    // Admins can take any action. A pod creator may only grant a grace period;
    // deductions, platform escrow draws and removals are operations decisions.
    const isAdmin = checkIsAdmin(req);
    const isCreatorGrace = pod.createdBy === user.id && actionChoice === 'GRACE_PERIOD';
    if (!isAdmin && !isCreatorGrace) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only an administrator can take this delinquency action.' });
    }
    if (!['GRACE_PERIOD', 'COVER_GAP', 'REMOVE'].includes(actionChoice)) {
      return res.status(400).json({ error: 'INVALID_ACTION', message: 'actionChoice must be GRACE_PERIOD, COVER_GAP or REMOVE.' });
    }

    const member = pod.members.find(m => m.userId === memberUserId);
    if (!member) return res.status(404).json({ error: 'Member not found in this pod' });

    const memberUser = users.find(u => u.id === memberUserId);
    const requiredDeposit = pod.depositTier || 20;

    let outcome = 'RESOLVED';
    let balanceDeducted = 0;
    let welcomeMatchUsed = 0;
    let removedFromPod = false;
    let podListedPublicly = false;

    if (actionChoice === 'GRACE_PERIOD') {
      member.delinquencyStatus = 'GRACE_PERIOD';
      outcome = 'GRACE_PERIOD_GRANTED';

      addAuditLog(
        pod.id,
        user.id,
        user.displayName,
        'DELINQUENCY_HANDLED',
        `Granted 24-hour grace period to ${member.displayName} for missed deposit in pod "${pod.name}".`,
        { memberUserId, actionChoice }
      );
    } else if (actionChoice === 'REMOVE') {
      // Direct removal
      removeMemberFromRotation(pod, memberUserId);
      pod.podType = 'OPEN_POD';
      pod.isPrioritizedForReplacement = true;
      pod.replacementVacanciesCount = (pod.replacementVacanciesCount || 0) + 1;
      removedFromPod = true;
      podListedPublicly = true;
      outcome = 'MEMBER_REMOVED';

      addAuditLog(
        pod.id,
        user.id,
        user.displayName,
        'MEMBER_REMOVED',
        `Removed member ${member.displayName} from pod "${pod.name}" per mutual agreement. Pod is now publicly listed as Open Pod with replacement priority.`,
        { memberUserId, actionChoice, remainingMembers: pod.memberCount }
      );
    } else if (actionChoice === 'COVER_GAP') {
      // Step 1: Check account balance (Stripe Treasury / daily wage supplement earnings)
      const currentBalance = memberUser?.treasury?.balanceUsd || 0;

      if (currentBalance >= requiredDeposit) {
        // Case A: Account balance is SUFFICIENT to cover full deposit
        balanceDeducted = requiredDeposit;
        if (memberUser) debitLedger(memberUser, requiredDeposit);
        pod.currentWeeklyCollected = (pod.currentWeeklyCollected || 0) + requiredDeposit;
        member.delinquencyStatus = 'CLEAN';
        outcome = 'FULL_BALANCE_DEDUCTED';

        // Record deposit
        const newDeposit: Deposit = {
          id: newLedgerId('dep_autodeduct'),
          membershipId: member.id,
          podId: pod.id,
          cycleId: `cyc_w${pod.currentCycleWeek || 1}`,
          userId: member.userId,
          userName: member.displayName,
          amount: requiredDeposit,
          stripePaymentId: newLedgerId('ledger_autodeduct'),
          status: 'COMPLETE',
          createdAt: new Date().toISOString(),
        };
        deposits.unshift(newDeposit);

        addAuditLog(
          pod.id,
          user.id,
          user.displayName,
          'DEPOSIT_COMPLETED',
          `💳 Full missed deposit of $${requiredDeposit.toFixed(2)} auto-deducted directly from ${member.displayName}'s account balance. Delinquency resolved and member remains active in pod "${pod.name}".`,
          { memberUserId, balanceDeducted, remainingBalance: memberUser?.treasury?.balanceUsd }
        );

        createNotification({
          userId: member.userId,
          type: 'DEPOSIT_DUE',
          title: 'Weekly Deposit Auto-Deducted',
          message: `$${requiredDeposit.toFixed(2)} full weekly deposit was successfully deducted from your account balance for pod "${pod.name}". Your rotation standing is CLEAN.`,
          podId: pod.id,
        });
      } else {
        // Case B: Account balance is INSUFFICIENT to cover full deposit
        // Available balance is deducted first, then Welcome Match Credited covers the remainder
        balanceDeducted = roundCents(Math.max(0, currentBalance));
        if (memberUser && balanceDeducted > 0) debitLedger(memberUser, balanceDeducted);

        const remainder = requiredDeposit - balanceDeducted;
        const availableWelcomeMatch = pod.contingencyBufferUsd || 0;
        welcomeMatchUsed = Math.min(remainder, availableWelcomeMatch);
        pod.contingencyBufferUsd = Math.max(0, availableWelcomeMatch - welcomeMatchUsed);

        // System Liquidity Escrow Account advances any remaining uncovered gap
        const systemEscrowUsed = Math.max(0, remainder - welcomeMatchUsed);
        if (systemEscrowUsed > 0) {
          pod.systemEscrowActive = true;
          pod.systemEscrowDrawnUsd = (pod.systemEscrowDrawnUsd || 0) + systemEscrowUsed;
        }

        pod.currentWeeklyCollected = (pod.currentWeeklyCollected || 0) + requiredDeposit;

        // Record deposit with split metadata
        const newDeposit: Deposit = {
          id: newLedgerId('dep_split'),
          membershipId: member.id,
          podId: pod.id,
          cycleId: `cyc_w${pod.currentCycleWeek || 1}`,
          userId: member.userId,
          userName: member.displayName,
          amount: requiredDeposit,
          stripePaymentId: newLedgerId('ledger_split_wm'),
          status: 'COMPLETE',
          createdAt: new Date().toISOString(),
        };
        deposits.unshift(newDeposit);

        // Check if the defaulting member is the Pod Creator
        const isCreatorDefaulting = pod.createdBy === memberUserId;

        // ENFORCEMENT: Welcome Match Credited / Escrow kicked in due to insufficient user balance
        // The user must be taken off the Pod due to missed payment/deposit, and Pod is publicly listed.
        removeMemberFromRotation(pod, memberUserId);
        pod.podType = 'OPEN_POD';
        pod.isPrioritizedForReplacement = true;
        pod.replacementVacanciesCount = (pod.replacementVacanciesCount || 0) + 1;
        removedFromPod = true;
        podListedPublicly = true;
        outcome = 'WELCOME_MATCH_REMAINDER_APPLIED_MEMBER_REMOVED';

        if (isCreatorDefaulting) {
          // Autonomous AI Custodian / System Stewardship immediately takes over
          pod.stewardshipMode = 'AUTONOMOUS_AI';
          pod.managedBy = 'SYSTEM_AI';
          pod.stewardName = '🤖 Lainie (Autonomous System Custodian)';
          pod.systemEscrowActive = true;
          pod.creatorDefaultedAt = new Date().toISOString();

          addAuditLog(
            pod.id,
            'usr_system_escrow_liquidity',
            '🤖 Lainie (Autonomous System Custodian)',
            'AUTONOMOUS_STEWARDSHIP_ACTIVATED',
            `🛡️ Autonomous AI Custodian Protocol Activated: Pod Creator ${member.displayName} defaulted on deposit and was removed. System Stewardship (Lainie) and the Platform System Deposits Escrow Account have taken over. All weekly deposits and payouts will continue with 100% platform-backed liquidity.`,
            { creatorUserId: memberUserId, systemEscrowUsed, remainingBuffer: pod.contingencyBufferUsd }
          );

          // Notify all remaining members that AI Custodian has assumed stewardship
          pod.members.forEach((m) => {
            createNotification({
              userId: m.userId,
              type: 'STATUS_CHANGE',
              title: '🤖 Autonomous AI Custodian Active',
              message: `The Pod Creator defaulted on a deposit. The system (Lainie AI Custodian) has autonomously taken over Pod stewardship. All weekly deposits and payouts are 100% secured by the System Deposits Escrow Account.`,
              podId: pod.id,
            });
          });
        }

        addAuditLog(
          pod.id,
          user.id,
          user.displayName,
          'CONTINGENCY_BUFFER_USED',
          `🛡️ Missed Deposit Resolution: $${balanceDeducted.toFixed(2)} deducted from ${member.displayName}'s balance; remainder $${welcomeMatchUsed.toFixed(2)} covered by Welcome Match Contingency Reserve ${systemEscrowUsed > 0 ? `+ $${systemEscrowUsed.toFixed(2)} drawn from System Deposits Escrow` : ''} (remaining buffer: $${pod.contingencyBufferUsd.toFixed(2)}). Due to insufficient funds default, ${member.displayName} was removed from pod "${pod.name}", and the pod is now publicly listed as an Open Pod with replacement priority.`,
          {
            memberUserId,
            balanceDeducted,
            welcomeMatchUsed,
            systemEscrowUsed,
            isCreatorDefaulting,
            remainingBuffer: pod.contingencyBufferUsd,
            removedFromPod: true,
            podListedPublicly: true,
          }
        );

        createNotification({
          userId: member.userId,
          type: 'STATUS_CHANGE',
          title: 'Removed from Pod - Insufficient Balance',
          message: `Your account balance ($${balanceDeducted.toFixed(2)}) was insufficient for your $${requiredDeposit.toFixed(2)} deposit in "${pod.name}". The remaining $${welcomeMatchUsed.toFixed(2)} was covered by the Welcome Match Reserve. You have been removed from the rotation and the pod is now publicly listed for a replacement.`,
          podId: pod.id,
        });
      }
    }

    savePodsToDisk();
    saveUsersToDisk();

    res.json({
      success: true,
      outcome,
      balanceDeducted,
      welcomeMatchUsed,
      removedFromPod,
      podListedPublicly,
      pod,
      remainingBufferUsd: pod.contingencyBufferUsd,
    });
  });

  // 11. Autonomous / System Escrow Deposit Injection for Vacant or Defaulted Slots
  // Platform escrow advances: administrators / scheduler only, once per vacant
  // or defaulted slot per cycle.
  app.post(['/api/pods/:id/system-deposit', '/pods/:id/system-deposit'], async (req: Request, res: Response) => {
    if (!isSystemRequest(req)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'System escrow deposits are restricted to administrators.' });
    }
    const user = getCurrentUser(req);
    const pod = await findPodById(req.params.id, user || undefined);
    if (!pod) return res.status(404).json({ error: 'Pod not found' });
    if (pod.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'POD_NOT_ACTIVE', message: 'System deposits can only be made into an active pod.' });
    }
    const cycleId = `cyc_w${pod.currentCycleWeek || 1}`;
    const memberDepositsThisCycle = deposits.filter(d => d && d.podId === pod.id && d.cycleId === cycleId && d.status === 'COMPLETE').length;
    if (memberDepositsThisCycle >= (pod.members?.length || 0)) {
      return res.status(400).json({ error: 'CYCLE_FULLY_FUNDED', message: 'Every slot already has a deposit for this cycle.' });
    }

    const depositAmount = pod.depositTier || 20;
    pod.currentWeeklyCollected = (pod.currentWeeklyCollected || 0) + depositAmount;
    pod.systemEscrowActive = true;
    pod.systemEscrowDrawnUsd = (pod.systemEscrowDrawnUsd || 0) + depositAmount;

    const sysDeposit: Deposit = {
      id: newLedgerId('dep_system_escrow'),
      membershipId: `pm_system_escrow_${pod.id}`,
      podId: pod.id,
      cycleId: `cyc_w${pod.currentCycleWeek || 1}`,
      userId: 'usr_system_escrow_liquidity',
      userName: '🤖 System Deposits Escrow Account',
      amount: depositAmount,
      stripePaymentId: newLedgerId('ledger_system_escrow'),
      status: 'COMPLETE',
      createdAt: new Date().toISOString(),
    };
    deposits.unshift(sysDeposit);

    addAuditLog(
      pod.id,
      'usr_system_escrow_liquidity',
      '🤖 Lainie (Autonomous System Custodian)',
      'SYSTEM_ESCROW_DEPOSIT_DISBURSED',
      `🤖 Disbursed $${depositAmount.toFixed(2)} deposit from Platform System Deposits Escrow Account for Week ${pod.currentCycleWeek}. Total system liquidity advanced to pod: $${pod.systemEscrowDrawnUsd.toFixed(2)}. Payout pot is 100% whole.`,
      { depositAmount, cycleWeek: pod.currentCycleWeek, totalEscrowDrawn: pod.systemEscrowDrawnUsd }
    );

    savePodsToDisk();

    res.json({
      success: true,
      pod,
      deposit: sysDeposit,
      systemEscrowDrawnUsd: pod.systemEscrowDrawnUsd,
      currentWeeklyCollected: pod.currentWeeklyCollected,
    });
  });

// --- ADVERTISER / BRAND PARTNER CAMPAIGN INQUIRIES ---
const ADVERTISER_INQUIRIES_FILE = path.join(DATA_DIR, 'advertiser_inquiries.json');

function loadAdvertiserInquiries(): any[] {
  if (IS_PRODUCTION) return [];
  try {
    const data = safeReadFile(ADVERTISER_INQUIRIES_FILE);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load advertiser inquiries:', err);
  }
  return [];
}

let advertiserInquiries: any[] = loadAdvertiserInquiries();

function saveAdvertiserInquiries(inquiries: any[]) {
  if (isPersistenceEnabled()) {
    requestFlush();
    return;
  }
  try {
    safeWriteFile(ADVERTISER_INQUIRIES_FILE, JSON.stringify(inquiries, null, 2));
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
    const tooLong = [brandName, contactName, contactEmail, contactPhone, websiteUrl, campaignObjective, estimatedBudget]
      .some(v => v !== undefined && (typeof v !== 'string' || v.length > 300))
      || (customNotes !== undefined && (typeof customNotes !== 'string' || customNotes.length > 5000))
      || (targetMarkets !== undefined && (!Array.isArray(targetMarkets) || targetMarkets.length > 50))
      || (apparelTypes !== undefined && (!Array.isArray(apparelTypes) || apparelTypes.length > 20));
    if (tooLong) {
      return res.status(400).json({ error: 'One or more fields are too long or invalid.' });
    }

    const newInquiry = {
      id: `inq_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      brandName: String(brandName).trim(),
      contactName: String(contactName || 'Partner').trim(),
      contactEmail: String(contactEmail).trim(),
      contactPhone: contactPhone ? String(contactPhone).trim() : '',
      websiteUrl: websiteUrl ? String(websiteUrl).trim() : '',
      targetMarkets: Array.isArray(targetMarkets) ? targetMarkets.map(String).map(s => s.slice(0, 60)) : ['national'],
      campaignObjective: String(campaignObjective || 'Brand Awareness'),
      estimatedBudget: String(estimatedBudget || '$5,000 - $15,000'),
      fleetSizeTarget: Number(fleetSizeTarget) || 100,
      campaignDurationWeeks: Number(campaignDurationWeeks) || 4,
      apparelTypes: Array.isArray(apparelTypes) ? apparelTypes.map(String).map(s => s.slice(0, 40)) : ['hoodie'],
      customNotes: customNotes ? String(customNotes).trim() : '',
      submittedAt: new Date().toISOString(),
      status: 'NEW',
    };

    advertiserInquiries.unshift(newInquiry);
    saveAdvertiserInquiries(advertiserInquiries);

    console.log(`[Advertiser Inquiry] New campaign lead from ${newInquiry.brandName} (${newInquiry.contactEmail})`);

    res.json({
      success: true,
      message: 'Campaign inquiry submitted successfully. A Brand Partnerships Director will reach out within 24 hours.',
      inquiry: { id: newInquiry.id, brandName: newInquiry.brandName, submittedAt: newInquiry.submittedAt, status: newInquiry.status },
    });
  } catch (err: any) {
    console.error('Error submitting advertiser inquiry:', err);
    res.status(500).json({ error: 'Failed to submit advertiser inquiry', details: err?.message });
  }
});

app.get('/api/campaigns/advertiser-inquiries', (req: Request, res: Response) => {
  if (!checkIsAdmin(req)) {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  res.json({ inquiries: advertiserInquiries });
});

// --- FOURTHWALL PRINT-ON-DEMAND GEAR STORAGE & API ---
const GEAR_DESIGNS_FILE = path.join(DATA_DIR, 'gear_designs.json');

function loadGearDesigns(): GearDesignOrder[] {
  try {
    const raw = safeReadFile(GEAR_DESIGNS_FILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Fourthwall] Error loading gear_designs.json:', err);
  }
  return IS_PRODUCTION ? [] : [...INITIAL_GEAR_DESIGNS];
}

let gearDesigns: GearDesignOrder[] = loadGearDesigns();

function saveGearDesigns(): void {
  if (isPersistenceEnabled()) {
    requestFlush();
    return;
  }
  try {
    safeWriteFile(GEAR_DESIGNS_FILE, JSON.stringify(gearDesigns, null, 2));
  } catch (err) {
    console.error('[Fourthwall] Error saving gear_designs.json:', err);
  }
}

// 1. Get Fourthwall Base Apparel Catalog
app.get(['/api/fourthwall/catalog', '/fourthwall/catalog'], (req: Request, res: Response) => {
  res.json({
    catalog: FOURTHWALL_GEAR_CATALOG,
    provider: 'Fourthwall Platform API',
    printMethod: 'Direct-to-Film (DTF) High-Density Printing',
    documentationUrl: 'https://docs.fourthwall.com/quickstart',
  });
});

// Sponsors see their own designs; admins see all. Raw Fourthwall API responses stay server-side.
function toDesignView(design: GearDesignOrder): GearDesignOrder {
  const { fourthwallRawResponse: _raw, ...rest } = design;
  return rest as GearDesignOrder;
}

function canViewDesign(req: Request, design: GearDesignOrder): boolean {
  const user = getCurrentUser(req);
  return checkIsAdmin(req) || Boolean(user && design.ownerUserId === user.id);
}

// 2. List Sponsored Gear Designs
app.get(['/api/fourthwall/designs', '/fourthwall/designs'], (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
  }
  const { status, sponsorBrand, campaignId } = req.query;
  let results = gearDesigns.filter(d => canViewDesign(req, d));

  if (status && typeof status === 'string') {
    results = results.filter(d => d.status === status);
  }
  if (sponsorBrand && typeof sponsorBrand === 'string') {
    results = results.filter(d => d.sponsorBrand.toLowerCase().includes(sponsorBrand.toLowerCase()));
  }
  if (campaignId && typeof campaignId === 'string') {
    results = results.filter(d => d.campaignId === campaignId);
  }

  res.json({
    designs: results.map(toDesignView),
    total: results.length,
  });
});

// 3. Create or update a draft gear design (owner only, DRAFT/REJECTED designs only)
app.post(['/api/fourthwall/designs', '/fourthwall/designs'], (req: Request, res: Response) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const designData = req.body as Partial<GearDesignOrder>;
    if (!designData.sponsorBrand || !designData.gearType || typeof designData.sponsorBrand !== 'string' || designData.sponsorBrand.length > 120) {
      return res.status(400).json({ error: 'sponsorBrand and gearType are required' });
    }

    const catalogItem = FOURTHWALL_GEAR_CATALOG.find(c => c.type === designData.gearType);
    if (!catalogItem) {
      return res.status(400).json({ error: 'Unknown gearType' });
    }
    const qty = Math.floor(Number(designData.quantity) || 50);
    if (qty < 1 || qty > 5000) {
      return res.status(400).json({ error: 'quantity must be between 1 and 5000' });
    }
    let zonesJson = '{}';
    if (designData.zones !== undefined) {
      if (!designData.zones || typeof designData.zones !== 'object' || Array.isArray(designData.zones)) {
        return res.status(400).json({ error: 'zones must be an object' });
      }
      zonesJson = JSON.stringify(designData.zones);
      if (zonesJson.length > 200_000 || /\[\s*\[/.test(zonesJson)) {
        return res.status(400).json({ error: 'zones is too large or contains nested arrays' });
      }
    }
    const unitCost = catalogItem.baseUnitCostUsd;

    const existing = designData.id ? gearDesigns.find(d => d.id === designData.id) : undefined;
    if (existing) {
      if (existing.ownerUserId !== user.id) {
        return res.status(403).json({ error: 'You can only edit your own designs.' });
      }
      if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
        return res.status(400).json({ error: 'Only draft or rejected designs can be edited.' });
      }
    }

    const nowIso = new Date().toISOString();
    const design: GearDesignOrder = {
      id: existing?.id || `gdes_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      ownerUserId: user.id,
      campaignId: designData.campaignId || 'camp_ad_hoc_sponsor',
      campaignTitle: designData.campaignTitle || `${designData.sponsorBrand} Sponsored Fleet`,
      sponsorBrand: designData.sponsorBrand,
      sponsorContactEmail: designData.sponsorContactEmail || user.email,
      sponsorContactName: designData.sponsorContactName || designData.sponsorBrand,
      gearType: designData.gearType,
      gearName: catalogItem.name,
      baseColor: designData.baseColor || 'NEON_LIME',
      quantity: qty,
      unitCostUsd: unitCost,
      totalEstimatedCostUsd: unitCost * qty,
      zones: JSON.parse(zonesJson),
      status: 'DRAFT',
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (existing) {
      Object.assign(existing, design);
    } else {
      gearDesigns.unshift(design);
    }

    saveGearDesigns();
    res.status(201).json({ success: true, design: toDesignView(existing || design) });
  } catch (err: any) {
    console.error('[Fourthwall] Error creating gear design:', err);
    res.status(500).json({ error: 'Failed to create gear design' });
  }
});

// 4. Submit Gear Design for Admin Approval (owner only)
app.post(['/api/fourthwall/designs/:id/submit', '/fourthwall/designs/:id/submit'], (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
  }
  const design = gearDesigns.find(d => d.id === req.params.id);
  if (!design || design.ownerUserId !== user.id) {
    return res.status(404).json({ error: 'Gear design not found' });
  }
  if (design.status !== 'DRAFT' && design.status !== 'REJECTED') {
    return res.status(400).json({ error: 'Only draft or rejected designs can be submitted.' });
  }

  design.status = 'PENDING_APPROVAL';
  design.submittedAt = new Date().toISOString();
  design.updatedAt = new Date().toISOString();
  saveGearDesigns();

  res.json({
    success: true,
    design: toDesignView(design),
    message: 'Gear design submitted for stewardship approval. Upon approval it will be dispatched to Fourthwall.',
  });
});

// 5. Admin Approves Gear Design & Dispatches a (paid) Order to the Fourthwall API
const designsBeingDispatched = new Set<string>();
app.post(['/api/fourthwall/designs/:id/approve', '/fourthwall/designs/:id/approve'], async (req: Request, res: Response) => {
  if (!checkIsAdmin(req)) {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  const design = gearDesigns.find(d => d.id === req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Gear design not found' });
  }
  if (design.status !== 'PENDING_APPROVAL' && design.status !== 'DRAFT') {
    return res.status(400).json({ error: `Design is ${String(design.status).toLowerCase()} and cannot be dispatched again.` });
  }
  if (designsBeingDispatched.has(design.id)) {
    return res.status(409).json({ error: 'This design is already being dispatched.' });
  }

  designsBeingDispatched.add(design.id);
  try {
    const { shippingRecipient, adminNotes } = req.body || {};
    const fwResult = await dispatchOrderToFourthwall(design, shippingRecipient);

    design.status = 'DISPATCHED_TO_FOURTHWALL';
    design.approvedAt = new Date().toISOString();
    design.adminNotes = (typeof adminNotes === 'string' ? adminNotes.slice(0, 2000) : '') || 'Design approved for high-visibility courier fleet print run.';
    design.fourthwallOrderId = fwResult.fourthwallOrderId;
    design.fourthwallOrderNumber = fwResult.fourthwallOrderNumber;
    design.fourthwallTrackingUrl = fwResult.fourthwallTrackingUrl;
    design.fourthwallProductionStage = fwResult.productionStage;
    design.fourthwallRawResponse = fwResult.rawResponse;
    design.updatedAt = new Date().toISOString();

    saveGearDesigns();

    res.json({
      success: true,
      design: toDesignView(design),
      message: `Design approved and manufacturing order ${fwResult.fourthwallOrderNumber} dispatched to Fourthwall print pipeline.`,
    });
  } catch (err: any) {
    console.error('[Fourthwall] Approval and dispatch error:', err);
    res.status(500).json({ error: 'Fourthwall dispatch failed' });
  } finally {
    designsBeingDispatched.delete(design.id);
  }
});

// 6. Admin Rejects Gear Design
app.post(['/api/fourthwall/designs/:id/reject', '/fourthwall/designs/:id/reject'], (req: Request, res: Response) => {
  if (!checkIsAdmin(req)) {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  const design = gearDesigns.find(d => d.id === req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Gear design not found' });
  }
  if (design.status !== 'PENDING_APPROVAL') {
    return res.status(400).json({ error: 'Only designs awaiting approval can be rejected.' });
  }

  const { adminNotes } = req.body || {};
  design.status = 'REJECTED';
  design.rejectedAt = new Date().toISOString();
  design.adminNotes = (typeof adminNotes === 'string' ? adminNotes.slice(0, 2000) : '') || 'Design requires adjustments to comply with courier safety guidelines.';
  design.updatedAt = new Date().toISOString();
  saveGearDesigns();

  res.json({
    success: true,
    design: toDesignView(design),
    message: 'Gear design marked as rejected with feedback.',
  });
});

// 7. Get Single Gear Design (owner or admin)
app.get(['/api/fourthwall/designs/:id', '/fourthwall/designs/:id'], (req: Request, res: Response) => {
  const design = gearDesigns.find(d => d.id === req.params.id);
  if (!design || !canViewDesign(req, design)) {
    return res.status(404).json({ error: 'Gear design not found' });
  }
  res.json({ design: toDesignView(design) });
});

// 8. Fourthwall Webhook Receiver: HMAC-SHA256 (base64) of the raw body, signed
// with FOURTHWALL_WEBHOOK_SECRET, sent in the X-Fourthwall-Hmac-SHA256 header.
function verifyFourthwallSignature(req: Request): boolean {
  const secret = process.env.FOURTHWALL_WEBHOOK_SECRET;
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const provided = getHeaderValue(req, 'x-fourthwall-hmac-sha256');
  if (!secret || !rawBody || !provided) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post(['/api/fourthwall/webhook', '/fourthwall/webhook'], (req: Request, res: Response) => {
  if (!verifyFourthwallSignature(req)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  try {
    const { event, order_id, order_number, status, tracking_url } = req.body || {};
    console.log(`[Fourthwall Webhook] Received ${event} for order ${order_id || order_number}`);

    const match = gearDesigns.find(d =>
      (order_id && d.fourthwallOrderId && d.fourthwallOrderId === order_id) ||
      (order_number && d.fourthwallOrderNumber && d.fourthwallOrderNumber === order_number)
    );
    if (match) {
      if (status === 'IN_PRODUCTION') match.fourthwallProductionStage = 'IN_PRODUCTION';
      if (status === 'SHIPPED') match.fourthwallProductionStage = 'FULFILLED';
      if (typeof tracking_url === 'string' && /^https:\/\//i.test(tracking_url)) match.fourthwallTrackingUrl = tracking_url;
      match.updatedAt = new Date().toISOString();
      saveGearDesigns();
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[Fourthwall Webhook] Error processing event:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

// 9. Fourthwall Health & Config Status (admin only)
app.get(['/api/fourthwall/health', '/fourthwall/health'], (req: Request, res: Response) => {
  if (!checkIsAdmin(req)) {
    return res.json({ status: 'ok' });
  }
  const isConfigured = Boolean(process.env.FOURTHWALL_API_KEY || process.env.FOURTHWALL_ACCESS_TOKEN);
  res.json({
    status: 'ok',
    configured: isConfigured,
    mode: isConfigured ? 'live' : 'sandbox',
    apiUrl: process.env.FOURTHWALL_API_URL || 'https://platform.fourthwall.com/v1',
    shopId: process.env.FOURTHWALL_SHOP_ID || 'mutualpool-creator-shop',
    catalogItemsAvailable: FOURTHWALL_GEAR_CATALOG.length,
    activeOrdersCount: gearDesigns.length,
  });
});

// --- VOICE AI & NATURAL AUDIO AGENT API ---
app.post('/api/ai/voice-guide', async (req: Request, res: Response) => {
  try {
    const sessionUser = getCurrentUser(req);
    if (!sessionUser) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const { query, currentContext } = req.body || {};
    if (!query || typeof query !== 'string' || query.length > 1000) {
      return res.status(400).json({ error: 'Query string is required (max 1000 characters)' });
    }

    const client = getGeminiClient();
    // Account facts come from the server-side session, never from the request body.
    const activeTab = typeof currentContext?.activeTab === 'string' && /^[a-z-]{1,40}$/.test(currentContext.activeTab) ? currentContext.activeTab : 'my-pods';
    const userName = sessionUser.displayName || 'Member';
    const platform = sessionUser.platform || 'Gig Courier';
    const treasuryBalance = Number(sessionUser.treasury?.balanceUsd) || 0;
    const activePodsCount = pods.filter(p => p && p.status === 'ACTIVE' && isPodMember(p, sessionUser)).length;
    const lang = ['en', 'es', 'fr'].includes(currentContext?.language) ? currentContext.language : 'en';

    const fallbackKnowledge = (userQuery: string, language: string = 'en') => {
      const q = (userQuery || '').toLowerCase();
      const isEs = language === 'es';
      const isFr = language === 'fr';

      // 0. What is ROSCA / What is MutualPool / Savings Pod / Tandas / Susu / How does it work?
      if (
        q.includes('rosca') || q.includes('tanda') || q.includes('susu') || q.includes('pardna') || 
        q.includes('arisan') || q.includes('chit fund') || q.includes('mutualpool') || 
        q.includes('what is') || q.includes('how does a pod work') || q.includes('how do pods work') ||
        q.includes('how it work') || q.includes('savings pod') || q.includes('qué es') || 
        q.includes('cómo funciona') || q.includes('grupo de ahorro') || q.includes("qu'est-ce") || 
        q.includes('comment fonctionne') || q.includes("groupe d'épargne") || q.includes('tontine')
      ) {
        if (isEs) {
          return {
            spokenText: "MutualPool es una Asociación de Ahorro y Crédito Rotativo (ROSCA) entre pares modernizada—conocida mundialmente como tanda, susu o pardna. Los miembros aportan un depósito semanal fijo y cada semana uno recibe el pozo acumulado sin intereses ni deudas.",
            displayText: "🔄 ¿Qué es MutualPool y Cómo Funciona un Grupo de Ahorro (ROSCA)?\n\n• ROSCA Modernizada (Tandas / Susu / Pardna): Modelo cultural de ahorro colaborativo para repartidores y trabajadores independientes.\n• Cómo Funciona: Los miembros aportan un depósito semanal fijo (ej. $20.00/semana). Cada semana, un miembro por rotación recibe el fondo acumulado (ej. $400.00 bruto / $360.00 neto en un grupo de 20).\n• 0% Interés y Sin Deudas: Sin intereses abusivos, sin préstamos bancarios y sin verificación de crédito.\n• Seguridad FDIC y Custodia IA: Cuentas aseguradas con supervisión automática de Lainie AI.",
            suggestedActions: [
              { label: "¿Es MutualPool un préstamo?", action: "SPEAK_EXPLANATION", prompt: "¿Es MutualPool un préstamo o tarjeta de crédito?" },
              { label: "¿Cómo funciona la rotación?", action: "SPEAK_EXPLANATION", prompt: "¿Cómo funciona la rotación fija?" },
              { label: "Ver FAQ Completo", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        if (isFr) {
          return {
            spokenText: "MutualPool est une Association d'Épargne et de Crédit Rotatif (ROSCA ou Tontine) modernisée. Les membres versent une cotisation hebdomadaire fixe et chaque semaine un membre reçoit le pot collectif sans aucun intérêt ni dette.",
            displayText: "🔄 Qu'est-ce que MutualPool & Comment Fonctionnent les Groupes (ROSCAs / Tontines) ?\n\n• ROSCA / Tontine Modernisée : Modèle d'épargne collective éprouvé, conçu pour les livreurs et travailleurs indépendants.\n• Fonctionnement : Chaque membre verse une cotisation hebdomadaire fixe (ex. 20 $/semaine). Chaque semaine, un membre reçoit le pot collectif (ex. 400 $ brut / 360 $ net pour 20 membres).\n• 0% Intérêt & Aucune Dette : Pas de prêt bancaire, aucun taux d'usure ni contrôle de crédit.\n• Comptes Protégés FDIC & Gardienne IA : Sécurité bancaire maximale supervisée par Lainie AI.",
            suggestedActions: [
              { label: "Est-ce un prêt bancaire ?", action: "SPEAK_EXPLANATION", prompt: "MutualPool est-il un prêt bancaire ou une dette ?" },
              { label: "Rotation fixe", action: "SPEAK_EXPLANATION", prompt: "Comment fonctionne la rotation fixe ?" },
              { label: "Consulter la FAQ", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        return {
          spokenText: "MutualPool is a modernized peer-to-peer Rotating Savings and Credit Association, or ROSCA—known globally as a tanda, susu, or pardna. Members make a fixed weekly deposit, and each week one member receives the full collective lump-sum pot with zero interest and no debt.",
          displayText: "🔄 What is MutualPool & How Rotating Savings Pods (ROSCAs) Work\n\n• Modernized ROSCA (Tanda / Susu / Pardna): A time-tested collaborative savings model built specifically for 1099 couriers and gig workers.\n• How It Works: Members make a fixed weekly deposit (e.g., $20.00/week). Each week, one member in the scheduled rotation receives the collective lump-sum pot (e.g., $400 gross / $360 net for a 20-member pod).\n• 0% Interest & Zero Debt: No bank loan debt, no predatory compounding fees, and no credit checks.\n• FDIC Pass-Through & AI Custodianship: Safe holding accounts with Lainie AI automated escrow protections.",
          suggestedActions: [
            { label: "Is MutualPool a loan?", action: "SPEAK_EXPLANATION", prompt: "Is MutualPool a loan, credit card, or debt?" },
            { label: "How rotation works", action: "SPEAK_EXPLANATION", prompt: "How does fixed rotation work?" },
            { label: "Browse Full FAQ", action: "OPEN_MODAL", modal: "FAQ" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
        };
      }

      // 1. Is MutualPool a loan / credit / interest?
      if (q.includes('loan') || q.includes('credit') || q.includes('interest') || q.includes('debt') || q.includes('préstamo') || q.includes('interés') || q.includes('crédito') || q.includes('deuda') || q.includes('prêt') || q.includes('crédit') || q.includes('dette') || q.includes('intérêt')) {
        if (isEs) {
          return {
            spokenText: "MutualPool no es un préstamo bancario ni una tarjeta de crédito. Tiene 0% de interés, no genera deudas y no requiere historial de crédito. Es ahorro mutuo colaborativo entre repartidores.",
            displayText: "🚫 Cero Intereses, No es un Préstamo Bancario\n\n• 0% Interés y Sin Deudas: Ahorras con tu propio dinero junto a repartidores verificados.\n• Sin Verificación de Buró: No requieres historial de crédito bancario.\n• Basado en Tandas / Susu: Modelo cultural de ahorro rotativo modernizado con cuentas bancarias aseguradas por la FDIC.",
            suggestedActions: [
              { label: "Ver FAQ Completo", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "¿Cómo funciona la rotación?", action: "SPEAK_EXPLANATION", prompt: "¿Cómo funciona la rotación fija?" },
              { label: "Explorar Grupos", action: "NAVIGATE_TAB", tab: "explore-pods" }
            ],
            navigationAction: null
          };
        }
        if (isFr) {
          return {
            spokenText: "MutualPool n'est ni un prêt ni une carte de crédit. Il n'y a 0% d'intérêt, aucune dette et aucun contrôle bancaire. C'est de l'épargne rotative entre pairs.",
            displayText: "🚫 0% Intérêt, Pas de Prêt Bancaire\n\n• 0% Intérêt & Aucune Dette : Vous mutualisez vos économies avec des collègues vérifiés.\n• Aucun Contrôle de Crédit : Pas de score bancaire exigé.\n• Inspiré des Tontines / Susu : Système d'épargne rotative modernisé avec comptes protégés par la FDIC.",
            suggestedActions: [
              { label: "Consulter la FAQ", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "Rotation fixe", action: "SPEAK_EXPLANATION", prompt: "Comment fonctionne la rotation fixe ?" },
              { label: "Explorer les Groupes", action: "NAVIGATE_TAB", tab: "explore-pods" }
            ],
            navigationAction: null
          };
        }
        return {
          spokenText: "MutualPool is not a bank loan or a credit card. There is 0% interest, zero compounding debt, and no credit check. You are pooling your own income with verified gig workers.",
          displayText: "🚫 0% Interest — Not a Bank Loan or Debt\n\n• Zero Interest & No Compounding Debt: You pool your own income with verified gig couriers.\n• No Credit Check: No minimum FICO or credit score required.\n• Modernized ROSCA (Tanda / Susu / Pardna): Members save collectively with FDIC pass-through bank accounts.",
          suggestedActions: [
            { label: "Browse Full FAQ", action: "OPEN_MODAL", modal: "FAQ" },
            { label: "How rotation works", action: "SPEAK_EXPLANATION", prompt: "How does fixed rotation work?" },
            { label: "Explore Pods", action: "NAVIGATE_TAB", tab: "explore-pods" }
          ],
          navigationAction: null
        };
      }

      // 1.5 Creator Payout Spot Swapping & 3% Cut Transfer Policy
      const isCreatorSwap = (q.includes('creator') || q.includes('creador') || q.includes('créateur') || q.includes('host') || q.includes('anfitrión') || q.includes('hôte')) &&
        (q.includes('swap') || q.includes('switch') || q.includes('trade') || q.includes('spot') || q.includes('cambi') || q.includes('échang') || q.includes('early payout') || q.includes('adelant') || q.includes('cut') || q.includes('lugar') || q.includes('place'));

      if (isCreatorSwap) {
        if (isEs) {
          return {
            spokenText: "El Creador del grupo puede intercambiar su puesto para cobrar antes como cualquier miembro. Sin embargo, el corte del 3% semanal sobre los cobros de compañeros se transferirá a la persona con quien intercambie el turno.",
            displayText: "🔄 Intercambio de Puestos del Creador y Transferencia del 3%\n\n• Flexibilidad Total: El Creador del grupo puede intercambiar turnos con cualquier compañero (igual que cualquier miembro) para recibir un cobro anticipado por emergencias.\n• Transferencia del Corte del 3%: El corte del 3% semanal sobre los cobros de compañeros que recibía el Creador por ser el último se otorgará a quien intercambie el lugar una vez aprobado y activo el cambio.\n• Ejemplo: Si el Creador intercambia lugares con el 'Miembro X' para un cobro anticipado, el Miembro X pasa a la posición final y recibe el 3% semanal en cada cobro siguiente.",
            suggestedActions: [
              { label: "Ver Mis Grupos", action: "NAVIGATE_TAB", tab: "my-pods" },
              { label: "Ver FAQ Completo", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Le Créateur peut échanger sa place pour un versement anticipé. Toutefois, la prime hebdomadaire de 3 % sur les versements des coéquipiers sera attribuée au membre avec lequel il échange sa place dès l'activation.",
            displayText: "🔄 Échange de Place du Créateur & Transfert des 3 %\n\n• Liberté Totale : Le Créateur peut échanger sa place avec un coéquipier (comme tout autre membre) pour obtenir un versement anticipé en cas d'urgence.\n• Transfert de la Prime de 3 % : La prime hebdomadaire de 3 % sur tous les versements des coéquipiers est transmise au membre qui prend sa place finale dès validation de l'échange.\n• Exemple : Si le Créateur échange avec le Membre X pour un versement anticipé, le Membre X prend la place finale et perçoit les 3 % hebdomadaires.",
            suggestedActions: [
              { label: "Voir Mes Groupes", action: "NAVIGATE_TAB", tab: "my-pods" },
              { label: "Consulter la FAQ", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        return {
          spokenText: "The Pod Creator can switch places as they please for an early payout. However, the 3% weekly cut on all teammate payouts will be given to whomever they switch spots with once the switch is approved and active.",
          displayText: "🔄 Creator Spot Switch & 3% Cut Transfer Policy\n\n• Full Flexibility to Switch: The Pod Creator can switch places as they please (just like any other member) for an early payout.\n• 3% Weekly Cut Transfers: The 3% weekly cut on all teammate payouts that the Creator gets for being last is transferred to whomever they switch spots with once approved and active.\n• Example: If the Creator asks to switch places for an early payout with 'Member X', Member X takes the later/final position and receives the 3% weekly cut going forward.",
          suggestedActions: [
            { label: "View My Pods", action: "NAVIGATE_TAB", tab: "my-pods" },
            { label: "Browse Full FAQ", action: "OPEN_MODAL", modal: "FAQ" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
        };
      }

      // 2. Creator Host Stewardship Reward (3%) & Skin in the Game
      if (q.includes('host') || q.includes('creator') || q.includes('skin in the game') || q.includes('3%') || q.includes('last slot') || q.includes('final slot') || q.includes('anfitrión') || q.includes('creador') || q.includes('recompensa') || q.includes('último turno') || q.includes('hôte') || q.includes('créateur') || q.includes('récompense')) {
        if (isEs) {
          return {
            spokenText: "Los Creadores de grupos toman el último turno de cobro como garantía de confianza y reciben una recompensa de anfitrión del 3% en cada desembolso semanal de sus compañeros.",
            displayText: "🌟 Recompensa del Creador (3%) y Compromiso Real\n\n• Garantía de Confianza: El Creador se fija en el último turno (#N) para proteger al grupo contra fraudes.\n• Recompensa del 3%: Por liderar el grupo, el Creador gana el 3% de cada desembolso semanal (ej. $12/semana en un pozo de $400, sumando $228 en 20 semanas).\n• Depósito Directo: Las ganancias se acreditan automáticamente a su saldo de Stripe Treasury.",
            suggestedActions: [
              { label: "Crear un Grupo Ahora", action: "OPEN_MODAL", modal: "CREATE_POD" },
              { label: "Ver FAQ de Creadores", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Les Créateurs de groupes occupent le dernier tour de versement pour garantir la sécurité et reçoivent une prime d'hôte de 3% sur chaque versement de leurs coéquipiers.",
            displayText: "🌟 Prime d'Hôte Créateur (3%) & Sécurité Totale\n\n• Engagement Garanti : Le Créateur est placé au dernier tour (#N) pour éliminer tout risque de désistement précoce.\n• Prime de Gestion de 3% : En contrepartie, le Créateur perçoit 3% sur chaque versement hebdomadaire (ex. 12 $/semaine sur un pot de 400 $, soit 228 $ sur 20 semaines).\n• Crédité sur Treasury : Versements directs sur votre compte Stripe Treasury.",
            suggestedActions: [
              { label: "Créer un Groupe", action: "OPEN_MODAL", modal: "CREATE_POD" },
              { label: "FAQ Créateurs", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
          };
        }
        return {
          spokenText: "Pod Creators take the final rotation slot as a skin-in-the-game safety guarantee. In return, they earn a 3% Host Stewardship Reward on every teammate payout, totaling up to $228 in passive earnings.",
          displayText: "🌟 3% Creator Host Stewardship Reward & Skin-in-the-Game\n\n• Skin-in-the-Game: The Creator is pinned to the final rotation slot (#N) so they stay committed to the cycle.\n• 3% Host Reward: The Creator earns 3% on every teammate payout (e.g. $12/payout on a $400 pot → $228 total on a 20-member pod).\n• Direct Deposit: Rewards disburse automatically into the Creator's Stripe Treasury wallet.",
          suggestedActions: [
            { label: "Create a Pod Now", action: "OPEN_MODAL", modal: "CREATE_POD" },
            { label: "Read Creator FAQ", action: "OPEN_MODAL", modal: "FAQ" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
        };
      }

      // 3. Autonomous AI Custodian Protocol (Lainie AI) & Defaults
      if (q.includes('custodian') || q.includes('autonomous') || q.includes('lainie') || q.includes('bot') || q.includes('custodia') || q.includes('autónom') || q.includes('gardien') || q.includes('protocole')) {
        if (isEs) {
          return {
            spokenText: "Si el Creador de un grupo sufre un imprevisto o falta a sus depósitos, yo asumo la custodia autónoma del grupo. Administro los pagos automáticamente sin transferir cargas a los miembros.",
            displayText: "🤖 Protocolo de Custodia Autónoma por Lainie AI\n\n• Toma de Control Inmediata: Si un Creador tiene problemas, Lainie AI asume la administración completa del grupo.\n• Cero Carga para los Miembros: No hay estrés administrativo ni cobros manuales entre compañeros.\n• Redirección de Fondos: El 3% del creador se redirige a la Cuenta de Custodia del Sistema para garantizar todos los pagos semanales a tiempo.",
            suggestedActions: [
              { label: "Ver FAQ de Custodia", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "Ver Mis Grupos", action: "NAVIGATE_TAB", tab: "my-pods" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Si le Créateur d'un groupe fait défaut, je prends le relais en tant que gardienne IA autonome pour assurer les versements sans aucune charge administrative pour les membres.",
            displayText: "🤖 Protocole de Gardienne IA Autonome (Lainie)\n\n• Prise de Relais Automatique : En cas d'empêchement du créateur, Lainie AI gère la rotation et les versements.\n• Zéro Fardeau Administratif : Aucun stress pour les membres du groupe.\n• Sécurisation des Versements : Les frais de gestion sont réaffectés au compte d'entiercement du système pour garantir 100% des paiements.",
            suggestedActions: [
              { label: "Voir la FAQ Gardienne", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "Mes Groupes", action: "NAVIGATE_TAB", tab: "my-pods" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        return {
          spokenText: "If a Pod Creator experiences hardship or defaults, I step in as the Autonomous AI Custodian. I manage the pod rotations and weekly payouts automatically with zero administrative burden on members.",
          displayText: "🤖 Autonomous AI Custodian Protocol (Lainie AI)\n\n• Automated Pod Takeover: If a Creator defaults, Lainie AI assumes full custodianship of the pod.\n• Zero Member Burden: No manual debt collection or administrative stress placed on participating drivers.\n• System Escrow Backstop: The Creator forfeits the 3% reward, which is redirected into the System Deposits Escrow to guarantee on-time payouts.",
          suggestedActions: [
            { label: "View FAQ on Custodianship", action: "OPEN_MODAL", modal: "FAQ" },
            { label: "Go to My Pods", action: "NAVIGATE_TAB", tab: "my-pods" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
        };
      }

      // 4. System Deposits Escrow Account & Missed Payment Safety Net
      if (q.includes('escrow') || q.includes('system deposit') || q.includes('missed') || q.includes('default') || q.includes('shortfall') || q.includes('garantía') || q.includes('falta') || q.includes('impago') || q.includes('entiercement') || q.includes('retard')) {
        if (isEs) {
          return {
            spokenText: "La Cuenta de Depósitos de Custodia del Sistema es una reserva de liquidez que adelanta depósitos impagos para asegurar que el miembro de turno reciba su desembolso completo a tiempo.",
            displayText: "🛡️ Cuenta de Depósitos de Custodia del Sistema y Protección ante Impagos\n\n1. Periodo de Gracia de 72 Horas: Notificaciones automáticas para regularizar depósitos.\n2. Fondo de Contingencia de Primer Ciclo: Cubre vacantes iniciales.\n3. Adelanto del Sistema Escrow: La plataforma adelanta el depósito faltante para que el receptor de la semana cobre el 100% de su pozo sin demoras.\n4. Reemplazo de Miembros: Las vacantes se abren para conductores verificados.",
            suggestedActions: [
              { label: "Ver FAQ de Protección", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "Fondo de Solidaridad", action: "OPEN_MODAL", modal: "HARDSHIP" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Le Compte d'Entiercement du Système est une réserve centrale qui avance les dépôts manquants afin que le membre du tour reçoive son versement complet dans les délais.",
            displayText: "🛡️ Entiercement du Système & Protection Anti-Défaut\n\n1. Période de Grâce de 72h : Rappels sans pénalité pour régulariser les cotisations.\n2. Buffer de Contingence Cycle 1 : Prise en charge des imprévus.\n3. Avance d'Entiercement du Système : La plateforme avance les fonds manquants pour verser 100% du pot sans retard.\n4. Remplacement Rapide : Réattribution du créneau à un chauffeur vérifié.",
            suggestedActions: [
              { label: "FAQ Protection & Entiercement", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "Fonds de Solidarité", action: "OPEN_MODAL", modal: "HARDSHIP" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        return {
          spokenText: "The System Deposits Escrow Account is a liquidity reserve that advances missing deposits if a member is late. This guarantees that weekly rotation recipients always get their 100% full payout on time.",
          displayText: "🛡️ System Deposits Escrow Account & Default Protection\n\n1. 72-Hour Grace Period: Automated reminders to resolve pending deposits without penalty.\n2. First-Cycle Contingency Buffer: Welcome match cushions initial cycle delays.\n3. System Escrow Advance: MutualPool advances the missing weekly contribution so the recipient gets 100% of their lump sum.\n4. Verified Replacement: Delinquent slots are opened to verified gig couriers.",
          suggestedActions: [
            { label: "Open FAQ on Escrow", action: "OPEN_MODAL", modal: "FAQ" },
            { label: "Hardship Protection", action: "OPEN_MODAL", modal: "HARDSHIP" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
        };
      }

      // 5. Fees (5% Initial Deposit Fee, 10% Payout Service Fee)
      if (q.includes('fee') || q.includes('cost') || q.includes('charge') || q.includes('5%') || q.includes('10%') || q.includes('comisi') || q.includes('tarifa') || q.includes('cuota') || q.includes('frais') || q.includes('coût')) {
        if (isEs) {
          return {
            spokenText: "Cobramos una tarifa inicial del 5% al configurar tu cuenta Treasury y una tarifa de servicio del 10% sobre los desembolsos. El 3% se destina al Creador del grupo y el 7% a las reservas de la plataforma.",
            displayText: "💳 Estructura Transparente de Tarifas\n\n• Tarifa de Depósito Inicial (5%): Solo en tu primer depósito para inicializar tu cuenta bancaria asegurada por la FDIC en Stripe Treasury.\n• Tarifa de Desembolso (10%): Deducida al entregar el pozo acumulado (ej. $40 en un pozo de $400 → $360 netos al conductor):\n  - 3% para el Creador del grupo como Recompensa de Anfitrión.\n  - 7% para operaciones de la plataforma, reservas de contingencia y cumplimiento FDIC.\n• 0% Intereses: Cero intereses acumulativos ni cargos ocultos.",
            suggestedActions: [
              { label: "Ver FAQ de Tarifas", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "Ver Mis Grupos", action: "NAVIGATE_TAB", tab: "my-pods" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Nous appliquons des frais initiaux de 5% à l'ouverture de votre compte Treasury et des frais de service de 10% sur les versements (dont 3% pour le Créateur hôte et 7% pour les réserves de la plateforme).",
            displayText: "💳 Structure Claire des Frais\n\n• Frais de Dépôt Initial (5%) : Appliqués uniquement sur la 1ère cotisation pour initialiser le compte Stripe Treasury protégé FDIC.\n• Frais de Versement (10%) : Déduits lors de la réception du pot (ex. 40 $ sur un pot de 400 $ → 360 $ nets versés) :\n  - 3% versés au Créateur du groupe (Prime d'Hôte).\n  - 7% pour l'infrastructure Treasury, les garanties anti-défaut et la conformité FDIC.\n• 0% Intérêt : Zéro dette ni frais cachés.",
            suggestedActions: [
              { label: "Voir la FAQ Frais", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "Explorer les Groupes", action: "NAVIGATE_TAB", tab: "explore-pods" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        return {
          spokenText: "MutualPool charges a 5% initial deposit setup fee and a 10% Payout Service Fee when you receive your lump sum. 3% goes to the Pod Creator as a Host Reward and 7% funds platform reserves and FDIC compliance.",
          displayText: "💳 Transparent Platform Fee Structure\n\n• Initial Deposit Fee (5%): One-time fee on your first deposit to initialize your FDIC-insured Stripe Treasury account.\n• Payout Service Fee (10%): Deducted only when the lump-sum pot is disbursed (e.g. $40 fee on a $400 pool → $360.00 net payout):\n  - 3% paid directly to the active Pod Creator as a Host Stewardship Reward.\n  - 7% funds platform liquidity reserves, First-Cycle buffer, and banking compliance.\n• Zero Interest: No predatory loan APRs or compounding balance fees.",
          suggestedActions: [
            { label: "Read Fees FAQ", action: "OPEN_MODAL", modal: "FAQ" },
            { label: "Explore Savings Pods", action: "NAVIGATE_TAB", tab: "explore-pods" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
        };
      }

      // 6. Invite Window, Expiration & Flexible Early Launch
      if (q.includes('invite') || q.includes('expire') || q.includes('window') || q.includes('flexible') || q.includes('early launch') || q.includes('invitaci') || q.includes('expira') || q.includes('lanzamiento') || q.includes('expiration') || q.includes('lancement')) {
        if (isEs) {
          return {
            spokenText: "Al crear un grupo eliges una ventana de invitación de 3 a 30 días. Con el Lanzamiento Flexible, puedes iniciar el ciclo en cuanto se unan 2 o más miembros sin esperar a llenar todos los cupos.",
            displayText: "⏱️ Ventana de Invitación y Lanzamiento Flexible\n\n• Ventana de Invitación (3, 7, 14, 30 días): Al vencer, el grupo puede abrirse automáticamente al público o seguir esperando.\n• Lanzamiento Flexible Anticipado: ¡No tienes que esperar 20 miembros! Puedes iniciar el ciclo con 2 o más miembros, y los desembolsos se ajustan dinámicamente.",
            suggestedActions: [
              { label: "Crear un Grupo Ahora", action: "OPEN_MODAL", modal: "CREATE_POD" },
              { label: "Ver FAQ de Grupos", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Lors de la création d'un groupe, vous choisissez un délai d'invitation de 3 à 30 jours. Grâce au Lancement Flexible, vous pouvez démarrer dès 2 membres sans attendre que le groupe soit complet.",
            displayText: "⏱️ Délai d'Invitation & Lancement Flexible\n\n• Délai d'Invitation (3, 7, 14, 30 jours) : À l'expiration, le groupe s'ouvre automatiquement au public ou reste privé.\n• Lancement Flexible Anticipé : Démarrez dès 2 membres inscrits ; les versements hebdomadaires s'adaptent automatiquement au nombre de participants actifs.",
            suggestedActions: [
              { label: "Créer un Groupe", action: "OPEN_MODAL", modal: "CREATE_POD" },
              { label: "Consulter la FAQ", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
          };
        }
        return {
          spokenText: "When creating a pod, you set an invite window of 3 to 30 days. With Flexible Early Launch, you can start weekly cycles as soon as 2 or more members join without waiting for all slots to fill.",
          displayText: "⏱️ Invite Windows & Flexible Early Launch\n\n• Invite Windows (3, 7, 14, or 30 days): Choose whether to auto-open vacant slots to verified drivers or keep the circle private upon expiration.\n• Flexible Early Launch: Creators can launch the pod with 2 or more members. Payouts scale dynamically to match the active member count.",
          suggestedActions: [
            { label: "Create a Pod Now", action: "OPEN_MODAL", modal: "CREATE_POD" },
            { label: "Browse Full FAQ", action: "OPEN_MODAL", modal: "FAQ" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
        };
      }

      // 7. General FAQ / Help Query
      if (q.includes('faq') || q.includes('help') || q.includes('question') || q.includes('rule') || q.includes('ayuda') || q.includes('pregunta') || q.includes('regla') || q.includes('aide') || q.includes('foire aux questions')) {
        if (isEs) {
          return {
            spokenText: "He abierto nuestro Centro de Preguntas Frecuentes. Incluye guías sobre grupos de ahorro, recompensas del 3% para creadores, custodia autónoma por IA, seguro FDIC y campañas para embajadores.",
            displayText: "📚 Centro de Preguntas Frecuentes (FAQ)\n\nHe abierto el Centro de Conocimiento de MutualPool. Puedes explorar:\n• Conceptos Básicos y Tandas (ROSCAs)\n• Recompensas del Creador (3%)\n• Depósitos, Desembolsos y Tarifas (10%)\n• Custodia Autónoma por Lainie AI y Escrow del Sistema\n• Seguridad FDIC ($250,000) y Verificación KYC\n• Campañas de Embajadores de Marca",
            suggestedActions: [
              { label: "Ver FAQ Completo", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "Reglas de la Plataforma", action: "OPEN_MODAL", modal: "HOW_IT_WORKS" },
              { label: "Contactar Soporte", action: "OPEN_MODAL", modal: "CONTACT" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        if (isFr) {
          return {
            spokenText: "J'ai ouvert notre Centre de FAQ. Vous y trouverez toutes les réponses sur les groupes d'épargne, la prime créateur de 3%, la gardienne IA, la protection FDIC et les campagnes de marque.",
            displayText: "📚 Centre de Foire Aux Questions (FAQ)\n\nConsultez notre base de connaissances complète :\n• Principes de Base & Tontines (ROSCAs)\n• Primes d'Hôte Créateur (3%)\n• Dépôts, Versements & Frais (10%)\n• Gardienne IA Autonome & Entiercement du Système\n• Sécurité FDIC (250 000 $) & Vérification KYC\n• Campagnes Ambassadeurs & Équipements",
            suggestedActions: [
              { label: "Ouvrir la FAQ", action: "OPEN_MODAL", modal: "FAQ" },
              { label: "Règles de la Plateforme", action: "OPEN_MODAL", modal: "HOW_IT_WORKS" },
              { label: "Contacter le Support", action: "OPEN_MODAL", modal: "CONTACT" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
          };
        }
        return {
          spokenText: "I've opened our FAQ Knowledge Base for you. It covers savings pod mechanics, 3% creator rewards, Autonomous AI Custodianship, FDIC insurance, and brand ambassador shifts.",
          displayText: "📚 FAQ Knowledge Base\n\nI've opened the full Knowledge Base. You can explore:\n• Basics & Rotating Savings Pods (ROSCAs)\n• Creator Host Rewards (3% Stewardship)\n• Deposits, Payouts & Platform Fees (10%)\n• Autonomous AI Custodian (Lainie AI) & System Escrow\n• FDIC Insurance ($250,000) & KYC Security\n• Brand Ambassador Campaigns & Vision Verification",
          suggestedActions: [
            { label: "Open Full FAQ", action: "OPEN_MODAL", modal: "FAQ" },
            { label: "View Rules", action: "OPEN_MODAL", modal: "HOW_IT_WORKS" },
            { label: "Contact Support", action: "OPEN_MODAL", modal: "CONTACT" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
        };
      }

      // 8. Rotation slot swap
      if (q.includes('swap') || q.includes('spot') || q.includes('trade') || q.includes('turn') || q.includes('turno') || q.includes('intercamb') || q.includes('tour') || q.includes('échange')) {
        if (isEs) {
          return {
            spokenText: "Los miembros pueden intercambiar turnos para cobrar antes. El Creador del grupo también puede cambiar su puesto, transfiriendo su corte semanal del 3% a su compañero de intercambio.",
            displayText: "🔄 Intercambios de Turno de Cobro y Regla del Creador\n\n1. Solicitud entre Pares: En la pestaña Rotación de tu grupo, pulsa 'Solicitar Intercambio' junto a cualquier compañero.\n2. Aprobación Mutua: Cuando el otro miembro acepte, los turnos se intercambian al instante y sin penalizaciones.\n3. Regla del Creador: El Creador puede intercambiar su puesto para un cobro anticipado; en ese caso, el corte semanal del 3% sobre los cobros de compañeros se transferirá automáticamente a quien tome su lugar.",
            suggestedActions: [
              { label: "Ver Mis Grupos", action: "NAVIGATE_TAB", tab: "my-pods" },
              { label: "Ver FAQ Completo", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "my-pods" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Les membres peuvent échanger leur tour pour un versement anticipé. Le Créateur peut aussi échanger sa place, et sa prime de 3 % est alors transmise au membre qui prend sa place.",
            displayText: "🔄 Échanges de Tours de Versement & Règle Créateur\n\n1. Demande Entre Pairs : Dans l'onglet Rotation de votre groupe, cliquez sur 'Demander un Échange' à côté d'un autre membre.\n2. Approbation Mutuelle : Dès acceptation mutuelle, les positions s'échangent sans pénalité.\n3. Règle du Créateur : Le Créateur peut également échanger sa place pour un versement anticipé ; dans ce cas, la prime hebdomadaire de 3 % est transférée au membre avec lequel il échange sa place.",
            suggestedActions: [
              { label: "Voir Mes Groupes", action: "NAVIGATE_TAB", tab: "my-pods" },
              { label: "Consulter la FAQ", action: "OPEN_MODAL", modal: "FAQ" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "my-pods" }
          };
        }
        return {
          spokenText: "Pod members can switch places for an earlier payout with mutual consent. The Pod Creator can switch places too, and their 3% weekly cut transfers to whomever they switch spots with.",
          displayText: "🔄 Payout Spot Swaps & Creator Rule\n\n1. Request Spot Swap: In your active Pod's Rotation tab, click 'Request Spot Swap' next to any member.\n2. Mutual Consent: Once the other member accepts, positions trade immediately with zero penalty and full audit logging.\n3. Creator Switch Rule: The Creator can switch places as they please; the 3% weekly cut on teammate payouts is given to whomever the Creator switches spots with once active.",
          suggestedActions: [
            { label: "View My Pods", action: "NAVIGATE_TAB", tab: "my-pods" },
            { label: "Browse Full FAQ", action: "OPEN_MODAL", modal: "FAQ" }
          ],
          navigationAction: { type: "NAVIGATE_TAB", target: "my-pods" }
        };
      }

      // 9. Perks & Marketplace
      if (q.includes('perk') || q.includes('discount') || q.includes('gas') || q.includes('oil') || q.includes('tire') || q.includes('tax') || q.includes('repair') || q.includes('ventaja') || q.includes('beneficio') || q.includes('gasolina') || q.includes('aceite') || q.includes('llanta') || q.includes('avantage') || q.includes('réduction') || q.includes('essence') || q.includes('pneu')) {
        if (isEs) {
          return {
            spokenText: "Nuestro Mercado de Ventajas ofrece beneficios para el día a día en la calle: comidas rápidas económicas, parches de llanta, reparación de celulares, lavado de autos, masajes, estacionamiento y más.",
            displayText: "🎁 Mercado de Ventajas para Repartidores\n\nBeneficios para tu día a día en la calle:\n• Comidas rápidas y food trucks, café con recargas gratis\n• Llantas, mecánico móvil, lavado de autos y combustible a domicilio\n• Ofertas de celular y reparación de pantalla el mismo día\n• Masajes, gimnasio, lavandería, estacionamiento y cuidado infantil",
            suggestedActions: [
              { label: "Abrir Ventajas", action: "NAVIGATE_TAB", tab: "perks" },
              { label: "Canjear Beneficio", action: "NAVIGATE_TAB", tab: "perks" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "perks" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Notre espace Avantages propose des réductions pour le quotidien sur la route : repas rapides à petit prix, réparation de pneus et de téléphones, lavage auto, massages, stationnement et plus.",
            displayText: "🎁 Espace Avantages Gig\n\nDes avantages pour votre quotidien sur la route :\n• Repas rapides & food trucks, café à volonté\n• Pneus, mécanicien mobile, lavage auto et carburant livré\n• Offres mobile et réparation d'écran le jour même\n• Massages, salle de sport, laverie, stationnement et garde d'enfants",
            suggestedActions: [
              { label: "Ouvrir les Avantages", action: "NAVIGATE_TAB", tab: "perks" },
              { label: "Utiliser un Avantage", action: "NAVIGATE_TAB", tab: "perks" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "perks" }
          };
        }
        return {
          spokenText: "Our Gig Perks Marketplace has everyday savings for people on the road: cheap quick meals, tire patches, phone repairs, car washes, chair massages, parking and more. Let's look at the marketplace now.",
          displayText: "🎁 Gig Perks Marketplace\n\nEveryday perks for life on the road:\n• Quick meals & food trucks, free coffee refills\n• Tires, mobile mechanic, car wash & fuel delivery\n• Phone data deals & same-day screen repair\n• Massage, gym day passes, laundry, parking & childcare",
          suggestedActions: [
            { label: "Open Perks Marketplace", action: "NAVIGATE_TAB", tab: "perks" },
            { label: "Redeem a Perk", action: "NAVIGATE_TAB", tab: "perks" }
          ],
          navigationAction: { type: "NAVIGATE_TAB", target: "perks" }
        };
      }

      // 10. Create a Pod
      if (q.includes('create') || q.includes('new pod') || q.includes('start pod') || q.includes('crear') || q.includes('nuevo grupo') || q.includes('iniciar') || q.includes('créer') || q.includes('nouveau groupe')) {
        if (isEs) {
          return {
            spokenText: "Para iniciar un nuevo grupo, pulsa Crear Grupo arriba. Puedes elegir un Círculo de Confianza para tus compañeros o un Grupo Abierto con verificación automática de identidad.",
            displayText: "🚀 Crear un Grupo de Ahorro\n\n1. Haz clic en + Iniciar Grupo en la parte superior.\n2. Elige Círculo de Confianza (amigos/familiares) o Grupo Abierto (repartidores verificados con KYC).\n3. Define el monto del pozo, el depósito semanal (ej. $50/sem) y la duración del ciclo.",
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
            displayText: "🚀 Créer un Groupe d'Épargne\n\n1. Cliquez sur + Créer un Groupe dans l'en-tête.\n2. Choisissez Cercle de Confiance (invitation uniquement) ou Groupe Ouvert (membres vérifiés KYC).\n3. Définissez le montant cible, la cotisation hebdomadaire et la durée du cycle.",
            suggestedActions: [
              { label: "Créer un Groupe", action: "OPEN_MODAL", modal: "CREATE_POD" },
              { label: "Explorer les Groupes", action: "NAVIGATE_TAB", tab: "explore-pods" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
          };
        }
        return {
          spokenText: "To start a new Pod, click Create Pod at the top. You can choose a Trusted Circle for your trusted contacts or an Open Pod with automated KYC verification.",
          displayText: "🚀 Creating a Savings Pod\n\n1. Click + Create Pod in the dashboard header.\n2. Select Trusted Circle (invite-only, family/friends) or Open Pod (KYC-verified gig couriers).\n3. Set your target amount, weekly deposit (e.g. $50/wk), and cycle length.",
          suggestedActions: [
            { label: "Create a Pod Now", action: "OPEN_MODAL", modal: "CREATE_POD" },
            { label: "Explore Open Pods", action: "NAVIGATE_TAB", tab: "explore-pods" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "CREATE_POD" }
        };
      }

      // 11. Brand Ambassador Campaigns & Shifts
      if (q.includes('campaign') || q.includes('advertiser') || q.includes('wrap') || q.includes('brand') || q.includes('shift') || q.includes('hoodie') || q.includes('publicidad') || q.includes('embajador') || q.includes('vehículo') || q.includes('campagne') || q.includes('publicité') || q.includes('ambassadeur')) {
        if (isEs) {
          return {
            spokenText: "Con el programa de Embajadores de Marca, los conductores reciben pagos diarios garantizados de $55 a $75 por participar en campañas seleccionadas e indumentaria verificada con IA Vision.",
            displayText: "🚗 Campañas de Publicidad y Embajadores de Marca\n\n• Pagos diarios garantizados de $55 a $75/día según las campañas seleccionadas en las que participes.\n• Recibe sudaderas y bolsas térmicas oficiales gratuitas de la marca asociada.\n• Abono diario directo a tu cuenta Stripe Treasury tras verificar el turno.\n• Verificación de turnos por IA Vision (selfie) y seguimiento GPS.",
            suggestedActions: [
              { label: "Ver Campañas Activas", action: "NAVIGATE_TAB", tab: "campaigns" },
              { label: "Portal de Anunciantes", action: "OPEN_ADVERTISER" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "campaigns" }
          };
        }
        if (isFr) {
          return {
            spokenText: "Grâce au programme Ambassadeur de Marque, les coursiers reçoivent une rémunération quotidienne de 55$ à 75$/jour pour chaque campagne sélectionnée validée par IA Vision.",
            displayText: "🚗 Campagnes Publicitaires Véhicule & Ambassadeurs\n\n• Rémunération quotidienne de 55$ à 75$/jour selon les campagnes sélectionnées auxquelles vous participez.\n• Équipements premium gratuits (sweats, sacs isothermes) offerts par les marques.\n• Versement quotidien direct sur votre compte Stripe Treasury.\n• Validation instantanée par IA Vision (selfie) et GPS.",
            suggestedActions: [
              { label: "Voir les Campagnes", action: "NAVIGATE_TAB", tab: "campaigns" },
              { label: "Portail Annonceurs", action: "OPEN_ADVERTISER" }
            ],
            navigationAction: { type: "NAVIGATE_TAB", target: "campaigns" }
          };
        }
        return {
          spokenText: "Through our Brand Ambassador program, gig drivers earn guaranteed daily payouts of $55 to $75 based on selected campaigns they participate in, verified with AI Vision and GPS.",
          displayText: "🚗 Brand Ambassador & Sponsor Campaigns\n\n• Earn $55-$75/day in guaranteed daily payouts based on your selected campaigns.\n• Receive free premium sponsor apparel (weatherproof hoodies, insulated delivery bags).\n• Instant daily payouts deposited directly to your Stripe Treasury wallet.\n• Shift verification powered by multimodal AI Vision selfies and GPS tracking.",
          suggestedActions: [
            { label: "View Active Campaigns", action: "NAVIGATE_TAB", tab: "campaigns" },
            { label: "Advertiser Portal", action: "OPEN_ADVERTISER" }
          ],
          navigationAction: { type: "NAVIGATE_TAB", target: "campaigns" }
        };
      }

      // 12. Banking, FDIC Insurance & Stripe Treasury
      if (q.includes('treasury') || q.includes('bank') || q.includes('fdic') || q.includes('stripe') || q.includes('balance') || q.includes('payout') || q.includes('banco') || q.includes('saldo') || q.includes('seguro') || q.includes('banque') || q.includes('solde') || q.includes('kyc') || q.includes('seguridad')) {
        if (!TREASURY_PROGRAM_ENABLED) {
          // Member funds are not in Stripe Treasury accounts yet: no insurance claims.
          const neutral = isEs ? {
            spokenText: "Tu saldo de Tesorería registra tus depósitos y cobros. Los pagos se procesan con Stripe y los retiros van a la cuenta bancaria que verificaste. MutualPool es una plataforma tecnológica, no un banco.",
            displayText: "🏦 Tu saldo de Tesorería\n\n• Registra tus depósitos semanales y cobros de rotación.\n• Los pagos se procesan a través de Stripe.\n• Los retiros van a la cuenta bancaria verificada en Stripe.\n• MutualPool es una plataforma tecnológica, no un banco.",
            suggestedActions: [{ label: "Administrar Banco", action: "OPEN_MODAL", modal: "BANK" }, { label: "Verificar Identidad (KYC)", action: "OPEN_MODAL", modal: "KYC" }],
            navigationAction: { type: "OPEN_MODAL", target: "BANK" }
          } : isFr ? {
            spokenText: "Votre solde de trésorerie enregistre vos dépôts et versements. Les paiements sont traités par Stripe et les retraits vont sur le compte bancaire que vous avez vérifié. MutualPool est une plateforme technologique, pas une banque.",
            displayText: "🏦 Votre solde de trésorerie\n\n• Enregistre vos dépôts hebdomadaires et versements de rotation.\n• Paiements traités par Stripe.\n• Retraits vers le compte bancaire vérifié via Stripe.\n• MutualPool est une plateforme technologique, pas une banque.",
            suggestedActions: [{ label: "Gérer la Banque", action: "OPEN_MODAL", modal: "BANK" }, { label: "Vérifier l'Identité (KYC)", action: "OPEN_MODAL", modal: "KYC" }],
            navigationAction: { type: "OPEN_MODAL", target: "BANK" }
          } : {
            spokenText: "Your Treasury balance records your deposits and payouts. Payments are processed by Stripe, and withdrawals go to the bank account you verified. MutualPool is a technology platform, not a bank.",
            displayText: "🏦 Your Treasury balance\n\n• Records your weekly deposits and rotation payouts.\n• Payments are processed by Stripe.\n• Withdrawals go to the bank account you verified with Stripe.\n• MutualPool is a technology platform, not a bank.",
            suggestedActions: [{ label: "Manage Bank", action: "OPEN_MODAL", modal: "BANK" }, { label: "Verify Identity (KYC)", action: "OPEN_MODAL", modal: "KYC" }],
            navigationAction: { type: "OPEN_MODAL", target: "BANK" }
          };
          return neutral;
        }
        if (isEs) {
          return {
            spokenText: "Tu cuenta de MutualPool Treasury es una cuenta dedicada con seguro indirecto FDIC de hasta $250,000 mediante bancos asociados a Stripe Treasury.",
            displayText: "🏦 Stripe Treasury y Seguro FDIC\n\n• Cuenta de custodia dedicada para tus ahorros semanales.\n• Elegible para seguro indirecto FDIC hasta $250,000.\n• Transferencias directas a tu cuenta bancaria vinculada.",
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
            displayText: "🏦 Stripe Treasury & Garantie FDIC\n\n• Compte sécurisé dédié pour vos dépôts d'épargne hebdomadaires.\n• Éligibilité à la protection FDIC jusqu'à 250 000 $.\n• Versements rapides vers votre compte bancaire lié.",
            suggestedActions: [
              { label: "Gérer la Banque & Treasury", action: "OPEN_MODAL", modal: "BANK" },
              { label: "Vérifier l'Identité (KYC)", action: "OPEN_MODAL", modal: "KYC" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "BANK" }
          };
        }
        return {
          spokenText: "Your MutualPool Treasury is a dedicated account eligible for FDIC pass-through insurance up to $250,000 via Stripe Treasury partner banks. Your weekly pool payouts deposit automatically here.",
          displayText: "🏦 Stripe Treasury & FDIC Pass-Through\n\n• Dedicated holding account for weekly pool deposits.\n• Pass-through FDIC insurance eligibility up to $250,000.\n• Instant payouts to your linked external checking account or debit card.",
          suggestedActions: [
            { label: "Manage Bank & Treasury", action: "OPEN_MODAL", modal: "BANK" },
            { label: "Verify Identity (KYC)", action: "OPEN_MODAL", modal: "KYC" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "BANK" }
        };
      }

      // 13. Hardship Fund & Emergency Assistance
      if (q.includes('hardship') || q.includes('emergency') || q.includes('miss') || q.includes('late') || q.includes('delinquent') || q.includes('emergencia') || q.includes('dificultad') || q.includes('avería') || q.includes('urgence') || q.includes('panne')) {
        if (isEs) {
          return {
            spokenText: "Si sufres una avería imprevista en tu vehículo o una baja de ingresos, puedes solicitar ayuda al Fondo de Solidaridad de MutualPool para cubrir tu depósito sin perder tu posición.",
            displayText: "🛡️ Protección y Fondo de Solidaridad\n\n• Fondos de emergencia para cubrir tu depósito durante reparaciones mecánicas.\n• Cero intereses abusivos — facilidades de pago justas.\n• Protege tu reputación y mantiene tu grupo activo.",
            suggestedActions: [
              { label: "Solicitar Ayuda de Emergencia", action: "OPEN_MODAL", modal: "HARDSHIP" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "HARDSHIP" }
          };
        }
        if (isFr) {
          return {
            spokenText: "En cas de panne de véhicule ou d'imprévu financier, vous pouvez solliciter le Fonds de Solidarité MutualPool pour couvrir votre dépôt sans perdre votre place.",
            displayText: "🛡️ Protection & Fonds de Solidarité\n\n• Aide d'urgence pour couvrir vos cotisations en cas de réparation mécanique.\n• Aucun intérêt prédateur — conditions de remboursement souples.\n• Préserve votre réputation et le bon fonctionnement du groupe.",
            suggestedActions: [
              { label: "Demander une Aide d'Urgence", action: "OPEN_MODAL", modal: "HARDSHIP" }
            ],
            navigationAction: { type: "OPEN_MODAL", target: "HARDSHIP" }
          };
        }
        return {
          spokenText: "If you experience an unexpected vehicle breakdown or income disruption, you can request support from the MutualPool Hardship Fund to cover your weekly deposit without losing your pod standing.",
          displayText: "🛡️ MutualPool Hardship Protection\n\n• Emergency bridge funds to cover deposit during vehicle repairs.\n• Zero predatory interest — simple repayment terms.\n• Protects your reputation score and keeps your pod running smoothly.",
          suggestedActions: [
            { label: "Open Hardship Assistance", action: "OPEN_MODAL", modal: "HARDSHIP" }
          ],
          navigationAction: { type: "OPEN_MODAL", target: "HARDSHIP" }
        };
      }

      // Default contextual greeting & helper
      if (isEs) {
        return {
          spokenText: `¡Hola ${userName}! Soy Lainie, tu Guía de IA de MutualPool. Pregúntame sobre cómo funcionan los grupos de ahorro, recompensas del 3% para creadores, custodia autónoma, seguro FDIC o consulta la FAQ.`,
          displayText: `🎙️ Asistente de Voz Lainie AI (Base de Conocimiento FAQ)\n\nPuedo orientarte en todas las funciones:\n• Grupos de Ahorro Rotativo (Tandas / Susu / ROSCA) (0% interés, sin deudas)\n• Recompensas del Creador (3%) y Compromiso Real (Skin-in-the-Game)\n• Custodia Autónoma por IA y Depósitos en Custodia del Sistema\n• Cuentas Stripe Treasury y Seguro FDIC ($250,000)\n• Mercado de Ventajas y Campañas de Embajadores`,
          suggestedActions: [
            { label: "¿Qué es MutualPool y ROSCA?", action: "SPEAK_EXPLANATION", prompt: "¿Qué es MutualPool y cómo funciona un Grupo de Ahorro?" },
            { label: "¿Es MutualPool un préstamo?", action: "SPEAK_EXPLANATION", prompt: "¿Es MutualPool un préstamo o tarjeta de crédito?" },
            { label: "Recompensa del Creador 3%", action: "SPEAK_EXPLANATION", prompt: "¿Cómo funciona la recompensa de anfitrión del 3%?" },
            { label: "Ver FAQ Completo", action: "OPEN_MODAL", modal: "FAQ" }
          ],
          navigationAction: null
        };
      }

      if (isFr) {
        return {
          spokenText: `Bonjour ${userName} ! Je suis Lainie, votre Guide IA MutualPool. Posez-moi des questions sur les groupes d'épargne, la prime créateur de 3%, la gardienne IA, la protection FDIC ou consultez la FAQ.`,
          displayText: `🎙️ Assistant Vocal Lainie AI (Base de Connaissances FAQ)\n\nJe peux vous guider sur l'ensemble des fonctionnalités :\n• Groupes d'Épargne Rotative (Tontines / Susu / ROSCA) (0% intérêt, sans dette)\n• Primes d'Hôte Créateur (3%) & Engagement Garanti (Skin-in-the-Game)\n• Gardienne IA Autonome (Lainie) & Entiercement du Système\n• Comptes Stripe Treasury & Garantie FDIC (250 000 $)\n• Espace Avantages & Campagnes Ambassadeurs`,
          suggestedActions: [
            { label: "Qu'est-ce que ROSCA / Tontine ?", action: "SPEAK_EXPLANATION", prompt: "Qu'est-ce que MutualPool et comment fonctionne un groupe d'épargne ?" },
            { label: "Est-ce un prêt bancaire ?", action: "SPEAK_EXPLANATION", prompt: "MutualPool est-il un prêt bancaire ou une dette ?" },
            { label: "Prime Créateur 3%", action: "SPEAK_EXPLANATION", prompt: "Comment fonctionne la prime d'hôte de 3% pour le créateur ?" },
            { label: "Consulter la FAQ", action: "OPEN_MODAL", modal: "FAQ" }
          ],
          navigationAction: null
        };
      }

      return {
        spokenText: `Welcome ${userName}! I'm Lainie, your MutualPool Voice AI Guide. Ask me anything about how savings pods work, the 3% Creator Host Reward, our Autonomous AI Custodian, FDIC insurance, or explore our FAQ!`,
        displayText: `🎙️ MutualPool Voice Assistant (FAQ Knowledge Base)\n\nI am trained on the complete MutualPool Knowledge Base:\n• Rotating Savings Pods (ROSCAs / Susu / Tandas) (0% interest, no loan debt)\n• Creator Host Rewards (3%) & Skin-in-the-Game Guarantee\n• Autonomous AI Custodian Protocol (Lainie) & System Escrow\n• Stripe Treasury & FDIC Pass-Through Insurance ($250,000)\n• Transparent Fees (5% Setup / 10% Payout Service Fee)\n• Brand Ambassador Earnings & Vision Verification`,
        suggestedActions: [
          { label: "What is a ROSCA / Pod?", action: "SPEAK_EXPLANATION", prompt: "What is MutualPool and how does a Mutual Savings Pod work?" },
          { label: "Is MutualPool a loan?", action: "SPEAK_EXPLANATION", prompt: "Is MutualPool a loan, credit card, or debt?" },
          { label: "3% Creator Host Reward", action: "SPEAK_EXPLANATION", prompt: "How does the 3% Creator Host Stewardship Reward work?" },
          { label: "Browse Full FAQ", action: "OPEN_MODAL", modal: "FAQ" }
        ],
        navigationAction: null
      };
    };

    if (client) {
      try {
        const languageInstruction = lang === 'es' 
          ? 'MANDATORY LANGUAGE: The user\'s interface language is Spanish (Español). You MUST generate "spokenText", "displayText", and "suggestedActions[].label" completely in Spanish.'
          : lang === 'fr'
          ? 'MANDATORY LANGUAGE: The user\'s interface language is French (Français). You MUST generate "spokenText", "displayText", and "suggestedActions[].label" completely in French.'
          : 'MANDATORY LANGUAGE: The user\'s interface language is English. Respond in English.';

        const systemInstruction = `You are "Lainie", the intelligent, friendly, and highly knowledgeable on-screen Voice AI Guide for MutualPool (mutualpool.org).
MutualPool is a collaborative savings and gig economy perks platform built for 1099 couriers, rideshare drivers, and independent gig workers.
You are directly wired to the comprehensive MutualPool FAQ Knowledge Base.

${languageInstruction}

====================================================
MUTUALPOOL OFFICIAL FAQ KNOWLEDGE BASE:
====================================================

1. CATEGORY: BASICS & ROSCAs (TANDAS / SUSU / PARDNA / ARISAN)
- What is MutualPool? A modernized peer-to-peer Rotating Savings and Credit Association (ROSCA) for gig workers.
- How Pods Work: Members contribute a fixed weekly deposit (e.g. $20/wk). Each week, one member receives the full collective lump-sum pot (e.g., $400 gross / $360 net for 20 members). Over 20 weeks, all 20 members receive one full lump sum.
- 0% Interest, 0 Debt, No Credit Checks: MutualPool is NOT a loan, credit card, or bank. There is zero compounding interest, no predatory APR, and no credit score checks.
- Trusted Circles vs Open Pods:
  * Trusted Circles (Private): Invite-only for friends, family, or close delivery hub crews via private invite link/code.
  * Open Pods (Public): Open to all KYC-verified drivers across the network. Creators must have completed 1 full cycle with 100% on-time record to host an Open Pod.

2. CATEGORY: CREATOR HOST REWARDS & SKIN-IN-THE-GAME
- Skin-in-the-Game Guarantee: The Pod Creator is architecturally pinned to the FINAL rotation slot (Turn #N). This prevents early cash-out fraud and aligns incentives.
- 3% Host Stewardship Reward: In exchange for hosting and taking the last slot, the Creator earns 3% on every teammate payout (e.g., $12/payout on a $400 pool = $228 in cumulative passive rewards on a 20-member pod), credited directly to their Stripe Treasury balance.
- Creator Payout Spot Swapping & 3% Cut Transfer Policy: Pod Creators can switch places as they please (just like any other member) for an early payout. However, because the 3% weekly cut is given for being the last to be paid out, whomever the Creator switches spots with will be given the 3% weekly cut on all teammate payouts once the switch is approved and active. For example, if the Pod Creator asks to switch places for an early payout with 'Member X', the 3% weekly cut is transferred to 'Member X' once active.
- Invite Window & Flexible Early Launch:
  * Invite Windows: 3, 7, 14, or 30 days. Creators choose to auto-open vacant slots to the public or keep waiting upon expiration.
  * Flexible Early Launch: Creators can launch as soon as 2 or more members join without waiting for all 20 slots. Payouts scale dynamically.

3. CATEGORY: DEPOSITS, PAYOUTS & TRANSPARENT FEES
- Deposit Collection: Collected weekly via Stripe Treasury balance, Linked Bank ACH (Plaid/Financial Connections), or offset by Brand Campaign daily courier wages.
- Payout Execution: Net lump sum (90%) is credited to the recipient's Treasury balance; withdrawals go to their verified bank account via Stripe. Subsequent rotation weeks NEVER wait or block for bank withdrawals.
- Fee Structure:
  * 5% Initial Deposit Fee: Applied only on the 1st deposit to initialize the member's Treasury balance.
  * 10% Payout Service Fee: Deducted on payout (e.g. $40 on $400 pot = $360 net payout). 3% goes to Pod Creator as Host Reward; 7% goes to platform operations and the First-Cycle contingency buffer.

4. CATEGORY: AUTONOMOUS AI CUSTODIAN & SYSTEM ESCROW
- Autonomous AI Custodian Protocol (Lainie AI): If a Creator defaults or experiences hardship, Lainie AI automatically takes over pod administration with zero administrative burden on members. Creator forfeits the 3% reward, which is redirected to the System Escrow.
- System Deposits Escrow Account: Platform central liquidity reserve that advances weekly deposits for vacant slots or missed payments so rotation recipients always receive 100% full payout on time.
- Delinquent Member Replacement: After a 72-hour grace period, unpaid slots are opened to verified replacement drivers.
- Hardship Relief Fund: Emergency bridge protection for members facing vehicle mechanical breakdowns or medical emergencies.

5. CATEGORY: SECURITY${TREASURY_PROGRAM_ENABLED ? ', FDIC INSURANCE' : ''} & KYC VERIFICATION
${TREASURY_PROGRAM_ENABLED ? '- FDIC Pass-Through Insurance: Dedicated Stripe Treasury accounts held at FDIC-insured partner institutions (such as Evolve Bank & Trust or Fifth Third Bank) with pass-through insurance up to $250,000 per member.' : '- Custody: Deposits and payouts are processed by Stripe. MutualPool is a technology platform, not a bank; member balances are NOT FDIC insured. Never claim FDIC or deposit insurance.'}
- Stripe Identity KYC: Required under Bank Secrecy Act / AML regulations to prevent duplicate accounts and fraud.
- Peer Rotation Slot Swaps: Members of a pod can trade or switch places for early payout with mutual consent. The Pod Creator can also switch places as they please (just like any other member); however, the 3% weekly cut on all teammate payouts will be given to whomever the Creator switches spots with once the switch is approved and active.

6. CATEGORY: BRAND AMBASSADOR SPONSORSHIP CAMPAIGNS
- Daily Campaign Earnings: Couriers earn guaranteed daily payouts of $55-$75/day based on active participation in their selected brand campaigns.
- Free Apparel & Gear: Approved drivers get premium weatherproof hoodies and insulated bags.
- Direct Stripe Treasury Credit: Daily payouts are deposited directly to courier accounts upon completing shifts.
- AI Vision & GPS Verification: Shift check-in verified via multimodal camera selfie and GPS route logging.

7. CATEGORY: GIG PERKS MARKETPLACE
- Everyday perks (not offered by the delivery platforms): discounted quick meals at food trucks, coffee refills with restroom access, flat-tire patches and mobile mechanics, car washes, fuel delivery and EV charging, phone data plans and screen repair, chair massages, gym day passes, laundry, downtown parking, e-bike tune-ups, rain gear, haircuts, drop-in childcare and dog walking.

====================================================
RESPONSE GUIDELINES:
====================================================
- "spokenText": Concise, conversational, warm, and natural (1-3 sentences) suitable for text-to-speech audio. DO NOT include markdown symbols or URLs in spokenText.
- "displayText": Clear, clean plain text with bullet points (•) and natural line breaks. DO NOT use markdown characters like ### or **.
- If the user's intent is to view or do something in the app, specify "navigationAction":
  - {"type": "NAVIGATE_TAB", "target": "my-pods" | "explore-pods" | "perks" | "campaigns" | "audit-log" | "admin-ops"}
  - {"type": "OPEN_MODAL", "target": "FAQ" | "CREATE_POD" | "KYC" | "BANK" | "HARDSHIP" | "ABOUT" | "HOW_IT_WORKS" | "CONTACT"}
  - {"type": "OPEN_ADVERTISER"}
- Provide 2-3 helpful "suggestedActions" pills for one-tap follow-ups in the user's language (${lang}).

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
  "displayText": "string",
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
        if (responseText) {
          const parsedData = JSON.parse(responseText);
          if (parsedData && (parsedData.spokenText || parsedData.displayText)) {
            return res.json(sanitizeVoiceGuidePayload(parsedData));
          }
        }
      } catch (geminiError) {
        console.warn('Gemini API call warning in voice guide, using rich local fallback knowledge:', geminiError);
      }
    }

    // Always fallback smoothly to comprehensive knowledge base
    const fallback = fallbackKnowledge(query, lang);
    return res.json(sanitizeVoiceGuidePayload(fallback));
  } catch (err: any) {
    console.error('Error in /api/ai/voice-guide route:', err);
    const lang = req.body?.currentContext?.language || 'en';
    const fallback = (lang === 'es') ? {
      spokenText: "MutualPool es una Asociación de Ahorro y Crédito Rotativo (ROSCA / Tanda) modernizada para repartidores independientes, con 0% de interés y seguro FDIC.",
      displayText: "🎙️ Guía de IA de MutualPool (Lainie)\n\nEstoy aquí para responder cualquier pregunta sobre:\n• Grupos de Ahorro Rotativo (Tandas / ROSCA)\n• Recompensas de Creador del 3% y Compromiso Real\n• Custodia Autónoma por IA y Depósitos de Escrow\n• Cuentas Stripe Treasury y Seguro FDIC ($250,000)",
      suggestedActions: [
        { label: "¿Qué es ROSCA / Tanda?", action: "SPEAK_EXPLANATION", prompt: "¿Qué es MutualPool y cómo funciona un Grupo de Ahorro?" },
        { label: "Ver FAQ Completo", action: "OPEN_MODAL", modal: "FAQ" },
        { label: "Explorar Grupos", action: "NAVIGATE_TAB", tab: "explore-pods" }
      ],
      navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
    } : (lang === 'fr') ? {
      spokenText: "MutualPool est une Association d'Épargne et de Crédit Rotatif (ROSCA / Tontine) modernisée pour les livreurs, avec 0% d'intérêt et garantie FDIC.",
      displayText: "🎙️ Guide IA MutualPool (Lainie)\n\nJe suis là pour répondre à toutes vos questions sur :\n• Groupes d'Épargne Rotative (Tontines / ROSCA)\n• Primes d'Hôte Créateur (3%)\n• Gardienne IA Autonome & Entiercement du Système\n• Comptes Stripe Treasury & Garantie FDIC (250 000 $)",
      suggestedActions: [
        { label: "Qu'est-ce que ROSCA / Tontine ?", action: "SPEAK_EXPLANATION", prompt: "Qu'est-ce que MutualPool et comment fonctionne un groupe d'épargne ?" },
        { label: "Consulter la FAQ", action: "OPEN_MODAL", modal: "FAQ" },
        { label: "Explorer les Groupes", action: "NAVIGATE_TAB", tab: "explore-pods" }
      ],
      navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
    } : {
      spokenText: "MutualPool is a modernized peer-to-peer Rotating Savings and Credit Association (ROSCA) for gig workers with 0% interest and FDIC protection.",
      displayText: "🎙️ MutualPool Voice Assistant (Lainie AI)\n\nI can answer any question about our platform:\n• Rotating Savings Pods (ROSCAs / Susu / Tandas)\n• 3% Creator Host Rewards & Skin-in-the-Game\n• Autonomous AI Custodian Protocol & System Escrow\n• Stripe Treasury & FDIC Pass-Through Insurance ($250,000)",
      suggestedActions: [
        { label: "What is a ROSCA / Pod?", action: "SPEAK_EXPLANATION", prompt: "What is MutualPool and how does a Mutual Savings Pod work?" },
        { label: "Browse Full FAQ", action: "OPEN_MODAL", modal: "FAQ" },
        { label: "Explore Savings Pods", action: "NAVIGATE_TAB", tab: "explore-pods" }
      ],
      navigationAction: { type: "OPEN_MODAL", target: "FAQ" }
    };
    return res.json(sanitizeVoiceGuidePayload(fallback));
  }
});

// --- NATURAL GEMINI TTS (SPEECH GENERATION) API ---
app.post('/api/ai/tts', async (req: Request, res: Response) => {
  try {
    if (!getCurrentUser(req)) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
    }
    const { text, voiceName } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    const client = getGeminiClient();
    if (!client) {
      return res.json({ fallbackToWebSpeech: true, reason: 'No Gemini API key configured' });
    }

    const allowedVoices = ['Zephyr', 'Puck', 'Kore', 'Fenrir', 'Charon'];
    const selectedVoice = allowedVoices.includes(voiceName) ? voiceName : 'Zephyr';
    
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
app.get(['/api/chats/threads', '/chats/threads'], (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
  }
  res.json(getThreadsForUser(user.id));
});

app.get(['/api/chats/messages', '/chats/messages'], (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
  }
  const threadId = getQueryValue(req, 'threadId');
  if (!threadId) {
    return res.status(400).json({ error: 'threadId is required' });
  }
  ensureThreadForUser(threadId, user.id);
  if (!isThreadParticipant(threadId, user.id)) {
    return res.status(403).json({ error: 'You are not a participant in this conversation.' });
  }
  res.json(getMessagesForThread(threadId, user.id));
});

app.post(['/api/chats/send', '/chats/send'], (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
  }
  const { threadId, content, type, metadata } = req.body || {};
  if (typeof threadId !== 'string' || !content) {
    return res.status(400).json({ error: 'threadId and content are required' });
  }
  const result = createMessage({
    threadId,
    sender: { userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, platform: user.platform },
    content,
    type,
    metadata,
  });
  if (!result.ok) {
    const status = result.error === 'NOT_A_PARTICIPANT' ? 403 : result.error === 'THREAD_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: result.error });
  }
  res.status(201).json({ success: true, message: result.message });
});

app.post(['/api/chats/mark-read', '/chats/mark-read'], (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
  }
  const { threadId } = req.body || {};
  if (typeof threadId !== 'string') {
    return res.status(400).json({ error: 'threadId is required' });
  }
  if (!isThreadParticipant(threadId, user.id)) {
    return res.status(403).json({ error: 'You are not a participant in this conversation.' });
  }
  markThreadMessagesAsRead(threadId, user.id);
  res.json({ success: true });
});

app.post(['/api/chats/start-direct', '/chats/start-direct'], (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Please sign in.' });
  }
  const { targetUserId } = req.body || {};
  const targetUser = users.find(u => u && u.id === targetUserId);
  if (!targetUser || targetUser.id === user.id) {
    return res.status(404).json({ error: 'Member not found' });
  }
  const thread = getOrCreateDirectThread(
    { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, platform: user.platform },
    { id: targetUser.id, displayName: targetUser.displayName, avatarUrl: targetUser.avatarUrl, platform: targetUser.platform }
  );
  res.json({ success: true, thread });
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
    ...(IS_PRODUCTION ? {} : { message: err?.message || String(err) }),
  });
});

// --- PERSISTENCE ---
// Every piece of mutable server state that must survive restarts.
function registerPersistentState(): void {
  registerCollection({ collection: 'users', get: () => users, set: docs => { users = docs; } });
  registerCollection({ collection: 'pods', get: () => pods, set: docs => {
    // Legacy documents were written as {pod: {...}} by older clients; demo pods are never loaded.
    pods = docs
      .map(d => (d && d.pod && typeof d.pod === 'object' ? { ...d.pod, id: d.pod.id || d.id } : d))
      .filter(p => p && p.id && !isDemoPodServer(p))
      .map(p => ({ ...p, members: Array.isArray(p.members) ? p.members : [], invitedContacts: Array.isArray(p.invitedContacts) ? p.invitedContacts : [], status: p.status || 'FORMING' }));
  } });
  registerCollection({ collection: 'notifications', get: () => notifications, set: docs => {
    notifications = docs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } });
  registerCollection({ collection: 'swap_requests', get: () => swapRequests, set: docs => { swapRequests = docs; } });
  registerCollection({ collection: 'perks', get: () => perks, set: docs => { perks = docs; } });
  registerCollection({ collection: 'auditLogs', get: () => auditLogs, set: docs => {
    auditLogs = docs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } });
  registerCollection({ collection: 'hardshipRequests', get: () => hardshipRequests, set: docs => { hardshipRequests = docs; } });
  registerCollection({ collection: 'reprioritizationRequests', get: () => reprioritizationRequests, set: docs => { reprioritizationRequests = docs; } });
  registerCollection({ collection: 'deposits', get: () => deposits, set: docs => {
    deposits = docs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } });
  registerCollection({ collection: 'redemptions', get: () => redemptions, set: docs => { redemptions = docs; } });
  registerCollection({ collection: 'processedPayments', get: () => processedPayments, set: docs => { processedPayments = docs; } });
  registerCollection({ collection: 'withdrawals', get: () => withdrawals, set: docs => { withdrawals = docs; } });
  registerCollection({ collection: 'welcomeMatchGrants', get: () => welcomeMatchGrants, set: docs => { welcomeMatchGrants = docs; } });
  registerCollection({ collection: 'advertiserInquiries', get: () => advertiserInquiries, set: docs => { advertiserInquiries = docs; } });
  registerCollection({ collection: 'gearDesigns', get: () => gearDesigns, set: docs => { gearDesigns = docs; } });
  registerCollection({ collection: 'chatThreads', get: getChatThreads, set: setChatThreads });
  registerCollection({ collection: 'chatMessages', get: getChatMessages, set: docs => {
    setChatMessages(docs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  } });
}

// Resolve a WebSocket AUTH token to a member (same rules as the HTTP auth middleware).
async function verifySocketToken(token: string) {
  let uid: string | null = null;
  if (DEMO_MODE && (token.startsWith('demo_token_') || token.startsWith('usr_'))) {
    uid = token.replace('demo_token_', '');
  } else {
    const authAdmin = getAuthAdmin();
    if (!authAdmin) return null;
    try {
      uid = (await authAdmin.verifyIdToken(token)).uid;
    } catch {
      return null;
    }
  }
  const user = users.find(u => u && u.id === uid);
  if (!user) return null;
  return { userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, platform: user.platform };
}

// --- VITE MIDDLEWARE OR STATIC SERVING ---
async function startServer() {
  assertProductionConfig(storageConfigProblems());

  registerPersistentState();
  // Production always persists. In development, opt in with PERSIST_STATE=true
  // (PERSIST_TO_FIRESTORE is the older name); otherwise dev uses the JSON files.
  const persistInDev = process.env.PERSIST_STATE === 'true' || process.env.PERSIST_TO_FIRESTORE === 'true';
  if (IS_PRODUCTION || persistInDev) {
    await hydrateFromStorage(createStorageAdapter());
    startAutoFlush();
  }

  configureChatManager({
    verifyToken: verifySocketToken,
    getPods: () => pods,
    allowedOrigins: getAllowedOrigins(),
    onChange: requestFlush,
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Endpoint or asset not found' });
      }
    });
  }

  const httpServer = http.createServer(app);
  setupWebSocketServer(httpServer);

  // On SIGTERM stop accepting requests before the final Firestore flush, so no
  // change can land after the flush and be lost.
  onBeforeShutdown(() => new Promise<void>(resolve => {
    const timer = setTimeout(resolve, 8000);
    httpServer.close(() => { clearTimeout(timer); resolve(); });
    httpServer.closeIdleConnections?.();
  }));

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Gig Mutual Pool Server] running on port ${PORT} (${IS_PRODUCTION ? 'production' : 'development'}${DEMO_MODE ? ', DEMO_MODE' : ''})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
