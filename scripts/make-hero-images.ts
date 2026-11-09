/**
 * Generates the landing-page hero carousel photos with Runway (gen4_image).
 *
 *   npx tsx scripts/make-hero-images.ts              generate any missing scenes
 *   npx tsx scripts/make-hero-images.ts --only nurse regenerate one scene
 *
 * Writes src/assets/images/hero/<id>.jpg (1200px wide JPEG). Needs RUNWAY_API_KEY.
 * Every prompt asks for brand-free scenes: no logos, uniforms of real companies
 * or readable text, so the photos are safe to use in ads.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import RunwayML from '@runwayml/sdk';

const OUT_DIR = path.join(process.cwd(), 'src/assets/images/hero');
const STYLE = 'Photorealistic editorial lifestyle photograph, candid and authentic, natural light, shot on a 35mm lens with shallow depth of field, warm and optimistic mood, true-to-life skin tones. No text, no logos, no brand names, no readable writing anywhere, no watermarks.';

export const HERO_SCENES = [
  { id: 'family', prompt: 'A young Black couple and their daughter at a kitchen table in a cozy American home in the evening, the mother smiling as she looks at a smartphone while the father points at it, the girl doing homework beside them, warm lamp light, family budgeting together.' },
  { id: 'nurse', prompt: 'A Latina nurse in plain navy scrubs taking a break on a bench outside a modern hospital at golden hour, smiling at her phone, coffee cup beside her, relieved and happy expression.' },
  { id: 'shop-owner', prompt: 'A South Asian woman in her forties who owns a small neighborhood bakery, standing behind the counter in an apron, smiling proudly at the camera, shelves of fresh bread behind her, morning light through the front window.' },
  { id: 'friends', prompt: 'A diverse group of five adult friends of different ages sitting around a backyard patio table at sunset, laughing together, one of them holding a phone that the others lean in to see, string lights overhead, sense of community and trust.' },
  { id: 'delivery', prompt: 'A smiling young woman food delivery rider on a busy American city sidewalk at golden hour, wearing a plain dark green beanie, a plain navy vest over a plain green polo and a plain teal insulated delivery backpack, standing beside an e-bike with a plain teal basket, holding up her phone toward the camera with the screen turned slightly away, pedestrians and storefronts softly blurred behind her. All clothing, bags and bike completely plain and unbranded.' },
  { id: 'teacher', prompt: 'A white male teacher in his thirties with rolled-up sleeves in an empty classroom after school, sitting on the edge of a desk and smiling at his phone, chalkboard with simple drawings behind him, afternoon light.' },
] as const;

const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1] || '';
};

async function main() {
  if (!process.env.RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY is not set.');
  const client = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY, timeout: 120_000, maxRetries: 3 });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const only = flag('only');
  for (const scene of HERO_SCENES) {
    const out = path.join(OUT_DIR, `${scene.id}.jpg`);
    if (only ? scene.id !== only : fs.existsSync(out)) continue;
    console.log(`[hero] ${scene.id}: generating…`);
    const task = await client.textToImage.create({
      model: 'gen4_image',
      ratio: '1168:880',
      promptText: `${scene.prompt} ${STYLE}`,
    }).waitForTaskOutput({ timeout: 10 * 60_000 });
    const url = task.output?.[0];
    if (!url) throw new Error(`${scene.id}: no output`);
    const raw = path.join(OUT_DIR, `.${scene.id}.raw`);
    fs.writeFileSync(raw, Buffer.from(await (await fetch(url)).arrayBuffer()));
    // 1200px wide, JPEG quality ~80: small enough for the landing page.
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '--resampleWidth', '1200', raw, '--out', out], { stdio: 'ignore' });
    fs.unlinkSync(raw);
    console.log(`[hero] ${scene.id}: saved ${path.relative(process.cwd(), out)} (${Math.round(fs.statSync(out).size / 1024)} KB, ${(task as any).cost?.credits ?? '?'} credits)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
