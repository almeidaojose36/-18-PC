// Generates one MP3 per script line with ElevenLabs and writes public/audio/manifest.json
// (line id -> duration in seconds). Existing files are skipped; pass --force to redo all,
// or list ids (e.g. `npm run narration -- d8 d9`) to redo specific lines.
//
//   ELEVENLABS_API_KEY=...  npm run narration
//   ELEVENLABS_VOICE_ID=... to change the voice (default: "Inside the Machine Narrator")
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public/audio');
const chapters = JSON.parse(fs.readFileSync(path.join(root, 'src/script.json'), 'utf8'));
const lines = chapters.flatMap((c) => c.lines);

const VOICE = process.env.ELEVENLABS_VOICE_ID || 'mBuVX55i5Lt3LEkHr36R';
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const KEY = process.env.ELEVENLABS_API_KEY || 'proxy-injected';

// Spoken-form fixes for things a TTS voice would stumble on.
const SPOKEN = { d8: [['*h264ify*', 'H.264-ify']] };
const spoken = (l) => {
  let t = l.text;
  for (const [a, b] of SPOKEN[l.id] || []) t = t.replace(a, b);
  return t.replace(/\*/g, '').replace(/—/g, ', ').replace(/"/g, '');
};

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
const manifestPath = path.join(outDir, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
fs.mkdirSync(outDir, { recursive: true });

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const file = path.join(outDir, `${l.id}.mp3`);
  const wanted = only.length ? only.includes(l.id) : force || !fs.existsSync(file) || !manifest[l.id];
  if (!wanted) continue;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        text: spoken(l),
        model_id: MODEL,
        previous_text: i > 0 ? spoken(lines[i - 1]) : undefined,
        next_text: i < lines.length - 1 ? spoken(lines[i + 1]) : undefined,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok) throw new Error(`${l.id}: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  fs.writeFileSync(file, Buffer.from(json.audio_base64, 'base64'));
  const ends = json.alignment?.character_end_times_seconds || [];
  manifest[l.id] = +(ends[ends.length - 1] || 0).toFixed(3);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(l.id, manifest[l.id] + 's');
}
const total = lines.reduce((s, l) => s + (manifest[l.id] || 0), 0);
console.log(`done: ${Object.keys(manifest).length}/${lines.length} lines, ${total.toFixed(1)}s of speech`);
