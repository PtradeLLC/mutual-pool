import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageInfo } from './types';
import { en, TranslationKey } from './en';
import { es } from './es';
import { fr } from './fr';

const translationsMap: Record<SupportedLanguage, Record<TranslationKey, string>> = {
  en,
  es,
  fr,
};

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  supportedLanguages: LanguageInfo[];
  currentLanguageInfo: LanguageInfo;
  formatCurrency: (amount: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'mutualpool_user_lang';

/**
 * Detect the initial language from localStorage or device/system settings.
 */
function getInitialLanguage(): SupportedLanguage {
  try {
    // 1. Check if user previously chose a language manually
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es' || saved === 'fr') {
      return saved;
    }

    // 2. Check system/device languages
    const browserLanguages = navigator.languages || [navigator.language || (navigator as any).userLanguage || 'en'];
    for (const lang of browserLanguages) {
      if (typeof lang === 'string') {
        const lower = lang.toLowerCase();
        if (lower.startsWith('es')) return 'es';
        if (lower.startsWith('fr')) return 'fr';
        if (lower.startsWith('en')) return 'en';
      }
    }
  } catch (err) {
    console.warn('Could not read navigator language, falling back to en', err);
  }

  return 'en';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(getInitialLanguage);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // Ignore
    }
  }, [language]);

  const currentLanguageInfo = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const currentDict = translationsMap[language] || translationsMap.en;
    let translation = currentDict[key] || translationsMap.en[key] || (key as string);

    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        translation = translation.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }

    return translation;
  };

  const formatCurrency = (amount: number): string => {
    try {
      const locale = language === 'es' ? 'es-US' : language === 'fr' ? 'fr-CA' : 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `$${amount.toLocaleString()}`;
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
        currentLanguageInfo,
        formatCurrency,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
