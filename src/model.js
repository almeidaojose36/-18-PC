// Procedural, millimetre-accurate Dell Wyse 3040 assembly (1 unit = 1 mm).
//
// The model is built in "service orientation": +Y points at the removable cover, the
// lid with the Dell badge is at -Y, front I/O is at Z = +50.8 and rear I/O at Z = -50.8.
// Every part is a named Group at the origin whose children carry absolute positions, so
// a part can be exploded by simply offsetting its group. Runs in Node (no DOM needed)
// so the same code feeds the OBJ exporter.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// REC: how far the lattice base surface sits below the outer envelope; BAND: depth of the smooth front band
export const DIM = { W: 101.6, D: 101.6, H: 27.94, R: 2.5, WALL: 1.6, COVER: 1.5, PCB: 95, PCB_T: 1.6, REC: 1.6, BAND: 18 };
const HH = DIM.H / 2;
const FRONT_Z = DIM.D / 2, REAR_Z = -(DIM.D / 2 - DIM.REC);   // the rear panel is recessed inside the lattice

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
    sticker: mat('sticker_blue', { color: 0x0d4f8f, roughness: 0.45 }),
    print: mat('printed_text', { color: 0xd8dade, roughness: 0.6, transparent: true }),
    badge: mat('dell_badge', { color: 0xc9ccd2, roughness: 0.25, metalness: 0.95 }),
    pcb: mat('pcb_soldermask', { color: 0x1e6a3c, roughness: 0.45, metalness: 0.1 }),
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

// Closed polygon (points as [x, z]) with optionally rounded corners, as a Shape in the
// (x, -z) plane so that slab() puts it back at the given x/z.
function poly(points, r = 0, PathClass = THREE.Shape) {
  const s = new PathClass(), n = points.length;
  const P = points.map(([x, z]) => new THREE.Vector2(x, -z));
  for (let i = 0; i < n; i++) {
    const p = P[i], a = P[(i + n - 1) % n], b = P[(i + 1) % n];
    const rr = Array.isArray(r) ? r[i] : r;
    if (!rr) { i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y); continue; }
    const p0 = p.clone().add(a.clone().sub(p).setLength(rr)), p1 = p.clone().add(b.clone().sub(p).setLength(rr));
    i ? s.lineTo(p0.x, p0.y) : s.moveTo(p0.x, p0.y);
    s.quadraticCurveTo(p.x, p.y, p1.x, p1.y);
  }
  s.closePath();
  return s;
}

// Diamond lattice of raised ridges filling the rectangle [u0,u1] x [v0,v1] of the XZ plane
// (u = x, v = z). Each ridge is a square bar turned 45 degrees, so half of it stands proud.
function lattice(u0, u1, v0, v1, pitch, side) {
  const geos = [];
  for (const sign of [1, -1]) {
    const cmin = sign > 0 ? v0 - u1 : v0 + u0, cmax = sign > 0 ? v1 - u0 : v1 + u1;
    for (let c = Math.ceil(cmin / pitch) * pitch; c <= cmax; c += pitch) {
      const ua = sign > 0 ? Math.max(u0, v0 - c) : Math.max(u0, c - v1);
      const ub = sign > 0 ? Math.min(u1, v1 - c) : Math.min(u1, c - v0);
      if (ub - ua < 1.2) continue;
      const um = (ua + ub) / 2;
      const g = new THREE.BoxGeometry((ub - ua) * Math.SQRT2, side, side);
      g.rotateX(Math.PI / 4); g.rotateY(sign > 0 ? -Math.PI / 4 : Math.PI / 4); g.translate(um, 0, sign * um + c);
      geos.push(g);
    }
  }
  return mergeGeometries(geos);
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
  const zFace = dir > 0 ? FRONT_Z + 0.06 : REAR_Z - 0.06;
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

export function buildWyse3040({ decor = true, badgeTexture = null, nameTexture = null } = {}) {
  const M = makeMaterials();
  const unit = new THREE.Group();
  unit.name = 'dell_wyse_3040';
  const parts = {};
  const outer = roundedRect(DIM.W, DIM.D, DIM.R);

  // ---- Chassis: lattice shell behind a smooth front band --------------------------------
  const shell = part(unit, parts, 'shell');
  const X = DIM.W / 2, XI = X - DIM.REC, ZB = FRONT_Z - DIM.BAND, base = -HH + DIM.REC;
  const pts = [[-X, FRONT_Z], [X, FRONT_Z], [X, ZB], [XI, ZB], [XI, REAR_Z], [-XI, REAR_Z], [-XI, ZB], [-X, ZB]];
  const outline = () => poly(pts, [DIM.R, DIM.R, 0.8, 0, DIM.R, DIM.R, 0, 0.8]);
  shell.add(slab(outline(), 2, base, M.plastic));                                   // lid plate
  shell.add(slab(poly([[-X, FRONT_Z], [X, FRONT_Z], [X, ZB], [-X, ZB]], [DIM.R, DIM.R, 0.8, 0.8]), DIM.REC + 0.4, -HH, M.plastic, 0.5)); // smooth band, top
  const ring = outline(), XW = XI - DIM.WALL;
  ring.holes.push(poly([[-XW, FRONT_Z - DIM.WALL], [XW, FRONT_Z - DIM.WALL], [XW, REAR_Z + DIM.WALL], [-XW, REAR_Z + DIM.WALL]], 1, THREE.Path));
  shell.add(slab(ring, HH * 2 - DIM.REC - 2 - DIM.COVER, base + 2, M.plastic));       // walls
  // diamond lattice: lid, then both side walls
  const PITCH = 7.6, BAR = DIM.REC * Math.SQRT2;
  const top = lattice(-XI + 0.5, XI - 0.5, REAR_Z + 0.5, ZB, PITCH, BAR);
  top.translate(0, base, 0);
  shell.add(new THREE.Mesh(top, M.plastic));
  for (const sx of [-1, 1]) {
    const g = lattice(base + 0.4, HH - DIM.COVER - 0.3, REAR_Z + 0.5, ZB, PITCH, BAR);
    g.rotateZ(Math.PI / 2); g.translate(sx * XI, 0, 0);
    shell.add(new THREE.Mesh(g, M.plastic));
  }
  // Kensington lock slot, 7 x 3 mm, in the smooth band on the X+ side
  box(shell, 0.1, 3, 7, M.cavity, X + 0.02, 1.5, ZB + 9);
  // PCB standoffs
  for (const [sx, sz] of [[-42, -42], [42, -42], [-42, 42], [42, 42]]) cyl(shell, 2.6, -DIM.PCB_T - (base + 2), M.plastic, sx, base + 2, sz);
  // stickers on the top of the front band (left of the power button when upright)
  box(shell, 11, 0.08, 12, M.sticker, 38, -HH - 0.07, ZB + 9);
  box(shell, 8, 0.08, 10, M.sticker, 27, -HH - 0.07, ZB + 9);

  // Round Dell logo on the front face (right-hand side when the unit stands upright)
  const badge = part(unit, parts, 'badge');
  const ringGeo = badgeTexture ? new THREE.CircleGeometry(8.6, 48) : new THREE.RingGeometry(7.2, 8.6, 48);
  ringGeo.rotateZ(Math.PI);
  const badgeMat = badgeTexture
    ? Object.assign(M.badge, { map: badgeTexture, color: new THREE.Color(0xffffff), transparent: true, metalness: 0.9 })
    : M.badge;
  const badgeMesh = new THREE.Mesh(ringGeo, badgeMat);
  badgeMesh.position.set(-36, -1, FRONT_Z + 0.05);
  badge.add(badgeMesh);
  if (nameTexture) {
    const name = new THREE.Mesh(new THREE.PlaneGeometry(24, 4), Object.assign(M.print, { map: nameTexture }));
    name.rotation.z = Math.PI; name.position.set(35, -9.2, FRONT_Z + 0.05);
    shell.add(name);
  }

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

  // ---- Heatsink: flat plate with two finned wings, held by two screws ----------------------
  const sink = part(unit, parts, 'heatsink');
  box(sink, 58, 1.8, 40, M.heatsink, SOC.x, 1.55, SOC.z);
  box(sink, 18, 1.6, 16, M.heatsink, SOC.x, 3.35, SOC.z);
  for (const wx of [-19.5, 19.5]) for (let i = 0; i < 10; i++) box(sink, 17, 4.2, 1.9, M.heatsink, SOC.x + wx, 3.35, SOC.z - 17.5 + i * 3.9);
  for (const [hx, hz] of [[-7, -15], [7, 15]]) cyl(sink, 1.8, 0.8, M.screw, SOC.x + hx, 3.35, SOC.z + hz, 'y', 16);

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

  // ---- Front I/O (Z = +50.8). Upright, left to right: headset, USB 2.0, USB 3.0, Dell logo ----
  const usbPort = (g, x, dir, tongueMat, by = 0) => {
    const zFace = dir > 0 ? FRONT_Z + 0.06 : REAR_Z - 0.06, fz = zFace + dir * 0.02;
    box(g, 13.2, 6, 14, M.steel, x, by, zFace - dir * 7);
    const pl = (w, h, m, y, dz = 0) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), m); q.position.set(x, by + y, fz + dir * dz); g.add(q); };
    pl(12.2, 4.6, M.cavity, 3); pl(11, 1.7, tongueMat, 3.9, 0.03);
  };
  const usb3 = part(unit, parts, 'usb3'); usbPort(usb3, -6, 1, M.usbBlue);
  const usb2f = part(unit, parts, 'usb2_front'); usbPort(usb2f, 14, 1, M.usbBlack);
  const audio = part(unit, parts, 'audio');
  box(audio, 7, 6, 12, M.blackPlastic, 37, 0, FRONT_Z - 6.2);
  cyl(audio, 3.0, 0.5, M.steel, 37, 3.2, FRONT_Z + 0.05, 'z');
  cyl(audio, 1.75, 0.6, M.cavity, 37, 3.2, FRONT_Z + 0.1, 'z');
  // Power button: on top of the front band, right-hand side when upright
  const power = part(unit, parts, 'power');
  cyl(power, 4.4, 0.5, M.blackPlastic, -38, -HH - 0.15, ZB + 9);
  cyl(power, 3.7, 0.3, M.plastic, -38, -HH - 0.3, ZB + 9);
  box(power, 0.5, 0.1, 3, M.led, -38, -HH - 0.36, ZB + 9);

  // ---- Rear I/O. Upright, seen from behind, left to right: DC, DP, DP, 2x USB (stacked), RJ45 ----
  const dc = part(unit, parts, 'dc');
  box(dc, 9, 9, 12, M.blackPlastic, -42, 0, REAR_Z + 5.95);
  cyl(dc, 2.75, 0.5, M.cavity, -42, 4.5, REAR_Z - 0.1, 'z');
  cyl(dc, 0.9, 0.6, M.steel, -42, 4.5, REAR_Z - 0.15, 'z', 12);
  const dpPort = (name, x) => {
    const g = part(unit, parts, name);
    connector(g, M, { x, w: 16.5, h: 6, depth: 13, dir: -1, face: (plane) => { plane(15.3, 4.4, M.cavity, x, 3); plane(13, 1.3, M.blackPlastic, x, 3, 0.03); } });
  };
  dpPort('dp1', -26); dpPort('dp2', -7);
  const usbRear = part(unit, parts, 'usb2_rear');
  usbPort(usbRear, 11.5, -1, M.usbBlack, 0); usbPort(usbRear, 11.5, -1, M.usbBlack, 6.2);
  const rj45 = part(unit, parts, 'rj45');
  connector(rj45, M, { x: 30, w: 15.5, h: 12, depth: 16, dir: -1, face: (plane) => {
    plane(11.8, 8, M.cavity, 30, 5); plane(6, 2.2, M.cavity, 30, 9.8);
    plane(1.6, 1.2, M.led, 24.2, 10.8, 0.02); plane(1.6, 1.2, M.gold, 35.8, 10.8, 0.02);
  } });

  // Part bounding boxes in unit space (taken while everything is still un-transformed)
  unit.updateMatrixWorld(true);
  const bounds = {};
  for (const [name, g] of Object.entries(parts)) bounds[name] = new THREE.Box3().setFromObject(g);

  return { unit, parts, bounds, materials: M, SOC };
}
