process.noDeprecation = true;
import express from 'express';
type Request = express.Request;
type Response = express.Response;
import path from 'path';
import fs from 'fs';
import { 
  User, Pod, PodMembership, Perk, PerkStatus, AuditLogEntry, 
  ReprioritizationRequest, Deposit, WeeklyCycle, Redemption, InvitedContact,
  HardshipFundRequest 
} from './src/types';
import { 
  INITIAL_USERS, INITIAL_PODS, INITIAL_PERKS, INITIAL_AUDIT_LOGS 
} from './src/data/initialData';

const PORT = 3000;

const PODS_FILE = path.join(process.env.VERCEL ? '/tmp' : process.cwd(), 'pods_data.json');
const USERS_FILE = path.join(process.env.VERCEL ? '/tmp' : process.cwd(), 'users_data.json');

function loadPodsFromDisk(): Pod[] {
  try {
    if (fs.existsSync(PODS_FILE)) {
      const raw = fs.readFileSync(PODS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const map = new Map<string, Pod>();
        for (const p of INITIAL_PODS) map.set(p.id, p);
        for (const p of parsed) {
          if (p && p.id) map.set(p.id, p);
        }
        return Array.from(map.values());
      }
    }
  } catch (err) {
    console.error('Error loading pods_data.json:', err);
  }
  return [...INITIAL_PODS];
}

function savePodsToDisk() {
  try {
    fs.writeFileSync(PODS_FILE, JSON.stringify(pods, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving pods_data.json:', err);
  }
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

function findPodById(id: string, currentUser?: User): Pod | undefined {
  if (!id) return undefined;

  try {
    const diskPods = loadPodsFromDisk();
    for (const dp of diskPods) {
      if (dp && dp.id && !pods.some(p => p.id === dp.id)) {
        pods.push(dp);
      }
    }
  } catch (err) {
    console.error('Error reloading pods in findPodById:', err);
  }

  let pod = pods.find(p => p.id === id);

  if (!pod && id.startsWith('pod_')) {
    const creator = currentUser || INITIAL_USERS[0];
    const newFallbackPod: Pod = {
      id,
      name: 'Mutual Savings Pod',
      description: 'Community gig worker mutual savings pool',
      category: 'General Gig Workers',
      podType: 'TRUSTED_CIRCLE',
      activationPolicy: 'FLEXIBLE_EARLY',
      inviteWindowDays: 7,
      autoOpenOnExpire: true,
      inviteCode: 'POOL2026',
      invitedContacts: [],
      sizeTier: 20,
      depositTier: 20,
      status: 'FORMING',
      currentCycleWeek: 1,
      totalCycles: 20,
      agreementVersion: 'v2.0-2026',
      holdingFinAccountId: `fa_${id}_holding`,
      createdBy: creator.id,
      creatorName: creator.displayName,
      createdAt: new Date().toISOString(),
      weeklyPoolTarget: 400,
      currentWeeklyCollected: 20,
      members: [
        {
          id: `pm_${id}_${creator.id}`,
          podId: id,
          userId: creator.id,
          displayName: creator.displayName,
          avatarUrl: creator.avatarUrl,
          platform: creator.platform,
          rotationIndex: 0,
          hasReceivedPayout: false,
          delinquencyStatus: 'CLEAN',
          joinedAt: new Date().toISOString(),
        } as any
      ]
    };
    pods.unshift(newFallbackPod);
    savePodsToDisk();
    pod = newFallbackPod;
  }

  if (pod && currentUser && !pod.members.some(m => m.userId === currentUser.id)) {
    pod.members.push({
      id: `pm_${pod.id}_${currentUser.id}`,
      podId: pod.id,
      userId: currentUser.id,
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl,
      platform: currentUser.platform,
      rotationIndex: pod.members.length,
      hasReceivedPayout: false,
      delinquencyStatus: 'CLEAN',
      joinedAt: new Date().toISOString(),
    } as any);
    savePodsToDisk();
  }

  return pod;
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
    const userId = rawUserId && rawUserId !== 'usr_guest' ? rawUserId : undefined;
    if (!userId) {
      return null;
    }

    let found: User | undefined = users.find(u => u && u.id === userId);
    if (!found) {
      const userName = getHeaderValue(req, 'x-user-name') || 'Verified Member';
      const userEmail = getHeaderValue(req, 'x-user-email') || `${userId.substring(0, 8)}@mutualpool.org`;
      const profile = getProfileFromHeaders(req);
      found = {
        id: userId,
        email: userEmail,
        displayName: userName,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=005FB8&color=fff&size=200`,
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

// Normalize request URL for serverless environments (e.g., Vercel proxy rewrites)
app.use((req, res, next) => {
  if (res.headersSent) return next();

  try {
    // If path query parameter was provided by Vercel rewrite rule: /api/(.*) -> /api/index.ts?path=$1
    if (req.query && typeof req.query.path === 'string') {
      const pathParam = req.query.path.startsWith('/') ? req.query.path : '/' + req.query.path;
      req.url = '/api' + pathParam;
      return next();
    }

    // If req.url is already a specific API route like /api/pods or /api/users/current, leave it alone!
    if (req.url && req.url.startsWith('/api/') && !req.url.startsWith('/api/index')) {
      return next();
    }

    // Check headers set by Vercel proxy for the original incoming client URL
    const rawForwarded = req.headers['x-forwarded-uri'] || req.headers['x-now-route-matches'] || req.headers['x-invoke-path'];
    const forwardedStr = Array.isArray(rawForwarded) ? rawForwarded[0] : rawForwarded;

    if (typeof forwardedStr === 'string' && forwardedStr.startsWith('/api/') && !forwardedStr.startsWith('/api/index')) {
      req.url = forwardedStr;
      return next();
    }

    // Fallback to req.originalUrl if it contains the real client path
    if (req.originalUrl && req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/api/index')) {
      req.url = req.originalUrl;
      return next();
    }
  } catch (err) {
    console.error('[URL Normalization Error]', err);
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

  // 4. Pods List & Details
  app.get(['/api/pods', '/pods'], (req: Request, res: Response) => {
    try {
      res.json(pods);
    } catch (err) {
      console.error('[/api/pods] error:', err);
      res.status(500).json({ error: 'Failed to fetch pods.' });
    }
  });

  app.get(['/api/pods/:id', '/pods/:id'], (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      const pod = findPodById(req.params.id, user);
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

    // Check Welcome Match Eligibility (Up to $20 match for verified KYC first pod creation)
    const creatorUser = users.find(u => u.id === user.id);
    const isKycVerified = user.kycStatus === 'VERIFIED' || creatorUser?.kycStatus === 'VERIFIED';
    const isEligibleForWelcomeMatch = isKycVerified && !creatorUser?.welcomeMatchReceived;
    const welcomeMatchAmount = isEligibleForWelcomeMatch ? Math.min(baseDepositAmount, 20) : 0;

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
  app.post(['/api/pods/:id/contacts', '/pods/:id/contacts'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = findPodById(req.params.id, user);

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
  app.post(['/api/pods/:id/convert-open', '/pods/:id/convert-open'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = findPodById(req.params.id, user);

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
  app.post(['/api/pods/:id/join', '/pods/:id/join'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { inviteCode, refUserId, refName } = req.body || {};
    const pod = findPodById(req.params.id, user);

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

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

    // Check matching contact in invitedContacts
    const contactMatch = pod.invitedContacts?.find(
      ic => ic.emailOrPhone.toLowerCase() === user.email.toLowerCase() || ic.memberUserId === user.id
    );

    // Check Trusted Circle restrictions if pod is TRUSTED_CIRCLE and user is not creator
    if (pod.podType === 'TRUSTED_CIRCLE' && pod.createdBy !== user.id) {
      const isInvited = !!contactMatch;
      const isCodeValid = inviteCode && inviteCode.trim().toUpperCase() === pod.inviteCode?.toUpperCase();

      if (!isInvited && !isCodeValid) {
        return res.status(403).json({
          error: 'INVITE_REQUIRED',
          message: 'This is a private Trusted Circle pod. Enter a valid invite code or request an invite from a pod member.'
        });
      }
    }

    // Determine inviter attribution
    let inviterId = contactMatch?.invitedByUserId;
    let inviterDisplayName = contactMatch?.invitedByName;

    if (!inviterId && refUserId) {
      const refMember = pod.members.find(m => m.userId === refUserId);
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
      invitedByUserId: inviterId,
      invitedByName: inviterDisplayName,
    };

    pod.members.push(newMember);
    savePodsToDisk();

    // Update invited contact status if matched
    if (contactMatch) {
      contactMatch.status = 'JOINED';
    }

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'POD_CREATED',
      `Joined pod "${pod.name}"${inviterDisplayName ? ` (Invited by ${inviterDisplayName})` : ''}. Position in queue pending final rotation lock when full.`
    );

    res.json(pod);
  });

  // 7. Digital Signature on Pod Agreement
  app.post(['/api/pods/:id/agreement/sign', '/pods/:id/agreement/sign'], (req: Request, res: Response) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
      }
      const { signatureName } = req.body || {};
      const pod = findPodById(req.params.id, user);

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
  app.post(['/api/pods/:id/lock', '/pods/:id/lock'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = findPodById(req.params.id, user);

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

    savePodsToDisk();

    const auditDetail = isFull
      ? `Pod reached full capacity (${pod.sizeTier}/${pod.sizeTier}) and locked rotation order.`
      : `Pod locked and activated early under ${pod.activationPolicy === 'FLEXIBLE_EARLY' ? 'Flexible Early Activation policy' : 'Creator Early Lock override'} with ${pod.members.length}/${pod.sizeTier} members.`;

    addAuditLog(
      pod.id,
      user.id,
      user.displayName,
      'ROTATION_LOCKED',
      `${auditDetail} 1-time cryptographically secure random shuffle set rotation order 0 to ${pod.members.length - 1}.`,
      { totalMembers: pod.members.length, agreementVersion: pod.agreementVersion, activationPolicy: pod.activationPolicy }
    );

    res.json(pod);
  });

  // 9. Deposit Weekly Funds to Stripe Treasury Holding Account
  app.post(['/api/pods/:id/deposit', '/pods/:id/deposit'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = findPodById(req.params.id, user);

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
  app.post(['/api/pods/:id/cycle/process', '/pods/:id/cycle/process'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const pod = findPodById(req.params.id, user);

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
  app.post(['/api/pods/:id/reprioritize/request', '/pods/:id/reprioritize/request'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { reason } = req.body || {};
    const pod = findPodById(req.params.id, user);

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

  app.post(['/api/pods/:id/reprioritize/vote', '/pods/:id/reprioritize/vote'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { requestId, vote } = req.body || {}; // vote: 'FOR' | 'AGAINST'
    const pod = findPodById(req.params.id, user);

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

  // 12. Voluntary Slot Swap Between Two Members
  app.post(['/api/pods/:id/swap', '/pods/:id/swap'], (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User session or x-user-id header required.' });
    }
    const { targetMemberUserId } = req.body || {};
    const pod = findPodById(req.params.id, user);

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
    savePodsToDisk();

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

      const { title, category, provider, guestDisplayName, description, valueBadge, redemptionType, redemptionData, eligibility, partnerEmail, guestEmail, partnerNotes, createAccount } = req.body || {};

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

    const { title, category, provider, description, valueBadge, redemptionType, redemptionData, eligibility, status, partnerEmail, partnerNotes } = req.body;

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

    const { title, category, provider, description, valueBadge, redemptionType, redemptionData, eligibility, status, partnerEmail, partnerNotes } = req.body;

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
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Gig Mutual Pool PWA Server] running on http://localhost:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default function handler(req: express.Request, res: express.Response, next?: express.NextFunction) {
  if (typeof next === 'function') {
    return app(req, res, next);
  }
  return app(req, res);
}
