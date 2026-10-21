// Invited-contact validation shared by the create-pod wizard and the server.
//
// A contact is an email address or a phone number. Emails are lower-cased;
// phone numbers are normalised to E.164 (+14155550192), with bare 10-digit
// numbers treated as US. Anything else is rejected so a typo like "jon@" is
// never stored as an invitation that can't be delivered.

export type InviteContactKind = 'email' | 'phone';

export interface NormalizedInviteContact {
  value: string;
  kind: InviteContactKind;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeInviteContact(raw: unknown): NormalizedInviteContact | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > 254) return null;
  if (s.includes('@')) {
    return EMAIL_RE.test(s) ? { value: s.toLowerCase(), kind: 'email' } : null;
  }
  const digits = s.replace(/[^\d]/g, '');
  if (!/^\+?[\d\s().-]+$/.test(s) || digits.length < 10 || digits.length > 15) return null;
  if (digits.length === 10) return { value: `+1${digits}`, kind: 'phone' };
  if (digits.length === 11 && digits.startsWith('1') && !s.startsWith('+')) return { value: `+${digits}`, kind: 'phone' };
  return { value: `+${digits}`, kind: 'phone' };
}

export function isPhoneContact(value: string): boolean {
  return !value.includes('@');
}
