// Runtime mode + production configuration guards for the Node server.
//
// DEMO_MODE re-enables the legacy simulation paths (header-based identity,
// simulated KYC, direct Treasury top-ups, fabricated Stripe IDs, seed data).
// It is only honoured outside production, so a misconfigured env var can never
// turn the simulations on for real users.

// Guarded so modules shared with the browser bundle (e.g. the Fourthwall catalog) can import this.
const env: Record<string, string | undefined> = typeof process !== 'undefined' && process.env ? process.env : {};

export const IS_PRODUCTION = env.NODE_ENV === 'production';
export const DEMO_MODE = !IS_PRODUCTION && env.DEMO_MODE === 'true';

// Where development JSON data files live (tests point this at a temp dir).
export const DATA_DIR = env.DATA_DIR || (typeof process !== 'undefined' ? process.cwd() : '');

const REQUIRED_PRODUCTION_ENV = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FIREBASE_PROJECT_ID',
  'APP_URL',
] as const;

// Fail fast at boot instead of silently falling back to sandbox/simulated behaviour.
// `extraProblems` lets the server add checks for modules that must not be
// imported here (this file is also bundled into the browser), e.g. storage.
export function assertProductionConfig(extraProblems: string[] = []): void {
  if (!IS_PRODUCTION) return;

  const problems: string[] = [...extraProblems];
  for (const key of REQUIRED_PRODUCTION_ENV) {
    const fallback = key === 'FIREBASE_PROJECT_ID' ? process.env.VITE_FIREBASE_PROJECT_ID : undefined;
    if (!process.env[key] && !fallback) problems.push(`${key} is not set`);
  }
  if (process.env.STRIPE_SECRET_KEY?.includes('placeholder')) {
    problems.push('STRIPE_SECRET_KEY is a placeholder value');
  }
  if (process.env.DEMO_MODE === 'true') {
    problems.push('DEMO_MODE=true is not allowed in production');
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
    problems.push('Serverless runtimes are not supported: state is held in memory, so run a single long-lived Node instance (see Dockerfile)');
  }

  if (problems.length > 0) {
    throw new Error(`Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
  }
}

// Origins allowed to call the API cross-origin. The SPA is served by this same
// server, so in production this is normally just APP_URL.
export function getAllowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  const origins = new Set(configured);
  for (const url of [process.env.APP_URL, process.env.VITE_PROD_URL, process.env.VITE_DEV_URL]) {
    if (!url) continue;
    try {
      origins.add(new URL(url).origin);
    } catch {
      // ignore malformed URLs
    }
  }
  if (!IS_PRODUCTION) {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  return Array.from(origins);
}

// Parse a client-supplied money amount. Returns null for anything that is not a
// finite, positive amount with at most two decimals within the given bounds.
export function parseMoneyAmount(value: unknown, { max = 100_000 }: { max?: number } = {}): number | null {
  const n = typeof value === 'string' ? Number(value.trim()) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return null;
  return Math.round(n * 100) / 100;
}
