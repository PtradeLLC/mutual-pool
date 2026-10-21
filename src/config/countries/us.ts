import { CountryConfig } from './types';
import { TREASURY_PROGRAM_ENABLED } from '../../lib/treasuryClaims';

export const US_CONFIG: CountryConfig = {
  countryCode: 'US',
  countryName: 'United States',
  flag: '🇺🇸',
  primaryDomain: 'themutualpool.com',
  domains: ['themutualpool.com', 'www.themutualpool.com', 'mutual-pool.vercel.app', 'localhost', '127.0.0.1'],
  
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
    providerDisplayName: 'our partner bank & Card Rails',
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
    regulatoryBody: TREASURY_PROGRAM_ENABLED ? 'Payments processed by Stripe / FDIC pass-through via our partner bank' : 'Payments processed by Stripe / Identity verified by Stripe',
    regulatoryNotice: TREASURY_PROGRAM_ENABLED
      ? 'MutualPool deposits are held in dedicated custodial accounts with FDIC pass-through insurance up to $250,000 via our banking partner.'
      : 'Member balances are held with our payments and banking partners. MutualPool is a financial technology platform, not a bank; member balances are not FDIC insured.',
    cookieConsentType: 'notice',
    taxIdRequired: true,
    taxIdLabel: 'SSN or ITIN (Last 4)',
    privacyPolicyUrl: '/privacy',
    termsOfServiceUrl: '/terms',
    dataRetentionDays: 2555, // 7 years IRS / BSA requirement
    legalEntityName: 'Chris Bitoye Ventures, LLC',
  },
  
  pwa: {
    name: 'MutualPool USA',
    shortName: 'MutualPool US',
    description: 'Mutual savings pods and driver perks for couriers in the United States with our partner bank.',
    themeColor: '#005FB8',
    backgroundColor: '#F8FAFC',
  },
};
