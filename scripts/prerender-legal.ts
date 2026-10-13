// Writes the Privacy Policy and Terms of Service as static HTML into dist/, so
// the pages exist on any host that only serves the built files (e.g. a static
// Vercel deployment) as well as from the Express server, which renders the same
// content live at /privacy and /terms. Runs as part of `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { buildLegalDocument, renderLegalHtml } from '../src/server/legalPages';
import { US_CONFIG } from '../src/config/countries';
import { TREASURY_PROGRAM_ENABLED } from '../src/lib/treasuryClaims';

const distDir = path.join(process.cwd(), 'dist');
const appUrl = (process.env.APP_URL || process.env.VITE_PROD_URL || '').replace(/\/+$/, '');

for (const slug of ['privacy', 'terms'] as const) {
  const doc = buildLegalDocument(slug, {
    entity: US_CONFIG.regulations.legalEntityName,
    retentionYears: Math.max(1, Math.round((US_CONFIG.regulations.dataRetentionDays || 2555) / 365)),
    treasuryEnabled: TREASURY_PROGRAM_ENABLED,
  });
  const lastUpdated = new Date(`${doc.version}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const html = renderLegalHtml(doc, { siteName: 'MutualPool', appUrl, lastUpdated });
  const outDir = path.join(distDir, slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`prerendered /${slug} -> ${path.relative(process.cwd(), path.join(outDir, 'index.html'))}`);
}
