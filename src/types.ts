export type KYCStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';

export type UserRole = 'RIDER' | 'DRIVER' | 'POD_ADMIN' | 'SUPER_ADMIN' | 'Admin';

export type GigPlatform = 'Uber Eats' | 'Lyft' | 'DoorDash' | 'Instacart' | 'Amazon Flex' | 'Grubhub' | 'Spark' | 'Partner Provider';

export interface ExternalBankAccount {
  bankName: string;
  last4: string;
  routingNumber: string;
  accountType: 'CHECKING' | 'SAVINGS';
  status: 'LINKED' | 'NOT_LINKED' | 'PENDING_VERIFICATION';
  linkedAt?: string;
}

export interface StripeTreasuryAccount {
  stripeAccountId: string; // Connect Custom Account ID
  stripeFinAccountId: string; // Treasury Financial Account ID
  balanceUsd: number;
  pendingInboundUsd: number;
  totalPayoutsReceivedUsd: number;
  fdicPassThroughEligible: boolean;
  status: 'ACTIVE' | 'RESTRICTED' | 'PENDING_REQUIREMENTS' | 'UNINITIALIZED';
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  platform: GigPlatform;
  role: UserRole;
  accountAgeDays: number;
  kycStatus: KYCStatus;
  kycVerifiedAt?: string;
  treasury: StripeTreasuryAccount;
  externalBank: ExternalBankAccount;
  completedPodsCount: number;
  welcomeMatchReceived?: boolean;
  welcomeMatchAmountUsd?: number;
  isHardshipInactive?: boolean;
  hardshipOwedUsd?: number;
  lastHardshipRequestedAt?: string;
  activeHardshipRequestId?: string;
}

export type PodSizeTier = 20 | 50 | 100 | 500 | 1000 | 5000 | 10000;
export type DepositTier = 5 | 10 | 20 | 50 | 100;
export type PodStatus = 'FORMING' | 'LOCKED' | 'ACTIVE' | 'COMPLETED';
export type DelinquencyStatus = 'CLEAN' | 'GRACE_PERIOD' | 'DELINQUENT';
export type PodType = 'TRUSTED_CIRCLE' | 'OPEN_POD';

export interface InvitedContact {
  id: string;
  name: string;
  emailOrPhone: string;
  isExistingMember: boolean;
  memberUserId?: string;
  status: 'PENDING_INVITE' | 'INVITED' | 'JOINED';
  invitedAt: string;
  invitedByUserId?: string;
  invitedByName?: string;
}

export type PayoutClaimStatus = 'AUTOMATED_TREASURY_TRANSFER' | 'DISBURSED_TO_BANK' | 'EARMARKED_IN_TREASURY';

export interface PodMembership {
  id: string; // e.g. "pm_101"
  podId: string;
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  platform: GigPlatform;
  rotationIndex: number; // 0..N-1
  hasReceivedPayout: boolean;
  payoutCycleWeek?: number;
  payoutClaimStatus?: PayoutClaimStatus;
  payoutStripeTransferId?: string;
  payoutProcessedAt?: string;
  agreementSignedAt?: string;
  agreementSignatureName?: string;
  delinquencyStatus: DelinquencyStatus;
  isHardshipInactive?: boolean;
  hardshipStatus?: 'NONE' | 'PENDING_APPROVAL' | 'INACTIVE_HOLD' | 'REPAID';
  joinedAt: string;
  invitedByUserId?: string;
  invitedByName?: string;
}

export type ActivationPolicy = 'WHEN_FULL' | 'FLEXIBLE_EARLY';

export interface Pod {
  id: string;
  name: string;
  description: string;
  category: string;
  podType: PodType;
  activationPolicy?: ActivationPolicy;
  inviteWindowDays: number;
  autoOpenOnExpire: boolean;
  inviteCode: string;
  invitedContacts: InvitedContact[];
  sizeTier: PodSizeTier;
  depositTier: DepositTier;
  status: PodStatus;
  cycleStartDate?: string;
  currentCycleWeek: number;
  totalCycles: number;
  agreementVersion: string;
  holdingFinAccountId: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  members: PodMembership[];
  memberCount?: number;
  weeklyPoolTarget: number;
  currentWeeklyCollected: number;
  welcomeMatchGranted?: boolean;
  welcomeMatchAmountUsd?: number;
  contingencyBufferUsd?: number;
  contingencyBufferInitialUsd?: number;
  isPrioritizedForReplacement?: boolean;
  replacementVacanciesCount?: number;
}

export type HardshipRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID_OFF';

export interface HardshipFundRequest {
  id: string;
  podId: string;
  podName: string;
  userId: string;
  userName: string;
  creatorUserId: string;
  depositAmount: number;
  feeAmount: number;
  totalPayoffAmount: number;
  status: HardshipRequestStatus;
  requestedAt: string;
  approvedAt?: string;
  paidOffAt?: string;
  reason?: string;
}

export type CycleStatus = 'COLLECTING' | 'PAID_OUT' | 'DELINQUENT_GAP' | 'FAILED';

export interface WeeklyCycle {
  id: string;
  podId: string;
  weekNumber: number;
  recipientUserId: string;
  recipientDisplayName: string;
  totalPoolAmount: number;
  stripeTransferId?: string;
  status: CycleStatus;
  payoutClaimStatus?: PayoutClaimStatus;
  dueDate: string;
  processedAt?: string;
}

export interface Deposit {
  id: string;
  membershipId: string;
  podId: string;
  cycleId: string;
  userId: string;
  userName: string;
  amount: number;
  stripePaymentId: string;
  status: 'COMPLETE' | 'PENDING' | 'FAILED';
  createdAt: string;
}

export type ReprioritizationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ReprioritizationRequest {
  id: string;
  podId: string;
  membershipId: string;
  requesterUserId: string;
  requesterName: string;
  currentRotationIndex: number;
  desiredRotationIndex: number;
  reason: string;
  status: ReprioritizationStatus;
  votesFor: number;
  votesAgainst: number;
  quorumNeeded: number;
  votedUserIds: string[];
  createdAt: string;
  decidedAt?: string;
}

export type SwapRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXECUTED';

export interface SwapRequest {
  id: string;
  podId: string;
  podName: string;
  requesterUserId: string;
  requesterName: string;
  requesterSlot: number;
  targetUserId: string;
  targetName: string;
  targetSlot: number;
  status: SwapRequestStatus;
  createdAt: string;
  updatedAt: string;
  note?: string;
}

export type NotificationType = 
  | 'SWAP_EXECUTED' 
  | 'SWAP_REQUESTED' 
  | 'SWAP_ACCEPTED' 
  | 'SWAP_DECLINED' 
  | 'HARDSHIP_REQUESTED' 
  | 'HARDSHIP_APPROVED' 
  | 'HARDSHIP_REJECTED' 
  | 'POD_JOINED' 
  | 'PAYOUT_READY' 
  | 'DEPOSIT_REMINDER' 
  | 'GENERAL';

export interface AppNotification {
  id: string;
  userId: string;
  senderUserId?: string;
  senderName?: string;
  podId?: string;
  podName?: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  podId?: string;
  actorId: string;
  actorName: string;
  action: 
    | 'POD_CREATED'
    | 'AGREEMENT_SIGNED'
    | 'ROTATION_LOCKED'
    | 'DEPOSIT_COMPLETED'
    | 'PAYOUT_EXECUTED'
    | 'REPRIORITIZATION_REQUESTED'
    | 'REPRIORITIZATION_VOTED'
    | 'SLOT_SWAP_EXECUTED'
    | 'KYC_VERIFIED'
    | 'BANK_LINKED'
    | 'USER_REGISTERED'
    | 'WEBHOOK_EVENT'
    | 'DELINQUENCY_HANDLED'
    | 'TREASURY_WITHDRAWAL'
    | 'PERK_CREATED'
    | 'PERK_UPDATED'
    | 'PERK_STATUS_CHANGED'
    | 'PERK_DELETED'
    | 'WELCOME_MATCH_GRANTED'
    | 'CONTINGENCY_BUFFER_USED'
    | 'HARDSHIP_REQUESTED'
    | 'HARDSHIP_APPROVED'
    | 'HARDSHIP_REPAID'
    | 'HARDSHIP_REJECTED';
  detail: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type PerkCategory = 
  | 'Healthcare'
  | 'Dental'
  | 'Vision'
  | 'Vehicle Maintenance'
  | 'Gas & Fuel Discounts'
  | 'Phone & Tech Deals'
  | 'Insurance & Roadside'
  | 'Tax & Financial Services'
  | 'Retirement'
  | 'Training'
  | 'Legal Assistance'
  | 'Mental Health'
  | 'Financial Services'
  | 'Discounts'
  | 'Entertainment'
  | 'Restaurants'
  | 'Hotels'
  | 'Retail Savings'
  | 'Insurance Programs'
  | 'Scholarships'
  | 'Family Benefits'
  | 'Emergency Assistance';

export type PerkRedemptionType = 'CODE' | 'LINK' | 'VOUCHER' | 'PARTNER_API';

export type PerkStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'SUSPENDED';

export interface Perk {
  id: string;
  title: string;
  category: PerkCategory;
  provider: string;
  description: string;
  valueBadge: string;
  redemptionType: PerkRedemptionType;
  redemptionData: string;
  eligibility?: string;
  submittedBy?: string;
  submittedByUserId?: string;
  status: PerkStatus;
  iconName: string;
  imageUrl?: string;
  redeemedCount: number;
  partnerEmail?: string;
  partnerNotes?: string;
}

export interface Redemption {
  id: string;
  userId: string;
  perkId: string;
  perkTitle: string;
  redeemedAt: string;
  codeOrLink: string;
}

export function mergeMembers(members1: PodMembership[] = [], members2: PodMembership[] = []): PodMembership[] {
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

export function mergePodObjects(p1: Pod, p2: Pod): Pod {
  const cleanP2: Partial<Pod> = {};
  if (p2 && typeof p2 === 'object') {
    for (const [key, val] of Object.entries(p2)) {
      if (val !== undefined && val !== null) {
        (cleanP2 as any)[key] = val;
      }
    }
  }

  const mergedMembers = mergeMembers(p1.members || [], p2.members || []);
  const calculatedCount = mergedMembers.length;
  const storedCount = Math.max(p1.memberCount || 0, p2.memberCount || 0, cleanP2.memberCount || 0, calculatedCount);
  const highestCollected = Math.max(
    p1.currentWeeklyCollected || 0,
    p2.currentWeeklyCollected || 0,
    cleanP2.currentWeeklyCollected || 0,
    storedCount * (p1.depositTier || cleanP2.depositTier || 20)
  );

  return {
    ...p1,
    ...cleanP2,
    id: cleanP2.id || p1.id,
    name: cleanP2.name || p1.name || 'Savings Circle',
    status: cleanP2.status || p1.status || 'FORMING',
    members: mergedMembers,
    memberCount: Math.max(1, storedCount),
    currentWeeklyCollected: highestCollected,
  };
}

export const DEMO_POD_IDS = new Set([
  'pod_metro_riders_20',
  'pod_national_starter_50',
  'pod_veteran_fleet_100',
  'pod_1786132889241',
]);

export function isDemoPod(p: any): boolean {
  if (!p) return true;
  const pod = (p.pod && p.pod.id) ? p.pod : p;
  if (!pod || !pod.id) return true;
  if (DEMO_POD_IDS.has(pod.id)) return true;
  if (pod.name === 'Mutual Savings Pod') return true;
  if (pod.createdBy === 'JTnLblih' || pod.creatorName === 'JTnLblih') return true;
  if (pod.createdBy && (
    pod.createdBy.startsWith('usr_marcus') ||
    pod.createdBy.startsWith('usr_elena') ||
    pod.createdBy.startsWith('usr_devon') ||
    pod.createdBy.startsWith('usr_aisha') ||
    pod.createdBy.startsWith('usr_admin') ||
    pod.createdBy.startsWith('usr_chris_admin')
  )) return true;
  return false;
}
