import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Landmark, CheckCircle2, AlertCircle, Loader2, Lock } from 'lucide-react';

// Bank payments setup (Dwolla): 1) verify the member's identity details with
// Dwolla, 2) show Dwolla's debit authorization and link a bank (pressing the
// authorization button is the member's consent), 3) done.
// The server keeps the exact authorization text, time, IP and browser.

export interface BankPaymentsStatus {
  enabled: boolean;
  env?: 'sandbox' | 'production';
  customerStatus: string | null;
  bankStatus?: string | null;
  bankName?: string | null;
  ready?: boolean;
}

interface Props {
  status: BankPaymentsStatus;
  onClose: () => void;
  /** Called with the fresh status after each step. */
  onUpdated: (status: BankPaymentsStatus) => void;
}

type Step = 'details' | 'bank' | 'review' | 'done';

const US_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' ');

async function postJson(url: string, body?: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

function stepFor(s: BankPaymentsStatus): Step {
  if (s.ready) return 'done';
  if (s.customerStatus === 'verified') return 'bank';
  if (s.customerStatus) return 'review';
  return 'details';
}

export const PaymentSetupModal: React.FC<Props> = ({ status, onClose, onUpdated }) => {
  const [step, setStep] = useState<Step>(() => stepFor(status));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 fields (the SSN last four are sent to Dwolla and never stored by MutualPool).
  const [form, setForm] = useState({ firstName: '', lastName: '', address1: '', address2: '', city: '', state: '', postalCode: '', dateOfBirth: '', ssnLast4: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Step 2: authorization + bank.
  const [auth, setAuth] = useState<{ authorizationId: string; bodyText: string; buttonText: string } | null>(null);
  const sandbox = status.env !== 'production';
  const [bank, setBank] = useState({ routingNumber: sandbox ? '222222226' : '', accountNumber: sandbox ? String(Math.floor(1e8 + Math.random() * 9e8)) : '', bankAccountType: 'checking' as 'checking' | 'savings', name: 'Checking' });

  useEffect(() => {
    if (step !== 'bank' || auth) return;
    let cancelled = false;
    (async () => {
      try {
        const a = await postJson('/api/dwolla/authorization');
        if (!cancelled) setAuth(a);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the authorization.');
      }
    })();
    return () => { cancelled = true; };
  }, [step, auth]);

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await postJson('/api/dwolla/customer', form);
      onUpdated(s);
      setForm(f => ({ ...f, ssnLast4: '' }));
      setStep(stepFor(s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify your details.');
    } finally {
      setBusy(false);
    }
  };

  const submitBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setBusy(true);
    setError(null);
    try {
      const s = await postJson('/api/dwolla/bank', { authorizationId: auth.authorizationId, ...bank });
      onUpdated(s);
      setStep(stepFor(s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link your bank.');
      setAuth(null); // a used or expired authorization is replaced on retry
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await postJson('/api/dwolla/refresh');
      onUpdated(s);
      setStep(stepFor(s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-2 rounded-lg border border-[#DDE1E6] text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#005FB8]/30';
  const label = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';
  const primary = 'w-full py-2.5 rounded-xl bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-900 font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer';
  const stepIndex = step === 'details' || step === 'review' ? 1 : step === 'bank' ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-[#111827] max-h-[92vh] overflow-y-auto my-auto">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-1 pr-8">
          <div className="p-3 rounded-xl bg-blue-50 text-[#005FB8] border border-blue-100"><Landmark className="w-6 h-6" /></div>
          <div>
            <h3 className="text-lg font-bold">Set up bank payments</h3>
            <p className="text-xs text-[#6B7280]">Step {stepIndex} of 3 · Payments are processed by Dwolla</p>
          </div>
        </div>
        <p className="text-[11.5px] text-slate-600 mt-3 mb-4 leading-relaxed">
          Your weekly contributions are debited from your bank and your payouts land in your MutualPool balance, held by Dwolla's partner bank. MutualPool never holds your money.
        </p>

        {error && (
          <div role="alert" className="mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {step === 'details' && (
          <form onSubmit={submitDetails} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><label className={label}>Legal first name</label><input className={input} value={form.firstName} onChange={set('firstName')} required autoComplete="given-name" /></div>
              <div><label className={label}>Legal last name</label><input className={input} value={form.lastName} onChange={set('lastName')} required autoComplete="family-name" /></div>
            </div>
            <div><label className={label}>Home address (no PO boxes)</label><input className={input} value={form.address1} onChange={set('address1')} required autoComplete="address-line1" /></div>
            <div><label className={label}>Apt / unit (optional)</label><input className={input} value={form.address2} onChange={set('address2')} autoComplete="address-line2" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1"><label className={label}>City</label><input className={input} value={form.city} onChange={set('city')} required autoComplete="address-level2" /></div>
              <div><label className={label}>State</label>
                <select className={input} value={form.state} onChange={set('state')} required autoComplete="address-level1">
                  <option value="">—</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={label}>ZIP</label><input className={input} value={form.postalCode} onChange={set('postalCode')} required inputMode="numeric" autoComplete="postal-code" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={label}>Date of birth</label><input type="date" className={input} value={form.dateOfBirth} onChange={set('dateOfBirth')} required autoComplete="bday" /></div>
              <div><label className={label}>SSN (last 4)</label><input className={input} value={form.ssnLast4} onChange={set('ssnLast4')} required inputMode="numeric" maxLength={4} pattern="\d{4}" autoComplete="off" /></div>
            </div>
            <p className="text-[11px] text-slate-500 flex items-start gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />Sent securely to Dwolla to verify your identity, as required by law. MutualPool does not store your SSN.</p>
            <button type="submit" disabled={busy} className={primary}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Verify my details
            </button>
          </form>
        )}

        {step === 'review' && (
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              {status.customerStatus === 'document'
                ? 'Dwolla needs a photo ID to finish verifying you. Our team will contact you by email with next steps.'
                : status.customerStatus === 'suspended' || status.customerStatus === 'deactivated'
                  ? 'Your payment account is on hold. Please contact MutualPool support.'
                  : 'Dwolla could not verify your details automatically. Our team will contact you by email to complete verification.'}
            </div>
            <button type="button" onClick={refresh} disabled={busy} className={primary}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Check status again
            </button>
          </div>
        )}

        {step === 'bank' && (
          <form onSubmit={submitBank} className="space-y-3">
            {!sandbox ? (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                Secure bank linking through Plaid is coming soon. You'll be able to finish this step shortly.
              </div>
            ) : (
              <>
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">Test mode: use the prefilled test bank numbers.</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={label}>Routing number</label><input className={input} value={bank.routingNumber} onChange={e => setBank(b => ({ ...b, routingNumber: e.target.value }))} required inputMode="numeric" /></div>
                  <div><label className={label}>Account number</label><input className={input} value={bank.accountNumber} onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))} required inputMode="numeric" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={label}>Account type</label>
                    <select className={input} value={bank.bankAccountType} onChange={e => setBank(b => ({ ...b, bankAccountType: e.target.value as 'checking' | 'savings' }))}>
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                    </select>
                  </div>
                  <div><label className={label}>Nickname</label><input className={input} value={bank.name} onChange={e => setBank(b => ({ ...b, name: e.target.value }))} maxLength={50} /></div>
                </div>
              </>
            )}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11.5px] text-slate-700 leading-relaxed">
              {auth ? auth.bodyText : <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading authorization…</span>}
            </div>
            <p className="text-[11px] text-slate-500">Each week, once your pod is running, you'll be debited your contribution plus a 5% non-refundable reserve fee (except in your payout week).</p>
            <button type="submit" disabled={busy || !auth || !sandbox} className={primary}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{auth?.buttonText || 'Agree & Continue'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center space-y-3 py-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <p className="font-bold">Bank payments are set up</p>
            <p className="text-xs text-slate-600">{status.bankName ? `${status.bankName} is linked. ` : ''}You can now create and join pods. Nothing is charged until a pod is full.</p>
            <button type="button" onClick={onClose} className={primary}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSetupModal;
