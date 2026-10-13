import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';
import { useCountry } from '../context/CountryContext';
import { useTranslation } from '../i18n';
import { TREASURY_PROGRAM_ENABLED } from '../lib/treasuryClaims';
import { getTermsOfService } from '../content/legalDocuments';
import { LegalDocumentView } from './LegalDocumentView';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacy?: () => void;
}

// In-app view of the platform-wide Terms of Service. The text lives in
// src/content/legalDocuments.ts (fees come from src/lib/legal.ts) and is also
// served as a standalone page at /terms. The Pod Agreement (accepted per pod)
// and the Brand Ambassador agreement (accepted per campaign) sit underneath.
export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ isOpen, onClose, onOpenPrivacy }) => {
  const { t } = useTranslation();
  const { country } = useCountry();
  if (!isOpen) return null;

  const doc = getTermsOfService({
    entity: country.regulations.legalEntityName,
    treasuryEnabled: TREASURY_PROGRAM_ENABLED,
  });

  // The intro links to the Privacy Policy; open it in-app when a handler is provided.
  const handleNavigate = (href: string) => {
    if (href === '/privacy' && onOpenPrivacy) { onOpenPrivacy(); return true; }
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative text-[#111827] my-auto max-h-[90vh] overflow-y-auto space-y-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close terms of service"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <Logo size="md" />
          <div>
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block">{t('footer.terms')}</span>
            <h3 className="text-xl font-bold text-[#111827]">{doc.heading}</h3>
            <p className="text-[11px] text-[#6B7280]">
              Version {doc.version} ·{' '}
              <a href={country.regulations.termsOfServiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#005FB8] underline">
                Open as a page <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        <LegalDocumentView doc={doc} onNavigate={handleNavigate} />
      </div>
    </div>
  );
};
