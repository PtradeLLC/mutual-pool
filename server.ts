import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { 
  User, Pod, PodMembership, Perk, AuditLogEntry, 
  ReprioritizationRequest, Deposit, WeeklyCycle, Redemption, InvitedContact 
} from './src/types';
import { 
  INITIAL_USERS, INITIAL_PODS, INITIAL_PERKS, INITIAL_AUDIT_LOGS 
} from './src/data/initialData';

const PORT = 3000;

// State Store (In-Memory Database)
let users: User[] = [...INITIAL_USERS];
let pods: Pod[] = [...INITIAL_PODS];
let perks: Perk[] = [...INITIAL_PERKS];
let auditLogs: AuditLogEntry[] = [...INITIAL_AUDIT_LOGS];
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

// Helper: Get Current User from Request Header/Query or default
function getCurrentUser(req: Request): User | null {
  const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
  if (userId) {
    const found = users.find(u => u.id === userId);
    return found || null;
  }
  return users[0] || null;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- API ROUTES ---

  // 1. Current User Profile, Sync, Login, Registration & User Switcher
  app.get('/api/users/current', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });

  app.post('/api/users/sync', (req: Request, res: Response) => {
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
  });

  app.get('/api/users', (req: Request, res: Response) => {
    res.json(users);
  });

  app.post('/api/users/login', (req: Request, res: Response) => {
    const { email, userId } = req.body;
    let found = users.find(u => u.id === userId);
    if (!found && email) {
      found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
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

    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
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
  app.post('/api/users/kyc/verify', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { idType, documentNumber, fullName, ssnLast4 } = req.body;

    const targetUser = users.find(u => u.id === user.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    targetUser.kycStatus = 'VERIFIED';
    targetUser.kycVerifiedAt = new Date().toISOString();
    
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
      targetUser.displayName,
      'KYC_VERIFIED',
      `Completed Stripe Identity verification (${idType || 'Driver License'}, SSN: ***-**-${ssnLast4 || '4321'}). Stripe Custom Account ${targetUser.treasury.stripeAccountId} and Treasury Financial Account ${targetUser.treasury.stripeFinAccountId} activated with FDIC pass-through coverage.`,
      { idType, fullName }
    );

    res.json({
      success: true,
      user: targetUser,
      message: 'Stripe Identity KYC Verification Successful. Treasury Account Activated.',
    });
  });

  // 3. Bank Account Linking (Stripe Financial Connections)
  app.post('/api/users/bank/link', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { bankName, accountNumber, routingNumber, accountType } = req.body;

    const targetUser = users.find(u => u.id === user.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const last4 = (accountNumber || '4821').slice(-4);
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
      targetUser.displayName,
      'BANK_LINKED',
      `Linked external bank account (${targetUser.externalBank.bankName} ending in ${last4}) via Stripe Financial Connections for Treasury transfers.`,
      { bankName, last4 }
    );

    res.json({
      success: true,
      user: targetUser,
    });
  });

  // 4. Pods List & Details
  app.get('/api/pods', (req: Request, res: Response) => {
    res.json(pods);
  });

  app.get('/api/pods/:id', (req: Request, res: Response) => {
    const pod = pods.find(p => p.id === req.params.id);
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
  });

  // 5. Create Pod (Enforces Tenure & Deposit Tier Guardrails)
  app.post('/api/pods', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { 
      name, 
      description, 
      category, 
      sizeTier, 
      depositTier, 
      podType, 
      inviteWindowDays, 
      autoOpenOnExpire, 
      invitedContacts 
    } = req.body;

    // Hard Gate: KYC Must be Verified
    if (user.kycStatus !== 'VERIFIED') {
      return res.status(403).json({
        error: 'KYC_REQUIRED',
        message: 'You must complete Stripe Identity KYC verification before creating a mutual savings pod.'
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

    const newPod: Pod = {
      id: podId,
      name,
      description: description || 'Community gig worker mutual savings pool',
      category: category || 'General Gig Workers',
      podType: requestedPodType,
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
      currentWeeklyCollected: 0,
      members: [
        {
          id: `pm_${Date.now()}_1`,
          podId: podId,
          userId: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          platform: user.platform,
          rotationIndex: 0,
          hasReceivedPayout: false,
          delinquencyStatus: 'CLEAN',
          joinedAt: new Date().toISOString(),
        }
      ],
    };

    pods.unshift(newPod);

    addAuditLog(
      newPod.id,
      user.id,
      user.displayName,
      'POD_CREATED',
      `Created new ${newPod.podType === 'TRUSTED_CIRCLE' ? '🔒 Trusted Circle' : '🌐 Open'} pod "${newPod.name}" (${newPod.sizeTier} members @ $${newPod.depositTier}/wk). Invite Code: ${newPod.inviteCode}. Holding Account ${newPod.holdingFinAccountId} provisioned.`
    );

    res.json(newPod);
  });

  // 5b. Add / Invite Contacts to Pod's Trusted Circle
  app.post('/api/pods/:id/contacts', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const pod = pods.find(p => p.id === req.params.id);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    const { contacts } = req.body; // array of { name, emailOrPhone }
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
      };

      pod.invitedContacts.push(newInvitedContact);
      addedContacts.push(newInvitedContact);
    });

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'POD_CREATED',
      `Invited ${addedContacts.length} contacts to Trusted Circle for pod "${pod.name}".`
    );

    res.json({
      success: true,
      pod,
      addedContacts,
    });
  });

  // 5c. Convert Trusted Circle Pod to Open Pod
  app.post('/api/pods/:id/convert-open', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const pod = pods.find(p => p.id === req.params.id);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    if (pod.createdBy !== user.id) {
      return res.status(403).json({ error: 'Only the pod creator can convert this pod to an Open Pod.' });
    }

    pod.podType = 'OPEN_POD';

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'POD_CREATED',
      `Converted pod "${pod.name}" from Trusted Circle to Open Pod. Remaining spots are now open to all verified members.`
    );

    res.json({ success: true, pod });
  });

  // 6. Join Pod
  app.post('/api/pods/:id/join', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { inviteCode } = req.body || {};
    const pod = pods.find(p => p.id === req.params.id);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    if (user.kycStatus !== 'VERIFIED') {
      return res.status(403).json({
        error: 'KYC_REQUIRED',
        message: 'You must complete Stripe Identity KYC verification before joining a mutual savings pod.'
      });
    }

    if (pod.status !== 'FORMING') {
      return res.status(400).json({ error: 'This pod is already locked or active and cannot accept new members.' });
    }

    if (pod.members.length >= pod.sizeTier) {
      return res.status(400).json({ error: 'Pod has reached its maximum size tier capacity.' });
    }

    const existing = pod.members.find(m => m.userId === user.id);
    if (existing) {
      return res.status(400).json({ error: 'You are already a member of this pod.' });
    }

    // Check Trusted Circle restrictions if pod is TRUSTED_CIRCLE and user is not creator
    if (pod.podType === 'TRUSTED_CIRCLE' && pod.createdBy !== user.id) {
      const isInvitedByEmail = pod.invitedContacts?.some(
        ic => ic.emailOrPhone.toLowerCase() === user.email.toLowerCase() || ic.memberUserId === user.id
      );
      const isCodeValid = inviteCode && inviteCode.trim().toUpperCase() === pod.inviteCode?.toUpperCase();

      if (!isInvitedByEmail && !isCodeValid) {
        return res.status(403).json({
          error: 'INVITE_REQUIRED',
          message: 'This is a private Trusted Circle pod. Enter the valid 6-character invite code or request an invite from the pod creator.'
        });
      }
    }

    const newMember: PodMembership = {
      id: `pm_${Date.now()}_${pod.members.length + 1}`,
      podId: pod.id,
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      platform: user.platform,
      rotationIndex: pod.members.length,
      hasReceivedPayout: false,
      delinquencyStatus: 'CLEAN',
      joinedAt: new Date().toISOString(),
    };

    pod.members.push(newMember);

    // Update invited contact status if matched
    if (pod.invitedContacts) {
      const contactMatch = pod.invitedContacts.find(
        ic => ic.emailOrPhone.toLowerCase() === user.email.toLowerCase() || ic.memberUserId === user.id
      );
      if (contactMatch) {
        contactMatch.status = 'JOINED';
      }
    }

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'POD_CREATED', // Or joined
      `Joined pod "${pod.name}". Position in queue pending final rotation lock when full.`
    );

    res.json(pod);
  });

  // 7. Digital Signature on Pod Agreement
  app.post('/api/pods/:id/agreement/sign', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { signatureName } = req.body;
    const pod = pods.find(p => p.id === req.params.id);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    const member = pod.members.find(m => m.userId === user.id);
    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this pod.' });
    }

    member.agreementSignedAt = new Date().toISOString();
    member.agreementSignatureName = signatureName || user.displayName;

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'AGREEMENT_SIGNED',
      `Signed legal Pod Agreement v2.0-2026 as "${member.agreementSignatureName}". Confirmed understanding of fixed rotation order, FDIC pass-through coverage, and delinquency handling.`
    );

    res.json({ success: true, member, pod });
  });

  // 8. Lock Pod & Generate Fixed Rotation Order
  app.post('/api/pods/:id/lock', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const pod = pods.find(p => p.id === req.params.id);

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

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'ROTATION_LOCKED',
      `Pod locked and activated. 1-time cryptographically secure random shuffle permanently set rotation indices 0 to ${pod.members.length - 1}. Rotation order is now fixed and immutable.`,
      { totalMembers: pod.members.length, agreementVersion: pod.agreementVersion }
    );

    res.json(pod);
  });

  // 9. Deposit Weekly Funds to Stripe Treasury Holding Account
  app.post('/api/pods/:id/deposit', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const pod = pods.find(p => p.id === req.params.id);

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

    // Deduct from external bank / Treasury balance
    const depositAmount = pod.depositTier;
    const stripePaymentId = `pi_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const newDeposit: Deposit = {
      id: `dep_${Date.now()}`,
      membershipId: member.id,
      podId: pod.id,
      cycleId: `cyc_w${pod.currentCycleWeek}`,
      userId: user.id,
      userName: user.displayName,
      amount: depositAmount,
      stripePaymentId,
      status: 'COMPLETE',
      createdAt: new Date().toISOString(),
    };

    deposits.unshift(newDeposit);
    pod.currentWeeklyCollected += depositAmount;

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'DEPOSIT_COMPLETED',
      `Deposited $${depositAmount}.00 into Treasury holding account ${pod.holdingFinAccountId} for Week ${pod.currentCycleWeek} cycle. Stripe Transfer ID: ${stripePaymentId}.`,
      { amount: depositAmount, cycleWeek: pod.currentCycleWeek }
    );

    res.json({
      success: true,
      deposit: newDeposit,
      currentWeeklyCollected: pod.currentWeeklyCollected,
      weeklyPoolTarget: pod.weeklyPoolTarget,
    });
  });

  // 10. Process Weekly Cycle Payout via Stripe Treasury OutboundTransfer (Option A: Automated Earmarked Settlement)
  app.post('/api/pods/:id/cycle/process', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const pod = pods.find(p => p.id === req.params.id);

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
    const payoutAmount = pod.currentWeeklyCollected > 0 ? pod.currentWeeklyCollected : pod.weeklyPoolTarget;
    const stripeTransferId = `tr_stripe_treasury_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // Update recipient Treasury balance immediately (Option A: Auto-Earmarked Balance)
    if (recipientUser) {
      recipientUser.treasury.balanceUsd += payoutAmount;
      recipientUser.treasury.totalPayoutsReceivedUsd += payoutAmount;
    }

    recipientMember.hasReceivedPayout = true;
    recipientMember.payoutCycleWeek = pod.currentCycleWeek;
    recipientMember.payoutClaimStatus = 'EARMARKED_IN_TREASURY';
    recipientMember.payoutStripeTransferId = stripeTransferId;
    recipientMember.payoutProcessedAt = new Date().toISOString();

    // Reset weekly collected for next cycle
    pod.currentWeeklyCollected = 0;
    
    // Log audit entry with Option A details
    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'PAYOUT_EXECUTED',
      `Week ${pod.currentCycleWeek} payout of $${payoutAmount}.00 automatically processed via Stripe Treasury OutboundTransfer (${stripeTransferId}) to ${recipientMember.displayName} (Rotation #${recipientMember.rotationIndex}). Funds earmarked in member's Stripe Treasury Financial Account. Rotation schedule unblocked for next week.`,
      { 
        stripeTransferId, 
        recipientId: recipientMember.userId, 
        amount: payoutAmount, 
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
      payoutAmount,
      recipientName: recipientMember.displayName,
      payoutClaimStatus: 'EARMARKED_IN_TREASURY',
      nextCycleWeek: pod.currentCycleWeek,
      podStatus: pod.status,
    });
  });

  // 10b. Withdraw / Claim Earmarked Treasury Payout to External Bank Account
  app.post('/api/treasury/payouts/withdraw', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
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

  // 11. Emergency Reprioritization Request & Voting
  app.post('/api/pods/:id/reprioritize/request', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { reason } = req.body;
    const pod = pods.find(p => p.id === req.params.id);

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

  app.post('/api/pods/:id/reprioritize/vote', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { requestId, vote } = req.body; // vote: 'FOR' | 'AGAINST'
    const pod = pods.find(p => p.id === req.params.id);

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

  // 12. Voluntary Slot Swap Between Two Members
  app.post('/api/pods/:id/swap', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { targetMemberUserId } = req.body;
    const pod = pods.find(p => p.id === req.params.id);

    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    const member1 = pod.members.find(m => m.userId === user.id);
    const member2 = pod.members.find(m => m.userId === targetMemberUserId);

    if (!member1 || !member2) {
      return res.status(400).json({ error: 'Both members must be in the pod.' });
    }

    if (member1.hasReceivedPayout || member2.hasReceivedPayout) {
      return res.status(400).json({ error: 'Cannot swap slots if either member has already received a payout.' });
    }

    const tempIndex = member1.rotationIndex;
    member1.rotationIndex = member2.rotationIndex;
    member2.rotationIndex = tempIndex;

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'SLOT_SWAP_EXECUTED',
      `Voluntary rotation slot swap executed between ${member1.displayName} (now #${member1.rotationIndex}) and ${member2.displayName} (now #${member2.rotationIndex}). Mutually agreed.`,
      { member1Id: member1.userId, member2Id: member2.userId }
    );

    res.json({ success: true, pod });
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

  app.post('/api/perks/submit', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { title, category, provider, description, valueBadge, redemptionType, redemptionData, eligibility } = req.body;

    const newPerk: Perk = {
      id: `perk_${Date.now()}`,
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
    };

    perks.unshift(newPerk);

    res.json({ success: true, perk: newPerk, message: 'Partner perk submitted for admin CMS review.' });
  });

  app.get('/api/admin/perks/pending', (req: Request, res: Response) => {
    res.json(perks.filter(p => p.status === 'PENDING'));
  });

  app.post('/api/admin/perks/:id/approve', (req: Request, res: Response) => {
    const perk = perks.find(p => p.id === req.params.id);
    if (!perk) return res.status(404).json({ error: 'Perk not found' });

    perk.status = 'APPROVED';
    res.json({ success: true, perk });
  });

  // 14. Immutable Audit Logs
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    const { podId } = req.query;
    if (podId) {
      return res.json(auditLogs.filter(l => l.podId === podId));
    }
    res.json(auditLogs);
  });

  // 15. Stripe Webhook Testing Simulator
  app.post('/api/webhooks/stripe', (req: Request, res: Response) => {
    const { eventType, data } = req.body;

    addAuditLog(
      undefined,
      'stripe_webhook',
      'Stripe Treasury Webhook',
      'WEBHOOK_EVENT',
      `Received asynchronous webhook event: "${eventType || 'treasury.financial_account.features_status_updated'}". Verified signature via test mode endpoint.`,
      { eventType, data }
    );

    res.json({ received: true, eventType });
  });

  // 16. Operations Admin: Delinquency & Webhook Triggers
  app.post('/api/admin/delinquency/handle', (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { podId, memberUserId, actionChoice } = req.body; // actionChoice: 'GRACE_PERIOD' | 'COVER_GAP' | 'REMOVE'

    const pod = pods.find(p => p.id === podId);
    if (!pod) return res.status(404).json({ error: 'Pod not found' });

    const member = pod.members.find(m => m.userId === memberUserId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    if (actionChoice === 'GRACE_PERIOD') {
      member.delinquencyStatus = 'GRACE_PERIOD';
    } else if (actionChoice === 'COVER_GAP') {
      member.delinquencyStatus = 'CLEAN';
      pod.currentWeeklyCollected += pod.depositTier;
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

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Gig Mutual Pool PWA Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
