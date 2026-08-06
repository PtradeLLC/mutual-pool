import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';

process.env.VERCEL = '1';

const { app, isServerlessRuntime } = await import('../server');

test('detects AWS Lambda-style serverless environments', () => {
  const previousVercel = process.env.VERCEL;
  const previousLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;

  delete process.env.VERCEL;
  process.env.AWS_LAMBDA_FUNCTION_NAME = 'mutual-pool-api';

  try {
    assert.equal(isServerlessRuntime(), true);
  } finally {
    if (previousVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = previousVercel;
    }

    if (previousLambda === undefined) {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    } else {
      process.env.AWS_LAMBDA_FUNCTION_NAME = previousLambda;
    }
  }
});

test('POST /api/pods accepts verified users from headers even without prior sync', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get test server port');
  }

  const port = (address as AddressInfo).port;
  const payload = JSON.stringify({
    name: 'Header Verified Pod',
    description: 'Regression test',
    category: 'Food Delivery & Rideshare',
    sizeTier: 20,
    depositTier: 20,
  });

  const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/pods',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'usr_header_verified_001',
        'x-user-name': 'Header Verified User',
        'x-user-email': 'header@example.com',
        'x-user-kyc-status': 'VERIFIED',
        'x-user-account-age-days': '365',
        'x-user-completed-pods-count': '1',
        'x-user-platform': 'Uber Eats',
        'x-user-role': 'RIDER',
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode ?? 0, body });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Header Verified Pod/);

  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('POST /api/pods returns a normal 403 for unverified users when headers are provided as arrays', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get test server port');
  }

  const port = (address as AddressInfo).port;
  const payload = JSON.stringify({
    name: 'Regression Pod',
    description: 'Regression test',
    category: 'Food Delivery & Rideshare',
    sizeTier: 20,
    depositTier: 20,
  });

  const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/pods',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'usr_test_001',
        'x-user-name': 'Test User',
        'x-user-email': ['test@example.com'],
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode ?? 0, body });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body, /KYC_REQUIRED/);

  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});
