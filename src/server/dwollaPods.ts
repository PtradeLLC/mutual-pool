// Weekly cycle for pods on the Dwolla rail (pod.paymentRail === 'DWOLLA').
//
// - Creating and joining is free. Once the pod is full and locked, the
//   rotation decides who receives each week.
// - Thursday: every member except that week's recipient is debited from their
//   bank straight into the recipient's Dwolla Balance (deposit + 5% reserve
//   fee; MutualPool keeps the reserve fee and the 10% platform fee). The
//   recipient's own share is not moved: each member skips paying once, in the
//   week they receive, so it evens out across the pod.
// - A contribution that fails (or can't be started) is covered by MutualPool's
//   reserve, so the recipient still gets the full amount; the member is marked
//   delinquent and told to fix their bank.
// - Friday: the week is closed (recipient marked paid) and the pod moves on;
//   after the last week it is completed.
// The Hardship Fund and the welcome match are paused for these pods.

import type { Pod, PodMembership, User, DwollaTransferRecord } from '../types';
import { canContribute, canReceive, createContribution, coverWithReserve, podTransfers } from './dwollaRail';
import { contributionAmounts } from '../lib/contributionFees';

export const isDwollaPod = (pod?: Pod | null): boolean => Boolean(pod && pod.paymentRail === 'DWOLLA');

/** Verified with Dwolla, bank linked and authorized, able to receive. */
export function paymentsReady(user?: User | null): boolean {
  return Boolean(user && canContribute(user) && canReceive(user));
}

export interface PodEngineDeps {
  users: () => User[];
  audit: (podId: string, userId: string, userName: string, action: string, message: string, meta?: Record<string, unknown>) => void;
  notify: (userId: string, pod: Pod, title: string, message: string) => void;
  onCompleted: (pod: Pod) => void;
  persist: () => void;
}

let deps: PodEngineDeps | null = null;
export function initDwollaPods(d: PodEngineDeps): void { deps = d; }
function need(): PodEngineDeps {
  if (!deps) throw new Error('dwollaPods not initialised');
  return deps;
}

const userOf = (id: string) => need().users().find(u => u && u.id === id);

/** Members who still need to finish payment setup before the pod can start. */
export function membersNotReady(pod: Pod): PodMembership[] {
  return (pod.members || []).filter(m => !paymentsReady(userOf(m.userId)));
}

export function weekRecipient(pod: Pod, week = pod.currentCycleWeek || 1): PodMembership | undefined {
  return (pod.members || []).find(m => m && m.rotationIndex === week - 1);
}

export interface EngineResult {
  podsEvaluated: number;
  transfers: number;
  volumeUsd: number;
  failed: number;
  details: string[];
}

const empty = (): EngineResult => ({ podsEvaluated: 0, transfers: 0, volumeUsd: 0, failed: 0, details: [] });

/** Marks a missed week on the member and tells them. */
function markMissed(pod: Pod, member: PodMembership, week: number, reason: string): void {
  const d = need();
  member.delinquencyStatus = 'DELINQUENT';
  d.audit(pod.id, member.userId, member.displayName, 'DEPOSIT_MISSED', `Week ${week} contribution was not collected (${reason}). MutualPool's reserve covered the recipient.`, { cycleWeek: week, reason });
  d.notify(member.userId, pod, `Week ${week} contribution missed`, `We couldn't collect your $${Number(pod.depositTier).toFixed(2)} contribution for "${pod.name}" (${reason}). MutualPool covered it so the pod keeps going. Please check your linked bank account.`);
}

async function coverMiss(pod: Pod, payerId: string, recipient: User, week: number, failed?: DwollaTransferRecord): Promise<boolean> {
  try {
    await coverWithReserve({ recipient, payerUserId: payerId, podId: pod.id, cycleWeek: week, depositUsd: Number(pod.depositTier), failed });
    return true;
  } catch (err: any) {
    need().audit(pod.id, 'SYSTEM', 'MutualPool Reserve', 'RESERVE_COVER_FAILED', `Could not cover a missed week ${week} contribution: ${err?.message || err}`, { payerUserId: payerId });
    return false;
  }
}

/** Thursday: start this week's contributions for every active Dwolla pod. */
export async function startWeekContributions(pods: Pod[]): Promise<EngineResult> {
  const d = need();
  const out = empty();
  for (const pod of pods.filter(p => p && p.status === 'ACTIVE' && isDwollaPod(p))) {
    out.podsEvaluated += 1;
    const week = pod.currentCycleWeek || 1;
    const rec = weekRecipient(pod, week);
    const recipient = rec && userOf(rec.userId);
    if (!rec || !recipient) {
      out.failed += 1;
      out.details.push(`[${pod.name}] No recipient for week ${week}.`);
      continue;
    }
    if (!canReceive(recipient)) {
      out.failed += 1;
      out.details.push(`[${pod.name}] Week ${week} recipient ${rec.displayName} can't receive payouts; contributions not started.`);
      d.notify(rec.userId, pod, 'Action needed to receive your payout', `Your payout week in "${pod.name}" has arrived, but your payment account needs attention. Open payment setup to fix it.`);
      continue;
    }
    for (const m of pod.members) {
      if (!m || m.userId === rec.userId) continue;
      const payer = userOf(m.userId);
      try {
        if (!payer) throw new Error('member not found');
        const t = await createContribution(payer, recipient, Number(pod.depositTier), { podId: pod.id, cycleWeek: week });
        out.transfers += 1;
        out.volumeUsd += t.amountUsd;
      } catch (err: any) {
        out.failed += 1;
        const reason = err?.code === 'PAYER_NOT_READY' ? 'no verified bank on file' : (err?.message || 'debit could not start');
        out.details.push(`[${pod.name}] ${m.displayName}: ${reason}`);
        markMissed(pod, m, week, reason);
        await coverMiss(pod, m.userId, recipient, week);
      }
    }
    out.details.push(`[${pod.name}] Week ${week}: contributions started to ${rec.displayName}.`);
  }
  d.persist();
  return out;
}

/** A contribution failed after it started (ACH return): cover it and mark the member. */
export async function handleFailedContribution(record: DwollaTransferRecord, pods: Pod[]): Promise<void> {
  const pod = pods.find(p => p && p.id === record.podId);
  if (!pod || !record.payerUserId || !record.recipientUserId || !record.cycleWeek) return;
  const member = pod.members.find(m => m.userId === record.payerUserId);
  const recipient = userOf(record.recipientUserId);
  if (member) markMissed(pod, member, record.cycleWeek, record.failureCode ? `bank return ${record.failureCode}` : 'bank debit failed');
  if (recipient) await coverMiss(pod, record.payerUserId, recipient, record.cycleWeek, record);
  need().persist();
}

/** Friday: close the week for every active Dwolla pod and move on (or complete). */
export async function finishWeek(pods: Pod[]): Promise<EngineResult> {
  const d = need();
  const out = empty();
  for (const pod of pods.filter(p => p && p.status === 'ACTIVE' && isDwollaPod(p))) {
    out.podsEvaluated += 1;
    const week = pod.currentCycleWeek || 1;
    const rec = weekRecipient(pod, week);
    if (!rec) {
      out.failed += 1;
      out.details.push(`[${pod.name}] No recipient for week ${week}.`);
      continue;
    }
    if (rec.hasReceivedPayout && rec.payoutCycleWeek === week) continue; // already closed
    const weekTransfers = podTransfers(pod.id).filter(t => t.cycleWeek === week && (t.kind === 'CONTRIBUTION' || t.kind === 'RESERVE_COVER') && t.status !== 'failed' && t.status !== 'cancelled');
    const contributors = pod.members.length - 1;
    const expectedNet = contributionAmounts(Number(pod.depositTier)).recipientNetUsd * contributors;
    rec.hasReceivedPayout = true;
    rec.payoutCycleWeek = week;
    out.transfers += weekTransfers.length;
    d.audit(pod.id, rec.userId, rec.displayName, 'PAYOUT_COMPLETED', `Week ${week} payout to ${rec.displayName}: ${weekTransfers.length} of ${contributors} contributions sent to their Dwolla balance (about $${expectedNet.toFixed(2)} after fees, as transfers clear).`, { cycleWeek: week });
    d.notify(rec.userId, pod, 'Your payout is on the way', `Your week ${week} payout from "${pod.name}" (about $${expectedNet.toFixed(2)}) is arriving in your MutualPool balance as the bank transfers clear, usually within a few business days.`);
    const total = pod.totalCycles || pod.members.length;
    if (week >= total) {
      pod.status = 'COMPLETED';
      for (const m of pod.members) {
        const u = userOf(m.userId);
        if (u) u.completedPodsCount = (u.completedPodsCount || 0) + 1;
      }
      d.onCompleted(pod);
      out.details.push(`[${pod.name}] Final week ${week} closed. Pod completed.`);
    } else {
      pod.currentCycleWeek = week + 1;
      out.details.push(`[${pod.name}] Week ${week} closed; now week ${pod.currentCycleWeek}.`);
    }
  }
  d.persist();
  return out;
}
