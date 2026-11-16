// Renders the explainer to an MP4, frame by frame, in headless Chromium.
//
//   npm run dev            (in another terminal; or pass --url)
//   npm run render -- --out out/video.mp4 [--fps 30] [--width 1920] [--height 1080] [--workers 4]
//
// The timeline is split across workers; each pipes JPEG frames into its own ffmpeg, the
// chunks are joined without re-encoding, and the narration clips are mixed in at their
// exact start times. Needs `playwright` and `ffmpeg` to be installed.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const fps = +arg('fps', 30), width = +arg('width', 1920), height = +arg('height', 1080);
const url = arg('url', 'http://localhost:5173/');
const out = path.resolve(arg('out', path.join(root, 'out/video.mp4')));
const workers = +arg('workers', Math.max(1, Math.min(8, os.cpus().length)));
const tmp = path.resolve(arg('tmp', path.join(path.dirname(out), '.render')));
const WARMUP = 45; // frames rendered (not saved) before a chunk so fades are mid-flight correctly

async function open() {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => { console.error('page error:', e); process.exit(1); });
  await page.goto(`${url}?capture=1&mute=1`);
  await page.waitForFunction(() => window.player);
  return { browser, page };
}

if (arg('chunk')) {
  // ---- worker: render frames [from, to) into one chunk file ---------------------------
  const from = +arg('from'), to = +arg('to');
  const { browser, page } = await open();
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', arg('crf', '18'), '-pix_fmt', 'yuv420p', '-r', String(fps), arg('chunk')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())));
  for (let f = Math.max(0, from - WARMUP); f < to; f++) {
    await page.evaluate(([t, dt]) => window.player.frame(t, dt), [f / fps, 1 / fps]);
    if (f < from) continue;
    const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - from) % 150 === 0) console.log(`chunk ${from}: ${f - from}/${to - from}`);
  }
  ff.stdin.end(); await done; await browser.close();
} else {
  // ---- master ---------------------------------------------------------------------------
  fs.mkdirSync(tmp, { recursive: true });
  const { browser, page } = await open();
  const { duration, clips } = await page.evaluate(() => ({ duration: window.player.duration, clips: window.player.segs.map((s) => [s.id, s.start]) }));
  await browser.close();
  const limit = +arg('seconds', duration), total = Math.ceil(Math.min(limit, duration) * fps);
  console.log(`${total} frames at ${width}x${height}@${fps}, ${workers} workers`);
  // 30-second chunks, rendered by a pool of workers; finished chunks are kept, so an
  // interrupted render resumes where it stopped.
  const t0 = Date.now(), per = 30 * fps, chunks = [], queue = [];
  for (let from = 0, i = 0; from < total; from += per, i++) {
    const file = path.join(tmp, `chunk${String(i).padStart(3, '0')}.mp4`); chunks.push(file);
    if (!fs.existsSync(file)) queue.push({ from, to: Math.min(total, from + per), file });
  }
  let finished = chunks.length - queue.length;
  const runOne = ({ from, to, file }) => new Promise((res, rej) => {
    const part = file.replace(/\.mp4$/, '.part.mp4');
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), '--chunk', part, '--from', from, '--to', to], { stdio: ['ignore', 'ignore', 'inherit'] });
    child.on('close', (c) => { if (c) return rej(new Error(`chunk at frame ${from} failed`)); fs.renameSync(part, file); console.log(`chunk ${++finished}/${chunks.length} done, ${((Date.now() - t0) / 60000).toFixed(1)} min`); res(); });
  });
  await Promise.all(Array.from({ length: workers }, async () => { while (queue.length) await runOne(queue.shift()); }));
  console.log(`frames done in ${((Date.now() - t0) / 60000).toFixed(1)} min; mixing audio`);
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, chunks.filter(Boolean).map((c) => `file '${c}'`).join('\n'));
  const used = clips.filter(([id, start]) => start < total / fps && fs.existsSync(path.join(root, 'public/audio', `${id}.mp3`)));
  const inputs = used.flatMap(([id]) => ['-i', path.join(root, 'public/audio', `${id}.mp3`)]);
  const filter = used.map(([, start], i) => `[${i + 1}:a]adelay=${Math.round(start * 1000)}:all=1[a${i}]`).join(';')
    + `;${used.map((_, i) => `[a${i}]`).join('')}amix=inputs=${used.length}:normalize=0:dropout_transition=0,apad[a]`;
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, ...inputs, '-filter_complex', filter,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
}
