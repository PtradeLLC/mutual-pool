import { SupportedCountryCode } from '../config/countries/types';
import { getCountryByCode } from '../config/countries';

/**
 * Checks if the application is currently running in an installed PWA standalone mode
 * or an App Store wrapper (iOS home screen, Android TWA / WebAPK, PWABuilder wrapper).
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Standard CSS display-mode media query (Chromium, Edge, modern Safari)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // 2. iOS Safari standalone boolean
    if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) {
      return true;
    }

    // 3. Android Trusted Web Activity (TWA) or referrer check
    if (document.referrer && document.referrer.startsWith('android-app://')) {
      return true;
    }

    // 4. URL query param or session flag for wrapped webviews
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('display') === 'standalone' || urlParams.get('source') === 'app_store') {
      return true;
    }
  } catch (err) {
    // Ignore error and fallback to browser mode
  }

  return false;
}

/**
 * Handles country switching with respect to PWA and App Store isolation rules:
 * - If running inside an installed PWA / App Store wrapper:
 *   NEVER redirect to an external domain (e.g. myapp.ng), which causes iOS/Android to kick
 *   the user out of full-screen app mode into Safari/Chrome. Instead, execute an in-app state switch.
 * - If running in a standard web browser:
 *   Redirect to the respective country domain in production, or switch locally in dev/preview.
 */
export function executeCountrySwitch(
  targetCode: SupportedCountryCode,
  onInAppContextSwitch: (code: SupportedCountryCode) => void
): { switchedInApp: boolean; targetDomain?: string } {
  if (typeof window === 'undefined') {
    return { switchedInApp: true };
  }

  const isStandalone = isStandaloneMode();
  const targetConfig = getCountryByCode(targetCode);

  // Persist the user's preference locally
  try {
    localStorage.setItem('mutualpool_active_country', targetCode);
  } catch {
    // Ignore local storage quota errors
  }

  const currentHost = window.location.hostname.toLowerCase();
  const isDevOrPreview =
    currentHost.includes('localhost') ||
    currentHost.includes('127.0.0.1') ||
    currentHost.includes('run.app') ||
    currentHost.includes('vercel.app');

  // CRITICAL PWA & APP STORE RULE:
  // In standalone mode or dev environments, ALWAYS switch in-app to prevent external window breakout!
  if (isStandalone || isDevOrPreview) {
    onInAppContextSwitch(targetCode);
    return { switchedInApp: true, targetDomain: targetConfig.primaryDomain };
  }

  // Web browser in production: Navigate to the country-specific domain
  const targetDomain = targetConfig.primaryDomain;
  if (currentHost !== targetDomain && !currentHost.endsWith(`.${targetDomain}`)) {
    const protocol = window.location.protocol;
    const pathAndQuery = window.location.pathname + window.location.search;
    window.location.href = `${protocol}//${targetDomain}${pathAndQuery}`;
    return { switchedInApp: false, targetDomain };
  }

  // Already on the right domain
  onInAppContextSwitch(targetCode);
  return { switchedInApp: true, targetDomain };
}
