// Launching, flying shots, and what happens when something gets splatted.
import { GADGETS, MOVE } from './config.js';
import { raycast, rayBox, raySphere } from './collide.js';
import { dirX, dirY, dirZ, TAU } from './util.js';
import { addSplat } from './characters.js';

const T = window.THREE;
const tmp = new T.Vector3();
const body = { x1: 0, y1: 0, z1: 0, x2: 0, y2: 0, z2: 0 };

export function createCombat(game) {
  const shots = [];

  function tryFire(a) {
    if (!a.alive || a.busy || a.cooldown > 0 || a.reloadT > 0 || game.state !== 'live') return false;
    const g = GADGETS[a.gadgetId];
    if (a.ammo <= 0) { a.startReload(); return false; }
    a.ammo--; a.cooldown = 1 / g.rate;
    const spread = a.spread();
    const r = spread * Math.sqrt(Math.random()), th = Math.random() * TAU;
    // over-the-shoulder view aims at whatever is under the crosshair, not straight ahead of the character
    const pitch = (a.aim ? a.aim.pitch : a.pitch + a.recoil) + r * Math.sin(th);
    const yaw = (a.aim ? a.aim.yaw : a.yaw) + (r * Math.cos(th)) / Math.max(0.3, Math.cos(pitch));
    const dx = dirX(yaw, pitch), dy = dirY(pitch), dz = dirZ(yaw, pitch);
    const ox = a.pos.x, oy = a.pos.y + a.eyeY(), oz = a.pos.z;
    // the shot is drawn leaving the launcher (lower right), but flies from the eyes so aiming is honest
    const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
    const shot = {
      x: ox, y: oy, z: oz, vx: dx * g.speed, vy: dy * g.speed, vz: dz * g.speed,
      owner: a, g, life: 1.4, age: 0, offx: rx * 0.2 + dx * 0.5, offy: -0.16, offz: rz * 0.2 + dz * 0.5,
      mesh: game.fx.shotMesh(g.color),
    };
    shots.push(shot);
    a.bloom = Math.min(g.bloomMax, a.bloom + g.bloom);
    a.recoil += g.kick;
    game.audio.shoot(g, a);
    if (a.isPlayer) game.onPlayerFire();
    if (g.zoom) a.scoped = false; // the big shot knocks you out of the zoom
    if (a.ammo === 0) a.startReload();
    return true;
  }

  function hitActor(s, v, head, t, dx, dy, dz) {
    const a = s.owner, px = s.x + dx * t, py = s.y + dy * t, pz = s.z + dz * t;
    let dmg = s.g.dmg * (head ? s.g.head : 1);
    if (v.isPlayer && !a.isPlayer) dmg *= game.diff.dmgToPlayer;
    v.hp -= v.soak(dmg);
    tmp.set(px, py, pz);
    addSplat(v.char, tmp, s.g.color);
    game.fx.burst(px, py, pz, s.g.color, 7);
    game.audio.splat(px, py, pz, true);
    const out = v.hp <= 0;
    if (out) { v.hp = 0; v.alive = false; v.outT = 0; v.vel.set(0, 0, 0); }
    game.onHit(a, v, head, out);
  }

  function update(dt) {
    const boxes = game.world.boxes, actors = game.actors;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.vy -= 4 * dt;
      const speed = Math.hypot(s.vx, s.vy, s.vz), dx = s.vx / speed, dy = s.vy / speed, dz = s.vz / speed;
      const step = speed * dt;
      let best = step, hitWho = null, hitHead = false;
      const w = raycast(s.x, s.y, s.z, dx, dy, dz, step, boxes);
      let wall = null;
      if (w) { best = w.t; wall = { nx: w.nx, ny: w.ny, nz: w.nz }; }
      for (let k = 0; k < actors.length; k++) {
        const v = actors[k];
        if (!v.alive || v.team === s.owner.team) continue;
        const ddx = v.pos.x - s.x, ddz = v.pos.z - s.z;
        if (ddx * ddx + ddz * ddz > (step + 2) * (step + 2)) continue;
        const hy = v.pos.y + (v.crouched ? 1.08 : 1.36);
        let t = raySphere(s.x, s.y, s.z, dx, dy, dz, v.pos.x, hy, v.pos.z, 0.36);
        if (t >= 0 && t < best) { best = t; hitWho = v; hitHead = true; }
        body.x1 = v.pos.x - 0.38; body.x2 = v.pos.x + 0.38; body.z1 = v.pos.z - 0.38; body.z2 = v.pos.z + 0.38;
        body.y1 = v.pos.y; body.y2 = v.pos.y + (v.crouched ? 0.86 : 1.12);
        t = rayBox(s.x, s.y, s.z, dx, dy, dz, body);
        if (t >= 0 && t < best) { best = t; hitWho = v; hitHead = false; }
      }
      if (hitWho) {
        hitActor(s, hitWho, hitHead, best, dx, dy, dz);
      } else if (wall) {
        const px = s.x + dx * best, py = s.y + dy * best, pz = s.z + dz * best;
        game.fx.splat(px, py, pz, wall.nx, wall.ny, wall.nz, s.g.color, s.g.splat);
        game.fx.burst(px + wall.nx * 0.05, py + wall.ny * 0.05, pz + wall.nz * 0.05, s.g.color, 5);
        game.audio.splat(px, py, pz, false);
      }
      s.life -= dt;
      if (hitWho || wall || s.life <= 0 || Math.abs(s.x) > 70 || Math.abs(s.z) > 70) {
        game.fx.freeShot(s.mesh);
        shots[i] = shots[shots.length - 1]; shots.pop();
        continue;
      }
      s.x += dx * step; s.y += dy * step; s.z += dz * step; s.age += dt;
      const k = Math.max(0, 1 - s.age / 0.1);
      s.mesh.position.set(s.x + s.offx * k, s.y + s.offy * k, s.z + s.offz * k);
      tmp.set(s.mesh.position.x + dx, s.mesh.position.y + dy, s.mesh.position.z + dz);
      s.mesh.lookAt(tmp);
    }
  }

  function clear() { for (const s of shots) game.fx.freeShot(s.mesh); shots.length = 0; }

  return { tryFire, update, clear, shots };
}

export { MOVE };
