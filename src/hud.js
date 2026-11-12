// Everything drawn on top of the 3D view: score, timer, meters, purse, shop, pumpkin prompts, radar and messages.
import { GADGETS, TEAM, SHOP, OBJ } from './config.js';
import { angDiff, yawTo } from './util.js';
import { t as tl } from './i18n.js';

const $ = (id) => document.getElementById(id);

export function createHud(game) {
  const el = {};
  for (const id of ['hud', 'score-herd', 'score-hands', 'pips-herd', 'pips-hands', 'timer', 'feed', 'hurt', 'hurt-arrow', 'hitmark', 'banner', 'banner-title', 'banner-sub',
    'tip', 'spectate', 'hp-num', 'hp-fill', 'ammo-num', 'ammo-fill', 'gadget-name', 'slots', 'radar', 'cross', 'ch-t', 'ch-b', 'ch-l', 'ch-r',
    'armor-row', 'armor-num', 'armor-fill', 'slot-1', 'slot-1-name', 'slot-2', 'slot-b', 'purse', 'coins', 'shop', 'shop-coins', 'shop-list',
    'status', 'status-text', 'prompt', 'prompt-text', 'prompt-bar', 'prompt-fill', 'scope', 'veil', 'slot-3', 'slot-4', 'slot-5']) el[id] = $(id);
  for (const t of ['herd', 'hands']) { el['pips-' + t].innerHTML = '<i></i><i></i><i></i><i></i><i></i>'; }
  const rctx = el.radar.getContext('2d');
  let bannerT = 0, tipT = 0, hitT = 0, hurtT = 0, shopKey = '';
  const last = {};
  const set = (key, node, value) => { if (last[key] !== value) { last[key] = value; node.textContent = value; } };
  const show = (key, node, on) => { if (last[key] !== on) { last[key] = on; node.hidden = !on; } };

  function update(dt) {
    const p = game.player;
    if (!p) return;
    const P = game.pumpkin;
    set('sh', el['score-herd'], String(game.score.herd));
    set('sf', el['score-hands'], String(game.score.hands));
    const planted = P.state === 'planted';
    const secs = Math.max(0, Math.ceil(planted ? P.fuse : game.state === 'freeze' ? game.freezeT : game.roundT));
    set('tm', el.timer, `${(secs / 60) | 0}:${String(secs % 60).padStart(2, '0')}`);
    el.timer.classList.toggle('low', secs <= 15 && game.state === 'live' && !planted);
    el.timer.classList.toggle('fuse', planted);
    for (const t of ['herd', 'hands']) {
      const n = game.actors.filter((a) => a.team === t && a.alive).length;
      if (last['al' + t] !== n) { last['al' + t] = n; [...el['pips-' + t].children].forEach((c, i) => c.classList.toggle('off', i >= n)); }
    }
    const hp = Math.ceil(p.hp);
    if (last.hp !== hp) { last.hp = hp; el['hp-num'].textContent = hp; el['hp-fill'].style.width = hp + '%'; el['hp-fill'].style.background = hp > 55 ? '' : hp > 25 ? '#f6cf58' : '#d9463e'; }
    const ar = Math.ceil(p.armor);
    if (last.ar !== ar) { last.ar = ar; el['armor-row'].classList.toggle('on', ar > 0); el['armor-num'].textContent = ar; el['armor-fill'].style.width = ar + '%'; }
    const g = GADGETS[p.gadgetId];
    set('am', el['ammo-num'], p.reloadT > 0 ? tl('hud.refilling') : String(p.ammo));
    el['ammo-fill'].style.width = Math.round((p.reloadT > 0 ? 1 - p.reloadT / g.reload : p.ammo / g.tank) * 100) + '%';
    set('gn', el['gadget-name'], tl(`g.${g.id}.name`));
    set('s1', el['slot-1-name'], p.primary ? tl(`g.${p.primary}.short`) : tl('hud.empty'));
    const key = p.gadgetId + '|' + p.primary;
    if (last.slot !== key) {
      last.slot = key;
      el['slot-1'].classList.toggle('on', p.gadgetId !== 'squirter'); el['slot-1'].classList.toggle('empty', !p.primary);
      el['slot-2'].classList.toggle('on', p.gadgetId === 'squirter');
    }
    show('sb', el['slot-b'], game.state === 'freeze');
    const tk = `${p.throws.flour}${p.throws.rooster}${p.throws.mud}`;
    if (last.tk !== tk) { last.tk = tk; el['slot-3'].classList.toggle('empty', !p.throws.flour); el['slot-4'].classList.toggle('empty', !p.throws.rooster); el['slot-5'].classList.toggle('empty', !p.throws.mud); }
    const veil = Math.round((game.veil || 0) * 50) / 50;
    if (last.veil !== veil) { last.veil = veil; el.veil.style.opacity = veil; }
    if (last.coins !== p.coins) {
      if (last.coins !== undefined) { el.purse.classList.add('flash'); setTimeout(() => el.purse.classList.remove('flash'), 350); }
      last.coins = p.coins; el.coins.textContent = p.coins.toLocaleString('en-US');
    }

    // crosshair opens up to show how much the shots will scatter; hidden while zoomed
    const zoomed = p.alive && p.scoped;
    show('scope', el.scope, zoomed);
    const focal = (game.viewH / 2) / Math.tan((game.camera.fov * Math.PI) / 360);
    const gap = Math.round(5 + Math.min(0.2, p.spread()) * focal);
    if (last.gap !== gap) {
      last.gap = gap;
      el['ch-t'].style.top = -gap - 11 + 'px'; el['ch-b'].style.top = gap + 'px'; el['ch-l'].style.left = -gap - 11 + 'px'; el['ch-r'].style.left = gap + 'px';
    }
    el.cross.style.display = p.alive && !zoomed ? '' : 'none';

    // ---- the pumpkin: status chip and what-to-do prompt ----
    const attacking = game.attackers === p.team;
    let status = '', hot = false, prompt = '', frac = -1;
    if (game.state === 'live' || game.state === 'freeze') {
      if (P.state === 'carried') status = P.carrier === p ? tl('status.you') : attacking ? tl('status.carrier', { name: P.carrier.name }) : '';
      else if (P.state === 'dropped') status = tl(attacking ? 'status.droppedAtt' : 'status.droppedDef');
      else if (planted) { status = tl(attacking ? 'status.plantedAtt' : 'status.plantedDef', { site: P.site }); hot = true; }
    }
    if (game.state === 'live' && p.alive) {
      if (P.state === 'carried' && P.carrier === p) {
        if (P.actor === p) { prompt = tl('prompt.planting'); frac = P.progress / OBJ.plantTime; }
        else prompt = game.siteAt(p.pos.x, p.pos.z) ? tl('prompt.plant') : tl('prompt.carry');
      } else if (planted && !attacking) {
        const need = p.kit ? OBJ.corkTimeKit : OBJ.corkTime;
        if (P.actor === p) { prompt = tl('prompt.corking'); frac = P.progress / need; }
        else if (Math.hypot(p.pos.x - P.x, p.pos.z - P.z) < OBJ.reach) prompt = tl('prompt.cork');
      }
    }
    const hunt = game.mode === 'lts';
    if (hunt && game.state === 'live' && game.revealed) status = tl('status.reveal');
    show('st', el.status, !!status);
    if (status) { set('stt', el['status-text'], status); el.status.classList.toggle('hot', hot); el.status.classList.toggle('plain', hunt); }
    show('pr', el.prompt, !!prompt);
    if (prompt) {
      if (last.prt !== prompt) { last.prt = prompt; el['prompt-text'].innerHTML = prompt.replace('[E]', '<kbd>E</kbd>'); }
      el['prompt-bar'].hidden = frac < 0;
      if (frac >= 0) el['prompt-fill'].style.width = Math.min(100, frac * 100) + '%';
    }

    // ---- shop ----
    const open = game.shopOpen && game.state === 'freeze' && p.alive;
    show('shop', el.shop, open);
    if (open) renderShop(p);

    if (bannerT > 0 && (bannerT -= dt) <= 0) el.banner.hidden = true;
    if (tipT > 0 && (tipT -= dt) <= 0) el.tip.hidden = true;
    if (hitT > 0 && (hitT -= dt) <= 0) el.hitmark.style.opacity = 0;
    if (hurtT > 0 && (hurtT -= dt) <= 0) { el.hurt.style.opacity = 0; el['hurt-arrow'].style.opacity = 0; }
    radar();
  }

  function renderShop(p) {
    const items = game.shopItems(p);
    const key = p.coins + '|' + items.map((i) => i.state).join('');
    if (key === shopKey) return;
    shopKey = key;
    el['shop-coins'].textContent = tl('shop.coins', { n: p.coins.toLocaleString('en-US') });
    el['shop-list'].textContent = '';
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'item' + (it.state === 'own' ? ' own' : it.state === 'ok' ? '' : ' no');
      b.id = 'buy-' + it.id;
      const img = document.createElement('img'); img.src = `assets/ui/${it.icon}.jpg`; img.alt = '';
      const k = document.createElement('kbd'); k.textContent = String(i + 1);
      const mid = document.createElement('span');
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = it.name;
      const bl = document.createElement('span'); bl.className = 'bl'; bl.textContent = it.blurb;
      mid.append(nm, document.createElement('br'), bl);
      const pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = it.state === 'own' ? tl('shop.owned') : it.price.toLocaleString('en-US');
      b.append(k, img, mid, pr);
      b.addEventListener('click', () => game.buy(p, it.id));
      el['shop-list'].append(b);
    });
  }

  function radar() {
    const c = rctx, S = 272, r = 130, scale = r / 32;
    const v = game.viewActor || game.player, yaw = game.viewYaw, P = game.pumpkin;
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(S / 2, S / 2, r, 0, 7); c.clip();
    c.translate(S / 2, S / 2); c.scale(scale, scale); c.rotate(yaw); c.translate(-v.pos.x, -v.pos.z);
    c.fillStyle = 'rgba(95,196,239,0.55)';
    for (const z of game.world.slowZones) c.fillRect(z.x1, z.z1, z.x2 - z.x1, z.z2 - z.z1);
    c.fillStyle = 'rgba(58,38,22,0.32)';
    for (const b of game.world.boxes) if (b.y2 >= 2.2 && b.y1 < 1) c.fillRect(b.x1, b.z1, b.x2 - b.x1, b.z2 - b.z1);
    c.font = '800 4px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const key of ['A', 'B']) {
      const s = game.world.sites[key];
      c.strokeStyle = c.fillStyle = key === 'A' ? '#d9463e' : '#3f8fd9'; c.lineWidth = 0.6; c.beginPath(); c.arc(s.x, s.z, s.r, 0, 7); c.stroke();
      c.save(); c.translate(s.x, s.z); c.rotate(-yaw); c.fillText(key, 0, 0.3); c.restore();
    }
    const dot = (a, colr, rad) => { c.fillStyle = colr; c.strokeStyle = '#3a2616'; c.lineWidth = 0.35; c.beginPath(); c.arc(a.x, a.z, rad, 0, 7); c.fill(); c.stroke(); };
    for (const a of game.actors) if (a !== v && a.alive && a.team === game.playerTeam) dot(a.pos, TEAM[a.team].color, P.carrier === a ? 1.7 : 1.25);
    game.intel[game.playerTeam].forEach((info, enemy) => { if (enemy.alive && game.time - info.t < 1.5) dot(info, '#e5412d', 1.25); });
    const mine = game.attackers === game.playerTeam;
    if (P.state === 'planted' || (P.state === 'dropped' && mine)) { const pulse = 1.5 + Math.sin(game.time * 8) * 0.4; dot(P, '#ff8a00', pulse); }
    c.restore();
    c.fillStyle = '#fff'; c.strokeStyle = '#3a2616'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(S / 2, S / 2 - 11); c.lineTo(S / 2 + 8, S / 2 + 8); c.lineTo(S / 2 - 8, S / 2 + 8); c.closePath(); c.fill(); c.stroke();
  }

  return {
    update,
    show(on) { el.hud.hidden = !on; },
    banner(title, sub, secs = 2.5) { el['banner-title'].textContent = title; el['banner-sub'].textContent = sub || ''; el['banner-sub'].hidden = !sub; el.banner.hidden = false; bannerT = secs; },
    hideBanner() { el.banner.hidden = true; bannerT = 0; },
    tip(text, secs = 5) { el.tip.textContent = text; el.tip.hidden = false; tipT = secs; },
    spectate(text) { el.spectate.hidden = !text; if (text) el.spectate.textContent = text; },
    hitMarker(head) { el.hitmark.classList.toggle('head', head); el.hitmark.style.opacity = 1; hitT = 0.12; },
    hurt(from) {
      const p = game.player;
      el.hurt.style.opacity = 1; hurtT = 0.25;
      const rel = angDiff(yawTo(from.pos.x - p.pos.x, from.pos.z - p.pos.z), p.yaw);
      el['hurt-arrow'].style.transform = `rotate(${-rel}rad)`; el['hurt-arrow'].style.opacity = 1;
    },
    feed(attacker, victim, head) {
      const row = document.createElement('div');
      const who = (a) => { const b = document.createElement('b'); b.className = a.team; b.textContent = a.name; return b; };
      row.append(who(attacker), tl(head ? 'feed.bonk' : 'feed.splat'), who(victim), tl(head ? 'feed.endHead' : 'feed.end'));
      el.feed.append(row);
      while (el.feed.children.length > 5) el.feed.firstChild.remove();
      setTimeout(() => row.remove(), 6000);
    },
    note(text) {
      const row = document.createElement('div'); row.textContent = text;
      el.feed.append(row);
      while (el.feed.children.length > 5) el.feed.firstChild.remove();
      setTimeout(() => row.remove(), 6000);
    },
    clearFeed() { el.feed.textContent = ''; },
    refreshShop() { shopKey = ''; },
  };
}
