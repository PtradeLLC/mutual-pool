// Encryption for creators' tax IDs (SSN or EIN from the W-9). This is the only
// place the app stores one, so it is kept apart from everything else:
//
//   - AES-256-GCM with a dedicated key, TAX_ID_ENCRYPTION_KEY (32 bytes, base64),
//     held as a Fly secret and used for nothing else;
//   - stored as "v1:<iv>:<tag>:<ciphertext>" (base64 parts);
//   - only the admin year-end export decrypts it.
//
// Without the key, production refuses to accept tax forms. Outside production
// a fixed development key is used so tests and local runs work.

import crypto from 'node:crypto';

const DEV_KEY = crypto.createHash('sha256').update('mutualpool-dev-only-tax-id-key').digest();

export function taxIdKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.TAX_ID_ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('TAX_ID_ENCRYPTION_KEY must be 32 bytes, base64-encoded.');
    return key;
  }
  return env.NODE_ENV === 'production' ? null : DEV_KEY;
}

export function encryptTaxId(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decryptTaxId(stored: string, key: Buffer): string {
  const [v, iv, tag, ct] = String(stored).split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unrecognized tax ID format.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

// Digits only; 9 for both SSN and EIN.
export function normalizeTaxId(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return /^\d{9}$/.test(digits) ? digits : null;
}

// CSV cell, quoted, with spreadsheet formula injection neutralized.
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
