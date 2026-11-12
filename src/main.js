// Harvest Standoff: ties the farm, the characters, the rules and the screen together.
import { sphereGeo } from './gfx.js';
import { ROUND, TEAM, GADGETS, PRIMARIES, SHOP, THROWS, OBJ, ECON, DIFFICULTY, ROSTER, MOVE, MODES } from './config.js';
import { createThrowables } from './throwables.js';
import { buildWorld, MAPS } from './world.js';
import { buildNav } from './nav.js';
import { Actor } from './actor.js';
import { Bot } from './bot.js';
import { createCombat } from './combat.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createViewModel } from './viewmodel.js';
import { buildPumpkin, buildCharacter, buildGadget, animateCharacter, modelOptions } from './characters.js';
import { raycast, rayBox, raySphere } from './collide.js';
import { t as tl, applyI18n, setLang, onLangChange } from './i18n.js';
import { clamp, dirX, dirY, dirZ, yawTo, shuffle, pick, rand } from './util.js';

const T = window.THREE;
const $ = (id) => document.getElementById(id);
const other = (team) => (team === 'herd' ? 'hands' : 'herd');

function boot() {
  const canvas = $('view'), rootEl = $('game');
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    $('touch-note').hidden = false;
    $('touch-note').dataset.i18n = 'err.gfx'; applyI18n();
    $('play').disabled = true;
    return;
  }
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.autoClear = false;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(72, 1, 0.08, 700);
  camera.rotation.order = 'YXZ';

  const game = {
    scene, camera, renderer, actors: [], bots: [], player: null, viewActor: null,
    state: 'menu', paused: false, time: 0, roundT: ROUND.length, freezeT: 0, endT: 0, round: 0,
    score: { herd: 0, hands: 0 }, streak: { herd: 0, hands: 0 }, attackers: 'herd',
    diff: DIFFICULTY.easy, diffKey: 'easy', playerTeam: 'herd', shopOpen: false,
    viewYaw: 0, viewH: 600, intel: { herd: new Map(), hands: new Map() },
    pumpkin: { state: 'none', carrier: null, x: 0, z: 0, site: null, fuse: 0, progress: 0, actor: null },
  };
  game.mapId = 'farm'; game.mode = 'pumpkin'; game.revealed = false;
  try { const m = localStorage.getItem('hs-mode'); if (MODES[m]) game.mode = m; } catch (e) { /* default mode */ }
  const lts = () => game.mode === 'lts';
  try { const m = localStorage.getItem('hs-map'); if (MAPS[m]) game.mapId = m; } catch (e) { /* default map */ }
  game.world = buildWorld(scene, game.mapId);
  game.nav = buildNav(game.world);
  game.fx = createFx(scene);
  game.audio = createAudio(game);
  game.combat = createCombat(game);
  game.throwables = createThrowables(game);
  game.hud = createHud(game);
  const vm = createViewModel();
  const botOf = new Map();
  let W = game.world;
  const P = game.pumpkin, audio = game.audio, hud = game.hud;
  // swap to another map: clear away the old one and build the new one with its own paths for computer players
  function loadMap(id) {
    if (!MAPS[id] || id === game.mapId) return;
    game.world.dispose();
    game.fx.clearDecals(); game.combat.clear(); game.throwables.clear();
    game.mapId = id;
    game.world = buildWorld(scene, id);
    game.nav = buildNav(game.world);
    W = game.world;
    try { localStorage.setItem('hs-map', id); } catch (e) { /* not saved */ }
  }
  game.loadMap = loadMap;
  const roleOf = (team) => (team === game.attackers ? 'attack' : 'defend');
  const alive = (team) => game.actors.filter((a) => a.team === team && a.alive);
  const dist = (a, x, z) => Math.hypot(a.pos.x - x, a.pos.z - z);
  game.roleOf = roleOf;
  game.siteAt = (x, z) => { for (const k of ['A', 'B']) { const s = W.sites[k]; if (Math.hypot(x - s.x, z - s.z) < s.r) return k; } return null; };

  // the pumpkin itself, and the green cloud when it goes off
  const pumpkin = buildPumpkin();
  pumpkin.root.visible = false;
  scene.add(pumpkin.root);
  const puffs = [];
  function stinkCloud(x, z) {
    for (let i = 0; i < 16; i++) {
      const m = new T.Mesh(sphereGeo(), new T.MeshBasicMaterial({ color: i % 2 ? 0xb7f23a : 0x8fd94a, transparent: true, opacity: 0.6, depthWrite: false }));
      m.position.set(x + rand(-1, 1), 0.6 + rand(0, 1.2), z + rand(-1, 1));
      scene.add(m);
      puffs.push({ m, life: 0, max: rand(2.2, 3.6), vx: rand(-2.6, 2.6), vy: rand(0.4, 1.6), vz: rand(-2.6, 2.6), size: rand(1.2, 2.6) });
    }
    game.fx.burst(x, 0.8, z, 0xb7f23a, 30);
  }

  // ---------- what each team knows about the other ----------
  game.report = (team, enemy) => { game.intel[team].set(enemy, { x: enemy.pos.x, z: enemy.pos.z, t: game.time }); };
  game.latestIntel = (team) => {
    let best = null;
    game.intel[team].forEach((info, enemy) => { if (enemy.alive && game.time - info.t < 8 && (!best || info.t > best.t)) best = info; });
    return best;
  };
  game.busiestSite = (team) => {
    const need = alive(other(team)).length <= 2 ? 1 : 2;
    let bestSite = null, bestN = 0;
    for (const key of ['A', 'B']) {
      const s = W.points[key];
      let n = 0;
      game.intel[team].forEach((info, enemy) => { if (enemy.alive && game.time - info.t < 5 && Math.hypot(info.x - s.x, info.z - s.z) < 17) n++; });
      if (n >= need && n > bestN) { bestN = n; bestSite = key; }
    }
    return bestSite;
  };
  const spotT = { herd: -9, hands: -9 };
  game.onSpot = (a) => { if (game.time - spotT[a.team] > 7) { spotT[a.team] = game.time; audio.radio(a.team, ['spot_1', 'spot_2']); } };

  // ---------- the shop ----------
  game.shopItems = (a) => SHOP.map((it) => {
    const g = GADGETS[it.id];
    let state = 'ok';
    if (it.kind === 'gadget' ? a.primary === it.id : it.kind === 'throw' ? a.throws[it.id] > 0 : it.id === 'overalls' ? a.armor >= 100 : a.kit) state = 'own';
    else if (it.role && (lts() || it.role !== roleOf(a.team))) state = 'role';
    else if (a.coins < it.price) state = 'poor';
    const blurb = state !== 'role' ? tl(`shop.${it.id}.blurb`) : lts() ? tl('shop.roleLts') : tl('shop.roleDef');
    return { id: it.id, name: g ? tl(`g.${g.id}.name`) : tl(`shop.${it.id}.name`), icon: it.icon, price: it.price, blurb, state };
  });
  game.buy = (a, id) => {
    const it = game.shopItems(a).find((i) => i.id === id);
    if (!it || it.state !== 'ok' || (a.isPlayer && game.state !== 'freeze')) { if (a.isPlayer) audio.deny(); return false; }
    a.coins -= it.price;
    if (PRIMARIES.includes(id)) a.givePrimary(id); else if (THROWS[id]) a.throws[id] = 1; else if (id === 'overalls') a.armor = 100; else a.kit = true;
    if (a.isPlayer) { audio.buy(); hud.refreshShop(); }
    return true;
  };
  function botShop(a) {
    const c = a.coins;
    if (!a.primary) {
      if (c >= 4850 && Math.random() < 0.22) game.buy(a, 'pea');
      else if (c >= 2700) game.buy(a, 'tomato');
      else if (c >= 1200 && (c < 1900 || Math.random() < 0.6)) game.buy(a, 'egg');
    }
    if (a.armor < 60 && a.coins >= 650) game.buy(a, 'overalls');
    const everyone = lts(), role = roleOf(a.team);
    if (!everyone && role === 'defend' && !a.kit && a.coins >= 400 && Math.random() < 0.7) game.buy(a, 'kit');
    // spare coins go on something to throw
    if (a.primary || a.coins >= 1500) {
      if ((everyone || role === 'attack') && a.coins >= 300 && Math.random() < (everyone ? 0.4 : 0.55)) game.buy(a, 'flour');
      if (a.coins >= 200 && Math.random() < 0.45) game.buy(a, 'rooster');
      if ((everyone || role === 'defend') && a.coins >= 300 && Math.random() < (everyone ? 0.3 : 0.45)) game.buy(a, 'mud');
    }
  }

  // ---------- match and round flow ----------
  function startMatch(team, diffKey) {
    for (const a of game.actors) scene.remove(a.char.root);
    game.actors = []; game.bots = []; botOf.clear();
    game.playerTeam = team; game.diffKey = diffKey; game.diff = DIFFICULTY[diffKey];
    game.score = { herd: 0, hands: 0 }; game.streak = { herd: 0, hands: 0 }; game.round = 0; game.attackers = 'herd';
    for (const t of ['herd', 'hands']) {
      ROSTER[t].forEach((info, i) => {
        const isPlayer = t === team && i === 0;
        const a = new Actor(game, t, isPlayer ? { ...info, name: tl('hud.you') } : { ...info, name: tl('name.' + info.name) }, isPlayer);
        a.survived = false;
        game.actors.push(a);
        if (isPlayer) game.player = a;
        else { const b = new Bot(game, a); game.bots.push(b); botOf.set(a, b); }
        a.char.marker.visible = t === team && !isPlayer;
      });
    }
    if (team === 'herd') vm.setColors(0xfff3d6, 0xffffff); else vm.setColors(0xf2c9a0, 0xd9463e);
    game.fx.clearDecals(); hud.clearFeed();
    audio.stopMusic(); audio.rooster();
    startRound();
  }

  let mainSite = 'A', callT = -1;
  const PLACE = (k) => tl('place.' + k);
  // Last Team Standing: each team picks a part of the map to gather at, then goes hunting
  function planHunt() {
    const at = (x, z) => game.nav.nearestFree(x + rand(-1.1, 1.1), z + rand(-1.1, 1.1));
    for (const team of ['herd', 'hands']) {
      const south = roleOf(team) === 'attack';
      const main = pick(['A', 'B', 'MID']), rush = Math.random() < 0.5;
      if (team === game.playerTeam) mainSite = main;
      const used = { A: 0, B: 0, MID: 0 }, order = shuffle([0, 1, 2]);
      let i = 0;
      for (const b of game.bots) {
        const a = b.a;
        if (a.team !== team) continue;
        botShop(a);
        const site = Math.random() < 0.7 ? main : pick(['A', 'B', 'MID'].filter((k) => k !== main));
        const hold = W.holds[site][used[site]++ % W.holds[site].length];
        // the team starting in the south follows the lanes up; the team in the north is already close
        const route = south && W.routes[site] ? W.routes[site][order[i++ % 3]] : null;
        const legs = route ? route.slice(0, -1).map((n) => at(W.points[n].x, W.points[n].z)) : [];
        legs.push(hold);
        b.newRound({ role: 'attack', site, legs, hold, enemyBase: south ? 'HANDS' : 'HERD' });
        b.holdFor = rush ? rand(1, 4) : rand(7, 13);
      }
    }
  }
  function planRound() {
    if (lts()) { planHunt(); return; }
    const at = (x, z) => game.nav.nearestFree(x + rand(-1.1, 1.1), z + rand(-1.1, 1.1));
    mainSite = pick(['A', 'B']);
    const otherSite = mainSite === 'A' ? 'B' : 'A';
    const used = { A: 0, B: 0, MID: 0 };
    const routeOrder = { A: shuffle([0, 1, 2]), B: shuffle([0, 1, 2]) };
    let ai = 0, di = 0;
    const defendOrder = shuffle(['A', 'B', 'A', 'B', 'MID']);
    for (const b of game.bots) {
      const a = b.a;
      botShop(a);
      if (roleOf(a.team) === 'attack') {
        const carrier = P.carrier === a;
        const site = !carrier && Math.random() < 0.2 ? otherSite : mainSite;
        const route = W.routes[site][routeOrder[site][ai++ % 3]];
        const hold = W.holds[site][used[site]++ % W.holds[site].length];
        const legs = route.slice(0, -1).map((n) => at(W.points[n].x, W.points[n].z));
        b.newRound({ role: 'attack', site, legs, hold });
        if (carrier) { b.legs = legs; const keep = b.legs.slice(); b.carryTo(site); b.legs = keep.concat(b.legs); } else b.legs.push(hold);
      } else {
        const site = defendOrder[di++ % defendOrder.length];
        const hold = W.holds[site][used[site]++ % W.holds[site].length];
        b.newRound({ role: 'defend', site, legs: [hold], hold });
      }
    }
  }

  function startRound() {
    let half = false;
    if (game.round === ROUND.half) {
      // half-time: the teams swap jobs and everyone starts fresh
      half = true;
      game.attackers = other(game.attackers);
      game.streak = { herd: 0, hands: 0 };
      for (const a of game.actors) { a.coins = ECON.start; a.survived = false; }
    }
    game.round++;
    game.state = 'freeze'; game.freezeT = ROUND.freeze; game.roundT = ROUND.length;
    game.combat.clear(); game.throwables.clear();
    game.intel.herd.clear(); game.intel.hands.clear();
    for (const t of ['herd', 'hands']) {
      const slots = shuffle(W.spawns[roleOf(t)].slice());
      game.actors.filter((a) => a.team === t).forEach((a, i) => { a.reset(slots[i], a.survived); a.wantUse = false; });
    }
    // somebody on the attacking team starts with the pumpkin (there is none in Last Team Standing)
    Object.assign(P, { state: lts() ? 'none' : 'carried', carrier: lts() ? null : pick(alive(game.attackers)), site: null, fuse: 0, progress: 0, actor: null });
    pumpkin.glow.visible = false; game.revealed = false; revealT = 0;
    planRound();
    spectateIdx = 0; game.viewActor = game.player; game.shopOpen = true; hud.refreshShop();
    hud.spectate(null);
    const attacking = roleOf(game.playerTeam) === 'attack';
    const job = lts() ? tl('job.lts')
      : attacking ? (P.carrier === game.player ? tl('job.carrying') : tl('job.helpPlant')) : tl('job.defend');
    const point = Math.max(game.score.herd, game.score.hands) === ROUND.winTarget - 1;
    if (half) { hud.banner(tl('round.half'), tl(lts() ? 'round.halfEnds' : 'round.halfJobs', { job }), 5); audio.announce('ann_half'); }
    else hud.banner(game.round === 1 ? tl(`map.${game.mapId}.name`) : tl('round.n', { n: game.round }), job, 3.2);
    if (game.round === 1 && lts()) audio.announce('ann_lts');
    if (point) audio.announce('ann_match_point');
    callT = -1;
  }

  // winner is a team, or null when the round is a draw (nobody scores)
  function endRound(winner, why) {
    let consolation = ECON.lose[0];
    if (winner) {
      const loser = other(winner);
      game.score[winner]++;
      game.streak[winner] = 0; game.streak[loser]++;
      consolation = ECON.lose[Math.min(ECON.lose.length - 1, game.streak[loser] - 1)];
    }
    for (const a of game.actors) { a.earn(a.team === winner ? ECON.win : consolation); a.survived = a.alive; a.busy = false; a.wantUse = false; a.scoped = false; }
    game.state = 'roundEnd'; game.endT = ROUND.endDelay;
    P.actor = null;
    const won = winner === game.playerTeam;
    hud.banner(!winner ? tl('round.drawn') : won ? tl('round.won') : tl('round.lost'), why, ROUND.endDelay);
    audio.stopMusic(0.3);
    if (!winner) { audio.bell(); audio.announce('ann_draw'); return; }
    if (won) audio.win(); else audio.lose();
    audio.announce(winner === 'herd' ? 'ann_herd_win' : 'ann_hands_win');
  }

  function finishMatch() {
    game.state = 'matchEnd';
    const winner = game.score.herd > game.score.hands ? 'herd' : 'hands';
    const won = winner === game.playerTeam;
    $('end-title').textContent = won ? tl('end.won') : tl('end.teamWon', { team: tl(`team.${winner}.name`) });
    $('end-sub').textContent = tl('end.sub', { herd: game.score.herd, hands: game.score.hands, msg: tl(won ? 'end.msgWon' : 'end.msgLost') });
    $('end').hidden = false;
    hud.hideBanner();
    audio.music(won ? 'music_victory' : 'music_defeat', false, 1);
    audio.announce(won ? 'ann_victory' : 'ann_defeat');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function toMenu() {
    game.state = 'menu'; game.paused = false;
    for (const a of game.actors) scene.remove(a.char.root);
    game.actors = []; game.bots = []; game.player = null; game.viewActor = null;
    game.combat.clear(); game.throwables.clear();
    P.state = 'none'; P.carrier = null; pumpkin.root.visible = false;
    $('end').hidden = true; $('pause').hidden = true; $('menu').hidden = false;
    hud.show(false);
    audio.init(); audio.music('music_menu', true, 0.8);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  game.onPlayerFire = () => vm.fire();
  game.onHit = (attacker, victim, head, out) => {
    if (attacker.isPlayer) { hud.hitMarker(head); audio.hitConfirm(head); }
    if (victim.isPlayer) { hud.hurt(attacker); audio.hurt(); }
    const vb = botOf.get(victim);
    if (vb) vb.onHurt(attacker);
    game.report(victim.team, attacker);
    if (out) {
      attacker.earn(ECON.splat); attacker.splats++;
      hud.feed(attacker, victim, head); audio.out(victim);
      if (attacker.isPlayer) { const mate = alive(attacker.team).find((m) => m !== attacker && dist(m, attacker.pos.x, attacker.pos.z) < 20); if (mate) audio.shout(mate, 'nice', 0.5); }
    } else audio.shout(victim, 'hurt_' + (1 + ((Math.random() * 2) | 0)), victim.isPlayer ? 0.2 : 0.3);
  };

  // ---------- the Stink-Pumpkin ----------
  let dutyT = 0, tickT = 0, tickN = 0, squeakT = 0, revealT = 0;
  function stopUse() { if (P.actor) { P.actor.busy = false; P.actor = null; } P.progress = 0; }
  function pickUp(a) {
    P.state = 'carried'; P.carrier = a;
    audio.radio(a.team, 'got_it');
    const b = botOf.get(a);
    if (b) b.carryTo(nearestSite(a)); else hud.tip(tl('tip.pickup'), 4);
    for (const o of game.bots) o.fetching = o === b ? false : o.fetching && false;
  }
  const nearestSite = (a) => (dist(a, W.sites.A.x, W.sites.A.z) < dist(a, W.sites.B.x, W.sites.B.z) ? 'A' : 'B');
  function plant(c, site) {
    stopUse();
    Object.assign(P, { state: 'planted', carrier: null, x: c.pos.x, z: c.pos.z, site, fuse: OBJ.fuse });
    c.earn(ECON.plant);
    tickT = 0; tickN = 0; dutyT = 0;
    audio.thud(P.x, P.z); audio.announce('ann_planted'); audio.music('music_fuse', true, 0.55);
    const att = game.attackers, def = other(att), mine = att === game.playerTeam;
    hud.banner(tl('banner.planted', { site }), mine ? tl('banner.guard', { n: OBJ.fuse }) : tl('banner.cork'), 3.5);
    audio.radio(att, 'guard');
    if (def === 'hands') audio.radio(def, site === 'A' ? 'planted_a' : 'planted_b');
    // attackers dig in around it; defenders come to take it back
    let i = 0, j = 0;
    for (const b of game.bots) {
      if (!b.a.alive) continue;
      if (b.a.team === att) b.sendTo(W.holds[site][i++ % W.holds[site].length], true);
      else { const ang = rand(6.28), r = 2.4 + (j++ % 3) * 1.1, s = game.nav.nearestFree(P.x + Math.cos(ang) * r, P.z + Math.sin(ang) * r); b.sendTo({ x: s.x, z: s.z, lx: P.x, lz: P.z }, true); }
    }
  }
  function updatePumpkin(dt) {
    const att = game.attackers, def = other(att);
    if (P.state === 'carried') {
      const c = P.carrier;
      if (!c.alive) {
        stopUse();
        const spot = game.nav.nearestFree(c.pos.x, c.pos.z);
        Object.assign(P, { state: 'dropped', carrier: null, x: spot.x, z: spot.z });
        hud.note(tl('note.dropped'));
        audio.thud(P.x, P.z);
        dutyT = 0;
      } else {
        const site = game.siteAt(c.pos.x, c.pos.z);
        if (c.wantUse && site && c.onGround) {
          if (P.actor !== c) { P.actor = c; P.progress = 0; c.busy = true; audio.radio(att, 'planting'); }
          P.progress += dt;
          if (P.progress >= OBJ.plantTime) plant(c, site);
        } else if (P.actor) stopUse();
      }
    } else if (P.state === 'dropped') {
      for (const a of alive(att)) if (dist(a, P.x, P.z) < 1.3) { pickUp(a); return; }
      dutyT -= dt;
      if (dutyT <= 0) {
        dutyT = 1;
        // make sure one computer player is on its way to fetch it
        const bots = game.bots.filter((b) => b.a.alive && b.a.team === att);
        if (bots.length && !bots.some((b) => b.fetching)) { bots.sort((x, y) => dist(x.a, P.x, P.z) - dist(y.a, P.x, P.z)); bots[0].fetch(P.x, P.z); audio.radio(att, 'dropped'); }
      }
    } else if (P.state === 'planted') {
      P.fuse -= dt;
      // tick faster and faster
      tickT -= dt;
      if (tickT <= 0) { tickT = 0.14 + 0.86 * clamp(P.fuse / OBJ.fuse, 0, 1); audio.fuseTick(P.x, P.z, tickN++); }
      // corking: whoever is next to it and holding "use"
      const can = (a) => a && a.alive && a.wantUse && a.team === def && dist(a, P.x, P.z) < OBJ.reach;
      if (!can(P.actor)) {
        stopUse();
        const next = game.actors.find(can);
        if (next) { P.actor = next; next.busy = true; squeakT = 0; audio.radio(def, 'corking'); }
      }
      if (P.actor) {
        P.progress += dt;
        squeakT -= dt;
        if (squeakT <= 0) { squeakT = 1.15; audio.squeak(P.x, P.z); }
        if (P.progress >= (P.actor.kit ? OBJ.corkTimeKit : OBJ.corkTime)) {
          const hero = P.actor;
          stopUse(); hero.earn(ECON.cork);
          P.state = 'corked';
          audio.corkPop(P.x, P.z); audio.announce('ann_corked');
          endRound(def, hero.isPlayer ? tl('why.corkedYou') : tl('why.corked', { name: hero.name }));
          return;
        }
      }
      if (P.fuse <= 0) {
        stopUse();
        P.state = 'burst';
        stinkCloud(P.x, P.z); audio.stink(P.x, P.z); audio.announce('ann_stink');
        endRound(att, tl('why.burst'));
        return;
      }
      dutyT -= dt;
      if (dutyT <= 0) {
        dutyT = 0.8;
        // one computer defender gets the job of corking
        const bots = game.bots.filter((b) => b.a.alive && b.a.team === def);
        if (bots.length && !bots.some((b) => b.corkDuty)) {
          bots.sort((x, y) => dist(x.a, P.x, P.z) - dist(y.a, P.x, P.z));
          bots[0].corkDuty = true; bots[0].sendTo({ x: P.x + 0.7, z: P.z + 0.5, lx: P.x, lz: P.z }, true);
        }
      }
    }
  }
  function drawPumpkin(dt) {
    const p = game.player, root = pumpkin.root;
    if (P.state === 'carried' && P.carrier) {
      const c = P.carrier;
      root.visible = c.alive && !(c === p && p.alive);
      root.position.set(c.pos.x - dirX(c.yaw) * 0.42, c.pos.y + 0.62 - (c.crouched || c.busy ? 0.3 : 0), c.pos.z - dirZ(c.yaw) * 0.42);
      root.rotation.y = c.yaw + Math.PI; root.scale.setScalar(0.62);
      pumpkin.glow.visible = false;
    } else if (P.state === 'dropped' || P.state === 'planted' || P.state === 'corked') {
      root.visible = true;
      root.position.set(P.x, P.state === 'dropped' ? 0.06 + Math.abs(Math.sin(game.time * 3)) * 0.12 : 0, P.z);
      root.scale.setScalar(1);
      if (P.state === 'dropped') root.rotation.y += dt * 1.5;
      const hot = P.state === 'planted';
      pumpkin.glow.visible = hot;
      if (hot) { const k = 0.5 + 0.5 * Math.sin(game.time * (4 + 14 * (1 - P.fuse / OBJ.fuse))); pumpkin.glow.scale.setScalar(0.55 + k * 0.25); pumpkin.body.scale.setScalar(1 + k * 0.05); } else pumpkin.body.scale.setScalar(1);
    } else root.visible = false;
    for (let i = puffs.length - 1; i >= 0; i--) {
      const f = puffs[i]; f.life += dt;
      const k = f.life / f.max;
      if (k >= 1) { scene.remove(f.m); puffs.splice(i, 1); continue; }
      f.m.position.x += f.vx * dt * (1 - k); f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt * (1 - k);
      f.m.scale.setScalar(f.size * (0.4 + k * 1.4)); f.m.material.opacity = 0.6 * (1 - k);
    }
  }

  // ---------- input ----------
  const keys = {};
  let mdx = 0, mdy = 0, mouseDown = false, fireEdge = false, locked = false, everLocked = false, noLock = false;
  let sens = 1, spectateIdx = 0, eyeY = MOVE.eye, fov = 72, shoulder = false, selfHidden = false;
  try { shoulder = localStorage.getItem('hs-view') === 'shoulder'; } catch (e) { /* default view */ }
  const shoulderNow = () => shoulder && game.player && game.player.alive && !game.player.scoped;
  const hitBox = { x1: 0, y1: 0, z1: 0, x2: 0, y2: 0, z2: 0 };
  try { const s = parseFloat(localStorage.getItem('hs-sens')); if (s > 0) sens = s; const v = parseFloat(localStorage.getItem('hs-vol')); if (v >= 0) { $('vol').value = v; } } catch (e) { /* no saved settings */ }
  $('sens').value = sens;

  const playing = () => game.state === 'freeze' || game.state === 'live' || game.state === 'roundEnd';
  function lockFailed() {
    if (locked) return;
    if (everLocked) { if (playing()) pause(); return; }
    noLock = true;
    hud.tip(tl('tip.look'), 7);
  }
  function lock() {
    if (noLock || locked) return;
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(lockFailed); } catch (e) { lockFailed(); }
  }
  function pause() {
    if (!playing() || game.paused) return;
    game.paused = true; $('pause').hidden = false;
    for (const k in keys) keys[k] = false;
    mouseDown = false;
  }
  function resume() {
    game.paused = false; $('pause').hidden = true;
    lock();
  }
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (locked) everLocked = true;
    else if (playing() && !noLock) pause();
  });
  document.addEventListener('pointerlockerror', lockFailed);
  document.addEventListener('mousemove', (e) => { if ((locked || noLock) && playing() && !game.paused) { mdx += e.movementX || 0; mdy += e.movementY || 0; } });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  function toggleZoom() {
    const p = game.player;
    if (p && p.alive && GADGETS[p.gadgetId].zoom && p.reloadT <= 0 && game.state === 'live') { p.scoped = !p.scoped; audio.ui(); }
  }
  canvas.addEventListener('mousedown', (e) => {
    if (!playing() || game.paused) return;
    audio.init();
    if (e.button === 2) { toggleZoom(); return; }
    if (e.button !== 0) return;
    if (!locked && !noLock) { lock(); return; }
    mouseDown = true; fireEdge = true;
    if (game.player && !game.player.alive) spectateIdx++;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });
  window.addEventListener('keydown', (e) => {
    if (!playing()) return;
    if (e.code === 'Escape' && noLock) { if (game.paused) resume(); else pause(); return; }
    if (game.paused) return;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || (e.code.startsWith('Digit') && !e.ctrlKey && !e.metaKey)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    const p = game.player;
    if (!p || !p.alive) return;
    const digit = e.code.startsWith('Digit') ? +e.code.slice(5) : 0;
    if (e.code === 'KeyB' && game.state === 'freeze') { game.shopOpen = !game.shopOpen; audio.ui(); return; }
    if (game.shopOpen && game.state === 'freeze' && digit >= 1 && digit <= SHOP.length) { game.buy(p, SHOP[digit - 1].id); return; }
    let want = null;
    if (digit === 1) want = p.primary; else if (digit === 2) want = 'squirter'; else if (e.code === 'KeyQ') want = p.has(p.lastGadget) ? p.lastGadget : 'squirter';
    if (want && p.setGadget(want)) audio.ui();
    const lob = { 3: 'flour', 4: 'rooster', 5: 'mud' }[digit];
    if (lob && !game.throwables.throwItem(p, lob, p.yaw, p.pitch + 0.06) && game.state === 'live' && !p.throws[lob]) audio.deny();
    if (e.code === 'KeyR') p.startReload();
    if (e.code === 'KeyF') fireEdge = true;
    if (e.code === 'KeyZ') toggleZoom();
    if (e.code === 'KeyV') {
      shoulder = !shoulder; audio.ui();
      try { localStorage.setItem('hs-view', shoulder ? 'shoulder' : 'eyes'); } catch (err) { /* not saved */ }
      hud.tip(tl(shoulder ? 'tip.shoulder' : 'tip.eyes'), 3.5);
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  function updatePlayer(dt) {
    const p = game.player;
    const k = 0.0021 * sens * (fov / 72);
    p.yaw -= mdx * k; p.pitch = clamp(p.pitch - mdy * k, -1.45, 1.45);
    mdx = 0; mdy = 0;
    p.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 2.4 * dt * (fov / 72);
    p.pitch = clamp(p.pitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 1.6 * dt * (fov / 72), -1.45, 1.45);
    if (!p.alive) { fireEdge = false; p.wantUse = false; return; }
    p.wantUse = !!keys.KeyE && game.state === 'live';
    if (game.state === 'live') {
      const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      let wx = dirX(p.yaw) * f + Math.cos(p.yaw) * s, wz = dirZ(p.yaw) * f - Math.sin(p.yaw) * s;
      const l = Math.hypot(wx, wz);
      if (l > 1) { wx /= l; wz /= l; }
      p.move(dt, wx, wz, !!keys.Space, !!(keys.ShiftLeft || keys.ShiftRight), !!keys.KeyC);
      const g = GADGETS[p.gadgetId];
      if ((g.auto ? mouseDown || keys.KeyF : fireEdge)) game.combat.tryFire(p);
    } else p.move(dt, 0, 0, false, false, false);
    fireEdge = false;
  }

  // ---------- camera ----------
  function updateCamera(dt) {
    const p = game.player;
    const wantFov = p && p.alive && p.scoped ? 22 : 72;
    if (Math.abs(fov - wantFov) > 0.05) { fov += (wantFov - fov) * Math.min(1, dt * 16); camera.fov = fov; camera.updateProjectionMatrix(); }
    if (game.camFixed) { camera.position.set(...game.camFixed.pos); camera.lookAt(...game.camFixed.look); return; }
    if (game.state === 'menu' || !p) {
      const a = game.time * 0.07;
      camera.position.set(Math.sin(a) * 50, 24, -4 + Math.cos(a) * 50);
      camera.lookAt(0, 1, -5);
      game.viewYaw = 0;
      return;
    }
    if (p.alive) {
      eyeY += ((p.busy ? MOVE.eyeCrouch : p.eyeY()) - eyeY) * Math.min(1, dt * 14);
      game.viewYaw = p.yaw; game.viewActor = p;
      const pitch = p.pitch + p.recoil;
      if (!shoulderNow()) {
        camera.position.set(p.pos.x, p.pos.y + eyeY, p.pos.z);
        camera.rotation.set(pitch, p.yaw, 0);
        p.aim = null; selfHidden = true;
        return;
      }
      // ---- over the shoulder: the camera sits behind and to the right, pulled in when a wall is in the way ----
      const fx = dirX(p.yaw, pitch), fy = dirY(pitch), fz = dirZ(p.yaw, pitch), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const ex = p.pos.x, ey = p.pos.y + eyeY, ez = p.pos.z;
      let side = 0.58;
      const sideHit = raycast(ex, ey, ez, rx, 0, rz, side + 0.3, W.boxes);
      if (sideHit) side = Math.max(0, sideHit.t - 0.3);
      const px = ex + rx * side, py = ey + 0.3, pz = ez + rz * side;
      let back = 3.1;
      const backHit = raycast(px, py, pz, -fx, -fy, -fz, back + 0.25, W.boxes);
      if (backHit) back = Math.max(0.25, backHit.t - 0.25);
      camera.position.set(px - fx * back, py - fy * back, pz - fz * back);
      camera.rotation.set(pitch, p.yaw, 0);
      selfHidden = back < 0.95; // too close to see past yourself: hide the body
      // what is under the crosshair? launch at that
      let reach = 150;
      const sx = px + fx * 0.4, sy = py + fy * 0.4, sz = pz + fz * 0.4;
      const wall = raycast(sx, sy, sz, fx, fy, fz, reach, W.boxes);
      if (wall) reach = wall.t;
      for (const v of game.actors) {
        if (!v.alive || v.team === p.team) continue;
        let t = raySphere(sx, sy, sz, fx, fy, fz, v.pos.x, v.pos.y + (v.crouched ? 1.08 : 1.36), v.pos.z, 0.36);
        if (t >= 0 && t < reach) reach = t;
        hitBox.x1 = v.pos.x - 0.38; hitBox.x2 = v.pos.x + 0.38; hitBox.z1 = v.pos.z - 0.38; hitBox.z2 = v.pos.z + 0.38; hitBox.y1 = v.pos.y; hitBox.y2 = v.pos.y + (v.crouched ? 0.86 : 1.12);
        t = rayBox(sx, sy, sz, fx, fy, fz, hitBox);
        if (t >= 0 && t < reach) reach = t;
      }
      const tx = sx + fx * reach - ex, ty = sy + fy * reach - ey, tz = sz + fz * reach - ez;
      if (!p.aim) p.aim = { yaw: 0, pitch: 0 };
      if (Math.hypot(tx, tz) > 1.2) { p.aim.yaw = yawTo(tx, tz); p.aim.pitch = Math.atan2(ty, Math.hypot(tx, tz)); } else { p.aim.yaw = p.yaw; p.aim.pitch = pitch; }
      return;
    }
    p.aim = null;
    // splatted out: watch yourself flop, then follow a teammate from behind
    let target = p;
    if (p.outT > 1.5) {
      const mates = alive(p.team);
      const others = mates.length ? mates : game.actors.filter((a) => a.alive);
      if (others.length) target = others[spectateIdx % others.length];
      hud.spectate(target === p ? tl('spec.out') : tl('spec.watch', { name: target.name }));
    }
    game.viewActor = target; game.viewYaw = target.yaw;
    const fx = dirX(target.yaw), fz = dirZ(target.yaw);
    const hx = target.pos.x, hy = target.pos.y + 1.7, hz = target.pos.z;
    let d = 3.6;
    const hit = raycast(hx, hy, hz, -fx * 0.94, 0.33, -fz * 0.94, d, W.boxes);
    if (hit) d = Math.max(0.6, hit.t - 0.25);
    const k = Math.min(1, dt * 10);
    camera.position.x += (hx - fx * 0.94 * d - camera.position.x) * k;
    camera.position.y += (hy + 0.33 * d - camera.position.y) * k;
    camera.position.z += (hz - fz * 0.94 * d - camera.position.z) * k;
    camera.lookAt(hx + fx * 3, hy - 0.2, hz + fz * 3);
  }

  // ---------- one step of the game ----------
  function update(dt) {
    game.time += dt;
    for (const f of W.animated) f(game.time, dt);
    if (playing()) {
      if (game.state === 'freeze') {
        game.freezeT -= dt;
        if (game.freezeT <= 3 && Math.ceil(game.freezeT) !== Math.ceil(game.freezeT + dt) && game.freezeT > 0) audio.countdown();
        if (game.freezeT <= 0) {
          game.state = 'live'; game.shopOpen = false;
          audio.bell(); audio.radio(game.playerTeam, ['go_1', 'go_2']);
          hud.banner(tl('round.go'), '', 0.9);
          callT = game.time + 2.2;
        }
      } else if (game.state === 'live') {
        const before = game.roundT;
        if (P.state !== 'planted') game.roundT -= dt;
        if (before > 10 && game.roundT <= 10 && P.state !== 'planted') audio.announce('ann_ten');
        // a teammate calls out where the team is heading
        if (callT > 0 && game.time > callT) {
          callT = -1;
          if (lts() || roleOf(game.playerTeam) === 'attack') { if (mainSite !== 'MID') audio.radio(game.playerTeam, mainSite === 'A' ? 'to_a' : 'to_b'); hud.note(tl('note.heading', { place: PLACE(mainSite) })); }
        }
        // Last Team Standing: near the end nobody can hide, so the round always finishes with a chase
        if (lts() && game.roundT <= ROUND.reveal) {
          if (!game.revealed) { game.revealed = true; audio.announce('ann_reveal'); hud.banner(tl('reveal.t'), tl('reveal.d'), 3); }
          revealT -= dt;
          if (revealT <= 0) { revealT = 0.5; for (const a of game.actors) if (a.alive) game.report(other(a.team), a); }
        }
      }
      updatePlayer(dt);
      for (const b of game.bots) b.update(dt);
      for (const a of game.actors) a.tick(dt);
      game.combat.update(dt);
      game.throwables.update(dt);
      if (game.state === 'live' && !lts()) updatePumpkin(dt);
      if (game.state === 'live' && lts()) {
        const herd = alive('herd'), hands = alive('hands'), names = { herd: tl('team.herd.name'), hands: tl('team.hands.name') };
        const clean = (list) => list.reduce((n, a) => n + a.hp, 0);
        if (!herd.length && !hands.length) endRound(null, tl('why.bothOut'));
        else if (!hands.length) endRound('herd', tl('why.allHands', { team: names.herd }));
        else if (!herd.length) endRound('hands', tl('why.allHerd', { team: names.hands }));
        else if (game.roundT <= 0) {
          audio.announce('ann_time');
          // time is up: more players left wins, then whoever is cleaner
          const w = herd.length !== hands.length ? (herd.length > hands.length ? 'herd' : 'hands') : Math.abs(clean(herd) - clean(hands)) < 1 ? null : clean(herd) > clean(hands) ? 'herd' : 'hands';
          if (!w) endRound(null, tl('why.timeDraw'));
          else endRound(w, tl(herd.length !== hands.length ? 'why.timeMore' : 'why.timeClean', { team: names[w] }));
        }
      } else if (game.state === 'live') {
        const att = game.attackers, def = other(att), nAtt = alive(att).length, nDef = alive(def).length;
        const names = { herd: tl('team.herd.name'), hands: tl('team.hands.name') };
        if (nDef === 0 && nAtt > 0) endRound(att, P.state === 'planted' ? tl('why.noCorker') : tl('why.defOut', { team: names[att] }));
        else if (P.state !== 'planted') {
          if (nAtt === 0) endRound(def, tl('why.attOut', { team: names[def] }));
          else if (game.roundT <= 0) { audio.announce('ann_time'); endRound(def, tl('why.noPlant')); }
        }
      } else if (game.state === 'roundEnd') {
        game.endT -= dt;
        if (game.endT <= 0) {
          if (game.score.herd >= ROUND.winTarget || game.score.hands >= ROUND.winTarget) finishMatch(); else startRound();
        }
      }
      for (const a of game.actors) a.updateModel(dt, a === game.player && a.alive && selfHidden);
      if (game.player && game.player.alive) vm.update(dt, game.player);
      audio.ambient(dt);
    }
    drawPumpkin(dt);
    game.fx.update(dt);
    updateCamera(dt);
    const pv = game.player;
    game.veil = pv && playing() ? Math.max(pv.alive ? Math.min(1, pv.dazeT / 1.1) : 0, game.throwables.fogAt(camera.position.x, camera.position.y, camera.position.z) * 0.93) : 0;
    hud.update(dt);
  }

  function render() {
    renderer.clear();
    renderer.render(scene, camera);
    const p = game.player;
    if (playing() && p && p.alive && !p.scoped && !shoulderNow()) { renderer.clearDepth(); renderer.render(vm.scene, vm.cam); }
  }

  function resize() {
    const w = Math.max(1, rootEl.clientWidth), h = Math.max(1, rootEl.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    vm.resize(w / h);
    game.viewH = h;
  }

  // ---------- menu ----------
  let pickTeam = 'herd', pickDiff = 'easy', welcomed = false;
  function showMode() {
    const m = MODES[game.mode];
    document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === game.mode)));
    $('job-herd').textContent = tl(`job.${game.mode}.herd`); $('job-hands').textContent = tl(`job.${game.mode}.hands`);
    for (let i = 0; i < 3; i++) { const li = $('how-' + i); li.textContent = ''; const b = document.createElement('b'); b.textContent = tl(`how.${game.mode}.${i}.t`); li.append(b, tl(`how.${game.mode}.${i}.d`)); }
    $('key-use').hidden = game.mode === 'lts';
  }
  function setMode(id) {
    if (!MODES[id]) return;
    game.mode = id;
    try { localStorage.setItem('hs-mode', id); } catch (e) { /* not saved */ }
    showMode();
  }
  document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => { setMode(b.dataset.mode); audio.ui(); }));
  showMode();
  const choose = (group, attr, value) => document.querySelectorAll(group).forEach((b) => b.setAttribute('aria-checked', String(b.dataset[attr] === value)));
  document.querySelectorAll('.side').forEach((b) => b.addEventListener('click', () => { pickTeam = b.dataset.team; choose('.side', 'team', pickTeam); audio.ui(); }));
  document.querySelectorAll('#levels button').forEach((b) => b.addEventListener('click', () => { pickDiff = b.dataset.diff; choose('#levels button', 'diff', pickDiff); audio.ui(); }));
  document.querySelectorAll('#maps button').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.map === game.mapId));
    b.addEventListener('click', () => { loadMap(b.dataset.map); choose('#maps button', 'map', game.mapId); $('map-blurb').textContent = tl(`map.${game.mapId}.blurb`); audio.ui(); });
  });
  $('map-blurb').textContent = tl(`map.${game.mapId}.blurb`);
  // language switch: the choice is saved by setLang()
  applyI18n();
  document.querySelectorAll('#langs button').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang); audio.ui(); }));
  onLangChange(() => { showMode(); $('map-blurb').textContent = tl(`map.${game.mapId}.blurb`); hud.refreshShop(); });
  // sound can only start after the first click anywhere
  document.addEventListener('pointerdown', () => {
    audio.init();
    if (game.state === 'menu') { audio.music('music_menu', true, 0.8); if (!welcomed) { welcomed = true; audio.announce('ann_welcome'); } }
  });
  function begin() {
    audio.init();
    $('menu').hidden = true; $('end').hidden = true;
    hud.show(true);
    startMatch(pickTeam, pickDiff);
    lock();
  }
  $('play').addEventListener('click', begin);
  $('again').addEventListener('click', begin);
  $('to-menu').addEventListener('click', toMenu);
  $('resume').addEventListener('click', resume);
  $('quit').addEventListener('click', toMenu);
  $('sens').addEventListener('input', (e) => { sens = parseFloat(e.target.value) || 1; try { localStorage.setItem('hs-sens', String(sens)); } catch (err) { /* not saved */ } });
  $('vol').addEventListener('input', (e) => { const v = parseFloat(e.target.value); audio.setVolume(v); try { localStorage.setItem('hs-vol', String(v)); } catch (err) { /* not saved */ } });
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches) $('touch-note').hidden = false;

  window.addEventListener('resize', resize);
  resize();
  audio.boot();
  audio.setVolume(parseFloat($('vol').value));

  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!game.paused && game.state !== 'matchEnd') update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // handy for automated checks: run the game forward without waiting for real time
  game.simulate = (seconds, step = 1 / 60) => { for (let t = 0; t < seconds; t += step) update(step); };
  game.begin = (team, diff, map, mode) => { if (map) loadMap(map); if (mode) setMode(mode); pickTeam = team; pickDiff = diff; begin(); };
  game.setShoulder = (on) => { shoulder = on; };
  game.input = { keys, look: (dx, dy) => { mdx += dx; mdy += dy; }, fire: (down) => { mouseDown = down; fireEdge = down; }, noLock: () => { noLock = true; } };
  game.botOf = botOf;
  // old hand-built version (left) next to the sculpted model (right), for comparing
  game.compare = (kind, look) => {
    const pair = [false, true].map((on, i) => {
      modelOptions.enabled = on;
      const c = buildCharacter(kind, look);
      c.mount.add(buildGadget('tomato'));
      c.root.position.set(i ? 0.75 : -0.75, 0, 20); c.root.rotation.y = Math.PI;
      scene.add(c.root);
      return c;
    });
    modelOptions.enabled = true;
    game.camFixed = { pos: [0, 1.2, 22.75], look: [0, 0.92, 20] };
    game.comparePose = (speed, pitch, crouch, turn = 0, alive = true) => pair.forEach((c) => { c.root.rotation.y = Math.PI + turn; for (let k = 0; k < 10; k++) animateCharacter(c, 0.05, speed, pitch, crouch, alive); });
    game.comparePose(0, 0, false);
  };
  // stands all ten characters in a row so their looks can be checked
  game.lineup = (pose = {}) => {
    const kinds = [...ROSTER.herd, ...ROSTER.hands], made = [];
    kinds.forEach((info, i) => {
      const c = buildCharacter(info.kind, info.look), gd = buildGadget(['squirter', 'egg', 'tomato', 'pea'][i % 4]);
      c.mount.add(gd);
      c.root.position.set((i - 4.5) * 1.15, 0, 20); c.root.rotation.y = Math.PI + (pose.turn || 0);
      animateCharacter(c, 0.016, pose.speed || 0, pose.pitch || 0, !!pose.crouch, true);
      if (pose.speed) for (let k = 0; k < 8; k++) animateCharacter(c, 0.05, pose.speed, 0, false, true);
      scene.add(c.root); made.push(c);
    });
    game.camFixed = { pos: pose.cam || [0, 1.25, 26.6], look: [0, 0.95, 20] };
    game.lineupPose = (speed = 0, pitch = 0, crouch = false, turn = 0) => made.forEach((c) => { c.root.rotation.y = Math.PI + turn; for (let k = 0; k < 10; k++) animateCharacter(c, 0.05, speed, pitch, crouch, true); });
    return made.length;
  };
  window.__hs = game;
}

if (window.THREE) boot();
else {
  const n = document.getElementById('touch-note');
  if (n) { n.hidden = false; n.dataset.i18n = 'err.lib'; applyI18n(); }
}
