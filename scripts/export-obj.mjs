// Writes models/dell_wyse_3040_assembly.obj (+ .mtl): the closed unit standing on its
// feet, Y up, 1 unit = 1 mm, one OBJ object per named part.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { buildWyse3040, DIM } from '../src/model.js';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../models');
const { unit, parts, materials } = buildWyse3040({ decor: false });
unit.rotation.z = Math.PI;            // lid with the badge up, cover + feet down
unit.position.y = DIM.H / 2 + 0.8;    // resting on the rubber feet
for (const [name, g] of Object.entries(parts)) {
  // merge each part into a single named mesh per material so OBJ groups stay tidy
  g.traverse((o) => { if (o.isMesh) o.name = `${name}`; });
}
const scene = new THREE.Scene();
scene.add(unit);
scene.updateMatrixWorld(true);
let obj = new OBJExporter().parse(scene);
obj = `# Dell Wyse 3040 thin client - procedural assembly\n# units: millimetres, Y up, front I/O at +Z\nmtllib dell_wyse_3040_assembly.mtl\n` + obj;
let mtl = '# Dell Wyse 3040 materials\n';
for (const m of Object.values(materials)) {
  const c = m.color;
  mtl += `\nnewmtl ${m.name}\nKd ${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)}\nKs ${m.metalness > 0.5 ? '0.9 0.9 0.9' : '0.2 0.2 0.2'}\nNs ${Math.round((1 - m.roughness) * 400)}\nPr ${m.roughness}\nPm ${m.metalness}\n`;
  if (m.emissiveIntensity && m.emissive?.r) mtl += `Ke 1 1 1\n`;
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'dell_wyse_3040_assembly.obj'), obj);
fs.writeFileSync(path.join(out, 'dell_wyse_3040_assembly.mtl'), mtl);
const box = new THREE.Box3().setFromObject(unit);
const s = box.getSize(new THREE.Vector3());
console.log(`wrote OBJ: ${(obj.length / 1024).toFixed(0)} kB, bbox ${s.x.toFixed(2)} x ${s.z.toFixed(2)} x ${s.y.toFixed(2)} mm (W x D x H incl. feet)`);
