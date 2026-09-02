import { CountryConfig } from './types';

export const NL_CONFIG: CountryConfig = {
  countryCode: 'NL',
  countryName: 'Netherlands',
  flag: '🇳🇱',
  primaryDomain: 'myapp.nl',
  domains: ['myapp.nl', 'nl.myapp.com'],
  
  defaultLanguage: 'nl',
  defaultLocale: 'nl-NL',
  supportedLocales: ['nl-NL', 'en-GB'],
  
  currency: {
    code: 'EUR',
    symbol: '€',
    minorUnitExponent: 2,
    symbolPosition: 'prefix',
    thousandSeparator: '.',
    decimalSeparator: ',',
  },
  
  timezone: 'Europe/Amsterdam',
  dateFormat: 'DD-MM-YYYY',
  
  payment: {
    provider: 'stripe_ideal',
    providerDisplayName: 'iDEAL & SEPA Instant Credit Transfer',
    currency: 'EUR',
    supportedMethods: ['ideal', 'sepa', 'card'],
    minDepositMinorUnits: 500, // €5.00
    payoutFeePercentage: 0.035, // 3.5% platform fee
    instantPayoutAvailable: true,
  },
  
  features: {
    stripeTreasuryFdicPassThrough: false,
    bankVerificationRequired: true,
    taxIdRequired: true,
    smsPhoneVerificationRequired: false,
    kycProvider: 'stripe_identity',
    communityChatEnabled: true,
    brandAmbassadorPayouts: true,
    hardshipFundPools: true,
  },
  
  regulations: {
    regulatoryBody: 'De Nederlandsche Bank (DNB) / Autoriteit Financiële Markten (AFM) / GDPR',
    regulatoryNotice: 'MutualPool spaarpotten opereren in overeenstemming met EU PSD2 richtlijnen en AVG/GDPR privacywaarborgen.',
    cookieConsentType: 'opt-in', // Strict GDPR requirement in the Netherlands
    taxIdRequired: true,
    taxIdLabel: 'Burgerservicenummer (BSN)',
    privacyPolicyUrl: '/privacy',
    termsOfServiceUrl: '/terms',
    dataRetentionDays: 2555, // 7 years Belastingdienst fiscal retention
    legalEntityName: 'MutualPool Netherlands B.V. (Amsterdam, Nederland)',
  },
  
  pwa: {
    name: 'MutualPool Nederland',
    shortName: 'MutualPool NL',
    description: 'Onderlinge spaarpotten en koeriersvoordelen voor bezorgers in Nederland.',
    themeColor: '#005FB8',
    backgroundColor: '#F8FAFC',
  },
};
