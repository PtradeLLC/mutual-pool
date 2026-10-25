/**
 * Build the MutualPool ad video with Runway + ffmpeg.
 *
 *   npm run video:ad                 full build -> public/videos/mutualpool-ad.{mp4,jpg,vtt,chapters.json}
 *   npm run video:ad -- --smoke      cheap end-to-end check of every primitive (a few credits)
 *   npm run video:ad -- --only s03   regenerate selected scenes (comma separated), then re-assemble
 *   npm run video:ad -- --assemble   skip generation, just re-stitch what is cached
 *   npm run video:ad -- --voice Noah pick another narrator preset (default Kendrick)
 *
 * Needs RUNWAY_API_KEY in .env. Everything generated is cached in assets/ad/.cache so a re-run
 * only pays for what is missing. Delete a scene's folder there to force it to regenerate.
 *
 * Pipeline per scene
 *   narration : Runway text-to-speech (eleven_v3) with one fixed voice so every scene matches
 *   avatar    : Runway avatar video lip-synced to that narration (custom avatar from the hero photo)
 *   i2v/t2v   : Runway b-roll clip (gen4.5 from the hero photo, or seedance2_fast with photo references)
 *   assemble  : ffmpeg normalises every clip to 1280x720/30fps, muxes narration, adds the end card
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import RunwayML from '@runwayml/sdk';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { SCENES, CHAPTERS, AVATAR_PERSONALITY, type Scene } from './ad-storyboard';

// ---------- config ----------
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ASSETS = path.join(ROOT, 'assets', 'ad');
const CACHE = path.join(ASSETS, '.cache');
const OUT_DIR = path.join(ROOT, 'public', 'videos');
const OUT_BASE = 'mutualpool-ad';
const REF_IMAGES = { main: path.join(ASSETS, 'character-main.jpg'), crew: path.join(ASSETS, 'character-crew.png') };
const LOGO = path.join(ROOT, 'public', 'logo.png');

const W = 1280, H = 720, FPS = 30;
const BG = '#0f172a';
const SCENE_PAD_SEC = 0.45;      // breathing room after each narration
const END_CARD_SEC = 3.5;
const BROLL_MIN = 5, BROLL_MAX = 10;   // seconds; seedance/hailuo need >=5, gen4.5 caps at 10
const TASK_TIMEOUT_MS = 20 * 60 * 1000;
const CONCURRENCY = 5;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const SMOKE = flag('smoke');
const ASSEMBLE_ONLY = flag('assemble');
const ONLY = (opt('only') || '').split(',').map(s => s.trim()).filter(Boolean);
const VOICE = (opt('voice') || process.env.AD_VOICE_PRESET || 'Kendrick') as any;

const ffmpeg = ffmpegStatic as string;
const ffprobe = ffprobeStatic.path;
if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new Error('ffmpeg-static binary missing; run npm install');
if (!process.env.RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY is not set in .env');

const client = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY, timeout: 120_000, maxRetries: 3 });

// ---------- small helpers ----------
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ensureDir = (p: string) => fs.mkdirSync(p, { recursive: true });
const exists = (p: string) => fs.existsSync(p) && fs.statSync(p).size > 0;
const readJson = <T,>(p: string, fallback: T): T => (exists(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const writeJson = (p: string, v: unknown) => fs.writeFileSync(p, JSON.stringify(v, null, 2));

function dataUri(file: string): string {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

async function download(url: string, file: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

function run(bin: string, argv: string[]): string {
  return execFileSync(bin, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

interface Probe { duration: number; width?: number; height?: number; hasAudio: boolean; hasVideo: boolean }
function probe(file: string): Probe {
  const j = JSON.parse(run(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]));
  const v = (j.streams || []).find((s: any) => s.codec_type === 'video');
  const a = (j.streams || []).find((s: any) => s.codec_type === 'audio');
  return {
    duration: Number(j.format?.duration || v?.duration || a?.duration || 0),
    width: v?.width, height: v?.height,
    hasAudio: Boolean(a), hasVideo: Boolean(v),
  };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

async function waitTask(p: Promise<unknown> & { waitForTaskOutput: (o?: any) => Promise<any> }, label: string): Promise<string> {
  p.catch(() => { /* surfaced through waitForTaskOutput below */ });
  const done = await p.waitForTaskOutput({ timeout: TASK_TIMEOUT_MS });
  const url = done.output?.[0];
  if (!url) throw new Error(`${label}: task ${done.id} finished without output`);
  log(`${label}: done (${done.cost?.credits ?? '?'} credits)`);
  return url;
}

// ---------- Runway primitives ----------
async function narrate(text: string, file: string): Promise<string> {
  if (exists(file)) return file;
  log(`tts: ${text.slice(0, 48)}…`);
  const task = client.textToSpeech.create({
    model: 'eleven_v3',
    promptText: text,
    voice: { type: 'runway-preset', presetId: VOICE },
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.3,
    speed: 1.0,
    useSpeakerBoost: true,
  });
  const url = await waitTask(task, 'tts');
  fs.writeFileSync(`${file}.url`, url);
  return download(url, file);
}
const narrationUrl = (file: string) => (exists(`${file}.url`) ? fs.readFileSync(`${file}.url`, 'utf8').trim() : undefined);

async function getAvatarId(manifest: Manifest): Promise<string> {
  if (manifest.avatarId) {
    try {
      const a = await client.avatars.retrieve(manifest.avatarId);
      if (a.status === 'READY') return a.id;
    } catch { /* recreate below */ }
  }
  // Runway rejects the full-body photo; a square head-and-shoulders crop works.
  const portrait = path.join(CACHE, 'avatar-portrait.jpg');
  if (!exists(portrait)) run(ffmpeg, ['-y', '-v', 'error', '-i', REF_IMAGES.main, '-vf', 'crop=896:896:0:40', portrait]);
  log('avatar: creating from head-and-shoulders crop of character-main.jpg');
  const created = await client.avatars.create({
    name: 'MutualPool Host',
    personality: AVATAR_PERSONALITY,
    referenceImage: dataUri(portrait),
    imageProcessing: 'optimize',
    voice: { type: 'runway-live-preset', presetId: 'marcus' },
  });
  let a: any = created;
  while (a.status === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 5000));
    a = await client.avatars.retrieve(created.id);
  }
  if (a.status !== 'READY') throw new Error(`avatar failed: ${a.failureReason || a.status}`);
  manifest.avatarId = a.id;
  saveManifest(manifest);
  log(`avatar: ready ${a.id}`);
  return a.id;
}

/** Runway needs the narration at a URI it can read. Try an ephemeral upload, else fall back to the TTS output URL. */
async function uploadAudio(file: string, fallbackUrl?: string): Promise<string> {
  try {
    const up = await client.uploads.createEphemeral({ file: fs.createReadStream(file) as any });
    return up.uri;
  } catch (e: any) {
    if (!fallbackUrl) throw e;
    log(`upload failed (${e?.status || e?.message}); using TTS output URL instead`);
    return fallbackUrl;
  }
}

async function avatarClip(avatarId: string, audioFile: string, outFile: string): Promise<string> {
  if (exists(outFile)) return outFile;
  const audio = await uploadAudio(audioFile, narrationUrl(audioFile));
  log(`avatar clip: ${path.basename(outFile)}`);
  const task = client.avatarVideos.create({
    model: 'gwm1_avatars',
    avatar: { type: 'custom', avatarId },
    speech: { type: 'audio', audio },
  });
  const url = await waitTask(task, `avatar ${path.basename(outFile)}`);
  return download(url, outFile);
}

async function brollPart(scene: Scene, duration: number, outFile: string, seed: number): Promise<string> {
  if (exists(outFile)) return outFile;
  log(`b-roll ${scene.id} part (${scene.type}, ${duration}s)`);
  let url: string;
  if (scene.type === 'i2v') {
    url = await waitTask(client.imageToVideo.create({
      model: 'gen4.5',
      promptImage: dataUri(REF_IMAGES.main),
      promptText: scene.prompt!,
      ratio: '1280:720',
      duration,
      seed,
    }), `i2v ${scene.id}`);
  } else {
    // Hailuo 3 is the model that accepts photos of real people as character references
    // (Seedance refuses them). If it fails, fall back to Gen-4.5 text-to-video without references.
    const refs = (scene.references || ['main']).map(k => ({ uri: dataUri(REF_IMAGES[k]) }));
    try {
      url = await waitTask(client.textToVideo.create({
        model: 'hailuo3',
        promptText: scene.prompt!,
        ratio: '16:9',
        resolution: '768p',
        duration,
        references: refs,
      }), `t2v ${scene.id}`);
    } catch (e: any) {
      log(`t2v ${scene.id}: hailuo3 failed (${e?.message?.slice(0, 80)}); falling back to gen4.5 without references`);
      url = await waitTask(client.textToVideo.create({
        model: 'gen4.5',
        promptText: scene.prompt!,
        ratio: '1280:720',
        duration,
        seed,
      }), `t2v-fallback ${scene.id}`);
    }
  }
  return download(url, outFile);
}

/** Enough clips to cover the narration (each between BROLL_MIN and BROLL_MAX seconds). */
async function brollClips(scene: Scene, seconds: number, dir: string): Promise<string[]> {
  const parts = Math.max(1, Math.ceil(seconds / BROLL_MAX));
  const each = Math.max(BROLL_MIN, Math.min(BROLL_MAX, Math.ceil(seconds / parts)));
  const files = Array.from({ length: parts }, (_, i) => path.join(dir, `clip-${i + 1}.mp4`));
  await Promise.all(files.map((f, i) => brollPart(scene, each, f, 1000 + i)));
  return files;
}

// ---------- ffmpeg assembly ----------
/** Scale to fill a blurred 16:9 canvas, overlay the clip fitted inside, normalise fps/pixel format. */
const FIT = `split=2[bg][fg];[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:4[bgb];` +
  `[fg]scale=${W}:${H}:force_original_aspect_ratio=decrease[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2,fps=${FPS},format=yuv420p,setsar=1`;
const VENC = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const AENC = ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2'];

/** Avatar clip already carries the narration: fit it and pad a little silence at the end. */
function segmentFromAvatar(clip: string, out: string): number {
  const p = probe(clip);
  const total = p.duration + SCENE_PAD_SEC;
  run(ffmpeg, ['-y', '-i', clip,
    '-filter_complex', `[0:v]${FIT},tpad=stop_mode=clone:stop_duration=${SCENE_PAD_SEC}[v];[0:a]aresample=48000,apad=pad_dur=${SCENE_PAD_SEC}[a]`,
    '-map', '[v]', '-map', '[a]', '-t', total.toFixed(3), ...VENC, ...AENC, out]);
  return total;
}

/** B-roll clips + separate narration: clips play back to back, last frame holds if the voice runs longer. */
function segmentFromBroll(clips: string[], audio: string, out: string): number {
  const a = probe(audio);
  const total = a.duration + SCENE_PAD_SEC;
  const inputs = clips.flatMap(c => ['-i', c]);
  const fitted = clips.map((_, i) => `[${i}:v]${FIT}[v${i}]`).join(';');
  const chain = clips.map((_, i) => `[v${i}]`).join('');
  run(ffmpeg, ['-y', ...inputs, '-i', audio,
    '-filter_complex', `${fitted};${chain}concat=n=${clips.length}:v=1:a=0,tpad=stop_mode=clone:stop_duration=${total.toFixed(3)}[v];[${clips.length}:a]aresample=48000,apad=pad_dur=${SCENE_PAD_SEC}[a]`,
    '-map', '[v]', '-map', '[a]', '-t', total.toFixed(3), ...VENC, ...AENC, out]);
  return total;
}

/** Logo on the brand background, silent. */
function segmentEndCard(out: string): number {
  run(ffmpeg, ['-y', '-loop', '1', '-framerate', String(FPS), '-i', LOGO,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-filter_complex', `[0:v]scale=-2:300,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG},fps=${FPS},format=yuv420p,setsar=1,fade=t=in:st=0:d=0.6[v]`,
    '-map', '[v]', '-map', '1:a', '-t', String(END_CARD_SEC), ...VENC, ...AENC, out]);
  return END_CARD_SEC;
}

function concat(segments: string[], out: string) {
  const list = path.join(CACHE, 'concat.txt');
  fs.writeFileSync(list, segments.map(s => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
  run(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
}

function poster(video: string, out: string) {
  run(ffmpeg, ['-y', '-ss', '1.0', '-i', video, '-frames:v', '1', '-q:v', '3', out]);
}

const vttTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60).toFixed(3).padStart(6, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec}`;
};

/** One cue per sentence, timed proportionally to character count inside the scene's narration window. */
function writeCaptions(timeline: Array<{ scene: Scene; start: number; speech: number }>, out: string) {
  const lines = ['WEBVTT', ''];
  for (const { scene, start, speech } of timeline) {
    const sentences = scene.narration.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [scene.narration];
    const chars = sentences.reduce((n, s) => n + s.length, 0);
    let t = start;
    for (const s of sentences) {
      const d = speech * (s.length / chars);
      lines.push(`${vttTime(t)} --> ${vttTime(t + d)}`, s, '');
      t += d;
    }
  }
  fs.writeFileSync(out, lines.join('\n'));
}

// ---------- manifest ----------
interface Manifest { avatarId?: string; voice?: string; scenes: Record<string, { narration?: string; clip?: string; clips?: string[]; segment?: string; speechSec?: number; segSec?: number }> }
const MANIFEST = path.join(CACHE, 'manifest.json');
const loadManifest = (): Manifest => readJson<Manifest>(MANIFEST, { scenes: {} });
const saveManifest = (m: Manifest) => writeJson(MANIFEST, m);

// ---------- modes ----------
async function smoke() {
  const dir = path.join(CACHE, 'smoke'); ensureDir(dir);
  const manifest = loadManifest();
  log('smoke: narration + avatar in parallel');
  const [audio, avatarId] = await Promise.all([
    narrate("I know how it is. You work all week, and somehow there's nothing left. MutualPool changes that.", path.join(dir, 'line.mp3')),
    getAvatarId(manifest),
  ]);
  log('smoke: narration', probe(audio));
  const scene: Scene = { id: 'smoke-t2v', type: 't2v', chapter: 1, narration: '', references: ['main', 'crew'],
    prompt: SCENES.find(s => s.id === 's03')!.prompt };
  const i2v: Scene = { ...SCENES.find(s => s.id === 's01')!, id: 'smoke-i2v' };
  const results = await Promise.allSettled([
    avatarClip(avatarId, audio, path.join(dir, 'avatar.mp4')),
    brollPart(scene, 5, path.join(dir, 't2v.mp4'), 1),
    brollPart(i2v, 5, path.join(dir, 'i2v.mp4'), 1),
  ]);
  for (const r of results) {
    if (r.status === 'fulfilled') log('smoke ok:', path.basename(r.value), probe(r.value));
    else log('smoke FAILED:', r.reason?.message || r.reason, r.reason?.taskDetails ? JSON.stringify(r.reason.taskDetails) : '');
  }
  const okClips = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<string>).value);
  if (okClips.length) {
    const segs: string[] = [];
    for (const c of okClips) {
      const seg = c.replace(/\.mp4$/, '.seg.mp4');
      if (c.endsWith('avatar.mp4')) segmentFromAvatar(c, seg); else segmentFromBroll([c], audio, seg);
      segs.push(seg);
    }
    const end = path.join(dir, 'end.seg.mp4'); segmentEndCard(end); segs.push(end);
    const out = path.join(dir, 'smoke.mp4'); concat(segs, out);
    log('smoke stitched ->', out, probe(out));
  }
}

async function build() {
  ensureDir(CACHE); ensureDir(OUT_DIR);
  const manifest = loadManifest();
  if (manifest.voice && manifest.voice !== VOICE) log(`note: cached narration used voice ${manifest.voice}; delete assets/ad/.cache to switch to ${VOICE}`);
  manifest.voice = manifest.voice || VOICE;

  const scenes = SCENES;
  const selected = ONLY.length ? scenes.filter(s => ONLY.includes(s.id)) : scenes;
  for (const s of selected) {
    if (ONLY.length) fs.rmSync(path.join(CACHE, s.id), { recursive: true, force: true });
    ensureDir(path.join(CACHE, s.id));
  }

  if (!ASSEMBLE_ONLY) {
    // 1. narration for every scene (cheap, parallel)
    await pool(selected, CONCURRENCY, async s => {
      const file = path.join(CACHE, s.id, 'narration.mp3');
      await narrate(s.narration, file);
      manifest.scenes[s.id] = { ...(manifest.scenes[s.id] || {}), narration: file, speechSec: probe(file).duration };
      saveManifest(manifest);
    });

    // 2. visuals
    const needAvatar = selected.some(s => s.type === 'avatar');
    const avatarId = needAvatar ? await getAvatarId(manifest) : '';
    const failures: string[] = [];
    await pool(selected, CONCURRENCY, async s => {
      const entry = manifest.scenes[s.id]!;
      try {
        if (s.type === 'avatar') {
          const clip = path.join(CACHE, s.id, 'clip.mp4');
          await avatarClip(avatarId, entry.narration!, clip);
          entry.clip = clip;
        } else {
          entry.clips = await brollClips(s, entry.speechSec! + SCENE_PAD_SEC, path.join(CACHE, s.id));
        }
        saveManifest(manifest);
      } catch (e: any) {
        failures.push(`${s.id}: ${e?.message || e}`);
        log(`FAILED ${s.id}:`, e?.message || e, e?.taskDetails ? JSON.stringify(e.taskDetails) : '');
      }
    });
    if (failures.length) {
      log(`\n${failures.length} scene(s) failed. Re-run to retry just those (cached scenes are skipped):\n  ${failures.join('\n  ')}`);
      process.exitCode = 1;
      return;
    }
  }

  // 3. normalise every scene into a segment, then stitch
  const timeline: Array<{ scene: Scene; start: number; speech: number }> = [];
  const segments: string[] = [];
  let t = 0;
  for (const s of scenes) {
    const entry = manifest.scenes[s.id];
    const ready = s.type === 'avatar' ? Boolean(entry?.clip && exists(entry.clip)) : Boolean(entry?.clips?.length && entry.clips.every(exists));
    if (!ready) throw new Error(`${s.id} has no clip yet; run without --assemble`);
    const seg = path.join(CACHE, s.id, 'segment.mp4');
    const segSec = s.type === 'avatar' ? segmentFromAvatar(entry!.clip!, seg) : segmentFromBroll(entry!.clips!, entry!.narration!, seg);
    entry.segment = seg; entry.segSec = segSec;
    timeline.push({ scene: s, start: t, speech: s.type === 'avatar' ? segSec - SCENE_PAD_SEC : entry.speechSec! });
    segments.push(seg);
    t += segSec;
  }
  const endSeg = path.join(CACHE, 'end-card.mp4');
  segmentEndCard(endSeg); segments.push(endSeg);
  saveManifest(manifest);

  const mp4 = path.join(OUT_DIR, `${OUT_BASE}.mp4`);
  concat(segments, mp4);
  poster(mp4, path.join(OUT_DIR, `${OUT_BASE}.jpg`));
  writeCaptions(timeline, path.join(OUT_DIR, `${OUT_BASE}.vtt`));

  const chapters = CHAPTERS.map(c => {
    const first = timeline.find(x => x.scene.chapter === c.id);
    return { ...c, start: Math.round((first?.start ?? 0) * 10) / 10 };
  });
  const total = Math.round((t + END_CARD_SEC) * 10) / 10;
  writeJson(path.join(OUT_DIR, `${OUT_BASE}.chapters.json`), { duration: total, chapters, generatedAt: new Date().toISOString() });

  const sizeMb = (fs.statSync(mp4).size / 1024 / 1024).toFixed(1);
  log(`\nDone -> public/videos/${OUT_BASE}.mp4  (${total}s, ${sizeMb} MB)`);
  for (const c of chapters) log(`  chapter ${c.id} "${c.title}" @ ${c.start}s`);
}

(SMOKE ? smoke() : build()).catch(e => {
  console.error(e?.message || e);
  if (e?.taskDetails) console.error(JSON.stringify(e.taskDetails, null, 2));
  process.exit(1);
});
