import { CountryConfig } from './types';

export const MX_CONFIG: CountryConfig = {
  countryCode: 'MX',
  countryName: 'Mexico',
  flag: '🇲🇽',
  primaryDomain: 'myapp.mx',
  domains: ['myapp.mx', 'mx.myapp.com', 'myapp.com.mx'],

  defaultLanguage: 'es',
  defaultLocale: 'es-MX',
  supportedLocales: ['es-MX', 'en-US'],

  currency: {
    code: 'MXN',
    symbol: '$',
    minorUnitExponent: 2,
    symbolPosition: 'prefix',
    thousandSeparator: ',',
    decimalSeparator: '.',
  },

  timezone: 'America/Mexico_City',
  dateFormat: 'DD/MM/YYYY',

  payment: {
    provider: 'stripe_mx',
    providerDisplayName: 'Stripe México (tarjeta, OXXO y SPEI)',
    currency: 'MXN',
    supportedMethods: ['card', 'oxxo', 'spei'],
    minDepositMinorUnits: 10000, // MX$100.00
    payoutFeePercentage: 0.05,   // 5% platform fee, as in the US
    instantPayoutAvailable: true, // SPEI settles in seconds
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
    regulatoryBody: 'Aún no disponible en México',
    regulatoryNotice: 'MutualPool aún no está disponible en México. Las tandas, los depósitos y los pagos solo se ofrecen por ahora a miembros en Estados Unidos; los pagos con tarjeta son procesados por Stripe.',
    cookieConsentType: 'notice',
    taxIdRequired: true,
    taxIdLabel: 'CURP / RFC',
    privacyPolicyUrl: '/privacy',
    termsOfServiceUrl: '/terms',
    dataRetentionDays: 1825, // 5 years (CFF tax records, LFPIORPI anti-money-laundering records)
    legalEntityName: 'MutualPool México S.A.P.I. de C.V. (Ciudad de México)',
  },

  pwa: {
    name: 'MutualPool México',
    shortName: 'MutualPool MX',
    description: 'Tandas digitales y beneficios para repartidores y conductores en México.',
    themeColor: '#005FB8',
    backgroundColor: '#F8FAFC',
  },
};
