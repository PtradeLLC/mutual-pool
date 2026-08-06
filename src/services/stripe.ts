import Stripe from 'stripe';
import { getDb, COLLECTIONS, timestampToISO } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20' as any,
  typescript: true,
});

export interface StripeConnectAccount {
  id: string;
  email: string;
  capabilities: {
    transfers: 'active' | 'inactive' | 'pending';
    treasury: 'active' | 'inactive' | 'pending';
  };
  requirements: {
    currently_due: string[];
    eventually_due: string[];
    past_due: string[];
  };
  settings: {
    payouts: {
      schedule: {
        interval: 'manual' | 'daily' | 'weekly' | 'monthly';
      };
    };
  };
}

export interface TreasuryFinancialAccount {
  id: string;
  account: string; // Connect account ID
  currency: string;
  status: 'open' | 'closed';
  features: {
    deposit: { status: 'active' | 'inactive' };
    withdraw: { status: 'active' | 'inactive' };
    outbound_transfer: { status: 'active' | 'inactive' };
    inbound_transfer: { status: 'active' | 'inactive' };
  };
}

export interface OutboundTransfer {
  id: string;
  financial_account: string;
  amount: number;
  currency: string;
  status: 'pending' | 'posted' | 'failed' | 'canceled';
  destination_payment_method: string;
  description: string;
  metadata: Record<string, string>;
}

export interface InboundTransfer {
  id: string;
  financial_account: string;
  amount: number;
  currency: string;
  status: 'pending' | 'posted' | 'failed' | 'canceled';
  origin_payment_method: string;
  description: string;
}

export interface FinancialConnectionsSession {
  id: string;
  client_secret: string;
  accounts: Array<{
    id: string;
    display_name: string;
    last4: string;
    institution_name: string;
  }>;
}

// Create Stripe Connect Custom Account for user
export async function createConnectAccount(userId: string, email: string, displayName: string): Promise<StripeConnectAccount> {
  const account = await stripe.accounts.create({
    type: 'custom',
    country: 'US',
    email,
    business_type: 'individual',
    capabilities: {
      transfers: { requested: true },
      treasury: { requested: true },
    },
    business_profile: {
      name: displayName,
      url: 'https://gigmutual.app',
    },
    settings: {
      payouts: {
        schedule: {
          interval: 'manual',
        },
      },
    },
    metadata: {
      userId,
      platform: 'gig-mutual-pool',
    },
  });

  // Create Account Link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.APP_URL}/dashboard?stripe_refresh=true`,
    return_url: `${process.env.APP_URL}/dashboard?stripe_success=true`,
    type: 'account_onboarding',
  });

  return {
    ...account,
    capabilities: account.capabilities as any,
    requirements: account.requirements as any,
    settings: account.settings as any,
  };
}

// Get Connect Account
export async function getConnectAccount(accountId: string): Promise<StripeConnectAccount> {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    ...account,
    capabilities: account.capabilities as any,
    requirements: account.requirements as any,
    settings: account.settings as any,
  };
}

// Update Connect Account
export async function updateConnectAccount(accountId: string, data: Partial<StripeConnectAccount>): Promise<StripeConnectAccount> {
  const account = await stripe.accounts.update(accountId, data as any);
  return {
    ...account,
    capabilities: account.capabilities as any,
    requirements: account.requirements as any,
    settings: account.settings as any,
  };
}

// Create Treasury Financial Account
export async function createTreasuryFinancialAccount(
  connectAccountId: string,
  userId: string,
  podId?: string
): Promise<TreasuryFinancialAccount> {
  const financialAccount = await stripe.treasury.financialAccounts.create({
    supported_currencies: ['usd'],
    features: {
      withdraw: { requested: true },
      outbound_transfer: { requested: true },
      inbound_transfer: { requested: true },
    } as any,
    account: connectAccountId,
    metadata: {
      userId,
      podId: podId || '',
      platform: 'gig-mutual-pool',
    },
  } as any);

  return financialAccount as any;
}

// Get Financial Account
export async function getFinancialAccount(financialAccountId: string): Promise<TreasuryFinancialAccount> {
  const account = await stripe.treasury.financialAccounts.retrieve(financialAccountId);
  return account as any;
}

// Create Outbound Transfer (Payout to member)
export async function createOutboundTransfer(
  financialAccountId: string,
  amount: number, // in cents
  destinationPaymentMethodId: string,
  description: string,
  metadata: Record<string, string>
): Promise<OutboundTransfer> {
  const transfer = await stripe.treasury.outboundTransfers.create({
    financial_account: financialAccountId,
    amount,
    currency: 'usd',
    destination_payment_method: destinationPaymentMethodId,
    description,
    metadata,
  });

  return transfer as any;
}

// Create Inbound Transfer (Deposit from member)
export async function createInboundTransfer(
  financialAccountId: string,
  amount: number, // in cents
  originPaymentMethodId: string,
  description: string,
  metadata: Record<string, string>
): Promise<InboundTransfer> {
  const transfer = await stripe.treasury.inboundTransfers.create({
    financial_account: financialAccountId,
    amount,
    currency: 'usd',
    origin_payment_method: originPaymentMethodId,
    description,
    metadata,
  });

  return transfer as any;
}

// Create Financial Connections Session for bank linking
export async function createFinancialConnectionsSession(
  connectAccountId: string,
  userId: string
): Promise<FinancialConnectionsSession> {
  const session = await stripe.financialConnections.sessions.create({
    account_holder: {
      type: 'account',
      account: connectAccountId,
    },
    permissions: ['balances', 'ownership', 'transactions'],
    prefetch: ['balances', 'ownership', 'transactions'],
  } as any);

  return {
    id: session.id,
    client_secret: session.client_secret!,
    accounts: [],
  };
}

// Get Financial Connections Accounts
export async function getFinancialConnectionsAccounts(sessionId: string): Promise<any[]> {
  const accounts = await stripe.financialConnections.accounts.list({
    session: sessionId,
  });
  return accounts.data;
}

// Create Payment Method from Financial Connections Account
export async function createPaymentMethodFromFinancialConnections(
  financialConnectionsAccountId: string,
  connectAccountId: string
): Promise<Stripe.PaymentMethod> {
  const paymentMethod = await stripe.paymentMethods.create({
    type: 'us_bank_account',
    us_bank_account: {
      financial_connections_account: financialConnectionsAccountId,
    },
    metadata: {
      connectAccountId,
    },
  });

  // Attach to Connect account
  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: connectAccountId, // For Connect, we attach to the account
  });

  return paymentMethod;
}

// Create Test Mode Payment Method (for development)
export async function createTestPaymentMethod(
  connectAccountId: string,
  bankName: string,
  last4: string
): Promise<Stripe.PaymentMethod> {
  const paymentMethod = await stripe.paymentMethods.create({
    type: 'us_bank_account',
    us_bank_account: {
      account_type: 'checking',
      routing_number: '110000000', // Test routing number
      account_number: '000123456789', // Test account number
    },
    billing_details: {
      name: bankName,
    },
    metadata: {
      connectAccountId,
      testMode: 'true',
    },
  });

  return paymentMethod;
}

// Get Financial Account Balance
export async function getFinancialAccountBalance(financialAccountId: string): Promise<{ available: number; pending: number }> {
  const balance = await (stripe.treasury.financialAccounts as any).retrieveBalance(financialAccountId);
  return {
    available: balance?.available?.[0]?.amount || 0,
    pending: balance?.pending?.[0]?.amount || 0,
  };
}

// Webhook Handlers
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  const db = getDb();
  
  switch (event.type as string) {
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      // Update user's Connect account status
      await db.collection(COLLECTIONS.USERS)
        .where('treasury.stripeAccountId', '==', account.id)
        .get()
        .then(snapshot => {
          const batch = db.batch();
          snapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
              'treasury.status': account.capabilities?.transfers === 'active' ? 'ACTIVE' : 'PENDING_REQUIREMENTS',
              updatedAt: Timestamp.now(),
            });
          });
          return batch.commit();
        });
      break;
    }
    
    case 'treasury.financial_account.features_status_updated': {
      const financialAccount = event.data.object as any;
      // Update financial account features status
      console.log('Financial account features updated:', financialAccount.id);
      break;
    }
    
    case 'treasury.outbound_transfer.posted': {
      const transfer = event.data.object as any;
      // Record successful payout
      console.log('Outbound transfer posted:', transfer.id);
      break;
    }
    
    case 'treasury.outbound_transfer.failed': {
      const transfer = event.data.object as any;
      // Handle failed payout
      console.error('Outbound transfer failed:', transfer.id, transfer.failure_details);
      break;
    }
    
    case 'treasury.inbound_transfer.posted': {
      const transfer = event.data.object as any;
      // Record successful deposit
      console.log('Inbound transfer posted:', transfer.id);
      break;
    }
    
    case 'treasury.inbound_transfer.failed': {
      const transfer = event.data.object as any;
      // Handle failed deposit
      console.error('Inbound transfer failed:', transfer.id, transfer.failure_details);
      break;
    }
    
    case 'identity.verification_session.verified': {
      const session = event.data.object as any;
      // KYC verification completed
      console.log('Identity verification completed:', session.id);
      break;
    }
    
    case 'identity.verification_session.requires_input': {
      const session = event.data.object as any;
      // KYC needs more info
      console.log('Identity verification requires input:', session.id);
      break;
    }
  }
}

// Create Identity Verification Session for KYC
export async function createIdentityVerificationSession(
  userId: string,
  email: string,
  displayName: string
): Promise<Stripe.Identity.VerificationSession> {
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: {
      userId,
      platform: 'gig-mutual-pool',
    },
    options: {
      document: {
        allowed_types: ['driving_license', 'passport', 'id_card'],
        require_matching_selfie: true,
        require_id_number: true,
      },
    },
    client_reference_id: userId,
  });

  return session;
}

// Get Verification Session
export async function getVerificationSession(sessionId: string): Promise<Stripe.Identity.VerificationSession> {
  return stripe.identity.verificationSessions.retrieve(sessionId);
}

// Create Test Clock for testing (optional)
export async function createTestClock(frozenTime?: number): Promise<Stripe.TestHelpers.TestClock> {
  return stripe.testHelpers.testClocks.create({
    frozen_time: frozenTime || Math.floor(Date.now() / 1000),
  });
}

// Advance Test Clock
export async function advanceTestClock(testClockId: string, frozenTime: number): Promise<Stripe.TestHelpers.TestClock> {
  return stripe.testHelpers.testClocks.advance(testClockId, {
    frozen_time: frozenTime,
  });
}

export { stripe };