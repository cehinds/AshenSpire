// tools/store-assets.mjs — generate the Steam store asset set from the game's
// own visual language, at Steam's required sizes, into store/.
//
//   node tools/store-assets.mjs             → render every asset + verify
//   node tools/store-assets.mjs --only NAME → render assets whose file matches
//   node tools/store-assets.mjs --plan      → print the table + the open taste
//                                             calls and render nothing
//
// Two kinds of source, deliberately:
//   · store/templates/*.html — authored compositions that import the game's
//     real palette (styles/base.css tokens, --font-display, the map-graph
//     motif). Changing the game's palette changes the store art on the next
//     run — that is the point.
//   · the game itself — the screenshots are the real app at its shipped
//     defaults, driven through the same ?shot= states the preview generator
//     uses, at a deterministic seed.
//
// The four calls that are Constantine's, not mine, live in
// store/templates/taste.js — one token each, imported here and by the
// templates so the tool's report and the pixels can never disagree.
//
// Every capture is verified before this tool reports it: the encoded image's
// own header is parsed and its pixel size asserted against the table (a store
// asset at the wrong size is a rejected upload, found at submission time — the
// most expensive place), transparent assets are decoded back in the browser to
// prove their corners carry alpha 0, the opaque one is proved NOT to, and the
// face the wordmark actually rendered in is reported by name every run.
// Exit 1 on any miss.
//
// Zero dependencies (house rule): Chromium over raw CDP, the same pattern as
// tools/contrast-audit.mjs.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { TASTE } from '../store/templates/taste.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const BROWSERS = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// ---- the table: Steam's required sizes, one home -------------------------------
// VERIFIED AT THE PRIMARY 2026-08-07 — partner.steamgames.com is reachable from
// this environment again (it answered 403 on 2026-08-06, which is why the first
// cut of this table was cross-checked against secondary sources). Every number
// below now comes from Valve's own doc, cited per row:
//   S = /doc/store/assets/standard   L = /doc/store/assets/libraryassets
//   C = /doc/store/assets/community  R = /doc/store/assets/rules
// The re-read moved three rows — see store/SUBMISSION.md for what changed and
// why, and read the rules note on `subtitle` in taste.js before shipping text.
//
// minDisplayW = the narrowest width Valve's doc names for that asset (the
// sizes Steam auto-generates from the upload); where the doc says smaller
// versions exist but names none, the asset's own width stands and the row says
// so. It is what FLAG 2 (the descriptor line) is decided against — never a
// guess dressed as a measurement.
const ASSETS = [
  // ── store capsules (S) ──────────────────────────────────────────────────
  { file: 'header-capsule.png',   w: 920,  h: 430,  minDisplayW: 920,  wordmark: true,
    url: '/store/templates/capsule.html?kind=header' },   // S: "920px x 430px"; smaller generated, sizes unnamed
  { file: 'small-capsule.png',    w: 462,  h: 174,  minDisplayW: 120,  wordmark: true,
    url: '/store/templates/capsule.html?kind=small' },    // S: "462px x 174px", generates 120x45 and 184x69
  { file: 'main-capsule.png',     w: 1232, h: 706,  minDisplayW: 1232, wordmark: true,
    url: '/store/templates/capsule.html?kind=main' },     // S: "1232px x 706px"
  { file: 'vertical-capsule.png', w: 748,  h: 896,  minDisplayW: 748,  wordmark: true,
    url: '/store/templates/capsule.html?kind=vertical' }, // S: "748px x 896px"
  // ── library assets (L) ──────────────────────────────────────────────────
  { file: 'library-capsule.png',  w: 600,  h: 900,  minDisplayW: 300,  wordmark: true,
    url: '/store/templates/capsule.html?kind=library' },  // L: "600px x 900px", half-size 300x450 generated
  // L: "If not set, then the Store Asset Header Capsule is used" — so shipping
  // the same picture twice is Valve's own default, not a duplicate we failed to
  // notice. FLAG 3 chooses whether it stays that way.
  { file: 'library-header.png',   w: 920,  h: 430,  minDisplayW: 920,  wordmark: true,
    url: `/store/templates/capsule.html?kind=${TASTE.libraryHeader === 'distinct' ? 'library-header' : 'header'}` },
  { file: 'library-hero.png',     w: 3840, h: 1240, minDisplayW: 1920,
    url: '/store/templates/hero.html' },                  // L: "3840px x 1240px", half-size 1920x620; safe area 860x380; no words at all (R)
  { file: 'library-logo.png',     w: 1280, h: 720,  transparent: true, wordmark: true,
    url: '/store/templates/logo.html' },                  // L: "either 1280px wide and/or 720px tall", transparent PNG
  // ── client & community icons (C) ────────────────────────────────────────
  // App Icon is a JPG at 184 and is shown SMALL; it has no alpha channel, and
  // when Steam derives it from the shortcut icon it replaces alpha with solid
  // black — so it is authored on an opaque ground instead of inheriting one.
  { file: 'app-icon-184.jpg',     w: 184,  h: 184,  format: 'jpeg', opaque: true,
    url: '/store/templates/icon.html?opaque=1' },         // C: "184px by 184px JPG"
  // Shortcut Icon: Valve generates the .ico from this PNG — see SUBMISSION.md.
  { file: 'shortcut-icon-512.png', w: 512, h: 512,  transparent: true,
    url: '/store/templates/icon.html' },                  // C: "256px x 256px or 512px x 512px, ICO or PNG"
  // ── optional store page background (S) ──────────────────────────────────
  // Optional; if we upload none Steam generates one from the last screenshot.
  // The hero canvas is already wordless ambient artwork, which is this slot's
  // whole brief, so it re-renders here rather than earning a second template.
  { file: 'page-background.png',  w: 1438, h: 810,  optional: true,
    url: '/store/templates/hero.html' },                  // S: "1438px x 810px"
  // ── screenshots: the game itself, shipped defaults, deterministic seed ───
  // S: "1920x1080 minimum. 16:9", at least five, gameplay only.
  { file: 'screenshot-title.png',  w: 1920, h: 1080, shot: true, url: '/index.html', settle: 1400 },
  { file: 'screenshot-map.png',    w: 1920, h: 1080, shot: true, url: '/index.html?shot=map&shotSeed=SHOWCASE', settle: 1400 },
  { file: 'screenshot-combat.png', w: 1920, h: 1080, shot: true, url: '/index.html?shot=combat&shotSeed=SHOWCASE', settle: 1400 },
  { file: 'screenshot-fx.png',     w: 1920, h: 1080, shot: true, url: '/index.html?shot=fx&shotSeed=SHOWCASE', settle: 1400 },
  { file: 'screenshot-boss.png',   w: 1920, h: 1080, shot: true, url: '/index.html?shot=boss&shotSeed=SHOWCASE', settle: 1400 },
];

// FLAG 2, decided in one place: does this asset ever get shown narrower than
// the floor a tracked descriptor line survives?
function subtitleFor(a) {
  // Only the capsules can carry a descriptor at all. The library logo letters
  // the title and nothing else — Valve's rule, not a taste call: "Aside from
  // your game's logotype, there should be no other words in this asset."
  if (!a.url.includes('capsule.html')) return false;
  if (TASTE.subtitle === 'never') return false;
  if (TASTE.subtitle === 'always') return true;
  return (a.minDisplayW ?? a.w) >= TASTE.subtitleMinWidth;
}
function urlFor(a) {
  if (!a.url.includes('capsule.html')) return a.url;
  return `${a.url}&sub=${subtitleFor(a) ? 'on' : 'off'}`;
}

// ---- CDP over the global WebSocket (node ≥22) ---------------------------------
async function connectCdp(port) {
  let list;
  for (let i = 0; i < 100; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (list.length) break;
    } catch { /* browser still booting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!list || !list.length) throw new Error('CDP: no target — is the browser up?');
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('CDP: socket refused')); });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id != null && waiting.has(msg.id)) {
      const { ok, no } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? no(new Error(msg.error.message)) : ok(msg.result);
    }
  };
  return {
    send(method, params = {}) {
      const n = ++id;
      ws.send(JSON.stringify({ id: n, method, params }));
      return new Promise((ok, no) => waiting.set(n, { ok, no }));
    },
    close() { ws.close(); },
  };
}

async function evalIn(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page eval failed: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

// PNG IHDR: width/height as big-endian u32 at offsets 16/20; colour type at 25.
function pngHeader(buf) {
  if (buf.length < 26 || buf.readUInt32BE(12) !== 0x49484452) throw new Error('not a PNG (no IHDR)');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), colorType: buf[25] };
}

// JPEG: walk the marker chain to the frame header (SOF0/1/2/9/10) and read the
// size out of it. A JPEG has no single fixed header offset, so this is a walk,
// not an index — the same "assert the encoded pixels, not the intent" check.
function jpegHeader(buf) {
  if (buf.readUInt16BE(0) !== 0xffd8) throw new Error('not a JPEG (no SOI)');
  let p = 2;
  while (p + 9 < buf.length) {
    if (buf[p] !== 0xff) { p++; continue; }
    const marker = buf[p + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
    const len = buf.readUInt16BE(p + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc9, 0xca].includes(marker)) {
      return { h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) };
    }
    p += 2 + len;
  }
  throw new Error('JPEG: no frame header found');
}

// Which face did the wordmark ACTUALLY render in? The templates use the game's
// own --font-display stack, so this answers per machine — the whole point of
// FLAG 4. Canvas width probing, not document.fonts.check: a check() call can
// answer true for a family fontconfig merely aliases, and an alias is not the
// letterforms someone chose.
const FACE_PROBE = `(() => {
  const stack = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
  const fams = stack.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
  const ctx = document.createElement('canvas').getContext('2d');
  const width = (f) => { ctx.font = '700 72px ' + f; return ctx.measureText('ASHEN SPIRE').width; };
  const base = width('monospace');
  const generic = ['serif', 'sans-serif', 'monospace', 'system-ui', 'cursive', 'fantasy'];
  const resolved = fams.find((f) => generic.includes(f) || width('"' + f + '", monospace') !== base) || null;
  return { stack, resolved };
})()`;

// ---- run ----------------------------------------------------------------------
const args = process.argv.slice(2);
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1] : null;
const todo = ASSETS.filter((a) => !only || a.file.includes(only));
if (!todo.length) {
  console.error(`store-assets: --only '${only}' matches nothing. Have: ${ASSETS.map((a) => a.file).join(', ')}`);
  process.exit(1);
}

console.log('Taste flags in force (store/templates/taste.js — one edit each):');
console.log(`  plume=${TASTE.plume}  subtitle=${TASTE.subtitle}(<${TASTE.subtitleMinWidth}px→off)`
  + `  libraryHeader=${TASTE.libraryHeader}  displayFont=${TASTE.displayFont}  palette=${TASTE.palette}`);

if (args.includes('--plan')) {
  for (const a of ASSETS) {
    console.log(`  ${a.file.padEnd(24)} ${String(a.w).padStart(4)}x${String(a.h).padEnd(4)}`
      + ` ${a.optional ? 'optional' : 'required'}`
      + `${a.url.includes('capsule.html') ? `  descriptor:${subtitleFor(a) ? 'on' : 'off'}` : ''}`);
  }
  console.log(`\n${ASSETS.length} assets. Nothing rendered (--plan). Submission steps: store/SUBMISSION.md`);
  process.exit(0);
}

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('store-assets: no Chromium found — set CHROME_PATH.');
  process.exit(1);
}

const outDir = resolve(ROOT, 'store');
mkdirSync(outDir, { recursive: true });
const { server, port } = await serve({ root: ROOT, port: 8151, open: false });

const debugPort = 9333;
const child = spawn(browser, [
  `--remote-debugging-port=${debugPort}`,
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--hide-scrollbars', '--force-color-profile=srgb', '--force-device-scale-factor=1',
  '--user-data-dir=' + resolve('/tmp', `store-assets-${process.pid}`),
  'about:blank',
], { stdio: 'ignore' });

const failures = [];
const facesSeen = new Set();
try {
  const cdp = await connectCdp(debugPort);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const a of todo) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: a.w, height: a.h, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', {
      color: a.transparent ? { r: 0, g: 0, b: 0, a: 0 } : { r: 13, g: 11, b: 8, a: 255 },
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}${urlFor(a)}` });
    // Settle: load event, then fonts, then two frames; game screens get extra
    // time for their screen-in transitions (screenIn runs 700ms).
    await evalIn(cdp, `new Promise((done) => {
      const go = () => document.fonts.ready.then(() =>
        requestAnimationFrame(() => requestAnimationFrame(() =>
          setTimeout(done, ${a.settle ?? 250}))));
      if (document.readyState === 'complete') go(); else addEventListener('load', go);
    })`);

    // FLAG 4: name the face before capturing, on every canvas that letters.
    let face = null;
    if (a.wordmark) {
      const probe = await evalIn(cdp, FACE_PROBE);
      face = probe.resolved;
      facesSeen.add(face);
      if (TASTE.displayFont === 'cinzel-required' && face !== 'Cinzel') {
        failures.push(`${a.file}: displayFont='cinzel-required' but the wordmark rendered in ${face || 'an unresolved face'} (stack: ${probe.stack})`);
      }
    }

    const fmt = a.format ?? 'png';
    const shot = await cdp.send('Page.captureScreenshot',
      fmt === 'jpeg' ? { format: 'jpeg', quality: 96 } : { format: 'png' });
    const buf = Buffer.from(shot.data, 'base64');
    const hdr = fmt === 'jpeg' ? jpegHeader(buf) : pngHeader(buf);

    // Verify the pixels, not the intent.
    const sizeOk = hdr.w === a.w && hdr.h === a.h;
    let alphaOk = true;
    if (a.transparent || a.opaque) {
      // Decode the capture back in the page and read the corner pixels. A
      // "transparent" asset whose corners are opaque is a lie with an alpha
      // channel; an "opaque" one with clear corners is a black rectangle
      // waiting to happen the moment Steam flattens it.
      const want = a.transparent ? 0 : 255;
      alphaOk = await evalIn(cdp, `new Promise((res) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0);
          const corners = [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]];
          res(corners.every(([px, py]) => x.getImageData(px, py, 1, 1).data[3] === ${want}));
        };
        img.onerror = () => res(false);
        img.src = 'data:image/${fmt};base64,${shot.data}';
      })`);
    }
    writeFileSync(resolve(outDir, a.file), buf);
    const mark = sizeOk && alphaOk ? '✓' : '✗';
    const notes = [
      a.transparent ? `alpha-corners:${alphaOk ? 'clear' : 'OPAQUE'}` : null,
      a.opaque ? `ground:${alphaOk ? 'opaque' : 'TRANSPARENT'}` : null,
      face ? `face:${face}` : null,
      a.url.includes('capsule.html') ? `descriptor:${subtitleFor(a) ? 'on' : 'off'}` : null,
    ].filter(Boolean).join(' ');
    console.log(`  ${mark} ${a.file.padEnd(24)} ${hdr.w}x${hdr.h}${notes ? '  ' + notes : ''}`);
    if (!sizeOk) failures.push(`${a.file}: rendered ${hdr.w}x${hdr.h}, table says ${a.w}x${a.h}`);
    if (!alphaOk) failures.push(`${a.file}: corner alpha is not ${a.transparent ? '0 (transparent)' : '255 (opaque)'}`);
  }
  cdp.close();
} finally {
  child.kill();
  server.close();
}

// Valve requires at least five screenshots; a set that renders four is short at
// submission, not at review.
const shots = todo.filter((a) => a.shot).length;
if (!only && shots < 5) failures.push(`screenshots: ${shots} rendered, Steam requires at least 5`);

console.log(`\n${todo.length} asset(s) rendered into store/.`);
console.log(
  'Wordmark rendered in: ' + ([...facesSeen].filter(Boolean).join(', ') || 'n/a (no lettered canvas in this run)')
  + (TASTE.displayFont === 'game' ? '  — reported, not required (taste.js → displayFont).' : '  — required to be Cinzel.')
);
console.log(
  'Boundary: sizes are asserted from each file\'s own encoded header and\n'
  + 'transparency from decoded corner pixels — whether the art READS at Steam\'s\n'
  + 'display sizes is a human call this tool cannot make, and the four calls in\n'
  + 'store/templates/taste.js are Constantine\'s, not this tool\'s. The face above\n'
  + 'is the face THIS machine had; a different box renders a different wordmark\n'
  + 'unless displayFont is set to cinzel-required. Dimensions re-verified at\n'
  + 'partner.steamgames.com on 2026-08-07 (reachable again; it 403\'d on 08-06).\n'
  + 'Submission steps, including what Steam does with .ico: store/SUBMISSION.md'
);
if (failures.length) {
  console.error('\nstore-assets: FAILURES:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
process.exit(0);
