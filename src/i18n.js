// Tiny language system: Korean (default) and English. t('key', { param }) looks a string up; the choice is saved in localStorage.
// Static page text carries data-i18n="key" (or data-i18n-alt / data-i18n-aria / data-i18n-title) and is filled in by applyI18n().
import { KO } from './lang-ko.js';
import { EN } from './lang-en.js';

const DICT = { ko: KO, en: EN };
const KEY = 'hs-lang';
let lang = 'ko';
try { const s = localStorage.getItem(KEY); if (s === 'ko' || s === 'en') lang = s; } catch (e) { /* default language */ }
const listeners = [];

export const getLang = () => lang;
// numbers follow the active language (ko-KR / en-US)
export const fmt = (n) => Number(n).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US');
export function t(key, params) {
  let s = DICT[lang][key];
  if (s === undefined) s = DICT.en[key];
  if (s === undefined) return key;
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m)) : s;
}
export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  document.title = t('title');
  root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  for (const [attr, target] of [['i18nAlt', 'alt'], ['i18nAria', 'aria-label'], ['i18nTitle', 'title']]) {
    root.querySelectorAll(`[data-${attr.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`).forEach((n) => n.setAttribute(target, t(n.dataset[attr])));
  }
  document.querySelectorAll('.lang-sw button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
}
export function setLang(l) {
  if (!DICT[l] || l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch (e) { /* not saved */ }
  applyI18n();
  listeners.forEach((f) => f());
}
export const onLangChange = (f) => listeners.push(f);
