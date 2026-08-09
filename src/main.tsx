import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  // Suppress unhandled rejections from crypto/wallet browser extensions
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (
      reason.includes('MetaMask') ||
      reason.includes('ethereum') ||
      reason.includes('extension') ||
      reason.includes('Resetting the streams')
    ) {
      event.preventDefault();
    }
  });

  // Filter out repetitive third-party browser extension contentscript logs
  const origLog = console.log;
  const origError = console.error;

  const isExtensionNoise = (args: any[]) => {
    try {
      const str = args.map(a => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' ');
      return (
        str.includes('Resetting the streams') ||
        str.includes('MetaMask') ||
        str.includes('contentscript')
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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

