import { CountryConfig } from './types';

export const NG_CONFIG: CountryConfig = {
  countryCode: 'NG',
  countryName: 'Nigeria',
  flag: '🇳🇬',
  primaryDomain: 'myapp.ng',
  domains: ['myapp.ng', 'ng.myapp.com', 'myapp.com.ng'],
  
  defaultLanguage: 'en',
  defaultLocale: 'en-NG',
  supportedLocales: ['en-NG'],
  
  currency: {
    code: 'NGN',
    symbol: '₦',
    minorUnitExponent: 2,
    symbolPosition: 'prefix',
    thousandSeparator: ',',
    decimalSeparator: '.',
  },
  
  timezone: 'Africa/Lagos',
  dateFormat: 'DD/MM/YYYY',
  
  payment: {
    provider: 'paystack',
    providerDisplayName: 'Paystack & Direct Bank Transfer (NIBSS)',
    currency: 'NGN',
    supportedMethods: ['card', 'bank_transfer', 'ussd'],
    minDepositMinorUnits: 100000, // ₦1,000.00 (in kobo)
    payoutFeePercentage: 0.025,   // 2.5% platform fee
    instantPayoutAvailable: true,
  },
  
  features: {
    stripeTreasuryFdicPassThrough: false,
    bankVerificationRequired: true,
    taxIdRequired: true,
    smsPhoneVerificationRequired: true,
    kycProvider: 'smile_id',
    communityChatEnabled: true,
    brandAmbassadorPayouts: true,
    hardshipFundPools: true,
  },
  
  regulations: {
    regulatoryBody: 'Not yet available in Nigeria',
    regulatoryNotice: 'MutualPool is not yet available in Nigeria. Pods, deposits and payouts are currently offered to US members only; payments are processed by Stripe.',
    cookieConsentType: 'notice',
    taxIdRequired: true,
    taxIdLabel: 'Bank Verification Number (BVN) / NIN',
    privacyPolicyUrl: '/privacy',
    termsOfServiceUrl: '/terms',
    dataRetentionDays: 1825, // 5 years NDIC / AML guidelines
    legalEntityName: 'MutualPool Nigeria Ltd. (Lagos, Nigeria)',
  },
  
  pwa: {
    name: 'MutualPool Nigeria',
    shortName: 'MutualPool NG',
    description: 'Ajo and Esusu peer-to-peer savings pods and rider benefits for couriers across Nigeria.',
    themeColor: '#005FB8',
    backgroundColor: '#F8FAFC',
  },
};
