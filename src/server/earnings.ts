// Decides whether money arriving in a member's MutualPool account is earnings.
//
// Premium perks unlock for members whose gig-platform payouts or paychecks are
// deposited into MutualPool. Every incoming ACH credit still adds to the
// member's balance; only credits from a recognised gig platform or a payroll
// deposit count as earnings. A member moving their own money in (an online
// transfer from their bank, Zelle, Venmo, Cash App...) does not.
//
// Banks describe an ACH credit with the originator's company name (up to 16
// characters, e.g. "UBER USA 6787") and a short entry description (up to 10,
// e.g. "PAYROLL", "DIR DEP"). Both are free text, so matching is by pattern.

export type IncomingCreditKind = 'GIG_PLATFORM' | 'PAYROLL' | 'TRANSFER' | 'OTHER';

export interface IncomingCreditInput {
  companyName?: string | null;
  companyEntryDescription?: string | null;
  description?: string | null;
}

export interface IncomingCreditClassification {
  kind: IncomingCreditKind;
  isEarnings: boolean;
  // Display name of the gig platform, when one was recognised.
  platform?: string;
  // What the bank said about the sender, for the member's history.
  source?: string;
}

// Order matters: more specific names first (Uber Eats before Uber).
const GIG_PLATFORMS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Uber Eats', pattern: /\bUBER\s*EATS\b/ },
  { name: 'Uber', pattern: /\bUBER\b/ },
  { name: 'Lyft', pattern: /\bLYFT\b/ },
  { name: 'DoorDash', pattern: /\bDOOR\s*DASH\b/ },
  { name: 'Instacart', pattern: /\bINSTACART\b|\bMAPLEBEAR\b/ },
  { name: 'Amazon Flex', pattern: /\bA(MAZON|MZN)\b.*\bFLEX\b/ },
  { name: 'Grubhub', pattern: /\bGRUB\s*HUB\b/ },
  { name: 'Spark', pattern: /\bSPARK\s*DRIVER\b/ },
  { name: 'Shipt', pattern: /\bSHIPT\b/ },
  { name: 'Gopuff', pattern: /\bGO\s*PUFF\b/ },
  { name: 'Postmates', pattern: /\bPOSTMATES\b/ },
  { name: 'Roadie', pattern: /\bROADIE\b/ },
  { name: 'Veho', pattern: /\bVEHO\b/ },
  { name: 'TaskRabbit', pattern: /\bTASK\s*RABBIT\b/ },
];

// Money the member moved themselves, or that isn't pay at all.
const NOT_EARNINGS =
  /\bTRANSFER\b|\bXFER\b|\bTRNSFR\b|\bP2P\b|\bVENMO\b|\bZELLE\b|\bCASH\s*APP\b|\bSQUARE\s*CASH\b|\bPAYPAL\b|\bAPPLE\s*CASH\b|\bMUTUAL\s*POOL\b|\bACCT\s*VERIFY\b|\bVERIFY\b|\bREFUND\b|\bREVERSAL\b|\bRETURN\b/;

// Payroll processors that pay on behalf of employers.
const PAYROLL_PROCESSORS =
  /\bADP\b|\bPAYCHEX\b|\bGUSTO\b|\bPAYCOM\b|\bPAYLOCITY\b|\bPAYCOR\b|\bRIPPLING\b|\bTRINET\b|\bJUSTWORKS\b|\bINTUIT\s*PAYROLL\b|\bQUICKBOOKS\s*PAYROLL\b/;

// Entry descriptions employers use for wages.
const PAYROLL_DESCRIPTIONS =
  /\bPAYROLL\b|\bPAYRLL\b|\bPAY\s*ROLL\b|\bDIR\s*DEP\b|\bDIRECT\s*DEP(OSIT)?\b|\bDIRDEP\b|\bSALARY\b|\bWAGES?\b|\bEARNINGS\b/;

const norm = (s?: string | null) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();

export function classifyIncomingCredit(input: IncomingCreditInput): IncomingCreditClassification {
  const company = norm(input.companyName);
  const entry = norm(input.companyEntryDescription);
  const description = norm(input.description);
  const all = `${company} ${entry} ${description}`;
  const source = (input.companyName || input.description || '').trim().slice(0, 60) || undefined;

  // The originator's name is the most reliable signal, so a platform match wins
  // even when the description reads like a transfer.
  for (const p of GIG_PLATFORMS) {
    if (p.pattern.test(company) || (!company && p.pattern.test(description))) {
      return { kind: 'GIG_PLATFORM', isEarnings: true, platform: p.name, source };
    }
  }
  if (NOT_EARNINGS.test(all)) return { kind: 'TRANSFER', isEarnings: false, source };
  if (PAYROLL_PROCESSORS.test(company) || PAYROLL_DESCRIPTIONS.test(`${entry} ${description}`)) {
    return { kind: 'PAYROLL', isEarnings: true, source };
  }
  return { kind: 'OTHER', isEarnings: false, source };
}
