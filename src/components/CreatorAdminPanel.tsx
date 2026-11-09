import React, { useEffect, useState } from 'react';
import { Clapperboard, RefreshCw, ShieldOff, ShieldCheck, Download, CheckCircle2, XCircle, Landmark, Mail, ExternalLink, UserPlus } from 'lucide-react';

// Admin Ops: Creator Pools administration (CREATOR_POOLS_SPEC.md sections 2,
// 7, 10 and 11). Creators and their pools, suspension, manual account checks,
// IRS TIN-match results, bank owner name reviews, the year-end 1099 export,
// and early-access requests from the /creators page.

interface AdminCreator {
  userId: string;
  handle: string;
  displayName: string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED';
  suspendedReason?: string;
  totalFollowers: number;
  earningsUsd: number;
  accounts: { platform: string; handle: string; followers: number; verifiedBy: string; refreshedAt: string }[];
  pools: { id: string; name: string; status: string; seatedCount: number; depositTier: number; pods: number }[];
  taxForm: null | { tinType: string; tinLast4: string; tinMatch: 'UNCHECKED' | 'MATCHED' | 'MISMATCH'; signedAt: string; legalName: string };
  termsAcceptedVersion?: string;
  createdAt: string;
}
interface BankReview { userId: string; displayName: string; email: string; legalName: string; accountHolderName: string; bankName?: string; last4?: string; isCreator: boolean }
interface Interest { id: string; name: string; email: string; handle: string; platforms: string[]; followers?: number; niche?: string; inUS: boolean; notes?: string; submittedAt: string }

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold disabled:opacity-50';

export const CreatorAdminPanel: React.FC = () => {
  const [creators, setCreators] = useState<AdminCreator[]>([]);
  const [reviews, setReviews] = useState<BankReview[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [suspendFor, setSuspendFor] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [verifyFor, setVerifyFor] = useState<string | null>(null);
  const [verify, setVerify] = useState({ platform: 'instagram', handle: '', followers: '' });
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [includeAll, setIncludeAll] = useState(false);
  const [tab, setTab] = useState<'creators' | 'bank' | 'interest'>('creators');

  const load = async () => {
    setLoading(true);
    try {
      const [c, b, i] = await Promise.all([
        fetch('/api/admin/creators').then(r => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/admin/bank-reviews').then(r => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/admin/creator-interests').then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (Array.isArray(c?.creators)) setCreators(c.creators);
      if (Array.isArray(b?.reviews)) setReviews(b.reviews);
      if (Array.isArray(i?.interests)) setInterests(i.interests);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const act = async (path: string, body: unknown, done: string) => {
    setMessage(null);
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? { ok: true, text: done } : { ok: false, text: data.message || data.error || `Request failed (${res.status})` });
    if (res.ok) await load();
    return res.ok;
  };

  const exportCsv = async () => {
    setMessage(null);
    const res = await fetch(`/api/admin/creators/tax-export?year=${encodeURIComponent(year)}${includeAll ? '&all=1' : ''}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ ok: false, text: data.message || `Export failed (${res.status})` });
      return;
    }
    const missing = res.headers.get('X-Missing-W9');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mutualpool-1099-nec-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage({ ok: !missing, text: missing ? `Exported. Missing W-9 for: ${missing}. Ask them to add it before filing.` : 'Exported. The file contains tax IDs: keep it private and delete it after filing.' });
  };

  const statusTone = (s: string) => s === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : s === 'SUSPENDED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
  const tinTone = (s?: string) => s === 'MATCHED' ? 'text-emerald-700' : s === 'MISMATCH' ? 'text-rose-700' : 'text-amber-700';

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-2xl p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-extrabold text-sm flex items-center gap-2"><Clapperboard className="w-4 h-4 text-[#005FB8]" /> Creator Pools</h3>
        <button type="button" onClick={load} className={`${btn} border-[#DDE1E6] hover:bg-gray-50`}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {([
          ['creators', `Creators (${creators.length})`],
          ['bank', `Bank name checks (${reviews.length})`],
          ['interest', `Early-access requests (${interests.length})`],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === key ? 'bg-[#005FB8] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
        ))}
      </div>

      {message && (
        <div className={`mb-3 p-2.5 rounded-lg text-xs border ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{message.text}</div>
      )}

      {tab === 'creators' && (
        <>
          <div className="mb-4 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold">1099-NEC export</span>
            <input value={year} onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-20 px-2 py-1 rounded border border-[#DDE1E6]" aria-label="Tax year" />
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={includeAll} onChange={e => setIncludeAll(e.target.checked)} /> include creators under $2,000</label>
            <button type="button" onClick={exportCsv} className={`${btn} border-[#005FB8] text-[#005FB8] hover:bg-blue-50`}><Download className="w-3 h-3" /> Download CSV</button>
            <span className="text-slate-500">For the IRS IRIS upload. Contains tax IDs; every export is logged.</span>
          </div>

          {creators.length === 0 ? (
            <p className="text-xs text-slate-500">No creators yet. They sign up from the Creator dashboard.</p>
          ) : (
            <ul className="divide-y divide-[#E2E8F0]">
              {creators.map(c => (
                <li key={c.userId} className="py-3 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm">{c.displayName}</span>
                      <a href={`/c/${c.handle}`} target="_blank" rel="noreferrer" className="text-[#005FB8] inline-flex items-center gap-0.5">@{c.handle} <ExternalLink className="w-3 h-3" /></a>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusTone(c.status)}`}>{c.status}</span>
                      <span className="text-slate-500">{c.totalFollowers.toLocaleString()} followers · earned {usd(c.earningsUsd)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.status === 'SUSPENDED' ? (
                        <button type="button" onClick={() => act(`/api/admin/creators/${c.userId}/restore`, {}, `${c.displayName} restored.`)} className={`${btn} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}><ShieldCheck className="w-3 h-3" /> Restore</button>
                      ) : (
                        <button type="button" onClick={() => { setSuspendFor(c.userId); setSuspendReason(''); }} className={`${btn} border-rose-300 text-rose-700 hover:bg-rose-50`}><ShieldOff className="w-3 h-3" /> Suspend</button>
                      )}
                      <button type="button" onClick={() => { setVerifyFor(verifyFor === c.userId ? null : c.userId); setVerify({ platform: 'instagram', handle: '', followers: '' }); }} className={`${btn} border-[#DDE1E6] hover:bg-gray-50`}><UserPlus className="w-3 h-3" /> Verify account</button>
                    </div>
                  </div>

                  {c.status === 'SUSPENDED' && c.suspendedReason && <div className="text-rose-700">Suspended: {c.suspendedReason}</div>}

                  {suspendFor === c.userId && (
                    <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 flex flex-wrap items-center gap-2">
                      <input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Reason (shown to the creator)" className="flex-1 min-w-[200px] px-2 py-1 rounded border border-rose-200" />
                      <button type="button" disabled={suspendReason.trim().length < 3} onClick={async () => { if (await act(`/api/admin/creators/${c.userId}/suspend`, { reason: suspendReason }, `${c.displayName} suspended. Their open pool closed; pods keep running and the 3% goes to MutualPool.`)) setSuspendFor(null); }} className={`${btn} border-rose-400 bg-rose-600 text-white`}>Confirm suspension</button>
                      <button type="button" onClick={() => setSuspendFor(null)} className={`${btn} border-[#DDE1E6] bg-white`}>Cancel</button>
                    </div>
                  )}

                  {verifyFor === c.userId && (
                    <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50 flex flex-wrap items-center gap-2">
                      <span className="text-slate-600">Checked by hand on the platform:</span>
                      <select value={verify.platform} onChange={e => setVerify(v => ({ ...v, platform: e.target.value }))} className="px-2 py-1 rounded border border-blue-200">
                        <option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option>
                      </select>
                      <input value={verify.handle} onChange={e => setVerify(v => ({ ...v, handle: e.target.value }))} placeholder="@handle" className="w-32 px-2 py-1 rounded border border-blue-200" />
                      <input value={verify.followers} onChange={e => setVerify(v => ({ ...v, followers: e.target.value.replace(/\D/g, '') }))} placeholder="Followers" className="w-28 px-2 py-1 rounded border border-blue-200" />
                      <button type="button" disabled={!verify.handle.trim() || !verify.followers} onClick={async () => { if (await act(`/api/admin/creators/${c.userId}/accounts`, { platform: verify.platform, handle: verify.handle, followers: Number(verify.followers) }, 'Account recorded as verified by an admin.')) setVerifyFor(null); }} className={`${btn} border-[#005FB8] bg-[#005FB8] text-white`}>Save</button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {c.accounts.length === 0 && <span className="text-slate-500">No accounts connected.</span>}
                    {c.accounts.map(a => (
                      <span key={a.platform} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{a.platform} @{a.handle} · {a.followers.toLocaleString()} · {a.verifiedBy}{' '}· checked {new Date(a.refreshedAt).toLocaleDateString()}</span>
                    ))}
                  </div>

                  {c.pools.length > 0 && (
                    <div className="text-slate-600">
                      Pools: {c.pools.map(p => `${p.name} (${p.status.toLowerCase()}, $${p.depositTier}/wk, ${p.seatedCount} seated, ${p.pods} pod${p.pods === 1 ? '' : 's'})`).join(' · ')}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {c.taxForm ? (
                      <>
                        <span>W-9: {c.taxForm.legalName} · {c.taxForm.tinType} ••• {c.taxForm.tinLast4} · signed {new Date(c.taxForm.signedAt).toLocaleDateString()} ·</span>
                        <span className={`font-bold ${tinTone(c.taxForm.tinMatch)}`}>IRS match: {c.taxForm.tinMatch}</span>
                        <button type="button" onClick={() => act(`/api/admin/creators/${c.userId}/tin-match`, { result: 'MATCHED' }, 'Recorded: name and tax ID match IRS records.')} className={`${btn} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}><CheckCircle2 className="w-3 h-3" /> Matched</button>
                        <button type="button" onClick={() => act(`/api/admin/creators/${c.userId}/tin-match`, { result: 'MISMATCH' }, 'Recorded as a mismatch; the creator was asked to resubmit.')} className={`${btn} border-rose-300 text-rose-700 hover:bg-rose-50`}><XCircle className="w-3 h-3" /> Mismatch</button>
                      </>
                    ) : (
                      <span className={c.earningsUsd > 0 ? 'text-amber-700' : 'text-slate-500'}>No W-9 yet{c.earningsUsd > 0 ? ' (earnings are held until it is on file)' : ''}.</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'bank' && (
        reviews.length === 0 ? (
          <p className="text-xs text-slate-500">Nothing to review. A withdrawal is held here when the account holder name on a creator-pool member's or creator's bank authorization doesn't match their verified name.</p>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {reviews.map(r => (
              <li key={r.userId} className="py-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-sm flex items-center gap-2"><Landmark className="w-4 h-4 text-[#005FB8]" /> {r.displayName}{r.isCreator ? ' (creator)' : ''}</div>
                  <div className="text-slate-600 mt-0.5">Verified name: <strong>{r.legalName}</strong> · Bank account holder: <strong>{r.accountHolderName}</strong> · {r.bankName || 'Bank'} ••• {r.last4}</div>
                  <a href={`mailto:${r.email}`} className="text-[#005FB8] inline-flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {r.email}</a>
                </div>
                <button type="button" onClick={() => act(`/api/admin/bank-reviews/${r.userId}/approve`, {}, `${r.displayName}'s bank account confirmed. Withdrawals are open.`)} className={`${btn} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}><CheckCircle2 className="w-3 h-3" /> Same person: approve</button>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'interest' && (
        interests.length === 0 ? (
          <p className="text-xs text-slate-500">No requests yet. They arrive from the form on the /creators page.</p>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {interests.map(q => (
              <li key={q.id} className="py-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-sm">{q.name} <span className="ml-1 text-[#005FB8]">{q.handle}</span></div>
                  <span className="font-mono text-[10px] text-slate-500">{new Date(q.submittedAt).toLocaleString()}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
                  <a href={`mailto:${q.email}`} className="inline-flex items-center gap-1 text-[#005FB8]"><Mail className="w-3 h-3" /> {q.email}</a>
                  {q.followers ? <span>{q.followers.toLocaleString()} followers</span> : null}
                  {q.platforms?.length > 0 && <span>{q.platforms.join(', ')}</span>}
                  {q.niche && <span>{q.niche}</span>}
                  <span>{q.inUS ? 'In the US' : 'Outside the US'}</span>
                </div>
                {q.notes && <p className="mt-1 text-slate-700 whitespace-pre-wrap">{q.notes}</p>}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
};
