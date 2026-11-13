import React, { useEffect, useMemo, useState } from 'react';
import { X, Target, Wallet, Receipt, Plus, Pencil, Trash2, AlertTriangle, Info, Lock, CheckCircle2, Users, PlusCircle, HandCoins } from 'lucide-react';
import { useTranslation, TranslationKey } from '../i18n';
import {
  PAY_FREQUENCIES, SAVINGS_PURPOSES, MAX_EXPENSES, MAX_EXPENSE_NAME, MAX_PURPOSE_TEXT,
  computeEstimate, dollarsToCents, centsToInput, formatCents, monthlyEquivalentCents, profileIsComplete,
} from '../lib/financialAwareness';
import type { PayFrequency, SavingsPurposeId, FinancialProfileView, SavingsRangeView } from '../lib/financialAwareness';

interface FinancialAwarenessModalProps {
  isOpen: boolean;
  onClose: () => void;
  // The saved profile changed (so the dashboard can refresh).
  onSaved?: (view: FinancialProfileView) => void;
  onJoinPod: () => void;
  onCreatePod: (view: FinancialProfileView) => void;
}

interface ExpenseRow {
  key: string;
  id?: string;
  name: string;
  amountCents: number;
  frequency: PayFrequency;
}

const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005FB8]';
const labelClass = 'text-xs font-bold text-slate-800';

export function savingsRangeLabel(t: (key: TranslationKey, params?: Record<string, string | number>) => string, range: SavingsRangeView): string {
  return range.maxWeeklyCents === null
    ? t('fa.rangeLabelOpen', { name: range.name, min: formatCents(range.minWeeklyCents) })
    : t('fa.rangeLabel', { name: range.name, min: formatCents(range.minWeeklyCents), max: formatCents(range.maxWeeklyCents) });
}

let rowSeq = 0;
const newKey = () => `row_${Date.now()}_${++rowSeq}`;

export const FinancialAwarenessModal: React.FC<FinancialAwarenessModalProps> = ({ isOpen, onClose, onSaved, onJoinPod, onCreatePod }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'form' | 'summary'>('form');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<FinancialProfileView | null>(null);

  const [targetInput, setTargetInput] = useState('');
  const [purpose, setPurpose] = useState<SavingsPurposeId>('EMERGENCY_FUND');
  const [purposeText, setPurposeText] = useState('');
  const [payInput, setPayInput] = useState('');
  const [incomeFrequency, setIncomeFrequency] = useState<PayFrequency>('WEEKLY');
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [commitmentInput, setCommitmentInput] = useState('');

  // The add / edit expense row.
  const [draftName, setDraftName] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [draftFrequency, setDraftFrequency] = useState<PayFrequency>('MONTHLY');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const fillFrom = (v: FinancialProfileView) => {
    const p = v.profile;
    setTargetInput(p ? centsToInput(p.targetSavingsCents) : '');
    setPurpose(p ? p.savingsPurpose : 'EMERGENCY_FUND');
    setPurposeText(p?.savingsPurposeText || '');
    setPayInput(p ? centsToInput(p.takeHomePayCents) : '');
    setIncomeFrequency(p ? p.incomeFrequency : 'WEEKLY');
    setExpenses((p?.expenses || []).map(e => ({ key: e.id, id: e.id, name: e.name, amountCents: e.amountCents, frequency: e.frequency })));
    setCommitmentInput(p ? centsToInput(p.confirmedWeeklyCommitmentCents) : '');
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditingKey(null);
    setDraftName(''); setDraftAmount(''); setDraftFrequency('MONTHLY'); setDraftError(null);
    (async () => {
      try {
        const res = await fetch('/api/financial-profile', { headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data) throw new Error('load');
        setView(data);
        fillFrom(data);
        setStep(data.profile?.completionStatus === 'COMPLETE' ? 'summary' : 'form');
      } catch {
        if (!cancelled) { setError(t('fa.loadError')); setStep('form'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const targetCents = dollarsToCents(targetInput);
  const payCents = dollarsToCents(payInput);
  const commitmentCents = dollarsToCents(commitmentInput);

  const estimate = useMemo(
    () => computeEstimate({ takeHomePayCents: payCents || 0, incomeFrequency, expenses }),
    [payCents, incomeFrequency, expenses],
  );

  if (!isOpen) return null;

  const resetDraft = () => {
    setDraftName(''); setDraftAmount(''); setDraftFrequency('MONTHLY'); setEditingKey(null); setDraftError(null);
  };

  const submitDraft = () => {
    const name = draftName.trim();
    const amountCents = dollarsToCents(draftAmount);
    if (!name) { setDraftError(t('fa.errName')); return; }
    if (amountCents === null || amountCents <= 0) { setDraftError(t('fa.errAmount')); return; }
    if (editingKey) {
      setExpenses(prev => prev.map(e => (e.key === editingKey ? { ...e, name, amountCents, frequency: draftFrequency } : e)));
    } else {
      if (expenses.length >= MAX_EXPENSES) return;
      setExpenses(prev => [...prev, { key: newKey(), name, amountCents, frequency: draftFrequency }]);
    }
    resetDraft();
  };

  const startEdit = (row: ExpenseRow) => {
    setEditingKey(row.key);
    setDraftName(row.name);
    setDraftAmount(centsToInput(row.amountCents));
    setDraftFrequency(row.frequency);
    setDraftError(null);
  };

  const removeExpense = (key: string) => {
    setExpenses(prev => prev.filter(e => e.key !== key));
    if (editingKey === key) resetDraft();
  };

  const canSave = targetCents !== null && payCents !== null && commitmentCents !== null
    && profileIsComplete({
      targetSavingsCents: targetCents,
      savingsPurpose: purpose,
      savingsPurposeText: purposeText.trim() || undefined,
      takeHomePayCents: payCents,
      confirmedWeeklyCommitmentCents: commitmentCents,
    });

  const handleSave = async () => {
    if (!canSave) { setError(t('fa.errRequired')); return; }
    // An expense typed but not yet added is included, never silently dropped.
    let rows = expenses;
    if (draftName.trim() || draftAmount.trim()) {
      const name = draftName.trim();
      const amountCents = dollarsToCents(draftAmount);
      if (!name) { setDraftError(t('fa.errName')); return; }
      if (amountCents === null || amountCents <= 0) { setDraftError(t('fa.errAmount')); return; }
      rows = editingKey
        ? expenses.map(e => (e.key === editingKey ? { ...e, name, amountCents, frequency: draftFrequency } : e))
        : [...expenses, { key: newKey(), name, amountCents, frequency: draftFrequency }];
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/financial-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          targetSavingsCents: targetCents,
          savingsPurpose: purpose,
          savingsPurposeText: purpose === 'CUSTOM' ? purposeText.trim() : undefined,
          takeHomePayCents: payCents,
          incomeFrequency,
          expenses: rows.map(e => ({ id: e.id, name: e.name, amountCents: e.amountCents, frequency: e.frequency })),
          confirmedWeeklyCommitmentCents: commitmentCents,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.profile) throw new Error(data?.message || t('fa.saveError'));
      setView(data);
      fillFrom(data);
      resetDraft();
      setStep('summary');
      onSaved?.(data);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('fa.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const purposeLabel = (id: SavingsPurposeId, text?: string) => (id === 'CUSTOM' && text ? text : t(`fa.purpose.${id}` as TranslationKey));
  const freqLabel = (f: PayFrequency) => t(`fa.freq.${f}` as TranslationKey);
  const commitmentAboveEstimate = !estimate.incomplete && commitmentCents !== null && commitmentCents > estimate.proposedWeeklySavingsCents;

  const frequencySelect = (value: PayFrequency, onChange: (f: PayFrequency) => void, id: string) => (
    <select id={id} value={value} onChange={e => onChange(e.target.value as PayFrequency)} className={inputClass}>
      {PAY_FREQUENCIES.map(f => <option key={f} value={f}>{freqLabel(f)}</option>)}
    </select>
  );

  const moneyInput = (id: string, value: string, onChange: (v: string) => void, placeholder: string) => (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-7 font-mono`}
        aria-invalid={value.trim() !== '' && dollarsToCents(value) === null}
      />
    </div>
  );

  const summary = view?.profile && step === 'summary' ? view : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="fa-title">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} aria-label="Close" className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1 pr-10">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-[#005FB8]">{t('principle.awareness')}</span>
          <h2 id="fa-title" className="text-xl font-black text-slate-950">{summary ? t('fa.summaryTitle') : t('fa.title')}</h2>
          {!summary && <p className="text-xs text-slate-500">{t('fa.intro')}</p>}
        </div>

        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
          <span>{t('fa.private')}</span>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500">…</div>
        ) : summary ? (
          /* ---------------- SUMMARY ---------------- */
          <div className="mt-4 space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t('fa.saved')}</span>
            </div>

            <dl className="rounded-2xl border border-slate-200 divide-y divide-slate-100 text-sm">
              {([
                [t('fa.sumGoal'), purposeLabel(summary.profile!.savingsPurpose, summary.profile!.savingsPurposeText)],
                [t('fa.sumTarget'), formatCents(summary.profile!.targetSavingsCents)],
                [t('fa.sumIncome'), `${formatCents(summary.profile!.takeHomePayCents)} · ${freqLabel(summary.profile!.incomeFrequency)}`],
                [t('fa.sumExpenses'), formatCents(summary.profile!.totalMonthlyExpensesCents)],
                [t('fa.sumRemaining'), formatCents(summary.profile!.estimatedRemainingIncomeCents)],
                [t('fa.sumCommitment'), t('fa.perWeek', { amount: formatCents(summary.profile!.confirmedWeeklyCommitmentCents) })],
              ] as Array<[string, string]>).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="font-bold text-slate-900 text-right font-mono text-[13px]">{value}</dd>
                </div>
              ))}
            </dl>

            {summary.estimate?.expensesExceedIncome && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{t('fa.warnExceed', { amount: formatCents(-summary.profile!.estimatedRemainingIncomeCents) })}</span>
              </div>
            )}
            {!summary.estimate?.expensesExceedIncome && summary.estimate?.missingExpenses && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{t('fa.warnIncompleteExpenses')}</span>
              </div>
            )}
            {!summary.estimate?.expensesExceedIncome && summary.commitmentExceedsEstimate && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{t('fa.warnCommitment', { amount: formatCents(summary.estimate?.proposedWeeklySavingsCents || 0) })}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#005FB8]">{t('fa.sumRange')}</div>
              {summary.savingsRange ? (
                <>
                  <div className="text-base font-black text-slate-950 mt-0.5">{savingsRangeLabel(t, summary.savingsRange)}</div>
                  {summary.weeksToGoal !== null && <div className="text-xs text-slate-600 mt-1">{t('fa.sumWeeks', { weeks: summary.weeksToGoal })}</div>}
                </>
              ) : (
                <>
                  <div className="text-base font-black text-slate-950 mt-0.5">{t('fa.noRange')}</div>
                  <div className="text-xs text-slate-600 mt-1">{t('fa.noRangeHelp')}</div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800">{t('fa.nextTitle')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={onJoinPod} className="py-3 rounded-xl bg-[#005FB8] hover:bg-[#004A94] text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer">
                  <Users className="w-4 h-4" /> {t('fa.joinPod')}
                </button>
                <button type="button" onClick={() => onCreatePod(summary)} className="py-3 rounded-xl border border-[#005FB8] text-[#005FB8] hover:bg-blue-50 font-black text-sm flex items-center justify-center gap-2 cursor-pointer">
                  <PlusCircle className="w-4 h-4" /> {t('fa.createPod')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setStep('form'); setError(null); }} className="px-4 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                <Pencil className="w-3.5 h-3.5" /> {t('fa.back')}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer">{t('fa.done')}</button>
            </div>
          </div>
        ) : (
          /* ---------------- FORM ---------------- */
          <div className="mt-4 space-y-6">
            {/* A. Savings goal */}
            <section className="space-y-3">
              <h3 className="text-sm font-black text-slate-950 flex items-center gap-2"><Target className="w-4 h-4 text-[#005FB8]" /> {t('fa.sectionGoal')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="fa-target" className={labelClass}>{t('fa.target')}</label>
                  {moneyInput('fa-target', targetInput, setTargetInput, '2,000')}
                  <p className="text-[11px] text-slate-500">{t('fa.targetHint')}</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="fa-purpose" className={labelClass}>{t('fa.purpose')}</label>
                  <select id="fa-purpose" value={purpose} onChange={e => setPurpose(e.target.value as SavingsPurposeId)} className={inputClass}>
                    {SAVINGS_PURPOSES.map(p => <option key={p} value={p}>{t(`fa.purpose.${p}` as TranslationKey)}</option>)}
                  </select>
                  {purpose === 'CUSTOM' ? (
                    <input
                      type="text"
                      value={purposeText}
                      maxLength={MAX_PURPOSE_TEXT}
                      onChange={e => setPurposeText(e.target.value)}
                      placeholder={t('fa.purposeCustomPlaceholder')}
                      aria-label={t('fa.purposeCustomPlaceholder')}
                      className={inputClass}
                    />
                  ) : (
                    <p className="text-[11px] text-slate-500">{t('fa.purposeHint')}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="fa-pay" className={labelClass}>{t('fa.pay')}</label>
                  {moneyInput('fa-pay', payInput, setPayInput, '700')}
                  <p className="text-[11px] text-slate-500">{t('fa.payHint')}</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="fa-income-frequency" className={labelClass}>{t('fa.incomeFrequency')}</label>
                  {frequencySelect(incomeFrequency, setIncomeFrequency, 'fa-income-frequency')}
                </div>
              </div>
            </section>

            {/* B. Bills and expenses */}
            <section className="space-y-3">
              <h3 className="text-sm font-black text-slate-950 flex items-center gap-2"><Receipt className="w-4 h-4 text-[#005FB8]" /> {t('fa.sectionExpenses')}</h3>

              {expenses.length === 0 ? (
                <p className="text-xs text-slate-500 p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50">{t('fa.noExpenses')}</p>
              ) : (
                <ul className="rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {expenses.map(row => (
                    <li key={row.key} className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${editingKey === row.key ? 'bg-blue-50/60' : ''}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{row.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatCents(row.amountCents)} · {freqLabel(row.frequency)}
                          {row.frequency !== 'MONTHLY' && <> · {t('fa.perMonth', { amount: formatCents(monthlyEquivalentCents(row.amountCents, row.frequency)) })}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => startEdit(row)} aria-label={`${t('fa.edit')}: ${row.name}`} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#005FB8] cursor-pointer">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => removeExpense(row.key)} aria-label={`${t('fa.remove')}: ${row.name}`} className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-2">
                  <input
                    type="text"
                    value={draftName}
                    maxLength={MAX_EXPENSE_NAME}
                    onChange={e => setDraftName(e.target.value)}
                    placeholder={t('fa.expenseNamePlaceholder')}
                    aria-label={t('fa.expenseName')}
                    className={`${inputClass} bg-white`}
                  />
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draftAmount}
                      onChange={e => setDraftAmount(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitDraft(); } }}
                      placeholder="0"
                      aria-label={t('fa.expenseAmount')}
                      className={`${inputClass} bg-white pl-7 font-mono`}
                    />
                  </div>
                  <select value={draftFrequency} onChange={e => setDraftFrequency(e.target.value as PayFrequency)} aria-label={t('fa.expenseFrequency')} className={`${inputClass} bg-white`}>
                    {PAY_FREQUENCIES.map(f => <option key={f} value={f}>{freqLabel(f)}</option>)}
                  </select>
                </div>
                {draftError && <p className="text-[11px] text-rose-600 font-semibold" role="alert">{draftError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={submitDraft}
                    disabled={!editingKey && expenses.length >= MAX_EXPENSES}
                    className="px-3.5 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004A94] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {editingKey ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {editingKey ? t('fa.saveExpense') : t('fa.addExpense')}
                  </button>
                  {editingKey && (
                    <button type="button" onClick={resetDraft} className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold text-xs cursor-pointer">{t('fa.cancelEdit')}</button>
                  )}
                </div>
              </div>

              {/* Live totals */}
              <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 text-sm" aria-live="polite">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-slate-500">{t('fa.monthlyIncome')}</span>
                  <span className="font-bold font-mono text-slate-900">{formatCents(estimate.monthlyIncomeCents)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-slate-500">{t('fa.totalExpenses')}</span>
                  <span className="font-bold font-mono text-slate-900">{formatCents(estimate.totalMonthlyExpensesCents)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-b-2xl">
                  <span className="text-xs font-bold text-slate-800">{t('fa.remaining')}</span>
                  <span className={`text-base font-black font-mono ${estimate.missingIncome ? 'text-slate-400' : estimate.expensesExceedIncome ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {estimate.missingIncome ? '—' : formatCents(estimate.estimatedRemainingIncomeCents)}
                  </span>
                </div>
              </div>

              {estimate.missingIncome ? (
                <p className="text-[11px] text-amber-800 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t('fa.warnIncompleteIncome')}</p>
              ) : estimate.expensesExceedIncome ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{t('fa.warnExceed', { amount: formatCents(-estimate.estimatedRemainingIncomeCents) })}</span>
                </div>
              ) : estimate.missingExpenses ? (
                <p className="text-[11px] text-amber-800 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t('fa.warnIncompleteExpenses')}</p>
              ) : (
                <p className="text-[11px] text-slate-500 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t('fa.remainingNote')}</p>
              )}
            </section>

            {/* C. Commitment */}
            <section className="space-y-3">
              <h3 className="text-sm font-black text-slate-950 flex items-center gap-2"><HandCoins className="w-4 h-4 text-[#005FB8]" /> {t('fa.sectionCommitment')}</h3>
              <div className="space-y-1.5 max-w-xs">
                <label htmlFor="fa-commitment" className={labelClass}>{t('fa.commitment')}</label>
                {moneyInput('fa-commitment', commitmentInput, setCommitmentInput, '20')}
              </div>
              <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                <Wallet className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {t('fa.commitmentHint')}
                  {!estimate.incomplete && estimate.proposedWeeklySavingsCents > 0 && <> {t('fa.suggested', { amount: formatCents(estimate.proposedWeeklySavingsCents) })}</>}
                </span>
              </p>
              {commitmentAboveEstimate && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>{t('fa.warnCommitment', { amount: formatCents(estimate.proposedWeeklySavingsCents) })}</span>
                </div>
              )}
            </section>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button type="button" onClick={view?.profile?.completionStatus === 'COMPLETE' ? () => { fillFrom(view); resetDraft(); setError(null); setStep('summary'); } : onClose} className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer">
                {t('fa.cancelEdit')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2 cursor-pointer ${canSave ? 'bg-[#005FB8] hover:bg-[#004A94] text-white shadow-md shadow-blue-600/20' : 'bg-slate-200 text-slate-500'}`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? t('fa.saving') : t('fa.save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
