// Keeps an unfinished "Create pod" form while the member adds funds.
// Stripe Checkout leaves the app, so the draft is stored in sessionStorage and
// the Create Pod modal reopens with it when the member returns.

import type { ActivationPolicy, DepositTier, InvitedContact, PodSizeTier, PodType } from '../types';

export interface PendingPodDraft {
  name: string;
  description?: string;
  category?: string;
  podType: PodType;
  activationPolicy?: ActivationPolicy;
  inviteWindowDays?: number;
  autoOpenOnExpire?: boolean;
  sizeTier: PodSizeTier;
  depositTier: DepositTier;
  invitedContacts?: InvitedContact[];
  renewedFromPodId?: string;
  savedAt: number;
}

const KEY = 'mp_pending_pod_draft';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // a draft older than 2 hours is dropped

export function savePendingPodDraft(draft: Omit<PendingPodDraft, 'savedAt'>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // storage unavailable (private mode): the member re-enters the form
  }
}

export function readPendingPodDraft(): PendingPodDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as PendingPodDraft;
    if (!draft || typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearPendingPodDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Whole-dollar top-up that covers the shortfall (minimum $1). */
export function topUpAmountFor(shortfallUsd: number): number {
  return Math.max(1, Math.ceil(shortfallUsd - 1e-9));
}
