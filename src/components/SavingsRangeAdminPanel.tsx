import React, { useEffect, useState } from 'react';
import { Layers, RefreshCw, Plus, Save, PlusCircle } from 'lucide-react';
import { dollarsToCents, centsToInput, formatCents } from '../lib/financialAwareness';
import type { SavingsRange } from '../lib/financialAwareness';

interface HostedPodSummary {
  id: string;
  name: string;
  status: string;
  members: number;
  sizeTier: number;
  depositTier: number;
  savingsPurpose: string | null;
  createdAt: string;
}
type AdminRange = SavingsRange & { memberCount: number; hostedPods: HostedPodSummary[] };

interface AdminData {
  ranges: AdminRange[];
  profilesCompleted: number;
  profilesWithoutRange: number;
  depositTiers: number[];
  podSize: { min: number; max: number };
  fees: { payoutFeeRate: number; userPodPlatformRate: number; hostedPodPlatformRate: number };
}

interface Draft {
  name: string;
  min: string;
  max: string;
  podDepositTier: number;
  podSize: string;
  autoProvision: boolean;
  active: boolean;
}

const draftOf = (r?: AdminRange): Draft => ({
  name: r?.name || '',
  min: r ? centsToInput(r.minWeeklyCents) : '',
  max: r && r.maxWeeklyCents !== null ? centsToInput(r.maxWeeklyCents) : '',
  podDepositTier: r?.matchingCriteria.podDepositTier || 5,
  podSize: String(r?.matchingCriteria.podSize || 10),
  autoProvision: r ? r.matchingCriteria.autoProvision : false,
  active: r ? r.active : true,
});

const pct = (rate: number) => `${Math.round(rate * 100)}%`;
const field = 'px-2 py-1.5 rounded-lg border border-[#DDE1E6] text-xs bg-white w-full';

/** Admin Ops: Savings Range thresholds and MutualPool-hosted pods. Shows counts only, never a member's finances. */
export const SavingsRangeAdminPanel: React.FC = () => {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newDraft, setNewDraft] = useState<Draft>(draftOf());
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/savings-ranges');
      const body = await res.json().catch(() => null);
      if (res.ok && Array.isArray(body?.ranges)) {
        setData(body);
        setDrafts(Object.fromEntries(body.ranges.map((r: AdminRange) => [r.id, draftOf(r)])));
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const payloadOf = (d: Draft): Record<string, unknown> | string => {
    const min = dollarsToCents(d.min);
    const max = d.max.trim() === '' ? null : dollarsToCents(d.max);
    if (min === null || (d.max.trim() !== '' && max === null)) return 'Enter the weekly amounts as dollars, for example 20 or 49.99.';
    const podSize = Number(d.podSize);
    if (!Number.isInteger(podSize)) return 'Pod size must be a whole number.';
    return {
      name: d.name,
      minWeeklyCents: min,
      maxWeeklyCents: max,
      active: d.active,
      matchingCriteria: { podDepositTier: d.podDepositTier, podSize, autoProvision: d.autoProvision },
    };
  };

  const send = async (key: string, url: string, method: string, body: Record<string, unknown>, done: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        // An equivalent pod still has seats: opening another needs an explicit yes.
        if (out.error === 'HOSTED_POD_EXISTS' && window.confirm(`${out.message}\n\nOpen another pod anyway?`)) {
          await send(key, url, method, { ...body, allowDuplicate: true }, done);
          return;
        }
        setMessage({ ok: false, text: out.message || out.error || `Request failed (HTTP ${res.status}).` });
        return;
      }
      setMessage({ ok: true, text: done });
      if (key === 'new') setNewDraft(draftOf());
      await load();
    } catch {
      setMessage({ ok: false, text: 'Network error. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const saveRange = (id: string) => {
    const payload = payloadOf(drafts[id]);
    if (typeof payload === 'string') { setMessage({ ok: false, text: payload }); return; }
    send(id, `/api/admin/savings-ranges/${id}`, 'PUT', payload, 'Range saved. Members were re-placed under the new thresholds.');
  };
  const createRange = () => {
    const payload = payloadOf(newDraft);
    if (typeof payload === 'string') { setMessage({ ok: false, text: payload }); return; }
    send('new', '/api/admin/savings-ranges', 'POST', payload, 'Range created.');
  };
  const openPod = (r: AdminRange) => send(`pod_${r.id}`, '/api/admin/hosted-pods', 'POST', { savingsRangeId: r.id }, `Hosted pod opened for ${r.name}.`);

  const editor = (d: Draft, set: (next: Draft) => void, idPrefix: string) => (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
      <label className="text-[10px] font-bold text-slate-600 space-y-1 col-span-2 md:col-span-1">Name
        <input id={`${idPrefix}-name`} className={field} value={d.name} maxLength={60} onChange={e => set({ ...d, name: e.target.value })} />
      </label>
      <label className="text-[10px] font-bold text-slate-600 space-y-1">Min $/week
        <input className={`${field} font-mono`} inputMode="decimal" value={d.min} onChange={e => set({ ...d, min: e.target.value })} />
      </label>
      <label className="text-[10px] font-bold text-slate-600 space-y-1">Max $/week
        <input className={`${field} font-mono`} inputMode="decimal" placeholder="no limit" value={d.max} onChange={e => set({ ...d, max: e.target.value })} />
      </label>
      <label className="text-[10px] font-bold text-slate-600 space-y-1">Pod deposit
        <select className={field} value={d.podDepositTier} onChange={e => set({ ...d, podDepositTier: Number(e.target.value) })}>
          {(data?.depositTiers || [5, 10, 20, 50, 100]).map(tier => <option key={tier} value={tier}>${tier}/week</option>)}
        </select>
      </label>
      <label className="text-[10px] font-bold text-slate-600 space-y-1">Pod size
        <input className={`${field} font-mono`} inputMode="numeric" value={d.podSize} onChange={e => set({ ...d, podSize: e.target.value })} />
      </label>
      <div className="flex flex-col gap-1 text-[11px] text-slate-700">
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={d.active} onChange={e => set({ ...d, active: e.target.checked })} /> Active</label>
        <label className="inline-flex items-center gap-1.5" title="Open a hosted pod when a matching member finds none forming"><input type="checkbox" checked={d.autoProvision} onChange={e => set({ ...d, autoProvision: e.target.checked })} /> Auto-open pods</label>
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="font-extrabold text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-[#005FB8]" /> Savings Ranges & MutualPool-hosted pods</h3>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#DDE1E6] hover:bg-gray-50 text-[11px] font-semibold">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {data && (
        <p className="text-xs text-slate-500 mb-3">
          {data.profilesCompleted} completed financial profiles ({data.profilesWithoutRange} outside every active range). A member's range comes from their confirmed weekly commitment.
          Payout fee is {pct(data.fees.payoutFeeRate)} of each pot in every pod: MutualPool keeps {pct(data.fees.userPodPlatformRate)} in member-created pods (the rest is the host reward) and the full {pct(data.fees.hostedPodPlatformRate)} in hosted pods.
        </p>
      )}
      {message && (
        <div role="status" className={`mb-3 p-2.5 rounded-lg text-xs font-semibold border ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>{message.text}</div>
      )}

      <ul className="space-y-3">
        {(data?.ranges || []).map(r => {
          const d = drafts[r.id] || draftOf(r);
          return (
            <li key={r.id} className={`p-3 rounded-xl border ${r.active ? 'border-[#E2E8F0] bg-[#F8FAFC]' : 'border-dashed border-slate-300 bg-white'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                <span className="font-bold text-sm">
                  {r.name}
                  <span className="ml-2 font-mono font-semibold text-slate-500">{formatCents(r.minWeeklyCents)}{r.maxWeeklyCents === null ? '+' : ` to ${formatCents(r.maxWeeklyCents)}`} / week</span>
                  {!r.active && <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold uppercase">Inactive</span>}
                </span>
                <span className="text-slate-500">{r.memberCount} members · {r.hostedPods.length} hosted pods</span>
              </div>
              {editor(d, next => setDrafts(prev => ({ ...prev, [r.id]: next })), r.id)}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => saveRange(r.id)} disabled={busy !== null} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white text-[11px] font-bold">
                  <Save className="w-3 h-3" /> Save range
                </button>
                {r.active && (
                  <button type="button" onClick={() => openPod(r)} disabled={busy !== null} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#005FB8] text-[#005FB8] hover:bg-blue-50 disabled:opacity-50 text-[11px] font-bold">
                    <PlusCircle className="w-3 h-3" /> Open hosted pod (${r.matchingCriteria.podDepositTier}/week, {r.matchingCriteria.podSize} members)
                  </button>
                )}
              </div>
              {r.hostedPods.length > 0 && (
                <ul className="mt-2 divide-y divide-[#E2E8F0] text-[11px]">
                  {r.hostedPods.map(p => (
                    <li key={p.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-slate-500 font-mono">{p.members}/{p.sizeTier} · ${p.depositTier}/wk · {p.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 p-3 rounded-xl border border-dashed border-slate-300">
        <div className="text-xs font-bold mb-2">Add a range</div>
        {editor(newDraft, setNewDraft, 'new-range')}
        <button type="button" onClick={createRange} disabled={busy !== null} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-[11px] font-bold">
          <Plus className="w-3 h-3" /> Create range
        </button>
        <p className="text-[11px] text-slate-500 mt-2">Active ranges cannot overlap, and a range's pod deposit cannot be more than its minimum, so nobody is asked for more than they committed to.</p>
      </div>
    </div>
  );
};
