import { IPaymentProvider } from './types';
import { CountryConfig, SupportedCountryCode } from '../../config/countries/types';
import { StripeTreasuryProvider } from './stripeTreasuryProvider';
import { StripeUKProvider } from './stripeUKProvider';
import { PaystackProvider } from './paystackProvider';
import { StripeIdealProvider } from './stripeIdealProvider';
import { getCountryByCode } from '../../config/countries';

const providerInstances: Record<string, IPaymentProvider> = {
  stripe_treasury: new StripeTreasuryProvider(),
  stripe_uk: new StripeUKProvider(),
  paystack: new PaystackProvider(),
  stripe_ideal: new StripeIdealProvider(),
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

    const providerId = config.payment.provider;
    const provider = providerInstances[providerId];
    if (provider) {
      return provider;
    }

    // Safe fallback based on country code
    switch (config.countryCode) {
      case 'GB':
        return providerInstances.stripe_uk;
      case 'NG':
        return providerInstances.paystack;
      case 'NL':
        return providerInstances.stripe_ideal;
      case 'US':
      default:
        return providerInstances.stripe_treasury;
    }
  }

  static getProviderById(providerId: string): IPaymentProvider {
    return providerInstances[providerId] || providerInstances.stripe_treasury;
  }
}

export * from './types';
export * from './stripeTreasuryProvider';
export * from './stripeUKProvider';
export * from './paystackProvider';
export * from './stripeIdealProvider';
