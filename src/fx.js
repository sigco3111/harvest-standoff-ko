// Things that fly and stick: shot streaks, splat marks, and little droplets.
import { sphereGeo } from './gfx.js';

const T = window.THREE;

export function createFx(scene) {
  // ---- shots ----
  const freeShots = [];
  function shotMesh(color) {
    let m = freeShots.pop();
    if (!m) {
      m = new T.Mesh(sphereGeo(), new T.MeshBasicMaterial({ color }));
      m.scale.set(0.055, 0.055, 0.42);
      scene.add(m);
    }
    m.material.color.setHex(color);
    m.visible = true;
    return m;
  }
  function freeShot(m) { m.visible = false; freeShots.push(m); }

  // ---- splat marks on walls and ground ----
  const blobGeos = [];
  for (let v = 0; v < 4; v++) {
    const g = new T.CircleGeometry(1, 14);
    const p = g.attributes.position;
    for (let i = 1; i < p.count; i++) { const k = 0.7 + Math.random() * 0.5; p.setXY(i, p.getX(i) * k, p.getY(i) * k); }
    p.setXY(p.count - 1, p.getX(1), p.getY(1));
    blobGeos.push(g);
  }
  const decals = [];
  let decalNext = 0;
  const DECALS = 160;
  function splat(x, y, z, nx, ny, nz, color, size) {
    let d = decals[decalNext];
    if (!d) {
      d = new T.Mesh(blobGeos[decalNext % 4], new T.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      d.receiveShadow = true;
      scene.add(d); decals[decalNext] = d;
    }
    decalNext = (decalNext + 1) % DECALS;
    d.material.color.setHex(color);
    d.position.set(x + nx * 0.02, y + ny * 0.02 + (ny > 0.5 ? 0.012 : 0), z + nz * 0.02);
    d.lookAt(x + nx, y + ny, z + nz);
    d.rotateZ(Math.random() * 6.28);
    const s = size * (0.8 + Math.random() * 0.5);
    d.scale.set(s, s, s);
    d.visible = true;
  }

  // ---- droplets ----
  const drops = [];
  const DROPS = 140;
  let dropNext = 0;
  function burst(x, y, z, color, n) {
    for (let i = 0; i < n; i++) {
      let d = drops[dropNext];
      if (!d) { d = { m: new T.Mesh(sphereGeo(), new T.MeshBasicMaterial({ color })), vx: 0, vy: 0, vz: 0, life: 0 }; scene.add(d.m); drops[dropNext] = d; }
      dropNext = (dropNext + 1) % DROPS;
      d.m.material.color.setHex(color);
      d.m.position.set(x, y, z);
      d.m.scale.setScalar(0.03 + Math.random() * 0.04);
      d.m.visible = true;
      d.vx = (Math.random() - 0.5) * 5; d.vy = Math.random() * 4 + 0.5; d.vz = (Math.random() - 0.5) * 5;
      d.life = 0.3 + Math.random() * 0.25;
    }
  }

  function update(dt) {
    for (const d of drops) {
      if (!d || d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { d.m.visible = false; continue; }
      d.vy -= 14 * dt;
      d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
    }
  }

  function clearDecals() { for (const d of decals) if (d) d.visible = false; }

  return { shotMesh, freeShot, splat, burst, update, clearDecals };
}
