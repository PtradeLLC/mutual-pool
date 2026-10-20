export type KYCStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';

export type UserRole = 'RIDER' | 'DRIVER' | 'POD_ADMIN' | 'SUPER_ADMIN' | 'Admin' | 'ADMIN' | 'ADVERTISER' | 'Advertiser';

export const isAdminUser = (user?: User | null): boolean => {
  if (!user || !user.id || user.id === 'usr_guest') return false;
  if (user.isAdmin) return true;
  const role = String(user.role || '').trim().toUpperCase();
  return (
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'PLATFORM_ADMIN' ||
    role === 'SITE_ADMIN'
  );
};

export const isAdvertiserUser = (user?: User | null): boolean => {
  if (!user || !user.id || user.id === 'usr_guest') return false;
  if (isAdminUser(user)) return false;
  const role = String(user.role || '').trim().toUpperCase();
  return role === 'ADVERTISER' || role === 'BRAND_ADVERTISER' || role.includes('ADVERTISER');
};

export const isCourierUser = (user?: User | null): boolean => {
  if (!user || !user.id || user.id === 'usr_guest') return false;
  return !isAdminUser(user) && !isAdvertiserUser(user);
};

export const isAdvertiserOrAdmin = (user?: User | null): boolean => {
  if (!user || !user.id || user.id === 'usr_guest') return false;
  return isAdminUser(user) || isAdvertiserUser(user);
};

export type GigPlatform = 'Uber Eats' | 'Lyft' | 'DoorDash' | 'Instacart' | 'Amazon Flex' | 'Grubhub' | 'Spark' | 'Partner Provider';

export interface ExternalBankAccount {
  bankName: string;
  last4: string;
  routingNumber: string;
  accountType: 'CHECKING' | 'SAVINGS';
  status: 'LINKED' | 'NOT_LINKED' | 'PENDING_VERIFICATION';
  linkedAt?: string;
}

// Authorization (Stripe us_bank_account mandate) to debit the member's bank for
// amounts they owe: a missed weekly deposit, anything the platform advanced for
// them, and the deposits still owed after a payout-then-default. Collected
// before a member creates or joins a pod; debits are initiated by an admin.
export type DebitMandateStatus = 'ACTIVE' | 'PENDING' | 'REVOKED' | 'FAILED';

export interface DebitMandate {
  status: DebitMandateStatus;
  stripeCustomerId?: string;
  paymentMethodId?: string;
  mandateId?: string;
  setupIntentId?: string;
  bankName?: string;
  last4?: string;
  fingerprint?: string;
  acceptedAt?: string;
  revokedAt?: string;
  termsVersion?: string;
}

export interface DigitalCard {
  id?: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  cardholderName?: string;
  isDefault?: boolean;
  addedAt?: string;
}

export interface StripeTreasuryAccount {
  stripeAccountId: string; // Connect Custom Account ID
  stripeFinAccountId: string; // Treasury Financial Account ID
  balanceUsd: number;
  pendingInboundUsd: number;
  totalPayoutsReceivedUsd: number;
  fdicPassThroughEligible: boolean;
  status: 'ACTIVE' | 'RESTRICTED' | 'PENDING_REQUIREMENTS' | 'UNINITIALIZED';
  digitalCards?: DigitalCard[];
}

export interface User {
  id: string;
  email: string;
  emailVerified?: boolean;
  // Stripe bank-account fingerprints from Connect onboarding: identify the same
  // person across accounts (one welcome match per person, host-reward checks).
  identityFingerprints?: string[];
  // What the member's community calls a savings circle (id in src/data/roscaTraditions.ts).
  traditionId?: string;
  // Language signals used to decide which translations to add next.
  preferredLanguage?: string;   // language chosen in the app
  // Terms of Service acceptance (version from src/lib/legal.ts), recorded by the server.
  termsAcceptedVersion?: string;
  termsAcceptedAt?: string;
  browserLanguage?: string;     // device language (primary Accept-Language tag)
  displayName: string;
  name?: string;
  city?: string;
  avatarUrl?: string;
  platform: GigPlatform;
  role: UserRole;
  isAdmin?: boolean;
  deliveryPlatforms?: string[];
  currentPodId?: string;
  accountAgeDays: number;
  kycStatus: KYCStatus;
  kycVerifiedAt?: string;
  treasury: StripeTreasuryAccount;
  externalBank: ExternalBankAccount;
  digitalCards?: DigitalCard[];
  // Stripe Customer on the platform account (holds the debit payment method).
  stripeCustomerId?: string;
  // DEMO_MODE only: set to false to stop the Thursday sweep topping this account
  // up, so tests can make a member miss a deposit.
  demoAutoFund?: boolean;
  // Set when a card top-up was refunded or charged back: withdrawals and new
  // pods are blocked until an admin clears it.
  riskHold?: { reason: string; at: string; amountUsd?: number; stripeRef?: string };
  debitMandate?: DebitMandate;
  accountRestriction?: AccountRestriction;
  // Bank account in the member's name at Column (see src/server/custody.ts).
  custody?: MemberCustody;
  completedPodsCount: number;
  welcomeMatchReceived?: boolean;
  welcomeMatchAmountUsd?: number;
  isHardshipInactive?: boolean;
  hardshipOwedUsd?: number;
  lastHardshipRequestedAt?: string;
  activeHardshipRequestId?: string;
  createdAt?: string;
}

export function calculateAccountAgeDays(createdAt?: string, fallbackDays: number = 1): number {
  const fallback = typeof fallbackDays === 'number' && !isNaN(fallbackDays) && fallbackDays > 0 ? fallbackDays : 1;
  if (!createdAt) return fallback;
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime) || createdTime <= 0) return fallback;
  const diffMs = Date.now() - createdTime;
  // Calculate total elapsed full days
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(fallback, days, 1);
}

export type PodSizeTier = 20 | 50 | 100 | 500 | 1000 | 5000 | 10000;
export type DepositTier = 5 | 10 | 20 | 50 | 100;
export type PodStatus = 'FORMING' | 'LOCKED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
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
  payoutNetAmountUsd?: number;
  agreementSignedAt?: string;
  agreementSignatureName?: string;
  delinquencyStatus: DelinquencyStatus;
  isHardshipInactive?: boolean;
  hardshipStatus?: 'NONE' | 'PENDING_APPROVAL' | 'INACTIVE_HOLD' | 'REPAID';
  joinedAt: string;
  invitedByUserId?: string;
  invitedByName?: string;
  // Trust tier when the rotation was locked; early slots (the first half) go
  // to the most trusted members. See src/server/rotation.ts.
  trustAtLock?: 'COMPLETED_POD' | 'TENURED' | 'NEW_WITH_MANDATE' | 'NEW';
}

export type ActivationPolicy = 'WHEN_FULL' | 'FLEXIBLE_EARLY';

export type CampaignAgreementStatus = 'PENDING_SIGNATURE' | 'OPTED_IN' | 'OPTED_OUT';

export interface PodCampaignAgreement {
  optedIn: boolean;
  status: CampaignAgreementStatus;
  signerUserId: string;
  signerFirstName: string;
  signerLastName: string;
  signerFullName: string;
  signedAt: string;
  acknowledgedTerms: boolean;
  contractVersion: string;
  termsTitle: string;
}

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
  activatedAt?: string;
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
  campaignAgreement?: PodCampaignAgreement;
  stewardshipMode?: 'CREATOR_MANAGED' | 'AUTONOMOUS_AI';
  managedBy?: 'CREATOR' | 'SYSTEM_AI';
  stewardName?: string;
  systemEscrowActive?: boolean;
  systemEscrowDrawnUsd?: number;
  creatorDefaultedAt?: string;
  creatorLastInRotation?: boolean;
  creatorHostRewardRate?: number; // 0.03 (3% of gross pool)
  creatorStewardshipEarningsUsd?: number;
  hostRewardRecipientUserId?: string; // Current recipient of the 3% weekly payout stewardship reward (defaults to creator; transfers if creator switches spot)
  hostRewardRecipientName?: string; // Name of the active 3% weekly reward beneficiary
  // Number of early rotation slots (from slot 1) filled by trust, fixed at lock.
  earlySlotCount?: number;
  // Pot at lock (members × deposit); pots over $1,000 need seasoned early slots.
  potAtLockUsd?: number;
  // Default controls: open/last pause vote, and whether the remaining members
  // agreed to cover missing deposits (split each Thursday) instead of pausing.
  pauseVote?: PodPauseVote;
  pausedAt?: string;
  pauseReason?: string;
  coverShareActive?: boolean;
  // After a member is removed for a default, the remaining members vote on
  // listing the pod publicly to fill the slot (or keeping it private).
  replacementVote?: PodReplacementVote;
  // Once every member has been paid, the creator chooses to start a new round
  // (a new pod linked here) or close the pod.
  completedAt?: string;
  renewalDecision?: 'PENDING' | 'RENEWED' | 'CLOSED';
  renewedFromPodId?: string;
  renewedToPodId?: string;
  // The pod's own holding account at Column (created on first movement).
  custody?: PodCustody;
}

// A missed weekly deposit, and what the member still owes because of it.
// Reported to admins, who may recover it by ACH debit under the member's mandate.
export type DepositDefaultStatus = 'OPEN' | 'COLLECTING' | 'RECOVERED' | 'WRITTEN_OFF';
export type DepositDefaultTrigger = 'THURSDAY_SWEEP' | 'ADMIN_COVER_GAP' | 'ADMIN_REMOVE' | 'AUTO_REMOVE';
export type DefaultRecoverySource = 'MEMBER_BALANCE' | 'MEMBER_DEPOSIT' | 'ACH_DEBIT' | 'WRITE_OFF';

export interface DepositDefault {
  id: string;
  podId: string;
  podName: string;
  userId: string;
  userName: string;
  cycleWeek: number;
  depositTierUsd: number;
  trigger: DepositDefaultTrigger;
  // Who fronted the missed deposit (owed back to the platform).
  bufferCoveredUsd: number;   // pod contingency buffer (welcome match)
  escrowCoveredUsd: number;   // platform system escrow
  // Nobody fronted it: that week's pot was short.
  potShortfallUsd: number;
  // Deposits still owed under the Pod Agreement when a member who already
  // received the pot is removed (the payout-then-default case).
  remainingObligationUsd: number;
  owedUsd: number;
  recoveredUsd: number;
  // Recovered money that has not been fronted by anyone yet: bridges the pod's
  // pot one deposit per week (see the Thursday sweep).
  reserveUsd: number;
  recoveries: Array<{ at: string; amountUsd: number; source: DefaultRecoverySource; ref?: string }>;
  status: DepositDefaultStatus;
  memberRemoved: boolean;
  payoutReceivedUsd: number;
  writeOffReason?: string;
  // Last pod cycle week in which the reserve bridged a deposit (one bridge per week).
  lastBridgedCycleWeek?: number;
  // Default controls (src/server/defaultControls.ts): the member and the rest of
  // the pod are told at once; if nothing is paid by removalDueAt the member is
  // removed from the pod, their account is restricted and collection starts.
  memberNotifiedAt?: string;
  podNotifiedAt?: string;
  removalDueAt?: string;
  autoRemovedAt?: string;
  collectionStartedAt?: string;
  secondDefaultNoticeAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Custody: where member money actually sits (src/server/custody.ts).
//   ledger  - the in-memory ledger is the only record (demo / pre-launch)
//   column  - every member, pod and platform balance is a real bank account at
//             Column; ledger moves are settled as Column book transfers.
// ---------------------------------------------------------------------------
export type CustodyProviderName = 'ledger' | 'column';
export type MemberCustodyStatus = 'PENDING' | 'VERIFIED' | 'MANUAL_REVIEW' | 'DENIED' | 'FROZEN';
export interface MemberCustody {
  provider: 'column';
  entityId: string;
  bankAccountId: string;
  accountNumberId: string;
  accountNumberLast4: string;
  routingNumber: string;
  status: MemberCustodyStatus;
  // External bank linked for ACH funding and withdrawals.
  counterpartyId?: string;
  counterpartyLast4?: string;
  counterpartyName?: string;
  // The linked bank accepts RTP/FedNow: withdrawals land in seconds instead of by ACH.
  realtimeEligible?: boolean;
  counterpartyBankName?: string;
  createdAt: string;
  updatedAt: string;
}
export interface PodCustody {
  provider: 'column';
  bankAccountId: string;
  accountNumberId: string;
  createdAt: string;
}
// Platform-owned Column accounts. One document, id 'platform'.
export interface CustodySettings {
  id: 'platform';
  entityId: string;
  operatingAccountId: string;      // float: card top-ups fronted, recoveries, reserves
  operatingAccountNumberId?: string;
  escrowAccountId: string;         // System Deposits Escrow: bridges missed deposits
  revenueAccountId: string;        // fees
  webhookEndpointId?: string;
  processedEventIds?: string[];    // recent Column event ids (idempotent webhooks)
  updatedAt: string;
}
export type CustodyAccountRef =
  | { kind: 'member'; userId: string }
  | { kind: 'pod'; podId: string }
  | { kind: 'platform'; account: 'operating' | 'escrow' | 'revenue' }
  | { kind: 'external'; label: string };   // outside Column: a member's own bank, Stripe
export type CustodyPurpose =
  | 'DEPOSIT' | 'DEPOSIT_FEE' | 'PAYOUT' | 'PAYOUT_FEE' | 'HOST_REWARD' | 'WELCOME_MATCH'
  | 'ESCROW_BRIDGE' | 'ESCROW_REPAYMENT' | 'BUFFER_RESTORE' | 'RESERVE_BRIDGE'
  | 'HARDSHIP_ADVANCE' | 'HARDSHIP_REPAYMENT' | 'COVER_SHARE' | 'COLLECTION'
  | 'TOPUP' | 'WITHDRAWAL' | 'ADJUSTMENT';
export type CustodyMovementStatus = 'PENDING' | 'SETTLED' | 'FAILED' | 'RETURNED';
// One money movement. In ledger mode it is a record; in column mode it is
// executed as a book transfer (or tracked as an ACH transfer) at Column.
export interface CustodyMovement {
  id: string;
  from: CustodyAccountRef;
  to: CustodyAccountRef;
  amountUsd: number;
  purpose: CustodyPurpose;
  description: string;
  refs: { podId?: string; userId?: string; cycleWeek?: number; depositId?: string; withdrawalId?: string; stripeRef?: string; defaultId?: string; requestId?: string };
  provider: CustodyProviderName;
  status: CustodyMovementStatus;
  columnTransferId?: string;
  columnTransferKind?: 'book' | 'ach' | 'realtime';
  attempts: number;
  lastError?: string;
  createdAt: string;
  settledAt?: string;
  updatedAt: string;
}

// An account limited because of an unsettled deposit default: no creating or
// joining pods, no swaps, votes or hardship requests until every default is
// paid in full, at which point the account is restored automatically.
export interface AccountRestriction {
  status: 'RESTRICTED';
  reason: 'DEPOSIT_DEFAULT';
  since: string;
  defaultIds: string[];
  owedUsd: number;
}

// Opened when two or more members of one pod have unsettled defaults. The
// members not in default decide: pause the pod, or keep going and split the
// missing deposits among themselves each week until the defaults are settled.
export type PodPauseVoteChoice = 'PAUSE' | 'COVER';
export type PodReplacementVoteChoice = 'OPEN' | 'KEEP';
export interface PodReplacementVote {
  id: string;
  openedAt: string;
  closesAt: string;
  removedUserId: string;
  removedUserName: string;
  eligibleVoterIds: string[];
  votes: Record<string, PodReplacementVoteChoice>;
  status: 'OPEN' | 'RESOLVED';
  outcome?: PodReplacementVoteChoice;
  resolvedAt?: string;
}
export interface PodPauseVote {
  id: string;
  openedAt: string;
  closesAt: string;
  defaultIds: string[];
  defaulterUserIds: string[];
  eligibleVoterIds: string[];
  votes: Record<string, PodPauseVoteChoice>;
  status: 'OPEN' | 'RESOLVED';
  outcome?: PodPauseVoteChoice;
  resolvedAt?: string;
}

// NEEDS_REVIEW: Stripe gave an ambiguous answer (timeout/outage); an admin must
// confirm in the Stripe dashboard whether the debit exists before retrying.
export type AchCollectionStatus = 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'RETURNED' | 'NEEDS_REVIEW';

// One ACH debit against a member's mandate, initiated by an admin for a default.
export interface AchCollection {
  id: string;
  defaultId: string;
  userId: string;
  podId: string;
  amountUsd: number;
  status: AchCollectionStatus;
  stripePaymentIntentId?: string;
  stripeMandateId?: string;
  bankLast4?: string;
  failureReason?: string;
  initiatedByUserId: string;
  initiatedByName: string;
  createdAt: string;
  updatedAt: string;
  settledAt?: string;
}

export type PodDetailTab = 'rotation' | 'circle' | 'deposits' | 'reprioritize' | 'audit' | 'hardship' | 'activity';

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
  approvedByUserId?: string;
  approvedCycleWeek?: number;
  rejectedAt?: string;
  rejectedByUserId?: string;
  rejectionReason?: string;
  paidOffAt?: string;
  reason?: string;
  // Advisory fraud-risk assessment shown to the reviewing admin (src/server/hardshipRisk.ts).
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReasons?: string[];
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
  scheduledSweepType?: 'THURSDAY_AUTOMATED' | 'MANUAL_DEPOSIT';
}

export interface PaymentHistoryItem {
  id: string;
  type: 'DEPOSIT' | 'PAYOUT';
  podId: string;
  podName: string;
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  date: string;
  formattedDate?: string;
  cycleWeek?: number;
  stripePaymentId?: string;
  stripeTransferId?: string;
  description: string;
  paymentMethod?: string;
}

export type SettlementPhase = 'COLLECTION_PENDING' | 'SETTLEMENT_BUFFER' | 'PAYOUT_DISBURSING';

export interface PlatformScheduleStatus {
  weeklyDepositDay: 'THURSDAY';
  weeklyDepositTime: '12:00 AM';
  weeklyPayoutDay: 'FRIDAY';
  weeklyPayoutTime: '12:00 AM';
  timezone: string;
  nextDepositDate: string;
  nextPayoutDate: string;
  msUntilNextDeposit: number;
  msUntilNextPayout: number;
  currentPhase: SettlementPhase;
  phaseLabel: string;
  phaseDescription: string;
  lastThursdaySweepAt?: string;
  lastFridaySweepAt?: string;
  activePodsCount: number;
  totalWeeklyTargetVolumeUsd: number;
}

export interface SweepExecutionResult {
  sweepType: 'THURSDAY_DEPOSITS' | 'FRIDAY_PAYOUTS';
  executedAt: string;
  success: boolean;
  activePodsEvaluated: number;
  totalTransactionsCount: number;
  totalVolumeUsd: number;
  failedCount: number;
  details: string[];
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
  | 'PAYOUT_RECEIVED'
  | 'DEPOSIT_REMINDER' 
  | 'DEPOSIT_DUE'
  | 'DEPOSIT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'POD_MEMBER_DEFAULT'
  | 'ACCOUNT_RESTRICTED'
  | 'ACCOUNT_RESTORED'
  | 'POD_PAUSE_VOTE'
  | 'POD_PAUSED'
  | 'POD_RESUMED'
  | 'POD_REPLACEMENT_VOTE'
  | 'POD_COMPLETED'
  | 'STATUS_CHANGE'
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
    | 'MEMBER_REMOVED'
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
    | 'HARDSHIP_REJECTED'
    | 'CAMPAIGN_AGREEMENT_RECORDED'
    | 'COURIER_GEAR_VERIFIED_PAYOUT'
    | 'AUTONOMOUS_STEWARDSHIP_ACTIVATED'
    | 'SYSTEM_ESCROW_DEPOSIT_DISBURSED'
    | 'CREATOR_HOST_REWARD_DISBURSED'
    | 'THURSDAY_AUTOMATED_DEPOSIT_SWEEP'
    | 'FRIDAY_AUTOMATED_PAYOUT_SWEEP'
    | 'CONTINGENCY_BUFFER_BRIDGED_DEPOSIT'
    | 'DEPOSIT_DEFAULT_RECORDED'
    | 'DEFAULT_RECOVERY_APPLIED'
    | 'DEFAULT_RESERVE_BRIDGED_DEPOSIT'
    | 'DEFAULT_WRITTEN_OFF'
    | 'DEBIT_MANDATE_ACCEPTED'
    | 'DEBIT_MANDATE_REVOKED'
    | 'ACH_COLLECTION_INITIATED'
    | 'ACH_COLLECTION_SETTLED'
    | 'ACH_COLLECTION_FAILED'
    | 'MEMBER_AUTO_REMOVED'
    | 'ACCOUNT_RESTRICTED'
    | 'ACCOUNT_RESTORED'
    | 'POD_PAUSE_VOTE_OPENED'
    | 'POD_PAUSE_VOTED'
    | 'POD_PAUSED'
    | 'POD_RESUMED'
    | 'COVER_SHARE_CHARGED'
    | 'POD_REPLACEMENT_VOTE_OPENED'
    | 'POD_REPLACEMENT_VOTED'
    | 'POD_OPENED_TO_PUBLIC'
    | 'POD_COMPLETED'
    | 'POD_RENEWAL_CLOSED'
    | 'POD_RENEWED'
    | 'CUSTODY_ACCOUNT_OPENED'
    | 'CUSTODY_MOVEMENT_FAILED'
    | 'CUSTODY_ACH_SETTLED'
    | 'CUSTODY_ACH_RETURNED';
  detail: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type PerkCategory =
  | 'Quick Meals & Food Trucks'
  | 'Coffee & Rest Stops'
  | 'Tires & Roadside Repair'
  | 'Car Wash & Detailing'
  | 'Fuel Delivery & EV Charging'
  | 'Phone & Data Deals'
  | 'Massage & Body Care'
  | 'Fitness & Recovery'
  | 'Laundry & Dry Cleaning'
  | 'Parking & Tolls'
  | 'Bike & Scooter Service'
  | 'Gear & Safety Equipment'
  | 'Grooming & Haircuts'
  | 'Childcare & Pet Care';

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
  logoUrl?: string;
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
      if (m.displayName && existing.displayName && m.displayName.trim().toLowerCase() === existing.displayName.trim().toLowerCase()) return true;
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

export const DEMO_POD_IDS = new Set<string>([
  'pod_metro_riders_20',
  'pod_national_starter_50',
  'pod_veteran_fleet_100',
]);

export function isDemoPod(p: any): boolean {
  if (!p) return true;
  const pod = (p.pod && p.pod.id) ? p.pod : p;
  if (!pod || !pod.id) return true;
  if (DEMO_POD_IDS.has(pod.id)) return true;
  if (pod.name && typeof pod.name === 'string' && (
    pod.name.includes('National Gig Starter Pod') ||
    pod.name.includes('Veteran Fleet Mutual Pool') ||
    pod.name.includes('Metro Delivery Riders Pod')
  )) {
    return true;
  }
  return false;
}

export interface AdvertiserInquiry {
  id: string;
  brandName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  websiteUrl?: string;
  targetMarkets: string[];
  campaignObjective: string;
  estimatedBudget: string;
  fleetSizeTarget: number;
  campaignDurationWeeks: number;
  apparelTypes: string[];
  customNotes?: string;
  submittedAt: string;
  status: 'NEW' | 'CONTACTED' | 'PROPOSAL_SENT' | 'ACTIVE';
}

export interface AdCampaign {
  id: string;
  title: string;
  brandName: string;
  brandLogo?: string;
  brandColor?: string;
  description: string;
  bannerUrl?: string;
  targetMetro: string;
  deliveryPlatforms: string[];
  dailyPayout: number;
  weeklyEstimatedEarnings: number;
  maxCouriersTarget: number;
  activeCouriersCount: number;
  durationWeeks: number;
  startDate?: string;
  endDate?: string;
  impressionsTarget?: number;
  currentImpressions?: number;
  payoutTerms?: string;
  gearRequired: string[];
  requirements: string[];
  // 'pending': submitted by an advertiser, not yet approved by MutualPool.
  // Couriers only see 'recruiting' and 'active' campaigns.
  status: 'pending' | 'recruiting' | 'active' | 'completed' | 'paused' | 'rejected';
  createdAt?: string;
  createdByUserId?: string;
  approvedAt?: string;
  approvedByUserId?: string;
  rejectionReason?: string;
}

export interface CourierCampaignParticipation {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  dailyRate: number;
  totalEarningsAccumulated: number;
  status: 'applied' | 'approved' | 'active' | 'completed' | 'paused';
  apparelDeliveryStatus: 'processing' | 'shipped' | 'delivered';
  apparelShipmentTracking?: string;
  gearDeliveryAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  gearSizes?: {
    jacketSize: string;
    shirtSize: string;
  };
  enrolledAt: string;
}

export interface PhotoSpotCheck {
  id: string;
  timestamp: string; // e.g. "1:42 PM"
  promptedAt: number; // epoch ms
  respondedAt?: number; // epoch ms
  status: 'PENDING' | 'VERIFIED' | 'MISSED' | 'REJECTED';
  photoUrl?: string;
  locationLabel?: string;
  responseWindowSeconds: number; // e.g. 300 (5 mins)
  secondsToRespond?: number;
}

export interface ActiveShiftSession {
  id: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  brandColor?: string;
  dailyRate: number;
  targetMetro: string;
  platform: 'DoorDash' | 'UberEats' | 'Grubhub' | 'Instacart' | 'Relay' | 'Postmates';
  courierId: string;
  courierName: string;
  startedAt: number; // epoch ms
  startFormatted: string; // e.g. "12:15 PM"
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  currentMiles: number;
  estimatedImpressions: number;
  spotChecks: PhotoSpotCheck[];
  activePrompt?: PhotoSpotCheck | null;
  // Future checks are scheduled by the server; only their number is shared.
  checksRemaining?: number;
  neighborhood: string;
  lastGpsPing?: {
    neighborhood: string;
    speedMph: number;
    accuracyMeters: number;
    heading: string;
  };
}

export type GearVerificationStatus = 'PENDING_VERIFICATION' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';

export interface VisionVerificationResult {
  matched: boolean;
  confidenceScore: number;
  detectedBrand: string;
  expectedBrand: string;
  matchedCampaignTitle?: string;
  gearItemsDetected?: string[];
  visualFindings: string;
  decisionReason: string;
  status: 'VERIFIED' | 'REJECTED';
  modelUsed?: string;
  comparedAt?: string;
}

export interface CourierGearItemCheck {
  itemName: string;
  isEquipped: boolean;
  photoUrl?: string;
}

export interface CourierGearVerification {
  id: string;
  shiftId: string;
  courierId: string;
  campaignId: string;
  verifiedAt?: string;
  status: GearVerificationStatus;
  gearItems: CourierGearItemCheck[];
  overallPhotoUrl?: string;
  checklistCompleted: boolean;
  complianceScore: number; // 0-100
  verifiedBy?: string;
  visionResult?: VisionVerificationResult;
}

export interface CampaignShiftLog {
  id: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  courierId: string;
  courierName: string;
  courierAvatar?: string;
  platform: 'DoorDash' | 'UberEats' | 'Grubhub' | 'Instacart' | 'Relay' | 'Postmates';
  metro: string;
  neighborhood: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  milesTraveled: number;
  estimatedImpressions: number;
  courierPayoutEarned: number;
  verifiedGps: boolean;
  verifiedPhoto: boolean;
  gearVerificationStatus?: GearVerificationStatus;
  gearVerification?: CourierGearVerification;
  payoutStatus?: 'PENDING_GEAR_VERIFICATION' | 'PROCESSING' | 'PAID' | 'WITHHELD';
  payoutTransferId?: string;
  spotChecks?: PhotoSpotCheck[];
  spotChecksCount?: number;
  spotChecksVerified?: number;
  complianceScore: number; // 0-100
  notes?: string;
}

export interface CampaignDailyMetric {
  date: string;
  dayLabel: string;
  impressions: number;
  activeCouriers: number;
  shiftsCompleted: number;
  spend: number;
}

export interface CampaignZoneMetric {
  zoneName: string;
  metro: string;
  activeCouriers: number;
  impressions: number;
  footTrafficScore: string;
  popularPlatform: string;
}

export type ChatMessageType = 'TEXT' | 'SWAP_OFFER' | 'POD_ANNOUNCEMENT' | 'SYSTEM';

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderPlatform?: GigPlatform | string;
  recipientId?: string;
  podId?: string;
  content: string;
  type?: ChatMessageType;
  createdAt: string;
  readBy: string[];
  metadata?: Record<string, unknown>;
}

export interface ChatParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  platform?: GigPlatform | string;
  isOnline?: boolean;
}

export interface ChatThread {
  id: string;
  type: 'DIRECT' | 'POD';
  name: string;
  avatar?: string;
  participantIds: string[];
  participantProfiles?: ChatParticipant[];
  podId?: string;
  podName?: string;
  lastMessage?: {
    content: string;
    senderName: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount?: number;
  updatedAt: string;
  isOnline?: boolean;
}

// ==========================================
// FOURTHWALL SPONSORED APPAREL GEAR TYPES
// ==========================================

export type GearProductType = 
  | 'WINDBREAKER' 
  | 'HOODIE' 
  | 'DELIVERY_BAG' 
  | 'FLEET_POLO' 
  | 'COURIER_CAP';

export type GearPrintZone = 
  | 'FRONT_CHEST' 
  | 'BACK_FULL' 
  | 'LEFT_SLEEVE' 
  | 'RIGHT_SLEEVE' 
  | 'FRONT_FLAP' 
  | 'CROWN';

export type GearColor = 
  | 'BLACK' 
  | 'NAVY' 
  | 'NEON_LIME' 
  | 'STEALTH_CHARCOAL' 
  | 'SAFETY_ORANGE' 
  | 'WHITE';

export type GearDesignStatus = 
  | 'DRAFT' 
  | 'PENDING_APPROVAL' 
  | 'APPROVED' 
  | 'DISPATCHED_TO_FOURTHWALL' 
  | 'PRINTING' 
  | 'COMPLETED' 
  | 'REJECTED';

export interface GearDesignZoneConfig {
  zone: GearPrintZone;
  label: string;
  sponsorMessage: string;
  subMessage?: string;
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  textColor: string;
  badgeStyle: 'NONE' | 'OUTLINED' | 'HIGH_VIS_BOX' | 'REFLECTIVE_SHIELD';
  logoBadgeUrl?: string;
  active: boolean;
  qrCodeUrl?: string;
  qrCodeEnabled?: boolean;
  qrCodePosition?: 'NEXT_TO_TEXT' | 'ABOVE_TEXT' | 'BELOW_TEXT';
}

export interface GearCatalogItem {
  type: GearProductType;
  name: string;
  category: string;
  description: string;
  baseUnitCostUsd: number;
  availableColors: GearColor[];
  supportedZones: {
    zone: GearPrintZone;
    label: string;
    maxCharacters: number;
    dimensions: string;
  }[];
  materialSpec: string;
  fourthwallProductTemplateId: string;
}

export interface GearDesignOrder {
  id: string;
  ownerUserId?: string;
  campaignId?: string;
  campaignTitle?: string;
  sponsorBrand: string;
  sponsorContactEmail: string;
  sponsorContactName: string;
  gearType: GearProductType;
  gearName: string;
  baseColor: GearColor;
  quantity: number;
  unitCostUsd: number;
  totalEstimatedCostUsd: number;
  zones: Record<string, GearDesignZoneConfig>;
  status: GearDesignStatus;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  adminNotes?: string;
  // Fourthwall Platform API Response details
  fourthwallOrderId?: string;
  fourthwallOrderNumber?: string;
  fourthwallTrackingUrl?: string;
  fourthwallProductionStage?: 'SUBMITTED' | 'ARTWORK_VALIDATED' | 'PRINT_QUEUE' | 'IN_PRODUCTION' | 'FULFILLED';
  fourthwallRawResponse?: any;
  createdAt: string;
  updatedAt: string;
}



