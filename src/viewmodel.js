// What you see in your own hands in first-person view. Drawn in its own layer so it never pokes into walls.
import { add, group, sphereGeo, capsuleGeo } from './gfx.js';
import { buildGadget } from './characters.js';
import { GADGETS } from './config.js';

const T = window.THREE;

export function createViewModel() {
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(50, 1, 0.01, 10);
  scene.add(new T.HemisphereLight(0xffffff, 0xb0d090, 0.85));
  const sun = new T.DirectionalLight(0xfff2d6, 0.6); sun.position.set(-1, 2, 1.5); scene.add(sun);
  const holder = group(scene, 0, 0, 0);
  const gadgets = {};
  for (const id in GADGETS) { const m = buildGadget(id); m.scale.setScalar(id === 'pea' ? 0.78 : 1.0); if (id === 'pea') m.position.set(0, 0.01, -0.1); m.visible = false; holder.add(m); gadgets[id] = m; m.traverse((o) => { o.castShadow = false; o.receiveShadow = false; }); }
  const hand = add(holder, sphereGeo(), 0xffffff, 0, -0.07, 0.05, { s: [0.07, 0.075, 0.075], cast: false, receive: false });
  const arm = add(holder, capsuleGeo(0.055, 0.4), 0xffffff, 0.06, -0.2, 0.27, { r: [1.0, 0, -0.2], cast: false, receive: false });
  hand.material = new T.MeshLambertMaterial({ color: 0xffffff }); arm.material = new T.MeshLambertMaterial({ color: 0xffffff });
  let current = null, kick = 0, raise = 1, bobT = 0;

  return {
    scene, cam,
    setColors(handColor, armColor) { hand.material.color.setHex(handColor); arm.material.color.setHex(armColor); },
    set(id) { if (current === id) return; current = id; for (const k in gadgets) gadgets[k].visible = k === id; raise = 1; },
    fire() { kick = 1; },
    resize(aspect) { cam.aspect = aspect; cam.updateProjectionMatrix(); },
    update(dt, actor) {
      if (current !== actor.gadgetId) this.set(actor.gadgetId);
      kick *= Math.exp(-16 * dt);
      raise *= Math.exp(-9 * dt);
      const sp = actor.speed2d(), k = actor.onGround ? Math.min(1, sp / 6) : 0;
      bobT += dt * (5 + sp * 1.3);
      let dip = raise * 0.16;
      if (actor.reloadT > 0) { const g = GADGETS[actor.gadgetId]; dip += Math.sin(Math.PI * (1 - actor.reloadT / g.reload)) * 0.2; }
      holder.position.set(0.25 + Math.sin(bobT) * 0.008 * k, -0.225 - Math.abs(Math.cos(bobT)) * 0.01 * k - dip, -0.66 + kick * 0.05);
      holder.rotation.set(kick * 0.12 - dip * 1.6, 0.05, -dip * 0.5);
    },
  };
}
