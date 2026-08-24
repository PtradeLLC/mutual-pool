import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LanguageProvider } from './i18n';
import './index.css';

if (typeof window !== 'undefined') {
  // Suppress unhandled errors from crypto/wallet browser extensions
  window.addEventListener('error', (event) => {
    const msg = event.message || (event.error && (event.error.message || String(event.error))) || '';
    const filename = event.filename || '';
    const stack = (event.error && event.error.stack) || '';
    const fullText = (msg + ' ' + filename + ' ' + stack).toLowerCase();

    if (
      fullText.includes('metamask') ||
      fullText.includes('ethereum') ||
      fullText.includes('extension') ||
      fullText.includes('inpage.js') ||
      fullText.includes('contentscript') ||
      fullText.includes('resetting the streams') ||
      fullText.includes('error restoring session') ||
      fullText.includes('failed to connect to metamask') ||
      fullText.includes('chrome-extension') ||
      fullText.includes('moz-extension')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Suppress unhandled rejections from crypto/wallet browser extensions
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || (typeof event.reason === 'string' ? event.reason : '') || String(event.reason || '');
    const stack = event.reason?.stack || '';
    const fullText = (reason + ' ' + stack).toLowerCase();

    if (
      fullText.includes('metamask') ||
      fullText.includes('ethereum') ||
      fullText.includes('extension') ||
      fullText.includes('inpage.js') ||
      fullText.includes('contentscript') ||
      fullText.includes('resetting the streams') ||
      fullText.includes('error restoring session') ||
      fullText.includes('failed to connect to metamask') ||
      fullText.includes('chrome-extension') ||
      fullText.includes('moz-extension')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Filter out repetitive third-party browser extension contentscript logs
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;

  const isExtensionNoise = (args: any[]) => {
    try {
      const str = args.map(a => {
        if (typeof a === 'object' && a !== null) {
          if (a instanceof Error) return a.message + ' ' + (a.stack || '');
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        }
        return String(a);
      }).join(' ').toLowerCase();

      return (
        str.includes('resetting the streams') ||
        str.includes('metamask') ||
        str.includes('contentscript') ||
        str.includes('ethereum') ||
        str.includes('inpage.js') ||
        str.includes('error restoring session') ||
        str.includes('failed to connect to metamask') ||
        str.includes('maxlistenersexceededwarning') ||
        str.includes('could not establish connection') ||
        str.includes('chrome-extension://') ||
        str.includes('moz-extension://')
      ) && !str.includes('firestore');
    } catch {
      return false;
    }
  };

  console.log = (...args: any[]) => {
    if (isExtensionNoise(args)) return;
    origLog.apply(console, args);
  };

  console.error = (...args: any[]) => {
    if (isExtensionNoise(args)) return;
    origError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    if (isExtensionNoise(args)) return;
    origWarn.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);

