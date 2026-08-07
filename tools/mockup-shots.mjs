// tools/mockup-shots.mjs — render docs/mockups/*.html to PNG, full page.
//
//   node tools/mockup-shots.mjs
//
// These are DRAWINGS, not shipped UI, and this tool exists for one reason a
// plain `--screenshot` cannot serve: a mockup is taller than any viewport, and
// a capture that silently crops is a review of the part I happened to frame.
// So each page is measured (documentElement.scrollHeight) and captured with
// captureBeyondViewport, then its PNG height is asserted against that
// measurement — a crop fails the run instead of shipping quietly.
//
// Every page is rendered in BOTH shipped palettes: `hi-contrast` (the default —
// highContrast defaults true) and the atmospheric opt-out. A rarity language
// that only survives one of them fails half the players, which is exactly the
// trap #45 was about.
//
// Zero dependencies (house rule): Chromium over raw CDP, same pattern as
// tools/contrast-audit.mjs and tools/store-assets.mjs.

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/mockups/shots');

const BROWSERS = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

// 390 is the judging shape (Marina's brief). 1200 shows where desktop differs:
// the phone layout is the design, the wide one only proves it does not break.
const PAGES = ['sheet', 'drop', 'ascension'];
const WIDTHS = [390, 1200];
const PALETTES = [
  { name: 'default', atmospheric: false },   // hi-contrast — the shipped default
  { name: 'atmospheric', atmospheric: true }, // the opt-out palette
];

async function connectCdp(port) {
  let list;
  for (let i = 0; i < 100; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (list.length) break;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!list || !list.length) throw new Error('CDP: no target');
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('CDP: refused')); });
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

async function evalIn(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

function pngSize(buf) {
  if (buf.length < 26 || buf.readUInt32BE(12) !== 0x49484452) throw new Error('not a PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) { console.error('mockup-shots: no Chromium — set CHROME_PATH.'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
const { server, port } = await serve({ root: ROOT, port: 8161, open: false });
const dbg = 9341;
const child = spawn(browser, [
  `--remote-debugging-port=${dbg}`, '--headless=new', '--no-sandbox', '--disable-gpu',
  '--hide-scrollbars', '--force-color-profile=srgb', '--force-device-scale-factor=1',
  '--user-data-dir=' + resolve('/tmp', `mockup-shots-${process.pid}`), 'about:blank',
], { stdio: 'ignore' });

const failures = [];
try {
  const cdp = await connectCdp(dbg);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const page of PAGES) {
    for (const w of WIDTHS) {
      for (const pal of PALETTES) {
        // Desktop is drawn once, in the shipped palette only: the wide shot
        // exists to prove the phone design does not break, and a second
        // palette of the same proof is a file nobody opens.
        if (w !== 390 && pal.atmospheric) continue;
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/docs/mockups/${page}.html` });
        await evalIn(cdp, `new Promise((d) => {
          const go = () => document.fonts.ready.then(() => requestAnimationFrame(() => setTimeout(d, 220)));
          if (document.readyState === 'complete') go(); else addEventListener('load', go);
        })`);
        // The palette is applied the way the game applies it — a class on
        // <body> — so these drawings resolve the same tokens the app does.
        if (pal.atmospheric) await evalIn(cdp, `document.body.classList.remove('hi-contrast'), 1`);
        const h = await evalIn(cdp, 'Math.ceil(document.documentElement.scrollHeight)');
        const shot = await cdp.send('Page.captureScreenshot', {
          format: 'png', captureBeyondViewport: true,
          clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
        });
        const buf = Buffer.from(shot.data, 'base64');
        const size = pngSize(buf);
        const file = `${page}-${w}${pal.atmospheric ? '-atmospheric' : ''}.png`;
        writeFileSync(resolve(OUT, file), buf);
        // The assertion that makes this tool worth having: no silent crop.
        const ok = size.h >= h - 1 && size.w === w;
        console.log(`  ${ok ? '✓' : '✗'} ${file.padEnd(30)} ${size.w}x${size.h} (content ${h})`);
        if (!ok) failures.push(`${file}: captured ${size.w}x${size.h}, content is ${w}x${h} — CROPPED`);
      }
    }
  }
  cdp.close();
} finally {
  child.kill();
  server.close();
}

console.log('\nBoundary: these are drawings of screens that do not exist. This tool');
console.log('proves the capture is complete and the palette applied — it says nothing');
console.log('about whether the design is right, which is Sunna\'s read and his taste.');
if (failures.length) {
  console.error('\nmockup-shots: FAILURES:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
process.exit(0);
