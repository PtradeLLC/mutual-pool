import React, { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, X, Send, Bug, CheckCircle2 } from 'lucide-react';
import { useTranslation, type TranslationKey } from '../i18n';
import { ASK_FEEDBACK_EVENT, REPORT_PROBLEM_EVENT, appContext, isUsageDataOff, lastErrorSummary } from '../lib/telemetry';

// "Was that easy?" after key moments, and "Report a problem" from anywhere.
// Both send to /api/feedback; admins read them in Admin Ops → App health.

const askedKey = (step: string) => `mp_fb_asked_${step}`;

async function sendFeedback(body: Record<string, unknown>): Promise<boolean> {
  try {
    const ctx = appContext();
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ctx, ...body }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const FeedbackPrompt: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string) => t(key as TranslationKey);
  const [step, setStep] = useState<string | null>(null);
  const [mode, setMode] = useState<'ask' | 'hard' | 'thanks'>('ask');
  const [comment, setComment] = useState('');

  useEffect(() => {
    const onAsk = (e: Event) => {
      const s = (e as CustomEvent).detail?.step;
      if (!s || isUsageDataOff()) return;
      try {
        if (localStorage.getItem(askedKey(s))) return;
        localStorage.setItem(askedKey(s), '1');
      } catch { /* ask anyway */ }
      setStep(s);
      setMode('ask');
      setComment('');
    };
    window.addEventListener(ASK_FEEDBACK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_FEEDBACK_EVENT, onAsk);
  }, []);

  if (!step) return null;
  const close = () => setStep(null);
  const answer = async (kind: 'easy' | 'hard', text = '') => {
    await sendFeedback({ kind, step, comment: text });
    setMode('thanks');
    window.setTimeout(close, 1800);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:w-80 z-[70] bg-white border border-[#DDE1E6] rounded-2xl shadow-2xl p-4 text-[#111827]" role="dialog" aria-label={k('feedback.askTitle')}>
      <button type="button" onClick={close} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600" aria-label={k('feedback.close')}><X className="w-4 h-4" /></button>
      {mode === 'thanks' ? (
        <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {k('feedback.thanks')}</p>
      ) : mode === 'ask' ? (
        <>
          <p className="text-sm font-bold pr-6">{k('feedback.askTitle')}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => answer('easy')} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-semibold"><ThumbsUp className="w-4 h-4" /> {k('feedback.easy')}</button>
            <button type="button" onClick={() => setMode('hard')} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-sm font-semibold"><ThumbsDown className="w-4 h-4" /> {k('feedback.hard')}</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-bold pr-6">{k('feedback.whatHard')}</p>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={1000} className="mt-2 w-full px-3 py-2 rounded-xl border border-[#DDE1E6] text-sm focus:outline-none focus:ring-2 focus:ring-[#005FB8]/30" placeholder={k('feedback.optional')} />
          <button type="button" onClick={() => answer('hard', comment)} className="mt-2 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white text-sm font-bold"><Send className="w-4 h-4" /> {k('feedback.send')}</button>
        </>
      )}
    </div>
  );
};

export const ReportProblemModal: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, p?: Record<string, string | number>) => t(key as TranslationKey, p);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>();

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setDone(false);
      setComment('');
      setLastError(lastErrorSummary());
    };
    window.addEventListener(REPORT_PROBLEM_EVENT, onOpen);
    return () => window.removeEventListener(REPORT_PROBLEM_EVENT, onOpen);
  }, []);

  if (!open) return null;
  const submit = async () => {
    setSending(true);
    await sendFeedback({ kind: 'problem', comment, lastError });
    setSending(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 text-[#111827]" onClick={e => e.stopPropagation()} role="dialog" aria-label={k('feedback.reportTitle')}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold flex items-center gap-2"><Bug className="w-5 h-5 text-[#005FB8]" /> {k('feedback.reportTitle')}</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label={k('feedback.close')}><X className="w-5 h-5" /></button>
        </div>
        {done ? (
          <p className="mt-4 text-sm text-emerald-800 flex items-start gap-2"><CheckCircle2 className="w-5 h-5 shrink-0" /> {k('feedback.reportThanks')}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-[#6B7280]">{k('feedback.reportDesc')}</p>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} maxLength={2000} autoFocus className="mt-3 w-full px-3 py-2 rounded-xl border border-[#DDE1E6] text-sm focus:outline-none focus:ring-2 focus:ring-[#005FB8]/30" placeholder={k('feedback.reportPlaceholder')} />
            {lastError && <p className="mt-2 text-xs text-[#6B7280]">{k('feedback.reportIncludes', { error: lastError })}</p>}
            <p className="mt-1 text-[11px] text-[#6B7280]">{k('feedback.reportPrivacy')}</p>
            <button type="button" disabled={sending || (comment.trim().length < 3 && !lastError)} onClick={submit}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white text-sm font-bold">
              <Send className="w-4 h-4" /> {k('feedback.send')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
