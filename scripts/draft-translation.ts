// Produce a machine-translated DRAFT language file from src/i18n/en.ts.
//
//   npx tsx scripts/draft-translation.ts vi "Vietnamese"
//   npx tsx scripts/draft-translation.ts zh-TW "Traditional Chinese"
//
// Writes src/i18n/<code>.draft.ts with every key present, then verifies that
// placeholders such as {amount} and ${deposit} survived. The draft must be
// reviewed by a native speaker (especially pod agreement, hardship, fee and
// payout text) before being renamed to <code>.ts and wired into
// src/i18n/types.ts, src/i18n/index.ts and LanguageContext.
//
// Needs GEMINI_API_KEY in .env.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { en } from '../src/i18n/en';

const [code, languageName] = process.argv.slice(2);
if (!code || !languageName) {
  console.error('Usage: npx tsx scripts/draft-translation.ts <language-code> "<Language name>"');
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in .env');
  process.exit(1);
}

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const entries = Object.entries(en) as Array<[string, string]>;
const BATCH = 60;
const PLACEHOLDER = /\{[a-zA-Z0-9_]+\}|\$\{[a-zA-Z0-9_]+\}/g;

const prompt = (batch: Array<[string, string]>) => `You are translating the user interface of MutualPool, a savings-circle (ROSCA) app for gig delivery workers, from English into ${languageName}.
Rules:
- Translate the VALUES only; return the same keys.
- Keep placeholders exactly as they are: {amount}, \${deposit}, etc. Keep emoji, line breaks (\\n) and bullet characters.
- Keep brand and product names in English: MutualPool, Stripe, DoorDash, Uber Eats, Lyft, Instacart, Grubhub, Spark, Amazon Flex, Fourthwall, Lainie.
- Do not translate savings-circle tradition names (Tanda, Susu, Chama, ...).
- Use a friendly, plain tone suited to couriers and drivers; financial and legal terms must stay precise.
Return ONLY a JSON object mapping each key to its translation.

${JSON.stringify(Object.fromEntries(batch), null, 2)}`;

async function translateBatch(batch: Array<[string, string]>): Promise<Record<string, string>> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await client.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [{ role: 'user', parts: [{ text: prompt(batch) }] }],
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const text = res.text || '';
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (err: any) {
      console.warn(`  batch attempt ${attempt} failed: ${err?.message || err}`);
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  return {};
}

async function main() {
  const out: Record<string, string> = {};
  const problems: string[] = [];
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    process.stdout.write(`Translating ${i + 1}-${Math.min(i + BATCH, entries.length)} of ${entries.length}...\n`);
    const translated = await translateBatch(batch);
    for (const [key, source] of batch) {
      const value = typeof translated[key] === 'string' && translated[key].trim() ? translated[key] : source;
      if (value === source && source.length > 3) problems.push(`untranslated: ${key}`);
      const want = (source.match(PLACEHOLDER) || []).sort().join(',');
      const got = (value.match(PLACEHOLDER) || []).sort().join(',');
      if (want !== got) problems.push(`placeholder mismatch: ${key} (expected ${want || 'none'}, got ${got || 'none'})`);
      out[key] = value;
    }
  }

  const varName = code.replace(/[^a-zA-Z0-9]/g, '_');
  const lines = [
    `// DRAFT machine translation (${languageName}). Review with a native speaker before use;`,
    '// pay particular attention to pod agreement, hardship, fee and payout wording.',
    "import { TranslationKey } from './en';",
    '',
    `export const ${varName}: Record<TranslationKey, string> = {`,
    ...entries.map(([key]) => `  ${JSON.stringify(key)}: ${JSON.stringify(out[key])},`),
    '};',
    '',
  ];
  const target = path.join(process.cwd(), 'src', 'i18n', `${code}.draft.ts`);
  fs.writeFileSync(target, lines.join('\n'), 'utf8');

  console.log(`\nWrote ${target} (${entries.length} keys).`);
  if (problems.length) {
    console.log(`${problems.length} item(s) need a look:`);
    problems.slice(0, 40).forEach(p => console.log('  - ' + p));
    if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
  }
}

main().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});
