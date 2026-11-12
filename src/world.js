// The maps. Each one is an original three-lane layout built from one shared kit of walls and props.
// North (-z) is where the defenders start; south (+z) is where the attackers start.
import { mat, add, group, rboxGeo, sphereLoGeo as sphereGeo, cylGeo, coneGeo, canvasTexture, texMat, bakeTree, loadTexture } from './gfx.js';
import { rand, pick } from './util.js';

const T = window.THREE;

const C = {
  barn: 0xd9463e, trim: 0xfff4e0, roof: 0x6f4a3c, stone: 0xbdb7aa, stoneCap: 0xdad5c8,
  hedgeA: 0x4f9f42, hedgeB: 0x66b84e, wood: 0xb98452, woodDark: 0x8f6238, hay: 0xf2cc5c, hayBand: 0xc9953a,
  crate: 0xcf9f5f, soil: 0x7a553c, cabbage: 0x9bdb72, pumpkin: 0xf08a24, tomato: 0xe5412d, carrot: 0xff9a3c,
  leaf: 0x58b03c, coop: 0xf6e7bd, coopRoof: 0xc55a43, house: 0xfff1d6, houseRoof: 0x5f8ec4, glass: 0xc8efe6,
  tractor: 0xe2443a, tyre: 0x34363c, hub: 0xffd24a, trunk: 0x8a5a36, treeA: 0x4fa846, treeB: 0x6cc257,
  water: 0x64c8f2, metal: 0x9aa3ad, barrel: 0xa8693a, barrelBand: 0x5a4636, apple: 0xd9342b,
};

export const MAPS = {
  farm: { id: 'farm', name: 'Sunnyside Farm', blurb: 'A barn, a veggie garden and a cornfield to hide in.' },
  mill: { id: 'mill', name: 'Applewood Mill', blurb: 'A cider mill, a market square and a creek with three bridges.' },
};

// the mood of each map: colours of trees, hedges, grass, sky and sunlight
const THEMES = {
  farm: {
    trees: [[0x4fa846, 0x6cc257]], hedge: [0x4f9f42, 0x66b84e], grass: 0xffffff, outer: 0x7cc452, hills: [0x74bf52, 0x8ad164],
    sky: ['#3fa4ee', '#8fd0fb', '#e4f6ff'], fog: 0xdff3ff, hemi: [0xe4f2ff, 0xe3d8b0, 0.82], sun: [0xfff0d0, 0.74, [34, 58, 30]],
    specks: ['#ffffff', '#ffe36e', '#ff9ec4', '#fff3b0'], mill: [-58, -52],
  },
  mill: {
    trees: [[0xe8862e, 0xf2a93b], [0xd9552e, 0xe8862e], [0xf2c84b, 0xf2a93b], [0xc94a32, 0xe07a2e]], hedge: [0x8a9a3a, 0xa3b04a], grass: 0xf3e2a8, outer: 0xb5b455, hills: [0xc9a94a, 0xd98a3a],
    sky: ['#4a97dc', '#a8d0ee', '#ffe2ba'], fog: 0xffe9cf, hemi: [0xfff1de, 0xe6c79a, 0.8], sun: [0xffd49a, 0.8, [-42, 44, 28]],
    specks: ['#e8862e', '#d9463e', '#f2c84b', '#b5652a'], mill: [62, -50],
  },
};

export function buildWorld(scene, mapId = 'farm') {
  const TH = THEMES[mapId] || THEMES.farm;
  const boxes = [];
  const root = group(scene);
  const bushes = [];
  const animated = [];
  const owned = []; // textures made just for this map, thrown away when the map changes

  const solid = (x1, y1, z1, x2, y2, z2) => { const b = { x1, y1, z1, x2, y2, z2 }; boxes.push(b); return b; };
  // long walls are always modelled lengthwise and then turned, so wall patterns run the right way up
  const block = (x1, z1, x2, z2, h, color, r = 0.1, y = 0) => {
    solid(x1, y, z1, x2, y + h, z2);
    const w = x2 - x1, d = z2 - z1;
    if (d > w) return add(root, rboxGeo(d, h, w, r), color, (x1 + x2) / 2, y + h / 2, (z1 + z2) / 2, { r: [0, Math.PI / 2, 0] });
    return add(root, rboxGeo(w, h, d, r), color, (x1 + x2) / 2, y + h / 2, (z1 + z2) / 2);
  };
  // a building wall with one material outside and another lining the inside (cx,cz is the middle of the building)
  const lined = (outside, inside, cx0, cz0) => (x1, z1, x2, z2, h, y = 0) => {
    block(x1, z1, x2, z2, h, outside, 0.06, y);
    const w = x2 - x1, d = z2 - z1, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    if (d > w) add(root, rboxGeo(d, h, 0.08, 0.03), inside, cx < cx0 ? x2 + 0.02 : x1 - 0.02, y + h / 2, cz, { r: [0, Math.PI / 2, 0], cast: false });
    else add(root, rboxGeo(w, h, 0.08, 0.03), inside, cx, y + h / 2, cz < cz0 ? z2 + 0.02 : z1 - 0.02, { cast: false });
  };
  const deco = (w, h, d, color, x, y, z, r = 0.06, o) => add(root, rboxGeo(w, h, d, r), color, x, y, z, o);

  // ---------- walls ----------
  function stone(x1, z1, x2, z2, h = 2.8) {
    block(x1, z1, x2, z2, h, texMat('stone'), 0.14);
    deco(x2 - x1 + 0.24, 0.26, z2 - z1 + 0.24, C.stoneCap, (x1 + x2) / 2, h + 0.06, (z1 + z2) / 2, 0.1);
  }
  function hedge(x1, z1, x2, z2, h = 3) {
    solid(x1, 0, z1, x2, h, z2);
    const alongX = x2 - x1 >= z2 - z1;
    const len = alongX ? x2 - x1 : z2 - z1, thick = alongX ? z2 - z1 : x2 - x1;
    const n = Math.max(1, Math.round(len / 1.25));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = alongX ? x1 + len * t : (x1 + x2) / 2, z = alongX ? (z1 + z2) / 2 : z1 + len * t;
      const rr = thick * rand(0.72, 0.9);
      bushes.push({ x: x + rand(-0.1, 0.1), y: h * 0.48, z: z + rand(-0.1, 0.1), sx: alongX ? 0.95 : rr, sy: h * rand(0.5, 0.58), sz: alongX ? rr : 0.95, c: TH.hedge[i % 2] });
    }
  }
  function fence(x1, z1, x2, z2) {
    solid(x1, 0, z1, x2, 1.1, z2);
    const alongX = x2 - x1 >= z2 - z1;
    const len = alongX ? x2 - x1 : z2 - z1, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    for (const y of [0.45, 0.9]) deco(alongX ? len : 0.1, 0.14, alongX ? 0.1 : len, C.trim, cx, y, cz, 0.04);
    const n = Math.round(len / 1.75);
    for (let i = 0; i <= n; i++) {
      const t = i / n - 0.5;
      deco(0.2, 1.2, 0.2, C.trim, alongX ? cx + t * len : cx, 0.6, alongX ? cz : cz + t * len, 0.06);
    }
  }

  // ---------- props ----------
  function hay(x, z, turned = false, levels = 1) {
    const w = turned ? 1.0 : 1.6, d = turned ? 1.6 : 1.0;
    solid(x - w / 2, 0, z - d / 2, x + w / 2, 0.9 * levels, z + d / 2);
    for (let i = 0; i < levels; i++) {
      const y = 0.45 + i * 0.9;
      deco(w, 0.9, d, texMat('hay'), x, y, z, 0.16);
      for (const s of [-0.28, 0.28]) deco(turned ? w + 0.03 : 0.08, 0.93, turned ? 0.08 : d + 0.03, C.hayBand, turned ? x : x + s * w, y, turned ? z + s * d : z, 0.03);
    }
  }
  function crate(x, z, size = 1.2, levels = 1) {
    solid(x - size / 2, 0, z - size / 2, x + size / 2, size * levels, z + size / 2);
    for (let i = 0; i < levels; i++) {
      const y = size / 2 + i * size;
      deco(size, size, size, texMat('crate'), x, y, z, 0.07);
      deco(size + 0.04, 0.14, size + 0.04, C.woodDark, x, y + size / 2 - 0.1, z, 0.04);
      deco(size + 0.04, 0.14, size + 0.04, C.woodDark, x, y - size / 2 + 0.1, z, 0.04);
    }
  }
  function tree(x, z, s = 1, collide = true, apples = false) {
    if (collide) solid(x - 0.4, 0, z - 0.4, x + 0.4, 5, z + 0.4);
    const [ca, cb] = pick(TH.trees);
    add(root, cylGeo(0.26 * s, 0.38 * s, 2.6 * s, 10), C.trunk, x, 1.3 * s, z);
    add(root, sphereGeo(), ca, x, 3.5 * s, z, { s: [2.0 * s, 1.7 * s, 2.0 * s] });
    add(root, sphereGeo(), cb, x + 0.9 * s, 4.3 * s, z + 0.3 * s, { s: 1.3 * s });
    add(root, sphereGeo(), cb, x - 0.8 * s, 4.5 * s, z - 0.5 * s, { s: 1.15 * s });
    if (apples) for (let i = 0; i < 9; i++) {
      const a = rand(6.28), e = rand(-0.5, 0.7);
      add(root, sphereGeo(), C.apple, x + Math.cos(a) * Math.cos(e) * 1.95 * s, 3.5 * s + Math.sin(e) * 1.65 * s, z + Math.sin(a) * Math.cos(e) * 1.95 * s, { s: 0.16, cast: false });
    }
  }
  function barrel(x, z, levels = 1) {
    solid(x - 0.48, 0, z - 0.48, x + 0.48, levels, z + 0.48);
    for (let i = 0; i < levels; i++) {
      add(root, cylGeo(0.42, 0.42, 1.0, 14), C.barrel, x, 0.5 + i, z);
      add(root, cylGeo(0.5, 0.5, 0.5, 14), C.barrel, x, 0.5 + i, z);
      for (const y of [0.16, 0.84]) add(root, cylGeo(0.47, 0.47, 0.07, 14), C.barrelBand, x, y + i, z);
    }
  }
  // a market stall: a counter to hide behind under a striped canopy
  function stall(x, z, colr, turned = false) {
    const w = turned ? 1.2 : 3, d = turned ? 3 : 1.2;
    block(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 1.1, texMat('wood'), 0.08);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) deco(0.12, 2.5, 0.12, C.woodDark, x + sx * (w / 2 + 0.2), 1.25, z + sz * (d / 2 + 0.2), 0.04);
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6 - 0.5, L = (turned ? d : w) + 0.9;
      deco(turned ? w + 0.9 : L / 6, 0.1, turned ? L / 6 : d + 0.9, i % 2 ? colr : C.trim, turned ? x : x + t * L, 2.55 + (turned ? 0 : 0), turned ? z + t * L : z, 0.03);
    }
    for (let i = 0; i < 5; i++) add(root, sphereGeo(), [C.apple, 0xf2c84b, 0x8fd060][i % 3], x + (turned ? rand(-0.3, 0.3) : -1 + i * 0.5), 1.22, z + (turned ? -1 + i * 0.5 : rand(-0.3, 0.3)), { s: 0.14, cast: false });
  }
  function fountain(x, z) {
    solid(x - 1.5, 0, z - 1.5, x + 1.5, 0.9, z + 1.5);
    add(root, cylGeo(1.65, 1.8, 0.85, 22), C.stone, x, 0.42, z);
    add(root, cylGeo(1.4, 1.4, 0.06, 22), 0x58b4e8, x, 0.84, z, { cast: false });
    add(root, cylGeo(0.22, 0.3, 1.5, 12), C.stoneCap, x, 1.2, z);
    add(root, cylGeo(0.75, 0.3, 0.24, 16), C.stoneCap, x, 2.0, z);
    add(root, sphereGeo(), 0x9bdcf7, x, 2.2, z, { s: [0.45, 0.2, 0.45], cast: false });
  }
  function cart(x, z, turned = false) {
    const w = turned ? 1.5 : 2.8, d = turned ? 2.8 : 1.5;
    solid(x - w / 2, 0, z - d / 2, x + w / 2, 1.35, z + d / 2);
    deco(w, 0.7, d, texMat('crate'), x, 0.95, z, 0.08);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(root, cylGeo(0.5, 0.5, 0.14, 16), C.woodDark, x + sx * (turned ? 0.82 : 0.95), 0.5, z + sz * (turned ? 0.95 : 0.82), { r: turned ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 8; i++) add(root, sphereGeo(), i % 3 ? C.apple : 0xf2c84b, x + rand(-w / 2 + 0.3, w / 2 - 0.3), 1.36 + rand(0, 0.1), z + rand(-d / 2 + 0.3, d / 2 - 0.3), { s: 0.17, cast: false });
  }
  // a bridge over the creek running north-south; "covered" gives it walls and a roof
  function bridge(x1, x2, z1, z2, covered = false) {
    deco(x2 - x1 + 0.4, 0.08, z2 - z1, C.wood, (x1 + x2) / 2, 0.05, (z1 + z2) / 2, 0.03, { cast: false });
    for (let z = z1 + 0.5; z < z2; z += 1) deco(x2 - x1 + 0.4, 0.02, 0.06, C.woodDark, (x1 + x2) / 2, 0.1, z, 0.01, { cast: false });
    if (covered) {
      const wall = lined(texMat('planks'), texMat('wood'), (x1 + x2) / 2, 0);
      wall(x1 - 0.4, z1, x1, z2, 2.7); wall(x2, z1, x2 + 0.4, z2, 2.7);
      solid(x1 - 0.4, 2.7, z1, x2 + 0.4, 3.0, z2);
      deco(x2 - x1 + 1.5, 0.22, z2 - z1 + 0.9, C.roof, (x1 + x2) / 2, 2.85, (z1 + z2) / 2, 0.08);
      deco(0.5, 0.3, z2 - z1 + 1.1, C.roof, (x1 + x2) / 2, 3.08, (z1 + z2) / 2, 0.1);
      for (const z of [z1 - 0.05, z2 + 0.05]) deco(x2 - x1 + 0.9, 0.3, 0.14, C.trim, (x1 + x2) / 2, 2.55, z, 0.05);
    } else {
      for (const x of [x1 - 0.2, x2]) {
        solid(x, 0, z1 + 0.1, x + 0.2, 1.0, z2 - 0.1);
        deco(0.14, 0.12, z2 - z1, C.trim, x + 0.1, 0.95, (z1 + z2) / 2, 0.04);
        for (const z of [z1 + 0.2, (z1 + z2) / 2, z2 - 0.2]) deco(0.18, 1.0, 0.18, C.trim, x + 0.1, 0.5, z, 0.05);
      }
    }
  }
  // a big wooden wheel that turns (decoration on the mill)
  function waterWheel(x, y, z, r = 2.2) {
    const wheel = group(root, x, y, z);
    const parts = [add(wheel, cylGeo(r, r, 0.12, 24), C.woodDark, 0, 0, 0, { r: [Math.PI / 2, 0, 0] }), add(wheel, cylGeo(r - 0.35, r - 0.35, 0.16, 24), C.wood, 0, 0, 0, { r: [Math.PI / 2, 0, 0] }), add(wheel, cylGeo(0.3, 0.3, 0.6, 12), C.barrelBand, 0, 0, 0, { r: [Math.PI / 2, 0, 0] })];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; parts.push(add(wheel, rboxGeo(0.7, 0.14, 0.5, 0.04), C.wood, Math.cos(a) * r, Math.sin(a) * r, 0.1, { r: [0, 0, a + Math.PI / 2] })); }
    for (const m of parts) m.userData.keep = true;
    animated.push((t) => { wheel.rotation.z = -t * 0.6; });
  }
  function bunting(x1, x2, z, y = 3.3) {
    for (const x of [x1, x2]) deco(0.14, y + 0.2, 0.14, C.woodDark, x, (y + 0.2) / 2, z, 0.05);
    const n = Math.round((x2 - x1) / 1.1);
    for (let i = 1; i < n; i++) { const t = i / n, sag = Math.sin(t * Math.PI) * 0.45; add(root, coneGeo(0.2, 0.42, 3), [0xe2443a, 0xf2c84b, 0x3f8fd9, 0x58a55c][i % 4], x1 + (x2 - x1) * t, y - sag - 0.2, z, { r: [Math.PI, 0, 0], s: [1, 1, 0.25], cast: false }); }
  }
  function planter(x1, z1, x2, z2, crop) {
    block(x1, z1, x2, z2, 0.5, C.wood, 0.08);
    deco(x2 - x1 - 0.24, 0.1, z2 - z1 - 0.24, C.soil, (x1 + x2) / 2, 0.5, (z1 + z2) / 2, 0.04, { cast: false });
    const n = Math.floor((x2 - x1) / 0.8);
    for (let i = 0; i < n; i++) {
      const x = x1 + 0.5 + i * ((x2 - x1 - 1) / Math.max(1, n - 1)), z = (z1 + z2) / 2 + rand(-0.15, 0.15);
      if (crop === 'cabbage') add(root, sphereGeo(), C.cabbage, x, 0.68, z, { s: [0.3, 0.24, 0.3] });
      else if (crop === 'tomato') {
        add(root, cylGeo(0.03, 0.03, 0.9, 6), C.leaf, x, 0.95, z);
        add(root, sphereGeo(), C.leaf, x, 1.1, z, { s: [0.26, 0.32, 0.26] });
        add(root, sphereGeo(), C.tomato, x + 0.16, 1.0, z + 0.1, { s: 0.1 });
        add(root, sphereGeo(), C.tomato, x - 0.14, 1.2, z - 0.08, { s: 0.09 });
      } else add(root, coneGeo(0.16, 0.5, 7), C.leaf, x, 0.8, z);
    }
  }
  function pumpkin(x, z, s = 0.4) {
    add(root, sphereGeo(), C.pumpkin, x, s * 0.72, z, { s: [s, s * 0.74, s] });
    add(root, cylGeo(0.04, 0.06, 0.16, 6), C.leaf, x, s * 1.45, z);
  }
  function tractor(x, z) {
    solid(x - 1.7, 0, z - 0.95, x + 1.7, 1.75, z + 0.95);
    solid(x + 0.2, 1.75, z - 0.7, x + 1.5, 2.6, z + 0.7);
    deco(1.9, 0.85, 1.1, C.tractor, x - 0.7, 1.15, z, 0.2);
    deco(1.3, 1.5, 1.4, C.tractor, x + 0.85, 1.75, z, 0.2);
    deco(1.34, 0.6, 1.2, 0x2f3b4a, x + 0.85, 2.0, z, 0.1);
    deco(1.5, 0.12, 1.6, C.hub, x + 0.85, 2.58, z, 0.05);
    for (const s of [-1, 1]) {
      add(root, cylGeo(0.85, 0.85, 0.42, 20), C.tyre, x + 0.85, 0.85, z + s * 0.85, { r: [Math.PI / 2, 0, 0] });
      add(root, cylGeo(0.36, 0.36, 0.46, 14), C.hub, x + 0.85, 0.85, z + s * 0.85, { r: [Math.PI / 2, 0, 0] });
      add(root, cylGeo(0.46, 0.46, 0.3, 16), C.tyre, x - 1.15, 0.46, z + s * 0.72, { r: [Math.PI / 2, 0, 0] });
      add(root, cylGeo(0.2, 0.2, 0.34, 12), C.hub, x - 1.15, 0.46, z + s * 0.72, { r: [Math.PI / 2, 0, 0] });
      add(root, sphereGeo(), 0xfff7c9, x - 1.66, 1.2, z + s * 0.34, { s: 0.11 });
    }
    add(root, cylGeo(0.06, 0.06, 0.9, 8), C.metal, x - 1.0, 2.0, z + 0.3);
  }
  function well(x, z) {
    solid(x - 1, 0, z - 1, x + 1, 1.1, z + 1);
    add(root, cylGeo(1.05, 1.15, 1.1, 20), C.stone, x, 0.55, z);
    add(root, cylGeo(0.82, 0.82, 0.06, 20), 0x3a7fb5, x, 1.09, z, { cast: false });
    for (const s of [-1, 1]) deco(0.16, 1.9, 0.16, C.wood, x + s * 0.92, 1.9, z, 0.05);
    add(root, coneGeo(1.5, 0.9, 4), C.coopRoof, x, 3.25, z, { r: [0, Math.PI / 4, 0] });
    add(root, cylGeo(0.05, 0.05, 1.9, 6), C.woodDark, x, 2.7, z, { r: [0, 0, Math.PI / 2] });
    add(root, cylGeo(0.16, 0.13, 0.26, 10), C.wood, x + 0.2, 1.75, z);
  }
  function scarecrow(x, z) {
    solid(x - 0.25, 0, z - 0.25, x + 0.25, 2.2, z + 0.25);
    deco(0.12, 2.3, 0.12, C.woodDark, x, 1.15, z, 0.04);
    deco(1.7, 0.1, 0.1, C.woodDark, x, 1.65, z, 0.04);
    deco(0.62, 0.7, 0.3, 0x4f79c7, x, 1.5, z, 0.12);
    add(root, sphereGeo(), 0xe9cf9a, x, 2.15, z, { s: 0.27 });
    add(root, cylGeo(0.5, 0.5, 0.04, 16), C.hay, x, 2.36, z);
    add(root, coneGeo(0.24, 0.3, 12), C.hay, x, 2.5, z);
    for (const s of [-1, 1]) add(root, coneGeo(0.1, 0.3, 6), C.hay, x + s * 0.92, 1.65, z, { r: [0, 0, s * Math.PI / 2] });
  }
  function gableRoof(x1, x2, z1, z2, yB, yR, color, endColor, inset = 0.7) {
    const zm = (z1 + z2) / 2;
    const slopes = new T.BufferGeometry();
    slopes.setAttribute('position', new T.Float32BufferAttribute([
      x1, yB, z2, x2, yB, z2, x2, yR, zm, x1, yB, z2, x2, yR, zm, x1, yR, zm,
      x2, yB, z1, x1, yB, z1, x1, yR, zm, x2, yB, z1, x1, yR, zm, x2, yR, zm,
    ], 3));
    slopes.computeVertexNormals();
    const run = Math.hypot(zm - z1, yR - yB);
    slopes.setAttribute('uv', new T.Float32BufferAttribute([x1, 0, x2, 0, x2, run, x1, 0, x2, run, x1, run, x2, 0, x1, 0, x1, run, x2, 0, x1, run, x2, run], 2));
    add(root, slopes, color === 'shingle' ? texMat('shingle') : mat(color, { side: T.DoubleSide }));
    if (endColor !== undefined) {
      const ends = new T.BufferGeometry();
      const i1 = x1 + inset, i2 = x2 - inset;
      ends.setAttribute('position', new T.Float32BufferAttribute([
        i1, yB, z1, i1, yB, z2, i1, yR, zm, i2, yB, z2, i2, yB, z1, i2, yR, zm,
      ], 3));
      ends.computeVertexNormals();
      add(root, ends, mat(endColor, { side: T.DoubleSide }));
    }
  }
  function sign(x, z, letter, color) {
    deco(0.14, 3.4, 0.14, C.woodDark, x, 1.7, z, 0.05);
    const tex = canvasTexture(128, 128, (g) => {
      g.fillStyle = color; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
      g.lineWidth = 8; g.strokeStyle = '#fff8e6'; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
      g.fillStyle = '#fff8e6'; g.font = '900 84px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 64, 70);
    });
    owned.push(tex);
    const m = new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide });
    const disc = new T.Mesh(new T.CircleGeometry(0.62, 28), m);
    disc.position.set(x, 3.3, z);
    root.add(disc);
    animated.push((t) => { disc.rotation.y = t * 0.8; });
  }

  // =====================================================================================================
  // MAP 1: Sunnyside Farm
  // =====================================================================================================
  function layoutFarm() {
    const wall = lined(texMat('planks'), texMat('wood'), -26, -13);
    // ---------- boundary ----------
    hedge(-41, -41, 41, -40, 3.4); hedge(-41, 40, 41, 41, 3.4); hedge(-41, -40, -40, 40, 3.4); hedge(40, -40, 41, 40, 3.4);

    // ---------- Site A: the Barn ----------
    const H = 4.5;
    wall(-34, -6.5, -28, -6, H); wall(-24, -6.5, -18, -6, H); wall(-28, -6.5, -24, -6, 1.5, 3);
    wall(-34, -20, -24, -19.5, H); wall(-21, -20, -18, -19.5, H); wall(-24, -20, -21, -19.5, 1.5, 3);
    wall(-34, -19.5, -33.5, -6.5, H);
    wall(-18.5, -19.5, -18, -15, H); wall(-18.5, -11, -18, -6.5, H); wall(-18.5, -15, -18, -11, 1.5, 3);
    gableRoof(-34.5, -17.5, -20.5, -5.5, H - 0.2, 8.2, 0xdcae72);
    gableRoof(-34.7, -17.3, -20.7, -5.3, H - 0.05, 8.4, 'shingle', C.barn);
    for (const [x, z] of [[-34, -6.25], [-18, -6.25], [-34, -19.75], [-18, -19.75]]) deco(0.62, H + 0.1, 0.62, C.trim, x, H / 2, z, 0.08);
    for (const x of [-28.1, -23.9]) deco(0.3, 3, 0.62, C.trim, x, 1.5, -6.25, 0.06);
    deco(4.5, 0.3, 0.62, C.trim, -26, 3.1, -6.25, 0.06);
    for (const z of [-15.1, -10.9]) deco(0.62, 3, 0.3, C.trim, -18.25, 1.5, z, 0.06);
    deco(0.62, 0.3, 4.5, C.trim, -18.25, 3.1, -13, 0.06);
    for (const x of [-24.1, -20.9]) deco(0.3, 3, 0.62, C.trim, x, 1.5, -19.75, 0.06);
    deco(3.5, 0.3, 0.62, C.trim, -22.5, 3.1, -19.75, 0.06);
    hay(-30, -14, false, 2); hay(-22, -12.5, true, 2); crate(-29, -9, 1.2, 1); hay(-26.5, -17.8, false, 1); crate(-20, -17.5, 1.2, 2);
    sign(-22.4, -4.6, 'A', '#e2443a');
    // silo beside the barn
    solid(-39, 0, -18, -35.6, 8, -14.6);
    add(root, cylGeo(1.7, 1.7, 7.5, 22), 0xdfe4ea, -37.3, 3.75, -16.3);
    add(root, sphereGeo(), C.barn, -37.3, 7.5, -16.3, { s: [1.72, 1.1, 1.72] });

    // ---------- Site B: the Veggie Garden ----------
    stone(12, -24, 13, -18); stone(12, -15, 13, -9);
    hedge(13, -24, 20, -23, 2.8); hedge(24, -24, 40, -23, 2.8);
    planter(16, -9, 22, -7.6, 'cabbage'); planter(16, -13, 22, -11.6, 'tomato'); planter(26, -8.6, 32, -7.2, 'carrot'); planter(26, -12.4, 30, -11, 'cabbage');
    scarecrow(24, -10.2);
    crate(21, -17, 1.3, 2); crate(22.4, -17, 1.2, 1);
    // greenhouse
    solid(29, 0, -21, 36, 3.2, -14);
    deco(7, 0.9, 7, C.trim, 32.5, 0.45, -17.5, 0.1);
    add(root, rboxGeo(6.8, 2.2, 6.8, 0.1), mat(C.glass, { transparent: true, opacity: 0.5 }), 32.5, 2.0, -17.5, { cast: false });
    for (const [x, z] of [[29.1, -20.9], [35.9, -20.9], [29.1, -14.1], [35.9, -14.1], [32.5, -14.1], [32.5, -20.9]]) deco(0.2, 3.2, 0.2, C.trim, x, 1.6, z, 0.05);
    deco(7.1, 0.2, 7.1, C.trim, 32.5, 3.15, -17.5, 0.06);
    for (let i = 0; i < 5; i++) add(root, sphereGeo(), i % 2 ? C.leaf : C.cabbage, 30.2 + i * 1.15, 1.35, -17.5 + (i % 2 ? 1.2 : -1.2), { s: [0.5, 0.7, 0.5], cast: false });
    // tool shed
    block(15, -22, 19, -19, 2.7, texMat('wood'), 0.1);
    deco(4.5, 0.2, 3.6, C.coopRoof, 17, 2.85, -20.5, 0.08, { r: [0.12, 0, 0] });
    deco(1.0, 1.9, 0.1, C.woodDark, 17, 0.95, -18.97, 0.04);
    for (const [x, z, s] of [[33.5, -10, 0.5], [34.6, -8.8, 0.38], [32.8, -5.4, 0.44], [14.6, -5, 0.4], [36.5, -11.6, 0.34]]) pumpkin(x, z, s);
    sign(22.6, -4.4, 'B', '#3f8fd9');

    // ---------- farmhouse and the Hands' start ----------
    block(-9, -40, 9, -35, 5, C.house, 0.12);
    gableRoof(-9.8, 9.8, -41, -34.2, 4.95, 8.2, C.houseRoof, C.house, 0.8);
    deco(18.6, 0.18, 2.4, C.houseRoof, 0, 3.1, -33.9, 0.06);
    for (const x of [-8.8, -3, 3, 8.8]) deco(0.2, 3.1, 0.2, C.trim, x, 1.55, -32.9, 0.06);
    deco(1.3, 2.3, 0.12, 0x9b5a3c, 0, 1.15, -34.95, 0.04);
    for (const x of [-6, -3.2, 3.2, 6]) { deco(1.3, 1.3, 0.1, 0x9fd6f2, x, 2.0, -34.96, 0.04); deco(1.5, 0.14, 0.16, C.trim, x, 1.3, -34.94, 0.04); }
    block(5.6, -38.6, 6.8, -37.4, 9.4, 0xc9705a, 0.1);
    hedge(-7, -27, 7, -26, 2.7);
    crate(-11.5, -31.5, 1.2, 1); crate(11.5, -31.5, 1.2, 2);

    // ---------- the Yard (between the two sites) ----------
    well(0, -15);
    tractor(-7, -21);
    hay(6, -10, false, 2); hay(-10, -8.6, true, 2); hay(-8.9, -8.6, true, 1); crate(8, -21, 1.3, 1); hay(3.5, -23, false, 1);

    // ---------- middle: the cornfield ----------
    stone(-11, -5, -8, -4); stone(-5, -5, 5, -4); stone(8, -5, 11, -4);
    stone(-12, -5, -11, 17); stone(-12, 20, -11, 26);
    stone(11, -5, 12, 17); stone(11, 20, 12, 26);
    fence(-11, 26, -4, 26.4); fence(4, 26, 11, 26.4);
    hay(0, 18.5, false, 1); hay(-6, 21, true, 1); hay(6.5, 22.5, false, 2);

    // ---------- west lane: Coop Alley and the Tractor Gate ----------
    stone(-40, 4, -37, 5); stone(-34, 4, -17, 5); stone(-14, 4, -12, 5);
    block(-30, 12, -22, 18, 3, C.coop, 0.12);
    gableRoof(-30.6, -21.4, 11.4, 18.6, 2.95, 5, 'shingle', C.coop, 0.6);
    deco(1.0, 1.2, 0.12, C.woodDark, -26, 0.6, 18.02, 0.04);
    deco(0.9, 0.08, 1.8, C.wood, -26, 0.25, 18.8, 0.03, { r: [0.28, 0, 0] });
    for (const x of [-28.4, -23.6]) deco(1.0, 0.8, 0.1, 0x9fd6f2, x, 1.9, 18.03, 0.04);
    hay(-19, 9.5, false, 2); hay(-17.4, 22, true, 1); crate(-33, 10, 1.2, 1); crate(-21.5, 1, 1.2, 2); hay(-30, 0.5, false, 1); hay(-14, -1.5, true, 2);
    tree(-37.5, 22); tree(-21, 25.5, 0.9); tree(-38, -2.5, 0.9);

    // ---------- east lane: Garden Gate and the Creek Culvert ----------
    stone(12, 6, 15, 7); stone(18, 6, 28, 7); stone(37, 6, 40, 7);
    block(28, 3, 31, 7, 3, C.stone, 0.14); block(34, 3, 37, 7, 3, C.stone, 0.14); block(31, 3, 34, 7, 0.7, C.stone, 0.14, 2.4);
    deco(9.3, 0.26, 4.3, C.stoneCap, 32.5, 3.1, 5, 0.1);
    crate(19.5, 11, 1.2, 2); hay(28.5, 15, true, 1); crate(36, 12, 1.2, 1); hay(20, 1, false, 2); crate(27, -0.5, 1.2, 1); hay(15, 21.5, true, 1);
    for (const [x, z, s] of [[23.5, 13, 0.55], [26.4, 21, 0.7], [22.6, 25, 0.5]]) { solid(x - s, 0, z - s, x + s, s * 1.2, z + s); add(root, sphereGeo(), 0xa9a79f, x, s * 0.5, z, { s: [s * 1.15, s * 0.85, s * 1.05] }); }
    tree(36.5, 22); tree(14.5, 25, 0.85); tree(38, -1.5, 0.9);

    // ---------- the Herd's start: back pasture ----------
    hay(-9, 30, false, 1); hay(9, 30, false, 1); hay(-18, 33.5, true, 2); hay(18, 33.5, true, 2);
    tree(-28, 36.5); tree(28, 36.5); tree(0, 38.2, 0.8);
    block(-3.2, 36.2, 3.2, 37, 0.6, C.wood, 0.1);
    deco(6, 0.08, 0.5, C.water, 0, 0.6, 36.6, 0.03, { cast: false });


    const pt = (x, z) => ({ x, z });
    return {
      corn: [[-10, -1.4, -1, 6], [-10, -1.4, 8.6, 15], [1.4, 10, -1, 6], [1.4, 10, 8.6, 15]],
      lanes: [
        [[-36, 31], [36, 31]], [[-15.5, 31], [-15.5, -1], [-26, -3.5], [-26, -13]], [[-35.5, 31], [-35.5, -22.5], [-22.5, -22.5], [-22.5, -19]],
        [[0, 31], [0, -2]], [[0, -2], [-6.5, -4.5], [-6.5, -10], [0, -18]], [[0, -2], [6.5, -4.5], [6.5, -10], [0, -18]], [[-10, 7.3], [10, 7.3]],
        [[16.5, 31], [16.5, -1], [24, -10]], [[32.5, 31], [32.5, -1], [24, -10]],
        [[0, -31], [-10, -29], [-22.5, -23]], [[0, -31], [10, -29], [22, -25], [24, -12]], [[0, -18], [-15, -13], [-26, -13]], [[0, -18], [10, -7], [14, -7]], [[12, -16.5], [22, -14]],
        [[-9, -29], [-9, -24], [0, -18]], [[9, -29], [9, -24], [0, -18]], [[-11.5, 18.5], [-15.5, 18.5]], [[11.5, 18.5], [16.5, 18.5]],
      ],
      soil: [[14, -22, 22.5, 18, 30]], paved: [], floors: [[-33.6, -19.6, -18.4, -6.4]],
      creeks: [{ pts: [[24.5, 7.4], [24, 14], [25.6, 22], [24.4, 30], [25, 40]], w: 2.3 }],
      slowZones: [], cluck: { x: -26, z: 15 },
      points: {
        A: pt(-26, -13), B: pt(24, -12.6), MID: pt(0, 7.3), YARD: pt(3, -17), HERD: pt(0, 32), HANDS: pt(0, -31),
        A_S: pt(-26, -3), A_E: pt(-15, -13), W_GATE: pt(-15.5, 8), W_ALLEY: pt(-35.5, 8), A_BACK: pt(-36, -2),
        E_GATE: pt(16.5, 10), E_TUNNEL: pt(32.5, 10), B_S: pt(32.5, -2), MID_L: pt(-6.5, -7), MID_R: pt(6.5, -7), B_W: pt(10, -7),
      },
      routes: {
        A: [['W_GATE', 'A_S', 'A'], ['W_ALLEY', 'A_BACK', 'A_S', 'A'], ['MID', 'MID_L', 'A_E', 'A']],
        B: [['E_GATE', 'B'], ['E_TUNNEL', 'B_S', 'B'], ['MID', 'MID_R', 'B_W', 'B']],
      },
      // where defenders like to stand, and what they keep an eye on
      holds: {
        A: [{ x: -32, z: -18, lx: -26, lz: -6 }, { x: -21.5, z: -8.5, lx: -18, lz: -13 }, { x: -19.5, z: -15.6, lx: -26, lz: -7 }, { x: -15, z: -9.5, lx: -15.5, lz: 4 }, { x: -25.5, z: -16.6, lx: -26, lz: -6 }],
        B: [{ x: 33.5, z: -11.5, lx: 16.5, lz: 5 }, { x: 18, z: -16.5, lx: 32.5, lz: 2 }, { x: 26.5, z: -19, lx: 22, lz: 2 }, { x: 23, z: -17.2, lx: 16.5, lz: 6 }, { x: 14.5, z: -10.5, lx: 32, lz: 2 }],
        MID: [{ x: -2.5, z: -13.5, lx: -6.5, lz: -4 }, { x: 4, z: -24.2, lx: 6.5, lz: -4 }, { x: 7, z: -8.2, lx: 6.5, lz: 0 }],
      },
      sites: { A: { x: -26, z: -13, r: 3.4 }, B: { x: 24, z: -10.2, r: 3.4 } },
    };
  }

  // =====================================================================================================
  // MAP 2: Applewood Mill. An autumn orchard in the south, a creek across the middle with three bridges
  // (wading is allowed but slow), and the cider mill (A) and market square (B) to the north.
  // =====================================================================================================
  function layoutMill() {
    const wall = lined(texMat('stone'), texMat('wood'), -27, -15);
    hedge(-41, -41, 41, -40, 3.4); hedge(-41, 40, 41, 41, 3.4); hedge(-41, -40, -40, 40, 3.4); hedge(40, -40, 41, 40, 3.4);

    // ---- the creek and its three bridges ----
    bridge(-29, -25, 2.5, 7.5); bridge(-3, 3, 2.5, 7.5, true); bridge(22, 26, 2.5, 7.5);
    stone(-40, 1, -29, 2); stone(-25, 1, -3.4, 2); stone(3.4, 1, 10, 2); stone(12, 1, 22, 2); stone(26, 1, 40, 2);
    for (const [x, z, s] of [[10.3, 0.4, 0.35], [11.8, 2.3, 0.3], [9.6, 2.6, 0.4], [-14, 8.2, 0.45], [15, 8.4, 0.5], [34, 8.1, 0.4], [-36, 8.3, 0.45]]) add(root, sphereGeo(), 0xa9a79f, x, s * 0.4, z, { s: [s * 1.2, s * 0.8, s] });

    // ---- Site A: the Cider Mill ----
    const H = 5;
    wall(-36, -8.5, -29, -8, H); wall(-25, -8.5, -18, -8, H); wall(-29, -8.5, -25, -8, 2, 3);
    wall(-36, -22, -24, -21.5, H); wall(-21, -22, -18, -21.5, H); wall(-24, -22, -21, -21.5, 2, 3);
    wall(-36, -21.5, -35.5, -8.5, H);
    wall(-18.5, -21.5, -18, -17, H); wall(-18.5, -13, -18, -8.5, H); wall(-18.5, -17, -18, -13, 2, 3);
    gableRoof(-36.5, -17.5, -22.5, -7.5, H - 0.2, 9.0, 0xdcae72);
    gableRoof(-36.8, -17.2, -22.8, -7.2, H - 0.05, 9.2, 'shingle', 0xcfc8b8);
    for (const [x, z] of [[-36, -8.25], [-18, -8.25], [-36, -21.75], [-18, -21.75]]) deco(0.7, H + 0.1, 0.7, C.woodDark, x, H / 2, z, 0.08);
    for (const x of [-29.1, -24.9]) deco(0.3, 3, 0.62, C.woodDark, x, 1.5, -8.25, 0.06);
    deco(4.5, 0.3, 0.62, C.woodDark, -27, 3.1, -8.25, 0.06);
    for (const z of [-17.1, -12.9]) deco(0.62, 3, 0.3, C.woodDark, -18.25, 1.5, z, 0.06);
    deco(0.62, 0.3, 4.5, C.woodDark, -18.25, 3.1, -15, 0.06);
    for (const x of [-24.1, -20.9]) deco(0.3, 3, 0.62, C.woodDark, x, 1.5, -21.75, 0.06);
    deco(3.5, 0.3, 0.62, C.woodDark, -22.5, 3.1, -21.75, 0.06);
    // the cider press and barrels inside
    block(-33.4, -19.6, -30.8, -17.6, 1.5, texMat('wood'), 0.1);
    deco(0.3, 2.6, 0.3, C.woodDark, -33.0, 2.3, -18.6, 0.06); deco(0.3, 2.6, 0.3, C.woodDark, -31.2, 2.3, -18.6, 0.06); deco(2.4, 0.3, 0.4, C.woodDark, -32.1, 3.5, -18.6, 0.06);
    add(root, cylGeo(0.12, 0.12, 2.0, 8), C.metal, -32.1, 2.6, -18.6); add(root, cylGeo(0.75, 0.75, 0.3, 16), C.woodDark, -32.1, 1.75, -18.6);
    barrel(-33.6, -11, 2); barrel(-32.5, -10.2, 1); barrel(-20.2, -10.2, 2); barrel(-21.4, -10.2, 1); crate(-23, -19.6, 1.2, 2); barrel(-29.5, -12.6, 1); hay(-20.6, -19.4, true, 1);
    solid(-34.8, 0, -8, -30.2, 4.7, -7.5);
    waterWheel(-32.5, 2.45, -7.62);
    sign(-23.3, -6.7, 'A', '#e2443a');

    // ---- the Mill Yard, between the west bridge and the mill ----
    barrel(-27.5, -3.6, 2); barrel(-26.5, -3.2, 1); crate(-33.5, -2.5, 1.2, 1); hay(-21.5, -4.5, false, 2); barrel(-20, 0, 1); cart(-37.2, -5.2, true);
    tree(-38.2, -26.5, 0.9); tree(-30, -27, 1.0);

    // ---- the Barrel Yard, in the middle ----
    cart(0.4, -9, false); barrel(-8, -5.2, 2); barrel(-8.9, -4.4, 1); barrel(-7.2, -4.3, 1); barrel(6.2, -4, 2); barrel(7.2, -4.4, 1);
    crate(4.5, -16, 1.3, 2); crate(5.9, -16, 1.2, 1); hay(-4, -20, false, 2); barrel(-12.5, -14, 2); barrel(-13.4, -13.2, 1); stall(-9.5, -23, 0xf2c84b); hay(8, -22.5, true, 1);
    tree(-14.5, -1.2, 0.85); tree(8.5, -27.5, 0.9);

    // ---- Site B: the Market Square ----
    block(10, -24, 13, -12, 3.6, C.house, 0.12);
    deco(3.8, 0.24, 12.6, C.coopRoof, 11.5, 3.75, -18, 0.08, { r: [0, 0, 0.1] });
    for (const z of [-21.5, -18, -14.5]) { deco(0.1, 1.1, 1.3, 0x9fd6f2, 13.03, 2.0, z, 0.04); deco(0.16, 0.14, 1.5, C.trim, 13.04, 1.35, z, 0.04); }
    stone(10, -5, 22, -4); stone(26, -5, 34, -4); stone(37, -5, 40, -4);
    hedge(13, -25, 26, -24, 2.8); hedge(30, -25, 40, -24, 2.8);
    fountain(31, -17);
    stall(17.5, -9, 0xe2443a); stall(19, -20, 0x3f8fd9); stall(36, -11.5, 0x58a55c, true); stall(24.5, -22, 0xf08a24);
    barrel(22.3, -16.8, 2); barrel(23.2, -16.2, 1); crate(28.5, -7.6, 1.2, 1); crate(15, -14.5, 1.2, 2); barrel(34.5, -21.5, 1); hay(27.5, -19.5, true, 1);
    bunting(14, 39, -6.2); bunting(14, 39, -23);
    for (const [x, z, s] of [[38.3, -6.5, 0.45], [37.6, -7.6, 0.34], [14.4, -22.6, 0.42], [33.2, -6.4, 0.36]]) pumpkin(x, z, s);
    sign(27.4, -3.0, 'B', '#3f8fd9');
    // the little court between the east bridge and the market gate
    barrel(19.5, -1.6, 2); crate(29.5, -1.8, 1.2, 1); hay(16, -0.6, false, 1); tree(38, -1.5, 0.85);

    // ---- the defenders' start: the cider shop ----
    block(-9, -40, 9, -35, 5, C.coop, 0.12);
    gableRoof(-9.8, 9.8, -41, -34.2, 4.95, 8.2, 'shingle', C.coop, 0.8);
    for (let i = 0; i < 9; i++) deco(2.0, 0.14, 2.2, i % 2 ? 0xe2443a : C.trim, -8 + i * 2, 3.0, -33.9, 0.05, { r: [0.2, 0, 0] });
    for (const x of [-8.8, 0, 8.8]) deco(0.2, 3.0, 0.2, C.woodDark, x, 1.5, -32.9, 0.06);
    deco(1.3, 2.3, 0.12, 0x9b5a3c, -4, 1.15, -34.95, 0.04);
    for (const x of [0, 3.2, 6]) { deco(1.3, 1.3, 0.1, 0x9fd6f2, x, 2.0, -34.96, 0.04); deco(1.5, 0.14, 0.16, C.trim, x, 1.3, -34.94, 0.04); }
    hedge(-7, -27, 7, -26, 2.7);
    barrel(-11.5, -31.5, 2); barrel(11.5, -31.5, 1); barrel(12.4, -30.9, 1);

    // ---- the orchard, south of the creek ----
    stone(-13, 13, -12, 25); stone(12, 13, 13, 25);
    for (const x of [-36.5, -31.5, -22.5, -17.5]) for (const z of [12.5, 18.5, 24.5]) tree(x + rand(-0.3, 0.3), z + rand(-0.3, 0.3), rand(0.82, 0.95), true, true);
    for (const x of [16.5, 20.2, 28, 32.5, 37]) for (const z of [12.5, 18.5, 24.5]) tree(x + rand(-0.3, 0.3), z + rand(-0.3, 0.3), rand(0.82, 0.95), true, true);
    for (const x of [-7.5, 7.5]) for (const z of [13.5, 19.5, 25.5]) tree(x, z, 0.9, true, true);
    crate(-30.6, 10, 1.2, 2); barrel(-23.4, 10.2, 2); barrel(-22.5, 9.6, 1); crate(5.2, 10.6, 1.2, 1); barrel(-5, 10.4, 2); crate(20.4, 9.8, 1.2, 2); barrel(27.6, 10.4, 1); barrel(28.4, 9.8, 2);
    hay(-27, 21, false, 1); cart(-5.5, 29.5, false); hay(24, 21.5, false, 2); crate(-34, 15.6, 1.2, 1); crate(34.6, 21.4, 1.2, 1); hay(0, 16, false, 1); hay(0.2, 22.4, true, 2);
    hay(-18, 33.5, true, 2); hay(18, 33.5, true, 2); barrel(-9, 30, 1); barrel(9, 30, 2);
    tree(-28, 37, 1.0); tree(28, 37, 1.0); tree(0, 38.2, 0.8);
    for (const [x, z, s] of [[-10.5, 27.5, 0.42], [-9.6, 28.4, 0.3], [10.6, 27.6, 0.4], [-38, 30, 0.45], [37.5, 29, 0.38]]) pumpkin(x, z, s);

    const pt = (x, z) => ({ x, z });
    return {
      corn: [],
      lanes: [
        [[-36, 31], [36, 31]], [[-27, 31], [-27, 8]], [[0, 31], [0, 8]], [[24, 31], [24, 8]], [[-38, 9.6], [38, 9.6]],
        [[-27, 1], [-27, -8]], [[0, 1], [0, -6], [-4, -12], [-15, -15], [-18, -15]], [[0, -6], [5, -8.5], [13, -8.5]], [[24, 1], [24, -5]], [[13, -1.5], [38, -1.5]], [[35.5, -1.5], [35.5, -5]],
        [[0, -31], [-12, -28], [-22.5, -24.5], [-22.5, -22]], [[0, -31], [14, -28], [28, -26.5], [28, -24]], [[-38, -1.5], [-38, -24.5], [-22.5, -24.5]], [[-38, -1.5], [-27, -1.5]],
        [[-9, -29], [-9, -25], [-4, -12]], [[9, -29], [9, -25], [5, -8.5]],
      ],
      soil: [], paved: [[13.2, -23.8, 26.6, 18.6, 26]], floors: [[-35.4, -21.4, -18.6, -8.6]],
      creeks: [{ pts: [[-41, 5], [41, 5]], w: 4 }],
      slowZones: [[-40, 3, -29, 7], [-25, 3, -3, 7], [3, 3, 22, 7], [26, 3, 40, 7]].map(([x1, z1, x2, z2]) => ({ x1, z1, x2, z2, f: 0.5 })),
      cluck: null,
      points: {
        A: pt(-27, -15), B: pt(25, -13), MID: pt(0, 10), YARD: pt(-2, -15), HERD: pt(0, 32), HANDS: pt(0, -31),
        W_S: pt(-27, 10), W_N: pt(-27, -0.5), M_S: pt(0, 10), M_N: pt(0, -1), E_S: pt(24, 10), E_N: pt(24, -1),
        A_E: pt(-15, -15), A_BACK: pt(-38, -3), A_NW: pt(-38, -24.5), A_N: pt(-22.5, -24), B_W: pt(8.5, -8.5), B_GATE: pt(24, -6.5), WADE_S: pt(11, 9.5), WADE_N: pt(11, -1),
      },
      routes: {
        A: [['W_S', 'W_N', 'A'], ['M_S', 'M_N', 'A_E', 'A'], ['W_S', 'W_N', 'A_BACK', 'A_NW', 'A_N', 'A']],
        B: [['E_S', 'E_N', 'B_GATE', 'B'], ['M_S', 'M_N', 'B_W', 'B'], ['WADE_S', 'WADE_N', 'B_W', 'B']],
      },
      holds: {
        A: [{ x: -34.5, z: -15.5, lx: -27, lz: -8 }, { x: -20.5, z: -12, lx: -18, lz: -15 }, { x: -19.6, z: -20.4, lx: -27, lz: -8 }, { x: -15, z: -11, lx: -27, lz: 0 }, { x: -26, z: -19.6, lx: -27, lz: -8 }],
        B: [{ x: 37.5, z: -21, lx: 24, lz: -4 }, { x: 15.5, z: -22, lx: 24, lz: -4 }, { x: 33, z: -17, lx: 24, lz: -4 }, { x: 21, z: -21.8, lx: 11, lz: -8 }, { x: 37.6, z: -9, lx: 24, lz: -4 }],
        MID: [{ x: 2.5, z: -11.2, lx: 0, lz: 1 }, { x: -6, z: -21.6, lx: 0, lz: 1 }, { x: 7.5, z: -6.2, lx: 0, lz: 1 }],
      },
      sites: { A: { x: -27, z: -15, r: 3.4 }, B: { x: 25, z: -13, r: 3.4 } },
    };
  }

  const L = (mapId === 'mill' ? layoutMill : layoutFarm)();

  // ---------- hedges drawn as one batch ----------
  const bushMesh = new T.InstancedMesh(sphereGeo(), new T.MeshLambertMaterial({ color: 0xffffff }), bushes.length);
  const dummy = new T.Object3D(), col = new T.Color();
  bushes.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z); dummy.scale.set(b.sx, b.sy, b.sz); dummy.updateMatrix();
    bushMesh.setMatrixAt(i, dummy.matrix); bushMesh.setColorAt(i, col.setHex(b.c));
  });
  bushMesh.castShadow = true; bushMesh.receiveShadow = true;
  root.add(bushMesh);

  // ---------- corn ----------
  const cornZones = [];
  if (L.corn.length) {
    const cornTex = canvasTexture(128, 256, (g) => {
      g.lineCap = 'round';
      g.strokeStyle = '#4c9a36'; g.lineWidth = 9; g.beginPath(); g.moveTo(64, 256); g.lineTo(64, 22); g.stroke();
      const leaf = (y, dir, len, colr) => { g.strokeStyle = colr; g.lineWidth = 13; g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + dir * len * 0.7, y - 46, 64 + dir * len, y - 6); g.stroke(); };
      leaf(240, 1, 52, '#5fb43f'); leaf(226, -1, 56, '#57a93a'); leaf(176, 1, 58, '#69c048'); leaf(158, -1, 54, '#5fb43f'); leaf(108, 1, 46, '#57a93a'); leaf(92, -1, 50, '#69c048'); leaf(48, 1, 30, '#69c048'); leaf(44, -1, 28, '#5fb43f');
      g.fillStyle = '#f4cf45'; g.beginPath(); g.ellipse(80, 128, 11, 26, 0.25, 0, 7); g.fill();
      g.fillStyle = '#8fd060'; g.beginPath(); g.ellipse(76, 142, 9, 18, 0.25, 0, 7); g.fill();
      g.fillStyle = '#e8c56a'; g.beginPath(); g.ellipse(64, 16, 10, 16, 0, 0, 7); g.fill();
    });
    owned.push(cornTex);
    const cornGeo = new T.BufferGeometry();
    const hw = 0.62, ch = 2.45;
    cornGeo.setAttribute('position', new T.Float32BufferAttribute([-hw, 0, 0, hw, 0, 0, hw, ch, 0, -hw, ch, 0, 0, 0, -hw, 0, 0, hw, 0, ch, hw, 0, ch, -hw], 3));
    cornGeo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2));
    cornGeo.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    cornGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const stalks = [];
    for (const [x1, x2, z1, z2] of L.corn) {
      cornZones.push({ x1, y1: 0, z1, x2, y2: 2.3, z2 });
      for (let x = x1 + 0.35; x < x2 - 0.2; x += 0.72) for (let z = z1 + 0.35; z < z2 - 0.2; z += 0.72) stalks.push([x + rand(-0.22, 0.22), z + rand(-0.22, 0.22)]);
    }
    const corn = new T.InstancedMesh(cornGeo, new T.MeshLambertMaterial({ map: cornTex, alphaTest: 0.45, side: T.DoubleSide }), stalks.length);
    stalks.forEach(([x, z], i) => {
      dummy.position.set(x, 0, z); dummy.rotation.set(0, rand(Math.PI), 0); dummy.scale.setScalar(rand(0.86, 1.14)); dummy.updateMatrix();
      corn.setMatrixAt(i, dummy.matrix);
    });
    dummy.rotation.set(0, 0, 0);
    corn.receiveShadow = true;
    root.add(corn);
  }

  // ---------- ground ----------
  // Painted surfaces (grass, dirt path, garden soil, market paving) are blended by a "mask" picture:
  // red in the mask means path, green means soil, blue means paving. Small details (creek, floors, flowers) sit on top.
  const P1 = (v, S) => (v + 48) * (S / 96);
  const maskTex = canvasTexture(1024, 1024, (g, S) => {
    const P = (v) => P1(v, S), m2p = S / 96;
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round'; g.lineJoin = 'round';
    const stroke = (pts, w, colr) => { g.strokeStyle = colr; g.lineWidth = w * m2p; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(P(x), P(z)) : g.moveTo(P(x), P(z)))); g.stroke(); };
    try { g.filter = 'blur(5px)'; } catch (e) { /* sharper edges on older browsers */ }
    L.lanes.forEach((l) => stroke(l, 2.9, '#ff0000'));
    g.fillStyle = '#00ff00';
    for (const [x, z, w, d, r] of L.soil) { roundRect(g, P(x), P(z), w * m2p, d * m2p, r); g.fill(); }
    for (const z of cornZones) { roundRect(g, P(z.x1 - 0.3), P(z.z1 - 0.3), (z.x2 - z.x1 + 0.6) * m2p, (z.z2 - z.z1 + 0.6) * m2p, 8); g.fill(); }
    g.fillStyle = '#0000ff';
    for (const [x, z, w, d, r] of L.paved) { roundRect(g, P(x), P(z), w * m2p, d * m2p, r); g.fill(); }
    g.filter = 'none'; g.globalCompositeOperation = 'source-over';
  });
  maskTex.encoding = T.LinearEncoding;
  const detailTex = canvasTexture(2048, 2048, (g, S) => {
    const P = (v) => P1(v, S), m2p = S / 96;
    g.clearRect(0, 0, S, S);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const stroke = (pts, w, colr) => { g.strokeStyle = colr; g.lineWidth = w * m2p; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(P(x), P(z)) : g.moveTo(P(x), P(z)))); g.stroke(); };
    for (const c of L.creeks) {
      try { g.filter = 'blur(4px)'; } catch (e) { /* fine */ }
      stroke(c.pts, c.w + 1.1, '#9be2fb');
      g.filter = 'none';
      stroke(c.pts, c.w, '#5fc4ef');
      // ripples
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
      for (let k = 0; k < c.pts.length - 1; k++) {
        const [ax, az] = c.pts[k], [bx, bz] = c.pts[k + 1], len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 1.3);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, x = ax + (bx - ax) * t + rand(-0.3, 0.3) * (c.w / 2.3), z = az + (bz - az) * t + rand(-0.4, 0.4) * (c.w / 2.3);
          g.beginPath(); g.moveTo(P(x - 0.3), P(z)); g.lineTo(P(x + 0.3), P(z + 0.08)); g.stroke();
        }
      }
    }
    // wooden floors inside buildings
    for (const [x1, z1, x2, z2] of L.floors) {
      g.fillStyle = '#d4a96f'; g.fillRect(P(x1), P(z1), (x2 - x1) * m2p, (z2 - z1) * m2p);
      g.strokeStyle = 'rgba(120,80,40,0.4)'; g.lineWidth = 2.5;
      for (let z = z1 + 0.6; z < z2; z += 0.9) { g.beginPath(); g.moveTo(P(x1), P(z)); g.lineTo(P(x2), P(z)); g.stroke(); }
    }
    // where the pumpkin can be planted
    for (const k of ['A', 'B']) { const st = L.sites[k]; g.strokeStyle = 'rgba(255,248,230,0.95)'; g.lineWidth = 0.28 * m2p; g.setLineDash([24, 16]); g.beginPath(); g.arc(P(st.x), P(st.z), st.r * m2p, 0, 7); g.stroke(); g.setLineDash([]); }
    // flowers on the farm, fallen leaves at the mill
    for (let i = 0; i < 1100; i++) { g.fillStyle = TH.specks[i % 4]; g.beginPath(); g.arc(rand(S), rand(S), rand(1.5, 3.2), 0, 7); g.fill(); }
  });
  const flat = (colr) => { const t = canvasTexture(4, 4, (g) => { g.fillStyle = colr; g.fillRect(0, 0, 4, 4); }); owned.push(t); return t; };
  owned.push(maskTex, detailTex);
  const uni = { dirtMap: { value: flat('#dcb98a') }, soilMap: { value: flat('#9b6b46') }, paveMap: { value: flat('#cfc7b6') }, maskMap: { value: maskTex }, detailMap: { value: detailTex } };
  const groundMat = new T.MeshLambertMaterial({ map: flat('#86cf58'), color: TH.grass });
  groundMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D dirtMap; uniform sampler2D soilMap; uniform sampler2D paveMap; uniform sampler2D maskMap; uniform sampler2D detailMap;')
      .replace('#include <map_fragment>', `
        vec2 tuv = vUv * 30.0;
        vec4 mk = texture2D( maskMap, vUv );
        vec3 gcol = mix( texture2D( map, tuv ).rgb, texture2D( map, tuv * 0.31 + 0.37 ).rgb, 0.4 ) * diffuseColor.rgb;
        vec3 col = mix( gcol, texture2D( dirtMap, tuv * 0.8 ).rgb, smoothstep( 0.15, 0.75, mk.r ) );
        col = mix( col, texture2D( soilMap, tuv * 0.8 ).rgb, smoothstep( 0.2, 0.8, mk.g ) );
        col = mix( col, texture2D( paveMap, tuv * 0.55 ).rgb * vec3( 1.08, 1.05, 0.98 ), smoothstep( 0.2, 0.8, mk.b ) );
        vec4 det = texture2D( detailMap, vUv );
        col = mix( col, det.rgb, det.a );
        diffuseColor.rgb = col;`);
  };
  let alive = true; // textures that arrive after the map was swapped out must not be applied
  const take = (t, use) => { if (!alive) { t.dispose(); return; } owned.push(t); use(t); };
  loadTexture('grass', (t) => take(t, () => { groundMat.map = t; groundMat.needsUpdate = true; }));
  loadTexture('dirt', (t) => take(t, () => { uni.dirtMap.value = t; }));
  loadTexture('soil', (t) => take(t, () => { uni.soilMap.value = t; }));
  if (L.paved.length) loadTexture('stone', (t) => take(t, () => { uni.paveMap.value = t; }));
  const ground = new T.Mesh(new T.PlaneGeometry(96, 96), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData.keep = true;
  root.add(ground);
  const outer = new T.Mesh(new T.CircleGeometry(420, 40), mat(TH.outer));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.06;
  root.add(outer);

  // ---------- scenery beyond the hedge ----------
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand(0.2), d = rand(120, 230), s = rand(40, 85);
    add(root, sphereGeo(), TH.hills[i % 2], Math.cos(a) * d, -s * 0.18, Math.sin(a) * d, { s: [s, s * rand(0.3, 0.5), s], cast: false, receive: false });
  }
  for (let i = 0; i < 26; i++) {
    const a = rand(Math.PI * 2), d = rand(47, 80);
    tree(Math.cos(a) * d * 1.05, Math.sin(a) * d * 1.05, rand(1.0, 1.7), false);
  }
  // windmill landmark
  const mill = group(root, TH.mill[0], 0, TH.mill[1]);
  add(mill, cylGeo(1.6, 2.8, 12, 12), 0xfff1d6, 0, 6, 0);
  add(mill, coneGeo(2.2, 2.4, 12), C.coopRoof, 0, 13.2, 0);
  const blades = group(mill, TH.mill[0] < 0 ? 2.0 : -2.0, 11, 1.2);
  blades.rotation.y = TH.mill[0] < 0 ? 0.9 : -0.9;
  for (let i = 0; i < 4; i++) { const b = add(blades, rboxGeo(0.8, 7, 0.1, 0.04), C.trim, 0, 0, 0.3); b.geometry = b.geometry.clone().translate(0, 3.8, 0); b.rotation.z = (i * Math.PI) / 2; b.userData.keep = true; }
  animated.push((t) => { blades.children.forEach((b, i) => { b.rotation.z = t * 0.5 + (i * Math.PI) / 2; }); });
  // clouds
  const clouds = group(root);
  for (let i = 0; i < 12; i++) {
    const c = group(clouds, rand(-220, 220), rand(55, 85), rand(-220, 220));
    const cm = new T.MeshBasicMaterial({ color: 0xffffff, fog: false });
    for (let k = 0; k < 4; k++) { const p = new T.Mesh(sphereGeo(), cm); p.position.set(k * 5 - 7 + rand(-1, 1), rand(-1, 1), rand(-2, 2)); p.scale.set(rand(5, 8), rand(3, 4.5), rand(4, 6)); c.add(p); }
  }
  animated.push((t, dt) => { clouds.children.forEach((c) => { c.position.x += dt * 1.2; if (c.position.x > 240) c.position.x = -240; }); });
  // sky dome
  const skyTex = canvasTexture(16, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, TH.sky[0]); gr.addColorStop(0.45, TH.sky[1]); gr.addColorStop(0.62, TH.sky[2]); gr.addColorStop(1, TH.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  });
  owned.push(skyTex);
  const sky = new T.Mesh(new T.SphereGeometry(400, 20, 14), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false }));
  root.add(sky);

  bakeTree(root);

  // ---------- lights ----------
  scene.fog = new T.Fog(TH.fog, 130, 520);
  const hemi = new T.HemisphereLight(TH.hemi[0], TH.hemi[1], TH.hemi[2]);
  scene.add(hemi);
  const sun = new T.DirectionalLight(TH.sun[0], TH.sun[1]);
  sun.position.set(...TH.sun[2]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -58, right: 58, top: 58, bottom: -58, near: 1, far: 160 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun);

  const spawns = {
    attack: [[0, 33], [-3, 33.6], [3, 33.6], [-6, 34.4], [6, 34.4]].map(([x, z]) => ({ x, z, yaw: 0 })),
    defend: [[0, -31], [-3, -31.5], [3, -31.5], [-6, -32], [6, -32]].map(([x, z]) => ({ x, z, yaw: Math.PI })),
  };
  const slowZones = L.slowZones;
  return {
    id: mapId, name: MAPS[mapId].name, boxes, cornZones, points: L.points, routes: L.routes, holds: L.holds, spawns, sites: L.sites, animated, half: 40,
    slowZones, cluck: L.cluck,
    // how much slower you move here (1 = normal): wading through the creek is slow
    slowAt(x, z) { for (const s of slowZones) if (x > s.x1 && x < s.x2 && z > s.z1 && z < s.z2) return s.f; return 1; },
    // take this map out of the scene so another can be built
    dispose() {
      alive = false;
      scene.remove(root); scene.remove(hemi); scene.remove(sun);
      sun.shadow.map && sun.shadow.map.dispose();
      root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
      for (const t of owned) t.dispose();
      groundMat.dispose();
    },
  };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
