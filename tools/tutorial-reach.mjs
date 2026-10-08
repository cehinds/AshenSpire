// tools/tutorial-reach.mjs — can a real player finish (or skip) the first-run
// tutorial at every viewport we ship to?
//
// The first-run coach marks (src/ui/components/tutorial.js) are the ONLY thing
// that writes `seenTutorial` (main.js onTutorialDone): if their two buttons are
// off-screen, the veil is un-dismissable AND comes back on reload. So button
// reachability is not cosmetic — it is the exit from the first fight.
//
// This drives a real headless Chrome at each viewport, mounts the real tutorial
// over a real combat board, and, per step, checks the buttons are on-screen and
// actually hit-testable, then advances with REAL mouse clicks at their screen
// coordinates (never el.click(), which would bypass the geometry under test).
// It also checks the ordered Escape contract that must not depend on geometry:
// an armed attack owns the first Escape (targeting cancels while the tutorial
// stands), an adjacent menu owns its Escape, and only a later unarmed Escape
// finishes and persists the tutorial.
//
// Zero dependencies: CDP over Node's built-in WebSocket, tools/serve.mjs
// in-process (same pattern as tools/coop-shoot.mjs).
//
//   node tools/tutorial-reach.mjs
//   node tools/tutorial-reach.mjs --root
//   node tools/tutorial-reach.mjs --screenshot docs/preview/tutorial-escape-target-cancel.png
//   CHROME=/path/to/chrome node tools/tutorial-reach.mjs
//   node tools/tutorial-reach.mjs --browser /path/to/chrome --only 1920x1080
//   node tools/tutorial-reach.mjs --only first-run   (the durable-storage walk alone)
//   node tools/tutorial-reach.mjs --only 1920x1080,2560x1440,resize   (a CI shard)

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
// The orientation gate's one number, read from its single home. See THE FIRST
// VIEWPORT IS DERIVED, NOT TYPED below for why this import exists.
import { balance } from '../src/content/balance.js';
import { SETTINGS_DEFAULTS } from '../src/content/settingsDefaults.js';

// Derived here, above --selftest, because BOTH readers need it and two reads of
// one number is the defect this derivation exists to remove.
const GATE_BELOW_H = balance?.ui?.uiScale?.gateBelowH;
if (typeof GATE_BELOW_H !== 'number' || !Number.isFinite(GATE_BELOW_H)) {
  // Absent is not a pass. A missing constant here would silently produce a NaN
  // viewport and the browser would pick a size of its own, so this fails loudly
  // rather than measuring something nobody chose.
  console.error('tutorial-reach: balance.ui.uiScale.gateBelowH is absent or not finite.');
  console.error('  The first viewport is derived from it and there is nothing to derive from.');
  console.error('  UNKNOWN BLOCKS — this is not a pass and not a soft red.');
  process.exit(2);
}
// The smallest viewport this tool drives, as `--only` spells it (`${w}x${h}`).
const SMALLEST_VP = { w: 800, h: GATE_BELOW_H };
const SMALLEST_VP_NAME = `${SMALLEST_VP.w}x${SMALLEST_VP.h}`;

// DOOR, and why --selftest exists (Rune, 2026-08-15). The real input is the
// rendered coach mark driven by REAL mouse clicks at real screen coordinates
// — never el.click(), which would bypass the geometry under test. That door
// is the strongest thing in this file. What it had no re-runnable known-bad
// for was the property it exists to protect: that the veil's two buttons stay
// hit-testable, because they are the ONLY thing that writes `seenTutorial`,
// so an unreachable button is an un-dismissable veil that returns on reload.
// Vira's audit (2026-08-14) rated this NO-KNOWN-BAD. `--selftest` plants that
// exact lockout as CSS bytes in a copy of the real tree and re-runs this whole
// tool against it — same serve.mjs, same browser, same real clicks.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'tutorial-reach.mjs',
    extraCopy: ['art-release.json'], // Required by the source server's build identity.
    // DERIVED, not typed — this named the viewport as a literal '800x450' until
    // 2026-08-16. When the gate moved 432 -> 465 the first viewport moved with
    // it and this string did not, so `--only` would have matched NO viewport and
    // the plants would have been re-run against an empty sweep. doorplant would
    // have called that a failure rather than a pass (it requires a non-zero exit
    // AND a matching line), so it fails loudly — but a known-bad harness aimed at
    // a viewport that no longer exists is checking nothing, and "it fails loudly"
    // is not the same as "it is checking the thing". One home, both readers.
    args: ['--only', SMALLEST_VP_NAME],
    timeoutMs: 900000,
    plants: [
      {
        // The discriminating #17 regression: restoring the old selected-card
        // conjunct leaves attack targeting green but makes targeted flasks lose
        // their first Escape to the tutorial capture listener.
        name: 'tutorial target guard narrows to selected cards and misses targeted flasks',
        file: 'src/ui/components/tutorial.js',
        find: "    if (root.querySelector('.enemy-row .enemy.targetable')) return;",
        replace: "    if (root.querySelector('.hand .card.selected') && root.querySelector('.enemy-row .enemy.targetable')) return;",
        expectRed: /✗ .*targeted-flask Escape cancels targeting and leaves the tutorial standing/,
      },
      {
        name: 'tutorial Escape takes an armed self Counter instead of yielding its cancellation',
        file: 'src/ui/components/tutorial.js',
        find: "    if (root.querySelector('.combatant.player.armed')) return;",
        replace: '    /* planted: self Counter confirmation loses Escape to the tutorial */',
        expectRed: /✗ .*self-Counter Escape cancels without spending and leaves the tutorial standing/,
      },
      {
        // THE LOCKOUT ITSELF: the button row pushed off the bottom of the
        // viewport, which is the state the header says makes the veil
        // un-dismissable AND persistent across a reload. Transform displaces
        // the real controls after inline placement in either coordinate owner.
        name: 'the coach mark buttons are pushed off the bottom of the viewport (the un-dismissable veil)',
        file: 'styles/ui.css',
        append: '.tut-row { transform: translateY(4000px) !important; }',
        expectRed: /(FAIL|off-screen|not hit-testable|unreachable|✗)/i,
      },
      {
        // The other way the same lockout arrives: something else answers the
        // hit-test at the button's own coordinates, so a REAL click lands on
        // the veil instead of the control. el.click() would not notice. Cover
        // the real button row as well, independently of its coordinate owner.
        name: 'a transparent layer covers the buttons — a real click lands on the veil',
        file: 'styles/ui.css',
        append: '.tut-veil::after, .tut-bubble::after, .tut-row::after { content: ""; position: fixed; inset: 0; z-index: 99999; pointer-events: auto; }',
        expectRed: /(FAIL|not hit-testable|covered|unreachable|✗)/i,
      },
    ],
  }));
}

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
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

// Both edges are viewport edges here: --ui-zoom is min(w/designW, h/designH)
// clamped to [min, max] (balance.js uiScale), so the two ends of the dial are
// the two ends of this list. The middle four are the sizes Sunna measured.
//
// ---- THE FIRST VIEWPORT IS DERIVED, NOT TYPED -------------------------------
//
// It read `{ w: 800, h: 450 }` until 2026-08-16, when the orientation gate's one
// number moved 432 -> 465 (balance.ui.uiScale.gateBelowH, re-derived against the
// wall). 450 fell FIFTEEN PX BELOW the gate, the upright veil correctly covered
// the board, and this tool went exit 1 with three failures — naming the culprit
// itself, `elementFromPoint -> modal-veil upright-veil`. The tool was right and
// the viewport was stale.
//
// A HAND-TYPED 465 HERE WOULD BE THE SAME DEFECT ONE FILE OVER. The whole
// subject of that change was a number anchored in two places; "fixing" it by
// typing the new value into a second file re-creates the thing on the day it
// was collapsed. So the height is READ from the number's one home, and it moves
// when the gate moves, forever.
//
// SAME DOOR AS uprightgate --ladder, deliberately: import src/content/balance.js
// in Node — same bytes, different loader. Whether the shipped bundle carries
// those bytes is tools/verify-shipped.mjs's subject, not this file's.
//
// WHAT THIS COSTS, AND IT IS A REAL LOSS, STATED RATHER THAN DISCOVERED: at
// width 800 the MIN clamp is NO LONGER REACHABLE above the gate. 800x465 zooms
// to 0.64, not the 0.62 floor — that floor now needs w <= designW*min = 744,
// and whether this list should carry such a viewport is a coverage decision
// about what we ship, not a merge-time edit. Filed with this act, not taken.
const VIEWPORTS = [
  // The smallest screen we ship: the lowest height the upright gate ADMITS, at
  // the width every wall in the derivation was measured at (800). Derived and
  // named once, above --selftest, because that harness reads it too.
  SMALLEST_VP,
  { w: 1024, h: 640 },  // zoom 0.85 — below the design baseline
  { w: 1200, h: 730 },  // zoom 1.00 — the design baseline, the case that always worked
  { w: 1280, h: 800 },  // zoom 1.07
  { w: 1366, h: 768 },  // zoom 1.05
  { w: 1440, h: 900 },  // zoom 1.20
  { w: 1920, h: 1080 }, // zoom 1.48 — the most common desktop resolution
  { w: 2560, h: 1440 }, // zoom 1.70 — the MAX clamp
];

const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
// `--only` takes one case or a comma list of them: viewport names as printed
// (`1920x1080`), `resize` and `first-run`. CI shards the sweep with it
// (.github/workflows/tutorial-reach.yml). An unknown name is refused rather than
// silently matching nothing — an empty sweep is not a pass.
const CASES = [...VIEWPORTS.map((v) => `${v.w}x${v.h}`), 'resize', 'first-run'];
// A bare `--only` or `--only ""` is an error (exit 2), not the full sweep.
// `smallest` names the smallest viewport by role, so the CI matrix does not
// repeat the gate-derived `800x<gateBelowH>` and go red when the gate moves.
const onlySet = args.includes('--only')
  ? new Set((only || '').split(',').map((n) => n.trim()).filter(Boolean).map((n) => (n === 'smallest' ? SMALLEST_VP_NAME : n)))
  : null;
if (onlySet) {
  const unknown = [...onlySet].filter((n) => !CASES.includes(n));
  if (unknown.length || !onlySet.size) {
    console.error(`tutorial-reach: --only names no case it knows: ${JSON.stringify(unknown)}; cases are ${CASES.join(', ')}`);
    process.exit(2);
  }
}
const want = (name) => !onlySet || onlySet.has(name);
const rootArtifact = args.includes('--root');
const screenshotPath = argOf('--screenshot');

const fails = [];
let passedCount = 0;
const ok = (cond, msg) => { console.log(`    ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); else passedCount += 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- minimal CDP client over Node's global WebSocket (per tools/coop-shoot.mjs)
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
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}


// Page-side probe: where are the tutorial's two exits, and can they be hit?
// `inside` = every corner within the viewport; `hit` = elementFromPoint at the
// button's centre really lands on the button (nothing covering it, and the
// centre is on-screen at all).
const PROBE = `(() => {
  const veil = document.querySelector('.tut-veil');
  if (!veil) return { veil: false };
  const vw = innerWidth, vh = innerHeight;
  const box = (sel) => {
    // Controls remain inside the pointer-transparent veil and own their hit
    // lane independently of the prose bubble. Measure those live controls
    // while the veil remains the tutorial-presence guard.
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const onScreenCentre = cx >= 0 && cy >= 0 && cx < vw && cy < vh;
    const at = onScreenCentre ? document.elementFromPoint(cx, cy) : null;
    return {
      left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom),
      inside: r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh,
      anyPixelVisible: r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh,
      hit: !!(at && (at === el || el.contains(at))),
      cx, cy,
    };
  };
  const spot = veil.querySelector('.tut-spot').getBoundingClientRect();
  return {
    veil: true, vw, vh,
    zoom: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1,
    label: document.querySelector('.tut-next')?.textContent || '',
    next: box('.tut-next'), skip: box('.tut-skip'),
    spot: { left: Math.round(spot.left), top: Math.round(spot.top), width: Math.round(spot.width), height: Math.round(spot.height) },
  };
})()`;

// Does the spotlight actually sit on the element the step is talking about?
// (Placement in the wrong coordinate space still "works" if you only ask
// whether the buttons are on-screen — this asks whether it points at anything.)
const SPOT_ON_TARGET = `(() => {
  const sels = ['.energy-orb', '.enemy-row .intent', '.hand .card', '.end-turn'];
  const veil = document.querySelector('.tut-veil');
  if (!veil) return null;
  const s = veil.querySelector('.tut-spot').getBoundingClientRect();
  let best = 0, bestSel = null;
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const ov = Math.max(0, Math.min(s.right, r.right) - Math.max(s.left, r.left)) *
               Math.max(0, Math.min(s.bottom, r.bottom) - Math.max(s.top, r.top));
    const frac = r.width * r.height ? ov / (r.width * r.height) : 0;
    if (frac > best) { best = frac; bestSel = sel; }
  }
  return { cover: best, sel: bestSel };
})()`;

// Page-side: resolves once the board and the spotlight are AT REST — the lit
// box, every step's target, the viewport and --ui-zoom all unchanged for
// SETTLED_MS of time AND SETTLED_FRAMES rendered frames — and says how long
// that took. The spotlight checks read after this, never after a fixed sleep.
// Measured on a loaded 4-core machine: the page delivered a resize 3.6 s after
// CDP sent it and then rendered in 400-900 ms gaps while the action row
// re-laid itself, so "1200 ms after the resize" was sometimes before the
// resize and sometimes mid-move — a reading of the race, not of the game. At
// rest is the state a player sees, and nothing is loosened by waiting for it:
// a spotlight that never followed its target is at rest in the wrong place,
// and the coverage check below still fails it. Never resolving within
// SETTLED_TIMEOUT_MS is reported as such (`settled: false`) and the caller
// fails on it — a board that never stops moving is not a pass.
const SETTLED_MS = 700;
const SETTLED_FRAMES = 30;
const SETTLED_TIMEOUT_MS = 15000;
const SETTLED = `new Promise((resolve) => {
  const sels = ['.energy-orb', '.enemy-row .intent', '.hand .card', '.end-turn'];
  const rect = (el) => { if (!el) return '-'; const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); };
  const key = () => [innerWidth, innerHeight, getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'),
    rect(document.querySelector('.tut-spot')), ...sels.map((s) => rect(document.querySelector(s)))].join('|');
  const t0 = performance.now();
  let last = key(), since = t0, frames = 0;
  const tick = () => {
    const now = performance.now(), k = key();
    if (k !== last) { last = k; since = now; frames = 0; } else frames += 1;
    if (now - since >= ${SETTLED_MS} && frames >= ${SETTLED_FRAMES}) return resolve({ settled: true, ms: Math.round(now - t0) });
    if (now - t0 > ${SETTLED_TIMEOUT_MS}) return resolve({ settled: false, ms: Math.round(now - t0) });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})`;

async function main() {
  if (!browserPath) throw new Error('no Chrome/Edge found — pass --browser PATH or set $CHROME');
  const { server, port } = await serve({ root: ROOT, port: 8240, open: false });
  const base = `http://localhost:${port}/${rootArtifact ? 'AshenSpire.html' : ''}`;
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'tutreach-', browser: browserPath,
    args: ['--window-size=1440,860', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
    timeoutMs: 12000,
  });
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
  const clickAt = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, S);
    }
    // .tut-spot animates left/top/width/height over 200ms (ui.css) — measuring
    // before it lands reads the slide, not the placement. Settle past it.
    await wait(340);
  };
  const holdAt = async (x, y, ms = 750) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, S);
    await wait(ms);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, S);
    await wait(340);
  };
  const pressKey = async (key, code, keyCode) => {
    for (const type of ['keyDown', 'keyUp']) {
      await cdp.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, S);
    }
    await wait(150);
  };
  const clickSel = async (sel, label) => {
    const pt = await evalIn(`(() => {
      const e = document.querySelector(${JSON.stringify(sel)});
      if (!e) return null;
      const before = e.getBoundingClientRect();
      const off = before.bottom > innerHeight || before.top < 0;
      if (off) e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, scrolled: off, top: Math.round(before.top) };
    })()`);
    if (!pt) throw new Error(`no element for ${label} (${sel})`);
    if (pt.scrolled) console.log(`    note: ${label} laid out at top ${pt.top} — scrolled into view to click it`);
    await clickAt(pt.x, pt.y);
  };
  // A hover tooltip owns the next Escape (tooltip.js peels one layer per
  // press), and the pointer is left resting wherever the last real click
  // landed — on a card, or on a combatant the board has just drawn under it.
  // A Escape aimed at the targeting then closes a tooltip instead, and the case
  // flakes on timing (it did, 1 run in ~6, 2026-10-02). So before an Escape
  // under test the pointer is parked in the corner and no tooltip stands — the
  // state a player is in when they reach for Escape, not a hover they left.
  const parkPointer = async () => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }, S);
    await until(`![...document.querySelectorAll('.as-tip')].some((t) => t.style.display === 'block')`, 'no hover tooltip standing', 5000);
  };
  const advanceToPlayCards = async () => {
    for (let guard = 0; guard < 4; guard++) {
      const title = await evalIn(`(document.querySelector('.tut-title') || {}).textContent || ''`);
      if (title === 'Play cards') return true;
      if (!title) return false;
      await clickSel('.tut-next', `tutorial Next from ${title}`);
    }
    return false;
  };
  const armAttackTarget = async () => {
    for (let guard = 0; guard < 8; guard++) {
      const pt = await evalIn(`(async () => {
        const { resolveCombatCard } = await import('/src/engine/combatExpansion.js');
        const { hasImmediateHostileDamage } = await import('/tools/click-impact-card.mjs');
        const { cardTargetPlan } = await import('/src/model/cardTargets.js');
        const { previewCard } = await import('/src/engine/combat.js');
        const combat = window.__combat;
        const c = [...document.querySelectorAll('.hand .card:not(.unaffordable)')].find(node => {
          const inst = combat.piles.hand.find(card => card.instanceId === node.dataset.instanceId);
          if (!inst) return false;
          const def = resolveCombatCard(combat, inst);
          const preview = previewCard(combat, inst.instanceId);
          const plan = cardTargetPlan({ ...def, combatPreview: preview }, combat.player.id, combat.enemies,
            [{ ...combat.player, connected: true }], { solo: true });
          return plan.mode === 'enemy' && plan.legalIds.length > 0
            && hasImmediateHostileDamage(def, { targeted: true });
        });
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: c.dataset.cardId };
      })()`);
      if (!pt) return { armed: false, card: null };
      await clickAt(pt.x, pt.y);
      const state = await evalIn(`({
        armed: !!document.querySelector('.hand .card.selected') && !!document.querySelector('.enemy-row .enemy.targetable'),
        card: (document.querySelector('.hand .card.selected') || {}).dataset?.cardId || null,
      })`);
      if (state.armed) { await parkPointer(); return state; }
    }
    return { armed: false, card: null };
  };
  const armSelfCounter = async () => {
    for (let guard = 0; guard < 3; guard++) {
      const pt = await evalIn(`(async () => {
        const { resolveCombatCard } = await import('/src/engine/combatExpansion.js');
        const { combatProfileFor } = await import('/src/model/combatCardProfile.js');
        const { cardTargetPlan } = await import('/src/model/cardTargets.js');
        const combat = window.__combat;
        const c = [...document.querySelectorAll('.hand .card:not(.unaffordable)')].find(node => {
          const inst = combat.piles.hand.find(card => card.instanceId === node.dataset.instanceId);
          if (!inst) return false;
          const def = resolveCombatCard(combat, inst);
          const plan = cardTargetPlan(def, combat.player.id, combat.enemies,
            [{ ...combat.player, connected: true }], { solo: true });
          return combatProfileFor(def).maneuver === 'counter' && plan.mode === 'friendly'
            && plan.legalIds.includes(combat.player.id);
        });
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`);
      if (!pt) return { armed: false, card: null };
      await clickAt(pt.x, pt.y);
      const state = await evalIn(`({
        armed: !!document.querySelector('.hand .card.selected') && !!document.querySelector('.combatant.player.armed'),
        enemyTarget: !!document.querySelector('.enemy-row .enemy.targetable'),
        card: document.querySelector('.hand .card.selected')?.dataset.cardId || null,
      })`);
      if (state.armed) { await parkPointer(); return state; }
    }
    return { armed: false, card: null };
  };
  const gameplayReceipt = () => evalIn(`(() => {
    const c = window.__combat;
    return JSON.stringify({ player: c.player, enemies: c.enemies, piles: c.piles,
      events: c.eventLog, rng: c.rng.getCounters() });
  })()`);
  const armTargetedFlask = async () => {
    // Select by the product-owned identity rather than an inventory position:
    // the shot fixture carries Crimson then Blight, while the durable standalone
    // cell intentionally seeds only Blight. Slot 1 would test one and miss the
    // other even though both render the same authored flask.
    //
    // THE ROUTE IS THE POTIONS LIST (combatActionRow.js openCombatPotions), the
    // way a player reaches a flask in combat since WGC11. This drove the old
    // per-slot `.flask-action-menu` until 2026-10-02, a surface combat no longer
    // mounts — so the tool died on a timeout at every viewport, an instrument
    // fault that read like a game one. The Use row is reached and pressed with
    // real input; its beat (tap, hold, or a confirmation) is honoured as shipped.
    await clickSel('.combat-potions', 'the Potions control');
    const useSel = '.combat-potion-menu .potion-use[aria-label="Use Blight Coating"]';
    await until(`!!document.querySelector(${JSON.stringify(useSel)})`, 'Blight Coating Use action');
    const pt = await evalIn(`(() => {
      const b = document.querySelector(${JSON.stringify(useSel)});
      if (!b || b.disabled) return null;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, beat: b.dataset.beat || 'tap' };
    })()`);
    if (!pt) return { armed: false, selectedCard: false, beat: null };
    if (pt.beat === 'hold') await holdAt(pt.x, pt.y);
    else await clickAt(pt.x, pt.y);
    let confirmedAt = null; // set when a confirmation was answered
    if (await evalIn(`!!document.querySelector('.confirmation-modal .confirmation-confirm')`)) {
      confirmedAt = Date.now();
      await clickSel('.confirmation-modal .confirmation-confirm', 'the Use confirmation');
    }
    await until(`!document.querySelector('.combat-potion-menu')`, 'the Potions list closing on Use', 5000);
    // A confirmed answer holds an input shield (confirmationModal.js) that eats
    // every key and click on `window` in the capture phase for
    // CONFIRMATION_INPUT_SHIELD_MS after the destination paints, so the
    // confirming gesture cannot fall through to the board. Its veil can leave the
    // DOM before its listener does, and a fixed sleep raced it on a slow CI
    // runner (2026-10-02, the first PR run). So this asks the listener itself:
    // a probe listener added NOW runs after the shield's, so a synthetic keydown
    // of an unbound key reaches it only once the shield has let go.
    if (confirmedAt != null) {
      await until(`(() => {
        let through = false;
        const probe = () => { through = true; };
        window.addEventListener('keydown', probe, true);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', bubbles: true }));
        window.removeEventListener('keydown', probe, true);
        return through;
      })()`, 'the confirmation input shield releasing', 5000);
    }
    await parkPointer();
    const state = await evalIn(`({
      armed: !!document.querySelector('.enemy-row .enemy.targetable'),
      selectedCard: !!document.querySelector('.hand .card.selected'),
    })`);
    return { ...state, beat: pt.beat };
  };

  // THE FRONT DOOR, AS A NEW PLAYER WALKS IT. Until 2026-10-02 this tool clicked
  // `.slot-new` on a title that answered at once and found `#cz-start` one press
  // later. The game grew a startup gate (a timed reveal), a slot picker with a
  // decision door, and a stepped character workspace whose Begin refuses until
  // a class, a stat mode, a keepsake and starting armour are chosen — so the
  // first-run case died on "timeout: the title screen" and checked nothing.
  // The route below is the one tools/map-camera-persistence.mjs walks (same
  // selectors, same order), driven here with real clicks at real coordinates.
  const passStartupGate = async () => {
    await until(`!!(document.querySelector('.startup-gate') || document.querySelector('.title-menu .slot-new'))`, 'the startup gate or the title');
    // The gate asks for ENTER OR SPACE; a real key press, as it says.
    if (await evalIn(`!!document.querySelector('.startup-gate')`)) await pressKey('Enter', 'Enter', 13);
    await until(`!!document.querySelector('.title-menu .slot-new')`, 'the title screen');
  };
  const walkNewClimb = async (seed) => {
    await clickSel('.title-menu .slot-new', 'NEW');
    await until(`!!document.querySelector('[data-title-action="modal-continue"]:not([disabled])')`, 'the new-slot picker');
    await clickSel('[data-title-action="modal-continue"]', 'the slot picker Continue');
    await until(`!!document.querySelector('[data-title-action="review-new"]:not([disabled])')`, 'the new-slot decision door');
    await clickSel('[data-title-action="review-new"]', 'Start in this slot');
    await until(`!!document.querySelector('#cz-classes .cz-class')`, 'the Class stage');
    // Open means open, never toggle: each fold is a <details>.
    const openFace = async (key) => {
      await until(`!!document.querySelector('[data-face="${key}"]')`, `the ${key} fold`);
      if (!(await evalIn(`document.querySelector('[data-face="${key}"]')?.closest('details')?.open === true`))) {
        await clickSel(`[data-face="${key}"]`, `the ${key} fold`);
      }
    };
    await clickSel('#cz-classes .cz-class', 'the first class');
    await clickSel('#cz-next', 'Next (to Character)');
    await until(`!!document.querySelector('#cz-statedit .cc-mode-select')`, 'the Character stage');
    await openFace('primary');
    const mode = await evalIn(`(() => { const s = document.querySelector('#cz-statedit .cc-mode-select'); s.value = 'lean'; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
    if (mode !== 'lean') throw new Error(`the stat mode select offers no Standard (lean); value=${JSON.stringify(mode)}`);
    await openFace('keepsake');
    await clickSel('#cz-keepsakes [data-keepsake-id]', 'the first keepsake');
    await clickSel('#cz-next', 'Next (to Starting equip)');
    await until(`document.querySelector('#cz-tab-equipment')?.getAttribute('aria-selected') === 'true'`, 'the Starting equip stage');
    await openFace('armour');
    await clickSel('#cz-armours .equip-chip .equipment-poker-card', 'the first armour');
    await clickSel('#cz-armours .equip-chip .equipment-choose', 'Choose armour');
    for (let step = 0; step < 8; step += 1) {
      if (await evalIn(`document.querySelector('#cz-tab-review')?.getAttribute('aria-selected') === 'true'`)) break;
      if (await evalIn(`document.querySelector('[data-equipment-section="startingAbilities"]')?.closest('details')?.open === true`)) {
        while (await evalIn(`!!document.querySelector('.cc-ability-choose:not([aria-pressed="true"]):not([disabled])') && document.querySelector('#cz-next')?.getAttribute('aria-disabled') === 'true'`)) {
          await clickSel('.cc-ability-choose:not([aria-pressed="true"]):not([disabled])', 'a starting ability');
        }
      }
      await clickSel('#cz-next', 'Next (towards Review)');
    }
    await until(`document.querySelector('#cz-tab-review')?.getAttribute('aria-selected') === 'true'`, 'the Review stage');
    // Fix the seed so the first floor reliably offers a fight (the same seed the
    // ?shot= harness uses); everything else stays at the shipped defaults.
    await evalIn(`(() => { const s = document.querySelector('#seed-input'); if (!s) return null; s.value = ${JSON.stringify(seed)}; s.dispatchEvent(new Event('input', { bubbles: true })); return s.value; })()`);
    await until(`(() => { const b = document.querySelector('#cz-start'); return !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; })()`, 'Begin accepting the finished character', 5000);
    await clickSel('#cz-start', 'BEGIN THE CLIMB');
    // A new climb opens on the opening sequence before its map; Skip opening.
    await until(`!!(document.querySelector('.prologue-screen') || document.querySelector('.class-mastery-node') || document.querySelector('.map-node.reachable'))`, 'the opening sequence or the map');
    const skip = await evalIn(`(() => {
      const b = [...document.querySelectorAll('.prologue-screen .prologue-controls button')].find((c) => !c.hidden && /skip/i.test(c.textContent));
      if (!b) return false;
      b.dataset.tutReachSkip = 'true';
      return true;
    })()`);
    if (skip) await clickSel('[data-tut-reach-skip="true"]', 'Skip opening');
    await until(`!!(document.querySelector('.class-mastery-node') || document.querySelector('.map-node.reachable'))`, 'the first tree choice or map');
    if (await evalIn(`!!document.querySelector('.class-mastery-node')`)) {
      await clickSel('.class-mastery-node', 'the initial class tree choice');
    }
    await until(`!!document.querySelector('.map-node.reachable')`, 'the map');
  };

  // A fresh combat board at this viewport, with the tutorial mounted over it.
  // ?shot=combat suppresses the first-run flag, so we mount the real module by
  // hand — same entry point combat.js uses, no stubbing of the thing under test.
  async function boardWithTutorial(vp) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false }, S);
    await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat board');
    await wait(700); // auto-zoom re-flexes on a 150ms debounce, plus a boot re-apply
    return evalIn(`(async () => {
      // The expanded Reaver opener may legitimately draw only Counters and
      // friendly actions. This cell verifies Escape while a CARD target is
      // armed, not the shuffle, so give the shot fixture one authored,
      // affordable hostile card instead of mistaking Shield Bash's deferred
      // reply for an immediate attack.
      const combat = window.__combat;
      if (!combat.piles.hand.some(card => card.instanceId === 'tutorial-reach-attack')) {
        combat.piles.hand.unshift({ instanceId: 'tutorial-reach-attack', cardId: 'strike', upgraded: false });
        window.__renderCombatForShot();
      }
      const m = await import('/src/ui/components/tutorial.js');
      window.__tutDone = 0;
      m.mountTutorial(document.getElementById('app'), { onDone: () => { window.__tutDone++; } });
      return !!document.querySelector('.tut-veil');
    })()`);
  }

  if (!rootArtifact) for (const vp of VIEWPORTS) {
    const name = `${vp.w}x${vp.h}`;
    if (!want(name)) continue;
    console.log(`\n  ${name}`);
    if (!(await boardWithTutorial(vp))) { ok(false, `${name}: tutorial mounted`); continue; }

    const z0 = (await evalIn(PROBE)).zoom;
    console.log(`    ui-zoom ${z0}`);

    // 1) The veil must not be able to hold the player's board hostage: whatever
    //    the coach marks are doing, a click aimed at a card must reach the card.
    const board = await evalIn(`(() => {
      const card = document.querySelector('.hand .card');
      const r = card.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { hitsVeil: !!(at && at.closest && at.closest('.tut-veil')), tag: at ? at.className : null };
    })()`);
    ok(!board.hitsVeil, `${name}: a hand card is still clickable under the veil (elementFromPoint → ${board.tag})`);

    // …and hit-testing is not the claim — the claim is that the game answers.
    // Play a card for real, through the veil: the hand shrinks, or the card
    // arms for a target. Up to 3 attempts because the first synthetic click
    // after load is swallowed somewhere in the board's own pointer plumbing —
    // measured identical with the tutorial absent, so it is not this overlay
    // (worth its own look, but out of this fix's boundary).
    const before = await evalIn(`document.querySelectorAll('.hand .card').length`);
    let reacted = { n: before, sel: false };
    for (let a = 0; a < 3 && reacted.n === before && !reacted.sel; a++) {
      const pt = await evalIn(`(() => { const c = document.querySelector('.hand .card'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!pt) break;
      await clickAt(pt.x, pt.y);
      reacted = await evalIn(`({ n: document.querySelectorAll('.hand .card').length, sel: !!document.querySelector('.hand .card.selected') })`);
    }
    ok(reacted.n !== before || reacted.sel, `${name}: a real click plays a card THROUGH the veil (hand ${before}→${reacted.n}, selected=${reacted.sel})`);
    ok(await evalIn(`!!document.querySelector('.tut-veil')`), `${name}: …and the tutorial is still up while that happened`);

    // 2) An armed card owns cancellation before the tutorial's geometry-free exit.
    const initiallyArmed = await evalIn(`!!document.querySelector('.enemy.targetable, .combatant.player.armed')`);
    if (initiallyArmed) {
      const receipt = await gameplayReceipt();
      await pressKey('Escape', 'Escape', 27);
      ok(await evalIn(`!!document.querySelector('.tut-veil') && !document.querySelector('.hand .card.selected, .enemy.targetable, .combatant.player.armed')`)
        && await gameplayReceipt() === receipt, `${name}: through-veil card Escape cancels without spending or finishing`);
    }
    await pressKey('Escape', 'Escape', 27);
    const escaped = await evalIn(`({ done: window.__tutDone, veil: !!document.querySelector('.tut-veil') })`);
    ok(escaped.done === 1 && !escaped.veil, `${name}: Escape finishes the tutorial (onDone fired, veil removed)`);

    // #17: step 3 tells the player to arm an attack. In that state Escape is
    // cancel-targeting first, never "finish tutorial". The capture listener
    // must yield the event so combat's existing handler owns that one press.
    await boardWithTutorial(vp);
    ok(await advanceToPlayCards(), `${name}: reached tutorial step 3 (Play cards)`);
    const armed = await armAttackTarget();
    ok(armed.armed, `${name}: armed a real attack target (${armed.card || 'none'})`);
    await pressKey('Escape', 'Escape', 27);
    const cancelled = await evalIn(`({
      done: window.__tutDone,
      veil: !!document.querySelector('.tut-veil'),
      selected: !!document.querySelector('.hand .card.selected'),
      targetable: !!document.querySelector('.enemy-row .enemy.targetable'),
    })`);
    ok(
      cancelled.done === 0 && cancelled.veil && !cancelled.selected && !cancelled.targetable,
      `${name}: armed Escape cancels targeting and leaves the tutorial standing — ${JSON.stringify(cancelled)}`
    );
    await pressKey('Escape', 'Escape', 27);
    const later = await evalIn(`({ done: window.__tutDone, veil: !!document.querySelector('.tut-veil') })`);
    ok(later.done === 1 && !later.veil, `${name}: a later unarmed Escape finishes the tutorial exactly once`);

    // A self Counter has no enemy target: its player confirmation owns the same
    // first Escape. Inspect real state before/after so preparation is not paid.
    await boardWithTutorial(vp);
    ok(await advanceToPlayCards(), `${name}: reached tutorial step 3 for self Counter`);
    const selfReceipt = await gameplayReceipt();
    const armedSelf = await armSelfCounter();
    ok(armedSelf.armed && !armedSelf.enemyTarget, `${name}: armed a real self Counter — ${JSON.stringify(armedSelf)}`);
    await pressKey('Escape', 'Escape', 27);
    const selfCancelled = await evalIn(`({ done: window.__tutDone, veil: !!document.querySelector('.tut-veil'),
      selected: !!document.querySelector('.hand .card.selected'), playerArmed: !!document.querySelector('.combatant.player.armed') })`);
    ok(selfCancelled.done === 0 && selfCancelled.veil && !selfCancelled.selected && !selfCancelled.playerArmed
      && await gameplayReceipt() === selfReceipt,
      `${name}: self-Counter Escape cancels without spending and leaves the tutorial standing — ${JSON.stringify(selfCancelled)}`);
    await pressKey('Escape', 'Escape', 27);
    ok(await evalIn(`window.__tutDone === 1 && !document.querySelector('.tut-veil')`),
      `${name}: later unarmed Escape after self Counter finishes exactly once`);

    // A targeted flask arms the same enemy-targeting state without selecting a
    // hand card. This is the discriminating sibling of the attack-card case:
    // Escape must yield because the enemy is targetable, not because a selected
    // card happens to be present.
    await boardWithTutorial(vp);
    ok(await advanceToPlayCards(), `${name}: reached tutorial step 3 for targeted flask`);
    const armedFlask = await armTargetedFlask();
    ok(
      armedFlask.armed && !armedFlask.selectedCard,
      `${name}: armed Blight Coating with targetable enemy and no selected card — ${JSON.stringify(armedFlask)}`
    );
    await pressKey('Escape', 'Escape', 27);
    const flaskCancelled = await evalIn(`({
      done: window.__tutDone,
      veil: !!document.querySelector('.tut-veil'),
      selected: !!document.querySelector('.hand .card.selected'),
      targetable: !!document.querySelector('.enemy-row .enemy.targetable'),
    })`);
    ok(
      flaskCancelled.done === 0 && flaskCancelled.veil && !flaskCancelled.selected && !flaskCancelled.targetable,
      `${name}: targeted-flask Escape cancels targeting and leaves the tutorial standing — ${JSON.stringify(flaskCancelled)}`
    );
    await pressKey('Escape', 'Escape', 27);
    const afterFlask = await evalIn(`({ done: window.__tutDone, veil: !!document.querySelector('.tut-veil') })`);
    ok(afterFlask.done === 1 && !afterFlask.veil, `${name}: later unarmed Escape after flask cancel finishes exactly once`);

    // 3) The full walk, step by step, with real clicks at real coordinates.
    await boardWithTutorial(vp);
    let guard = 0;
    let walked = true;
    while (guard++ < 8) {
      const rest = await evalIn(SETTLED);
      const p = await evalIn(PROBE);
      if (!p.veil) break;
      ok(rest.settled, `${name}: step "${p.label}" — board and spotlight come to rest (${rest.ms} ms)`);
      const spotOn = await evalIn(SPOT_ON_TARGET);
      const fmt = (b) => (b ? `${b.left},${b.top}..${b.right},${b.bottom} inside=${b.inside} hit=${b.hit}` : 'MISSING');
      console.log(`    step "${p.label}" next[${fmt(p.next)}] skip[${fmt(p.skip)}] spot covers ${(spotOn.cover * 100).toFixed(0)}% of ${spotOn.sel}`);
      const reachable = p.next.inside && p.next.hit && p.skip.inside && p.skip.hit;
      ok(reachable, `${name}: step "${p.label}" — both buttons on-screen and hit-testable`);
      ok(spotOn.cover > 0.5, `${name}: step "${p.label}" — spotlight lands on its target (${(spotOn.cover * 100).toFixed(0)}% of ${spotOn.sel})`);
      if (!reachable) { walked = false; break; }
      await clickAt(p.next.cx, p.next.cy);
      const after = await evalIn(`({ done: window.__tutDone, veil: !!document.querySelector('.tut-veil'), label: (document.querySelector('.tut-next')||{}).textContent })`);
      if (!after.veil) break;
      if (after.label === p.label) { ok(false, `${name}: click on "${p.label}" advanced the tutorial`); walked = false; break; }
    }
    if (walked) {
      const end = await evalIn(`({ done: window.__tutDone, veil: !!document.querySelector('.tut-veil') })`);
      ok(end.done === 1 && !end.veil, `${name}: clicking through every step finishes the tutorial exactly once`);
    }
  }

  // Resizing was one of the three unsignposted escapes from the old lock (the
  // others: delete the save, change UI size before continuing). It has to stop
  // being an escape and start being ordinary: --ui-zoom re-flexes on resize, so
  // every callout's coordinate space changes underneath it.
  if (want('resize') && !rootArtifact) {
    console.log('\n  resize mid-tutorial: 2560x1440 → 1280x800');
    await boardWithTutorial({ w: 2560, h: 1440 });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, S);
    // main.js re-flexes zoom 150 ms after the resize, the tutorial re-places at
    // 220 ms and follows the board until it holds still, the spot slides 200 ms.
    // Those are page-clock times from when the page RECEIVES the resize, which a
    // loaded runner can deliver seconds after CDP sends it — so wait for the
    // re-flex to happen at all, then for rest, and read only then.
    let reflexed = false;
    try { reflexed = await until(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) !== 1.7`, 'the zoom re-flex'); } catch { /* reported by the zoom check below */ }
    const rest = reflexed ? await evalIn(SETTLED) : { settled: false, ms: 0 };
    const p = await evalIn(PROBE);
    const spotOn = await evalIn(SPOT_ON_TARGET);
    console.log(`    ui-zoom now ${p.zoom} · next[${p.next.left},${p.next.top}..${p.next.right},${p.next.bottom}]`);
    ok(p.zoom === 1.07, `resize: --ui-zoom re-flexed 1.7 → 1.07 (else this case tests nothing)`);
    ok(rest.settled, `resize: board and spotlight come to rest after the re-flex (${rest.ms} ms)`);
    ok(p.next.inside && p.next.hit && p.skip.inside && p.skip.hit, 'resize: both buttons still on-screen and hit-testable');
    ok(spotOn.cover > 0.5, `resize: spotlight still lands on its target (${(spotOn.cover * 100).toFixed(0)}% of ${spotOn.sel})`);

    // THE HAND MOVES BY ITSELF, TOO. hand.js re-fans from its own deferred
    // ResizeObserver layout, which can land after the tutorial's 220 ms
    // re-place without moving the step's target at all (Enemy intent, End
    // Turn). A settle loop that watched only the target never re-placed, and
    // the bubble sat on a card — the keep-clear rule (D45) undone by a resize.
    // This makes that move deterministic: on the Enemy intent step, the
    // first re-place after the resize, once the target has held its box for
    // a few frames, is followed by the hand sliding a card under where the
    // bubble now stands. The target does not move; only the keep-clear set
    // does. At rest, no card may be covered.
    console.log('\n  resize, then the hand re-fans on its own (target still): bubble keeps off every card');
    await boardWithTutorial({ w: 1920, h: 1080 });
    await clickSel('.tut-next', 'tutorial Next from Energy');
    const onIntent = await evalIn(`(document.querySelector('.tut-title') || {}).textContent || ''`);
    ok(onIntent === 'Enemy intent', `refan: on the Enemy intent step (${onIntent || 'none'})`);
    await evalIn(`(() => {
      window.__refan = null;
      const veil = document.querySelector('.tut-veil');
      addEventListener('resize', () => {
        // Wait for the re-place, then for the target to hold its box for a
        // few frames (under the settle loop's SETTLE_STILL_MS of credited
        // time, so the loop is still watching), so nothing but the hand moves.
        const intent = () => { const r = document.querySelector('.enemy-row .intent').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); };
        const mo = new MutationObserver(() => {
          mo.disconnect();
          let last = intent(), held = 0, t0 = performance.now();
          const watch = () => {
            const k = intent();
            if (k !== last) { last = k; held = 0; t0 = performance.now(); } else held += 1;
            if (held < 6 || performance.now() - t0 < 150) return requestAnimationFrame(watch);
            const hand = document.querySelector('.hand');
            const card = hand && hand.querySelector('.card');
            if (!card) { window.__refan = { moved: false }; return; }
            const b = veil.querySelector('.tut-bubble').getBoundingClientRect();
            const c = card.getBoundingClientRect();
            // The card's top-left onto the bubble's centre: a real overlap,
            // with the rest of the screen left for a clear placement.
            const dx = b.left + b.width / 2 - c.left;
            const dy = b.top + b.height / 2 - c.top;
            // translate is read in the hand's local (pre --ui-zoom) space, so
            // measure one probe move and scale the real one by it.
            hand.style.translate = '100px 100px';
            const p = card.getBoundingClientRect();
            const sx = (p.left - c.left) / 100, sy = (p.top - c.top) / 100;
            hand.style.translate = Math.round(dx / sx) + 'px ' + Math.round(dy / sy) + 'px';
            const m = card.getBoundingClientRect();
            window.__refan = { moved: true, card: [m.left, m.top].map(Math.round), onto: [b.left + b.width / 2, b.top + b.height / 2].map(Math.round) };
          };
          requestAnimationFrame(watch);
        });
        mo.observe(veil, { attributes: true, subtree: true, attributeFilter: ['style'] });
      }, { once: true });
    })()`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1000, deviceScaleFactor: 1, mobile: false }, S);
    let refanned = false;
    try { refanned = await until(`!!(window.__refan && window.__refan.moved)`, 'the hand re-fan after the re-place'); } catch { /* reported below */ }
    ok(refanned, `refan: the hand moved after the bubble's re-place (${JSON.stringify(await evalIn('window.__refan'))})`);
    const refanRest = refanned ? await evalIn(SETTLED) : { settled: false, ms: 0 };
    ok(refanRest.settled, `refan: board and spotlight come to rest (${refanRest.ms} ms)`);
    const covered = await evalIn(`(() => {
      const b = document.querySelector('.tut-bubble').getBoundingClientRect();
      const hit = [...document.querySelectorAll('.hand .card')].map((n, k) => [k, n.getBoundingClientRect()])
        .filter(([, r]) => b.left < r.right && r.left < b.right && b.top < r.bottom && r.top < b.bottom).map(([k]) => k);
      return { cards: hit, bubble: [b.left, b.top, b.right, b.bottom].map(Math.round) };
    })()`);
    ok(!covered.cards.length, `refan: the bubble covers no hand card after the hand moved on its own — ${JSON.stringify(covered)}`);
  }

  // End-to-end on the REAL first-run path, through the title screen with real
  // durable storage — no ?shot=, no hand-mounting, no seeded flag. What makes it
  // worth its own case is the reload: `seenTutorial` is written only by
  // onTutorialDone, so if Escape removed the veil without reaching finish(), the
  // coach marks would be back the moment the player reloaded, which is exactly
  // how the original lock survived. So this reloads and looks.
  //
  // It cannot use ?shot= for this. A ?shot= boot never touches durable storage
  // (main.js pickStorage — the gate added in #8 after the hook clobbered a real
  // save), so there is nothing to read back afterwards. That gate is correct and
  // this check goes the long way round instead of weakening it.
  if (want('first-run')) {
    console.log(`\n  first-run ${rootArtifact ? 'root artifact' : 'source'} path at 1920x1080: title → BEGIN → first fight → attack Escape → targeted-flask Escape → menu Escape → unarmed Escape → RELOAD`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }, S);
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`document.readyState === 'complete'`, 'the page');
    ok(await evalIn(`(() => { localStorage.clear(); return localStorage.length === 0; })()`),
      'first-run: durable storage is empty before boot');
    await cdp.send('Page.navigate', { url: base }, S);
    await passStartupGate();
    // Promoted defaults legitimately save a settings-only profile during boot.
    // Freshness means no prior play or completed tutorial, not no profile file.
    ok(
      await evalIn(`(() => {
        const meta = JSON.parse(localStorage.getItem('sote_meta_v1') || 'null');
        const noRun = !Object.keys(localStorage).some(key => /^sote_run_v1(?:_s\\d+)?$/.test(key));
        return noRun && (!meta || (meta.settings.seenTutorial !== true &&
          meta.results.length === 0 && meta.discoveredArmaments.length === 0 && meta.discoveryReceipts.length === 0));
      })()`),
      'first-run: a genuinely new player — no saved run, results, discoveries or completed tutorial'
    );
    ok(await evalIn(`(() => {
      const meta = JSON.parse(localStorage.getItem('sote_meta_v1') || 'null');
      return Object.entries(${JSON.stringify(SETTINGS_DEFAULTS.values)}).every(([key, value]) => meta?.settings?.[key] === value);
    })()`), 'first-run: every promoted default is applied to the fresh profile');
    await wait(400);
    // History kept short: this path once measured #cz-start laid out below the
    // fold at 1920x1080, scrolled past it and went green for a week — a tool
    // that measures a defect and works around it reports PASS forever. That
    // property is now tools/actionreach.mjs's; clickSel stays general (it
    // prints a `note:` whenever it has to scroll) because map nodes live on a
    // pannable canvas and legitimately need it.
    await walkNewClimb('SHOWCASE');
    await wait(500);
    const haveFight = await evalIn(`!!document.querySelector('.map-node.monster.reachable')`);
    ok(haveFight, 'first-run: the first floor offers a fight to walk into');
    const savedRules = await evalIn(`(() => {
      const saved = JSON.parse(localStorage.getItem('sote_run_v1') || 'null');
      return { expansion: saved?.combatExpansionVersion, defense: saved?.advancedConfigSnapshot?.breakMeterVersion };
    })()`);
    ok(savedRules?.expansion === 2 && savedRules?.defense === 2,
      'first-run: expanded combat and defense versions survive the actual creation save', JSON.stringify(savedRules));

    // A brand-new run intentionally carries no utility flask, and its expanded
    // opener may contain no immediate hostile card. Seed both fixtures through
    // the durable run/profile, then reload through CONTINUE so the standalone
    // cell reaches them through the real save loader and combat constructor
    // rather than mutating the rendered combat object. The profile stays
    // first-run: seenTutorial is still absent/false and the coach marks must
    // mount itself.
    const seededFlask = await evalIn(`(() => {
      const key = 'sote_run_v1';
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      saved.flasks = [{ flaskId: 'blightCoating' }];
      saved.deck = saved.deck.filter(card => card.instanceId !== 'tutorial-reach-attack');
      const selfCounter = saved.deck.find(card => card.cardId === 'shieldBash');
      if (!selfCounter) return false;
      saved.deck = saved.deck.filter(card => card.instanceId !== selfCounter.instanceId);
      saved.deck.unshift({ instanceId: 'tutorial-reach-attack', cardId: 'strike', upgraded: false }, selfCounter);
      localStorage.setItem(key, JSON.stringify(saved));
      const metaKey = 'sote_meta_v1';
      const meta = JSON.parse(localStorage.getItem(metaKey));
      meta.settings.playInDeckOrder = true;
      localStorage.setItem(metaKey, JSON.stringify(meta));
      const reread = JSON.parse(localStorage.getItem(key));
      return reread.flasks?.[0]?.flaskId === 'blightCoating'
        && reread.deck?.[0]?.instanceId === 'tutorial-reach-attack';
    })()`);
    ok(seededFlask, 'first-run: valid attack and Blight Coating rows entered through the durable save');
    await cdp.send('Page.navigate', { url: base }, S);
    await passStartupGate();
    await until(`!!document.querySelector('.slot-continue:not([disabled])')`, 'the title screen with the flask-seeded run');
    await clickSel('.slot-continue', 'CONTINUE the flask-seeded run');
    await until(`!!document.querySelector('.map-node.monster.reachable')`, 'the resumed map with a reachable fight');
    await clickSel('.map-node.monster.reachable', 'a monster node');
    // The resumed map settles its camera and footer after it mounts; ENTER was
    // measured below the fold (top 1139 in 1080) on one run in ~6 when pressed
    // at once. Wait for it to stand on screen rather than scroll to it.
    await until(`(() => { const b = document.querySelector('#map-enter'); if (!b || b.disabled) return false; const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()`, 'ENTER on screen', 10000);
    await clickSel('#map-enter', 'ENTER the selected node');
    let mounted = true;
    try {
      await until(`!!document.querySelector('.tut-veil')`, 'the tutorial mounting itself', 10000);
    } catch { mounted = false; }
    ok(mounted, 'first-run: the game showed the tutorial on its own (real showTutorial path, real storage)');
    if (mounted) {
      const p = await evalIn(PROBE);
      ok(p.next.inside && p.next.hit && p.skip.inside && p.skip.hit, `first-run: both buttons reachable at ui-zoom ${p.zoom} on the shipped defaults`);
      ok(await advanceToPlayCards(), 'first-run: reached tutorial step 3 (Play cards)');
      const armed = await armAttackTarget();
      ok(armed.armed, `first-run: armed a real attack target (${armed.card || 'none'})`);
      await pressKey('Escape', 'Escape', 27);
      const afterCancel = await evalIn(`({
        veil: !!document.querySelector('.tut-veil'),
        selected: !!document.querySelector('.hand .card.selected'),
        targetable: !!document.querySelector('.enemy-row .enemy.targetable'),
        meta: localStorage.getItem('sote_meta_v1'),
      })`);
      ok(
        afterCancel.veil && !afterCancel.selected && !afterCancel.targetable,
        `first-run: armed Escape cancels targeting and leaves the tutorial standing — ${JSON.stringify(afterCancel)}`
      );
      ok(
        !afterCancel.meta || JSON.parse(afterCancel.meta).settings.seenTutorial !== true,
        'first-run: armed Escape leaves durable seenTutorial false'
      );

      const selfReceipt = await gameplayReceipt();
      const armedSelf = await armSelfCounter();
      ok(armedSelf.armed && !armedSelf.enemyTarget, `first-run: armed a real self Counter — ${JSON.stringify(armedSelf)}`);
      await pressKey('Escape', 'Escape', 27);
      const afterSelfCancel = await evalIn(`({ veil: !!document.querySelector('.tut-veil'),
        selected: !!document.querySelector('.hand .card.selected'), playerArmed: !!document.querySelector('.combatant.player.armed'),
        meta: localStorage.getItem('sote_meta_v1') })`);
      ok(afterSelfCancel.veil && !afterSelfCancel.selected && !afterSelfCancel.playerArmed
        && await gameplayReceipt() === selfReceipt,
        `first-run: self-Counter Escape cancels without spending and leaves the tutorial standing — ${JSON.stringify(afterSelfCancel)}`);
      ok(!afterSelfCancel.meta || JSON.parse(afterSelfCancel.meta).settings.seenTutorial !== true,
        'first-run: self-Counter Escape leaves durable seenTutorial false');

      // Exercise the targeted-flask sibling through the first-run path too.
      // This block runs against both source and --root, so a regenerated
      // standalone cannot silently retain the old selected-card conjunct while
      // the source-only viewport matrix stays green.
      const armedFlask = await armTargetedFlask();
      ok(
        armedFlask.armed && !armedFlask.selectedCard,
        `first-run: armed Blight Coating with a targetable enemy and no selected card — ${JSON.stringify(armedFlask)}`
      );
      await pressKey('Escape', 'Escape', 27);
      const afterFlaskCancel = await evalIn(`({
        veil: !!document.querySelector('.tut-veil'),
        selected: !!document.querySelector('.hand .card.selected'),
        targetable: !!document.querySelector('.enemy-row .enemy.targetable'),
        meta: localStorage.getItem('sote_meta_v1'),
      })`);
      ok(
        afterFlaskCancel.veil && !afterFlaskCancel.selected && !afterFlaskCancel.targetable,
        `first-run: targeted-flask Escape cancels targeting and leaves the tutorial standing — ${JSON.stringify(afterFlaskCancel)}`
      );
      ok(
        !afterFlaskCancel.meta || JSON.parse(afterFlaskCancel.meta).settings.seenTutorial !== true,
        'first-run: targeted-flask Escape leaves durable seenTutorial false'
      );

      if (screenshotPath) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }, S);
        await wait(220);
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, S);
        writeFileSync(resolve(screenshotPath), Buffer.from(shot.data, 'base64'));
        console.log(`    screenshot ${resolve(screenshotPath)}`);
      }

      // Adjacent ownership remains ordered: the menu veil owns its Escape, the
      // tutorial remains, and only the following unarmed Escape may finish it.
      await clickSel('#combat-menu', 'combat menu');
      await until(`!!document.querySelector('.modal-veil')`, 'the adjacent menu overlay');
      await pressKey('Escape', 'Escape', 27);
      const afterMenu = await evalIn(`({
        menu: !!document.querySelector('.modal-veil'),
        tutorial: !!document.querySelector('.tut-veil'),
        meta: localStorage.getItem('sote_meta_v1'),
      })`);
      ok(!afterMenu.menu && afterMenu.tutorial, 'first-run: menu Escape closes only the adjacent overlay and leaves the tutorial standing');
      ok(
        !afterMenu.meta || JSON.parse(afterMenu.meta).settings.seenTutorial !== true,
        'first-run: menu Escape leaves durable seenTutorial false'
      );

      await pressKey('Escape', 'Escape', 27);
      const finished = await evalIn(`({
        veil: !!document.querySelector('.tut-veil'),
        meta: localStorage.getItem('sote_meta_v1'),
      })`);
      ok(!finished.veil, 'first-run: a later unarmed Escape removes the tutorial');
      ok(
        !!finished.meta && JSON.parse(finished.meta).settings.seenTutorial === true,
        'first-run: the later unarmed Escape writes seenTutorial to durable storage'
      );
      // The claim Sunna's repro actually turns on: "Reload does not clear it."
      await cdp.send('Page.navigate', { url: base }, S);
      await passStartupGate();
      await until(`!!document.querySelector('.slot-continue:not([disabled])')`, 'the title screen with a saved run');
      await clickSel('.slot-continue', 'CONTINUE');
      await until(`!!document.querySelector('.combat')`, 'the fight, resumed');
      await wait(1500); // give a re-mount every chance to appear
      ok(
        !(await evalIn(`!!document.querySelector('.tut-veil')`)),
        'first-run: RELOADED and continued — the tutorial did not come back'
      );
      // The veil staying away is the symptom; the flag is the cause. Read the
      // durable row itself after the reload, so a re-mount suppressed by some
      // other path (a stale in-memory flag, a shot hook) cannot pass for it.
      const reloadedMeta = await evalIn(`localStorage.getItem('sote_meta_v1')`);
      let reloadedSeen = null;
      try { reloadedSeen = JSON.parse(reloadedMeta).settings.seenTutorial; } catch { /* absent or unparsable reads as not persisted */ }
      ok(reloadedSeen === true, `first-run: seenTutorial is still true in durable storage after the reload (read ${JSON.stringify(reloadedSeen)})`);
    }
  }

  cdp.close();
  await dropBrowser();
  server.close();

  // A run that checked nothing is not a pass (e.g. `--root --only 1920x1080`:
  // the viewport and resize cases do not run against the root artifact).
  if (!fails.length && passedCount === 0) {
    console.error('tutorial-reach: 0 checks ran for this selection — an empty run is not a pass.');
    process.exit(2);
  }
  console.log(`\n  ${fails.length ? `${fails.length} FAILED` : 'all checks passed'}`);
  // The counted verdict tools/verdict.mjs reads (CI runs this through it).
  console.log(`${passedCount} passed, ${fails.length} failed`);
  console.log(`  boundary: real Chromium headless against the ${rootArtifact ? 'root standalone artifact' : 'source server'} at deviceScaleFactor 1, UI size = Auto, text size M,`);
  console.log('  English strings, one class (reaver/SHOWCASE), solo play. Not checked: text size');
  console.log('  L/XL, the fixed UI-size overrides S..XL, touch or gamepad input, co-op boards,');
  console.log('  or any browser but Chromium. Silence from this tool is not coverage of those.');
  if (fails.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
