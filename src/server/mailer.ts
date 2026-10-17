// Outbound email. Members get important money events (invitations, missed
// deposits, bank debits) by email as well as in-app.
//
// Transport: Resend's HTTP API when RESEND_API_KEY is set (plain fetch, no SDK).
// Without a key every message is kept in the `outboundEmails` queue (persisted
// like other state) with status QUEUED, so nothing is silently lost and an
// admin can see what would have gone out. Swap the transport by replacing
// `deliver()`.

export type OutboundEmailStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface OutboundEmail {
  id: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  kind: string;
  status: OutboundEmailStatus;
  providerId?: string;
  error?: string;
  createdAt: string;
  sentAt?: string;
}

let queue: OutboundEmail[] = [];
export const getOutboundEmails = () => queue;
export const setOutboundEmails = (docs: OutboundEmail[]) => { queue = docs; };

const MAX_QUEUE = 2000;
const SEND_TIMEOUT_MS = 10_000;

export function getMailerStatus() {
  return {
    configured: Boolean(process.env.RESEND_API_KEY),
    from: process.env.EMAIL_FROM || '',
    queued: queue.filter(e => e.status === 'QUEUED').length,
    failed: queue.filter(e => e.status === 'FAILED').length,
  };
}

function isEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// Minimal HTML wrapper so plain-text bodies read well in mail clients.
function wrapHtml(subject: string, text: string): string {
  const paragraphs = text.split(/\n{2,}/).map(p => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:24px">
<h2 style="font-size:18px;margin:0 0 16px">${escapeHtml(subject)}</h2>${paragraphs}
<p style="color:#6b7280;font-size:12px;margin-top:24px">MutualPool · This message was sent because of activity on your account.</p>
</body></html>`;
}

async function deliver(mail: OutboundEmail): Promise<{ id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('mailer not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: controller.signal,
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || body?.error || `Resend ${res.status}`);
    return { id: body?.id };
  } finally {
    clearTimeout(timer);
  }
}

// Fire-and-forget: never throws, never blocks the caller's response.
export function sendEmail(input: { to: string | undefined | null; subject: string; text: string; kind: string; onChange?: () => void }): OutboundEmail | null {
  if (!isEmail(input.to)) return null;
  const mail: OutboundEmail = {
    id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    to: input.to,
    subject: input.subject.slice(0, 200),
    text: input.text,
    html: wrapHtml(input.subject, input.text),
    kind: input.kind,
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  };
  queue.unshift(mail);
  if (queue.length > MAX_QUEUE) queue = queue.slice(0, MAX_QUEUE);

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.log(`[mailer] queued (no provider configured): ${mail.kind} → ${mail.to}: ${mail.subject}`);
    input.onChange?.();
    return mail;
  }
  deliver(mail)
    .then(r => { mail.status = 'SENT'; mail.providerId = r.id; mail.sentAt = new Date().toISOString(); })
    .catch(err => { mail.status = 'FAILED'; mail.error = String(err?.message || err).slice(0, 300); console.error('[mailer] send failed:', mail.kind, mail.error); })
    .finally(() => input.onChange?.());
  return mail;
}
