import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Loader2, X, AlertTriangle } from 'lucide-react';
import { useTranslation, type TranslationKey } from '../i18n';
import type { Pod } from '../types';

// The agreement a creator-pool member signed when taking their seat (not the
// gig-pod agreement), with their signature record.

interface Props {
  pod: Pod;
  onClose: () => void;
}

interface AgreementView {
  version: string;
  text: string;
  creatorName: string;
  signature: null | { signedAt: string | null; signatureName: string | null; version: string | null; mandateLast4: string | null; matchesSignedText: boolean | null };
}

export const CreatorPoolAgreementModal: React.FC<Props> = ({ pod, onClose }) => {
  const { t } = useTranslation();
  const k = (key: string, params?: Record<string, string | number>) => t(key as TranslationKey, params);
  const [data, setData] = useState<AgreementView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pods/${pod.id}/creator-agreement`);
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pod.id]);

  const sig = data?.signature;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#005FB8] flex items-center gap-1.5"><FileText className="w-4 h-4" /> {k('podCreator.agreementTitle')}</div>
            <h2 className="mt-1 text-lg font-extrabold text-[#111827]">{pod.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        {!data && !failed && <div className="py-12 flex justify-center text-[#005FB8]"><Loader2 className="w-6 h-6 animate-spin" /></div>}
        {failed && <p className="mt-4 text-sm text-rose-700">{k('podCreator.agreementLoadFailed')}</p>}

        {data && (
          <>
            {sig?.signedAt ? (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {k('podCreator.agreementSigned', { name: sig.signatureName || '', date: new Date(sig.signedAt).toLocaleString() })}
                  {sig.mandateLast4 ? ` ${k('podCreator.agreementBank', { last4: sig.mandateLast4 })}` : ''}
                </span>
              </div>
            ) : (
              <p className="mt-4 text-xs text-[#6B7280]">{k('podCreator.agreementNotMember')}</p>
            )}
            {sig?.matchesSignedText === false && (
              <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {k('podCreator.agreementUpdated', { version: sig.version || '' })}
              </div>
            )}
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#374151] p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">{data.text}</pre>
          </>
        )}
      </div>
    </div>
  );
};
