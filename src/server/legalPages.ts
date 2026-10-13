// Standalone HTML pages for /privacy and /terms, rendered on the server from
// the shared content so they work without JavaScript (Stripe applications, app
// store listings, email links, crawlers).
import { getPrivacyPolicy, getTermsOfService, parseInline, type LegalContext, type LegalDocument } from '../content/legalDocuments';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(text: string): string {
  return parseInline(text).map(tok => {
    if (tok.type === 'bold') return `<strong>${escapeHtml(tok.text)}</strong>`;
    if (tok.type === 'link') {
      const safe = /^(https?:\/\/|mailto:|\/)/.test(tok.href) ? tok.href : '#';
      return `<a href="${escapeHtml(safe)}">${escapeHtml(tok.text)}</a>`;
    }
    return escapeHtml(tok.text);
  }).join('');
}

export function renderLegalHtml(doc: LegalDocument, opts: { siteName: string; appUrl: string; lastUpdated: string }): string {
  const sections = doc.sections.map((s, i) => {
    const parts: string[] = [`<h2 id="s${i + 1}">${i + 1}. ${escapeHtml(s.title)}</h2>`];
    for (const p of s.paragraphs || []) parts.push(`<p>${inline(p)}</p>`);
    if (s.bullets?.length) parts.push(`<ul>${s.bullets.map(b => `<li>${inline(b)}</li>`).join('')}</ul>`);
    if (s.after) parts.push(`<p>${inline(s.after)}</p>`);
    return parts.join('\n');
  }).join('\n');

  const toc = doc.sections.map((s, i) => `<li><a href="#s${i + 1}">${escapeHtml(s.title)}</a></li>`).join('');
  const other = doc.slug === 'privacy' ? { href: '/terms', label: 'Terms of Service' } : { href: '/privacy', label: 'Privacy Policy' };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.title)} · ${escapeHtml(opts.siteName)}</title>
<meta name="description" content="${escapeHtml(doc.heading)}">
<link rel="canonical" href="${escapeHtml(opts.appUrl)}/${doc.slug}">
<link rel="icon" href="/favicon.ico">
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; background: #F8FAFC; line-height: 1.6; }
  header { background: #fff; border-bottom: 1px solid #DDE1E6; }
  .wrap { max-width: 800px; margin: 0 auto; padding: 16px 20px; }
  header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #111827; font-weight: 800; }
  .brand img { width: 32px; height: 32px; border-radius: 8px; }
  nav a { color: #005FB8; text-decoration: none; font-size: 14px; margin-left: 16px; }
  main { background: #fff; border: 1px solid #DDE1E6; border-radius: 16px; margin: 24px auto; padding: 28px 32px; max-width: 800px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .meta { color: #6B7280; font-size: 13px; margin-bottom: 20px; }
  .intro { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 14px 16px; font-size: 15px; }
  .toc { font-size: 14px; columns: 2; margin: 20px 0; padding-left: 20px; }
  h2 { font-size: 17px; margin: 26px 0 8px; }
  p, li { font-size: 15px; }
  ul { padding-left: 22px; }
  a { color: #005FB8; }
  footer { color: #6B7280; font-size: 13px; text-align: center; padding: 8px 20px 32px; }
  @media (max-width: 600px) { .toc { columns: 1; } main { padding: 20px; margin: 12px; } }
  @media print { header, footer, .toc { display: none; } main { border: 0; } }
</style>
</head>
<body>
<header><div class="wrap">
  <a class="brand" href="/"><img src="/android-chrome-192x192.png" alt=""> ${escapeHtml(opts.siteName)}</a>
  <nav><a href="/">Home</a><a href="${other.href}">${other.label}</a></nav>
</div></header>
<main>
  <h1>${escapeHtml(doc.heading)}</h1>
  <div class="meta">${escapeHtml(doc.title)} · Version ${escapeHtml(doc.version)} · Last updated ${escapeHtml(opts.lastUpdated)}</div>
  <div class="intro">${inline(doc.intro)}</div>
  <ol class="toc">${toc}</ol>
  ${sections}
  <p><em>${inline(doc.contact)}</em></p>
</main>
<footer>© ${new Date().getFullYear()} ${escapeHtml(opts.siteName)} · <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a></footer>
</body>
</html>`;
}

export function buildLegalDocument(slug: 'privacy' | 'terms', ctx: LegalContext): LegalDocument {
  return slug === 'privacy' ? getPrivacyPolicy(ctx) : getTermsOfService(ctx);
}
