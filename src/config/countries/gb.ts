import { CountryConfig } from './types';

export const GB_CONFIG: CountryConfig = {
  countryCode: 'GB',
  countryName: 'United Kingdom',
  flag: '🇬🇧',
  primaryDomain: 'myapp.uk',
  domains: ['myapp.uk', 'uk.myapp.com', 'myapp.co.uk'],
  
  defaultLanguage: 'en',
  defaultLocale: 'en-GB',
  supportedLocales: ['en-GB'],
  
  currency: {
    code: 'GBP',
    symbol: '£',
    minorUnitExponent: 2,
    symbolPosition: 'prefix',
    thousandSeparator: ',',
    decimalSeparator: '.',
  },
  
  timezone: 'Europe/London',
  dateFormat: 'DD/MM/YYYY',
  
  payment: {
    provider: 'stripe_uk',
    providerDisplayName: 'Stripe UK (Bacs & Faster Payments)',
    currency: 'GBP',
    supportedMethods: ['card', 'bacs', 'bank_transfer'],
    minDepositMinorUnits: 500, // £5.00
    payoutFeePercentage: 0.04,  // 4% platform fee
    instantPayoutAvailable: true,
  },
  
  features: {
    stripeTreasuryFdicPassThrough: false,
    bankVerificationRequired: true,
    taxIdRequired: true,
    smsPhoneVerificationRequired: true,
    kycProvider: 'stripe_identity',
    communityChatEnabled: true,
    brandAmbassadorPayouts: true,
    hardshipFundPools: true,
  },
  
  regulations: {
    regulatoryBody: 'Financial Conduct Authority (FCA) / UK Open Banking',
    regulatoryNotice: 'Mutual savings pools operating under UK peer-to-peer circle exemptions. Payment processing facilitated via FCA-authorized EMI partners.',
    cookieConsentType: 'opt-in',
    taxIdRequired: true,
    taxIdLabel: 'National Insurance (NI) Number',
    privacyPolicyUrl: '/privacy',
    termsOfServiceUrl: '/terms',
    dataRetentionDays: 2190, // 6 years UK statutory limitation
    legalEntityName: 'MutualPool UK Ltd. (London, UK)',
  },
  
  pwa: {
    name: 'MutualPool United Kingdom',
    shortName: 'MutualPool UK',
    description: 'Mutual rotating savings pods and delivery driver perks across the United Kingdom.',
    themeColor: '#005FB8',
    backgroundColor: '#F8FAFC',
  },
};
