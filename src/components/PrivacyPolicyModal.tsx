import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';
import { useCountry } from '../context/CountryContext';
import { useTranslation } from '../i18n';
import { TREASURY_PROGRAM_ENABLED } from '../lib/treasuryClaims';
import { getPrivacyPolicy } from '../content/legalDocuments';
import { LegalDocumentView } from './LegalDocumentView';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// In-app view of the Privacy Policy. The text lives in
// src/content/legalDocuments.ts and is also served as a standalone page at
// /privacy. Keep it in step with the code: when a new integration or data
// field is added, update the relevant section there.
export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { country } = useCountry();
  if (!isOpen) return null;

  const doc = getPrivacyPolicy({
    entity: country.regulations.legalEntityName,
    retentionYears: Math.max(1, Math.round((country.regulations.dataRetentionDays || 2555) / 365)),
    treasuryEnabled: TREASURY_PROGRAM_ENABLED,
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative text-[#111827] my-auto max-h-[90vh] overflow-y-auto space-y-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close privacy policy"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <Logo size="md" />
          <div>
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block">{t('footer.privacy')}</span>
            <h3 className="text-xl font-bold text-[#111827]">{doc.heading}</h3>
            <p className="text-[11px] text-[#6B7280]">
              Version {doc.version} ·{' '}
              <a href={country.regulations.privacyPolicyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#005FB8] underline">
                Open as a page <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        <LegalDocumentView doc={doc} />
      </div>
    </div>
  );
};
