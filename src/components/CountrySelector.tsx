import React, { useState, useRef, useEffect } from 'react';
import { useCountry } from '../context/CountryContext';
import { SupportedCountryCode } from '../config/countries/types';
import { Globe, Check, ChevronDown, Smartphone, ExternalLink, ShieldCheck } from 'lucide-react';

interface CountrySelectorProps {
  variant?: 'pill' | 'compact' | 'drawer';
  className?: string;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  variant = 'pill',
  className = '',
}) => {
  const {
    country,
    countryCode,
    availableCountries,
    setCountry,
    isStandalone,
  } = useCountry();

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

  const handleSelect = (code: SupportedCountryCode) => {
    setCountry(code);
    setIsOpen(false);
  };

  if (variant === 'drawer') {
    return (
      <div className={`p-3 rounded-xl bg-gray-50 border border-gray-200 ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
            <Globe className="w-3.5 h-3.5 text-[#005FB8]" />
            <span>Select Market & Currency</span>
          </div>
          {isStandalone && (
            <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
              <Smartphone className="w-2.5 h-2.5" /> In-App Mode
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {availableCountries.map((c) => {
            const isSelected = countryCode === c.countryCode;
            return (
              <button
                key={c.countryCode}
                type="button"
                onClick={() => handleSelect(c.countryCode)}
                className={`p-2 rounded-lg text-xs font-semibold text-left transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-[#005FB8] text-white border-[#005FB8] shadow-xs'
                    : 'bg-white text-gray-800 hover:bg-gray-100 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="font-bold truncate">{c.countryName}</span>
                </div>
                <div className={`text-[10px] font-mono ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                  {c.currency.code} ({c.currency.symbol})
                </div>
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
        aria-label="Select country and currency"
        aria-expanded={isOpen}
      >
        <span className="text-sm leading-none">{country.flag}</span>
        <span className="uppercase text-[11px] font-bold tracking-wide">{country.countryCode}</span>
        <span className="hidden sm:inline text-[11px] font-mono font-bold text-[#005FB8] bg-blue-50 px-1 rounded">
          {country.currency.code}
        </span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white border border-[#DDE1E6] shadow-xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Regional Market & Currency
            </span>
            {isStandalone ? (
              <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <Smartphone className="w-2.5 h-2.5" /> PWA Standalone
              </span>
            ) : (
              <span className="text-[9px] font-medium text-gray-400">
                Web Domain
              </span>
            )}
          </div>

          <div className="py-1">
            {availableCountries.map((c) => {
              const isSelected = countryCode === c.countryCode;
              return (
                <button
                  key={c.countryCode}
                  type="button"
                  onClick={() => handleSelect(c.countryCode)}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50 text-[#005FB8]' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg leading-none shrink-0">{c.flag}</span>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">{c.countryName}</span>
                        <span className="font-mono text-[10px] font-extrabold text-[#005FB8] bg-blue-50 px-1 rounded">
                          {c.currency.code} ({c.currency.symbol})
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                        <span>{c.primaryDomain}</span>
                        <span>•</span>
                        <span className="text-gray-400">{c.payment.providerDisplayName.split('(')[0].trim()}</span>
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#005FB8] shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2 mt-1 bg-gray-50 border-t border-gray-100 rounded-b-xl text-[10px] text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              {isStandalone
                ? 'App Store mode active: Region updates seamlessly in-app.'
                : 'Web mode: Connects to local banking rails and regulatory disclosures.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
