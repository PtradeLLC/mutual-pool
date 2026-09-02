import { CountryConfig } from './types';

export const US_CONFIG: CountryConfig = {
  countryCode: 'US',
  countryName: 'United States',
  flag: '🇺🇸',
  primaryDomain: 'myapp.com',
  domains: ['myapp.com', 'us.myapp.com', 'localhost', '127.0.0.1'],
  
  defaultLanguage: 'en',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US', 'es-US'],
  
  currency: {
    code: 'USD',
    symbol: '$',
    minorUnitExponent: 2,
    symbolPosition: 'prefix',
    thousandSeparator: ',',
    decimalSeparator: '.',
  },
  
  timezone: 'America/New_York',
  dateFormat: 'MM/DD/YYYY',
  
  payment: {
    provider: 'stripe_treasury',
    providerDisplayName: 'Stripe Treasury & Card Rails',
    currency: 'USD',
    supportedMethods: ['card', 'ach', 'bank_transfer'],
    minDepositMinorUnits: 500, // $5.00
    payoutFeePercentage: 0.05,  // 5% platform fee on disbursements
    instantPayoutAvailable: true,
  },
  
  features: {
    stripeTreasuryFdicPassThrough: true,
    bankVerificationRequired: true,
    taxIdRequired: true,
    smsPhoneVerificationRequired: true,
    kycProvider: 'stripe_identity',
    communityChatEnabled: true,
    brandAmbassadorPayouts: true,
    hardshipFundPools: true,
  },
  
  regulations: {
    regulatoryBody: 'FinCEN / FDIC Pass-Through via Stripe Treasury (Evolve Bank & Trust)',
    regulatoryNotice: 'MutualPool deposits are held in dedicated custodial accounts with FDIC pass-through insurance up to $250,000 via our banking partner.',
    cookieConsentType: 'notice',
    taxIdRequired: true,
    taxIdLabel: 'SSN or ITIN (Last 4)',
    privacyPolicyUrl: '/privacy',
    termsOfServiceUrl: '/terms',
    dataRetentionDays: 2555, // 7 years IRS / BSA requirement
    legalEntityName: 'MutualPool Technologies Inc. (Delaware, USA)',
  },
  
  pwa: {
    name: 'MutualPool USA',
    shortName: 'MutualPool US',
    description: 'Mutual savings pods and driver perks for couriers in the United States with Stripe Treasury.',
    themeColor: '#005FB8',
    backgroundColor: '#F8FAFC',
  },
};
