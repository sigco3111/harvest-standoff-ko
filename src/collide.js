// Collision against axis-aligned boxes: {x1,y1,z1,x2,y2,z2}
const EPS = 1e-3;

export function overlaps(px, py, pz, r, h, b) {
  return px + r > b.x1 && px - r < b.x2 && pz + r > b.z1 && pz - r < b.z2 && py < b.y2 && py + h > b.y1;
}

// Moves p by v*dt one axis at a time, sliding along anything solid. Returns true if standing on something.
export function moveAndCollide(p, v, dt, r, h, boxes) {
  let onGround = false;
  const n = boxes.length;

  p.x += v.x * dt;
  for (let i = 0; i < n; i++) {
    const b = boxes[i];
    if (overlaps(p.x, p.y, p.z, r, h, b)) {
      if (v.x > 0) p.x = b.x1 - r - EPS;
      else if (v.x < 0) p.x = b.x2 + r + EPS;
      v.x = 0;
    }
  }
  p.z += v.z * dt;
  for (let i = 0; i < n; i++) {
    const b = boxes[i];
    if (overlaps(p.x, p.y, p.z, r, h, b)) {
      if (v.z > 0) p.z = b.z1 - r - EPS;
      else if (v.z < 0) p.z = b.z2 + r + EPS;
      v.z = 0;
    }
  }
  p.y += v.y * dt;
  for (let i = 0; i < n; i++) {
    const b = boxes[i];
    if (overlaps(p.x, p.y, p.z, r, h, b)) {
      if (v.y <= 0) { p.y = b.y2; onGround = true; } else { p.y = b.y1 - h - EPS; }
      v.y = 0;
    }
  }
  if (p.y <= 0) { p.y = 0; if (v.y < 0) v.y = 0; onGround = true; }
  return onGround;
}

const hitInfo = { axis: -1, sign: 0 };

// Ray vs box (slab test). Returns entry distance or -1. Fills hitInfo with the face that was entered.
export function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0, tmax = Infinity, axis = -1, sign = 0;
  if (Math.abs(dx) < 1e-9) { if (ox < b.x1 || ox > b.x2) return -1; } else {
    const inv = 1 / dx; let t1 = (b.x1 - ox) * inv, t2 = (b.x2 - ox) * inv, s = -1;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = 0; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-9) { if (oy < b.y1 || oy > b.y2) return -1; } else {
    const inv = 1 / dy; let t1 = (b.y1 - oy) * inv, t2 = (b.y2 - oy) * inv, s = -1;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = 1; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < b.z1 || oz > b.z2) return -1; } else {
    const inv = 1 / dz; let t1 = (b.z1 - oz) * inv, t2 = (b.z2 - oz) * inv, s = -1;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = 2; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  hitInfo.axis = axis; hitInfo.sign = sign;
  return tmin;
}

// Nearest solid hit along a ray, including the ground plane at y=0. Returns null or {t,nx,ny,nz}.
const result = { t: 0, nx: 0, ny: 0, nz: 0 };
export function raycast(ox, oy, oz, dx, dy, dz, maxT, boxes) {
  let best = maxT, found = false, axis = -1, sign = 0;
  for (let i = 0; i < boxes.length; i++) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, boxes[i]);
    if (t >= 0 && t < best) { best = t; found = true; axis = hitInfo.axis; sign = hitInfo.sign; }
  }
  if (dy < -1e-9) {
    const t = -oy / dy;
    if (t >= 0 && t < best) { best = t; found = true; axis = 1; sign = 1; }
  }
  if (!found) return null;
  result.t = best;
  result.nx = axis === 0 ? sign : 0;
  result.ny = axis === 1 ? sign : axis === -1 ? 1 : 0;
  result.nz = axis === 2 ? sign : 0;
  return result;
}

// True when nothing solid sits between two points.
export function losClear(ax, ay, az, bx, by, bz, boxes) {
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return true;
  dx /= d; dy /= d; dz /= d;
  for (let i = 0; i < boxes.length; i++) {
    const t = rayBox(ax, ay, az, dx, dy, dz, boxes[i]);
    if (t >= 0 && t < d) return false;
  }
  return true;
}

// How many metres of the segment a->b pass through any of the given zones (used for the cornfield).
export function lengthInside(ax, ay, az, bx, by, bz, zones) {
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return 0;
  dx /= d; dy /= d; dz /= d;
  let total = 0;
  for (let i = 0; i < zones.length; i++) {
    const b = zones[i];
    let tmin = 0, tmax = d, ok = true;
    const o = [ax, ay, az], dd = [dx, dy, dz], lo = [b.x1, b.y1, b.z1], hi = [b.x2, b.y2, b.z2];
    for (let k = 0; k < 3 && ok; k++) {
      if (Math.abs(dd[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) ok = false; } else {
        let t1 = (lo[k] - o[k]) / dd[k], t2 = (hi[k] - o[k]) / dd[k];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) ok = false;
      }
    }
    if (ok) total += tmax - tmin;
  }
  return total;
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const mx = ox - cx, my = oy - cy, mz = oz - cz;
  const b = mx * dx + my * dy + mz * dz;
  const c = mx * mx + my * my + mz * mz - r * r;
  if (c > 0 && b > 0) return -1;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t < 0 ? 0 : t;
}
