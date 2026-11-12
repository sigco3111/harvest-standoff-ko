// Subtitles for the recorded voice lines (announcer, farmer radio, animal radio).
// audio.js calls show(clipName, seconds) whenever a voice clip really starts playing; the text comes from the language files (vo.<clip>).
// Korean mode shows the Korean translation, English mode shows the original English. The on/off choice is saved in localStorage ('hs-subs').
import { t } from './i18n.js';

const KEY = 'hs-subs';
const MAX_LINES = 2;

export function createSubtitles() {
  const box = document.getElementById('subs');
  let on = true;
  try { if (localStorage.getItem(KEY) === '0') on = false; } catch (e) { /* default: on */ }
  let lines = []; // { clip, until, timer }

  const speaker = (clip) => (clip.startsWith('ann_') ? 'sub.ann' : clip.startsWith('hands_') ? 'sub.hands' : 'sub.herd');
  function draw() {
    box.textContent = '';
    box.hidden = !on || !lines.length;
    if (box.hidden) return;
    for (const l of lines) {
      const row = document.createElement('div');
      row.className = 'sub ' + speaker(l.clip).slice(4);
      const who = document.createElement('b'); who.textContent = t(speaker(l.clip));
      row.append(who, ' ', t('vo.' + l.clip));
      box.append(row);
    }
  }
  function drop(l) { lines = lines.filter((x) => x !== l); clearTimeout(l.timer); draw(); }
  function show(clip, seconds) {
    if (t('vo.' + clip) === 'vo.' + clip) return false; // no text for this clip (animal noises)
    const hold = Math.max(1.2, seconds + 0.4) * 1000;
    // one line per speaker: a new announcer / farmer / animal line replaces that speaker's previous one
    for (const old of lines.filter((x) => x.clip !== clip && speaker(x.clip) === speaker(clip))) drop(old);
    let l = lines.find((x) => x.clip === clip);
    if (l) clearTimeout(l.timer); else { l = { clip }; lines.push(l); }
    l.timer = setTimeout(() => drop(l), hold);
    while (lines.length > MAX_LINES) drop(lines[0]);
    draw();
    return true;
  }
  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* not saved */ }
    sync(); draw();
  }
  function sync() { document.querySelectorAll('.subs-sw button').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.subs === '1') === on))); }
  document.querySelectorAll('.subs-sw button').forEach((b) => b.addEventListener('click', () => setOn(b.dataset.subs === '1')));
  sync();
  return { show, setOn, redraw: draw, isOn: () => on };
}
