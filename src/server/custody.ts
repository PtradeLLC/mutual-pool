// Custody: where member money actually sits.
//
// The server keeps an operational ledger in memory (user.treasury.balanceUsd,
// pod pots, platform buffers). This module records every money movement and,
// when CUSTODY_PROVIDER=column, executes it at Column (column.com), a chartered
// bank with an API:
//
//   member account  <-- a real bank account in the member's name (FDIC insured)
//   pod account     <-- one Column account per pod, owned by the platform entity
//   platform        <-- operating (float), escrow (bridges), revenue (fees)
//
// Weekly deposits, payouts, fees, bridges and cover shares are book transfers
// between Column accounts: instant, no ACH timing, no return risk. Money enters
// and leaves Column by ACH (member's external bank <-> member account), tracked
// until Column reports settlement or a return.
//
// In ledger mode (default) movements are recorded only, so nothing changes for
// a running deployment until the switch is flipped.
import crypto from "crypto";
import type {
  CustodyAccountRef,
  CustodyMovement,
  CustodyPurpose,
  CustodySettings,
  MemberCustody,
  Pod,
  PodCustody,
  User,
} from "../types";
import * as column from "../services/column";

export type CustodyMode = "ledger" | "column";

export function custodyMode(): CustodyMode {
  return process.env.CUSTODY_PROVIDER === "column" &&
    column.columnMode() !== "off"
    ? "column"
    : "ledger";
}

export interface CustodyDeps {
  getUsers: () => User[];
  getPods: () => Pod[];
  getMovements: () => CustodyMovement[];
  setMovements: (docs: CustodyMovement[]) => void;
  getSettings: () => CustodySettings | null;
  setSettings: (doc: CustodySettings) => void;
  // Called after state changes so the server can persist.
  onChange: () => void;
  audit: (
    podId: string,
    action:
      | "CUSTODY_ACCOUNT_OPENED"
      | "CUSTODY_MOVEMENT_FAILED"
      | "CUSTODY_ACH_SETTLED"
      | "CUSTODY_ACH_RETURNED",
    detail: string,
    metadata?: Record<string, unknown>,
  ) => void;
  incident: (
    severity: "error" | "critical",
    kind: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) => void;
  // Ledger hooks for ACH outcomes (the server owns the ledger functions).
  creditLedger: (user: User, amountUsd: number) => void;
  debitLedger: (user: User, amountUsd: number) => boolean;
  notify: (
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) => void;
  onWithdrawalSettled?: (withdrawalId: string) => void;
  onWithdrawalReturned?: (withdrawalId: string, reason: string) => void;
}

let deps: CustodyDeps | null = null;
export function initCustody(d: CustodyDeps): void {
  deps = d;
}
function D(): CustodyDeps {
  if (!deps) throw new Error("custody not initialised");
  return deps;
}

const MAX_ATTEMPTS = 12;
const roundCents = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const newId = (prefix: string) =>
  `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

// ---------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------
export function recordMovement(input: {
  from: CustodyAccountRef;
  to: CustodyAccountRef;
  amountUsd: number;
  purpose: CustodyPurpose;
  description: string;
  refs?: CustodyMovement["refs"];
  // Already executed elsewhere (e.g. an ACH transfer created by this module).
  columnTransferId?: string;
  columnTransferKind?: "book" | "ach";
  status?: CustodyMovement["status"];
}): CustodyMovement | null {
  const amount = roundCents(input.amountUsd);
  if (amount <= 0) return null;
  const mode = custodyMode();
  const nowIso = new Date().toISOString();
  const external =
    input.from.kind === "external" || input.to.kind === "external";
  // Book transfers happen only between Column accounts. Movements with an
  // external leg are either tracked ACH transfers (status supplied) or pure
  // bookkeeping (money moved outside Column, e.g. a Stripe card payment).
  const needsBook = mode === "column" && !external && !input.columnTransferId;
  const m: CustodyMovement = {
    id: newId("mv"),
    from: input.from,
    to: input.to,
    amountUsd: amount,
    purpose: input.purpose,
    description: input.description.slice(0, 120),
    refs: input.refs || {},
    provider:
      mode === "column" && (!external || input.columnTransferId)
        ? "column"
        : "ledger",
    status:
      input.status ||
      (needsBook ? "PENDING" : input.columnTransferId ? "PENDING" : "SETTLED"),
    columnTransferId: input.columnTransferId,
    columnTransferKind: input.columnTransferKind,
    attempts: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    settledAt: undefined,
  };
  if (m.status === "SETTLED") m.settledAt = nowIso;
  const list = D().getMovements();
  list.unshift(m);
  D().onChange();
  return m;
}

export function pendingMovements(): CustodyMovement[] {
  return D()
    .getMovements()
    .filter((m) => m.status === "PENDING");
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
function sandboxOnly(): boolean {
  return column.columnMode() === "sandbox";
}

// Platform accounts: configured by env in production, created on demand in
// the sandbox so a fresh test key works without manual setup.
export async function ensurePlatformAccounts(): Promise<CustodySettings> {
  const existing = D().getSettings();
  if (
    existing &&
    existing.entityId &&
    existing.operatingAccountId &&
    existing.escrowAccountId &&
    existing.revenueAccountId
  )
    return existing;
  const env = process.env;
  const nowIso = new Date().toISOString();
  if (
    env.COLUMN_PLATFORM_ENTITY_ID &&
    env.COLUMN_OPERATING_ACCOUNT_ID &&
    env.COLUMN_ESCROW_ACCOUNT_ID &&
    env.COLUMN_REVENUE_ACCOUNT_ID
  ) {
    const operating = await column.getBankAccount(
      env.COLUMN_OPERATING_ACCOUNT_ID,
    );
    const settings: CustodySettings = {
      id: "platform",
      entityId: env.COLUMN_PLATFORM_ENTITY_ID,
      operatingAccountId: env.COLUMN_OPERATING_ACCOUNT_ID,
      operatingAccountNumberId: operating.default_account_number_id,
      escrowAccountId: env.COLUMN_ESCROW_ACCOUNT_ID,
      revenueAccountId: env.COLUMN_REVENUE_ACCOUNT_ID,
      processedEventIds: existing?.processedEventIds || [],
      updatedAt: nowIso,
    };
    D().setSettings(settings);
    D().onChange();
    return settings;
  }
  if (!sandboxOnly()) {
    throw new Error(
      "Column platform accounts are not configured: set COLUMN_PLATFORM_ENTITY_ID, COLUMN_OPERATING_ACCOUNT_ID, COLUMN_ESCROW_ACCOUNT_ID and COLUMN_REVENUE_ACCOUNT_ID.",
    );
  }
  // Sandbox bootstrap.
  const entity = await column.createBusinessEntity(
    {
      businessName:
        env.COLUMN_PLATFORM_BUSINESS_NAME || "MutualPool Sandbox LLC",
      website: "https://themutualpool.com",
      address: {
        line1: "1 Sandbox Way",
        city: "Wilmington",
        state: "DE",
        postalCode: "19801",
      },
      description: "MutualPool rotating savings platform (sandbox)",
    },
    "platform_entity_sandbox",
  );
  const mk = (description: string, key: string) =>
    column.createBankAccount(
      { entityId: entity.id, description, displayName: description },
      key,
    );
  const operating = await mk(
    "MutualPool Operating",
    "platform_operating_sandbox",
  );
  const escrow = await mk(
    "MutualPool System Deposits Escrow",
    "platform_escrow_sandbox",
  );
  const revenue = await mk("MutualPool Revenue", "platform_revenue_sandbox");
  const settings: CustodySettings = {
    id: "platform",
    entityId: entity.id,
    operatingAccountId: operating.id,
    operatingAccountNumberId: operating.default_account_number_id,
    escrowAccountId: escrow.id,
    revenueAccountId: revenue.id,
    processedEventIds: existing?.processedEventIds || [],
    updatedAt: nowIso,
  };
  D().setSettings(settings);
  D().onChange();
  return settings;
}

export interface MemberIdentityInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
  phone?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
}
// Open the member's Column entity and bank account. Identity data is sent to
// Column and never stored here; only Column ids are kept on the user.
export async function provisionMemberAccount(
  user: User,
  identity: MemberIdentityInput,
): Promise<MemberCustody> {
  if (user.custody?.bankAccountId) return user.custody;
  const entity = await column.createPersonEntity(
    {
      firstName: identity.firstName,
      lastName: identity.lastName,
      dateOfBirth: identity.dateOfBirth,
      ssn: identity.ssn,
      email: user.email || undefined,
      phone: identity.phone,
      address: identity.address,
    },
    `member_entity_${user.id}`,
  );
  const account = await column.createBankAccount(
    {
      entityId: entity.id,
      description: `MutualPool member ${user.id}`,
      displayName: "MutualPool savings",
    },
    `member_account_${user.id}`,
  );
  const nowIso = new Date().toISOString();
  user.custody = {
    provider: "column",
    entityId: entity.id,
    bankAccountId: account.id,
    accountNumberId: account.default_account_number_id,
    accountNumberLast4: String(account.default_account_number || "").slice(-4),
    routingNumber: account.routing_number,
    status: entityStatusToCustody(entity.verification_status),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  D().audit(
    "",
    "CUSTODY_ACCOUNT_OPENED",
    `Opened a Column bank account for ${user.displayName} (••••${user.custody.accountNumberLast4}); identity ${entity.verification_status}.`,
    { userId: user.id, entityId: entity.id, bankAccountId: account.id },
  );
  D().onChange();
  return user.custody;
}
function entityStatusToCustody(
  status: string | undefined,
): MemberCustody["status"] {
  switch ((status || "").toLowerCase()) {
    case "verified":
      return "VERIFIED";
    case "manual_review":
      return "MANUAL_REVIEW";
    case "denied":
      return "DENIED";
    default:
      return "PENDING";
  }
}

export async function ensurePodAccount(pod: Pod): Promise<PodCustody> {
  if (pod.custody?.bankAccountId) return pod.custody;
  const settings = await ensurePlatformAccounts();
  const account = await column.createBankAccount(
    {
      entityId: settings.entityId,
      description: `Pod ${pod.id}`,
      displayName: `Pod: ${pod.name}`.slice(0, 120),
    },
    `pod_account_${pod.id}`,
  );
  pod.custody = {
    provider: "column",
    bankAccountId: account.id,
    accountNumberId: account.default_account_number_id,
    createdAt: new Date().toISOString(),
  };
  D().onChange();
  return pod.custody;
}

// Link the member's external bank for ACH funding and withdrawals.
export async function linkExternalBank(
  user: User,
  input: {
    accountNumber: string;
    routingNumber: string;
    accountType?: "checking" | "savings";
    name?: string;
  },
): Promise<MemberCustody> {
  if (!user.custody?.bankAccountId)
    throw new Error("Open the member account first.");
  const cp = await column.createCounterparty(
    {
      accountNumber: input.accountNumber,
      routingNumber: input.routingNumber,
      accountType: input.accountType,
      name: input.name || user.displayName,
      description: `External bank for ${user.id}`,
    },
    `member_cp_${user.id}_${input.routingNumber.slice(-4)}_${input.accountNumber.slice(-4)}`,
  );
  user.custody.counterpartyId = cp.id;
  user.custody.counterpartyLast4 = String(
    cp.account_number || input.accountNumber,
  ).slice(-4);
  user.custody.counterpartyName = input.name || user.displayName;
  try {
    const fi = await column.getFinancialInstitution(input.routingNumber);
    user.custody.realtimeEligible = Boolean(fi.realtime_eligible);
    user.custody.counterpartyBankName =
      fi.short_name || fi.full_name || undefined;
  } catch {
    user.custody.realtimeEligible = false;
  }
  user.custody.updatedAt = new Date().toISOString();
  D().onChange();
  return user.custody;
}

// Resolve a movement leg to a Column bank account id (creating pod accounts on demand).
async function resolveAccount(
  ref: CustodyAccountRef,
): Promise<{ id: string } | { missing: string }> {
  if (ref.kind === "external") return { missing: "EXTERNAL" };
  if (ref.kind === "platform") {
    const s = await ensurePlatformAccounts();
    return {
      id:
        ref.account === "operating"
          ? s.operatingAccountId
          : ref.account === "escrow"
            ? s.escrowAccountId
            : s.revenueAccountId,
    };
  }
  if (ref.kind === "pod") {
    const pod = D()
      .getPods()
      .find((p) => p && p.id === ref.podId);
    if (!pod) return { missing: "POD_NOT_FOUND" };
    return { id: (await ensurePodAccount(pod)).bankAccountId };
  }
  const user = D()
    .getUsers()
    .find((u) => u && u.id === ref.userId);
  if (!user) return { missing: "MEMBER_NOT_FOUND" };
  if (!user.custody?.bankAccountId)
    return { missing: "MEMBER_ACCOUNT_MISSING" };
  if (user.custody.status === "DENIED" || user.custody.status === "FROZEN")
    return { missing: `MEMBER_ACCOUNT_${user.custody.status}` };
  return { id: user.custody.bankAccountId };
}

// Execute pending book transfers. Runs from the scheduler every minute and
// from the admin/cron endpoint. Idempotent: the movement id is the Column
// idempotency key, so a retry after a timeout never double-moves money.
export async function settlePendingMovements(
  limit = 50,
): Promise<{ settled: number; failed: number; waiting: number }> {
  let settled = 0;
  let failed = 0;
  let waiting = 0;
  if (custodyMode() !== "column") return { settled, failed, waiting };
  const pending = D()
    .getMovements()
    .filter(
      (m) =>
        m.status === "PENDING" &&
        m.provider === "column" &&
        !m.columnTransferId,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
  for (const m of pending) {
    try {
      const from = await resolveAccount(m.from);
      const to = await resolveAccount(m.to);
      if ("missing" in from || "missing" in to) {
        m.lastError =
          `${"missing" in from ? from.missing : ""}${"missing" in to ? " " + to.missing : ""}`.trim();
        m.updatedAt = new Date().toISOString();
        waiting += 1;
        continue;
      }
      const transfer = await column.createBookTransfer({
        senderBankAccountId: from.id,
        receiverBankAccountId: to.id,
        amountCents: column.toCents(m.amountUsd),
        description: `${m.purpose}: ${m.description}`,
        idempotencyKey: m.id,
        allowOverdraft:
          m.from.kind === "platform" && m.from.account === "operating",
      });
      m.columnTransferId = transfer.id;
      m.columnTransferKind = "book";
      m.attempts += 1;
      m.updatedAt = new Date().toISOString();
      if (transfer.status === "COMPLETED") {
        m.status = "SETTLED";
        m.settledAt = m.updatedAt;
        settled += 1;
      } else if (
        transfer.status === "REJECTED" ||
        transfer.status === "CANCELED"
      ) {
        m.status = "FAILED";
        m.lastError = `Column ${transfer.status}`;
        failed += 1;
        D().audit(
          m.refs.podId || "",
          "CUSTODY_MOVEMENT_FAILED",
          `Book transfer ${m.purpose} $${m.amountUsd.toFixed(2)} was ${transfer.status} by Column.`,
          { movementId: m.id, transferId: transfer.id },
        );
        D().incident(
          "error",
          "custody_movement_failed",
          `Column rejected ${m.purpose} $${m.amountUsd.toFixed(2)} (${m.description})`,
          { movementId: m.id, transferId: transfer.id },
        );
      } else {
        // HOLD: left pending; the webhook or a later pass resolves it.
        waiting += 1;
      }
    } catch (err) {
      const e = err as column.ColumnError;
      m.attempts += 1;
      m.lastError = String(e?.message || err).slice(0, 300);
      m.updatedAt = new Date().toISOString();
      const definite =
        e instanceof column.ColumnError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408 &&
        e.status !== 429;
      if (definite || m.attempts >= MAX_ATTEMPTS) {
        m.status = "FAILED";
        failed += 1;
        D().audit(
          m.refs.podId || "",
          "CUSTODY_MOVEMENT_FAILED",
          `Book transfer ${m.purpose} $${m.amountUsd.toFixed(2)} failed: ${m.lastError}`,
          { movementId: m.id },
        );
        D().incident(
          "error",
          "custody_movement_failed",
          `Column book transfer failed for ${m.purpose} $${m.amountUsd.toFixed(2)}: ${m.lastError}`,
          { movementId: m.id },
        );
      } else {
        waiting += 1;
      }
    }
  }
  if (pending.length) D().onChange();
  return { settled, failed, waiting };
}

// ---------------------------------------------------------------------------
// ACH: money in and out of Column
// ---------------------------------------------------------------------------
// Pull money from the member's external bank into their Column account. The
// ledger is credited when Column reports the debit settled (webhook).
export async function fundFromBank(
  user: User,
  amountUsd: number,
): Promise<CustodyMovement> {
  const c = user.custody;
  if (!c?.bankAccountId) throw new Error("MEMBER_ACCOUNT_MISSING");
  if (!c.counterpartyId) throw new Error("EXTERNAL_BANK_MISSING");
  if (c.status !== "VERIFIED") throw new Error(`MEMBER_ACCOUNT_${c.status}`);
  const id = newId("mv");
  const transfer = await column.createAchTransfer({
    bankAccountId: c.bankAccountId,
    counterpartyId: c.counterpartyId,
    type: "DEBIT",
    amountCents: column.toCents(amountUsd),
    description: `MutualPool deposit funding ${user.id}`,
    idempotencyKey: id,
    entryClassCode: "WEB",
    receiverName: user.displayName,
  });
  const nowIso = new Date().toISOString();
  const m: CustodyMovement = {
    id,
    from: { kind: "external", label: `bank ••••${c.counterpartyLast4 || ""}` },
    to: { kind: "member", userId: user.id },
    amountUsd: roundCents(amountUsd),
    purpose: "TOPUP",
    description: "ACH funding from linked bank",
    refs: { userId: user.id },
    provider: "column",
    status: "PENDING",
    columnTransferId: transfer.id,
    columnTransferKind: "ach",
    attempts: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  D().getMovements().unshift(m);
  D().onChange();
  return m;
}

// Push money from the member's Column account to their external bank. The
// ledger was already debited by the caller; a return credits it back.
export async function withdrawToBank(
  user: User,
  amountUsd: number,
  withdrawalId: string,
): Promise<CustodyMovement> {
  const c = user.custody;
  if (!c?.bankAccountId) throw new Error("MEMBER_ACCOUNT_MISSING");
  if (!c.counterpartyId) throw new Error("EXTERNAL_BANK_MISSING");
  const nowIso = new Date().toISOString();
  // Instant when the member's bank is on RTP or FedNow; otherwise ACH.
  if (c.realtimeEligible && process.env.CUSTODY_REALTIME !== "false") {
    try {
      const rt = await column.createRealtimeTransfer({
        bankAccountId: c.bankAccountId,
        counterpartyId: c.counterpartyId,
        amountCents: column.toCents(amountUsd),
        description: `MutualPool withdrawal ${withdrawalId}`,
        idempotencyKey: `rt_${withdrawalId}`,
      });
      const done = rt.status === "completed";
      const m: CustodyMovement = {
        id: newId("mv"),
        from: { kind: "member", userId: user.id },
        to: {
          kind: "external",
          label: `bank ••••${c.counterpartyLast4 || ""} (instant)`,
        },
        amountUsd: roundCents(amountUsd),
        purpose: "WITHDRAWAL",
        description: "Instant withdrawal to linked bank",
        refs: { userId: user.id, withdrawalId },
        provider: "column",
        status: done ? "SETTLED" : "PENDING",
        columnTransferId: rt.id,
        columnTransferKind: "realtime",
        attempts: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
        settledAt: done ? nowIso : undefined,
      };
      D().getMovements().unshift(m);
      if (done) D().onWithdrawalSettled?.(withdrawalId);
      D().onChange();
      return m;
    } catch (err) {
      const e = err as column.ColumnError;
      // A definite rejection of the realtime leg falls back to ACH; outages do not retry (idempotent keys).
      if (
        !(e instanceof column.ColumnError && e.status >= 400 && e.status < 500)
      )
        throw err;
    }
  }
  const transfer = await column.createAchTransfer({
    bankAccountId: c.bankAccountId,
    counterpartyId: c.counterpartyId,
    type: "CREDIT",
    amountCents: column.toCents(amountUsd),
    description: `MutualPool withdrawal ${withdrawalId}`,
    idempotencyKey: withdrawalId,
    entryClassCode: "PPD",
    receiverName: user.displayName,
  });
  const m: CustodyMovement = {
    id: newId("mv"),
    from: { kind: "member", userId: user.id },
    to: { kind: "external", label: `bank ••••${c.counterpartyLast4 || ""}` },
    amountUsd: roundCents(amountUsd),
    purpose: "WITHDRAWAL",
    description: "ACH withdrawal to linked bank",
    refs: { userId: user.id, withdrawalId },
    provider: "column",
    status: "PENDING",
    columnTransferId: transfer.id,
    columnTransferKind: "ach",
    attempts: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  D().getMovements().unshift(m);
  D().onChange();
  return m;
}

export async function memberBalanceAtColumn(user: User): Promise<{
  availableUsd: number;
  pendingUsd: number;
  ledgerUsd: number;
} | null> {
  if (!user.custody?.bankAccountId) return null;
  const acct = await column.getBankAccount(user.custody.bankAccountId);
  return {
    availableUsd: column.fromCents(acct.balances?.available_amount || 0),
    pendingUsd: column.fromCents(acct.balances?.pending_amount || 0),
    ledgerUsd: roundCents(Number(user.treasury?.balanceUsd) || 0),
  };
}

// ---------------------------------------------------------------------------
// Webhook events
// ---------------------------------------------------------------------------
export function rememberEvent(eventId: string): boolean {
  const s = D().getSettings();
  if (!s) return true;
  const seen = s.processedEventIds || [];
  if (seen.includes(eventId)) return false;
  s.processedEventIds = [eventId, ...seen].slice(0, 500);
  s.updatedAt = new Date().toISOString();
  D().onChange();
  return true;
}

export async function handleColumnEvent(
  event: column.ColumnEvent,
): Promise<string> {
  const type = String(event.type || "");
  const data = event.data || {};
  const d = D();
  const nowIso = new Date().toISOString();
  if (type.startsWith("identity.")) {
    const entityId = String(data.id || "");
    const user = d
      .getUsers()
      .find((u) => u && u.custody?.entityId === entityId);
    if (!user || !user.custody) return "identity: no member";
    const before = user.custody.status;
    user.custody.status = entityStatusToCustody(data.verification_status);
    user.custody.updatedAt = nowIso;
    if (before !== user.custody.status) {
      if (user.custody.status === "VERIFIED")
        d.notify(
          user.id,
          "🏦 Your MutualPool bank account is ready",
          `Your account ending ${user.custody.accountNumberLast4} is open. You can now fund it from your linked bank or set it as a direct-deposit destination.`,
        );
      if (user.custody.status === "DENIED")
        d.notify(
          user.id,
          "Bank account could not be opened",
          "The bank could not verify your identity for a MutualPool account. Please contact support.",
        );
      d.onChange();
    }
    return `identity: ${user.custody.status}`;
  }
  if (type.startsWith("ach.")) {
    const transferId = String(data.id || "");
    const m = d.getMovements().find((x) => x.columnTransferId === transferId);
    if (!m) {
      // Money arriving at a member account from outside (direct deposit), or
      // at the platform operating account (Stripe payouts replenishing the float).
      if (
        type.startsWith("ach.incoming_transfer.") &&
        (type.endsWith(".settled") || type.endsWith(".completed")) &&
        data.is_incoming &&
        data.type === "CREDIT"
      ) {
        const accountId = String(data.bank_account_id || "");
        const settings = d.getSettings();
        if (
          settings &&
          accountId === settings.operatingAccountId &&
          !d.getMovements().some((x) => x.columnTransferId === transferId)
        ) {
          const amount = column.fromCents(data.amount || 0);
          const rec: CustodyMovement = {
            id: newId("mv"),
            from: {
              kind: "external",
              label: String(
                data.company_name || data.description || "incoming ACH",
              ).slice(0, 40),
            },
            to: { kind: "platform", account: "operating" },
            amountUsd: amount,
            purpose: "ADJUSTMENT",
            description: `Incoming credit to operating: ${String(data.description || "").slice(0, 80)}`,
            refs: {},
            provider: "column",
            status: "SETTLED",
            columnTransferId: transferId,
            columnTransferKind: "ach",
            attempts: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
            settledAt: nowIso,
          };
          d.getMovements().unshift(rec);
          d.onChange();
          return "incoming credit to operating recorded";
        }
        const user = d
          .getUsers()
          .find((u) => u && u.custody?.bankAccountId === accountId);
        if (
          user &&
          !d.getMovements().some((x) => x.columnTransferId === transferId)
        ) {
          const amount = column.fromCents(data.amount || 0);
          d.creditLedger(user, amount);
          const rec: CustodyMovement = {
            id: newId("mv"),
            from: { kind: "external", label: "incoming ACH" },
            to: { kind: "member", userId: user.id },
            amountUsd: amount,
            purpose: "TOPUP",
            description: String(
              data.description || "Incoming ACH credit",
            ).slice(0, 120),
            refs: { userId: user.id },
            provider: "column",
            status: "SETTLED",
            columnTransferId: transferId,
            columnTransferKind: "ach",
            attempts: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
            settledAt: nowIso,
          };
          d.getMovements().unshift(rec);
          d.notify(
            user.id,
            "💵 Deposit received",
            `$${amount.toFixed(2)} arrived in your MutualPool account.`,
            { transferId },
          );
          d.onChange();
          return "incoming credit applied";
        }
      }
      return "ach: no movement";
    }
    const user = d.getUsers().find((u) => u && u.id === m.refs.userId);
    if (type.endsWith(".settled") || type.endsWith(".completed")) {
      if (m.status === "PENDING") {
        m.status = "SETTLED";
        m.settledAt = nowIso;
        m.updatedAt = nowIso;
        if (m.purpose === "TOPUP" && user) {
          d.creditLedger(user, m.amountUsd);
          d.notify(
            user.id,
            "💵 Funding complete",
            `$${m.amountUsd.toFixed(2)} from your bank is now in your MutualPool balance.`,
            { movementId: m.id },
          );
        }
        if (m.purpose === "WITHDRAWAL" && m.refs.withdrawalId)
          d.onWithdrawalSettled?.(m.refs.withdrawalId);
        d.audit(
          m.refs.podId || "",
          "CUSTODY_ACH_SETTLED",
          `${m.purpose} $${m.amountUsd.toFixed(2)} settled at Column (${transferId}).`,
          { movementId: m.id, transferId },
        );
        d.onChange();
      }
      return `ach: ${m.purpose} settled`;
    }
    if (
      type.endsWith(".returned") ||
      type.endsWith(".nsf") ||
      type.endsWith(".canceled")
    ) {
      if (m.status !== "RETURNED" && m.status !== "FAILED") {
        const reason =
          (Array.isArray(data.return_details) &&
            data.return_details[0] &&
            `${data.return_details[0].return_code || ""} ${data.return_details[0].description || ""}`.trim()) ||
          type.split(".").pop() ||
          "returned";
        const wasSettled = m.status === "SETTLED";
        m.status = "RETURNED";
        m.lastError = reason;
        m.updatedAt = nowIso;
        if (m.purpose === "TOPUP" && user && wasSettled) {
          // The funding was credited and then reversed by the member's bank.
          d.debitLedger(user, m.amountUsd);
          d.notify(
            user.id,
            "⚠️ Bank funding returned",
            `Your bank returned the $${m.amountUsd.toFixed(2)} transfer (${reason}). It has been removed from your balance.`,
            { movementId: m.id },
          );
        } else if (m.purpose === "TOPUP" && user) {
          d.notify(
            user.id,
            "⚠️ Bank funding failed",
            `Your bank did not complete the $${m.amountUsd.toFixed(2)} transfer (${reason}).`,
            { movementId: m.id },
          );
        }
        if (m.purpose === "WITHDRAWAL" && user) {
          d.creditLedger(user, m.amountUsd);
          d.notify(
            user.id,
            "⚠️ Withdrawal returned",
            `The $${m.amountUsd.toFixed(2)} withdrawal was returned by the receiving bank (${reason}). It is back in your balance.`,
            { movementId: m.id },
          );
          if (m.refs.withdrawalId)
            d.onWithdrawalReturned?.(m.refs.withdrawalId, reason);
        }
        d.audit(
          m.refs.podId || "",
          "CUSTODY_ACH_RETURNED",
          `${m.purpose} $${m.amountUsd.toFixed(2)} returned by the bank: ${reason}.`,
          { movementId: m.id, transferId },
        );
        d.incident(
          "error",
          "custody_ach_returned",
          `ACH ${m.purpose} $${m.amountUsd.toFixed(2)} returned: ${reason}`,
          { movementId: m.id },
        );
        d.onChange();
      }
      return `ach: ${m.purpose} returned`;
    }
    return `ach: ${type} ignored`;
  }
  if (type.startsWith("realtime.")) {
    const transferId = String(data.id || "");
    const m = d.getMovements().find((x) => x.columnTransferId === transferId);
    if (!m) return "realtime: no movement";
    const user = d.getUsers().find((u) => u && u.id === m.refs.userId);
    if (
      (type.endsWith(".completed") || type.endsWith(".accepted")) &&
      m.status === "PENDING"
    ) {
      m.status = "SETTLED";
      m.settledAt = nowIso;
      m.updatedAt = nowIso;
      if (m.purpose === "WITHDRAWAL" && m.refs.withdrawalId)
        d.onWithdrawalSettled?.(m.refs.withdrawalId);
      d.onChange();
      return "realtime: settled";
    }
    if (
      (type.endsWith(".rejected") ||
        type.endsWith(".blocked") ||
        type.endsWith(".returned") ||
        type.endsWith(".canceled")) &&
      m.status !== "RETURNED" &&
      m.status !== "FAILED"
    ) {
      const reason =
        `${data.rejection_code || ""} ${data.rejection_code_description || type.split(".").pop() || ""}`.trim();
      const wasSettled = m.status === "SETTLED";
      m.status = wasSettled ? "RETURNED" : "FAILED";
      m.lastError = reason;
      m.updatedAt = nowIso;
      if (m.purpose === "WITHDRAWAL" && user) {
        d.creditLedger(user, m.amountUsd);
        d.notify(
          user.id,
          "⚠️ Instant withdrawal did not go through",
          `The $${m.amountUsd.toFixed(2)} transfer was ${wasSettled ? "returned" : "rejected"} (${reason}). It is back in your balance.`,
          { movementId: m.id },
        );
        if (m.refs.withdrawalId)
          d.onWithdrawalReturned?.(m.refs.withdrawalId, reason);
      }
      d.audit(
        m.refs.podId || "",
        "CUSTODY_ACH_RETURNED",
        `Realtime ${m.purpose} $${m.amountUsd.toFixed(2)} ${wasSettled ? "returned" : "rejected"}: ${reason}.`,
        { movementId: m.id, transferId },
      );
      d.onChange();
      return "realtime: returned";
    }
    return `realtime: ${type} ignored`;
  }
  if (type.startsWith("book.transfer.")) {
    const transferId = String(data.id || "");
    const m = d
      .getMovements()
      .find(
        (x) =>
          x.columnTransferId === transferId || x.id === data.idempotency_key,
      );
    if (m && m.status === "PENDING" && type.endsWith(".completed")) {
      m.columnTransferId = transferId;
      m.status = "SETTLED";
      m.settledAt = nowIso;
      m.updatedAt = nowIso;
      d.onChange();
      return "book: settled";
    }
    if (m && m.status === "PENDING" && type.endsWith(".canceled")) {
      m.status = "FAILED";
      m.lastError = "canceled";
      m.updatedAt = nowIso;
      d.onChange();
      return "book: canceled";
    }
    return "book: ignored";
  }
  return `ignored: ${type}`;
}

// ---------------------------------------------------------------------------
// Status for /api/health and Admin Ops
// ---------------------------------------------------------------------------
export function custodyStatus(): Record<string, unknown> {
  const movements = deps ? D().getMovements() : [];
  const pending = movements.filter((m) => m.status === "PENDING");
  const failed = movements.filter(
    (m) => m.status === "FAILED" || m.status === "RETURNED",
  );
  const settings = deps ? D().getSettings() : null;
  return {
    mode: custodyMode(),
    column: column.columnMode(),
    platformConfigured: Boolean(settings?.operatingAccountId),
    pendingMovements: pending.length,
    oldestPendingAt: pending.length
      ? pending.reduce(
          (a, m) => (m.createdAt < a ? m.createdAt : a),
          pending[0].createdAt,
        )
      : null,
    failedMovements: failed.length,
    recentMovements: movements.slice(0, 8).map((m) => ({
      id: m.id,
      purpose: m.purpose,
      amountUsd: m.amountUsd,
      status: m.status,
      from: m.from,
      to: m.to,
      createdAt: m.createdAt,
    })),
  };
}
