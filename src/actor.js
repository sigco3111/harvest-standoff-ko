// One character in the match (the player or a computer player): movement, mess meter, launcher state, purse.
import { MOVE, GADGETS, ECON } from './config.js';
import { moveAndCollide } from './collide.js';
import { buildCharacter, animateCharacter, clearSplats, buildGadget } from './characters.js';

const T = window.THREE;

export class Actor {
  constructor(game, team, info, isPlayer) {
    this.game = game; this.team = team; this.name = info.name; this.kind = info.kind; this.isPlayer = isPlayer;
    this.pos = new T.Vector3(); this.vel = new T.Vector3();
    this.yaw = 0; this.pitch = 0; this.recoil = 0;
    this.crouched = false; this.onGround = true; this.alive = true; this.hp = 100;
    this.gadgetId = null; this.lastGadget = 'squirter'; this.tanks = {}; this.cooldown = 0; this.reloadT = 0; this.bloom = 0;
    this.primary = null; this.armor = 0; this.kit = false; this.coins = ECON.start; this.scoped = false;
    this.throws = { flour: 0, rooster: 0, mud: 0 }; this.throwT = 0; this.dazeT = 0;
    this.stepDist = 0; this.outT = 0; this.busy = false; this.sayT = 0; this.splats = 0;
    for (const id in GADGETS) this.tanks[id] = GADGETS[id].tank;
    this.char = buildCharacter(info.kind, info.look);
    this.gadgetMeshes = {};
    for (const id in GADGETS) { const m = buildGadget(id); m.visible = false; this.char.mount.add(m); this.gadgetMeshes[id] = m; }
    game.scene.add(this.char.root);
    this.setGadget('squirter');
  }

  // each launcher keeps its own tank, so swapping is never a free refill
  get ammo() { return this.tanks[this.gadgetId]; }
  set ammo(v) { this.tanks[this.gadgetId] = v; }
  has(id) { return id === 'squirter' || id === this.primary; }

  setGadget(id) {
    if (this.gadgetId === id || !this.has(id)) return false;
    if (this.gadgetId) this.lastGadget = this.gadgetId;
    this.gadgetId = id;
    this.reloadT = 0; this.cooldown = 0.35; this.bloom = 0; this.scoped = false;
    for (const k in this.gadgetMeshes) this.gadgetMeshes[k].visible = k === id;
    if (this.ammo <= 0) this.startReload();
    return true;
  }

  givePrimary(id) {
    this.primary = id;
    if (id) { this.tanks[id] = GADGETS[id].tank; this.setGadget(id); } else if (this.gadgetId !== 'squirter') { this.gadgetId = null; this.setGadget('squirter'); }
  }

  // called at the start of every round; "keep" is false after being splatted or at half-time
  reset(spawn, keep) {
    this.pos.set(spawn.x, 0, spawn.z); this.vel.set(0, 0, 0);
    this.yaw = spawn.yaw; this.pitch = 0; this.recoil = 0;
    if (!keep) { this.primary = null; this.armor = 0; this.kit = false; this.throws = { flour: 0, rooster: 0, mud: 0 }; }
    this.throwT = 0; this.dazeT = 0;
    this.hp = 100; this.alive = true; this.crouched = false; this.outT = 0; this.busy = false; this.scoped = false;
    for (const id in GADGETS) this.tanks[id] = GADGETS[id].tank;
    this.reloadT = 0; this.cooldown = 0; this.bloom = 0;
    this.gadgetId = null; this.setGadget(this.primary || 'squirter'); this.cooldown = 0;
    clearSplats(this.char);
    this.char.root.visible = true; this.char.root.scale.setScalar(1);
  }

  eyeY() { return this.crouched ? MOVE.eyeCrouch : MOVE.eye; }
  speed2d() { return Math.hypot(this.vel.x, this.vel.z); }

  // wx,wz: the direction this character wants to go (length 0..1)
  move(dt, wx, wz, wantJump, walking, crouching) {
    this.crouched = crouching;
    if (this.busy) { wx = 0; wz = 0; wantJump = false; } // planting or corking: feet stay put
    let top = crouching ? MOVE.crouch : walking ? MOVE.walk : MOVE.run;
    const g = GADGETS[this.gadgetId];
    if (g.slow) top *= this.scoped ? g.slow * 0.6 : g.slow;
    top *= this.game.throwables.slowAt(this.pos.x, this.pos.z); // sticky mud
    top *= this.game.world.slowAt(this.pos.x, this.pos.z); // wading through the creek
    const tx = wx * top, tz = wz * top;
    const rate = MOVE.accel * (this.onGround ? 1 : MOVE.airControl) * dt;
    const dx = tx - this.vel.x, dz = tz - this.vel.z, d = Math.hypot(dx, dz);
    if (d <= rate || d === 0) { this.vel.x = tx; this.vel.z = tz; } else { this.vel.x += (dx / d) * rate; this.vel.z += (dz / d) * rate; }
    if (wantJump && this.onGround) { this.vel.y = MOVE.jump; this.onGround = false; }
    this.vel.y -= MOVE.gravity * dt;
    const before = this.onGround;
    const px = this.pos.x, pz = this.pos.z;
    this.onGround = moveAndCollide(this.pos, this.vel, dt, MOVE.radius, crouching ? MOVE.heightCrouch : MOVE.height, this.game.world.boxes);
    if (this.onGround) {
      const sp = this.speed2d();
      if (sp > MOVE.walk + 0.5) {
        this.stepDist += Math.hypot(this.pos.x - px, this.pos.z - pz);
        if (this.stepDist > 2.3) { this.stepDist = 0; this.game.audio.step(this); }
      }
      if (!before) this.game.audio.step(this);
    }
  }

  // how wide the shots scatter right now (running and jumping make it much worse)
  spread() {
    const g = GADGETS[this.gadgetId];
    let s = (g.zoom && this.scoped ? g.zoomSpread : g.spread) + this.bloom;
    const sp = this.speed2d();
    if (sp > MOVE.walk + 0.4) s += g.moveSpread * Math.min(1, (sp - MOVE.walk) / (MOVE.run - MOVE.walk));
    if (!this.onGround) s += g.airSpread;
    if (this.crouched) s *= 0.75;
    return s;
  }

  startReload() {
    const g = GADGETS[this.gadgetId];
    if (this.reloadT > 0 || this.ammo >= g.tank) return;
    this.reloadT = g.reload; this.scoped = false;
    this.game.audio.reload(this);
  }

  // returns the mess that actually lands after overalls soak some up
  soak(dmg) {
    if (this.armor > 0) { const a = Math.min(this.armor, dmg * 0.5); this.armor -= a; dmg -= a; }
    return dmg;
  }

  earn(n) { this.coins = Math.max(0, Math.min(ECON.max, this.coins + n)); }

  tick(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.sayT > 0) this.sayT -= dt;
    if (this.throwT > 0) this.throwT -= dt;
    if (this.dazeT > 0) this.dazeT -= dt;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.ammo = GADGETS[this.gadgetId].tank; this.reloadT = 0; } }
    const g = GADGETS[this.gadgetId];
    this.bloom = Math.max(0, this.bloom - g.bloomMax * 2.2 * dt);
    this.recoil *= Math.exp(-7 * dt);
    if (!this.alive) this.outT += dt;
  }

  updateModel(dt, hidden) {
    const c = this.char;
    c.root.position.copy(this.pos);
    c.root.rotation.y = this.yaw;
    animateCharacter(c, dt, this.alive ? this.speed2d() : 0, this.pitch + this.recoil, this.crouched || this.busy, this.alive);
    if (!this.alive) {
      // lie there looking silly for a moment, then pop away
      const s = this.outT < 1.6 ? 1 : Math.max(0, 1 - (this.outT - 1.6) * 4);
      c.root.scale.setScalar(Math.max(0.001, s));
      c.root.visible = s > 0.01;
    } else c.root.visible = !hidden;
  }
}
