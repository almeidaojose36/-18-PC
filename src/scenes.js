// Shot list: one entry per narration line. Numeric keys are *cumulative* (each line
// inherits the previous line's state and tweens to its own); `hl`, `labels`, `callout`
// and `spin` apply to that line only.
//
// Camera: orbit around (tx,ty,tz) at distance d, azimuth az (0 = front, 180 = rear),
// elevation el, vertical field of view fov. All lengths in mm, angles in degrees.
// tr = tween duration in seconds, or 'full' to tween across the whole line.

export const BASE = {
  tx: 0, ty: 14, tz: 0, d: 330, az: 10, el: 20, fov: 30,
  flip: 0,     // 0 = standing on its feet (badge up), 1 = service side up
  hover: 0,    // extra lift off the floor
  rotY: -20,   // unit yaw
  screws: 0, cover: 0, sink: 0,   // explode: screws out, cover off, heatsink off
  ghost: 0,    // x-ray chassis
  card: 0, router: 0, pulse: 0,   // props
  die: 0, cores: 0, media: 0,     // silicon floorplan glow / CPU load / media engine
  packets: 0, codec: 0,           // stream packets; codec 0 = AV1 -> cores, 1 = H.264 -> media engine
  mem: 0, memOS: 0, memApp: 0,    // RAM grid (MB)
  video: 0, stutter: 0,           // playback HUD
};

export const SHOTS = {
  // ---- Cold open -------------------------------------------------------------------
  o1: { d: 300, az: 35, el: 18, hover: 22, rotY: 40, tr: 'full', callout: ['$18', 'Dell Wyse 3040 · used, 2026'] },
  o2: { flip: 1, ghost: 1, hover: 40, el: 38, az: 20, d: 280, tr: 2.2, hl: ['soc', 'ram', 'emmc'], callout: ['4 cores · 2 GB · 16 GB', 'Atom x5-Z8350 · DDR3L · eMMC flash'] },
  o3: { flip: 0, ghost: 0, hover: 0, rotY: 0, az: -28, el: 14, d: 340, video: 1, stutter: 1, cores: 1, tr: 2.2 },
  o4: { video: 0, stutter: 0, cores: 0, az: 25, d: 300, callout: ['$400+', 'list price, new, in enterprise catalogs'] },
  o5: { d: 200, az: 42, el: 10, tr: 'full' },
  o6: { flip: 1, screws: 1, cover: 1, sink: 1, hover: 30, el: 46, az: 22, d: 230, die: 1, cores: 0.7, tr: 3.5 },

  // ---- Chapter 1 — The palm-sized box ------------------------------------------------
  a1: { flip: 0, screws: 0, cover: 0, sink: 0, die: 0, cores: 0, hover: 0, card: 1, az: 30, el: 24, d: 410, tr: 3, spin: 360, callout: ['101.6 × 101.6 × 27.94 mm', '240 g — lighter than a smartphone'] },
  a2: { az: -25, el: 16, d: 300, card: 0, callout: ['Dell Wyse 3040', 'a thin client — never built to be a desktop'] },
  a3: { az: 0, el: 4, fov: 14, d: 440, tr: 2, labels: [['usb3', 'USB 3.0'], ['usb2_front', 'USB 2.0', 1], ['audio', 'Headset'], ['power', 'Power', 1]] },
  a4: { az: 180, tr: 2.4, labels: [['dp1', 'DisplayPort'], ['dp2', 'DisplayPort', 1], ['usb2_rear', '2× USB 2.0', 1], ['rj45', 'Gigabit Ethernet'], ['dc', 'DC in', 1]] },
  a5: { az: 115, el: 28, fov: 30, d: 320, tr: 2.4, callout: ['No vents. No fan.', 'completely passive'] },
  a6: { az: 40, el: 18, callout: ['< 5 W', 'a desktop PC pulls 60 – 200 W'] },
  a7: { flip: 1, el: 48, az: 20, d: 300, tr: 2.6 },

  // ---- Chapter 2 — Inside the shell ---------------------------------------------------
  b1: { screws: 1, cover: 1, az: 30, el: 36, d: 290, tr: 4 },
  b2: { d: 200, el: 30, az: 40, hl: ['heatsink'], labels: [['heatsink', 'Passive aluminium heatsink']] },
  b3: { sink: 1, el: 44, d: 210, tr: 2.4 },
  b4: { tx: 19, tz: -2, d: 95, el: 50, az: 25, hl: ['ram'], labels: [['ram', '2 GB DDR3L-1600 · soldered']] },
  b5: { tx: -32, tz: 22, az: -20, hl: ['emmc'], labels: [['emmc', '16 GB eMMC flash']] },
  b6: { d: 120, hl: ['emmc'], callout: ['16 GB → 14.7 GB', 'decimal gigabytes vs. binary gibibytes'] },
  b7: { tx: 34, tz: 27, az: 35, el: 48, d: 130, hl: ['m2'] },
  b8: { d: 85, el: 58, tz: 20, hl: ['m2'], labels: [['m2', 'M.2 2230 · E-key · Wi-Fi / Bluetooth only']] },
  b9: { tx: 0, tz: 0, d: 290, el: 40, az: 20, callout: ['Thin client', 'one job: be a window onto a server'] },
  b10: { az: 150, el: 34, d: 280, packets: 1, codec: 1, hl: ['rj45'], labels: [['rj45', 'keyboard + mouse out · desktop video in']] },
  b11: { packets: 0, az: 25, el: 46, d: 240, hl: ['soc', 'ram', 'emmc'], labels: [['soc', 'CPU'], ['ram', 'RAM'], ['emmc', 'Storage']] },

  // ---- Chapter 3 — Inside the two-watt silicon ------------------------------------------
  c1: { tx: 0, ty: 15, tz: -2, d: 75, el: 52, az: 20, tr: 3, labels: [['soc', 'Intel Atom x5-Z8350 · 14 nm']] },
  c2: { d: 21, el: 62, az: 12, die: 1, tr: 2.4, labels: [['cores', '4 cores · 1.44 GHz'], ['l2', '2 MB L2 cache', 1]] },
  c3: { az: -10, callout: ['1.44 GHz', 'a modern laptop chip: ~5 GHz, 10× the cache'] },
  c4: { d: 27, el: 55, az: 5, callout: ['2 W', 'scenario design power'] },
  c5: { sink: 0, die: 0, d: 230, el: 32, az: 35, tr: 2.6, callout: ['4 W idle · 5 W load', 'under 80 °C with no moving parts'] },
  c6: { az: 50, d: 200, hl: ['heatsink'] },
  c7: { sink: 1, d: 60, el: 55, az: 15, die: 1, cores: 0.5, tr: 2.6 },

  // ---- Chapter 4 — The YouTube codec trap ------------------------------------------------
  d1: { video: 1, stutter: 1, cores: 0.85, d: 150, el: 45, az: -25, tr: 3, callout: ['480p', '…and it still drops frames'] },
  d2: { d: 42, el: 58, az: -8, cores: 1, labels: [['cores', 'CPU cores · 100 %']] },
  d3: { tx: 4, tz: -18, d: 170, el: 50, az: -35, packets: 1, codec: 0, tr: 2.2, labels: [['rj45', 'VP9 / AV1 stream in']] },
  d4: { tx: 1.5, tz: -2.5, d: 26, el: 62, az: 8, tr: 2.4, hl: ['media'], labels: [['gpu', 'Intel HD Graphics 400'], ['media', 'H.264 hardware decoder', 1]] },
  d5: { hl: ['media'], labels: [['media', 'no AV1 · no full VP9', 1]] },
  d6: { d: 30, labels: [['media', 'media engine: idle', 1]] },
  d7: { tx: 0, d: 34, az: -8, cores: 1, hl: ['cores'], labels: [['cores', 'software decode · 100 % load']] },
  d8: { tx: 4, tz: -16, d: 150, el: 48, az: -30, codec: 1, cores: 0.6, tr: 2.4, callout: ['h264ify', 'ask for H.264 + working GPU drivers'] },
  d9: { tx: 0.5, tz: -2.5, d: 34, el: 60, az: 6, media: 1, cores: 0.12, stutter: 0, tr: 2.4, hl: ['media'], labels: [['media', 'hardware decode · active', 1]], callout: ['1080p', 'smooth'] },

  // ---- Chapter 5 — Why 2 GB strangles modern apps -----------------------------------------
  e1: { video: 0, packets: 0, die: 0, cores: 0, media: 0, mem: 1, tx: 0, ty: 34, tz: -12, d: 270, az: 18, el: 16, tr: 3, hl: ['ram'], callout: ['2 GB', 'of RAM — soldered, forever'] },
  e2: { memOS: 1150, memApp: 1350, tr: 'full' },
  e3: { az: -12, hl: ['emmc'], labels: [['emmc', 'overflow → swap on slow eMMC']] },
  e4: { memOS: 180, memApp: 0, az: 10, tr: 2.6, callout: ['< 200 MB', 'bare-bones Linux, no desktop'] },
  e5: { az: 25, d: 300, tr: 'full' },

  // ---- Chapter 6 — What this box actually beats ----------------------------------------------
  f1: { mem: 0, memOS: 0, sink: 0, cover: 0, screws: 0, ty: 14, tz: 0, d: 300, el: 34, az: 30, tr: 3.2 },
  f2: { flip: 0, el: 20, az: -20, tr: 2.4, callout: ['Daily desktop?', 'completely outgunned'] },
  f3: { router: 1, pulse: 1, tx: -75, ty: 10, tz: -45, d: 520, az: 150, el: 24, tr: 3 },
  f4: { az: 138, d: 480, callout: ['< 5 W · silent · x86-64', 'Pi-hole · Home Assistant · Proxmox node — 24 / 7'] },
  f5: { tx: -40, ty: 14, tz: -10, d: 330, az: 30, el: 16, tr: 'full', callout: ['It was never broken.', 'just a two-watt thin client asked to do a desktop’s job'] },
};
