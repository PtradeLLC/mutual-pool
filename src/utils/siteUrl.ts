/**
 * Dynamic Site URL & Deployment Environment Utility
 * 
 * Automatically resolves the active website URL between:
 * - Development / Vercel Preview (e.g. https://mutual-pool.vercel.app or http://localhost:3000)
 * - Production Launch (e.g. https://themutualpool.com or custom production domain)
 * 
 * Architecture & Dynamic Resolution:
 * 1. Runtime Browser: Dynamically defaults to `window.location.origin` so deep links,
 *    courier sleeve QR codes, share invites, and OAuth callbacks always match the current active host.
 * 2. Simulation / Developer Testing: Allows 1-click switching in the UI between Development
 *    (https://mutual-pool.vercel.app), Production (https://themutualpool.com), Localhost, and Custom domains.
 * 3. Environment Variables: Supports VITE_SITE_URL, VITE_DEV_URL, VITE_PROD_URL, VITE_APP_ENV,
 *    and Vercel system environment variables (VERCEL_URL, VERCEL_PROJECT_PRODUCTION_URL).
 */

import { useState, useEffect } from 'react';

export type AppEnvironment = 'development' | 'preview' | 'production';
export type SiteUrlMode = 'auto' | 'development' | 'production' | 'localhost' | 'custom';

export const DEFAULT_DEV_URL = 'https://mutual-pool.vercel.app';
export const DEFAULT_PROD_URL = 'https://themutualpool.com';
export const DEFAULT_LOCAL_URL = 'http://localhost:3000';

const STORAGE_KEY_SIMULATED_URL = 'mutualpool_simulated_url';
const STORAGE_KEY_SIMULATED_ENV = 'mutualpool_simulated_env';
const STORAGE_KEY_CUSTOM_PROD_URL = 'mutualpool_custom_prod_url';
const EVENT_SITE_URL_CHANGED = 'mutualpool_site_url_changed';

/**
 * Safely reads an environment variable in either Vite or Node environments
 */
function readEnvVar(name: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
      return String(import.meta.env[name]).trim();
    }
  } catch {
    // Ignore import.meta access errors
  }

  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return String(process.env[name]).trim();
    }
  } catch {
    // Ignore process access errors
  }

  return undefined;
}

/**
 * Retrieves the stored custom production domain (or default)
 */
export function getCustomProductionUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_PROD_URL);
      if (stored && stored.startsWith('http')) {
        return stored.replace(/\/+$/, '');
      }
    } catch {
      // Ignore localStorage errors
    }
  }
  return readEnvVar('VITE_PROD_URL') || DEFAULT_PROD_URL;
}

/**
 * Sets a custom production domain in localStorage
 */
export function setCustomProductionUrl(url: string): void {
  if (typeof window !== 'undefined') {
    try {
      const clean = url.trim().replace(/\/+$/, '');
      if (clean) {
        localStorage.setItem(STORAGE_KEY_CUSTOM_PROD_URL, clean);
        notifySiteUrlChange();
      }
    } catch {
      // Ignore localStorage errors
    }
  }
}

/**
 * Retrieves the simulated environment override if set by developer
 */
export function getSimulatedEnvironment(): AppEnvironment | null {
  if (typeof window !== 'undefined') {
    try {
      const val = localStorage.getItem(STORAGE_KEY_SIMULATED_ENV);
      if (val === 'production' || val === 'preview' || val === 'development') {
        return val;
      }
    } catch {
      // Ignore localStorage errors
    }
  }
  return null;
}

/**
 * Detects the active deployment environment ('development' | 'preview' | 'production')
 */
export function getAppEnvironment(): AppEnvironment {
  // 1. Check for active simulator override
  const simulatedEnv = getSimulatedEnvironment();
  if (simulatedEnv) {
    return simulatedEnv;
  }

  // 2. Explicit env override
  const explicitEnv = readEnvVar('VITE_APP_ENV');
  if (explicitEnv === 'production' || explicitEnv === 'preview' || explicitEnv === 'development') {
    return explicitEnv;
  }

  // 3. Browser runtime inspection
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname.toLowerCase();

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
      return 'development';
    }

    // Google Cloud Run preview / AI Studio sandbox
    if (hostname.includes('run.app')) {
      return 'development';
    }

    // Vercel development URL explicitly mentioned by user
    if (hostname === 'mutual-pool.vercel.app') {
      return 'development';
    }

    // Other Vercel preview or branch deployments
    if (hostname.includes('vercel.app')) {
      return 'preview';
    }

    // Custom domain in production (e.g. mutualpool.org or custom launch domain)
    return 'production';
  }

  // 4. Server / Build-time detection
  const isProd = readEnvVar('NODE_ENV') === 'production' || readEnvVar('PROD') === 'true';
  const vercelEnv = readEnvVar('VERCEL_ENV');

  if (vercelEnv === 'preview') return 'preview';
  if (vercelEnv === 'production') return 'production';
  if (isProd) return 'production';

  return 'development';
}

/**
 * Returns whether the current runtime environment is considered production
 */
export function isProduction(): boolean {
  return getAppEnvironment() === 'production';
}

/**
 * Returns whether the current runtime environment is considered development / preview
 */
export function isDevelopment(): boolean {
  return getAppEnvironment() !== 'production';
}

/**
 * Resolves the active base Site URL without trailing slash.
 * Priority:
 * 1. Developer simulation override (localStorage 'mutualpool_simulated_url')
 * 2. Explicit VITE_SITE_URL environment variable
 * 3. Browser environment: window.location.origin (dynamically tracks active host)
 * 4. Vercel deployment variables (VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL)
 * 5. Environment-based defaults (VITE_PROD_URL / DEFAULT_PROD_URL vs VITE_DEV_URL / DEFAULT_DEV_URL)
 */
export function getSiteUrl(): string {
  // 1. Check for manual local storage simulation override (developer tools)
  if (typeof window !== 'undefined') {
    try {
      const simulated = localStorage.getItem(STORAGE_KEY_SIMULATED_URL);
      if (simulated && simulated.startsWith('http')) {
        return simulated.replace(/\/+$/, '');
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  // 2. Check for explicit VITE_SITE_URL override
  const explicitSiteUrl = readEnvVar('VITE_SITE_URL');
  if (explicitSiteUrl && explicitSiteUrl.startsWith('http')) {
    return explicitSiteUrl.replace(/\/+$/, '');
  }

  // 3. Browser environment: dynamically use window.location.origin!
  // This automatically switches between https://mutual-pool.vercel.app, http://localhost:3000,
  // and the final production domain once launched and mapped.
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
    return window.location.origin.replace(/\/+$/, '');
  }

  // 4. Server environment with Vercel deployment variable
  const vercelProjectProdUrl = readEnvVar('VERCEL_PROJECT_PRODUCTION_URL');
  if (vercelProjectProdUrl && isProduction()) {
    const formatted = vercelProjectProdUrl.startsWith('http') ? vercelProjectProdUrl : `https://${vercelProjectProdUrl}`;
    return formatted.replace(/\/+$/, '');
  }

  const vercelUrl = readEnvVar('VERCEL_URL');
  if (vercelUrl) {
    const formatted = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
    return formatted.replace(/\/+$/, '');
  }

  // 5. Server environment with generic APP_URL
  const appUrl = readEnvVar('APP_URL');
  if (appUrl && appUrl.startsWith('http')) {
    return appUrl.replace(/\/+$/, '');
  }

  // 6. Fallback based on detected environment
  const env = getAppEnvironment();
  if (env === 'production') {
    return getCustomProductionUrl();
  }

  // Default development / preview URL
  const devUrl = readEnvVar('VITE_DEV_URL') || DEFAULT_DEV_URL;
  return devUrl.replace(/\/+$/, '');
}

/**
 * Builds a full URL on the dynamic site domain with path and query parameters
 */
export function buildSiteUrl(path = '', params?: Record<string, string | number | boolean | undefined | null>): string {
  const baseUrl = getSiteUrl();
  const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  const url = new URL(`${baseUrl}${cleanPath}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Builds the destination URL for Courier Apparel Sleeve QR Codes
 * Dynamically resolves to the active host with campaign tracking parameters.
 */
export function getSleeveQrUrl(customParams?: {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ref?: string;
}): string {
  return buildSiteUrl('/', {
    ref: customParams?.ref || 'sleeve_qr',
    utm_source: customParams?.utmSource || 'apparel_sleeve',
    utm_medium: customParams?.utmMedium || 'courier_qr',
    utm_campaign: customParams?.utmCampaign || 'advertise_with_us',
  });
}

/**
 * Builds a dynamic deep link for sharing a Savings Pod
 */
export function getPodShareUrl(podId: string, inviteCode?: string): string {
  return buildSiteUrl('/', {
    podId,
    ...(inviteCode ? { inviteCode } : {}),
  });
}

/**
 * Builds a dynamic invite link for Trusted Circle pods
 */
export function getTrustedCircleInviteUrl(inviteCode: string, refUserId?: string): string {
  return buildSiteUrl('/join', {
    code: inviteCode,
    ...(refUserId ? { ref: refUserId } : {}),
  });
}

/**
 * Dispatches an event to notify subscribers of site URL changes
 */
function notifySiteUrlChange() {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(EVENT_SITE_URL_CHANGED, { detail: getEnvironmentMeta() }));
    } catch {
      // Ignore event dispatch errors
    }
  }
}

/**
 * Subscribes to dynamic URL changes
 */
export function subscribeSiteUrl(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleEvent = () => callback();
  window.addEventListener(EVENT_SITE_URL_CHANGED, handleEvent);
  window.addEventListener('storage', handleEvent);

  return () => {
    window.removeEventListener(EVENT_SITE_URL_CHANGED, handleEvent);
    window.removeEventListener('storage', handleEvent);
  };
}

/**
 * Sets the active simulated site URL or clears it to return to auto
 */
export function setSimulatedSiteUrl(url: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (!url) {
      localStorage.removeItem(STORAGE_KEY_SIMULATED_URL);
      localStorage.removeItem(STORAGE_KEY_SIMULATED_ENV);
    } else {
      const clean = url.trim().replace(/\/+$/, '');
      localStorage.setItem(STORAGE_KEY_SIMULATED_URL, clean);
      
      // Infer simulated environment from URL
      if (clean.includes('localhost') || clean.includes('127.0.0.1')) {
        localStorage.setItem(STORAGE_KEY_SIMULATED_ENV, 'development');
      } else if (clean === DEFAULT_DEV_URL || clean.includes('vercel.app')) {
        localStorage.setItem(STORAGE_KEY_SIMULATED_ENV, 'development');
      } else {
        localStorage.setItem(STORAGE_KEY_SIMULATED_ENV, 'production');
      }
    }
    notifySiteUrlChange();
  } catch (err) {
    console.warn('Failed to update simulated site URL:', err);
  }
}

/**
 * Sets active URL mode: 'auto' | 'development' | 'production' | 'localhost' | 'custom'
 */
export function setSiteUrlMode(mode: SiteUrlMode, customUrl?: string): void {
  switch (mode) {
    case 'auto':
      setSimulatedSiteUrl(null);
      break;
    case 'development':
      setSimulatedSiteUrl(readEnvVar('VITE_DEV_URL') || DEFAULT_DEV_URL);
      break;
    case 'production':
      setSimulatedSiteUrl(getCustomProductionUrl());
      break;
    case 'localhost':
      setSimulatedSiteUrl(DEFAULT_LOCAL_URL);
      break;
    case 'custom':
      if (customUrl) {
        setSimulatedSiteUrl(customUrl);
      }
      break;
  }
}

/**
 * Comprehensive metadata object about the current environment & dynamic URL
 */
export function getEnvironmentMeta() {
  const env = getAppEnvironment();
  const siteUrl = getSiteUrl();
  const isProd = isProduction();
  const isDev = isDevelopment();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'server';
  const simulatedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SIMULATED_URL) : null;
  const isSimulated = Boolean(simulatedUrl);
  const customProdUrl = getCustomProductionUrl();
  const devUrl = readEnvVar('VITE_DEV_URL') || DEFAULT_DEV_URL;

  // Determine active mode
  let activeMode: SiteUrlMode = 'auto';
  if (simulatedUrl) {
    if (simulatedUrl === devUrl) activeMode = 'development';
    else if (simulatedUrl === customProdUrl || simulatedUrl === DEFAULT_PROD_URL) activeMode = 'production';
    else if (simulatedUrl === DEFAULT_LOCAL_URL || simulatedUrl.includes('localhost')) activeMode = 'localhost';
    else activeMode = 'custom';
  }

  return {
    environment: env,
    siteUrl,
    isProduction: isProd,
    isDevelopment: isDev,
    isVercel: hostname.includes('vercel.app') || siteUrl.includes('vercel.app'),
    isLocalhost: hostname === 'localhost' || hostname === '127.0.0.1' || siteUrl.includes('localhost'),
    isSimulated,
    activeMode,
    hostname,
    defaultDevUrl: DEFAULT_DEV_URL,
    defaultProdUrl: DEFAULT_PROD_URL,
    configuredDevUrl: devUrl,
    configuredProdUrl: customProdUrl,
  };
}

/**
 * React Hook for consuming dynamic Site URL and environment in components
 */
export function useSiteUrl() {
  const [meta, setMeta] = useState(getEnvironmentMeta);

  useEffect(() => {
    // Initial sync
    setMeta(getEnvironmentMeta());

    // Subscribe to dynamic switches across tabs and components
    const unsubscribe = subscribeSiteUrl(() => {
      setMeta(getEnvironmentMeta());
    });

    return unsubscribe;
  }, []);

  const switchMode = (mode: SiteUrlMode, customUrl?: string) => {
    setSiteUrlMode(mode, customUrl);
    setMeta(getEnvironmentMeta());
  };

  const updateCustomProdUrl = (url: string) => {
    setCustomProductionUrl(url);
    setMeta(getEnvironmentMeta());
  };

  const resetToAuto = () => {
    setSimulatedSiteUrl(null);
    setMeta(getEnvironmentMeta());
  };

  return {
    ...meta,
    switchMode,
    setCustomProductionUrl: updateCustomProdUrl,
    resetToAuto,
    buildUrl: buildSiteUrl,
    sleeveQrUrl: getSleeveQrUrl(),
    trustedCircleInviteUrl: (code: string, ref?: string) => getTrustedCircleInviteUrl(code, ref),
    podShareUrl: (podId: string, code?: string) => getPodShareUrl(podId, code),
  };
}
