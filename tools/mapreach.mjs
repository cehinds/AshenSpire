// tools/mapreach.mjs — can a player press every map node they can see, at every
// shape, every map zoom, every pan offset, on more than one map?
//
// WHY THIS IS NOT tools/screenreach.mjs. That sweep hit-tests controls AT REST,
// says so in its own boundary, and is right to: it covers six screens and a
// screen has one layout. The act map does not. It is a pannable canvas whose
// node positions are a function of FOUR things this repo had never crossed:
//
//   viewport shape  x  the map's own zoom ladder (1 -> 2)  x  scroll offset  x  SEED
//
// and the defect was a coincidence between one of those positions and a floating
// button. Sunna measured two map nodes at 412x915 sitting under the map's own
// zoom stack — visible, and pressing one zoomed the map instead of travelling.
// Panning did not rescue them: the canvas slides, the buttons do not, so a
// different node takes the trap. #24 had already "fixed" this once, at 390x844,
// with `padding-bottom` on the canvas — which pads the CONTENT while the buttons
// were pinned to the SCROLLPORT, so it held at exactly the offset it was
// measured at. A check that reads one shape at one offset on one seed cannot
// tell that fix from a real one. Both are green.
//
// AND ONE MAP WAS NOT THE MAP. Until EldenSpire#28 the ?shot=map seed was a
// literal, so every reachability number this repo has ever printed about the act
// map described a single graph. `?shotSeed=` exists for this tool.
//
// WHAT IT ASSERTS — two checks, and the first is the one that closes the class:
//
//   STRUCTURE (per shape): the zoom bar is not inside the map scrollport's
//     subtree and is laid out in normal flow. Exact, structural, no geometry and
//     no threshold: an element outside the scrolled subtree, in the flow, cannot
//     be over the scrolled content at ANY offset, on ANY seed, at ANY zoom.
//
//   TRAPPED (per shape x seed x map zoom x pan offset): no map node that is
//     WHOLLY inside the scrollport's client box is answered by something else on
//     a hit-test at its centre.
//
// Structure is what makes the defect impossible; trapped is the known-bad that
// proves structure is worth having. Keep both: the invariant alone would pass a
// tree where somebody re-armed the overlay by a different mechanism, and the
// symptom alone is a property of whichever seed you happened to sweep.
//
// WHY "WHOLLY INSIDE" AND NOT "CENTRE INSIDE", and it is not a fitted number.
// Under a fractional --ui-zoom two abutting boxes share a seam that Chromium
// hit-tests to the lower one for up to ~0.8 CSS px: measured at 360x640, the
// scrollport ends at y=606.22 and elementFromPoint(x, 605.5) already answers
// .map-zoom. A node centre in that seam belongs to a node that is ~2% visible at
// the very bottom edge, which no player is aiming at and one pixel of scrolling
// reveals. Requiring the whole node box inside the port draws the line at
// "visible enough to invite a tap" rather than at a tolerance, and it is
// deliberately STRICTER than screenreach's centre test everywhere else: a node
// fully on screen and under a button is exactly the defect, at any offset.
//
// Usage
//   node tools/mapreach.mjs                       source tree via tools/serve.mjs
//   node tools/mapreach.mjs --dist                dist/AshenSpire.html over file://
//   node tools/mapreach.mjs --only 412x915
//   node tools/mapreach.mjs --seeds SHOWCASE,FOO  --steps 4  --quick
//   node tools/mapreach.mjs --mutate              REINSTATE the defect; must go red
//   CHROME=/path/to/chrome node tools/mapreach.mjs
//
// Exit codes
//   0  no node trapped anywhere swept, and the structure holds
//   1  a trapped node, or the bar is back over the canvas
//   2  usage / no browser / a screen that would not mount / --mutate not caught
//      — never a pass

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// THIS IS THE THIRD SHAPE LIST IN tools/ AND IT IS A KNOWN DEFECT, NOT A DESIGN
// — AND IT IS, VERBATIM, A RE-OPEN TRIGGER ON EldenSpire#28.
//
// #28 says: "Re-opened if the shape leaves either list, if A THIRD INSTRUMENT
// LANDS WITH A FOURTH LIST, or if a control is found covered at any shape in
// either list." This file is that third instrument. I am not going to let that
// clause be discovered by someone else later: screenreach.mjs carries four
// shapes, mobilefit.mjs nine, this one six, and #28's condition 3 — one fact,
// which shapes we support, must not have independent homes — is further from
// met than it was before I wrote this.
//
// It is written this way anyway, for one reason: screenreach.mjs is being
// rewritten on two unmerged branches at once (Sunna's 6f4a9bd, Rune's 7d784a2)
// and a third uncoordinated edit to it was the collision the family had already
// decided to avoid. So the choice was a fourth list or a fourth touch, and the
// fourth list is the one that is visible in a diff and cannot merge silently.
// The collapse — one module, three importers — belongs to the tools-only PR that
// already has to reconcile that file, and it should absorb this list with the
// other two rather than after them.
//   412x915 is the shape the defect was found at.
//   884x1326 is the tablet that takes data-layout=narrow at zoom 1.70 — the one
//     shape where the narrow rules fire in 520 local px instead of ~433.
const SHAPES = [
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop' }, // NON-REGRESSION EDGE
  { w: 412, h: 915, d: 2.6, mobile: true, tag: 'portrait' },
  { w: 390, h: 844, d: 3, mobile: true, tag: 'portrait' },
  { w: 360, h: 640, d: 2, mobile: true, tag: 'portrait' },
  { w: 844, h: 390, d: 3, mobile: true, tag: 'landscape' },
  { w: 884, h: 1326, d: 2, mobile: true, tag: 'tablet-narrow' },
];

// More than one map, because one map is an anecdote. SHOWCASE is the literal
// every other tool and every screenshot in this repo uses, kept first so this
// sweep and those agree about at least one graph.
const SEEDS = ['SHOWCASE', 'MAPREACH-B', 'MAPREACH-C'];

// Clicks on the map's own zoom control before reading. 0 is where the player
// lands; +4 walks the ladder to its 2x ceiling, which is what makes the canvas
// overflow the port horizontally and puts nodes against the right edge where a
// bottom-right stack lives. -1 is the other end.
const ZOOMS = [0, 4, -1];

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');
const quick = args.includes('--quick');
const mutate = args.includes('--mutate');
const seeds = (argOf('--seeds') || (quick ? 'SHOWCASE' : SEEDS.join(','))).split(',').map((s) => s.trim()).filter(Boolean);
const zooms = quick ? [0] : ZOOMS;
const steps = Number(argOf('--steps') || (quick ? 3 : 4));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A FILTER THAT MATCHES NOTHING IS A USAGE ERROR, NOT A PASS. Checked against
// the table before a browser is launched, so the message names the typo and the
// legal values. This is the house's `verify-shipped: OK — 0 checks passed`
// shape, and it has been shipped four times; screenreach printed
// `PASS — no covered controls` for `--only 412x915` on the very shape carrying
// this defect.
if (only && !SHAPES.some((v) => `${v.w}x${v.h}` === only)) {
  console.error(`mapreach: --only ${only} matched no shape. Nothing would be tested, so this is unknown, not a pass.`);
  console.error(`  shapes: ${SHAPES.map((v) => `${v.w}x${v.h}`).join(', ')}`);
  process.exit(2);
}

// Re-arm the defect in the live DOM: put the bar back inside the scrollport,
// absolutely positioned in the bottom-right corner, which is byte-for-byte the
// geometry dev ships. Nothing on disk is touched. A check whose failing case
// nobody has watched fail is `unknown`, not green (development.md, The
// instrument rule) — and dev is a moving target, so the known-bad has to travel
// inside the tool rather than live at a ref that ages out.
const MUTATE = `(() => {
  const sc = document.querySelector('.map-scroll'), bar = document.querySelector('.map-zoom');
  if (!sc || !bar) return 'no map';
  sc.style.position = 'relative';
  sc.appendChild(bar);
  bar.style.position = 'absolute';
  bar.style.right = '1.4rem'; bar.style.bottom = '1.4rem';
  bar.style.left = 'auto'; bar.style.top = 'auto';
  bar.style.flexDirection = 'row'; bar.style.zIndex = '5';
  bar.style.borderTop = 'none'; bar.style.padding = '0';
  return 'armed';
})()`;

const STRUCTURE = `(() => {
  const sc = document.querySelector('.map-scroll'), bar = document.querySelector('.map-zoom');
  if (!sc || !bar) return { ok: false, why: 'map scrollport or zoom bar missing' };
  if (sc.contains(bar)) return { ok: false, why: 'the zoom bar is INSIDE the map scrollport subtree' };
  const pos = getComputedStyle(bar).position;
  if (pos !== 'static' && pos !== 'relative') return { ok: false, why: 'the zoom bar is out of flow (position: ' + pos + ')' };
  return { ok: true, why: 'bar is a flow sibling of the scrollport' };
})()`;

// One reading at whatever offset the map currently holds.
const READ = `(() => {
  const de = document.documentElement, app = document.getElementById('app');
  const sc = document.querySelector('.map-scroll');
  const p = sc.getBoundingClientRect();
  // THE CLIENT BOX, AND IN THE ROOM THE RECTS ARE STANDING IN.
  // getBoundingClientRect is VISUAL px; clientLeft/clientWidth/clientHeight are
  // LOCAL px, and the app is under a CSS zoom. Adding one to the other put the
  // port's bottom edge 116px below where it was and made the FIXED tree measure
  // worse than the defective one. The ratio is derived from this element, not
  // read from --ui-zoom, so it cannot disagree with the box it is converting.
  // clientWidth also excludes the scrollbar gutter, which the rect includes —
  // without that, ten nodes under a working desktop scrollbar read as trapped.
  const zr = p.width / (sc.offsetWidth || p.width);
  const b = {
    left: Math.max(p.left + sc.clientLeft * zr, 0),
    top: Math.max(p.top + sc.clientTop * zr, 0),
    right: Math.min(p.left + sc.clientLeft * zr + sc.clientWidth * zr, innerWidth),
    bottom: Math.min(p.top + sc.clientTop * zr + sc.clientHeight * zr, innerHeight),
  };
  const nodes = [...document.querySelectorAll('.map-node')];
  const trapped = []; let inPlay = 0;
  for (const c of nodes) {
    const r = c.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // WHOLLY inside the port — see the header. A partly-clipped node at the
    // edge is the scroll's business, not a trap.
    if (r.left < b.left || r.right > b.right || r.top < b.top || r.bottom > b.bottom) continue;
    inPlay++;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (hit && (hit === c || c.contains(hit))) continue;
    const nm = hit ? ((hit.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 10) + ' .' + (typeof hit.className === 'string' ? hit.className.trim().split(/\\s+/)[0] : hit.tagName)) : 'null';
    trapped.push((c.textContent || '?').trim() + ' at ' + Math.round(x) + ',' + Math.round(y) + '  <-  ' + nm);
  }
  return {
    zoom: getComputedStyle(de).getPropertyValue('--ui-zoom').trim(),
    layout: de.getAttribute('data-layout'),
    local: app.clientWidth + 'x' + app.clientHeight,
    travel: [Math.round(sc.scrollWidth - sc.clientWidth), Math.round(sc.scrollHeight - sc.clientHeight)],
    at: [Math.round(sc.scrollLeft), Math.round(sc.scrollTop)],
    nodes: nodes.length, inPlay, trapped,
  };
})()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`));
      else res(msg.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}

function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--disable-background-timer-throttling',
      '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`Chrome gave no DevTools endpoint:\n${err.slice(-400)}`)), 12000);
  });
}

async function main() {
  if (!browserPath) { console.error('mapreach: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'mapreach-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`mapreach: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8266), open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`mapreach — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);
  console.log(`  seeds ${seeds.join(', ')} · map-zoom clicks ${zooms.join(', ')} · ${steps}x${steps} pan offsets${mutate ? '  ·  --MUTATE: the defect is re-armed and MUST be caught' : ''}`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const evalIn = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const setScroll = (x, y) => evalIn(`(() => { const s = document.querySelector('.map-scroll'); s.scrollLeft = ${x}; s.scrollTop = ${y}; })()`);

  const fails = [];
  let shapesRun = 0, readings = 0, structureChecks = 0;
  for (const vp of SHAPES) {
    const shape = `${vp.w}x${vp.h}`;
    if (only && only !== shape) continue;
    shapesRun++;
    console.log(`\n  ${shape} @ dSF ${vp.d}  (${vp.tag})`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: 5 }, S);
    for (const seed of seeds) {
      for (const zc of zooms) {
        // `?…`, never `#?…`, on file:// as well as http:// — the shot hook reads
        // location.search, so a hash puts every parameter somewhere nothing
        // looks. The first draft did that and --dist mounted no map at all: the
        // unknown-guard below exited 2 rather than printing a green over six
        // shapes it had not tested, which is the only reason this is a footnote.
        await cdp.send('Page.navigate', { url: `${base}?shot=map&shotSeed=${encodeURIComponent(seed)}` }, S);
        const t0 = Date.now(); let up = false;
        while (Date.now() - t0 < 12000) { if (await evalIn(`!!document.querySelector('.map-node')`).catch(() => false)) { up = true; break; } await wait(150); }
        if (!up) { console.log(`    seed ${seed} DID NOT MOUNT — never a pass`); fails.push(`${shape} seed ${seed}: the map would not mount`); continue; }
        await wait(900); // auto-zoom re-flexes on a 150ms debounce plus a boot re-apply
        if (mutate) await evalIn(MUTATE);
        if (zc) { for (let k = 0; k < Math.abs(zc); k++) { await evalIn(`document.querySelector('#${zc > 0 ? 'zoom-in' : 'zoom-out'}').click()`); await wait(110); } await wait(300); }

        // Structure is a property of the shape, not of the seed or the offset.
        if (seed === seeds[0] && zc === zooms[0]) {
          structureChecks++;
          const st = await evalIn(STRUCTURE);
          console.log(`    STRUCTURE  ${st.ok ? 'ok' : 'FAIL'} — ${st.why}`);
          if (!st.ok) fails.push(`${shape}: STRUCTURE — ${st.why}`);
        }

        const rest = await evalIn(READ); readings++;
        const worst = { n: rest.trapped.length, at: rest.at, list: rest.trapped };
        const [tx, ty] = rest.travel;
        let offsets = 1;
        for (let i = 0; i < steps; i++) {
          for (let j = 0; j < steps; j++) {
            const x = steps === 1 ? 0 : Math.round((tx * i) / (steps - 1));
            const y = steps === 1 ? 0 : Math.round((ty * j) / (steps - 1));
            await setScroll(x, y); await wait(45);
            const r = await evalIn(READ); readings++; offsets++;
            if (r.trapped.length > worst.n) { worst.n = r.trapped.length; worst.at = r.at; worst.list = r.trapped; }
          }
        }
        const zl = zc === 0 ? 'rest ' : (zc > 0 ? `+${zc}   ` : `${zc}   `);
        console.log(`    seed ${seed.padEnd(12)} mapzoom ${zl} ui ${String(rest.zoom).padEnd(5)} ${rest.layout.padEnd(6)} local ${rest.local.padEnd(9)} travel ${String(rest.travel).padEnd(9)} ${String(rest.nodes).padStart(2)} nodes · ${offsets} offsets · worst ${worst.n} TRAPPED`);
        for (const t of worst.list) console.log(`               ✗ at scroll ${worst.at}: ${t}`);
        if (worst.n) fails.push(`${shape} seed ${seed} mapzoom ${zc}: ${worst.n} trapped at scroll ${worst.at} — ${worst.list[0]}`);
      }
    }
  }

  // A CHECK THAT RAN NOTHING IS `unknown`, NEVER A PASS. The second lock, after
  // the --only guard above, for the day the loop skips for a reason that is not
  // --only.
  if (shapesRun === 0 || readings === 0 || structureChecks === 0) {
    console.error(`\nmapreach: ${shapesRun} shapes, ${structureChecks} structure checks, ${readings} readings. Nothing was asserted, so this is unknown, not a pass.`);
    cdp.close(); child.kill(); if (server) server.close();
    process.exit(2);
  }

  console.log(`\n  BOUNDARY — Linux headless Chromium only; CDP emulation is not a phone. Only
  the ACT MAP is swept: this says nothing about combat, customize, shop, rest,
  rewards or any overlay, and nothing about legibility, feel or whether the map
  tells you where to pan. Reachability by hit-test at a node's centre: no tap is
  dispatched, so this proves the point is not covered, never that pressing it
  travels. Nodes only partly inside the scrollport are NOT evaluated (header).
  ${seeds.length} seed(s) is more than one map and is not every map — the sweep is a sample
  of a generator, and a shape/zoom/offset/seed the grid steps over is unswept,
  not clean. The STRUCTURE check is the part that does not depend on the sample.`);

  const caught = fails.length > 0;
  if (mutate) {
    console.log(`\n  --MUTATE: ${caught ? `CAUGHT — ${fails.length} finding(s). The check can go red.` : 'NOT CAUGHT. The defect was re-armed and this tool reported clean, so it is decoration, not evidence.'}`);
    for (const f of fails.slice(0, 6)) console.log(`    - ${f}`);
    cdp.close(); child.kill(); if (server) server.close();
    process.exit(caught ? 0 : 2);
  }

  console.log(`\n  ${caught ? `FAIL — ${fails.length}` : `PASS — ${readings} readings, ${structureChecks} structure checks, nothing trapped`}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); child.kill(); if (server) server.close();
  process.exit(caught ? 1 : 0);
}

main().catch((e) => { console.error(`mapreach: ${e.message}`); process.exit(2); });
