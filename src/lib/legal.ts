// Versions of the legal documents members must accept. Bump a version when the
// document changes materially; signed-in members are then asked to accept the
// new version before they can move money again (see server `requireTerms` and
// the TermsAcceptanceGate in App).
//
// Shared by the browser and the server.

export const TERMS_VERSION = '2026-10-13';
export const PRIVACY_VERSION = '2026-10-13';

export const SUPPORT_EMAIL = 'support@mutualpool.org';

// Platform fee schedule (single source of truth for the Terms and the UI copy).
export const FEES = {
  depositFeeRate: 0.05,          // charged on each weekly deposit
  payoutFeeRate: 0.10,           // deducted from each rotation payout
  hostRewardRate: 0.03,          // share of the payout fee paid to the final-slot holder
  hardshipRepaymentFeeRate: 0.07, // added to a hardship advance when it is repaid
} as const;

export function hasAcceptedCurrentTerms(user?: { termsAcceptedVersion?: string } | null): boolean {
  return Boolean(user && user.termsAcceptedVersion === TERMS_VERSION);
}
