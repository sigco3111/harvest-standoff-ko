// Sound: recorded effects, voice lines and music from assets/audio, with a built-in synthesiser as a safety net
// for anything that has not loaded yet.
import { angDiff, yawTo, clamp, pick } from './util.js';
import { AUDIO_PACK } from './audio-pack.js';

const VOICE = ['ann_welcome', 'ann_go', 'ann_planted', 'ann_corked', 'ann_stink', 'ann_herd_win', 'ann_hands_win', 'ann_time', 'ann_half', 'ann_match_point', 'ann_ten', 'ann_victory', 'ann_defeat', 'ann_lts', 'ann_reveal', 'ann_draw',
  'noise_chicken', 'noise_pig', 'noise_cow', 'noise_sheep', 'noise_goat'];
for (const t of ['herd', 'hands']) for (const k of ['go_1', 'go_2', 'spot_1', 'spot_2', 'planting', 'guard', 'dropped', 'got_it', 'hurt_1', 'hurt_2', 'out_1', 'out_2', 'nice', 'refill', 'to_a', 'to_b', 'corking', 'flour', 'rooster', 'mud']) VOICE.push(`${t}_${k}`);
VOICE.push('hands_planted_a', 'hands_planted_b');
const SFX = ['sfx_squirt', 'sfx_egg', 'sfx_pea', 'sfx_tomato', 'sfx_splat', 'sfx_thwap', 'sfx_step1', 'sfx_step2', 'sfx_step3', 'sfx_step4', 'sfx_refill', 'sfx_bell', 'sfx_rooster', 'sfx_tick', 'sfx_tock',
  'sfx_cork_pop', 'sfx_squeak', 'sfx_thud', 'sfx_click', 'sfx_flop', 'sfx_cluck'];
const MUSIC = ['music_menu', 'music_win', 'music_lose', 'music_victory', 'music_defeat', 'music_fuse'];

export function createAudio(game) {
  let ctx = null, master = null, musicBus = null, noiseBuf = null;
  const buffers = {};
  let musicNow = null, musicName = null, announcing = false, lastRadio = -9, cluckT = 14;
  const queue = [];

  function boot() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // one download holds every sound; cut it up using the table made at build time
      fetch('assets/audio.mp3').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((pack) => {
        for (const name of [...SFX, ...VOICE, ...MUSIC]) {
          const at = AUDIO_PACK[name];
          if (!at) continue;
          new Promise((res, rej) => ctx.decodeAudioData(pack.slice(at[0], at[0] + at[1]), res, rej))
            .then((buf) => { buffers[name] = buf; if (name === musicName && !musicNow) startMusic(name, pendingLoop, pendingVol); })
            .catch(() => { /* the synthesiser covers for a sound that will not decode */ });
        }
      }).catch(() => { /* no sound pack: synthesiser only */ });
    } catch (e) { ctx = null; }
  }
  // browsers only allow sound after a click or key press
  function init() {
    boot();
    if (ctx && ctx.state === 'suspended') ctx.resume().then(() => { if (musicName && !musicNow) startMusic(musicName, pendingLoop, pendingVol); }).catch(() => {});
  }

  // how loud and how far left/right a sound at (x,z) should be for the listener
  function place(x, z) {
    const c = game.camera.position, dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
    const vol = clamp(1 - d / 55, 0, 1) ** 2;
    const pan = d < 0.6 ? 0 : clamp(-Math.sin(angDiff(yawTo(dx, dz), game.viewYaw)) * 0.85, -1, 1);
    return { vol, pan };
  }
  function bus(vol, pan, dest) {
    const g = ctx.createGain(); g.gain.value = vol;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(dest || master); } else g.connect(dest || master);
    return g;
  }
  // plays a recorded sound; returns false when it has not loaded so the caller can synthesise instead
  function sample(name, vol = 1, pan = 0, rate = 1, dest) {
    const buf = buffers[name];
    if (!ctx || !buf || ctx.state !== 'running') return false;
    if (vol < 0.004) return true;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    src.connect(bus(vol, pan, dest)); src.start();
    return src;
  }
  function noise(dur, f0, f1, vol, pan = 0, type = 'bandpass', q = 1.2) {
    if (!ctx || vol < 0.004 || ctx.state !== 'running') return;
    const t = ctx.currentTime, src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = bus(1, pan), env = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    env.gain.setValueAtTime(vol, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl); fl.connect(env); env.connect(g);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  function tone(wave, f0, f1, dur, vol, pan = 0, delay = 0) {
    if (!ctx || vol < 0.004 || ctx.state !== 'running') return;
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), env = ctx.createGain(), g = bus(1, pan);
    o.type = wave; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vol, t + 0.008); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(env); env.connect(g);
    o.start(t); o.stop(t + dur + 0.03);
  }
  const wob = () => 0.94 + Math.random() * 0.12;

  // ---------- announcer: one line at a time, in order ----------
  function nextAnnouncement() {
    const name = queue.shift();
    if (!name) { announcing = false; return; }
    const src = sample(name, 1.0);
    if (!src || src === true) { nextAnnouncement(); return; }
    announcing = true;
    src.onended = nextAnnouncement;
  }
  function announce(name) { if (!ctx) return; queue.push(name); if (!announcing) nextAnnouncement(); }

  // ---------- music ----------
  let pendingLoop = true, pendingVol = 1;
  function stopMusic(fade = 0.6) {
    if (musicNow) { const { src, gain } = musicNow; try { gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 3); src.stop(ctx.currentTime + fade); } catch (e) { /* already stopped */ } }
    musicNow = null;
  }
  function music(name, loop = true, vol = 1) {
    if (!ctx) return;
    if (musicName === name && musicNow) return;
    stopMusic();
    musicName = name; pendingLoop = loop; pendingVol = vol;
    startMusic(name, loop, vol);
  }
  function startMusic(name, loop, vol) {
    const buf = buffers[name];
    if (!buf || ctx.state !== 'running') return; // starts by itself once loaded
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buf; src.loop = loop; gain.gain.value = vol;
    src.connect(gain); gain.connect(musicBus); src.start();
    musicNow = { src, gain };
    if (!loop) src.onended = () => { if (musicNow && musicNow.src === src) { musicNow = null; musicName = null; } };
  }

  return {
    init, boot, announce, music,
    stopMusic(fade) { musicName = null; stopMusic(fade); },
    shoot(g, a) {
      if (!ctx) return;
      const p = a.isPlayer ? { vol: 0.9, pan: 0 } : place(a.pos.x, a.pos.z);
      if (sample(g.sound, p.vol * 0.8, p.pan, wob())) { if (g.id === 'tomato') tone('triangle', 190, 70, 0.1, p.vol * 0.35, p.pan); return; }
      const v = p.vol * 0.5;
      if (g.id === 'squirter') { noise(0.11, 2600, 700, v, p.pan); tone('sine', 900, 380, 0.08, v * 0.5, p.pan); }
      else if (g.id === 'egg') { tone('sine', 520, 190, 0.07, v * 0.9, p.pan); noise(0.05, 1500, 600, v * 0.5, p.pan); }
      else { tone('triangle', 230, 80, 0.12, v * 1.1, p.pan); noise(0.09, 900, 250, v * 0.7, p.pan, 'lowpass'); }
    },
    splat(x, y, z, onChar) {
      if (!ctx) return;
      const p = place(x, z);
      if (sample('sfx_splat', p.vol * (onChar ? 0.75 : 0.4), p.pan, 0.9 + Math.random() * 0.35)) { if (onChar) sample('sfx_thwap', p.vol * 0.5, p.pan, wob()); return; }
      noise(0.13, onChar ? 1300 : 900, 160, p.vol * (onChar ? 0.5 : 0.25), p.pan, 'lowpass');
    },
    step(a) {
      if (!ctx) return;
      const p = a.isPlayer ? { vol: 0.32, pan: 0 } : place(a.pos.x, a.pos.z);
      if (sample('sfx_step' + (1 + ((Math.random() * 4) | 0)), p.vol * 0.9, p.pan, wob())) return;
      noise(0.06, 300, 90, p.vol * 0.55, p.pan, 'lowpass', 0.7);
    },
    reload(a) {
      if (!ctx) return;
      const p = a.isPlayer ? { vol: 0.8, pan: 0 } : place(a.pos.x, a.pos.z);
      if (sample('sfx_refill', p.vol * 0.6, p.pan, a.isPlayer ? 1 : wob())) return;
      if (a.isPlayer) { tone('square', 300, 520, 0.07, 0.08); tone('square', 520, 700, 0.07, 0.08, 0, 0.16); }
    },
    hitConfirm(head) { tone('sine', head ? 1250 : 900, head ? 1700 : 1150, 0.07, 0.2); if (head) tone('sine', 1900, 2300, 0.08, 0.15, 0, 0.06); },
    hurt() { tone('sine', 330, 140, 0.16, 0.26); },
    // someone got splatted out: a squeaky flop plus their own complaint
    out(a) {
      if (!ctx) return;
      const p = place(a.pos.x, a.pos.z);
      if (!sample('sfx_flop', p.vol * 0.6, p.pan, wob())) tone('sine', 950, 180, 0.45, p.vol * 0.3, p.pan);
      const line = a.kind !== 'farmer' && Math.random() < 0.6 ? `noise_${a.kind}` : `${a.team}_out_${1 + ((Math.random() * 2) | 0)}`;
      sample(line, Math.max(a.isPlayer ? 0.8 : 0, p.vol) * 0.95, p.pan);
    },
    // a character shouting from where they stand (anyone nearby hears it)
    shout(a, key, chance = 1) {
      if (!ctx || a.sayT > 0 || Math.random() > chance) return;
      a.sayT = 3.5;
      const p = a.isPlayer ? { vol: 0.75, pan: 0 } : place(a.pos.x, a.pos.z);
      sample(`${a.team}_${key}`, p.vol * 0.9, p.pan);
    },
    // team radio: only your own side's calls reach you
    radio(team, key) {
      if (!ctx || team !== game.playerTeam || game.time - lastRadio < 1.6) return;
      const name = Array.isArray(key) ? pick(key) : key;
      if (sample(`${team}_${name}`, 0.85)) { lastRadio = game.time; noise(0.04, 3000, 2500, 0.05); }
    },
    bell() { if (!sample('sfx_bell', 0.6)) for (const f of [540, 806]) tone('square', f, f * 0.99, 0.5, 0.09); },
    rooster() { sample('sfx_rooster', 0.6); },
    countdown() { tone('square', 700, 690, 0.05, 0.06); },
    fuseTick(x, z, k) { const p = place(x, z); if (!sample(k % 2 ? 'sfx_tock' : 'sfx_tick', Math.max(0.12, p.vol) * 0.9, p.pan, 1 + (k % 2) * 0.05)) tone('square', 900, 880, 0.05, Math.max(0.03, p.vol * 0.12), p.pan); },
    thud(x, z) { const p = place(x, z); if (!sample('sfx_thud', p.vol * 0.9, p.pan)) tone('triangle', 140, 60, 0.15, p.vol * 0.4, p.pan); },
    squeak(x, z) { const p = place(x, z); sample('sfx_squeak', p.vol * 0.6, p.pan, wob()); },
    corkPop(x, z) { const p = place(x, z); if (!sample('sfx_cork_pop', Math.max(0.3, p.vol), p.pan)) tone('sine', 300, 900, 0.08, 0.3, p.pan); },
    stink(x, z) {
      const p = place(x, z), v = Math.max(0.35, p.vol);
      for (let i = 0; i < 7; i++) tone('sawtooth', 95 - i * 6, 60, 0.11, v * 0.3, p.pan, i * 0.09);
      noise(1.6, 900, 200, v * 0.4, p.pan, 'lowpass'); noise(2.2, 5000, 1800, v * 0.12, p.pan, 'highpass');
    },
    toss(a) { const p = a.isPlayer ? { vol: 0.7, pan: 0 } : place(a.pos.x, a.pos.z); noise(0.2, 500, 1900, p.vol * 0.22, p.pan, 'bandpass', 0.8); },
    poof(x, z) { const p = place(x, z), v = Math.max(0.2, p.vol); noise(0.55, 1400, 180, v * 0.45, p.pan, 'lowpass'); noise(0.9, 4000, 2000, v * 0.08, p.pan, 'highpass'); },
    crow(x, z) { const p = place(x, z); if (!sample('sfx_rooster', Math.max(0.35, p.vol) * 1.1, p.pan, 1.08)) { tone('sawtooth', 500, 900, 0.25, 0.25, p.pan); tone('sawtooth', 900, 600, 0.4, 0.25, p.pan, 0.25); } },
    mud(x, z) { const p = place(x, z); if (!sample('sfx_splat', Math.max(0.2, p.vol) * 0.9, p.pan, 0.62)) noise(0.25, 700, 120, p.vol * 0.5, p.pan, 'lowpass'); },
    buy() { sample('sfx_click', 0.6); tone('sine', 1320, 1320, 0.09, 0.14); tone('sine', 1760, 1760, 0.16, 0.14, 0, 0.08); },
    deny() { tone('square', 170, 150, 0.14, 0.09); },
    win() { if (!sample('music_win', 0.7, 0, 1, musicBus)) [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.2, 0, i * 0.12)); },
    lose() { if (!sample('music_lose', 0.7, 0, 1, musicBus)) [440, 392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.97, 0.26, 0.18, 0, i * 0.16)); },
    ui() { tone('sine', 660, 880, 0.06, 0.1); },
    // little bits of farm life in the background
    ambient(dt) {
      cluckT -= dt;
      const coop = game.world.cluck; // only maps with a chicken coop have clucking
      if (cluckT <= 0) { cluckT = 14 + Math.random() * 22; if (coop) { const p = place(coop.x, coop.z); sample('sfx_cluck', p.vol * 0.5 + 0.03, p.pan, wob()); } }
    },
    setVolume(v) { if (master) master.gain.value = v; },
    loaded() { return Object.keys(buffers).length; },
  };
}
