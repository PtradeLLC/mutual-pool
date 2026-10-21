// With TREASURY_ENABLED unset, nothing the server sends may claim FDIC or
// pass-through insurance. Runs against the DEMO_MODE test server.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const CLAIM = /fdic|pass-?through/i;
const headers = {
  'content-type': 'application/json',
  'x-user-id': 'usr_treasury_gate',
  'x-user-email': 'gate@example.test',
  'x-user-kyc-status': 'VERIFIED',
};

async function ask(query: string, language = 'en') {
  const res = await fetch(`${BASE_URL}/api/ai/voice-guide`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, currentContext: { language } }),
  });
  assert.equal(res.status, 200);
  return res.json();
}

test('voice guide never claims FDIC insurance while Treasury is off', async () => {
  const questions: Array<[string, string]> = [
    ['Is my Stripe Treasury balance FDIC pass-through insured?', 'en'],
    ['How does MutualPool work?', 'en'],
    ['Is this a loan?', 'en'],
    ['¿Mi saldo tiene seguro FDIC?', 'es'],
    ['Mon solde est-il garanti par la FDIC ?', 'fr'],
    ['hello', 'en'],
  ];
  for (const [q, lang] of questions) {
    const data = await ask(q, lang);
    for (const field of ['spokenText', 'displayText'] as const) {
      const text = String(data[field] || '');
      assert.ok(!CLAIM.test(text), `${lang} "${q}" -> ${field} contains a claim: ${text.slice(0, 200)}`);
    }
  }
});

test('the banking answer describes the real custody model', async () => {
  const data = await ask('Is my balance safe?');
  assert.match(String(data.spokenText), /MutualPool account/i);
  assert.match(String(data.spokenText), /not a bank/i);
});

test('country regulatory notice makes no insurance claim', async () => {
  const res = await fetch(`${BASE_URL}/api/country/current`);
  const { regulations } = (await res.json()).country;
  assert.ok(!CLAIM.test(regulations.regulatoryBody), regulations.regulatoryBody);
  // The notice may only mention FDIC to say balances are NOT insured.
  assert.match(regulations.regulatoryNotice, /not FDIC insured/);
  const withoutNegation = regulations.regulatoryNotice.replace(/not FDIC insured/g, '');
  assert.ok(!CLAIM.test(withoutNegation), regulations.regulatoryNotice);
});
