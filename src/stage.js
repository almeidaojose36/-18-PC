// The 3D stage: studio, the Wyse 3040 assembly, props and effect layers, plus apply(),
// which poses everything from a numeric shot state (see scenes.js).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWyse3040, DIM } from './model.js';

const HH = DIM.H / 2;
const rad = THREE.MathUtils.degToRad;
const sstep = THREE.MathUtils.smoothstep;
const BG = 0x07080b;

function badgeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineWidth = 16; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  g.font = '700 78px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('DELL', 128, 134);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function nameTexture() {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = '600 44px Helvetica, Arial, sans-serif'; g.textBaseline = 'middle';
  g.fillText('Wyse 3040', 4, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// Port legends, drawn at 20 px per mm on a 100 x 5 mm strip; x is millimetres from the centre
// as the viewer sees that face.
function iconStrip(draw) {
  const c = document.createElement('canvas');
  c.width = 2000; c.height = 100;
  const g = c.getContext('2d');
  g.strokeStyle = g.fillStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
  g.font = '600 46px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const X = (mm) => 1000 + mm * 20;
  const usb = (mm, ss) => {            // USB trident, optionally prefixed with "SS"
    const x = X(mm) + (ss ? 26 : 0), y = 50;
    if (ss) g.fillText('SS', x - 78, y + 3);
    g.beginPath(); g.moveTo(x - 44, y); g.lineTo(x + 36, y); g.stroke();
    g.beginPath(); g.arc(x - 44, y, 9, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x + 50, y); g.lineTo(x + 30, y - 11); g.lineTo(x + 30, y + 11); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x - 6, y - 22); g.lineTo(x + 12, y - 22); g.stroke();
    g.beginPath(); g.arc(x + 14, y - 22, 7, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + 8, y + 22); g.lineTo(x + 20, y + 22); g.stroke();
    g.fillRect(x + 18, y + 15, 14, 14);
  };
  draw(g, X, usb);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const frontIconTexture = () => iconStrip((g, X, usb) => {
  const x = X(-37), y = 52;                               // headset
  g.beginPath(); g.arc(x, y, 20, Math.PI, 0); g.stroke();
  g.fillRect(x - 27, y - 2, 12, 24); g.fillRect(x + 15, y - 2, 12, 24);
  g.beginPath(); g.moveTo(x + 21, y + 22); g.quadraticCurveTo(x + 20, y + 38, x + 2, y + 38); g.stroke();
  usb(-10, false); usb(11.5, true);
});
const rearIconTexture = () => iconStrip((g, X, usb) => {
  let x = X(-43);                                         // DC in: solid line over dashed line
  g.beginPath(); g.moveTo(x - 34, 38); g.lineTo(x + 34, 38); g.stroke();
  g.setLineDash([14, 13]); g.beginPath(); g.moveTo(x - 34, 60); g.lineTo(x + 34, 60); g.stroke(); g.setLineDash([]);
  g.font = '500 40px Helvetica, Arial, sans-serif';      // DisplayPort 1 / 2 with bracket and logo
  g.fillText('1', X(-25.5), 22); g.fillText('2', X(-5.5), 22);
  g.lineWidth = 4; g.beginPath(); g.moveTo(X(-25.5), 48); g.lineTo(X(-25.5), 78); g.lineTo(X(-19.5), 78); g.moveTo(X(-11.5), 78); g.lineTo(X(-5.5), 78); g.lineTo(X(-5.5), 48); g.stroke();
  x = X(-15.5); g.font = '800 44px Helvetica, Arial, sans-serif'; g.fillText('D', x + 4, 79);
  g.fillRect(x - 24, 60, 9, 36); g.lineWidth = 5;
  usb(13.5, false);
  x = X(36);                                              // network
  g.strokeRect(x - 12, 14, 24, 20); g.strokeRect(x - 40, 62, 24, 20); g.strokeRect(x + 16, 62, 24, 20); g.strokeRect(x - 12, 62, 24, 20);
  g.beginPath(); g.moveTo(x, 34); g.lineTo(x, 62); g.moveTo(x - 28, 62); g.lineTo(x - 28, 48); g.lineTo(x + 28, 48); g.lineTo(x + 28, 62); g.stroke();
});

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !new URLSearchParams(location.search).get('noaa'), preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  // ?shadow=pcf|basic|off trades shadow softness for speed (used for software-rendered export)
  const shadowMode = new URLSearchParams(location.search).get('shadow') || 'soft';
  renderer.shadowMap.enabled = shadowMode !== 'off';
  renderer.shadowMap.type = { soft: THREE.PCFSoftShadowMap, pcf: THREE.PCFShadowMap, basic: THREE.BasicShadowMap }[shadowMode] ?? THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 700, 1900);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 5000);

  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(160, 320, 220);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 50, far: 900 });
  key.shadow.bias = -0.0005; key.shadow.radius = 6;
  const rim = new THREE.DirectionalLight(0x7fb0ff, 1.3);
  rim.position.set(-220, 160, -260);
  const fill = new THREE.DirectionalLight(0xffe2c4, 0.5);
  fill.position.set(-200, 80, 240);
  scene.add(key, rim, fill);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2400, 64),
    new THREE.MeshStandardMaterial({ color: 0x090a0e, roughness: 1, metalness: 0, envMapIntensity: 0.15 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- The unit ---------------------------------------------------------------------
  const model = buildWyse3040({ badgeTexture: badgeTexture(), nameTexture: nameTexture(), frontIcons: frontIconTexture(), rearIcons: rearIconTexture() });
  const { unit, parts, bounds, materials: M, board, BOARD_Y } = model;
  for (const m of [M.sticker, M.badge]) m.transparent = true;
  unit.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(unit);

  // ---- Silicon floorplan tiles on the die -------------------------------------------
  const owners = {};
  for (const n of Object.keys(parts)) owners[n] = parts[n];
  const tiles = {};
  const tileMat = (color) => new THREE.MeshStandardMaterial({ color: 0x0a0c10, emissive: color, emissiveIntensity: 0, roughness: 0.4, metalness: 0.3 });
  const tileGroup = new THREE.Group();
  parts.die.add(tileGroup);
  const tile = (name, x0, x1, z0, z1, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0), tileMat(color));
    m.position.set((x0 + x1) / 2, 1.53, (z0 + z1) / 2 - 2);
    tileGroup.add(m);
    (tiles[name] ||= []).push(m);
    const b = new THREE.Box3().setFromObject(m);
    bounds[name] = bounds[name] ? bounds[name].union(b) : b;
    owners[name] = parts.die;
  };
  // die spans x -4..4, z -3..3 (before the -2 offset of the SoC position)
  for (const [cx, cz] of [[-3.6, -2.6], [-1.95, -2.6], [-3.6, -1.1], [-1.95, -1.1]]) tile('cores', cx, cx + 1.5, cz, cz + 1.35, 0x3b82f6);
  tile('l2', -3.6, -2.0, 0.55, 1.5, 0xa78bfa); tile('l2', -1.9, -0.45, 0.55, 1.5, 0xa78bfa);
  tile('gpu', 0.2, 3.6, -2.6, -0.25, 0x14b8a6);
  tile('media', 0.2, 3.6, 0.0, 1.5, 0x22c55e);
  tile('io', -3.6, 3.6, 1.8, 2.6, 0x64748b);

  // ---- Highlight boxes ----------------------------------------------------------------
  const highlights = {};
  function highlight(name) {
    if (highlights[name]) return highlights[name];
    const b = bounds[name].clone().expandByScalar(name === 'cores' || name === 'media' ? 0.12 : 0.9);
    const size = b.getSize(new THREE.Vector3());
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const g = new THREE.Group();
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x5ee7ff, transparent: true, depthTest: false, toneMapped: false }));
    const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    edge.renderOrder = 10; glow.renderOrder = 9;
    g.add(glow, edge);
    b.getCenter(g.position);
    g.userData = { a: 0, edge, glow };
    owners[name].add(g);
    return (highlights[name] = g);
  }

  // ---- Stream packets (children of the unit so they follow it) --------------------------
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const pathCores = new THREE.CatmullRomCurve3([v(-36, 6, -38), v(-32, 13, -28), v(-10, 13, -12), v(-2, 6, -4), v(-2.2, 1.7, -3.2)]);
  const pathMedia = new THREE.CatmullRomCurve3([v(-36, 6, -38), v(-32, 13, -28), v(-8, 13, -11), v(2, 6, -1.6), v(1.9, 1.7, -1.25)]);
  const packetMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false });
  const packets = [];
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 2.4), packetMat);
    board.add(p); packets.push(p);
  }
  const cAV1 = new THREE.Color(0xff7a1a), cH264 = new THREE.Color(0x2ee6c8);
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();

  // ---- RAM grid: 16 x 8 cells, 16 MB each = 2048 MB --------------------------------------
  const COLS = 16, ROWS = 8, PITCH = 5.4;
  const memGroup = new THREE.Group();
  memGroup.position.set(0, 62, -34);
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(4.4, 4.4, 1.6), new THREE.MeshBasicMaterial({ toneMapped: false }), COLS * ROWS);
  const o3 = new THREE.Object3D();
  for (let i = 0; i < COLS * ROWS; i++) {
    o3.position.set((i % COLS - (COLS - 1) / 2) * PITCH, (Math.floor(i / COLS) - (ROWS - 1) / 2) * PITCH, 0);
    o3.updateMatrix(); cells.setMatrixAt(i, o3.matrix); cells.setColorAt(i, new THREE.Color(0x1a2030));
  }
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(COLS * PITCH + 3, ROWS * PITCH + 3, 2.4)),
    new THREE.LineBasicMaterial({ color: 0x4b5a78, toneMapped: false }),
  );
  memGroup.add(cells, frame);
  scene.add(memGroup);
  bounds.memgrid = new THREE.Box3(v(-45, 20, -1), v(45, 26, 1)); owners.memgrid = memGroup;
  const cFree = new THREE.Color(0x1a2030), cOS = new THREE.Color(0x3b82f6), cApp = new THREE.Color(0xf59e0b), cOver = new THREE.Color(0xff2d2d), cTmp = new THREE.Color();

  // ---- Props: credit card for scale, router + Ethernet run --------------------------------
  const card = new THREE.Group();
  const cardBody = new THREE.Mesh(new THREE.BoxGeometry(85.6, 0.76, 53.98), new THREE.MeshStandardMaterial({ color: 0x24427e, roughness: 0.35, metalness: 0.4 }));
  const chip = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 9.5), M.gold);
  chip.position.set(-24, 0.42, -4);
  card.add(cardBody, chip);
  card.position.set(-104, 0.4, 30); card.rotation.y = -0.25;
  cardBody.castShadow = cardBody.receiveShadow = true;
  scene.add(card);

  const router = new THREE.Group();
  const routerMat = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.5, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(150, 28, 95), routerMat);
  body.position.y = 14; body.castShadow = true; router.add(body);
  for (const ax of [-60, 60]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 95, 16), routerMat);
    a.position.set(ax, 70, -40); a.castShadow = true; router.add(a);
  }
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x3bff8f, toneMapped: false });
  for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 0.6), ledMat); l.position.set(-40 + i * 12, 14, 47.8); router.add(l); }
  router.position.set(-175, 0, -30);
  scene.add(router);
  // ---- Desk set from Dell's accessory list: two 24" monitors, wired keyboard + mouse, and the
  // bracket that mounts the unit behind a screen ----------------------------------------------
  const desk = new THREE.Group();
  const bezel = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.5, metalness: 0.2 });
  const standMat = new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.4, metalness: 0.7 });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x16345f, toneMapped: false });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xdfe6f1, toneMapped: false });
  const barMat = new THREE.MeshBasicMaterial({ color: 0x3c78d8, toneMapped: false });
  const MON = { x: 285, z: -262, y: 335 };
  for (const side of [-1, 1]) {
    const mon = new THREE.Group();
    const add = (geo, material, x, y, z) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); mon.add(m); return m; };
    add(new THREE.BoxGeometry(552, 332, 14), bezel, 0, MON.y, 0);
    add(new THREE.PlaneGeometry(531, 299), screenMat, 0, MON.y + 6, 7.1);
    add(new THREE.PlaneGeometry(300, 190), winMat, side * -70, MON.y + 22, 7.2);
    add(new THREE.PlaneGeometry(300, 16), barMat, side * -70, MON.y + 109, 7.3);
    add(new THREE.PlaneGeometry(531, 14), bezel, 0, MON.y - 137, 7.3);
    add(new THREE.BoxGeometry(46, 250, 18), standMat, 0, 140, -22);
    add(new THREE.BoxGeometry(250, 8, 190), standMat, 0, 4, -10);
    mon.position.set(side * MON.x, 0, MON.z); mon.rotation.y = -side * 0.14;
    desk.add(mon);
  }
  const kb = new THREE.Mesh(new THREE.BoxGeometry(440, 16, 130), bezel);
  kb.position.set(-30, 8, 190); desk.add(kb);
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(22, 5, 19), new THREE.MeshStandardMaterial({ color: 0x24272d, roughness: 0.6 }), 85);
  for (let r = 0, n = 0; r < 5; r++) for (let c2 = 0; c2 < 17; c2++, n++) { o3.position.set(-30 - 208 + c2 * 26, 18, 190 - 48 + r * 24); o3.scale.set(1, 1, 1); o3.updateMatrix(); keys.setMatrixAt(n, o3.matrix); }
  desk.add(keys);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), bezel);
  mouse.scale.set(31, 19, 55); mouse.position.set(290, 8, 195); desk.add(mouse);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(120, 120, 5), standMat);
  bracket.position.set(-MON.x, MON.y, MON.z - 12); bracket.rotation.y = 0.14; desk.add(bracket);
  desk.traverse((o) => { if (o.isMesh && o.material !== screenMat) o.castShadow = true; });
  scene.add(desk);
  const MOUNT = new THREE.Vector3(-MON.x - 4, MON.y, MON.z - 31);

  const cablePath = new THREE.CatmullRomCurve3([v(-36, 17, -50), v(-37, 6, -86), v(-60, 2.4, -118), v(-140, 4, -112), v(-158, 12, -78)]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cablePath, 80, 1.7, 10), new THREE.MeshStandardMaterial({ color: 0x2456c9, roughness: 0.5, transparent: true }));
  cable.castShadow = true;
  scene.add(cable);
  const pulses = [];
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, toneMapped: false });
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), pulseMat); scene.add(s); pulses.push(s); }

  // ---- Posing ---------------------------------------------------------------------------
  const target = new THREE.Vector3();
  function apply(S, t, shot, lineK, dt) {
    // unit pose
    const spin = shot.spin ? shot.spin * (lineK * lineK * (3 - 2 * lineK)) : 0;
    unit.rotation.set(-Math.PI / 2 * S.mount, rad(S.rotY + spin) + 0.14 * S.mount, Math.PI * (1 - S.flip));
    unit.position.y = HH + 0.8 * (1 - S.flip) + Math.sin(Math.PI * S.flip) * 48 + S.hover + (S.hover > 0.5 ? Math.sin(t * 0.9) * 1.5 : 0);
    // on the monitor bracket: stood on edge behind the left screen
    unit.position.set(MOUNT.x * S.mount, unit.position.y + (MOUNT.y - unit.position.y) * S.mount, MOUNT.z * S.mount);
    desk.visible = S.desk > 0.01; desk.scale.setScalar(Math.max(S.desk, 0.0001));
    scene.fog.near = Math.max(700, S.d * 1.6); scene.fog.far = Math.max(1900, S.d * 4);

    // teardown: base unclips -> board screws out -> board lifts out and flips heatsink-up
    // (the empty case fades away) -> heatsink lifts off and settles beside it
    const cov = sstep(S.cover, 0.3, 1);
    const fade = 1 - sstep(S.cover, 0.6, 1);
    parts.cover.position.y = cov * 75;
    parts.cover.visible = fade > 0.01;
    const bk = sstep(S.board, 0.3, 1), caseFade = 1 - sstep(S.board, 0.55, 0.95);
    parts.screws.position.y = sstep(S.screws, 0, 0.3) * 22;
    M.screw.opacity = 1 - sstep(S.board, 0.15, 0.4); parts.screws.visible = M.screw.opacity > 0.01;
    board.rotation.z = Math.PI * (1 - bk);
    board.position.y = BOARD_Y * (1 - bk) + Math.sin(Math.PI * bk) * 60;
    parts.shell.visible = parts.badge.visible = parts.power.visible = caseFade > 0.01;
    parts.heatsink.position.set(-140 * sstep(S.sink, 0.25, 1), 42 * sstep(S.sink, 0, 0.5) - 57.2 * sstep(S.sink, 0.5, 1), 0);
    const solid = (1 - 0.88 * S.ghost) * caseFade;
    M.plastic.transparent = solid < 0.99; M.plastic.opacity = solid; M.plastic.depthWrite = solid > 0.5;
    M.sticker.opacity = M.badge.opacity = M.print.opacity = M.printFront.opacity = M.printRear.opacity = M.lockRing.opacity = caseFade;
    M.coverPlastic.opacity = fade * solid; M.rubber.opacity = fade * solid;
    M.coverPlastic.depthWrite = M.coverPlastic.opacity > 0.5;

    // silicon
    tileGroup.visible = S.die > 0.01;
    const flick = 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7.3);
    for (const [name, list] of Object.entries(tiles)) for (const m of list) {
      const e = m.material;
      let k = S.die * 0.55;
      if (name === 'cores') { e.emissive.setHex(0x3b82f6).lerp(cOver, S.cores); k = S.die * (0.55 + S.cores * 1.3 * flick); }
      if (name === 'media') { k = S.die * (0.35 + S.media * 3.0 * (0.9 + 0.1 * Math.sin(t * 5))); }
      e.emissiveIntensity = k;
    }

    // packets
    cTmp.copy(cAV1).lerp(cH264, S.codec); packetMat.color.copy(cTmp);
    packets.forEach((p, i) => {
      const u = (t * 0.32 + i / packets.length) % 1;
      pathCores.getPoint(u, pa); pathMedia.getPoint(u, pb);
      p.position.copy(pa).lerp(pb, S.codec);
      const s = S.packets * Math.min(1, u * 8) * Math.min(1, (1 - u) * 5) * (1 - 0.78 * sstep(u, 0.5, 0.95));
      p.scale.setScalar(Math.max(s, 0.0001)); p.visible = s > 0.01;
    });

    // RAM grid
    memGroup.visible = S.mem > 0.01;
    memGroup.scale.setScalar(Math.max(S.mem, 0.0001));
    if (memGroup.visible) {
      const nOS = Math.round(S.memOS / 16), nApp = Math.round(S.memApp / 16);
      const over = nOS + nApp > COLS * ROWS;
      const blink = 0.5 + 0.5 * Math.sin(t * 9);
      for (let i = 0; i < COLS * ROWS; i++) {
        if (i < nOS) cTmp.copy(cOS); else if (i < nOS + nApp) { cTmp.copy(cApp); if (over) cTmp.lerp(cOver, 0.35 + 0.65 * blink); } else cTmp.copy(cFree);
        cells.setColorAt(i, cTmp);
      }
      cells.instanceColor.needsUpdate = true;
      frame.material.color.setHex(over ? 0xff4d4d : 0x4b5a78);
    }

    // props
    card.visible = S.card > 0.01; card.scale.setScalar(Math.max(S.card, 0.0001));
    router.visible = S.router > 0.01; router.scale.setScalar(Math.max(S.router, 0.0001));
    cable.visible = S.router > 0.02; cable.material.opacity = S.router;
    pulses.forEach((s, i) => {
      const u = (t * 0.22 + i / pulses.length) % 1;
      cablePath.getPoint(i % 2 ? 1 - u : u, s.position);
      const k = S.pulse * S.router * Math.min(1, u * 10) * Math.min(1, (1 - u) * 10);
      s.scale.setScalar(Math.max(k, 0.0001)); s.visible = k > 0.01;
    });

    // highlights
    const want = new Set(shot.hl || []);
    for (const n of want) highlight(n);
    for (const [n, g] of Object.entries(highlights)) {
      const goal = want.has(n) ? 1 : 0;
      g.userData.a += (goal - g.userData.a) * Math.min(1, dt * 6);
      const a = g.userData.a, pulse = 0.65 + 0.35 * Math.sin(t * 4);
      g.visible = a > 0.01;
      g.userData.edge.material.opacity = a * pulse;
      g.userData.glow.material.opacity = a * 0.16 * pulse;
    }

    // camera
    const az = rad(S.az + Math.sin(t * 0.23) * 1.6), el = rad(S.el + Math.sin(t * 0.31) * 0.6);
    target.set(S.tx, S.ty, S.tz);
    camera.position.set(target.x + S.d * Math.sin(az) * Math.cos(el), target.y + S.d * Math.sin(el), target.z + S.d * Math.cos(az) * Math.cos(el));
    camera.lookAt(target);
    if (camera.fov !== S.fov) { camera.fov = S.fov; camera.updateProjectionMatrix(); }
    camera.near = Math.max(0.5, S.d * 0.05); camera.far = 5000; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  // Screen-space position (CSS px) of a named anchor; returns false if behind the camera.
  const tmp = new THREE.Vector3();
  function project(name, out) {
    const b = bounds[name];
    if (!b) return false;
    b.getCenter(tmp);
    owners[name].localToWorld(tmp);
    tmp.project(camera);
    out.x = (tmp.x * 0.5 + 0.5) * canvas.clientWidth;
    out.y = (-tmp.y * 0.5 + 0.5) * canvas.clientHeight;
    return tmp.z < 1;
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { apply, project, resize, renderer, scene, camera };
}
