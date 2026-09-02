import { CountryConfig, SupportedCountryCode } from '../../config/countries/types';
import { getCountryByCode, US_CONFIG } from '../../config/countries';

/**
 * Converts a major decimal currency amount (e.g. 50.00) to minor integer units (e.g. 5000 cents/pence/kobo).
 */
export function toMinorUnits(amount: number, currencyCode: string = 'USD'): number {
  if (isNaN(amount)) return 0;
  const upper = currencyCode.toUpperCase();
  // Most currencies have 2 decimal places. JPY has 0.
  const exponent = upper === 'JPY' ? 0 : 2;
  return Math.round(amount * Math.pow(10, exponent));
}

/**
 * Converts integer minor units (e.g. 5000 cents) back to major decimal amount (50.00).
 */
export function fromMinorUnits(minorUnits: number, currencyCode: string = 'USD'): number {
  if (isNaN(minorUnits)) return 0;
  const upper = currencyCode.toUpperCase();
  const exponent = upper === 'JPY' ? 0 : 2;
  return minorUnits / Math.pow(10, exponent);
}

/**
 * Formats an amount using the country's specific currency, locale, and symbol positioning.
 */
export function formatCurrency(
  amount: number,
  countryOrCode?: CountryConfig | SupportedCountryCode | string,
  options?: {
    showCode?: boolean;
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
  }
): string {
  const config: CountryConfig =
    typeof countryOrCode === 'object' && countryOrCode !== null && 'currency' in countryOrCode
      ? countryOrCode
      : getCountryByCode(typeof countryOrCode === 'string' ? countryOrCode : 'US');

  const { currency, defaultLocale } = config;
  const maxDigits = options?.maximumFractionDigits ?? 2;
  const minDigits = options?.minimumFractionDigits ?? 0;

  try {
    const formatted = new Intl.NumberFormat(defaultLocale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(amount);

    if (options?.showCode) {
      return `${formatted} ${currency.code}`;
    }
    return formatted;
  } catch (err) {
    // Graceful fallback if Intl fails
    const formattedNumber = amount.toLocaleString(defaultLocale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    });
    return currency.symbolPosition === 'prefix'
      ? `${currency.symbol}${formattedNumber}`
      : `${formattedNumber} ${currency.symbol}`;
  }
}

/**
 * Formats an amount provided in minor integer units (e.g. 5000 -> "$50.00").
 */
export function formatMinorUnits(
  minorUnits: number,
  countryOrCode?: CountryConfig | SupportedCountryCode | string,
  options?: { showCode?: boolean }
): string {
  const config: CountryConfig =
    typeof countryOrCode === 'object' && countryOrCode !== null && 'currency' in countryOrCode
      ? countryOrCode
      : getCountryByCode(typeof countryOrCode === 'string' ? countryOrCode : 'US');

  const majorAmount = fromMinorUnits(minorUnits, config.currency.code);
  return formatCurrency(majorAmount, config, options);
}
