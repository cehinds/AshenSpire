// tools/actends.mjs — when the act opens, can the player SEE both ends of it?
//
// THE SENTENCE THIS EXISTS FOR is Constantine's, and it is already quoted in
// `src/model/mapknowledge.js` as the reason the boss is lit at all:
//
//   "when the act starts it show the start node and the end node"
//
// The fog obeys it: `tools/mapfog.mjs --selftest` holds the property "the boss
// is drawn from the first frame", and it has been observed red. THE LADDER IS
// NOT THE SCREEN. A node can be drawn and then scrolled off the top, and every
// check in this tree stays green through it, because the two halves answer
// different questions and neither owns this one:
//
//   mapfog.mjs   IS IT IN THE DOM. Its census is a set of ids, not positions.
//   mapfit.mjs   IS THE DECISION ON SCREEN. Its framing set is `current +
//                reachable`; at the entrance the boss is neither, so the boss
//                is outside everything that tool asserts, on purpose.
//
// So the gap is exactly one sentence wide, and this file is that sentence: at
// the entrance frame, the door and the boss are both WHOLLY inside the
// scrollport. Not lit. Not in the DOM. On screen, where a thumb and an eye are.
//
// WHY IT IS A PLAYER-EXPERIENCE CHECK AND NOT A CAMERA ONE. The entrance is the
// first five seconds of an act. Under fog it is also the emptiest screen the
// game ever draws — the lit set is TWO nodes — so if one of the two is off
// frame, the player is looking at a single circle in an unlit field with
// nothing to relate it to, and the fog reads as a map that failed to load
// rather than as a flashlight in the dark. The fix is not more light; it is
// letting them see the far end they are climbing toward.
//
// OBSERVED RED AND OBSERVED GREEN, BOTH ON REAL TREES — nothing was mutated to
// make this falsifiable, because the defect is live and its opposite is too
// (the instrument rule, `commons/development.md`; in this repo, the habit
// `mapfit.mjs` states). 12 seeds x 2 shapes, `node tools/actends.mjs`:
//
//   GREEN  dev @ cd3da94                          9/24 cells show both ends
//          390x844: 9/12 · 1200x730: 0/12, the boss 161 px off frame
//   RED    feature/fog-default-and-centred-camera
//          @ 89ec151                              0/24 cells show both ends
//          390x844: 0/12, off by 261 px · 1200x730: 0/12, off by 392 px
//
// SO THE DESKTOP HALF WAS ALREADY BROKEN AND NOBODY HAD LOOKED — 0/12 on `dev`
// at 1200x730, before the camera changed at all. That is not this tool making a
// case against one branch; it is the reason the tool is worth having. What the
// branch did is take the nine cells that worked and make them zero.
//
// AND `drawn: 2`. Under the fog default the entrance frame lights exactly two
// nodes — the door and the boss — so when the boss is off frame the player is
// looking at ONE CIRCLE. On `dev` the same miss was survivable because forty
// other nodes were on screen to tell them what they were looking at.
//
// Usage
//   node tools/actends.mjs                       source tree via tools/serve.mjs
//   node tools/actends.mjs --seeds A,B,C
//   node tools/actends.mjs --shapes 390x844,1200x730
//   node tools/actends.mjs --mode fog|path       default: the shipping default
//   node tools/actends.mjs --shots DIR           write each entrance frame as a PNG
//   CHROME=/path/to/chrome node tools/actends.mjs
//
// Exit codes
//   0  both ends wholly on screen at every cell swept
//   1  a finding — an end of the act the opening frame does not show
//   2  usage / no browser / a screen that would not mount / NOTHING SWEPT,
//      which is unknown, and unknown is never a pass (SOP 2's silence guard)
//
// BOUNDARY, and it is not small. Headless Chromium, one Linux box, act 1, the
// entrance frame only — the one position this property is about. It measures
// the node's own `<circle>`, never the reachable halo, so a clipped 6 px glow
// is deliberately not a finding. It says nothing about whether the fog READS as
// fog (that needs eyes and Freja's plate, which is a 404 today), nothing about
// mid-climb framing (`mapfit.mjs`), and nothing about whether a player enjoys
// the climb.

import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const BROWSERS = [
  process.env.CHROME,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SEEDS = arg('--seeds', 'SHOWCASE,BJORN1,BJORN2,SUNNA3,VIRA4,VIKI5,MARINA6,RUNE7,FREJA8,VEGA9,STEN10,SAGA11').split(',');
// THE SHAPES ARE tools/mapfit.mjs'S, VERBATIM — the same width, the same device
// pixel ratio, the same `mobile` flag. Two instruments measuring the same screen
// under different emulation produce two numbers and one argument; this file had
// that argument with itself on its first run (it read `mobile:true, dpr:1` and
// disagreed with a playwright pass at `mobile:false, dpr:2` about whether the
// boss was on screen on dev). One shape table, or the disagreement is the tool's.
const KNOWN_SHAPES = { '390x844': { d: 3, mobile: true }, '1200x730': { d: 1, mobile: false } };
const SHAPES = arg('--shapes', '390x844,1200x730').split(',').map((s) => {
  const m = /^(\d+)x(\d+)$/.exec(s.trim());
  if (!m) { console.error(`actends: --shapes wants WxH, got "${s}"`); process.exit(2); }
  const k = KNOWN_SHAPES[s.trim()] || { d: 1, mobile: Number(m[1]) < 700 };
  return { w: Number(m[1]), h: Number(m[2]), label: s.trim(), d: k.d, mobile: k.mobile };
});
const MODE = arg('--mode', null); // null = whatever the build ships as default
const SHOTS = arg('--shots', null);

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('actends: no Chrome/Chromium found. Set CHROME=/path/to/chrome.');
  process.exit(2);
}
if (SHOTS) mkdirSync(resolve(SHOTS), { recursive: true });

const { server, port } = await serve({ root: ROOT, port: 8177, open: false });

// The page-side probe. It runs in the document, so it must not import anything.
// It returns the two ends' RECTS and the scrollport's, and nothing derived — the
// verdict is computed out here, once, so the page cannot grade its own homework.
const PROBE = `(() => {
  const sc = document.querySelector('.map-scroll');
  if (!sc) return { error: 'no .map-scroll — the map never mounted' };
  const port = sc.getBoundingClientRect();
  const circle = (el) => { const c = el.querySelector('circle:not(.node-halo)'); return (c || el).getBoundingClientRect(); };
  const ends = [];
  for (const el of document.querySelectorAll('#map-nodes > .map-node')) {
    const isBoss = el.classList.contains('boss');
    const isDoor = el.classList.contains('reachable');
    if (!isBoss && !isDoor) continue;
    const r = circle(el);
    ends.push({
      role: isBoss ? 'boss' : 'door',
      id: el.dataset.node || '',
      x0: Math.round(r.left), y0: Math.round(r.top), x1: Math.round(r.right), y1: Math.round(r.bottom),
    });
  }
  return {
    port: { x0: Math.round(port.left), y0: Math.round(port.top), x1: Math.round(port.right), y1: Math.round(port.bottom) },
    ends,
    drawn: document.querySelectorAll('#map-nodes > .map-node').length,
    mode: sc.dataset.mapMode || '?',
    framing: sc.dataset.framing || '?',
  };
})()`;


async function cdp(shape, seed) {
  const q = new URLSearchParams({ shot: 'map', shotSeed: seed });
  if (MODE) q.set('shotSettings', JSON.stringify({ mapMode: MODE }));
  const url = `http://localhost:${port}/index.html?${q}`;
  const dp = 9333 + Math.floor(Math.random() * 400);
  const child = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${dp}`,
    `--window-size=${shape.w},${shape.h}`,
    'about:blank',
  ], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${dp}`;
  let ws = null;
  for (let i = 0; i < 120 && !ws; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      const list = await (await fetch(`${base}/json/list`)).json();
      const t = list.find((x) => x.type === 'page');
      if (t) ws = t.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
  }
  if (!ws) { child.kill(); return { error: 'browser never answered on the debugging port' }; }
  const sock = await openWs(ws);
  const send = mkSend(sock);
  await send('Page.enable', {});
  await send('Emulation.setDeviceMetricsOverride', { width: shape.w, height: shape.h, deviceScaleFactor: shape.d, mobile: shape.mobile });
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 1400));
  const res = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
  let png = null;
  if (SHOTS) {
    const cap = await send('Page.captureScreenshot', { format: 'png' });
    png = cap && cap.data ? Buffer.from(cap.data, 'base64') : null;
  }
  sock.destroy();
  child.kill();
  return { value: res && res.result && res.result.value, png };
}

// A 120-line WebSocket client is not worth writing twice; this is the same
// minimal frame codec tools/mapfit.mjs and tools/mapfog.mjs already carry, and
// if a third copy appears it goes in one home (Bjorn's second-copy guard).
function openWs(wsUrl) {
  const u = new URL(wsUrl);
  return new Promise((done, fail) => {
    const sock = createConnection({ host: u.hostname, port: Number(u.port) }, () => {
      sock.write(
        `GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: c3VubmFzdW5uYXN1bm5hMTI=\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    sock.once('error', fail);
    sock.once('data', () => done(sock));
  });
}

function mkSend(sock) {
  let id = 0;
  const waiting = new Map();
  let buf = Buffer.alloc(0);
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + len) return;
      const payload = buf.subarray(off, off + len).toString('utf8');
      buf = buf.subarray(off + len);
      try {
        const msg = JSON.parse(payload);
        if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg.result); waiting.delete(msg.id); }
      } catch { /* an event we do not read */ }
    }
  });
  return (method, params) => new Promise((done) => {
    const mid = ++id;
    waiting.set(mid, done);
    const body = Buffer.from(JSON.stringify({ id: mid, method, params }), 'utf8');
    const mask = Buffer.from([0, 0, 0, 0]);
    let head;
    if (body.length < 126) head = Buffer.from([0x81, 0x80 | body.length]);
    else if (body.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0xfe; head.writeUInt16BE(body.length, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 0xff; head.writeBigUInt64BE(BigInt(body.length), 2); }
    sock.write(Buffer.concat([head, mask, body]));
  });
}

const inside = (r, p) => r.x0 >= p.x0 && r.x1 <= p.x1 && r.y0 >= p.y0 && r.y1 <= p.y1;
const missBy = (r, p) => Math.max(0, p.x0 - r.x0, r.x1 - p.x1, p.y0 - r.y0, r.y1 - p.y1);

const findings = [];
let swept = 0;
const rows = [];

for (const shape of SHAPES) {
  for (const seed of SEEDS) {
    const { value: v, png } = await cdp(shape, seed);
    if (!v || v.error) { findings.push(`${shape.label} ${seed}: ${(v && v.error) || 'no reading'}`); continue; }
    if (SHOTS && png) writeFileSync(join(resolve(SHOTS), `entrance-${shape.label}-${seed}.png`), png);
    const boss = v.ends.find((e) => e.role === 'boss');
    const doors = v.ends.filter((e) => e.role === 'door');
    // NOTHING SWEPT IS NOT A PASS. An entrance frame with no boss element and no
    // door element is a screen this tool could not read, not a screen that
    // passed — the same rule mapfit.mjs exits 2 on.
    if (!boss && !doors.length) { findings.push(`${shape.label} ${seed}: neither end is in the DOM — nothing to measure`); continue; }
    swept++;
    const bad = [];
    if (!boss) bad.push('the end node is not drawn at all');
    else if (!inside(boss, v.port)) bad.push(`the END is off frame by ${missBy(boss, v.port)} px`);
    for (const d of doors) if (!inside(d, v.port)) bad.push(`a START door (${d.id}) is off frame by ${missBy(d, v.port)} px`);
    rows.push({ shape: shape.label, seed, mode: v.mode, drawn: v.drawn, ok: !bad.length, why: bad.join('; ') });
    if (bad.length) findings.push(`${shape.label} ${seed} [${v.mode}, ${v.drawn} drawn]: ${bad.join('; ')}`);
  }
}

server.close();

const w = (s, n) => String(s).padEnd(n);
console.log('\nactends — at the act entrance, are BOTH ends of the climb on screen?\n');
console.log(`  ${w('shape', 11)}${w('seed', 11)}${w('mode', 7)}${w('drawn', 7)}verdict`);
for (const r of rows) console.log(`  ${w(r.shape, 11)}${w(r.seed, 11)}${w(r.mode, 7)}${w(r.drawn, 7)}${r.ok ? 'both ends on screen' : r.why}`);

if (!swept) {
  console.error('\nactends: NOTHING SWEPT — unknown, never a pass.');
  process.exit(2);
}
console.log(`\n  ${rows.filter((r) => r.ok).length}/${swept} cells show both ends.`);
console.log('\nBOUNDARY: headless Chromium, one Linux box, act 1, the ENTRANCE frame only.');
console.log('  Measures each end node\'s own <circle>, never its reachable halo. Says nothing');
console.log('  about mid-climb framing (tools/mapfit.mjs), whether the node is in the DOM');
console.log('  (tools/mapfog.mjs), or whether the unlit ground READS as parchment — the act');
console.log('  plate is a 404 today, so every frame above is of the placeholder wash.');

if (findings.length) {
  console.error(`\nFINDINGS (${findings.length}):`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
