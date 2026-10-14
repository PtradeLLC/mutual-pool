// Starts an isolated dev server, runs node:test files against it, then stops it.
//
//   tsx scripts/run-server-tests.ts --env=secure tests/security.test.ts
//   tsx scripts/run-server-tests.ts --env=demo tests/feature-integration.test.ts
//
// --env=secure  production auth rules (no DEMO_MODE): verifies spoofing is rejected
// --env=demo    DEMO_MODE: header-based test identities for end-to-end flows
//
// The server writes its JSON data into a temp dir and never talks to Firestore.
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const args = process.argv.slice(2);
const mode = (args.find(a => a.startsWith('--env='))?.split('=')[1] || 'secure') as 'secure' | 'demo';
const testFiles = args.filter(a => !a.startsWith('--'));
const port = mode === 'demo' ? 3101 : 3102;
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutual-pool-test-'));

const serverEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(port),
  DATA_DIR: dataDir,
  DISABLE_FIRESTORE: 'true',
  DEMO_MODE: mode === 'demo' ? 'true' : 'false',
  STRIPE_SECRET_KEY: 'sk_test_runner_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_runner_secret',
  CRON_SECRET: 'test-cron-secret',
  GEMINI_API_KEY: '',
  GROQ_API_KEY: '',
  FOURTHWALL_API_KEY: '',
  FOURTHWALL_WEBHOOK_SECRET: 'fw_test_secret',
};

async function waitForHealth(timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server did not become healthy at ${baseUrl}`);
}

async function main() {
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', d => { serverLog += d; });
  server.stderr.on('data', d => { serverLog += d; });

  let exitCode = 1;
  try {
    await waitForHealth();
    exitCode = await new Promise<number>(resolve => {
      // One file at a time: they share a single server, and the settlement sweeps
      // act on every active pod, so parallel files would trip over each other.
      const runner = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...testFiles], {
        env: { ...process.env, TEST_BASE_URL: baseUrl, STRIPE_WEBHOOK_SECRET: serverEnv.STRIPE_WEBHOOK_SECRET, CRON_SECRET: serverEnv.CRON_SECRET, FOURTHWALL_WEBHOOK_SECRET: serverEnv.FOURTHWALL_WEBHOOK_SECRET },
        stdio: 'inherit',
      });
      runner.on('exit', code => resolve(code ?? 1));
    });
  } catch (err) {
    console.error(err);
    console.error('--- server output ---\n' + serverLog.slice(-4000));
  } finally {
    server.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  if (exitCode !== 0) {
    console.error('--- server output (tail) ---\n' + serverLog.slice(-3000));
  }
  process.exit(exitCode);
}

main();
