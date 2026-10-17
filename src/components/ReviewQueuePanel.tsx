import React, { useCallback, useEffect, useState } from 'react';
import { User } from '../types';
import { useToast } from '../context/ToastContext';
import { AlertTriangle, CheckCircle2, Inbox, RefreshCw, ShieldOff, XCircle } from 'lucide-react';

// Operations review queue: money movements Stripe answered ambiguously (a
// withdrawal or ACH debit that may or may not exist), accounts on hold after a
// card refund/chargeback, and messages from the public contact form. Admins
// check the Stripe dashboard, then resolve here.

interface ReviewData {
  withdrawals: Array<{ id: string; userId: string; userName: string; amountUsd: number; destinationAccountId: string; error?: string; createdAt: string }>;
  collections: Array<{ id: string; userId: string; userName: string; amountUsd: number; defaultId: string; failureReason?: string; createdAt: string }>;
  riskHolds: Array<{ userId: string; displayName: string; email?: string; balanceUsd: number; reason: string; at: string; amountUsd?: number; stripeRef?: string }>;
  supportMessages: Array<{ id: string; name: string; email: string; message: string; createdAt: string }>;
}

const money = (n: number | undefined) => `$${(Number(n) || 0).toFixed(2)}`;

export const ReviewQueuePanel: React.FC<{ currentUser: User; onChanged?: () => void }> = ({ currentUser, onChanged }) => {
  const toast = useToast();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reviews', { headers: { 'x-user-id': currentUser.id } });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.warn('Failed to load review queue:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => { load(); }, [load]);

  const post = async (path: string, body: Record<string, unknown>, okMessage: string) => {
    setBusy(path);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || 'Request failed');
      toast.success(okMessage, { title: 'Review queue' });
      await load();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Request failed', { title: 'Review queue' });
    } finally {
      setBusy(null);
    }
  };

  const resolveWithdrawal = (id: string, amount: number) => {
    const transferId = window.prompt(`Withdrawal ${money(amount)}: if Stripe shows the transfer, paste its id (tr_...) to mark it COMPLETED. Leave empty to mark it FAILED and refund the member's balance.`);
    if (transferId === null) return;
    const body = transferId.trim() ? { outcome: 'COMPLETED', stripeTransferId: transferId.trim() } : { outcome: 'FAILED' };
    post(`/api/admin/withdrawals/${id}/resolve`, body, body.outcome === 'COMPLETED' ? 'Withdrawal confirmed.' : 'Withdrawal marked failed and refunded.');
  };

  const resolveCollection = (id: string, amount: number) => {
    const piId = window.prompt(`ACH debit ${money(amount)}: if Stripe shows the PaymentIntent, paste its id (pi_...) to keep tracking it. Leave empty to mark it FAILED (no debit exists).`);
    if (piId === null) return;
    const body = piId.trim() ? { outcome: 'PROCESSING', stripePaymentIntentId: piId.trim() } : { outcome: 'FAILED' };
    post(`/api/admin/collections/${id}/resolve`, body, body.outcome === 'PROCESSING' ? 'Debit is being tracked again.' : 'Collection marked failed.');
  };

  const clearHold = (userId: string, name: string) => {
    const note = window.prompt(`Clear the account hold on ${name}? Enter a note for the audit log:`);
    if (note === null) return;
    post(`/api/admin/users/${userId}/clear-hold`, { note }, 'Hold cleared.');
  };

  const total = data ? data.withdrawals.length + data.collections.length + data.riskHolds.length : 0;

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#111827] font-bold text-sm">
            <Inbox className="w-4 h-4 text-amber-600" />
            <span>Operations Review Queue</span>
            {total > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">{total} open</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Money movements Stripe answered ambiguously, accounts on hold after a card reversal, and contact-form messages. Check the Stripe dashboard before resolving.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs flex items-center gap-1.5 disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 text-[#005FB8] ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {data && total === 0 && data.supportMessages.length === 0 && (
        <div className="text-xs text-gray-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Nothing waiting for review.</div>
      )}

      {data && data.withdrawals.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-bold text-[#111827] flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Withdrawals needing review</h4>
          {data.withdrawals.map(w => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 text-xs border border-amber-200 bg-amber-50/50 rounded-lg p-3">
              <div>
                <div className="font-semibold">{w.userName} · {money(w.amountUsd)} to {w.destinationAccountId}</div>
                <div className="text-[10px] text-gray-600">{new Date(w.createdAt).toLocaleString()} · Stripe said: {w.error || 'unknown error'} · Idempotency key: <span className="font-mono">{w.id}</span></div>
              </div>
              <button type="button" onClick={() => resolveWithdrawal(w.id, w.amountUsd)} disabled={busy !== null} className="px-2.5 py-1 rounded bg-[#111827] text-white font-bold text-[10px] disabled:opacity-60">Resolve</button>
            </div>
          ))}
        </section>
      )}

      {data && data.collections.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-bold text-[#111827] flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> ACH debits needing review</h4>
          {data.collections.map(c => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-xs border border-amber-200 bg-amber-50/50 rounded-lg p-3">
              <div>
                <div className="font-semibold">{c.userName} · {money(c.amountUsd)}</div>
                <div className="text-[10px] text-gray-600">{new Date(c.createdAt).toLocaleString()} · Stripe said: {c.failureReason || 'unknown error'} · Idempotency key: <span className="font-mono">{c.id}</span></div>
              </div>
              <button type="button" onClick={() => resolveCollection(c.id, c.amountUsd)} disabled={busy !== null} className="px-2.5 py-1 rounded bg-[#111827] text-white font-bold text-[10px] disabled:opacity-60">Resolve</button>
            </div>
          ))}
        </section>
      )}

      {data && data.riskHolds.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-bold text-[#111827] flex items-center gap-1.5"><ShieldOff className="w-3.5 h-3.5 text-red-600" /> Accounts on hold</h4>
          {data.riskHolds.map(h => (
            <div key={h.userId} className="flex flex-wrap items-center justify-between gap-2 text-xs border border-red-200 bg-red-50/50 rounded-lg p-3">
              <div>
                <div className="font-semibold">{h.displayName} <span className="text-gray-500 font-normal">{h.email}</span></div>
                <div className="text-[10px] text-gray-600">{h.reason} · {new Date(h.at).toLocaleString()} · still owed {money(h.amountUsd)} · balance {money(h.balanceUsd)} · {h.stripeRef}</div>
              </div>
              <button type="button" onClick={() => clearHold(h.userId, h.displayName)} disabled={busy !== null} className="px-2.5 py-1 rounded border border-gray-300 bg-white font-bold text-[10px] disabled:opacity-60">Clear hold</button>
            </div>
          ))}
        </section>
      )}

      {data && data.supportMessages.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-bold text-[#111827]">Contact-form messages (latest {data.supportMessages.length})</h4>
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {data.supportMessages.map(m => (
              <div key={m.id} className="text-xs border border-gray-200 rounded-lg p-2.5">
                <div className="font-semibold">{m.name} <span className="text-gray-500 font-normal">{m.email}</span> <span className="text-[10px] text-gray-400">{new Date(m.createdAt).toLocaleString()}</span></div>
                <div className="text-gray-700 whitespace-pre-wrap mt-0.5">{m.message}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!data && !loading && <div className="text-xs text-gray-500 flex items-center gap-2"><XCircle className="w-4 h-4" /> Could not load the review queue.</div>}
    </div>
  );
};
