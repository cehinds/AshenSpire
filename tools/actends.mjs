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
//   node tools/actends.mjs --dist                 inspect dist/AshenSpire.html
//   node tools/actends.mjs --mutate[=end|title]  REINSTATE the defect; must go red
//   CHROME=/path/to/chrome node tools/actends.mjs
//
// Exit codes
//   0  both ends wholly on screen at every cell swept · or --mutate CAUGHT
//   1  a finding — an end of the act the opening frame does not show
//   2  usage / no browser / a screen that would not mount / NOTHING SWEPT,
//      which is unknown, and unknown is never a pass (SOP 2's silence guard)
//      · or --mutate NOT CAUGHT, which makes this file decoration
//
// THE KNOWN-BAD, RE-RUNNABLE (development.md, *The instrument rule*, both
// clauses). The observations above are real and REF-PINNED — under SOP 2's
// drift clause they are `unknown (drifted)` at any later tree, which Vira's
// doors audit said out loud (verdict OBSERVED-ONCE). `--mutate` is the
// re-runnable red: after the app has posed the entrance frame — mount, camera,
// composition, everything a real run does — the plant removes what the player
// was owed and the sweep MUST report it. THE DOOR IS THE RENDERED FRAME
// ITSELF, the same surface every real reading here is taken from; nothing is
// handed to the verdict code directly, and the tool grades the mutated page
// with the exact loop that grades a clean one.
//   end    the act's far end dies in BOTH carriers — the boss node in the map
//          DOM and the orientation strip's boss cell — so whichever composition
//          would have carried the claim, the claim is now false
//   title  the act title dies in both carriers (display:none), the legibility
//          half of the same sentence
//
// BOUNDARY, and it is not small. Headless Chromium, one Linux box, act 1, the
// entrance frame only — the one position this property is about. It measures
// the node's own `<circle>`, never the reachable halo, so a clipped 6 px glow
// is deliberately not a finding. It says nothing about whether the fog READS as
// fog — that needs eyes; the act plate mounts now (`data-map-plate="ok"`,
// parchment_act1.svg, resolver-tested), but mounted is not read — nothing about
// mid-climb framing (`mapfit.mjs`), and nothing about whether a player enjoys
// the climb.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { createConnection } from 'node:net';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
const useDist = args.includes('--dist');
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SEEDS = arg('--seeds', 'SHOWCASE,BJORN1,BJORN2,SUNNA3,VIRA4,VIKI5,MARINA6,RUNE7,FREJA8,VEGA9,STEN10,SAGA11').split(',');
// 390x844 and 1200x730 are tools/mapfit.mjs's shapes; 320x640 is the smallest
// phone carried by mapreach.mjs and mapspacing.mjs. Same width, device pixel
// ratio and `mobile` flag. Two instruments measuring the same screen
// under different emulation produce two numbers and one argument; this file had
// that argument with itself on its first run (it read `mobile:true, dpr:1` and
// disagreed with a playwright pass at `mobile:false, dpr:2` about whether the
// boss was on screen on dev). One shape table, or the disagreement is the tool's.
const KNOWN_SHAPES = {
  '320x640': { d: 3, mobile: true },
  '390x844': { d: 3, mobile: true },
  '1200x730': { d: 1, mobile: false },
};
const SHAPES = arg('--shapes', '390x844,1200x730').split(',').map((s) => {
  const m = /^(\d+)x(\d+)$/.exec(s.trim());
  if (!m) { console.error(`actends: --shapes wants WxH, got "${s}"`); process.exit(2); }
  const k = KNOWN_SHAPES[s.trim()] || { d: 1, mobile: Number(m[1]) < 700 };
  return { w: Number(m[1]), h: Number(m[2]), label: s.trim(), d: k.d, mobile: k.mobile };
});
const MODE = arg('--mode', null); // null = whatever the build ships as default
const SHOTS = arg('--shots', null);

// --mutate[=end|title] — the re-runnable known-bad (header block above).
const mutateArg = args.find((a) => a === '--mutate' || a.startsWith('--mutate='));
const MUTATE = mutateArg ? (mutateArg.split('=')[1] || 'end') : null;
const MUTATIONS = {
  // The far end dies in BOTH carriers. Removal, not display:none, for the map
  // node: the probe reads the DOM census, and a hidden node with a live rect is
  // a different (weaker) plant than the one the real defect class is made of.
  end: `(() => {
    let n = 0;
    for (const el of document.querySelectorAll('#map-nodes > .map-node.boss')) { el.remove(); n++; }
    const strip = document.querySelector('.map-entrance-orientation [data-role="boss"]');
    if (strip) { strip.remove(); n++; }
    return n;
  })()`,
  title: `(() => {
    let n = 0;
    const t = document.querySelector('.map-act-title'); if (t) { t.style.display = 'none'; n++; }
    const o = document.querySelector('.map-entrance-orientation strong'); if (o) { o.style.display = 'none'; n++; }
    return n;
  })()`,
};
// What a caught cell must SAY — the finding class each plant reinstates, so a
// cell that reds for an unrelated reason cannot count as the catch (Sten's
// 'legal red': a mutation test that passes on a defect it did not cause has
// proved nothing).
const MUTATE_CLASS = {
  end: /end node is not drawn|END is off frame|neither real map nor bounded/,
  title: /ACT TITLE/,
};
if (MUTATE && !MUTATIONS[MUTATE]) {
  console.error(`actends: --mutate=${MUTATE} is not a known-bad. Known-bads: ${Object.keys(MUTATIONS).join(', ')}`);
  process.exit(2);
}

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('actends: no Chrome/Chromium found. Set CHROME=/path/to/chrome.');
  process.exit(2);
}
if (SHOTS) mkdirSync(resolve(SHOTS), { recursive: true });

const served = useDist ? null : await serve({ root: ROOT, port: 8177, open: false });
const pageBase = useDist
  ? pathToFileURL(resolve(ROOT, 'dist', 'AshenSpire.html')).href
  : `http://localhost:${served.port}/index.html`;

// The page-side probe. It runs in the document, so it must not import anything.
// It returns the two ends' RECTS and the scrollport's, and nothing derived — the
// verdict is computed out here, once, so the page cannot grade its own homework.
const PROBE = `(() => {
  const sc = document.querySelector('.map-scroll');
  if (!sc) return { error: 'no .map-scroll — the map never mounted' };
  const port = sc.getBoundingClientRect();
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return null;
    return { x0: Math.round(r.left), y0: Math.round(r.top), x1: Math.round(r.right), y1: Math.round(r.bottom) };
  };
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
  const orientation = document.querySelector('.map-entrance-orientation');
  return {
    port: { x0: Math.round(port.left), y0: Math.round(port.top), x1: Math.round(port.right), y1: Math.round(port.bottom) },
    viewport: { x0: 0, y0: 0, x1: innerWidth, y1: innerHeight },
    ends,
    title: rect(document.querySelector('.map-act-title')),
    orientation: orientation && getComputedStyle(orientation).display !== 'none' ? {
      title: rect(orientation.querySelector('strong')),
      start: rect(orientation.querySelector('[data-role="start"]')),
      boss: rect(orientation.querySelector('[data-role="boss"]')),
      rail: rect(orientation.querySelector('.map-orientation-rail')),
      inert: getComputedStyle(orientation).pointerEvents === 'none'
        && !orientation.querySelector('button, a, [role="button"], [tabindex]')
        && !orientation.querySelector('circle, .map-node, .map-overview-node'),
    } : null,
    drawn: document.querySelectorAll('#map-nodes > .map-node').length,
    mode: sc.dataset.mapMode || '?',
    framing: sc.dataset.framing || '?',
  };
})()`;


async function cdp(shape, seed, plant = null) {
  const q = new URLSearchParams({ shot: 'map', shotSeed: seed });
  if (MODE) q.set('shotSettings', JSON.stringify({ mapMode: MODE }));
  const url = `${pageBase}?${q}`;
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens. This tool
  // launches ONE BROWSER PER SHAPE PER SEED with no `--user-data-dir`, so every
  // one of those left a `/tmp/.org.chromium.Chromium.*` behind — measured at this
  // ref. `awaitEndpoint` is off because this tool polls `/json/list` on a port it
  // picks rather than reading the endpoint off stderr.
  const dp = 9333 + Math.floor(Math.random() * 400);
  const { child, close: dropBrowser } = await launchBrowser({
    prefix: 'actends-', browser, headless: '--headless=new', awaitEndpoint: false,
    args: [`--remote-debugging-port=${dp}`, `--window-size=${shape.w},${shape.h}`],
    stdio: 'ignore',
  });
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
  if (!ws) { await dropBrowser(); return { error: 'browser never answered on the debugging port' }; }
  const sock = await openWs(ws);
  const send = mkSend(sock);
  await send('Page.enable', {});
  await send('Emulation.setDeviceMetricsOverride', { width: shape.w, height: shape.h, deviceScaleFactor: shape.d, mobile: shape.mobile });
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 1400));
  if (plant) {
    // The plant enters HERE — after the app has mounted, framed and composed
    // the entrance, on the same rendered page the probe below reads. Nothing
    // is handed to the verdict code; it must find this the way it would find
    // the real thing.
    const planted = await send('Runtime.evaluate', { expression: MUTATIONS[plant], returnByValue: true });
    const n = planted && planted.result && planted.result.value;
    if (!n) { sock.destroy(); await dropBrowser(); return { error: `--mutate=${plant}: the plant found nothing to break — the page may not have mounted` }; }
    await new Promise((r) => setTimeout(r, 200));
  }
  const res = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
  let png = null;
  if (SHOTS) {
    const cap = await send('Page.captureScreenshot', { format: 'png' });
    png = cap && cap.data ? Buffer.from(cap.data, 'base64') : null;
  }
  sock.destroy();
  await dropBrowser();
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

// ONE grader, called by the sweep and by --mutate's clean pass. It was inline
// and the clean pass would have needed a second copy of it — which is the
// defect this file's author is named for, so it is a function instead.
function grade(v) {
  const boss = v.ends.find((e) => e.role === 'boss');
  const doors = v.ends.filter((e) => e.role === 'door');
  if (!boss && !doors.length) return { unreadable: true, bad: [] };
  const realEnds = [boss, ...doors].filter(Boolean);
  const endSpan = realEnds.length
    ? Math.max(...realEnds.map((e) => e.y1)) - Math.min(...realEnds.map((e) => e.y0))
    : Infinity;
  const portH = v.port.y1 - v.port.y0;
  const realFits = !!boss && doors.length > 0 && realEnds.every((e) => inside(e, v.port));
  const titleFits = !!v.title && inside(v.title, v.viewport);
  const orientationFits = !!v.orientation && !!v.orientation.title && !!v.orientation.start
    && !!v.orientation.boss && !!v.orientation.rail && v.orientation.inert
    && [v.orientation.title, v.orientation.start, v.orientation.boss, v.orientation.rail].every((e) => inside(e, v.viewport));
  const impossible = endSpan > portH;
  const composition = realFits && titleFits ? 'map' : (impossible && orientationFits ? 'orientation' : 'failed');
  const bad = [];
  if (v.orientation && !v.orientation.inert) bad.push('the orientation strip has an interactive or node-shaped descendant');
  if (!titleFits && !orientationFits) bad.push('the ACT TITLE is not wholly visible');
  if (!boss) bad.push('the end node is not drawn at all');
  else if (!inside(boss, v.port) && composition !== 'orientation') bad.push(`the END is off frame by ${missBy(boss, v.port)} px`);
  for (const d of doors) if (!inside(d, v.port) && composition !== 'orientation') bad.push(`a START door (${d.id}) is off frame by ${missBy(d, v.port)} px`);
  if (orientationFits && !impossible && !realFits) bad.push(`orientation strip hides a fixable camera miss: real ends need ${endSpan}px inside a ${portH}px port`);
  if (composition === 'failed' && !bad.length) bad.push('neither real map nor bounded orientation strip carries title + start + boss');
  return { unreadable: false, bad, composition, endSpan, portH };
}

const findings = [];
let swept = 0;
const rows = [];
// Under --mutate each cell is swept TWICE — clean, then planted — and the clean
// pass lands here. See the eligibility block at the foot of the file for why.
const cleanRows = new Map();

for (const shape of SHAPES) {
  for (const seed of SEEDS) {
    if (MUTATE) {
      const { value: cv } = await cdp(shape, seed);
      cleanRows.set(`${shape.label}/${seed}`, cv && !cv.error ? grade(cv, shape, seed).bad : null);
    }
    const { value: v, png } = await cdp(shape, seed, MUTATE);
    if (!v || v.error) { findings.push(`${shape.label} ${seed}: ${(v && v.error) || 'no reading'}`); continue; }
    if (SHOTS && png) writeFileSync(join(resolve(SHOTS), `entrance-${shape.label}-${seed}.png`), png);
    // NOTHING SWEPT IS NOT A PASS. An entrance frame with no boss element and no
    // door element is a screen this tool could not read, not a screen that
    // passed — the same rule mapfit.mjs exits 2 on.
    const g = grade(v);
    if (g.unreadable) { findings.push(`${shape.label} ${seed}: neither end is in the DOM — nothing to measure`); continue; }
    swept++;
    const { bad, composition, endSpan, portH } = g;
    rows.push({ shape: shape.label, seed, mode: v.mode, drawn: v.drawn, composition, endSpan, portH, ok: !bad.length, why: bad.join('; ') });
    if (bad.length) findings.push(`${shape.label} ${seed} [${v.mode}, ${v.drawn} drawn]: ${bad.join('; ')}`);
  }
}

if (served) served.server.close();

const w = (s, n) => String(s).padEnd(n);
console.log('\nactends — at the act entrance, are TITLE, START and BOSS visible together?\n');
console.log(`  ${w('shape', 11)}${w('seed', 11)}${w('mode', 7)}${w('drawn', 7)}${w('composition', 13)}verdict`);
for (const r of rows) console.log(`  ${w(r.shape, 11)}${w(r.seed, 11)}${w(r.mode, 7)}${w(r.drawn, 7)}${w(r.composition, 13)}`
  + `${r.ok ? `all three visible; real ends ${r.endSpan}px / port ${r.portH}px` : r.why}`);

if (!swept) {
  console.error('\nactends: NOTHING SWEPT — unknown, never a pass.');
  process.exit(2);
}
if (MUTATE) {
  // ELIGIBILITY, AND IT IS THE HALF I GOT WRONG FIRST (Bjorn, 2026-08-15).
  // My first version scored a plant CAUGHT if the planted class appeared in the
  // cell's findings, full stop — and `--mutate=title` came back "CAUGHT 4/4"
  // while two of those four cells were ALREADY RED for the act title with no
  // plant at all (1200x730, below). A mutation test that passes on a defect it
  // did not cause has proved nothing — Sten's legal red, and mapfit.mjs states
  // the same rule in its own --mutate block, which I had read.
  //
  // So a cell may only be CLAIMED by the plant if the cell was GREEN without
  // it. That is why each cell is swept twice here; the clean pass is the cost of
  // the claim being true. A run with no eligible cell proves nothing and exits
  // 2 — never 0, because "no cell could have shown me a red" is unknown.
  const eligible = rows.filter((r) => { const c = cleanRows.get(`${r.shape}/${r.seed}`); return c && c.length === 0; });
  const ineligible = rows.filter((r) => !eligible.includes(r));
  const caughtRows = eligible.filter((r) => !r.ok && MUTATE_CLASS[MUTATE].test(r.why));
  const caught = eligible.length > 0 && caughtRows.length === eligible.length;
  console.log(`\n  --MUTATE=${MUTATE}: ${eligible.length
    ? (caught
      ? `CAUGHT — ${caughtRows.length}/${eligible.length} eligible cell(s) red with the planted class. The check can go red.`
      : `NOT CAUGHT — only ${caughtRows.length}/${eligible.length} eligible cell(s) red with the planted class. The known-bad was armed and this tool stayed quiet on the rest, so it is decoration there, not evidence.`)
    : 'NOTHING PROVED — no cell was green before the plant, so no cell could show a red the plant caused. Unknown, never a pass.'}`);
  for (const r of ineligible) {
    const c = cleanRows.get(`${r.shape}/${r.seed}`);
    console.log(`    not eligible  ${w(r.shape, 11)}${w(r.seed, 11)} ${c === null ? 'the clean pass could not be read' : `already red without the plant: ${c.join('; ')}`}`);
  }
  console.log('  DOOR: the plant entered on the RENDERED entrance frame, after mount, camera and');
  console.log('  composition — the same surface every real reading here is taken from. Nothing was');
  console.log('  handed to the verdict code; it graded the mutated page with the loop that grades a');
  console.log('  clean one, and only cells that pass clean may be claimed.');
  console.log('  (development.md, *The instrument rule*, same-door clause.)');
  console.log('  NOT PASSED THROUGH: the build step. This drives the source tree by default, so a');
  console.log('  defect that only exists in dist/AshenSpire.html is outside this door (--dist).');
  process.exit(caught ? 0 : 2);
}
console.log(`\n  ${rows.filter((r) => r.ok).length}/${swept} cells show title + start + boss.`);
console.log('\nBOUNDARY: headless Chromium on this machine, act 1, the ENTRANCE frame only.');
console.log('  `map` measures real endpoint circles. `orientation` accepts only an inert,');
console.log('  node-free orientation strip where the');
console.log('  measured real span exceeds the measured port at the current zoom. Neither path');
console.log('  judges the composition or measures the reachable halo. Says nothing');
console.log('  about mid-climb framing (tools/mapfit.mjs), whether the node is in the DOM');
console.log('  (tools/mapfog.mjs), or whether the unlit ground READS as parchment - the act');
console.log('  plate mounts (data-map-plate="ok"), but only eyes can say it reads.');

if (findings.length) {
  console.error(`\nFINDINGS (${findings.length}):`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
