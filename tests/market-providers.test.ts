// Payment providers for the markets outside the US (Paystack: Nigeria, Kenya;
// Stripe: UK, Mexico). Paystack calls are checked against a stubbed fetch; no
// network access is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import Stripe from 'stripe';
import { PaymentProviderFactory } from '../src/services/payments/factory';

type Call = { url: string; body: any; auth: string | null };

function stubFetch(responses: Record<string, any>) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: any) => {
    const path = String(url).replace('https://api.paystack.co', '');
    calls.push({ url: path, body: JSON.parse(init?.body || '{}'), auth: init?.headers?.Authorization ?? null });
    const data = responses[path];
    return new Response(JSON.stringify(data ? { status: true, message: 'ok', data } : { status: false, message: `no stub for ${path}` }), { status: data ? 200 : 400 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('Kenya deposits open a Paystack checkout in KES with M-Pesa', async () => {
  process.env.PAYSTACK_KE_SECRET_KEY = 'sk_test_ke';
  const f = stubFetch({ '/transaction/initialize': { authorization_url: 'https://checkout.paystack.com/abc', reference: 'mp-dep-1' } });
  try {
    const ke = PaymentProviderFactory.getProvider('KE');
    const r = await ke.createDepositIntent({ amountMinorUnits: 50000, currency: 'KES', userId: 'u1', userEmail: 'a@example.test', podId: 'pod_1' });
    assert.equal(r.success, true);
    assert.equal(r.redirectUrl, 'https://checkout.paystack.com/abc');
    assert.equal(r.paymentIntentId, 'mp-dep-1');
    assert.equal(r.feeMinorUnits, 0, 'no fee on top-ups');
    const call = f.calls[0];
    assert.equal(call.auth, 'Bearer sk_test_ke');
    assert.equal(call.body.currency, 'KES');
    assert.equal(call.body.amount, 50000);
    assert.deepEqual(call.body.channels, ['mobile_money', 'card']);
    assert.match(call.body.reference, /^[a-z0-9-]{16,50}$/);
    assert.equal(call.body.metadata.userId, 'u1');
  } finally {
    f.restore();
  }
});

test('Kenya payouts go to an M-Pesa number', async () => {
  process.env.PAYSTACK_KE_SECRET_KEY = 'sk_test_ke';
  const f = stubFetch({
    '/transferrecipient': { recipient_code: 'RCP_1' },
    '/transfer': { transfer_code: 'TRF_1', status: 'pending' },
  });
  try {
    const r = await PaymentProviderFactory.getProvider('KE').processDisbursement({
      amountMinorUnits: 120000, currency: 'KES', destinationAccountId: '254712345678', accountName: 'Wanjiru K', userId: 'u1', narration: 'Chama payout', reference: 'wd_42',
    });
    assert.equal(r.success, true);
    assert.equal(r.status, 'PENDING');
    assert.equal(r.transferId, 'TRF_1');
    assert.equal(f.calls[0].body.type, 'mobile_money');
    assert.equal(f.calls[0].body.bank_code, 'MPESA');
    assert.equal(f.calls[0].body.account_number, '254712345678');
    assert.equal(f.calls[1].body.recipient, 'RCP_1');
    assert.equal(f.calls[1].body.amount, 120000);
    assert.match(f.calls[1].body.reference, /wd-42/, 'the payout reference is stable, so retries never pay twice');
  } finally {
    f.restore();
  }
});

test('Nigeria payouts go to a bank account (NUBAN) and need a bank code', async () => {
  process.env.PAYSTACK_NG_SECRET_KEY = 'sk_test_ng';
  const f = stubFetch({ '/transferrecipient': { recipient_code: 'RCP_2' }, '/transfer': { transfer_code: 'TRF_2', status: 'success' } });
  try {
    const ng = PaymentProviderFactory.getProvider('NG');
    const missing = await ng.processDisbursement({ amountMinorUnits: 100000, currency: 'NGN', destinationAccountId: '0123456789', userId: 'u2', narration: 'Ajo payout' });
    assert.equal(missing.success, false);
    assert.match(missing.error || '', /bank code/);
    const ok = await ng.processDisbursement({ amountMinorUnits: 100000, currency: 'NGN', destinationAccountId: '0123456789', destinationBankRouting: '058', userId: 'u2', narration: 'Ajo payout' });
    assert.equal(ok.status, 'SUCCESS');
    assert.equal(f.calls[0].body.type, 'nuban');
  } finally {
    f.restore();
  }
});

test('Paystack errors and missing keys come back as failures, not fake successes', async () => {
  delete process.env.PAYSTACK_NG_SECRET_KEY;
  const r = await PaymentProviderFactory.getProvider('NG').createDepositIntent({ amountMinorUnits: 100000, currency: 'NGN', userId: 'u3', userEmail: 'b@example.test' });
  assert.equal(r.success, false);
  assert.match(r.error || '', /PAYSTACK_NG_SECRET_KEY/);

  process.env.PAYSTACK_NG_SECRET_KEY = 'sk_test_ng';
  const f = stubFetch({});
  try {
    const r2 = await PaymentProviderFactory.getProvider('NG').createDepositIntent({ amountMinorUnits: 100000, currency: 'NGN', userId: 'u3', userEmail: 'b@example.test' });
    assert.equal(r2.success, false);
    assert.equal(r2.status, 'failed');
  } finally {
    f.restore();
  }
});

test('Paystack webhook signatures are HMAC-SHA512 of the raw body', () => {
  process.env.PAYSTACK_KE_SECRET_KEY = 'sk_test_ke';
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'mp-dep-1' } });
  const sig = crypto.createHmac('sha512', 'sk_test_ke').update(body).digest('hex');
  const ke = PaymentProviderFactory.getProvider('KE');
  assert.equal(ke.verifyWebhookSignature(body, sig), true);
  assert.equal(ke.verifyWebhookSignature(body, 'deadbeef'), false);
  assert.equal(ke.verifyWebhookSignature(body + ' ', sig), false);
});

test('Stripe market webhooks verify with that market\'s own secret', () => {
  process.env.STRIPE_MX_WEBHOOK_SECRET = 'whsec_mx';
  process.env.STRIPE_GB_WEBHOOK_SECRET = 'whsec_gb';
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const mxSig = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_mx' });
  assert.equal(PaymentProviderFactory.getProvider('MX').verifyWebhookSignature(payload, mxSig), true);
  assert.equal(PaymentProviderFactory.getProvider('GB').verifyWebhookSignature(payload, mxSig), false);
  assert.equal(PaymentProviderFactory.getProvider('MX').verifyWebhookSignature(payload, ''), false);
});

test('Stripe market providers fail cleanly without keys and only pay Connect accounts', async () => {
  delete process.env.STRIPE_MX_SECRET_KEY;
  const mx = PaymentProviderFactory.getProvider('MX');
  const dep = await mx.createDepositIntent({ amountMinorUnits: 20000, currency: 'MXN', userId: 'u4', userEmail: 'c@example.test' });
  assert.equal(dep.success, false);
  assert.match(dep.error || '', /STRIPE_MX_SECRET_KEY/);
  const pay = await mx.processDisbursement({ amountMinorUnits: 20000, currency: 'MXN', destinationAccountId: '012180001234567890', userId: 'u4', narration: 'Tanda payout' });
  assert.equal(pay.success, false);
  assert.match(pay.error || '', /Connect account/);
});
