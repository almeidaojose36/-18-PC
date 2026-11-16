// Player: builds the timeline from the script + narration durations, drives the stage,
// the HTML overlays (captions, callouts, labels, playback HUD, title cards) and audio.
//
// URL params:  ?t=123   start at a time (seconds)      ?clean=1  hide controls
//              ?capture=1  frame-stepped mode used by scripts/render-video.mjs
//              ?cc=0    hide captions                  ?mute=1   no narration audio
import chapters from './script.json';
import { BASE, SHOTS } from './scenes.js';
import { createStage } from './stage.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const AUDIO = `${import.meta.env.BASE_URL}audio/`;
const GAP = 0.6;            // pause after each line
const LEAD = 3.4;           // chapter title card
const WPM = 150;            // fallback pacing when a line has no audio yet
const NUMERIC = Object.keys(BASE);

if (q.get('clean')) document.body.classList.add('clean');
if (q.get('cc') === '0') document.body.classList.add('nocap');

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (k) => k * k * k * (k * (k * 6 - 15) + 10);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const rich = (t) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');

// ---- Timeline ---------------------------------------------------------------------------
let manifest = {};
try { manifest = await (await fetch(`${AUDIO}manifest.json`)).json(); } catch { /* no narration yet */ }

const segs = [];
let cursor = 0, state = { ...BASE };
chapters.forEach((ch, ci) => ch.lines.forEach((line, li) => {
  const shot = SHOTS[line.id] || {};
  const lead = li === 0 ? (ci === 0 ? 1.0 : LEAD) : 0;
  const dur = manifest[line.id] || (line.text.split(/\s+/).length / WPM) * 60;
  const next = { ...state };
  for (const k of NUMERIC) if (k in shot) next[k] = shot[k];
  const seg = {
    id: line.id, html: rich(line.text), shot, chapter: ch, first: li === 0, hasAudio: !!manifest[line.id],
    t0: cursor, start: cursor + lead, end: cursor + lead + dur + GAP, from: state, to: next,
  };
  seg.tr = shot.tr === 'full' ? seg.end - seg.t0 : Math.max(shot.tr ?? 1.6, lead);
  segs.push(seg);
  cursor = seg.end; state = next;
}));
const DURATION = cursor + 2.5;

function segAt(t) {
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].t0 <= t) lo = m; else hi = m - 1; }
  return lo;
}
const S = { ...BASE };
function stateAt(t, seg) {
  const k = ease(clamp01((t - seg.t0) / seg.tr));
  for (const key of NUMERIC) S[key] = seg.from[key] + (seg.to[key] - seg.from[key]) * k;
  return S;
}

// ---- Stage + overlays -------------------------------------------------------------------------
const stage = createStage($('#gl'));
const el = {
  caption: $('#caption'), callout: $('#callout'), big: $('#callout .big'), small: $('#callout .small'),
  labels: $('#labels'), title: $('#title'), kicker: $('#title .kicker'), name: $('#title .name'),
  hud: $('#videohud'), hudCanvas: $('#videohud canvas'), bars: [...document.querySelectorAll('#videohud .bar i')],
  cpu: $('#vh-cpu'), drop: $('#vh-drop'), res: $('#vh-res'), media: $('#vh-media'),
  play: $('#play'), time: $('#time'), fill: $('#scrub .fill'), scrub: $('#scrub'), chap: $('#chapname'),
};
segs.filter((s) => s.first).forEach((s) => {
  const tick = document.createElement('div');
  tick.className = 'tick'; tick.style.left = `${(s.t0 / DURATION) * 100}%`;
  el.scrub.appendChild(tick);
});

let shownSeg = -1;
const labelPool = [];
function setLine(i) {
  shownSeg = i;
  const seg = segs[i], shot = seg.shot;
  el.caption.innerHTML = seg.html;
  if (shot.callout) {
    el.big.textContent = shot.callout[0]; el.small.textContent = shot.callout[1] || '';
    el.big.className = `big ${shot.callout[0].length > 16 ? 'sm' : shot.callout[0].length > 8 ? 'md' : ''}`;
  }
  const list = [...(shot.labels || [])];
  if (seg.to.mem > 0.5) list.push(['memgrid', '']);
  while (labelPool.length < list.length) {
    const d = document.createElement('div');
    d.className = 'label fade off'; d.innerHTML = '<span></span>';
    el.labels.appendChild(d); labelPool.push(d);
  }
  labelPool.forEach((d, n) => {
    const spec = list[n];
    d.dataset.anchor = spec ? spec[0] : '';
    if (spec) { d.firstChild.textContent = spec[1]; d.style.setProperty('--stem', `calc(var(--u) * ${6 + (spec[2] || 0) * 5.5})`); }
    else d.classList.add('off');
  });
  el.chap.textContent = seg.chapter.kicker === seg.chapter.title ? seg.chapter.title : `${seg.chapter.kicker} — ${seg.chapter.title}`;
}

// Mock video frame: a ball bouncing across colour bars. When stuttering, time is quantised
// into irregular hitches so it visibly drops frames.
const vg = el.hudCanvas.getContext('2d');
function drawVideo(t, stutter) {
  let vt = t;
  if (stutter > 0.5) { const step = 0.42; const n = Math.floor(t / step); vt = n * step - ((n * 7919) % 5 === 0 ? step : 0); }
  const w = 480, h = 270;
  const grad = vg.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#16233f'); grad.addColorStop(1, '#3a1d4a');
  vg.fillStyle = grad; vg.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) {
    const x = ((i * 70 - vt * 90) % 630 + 630) % 630 - 70;
    vg.fillStyle = `hsla(${200 + i * 16}, 70%, 60%, .35)`; vg.fillRect(x, 150 + Math.sin(i * 1.7) * 30, 44, 120);
  }
  const bx = 240 + Math.sin(vt * 1.7) * 190, by = 205 - Math.abs(Math.sin(vt * 3.1)) * 150;
  vg.fillStyle = '#ffd27a'; vg.beginPath(); vg.arc(bx, by, 22, 0, Math.PI * 2); vg.fill();
  if (stutter > 0.5 && Math.floor(t / 0.42) % 3 === 0) {
    vg.strokeStyle = 'rgba(255,255,255,.85)'; vg.lineWidth = 5; vg.beginPath();
    vg.arc(w / 2, h / 2, 22, t * 6, t * 6 + 4.4); vg.stroke();
  }
}

const p2 = { x: 0, y: 0 };
function render(t, dt) {
  const i = segAt(t), seg = segs[i];
  if (i !== shownSeg) setLine(i);
  const st = stateAt(t, seg);
  const lineK = clamp01((t - seg.t0) / (seg.end - seg.t0));
  stage.apply(st, t, seg.shot, lineK, dt);

  const speaking = t >= seg.start - 0.15 && t < seg.end - 0.1 && t < DURATION - 2.6;
  el.caption.classList.toggle('off', !speaking);
  el.callout.classList.toggle('off', !(seg.shot.callout && t >= seg.start + 0.25 && t < seg.end - 0.25));
  const titled = seg.first && seg.start - seg.t0 > 2 && t < seg.start - 0.5;
  el.title.classList.toggle('off', !titled);
  if (titled) { el.kicker.textContent = seg.chapter.kicker; el.name.textContent = seg.chapter.title; }

  // anchored labels
  const showLabels = t >= seg.start + 0.5 && t < seg.end - 0.2;
  for (const d of labelPool) {
    const name = d.dataset.anchor;
    if (!name) continue;
    const ok = stage.project(name, p2) && showLabels;
    d.classList.toggle('off', !ok);
    d.style.transform = `translate(${p2.x.toFixed(1)}px, ${p2.y.toFixed(1)}px) translateY(calc(-1 * var(--stem)))`;
    if (name === 'memgrid') {
      const used = Math.round(st.memOS + st.memApp);
      d.firstChild.textContent = used > 2048 ? `${used} MB needed · 2048 MB installed` : `${used} MB used · 2048 MB installed`;
      d.firstChild.style.borderColor = used > 2048 ? 'var(--warn)' : '';
    }
  }

  // playback HUD
  el.hud.classList.toggle('off', st.video < 0.5);
  if (st.video > 0.01) {
    drawVideo(t, st.stutter);
    let sum = 0;
    el.bars.forEach((b, n) => {
      const v = clamp01(st.cores * (0.93 + 0.07 * Math.sin(t * (3 + n) + n * 2)) + 0.04);
      sum += v; b.style.width = `${v * 100}%`;
      b.style.background = v > 0.8 ? 'var(--warn)' : v > 0.45 ? '#ffb020' : 'var(--ok)';
    });
    el.cpu.textContent = `${Math.round(sum * 25)} %`;
    el.res.textContent = st.stutter > 0.5 ? '480p' : '1080p';
    el.drop.textContent = st.stutter > 0.5 ? Math.floor((t - seg.t0) * 11 + i * 37) : 0;
    el.drop.style.color = st.stutter > 0.5 ? 'var(--warn)' : 'var(--ok)';
    el.media.textContent = st.media > 0.5 ? 'active' : 'idle';
    el.media.className = `pill ${st.media > 0.5 ? 'on' : ''}`;
  }

  el.fill.style.width = `${(t / DURATION) * 100}%`;
  el.time.textContent = `${fmt(t)} / ${fmt(DURATION)}`;
}

// ---- Clock + narration audio ----------------------------------------------------------------
let time = Math.min(Number(q.get('t')) || 0, DURATION), playing = false, last = performance.now();
const muted = !!q.get('mute');
const audio = new Map();
function clip(i) {
  const seg = segs[i];
  if (!seg || !seg.hasAudio || muted) return null;
  if (!audio.has(i)) { const a = new Audio(`${AUDIO}${seg.id}.mp3`); a.preload = 'auto'; audio.set(i, a); }
  return audio.get(i);
}
function syncAudio() {
  const i = segAt(time), seg = segs[i], local = time - seg.start;
  for (const [n, a] of audio) if (n !== i && !a.paused) a.pause();
  const a = clip(i);
  clip(i + 1); // preload next
  if (!a) return;
  if (!playing || local < 0 || (a.duration && local >= a.duration)) { if (!a.paused) a.pause(); return; }
  if (Math.abs(a.currentTime - local) > 0.3) a.currentTime = local;
  if (a.paused) a.play().catch(() => {});
}
function setPlaying(p) {
  if (p && time >= DURATION - 0.05) time = 0;
  playing = p; last = performance.now();
  el.play.textContent = p ? '❚❚' : '▶';
  if (p) $('#start').style.display = 'none';
  syncAudio();
}
function seek(t) { time = Math.min(Math.max(t, 0), DURATION); syncAudio(); }

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (playing) { time += dt; if (time >= DURATION) { time = DURATION; setPlaying(false); } }
  syncAudio();
  render(time, dt);
  requestAnimationFrame(frame);
}

function resize() { stage.resize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', resize);
resize();

el.play.onclick = () => setPlaying(!playing);
$('#start').onclick = () => setPlaying(true);
$('#cc').onclick = (e) => { const off = document.body.classList.toggle('nocap'); e.currentTarget.setAttribute('aria-pressed', String(!off)); };
$('#fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
const scrubTo = (e) => { const r = el.scrub.getBoundingClientRect(); seek(clamp01((e.clientX - r.left) / r.width) * DURATION); };
el.scrub.addEventListener('pointerdown', (e) => { el.scrub.setPointerCapture(e.pointerId); scrubTo(e); });
el.scrub.addEventListener('pointermove', (e) => { if (e.buttons) scrubTo(e); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
  const i = segAt(time);
  if (e.code === 'ArrowRight') seek(segs[Math.min(i + 1, segs.length - 1)].start);
  if (e.code === 'ArrowLeft') seek(segs[time - segs[i].start > 1.5 ? i : Math.max(i - 1, 0)].start);
});

// Hooks for automated capture: window.player.seek(t) then .renderAt(t) draws that exact frame.
// With ?capture=1 nothing runs on the wall clock: frame(t, dt) draws exactly that moment and
// steps CSS transitions by dt, so every exported frame is deterministic.
const capture = !!q.get('capture');
function captureFrame(t, dt) {
  time = t; render(t, dt);
  for (const a of document.getAnimations()) {
    a.pause(); a.currentTime = (Number(a.currentTime) || 0) + dt * 1000;
    if (a.currentTime >= a.effect.getComputedTiming().endTime) a.finish();
  }
}
window.player = { segs, duration: DURATION, seek, play: () => setPlaying(true), pause: () => setPlaying(false), frame: captureFrame };
if (capture) document.body.classList.add('clean'); else requestAnimationFrame(frame);
