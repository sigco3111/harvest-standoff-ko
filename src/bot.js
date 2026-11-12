// The "brain" of a computer player: where to go, what it can see, when to launch, and how to play the pumpkin.
import { GADGETS, MOVE, OBJ } from './config.js';
import { losClear, lengthInside } from './collide.js';
import { angDiff, clamp, rand, pick, yawTo } from './util.js';
import { lobPitch } from './throwables.js';

export class Bot {
  constructor(game, actor) {
    this.g = game; this.a = actor;
    this.thinkT = Math.random() * 0.2;
    this.newRound(null);
  }

  newRound(plan) {
    this.plan = plan;
    this.state = 'travel'; // travel -> hold -> (seek) ; fight and hunt interrupt
    this.legs = plan ? plan.legs.slice() : [];
    this.path = null; this.pi = 0;
    this.target = null; this.seenT = 0; this.lastSeen = null;
    this.errYaw = 0; this.errPitch = 0; this.errT = 0;
    this.burst = 0; this.pauseT = 0; this.strafeT = 0; this.strafeDir = 0; this.standT = rand(0.4, 0.9);
    this.stuckT = 0; this.stuckX = 0; this.stuckZ = 0; this.jump = false;
    this.arrivedAt = 0; this.holdFor = rand(6, 10); this.rotateAt = 0; this.alertYaw = null; this.alertT = 0;
    this.hold = plan ? plan.hold : null;
    this.crouchHold = Math.random() < 0.35;
    this.sweep = rand(6.28);
    this.goal = null; this.repath = false; this.huntUntil = 0;
    this.guarding = false; // staying put on purpose (pumpkin planted, or on cork duty)
    this.corkDuty = false; this.fetching = false;
    this.toss = null; this.usedFlour = false; this.usedMud = false; this.usedRooster = false;
    if (this.a) this.a.wantUse = false;
  }

  // ---------- orders from the match ----------
  sendTo(spot, guard) {
    this.hold = spot; this.legs = [spot]; this.path = null; this.guarding = !!guard;
    if (this.state !== 'fight') this.state = 'travel';
  }
  fetch(x, z) { this.fetching = true; this.sendTo({ x, z, lx: x, lz: z - 5 }, false); }
  // carry the pumpkin to a site and plant it there
  carryTo(site) {
    const s = this.g.world.sites[site], spot = this.g.nav.nearestFree(s.x + rand(-1.6, 1.6), s.z + rand(-1.6, 1.6));
    this.fetching = false; this.plan.site = site;
    this.sendTo({ x: spot.x, z: spot.z, lx: s.x, lz: s.z + 8 }, true);
  }

  // ---------- seeing ----------
  canSee(e) {
    const a = this.a, dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d > 48) return false;
    if (d > 5 && Math.abs(angDiff(yawTo(dx, dz), a.yaw)) > 1.1) return false;
    const ey = a.pos.y + a.eyeY(), boxes = this.g.world.boxes;
    const hy = e.pos.y + (e.crouched ? 1.08 : 1.36), cy = e.pos.y + (e.crouched ? 0.5 : 0.75);
    if (!losClear(a.pos.x, ey, a.pos.z, e.pos.x, hy, e.pos.z, boxes) && !losClear(a.pos.x, ey, a.pos.z, e.pos.x, cy, e.pos.z, boxes)) return false;
    if (lengthInside(a.pos.x, ey, a.pos.z, e.pos.x, hy, e.pos.z, this.g.world.cornZones) > 3.5) return false;
    if (this.g.throwables.sightBlocked(a.pos.x, ey, a.pos.z, e.pos.x, hy, e.pos.z)) return false; // flour cloud in the way
    return true;
  }

  perceive() {
    const a = this.a;
    if (a.dazeT > 0.3) { this.target = null; return; } // dazzled by a rooster: sees nothing for a moment
    let best = null, bestD = 1e9;
    for (const e of this.g.actors) {
      if (!e.alive || e.team === a.team) continue;
      const d = Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z);
      if (d < bestD && this.canSee(e)) { best = e; bestD = d; }
    }
    if (best) {
      if (this.target !== best) {
        this.target = best; this.seenT = 0; this.errT = 0; this.g.onSpot(a, best);
        // a defender who sees someone coming may lob a mud balloon in their way
        if (a.throws.mud && !this.usedMud && (this.plan.role === 'defend' || this.g.mode === 'lts') && bestD > 8 && bestD < 19) { this.usedMud = true; this.toss = { id: 'mud', x: best.pos.x + best.vel.x * 0.8, z: best.pos.z + best.vel.z * 0.8 }; }
      }
      this.lastSeen = { x: best.pos.x, z: best.pos.z };
      this.g.report(a.team, best);
    } else this.target = null;
  }

  onHurt(from) {
    if (this.target) return;
    this.alertYaw = yawTo(from.pos.x - this.a.pos.x, from.pos.z - this.a.pos.z);
    this.alertT = 1.6;
  }

  // ---------- deciding ----------
  goTo(x, z) {
    const a = this.a;
    this.goal = { x, z };
    this.path = this.g.nav.findPath(a.pos.x, a.pos.z, x, z, 0.35);
    this.pi = 1;
    this.stuckT = 0; this.stuckX = a.pos.x; this.stuckZ = a.pos.z;
    return !!this.path;
  }

  decide() {
    const now = this.g.time, a = this.a, W = this.g.world, attack = this.plan.role === 'attack';
    const afterFight = () => (this.guarding || this.fetching || !attack ? 'return' : 'seek');
    if (this.target) { this.state = 'fight'; return; }
    if (this.repath) { this.repath = false; if (this.goal) { this.goTo(this.goal.x, this.goal.z); return; } }
    if (this.state === 'fight') {
      // lost sight: go and look where they were (unless there is a job to get back to)
      const urgent = this.corkDuty || this.fetching || this.g.pumpkin.carrier === a;
      if (urgent || !this.lastSeen || !this.goTo(this.lastSeen.x, this.lastSeen.z)) { this.state = afterFight(); this.path = null; }
      else {
        this.state = 'hunt'; this.huntUntil = now + rand(2.5, 4.5);
        // lost them round a corner: send in a rooster first
        const d = Math.hypot(this.lastSeen.x - a.pos.x, this.lastSeen.z - a.pos.z);
        if (a.throws.rooster && !this.usedRooster && d > 5 && d < 17 && Math.random() < 0.7) { this.usedRooster = true; this.toss = { id: 'rooster', x: this.lastSeen.x, z: this.lastSeen.z }; }
      }
      return;
    }
    if (this.state === 'hunt') {
      if (!this.path || this.pi >= this.path.length || now > this.huntUntil) { this.state = afterFight(); this.path = null; }
      return;
    }
    if (this.state === 'return') { this.state = 'travel'; this.legs = [this.hold]; this.path = null; return; }
    if (this.state === 'travel') {
      if (!this.path || this.pi >= this.path.length) {
        const next = this.legs.shift();
        if (next) { if (!this.goTo(next.x, next.z)) this.path = null; } else { this.state = 'hold'; this.arrivedAt = now; this.path = null; }
      }
      return;
    }
    if (this.state === 'hold') {
      // drifted away from the spot (pushed, or fought nearby)? walk back
      if (this.hold && Math.hypot(a.pos.x - this.hold.x, a.pos.z - this.hold.z) > 1.6 && (this.guarding || this.corkDuty)) { this.state = 'return'; return; }
      if (this.guarding || this.corkDuty) return;
      if (attack) {
        if (now - this.arrivedAt > this.holdFor) { this.state = 'seek'; this.path = null; }
      } else if (now - this.arrivedAt > 3 && now > this.rotateAt) {
        // defenders rotate when the other site is clearly under attack
        const other = this.g.busiestSite(a.team);
        if (other && other !== this.plan.site && Math.hypot(a.pos.x - W.points[other].x, a.pos.z - W.points[other].z) > 14) {
          this.plan.site = other; this.hold = pick(W.holds[other]);
          this.state = 'travel'; this.legs = [this.hold]; this.path = null; this.rotateAt = now + 12;
        }
      }
      return;
    }
    if (this.state === 'seek') {
      if (!this.path || this.pi >= this.path.length) {
        const tip = this.g.latestIntel(a.team);
        const goal = tip || W.points[pick(['A', 'B', 'YARD', 'MID', this.plan.enemyBase || (attack ? 'HANDS' : 'HERD')])];
        if (!this.goTo(goal.x + rand(-2, 2), goal.z + rand(-2, 2))) this.path = null;
      }
    }
  }

  // should this character be holding the "use" key right now (planting or corking)?
  wantsUse() {
    const a = this.a, P = this.g.pumpkin, t = this.target;
    if (P.carrier === a && P.state === 'carried') {
      const s = this.g.world.sites[this.g.siteAt(a.pos.x, a.pos.z)];
      return !!s && this.state === 'hold' && (!t || a.busy && P.progress > OBJ.plantTime * 0.5);
    }
    if (this.corkDuty && P.state === 'planted') {
      const near = Math.hypot(a.pos.x - P.x, a.pos.z - P.z) < OBJ.reach - 0.2;
      const need = a.kit ? OBJ.corkTimeKit : OBJ.corkTime;
      return near && (!t || (a.busy && P.progress > need * 0.55));
    }
    return false;
  }

  // ---------- acting ----------
  update(dt) {
    const a = this.a, g = this.g, D = g.diff;
    if (!a.alive) { a.wantUse = false; return; }
    if (g.state !== 'live') { a.wantUse = false; a.move(dt, 0, 0, false, false, false); return; }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.11 + Math.random() * 0.07; this.perceive(); this.decide(); }
    if (this.alertT > 0) this.alertT -= dt;
    a.wantUse = this.wantsUse();
    // throwing: attackers flour their way in; planned throws (mud, rooster) come from the thinking above
    if (!this.usedFlour && a.throws.flour && this.plan.role === 'attack' && this.state === 'travel' && this.hold && !this.target) {
      const d = Math.hypot(this.hold.x - a.pos.x, this.hold.z - a.pos.z);
      if (d > 9 && d < 17) { this.usedFlour = true; this.toss = { id: 'flour', x: a.pos.x + (this.hold.x - a.pos.x) * 0.62, z: a.pos.z + (this.hold.z - a.pos.z) * 0.62 }; }
    }
    if (this.toss && a.throwT <= 0 && !a.busy && a.dazeT <= 0) {
      const dx = this.toss.x - a.pos.x, dz = this.toss.z - a.pos.z;
      g.throwables.throwItem(a, this.toss.id, yawTo(dx, dz), lobPitch(Math.hypot(dx, dz)));
      this.toss = null;
    }

    let wx = 0, wz = 0, wantYaw = a.yaw, wantPitch = 0, crouch = false;
    const t = this.target;
    const gd = GADGETS[a.gadgetId];

    if (t && t.alive && !a.busy && a.dazeT <= 0.3) {
      this.seenT += dt;
      // aim, with a wobble that settles the longer the target stays in view
      this.errT -= dt;
      if (this.errT <= 0) {
        this.errT = rand(0.25, 0.5);
        const settle = Math.max(0.35, 1 - this.seenT * 0.45);
        this.errYaw = (Math.random() + Math.random() - 1) * D.aimErr * settle;
        this.errPitch = (Math.random() + Math.random() - 1) * D.aimErr * 0.6 * settle;
      }
      const dx0 = t.pos.x - a.pos.x, dz0 = t.pos.z - a.pos.z, dist = Math.hypot(dx0, dz0);
      const lead = dist / gd.speed;
      const dx = dx0 + t.vel.x * lead, dz = dz0 + t.vel.z * lead;
      const ty = t.pos.y + (t.crouched ? 0.7 : 0.95), ey = a.pos.y + a.eyeY();
      wantYaw = yawTo(dx, dz) + this.errYaw;
      wantPitch = Math.atan2(ty - ey, Math.hypot(dx, dz)) + this.errPitch;
      // footwork: mostly stand still to launch accurately, with short side-steps
      if (dist > 34 && this.plan.role === 'attack' && !gd.zoom) {
        const k = 1 / dist; wx = dx0 * k; wz = dz0 * k;
      } else if (this.strafeT > 0) {
        this.strafeT -= dt;
        const k = 1 / (dist || 1); wx = -dz0 * k * this.strafeDir; wz = dx0 * k * this.strafeDir;
        if (this.strafeT <= 0) this.standT = rand(0.5, 1.2) * (gd.zoom ? 2 : 1);
      } else {
        this.standT -= dt;
        if (this.standT <= 0) { this.strafeT = rand(0.22, 0.45); this.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      }
      const still = a.speed2d() < MOVE.walk + 0.6;
      a.scoped = !!gd.zoom && still;
      // launching
      const tight = gd.zoom ? 0.03 : 0.07;
      const aimed = Math.abs(angDiff(wantYaw, a.yaw)) < tight && Math.abs(wantPitch - a.pitch) < tight + 0.02;
      const steady = gd.zoom ? still : D.fireMoving || still;
      if (this.pauseT > 0) this.pauseT -= dt;
      else if (this.seenT > D.reaction + (gd.zoom ? 0.3 : 0) && aimed && steady) {
        if (this.burst <= 0) this.burst = gd.auto ? 3 + ((Math.random() * 5) | 0) : 1 + ((Math.random() * 3) | 0);
        if (a.cooldown <= 0 && g.combat.tryFire(a)) {
          this.burst--;
          if (!gd.auto) a.cooldown = Math.max(a.cooldown, rand(0.2, 0.34));
          if (this.burst <= 0) this.pauseT = rand(0.22, 0.55);
        }
      }
      // tank empty in a fight? fall back to the trusty squirter
      if (a.ammo <= 0 && a.gadgetId !== 'squirter' && dist < 14) a.setGadget('squirter');
    } else {
      if (!t || !t.alive) this.target = null;
      a.scoped = false;
      // follow the current path
      if (this.path && this.pi < this.path.length) {
        const p = this.path[this.pi];
        const dx = p.x - a.pos.x, dz = p.z - a.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.55) this.pi++;
        else { wx = dx / d; wz = dz / d; }
        const ahead = this.path[Math.min(this.path.length - 1, this.pi + 1)];
        wantYaw = yawTo(ahead.x - a.pos.x, ahead.z - a.pos.z);
        // stuck? hop, then pick a new way
        this.stuckT += dt;
        if (this.stuckT > 0.9) {
          if (Math.hypot(a.pos.x - this.stuckX, a.pos.z - this.stuckZ) < 0.5) { this.jump = true; this.repath = true; }
          this.stuckT = 0; this.stuckX = a.pos.x; this.stuckZ = a.pos.z;
        }
      } else if (this.state === 'hold' && this.hold) {
        this.sweep += dt * 0.9;
        wantYaw = yawTo(this.hold.lx - a.pos.x, this.hold.lz - a.pos.z) + Math.sin(this.sweep) * 0.45;
        crouch = this.crouchHold && !this.corkDuty;
      }
      if (this.alertT > 0 && this.alertYaw !== null) wantYaw = this.alertYaw;
      if (a.primary && a.gadgetId !== a.primary && a.tanks[a.primary] > 0) a.setGadget(a.primary);
      if (a.ammo < gd.tank * 0.45 && !a.busy) a.startReload();
    }

    // turn toward where we want to look (eases in so it does not snap)
    const dy = angDiff(wantYaw, a.yaw), turn = D.turn * dt * (0.3 + Math.min(1, Math.abs(dy) / 0.6));
    a.yaw += clamp(dy, -turn, turn);
    const dp = wantPitch - a.pitch;
    a.pitch += clamp(dp, -turn, turn);

    // keep a little personal space from the others
    for (const o of g.actors) {
      if (o === a || !o.alive) continue;
      const ox = a.pos.x - o.pos.x, oz = a.pos.z - o.pos.z, d2 = ox * ox + oz * oz;
      if (d2 < 1.0 && d2 > 1e-4) { const d = Math.sqrt(d2), push = (1 - d) * 0.9; wx += (ox / d) * push; wz += (oz / d) * push; }
    }
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    a.move(dt, wx, wz, this.jump, false, crouch);
    this.jump = false;
  }
}
