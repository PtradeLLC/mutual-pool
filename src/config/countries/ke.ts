import { CountryConfig } from './types';

export const KE_CONFIG: CountryConfig = {
  countryCode: 'KE',
  countryName: 'Kenya',
  flag: '🇰🇪',
  primaryDomain: 'myapp.co.ke',
  domains: ['myapp.co.ke', 'ke.myapp.com', 'myapp.ke'],

  defaultLanguage: 'en',
  defaultLocale: 'en-KE',
  supportedLocales: ['en-KE', 'sw-KE'],

  currency: {
    code: 'KES',
    symbol: 'KSh',
    minorUnitExponent: 2,
    symbolPosition: 'prefix',
    thousandSeparator: ',',
    decimalSeparator: '.',
  },

  timezone: 'Africa/Nairobi',
  dateFormat: 'DD/MM/YYYY',

  payment: {
    provider: 'paystack_ke',
    providerDisplayName: 'Paystack Kenya (M-Pesa & card)',
    currency: 'KES',
    supportedMethods: ['mpesa', 'card'],
    minDepositMinorUnits: 10000, // KSh 100.00
    payoutFeePercentage: 0.025,  // 2.5% platform fee, as in Nigeria
    instantPayoutAvailable: true, // M-Pesa payouts land in seconds
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
    regulatoryBody: 'Not yet available in Kenya',
    regulatoryNotice: 'MutualPool is not yet available in Kenya. Pods, deposits and payouts are currently offered to US members only; card payments are processed by Stripe.',
    cookieConsentType: 'notice',
    taxIdRequired: true,
    taxIdLabel: 'National ID / KRA PIN',
    privacyPolicyUrl: '/privacy',
    termsOfServiceUrl: '/terms',
    dataRetentionDays: 2555, // 7 years (POCAMLA record keeping)
    legalEntityName: 'MutualPool Kenya Ltd. (Nairobi, Kenya)',
  },

  pwa: {
    name: 'MutualPool Kenya',
    shortName: 'MutualPool KE',
    description: 'Digital chamas and rider benefits for boda boda and delivery riders across Kenya.',
    themeColor: '#005FB8',
    backgroundColor: '#F8FAFC',
  },
};
