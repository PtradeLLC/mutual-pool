import React, { useEffect, useState } from 'react';
import { Landmark, ShieldCheck, Link2, ArrowDownToLine, Copy, Check, RefreshCw, AlertCircle, Eye, EyeOff } from 'lucide-react';
import type { User } from '../types';

// The member's own bank account at Column: open it, link an external bank,
// fund it by ACH, and show the direct-deposit details. Identity fields are
// posted straight to the server, which forwards them to the bank and keeps
// only the bank's ids. Rendered inside the Add Funds flow when the server
// reports custody mode "column".

interface CustodyStatus {
  mode: 'ledger' | 'column';
  account: {
    status: 'PENDING' | 'VERIFIED' | 'MANUAL_REVIEW' | 'DENIED' | 'FROZEN';
    accountNumberLast4: string;
    routingNumber: string;
    externalBankLast4: string | null;
    externalBankName: string | null;
    openedAt: string;
  } | null;
  balances: { availableUsd: number; pendingUsd: number; ledgerUsd: number } | null;
  directDeposit: { routingNumber: string; accountNumber: string } | null;
  movements: Array<{ id: string; purpose: string; amountUsd: number; status: string; description: string; createdAt: string }>;
}

interface Props {
  user: User;
  onUpdated?: () => void;
}

const readJson = async (res: Response) => { const t = await res.text().catch(() => ''); try { return t ? JSON.parse(t) : {}; } catch { return { message: t.slice(0, 200) }; } };
const field = 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-[#005FB8]';
const label = 'block text-[11px] font-bold text-slate-600 mb-1';

export const CustodyAccountPanel: React.FC<Props> = ({ user, onUpdated }) => {
  const [status, setStatus] = useState<CustodyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Open-account form
  const names = (user.name || user.displayName || '').trim().split(/\s+/);
  const [firstName, setFirstName] = useState(names[0] || '');
  const [lastName, setLastName] = useState(names.slice(1).join(' '));
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [ssn, setSsn] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState(user.city || '');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  // Link-bank form
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  // Fund form
  const [fundAmount, setFundAmount] = useState('100');

  const load = async (opts: { sync?: boolean; reveal?: boolean } = {}) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (opts.sync) q.set('sync', '1');
      if (opts.reveal) q.set('reveal', '1');
      const res = await fetch(`/api/users/custody?${q.toString()}`);
      const data = await readJson(res);
      if (res.ok) setStatus(data);
      else setError(data.message || 'Could not load your bank account.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (path: string, body: unknown, okNotice: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.message || 'The bank could not complete the request.');
      setNotice(okNotice);
      setSsn('');
      await load();
      onUpdated?.();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  if (loading && !status) {
    return <div className="p-4 text-xs text-slate-500 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading your bank account…</div>;
  }
  // Ledger mode (bank-held member accounts not live yet): show the bank links that do
  // exist today so the member is never left with an empty panel.
  if (!status || status.mode !== 'column') return <LedgerBankLinks user={user} />;

  const acct = status.account;

  return (
    <div className="space-y-4 text-xs text-slate-700">
      {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
      {notice && <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2"><Check className="w-4 h-4 shrink-0 mt-0.5" /><span>{notice}</span></div>}

      {/* 1. Open the account */}
      {!acct && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await post('/api/users/custody/account', { firstName, lastName, dateOfBirth, ssn, phone, address: { line1, line2, city, state, postalCode } }, 'Your MutualPool bank account is open.');
          }}
        >
          <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900"><Landmark className="w-4 h-4 text-[#005FB8]" /> Open your MutualPool bank account</div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Your balance is held in a bank account in your own name at Column, N.A., an FDIC-insured bank. The bank needs these details to open it. They go directly to the bank; MutualPool does not store your Social Security Number.
          </p>
          {user.kycStatus !== 'VERIFIED' && <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">Verify your identity first, then come back here.</div>}
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>First name</label><input className={field} value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
            <div><label className={label}>Last name</label><input className={field} value={lastName} onChange={e => setLastName(e.target.value)} required /></div>
            <div><label className={label}>Date of birth</label><input className={field} type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required /></div>
            <div><label className={label}>SSN or ITIN</label><input className={field} inputMode="numeric" autoComplete="off" placeholder="123-45-6789" value={ssn} onChange={e => setSsn(e.target.value)} required /></div>
            <div className="col-span-2"><label className={label}>Street address</label><input className={field} value={line1} onChange={e => setLine1(e.target.value)} required /></div>
            <div className="col-span-2"><label className={label}>Apartment, unit (optional)</label><input className={field} value={line2} onChange={e => setLine2(e.target.value)} /></div>
            <div><label className={label}>City</label><input className={field} value={city} onChange={e => setCity(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={label}>State</label><input className={field} maxLength={2} placeholder="TX" value={state} onChange={e => setState(e.target.value.toUpperCase())} required /></div>
              <div><label className={label}>ZIP</label><input className={field} inputMode="numeric" value={postalCode} onChange={e => setPostalCode(e.target.value)} required /></div>
            </div>
            <div className="col-span-2"><label className={label}>Mobile phone (optional)</label><input className={field} type="tel" placeholder="+15551234567" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          </div>
          <button type="submit" disabled={busy || user.kycStatus !== 'VERIFIED'} className="w-full py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">
            <ShieldCheck className="w-4 h-4" /> {busy ? 'Opening…' : 'Open my account'}
          </button>
        </form>
      )}

      {acct && (
        <>
          {/* Account status */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900"><Landmark className="w-4 h-4 text-[#005FB8]" /> MutualPool account ••••{acct.accountNumberLast4}</div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${acct.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : acct.status === 'DENIED' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-amber-50 text-amber-900 border-amber-200'}`}>{acct.status.replace('_', ' ')}</span>
            </div>
            <div className="text-[11px] text-slate-600">Held in your name at Column, N.A. (FDIC insured). Routing {acct.routingNumber}.</div>
            {status.balances && (
              <div className="text-[11px] font-mono text-slate-700">Bank available ${status.balances.availableUsd.toFixed(2)} · pending ${status.balances.pendingUsd.toFixed(2)} · app balance ${status.balances.ledgerUsd.toFixed(2)}</div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => load({ sync: true, reveal })} className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh from bank</button>
              {acct.status === 'VERIFIED' && (
                <button type="button" onClick={() => { const next = !reveal; setReveal(next); load({ reveal: next }); }} className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                  {reveal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {reveal ? 'Hide' : 'Show'} direct-deposit details
                </button>
              )}
            </div>
            {reveal && status.directDeposit && (
              <div className="mt-1 p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] space-y-1">
                <div className="font-sans text-[11px] text-slate-600">Give these to DoorDash, Uber or any employer to send payouts straight into your MutualPool account:</div>
                <div className="flex items-center justify-between"><span>Routing {status.directDeposit.routingNumber}</span><button type="button" onClick={() => copy(status.directDeposit!.routingNumber, 'r')} className="text-[#005FB8] cursor-pointer">{copied === 'r' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button></div>
                <div className="flex items-center justify-between"><span>Account {status.directDeposit.accountNumber}</span><button type="button" onClick={() => copy(status.directDeposit!.accountNumber, 'a')} className="text-[#005FB8] cursor-pointer">{copied === 'a' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button></div>
              </div>
            )}
          </div>

          {/* 2. Link an external bank */}
          {acct.status === 'VERIFIED' && (
            <form className="p-3 rounded-xl border border-slate-200 space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await post('/api/users/custody/external-bank', { accountNumber, routingNumber, accountType }, 'Bank linked.')) { setAccountNumber(''); setRoutingNumber(''); } }}>
              <div className="flex items-center gap-2 font-bold text-slate-900"><Link2 className="w-4 h-4 text-[#005FB8]" /> {acct.externalBankLast4 ? `Linked bank ••••${acct.externalBankLast4}` : 'Link your bank for funding and withdrawals'}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={label}>Routing number</label><input className={field} inputMode="numeric" maxLength={9} value={routingNumber} onChange={e => setRoutingNumber(e.target.value)} required /></div>
                <div><label className={label}>Account number</label><input className={field} inputMode="numeric" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required /></div>
                <div className="col-span-2 flex items-center gap-3 text-[11px]">
                  <label className="flex items-center gap-1"><input type="radio" checked={accountType === 'checking'} onChange={() => setAccountType('checking')} /> Checking</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={accountType === 'savings'} onChange={() => setAccountType('savings')} /> Savings</label>
                </div>
              </div>
              <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-white hover:bg-blue-50 border border-blue-300 text-[#005FB8] font-bold text-xs cursor-pointer disabled:opacity-50">{acct.externalBankLast4 ? 'Replace linked bank' : 'Link bank'}</button>
            </form>
          )}

          {/* 3. Fund from the linked bank */}
          {acct.status === 'VERIFIED' && acct.externalBankLast4 && (
            <form className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2" onSubmit={async (e) => { e.preventDefault(); await post('/api/users/custody/fund', { amount: Number(fundAmount) }, `Transfer started. It usually arrives in 1 to 2 business days and is added to your balance when it settles.`); }}>
              <div className="flex items-center gap-2 font-bold text-slate-900"><ArrowDownToLine className="w-4 h-4 text-emerald-700" /> Add money from your bank ••••{acct.externalBankLast4}</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">$</span>
                <input className={field} inputMode="decimal" value={fundAmount} onChange={e => setFundAmount(e.target.value)} />
                <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50 whitespace-nowrap">{busy ? 'Starting…' : 'Transfer'}</button>
              </div>
              <div className="text-[10.5px] text-slate-600">No fee. ACH transfers take 1 to 2 business days; your bank can reverse an unauthorized transfer for up to 60 days.</div>
            </form>
          )}

          {/* Recent movements */}
          {status.movements.length > 0 && (
            <div className="p-3 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-900 mb-1.5">Recent activity</div>
              <ul className="space-y-1 font-mono text-[11px]">
                {status.movements.slice(0, 8).map(m => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-600">{m.purpose.replace(/_/g, ' ').toLowerCase()} · {m.description}</span>
                    <span className={`shrink-0 ${m.status === 'SETTLED' ? 'text-slate-900' : m.status === 'PENDING' ? 'text-amber-700' : 'text-rose-700'}`}>${m.amountUsd.toFixed(2)} {m.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};


/**
 * Shown while custody runs in ledger mode. The member can still link a bank for
 * authorized weekly debits and set up the payout bank; direct-deposit numbers arrive
 * with the bank-held MutualPool account.
 */
const LedgerBankLinks: React.FC<{ user: User }> = ({ user }) => {
  const [busy, setBusy] = useState<'MANDATE' | 'PAYOUT' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mandate = user.debitMandate;
  const payoutBank = user.externalBank;

  const open = async (kind: 'MANDATE' | 'PAYOUT') => {
    setBusy(kind); setErr(null);
    try {
      const path = kind === 'MANDATE' ? '/api/users/debit-mandate/checkout-session' : '/api/users/connect/onboarding-link';
      const res = await fetch(path, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.message || 'Could not open the bank setup page.');
      window.location.assign(data.url);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not open the bank setup page.');
      setBusy(null);
    }
  };

  const mandateLabel = mandate?.status === 'ACTIVE'
    ? `${mandate.bankName || 'Bank'} ••••${mandate.last4 || ''} authorized for weekly debits`
    : mandate?.status === 'PENDING' ? 'Verification pending (micro-deposits)'
    : mandate?.status === 'FAILED' ? 'Authorization failed, please try again'
    : 'Not linked yet';
  const payoutLabel = payoutBank?.status === 'LINKED'
    ? `${payoutBank.bankName || 'Bank'} ••••${payoutBank.last4 || ''}`
    : payoutBank?.status === 'PENDING_VERIFICATION' ? 'Pending verification'
    : 'Not set up yet';

  return (
    <div className="space-y-3 text-xs text-slate-700">
      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Your bank</div>

      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Bank for weekly deposits</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{mandateLabel}</div>
          </div>
          <button type="button" disabled={busy !== null} onClick={() => open('MANDATE')}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-[11px]">
            {busy === 'MANDATE' ? 'Opening…' : mandate?.status === 'ACTIVE' ? 'Change bank' : 'Link bank'}
          </button>
        </div>
        <p className="text-[11px] text-slate-500">You authorize MutualPool to debit a missed weekly deposit from this account. Required to create or join a pod.</p>
      </div>

      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900"><ArrowDownToLine className="w-4 h-4 text-[#005FB8]" /> Payout bank</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{payoutLabel}</div>
          </div>
          <button type="button" disabled={busy !== null} onClick={() => open('PAYOUT')}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-800 font-bold text-[11px]">
            {busy === 'PAYOUT' ? 'Opening…' : payoutBank?.status === 'LINKED' ? 'Manage' : 'Set up'}
          </button>
        </div>
        <p className="text-[11px] text-slate-500">Where withdrawals from your MutualPool balance are sent.</p>
      </div>

      <div className="p-3 rounded-xl border border-dashed border-slate-300 flex items-start gap-2">
        <Landmark className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-600">
          <span className="font-bold text-slate-800">Direct deposit is coming.</span> Your own MutualPool account and routing numbers, so an employer or gig platform can pay you straight into your balance, arrive with the bank-held account. Until then, fund your balance by card below.
        </p>
      </div>

      {err && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {err}</div>}
    </div>
  );
};
