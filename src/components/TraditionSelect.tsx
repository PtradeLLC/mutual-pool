import React from 'react';
import { ROSCA_TRADITIONS } from '../data/roscaTraditions';
import { useTranslation } from '../i18n';

interface TraditionSelectProps {
  value: string;
  onChange: (traditionId: string) => void;
  className?: string;
  labelClassName?: string;
  showHelp?: boolean;
}

// "What does your community call a savings circle?" Names are proper nouns and
// are shown as-is in every language; only the label and help text translate.
export const TraditionSelect: React.FC<TraditionSelectProps> = ({ value, onChange, className, labelClassName, showHelp = true }) => {
  const { t } = useTranslation();
  return (
    <div>
      <label className={labelClassName || 'block text-xs font-semibold text-[#111827] mb-1'}>
        {t('tradition.label')}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className || 'w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]'}
      >
        <option value="">{t('tradition.none')}</option>
        {ROSCA_TRADITIONS.map(tr => (
          <option key={tr.id} value={tr.id}>
            {tr.name}{tr.aliases?.length ? ` / ${tr.aliases.join(' / ')}` : ''} — {tr.region}
          </option>
        ))}
      </select>
      {showHelp && <p className="mt-1 text-[11px] text-[#6B7280]">{t('tradition.help')}</p>}
    </div>
  );
};
