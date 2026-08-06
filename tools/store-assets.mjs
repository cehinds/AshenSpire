// tools/store-assets.mjs — generate the Steam store asset set from the game's
// own visual language, at Steam's required sizes, into store/.
//
//   node tools/store-assets.mjs             → render every asset + verify
//   node tools/store-assets.mjs --only NAME → render assets whose file matches
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
// Every capture is verified before this tool reports it: the PNG's IHDR is
// parsed and its pixel size asserted against the table (a store asset at the
// wrong size is a rejected upload, found at submission time — the most
// expensive place), and the transparent assets are decoded back in the
// browser to prove their corners actually carry alpha 0. Exit 1 on any miss.
//
// Zero dependencies (house rule): Chromium over raw CDP, the same pattern as
// tools/contrast-audit.mjs.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

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
// Dimensions per Steamworks "Store Graphical Assets" / "Library Assets" after
// the 2024 size raise (header 920x430, small 462x174, main 1232x706, vertical
// 748x896; library 600x900 / 3840x1240 / 1280x720; community icon 184x184;
// client icon 32x32; screenshots 1920x1080).
// BOUNDARY, named: partner.steamgames.com answers 403 through this
// environment's proxy, so these numbers were cross-checked against two
// independent secondary sources on 2026-08-06, not read from the primary.
// Re-verify against the Steamworks doc before the actual submission.
const ASSETS = [
  { file: 'header-capsule.png',   w: 920,  h: 430,  url: '/store/templates/capsule.html?kind=header' },
  { file: 'small-capsule.png',    w: 462,  h: 174,  url: '/store/templates/capsule.html?kind=small' },
  { file: 'main-capsule.png',     w: 1232, h: 706,  url: '/store/templates/capsule.html?kind=main' },
  { file: 'vertical-capsule.png', w: 748,  h: 896,  url: '/store/templates/capsule.html?kind=vertical' },
  { file: 'library-capsule.png',  w: 600,  h: 900,  url: '/store/templates/capsule.html?kind=library' },
  // Steam takes the library header as its own upload even when it matches the
  // store header — a separate file so a future divergence has a place to live.
  { file: 'library-header.png',   w: 920,  h: 430,  url: '/store/templates/capsule.html?kind=header' },
  { file: 'library-hero.png',     w: 3840, h: 1240, url: '/store/templates/hero.html' },
  { file: 'library-logo.png',     w: 1280, h: 720,  url: '/store/templates/logo.html', transparent: true },
  { file: 'community-icon.png',   w: 184,  h: 184,  url: '/store/templates/icon.html', transparent: true },
  // PNG here; Steam's client icon upload wants .ico — package this at
  // submission (the pixels are the deliverable, the container is packaging).
  { file: 'client-icon-32.png',   w: 32,   h: 32,   url: '/store/templates/icon.html?tiny=1', transparent: true },
  // The screenshots: the game itself, shipped defaults, deterministic seed.
  { file: 'screenshot-title.png',  w: 1920, h: 1080, url: '/index.html', settle: 1400 },
  { file: 'screenshot-map.png',    w: 1920, h: 1080, url: '/index.html?shot=map&shotSeed=SHOWCASE', settle: 1400 },
  { file: 'screenshot-combat.png', w: 1920, h: 1080, url: '/index.html?shot=combat&shotSeed=SHOWCASE', settle: 1400 },
  { file: 'screenshot-fx.png',     w: 1920, h: 1080, url: '/index.html?shot=fx&shotSeed=SHOWCASE', settle: 1400 },
  { file: 'screenshot-boss.png',   w: 1920, h: 1080, url: '/index.html?shot=boss&shotSeed=SHOWCASE', settle: 1400 },
];

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

// ---- run ----------------------------------------------------------------------
const args = process.argv.slice(2);
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1] : null;
const todo = ASSETS.filter((a) => !only || a.file.includes(only));
if (!todo.length) {
  console.error(`store-assets: --only '${only}' matches nothing. Have: ${ASSETS.map((a) => a.file).join(', ')}`);
  process.exit(1);
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
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}${a.url}` });
    // Settle: load event, then fonts, then two frames; game screens get extra
    // time for their screen-in transitions (screenIn runs 700ms).
    await evalIn(cdp, `new Promise((done) => {
      const go = () => document.fonts.ready.then(() =>
        requestAnimationFrame(() => requestAnimationFrame(() =>
          setTimeout(done, ${a.settle ?? 250}))));
      if (document.readyState === 'complete') go(); else addEventListener('load', go);
    })`);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(shot.data, 'base64');
    const ihdr = pngHeader(buf);

    // Verify the pixels, not the intent.
    const sizeOk = ihdr.w === a.w && ihdr.h === a.h;
    let alphaOk = true;
    if (a.transparent) {
      // Decode the capture back in the page and read the corner pixels: a
      // "transparent" asset whose corners are opaque is a lie with an alpha
      // channel. (Colour type 6 alone only proves the channel exists.)
      alphaOk = await evalIn(cdp, `new Promise((res) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0);
          const corners = [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]];
          res(corners.every(([px, py]) => x.getImageData(px, py, 1, 1).data[3] === 0));
        };
        img.onerror = () => res(false);
        img.src = 'data:image/png;base64,${shot.data}';
      })`);
    }
    writeFileSync(resolve(outDir, a.file), buf);
    const mark = sizeOk && alphaOk ? '✓' : '✗';
    console.log(`  ${mark} ${a.file.padEnd(24)} ${ihdr.w}x${ihdr.h}${a.transparent ? ` alpha-corners:${alphaOk ? 'clear' : 'OPAQUE'}` : ''}`);
    if (!sizeOk) failures.push(`${a.file}: rendered ${ihdr.w}x${ihdr.h}, table says ${a.w}x${a.h}`);
    if (!alphaOk) failures.push(`${a.file}: corners are not transparent`);
  }
  cdp.close();
} finally {
  child.kill();
  server.close();
}

console.log(`\n${todo.length} asset(s) rendered into store/.`);
console.log(
  'Boundary: sizes are asserted from each PNG\'s IHDR and transparency from its\n'
  + 'decoded corner pixels — whether the art READS at Steam\'s display sizes is a\n'
  + 'human call this tool cannot make. The display font falls back per machine\n'
  + '(Cinzel > Georgia > serif, styles/base.css): the wordmark renders with the\n'
  + 'first of those the generating machine has, exactly as the game itself does.\n'
  + 'Steam dimension table cross-checked from secondary sources (primary 403s\n'
  + 'here) — re-verify at partner.steamgames.com before submission.'
);
if (failures.length) {
  console.error('\nstore-assets: FAILURES:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
process.exit(0);
