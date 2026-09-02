import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  CountryConfig,
  SupportedCountryCode,
  CurrencyConfig,
  FeaturesConfig,
  RegulationsConfig,
  PaymentConfig,
} from '../config/countries/types';
import {
  COUNTRY_REGISTRY,
  SUPPORTED_COUNTRIES,
  resolveCountryFromHostname,
  getCountryByCode,
  US_CONFIG,
} from '../config/countries';
import { formatCurrency, formatMinorUnits } from '../services/currency/currencyService';
import { isStandaloneMode, executeCountrySwitch } from '../utils/pwaMode';

interface CountryContextType {
  country: CountryConfig;
  countryCode: SupportedCountryCode;
  countryName: string;
  currency: CurrencyConfig;
  locale: string;
  language: string;
  timezone: string;
  dateFormat: string;
  features: FeaturesConfig;
  regulations: RegulationsConfig;
  payment: PaymentConfig;
  isStandalone: boolean;
  availableCountries: CountryConfig[];
  setCountry: (code: SupportedCountryCode) => { switchedInApp: boolean; targetDomain?: string };
  formatAmount: (amount: number, options?: { showCode?: boolean; maximumFractionDigits?: number; minimumFractionDigits?: number }) => string;
  formatMinor: (minorUnits: number, options?: { showCode?: boolean }) => string;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

const STORAGE_KEY = 'mutualpool_active_country';

function getInitialCountryConfig(): CountryConfig {
  if (typeof window === 'undefined') return US_CONFIG;

  try {
    // 1. Check URL query parameter override (e.g. ?country=NG or ?country=GB for testing/previews)
    const params = new URLSearchParams(window.location.search);
    const queryCountry = params.get('country');
    if (queryCountry && queryCountry.toUpperCase() in COUNTRY_REGISTRY) {
      return COUNTRY_REGISTRY[queryCountry.toUpperCase() as SupportedCountryCode];
    }

    // 2. Check local storage if in standalone/PWA mode or saved user preference
    const savedCode = localStorage.getItem(STORAGE_KEY);
    if (savedCode && savedCode.toUpperCase() in COUNTRY_REGISTRY) {
      // If running standalone or dev, respect saved country
      if (isStandaloneMode() || window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost')) {
        return COUNTRY_REGISTRY[savedCode.toUpperCase() as SupportedCountryCode];
      }
    }

    // 3. Resolve from actual domain/hostname (e.g. myapp.ng, myapp.uk, myapp.nl, myapp.com)
    return resolveCountryFromHostname(window.location.hostname);
  } catch (err) {
    console.warn('[CountryContext] Falling back to default US config', err);
    return US_CONFIG;
  }
}

export const CountryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [country, setCountryConfig] = useState<CountryConfig>(getInitialCountryConfig);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());
  }, []);

  // Sync document metadata and dynamic HTML tags
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${country.pwa.name} • Mutual Savings & Courier Perks`;
      
      // Update or inject meta description
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', country.pwa.description);
      }
      
      // Update theme-color
      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', country.pwa.themeColor);
      }

      // Update canonical link
      let canonicalLink = document.querySelector('link[rel="canonical"]');
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute('href', `https://${country.primaryDomain}${window.location.pathname}`);
    }
  }, [country]);

  const setCountry = (code: SupportedCountryCode) => {
    return executeCountrySwitch(code, (resolvedCode) => {
      const newConfig = getCountryByCode(resolvedCode);
      setCountryConfig(newConfig);
      try {
        localStorage.setItem(STORAGE_KEY, resolvedCode);
      } catch {
        // Ignore storage errors
      }
    });
  };

  const formatAmount = (
    amount: number,
    options?: { showCode?: boolean; maximumFractionDigits?: number; minimumFractionDigits?: number }
  ): string => {
    return formatCurrency(amount, country, options);
  };

  const formatMinor = (minorUnits: number, options?: { showCode?: boolean }): string => {
    return formatMinorUnits(minorUnits, country, options);
  };

  const contextValue = useMemo<CountryContextType>(
    () => ({
      country,
      countryCode: country.countryCode,
      countryName: country.countryName,
      currency: country.currency,
      locale: country.defaultLocale,
      language: country.defaultLanguage,
      timezone: country.timezone,
      dateFormat: country.dateFormat,
      features: country.features,
      regulations: country.regulations,
      payment: country.payment,
      isStandalone,
      availableCountries: SUPPORTED_COUNTRIES,
      setCountry,
      formatAmount,
      formatMinor,
    }),
    [country, isStandalone]
  );

  return <CountryContext.Provider value={contextValue}>{children}</CountryContext.Provider>;
};

export function useCountry(): CountryContextType {
  const context = useContext(CountryContext);
  if (!context) {
    throw new Error('useCountry must be used within a CountryProvider');
  }
  return context;
}
