import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';

process.env.VERCEL = '1';

const { app } = await import('../server');

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
