import { resolveCountryFromHostname, getCountryByCode, COUNTRY_REGISTRY, SUPPORTED_COUNTRIES } from '../src/config/countries';
import { formatCurrency, formatMinorUnits, toMinorUnits, fromMinorUnits } from '../src/services/currency/currencyService';
import { PaymentProviderFactory } from '../src/services/payments/factory';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- RUNNING MULTI-COUNTRY ARCHITECTURE TESTS ---');

// 1. Domain-Based Resolution Tests
console.log('[Test 1] Domain-Based Country Resolution');

// US Domains
assert(resolveCountryFromHostname('myapp.com').countryCode === 'US', 'myapp.com resolves to US');
assert(resolveCountryFromHostname('www.myapp.com').countryCode === 'US', 'www.myapp.com resolves to US');
assert(resolveCountryFromHostname('us.myapp.com').countryCode === 'US', 'us.myapp.com resolves to US');
assert(resolveCountryFromHostname('localhost:3000').countryCode === 'US', 'localhost resolves to US fallback');

// UK Domains
assert(resolveCountryFromHostname('myapp.uk').countryCode === 'GB', 'myapp.uk resolves to GB');
assert(resolveCountryFromHostname('www.myapp.uk').countryCode === 'GB', 'www.myapp.uk resolves to GB');
assert(resolveCountryFromHostname('uk.myapp.com').countryCode === 'GB', 'uk.myapp.com resolves to GB');
assert(resolveCountryFromHostname('store.co.uk').countryCode === 'GB', '*.co.uk resolves to GB');

// Nigeria Domains
assert(resolveCountryFromHostname('myapp.ng').countryCode === 'NG', 'myapp.ng resolves to NG');
assert(resolveCountryFromHostname('www.myapp.ng').countryCode === 'NG', 'www.myapp.ng resolves to NG');
assert(resolveCountryFromHostname('ng.myapp.com').countryCode === 'NG', 'ng.myapp.com resolves to NG');
assert(resolveCountryFromHostname('portal.com.ng').countryCode === 'NG', '*.com.ng resolves to NG');

// Netherlands Domains
assert(resolveCountryFromHostname('myapp.nl').countryCode === 'NL', 'myapp.nl resolves to NL');
assert(resolveCountryFromHostname('www.myapp.nl').countryCode === 'NL', 'www.myapp.nl resolves to NL');
assert(resolveCountryFromHostname('nl.myapp.com').countryCode === 'NL', 'nl.myapp.com resolves to NL');

// Override header / query test
assert(resolveCountryFromHostname('myapp.com', 'NG').countryCode === 'NG', 'Override code NG takes precedence');
assert(resolveCountryFromHostname('myapp.com', 'NL').countryCode === 'NL', 'Override code NL takes precedence');

console.log('✅ Domain-based resolution passed successfully!');

// 2. Currency Formatting & Minor Unit Calculations
console.log('[Test 2] Currency Formatting & Minor Units');

assert(toMinorUnits(50.00, 'USD') === 5000, 'toMinorUnits $50.00 -> 5000 cents');
assert(toMinorUnits(1000.50, 'NGN') === 100050, 'toMinorUnits ₦1,000.50 -> 100050 kobo');
assert(fromMinorUnits(5000, 'USD') === 50.00, 'fromMinorUnits 5000 cents -> 50.00');

const usFormatted = formatCurrency(500, 'US');
assert(usFormatted.includes('$') || usFormatted.includes('USD'), 'US currency contains $ or USD');

const gbFormatted = formatCurrency(500, 'GB');
assert(gbFormatted.includes('£') || gbFormatted.includes('GBP'), 'UK currency contains £ or GBP');

const ngFormatted = formatCurrency(50000, 'NG');
assert(ngFormatted.includes('₦') || ngFormatted.includes('NGN'), 'Nigeria currency contains ₦ or NGN');

const nlFormatted = formatCurrency(500, 'NL');
assert(nlFormatted.includes('€') || nlFormatted.includes('EUR'), 'Netherlands currency contains € or EUR');

const minorFormatted = formatMinorUnits(5000, 'US');
assert(minorFormatted.includes('$50') || minorFormatted.includes('50'), 'formatMinorUnits 5000 cents -> $50.00');

console.log('✅ Currency formatting & minor units passed successfully!');

// 3. Payment Provider Factory Tests
console.log('[Test 3] Payment Provider Factory');

const usProvider = PaymentProviderFactory.getProvider('US');
assert(usProvider.providerId === 'stripe_treasury', 'US uses stripe_treasury');
assert(usProvider.supportedCurrency === 'USD', 'US currency is USD');

const gbProvider = PaymentProviderFactory.getProvider('GB');
assert(gbProvider.providerId === 'stripe_uk', 'GB uses stripe_uk');
assert(gbProvider.supportedCurrency === 'GBP', 'GB currency is GBP');

const ngProvider = PaymentProviderFactory.getProvider('NG');
assert(ngProvider.providerId === 'paystack', 'NG uses paystack');
assert(ngProvider.supportedCurrency === 'NGN', 'NG currency is NGN');

const nlProvider = PaymentProviderFactory.getProvider('NL');
assert(nlProvider.providerId === 'stripe_ideal', 'NL uses stripe_ideal');
assert(nlProvider.supportedCurrency === 'EUR', 'NL currency is EUR');

console.log('✅ Payment provider factory passed successfully!');

// 4. Regulatory & PWA Manifest Configurations
console.log('[Test 4] Regulatory & PWA Manifest Configurations');

const usConfig = getCountryByCode('US');
assert(usConfig.pwa.name === 'MutualPool USA', 'US PWA name is MutualPool USA');
assert(usConfig.regulations.taxIdLabel.includes('SSN'), 'US tax ID label contains SSN');

const gbConfig = getCountryByCode('GB');
assert(gbConfig.pwa.name === 'MutualPool United Kingdom', 'GB PWA name is MutualPool United Kingdom');
assert(gbConfig.regulations.taxIdLabel.includes('National Insurance'), 'GB tax ID label contains National Insurance');

const ngConfig = getCountryByCode('NG');
assert(ngConfig.pwa.name === 'MutualPool Nigeria', 'NG PWA name is MutualPool Nigeria');
assert(ngConfig.regulations.taxIdLabel.includes('BVN'), 'NG tax ID label contains BVN');

const nlConfig = getCountryByCode('NL');
assert(nlConfig.pwa.name === 'MutualPool Nederland', 'NL PWA name is MutualPool Nederland');
assert(nlConfig.regulations.taxIdLabel.includes('BSN'), 'NL tax ID label contains BSN');

console.log('✅ Regulatory & PWA Manifest checks passed successfully!');
console.log('🎉 ALL MULTI-COUNTRY ARCHITECTURE TESTS PASSED!');
