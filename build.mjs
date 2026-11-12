// Bundles everything in src/ into a single web page.
// KO FORK: by default the finished site is written to the repository ROOT (index.html, vendor/, assets/audio.mp3 next to the
// source assets/) so GitHub Pages can serve it from main/(root). `node build.mjs --out=dist` gives the original dist/ layout.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, existsSync } from 'node:fs';

const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '--out=.').slice(6);
const ROOT = OUT === '.';

// All sounds are glued into ONE file (faster to load, far fewer files to publish); the game gets a table of
// where each sound starts and how long it is.
if (!existsSync('assets/audio')) { console.error('assets/audio 폴더가 없어요. 원작 저장소(andreteow/farm-ca)의 assets/audio 를 이 자리에 복사한 뒤 다시 실행하세요.'); process.exit(1); }
const sounds = readdirSync('assets/audio').filter((f) => f.endsWith('.mp3')).sort();
const table = {}, chunks = [];
let offset = 0;
for (const f of sounds) { const b = readFileSync(`assets/audio/${f}`); table[f.slice(0, -4)] = [offset, b.length]; offset += b.length; chunks.push(b); }
writeFileSync('src/audio-pack.js', `// made by build.mjs, do not edit\nexport const AUDIO_PACK = ${JSON.stringify(table)};\n`);

const out = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: process.argv.includes('--min'), write: false, target: 'es2020' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = readFileSync('src/page.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
mkdirSync(`${OUT}/assets`, { recursive: true });
if (!ROOT) {
  // pictures and sounds travel next to the page
  rmSync(`${OUT}/assets`, { recursive: true, force: true });
  cpSync('assets/tex', `${OUT}/assets/tex`, { recursive: true });
  cpSync('assets/ui', `${OUT}/assets/ui`, { recursive: true });
  if (existsSync('assets/chars')) cpSync('assets/chars', `${OUT}/assets/chars`, { recursive: true });
}
writeFileSync(`${OUT}/assets/audio.mp3`, Buffer.concat(chunks));
// the fragment used for the shareable preview page
if (!ROOT) writeFileSync(`${OUT}/harvest-standoff.html`, page);
// A complete stand-alone page for the public website. Unlike the preview fragment it loads NOTHING from other
// companies' servers: the 3D library and the fonts are copied next to the page.
mkdirSync(`${OUT}/vendor`, { recursive: true });
if (existsSync('node_modules/three/build/three.min.js')) cpSync('node_modules/three/build/three.min.js', `${OUT}/vendor/three.min.js`);
if (!ROOT) cpSync('assets/fonts', `${OUT}/assets/fonts`, { recursive: true });
const fontCss = `<style>
@font-face { font-family: "Lilita One"; font-weight: 400; font-display: swap; src: url(assets/fonts/lilita-one.woff2) format("woff2"); }
@font-face { font-family: "Nunito"; font-weight: 200 1000; font-display: swap; src: url(assets/fonts/nunito.woff2) format("woff2"); }
</style>`;
const cut = page.indexOf('</style>') + '</style>'.length;
const headPart = page.slice(0, cut)
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, fontCss)
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
const bodyPart = page.slice(cut).replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/[^/]+\/three\.min\.js/, 'vendor/three.min.js');
const about = '하베스트 스탠드오프 한글화: 농장 동물 팀 대 농부 팀의 5대5 1인칭 물총 대결! 악취 호박을 몰래 심거나 제때 코르크로 막고, 마지막까지 살아남으세요. 다치는 사람은 없고 엉망진창만 있을 뿐이에요. (비공식 한글화, 원작: andreteow/farm-ca)';
const SITE = 'https://sigco3111.github.io/harvest-standoff-ko/';
writeFileSync(`${OUT}/index.html`, `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${about}">
<meta name="theme-color" content="#8fd0fb">
<meta property="og:title" content="하베스트 스탠드오프 (한글화)">
<meta property="og:description" content="${about}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}assets/ui/share.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="assets/ui/favicon.png">
<style>html,body{margin:0}[hidden]{display:none!important}</style>
${headPart}
</head>
<body>
${bodyPart}
</body>
</html>
`);
console.log(`built: ${(page.length / 1024).toFixed(0)} KB`);
