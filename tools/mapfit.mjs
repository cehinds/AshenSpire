// tools/mapfit.mjs — when the game frames the act map for the player, is the
// player's next step ON SCREEN?
//
// THE DEFECT THIS EXISTS FOR. Bjorn, at 390x844: 9 of 12 seeds hide at least one
// of the player's next-step options; on one seed all four are hidden; 0 of 12 at
// 1200x730. The centroid `centerOnCurrent()` framed was CORRECT — the canvas was
// 834 px against a 390 viewport and nothing fitted the framing to the content.
// The reachable nodes are the only decision on that screen. Not a hard map; a
// hidden choice.
//
// WHY IT IS NOT tools/mapreach.mjs. That sweep asks whether a node a player can
// SEE can be PRESSED — it hit-tests against the chrome, at four dimensions of
// coincidence, and it is right to. This one asks the question one step earlier:
// is the node in the viewport at all, after the game has finished framing. A map
// whose choices are all off screen passes mapreach perfectly, because nothing is
// covering them.
//
// THE SECOND CHECK IS THE ONE THAT CLOSES THE CLASS. `centerOnCurrent()` has
// never been able to report failure: `Math.max(0, …)` clamped the low end,
// NOTHING clamped the high end, and the browser clamped it silently — asked for
// scrollTop 263, it got 1, on 39 of 39 nodes. So the screen now publishes what
// it did (`.map-scroll[data-framing]` = `fit` | `clipped`, with the overflow in
// local px), and this tool checks THE PAGE'S OWN REPORT AGAINST WHAT IT
// MEASURES. A camera that cannot miss cannot be trusted when it says it didn't;
// a camera whose confession disagrees with the photograph is worse than one that
// stays quiet, and that disagreement is a finding here in its own right.
//
// AND THE MAP HAS THIRTEEN SCREENS, NOT ONE. Every map measurement this repo has
// taken was taken at the entrance row, because `?shot=map` is the only map
// position anything could open. `?shotAt=floor:N` (src/main.js, dev-only, same
// shape as `?shotEvent`) is what lets this sweep stand mid-climb, where the
// framing is a fan-out from one node rather than the spread of the doors — a
// different problem that had never been looked at.
//
// Usage
//   node tools/mapfit.mjs                      source tree via tools/serve.mjs
//   node tools/mapfit.mjs --dist               dist/AshenSpire.html over file://
//   node tools/mapfit.mjs --only 390x844
//   node tools/mapfit.mjs --seeds BJORN1,BJORN2  --floors 1,4,7,10
//   node tools/mapfit.mjs --quick              one shape, three seeds, entrance only
//   node tools/mapfit.mjs --mutate             REINSTATE the defect; must go red
//   node tools/mapfit.mjs --zoom Fit           sweep the COMPUTED frame
//   node tools/mapfit.mjs --zoom 115           sweep one percentage
//   CHROME=/path/to/chrome node tools/mapfit.mjs
//
// WITH NO --zoom THIS SWEEPS WHAT SHIPS, which since #107 is a percentage: Sunna
// held the computed frame as the default because, arriving without the fog and
// parchment that make a close frame read as intended, it reads as a map that has
// been cropped. So the default row of this table is the game as played, and the
// `Fit` row is what the player gets if they choose it. Both are worth a number
// and they are not the same number — reporting only one would have been the
// second copy of the mistake this tool was written to catch.
//
// OBSERVED RED, AND THE TWO HALVES NEEDED DIFFERENT KNOWN-BADS.
//
//   the hidden-step half   needs no mutation at all. It is red on the shipped
//     tree right now, at the entrance row, and it is red for a real reason: six
//     walkers land on up to `columns` distinct doors, so the entrance frame
//     spans 5.92 columns on average (300 seeds) and wants 0.72x at its widest,
//     against a ladder that floors at 1x. No camera fixes that; `entries` does.
//   the disagreement half   is green everywhere, which is the good news and
//     makes it UNKNOWN rather than proven. `--mutate` is for that half only: it
//     falsifies the screen's own confession — writes `data-framing="fit"` onto a
//     frame this tool can see is clipped — and the run must report it. A tool
//     that cross-checks a report it has never seen wrong is a tool taking the
//     report's word for it.
//
// The first draft of --mutate pinned Map zoom to 115%, the frame the computed
// one replaced, and came back GREEN on all twelve mid-climb cells. That is not a
// broken mutation; it is the finding, and it is why this act is shaped the way
// it is: mid-climb framing was never the defect. The entrance row was.
//
// Exit codes
//   0  every framing node is wholly on screen at every mobile cell swept, and
//      the page's own report agrees with the measurement everywhere
//   1  a hidden next step, or the camera's report disagrees with the photograph
//   2  usage / no browser / a screen that would not mount / nothing swept /
//      --mutate not caught — never a pass
//
// BOUNDARY, and it is not small: headless Chromium on one Linux machine, two
// shapes, N seeds, the positions named on the command line. It measures
// GEOMETRY AFTER THE FRAME SETTLES — not whether a thumb can reach the node
// (mapreach), not whether the act is fun to climb (Sunna), and not one frame of
// the animation before the ResizeObserver fires.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const useDist = args.includes('--dist');
const quick = args.includes('--quick');
const mutate = args.includes('--mutate');
const only = argOf('--only');
// `--zoom Fit` / `--zoom 115` — WHICH MAP ZOOM IS UNDER TEST.
//
// Sunna's ruling on #107 put the shipping default back to a percentage and made
// `Fit` a row the player chooses. Without this flag the tool would only ever
// sweep whatever ships, and the computed frame — a code path a player can turn
// on — would go unmeasured the moment it stopped being the default. Unset means
// "sweep the default", which is the honest thing for a gate to do; naming a
// value sweeps that value.
const zoom = argOf('--zoom');
if (zoom != null && zoom !== 'Fit' && !/^\d+$/.test(zoom)) {
  console.error(`mapfit: --zoom takes 'Fit' or a percentage like 115, not '${zoom}'.`);
  process.exit(2);
}

// PROVENANCE AFTER THE ARGUMENTS, NOT AT MODULE SCOPE. Eleven banners in this
// tools/ directory name dist/AshenSpire.html from module scope — before `--dist`
// has been parsed — so seven of them announce the freshness of a file their run
// never opens. One menufit run prints `measured dist@…` five lines above
// `(source tree)`. This is one line and it is the whole fix, here at least.
printArtifactProvenance(useDist ? resolve(ROOT, 'dist/AshenSpire.html') : resolve(ROOT, 'index.html'), ROOT);

const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));

// MOBILE DECIDES, and the desktop row is the non-regression edge — Bjorn's own
// split: 9 of 12 at 390x844, 0 of 12 at 1200x730. Two different problems, not
// one screen at two sizes; the phone overflows across (401 px) and the desktop
// down (206 px).
const SHAPES = [
  { w: 390, h: 844, d: 3, mobile: true, blocks: true },
  { w: 1200, h: 730, d: 1, mobile: false, blocks: false },
];
// Bjorn's twelve, kept verbatim so his number and this one are the same number.
const SEEDS = Array.from({ length: 12 }, (_, i) => `BJORN${i + 1}`);
// The entrance row plus four positions up the climb. `entrance` is the only one
// any instrument could reach before `?shotAt` existed.
const FLOORS = [1, 4, 7, 10];

const seeds = (argOf('--seeds') || (quick ? 'BJORN1,BJORN2,BJORN3' : SEEDS.join(','))).split(',').map((s) => s.trim()).filter(Boolean);
const floors = quick ? [] : (argOf('--floors') || FLOORS.join(',')).split(',').map(Number).filter((n) => Number.isFinite(n));
const shapes = SHAPES.filter((s) => !only || `${s.w}x${s.h}` === only);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function cdpConnect(url) {
  const ws = new WebSocket(url);
  let n = 1;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = n++;
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

// WHOLLY INSIDE, not centre-inside — mapreach's rule, for its reason: under a
// fractional --ui-zoom a box at the seam hit-tests to its neighbour for ~0.8 px,
// and a node 2% visible at the edge is a choice the player does not know they
// have. The measurement is against the CIRCLE, not the halo: the halo is
// decoration and may clip.
const PROBE = `(() => {
  const s = document.querySelector('.map-scroll');
  if (!s) return { error: 'no .map-scroll' };
  const sr = s.getBoundingClientRect();
  const box = (n) => (n.querySelector('circle:not(.node-halo)') || n).getBoundingClientRect();
  const inside = (n) => { const r = box(n); return r.left >= sr.left - 0.5 && r.right <= sr.right + 0.5 && r.top >= sr.top - 0.5 && r.bottom <= sr.bottom + 0.5; };
  const reach = [...document.querySelectorAll('.map-node.reachable')];
  const cur = [...document.querySelectorAll('.map-node.current')];
  const frame = [...new Set([...cur, ...reach])];
  return {
    framing: frame.length,
    onScreen: frame.filter(inside).length,
    reachable: reach.length,
    reachOnScreen: reach.filter(inside).length,
    said: s.dataset.framing || null,
    saidMiss: Number(s.dataset.framingMiss || 0),
    saidZoom: s.dataset.framingZoom || null,
    view: [Math.round(s.clientWidth), Math.round(s.clientHeight)],
    overflow: [s.scrollWidth - s.clientWidth, s.scrollHeight - s.clientHeight],
  };
})()`;

async function main() {
  if (!browserPath) { console.error('mapfit: no chromium found. Set CHROME=/path/to/chrome.'); process.exit(2); }
  if (!shapes.length) { console.error(`mapfit: --only ${only} matches no shape.`); process.exit(2); }

  let base;
  let stop = () => {};
  if (useDist) {
    base = pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href;
  } else {
    const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8277), open: false });
    base = `http://127.0.0.1:${s.port}/index.html`;
    stop = () => s.server.close();
  }

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'mapfit-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--hide-scrollbars'],
    timeoutMs: 20000,
  });
  const cdp = cdpConnect(wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const evaluate = async (expr) => (await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result.value;

  // `--mutate` SWEEPS THE ENTRANCE ROW, because that is where this tree has a
  // clipped frame to lie about.
  const positions = mutate ? ['entrance'] : ['entrance', ...floors.map((f) => `floor:${f}`)];
  const findings = [];
  let cells = 0;
  console.log(`\nmapfit — ${useDist ? 'dist/AshenSpire.html' : 'source tree'} · ${shapes.length} shape(s) x ${seeds.length} seed(s) x ${positions.length} position(s)`
    + `  ·  Map zoom: ${zoom == null ? 'the shipping default (no shotSettings)' : `'${zoom}' via shotSettings`}`
    + `${mutate ? '  ·  --mutate: the framing report is falsified after each frame settles' : ''}`);

  for (const shape of shapes) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: shape.w, height: shape.h, deviceScaleFactor: shape.d, mobile: shape.mobile }, sessionId);
    const rows = [];
    for (const seed of seeds) {
      for (const pos of positions) {
        const q = [`shot=map`, `shotSeed=${encodeURIComponent(seed)}`];
        if (pos !== 'entrance') q.push(`shotAt=${encodeURIComponent(pos)}`);
        if (zoom != null) q.push(`shotSettings=${encodeURIComponent(JSON.stringify({ mapZoom: zoom }))}`);

        await cdp.send('Page.navigate', { url: `${base}?${q.join('&')}` }, sessionId);
        let up = false;
        for (let i = 0; i < 80; i++) {
          if (await evaluate(`document.querySelectorAll('.map-node.reachable').length > 0`)) { up = true; break; }
          await wait(120);
        }
        if (!up) { findings.push(`${shape.w}x${shape.h} ${seed} ${pos}: the map never mounted`); continue; }
        // The frame settles on a ResizeObserver with a 120 ms backstop; read
        // after both, because measuring the frame before the camera has finished
        // moving is a number about the wrong moment.
        await wait(400);
        // THE MUTATION: make the screen's report CONTRADICT ITSELF — whatever it
        // said, say the other thing. Applied after the frame has settled and
        // touching nothing but the report, so the geometry this tool measures is
        // the real one and only the confession is false, which is exactly the
        // failure the cross-check exists for.
        //
        // IT USED TO HARDCODE 'fit' AND THAT WAS THE SAME BUG TWICE IN ONE NIGHT.
        // A mutation that pins one value is a known-bad only while the tree
        // happens to hold the other one. The first draft pinned Map zoom to 115%
        // and went green because mid-climb framing was never broken; this draft
        // pinned the report to `fit` and went green the moment `entries: 1` made
        // every frame genuinely fit — a no-op wearing a test's clothes, passing
        // for the reason that should have failed it. Inverting whatever is there
        // is a lie in both directions and stays one at any state of the tree:
        // `fit` on a clipped frame is a camera hiding a miss, `clipped` on a
        // whole frame is a camera crying wolf, and the cross-check catches both
        // by construction rather than by luck.
        if (mutate) await evaluate(`(() => { const s = document.querySelector('.map-scroll'); if (!s) return 0;`
          + ` const was = s.dataset.framing;`
          + ` s.dataset.framing = was === 'clipped' ? 'fit' : 'clipped';`
          + ` s.dataset.framingMiss = was === 'clipped' ? '0' : '999';`
          + ` return 1; })()`);
        const r = await evaluate(PROBE);
        if (r && r.error) { findings.push(`${shape.w}x${shape.h} ${seed} ${pos}: ${r.error}`); continue; }
        cells++;
        rows.push({ seed, pos, ...r });
      }
    }

    const hidden = rows.filter((r) => r.onScreen < r.framing);
    // THE PAGE'S CONFESSION AGAINST THE PHOTOGRAPH. Both directions: a `fit`
    // that hides a node is a camera lying about a miss; a `clipped` with
    // everything on screen is a camera crying wolf, and the second one rots the
    // first — nobody reads a warning that is usually wrong.
    // A screen that published NO report is not lying — it is silent, and
    // silence is `unknown`, which blocks exactly as a red does (SOP 2). Two
    // different messages, because sending someone to hunt a lie that is really
    // an absence costs an hour.
    const mute = rows.filter((r) => r.said == null);
    const lied = rows.filter((r) => r.said != null && (r.said === 'clipped') !== (r.onScreen < r.framing));
    console.log(`\n  ${shape.w}x${shape.h}${shape.blocks ? '  (mobile — blocks)' : '  (non-regression edge)'}`);
    for (const r of rows) {
      const flag = r.onScreen < r.framing ? '  <-- A NEXT STEP IS OFF SCREEN' : '';
      console.log(`    ${r.seed.padEnd(8)} ${String(r.pos).padEnd(9)} framing ${r.onScreen}/${r.framing} on screen`
        + ` · zoom ${r.saidZoom ?? '?'} · says ${String(r.said).padEnd(7)} miss ${String(r.saidMiss).padStart(4)} px`
        + ` · view ${r.view.join('x')} · overflow ${r.overflow.join('/')}${flag}`);
    }
    const seedsHiding = new Set(hidden.map((r) => r.seed)).size;
    console.log(`    ---- ${hidden.length} of ${rows.length} cells hide a next step · ${seedsHiding} of ${seeds.length} seeds affected`);
    if (hidden.length && shape.blocks) {
      findings.push(`${shape.w}x${shape.h}: ${hidden.length} of ${rows.length} framings hide a next step (${seedsHiding} of ${seeds.length} seeds) — `
        + hidden.slice(0, 4).map((r) => `${r.seed}/${r.pos} ${r.onScreen}/${r.framing}`).join(', ') + (hidden.length > 4 ? ' …' : ''));
    } else if (hidden.length) {
      console.log(`    (not blocking at this shape — mobile decides; a 1200 finding that does not reproduce at 390 is a card)`);
    }
    for (const r of lied) {
      findings.push(`${shape.w}x${shape.h} ${r.seed}/${r.pos}: the camera said '${r.said}' and ${r.onScreen} of ${r.framing} framing nodes are on screen — `
        + `the screen's own report is wrong, which is worse than not having one`);
    }
    if (mute.length) {
      findings.push(`${shape.w}x${shape.h}: ${mute.length} of ${rows.length} frames published no report at all (no data-framing on .map-scroll) — `
        + `the camera cannot say whether it missed, so every one of those cells is unknown, and unknown blocks`);
    }
  }

  cdp.close();
  await dropBrowser();
  stop();

  if (!cells) { console.error(`\nmapfit: nothing was measured. That is unknown, not a pass.`); process.exit(2); }
  if (mutate) {
    // Only the CROSS-CHECK counts here. The hidden-step findings would fire on
    // this row with or without the mutation, and a mutation test that passes on
    // a defect it did not cause has proved nothing (Sten's 'legal red').
    const caught = findings.filter((f) => f.includes(`the screen's own report is wrong`));
    console.log(`\n  --mutate: ${caught.length ? `CAUGHT — ${caught.length} falsified report(s) detected. The cross-check can go red.`
      : 'NOT CAUGHT — the cross-check proves nothing.'}`);
    for (const f of findings) console.log(`    - ${f}`);
    process.exit(caught.length ? 0 : 2);
  }
  console.log(`\n  BOUNDARY — what a green here does NOT mean:
  (a) NOT REACHABILITY. A node on screen may still sit under a control;
      tools/mapreach.mjs owns that and this tool never hit-tests.
  (b) ONE MACHINE, headless Chromium, ${shapes.map((s) => `${s.w}x${s.h}`).join(' and ')} only.
  (c) THE FRAME AFTER IT SETTLES. Nothing here measures the 400 ms before it.
  (d) NOT 'verified-at' ANY CI REF — hand-run, like everything on this repo.`);
  console.log(`\n  ${findings.length ? `FAIL — ${findings.length} finding(s) over ${cells} framing(s)`
    : `PASS — ${cells} framings measured: every next step on screen at every mobile cell, and the screen's own report agrees with every one`}`);
  for (const f of findings) console.log(`    - ${f}`);
  process.exit(findings.length ? 1 : 0);
}

main().catch((e) => { console.error(`mapfit: ${e.message}`); process.exit(2); });
