// Path-finding for computer players: a 1-metre grid laid over the map, searched with A*.
const R = 0.45; // how much room a character needs from a wall

export function buildNav(world) {
  const half = world.half, N = half * 2;
  const blocked = new Uint8Array(N * N);
  const obstacles = world.boxes.filter((b) => b.y1 < 1.6 && b.y2 > 0.3);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -half + i + 0.5, z = -half + j + 0.5;
    for (const b of obstacles) {
      if (x > b.x1 - R && x < b.x2 + R && z > b.z1 - R && z < b.z2 + R) { blocked[j * N + i] = 1; break; }
    }
  }
  // some ground is slow to cross (the creek): paths through it cost more, so bridges are preferred
  const slow = new Float32Array(N * N).fill(1);
  for (const z of world.slowZones || []) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -half + i + 0.5, y = -half + j + 0.5;
    if (x > z.x1 && x < z.x2 && y > z.z1 && y < z.z2) slow[j * N + i] = 1 / z.f + 0.6;
  }
  const ci = (x) => Math.max(0, Math.min(N - 1, Math.floor(x + half)));
  const isBlocked = (x, z) => x <= -half || x >= half || z <= -half || z >= half || blocked[ci(z) * N + ci(x)] === 1;

  function nearestFree(x, z) {
    if (!isBlocked(x, z)) return { x, z };
    // the closest open square as the crow flies, so someone pressed against a wall stays on their own side of it
    let best = null, bestD = 1e9;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const i = ci(x) + di, j = ci(z) + dj;
      if (i < 0 || j < 0 || i >= N || j >= N || blocked[j * N + i]) continue;
      const cx = -half + i + 0.5, cz = -half + j + 0.5, d = (cx - x) * (cx - x) + (cz - z) * (cz - z);
      if (d < bestD) { bestD = d; best = { x: cx, z: cz }; }
    }
    if (best) return best;
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = ci(x) + di, j = ci(z) + dj;
      if (i < 0 || j < 0 || i >= N || j >= N || blocked[j * N + i]) continue;
      return { x: -half + i + 0.5, z: -half + j + 0.5 };
    }
    return { x, z };
  }

  function segmentClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.3);
    for (let k = 0; k <= n; k++) {
      const t = n ? k / n : 0, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (isBlocked(x, z) || isBlocked(x + 0.3, z) || isBlocked(x - 0.3, z) || isBlocked(x, z + 0.3) || isBlocked(x, z - 0.3)) return false;
    }
    return true;
  }

  const g = new Float32Array(N * N), f = new Float32Array(N * N), came = new Int32Array(N * N), state = new Uint8Array(N * N);
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

  // Returns a list of {x,z} points to walk through, or null when there is no way.
  function findPath(sx, sz, tx, tz, wobble = 0) {
    const s = nearestFree(sx, sz), t = nearestFree(tx, tz);
    const si = ci(s.x), sj = ci(s.z), ti = ci(t.x), tj = ci(t.z);
    const start = sj * N + si, goal = tj * N + ti;
    state.fill(0);
    const heap = [start];
    g[start] = 0; f[start] = 0; came[start] = -1; state[start] = 1;
    let found = false;
    while (heap.length) {
      let bi = 0;
      for (let k = 1; k < heap.length; k++) if (f[heap[k]] < f[heap[bi]]) bi = k;
      const cur = heap[bi];
      heap[bi] = heap[heap.length - 1]; heap.pop();
      if (cur === goal) { found = true; break; }
      state[cur] = 2;
      const cx = cur % N, cz = (cur / N) | 0;
      for (const [dx, dz, cost] of DIRS) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const ni = nz * N + nx;
        if (blocked[ni] || state[ni] === 2) continue;
        if (dx && dz && (blocked[cz * N + nx] || blocked[nz * N + cx])) continue;
        const ng = g[cur] + cost * slow[ni] * (1 + (wobble ? Math.random() * wobble : 0));
        if (state[ni] === 1 && ng >= g[ni]) continue;
        g[ni] = ng; came[ni] = cur;
        const hx = Math.abs(nx - ti), hz = Math.abs(nz - tj);
        f[ni] = ng + Math.max(hx, hz) + 0.414 * Math.min(hx, hz);
        if (state[ni] !== 1) { state[ni] = 1; heap.push(ni); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = goal; c !== -1; c = came[c]) cells.push({ x: -half + (c % N) + 0.5, z: -half + ((c / N) | 0) + 0.5 });
    cells.reverse();
    // straighten: skip any corner we can walk past in a straight line
    const out = [cells[0]];
    let a = 0;
    while (a < cells.length - 1) {
      let b = Math.min(cells.length - 1, a + 14);
      while (b > a + 1 && !segmentClear(cells[a].x, cells[a].z, cells[b].x, cells[b].z)) b--;
      out.push(cells[b]);
      a = b;
    }
    return out;
  }

  return { findPath, isBlocked, nearestFree, segmentClear, blocked, N, half };
}
