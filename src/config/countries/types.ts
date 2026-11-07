export type SupportedCountryCode = 'US' | 'GB' | 'NG' | 'MX' | 'KE';

export interface CurrencyConfig {
  code: string;               // e.g. 'USD', 'GBP', 'NGN', 'MXN', 'KES'
  symbol: string;             // e.g. '$', '£', '₦', 'KSh'
  minorUnitExponent: number;  // 2 for standard fiat (cents, pence, kobo, cents)
  symbolPosition: 'prefix' | 'suffix';
  thousandSeparator: string;
  decimalSeparator: string;
}

export interface PaymentConfig {
  provider: 'stripe_treasury' | 'stripe_uk' | 'stripe_mx' | 'paystack' | 'paystack_ke' | string;
  providerDisplayName: string;
  currency: string;
  supportedMethods: ('card' | 'bank_transfer' | 'ach' | 'bacs' | 'ussd' | 'oxxo' | 'spei' | 'mpesa')[];
  minDepositMinorUnits: number;
  payoutFeePercentage: number;
  instantPayoutAvailable: boolean;
}

export interface FeaturesConfig {
  stripeTreasuryFdicPassThrough: boolean;
  bankVerificationRequired: boolean;
  taxIdRequired: boolean;
  smsPhoneVerificationRequired: boolean;
  kycProvider: 'stripe_identity' | 'smile_id' | 'persona';
  communityChatEnabled: boolean;
  brandAmbassadorPayouts: boolean;
  hardshipFundPools: boolean;
}

export interface RegulationsConfig {
  regulatoryBody: string;       // e.g. 'FinCEN / FDIC Pass-Through', 'FCA (UK)', 'CBN (Nigeria)', 'CNBV (Mexico)', 'CBK (Kenya)'
  regulatoryNotice: string;
  cookieConsentType: 'opt-in' | 'opt-out' | 'notice';
  taxIdRequired: boolean;
  taxIdLabel: string;           // e.g. 'SSN / ITIN', 'National Insurance (NI)', 'BVN / NIN', 'CURP / RFC', 'KRA PIN'
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
  dataRetentionDays: number;
  legalEntityName: string;
}

export interface CountryConfig {
  countryCode: SupportedCountryCode;
  countryName: string;
  flag: string;
  primaryDomain: string;
  domains: string[];
  
  defaultLanguage: string;      // 'en', 'es', etc.
  defaultLocale: string;        // 'en-US', 'en-GB', 'en-NG', 'es-MX', 'en-KE'
  supportedLocales: string[];
  
  currency: CurrencyConfig;
  timezone: string;
  dateFormat: string;
  
  payment: PaymentConfig;
  features: FeaturesConfig;
  regulations: RegulationsConfig;
  
  // PWA & App Store metadata
  pwa: {
    name: string;
    shortName: string;
    description: string;
    themeColor: string;
    backgroundColor: string;
  };
}
