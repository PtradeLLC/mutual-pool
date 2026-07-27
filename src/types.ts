export type KYCStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';

export type UserRole = 'RIDER' | 'DRIVER' | 'POD_ADMIN' | 'SUPER_ADMIN';

export type GigPlatform = 'Uber Eats' | 'Lyft' | 'DoorDash' | 'Instacart' | 'Amazon Flex' | 'Grubhub' | 'Spark';

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
}

export interface PodMembership {
  id: string; // e.g. "pm_101"
  podId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  platform: GigPlatform;
  rotationIndex: number; // 0..N-1
  hasReceivedPayout: boolean;
  payoutCycleWeek?: number;
  agreementSignedAt?: string;
  agreementSignatureName?: string;
  delinquencyStatus: DelinquencyStatus;
  joinedAt: string;
}

export interface Pod {
  id: string;
  name: string;
  description: string;
  category: string;
  podType: PodType;
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
  weeklyPoolTarget: number;
  currentWeeklyCollected: number;
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
    | 'DELINQUENCY_HANDLED';
  detail: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type PerkCategory = 
  | 'Healthcare'
  | 'Dental'
  | 'Vision'
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

export type PerkStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

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
  status: PerkStatus;
  iconName: string;
  imageUrl?: string;
  redeemedCount: number;
}

export interface Redemption {
  id: string;
  userId: string;
  perkId: string;
  perkTitle: string;
  redeemedAt: string;
  codeOrLink: string;
}
