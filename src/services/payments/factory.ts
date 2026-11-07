import { IPaymentProvider } from './types';
import { CountryConfig, SupportedCountryCode } from '../../config/countries/types';
import { StripeTreasuryProvider } from './stripeTreasuryProvider';
import { StripeMarketProvider } from './stripeMarketProvider';
import { PaystackProvider } from './paystackProvider';
import { getCountryByCode } from '../../config/countries';

// One provider per market. Each non-US market is a separate account with its
// own keys (see .env.example): local payment methods are only offered to
// businesses registered in that country.
const providerInstances: Record<string, IPaymentProvider> = {
  stripe_treasury: new StripeTreasuryProvider(),
  stripe_uk: new StripeMarketProvider({
    providerId: 'stripe_uk',
    currency: 'GBP',
    secretKeyEnv: 'STRIPE_GB_SECRET_KEY',
    webhookSecretEnv: 'STRIPE_GB_WEBHOOK_SECRET',
  }),
  stripe_mx: new StripeMarketProvider({
    providerId: 'stripe_mx',
    currency: 'MXN',
    secretKeyEnv: 'STRIPE_MX_SECRET_KEY',
    webhookSecretEnv: 'STRIPE_MX_WEBHOOK_SECRET',
    bankTransferType: 'mx_bank_transfer', // SPEI
  }),
  paystack: new PaystackProvider({
    providerId: 'paystack',
    currency: 'NGN',
    secretKeyEnv: 'PAYSTACK_NG_SECRET_KEY',
    channels: ['card', 'bank', 'bank_transfer', 'ussd'],
    recipientType: 'nuban',
  }),
  paystack_ke: new PaystackProvider({
    providerId: 'paystack_ke',
    currency: 'KES',
    secretKeyEnv: 'PAYSTACK_KE_SECRET_KEY',
    channels: ['mobile_money', 'card'],
    recipientType: 'mobile_money',
    defaultBankCode: 'MPESA',
  }),
};

const BY_COUNTRY: Record<SupportedCountryCode, string> = {
  US: 'stripe_treasury',
  GB: 'stripe_uk',
  NG: 'paystack',
  MX: 'stripe_mx',
  KE: 'paystack_ke',
};

export class PaymentProviderFactory {
  /**
   * Retrieves the appropriate payment provider instance for a country configuration or code.
   */
  static getProvider(countryOrCode: CountryConfig | SupportedCountryCode | string): IPaymentProvider {
    const config: CountryConfig =
      typeof countryOrCode === 'object' && countryOrCode !== null && 'payment' in countryOrCode
        ? countryOrCode
        : getCountryByCode(typeof countryOrCode === 'string' ? countryOrCode : 'US');

    return providerInstances[config.payment.provider]
      || providerInstances[BY_COUNTRY[config.countryCode]]
      || providerInstances.stripe_treasury;
  }

  static getProviderById(providerId: string): IPaymentProvider {
    return providerInstances[providerId] || providerInstances.stripe_treasury;
  }
}

export * from './types';
export * from './stripeTreasuryProvider';
export * from './stripeMarketProvider';
export * from './paystackProvider';
