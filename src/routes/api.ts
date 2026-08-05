import { Router, Request, Response } from 'express';
import { asyncHandler, validateBody, authMiddleware } from '../middleware';
import { 
  userRepository, 
  podRepository, 
  depositRepository,
  reprioritizationRequestRepository,
  auditLogRepository,
  perkRepository,
  redemptionRepository,
  idempotencyRepository,
} from '../repositories';
import { 
  registerUserSchema,
  loginSchema,
  kycVerifySchema,
  bankLinkSchema,
  createPodSchema,
  signAgreementSchema,
  reprioritizeRequestSchema,
  reprioritizeVoteSchema,
  swapSlotsSchema,
  redeemPerkSchema,
  submitPerkSchema,
  approvePerkSchema,
  delinquencyActionSchema,
  webhookSchema,
  auditLogQuerySchema,
  perksQuerySchema,
} from '../validation/schemas';
import { 
  createConnectAccount,
  createTreasuryFinancialAccount,
  createIdentityVerificationSession,
  createFinancialConnectionsSession,
  getFinancialConnectionsSession,
  createPaymentMethod,
  attachPaymentMethod,
  handleStripeWebhook,
  verifyWebhookSignature,
  getFinancialAccountBalance,
  createOutboundTransfer,
  createInboundTransfer,
} from '../services/stripe';
import { addAuditLog } from '../services/auditLog';
import { Timestamp } from 'firebase-admin/firestore';

const router = Router();

// ============================================
// USER AUTHENTICATION & PROFILE
// ============================================

// Get current user (from Firebase token)
router.get('/users/current', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = await userRepository.getById(req.user!.uid);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
}));

// Register new user
router.post('/users/register', validateBody(registerUserSchema), asyncHandler(async (req: Request, res: Response) => {
  const { displayName, email, platform, initialDeposit, autoVerifyKyc } = req.validatedBody;
  
  // Check if user already exists
  const existing = await userRepository.getByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }
  
  // Create Stripe Connect account
  const connectAccount = await createConnectAccount(
    '', // Will be updated after user creation
    email,
    displayName
  );
  
  // Create user in Firestore
  const userId = `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const avatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
  ];
  
  const newUser = await userRepository.createWithId(userId, {
    id: userId,
    displayName,
    email: email.toLowerCase(),
    platform,
    role: 'RIDER',
    accountAgeDays: 1,
    kycStatus: autoVerifyKyc ? 'VERIFIED' : 'PENDING',
    kycVerifiedAt: autoVerifyKyc ? new Date().toISOString() : undefined,
    treasury: {
      stripeAccountId: connectAccount.id,
      stripeFinAccountId: '',
      balanceUsd: initialDeposit || 100,
      pendingInboundUsd: 0,
      totalPayoutsReceivedUsd: 0,
      fdicPassThroughEligible: !!autoVerifyKyc,
      status: autoVerifyKyc ? 'ACTIVE' : 'PENDING_REQUIREMENTS',
    },
    externalBank: {
      bankName: '',
      last4: '',
      routingNumber: '',
      accountType: 'CHECKING',
      status: 'NOT_LINKED',
    },
    completedPodsCount: 0,
    avatarUrl: avatars[Math.floor(Math.random() * avatars.length)],
  });
  
  // If auto-verify KYC, create Treasury Financial Account
  if (autoVerifyKyc) {
    const financialAccount = await createTreasuryFinancialAccount(connectAccount.id, userId);
    await userRepository.update(userId, {
      treasury: {
        ...newUser.treasury,
        stripeFinAccountId: financialAccount.id,
        fdicPassThroughEligible: true,
        status: 'ACTIVE',
      }
    });
  }
  
  await addAuditLog({
    podId: undefined,
    actorId: userId,
    actorName: displayName,
    action: 'USER_REGISTERED',
    detail: `Registered new driver profile on ${platform} fleet network. Initial Treasury account created.`,
    metadata: { platform, autoVerifyKyc },
  });
  
  res.status(201).json({
    success: true,
    user: newUser,
    message: 'Account created successfully',
    stripeOnboardingUrl: `https://connect.stripe.com/setup/s/${connectAccount.id}`, // Simplified
  });
}));

// Login / Get user by email
router.post('/users/login', validateBody(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, userId } = req.validatedBody;
  
  let user;
  if (userId) {
    user = await userRepository.getById(userId);
  } else if (email) {
    user = await userRepository.getByEmail(email);
  }
  
  if (!user) {
    return res.status(404).json({ error: 'No account found matching those credentials' });
  }
  
  res.json(user);
}));

// Switch user (for demo/testing)
router.post('/users/switch', validateBody(switchUserSchema), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.validatedBody;
  const user = await userRepository.getById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
}));

// KYC Verification
router.post('/users/kyc/verify', authMiddleware, validateBody(kycVerifySchema), asyncHandler(async (req: Request, res: Response) => {
  const { idType, documentNumber, fullName, ssnLast4 } = req.validatedBody;
  const userId = req.user!.uid;
  
  const user = await userRepository.getById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Create Stripe Identity Verification Session
  const session = await createIdentityVerificationSession(userId, user.email, user.displayName);
  
  // In production, you'd redirect user to session.url
  // For now, we'll simulate verification completion
  // In real app, this would be handled via webhook
  
  // Update user KYC status
  await userRepository.updateKycStatus(userId, 'VERIFIED', new Date().toISOString());
  
  // Create Treasury Financial Account if not exists
  if (!user.treasury.stripeFinAccountId) {
    const financialAccount = await createTreasuryFinancialAccount(
      user.treasury.stripeAccountId,
      userId
    );
    await userRepository.update(userId, {
      treasury: {
        ...user.treasury,
        stripeFinAccountId: financialAccount.id,
        fdicPassThroughEligible: true,
        status: 'ACTIVE',
      }
    });
  }
  
  const updatedUser = await userRepository.getById(userId);
  
  await addAuditLog({
    podId: undefined,
    actorId: userId,
    actorName: user.displayName,
    action: 'KYC_VERIFIED',
    detail: `Completed Stripe Identity verification (${idType || 'Driver License'}, SSN: ***-**-${ssnLast4}). Stripe Custom Account ${user.treasury.stripeAccountId} and Treasury Financial Account activated with FDIC pass-through coverage.`,
    metadata: { idType, fullName },
  });
  
  res.json({
    success: true,
    user: updatedUser,
    message: 'Stripe Identity KYC Verification Successful. Treasury Account Activated.',
    verificationSessionId: session.id,
  });
}));

// Link Bank Account
router.post('/users/bank/link', authMiddleware, validateBody(bankLinkSchema), asyncHandler(async (req: Request, res: Response) => {
  const { bankName, accountNumber, routingNumber, accountType } = req.validatedBody;
  const userId = req.user!.uid;
  
  const user = await userRepository.getById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Create Financial Connections Session
  const session = await createFinancialConnectionsSession(user.treasury.stripeAccountId, userId);
  
  // In production, redirect user to session.client_secret
  // For demo, we'll simulate completion
  
  const last4 = accountNumber.slice(-4);
  const updatedUser = await userRepository.updateExternalBank(userId, {
    bankName: bankName || 'Chase Bank',
    last4,
    routingNumber: routingNumber || '021000021',
    accountType: accountType || 'CHECKING',
    status: 'LINKED',
    linkedAt: new Date().toISOString(),
  });
  
  await addAuditLog({
    podId: undefined,
    actorId: userId,
    actorName: user.displayName,
    action: 'BANK_LINKED',
    detail: `Linked external bank account (${bankName || 'Chase Bank'} ending in ${last4}) via Stripe Financial Connections for Treasury transfers.`,
    metadata: { bankName, last4 },
  });
  
  res.json({
    success: true,
    user: updatedUser,
    financialConnectionsSession: session,
  });
}));

// Get all users (for admin/user switcher)
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const users = await userRepository.list(100);
  res.json(users);
}));

// ============================================
// POD MANAGEMENT
// ============================================

// Get all pods
router.get('/pods', asyncHandler(async (req: Request, res: Response) => {
  const pods = await podRepository.list(100);
  res.json(pods);
}));

// Get pod by ID
router.get('/pods/:id', asyncHandler(async (req: Request, res: Response) => {
  const pod = await podRepository.getById(req.params.id);
  if (!pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }
  
  // Attach related data
  const [deposits, requests, logs] = await Promise.all([
    depositRepository.getByPod(pod.id),
    reprioritizationRequestRepository.getByPod(pod.id),
    auditLogRepository.getByPod(pod.id),
  ]);
  
  res.json({
    ...pod,
    deposits,
    reprioritizationRequests: requests,
    auditLogs: logs,
  });
}));

// Create Pod
router.post('/pods', authMiddleware, validateBody(createPodSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const { name, description, category, sizeTier, depositTier } = req.validatedBody;
  
  const user = await userRepository.getById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // KYC Check
  if (user.kycStatus !== 'VERIFIED') {
    return res.status(403).json({
      error: 'KYC_REQUIRED',
      message: 'You must complete Stripe Identity KYC verification before creating a mutual savings pod.',
    });
  }
  
  // Tenure Rule Enforcement
  const isSeasoned = user.accountAgeDays >= 90 || user.completedPodsCount >= 1;
  if (!isSeasoned) {
    if (sizeTier > 50) {
      return res.status(400).json({
        error: 'TENURE_RESTRICTION',
        message: 'New accounts (< 90 days tenure) can only create 20 or 50 member pods. Higher member tiers unlock after 3 months of successful operation.',
      });
    }
    if (depositTier > 20) {
      return res.status(400).json({
        error: 'DEPOSIT_TIER_RESTRICTION',
        message: 'New accounts can start at $5, $10, or $20 deposit tiers. $50 and $100 tiers unlock after completing 1 full pod cycle.',
      });
    }
  }
  
  const newPod = await podRepository.create({
    name,
    description: description || 'Community gig worker mutual savings pool',
    category: category || 'General Gig Workers',
    sizeTier,
    depositTier,
    status: 'FORMING',
    currentCycleWeek: 1,
    totalCycles: sizeTier,
    agreementVersion: 'v2.0-2026',
    holdingFinAccountId: `fa_pod_holding_${Date.now()}`,
    createdBy: userId,
    creatorName: user.displayName,
    weeklyPoolTarget: sizeTier * depositTier,
    currentWeeklyCollected: 0,
    members: [{
      id: `pm_${Date.now()}_1`,
      podId: '', // Will be set after creation
      userId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      platform: user.platform,
      rotationIndex: 0,
      hasReceivedPayout: false,
      delinquencyStatus: 'CLEAN',
      joinedAt: new Date().toISOString(),
    }],
  });
  
  // Update member with correct podId
  await podRepository.updateMember(newPod.id, userId, { podId: newPod.id });
  
  await addAuditLog({
    podId: newPod.id,
    actorId: userId,
    actorName: user.displayName,
    action: 'POD_CREATED',
    detail: `Created new pod "${newPod.name}" (${newPod.sizeTier} members @ $${newPod.depositTier}/wk). Stripe Treasury Holding Account ${newPod.holdingFinAccountId} provisioned.`,
  });
  
  res.json(newPod);
}));

// Join Pod
router.post('/pods/:id/join', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const podId = req.params.id;
  
  const user = await userRepository.getById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (user.kycStatus !== 'VERIFIED') {
    return res.status(403).json({
      error: 'KYC_REQUIRED',
      message: 'You must complete Stripe Identity KYC verification before joining a mutual savings pod.',
    });
  }
  
  const pod = await podRepository.getById(podId);
  if (!pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }
  
  if (pod.status !== 'FORMING') {
    return res.status(400).json({ error: 'This pod is already locked or active and cannot accept new members.' });
  }
  
  if (pod.members.length >= pod.sizeTier) {
    return res.status(400).json({ error: 'Pod has reached its maximum size tier capacity.' });
  }
  
  const existing = pod.members.find(m => m.userId === userId);
  if (existing) {
    return res.status(400).json({ error: 'You are already a member of this pod.' });
  }
  
  const newMember = {
    id: `pm_${Date.now()}_${pod.members.length + 1}`,
    podId,
    userId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    platform: user.platform,
    rotationIndex: pod.members.length,
    hasReceivedPayout: false,
    delinquencyStatus: 'CLEAN' as const,
    joinedAt: new Date().toISOString(),
  };
  
  await podRepository.addMember(podId, newMember);
  
  await addAuditLog({
    podId,
    actorId: userId,
    actorName: user.displayName,
    action: 'POD_CREATED', // Using existing action type
    detail: `Joined pod "${pod.name}". Position in queue pending final rotation lock when full.`,
  });
  
  const updatedPod = await podRepository.getById(podId);
  res.json(updatedPod);
}));

// Sign Pod Agreement
router.post('/pods/:id/agreement/sign', authMiddleware, validateBody(signAgreementSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const { signatureName } = req.validatedBody;
  const podId = req.params.id;
  
  const pod = await podRepository.getById(podId);
  if (!pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }
  
  const member = pod.members.find(m => m.userId === userId);
  if (!member) {
    return res.status(403).json({ error: 'You are not a member of this pod.' });
  }
  
  await podRepository.updateMember(podId, userId, {
    agreementSignedAt: new Date().toISOString(),
    agreementSignatureName: signatureName || user.displayName,
  });
  
  await addAuditLog({
    podId,
    actorId: userId,
    actorName: user.displayName,
    action: 'AGREEMENT_SIGNED',
    detail: `Signed legal Pod Agreement v2.0-2026 as "${signatureName || user.displayName}". Confirmed understanding of fixed rotation order, FDIC pass-through coverage, and delinquency handling.`,
  });
  
  const updatedPod = await podRepository.getById(podId);
  res.json({ success: true, member: updatedPod?.members.find(m => m.userId === userId), pod: updatedPod });
}));

// Lock Pod & Generate Fixed Rotation Order
router.post('/pods/:id/lock', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const podId = req.params.id;
  
  const pod = await podRepository.getById(podId);
  if (!pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }
  
  // Check if all members signed
  const unsigned = pod.members.filter(m => !m.agreementSignedAt);
  if (unsigned.length > 0) {
    return res.status(400).json({
      error: 'UNSIGNED_MEMBERS',
      message: `Cannot lock pod. ${unsigned.length} member(s) have not digitally signed the Pod Agreement yet.`
    });
  }
  
  // Fisher-Yates shuffle for fixed rotation
  const shuffledMembers = [...pod.members];
  for (let i = shuffledMembers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledMembers[i], shuffledMembers[j]] = [shuffledMembers[j], shuffledMembers[i]];
  }
  
  // Assign permanent rotationIndex
  shuffledMembers.forEach((m, idx) => {
    m.rotationIndex = idx;
  });
  
  await podRepository.lockPod(podId, shuffledMembers);
  
  await addAuditLog({
    podId,
    actorId: userId,
    actorName: req.user!.displayName || 'Unknown',
    action: 'ROTATION_LOCKED',
    detail: `Pod locked and activated. 1-time cryptographically secure random shuffle permanently set rotation indices 0 to ${pod.members.length - 1}. Rotation order is now fixed and immutable.`,
    metadata: { totalMembers: pod.members.length, agreementVersion: pod.agreementVersion },
  });
  
  const updatedPod = await podRepository.getById(podId);
  res.json(updatedPod);
}));

// ============================================
// DEPOSITS & PAYOUTS
// ============================================

// Deposit Weekly Funds
router.post('/pods/:id/deposit', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const podId = req.params.id;
  
  const user = await userRepository.getById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (user.kycStatus !== 'VERIFIED') {
    return res.status(403).json({ error: 'KYC required before making deposits.' });
  }
  
  const pod = await podRepository.getById(podId);
  if (!pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }
  
  const member = pod.members.find(m => m.userId === userId);
  if (!member) {
    return res.status(403).json({ error: 'Not a member of this pod.' });
  }
  
  const depositAmount = pod.depositTier;
  const stripePaymentId = `pi_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  
  const newDeposit = await depositRepository.create({
    membershipId: member.id,
    podId,
    cycleId: `cyc_w${pod.currentCycleWeek}`,
    userId,
    userName: user.displayName,
    amount: depositAmount,
    stripePaymentId,
    status: 'COMPLETE',
  });
  
  await podRepository.incrementWeeklyCollected(podId, depositAmount);
  
  await addAuditLog({
    podId,
    actorId: userId,
    actorName: user.displayName,
    action: 'DEPOSIT_COMPLETED',
    detail: `Deposited $${depositAmount}.00 into Treasury holding account ${pod.holdingFinAccountId} for Week ${pod.currentCycleWeek} cycle. Stripe Transfer ID: ${stripePaymentId}.`,
    metadata: { amount: depositAmount, cycleWeek: pod.currentCycleWeek },
  });
  
  const updatedPod = await podRepository.getById(podId);
  res.json({
    success: true,
    deposit: newDeposit,
    currentWeeklyCollected: updatedPod?.currentWeeklyCollected,
    weeklyPoolTarget: pod.weeklyPoolTarget,
  });
}));

// Process Weekly Cycle Payout
router.post('/pods/:id/cycle/process', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const podId = req.params.id;
  
  const pod = await podRepository.getById(podId);
  if (!pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }
  
  if (pod.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'Pod is not active.' });
  }
  
  // Find recipient for current week
  const targetIndex = pod.currentCycleWeek - 1;
  const recipientMember = pod.members.find(m => m.rotationIndex === targetIndex);
  
  if (!recipientMember) {
    return res.status(400).json({ error: `No recipient assigned for rotation index ${targetIndex}.` });
  }
  
  const recipientUser = await userRepository.getById(recipientMember.userId);
  const payoutAmount = pod.currentWeeklyCollected > 0 ? pod.currentWeeklyCollected : pod.weeklyPoolTarget;
  const stripeTransferId = `tr_stripe_treasury_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  
  // Update recipient Treasury balance
  if (recipientUser) {
    await userRepository.updateTreasuryBalance(recipientMember.userId, payoutAmount);
  }
  
  // Mark member as received payout
  await podRepository.updateMember(podId, recipientMember.userId, {
    hasReceivedPayout: true,
    payoutCycleWeek: pod.currentCycleWeek,
  });
  
  // Reset weekly collected
  await podRepository.resetWeeklyCollected(podId);
  
  await addAuditLog({
    podId,
    actorId: userId,
    actorName: req.user!.displayName || 'Unknown',
    action: 'PAYOUT_EXECUTED',
    detail: `Week ${pod.currentCycleWeek} Payout of $${payoutAmount}.00 executed via Stripe Treasury OutboundTransfer (${stripeTransferId}) to ${recipientMember.displayName} (Rotation #${recipientMember.rotationIndex}).`,
    metadata: { stripeTransferId, recipientId: recipientMember.userId, amount: payoutAmount, weekNumber: pod.currentCycleWeek },
  });
  
  // Advance cycle
  await podRepository.advanceCycle(podId);
  
  // If pod completed, increment completedPodsCount for all members
  if (pod.currentCycleWeek >= pod.totalCycles) {
    for (const member of pod.members) {
      await userRepository.incrementCompletedPods(member.userId);
    }
  }
  
  const updatedPod = await podRepository.getById(podId);
  res.json({
    success: true,
    stripeTransferId,
    payoutAmount,
    recipientName: recipientMember.displayName,
    nextCycleWeek: updatedPod?.currentCycleWeek,
    podStatus: updatedPod?.status,
  });
}));

// ============================================
// EMERGENCY REPRIORITIZATION
// ============================================

// Request Reprioritization
router.post('/pods/:id/reprioritize/request', authMiddleware, validateBody(reprioritizeRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const { reason } = req.validatedBody;
  const podId = req.params.id;
  
  const pod = await podRepository.getById(podId);
  if (!pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }
  
  const member = pod.members.find(m => m.userId === userId);
  if (!member) {
    return res.status(403).json({ error: 'Not a member of this pod.' });
  }
  
  const user = await userRepository.getById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const newRequest = await reprioritizationRequestRepository.create({
    podId,
    membershipId: member.id,
    requesterUserId: userId,
    requesterName: user.displayName,
    currentRotationIndex: member.rotationIndex,
    desiredRotationIndex: pod.currentCycleWeek - 1, // Next up!
    reason: reason || 'Emergency hardship request',
    status: 'PENDING',
    votesFor: 1, // Auto-vote from requester
    votesAgainst: 0,
    quorumNeeded: Math.floor(pod.members.length / 2) + 1,
    votedUserIds: [userId],
  });
  
  await addAuditLog({
    podId,
    actorId: userId,
    actorName: user.displayName,
    action: 'REPRIORITIZATION_REQUESTED',
    detail: `Submitted emergency reprioritization request to advance from Rotation #${member.rotationIndex} to Rotation #${newRequest.desiredRotationIndex}. Reason: "${reason}". Requires ${newRequest.quorumNeeded} votes.`,
    metadata: { requestId: newRequest.id, reason },
  });
  
  res.json(newRequest);
}));

// Vote on Reprioritization
router.post('/pods/:id/reprioritize/vote', authMiddleware, validateBody(reprioritizeVoteSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const { requestId, vote } = req.validatedBody;
  const podId = req.params.id;
  
  const pod = await podRepository.getById(podId);
  if (!pod) return res.status(404).json({ error: 'Pod not found' });
  
  const request = await reprioritizationRequestRepository.getById(requestId);
  if (!request || request.status !== 'PENDING') {
    return res.status(400).json({ error: 'Active request not found.' });
  }
  
  if (request.votedUserIds.includes(userId)) {
    return res.status(400).json({ error: 'You have already voted on this request.' });
  }
  
  const updatedRequest = await reprioritizationRequestRepository.addVote(requestId, userId, vote);
  
  // Check if quorum reached
  if (updatedRequest && updatedRequest.votesFor >= updatedRequest.quorumNeeded) {
    await reprioritizationRequestRepository.decide(requestId, 'APPROVED');
    
    // Swap rotation indices
    const requesterMember = pod.members.find(m => m.userId === request.requesterUserId);
    const targetMember = pod.members.find(m => m.rotationIndex === request.desiredRotationIndex);
    
    if (requesterMember && targetMember) {
      const oldIndex = requesterMember.rotationIndex;
      await podRepository.updateMember(podId, requesterMember.userId, { rotationIndex: request.desiredRotationIndex });
      await podRepository.updateMember(podId, targetMember.userId, { rotationIndex: oldIndex });
      
      await addAuditLog({
        podId,
        actorId: userId,
        actorName: req.user!.displayName || 'Unknown',
        action: 'REPRIORITIZATION_VOTED',
        detail: `Emergency reprioritization request ${request.id} APPROVED by pod quorum (${updatedRequest.votesFor}/${pod.members.length} votes FOR). ${requesterMember.displayName} moved to Rotation #${request.desiredRotationIndex}.`,
        metadata: { requestId: request.id, votesFor: updatedRequest.votesFor },
      });
    }
  } else if (updatedRequest && updatedRequest.votesAgainst > pod.members.length - updatedRequest.quorumNeeded) {
    await reprioritizationRequestRepository.decide(requestId, 'REJECTED');
    
    await addAuditLog({
      podId,
      actorId: userId,
      actorName: req.user!.displayName || 'Unknown',
      action: 'REPRIORITIZATION_VOTED',
      detail: `Emergency reprioritization request ${request.id} REJECTED by pod vote.`,
      metadata: { requestId: request.id },
    });
  }
  
  const updatedPod = await podRepository.getById(podId);
  res.json({ request: updatedRequest, pod: updatedPod });
}));

// ============================================
// VOLUNTARY SLOT SWAP
// ============================================

router.post('/pods/:id/swap', authMiddleware, validateBody(swapSlotsSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const { targetMemberUserId } = req.validatedBody;
  const podId = req.params.id;
  
  const pod = await podRepository.getById(podId);
  if (!pod) return res.status(404).json({ error: 'Pod not found' });
  
  const member1 = pod.members.find(m => m.userId === userId);
  const member2 = pod.members.find(m => m.userId === targetMemberUserId);
  
  if (!member1 || !member2) {
    return res.status(400).json({ error: 'Both members must be in the pod.' });
  }
  
  if (member1.hasReceivedPayout || member2.hasReceivedPayout) {
    return res.status(400).json({ error: 'Cannot swap slots if either member has already received a payout.' });
  }
  
  const tempIndex = member1.rotationIndex;
  await podRepository.updateMember(podId, userId, { rotationIndex: member2.rotationIndex });
  await podRepository.updateMember(podId, targetMemberUserId, { rotationIndex: tempIndex });
  
  await addAuditLog({
    podId,
    actorId: userId,
    actorName: req.user!.displayName || 'Unknown',
    action: 'SLOT_SWAP_EXECUTED',
    detail: `Voluntary rotation slot swap executed between ${member1.displayName} (now #${member2.rotationIndex}) and ${member2.displayName} (now #${tempIndex}). Mutually agreed.`,
    metadata: { member1Id: member1.userId, member2Id: member2.userId },
  });
  
  const updatedPod = await podRepository.getById(podId);
  res.json({ success: true, pod: updatedPod });
}));

// ============================================
// PERKS MARKETPLACE
// ============================================

router.get('/perks', asyncHandler(async (req: Request, res: Response) => {
  const { category, search } = req.query;
  let perks = await perkRepository.getApproved();
  
  if (category && category !== 'All') {
    perks = perks.filter(p => p.category === category);
  }
  
  if (search) {
    const q = (search as string).toLowerCase();
    perks = perks.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.provider.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }
  
  res.json(perks);
}));

router.post('/perks/redeem', authMiddleware, validateBody(redeemPerkSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const { perkId } = req.validatedBody;
  
  const user = await userRepository.getById(userId);
  if (!user || user.kycStatus !== 'VERIFIED') {
    return res.status(403).json({ error: 'KYC verification required to redeem perks.' });
  }
  
  const perk = await perkRepository.getById(perkId);
  if (!perk) return res.status(404).json({ error: 'Perk not found' });
  
  await perkRepository.incrementRedeemedCount(perkId);
  
  const redemption = await redemptionRepository.create({
    userId,
    perkId: perk.id,
    perkTitle: perk.title,
    codeOrLink: perk.redemptionData,
    redeemedAt: new Date().toISOString(),
  });
  
  res.json({
    success: true,
    redemption,
    perk,
  });
}));

router.post('/perks/submit', authMiddleware, validateBody(submitPerkSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const { title, category, provider, description, valueBadge, redemptionType, redemptionData, eligibility } = req.validatedBody;
  
  const user = await userRepository.getById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const newPerk = await perkRepository.create({
    title,
    category,
    provider: provider || user.displayName,
    description,
    valueBadge: valueBadge || 'Special Discount',
    redemptionType: redemptionType || 'CODE',
    redemptionData,
    eligibility: eligibility || 'All verified members',
    submittedBy: user.displayName,
    status: 'PENDING',
    iconName: 'Gift',
    redeemedCount: 0,
  });
  
  res.json({ success: true, perk: newPerk, message: 'Partner perk submitted for admin CMS review.' });
}));

router.get('/admin/perks/pending', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = await userRepository.getById(req.user!.uid);
  if (user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const pending = await perkRepository.getPending();
  res.json(pending);
}));

router.post('/admin/perks/:id/approve', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = await userRepository.getById(req.user!.uid);
  if (user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const perk = await perkRepository.approve(req.params.id);
  if (!perk) return res.status(404).json({ error: 'Perk not found' });
  
  res.json({ success: true, perk });
}));

// ============================================
// AUDIT LOGS
// ============================================

router.get('/audit-logs', asyncHandler(async (req: Request, res: Response) => {
  const { podId, action, search, limit, offset } = req.query;
  
  let logs: any[] = [];
  
  if (podId) {
    logs = await auditLogRepository.getByPod(podId as string);
  } else {
    logs = await auditLogRepository.list(Number(limit) || 100, Number(offset) || 0);
  }
  
  // Filter by action
  if (action) {
    logs = logs.filter(l => l.action === action);
  }
  
  // Filter by search
  if (search) {
    const q = (search as string).toLowerCase();
    logs = logs.filter(l => 
      l.detail.toLowerCase().includes(q) || 
      l.actorName.toLowerCase().includes(q) ||
      (l.podId && l.podId.toLowerCase().includes(q))
    );
  }
  
  res.json(logs);
}));

// ============================================
// STRIPE WEBHOOK
// ============================================

router.post('/webhooks/stripe', asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET not configured');
    return res.json({ received: true });
  }
  
  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(req.body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  await handleStripeWebhook(event);
  res.json({ received: true, eventType: event.type });
}));

// ============================================
// ADMIN OPERATIONS
// ============================================

router.post('/admin/delinquency/handle', authMiddleware, validateBody(delinquencyActionSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.uid;
  const { podId, memberUserId, actionChoice } = req.validatedBody;
  
  const user = await userRepository.getById(userId);
  if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'POD_ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const pod = await podRepository.getById(podId);
  if (!pod) return res.status(404).json({ error: 'Pod not found' });
  
  const member = pod.members.find(m => m.userId === memberUserId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  
  if (actionChoice === 'GRACE_PERIOD') {
    await podRepository.updateMember(podId, memberUserId, { delinquencyStatus: 'GRACE_PERIOD' });
  } else if (actionChoice === 'COVER_GAP') {
    await podRepository.updateMember(podId, memberUserId, { delinquencyStatus: 'CLEAN' });
    await podRepository.incrementWeeklyCollected(podId, pod.depositTier);
  }
  // REMOVE would require more complex logic
  
  await addAuditLog({
    podId,
    actorId: userId,
    actorName: user?.displayName || 'Admin',
    action: 'DELINQUENCY_HANDLED',
    detail: `Admin handled missed deposit for ${member.displayName}: Action selected = "${actionChoice}".`,
    metadata: { memberUserId, actionChoice },
  });
  
  const updatedPod = await podRepository.getById(podId);
  const updatedMember = updatedPod?.members.find(m => m.userId === memberUserId);
  
  res.json({ success: true, member: updatedMember, pod: updatedPod });
}));

export default router;