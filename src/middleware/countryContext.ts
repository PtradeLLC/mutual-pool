import { Request, Response, NextFunction } from 'express';
import { CountryConfig, SupportedCountryCode } from '../config/countries/types';
import { resolveCountryFromHostname, COUNTRY_REGISTRY, US_CONFIG } from '../config/countries';

// Extend Express Request interface to include country
declare global {
  namespace Express {
    interface Request {
      country?: CountryConfig;
    }
  }
}

/**
 * Derives country context from the incoming domain/host.
 * Server is the sole authority for country context in financial and security operations.
 */
export function countryContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // 1. Resolve host header
    const forwardedHost = req.headers['x-forwarded-host'];
    const rawHost =
      (typeof forwardedHost === 'string' ? forwardedHost.split(',')[0] : null) ||
      req.headers['host'] ||
      req.hostname ||
      '';

    // 2. Optional override for non-production development/preview testing
    let overrideCode: string | null = null;
    const headerOverride = req.headers['x-country-override'];
    if (typeof headerOverride === 'string') {
      overrideCode = headerOverride.toUpperCase();
    } else if (req.query.country && typeof req.query.country === 'string') {
      overrideCode = req.query.country.toUpperCase();
    }

    // 3. Resolve CountryConfig
    const resolvedCountry = resolveCountryFromHostname(rawHost, overrideCode);

    // 4. Attach to Request and Response locals
    req.country = resolvedCountry;
    res.locals.country = resolvedCountry;

    // Set informative response header
    res.setHeader('X-Resolved-Country', resolvedCountry.countryCode);
    res.setHeader('X-Resolved-Currency', resolvedCountry.currency.code);

    next();
  } catch (err) {
    console.error('[CountryMiddleware] Error resolving country, falling back to US', err);
    req.country = US_CONFIG;
    res.locals.country = US_CONFIG;
    next();
  }
}

/**
 * Validates that an incoming payment/transaction request's currency matches the server's country context.
 */
export function validateCountryCurrency(req: Request, res: Response, next: NextFunction): void {
  const serverCurrency = req.country?.currency.code || 'USD';
  const clientCurrency = req.body?.currency;

  if (clientCurrency && String(clientCurrency).toUpperCase() !== serverCurrency) {
    res.status(400).json({
      error: `Currency mismatch. Active market domain requires ${serverCurrency}, but ${clientCurrency} was provided.`,
      requiredCurrency: serverCurrency,
      countryCode: req.country?.countryCode,
    });
    return;
  }

  next();
}
