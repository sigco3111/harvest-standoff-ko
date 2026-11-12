// Shared building blocks for everything we draw: cached shapes and colours.
const T = window.THREE;
// treat every colour we type as a normal screen colour, so the farm looks as bright as intended
T.ColorManagement.legacyMode = false;

const mats = new Map();
export function mat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  let m = mats.get(key);
  if (!m) { m = new T.MeshLambertMaterial({ color, ...(opts || {}) }); mats.set(key, m); }
  return m;
}

const geos = new Map();
function cached(key, make) {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g;
}
export const sphereGeo = () => cached('s', () => new T.SphereGeometry(1, 16, 12));
export const sphereLoGeo = () => cached('sl', () => new T.SphereGeometry(1, 12, 9));
export const capsuleGeo = (r, len) => cached(`c${r}|${len}`, () => new T.CapsuleGeometry(r, len, 6, 14));
export const cylGeo = (rt, rb, h, seg = 18) => cached(`y${rt}|${rb}|${h}|${seg}`, () => new T.CylinderGeometry(rt, rb, h, seg));
export const coneGeo = (r, h, seg = 14) => cached(`k${r}|${h}|${seg}`, () => new T.ConeGeometry(r, h, seg));
export const torusGeo = (r, t, arc = Math.PI * 2) => cached(`t${r}|${t}|${arc}`, () => new T.TorusGeometry(r, t, 8, 20, arc));

// A box with softened edges, so nothing in the world looks like a hard-cornered cube.
export function rboxGeo(w, h, d, r = 0.08) {
  r = Math.max(0.005, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
  return cached(`b${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`, () => {
    const b = r * 0.55;
    const hw = w / 2 - b, hh = h / 2 - b, cr = r * 0.5;
    const s = new T.Shape();
    s.moveTo(-hw + cr, -hh);
    s.lineTo(hw - cr, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
    s.lineTo(hw, hh - cr); s.quadraticCurveTo(hw, hh, hw - cr, hh);
    s.lineTo(-hw + cr, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
    s.lineTo(-hw, -hh + cr); s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
    const depth = Math.max(0.002, d - 2 * b);
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -depth / 2);
    return g;
  });
}

// Add a mesh to a parent in one line.
export function add(parent, geo, color, x = 0, y = 0, z = 0, o = {}) {
  const m = new T.Mesh(geo, typeof color === 'number' ? mat(color, o.mat) : color);
  m.position.set(x, y, z);
  if (o.s !== undefined) { if (Array.isArray(o.s)) m.scale.set(o.s[0], o.s[1], o.s[2]); else m.scale.setScalar(o.s); }
  if (o.r) m.rotation.set(o.r[0] || 0, o.r[1] || 0, o.r[2] || 0);
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.receive !== false;
  parent.add(m);
  return m;
}

export function group(parent, x = 0, y = 0, z = 0) {
  const g = new T.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding;
  t.anisotropy = 8;
  return t;
}

// Hand-drawn surface patterns so big walls are not flat slabs of colour.
const texMats = new Map();
export function texMat(kind) {
  let m = texMats.get(kind);
  if (m) return m;
  const S = 256;
  let repeat = 0.4;
  const tex = canvasTexture(S, S, (g) => {
    const lines = (n, colr, w, vertical) => { g.strokeStyle = colr; g.lineWidth = w; for (let i = 0; i < n; i++) { const p = (i + 0.5) * (S / n); g.beginPath(); if (vertical) { g.moveTo(p, 0); g.lineTo(p, S); } else { g.moveTo(0, p); g.lineTo(S, p); } g.stroke(); } };
    const streaks = (n, colrs, len, vertical) => { for (let i = 0; i < n; i++) { g.strokeStyle = colrs[i % colrs.length]; g.lineWidth = 1 + Math.random() * 2; g.globalAlpha = 0.25 + Math.random() * 0.35; const x = Math.random() * S, y = Math.random() * S, l = len * (0.4 + Math.random()); g.beginPath(); g.moveTo(x, y); g.lineTo(vertical ? x : x + l, vertical ? y + l : y); g.stroke(); } g.globalAlpha = 1; };
    if (kind === 'planks' || kind === 'wood') {
      g.fillStyle = kind === 'planks' ? '#d9463e' : '#dcae72'; g.fillRect(0, 0, S, S);
      streaks(120, kind === 'planks' ? ['#e25a50', '#c53a33'] : ['#e8bf88', '#c99a5e'], 90, true);
      lines(8, kind === 'planks' ? '#a92f29' : '#b58a52', 4, true);
    } else if (kind === 'stone') {
      g.fillStyle = '#a39c8d'; g.fillRect(0, 0, S, S);
      const rows = 5, rh = S / rows;
      for (let r = 0; r < rows; r++) {
        let x = -((r % 2) * 30) - Math.random() * 20;
        while (x < S) {
          const w = 44 + Math.random() * 44;
          g.fillStyle = ['#d6cfbf', '#cbc3b1', '#dedacd', '#c4bba8'][(Math.random() * 4) | 0];
          for (const ox of [0, S]) { g.beginPath(); const X = x + ox - (x > S - w ? S : 0) + 3, Y = r * rh + 3, W = w - 6, Hh = rh - 6, R = 11; g.moveTo(X + R, Y); g.arcTo(X + W, Y, X + W, Y + Hh, R); g.arcTo(X + W, Y + Hh, X, Y + Hh, R); g.arcTo(X, Y + Hh, X, Y, R); g.arcTo(X, Y, X + W, Y, R); g.fill(); if (x <= S - w) break; }
          x += w;
        }
      }
    } else if (kind === 'shingle') {
      repeat = 0.3;
      g.fillStyle = '#7a4f3e'; g.fillRect(0, 0, S, S);
      lines(8, '#5f3c30', 4, false);
      streaks(120, ['#8d6150', '#6a4335'], 30, true);
    } else if (kind === 'hay') {
      repeat = 1;
      g.fillStyle = '#f3cf62'; g.fillRect(0, 0, S, S);
      streaks(260, ['#fbe08a', '#d9ae3f', '#e9c04e'], 70, false);
    } else {
      repeat = 0.83;
      g.fillStyle = '#d2a468'; g.fillRect(0, 0, S, S);
      streaks(80, ['#e0b77c', '#bd8d52'], 110, false);
      lines(4, '#a87a45', 5, false);
    }
  });
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  m = new T.MeshLambertMaterial({ map: tex, side: kind === 'shingle' ? T.DoubleSide : T.FrontSide });
  texMats.set(kind, m);
  // the painted version (assets/tex) takes over as soon as it has loaded
  const file = { planks: 'barn', wood: 'timber', stone: 'stone', hay: 'hay', crate: 'crate', shingle: 'shingle' }[kind];
  const scale = { planks: 0.4, wood: 0.4, stone: 0.3, hay: 0.6, crate: 0.8, shingle: 0.3 }[kind];
  if (file) loadTexture(file, (img) => {
    if (kind === 'crate') { img.wrapS = img.wrapT = T.RepeatWrapping; img.offset.set(0.5, 0.5); }
    img.repeat.set(scale, scale);
    m.map = img; m.needsUpdate = true;
  });
  return m;
}

const loader = new T.TextureLoader();
export function loadTexture(file, onLoad) {
  loader.load(`assets/tex/${file}.jpg`, (img) => {
    img.encoding = T.sRGBEncoding; img.anisotropy = 8;
    img.wrapS = img.wrapT = T.MirroredRepeatWrapping; // mirrored tiling hides any seam at the edges
    onLoad(img);
  }, undefined, () => { /* keep the hand-drawn pattern */ });
}

// ---------- baking: squash many small shapes into a few big ones so slow computers keep up ----------
const flatCache = new WeakMap();
function flat(g) {
  if (!g.index) return g;
  let f = flatCache.get(g);
  if (!f) { f = g.toNonIndexed(); flatCache.set(g, f); }
  return f;
}
let bakedMat = null;

// Merges the given meshes into as few meshes as possible, living inside `space`.
// Plain-coloured shapes all become ONE mesh (colour is stored per corner); textured ones merge per texture.
export function bake(meshes, space) {
  if (!bakedMat) bakedMat = new T.MeshLambertMaterial({ vertexColors: true });
  space.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(space.matrixWorld).invert();
  const buckets = new Map(), v = new T.Vector3(), m4 = new T.Matrix4(), n3 = new T.Matrix3();
  for (const m of meshes) {
    const mt = m.material;
    const plain = mt.isMeshLambertMaterial && !mt.map && !mt.transparent && mt.side === T.FrontSide && !mt.vertexColors;
    const key = (plain ? 'plain' : mt.uuid) + (m.castShadow ? 'c' : '-') + (m.receiveShadow ? 'r' : '-');
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { plain, material: mt, cast: m.castShadow, receive: m.receiveShadow, pos: [], nor: [], uv: [], col: [] }));
    m.updateMatrixWorld(true);
    m4.multiplyMatrices(inv, m.matrixWorld); n3.getNormalMatrix(m4);
    const g = flat(m.geometry), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, c = mt.color;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m4); b.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(n3).normalize(); b.nor.push(v.x, v.y, v.z);
      if (plain) b.col.push(c.r, c.g, c.b); else b.uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
    }
    m.parent.remove(m);
  }
  const out = [];
  for (const b of buckets.values()) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(b.nor, 3));
    if (b.plain) g.setAttribute('color', new T.Float32BufferAttribute(b.col, 3)); else g.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2));
    const mesh = new T.Mesh(g, b.plain ? bakedMat : b.material);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.receive;
    space.add(mesh); out.push(mesh);
  }
  return out;
}
const bakeable = (o) => o.isMesh && !o.isInstancedMesh && !o.userData.keep && o.material.isMeshLambertMaterial && !o.material.transparent;
export function bakeChildren(g) { const list = g.children.filter(bakeable); if (list.length > 1) bake(list, g); }
export function bakeTree(root) { const list = []; root.traverse((o) => { if (bakeable(o)) list.push(o); }); bake(list, root); }
