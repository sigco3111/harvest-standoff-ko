export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const TAU = Math.PI * 2;

// shortest signed difference between two angles
export function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function approach(cur, target, maxStep) {
  const d = target - cur;
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// yaw 0 looks toward -z (north); positive yaw turns left (west)
export const dirX = (yaw, pitch = 0) => -Math.sin(yaw) * Math.cos(pitch);
export const dirY = (pitch) => Math.sin(pitch);
export const dirZ = (yaw, pitch = 0) => -Math.cos(yaw) * Math.cos(pitch);
export const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
