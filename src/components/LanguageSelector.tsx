import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { SupportedLanguage } from '../i18n/types';
import { Globe, Check, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'pill' | 'compact' | 'drawer';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'pill',
  className = '',
}) => {
  const { language, setLanguage, supportedLanguages, currentLanguageInfo, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'drawer') {
    return (
      <div className={`p-3 rounded-xl bg-gray-50 border border-gray-200 ${className}`}>
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-600">
          <Globe className="w-3.5 h-3.5 text-[#005FB8]" />
          <span>{t('nav.selectLanguage')}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {supportedLanguages.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code as SupportedLanguage)}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#005FB8] text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.code.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DDE1E6] bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
        aria-label={t('nav.selectLanguage')}
        aria-expanded={isOpen}
      >
        <Globe className="w-3.5 h-3.5 text-[#005FB8] shrink-0" />
        <span className="text-sm leading-none">{currentLanguageInfo.flag}</span>
        <span className="uppercase text-[11px] font-bold tracking-wide">{currentLanguageInfo.code}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white border border-[#DDE1E6] shadow-xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
            {t('nav.language')}
          </div>
          {supportedLanguages.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLanguage(lang.code as SupportedLanguage);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected ? 'bg-blue-50 text-[#005FB8]' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{lang.flag}</span>
                  <div>
                    <span className="block font-bold">{lang.nativeName}</span>
                    <span className="text-[10px] text-gray-400 block">{lang.name}</span>
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#005FB8]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
