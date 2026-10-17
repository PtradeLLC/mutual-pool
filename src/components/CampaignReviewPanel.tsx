import React, { useCallback, useEffect, useState } from 'react';
import { AdCampaign, User } from '../types';
import { useToast } from '../context/ToastContext';
import { Check, Megaphone, Pause, Play, RefreshCw, X } from 'lucide-react';

// Admin control over the campaign catalog. Couriers can only start shifts
// against campaigns an admin has approved here, and the pay rate shown is the
// one the server will honour.

const money = (n: number | undefined) => `$${(Number(n) || 0).toFixed(2)}`;

export const CampaignReviewPanel: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns', { headers: { 'x-user-id': currentUser.id } });
      if (res.ok) setCampaigns((await res.json()).campaigns || []);
    } catch (err) {
      console.warn('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (c: AdCampaign, status: string) => {
    let rejectionReason: string | undefined;
    if (status === 'rejected') {
      const reason = window.prompt(`Reason for not approving "${c.title}" (sent to the advertiser):`);
      if (reason === null) return;
      rejectionReason = reason;
    }
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/admin/campaigns/${c.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ status, rejectionReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || 'Update failed');
      toast.success(`"${c.title}" is now ${status}.`, { title: 'Campaigns' });
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed', { title: 'Campaigns' });
    } finally {
      setBusyId(null);
    }
  };

  const visible = campaigns.filter(c => showClosed || c.status === 'pending' || c.status === 'recruiting' || c.status === 'active' || c.status === 'paused');
  const pendingCount = campaigns.filter(c => c.status === 'pending').length;

  const badge = (status: AdCampaign['status']) => {
    const map: Record<AdCampaign['status'], string> = {
      pending: 'bg-amber-50 text-amber-800 border-amber-200',
      recruiting: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      active: 'bg-blue-50 text-blue-700 border-blue-200',
      paused: 'bg-gray-100 text-gray-700 border-gray-200',
      completed: 'bg-gray-100 text-gray-600 border-gray-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
    };
    return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${map[status]}`}>{status}</span>;
  };

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#111827] font-bold text-sm">
            <Megaphone className="w-4 h-4 text-[#005FB8]" />
            <span>Brand Campaign Catalog</span>
            {pendingCount > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">{pendingCount} to review</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Couriers only see approved campaigns, and shift pay is whatever is approved here. Check the brand, the gear list and the daily rate before approving.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium">
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} /> Show completed / rejected
          </label>
          <button type="button" onClick={load} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs flex items-center gap-1.5 disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 text-[#005FB8] ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Campaign</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Daily pay</th>
              <th className="py-2.5 px-3">Gear checked</th>
              <th className="py-2.5 px-3">Metro / duration</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.length === 0 && (
              <tr><td colSpan={6} className="py-6 px-3 text-center text-gray-500">{loading ? 'Loading…' : 'No campaigns yet. Advertisers submit them from the Campaigns page.'}</td></tr>
            )}
            {visible.map(c => (
              <tr key={c.id} className="hover:bg-gray-50/80 align-top">
                <td className="py-3 px-3">
                  <div className="font-semibold text-[#111827]">{c.title}</div>
                  <div className="text-[10px] text-gray-500">{c.brandName}{c.createdAt ? ` · submitted ${new Date(c.createdAt).toLocaleDateString()}` : ''}</div>
                  {c.rejectionReason && <div className="text-[10px] text-red-700 mt-0.5">Rejected: {c.rejectionReason}</div>}
                </td>
                <td className="py-3 px-3">{badge(c.status)}</td>
                <td className="py-3 px-3 font-mono font-bold">{money(c.dailyPayout)}</td>
                <td className="py-3 px-3 text-[11px]">{c.gearRequired?.length ? c.gearRequired.join(', ') : <span className="text-gray-400">default gear</span>}</td>
                <td className="py-3 px-3 text-[11px]">{c.targetMetro} · {c.durationWeeks} wk</td>
                <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                  {c.status === 'pending' && (
                    <>
                      <button type="button" disabled={busyId === c.id} onClick={() => setStatus(c, 'recruiting')} className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] inline-flex items-center gap-1 disabled:opacity-60"><Check className="w-3 h-3" /> Approve</button>
                      <button type="button" disabled={busyId === c.id} onClick={() => setStatus(c, 'rejected')} className="px-2.5 py-1 rounded border border-red-200 text-red-700 bg-red-50 font-bold text-[10px] inline-flex items-center gap-1 disabled:opacity-60"><X className="w-3 h-3" /> Reject</button>
                    </>
                  )}
                  {(c.status === 'recruiting' || c.status === 'active') && (
                    <button type="button" disabled={busyId === c.id} onClick={() => setStatus(c, 'paused')} className="px-2.5 py-1 rounded border border-gray-300 bg-white font-bold text-[10px] inline-flex items-center gap-1 disabled:opacity-60"><Pause className="w-3 h-3" /> Pause</button>
                  )}
                  {c.status === 'paused' && (
                    <button type="button" disabled={busyId === c.id} onClick={() => setStatus(c, 'active')} className="px-2.5 py-1 rounded border border-gray-300 bg-white font-bold text-[10px] inline-flex items-center gap-1 disabled:opacity-60"><Play className="w-3 h-3" /> Resume</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
