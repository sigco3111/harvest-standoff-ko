// Characters and their launchers, built from soft rounded shapes. Everyone faces "north" (-z) by default.
import { add, group, sphereGeo, capsuleGeo, cylGeo, coneGeo, torusGeo, rboxGeo, mat, bakeChildren } from './gfx.js';

const T = window.THREE;
const HALF = Math.PI / 2;

// where the front surface of a round head is, so faces sit ON the head instead of floating
const front = (hr, x, y, k = 1) => -Math.sqrt(Math.max(1e-4, hr * hr - x * x - y * y)) * k;

// big friendly eyes: white, coloured iris, pupil, sparkle and a soft brow
function eyes(head, hr, y, spread, size = 0.075, iris = 0x6b3f1d, brow = 0x3a2616) {
  const z = front(hr, spread, y, 0.93);
  for (const s of [-1, 1]) {
    add(head, sphereGeo(), 0xffffff, s * spread, y, z, { s: [size, size * 1.14, size * 0.8], cast: false });
    add(head, sphereGeo(), iris, s * spread * 0.97, y - size * 0.04, z - size * 0.44, { s: [size * 0.66, size * 0.72, size * 0.5], cast: false });
    add(head, sphereGeo(), 0x1c1c22, s * spread * 0.96, y - size * 0.04, z - size * 0.66, { s: [size * 0.38, size * 0.42, size * 0.3], cast: false });
    add(head, sphereGeo(), 0xffffff, s * spread * 0.96 + size * 0.22, y + size * 0.26, z - size * 0.86, { s: size * 0.17, cast: false });
    if (brow !== null) add(head, sphereGeo(), brow, s * spread * 1.02, y + size * 1.42, z + size * 0.1, { s: [size * 0.8, size * 0.15, size * 0.3], r: [0, 0, -s * 0.22], cast: false });
  }
}
function cheeks(head, hr, y, spread, color, size = 0.062) {
  for (const s of [-1, 1]) add(head, sphereGeo(), color, s * spread, y, front(hr, spread, y, 0.97), { s: [size, size * 0.8, size * 0.4], cast: false });
}
function smile(head, y, z, w = 0.075, color = 0x7a3b2e) {
  add(head, torusGeo(w, 0.012, Math.PI), color, 0, y, z, { r: [0, 0, Math.PI], cast: false });
}
function scarf(c, color, y = 0.21, r = 0.235) {
  add(c.torso, torusGeo(r, 0.04), color, 0, y, 0.01, { r: [HALF, 0, 0] });
  add(c.torso, coneGeo(0.15, 0.24, 3), color, 0, y - 0.12, -r - 0.02, { s: [1, 1, 0.28], r: [Math.PI - 0.22, 0, 0] });
  add(c.torso, sphereGeo(), color, 0.19, y + 0.005, -0.15, { s: 0.05 });
}

// Big head, round body, short legs: everybody is about 1.75 m tall so both teams are equally easy to hit.
function skeleton(o) {
  const root = new T.Group(); // turns left/right
  const pose = group(root); // tips over when splatted out
  const upper = group(pose); // everything above the legs (drops when crouching)
  const legs = [], arms = [], lr = o.legR || 0.1, legY = 0.36;
  for (const s of [-1, 1]) {
    const leg = group(pose, s * 0.17, legY, 0);
    add(leg, capsuleGeo(lr, 0.12), o.leg, 0, -0.14, 0);
    add(leg, sphereGeo(), o.foot, 0, -0.3, -0.045, { s: o.footS || [0.135, 0.09, 0.19] });
    legs.push(leg);
  }
  const torso = group(upper, 0, 0.76, 0);
  torso.scale.setScalar(1.12);
  add(torso, sphereGeo(), o.body, 0, 0, 0, { s: [o.bw, o.bh, o.bd] });
  add(torso, sphereGeo(), o.body, 0, 0.2, 0, { s: [o.bw * 0.78, o.bh * 0.62, o.bd * 0.8] });
  if (o.belly) add(torso, sphereGeo(), o.belly, 0, -0.05, -o.bd * 0.3, { s: [o.bw * 0.72, o.bh * 0.76, o.bd * 0.76] });
  const head = group(upper, 0, 1.34, 0);
  head.scale.setScalar(1.45);
  add(head, sphereGeo(), o.head, 0, 0, 0, { s: o.hr });
  for (const s of [-1, 1]) {
    const arm = group(upper, s * (o.bw * 1.12 - 0.02), 1.0, 0);
    add(arm, capsuleGeo(0.085, 0.17), o.arm, 0, -0.15, 0);
    add(arm, sphereGeo(), o.hand, 0, -0.34, 0, { s: 0.11 });
    arms.push(arm);
  }
  const mount = group(arms[1], 0, -0.37, 0);
  mount.rotation.x = -HALF;
  const marker = add(root, coneGeo(0.13, 0.26, 10), new T.MeshBasicMaterial({ color: 0x6dff7a }), 0, 2.38, 0, { r: [Math.PI, 0, 0], cast: false });
  marker.visible = false;
  return { root, pose, upper, legs, arms, torso, head, mount, marker, legY, splats: [], phase: Math.random() * 6, flop: 0 };
}

const BUILD = {
  chicken() {
    const hr = 0.24;
    const c = skeleton({ body: 0xffffff, head: 0xffffff, leg: 0xf5a623, foot: 0xf5a623, arm: 0xffffff, hand: 0xfff0cf, bw: 0.33, bh: 0.4, bd: 0.32, hr, belly: 0xfff6e2, legR: 0.055, footS: [0.15, 0.05, 0.2] });
    eyes(c.head, hr, 0.05, 0.1, 0.07, 0x3a2616, null);
    add(c.head, coneGeo(0.085, 0.2, 12), 0xffb02e, 0, -0.02, -0.29, { r: [-HALF, 0, 0], s: [1, 1, 0.7] });
    add(c.head, coneGeo(0.06, 0.13, 12), 0xf08a24, 0, -0.065, -0.25, { r: [-HALF, 0, 0], s: [1, 1, 0.5] });
    for (const [z, y, s] of [[-0.11, 0.24, 0.075], [-0.01, 0.275, 0.095], [0.1, 0.25, 0.08]]) add(c.head, sphereGeo(), 0xe5412d, 0, y, z, { s: [s * 0.6, s, s] });
    for (const s of [-1, 1]) add(c.head, sphereGeo(), 0xe5412d, s * 0.035, -0.17, -0.19, { s: [0.035, 0.07, 0.04] });
    cheeks(c.head, hr, -0.03, 0.16, 0xffc9cf, 0.05);
    for (const [x, rz] of [[0, 0], [-0.1, 0.5], [0.1, -0.5]]) add(c.torso, coneGeo(0.11, 0.42, 8), 0xffffff, x, 0.14, 0.31, { r: [0.95, 0, rz], s: [1, 1, 0.4] });
    for (const a of c.arms) add(a, sphereGeo(), 0xffffff, 0, -0.2, 0.03, { s: [0.06, 0.2, 0.15] });
    return c;
  },
  pig() {
    const hr = 0.26;
    const c = skeleton({ body: 0xf6a5b5, head: 0xf6a5b5, leg: 0xf6a5b5, foot: 0x9c4a5c, arm: 0xf6a5b5, hand: 0x9c4a5c, bw: 0.36, bh: 0.4, bd: 0.34, hr, belly: 0xfcd6dc });
    eyes(c.head, hr, 0.075, 0.108, 0.075, 0x6b3f1d, 0xb86a7c);
    const sz = front(hr, 0, -0.045) - 0.025;
    add(c.head, cylGeo(0.105, 0.118, 0.1, 18), 0xf08ea3, 0, -0.045, sz, { r: [HALF, 0, 0], s: [1.12, 1, 0.9] });
    for (const s of [-1, 1]) {
      add(c.head, sphereGeo(), 0xb85c74, s * 0.042, -0.04, sz - 0.05, { s: [0.022, 0.03, 0.015], cast: false });
      add(c.head, coneGeo(0.12, 0.22, 10), 0xf6a5b5, s * 0.19, 0.2, -0.03, { s: [1, 1, 0.42], r: [-0.75, 0, -s * 0.95] });
      add(c.head, coneGeo(0.075, 0.15, 10), 0xf58aa0, s * 0.195, 0.19, -0.045, { s: [1, 1, 0.3], r: [-0.75, 0, -s * 0.95], cast: false });
    }
    cheeks(c.head, hr, -0.04, 0.175, 0xf58aa0);
    smile(c.head, -0.13, front(hr, 0, -0.13) - 0.004, 0.07, 0xb85c74);
    add(c.torso, torusGeo(0.06, 0.022), 0xf08ea3, 0, -0.06, 0.34, { r: [0, HALF, 0] });
    scarf(c, 0xe2443a);
    return c;
  },
  cow() {
    const hr = 0.26;
    const c = skeleton({ body: 0xffffff, head: 0xffffff, leg: 0xffffff, foot: 0x2f3036, arm: 0xffffff, hand: 0x2f3036, bw: 0.36, bh: 0.42, bd: 0.33, hr, belly: 0xfff1ea });
    eyes(c.head, hr, 0.085, 0.108, 0.072, 0x4a3320, 0x2f3036);
    add(c.head, sphereGeo(), 0x2f3036, 0.15, 0.12, front(hr, 0.15, 0.12, 0.82), { s: [0.115, 0.13, 0.07] });
    const mz = front(hr, 0, -0.1, 0.82);
    add(c.head, sphereGeo(), 0xf7b7c2, 0, -0.1, mz, { s: [0.19, 0.125, 0.14] });
    for (const s of [-1, 1]) {
      add(c.head, sphereGeo(), 0xc7798a, s * 0.07, -0.075, mz - 0.125, { s: [0.024, 0.03, 0.015], cast: false });
      add(c.head, coneGeo(0.05, 0.17, 10), 0xf3e6c4, s * 0.14, 0.27, 0.0, { r: [0, 0, -s * 0.45] });
      add(c.head, sphereGeo(), 0xffffff, s * 0.29, 0.11, 0.0, { s: [0.12, 0.06, 0.08], r: [0, 0, s * 0.25] });
      add(c.head, sphereGeo(), 0xf7b7c2, s * 0.295, 0.105, -0.025, { s: [0.08, 0.035, 0.05], r: [0, 0, s * 0.25], cast: false });
    }
    smile(c.head, -0.125, mz - 0.128, 0.075, 0xc7798a);
    add(c.head, sphereGeo(), 0xffffff, 0, 0.26, -0.04, { s: [0.07, 0.05, 0.07] });
    for (const [x, y, z, s] of [[0.24, 0.1, -0.16, 0.17], [-0.26, -0.12, 0.08, 0.19], [0.1, -0.2, 0.25, 0.15], [-0.17, 0.2, -0.16, 0.11], [0.2, -0.05, 0.22, 0.12]]) add(c.torso, sphereGeo(), 0x2f3036, x, y, z, { s: [s, s, s * 0.7] });
    add(c.torso, torusGeo(0.235, 0.03), 0x8f5a2e, 0, 0.21, 0.01, { r: [HALF, 0, 0] });
    add(c.torso, cylGeo(0.055, 0.085, 0.11, 12), 0xffd24a, 0, 0.1, -0.27);
    add(c.torso, sphereGeo(), 0xc9973a, 0, 0.035, -0.27, { s: 0.03 });
    add(c.torso, cylGeo(0.018, 0.018, 0.3, 6), 0xffffff, 0, -0.12, 0.38, { r: [0.9, 0, 0] });
    add(c.torso, sphereGeo(), 0x2f3036, 0, -0.24, 0.5, { s: 0.05 });
    return c;
  },
  sheep() {
    const hr = 0.225;
    const c = skeleton({ body: 0xfdf6e3, head: 0x4a4038, leg: 0x4a4038, foot: 0x2a2420, arm: 0x4a4038, hand: 0x2a2420, bw: 0.34, bh: 0.4, bd: 0.33, hr });
    eyes(c.head, hr, 0.04, 0.095, 0.07, 0x6b3f1d, null);
    add(c.head, sphereGeo(), 0x655a50, 0, -0.07, front(hr, 0, -0.07, 0.86), { s: [0.11, 0.085, 0.09] });
    add(c.head, sphereGeo(), 0xe79aa6, 0, -0.05, front(hr, 0, -0.05) - 0.062, { s: [0.035, 0.024, 0.02], cast: false });
    smile(c.head, -0.085, front(hr, 0, -0.085) - 0.058, 0.045, 0x2a2420);
    for (const [x, y, z, s] of [[0.22, 0.2, 0.1, 0.21], [-0.22, 0.22, 0.08, 0.21], [0.25, -0.1, -0.05, 0.21], [-0.25, -0.12, -0.02, 0.21], [0, 0.1, 0.26, 0.23], [0, -0.16, 0.22, 0.21], [0, 0.3, -0.06, 0.21], [0.12, -0.02, -0.26, 0.18], [-0.12, 0.06, -0.27, 0.18], [0.14, -0.24, -0.16, 0.17], [-0.14, -0.26, -0.12, 0.17], [0.0, -0.3, 0.05, 0.2]]) add(c.torso, sphereGeo(), 0xfdf6e3, x, y, z, { s });
    for (const [x, y, z, s] of [[0, 0.2, -0.05, 0.15], [0.11, 0.17, 0.03, 0.12], [-0.11, 0.17, 0.03, 0.12], [0, 0.13, 0.14, 0.14], [0.06, 0.22, 0.06, 0.1], [-0.06, 0.22, 0.06, 0.1]]) add(c.head, sphereGeo(), 0xfdf6e3, x, y, z, { s });
    for (const s of [-1, 1]) add(c.head, sphereGeo(), 0x4a4038, s * 0.25, 0.0, 0.02, { s: [0.11, 0.05, 0.07], r: [0, 0, -s * 0.5] });
    scarf(c, 0x4f9f42, 0.25, 0.2);
    return c;
  },
  goat() {
    const hr = 0.24;
    const c = skeleton({ body: 0xd9b88a, head: 0xd9b88a, leg: 0xd9b88a, foot: 0x4a3a2c, arm: 0xd9b88a, hand: 0x4a3a2c, bw: 0.34, bh: 0.41, bd: 0.32, hr, belly: 0xf3e2c4 });
    eyes(c.head, hr, 0.07, 0.102, 0.072, 0xc9973a, 0x8a6a45);
    const mz = front(hr, 0, -0.08, 0.86);
    add(c.head, sphereGeo(), 0xf3e2c4, 0, -0.08, mz, { s: [0.14, 0.11, 0.12] });
    add(c.head, sphereGeo(), 0x6b4a3a, 0, -0.045, mz - 0.11, { s: [0.04, 0.026, 0.02], cast: false });
    smile(c.head, -0.09, mz - 0.105, 0.05, 0x6b4a3a);
    add(c.head, coneGeo(0.06, 0.2, 8), 0xffffff, 0, -0.27, -0.15, { r: [Math.PI, 0, 0], s: [1, 1, 0.7] });
    for (const s of [-1, 1]) {
      add(c.head, coneGeo(0.05, 0.2, 8), 0x8d8478, s * 0.1, 0.27, 0.03, { r: [0.5, 0, -s * 0.18] });
      add(c.head, coneGeo(0.035, 0.14, 8), 0x8d8478, s * 0.125, 0.36, 0.11, { r: [1.25, 0, -s * 0.2] });
      add(c.head, sphereGeo(), 0xd9b88a, s * 0.28, 0.06, 0.02, { s: [0.13, 0.045, 0.07], r: [0, 0, s * 0.35] });
      add(c.head, sphereGeo(), 0xf2c5b0, s * 0.285, 0.055, -0.01, { s: [0.085, 0.025, 0.04], r: [0, 0, s * 0.35], cast: false });
    }
    cheeks(c.head, hr, -0.02, 0.17, 0xeeb090, 0.05);
    add(c.torso, sphereGeo(), 0xd9b88a, 0, -0.05, 0.35, { s: [0.05, 0.05, 0.09] });
    scarf(c, 0x9b6fd0);
    return c;
  },
  farmer(look = 0) {
    const L = [
      { shirt: 0xd9463e, skin: 0xf2c9a0, hair: 0x6b4426, hat: 'straw', extra: 'moustache' },
      { shirt: 0xf2c84b, skin: 0xf7d7b5, hair: 0xd9783a, hat: 'bandana', extra: 'ponytail' },
      { shirt: 0x58a55c, skin: 0xc98f62, hair: 0xd9d9d9, hat: 'cap', extra: 'beard' },
      { shirt: 0xff9a3c, skin: 0x9a6b45, hair: 0x2e2420, hat: 'straw', extra: 'curls' },
      { shirt: 0x9b6fd0, skin: 0xf2c9a0, hair: 0xf0f0f0, hat: 'sun', extra: 'bun' },
    ][look % 5];
    const hr = 0.235, blush = look === 2 || look === 3 ? 0xc0714f : 0xf2a08c;
    const c = skeleton({ body: 0x3d6fb5, head: L.skin, leg: 0x3d6fb5, foot: 0x6b4426, arm: L.shirt, hand: L.skin, bw: 0.32, bh: 0.4, bd: 0.28, hr, footS: [0.14, 0.1, 0.2] });
    eyes(c.head, hr, 0.03, 0.082, 0.047, look === 1 ? 0x3f7a4a : 0x5a3a22, L.hair === 0xf0f0f0 || L.hair === 0xd9d9d9 ? 0x9a9a9a : L.hair);
    add(c.head, sphereGeo(), L.skin, 0, -0.035, front(hr, 0, -0.035) - 0.02, { s: [0.045, 0.04, 0.045] });
    cheeks(c.head, hr, -0.05, 0.14, blush, 0.05);
    for (const s of [-1, 1]) add(c.head, sphereGeo(), L.skin, s * 0.235, 0.0, 0.02, { s: [0.035, 0.06, 0.05] });
    if (L.extra !== 'moustache' && L.extra !== 'beard') smile(c.head, -0.095, front(hr, 0, -0.095) - 0.004, 0.06);
    // shirt, bib, straps, buttons, pocket
    add(c.torso, sphereGeo(), L.shirt, 0, 0.23, 0, { s: [0.275, 0.22, 0.245] });
    add(c.torso, rboxGeo(0.34, 0.3, 0.09, 0.045), 0x4f84cf, 0, 0.07, -0.235);
    add(c.torso, rboxGeo(0.16, 0.1, 0.03, 0.02), 0x3d6fb5, 0, 0.07, -0.285);
    for (const s of [-1, 1]) {
      add(c.torso, rboxGeo(0.06, 0.32, 0.04, 0.02), 0x4f84cf, s * 0.13, 0.27, -0.2, { r: [0.5, 0, 0] });
      add(c.torso, sphereGeo(), 0xffd24a, s * 0.13, 0.19, -0.285, { s: 0.03, cast: false });
    }
    if (L.hat === 'straw' || L.hat === 'sun') {
      const wide = L.hat === 'sun' ? 0.47 : 0.4;
      add(c.head, cylGeo(wide, wide + 0.02, 0.03, 22), 0xf2cc5c, 0, 0.15, 0.0);
      add(c.head, cylGeo(0.17, 0.215, 0.17, 18), 0xf2cc5c, 0, 0.24, 0.0);
      add(c.head, sphereGeo(), 0xf2cc5c, 0, 0.32, 0.0, { s: [0.17, 0.05, 0.17] });
      add(c.head, cylGeo(0.222, 0.222, 0.05, 18), L.hat === 'sun' ? 0xff6f91 : 0xb5452f, 0, 0.18, 0.0);
    } else if (L.hat === 'cap') {
      add(c.head, sphereGeo(), 0x2f6fb0, 0, 0.085, 0.01, { s: [0.24, 0.175, 0.24] });
      add(c.head, cylGeo(0.17, 0.17, 0.03, 16), 0x2f6fb0, 0, 0.1, -0.22, { s: [1, 1, 0.85] });
      add(c.head, sphereGeo(), 0xffffff, 0, 0.26, 0.01, { s: 0.03 });
    } else {
      add(c.head, sphereGeo(), 0xe2443a, 0, 0.09, 0.02, { s: [0.24, 0.16, 0.24] });
      add(c.head, sphereGeo(), 0xe2443a, 0.2, 0.1, 0.14, { s: [0.06, 0.05, 0.06] });
    }
    if (L.extra === 'moustache') { for (const s of [-1, 1]) add(c.head, sphereGeo(), L.hair, s * 0.045, -0.085, front(hr, 0, -0.085) - 0.012, { s: [0.06, 0.028, 0.03], r: [0, 0, -s * 0.3] }); add(c.head, sphereGeo(), L.hair, 0, 0.02, 0.19, { s: [0.2, 0.12, 0.08] }); }
    if (L.extra === 'beard') { add(c.head, sphereGeo(), L.hair, 0, -0.14, front(hr, 0, -0.14, 0.75), { s: [0.16, 0.12, 0.11] }); for (const s of [-1, 1]) add(c.head, sphereGeo(), L.hair, s * 0.05, -0.08, front(hr, 0, -0.08) - 0.01, { s: [0.06, 0.025, 0.03], r: [0, 0, -s * 0.3] }); }
    if (L.extra === 'ponytail') { add(c.head, sphereGeo(), L.hair, 0, -0.03, 0.25, { s: [0.09, 0.21, 0.09], r: [0.55, 0, 0] }); for (const s of [-1, 1]) add(c.head, sphereGeo(), L.hair, s * 0.13, 0.12, -0.17, { s: [0.09, 0.06, 0.06] }); }
    if (L.extra === 'curls') for (const [x, z] of [[-0.19, -0.06], [0.19, -0.06], [-0.21, 0.08], [0.21, 0.08], [0, 0.22], [-0.12, 0.19], [0.12, 0.19]]) add(c.head, sphereGeo(), L.hair, x, 0.04, z, { s: 0.065 });
    if (L.extra === 'bun') { add(c.head, sphereGeo(), L.hair, 0, 0.0, 0.23, { s: 0.11 }); for (const s of [-1, 1]) add(c.head, sphereGeo(), L.hair, s * 0.2, 0.06, -0.02, { s: [0.06, 0.09, 0.1] }); }
    return c;
  },
};

export function buildCharacter(kind, look) {
  const c = BUILD[kind](look);
  const model = MODELS[kind === 'farmer' ? `farmer${look || 0}` : kind];
  if (model && modelOptions.enabled) attachModel(c, model);
  // each stiff body part becomes a single shape, so a whole character costs only a few draw steps
  for (const part of [c.torso, c.head, ...c.legs, ...c.arms]) {
    for (const m of part.children) if (m.isMesh) m.castShadow = true;
    bakeChildren(part);
  }
  return c;
}

// Called every frame: legs, arms, crouch and the "flop over" when splatted out.
export function animateCharacter(c, dt, speed, pitch, crouched, alive) {
  c.phase += dt * (4 + speed * 1.7);
  const k = Math.min(1, speed / 5);
  const sw = Math.sin(c.phase) * 0.85 * k;
  if (c.rig) {
    // a generated model: move its six bones instead of the hand-built parts
    const r = c.rig, ease = Math.min(1, dt * 14);
    r.legL.rotation.x = sw * 0.8; r.legR.rotation.x = -sw * 0.8;
    r.drop += ((crouched ? 0.3 : 0) - r.drop) * ease;
    r.pelvis.position.y = r.pelvisY - r.drop + Math.abs(Math.sin(c.phase)) * 0.04 * k;
    r.pelvis.rotation.z = Math.sin(c.phase) * 0.05 * k;
    const squash = Math.max(0.35, (r.legLen - r.drop) / r.legLen);
    r.legL.scale.y = squash; r.legR.scale.y = squash;
    r.armR.rotation.set(pitch, HALF + 0.14, 0);
    r.armL.rotation.set(pitch, -HALF - 0.42, 0);
    r.head.rotation.x = pitch * 0.45;
    c.flop += ((alive ? 0 : 1) - c.flop) * Math.min(1, dt * 9);
    c.pose.rotation.x = c.flop * HALF * 0.98;
    c.pose.position.y = c.flop * 0.22;
    return;
  }
  c.legs[0].rotation.x = sw; c.legs[1].rotation.x = -sw;
  const drop = crouched ? 0.28 : 0;
  c.upper.position.y += (-drop + Math.abs(Math.sin(c.phase)) * 0.045 * k - c.upper.position.y) * Math.min(1, dt * 14);
  for (const leg of c.legs) { leg.position.y = c.legY - drop * 0.6; leg.scale.y = crouched ? 0.5 : 1; }
  c.arms[1].rotation.x = HALF + pitch;
  c.arms[0].rotation.x = HALF + pitch - 0.12;
  c.arms[0].rotation.z = -0.5;
  c.head.rotation.x = pitch * 0.6;
  const target = alive ? 0 : 1;
  c.flop += (target - c.flop) * Math.min(1, dt * 9);
  c.pose.rotation.x = c.flop * HALF * 0.98;
  c.pose.position.y = c.flop * 0.22;
}

export function addSplat(c, worldPoint, color) {
  const p = c.pose.worldToLocal(worldPoint.clone());
  const len = Math.hypot(p.x, p.z) || 1;
  const blob = add(c.pose, sphereGeo(), color, p.x, Math.max(0.2, Math.min(1.7, p.y)), p.z, { s: [0.13, 0.13, 0.13], cast: false });
  // nudge it onto the surface of the body
  const reach = 0.3 / len;
  blob.position.x = p.x * Math.min(1.4, Math.max(reach, 0.9));
  blob.position.z = p.z * Math.min(1.4, Math.max(reach, 0.9));
  blob.scale.set(0.14 + Math.random() * 0.06, 0.12 + Math.random() * 0.06, 0.1);
  blob.lookAt(c.pose.localToWorld(new T.Vector3(0, blob.position.y, 0)));
  c.splats.push(blob);
  if (c.splats.length > 9) c.pose.remove(c.splats.shift());
}

export function clearSplats(c) {
  for (const s of c.splats) c.pose.remove(s);
  c.splats.length = 0;
  c.flop = 0; c.pose.rotation.x = 0; c.pose.position.y = 0;
}

// ---------- launchers ----------
export function buildGadget(id) {
  const g = new T.Group();
  let muzzle = { y: 0.07, z: -0.3 };
  if (id === 'squirter') {
    add(g, rboxGeo(0.085, 0.105, 0.27, 0.04), 0x2f9bea, 0, 0.06, -0.08);
    add(g, cylGeo(0.022, 0.03, 0.1, 10), 0xff8a2a, 0, 0.07, -0.25, { r: [HALF, 0, 0] });
    add(g, sphereGeo(), mat(0x9fe3ff, { transparent: true, opacity: 0.85 }), 0, 0.145, 0.0, { s: [0.04, 0.042, 0.06] });
    add(g, cylGeo(0.018, 0.018, 0.025, 8), 0xff8a2a, 0, 0.192, 0.0);
    add(g, rboxGeo(0.055, 0.13, 0.065, 0.025), 0xff8a2a, 0, -0.035, 0.03, { r: [0.25, 0, 0] });
    add(g, rboxGeo(0.06, 0.045, 0.09, 0.02), 0xffd447, 0, 0.0, -0.13);
    muzzle = { y: 0.07, z: -0.31 };
  } else if (id === 'egg') {
    add(g, cylGeo(0.052, 0.052, 0.34, 14), 0xffd447, 0, 0.07, -0.14, { r: [HALF, 0, 0] });
    add(g, cylGeo(0.064, 0.064, 0.045, 14), 0xe5412d, 0, 0.07, -0.31, { r: [HALF, 0, 0] });
    add(g, rboxGeo(0.13, 0.055, 0.18, 0.02), 0xcfc7b8, 0, 0.15, -0.08);
    for (const z of [-0.135, -0.08, -0.025]) add(g, sphereGeo(), 0xfffaf0, 0, 0.185, z, { s: [0.036, 0.045, 0.036] });
    add(g, rboxGeo(0.055, 0.13, 0.065, 0.025), 0xb98452, 0, -0.035, 0.03, { r: [0.25, 0, 0] });
    add(g, rboxGeo(0.055, 0.08, 0.14, 0.025), 0xb98452, 0, 0.06, 0.12);
    muzzle = { y: 0.07, z: -0.34 };
  } else if (id === 'pea') {
    add(g, cylGeo(0.024, 0.028, 0.62, 10), 0xd9c27a, 0, 0.07, -0.34, { r: [HALF, 0, 0] });
    add(g, sphereGeo(), 0x58b03c, 0, 0.06, -0.04, { s: [0.06, 0.07, 0.2] });
    for (const z of [-0.14, -0.06, 0.02]) add(g, sphereGeo(), 0x9bdb72, 0, 0.1, z, { s: 0.036 });
    add(g, cylGeo(0.026, 0.026, 0.2, 10), 0xc9a13a, 0, 0.165, -0.08, { r: [HALF, 0, 0] });
    add(g, cylGeo(0.034, 0.026, 0.04, 10), 0xc9a13a, 0, 0.165, -0.19, { r: [HALF, 0, 0] });
    add(g, rboxGeo(0.058, 0.09, 0.24, 0.03), 0xb98452, 0, 0.045, 0.18);
    add(g, rboxGeo(0.055, 0.13, 0.065, 0.025), 0xb98452, 0, -0.035, 0.05, { r: [0.25, 0, 0] });
    muzzle = { y: 0.07, z: -0.66 };
  } else {
    add(g, cylGeo(0.036, 0.04, 0.5, 12), 0x4fa846, 0, 0.07, -0.22, { r: [HALF, 0, 0] });
    add(g, cylGeo(0.052, 0.04, 0.06, 12), 0xe5412d, 0, 0.07, -0.47, { r: [HALF, 0, 0] });
    add(g, cylGeo(0.088, 0.088, 0.085, 16), 0xe5412d, 0, -0.005, -0.15, { r: [0, 0, HALF] });
    add(g, coneGeo(0.03, 0.05, 6), 0x58b03c, 0, 0.125, -0.1);
    add(g, rboxGeo(0.058, 0.09, 0.22, 0.03), 0xb98452, 0, 0.05, 0.14);
    add(g, rboxGeo(0.055, 0.13, 0.065, 0.025), 0xb98452, 0, -0.035, 0.03, { r: [0.25, 0, 0] });
    muzzle = { y: 0.07, z: -0.5 };
  }
  g.userData.muzzle = muzzle;
  bakeChildren(g);
  return g;
}

// ---------- the Stink-Pumpkin ----------
export function buildPumpkin() {
  const g = new T.Group();
  const body = group(g, 0, 0.3, 0);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; add(body, sphereGeo(), i % 2 ? 0xf08a24 : 0xe87b17, 0, 0, 0, { s: [0.36, 0.29, 0.17], r: [0, a, 0] }); }
  for (const s of [-1, 1]) add(body, coneGeo(0.05, 0.08, 3), 0x3a2616, s * 0.12, 0.06, -0.31, { r: [HALF, 0, Math.PI], cast: false });
  add(body, sphereGeo(), 0x3a2616, 0, -0.07, -0.33, { s: [0.14, 0.035, 0.03], cast: false });
  add(body, cylGeo(0.07, 0.085, 0.14, 10), 0xd9b98a, 0, 0.3, 0);
  add(body, cylGeo(0.1, 0.1, 0.05, 14), 0xe2443a, 0.3, 0.0, 0.0, { r: [0, 0, HALF] });
  add(body, cylGeo(0.085, 0.085, 0.055, 14), 0xfff6df, 0.31, 0.0, 0.0, { r: [0, 0, HALF], cast: false });
  bakeChildren(body);
  const glow = add(g, sphereGeo(), new T.MeshBasicMaterial({ color: 0xb7f23a, transparent: true, opacity: 0.25, depthWrite: false }), 0, 0.3, 0, { s: 0.6, cast: false, receive: false });
  glow.visible = false;
  return { root: g, body, glow };
}

// ---------- generated 3D models (made by tools/chars/bake.mjs) ----------
// Which characters have one. Anyone not listed keeps the hand-built body.
export const MODELS = { chicken: 'chicken', pig: 'pig', cow: 'cow', sheep: 'sheep', goat: 'goat', farmer0: 'farmer0', farmer1: 'farmer1', farmer2: 'farmer2', farmer3: 'farmer3', farmer4: 'farmer4' };
export const modelOptions = { enabled: true };
const modelCache = new Map();
function unpack(text, Type) {
  const bin = atob(text), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Type(bytes.buffer);
}
function loadModel(name) {
  if (!modelCache.has(name)) {
    modelCache.set(name, fetch(`assets/chars/${name}.json`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
      const g = new T.BufferGeometry(), n = d.verts;
      const p16 = unpack(d.pos, Int16Array), pos = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) pos[i] = (p16[i] / 32767) * 2;
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.BufferAttribute(unpack(d.nrm, Int8Array), 3, true));
      if (d.uv) g.setAttribute('uv', new T.BufferAttribute(unpack(d.uv, Uint16Array), 2, true));
      if (d.col) {
        // colours were chosen as ordinary screen colours; convert them to what the lighting maths expects
        const c8 = unpack(d.col, Uint8Array), col = new Float32Array(n * 3), tmp = new T.Color();
        for (let i = 0; i < n; i++) { tmp.setRGB(c8[i * 3] / 255, c8[i * 3 + 1] / 255, c8[i * 3 + 2] / 255, T.SRGBColorSpace); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
        g.setAttribute('color', new T.BufferAttribute(col, 3));
      }
      g.setIndex(new T.BufferAttribute(unpack(d.idx, d.idxBytes === 2 ? Uint16Array : Uint32Array), 1));
      const bi = unpack(d.bi, Uint8Array), bw = unpack(d.bw, Uint8Array), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi[i * 2]; si[i * 4 + 1] = bi[i * 2 + 1]; sw[i * 4] = bw[i * 2] / 255; sw[i * 4 + 1] = bw[i * 2 + 1] / 255; }
      g.setAttribute('skinIndex', new T.BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
      g.computeBoundingSphere(); g.boundingSphere.radius = 2.2;
      let material;
      if (d.col) material = new T.MeshLambertMaterial({ vertexColors: true });
      else {
        const tex = new T.TextureLoader().load(`assets/chars/${name}.jpg`);
        tex.encoding = T.sRGBEncoding; tex.flipY = false; tex.anisotropy = 4;
        material = new T.MeshLambertMaterial({ map: tex });
      }
      return { geometry: g, material, rig: d.rig };
    }));
  }
  return modelCache.get(name);
}
function attachModel(c, name) {
  loadModel(name).then((m) => {
    const R = m.rig, py = R.crotchY + 0.06;
    const bone = (x, y, z, parent) => { const b = new T.Bone(); b.position.set(x, y, z); if (parent) parent.add(b); return b; };
    const pelvis = bone(0, py, 0);
    const legL = bone(-R.hipX, -0.02, 0, pelvis), legR = bone(R.hipX, -0.02, 0, pelvis);
    const armL = bone(-R.shoulderX, R.shoulderY - py, R.handZ, pelvis), armR = bone(R.shoulderX, R.shoulderY - py, R.handZ, pelvis);
    const head = bone(0, R.neckY - py, 0, pelvis);
    const mesh = new T.SkinnedMesh(m.geometry, m.material);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.add(pelvis);
    mesh.updateMatrixWorld(true);
    mesh.bind(new T.Skeleton([pelvis, legL, legR, armL, armR, head]));
    // the launcher moves from the hand-built hand to the model's right hand
    const hand = new T.Group();
    hand.position.set(R.handX - R.shoulderX, -0.02, 0);
    armR.add(hand);
    c.mount.position.set(0, 0, 0); c.mount.rotation.set(0, -HALF, 0);
    hand.add(c.mount);
    c.upper.visible = false; for (const l of c.legs) l.visible = false;
    c.pose.add(mesh);
    c.rig = { pelvis, legL, legR, armL, armR, head, mesh, pelvisY: py, legLen: py, drop: 0 };
  }).catch(() => { /* keep the hand-built body */ });
}
