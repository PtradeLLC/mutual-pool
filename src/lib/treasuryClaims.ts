// Gate for every FDIC / Stripe Treasury claim in the product.
//
// Member balances are an internal ledger backed by the platform's Stripe
// balance. Pass-through FDIC coverage only applies once member funds are held
// in Stripe Treasury financial accounts in the member's name. Until that
// program is live (TREASURY_ENABLED / VITE_TREASURY_ENABLED=true), no FDIC
// claim may be shown anywhere.
//
// Shared by the browser and the server: keep it free of DOM/Node-only APIs.

function readFlag(): boolean {
  try {
    const viteEnv = (import.meta as any)?.env;
    if (viteEnv && viteEnv.VITE_TREASURY_ENABLED !== undefined) return viteEnv.VITE_TREASURY_ENABLED === 'true';
  } catch {
    // not a Vite bundle
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.TREASURY_ENABLED === 'true' || process.env.VITE_TREASURY_ENABLED === 'true';
  }
  return false;
}

export const TREASURY_PROGRAM_ENABLED = readFlag();

// A member's own funds are insured only when the program is live AND they have
// a Stripe Treasury financial account (set by the server from Stripe data).
export function memberHasInsuredTreasury(user?: { treasury?: { fdicPassThroughEligible?: boolean; stripeFinAccountId?: string } } | null): boolean {
  return TREASURY_PROGRAM_ENABLED
    && Boolean(user?.treasury?.fdicPassThroughEligible)
    && Boolean(user?.treasury?.stripeFinAccountId && user.treasury.stripeFinAccountId.startsWith('fa_'));
}

const CLAIM = /fdic|pass-?through/i;
const BULLET = /^\s*(?:[•\-*▪◦]|\d+[.)])\s+/;
// Connectors between heading parts: "&", "and", "y", "et" need surrounding
// spaces (so the "y" in "Treasury" doesn't count); "/" and "," don't.
const CONNECTOR = String.raw`(?:\s+(?:&|and|y|et|—|–|-)\s+|\s*[\/,]\s*)`;
const CONNECTOR_TAIL = new RegExp(CONNECTOR + String.raw`[^&,\/\n—–]*(?:fdic|pass-?through)[^&,\/\n—–]*$`, 'i');
// Head form needs a connector after the claim ("FDIC Security & Stripe ..."); a
// heading that is nothing but the claim is dropped entirely by the caller.
const CONNECTOR_HEAD = new RegExp(String.raw`^([^\w\n]*)[^&,\/\n—–:]*?(?:fdic|pass-?through)[^&,\/\n—–:]*?` + CONNECTOR, 'i');

// Remove insurance claims from free text without touching the rest.
//   • bullet lines that contain the claim are dropped
//   • in prose, only the sentences containing the claim are dropped
//   • in headings (no sentence punctuation) the claim fragment is trimmed
export function stripTreasuryClaims(text: string): string {
  if (!text || !CLAIM.test(text)) return text;
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine;
    if (!CLAIM.test(line)) { out.push(line); continue; }
    if (BULLET.test(line)) continue;

    const hasSentences = /[.!?]\s|[.!?]$/.test(line.trim());
    if (hasSentences) {
      const kept = line.split(/(?<=[.!?])\s+/).filter(s => !CLAIM.test(s)).join(' ').trim();
      if (kept) out.push(kept);
      continue;
    }
    let heading = line.replace(CONNECTOR_TAIL, '');
    if (CLAIM.test(heading)) heading = heading.replace(CONNECTOR_HEAD, '$1');
    heading = heading.replace(/\s+([:)])/g, '$1').trim();
    if (CLAIM.test(heading) || !/\w/.test(heading)) continue;
    out.push(heading);
  }
  // Collapse runs of blank lines left behind.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function sanitizeVoiceGuidePayload<T extends { spokenText?: string; displayText?: string }>(payload: T): T {
  if (TREASURY_PROGRAM_ENABLED || !payload) return payload;
  return {
    ...payload,
    spokenText: payload.spokenText ? stripTreasuryClaims(payload.spokenText) : payload.spokenText,
    displayText: payload.displayText ? stripTreasuryClaims(payload.displayText) : payload.displayText,
  };
}
