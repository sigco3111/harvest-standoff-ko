// Things you throw: the Flour Bomb (a cloud nobody can see through), the Rooster Crow (dazzles opponents who look at it)
// and the Mud Balloon (a sticky puddle that slows everyone in it).
import { THROWS } from './config.js';
import { raycast, losClear } from './collide.js';
import { add, group, sphereLoGeo, coneGeo, cylGeo, mat } from './gfx.js';
import { dirX, dirY, dirZ, angDiff, yawTo, clamp } from './util.js';

const T = window.THREE;
const GRAV = 18;
export const THROW_SPEED = 15;

function buildItem(id) {
  const g = new T.Group();
  if (id === 'flour') {
    add(g, sphereLoGeo(), 0xf6ecd2, 0, 0, 0, { s: [0.15, 0.14, 0.15] });
    add(g, coneGeo(0.07, 0.1, 8), 0xf6ecd2, 0, 0.15, 0, { r: [Math.PI, 0, 0] });
    add(g, cylGeo(0.05, 0.05, 0.03, 8), 0xb98452, 0, 0.11, 0);
  } else if (id === 'rooster') {
    add(g, sphereLoGeo(), 0xfffaf0, 0, 0, 0, { s: [0.12, 0.13, 0.15] });
    add(g, sphereLoGeo(), 0xfffaf0, 0, 0.15, -0.08, { s: 0.08 });
    add(g, sphereLoGeo(), 0xe5412d, 0, 0.24, -0.08, { s: [0.03, 0.05, 0.07] });
    add(g, coneGeo(0.03, 0.08, 6), 0xffb02e, 0, 0.14, -0.18, { r: [-Math.PI / 2, 0, 0] });
    add(g, sphereLoGeo(), 0xe5412d, 0, 0.04, 0.16, { s: [0.04, 0.12, 0.08] });
    add(g, cylGeo(0.02, 0.02, 0.1, 6), 0x9aa3ad, 0, 0.16, 0.06);
  } else {
    add(g, sphereLoGeo(), 0x7a5230, 0, 0, 0, { s: [0.15, 0.17, 0.15] });
    add(g, coneGeo(0.04, 0.07, 8), 0x7a5230, 0, 0.19, 0);
  }
  return g;
}

export function createThrowables(game) {
  const flying = [], clouds = [], puddles = [], flashes = [];
  const scene = game.scene;

  // ---- throwing ----
  function throwItem(a, id, yaw, pitch) {
    if (!a.alive || a.busy || a.throwT > 0 || !a.throws[id] || game.state !== 'live') return false;
    a.throws[id]--; a.throwT = 0.8; a.cooldown = Math.max(a.cooldown, 0.45); a.scoped = false;
    const dx = dirX(yaw, pitch), dy = dirY(pitch), dz = dirZ(yaw, pitch);
    const mesh = buildItem(id);
    scene.add(mesh);
    flying.push({
      id, team: a.team, owner: a, t: 0, mesh, rest: false,
      x: a.pos.x + dx * 0.5 + Math.cos(yaw) * 0.18, y: a.pos.y + a.eyeY() - 0.1, z: a.pos.z + dz * 0.5 - Math.sin(yaw) * 0.18,
      vx: dx * THROW_SPEED + a.vel.x * 0.5, vy: dy * THROW_SPEED + 2.6, vz: dz * THROW_SPEED + a.vel.z * 0.5,
    });
    game.audio.toss(a);
    game.audio.radio(a.team, id);
    return true;
  }

  // ---- what happens when one goes off ----
  function trigger(it) {
    const def = THROWS[it.id];
    if (it.id === 'flour') {
      const c = { x: it.x, y: Math.max(1.0, it.y + 0.7), z: it.z, r: 0.4, full: def.radius, life: def.life, puffs: group(scene, it.x, 0, it.z) };
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 6.28 + Math.random(), d = i < 5 ? Math.random() * 0.25 : 0.45 + Math.random() * 0.4;
        const p = add(c.puffs, sphereLoGeo(), 0xfffdf6, Math.cos(a) * d, 0.35 + Math.random() * 0.55, Math.sin(a) * d, { s: 0.42 + Math.random() * 0.2, cast: false, receive: false });
        p.userData.base = p.position.clone();
      }
      clouds.push(c);
      game.audio.poof(it.x, it.z);
      game.fx.burst(it.x, it.y + 0.3, it.z, 0xffffff, 14);
    } else if (it.id === 'rooster') {
      game.audio.crow(it.x, it.z);
      game.fx.burst(it.x, it.y + 0.3, it.z, 0xfff6c9, 18);
      const f = add(scene, sphereLoGeo(), new T.MeshBasicMaterial({ color: 0xfff7c2, transparent: true, opacity: 0.7, depthWrite: false }), it.x, it.y + 0.3, it.z, { s: 0.3, cast: false, receive: false });
      flashes.push({ m: f, life: 0 });
      // dazzle every opponent who can see it; looking straight at it is worst
      for (const v of game.actors) {
        if (!v.alive || v.team === it.team) continue;
        const dx = it.x - v.pos.x, dz = it.z - v.pos.z, d = Math.hypot(dx, dz);
        if (d > def.radius) continue;
        const ey = v.pos.y + v.eyeY();
        if (!losClear(v.pos.x, ey, v.pos.z, it.x, it.y + 0.35, it.z, game.world.boxes) || sightBlocked(v.pos.x, ey, v.pos.z, it.x, it.y + 0.35, it.z)) continue;
        const off = Math.abs(angDiff(yawTo(dx, dz), v.yaw));
        const facing = off < 1.2 ? 1 : off < 2.1 ? 0.5 : 0.15;
        v.dazeT = Math.max(v.dazeT, def.daze * (1 - (d / def.radius) * 0.6) * facing);
      }
    } else {
      const m = new T.Mesh(new T.CircleGeometry(1, 22), new T.MeshLambertMaterial({ color: 0x6f4a2c, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      const p = m.geometry.attributes.position;
      for (let i = 1; i < p.count - 1; i++) { const k = 0.8 + Math.random() * 0.3; p.setXY(i, p.getX(i) * k, p.getY(i) * k); }
      p.setXY(p.count - 1, p.getX(1), p.getY(1));
      m.rotation.x = -Math.PI / 2; m.position.set(it.x, 0.035, it.z); m.scale.setScalar(0.3); m.receiveShadow = true;
      scene.add(m);
      puddles.push({ x: it.x, z: it.z, r: def.radius, life: def.life, m, grow: 0 });
      game.audio.mud(it.x, it.z);
      game.fx.burst(it.x, 0.3, it.z, 0x6f4a2c, 22);
    }
    scene.remove(it.mesh);
  }

  function update(dt) {
    const boxes = game.world.boxes;
    for (let i = flying.length - 1; i >= 0; i--) {
      const it = flying[i], def = THROWS[it.id];
      it.t += dt;
      if (!it.rest) {
        it.vy -= GRAV * dt;
        const sp = Math.hypot(it.vx, it.vy, it.vz), step = sp * dt;
        const dx = it.vx / sp, dy = it.vy / sp, dz = it.vz / sp;
        const hit = sp > 0.01 ? raycast(it.x, it.y, it.z, dx, dy, dz, step + 0.12, boxes) : null;
        if (hit) {
          it.x += dx * Math.max(0, hit.t - 0.12); it.y += dy * Math.max(0, hit.t - 0.12); it.z += dz * Math.max(0, hit.t - 0.12);
          if (it.id === 'mud') { trigger(it); flying.splice(i, 1); continue; }
          // bounce
          const dot = it.vx * hit.nx + it.vy * hit.ny + it.vz * hit.nz;
          it.vx = (it.vx - 2 * dot * hit.nx) * 0.42; it.vy = (it.vy - 2 * dot * hit.ny) * 0.42; it.vz = (it.vz - 2 * dot * hit.nz) * 0.42;
          if (hit.ny > 0.5 && Math.hypot(it.vx, it.vy, it.vz) < 1.6) { it.rest = true; it.vx = it.vy = it.vz = 0; }
          if (Math.abs(dot) > 2) game.audio.thud(it.x, it.z);
        } else { it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt; }
        if (it.y < 0.12) { it.y = 0.12; if (it.id === 'mud') { trigger(it); flying.splice(i, 1); continue; } }
        it.mesh.rotation.x += dt * 9; it.mesh.rotation.z += dt * 5;
      } else { it.mesh.rotation.set(0, it.mesh.rotation.y, 0); }
      it.mesh.position.set(it.x, it.y, it.z);
      if (it.id !== 'mud' && it.t >= def.fuse) { trigger(it); flying.splice(i, 1); }
      else if (it.t > 6) { scene.remove(it.mesh); flying.splice(i, 1); }
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      c.life -= dt;
      c.r += (c.full - c.r) * Math.min(1, dt * 3.5);
      const fade = clamp(c.life / 1.5, 0, 1), k = (c.r / 0.85) * (0.25 + 0.75 * fade);
      for (const p of c.puffs.children) { p.position.copy(p.userData.base).multiplyScalar(k); p.position.y = Math.max(0.5, p.userData.base.y * k * 0.62 + 0.3); p.scale.setScalar(k * 0.52); }
      if (c.life <= 0) { scene.remove(c.puffs); clouds.splice(i, 1); }
    }
    for (let i = puddles.length - 1; i >= 0; i--) {
      const p = puddles[i];
      p.life -= dt; p.grow = Math.min(1, p.grow + dt * 5);
      p.m.scale.setScalar(p.r * p.grow * clamp(p.life / 0.8, 0, 1));
      if (p.life <= 0) { scene.remove(p.m); puddles.splice(i, 1); }
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life += dt; f.m.scale.setScalar(0.3 + f.life * 14); f.m.material.opacity = 0.7 * (1 - f.life / 0.4);
      if (f.life >= 0.4) { scene.remove(f.m); flashes.splice(i, 1); }
    }
  }

  // ---- questions the rest of the game asks ----
  // does a flour cloud sit between two points?
  function sightBlocked(ax, ay, az, bx, by, bz) {
    for (const c of clouds) {
      if (c.life < 0.8) continue;
      const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
      const t = l2 ? clamp(((c.x - ax) * dx + (c.y - ay) * dy + (c.z - az) * dz) / l2, 0, 1) : 0;
      const r = c.r * 0.92;
      if ((ax + dx * t - c.x) ** 2 + (ay + dy * t - c.y) ** 2 + (az + dz * t - c.z) ** 2 < r * r) return true;
    }
    return false;
  }
  // how deep inside a cloud is this point (0 = outside, 1 = right in it)
  function fogAt(x, y, z) {
    let f = 0;
    for (const c of clouds) { const d = Math.hypot(x - c.x, y - c.y, z - c.z); f = Math.max(f, clamp((c.r - d) / 1.2, 0, 1) * clamp(c.life / 1.2, 0, 1)); }
    return f;
  }
  function slowAt(x, z) {
    for (const p of puddles) if (Math.hypot(x - p.x, z - p.z) < p.r * p.grow) return THROWS.mud.slow;
    return 1;
  }
  function clear() {
    for (const it of flying) scene.remove(it.mesh);
    for (const c of clouds) scene.remove(c.puffs);
    for (const p of puddles) scene.remove(p.m);
    for (const f of flashes) scene.remove(f.m);
    flying.length = clouds.length = puddles.length = flashes.length = 0;
  }

  return { throwItem, update, sightBlocked, fogAt, slowAt, clear, clouds, puddles, flying };
}

// the angle to throw at so it lands about `range` metres away
export function lobPitch(range) {
  return 0.5 * Math.asin(clamp((range * GRAV) / (THROW_SPEED * THROW_SPEED * 1.25), 0, 1));
}
