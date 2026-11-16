// Procedural, millimetre-accurate Dell Wyse 3040 assembly (1 unit = 1 mm).
//
// The model is built in "service orientation": +Y points at the removable cover, the
// lid with the Dell badge is at -Y, front I/O is at Z = +50.8 and rear I/O at Z = -50.8.
// Every part is a named Group at the origin whose children carry absolute positions, so
// a part can be exploded by simply offsetting its group. Runs in Node (no DOM needed)
// so the same code feeds the OBJ exporter.
import * as THREE from 'three';

export const DIM = { W: 101.6, D: 101.6, H: 27.94, R: 5, WALL: 2, COVER: 1.5, PCB: 95, PCB_T: 1.6 };
const HH = DIM.H / 2;

function mat(name, props, physical = false) {
  const m = physical ? new THREE.MeshPhysicalMaterial(props) : new THREE.MeshStandardMaterial(props);
  m.name = name;
  return m;
}

export function makeMaterials() {
  return {
    plastic: mat('chassis_abs', { color: 0x141416, roughness: 0.65, metalness: 0.0 }),
    coverPlastic: mat('cover_abs', { color: 0x141416, roughness: 0.65, metalness: 0.0, transparent: true }),
    rubber: mat('rubber_feet', { color: 0x08080a, roughness: 0.95, transparent: true }),
    screw: mat('screw_steel', { color: 0x9a9ca3, roughness: 0.35, metalness: 0.9, transparent: true }),
    badge: mat('dell_badge', { color: 0xc9ccd2, roughness: 0.25, metalness: 0.95 }),
    pcb: mat('pcb_soldermask', { color: 0x0f4230, roughness: 0.45, metalness: 0.1 }),
    silk: mat('pcb_silkscreen', { color: 0xdfe8e2, roughness: 0.8 }),
    gold: mat('gold_contacts', { color: 0xd9a441, roughness: 0.3, metalness: 1.0 }),
    heatsink: mat('heatsink_anodized', { color: 0x1a1a1d, roughness: 0.35, metalness: 0.85 }),
    substrate: mat('soc_substrate', { color: 0x1f3a2c, roughness: 0.55, metalness: 0.1 }),
    die: mat('silicon_die', {
      color: 0x8e96a8, roughness: 0.12, metalness: 1.0, iridescence: 1.0, iridescenceIOR: 1.8,
      iridescenceThicknessMinimum: 200, iridescenceThicknessMaximum: 600,
    }, true),
    epoxy: mat('ic_epoxy', { color: 0x101012, roughness: 0.6 }),
    steel: mat('connector_steel', { color: 0x70737a, roughness: 0.45, metalness: 0.95 }),
    cavity: mat('port_cavity', { color: 0x050506, roughness: 0.9 }),
    usbBlue: mat('usb3_tongue_blue', { color: 0x1565d8, roughness: 0.5 }),
    usbBlack: mat('usb2_tongue_black', { color: 0x1c1c1f, roughness: 0.5 }),
    blackPlastic: mat('connector_plastic', { color: 0x0c0c0e, roughness: 0.55 }),
    led: mat('power_led', { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.4 }),
    cell: mat('coin_cell', { color: 0xc8cacf, roughness: 0.25, metalness: 1.0 }),
    cap: mat('smd_passive', { color: 0x8a6f4d, roughness: 0.6 }),
  };
}

function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = w / 2, y = d / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y); s.absarc(x - r, -y + r, r, -Math.PI / 2, 0);
  s.lineTo(x, y - r); s.absarc(x - r, y - r, r, 0, Math.PI / 2);
  s.lineTo(-x + r, y); s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-x, -y + r); s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

// Extrude a shape upward (+Y) starting at y = y0.
function slab(shape, depth, y0, material, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, bevel
    ? { depth: Math.max(depth - 2 * bevel, 0.01), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 5, curveSegments: 10 }
    : { depth, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + (bevel || 0), 0);
  return new THREE.Mesh(g, material);
}

// Box with its *bottom* face at y = by.
function box(parent, w, h, d, material, x, by, z, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, by + h / 2, z);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

function cyl(parent, r, h, material, x, by, z, axis = 'y', seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material);
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, axis === 'y' ? by + h / 2 : by, z);
  parent.add(m);
  return m;
}

function part(unit, parts, name) {
  const g = new THREE.Group();
  g.name = name;
  unit.add(g);
  parts[name] = g;
  return g;
}

// A connector body sitting on the PCB and poking through the front (dir=+1) or rear (dir=-1) wall.
function connector(g, M, { x, w, h, depth, dir, face }) {
  const zFace = dir * (DIM.D / 2 + 0.06);
  const zc = zFace - dir * depth / 2;
  box(g, w, h, depth, M.steel, x, 0, zc);
  const fz = zFace + dir * 0.02;
  const plane = (pw, ph, material, px, py, dz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.04), material);
    m.position.set(px, py, fz + dir * dz);
    g.add(m);
  };
  face(plane, x, h);
}

export function buildWyse3040({ decor = true, badgeTexture = null } = {}) {
  const M = makeMaterials();
  const unit = new THREE.Group();
  unit.name = 'dell_wyse_3040';
  const parts = {};
  const outer = roundedRect(DIM.W, DIM.D, DIM.R);

  // ---- Chassis: lid (with 2 mm chamfer) + four walls -------------------------------
  const shell = part(unit, parts, 'shell');
  shell.add(slab(outer, 4, -HH, M.plastic, 2));
  const ring = roundedRect(DIM.W, DIM.D, DIM.R);
  ring.holes.push(roundedRect(DIM.W - 2 * DIM.WALL, DIM.D - 2 * DIM.WALL, DIM.R - DIM.WALL));
  shell.add(slab(ring, HH * 2 - 2 - DIM.COVER, -HH + 2, M.plastic));
  // Kensington lock slot, 7 x 3 mm, on the X+ side near the rear corner
  box(shell, 0.1, 3, 7, M.cavity, DIM.W / 2 + 0.02, 1.5, -36);
  // PCB standoffs
  for (const [sx, sz] of [[-42, -42], [42, -42], [-42, 42], [42, 42]]) cyl(shell, 2.6, HH - 2 - DIM.PCB_T, M.plastic, sx, -HH + 2, sz);

  // Dell badge on the lid (faces -Y, i.e. up once the unit sits on its feet)
  const badge = part(unit, parts, 'badge');
  const ringGeo = new THREE.RingGeometry(badgeTexture ? 0 : 7.6, 9, 48);
  ringGeo.rotateZ(Math.PI); ringGeo.rotateX(Math.PI / 2);
  const badgeMat = badgeTexture
    ? Object.assign(M.badge, { map: badgeTexture, color: new THREE.Color(0xffffff), transparent: true, metalness: 0.9 })
    : M.badge;
  const badgeMesh = new THREE.Mesh(ringGeo, badgeMat);
  badgeMesh.position.y = -HH - 0.03;
  badge.add(badgeMesh);

  // ---- Removable cover, rubber feet, screws ---------------------------------------
  const cover = part(unit, parts, 'cover');
  cover.add(slab(outer, DIM.COVER, HH - DIM.COVER, M.coverPlastic, 0.5));
  for (const [fx, fz] of [[-38, -38], [38, -38], [-38, 38], [38, 38]]) cyl(cover, 5, 0.8, M.rubber, fx, HH, fz);
  const screws = part(unit, parts, 'screws');
  for (const sx of [-30, 30]) {
    cyl(screws, 2.3, 0.9, M.screw, sx, HH - 0.5, -43);
    cyl(screws, 1.1, 7, M.screw, sx, HH - 7.2, -43, 'y', 12);
    box(screws, 2.6, 0.3, 0.5, M.cavity, sx, HH + 0.25, -43);
    box(screws, 0.5, 0.3, 2.6, M.cavity, sx, HH + 0.25, -43);
  }

  // ---- Mainboard ------------------------------------------------------------------
  const pcb = part(unit, parts, 'pcb');
  pcb.add(slab(roundedRect(DIM.PCB, DIM.PCB, 3), DIM.PCB_T, -DIM.PCB_T, M.pcb));
  for (const [sx, sz] of [[-42, -42], [42, -42], [-42, 42], [42, 42]]) {
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.3, 2.6, 24), M.gold);
    pad.rotation.x = -Math.PI / 2; pad.position.set(sx, 0.02, sz); pcb.add(pad);
  }
  // CMOS coin cell + a few larger passives
  cyl(pcb, 10, 3.2, M.cell, -33, 0, -16);
  box(pcb, 7, 4, 7, M.epoxy, -14, 0, 24);
  box(pcb, 7, 4, 7, M.epoxy, -4, 0, 24);
  box(pcb, 5, 1, 5, M.epoxy, 34, 0, -22);
  box(pcb, 8, 0.9, 8, M.epoxy, -36, 0, 2);
  box(pcb, 4, 0.9, 6, M.epoxy, 30, 0, -4);
  if (decor) {
    // Seeded scatter of small SMD parts (kept out of the keep-out zones of the main parts)
    let seed = 3040;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const keep = [[-27, 27, -24, 20], [-40, -24, 14, 30], [22, 46, 8, 42], [-48, 48, 34, 48], [-48, 48, -48, -34], [-44, -22, -27, -5], [-19, 1, 19, 29]];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const inst = new THREE.InstancedMesh(geo, M.cap, 150);
    const inst2 = new THREE.InstancedMesh(geo, M.epoxy, 60);
    inst.userData.noExport = inst2.userData.noExport = true;
    const o = new THREE.Object3D();
    let a = 0, b = 0;
    while (a < 150 || b < 60) {
      const x = (rnd() - 0.5) * 88, z = (rnd() - 0.5) * 88;
      if (keep.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) continue;
      const big = rnd() > 0.7 && b < 60;
      const flipAxis = rnd() > 0.5;
      const w = big ? 2 + rnd() * 2.5 : 1.0, d = big ? 2 + rnd() * 2 : 0.5, h = big ? 0.7 : 0.4;
      o.position.set(x, h / 2, z);
      o.scale.set(flipAxis ? w : d, h, flipAxis ? d : w);
      o.updateMatrix();
      if (big) inst2.setMatrixAt(b++, o.matrix); else if (a < 150) inst.setMatrixAt(a++, o.matrix);
    }
    pcb.add(inst, inst2);
  }

  // ---- SoC: Intel Atom x5-Z8350, 17 x 17 x 1.2 mm package, ~8 x 6 mm die ----------
  const SOC = { x: 0, z: -2 };
  const soc = part(unit, parts, 'soc');
  box(soc, 17, 1.2, 17, M.substrate, SOC.x, 0, SOC.z);
  const die = part(unit, parts, 'die');
  box(die, 8, 0.3, 6, M.die, SOC.x, 1.2, SOC.z);

  // ---- Heatsink 52 x 42 x 6 mm with longitudinal grooves --------------------------
  const sink = part(unit, parts, 'heatsink');
  box(sink, 52, 2.2, 42, M.heatsink, SOC.x, 1.55, SOC.z);
  for (let i = 0; i < 14; i++) box(sink, 52, 3.8, 1.7, M.heatsink, SOC.x, 3.75, SOC.z - 20.15 + i * 3.1);

  // ---- Soldered memory + storage ---------------------------------------------------
  const ram = part(unit, parts, 'ram');
  box(ram, 11, 1.0, 14, M.epoxy, 19, 0, SOC.z);
  const emmc = part(unit, parts, 'emmc');
  box(emmc, 11.5, 1.0, 13, M.epoxy, -32, 0, 22);

  // ---- M.2 2230 E-key slot ---------------------------------------------------------
  const m2 = part(unit, parts, 'm2');
  box(m2, 22, 4.2, 5, M.blackPlastic, 34, 0, 11.5);
  box(m2, 19, 0.5, 1.2, M.gold, 34, 2.0, 14.2);
  box(m2, 1.2, 1.6, 1.4, M.blackPlastic, 39.5, 1.6, 14.3); // E-key notch
  cyl(m2, 2.2, 2.4, M.gold, 34, 0, 41);
  for (const [w, d, x, z] of [[22, 0.35, 34, 14], [22, 0.35, 34, 44], [0.35, 30, 23, 29], [0.35, 30, 45, 29]]) box(m2, w, 0.04, d, M.silk, x, 0.01, z);

  // ---- Front I/O (Z = +50.8) -------------------------------------------------------
  const usbPort = (g, x, dir, tongueMat) => connector(g, M, {
    x, w: 13.2, h: 7, depth: 14, dir,
    face: (plane) => { plane(12.2, 5.4, M.cavity, x, 3.5); plane(11, 1.9, tongueMat, x, 4.6, 0.03); },
  });
  const usb3 = part(unit, parts, 'usb3'); usbPort(usb3, 10, 1, M.usbBlue);
  const usb2f = part(unit, parts, 'usb2_front'); usbPort(usb2f, -8, 1, M.usbBlack);
  const audio = part(unit, parts, 'audio');
  box(audio, 7, 6, 12, M.blackPlastic, -24, 0, DIM.D / 2 - 6.2);
  cyl(audio, 3.0, 0.5, M.steel, -24, 3.2, DIM.D / 2 + 0.05, 'z');
  cyl(audio, 1.75, 0.6, M.cavity, -24, 3.2, DIM.D / 2 + 0.1, 'z');
  const power = part(unit, parts, 'power');
  cyl(power, 3.4, 0.5, M.blackPlastic, -39, 4, DIM.D / 2 + 0.1, 'z');
  cyl(power, 2.5, 0.6, M.plastic, -39, 4, DIM.D / 2 + 0.2, 'z');
  cyl(shell, 0.7, 0.4, M.led, 33, 6.5, DIM.D / 2 + 0.05, 'z', 12);

  // ---- Rear I/O (Z = -50.8) --------------------------------------------------------
  const dc = part(unit, parts, 'dc');
  connector(dc, M, { x: -42.5, w: 8, h: 9, depth: 12, dir: -1, face: () => {} });
  box(dc, 8.02, 9.02, 12.02, M.blackPlastic, -42.5, 0, -DIM.D / 2 + 5.95);
  cyl(dc, 2.75, 0.5, M.cavity, -42.5, 4.5, -DIM.D / 2 - 0.1, 'z');
  cyl(dc, 0.9, 0.6, M.steel, -42.5, 4.5, -DIM.D / 2 - 0.15, 'z', 12);
  const dpPort = (name, x) => {
    const g = part(unit, parts, name);
    connector(g, M, { x, w: 16.5, h: 6, depth: 13, dir: -1, face: (plane) => { plane(15.3, 4.4, M.cavity, x, 3); plane(13, 1.3, M.blackPlastic, x, 3, 0.03); } });
  };
  dpPort('dp1', -28.25); dpPort('dp2', -9.75);
  const rj45 = part(unit, parts, 'rj45');
  connector(rj45, M, { x: 8.25, w: 15.5, h: 11.5, depth: 16, dir: -1, face: (plane) => {
    plane(11.8, 8, M.cavity, 8.25, 5); plane(6, 2.2, M.cavity, 8.25, 9.6);
    plane(1.6, 1.2, M.led, 2.4, 10.4, 0.02); plane(1.6, 1.2, M.gold, 14.1, 10.4, 0.02);
  } });
  const usbRear = part(unit, parts, 'usb2_rear');
  usbPort(usbRear, 24.6, -1, M.usbBlack); usbPort(usbRear, 39.8, -1, M.usbBlack);

  // Part bounding boxes in unit space (taken while everything is still un-transformed)
  unit.updateMatrixWorld(true);
  const bounds = {};
  for (const [name, g] of Object.entries(parts)) bounds[name] = new THREE.Box3().setFromObject(g);

  return { unit, parts, bounds, materials: M, SOC };
}
