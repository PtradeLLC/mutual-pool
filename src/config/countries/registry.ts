import { CountryConfig, SupportedCountryCode } from './types';
import { US_CONFIG } from './us';
import { GB_CONFIG } from './gb';
import { NG_CONFIG } from './ng';
import { MX_CONFIG } from './mx';
import { KE_CONFIG } from './ke';

export const COUNTRY_REGISTRY: Record<SupportedCountryCode, CountryConfig> = {
  US: US_CONFIG,
  GB: GB_CONFIG,
  NG: NG_CONFIG,
  MX: MX_CONFIG,
  KE: KE_CONFIG,
};

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  US_CONFIG,
  GB_CONFIG,
  NG_CONFIG,
  MX_CONFIG,
  KE_CONFIG,
];

/**
 * Resolves country configuration from hostname or domain.
 * Supports:
 * - Production domains: myapp.com, myapp.uk, myapp.ng, myapp.mx, myapp.co.ke
 * - Subdomains: www.*, us.*, uk.*, ng.*, mx.*, ke.*
 * - ccTLDs: *.uk, *.ng, *.mx, *.ke
 * - Localhost / dev previews / fallback to US
 */
export function resolveCountryFromHostname(
  hostname?: string | null,
  overrideCode?: string | null
): CountryConfig {
  // If an explicit override is provided (e.g. from session or dev header/cookie)
  if (overrideCode && overrideCode.toUpperCase() in COUNTRY_REGISTRY) {
    return COUNTRY_REGISTRY[overrideCode.toUpperCase() as SupportedCountryCode];
  }

  if (!hostname || typeof hostname !== 'string') {
    return US_CONFIG;
  }

  // Clean hostname (strip port, lowercase, trim)
  const cleanHost = hostname.split(':')[0].toLowerCase().trim();

  // Strip leading 'www.'
  const normalizedHost = cleanHost.startsWith('www.') ? cleanHost.slice(4) : cleanHost;

  // 1. Direct match on registered domains
  for (const config of SUPPORTED_COUNTRIES) {
    if (config.domains.includes(normalizedHost)) {
      return config;
    }
  }

  // 2. Subdomain prefix check (e.g. uk.myapp.com, ng.myapp.org)
  if (normalizedHost.startsWith('uk.') || normalizedHost.startsWith('gb.')) return GB_CONFIG;
  if (normalizedHost.startsWith('ng.')) return NG_CONFIG;
  if (normalizedHost.startsWith('mx.')) return MX_CONFIG;
  if (normalizedHost.startsWith('ke.')) return KE_CONFIG;
  if (normalizedHost.startsWith('us.')) return US_CONFIG;

  // 3. Top-level domain (TLD) suffix checks
  if (normalizedHost.endsWith('.uk') || normalizedHost.endsWith('.co.uk')) return GB_CONFIG;
  if (normalizedHost.endsWith('.ng') || normalizedHost.endsWith('.com.ng')) return NG_CONFIG;
  if (normalizedHost.endsWith('.mx')) return MX_CONFIG;
  if (normalizedHost.endsWith('.ke')) return KE_CONFIG;
  if (normalizedHost.endsWith('.com') || normalizedHost.endsWith('.us')) return US_CONFIG;

  // 4. Default fallback
  return US_CONFIG;
}

/**
 * Helper to get country by ISO code
 */
export function getCountryByCode(code: string): CountryConfig {
  const upper = (code || '').toUpperCase() as SupportedCountryCode;
  return COUNTRY_REGISTRY[upper] || US_CONFIG;
}
