import React from 'react';
import { useTranslation } from '../i18n';

// Gig platforms our members drive and deliver for. Shown as uniform text
// wordmarks rather than official logos: the logos are the companies'
// trademarks and need their permission. To use real logos once approved,
// add a `logoSrc` to an entry and it will render as an image instead.
const GIG_PLATFORMS: Array<{ name: string; logoSrc?: string }> = [
  { name: 'DoorDash' },
  { name: 'Uber Eats' },
  { name: 'Instacart' },
  { name: 'Lyft' },
  { name: 'Grubhub' },
  { name: 'Spark Driver' },
  { name: 'Amazon Flex' },
];

export const PartnerLogoStrip: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="partner-strip-heading" className="bg-white border-b border-[#DDE1E6] py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto text-center">
        <h2
          id="partner-strip-heading"
          className="text-[11px] sm:text-xs font-mono font-bold text-[#6B7280] uppercase tracking-wider"
        >
          {t('partners.heading')}
        </h2>

        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
          {GIG_PLATFORMS.map(({ name, logoSrc }) => (
            <li key={name}>
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={name}
                  className="h-6 sm:h-7 w-auto grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition"
                  loading="lazy"
                />
              ) : (
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#9CA3AF] hover:text-[#4B5563] transition-colors select-none">
                  {name}
                </span>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-5 text-[10px] text-[#9CA3AF]">{t('partners.disclaimer')}</p>
      </div>
    </section>
  );
};
