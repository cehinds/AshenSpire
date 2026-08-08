// tools/zoomplace.mjs — do the cursor-anchored overlays land ON the cursor, at
// every --ui-zoom we ship, and can any of them leave the screen?
//
// zoomunits.mjs is a text detector: it proves a second copy of the conversion
// exists and differs, and says on every run that it can never tell you whether a
// site RENDERS wrong. This is the browser half. It drives real Chrome at real
// viewports, makes the real gestures (hover, drag, play a card, ?shot=fx), and
// measures where the overlay actually is against where the player's hand is.
//
// WHY THE NUMBERS ARE IN LOCAL PX. Sunna's first probe called a 182px miss
// "correct in play" because its tolerance was sized for the big end of the zoom
// dial: one constant generous enough to pass at 1.70 swallowed the whole error at
// 0.62. A tolerance is only meaningful in a space where the CORRECT answer is a
// constant. So every miss below is divided by --ui-zoom before it is compared,
// which is the same space the code writes in — the correct answer is then the
// same number at every viewport, and the tolerances are small absolute ones that
// no zoom can inflate.
//
// Usage
//   node tools/zoomplace.mjs                 scan the source tree via tools/serve.mjs
//   node tools/zoomplace.mjs --dist          scan dist/AshenSpire.html over file://
//   node tools/zoomplace.mjs --only 1920x1080
//   CHROME=/path/to/chrome node tools/zoomplace.mjs
//
// Exit codes
//   0  every case within tolerance at every viewport
//   1  a case out of tolerance, or a target that could not be posed
//   2  usage / no browser / the harness could not reach a board — never a pass
//
// BOUNDARY (printed again at the end, where a reader will see it): this measures
// four sites and nothing else, on Linux headless Chrome only, at the eight
// viewports below. It says nothing about the five anchorLocalBox call sites in
// fx.js, nothing about touch or a page zoom other than --ui-zoom, and nothing
// about how any of it FEELS — that is Sunna's read, not a number.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// WHAT TREE DID THIS SEE? Naming the file is not naming its freshness — this
// tool measured a two-merge-stale bundle and printed OK once already. One home:
// tools/artifact-provenance.mjs. Facts only; it never fails a run.
import { printArtifactProvenance } from './artifact-provenance.mjs';
printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// --ui-zoom is min(w/1200, h/730) clamped to [0.62, 1.70] (content/balance.js).
// The four Sunna measured are marked; the others are the ordinary desktop sizes
// between them, because "wrong in BOTH directions away from 1.00" is a claim
// about the whole dial, not about its two ends.
const VIEWPORTS = [
  { w: 800, h: 450 },   // 0.62 — the MIN clamp            (Sunna)
  { w: 1024, h: 640 },  // 0.85
  { w: 1200, h: 730 },  // 1.00 — the design baseline      (Sunna) — NON-REGRESSION EDGE
  { w: 1280, h: 800 },  // 1.07
  { w: 1440, h: 900 },  // 1.20
  { w: 1920, h: 1080 }, // 1.48 — commonest desktop        (Sunna)
  { w: 2560, h: 1440 }, // 1.70 — the MAX clamp            (Sunna)
];

// Tolerances, in LOCAL px (see the header). Each is the slack around an answer
// that is exact by construction, not a guess at "close enough to play".
const TOL = {
  anchor: 3, // a placement that names an exact offset must hit it
  // tooltip: a pad of 14 local px on BOTH axes puts the nearest corner of the box
  // 14·√2 = 19.80 local from the pointer, at every zoom. 22 leaves ~2.2 px for
  // clientX/Y rounding and sub-pixel layout and nothing else. Chosen from that
  // geometry BEFORE the fix was written, so it is a bound and not a fit: at 22 the
  // pre-fix tree is red at six of seven viewports including 0.85, where the miss
  // is only 22.74 and a lazier tolerance would have called it correct in play.
  gap: 22,
  fx: 4, // an fx element centred on its anchor
};

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');

const fails = [];
const ok = (cond, msg) => {
  console.log(`    ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) fails.push(msg);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const n2 = (v) => (v == null ? 'n/a' : (Math.round(v * 100) / 100).toString());

// ---- minimal CDP client over Node's global WebSocket (tools/tutorial-reach.mjs)
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
    ready: new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', rej);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

function launchChrome(browser, userDataDir) {
  return new Promise((res, rej) => {
    const child = spawn(
      browser,
      [
        '--headless', '--no-sandbox', '--disable-gpu', '--window-size=1440,860',
        '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`,
        '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        // The dist build is one file://; without this its own assets are same-origin
        // anyway, but a file:// page may not fetch siblings by default on some builds.
        '--allow-file-access-from-files',
        '--no-first-run', 'about:blank',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let err = '';
    const onData = (d) => {
      err += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
      if (m) res({ child, wsUrl: m[1] });
    };
    child.stderr.on('data', onData);
    child.stdout.on('data', onData);
    child.on('error', rej);
    setTimeout(() => rej(new Error(`Chrome gave no DevTools endpoint. Output:\n${err.slice(-500)}`)), 12000);
  });
}

// ---------------------------------------------------------------- page probes
//
// THE CONTROL FOR THIS WHOLE FILE. Every measurement below divides a visual miss
// by --ui-zoom to reach local px, which is only the right conversion if a
// position:fixed child of the zoomed <body> really is scaled by exactly that
// factor from the viewport origin. That is a claim about Chrome, not about this
// codebase, so it is measured rather than believed: plant a probe element at a
// known LOCAL point and read back where it actually is.
const FIXED_SPACE = `(() => {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;left:100px;top:200px;width:50px;height:50px;pointer-events:none;opacity:0';
  document.body.appendChild(p);
  const r = p.getBoundingClientRect();
  const br = document.body.getBoundingClientRect();
  // Read offsetHeight BEFORE the remove(). Read after, a detached element answers
  // 0, offK became 0, and every flyaim error came out Infinity — a harness bug
  // that failed loudly, which is the only reason it was not a wrong number.
  const offH = p.offsetHeight;
  p.remove();
  return {
    z,
    // What a local 100/200 came out as on screen, and the factor that implies.
    visLeft: r.left, visTop: r.top,
    kx: r.left / 100, ky: r.top / 200, kw: r.width / 50,
    // Which space offsetHeight answers in — needed below and NOT assumed, because
    // Chrome's handling of offset* under CSS zoom has changed across versions.
    offK: offH / 50,
    bodyLeft: br.left, bodyTop: br.top,
    vw: innerWidth, vh: innerHeight,
  };
})()`;

const box = (r) => ({ left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom });

// Tooltip: where is it, relative to the pointer that summoned it?
const TIP = (x, y) => `(() => {
  const el = document.getElementById('tooltip');
  if (!el || el.style.display !== 'block') return null;
  const r = el.getBoundingClientRect();
  const cx = ${x}, cy = ${y};
  // Distance from the cursor to the NEAREST point of the tooltip box. Correct
  // placement is a pad of 14 LOCAL px on both axes, so this is 14·√2 local at
  // every zoom — a constant, which is what makes a constant tolerance legal.
  const dx = Math.max(r.left - cx, 0, cx - r.right);
  const dy = Math.max(r.top - cy, 0, cy - r.bottom);
  return {
    r: { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
    gap: Math.hypot(dx, dy), cx, cy,
    inside: r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
    anyPixel: r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight,
  };
})()`;

// Drag ghost: the cloned card that follows the pointer. It is the only node with
// z-index 600 (combat.js sets it inline), so it is found by that, not by class —
// the clone keeps the card's class list.
const GHOST = (x, y) => `(() => {
  const el = [...document.body.children].find((n) => n.style && n.style.zIndex === '600');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    r: { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
    // The code's stated intent: the pointer sits 70 local px in from the ghost's
    // left and 100 local px down from its top.
    offX: ${x} - r.left, offY: ${y} - r.top,
    onX: Math.min(r.right, innerWidth) - Math.max(r.left, 0),
    onY: Math.min(r.bottom, innerHeight) - Math.max(r.top, 0),
    anyPixel: r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight,
  };
})()`;

// ---------------------------------------------------------------------- main
async function main() {
  if (!browserPath) {
    console.error('zoomplace: no Chrome/Edge found — pass --browser PATH or set $CHROME');
    process.exit(2);
  }
  const profile = mkdtempSync(join(tmpdir(), 'zoomplace-'));
  let server = null;
  let base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) {
      console.error(`zoomplace: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`);
      process.exit(2);
    }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: 8260, open: false });
    server = s.server;
    base = `http://localhost:${s.port}/`;
  }
  console.log(`zoomplace — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S);
  await cdp.send('Runtime.enable', {}, S);

  const evalIn = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (expr, label, timeoutMs = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await evalIn(expr)) return true;
      await wait(120);
    }
    throw new Error(`timeout: ${label}`);
  };
  const mouse = (type, x, y, extra = {}) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: extra.buttons ?? 0, clickCount: 1, ...extra }, S);

  const url = (q) => (useDist ? `${base}?${q}` : `${base}?${q}`);

  async function boot(vp, q) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false }, S);
    await cdp.send('Page.navigate', { url: url(q) }, S);
  }

  for (const vp of VIEWPORTS) {
    const name = `${vp.w}x${vp.h}`;
    if (only && only !== name) continue;
    console.log(`\n  ${name}`);

    // ---------------------------------------------------------------- board
    await boot(vp, 'shot=combat');
    await until(`!!document.querySelector('.combat .hand .card')`, `${name}: combat board`);
    await wait(800); // auto-zoom re-flexes on a 150 ms debounce plus a boot re-apply

    const space = await evalIn(FIXED_SPACE);
    const z = space.z;
    const L = (v) => v / z; // visual px → local px, the one conversion in this file
    console.log(`    ui-zoom ${z} · a local (100,200) landed at (${n2(space.visLeft)},${n2(space.visTop)}) → factor ${n2(space.kx)}/${n2(space.ky)}, body at (${n2(space.bodyLeft)},${n2(space.bodyTop)})`);
    ok(
      Math.abs(space.kx - z) < 0.01 && Math.abs(space.ky - z) < 0.01 && Math.abs(space.kw - z) < 0.01,
      `${name}: a position:fixed child of <body> is scaled by exactly --ui-zoom from the viewport origin (else every local-px number below is measured in the wrong space)`
    );

    // ------------------------------------------------------- 1. the tooltip
    // Hover a real hand card with real pointer events. The card nearest the
    // bottom-right of the hand is the interesting one: that is where the
    // scaling error is largest and where a player's cards actually are.
    const cards = await evalIn(`[...document.querySelectorAll('.hand .card')].map((c) => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);
    if (!cards.length) {
      ok(false, `${name}: a hand card to hover`);
      continue;
    }
    const hover = cards[cards.length - 1];
    await mouse('mouseMoved', hover.x - 3, hover.y - 3); // pointerenter: starts the 140 ms show timer
    await wait(400);
    await mouse('mouseMoved', hover.x, hover.y); // pointermove: re-places it at THIS point
    await wait(80);
    // Measured against the LAST pointer position, which is why the move above is
    // separate: the show timer places the tooltip at the pointerenter point, so
    // measuring against a later cursor read a 2.8 local px offset that was the
    // harness's, not the code's — visible as a gap of 16.96 where the geometry
    // says 19.80 at z=1.00, the one viewport where the code is known-correct.
    const tip = await evalIn(TIP(hover.x, hover.y));
    if (!tip) {
      ok(false, `${name}: the tooltip appeared on hover (nothing to measure)`);
    } else {
      console.log(
        `    tooltip  cursor(${n2(tip.cx)},${n2(tip.cy)}) box(${n2(tip.r.left)},${n2(tip.r.top)} ${n2(tip.r.width)}x${n2(tip.r.height)}) ` +
          `gap ${n2(L(tip.gap))} local (${n2(tip.gap)} visual) · inside=${tip.inside} anyPixel=${tip.anyPixel}`
      );
      ok(L(tip.gap) <= TOL.gap, `${name}: tooltip sits at the cursor — ${n2(L(tip.gap))} local px away, tolerance ${TOL.gap}`);
      ok(tip.inside, `${name}: tooltip is entirely on screen (bounded — a player can read it)`);
    }

    // ---------------------------------------------------- 2. the drag ghost
    // A real press and a real move past the 12 px drag threshold.
    const drag = cards[Math.floor(cards.length / 2)];
    await mouse('mousePressed', drag.x, drag.y, { buttons: 1 });
    await mouse('mouseMoved', drag.x + 6, drag.y - 6, { buttons: 1 });
    await mouse('mouseMoved', drag.x + 30, drag.y - 60, { buttons: 1 });
    await mouse('mouseMoved', drag.x + 40, drag.y - 90, { buttons: 1 });
    await wait(120);
    const gx = drag.x + 40;
    const gy = drag.y - 90;
    const gh = await evalIn(GHOST(gx, gy));
    if (!gh) {
      ok(false, `${name}: a drag ghost appeared (nothing to measure)`);
    } else {
      const offX = L(gh.offX);
      const offY = L(gh.offY);
      // combat.js writes `transform:scale(1.1)` on the clone, so its rendered box
      // is 10% wider than the box the left/top were written for and grows about
      // its centre. That is ONE literal line of the code under test, modelled here
      // exactly rather than absorbed into a tolerance — at z=1.00, where local and
      // visual are the same number, this predicted the residual to 0.0 px, which
      // is the only reason the ±3 below is a real bound and not a fudge.
      const spread = (v) => (L(v) * (1 - 1 / 1.1)) / 2;
      const wantX = 70 + spread(gh.r.width);
      const wantY = 100 + spread(gh.r.height);
      console.log(
        `    ghost    cursor(${n2(gx)},${n2(gy)}) box(${n2(gh.r.left)},${n2(gh.r.top)} ${n2(gh.r.width)}x${n2(gh.r.height)}) ` +
          `grip (${n2(offX)},${n2(offY)}) local, want (${n2(wantX)},${n2(wantY)}) · on-screen ${n2(L(gh.onX))}x${n2(L(gh.onY))} local`
      );
      ok(
        Math.abs(offX - wantX) <= TOL.anchor && Math.abs(offY - wantY) <= TOL.anchor,
        `${name}: drag ghost hangs off the pointer at its stated grip — (${n2(offX)},${n2(offY)}) vs (${n2(wantX)},${n2(wantY)}), tolerance ±${TOL.anchor}`
      );
      ok(gh.anyPixel && L(gh.onX) >= 40 && L(gh.onY) >= 40, `${name}: drag ghost keeps ≥40 local px on screen on both axes (bounded — it can never vanish)`);
    }
    await mouse('mouseReleased', gx, gy, { buttons: 0 });
    await wait(250);

    // -------------------------------------------------- 3. the card-fly ghost
    // flyCard() clones the played card and starts it EXACTLY on that card, then
    // translates it to the target. Re-boot so the board is untouched by the drag
    // above, snapshot the card, play it, and catch the ghost inside its 220 ms.
    await boot(vp, 'shot=combat');
    await until(`!!document.querySelector('.combat .hand .card')`, `${name}: combat board (fly)`);
    await wait(800);
    //
    // The comparison is Δ(ghost, the card it cloned) in LOCAL px, and it is NOT
    // asserted to be zero. `.hand .card.selected` carries
    // `translateY(-56px) scale(1.32) !important` (combat.css) and the ghost keeps
    // the class but not the `.hand` ancestor, so the selector stops matching and
    // the ghost renders untransformed — a real, pre-existing cosmetic difference
    // that has nothing to do with zoom, and modelling it would be modelling the
    // stylesheet. What IS asserted is that the difference is the SAME LOCAL
    // NUMBER at every zoom: a CSS transform is constant in local px, a
    // coordinate-space error is (1−1/z)·offset and grows with the dial.
    const c0 = await evalIn(`(() => { const c = document.querySelector('.hand .card'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!c0) {
      ok(false, `${name}: a hand card to play`);
    } else {
      let ghostSeen = null;
      let from = null;
      for (let attempt = 0; attempt < 3 && !ghostSeen; attempt++) {
        await mouse('mousePressed', c0.x, c0.y, { buttons: 1 });
        await mouse('mouseReleased', c0.x, c0.y, { buttons: 0 });
        await wait(80);
        // Read the card's box HERE — after selection, before the commit. This is
        // the rect flyCard() itself reads, transform and all; reading it before
        // the click measured a differently-transformed card and made the harness
        // disagree with itself at z=1.00, where the code is known-correct.
        const snap = await evalIn(`(() => {
          const c = document.querySelector('.hand .card'); if (!c) return null;
          const r = c.getBoundingClientRect();
          // Anchor centres are captured HERE, before the commit, because flyCard
          // reads them before dispatch — and dispatch starts the actor's lunge
          // (fx.js flash 'act-attack'), which MOVES the sprite. Reading them after
          // the click measured a target that had since walked, and reported a flat
          // ~12 local px miss at every zoom that belonged to the animation.
          return { left: r.left, top: r.top, width: r.width, height: r.height,
            sprites: [...document.querySelectorAll('[data-eid] .sprite')].map((s) => {
              const b = s.getBoundingClientRect();
              return { eid: s.closest('[data-eid]').dataset.eid, cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
            }) };
        })()`);
        const tgt = await evalIn(`(() => {
          const e = document.querySelector('.enemy:not(.dead)') || document.querySelector('.field');
          if (!e) return null; const r = e.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        if (!tgt || !snap) break;
        await mouse('mousePressed', tgt.x, tgt.y, { buttons: 1 });
        await mouse('mouseReleased', tgt.x, tgt.y, { buttons: 0 });
        await wait(25);
        ghostSeen = await evalIn(`(() => {
          const g = document.querySelector('.card-ghost');
          if (!g) return null;
          const r = g.getBoundingClientRect();
          // THE TRANSFORM. combat.js writes translate(dx,dy) from the same two
          // rects as left/top, and zoomunits.mjs reads neither transform nor
          // cssText — so this write was never in the carried set and never could
          // have been (Marina's ruling section 1). Reading the INLINE string, not
          // the animated rect, so the measurement does not race the 220 ms
          // transition. The destination is combat.js:66 anchorFor:
          // [data-eid] .sprite — every candidate is listed, and the assertion is
          // that the delta matches exactly one of them.
          const m = /translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/.exec(g.style.transform || '');
          return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom,
                   onX: Math.min(r.right, innerWidth) - Math.max(r.left, 0),
                   onY: Math.min(r.bottom, innerHeight) - Math.max(r.top, 0),
                   tx: m ? parseFloat(m[1]) : null, ty: m ? parseFloat(m[2]) : null,
                   // The ghost's pre-transform box, read from the INLINE strings —
                   // those are local px by construction, and unlike the rect they
                   // do not move while the transition runs.
                   inLeft: parseFloat(g.style.left), inTop: parseFloat(g.style.top),
                   inWidth: parseFloat(g.style.width),
                   // The ghost's PRE-TRANSFORM box, measured by removing the
                   // transform for one read and putting it straight back. Modelling
                   // it instead — offsetHeight, or 19.6rem times a font size — was
                   // wrong by 7.6 local px, because offsetHeight and the rendered
                   // border box are not the same number here. Measure the box, do
                   // not reconstruct it.
                   pre: (() => {
                     // transition:none FIRST. Without it, setting transform:'none'
                     // merely starts a new 220 ms transition FROM the current
                     // animated value, so the read came back mid-flight and the
                     // miss got worse, not better — a probe that looked like it had
                     // found a bigger bug when it had only measured itself later.
                     const svT = g.style.transition, svX = g.style.transform;
                     g.style.transition = 'none';
                     g.style.transform = 'none';
                     const q = g.getBoundingClientRect();
                     g.style.transform = svX;
                     g.style.transition = svT;
                     return { left: q.left, top: q.top, width: q.width, height: q.height };
                   })() };
        })()`);
        if (ghostSeen) from = snap;
      }
      if (!ghostSeen) {
        ok(false, `${name}: a card-fly ghost appeared (nothing to measure)`);
      } else {
        const dL = L(ghostSeen.left - from.left);
        const dT = L(ghostSeen.top - from.top);
        const dW = L(ghostSeen.width - from.width);
        console.log(
          `    flyghost card(${n2(from.left)},${n2(from.top)} ${n2(from.width)}w) ghost(${n2(ghostSeen.left)},${n2(ghostSeen.top)} ${n2(ghostSeen.width)}w) ` +
            `Δ (${n2(dL)},${n2(dT)}) local, Δw ${n2(dW)} local · on-screen ${n2(L(ghostSeen.onX))}x${n2(L(ghostSeen.onY))} local`
        );
        flyByViewport.push({ name, z, dL, dT, dW });
        ok(L(ghostSeen.onX) >= 40 && L(ghostSeen.onY) >= 40, `${name}: card-fly ghost keeps ≥40 local px on screen on both axes (bounded)`);

        // …and where it FLIES to. This is the write no instrument in this repo can
        // see: zoomunits reads neither `transform` nor `cssText`, so it was never
        // in the carried set and never could have been.
        if (ghostSeen.tx == null) {
          ok(false, `${name}: card-fly ghost carries an inline translate() to measure`);
        } else {
          const cx = L(ghostSeen.pre.left + ghostSeen.pre.width / 2);
          const cy = L(ghostSeen.pre.top + ghostSeen.pre.height / 2);
          const aimed = from.sprites
            .map((s) => ({ eid: s.eid, ex: L(s.cx) - cx - ghostSeen.tx, ey: L(s.cy) - cy - ghostSeen.ty }))
            .map((s) => ({ ...s, err: Math.hypot(s.ex, s.ey) }))
            .sort((a, b) => a.err - b.err);
          const best = aimed[0];
          console.log(
            `    flyaim   translate(${n2(ghostSeen.tx)},${n2(ghostSeen.ty)}) local · nearest anchor ${best.eid} off by ${n2(best.err)} local` +
              ` [ex ${n2(best.ex)} ey ${n2(best.ey)}]` +
              ` (next: ${aimed[1] ? `${aimed[1].eid} ${n2(aimed[1].err)}` : 'none'})`
          );
          aimByViewport.push({ name, z, eid: best.eid, ex: best.ex, ey: best.ey, err: best.err });
          ok(
            best.eid !== null && aimed[1] && aimed[1].err > best.err * 5,
            `${name}: card-fly ghost's translate() aims at ONE anchor unambiguously — ${best.eid} at ${n2(best.err)} local, next ${aimed[1] ? n2(aimed[1].err) : 'n/a'}`
          );
        }
      }
    }

    // ------------------------------------------------ 4. poseFxShowcase (?shot=fx)
    // Dev-only, and it is the harness that generates this repo's screenshot
    // evidence — so a miss here does not reach a player but does reach every
    // picture we look at to decide whether something landed.
    await boot(vp, 'shot=fx');
    await until(`!!document.querySelector('.fx-layer .float-num')`, `${name}: ?shot=fx posed`, 20000);
    await wait(300);
    const pose = await evalIn(`(() => {
      const layer = document.querySelector('.fx-layer');
      const enemies = [...document.querySelectorAll('.combatant.enemy .sprite')];
      const player = document.querySelector('.combatant.player .sprite');
      if (!layer || !enemies.length || !player) return null;
      const lr = layer.getBoundingClientRect();
      // The five put() calls in main.js poseFxShowcase, in order, with the anchor
      // each one names and the local dx/dy it asks for.
      const want = [
        ['.fx-slash', enemies[0], 0, 0],
        ['.float-num.crit', enemies[0], 0, -34],
        ['.fx-spark', enemies[1] || enemies[0], 0, 0],
        ['.float-num.blk', enemies[1] || enemies[0], 0, -30],
        ['.fx-glyph', player, 0, 0],
      ];
      const out = [];
      for (const [sel, anchor, dx, dy] of want) {
        const el = layer.querySelector(sel);
        if (!el || !anchor) { out.push({ sel, missing: true }); continue; }
        const er = el.getBoundingClientRect();
        const ar = anchor.getBoundingClientRect();
        // What the element's inline left/top RESOLVED TO on screen, and what the
        // author asked for: the anchor's centre-x and 40% down, offset by dx/dy
        // LOCAL px (they are hand-written constants in the same space as fx.js).
        out.push({
          sel,
          visLeft: er.left, visTop: er.top,
          wantVisLeftBase: ar.left + ar.width / 2, wantVisTopBase: ar.top + ar.height * 0.4,
          dx, dy,
          inLayer: er.left >= lr.left - 0.5 && er.top >= lr.top - 0.5 && er.right <= lr.right + 0.5 && er.bottom <= lr.bottom + 0.5,
        });
      }
      return { out };
    })()`);
    if (!pose) {
      ok(false, `${name}: ?shot=fx posed a board (nothing to measure)`);
    } else {
      for (const p of pose.out) {
        if (p.missing) {
          ok(false, `${name}: ?shot=fx placed ${p.sel}`);
          continue;
        }
        // The element's own transform (the fx keyframes) moves it after layout,
        // so compare the INLINE-placed origin, not the animated box: left/top of
        // the border box already include the transform. poseFxShowcase pauses the
        // animation at a frame, so the transform is a fixed, class-determined
        // offset — measured as the residual after removing the anchor term, which
        // is why the tolerance below is on the DIFFERENCE ACROSS ZOOMS, reported
        // per viewport for a human to read, and asserted only on the local miss.
        const missX = L(p.visLeft - (p.wantVisLeftBase + p.dx * z));
        const missY = L(p.visTop - (p.wantVisTopBase + p.dy * z));
        console.log(
          `    fx ${p.sel.padEnd(17)} miss (${n2(missX)},${n2(missY)}) local · inLayer=${p.inLayer}`
        );
      }
      // Assert on the SPREAD, not the absolute miss: each fx class carries its own
      // CSS transform (centring, rotation, keyframe pose) which this harness does
      // not model, so the absolute number is not zero even when placement is
      // right. What placement error looks like is a miss that GROWS with zoom;
      // what a CSS transform looks like is the same local miss at every zoom.
      // The spread across viewports is computed after the loop.
      poseByViewport.push({ name, z, out: pose.out.map((p) => (p.missing ? null : { sel: p.sel, missX: L(p.visLeft - (p.wantVisLeftBase + p.dx * z)), missY: L(p.visTop - (p.wantVisTopBase + p.dy * z)), inLayer: p.inLayer })) });
      ok(pose.out.every((p) => p.missing || p.inLayer), `${name}: every ?shot=fx element is inside the fx layer (bounded)`);
    }
  }

  // ------------------------------------ the card-fly verdict, across zooms
  if (flyByViewport.length > 1) {
    console.log(`\n  card-fly ghost — Δ(ghost, its card) vs zoom, REPORTED AND NOT ASSERTED:`);
    for (const r of flyByViewport) console.log(`    z${r.z} ${r.name.padEnd(10)} Δ (${n2(r.dL)},${n2(r.dT)}) Δw ${n2(r.dW)}`);
    console.log(`    This Δ is dominated by the .hand .card.selected transform the ghost loses when`);
    console.log(`    it is reparented to <body>, whose size depends on which card was drawn and on`);
    console.log(`    whether the synthetic pointer left it hovered. It is not constant BETWEEN RUNS,`);
    console.log(`    let alone between zooms, so any threshold here would be fitted to the run I`);
    console.log(`    happened to look at — which is the exact failure this whole file exists over.`);
    console.log(`    The exact claim about this ghost is the flyaim check: it is computed from the`);
    console.log(`    START position AND the flight delta, so a wrong start cannot pass it either.`);
  }

  // ---------------------------------------- the card-fly AIM verdict, across zooms
  //
  // THE ASSERTION IS ON THE SPREAD, not on the absolute, and the reason is the
  // whole subject of #15. The flight delta is off its anchor by a constant ~3.5
  // local px because the card carries `.hand .card.selected` (scale 1.32) and the
  // ghost stops matching that selector once reparented — a CSS difference, not a
  // coordinate-space one. A coordinate-space error is (1−1/z)·offset: it is ZERO at
  // zoom 1.00 and grows in both directions away from it. So "same number at every
  // zoom" is the predicate that separates them, and it is the one this card is
  // about. Asserting the absolute instead would force me to model the stylesheet,
  // and a check that models the implementation proves the implementation.
  if (aimByViewport.length > 1) {
    console.log(`\n  card-fly ghost aim — miss vs zoom (constant = CSS; growing = the coordinate space)`);
    for (const r of aimByViewport) console.log(`    z${r.z} ${r.name.padEnd(10)} → ${r.eid}  (${n2(r.ex)},${n2(r.ey)})  |${n2(r.err)}|`);
    const sp = (k) => Math.max(...aimByViewport.map((r) => r[k])) - Math.min(...aimByViewport.map((r) => r[k]));
    const spread = Math.max(sp('ex'), sp('ey'));
    ok(spread <= TOL.anchor, `card-fly ghost aim: the miss is the same local number at every zoom (spread ${n2(spread)} local px, tolerance ${TOL.anchor})`);
  }

  // ------------------------------------------- the ?shot=fx verdict, across zooms
  if (poseByViewport.length > 1) {
    console.log(`\n  ?shot=fx — placement error vs zoom (a CSS transform is CONSTANT across zooms; a`);
    console.log(`  coordinate-space bug GROWS with zoom, because the error term is (1−1/z)·offset)`);
    const sels = [...new Set(poseByViewport.flatMap((v) => v.out.filter(Boolean).map((p) => p.sel)))];
    for (const sel of sels) {
      const rows = poseByViewport.map((v) => ({ z: v.z, p: v.out.find((p) => p && p.sel === sel) })).filter((r) => r.p);
      const xs = rows.map((r) => r.p.missX);
      const ys = rows.map((r) => r.p.missY);
      const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      console.log(`    ${sel.padEnd(17)} ${rows.map((r) => `z${r.z}:(${n2(r.p.missX)},${n2(r.p.missY)})`).join('  ')}`);
      ok(spread <= TOL.fx, `?shot=fx ${sel}: placement error is the same at every zoom (spread ${n2(spread)} local px, tolerance ${TOL.fx}) — a spread means the coordinate space, not the CSS`);
    }
  }

  console.log('\nBOUNDARY: four sites, Linux headless Chrome, the viewports listed above, and');
  console.log('          --ui-zoom only. Not looked at: the five anchorLocalBox call sites in');
  console.log('          fx.js, touch input, browser page zoom, and whether any of it FEELS');
  console.log('          right — that is a person, not a number.');
  console.log('BOUNDARY: every miss is divided by --ui-zoom before it is compared. That is only');
  console.log('          the right space if a fixed child of <body> scales by exactly that');
  console.log('          factor, which the first check of each viewport measures rather than');
  console.log('          assumes. If that check fails, ignore every other number in the run.');
  console.log(`\nRESULT: ${fails.length ? `${fails.length} FAILED` : 'all cases within tolerance'}`);
  for (const f of fails) console.log(`  ✗ ${f}`);

  cdp.close();
  child.kill();
  if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

const poseByViewport = [];
const flyByViewport = [];
const aimByViewport = [];

main().catch((e) => {
  console.error(`zoomplace: ${e.message}`);
  process.exit(2);
});
