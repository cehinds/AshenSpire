// tools/card-drag-targeting.mjs — browser acceptance for #150 + #198 + #311
// + #294c.
//
// #294c ADDS FOUR CELLS AND A COUNTED VERDICT LINE.
//
// The four are every OTHER reading of the sentence #311 fixed — "if a card is
// selected and the enemy is highlighted, I can't drag the card on the enemy to
// use it." #311 proved ONE of them (a slow press, the read OPEN). The rest were
// unexercised, and the fix's own comment ASSERTS one in prose: "while merely
// pending, a real drag crossing the shared 12 px boundary abandons the inspect
// in the same event and proceeds here." A claim with no cell behind it.
//   1 · ALREADY SELECTED, THEN DRAGGED FAST — one move, no dwell, and the move
//       that starts the drag must also AIM it.
//   2 · CARD A SELECTED WHILE CARD B IS DRAGGED — the card that plays is named
//       by instanceId, so "which one" is a fact and not a count.
//   3 · A MEDIUM DRAG — a dwell at 0.65 of the MEASURED dial, exactly one play.
//   4 · A TOUCH DRAG off a selected card — real Input.dispatchTouchEvent, every
//       pointerdown read back with its pointerType.
// Each has a plant; each plant was watched red at 1200x730 before it was
// written down, and every mouse cell stays green under cell 4's.
//
// THE VERDICT LINE NOW ENDS AT ITS COUNTED CLAIM. This tool used to print
// "PASS — card drag targeting … at every measured shape", which readVerdict
// (tools/verdict.mjs) refuses outright: prose after the counted claim is
// unrecognised grammar (D103). It was one of the ~40 that ruling named and left
// to "whoever wraps next". The count is derived by incrementing as each check is
// evaluated, never typed. And the BOUNDARY prints on every exit path — green,
// red, a run that dies in the harness, and `--selftest` — proved by a plant
// (the hand draws no card; exit 2, boundary printed) rather than by reading it.
//
// The same real page and pointer door checks the approved hand paging controls,
// drag start, nearest-only single target switching, all-target multi aim,
// non-targeting silence, one legal commit, zero illegal commits, cleanup on
// both endings, and Text XL pager geometry. `--selftest` plants each accepted
// defect back through this same browser door.
//
// #311 ADDS TWO CELLS TO THE SAME DOOR, because both are facts about what a
// DRAG does and this file is where the next drag change will run them.
//   * A READ YIELDS TO A DRAG. The inspect dial (balance.ui.inspectHold, 400 ms)
//     starts at pointerdown, so any press slower than that to its first 12 px
//     used to open the read and never give the press back. Measured red at
//     four shapes before the fix, 4/4. The cell waits on `data-inspect="open"`
//     rather than timing a camera against the dial — the attribute is what
//     holdconfirm.js publishes for exactly this.
//   * A SELF-ONLY CARD NAMES ITS ONE TARGET. Constantine: "dragging a block
//     should default highlight player character since it can only target that
//     character." `friendlyTargetMode` (model/friendlyTargets.js) is the one
//     home of that predicate; the colour is #209's TARGET_COLORS.self and is
//     read from the DOM here rather than re-typed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// A Windows checkout may materialize source files as CRLF while this tool's JS
// string literals use LF. Derive each multiline plant's separator from the file
// it will edit, so the same known-bad corpus remains armed in both checkout
// forms instead of reporting PLANT SITE DRIFTED before the browser ever runs.
const lines = (file, ...rows) => {
  const bytes = readFileSync(join(ROOT, file), 'utf8');
  // Some long-lived Windows worktrees are mixed-EOL after generated-file
  // normalization. Match the actual block first; only use the file-wide style
  // as the fallback for replacement text that does not yet exist.
  for (const eol of ['\r\n', '\n']) {
    const candidate = rows.join(eol);
    if (bytes.includes(candidate)) return candidate;
  }
  return rows.join(bytes.includes('\r\n') ? '\r\n' : '\n');
};

// THE COUNTERS ARE MODULE-SCOPE BECAUSE THE BOUNDARY OUTLIVES `main`. A run
// that dies in the harness still has to say how much of the door it reached,
// and a count that lives inside the try block cannot be printed from the catch.
let fails = 0;
let checks = 0;
let ran = 0;
let boundaryPrinted = false;

// EVERY EXIT PATH PRINTS THIS. Not the green one, not "at the end of main()" —
// Vira's line printed at the end of `main()` too, and `main()` also had a
// `.catch` and a `process.exit(2)` above it. Proved with a plant, not by reading
// the file (`--selftest`, "the run dies in the harness before any check"): the
// boundary prints and the exit is 2.
//
// AND IT SITS ABOVE THE `--selftest` BRANCH BECAUSE THE FIRST CUT OF THIS DID
// NOT, AND THAT WAS THE SAME DEFECT ONE LEVEL UP. It sat below, with a comment
// claiming the function declaration hoists so the branch could call it. THE
// FUNCTION HOISTS; `let boundaryPrinted` DOES NOT — it is in its temporal dead
// zone until the module reaches it, which a `process.exit` at the top never
// does. Measured: `--selftest` printed SELFTEST GREEN and then died with
// `ReferenceError: Cannot access 'boundaryPrinted' before initialization`, exit
// 1 on a run in which all 15 plants were caught.
//
// NO PLANT COULD HAVE CAUGHT IT, and that is the part worth keeping: every
// plant runs the tool WITHOUT `--selftest`, because the harness IS the
// selftest. So this one exit path is the one no corpus reaches, and the claim
// about it was carried by a comment — which is exactly the shape this whole
// file's night was about. It is checkable only by running the flag, which is
// now the standing instruction here: change this block, run `--selftest`, and
// read the LAST line, not the verdict.
function printBoundary() {
  if (boundaryPrinted) return;
  boundaryPrinted = true;
  console.log('  BOUNDARY: Linux headless Chromium, one container, four emulated shapes and ONE text');
  console.log('        size per run. Synthesized CDP input, never a finger and never a real mouse:');
  console.log('        Input.dispatchMouseEvent for cells 1-3, Emulation.setTouchEmulationEnabled +');
  console.log('        Input.dispatchTouchEvent for cell 4, every press aimed at the coordinates');
  console.log('        elementFromPoint reports and every pointerdown in cell 4 read back with its');
  console.log('        pointerType, so a press that misses is a named failure and never a quiet pass.');
  console.log('        THE DIAL IS MEASURED, NOT TYPED: cell 3 solves balance.ui.inspectHold out of two');
  console.log('        data-inspect-progress samples and dwells at 0.65 of it. WHAT THAT DOES NOT BUY:');
  console.log('        the pair either side of that dial (cell 3 pending, the #311 read-yield cell open)');
  console.log('        is NOT an adjacent pair — a CDP round trip is tens of ms, so no cell here sits one');
  console.log('        millisecond off the threshold and this door cannot place one. The dial itself is');
  console.log('        therefore watched, not bounded. AND ONE CELL HERE IS WATCHED, NOT PROVEN:');
  console.log('        "no read opens ON TOP of the live medium drag" has no plant of its own. The');
  console.log('        plant written for it — the read abandoned only once open — reds the TOUCH');
  console.log('        cell and leaves the mouse cell at the same dwell GREEN, measured both ways at');
  console.log('        1200x730. Under the instrument rule that assertion is `unknown` and may not be');
  console.log('        cited as coverage, whatever it prints. NOT COVERED: a plain unselected touch drag');
  console.log('        (tools/gesture-cancel.mjs check 5 owns that gesture — one home, not two); the');
  console.log('        narrow pan-x axis split (same tool, check 6); any text size but the one passed;');
  console.log('        a real thumb\'s size, angle or accuracy; body zoom or a CSS transform, since this');
  console.log('        aims in raw rect px; and CI, which runs NEITHER this tool nor its composer');
  console.log('        (tools/hybrid-input-parity.mjs) — every number above comes from a hand-dispatched');
  console.log('        run, so a green here is a claim about this machine, not about the pipeline.');
  console.log('  ONE HAZARD THIS WRAP CREATES, named where the text that causes it is printed: the');
  console.log('        composer above REPRINTS this whole stream, verdict line included. Its own');
  console.log('        summary matches no readVerdict row, so wrapping the COMPOSER today would find');
  console.log('        exactly one recognised line — THIS one — and hand it this count. Not a defect');
  console.log('        today; the fix belongs to whoever wraps that tool, in the same act.');
}

function finish(code, why = null) {
  if (why) console.error(`card-drag-targeting: ${why}`);
  console.log('');
  if (code === 0) console.log(`card-drag-targeting: OK — ${checks} checks passed`);
  else console.log(`  ${fails} finding(s) in ${checks} check(s) reached${why ? ' before the run died' : ''}`);
  printBoundary();
  process.exit(code);
}

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  // EVERY exit path, this one included: `printBoundary` is a hoisted function
  // declaration precisely so this branch — which returns above main() — can
  // state the same extent the runs it just performed were bounded by.
  const selftestCode = await doorSelftest({
    tool: 'card-drag-targeting.mjs',
    args: ['--text', 'XL'],
    timeoutMs: 600000,
    plants: [{
      name: 'illegal-drop cleanup is removed, leaving the targeting state armed',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', '          clearDragTargeting();', '          if (dragGhost)'),
      replace: lines('src/ui/screens/combat.js', '          /* planted: #198 cleanup omitted */', '          if (dragGhost)'),
      expectRed: /FAIL illegal drop clears every drag marker/,
    }, {
      name: 'single-target drag lights every enemy instead of only the nearest',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', '        const nearest = inField ? nearestEnemy(x, y) : null;', '        showDragAims(nearest ? [nearest] : []);', '        legal = !!nearest;'),
      replace: lines('src/ui/screens/combat.js', '        const nearest = inField ? nearestEnemy(x, y) : null;', '        showDragAims(inField ? livingEnemyEls() : []);', '        legal = !!nearest;'),
      expectRed: /FAIL single-target sweep keeps exactly one nearest red aim and switches across enemies/,
    }, {
      name: 'multi-target drag lights only one enemy instead of every legal enemy',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', '        showDragAims(enemies);', '        legal = enemies.length > 0;'),
      replace: lines('src/ui/screens/combat.js', '        showDragAims(enemies.slice(0, 1));', '        legal = enemies.length > 0;'),
      expectRed: /FAIL multi-target drag reuses red aim on every living enemy/,
    }, {
      name: 'non-targeting drag incorrectly paints enemy aim silhouettes',
      file: 'src/ui/screens/combat.js',
      // Context trimmed to the block itself when #311 put `if (selfOnlyTarget)
      // showSelfAim(legal);` between it and the `const state` line — the plant
      // read DRIFTED, which is doorplant working. The plant's substance is
      // unchanged; only the adjacency it quoted moved.
      find: lines('src/ui/screens/combat.js', '      } else {', '        showDragAims([]);', '      }'),
      replace: lines('src/ui/screens/combat.js', '      } else {', '        showDragAims(inField ? livingEnemyEls() : []);', '      }'),
      expectRed: /FAIL non-targeting drag produces no enemy aim/,
    }, {
      name: 'an open read keeps the press, so a slow drag can never start',
      file: 'src/ui/components/holdconfirm.js',
      find: '        if (Math.hypot(mv.clientX - x0, mv.clientY - y0) > SLOP) close();',
      replace: '        if (phase === \'pending\' && Math.hypot(mv.clientX - x0, mv.clientY - y0) > SLOP) close();',
      expectRed: /FAIL an open read yields to a drag/,
    }, {
      name: 'a self-only drag names no default target',
      file: 'src/ui/screens/combat.js',
      find: '      if (selfOnlyTarget) showSelfAim(legal);',
      replace: '      /* planted: a self-only drag names no default target */',
      expectRed: /FAIL a self-only drag lights the player blue/,
    }, {
      // CELL 1. The move that STARTS a drag no longer also AIMS it. Every other
      // cell in this file survives it — they all send a second move — and a
      // single-jump drag still PLAYS, so no count of plays can see this. What
      // dies is the only move a fast flick has.
      //
      // MEASURED WHILE CHOOSING THIS PLANT, and it is the finding: widening the
      // `data-inspect === 'open'` guard to cover `pending` changes NOTHING. The
      // hand arms the read BEFORE it wires the drag (hand.js), same-element
      // listeners run in registration order, so holdconfirm's own onMove has
      // already closed the read to `idle` before combat's guard ever reads it.
      // The pending path is protected by REGISTRATION ORDER, not by that guard.
      name: 'the move that starts a drag does not also aim it, so a single-jump drag arms nothing',
      file: 'src/ui/screens/combat.js',
      find: '        if (dragging && dragGhost) {',
      replace: '        else if (dragging && dragGhost) {',
      expectRed: /FAIL cell 1 a fast drag off a selected card starts AND aims/,
    }, {
      // CELL 2. The commit reads the SELECTION instead of the card under the
      // finger — the exact confusion two live cards invite, and invisible to
      // every check that counts plays instead of naming which card left.
      name: 'a drag commits the SELECTED card instead of the dragged one',
      file: 'src/ui/screens/combat.js',
      find: '            if (enemyBox) playCard(inst.instanceId, enemyBox.dataset.eid);',
      replace: '            if (enemyBox) playCard(selected || inst.instanceId, enemyBox.dataset.eid);',
      expectRed: /FAIL cell 2 the card that PLAYS is the one under the finger/,
    }, {
      // CELL 3, AND IT IS AIMED AT THE DERIVATION, NOT THE GESTURE. The dial
      // stops publishing its progress, so the dwell cell 3 calls "inside the
      // dial" can no longer be solved for. What must NOT happen is the cell
      // quietly falling back to a number somebody remembered: it reds, twice,
      // and says `null ms`. The medium drag still plays once under this plant —
      // which is the point. An unmeasurable dwell is an unknown cell, not a
      // green one.
      name: 'the inspect dial stops publishing its progress, so the medium dwell can no longer be derived',
      file: 'src/ui/components/holdconfirm.js',
      find: '        el.dataset.inspectProgress = p.toFixed(3);',
      replace: '        /* planted: the dial stops publishing its progress */',
      expectRed: /FAIL cell 3 the medium dwell sits INSIDE the measured dial/,
    }, {
      // CELL 4. The drag becomes a mouse feature — holdconfirm's rule 3 ("BE A
      // MOUSE FEATURE"), in the one place it was never asserted. EVERY mouse
      // cell in this file stays green under it, which is the whole argument for
      // cell 4 existing: no amount of dispatchMouseEvent can see this.
      name: 'the card drag refuses every pointer that is not a mouse',
      file: 'src/ui/screens/combat.js',
      find: "      if (busy || !affordable || ev.button !== 0) return;",
      replace: "      if (busy || !affordable || ev.button !== 0 || ev.pointerType !== 'mouse') return;",
      expectRed: /FAIL cell 4 the finger plays the selected card exactly once/,
    }, {
      // A READ OPENING ON TOP OF A LIVE DRAG — the inverse of the #311 plant
      // above: the read is abandoned only once it is ALREADY open, so a press
      // that became a drag while merely pending keeps its dial running and a
      // card-sized copy lands over the board mid-aim.
      //
      // NAMED FOR WHAT IT ACTUALLY REDS, WHICH IS NOT WHAT I EXPECTED. It reds
      // the TOUCH cell and leaves the mouse cell at the same dwell GREEN —
      // measured, both directions, at 1200x730. Something abandons the mouse
      // read that does not abandon the touch one, and I did not find it. So
      // cell 3's mid-drag assertion has no plant of its own and is WATCHED,
      // NOT PROVEN; the boundary says so rather than letting this plant's red
      // be read as coverage for it.
      name: 'the read is abandoned only when open, so it opens on top of a live TOUCH drag',
      file: 'src/ui/components/holdconfirm.js',
      find: '        if (Math.hypot(mv.clientX - x0, mv.clientY - y0) > SLOP) close();',
      replace: "        if (phase === 'open' && Math.hypot(mv.clientX - x0, mv.clientY - y0) > SLOP) close();",
      expectRed: /FAIL cell 4 the touch drag arms the drop off a selected card/,
    }, {
      // THE BOUNDARY ITSELF, and it is planted rather than read. The hand draws
      // no card, so the FIRST `until` is unreachable and the run dies inside the
      // harness — not at a check. What must survive that is the boundary block
      // and a non-zero exit; a boundary that only prints on the happy path is
      // the defect this plant exists to make impossible.
      name: 'the run dies in the harness before any check — the boundary must still print',
      file: 'src/ui/components/hand.js',
      find: '      handEl.appendChild(el);',
      replace: '      /* planted: the hand draws no card, so the run dies in the harness */',
      expectRed: /BOUNDARY: Linux headless Chromium/,
    }, {
      name: 'pager escapes the hand overlay at Text XL',
      file: 'styles/combat.css',
      find: lines('styles/combat.css', ".hand-overlay[data-paging='true'] {", '  grid-template-columns: var(--tap-floor) minmax(0, 1fr) var(--tap-floor);', '  grid-template-areas: "prev hand next";', '}'),
      replace: lines('styles/combat.css', ".hand-overlay[data-paging='true'] {", '  width: calc(100% + 40rem); margin-left: -20rem;', '  grid-template-columns: var(--tap-floor) minmax(0, 1fr) var(--tap-floor);', '  grid-template-areas: "prev hand next";', '}'),
      expectRed: /FAIL hand paging controls stay inside the viewport/,
    }, {
      name: 'pager is dropped onto the combat footer',
      file: 'styles/combat.css',
      find: lines('styles/combat.css', '.hand-page {', '  position: static; align-self: center; z-index: 70;'),
      replace: lines('styles/combat.css', '.hand-page {', '  position: relative; top: 20rem; align-self: center; z-index: 70;'),
      expectRed: /FAIL paging controls overlap neither cards nor combat controls/,
    }, {
      name: 'narrow combat chrome is pushed below the viewport',
      file: 'styles/combat.css',
      find: ":root[data-short='false'] .field { min-height: 0; }",
      replace: ":root[data-short='false'] .field { /* planted: fitting field cannot yield */ }",
      expectRed: /FAIL combat chrome stays inside the viewport/,
    }],
  });
  printBoundary();
  process.exit(selftestCode);
}

const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const SHAPES = [[320, 640], [390, 844], [768, 1024], [1200, 730]];
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const only = argOf('--only');
const screenshots = args.includes('--screenshots');
const useDist = args.includes('--dist');
const textSize = argOf('--text') || 'M';
if (!['S', 'M', 'L', 'XL'].includes(textSize)) throw new Error(`--text must be S, M, L, or XL (got ${textSize})`);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
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

async function main() {
  if (!browserPath) throw new Error('no Chrome/Edge found; pass --browser or set CHROME');
  const served = useDist ? null : await serve({ root: ROOT, port: 8298, open: false });
  const base = useDist ? pathToFileURL(resolve(ROOT, 'dist', 'AshenSpire.html')).href : `http://localhost:${served.port}/`;
  const browser = await launchBrowser({ prefix: 'carddrag-', browser: browserPath, timeoutMs: 15000 });
  const cdp = connectCdp(browser.wsUrl); await cdp.ready;
  // THE COUNT IS DERIVED BY INCREMENTING AS EACH CHECK IS EVALUATED, never
  // typed and never recounted from a list — a hand-typed N is a second copy of
  // the truth and it is the one that rots.
  const ok = (value, label, detail = '') => {
    checks++;
    console.log(`    ${value ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!value) fails++;
  };

  try {
    for (const [W, H] of SHAPES) {
      const shape = `${W}x${H}`;
      if (only && only !== shape) continue;
      ran++;
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }, S);
      const ev = async (expression) => {
        const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page evaluation threw');
        return r.result.value;
      };
      const until = async (expression, label, ms = 20000) => {
        const started = Date.now();
        while (Date.now() - started < ms) {
          if (await ev(expression).catch(() => false)) return;
          await wait(120);
        }
        throw new Error(`timeout waiting for ${label}`);
      };
      const mouse = (type, x, y, down = false) => cdp.send('Input.dispatchMouseEvent', {
        type, x, y, button: 'left', buttons: down ? 1 : 0, clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0,
      }, S);
      const point = (selector) => ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const state = () => ev(`(() => ({
        discard:+document.querySelector('.pile.discard .n').textContent,
        energy:document.querySelector('.energy-orb').textContent.trim(),
        mode:document.querySelector('.combat').classList.contains('drag-targeting'),
        drop:document.querySelector('.combat').dataset.dropState || null,
        dropAttrs:document.querySelectorAll('[data-drop-state]').length,
        aimed:[...document.querySelectorAll('.enemy.aiming.aim-enemy')].map(x=>x.dataset.eid),
        silhouettes:document.querySelectorAll('.enemy.aiming.aim-enemy .aim-silho').length,
        labeledEnemies:document.querySelectorAll('.enemy[data-drop-state],.enemy .drop-verdict').length,
        ghosts:document.querySelectorAll('.card-drag-ghost').length,
        inspectCopies:document.querySelectorAll('.card-inspect').length,
        selfSilho:(()=>{const s=document.querySelector('.combatant.player.aiming.aim-self .aim-silho');
          return s?{color:s.style.getPropertyValue('--target-color'),rel:s.dataset.targetRelationship}:null;})(),
        allSilhouettes:document.querySelectorAll('.aim-silho').length
      }))()`);

      const shotSettings = encodeURIComponent(JSON.stringify({ textSize }));
      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotHand=8&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat'); await wait(350);
      console.log(`\n  ${shape} · Text ${textSize}`);
      const controls = await ev(`(() => { const hs=[...document.querySelectorAll('.hand-page')]; return {n:hs.length, labels:hs.map(x=>x.getAttribute('aria-label')), rects:hs.map(x=>{const r=x.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}), on:hs.every(x=>{const r=x.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})}; })()`);
      ok(controls.n === 2 && controls.labels.every(Boolean), 'approved previous/next controls exist and are named', JSON.stringify(controls));
      ok(controls.on, 'hand paging controls stay inside the viewport');
      const containment = await ev(`(() => {
        const box=x=>{const r=x.getBoundingClientRect();return {name:x.className,left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
        const named=[...document.querySelectorAll('.hand-page,.energy-orb,.end-turn,.pile')]
          .filter(x=>getComputedStyle(x).display!=='none').map(box);
        const handArea=box(document.querySelector('.hand-area'));
        const hand=box(document.querySelector('.hand'));
        const cards=[...document.querySelectorAll('.hand .card')].map(box);
        const inside=r=>r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;
        const verticallyInside=r=>r.top>=0&&r.bottom<=innerHeight;
        const failures=[...named.filter(r=>!inside(r)),
          ...[handArea,hand].filter(r=>!inside(r)), ...cards.filter(r=>!verticallyInside(r))];
        return {ok:failures.length===0, viewport:{width:innerWidth,height:innerHeight}, failures, named, handArea, hand,
          cards:cards.map(({name,top,bottom})=>({name,top,bottom}))};
      })()`);
      ok(containment.ok, 'combat chrome stays inside the viewport', JSON.stringify(containment));
      const overlap = await ev(`(() => {
        const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        const box=x=>{const r=x.getBoundingClientRect();return {name:x.className,left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
        const pages=[...document.querySelectorAll('.hand-page')].map(box);
        const fixed=[...document.querySelectorAll('.end-turn,.energy-orb,.pile')].filter(x=>getComputedStyle(x).display!=='none').map(box);
        const handArea=document.querySelector('.hand-area').getBoundingClientRect();
        const hand=document.querySelector('.hand').getBoundingClientRect();
        const cards=[...document.querySelectorAll('.hand .card')].map(box).map(r=>({...r,
          left:Math.max(r.left,hand.left),right:Math.min(r.right,hand.right),
          top:Math.max(r.top,hand.top),bottom:Math.min(r.bottom,hand.bottom)}))
          .filter(r=>r.right>Math.max(0,r.left)&&r.bottom>r.top&&r.left<innerWidth);
        const pairs=(bs)=>pages.flatMap(a=>bs.filter(b=>hit(a,b)).map(b=>[a,b]));
        const chromePairs=pairs(fixed), cardPairs=pairs(cards);
        return {
          chrome:chromePairs.length>0, cards:cardPairs.length>0,
          chromePairs, cardPairs,
          handArea:{left:handArea.left,top:handArea.top,right:handArea.right,bottom:handArea.bottom},
          hand:{left:hand.left,top:hand.top,right:hand.right,bottom:hand.bottom},
          fixed
        };
      })()`);
      ok(!overlap.chrome && !overlap.cards, 'paging controls overlap neither cards nor combat controls', JSON.stringify(overlap));
      if (controls.n === 2) {
        await ev(`document.querySelector('.hand-next').click()`); await wait(100);
        ok(await ev(`!!document.querySelector('.hand .card.gp-focus')`), 'paging moves focus through the real hand');
      }

      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'five-card combat for drag coverage'); await wait(350);

      const card = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Slashing Strike/.test(x.textContent)); if(!c)return null; c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const enemies = await ev(`[...document.querySelectorAll('.enemy:not(.dead)')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.eid,x:r.left+r.width/2,y:r.top+r.height/2}})`);
      if (!card || enemies.length < 2) throw new Error(`${shape}: nearest-target proof needs one targetable card and at least two enemies`);
      const before = await state();
      await mouse('mousePressed', card.x, card.y, true);
      await mouse('mouseMoved', card.x, card.y - 30, true);
      const sweep = [];
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const at = {
          x: enemies[0].x + (enemies.at(-1).x - enemies[0].x) * t,
          y: enemies[0].y + (enemies.at(-1).y - enemies[0].y) * t,
        };
        await mouse('mouseMoved', at.x, at.y, true); await wait(70);
        const observed = await state();
        const expected = enemies.reduce((best, enemy) => {
          const distance = Math.hypot(at.x - enemy.x, at.y - enemy.y);
          return !best || distance < best.distance ? { id: enemy.id, distance } : best;
        }, null).id;
        sweep.push({ t, expected, aimed: observed.aimed, silhouettes: observed.silhouettes });
      }
      const exactNearest = sweep.every((row) => row.aimed.length === 1
        && row.aimed[0] === row.expected && row.silhouettes === 1);
      ok(exactNearest && new Set(sweep.map((row) => row.aimed[0])).size >= 2,
        'single-target sweep keeps exactly one nearest red aim and switches across enemies', JSON.stringify(sweep));
      const armed = await state();
      ok(armed.mode && armed.drop === 'legal' && armed.aimed.length === 1
        && armed.silhouettes === 1 && armed.labeledEnemies === 0 && armed.ghosts === 1,
      'single-target drag reuses the click-selected red silhouette without enemy drop labels', JSON.stringify(armed));
      if (screenshots) {
        const dir = join(ROOT, 'docs', 'preview'); mkdirSync(dir, { recursive: true });
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, S);
        const textSuffix = textSize === 'M' ? '' : `-text-${textSize.toLowerCase()}`;
        writeFileSync(join(dir, `combat-ui-drag-${shape}${textSuffix}.png`), Buffer.from(shot.data, 'base64'));
      }
      await mouse('mouseReleased', enemies.at(-1).x, enemies.at(-1).y, false); await wait(700);
      const legalEnd = await state();
      ok(legalEnd.discard === before.discard + 1, 'legal drop plays exactly once', `${before.discard} -> ${legalEnd.discard}`);
      ok(!legalEnd.mode && legalEnd.dropAttrs === 0 && legalEnd.aimed.length === 0
        && legalEnd.silhouettes === 0 && legalEnd.ghosts === 0,
      'legal drop clears every drag marker', JSON.stringify(legalEnd));

      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat reset'); await wait(350);
      const card2 = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Shield Defend/.test(x.textContent)); c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const enemy2 = await point('.enemy:not(.dead)');
      // The invalid edge is defined against the drop surface itself, not another
      // component's centre. The final viewport pixel is always in the reserved
      // hand/footer band and therefore outside `.field`, at every measured
      // composition; that remains true even when the battlefield yields height.
      const bad = await ev(`({x:Math.max(1,innerWidth/2),y:Math.max(1,innerHeight-2)})`);
      const beforeBad = await state();
      await mouse('mousePressed', card2.x, card2.y, true);
      await mouse('mouseMoved', card2.x, card2.y - 30, true);
      await mouse('mouseMoved', enemy2.x, enemy2.y, true); await wait(120);
      const noTargetAim = await state();
      ok(noTargetAim.aimed.length === 0 && noTargetAim.silhouettes === 0 && noTargetAim.labeledEnemies === 0,
        'non-targeting drag produces no enemy aim', JSON.stringify(noTargetAim));
      await mouse('mouseMoved', bad.x, bad.y, true); await wait(120);
      const rejected = await state();
      ok(rejected.mode && rejected.drop === 'illegal' && rejected.aimed.length === 0
        && rejected.silhouettes === 0 && rejected.ghosts === 1,
      'invalid point has no persisted enemy aim', JSON.stringify(rejected));
      await mouse('mouseReleased', bad.x, bad.y, false); await wait(350);
      const illegalEnd = await state();
      ok(illegalEnd.discard === beforeBad.discard && illegalEnd.energy === beforeBad.energy, 'illegal drop spends and plays nothing');
      ok(!illegalEnd.mode && illegalEnd.dropAttrs === 0 && illegalEnd.aimed.length === 0
        && illegalEnd.silhouettes === 0 && illegalEnd.ghosts === 0,
      'illegal drop clears every drag marker', JSON.stringify(illegalEnd));

      // ---- #311 · A READ YIELDS TO A DRAG -----------------------------------
      // His words: "if a card is selected and the enemy is highlighted, I can't
      // drag the card on the enemy to use it." The select is real (a trusted
      // click), the wait is on the PUBLISHED state rather than on the dial, and
      // the drag is deliberately unhurried — 12 steps of 25 ms — because a hurried
      // one was never the failing gesture.
      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat read-yield reset'); await wait(350);
      await mouse('mouseMoved', 2, 2, false); await wait(80); // park the cursor: no hover state of its own
      const yieldCard = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Slashing Strike/.test(x.textContent)); if(!c)return null; c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const yieldFoe = (await ev(`[...document.querySelectorAll('.enemy:not(.dead)')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.eid,x:r.left+r.width/2,y:r.top+r.height/2}})`))[0];
      if (!yieldCard || !yieldFoe) throw new Error(`${shape}: read-yield proof needs one targetable card and one living enemy`);
      await mouse('mousePressed', yieldCard.x, yieldCard.y, true);
      await mouse('mouseReleased', yieldCard.x, yieldCard.y, false); await wait(300);
      const selBox = await ev(`(() => { const c=document.querySelector('.hand .card.selected'); if(!c)return null; const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      ok(!!selBox, 'the click-to-target select is real before the drag begins', JSON.stringify(selBox));
      const beforeYield = await state();
      await mouse('mousePressed', selBox.x, selBox.y, true);
      await until(`document.querySelector('.hand .card.selected').dataset.inspect === 'open'`, 'the inspect copy to open under the press', 4000);
      for (let i = 1; i <= 12; i++) {
        await mouse('mouseMoved', selBox.x + (yieldFoe.x - selBox.x) * i / 12, selBox.y + (yieldFoe.y - selBox.y) * i / 12, true);
        await wait(25);
      }
      await wait(140);
      const yieldArmed = await state();
      ok(yieldArmed.mode && yieldArmed.ghosts === 1 && yieldArmed.inspectCopies === 0,
        'an open read yields to a drag', JSON.stringify(yieldArmed));
      await mouse('mouseReleased', yieldFoe.x, yieldFoe.y, false); await wait(700);
      const yieldEnd = await state();
      ok(yieldEnd.discard === beforeYield.discard + 1, 'the yielded drag plays exactly once', `${beforeYield.discard} -> ${yieldEnd.discard}`);

      // ---- #311 · THE EDGE THE OLD GUARD PROTECTED --------------------------
      // A 13 px reading DRIFT must still commit nothing. It cannot: a drift ends
      // in the hand, `.hand-area` and `.field` are siblings, and the drop needs
      // `closest('.field')`. Watched here so the next hand that widens the drop
      // surface finds out from this file rather than from a player.
      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat drift reset'); await wait(350);
      await mouse('mouseMoved', 2, 2, false); await wait(80);
      const driftCard = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Shield Defend/.test(x.textContent)); c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const beforeDrift = await state();
      await mouse('mousePressed', driftCard.x, driftCard.y, true);
      await until(`[...document.querySelectorAll('.hand .card')].find(x=>/Shield Defend/.test(x.textContent)).dataset.inspect === 'open'`, 'the inspect copy to open before the drift', 4000);
      for (const d of [6, 12, 16, 18]) { await mouse('mouseMoved', driftCard.x + d, driftCard.y - d, true); await wait(60); }
      await mouse('mouseReleased', driftCard.x + 18, driftCard.y - 18, false); await wait(700);
      const driftEnd = await state();
      ok(driftEnd.discard === beforeDrift.discard && driftEnd.energy === beforeDrift.energy,
        'an 18 px reading drift over the hand commits nothing', `${beforeDrift.discard} -> ${driftEnd.discard}, ${beforeDrift.energy} -> ${driftEnd.energy}`);

      // ---- #311 · A SELF-ONLY CARD NAMES ITS ONE TARGET ---------------------
      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat self-aim reset'); await wait(350);
      await mouse('mouseMoved', 2, 2, false); await wait(80);
      const selfCard = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Shield Defend/.test(x.textContent)); c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const fieldPoint = await ev(`(() => { const r=document.querySelector('.field').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height*0.6}; })()`);
      const beforeSelf = await state();
      await mouse('mousePressed', selfCard.x, selfCard.y, true);
      await mouse('mouseMoved', selfCard.x, selfCard.y - 30, true); await wait(60);
      await mouse('mouseMoved', fieldPoint.x, fieldPoint.y, true); await wait(160);
      const selfArmed = await state();
      // The colour is READ, never re-typed: TARGET_COLORS.self has one home
      // (components/friendlyTargets.js) and #209's door already guards its value.
      ok(selfArmed.selfSilho && selfArmed.selfSilho.rel === 'self' && selfArmed.selfSilho.color === '#4d94e0'
        && selfArmed.aimed.length === 0 && selfArmed.allSilhouettes === 1 && selfArmed.drop === 'legal',
      'a self-only drag lights the player blue and lights no enemy', JSON.stringify(selfArmed));
      if (screenshots) {
        const dir = join(ROOT, 'docs', 'preview'); mkdirSync(dir, { recursive: true });
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, S);
        const textSuffix = textSize === 'M' ? '' : `-text-${textSize.toLowerCase()}`;
        writeFileSync(join(dir, `combat-ui-drag-self-${shape}${textSuffix}.png`), Buffer.from(shot.data, 'base64'));
      }
      await mouse('mouseReleased', fieldPoint.x, fieldPoint.y, false); await wait(700);
      const selfEnd = await state();
      ok(!selfEnd.selfSilho && selfEnd.allSilhouettes === 0 && selfEnd.discard === beforeSelf.discard + 1,
        'the blue default aim clears on drop and the card plays once', JSON.stringify(selfEnd));

      await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat multi-target reset'); await wait(350);
      const multiPose = await ev(`(() => {
        const donor=window.__combat.piles.hand[0];
        const trigger=[...document.querySelectorAll('.hand .card')].find(x=>/Slashing Strike/.test(x.textContent));
        if(!donor||!trigger)return {id:null,reason:'missing donor or render trigger'};
        donor.cardId='crimsonCleave'; donor.upgraded=false;
        delete donor.profileId; delete donor.mods;
        delete donor.damageSchool; delete donor.exposureBuildupPerHit;
        trigger.click();
        const deselect=[...document.querySelectorAll('.hand .card')].find(x=>/Slashing Strike/.test(x.textContent));
        if(deselect)deselect.click();
        return {id:donor.instanceId,cardId:donor.cardId,trigger:trigger.textContent.trim()};
      })()`);
      await wait(150);
      const multiNames = await ev(`[...document.querySelectorAll('.hand .card')].map(x=>x.textContent.trim())`);
      if (!multiPose.id || !multiNames.some((name) => /Crimson Cleave/.test(name))) {
        throw new Error(`${shape}: real multi-target pose failed ${JSON.stringify({ multiPose, multiNames })}`);
      }
      const multiCard = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Crimson Cleave/.test(x.textContent)); c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const multiEnemies = await ev(`[...document.querySelectorAll('.enemy:not(.dead)')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.eid,x:r.left+r.width/2,y:r.top+r.height/2}})`);
      if (!multiCard || multiEnemies.length < 2) throw new Error(`${shape}: could not pose the real Crimson Cleave multi-target state`);
      const multiAt = {
        x: (multiEnemies[0].x + multiEnemies.at(-1).x) / 2,
        y: (multiEnemies[0].y + multiEnemies.at(-1).y) / 2,
      };
      const beforeMulti = await state();
      await mouse('mousePressed', multiCard.x, multiCard.y, true);
      await mouse('mouseMoved', multiCard.x, multiCard.y - 30, true);
      await mouse('mouseMoved', multiAt.x, multiAt.y, true); await wait(120);
      const multiArmed = await state();
      const wantMulti = multiEnemies.map((enemy) => enemy.id).sort();
      ok(multiArmed.drop === 'legal' && multiArmed.silhouettes === wantMulti.length
        && JSON.stringify([...multiArmed.aimed].sort()) === JSON.stringify(wantMulti)
        && multiArmed.labeledEnemies === 0,
      'multi-target drag reuses red aim on every living enemy', JSON.stringify(multiArmed));
      if (screenshots) {
        const dir = join(ROOT, 'docs', 'preview'); mkdirSync(dir, { recursive: true });
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, S);
        const textSuffix = textSize === 'M' ? '' : `-text-${textSize.toLowerCase()}`;
        writeFileSync(join(dir, `combat-ui-drag-multi-${shape}${textSuffix}.png`), Buffer.from(shot.data, 'base64'));
      }
      await mouse('mouseReleased', multiAt.x, multiAt.y, false); await wait(700);
      const multiEnd = await state();
      ok(multiEnd.discard === beforeMulti.discard + 1, 'multi-target legal drop plays exactly once', `${beforeMulti.discard} -> ${multiEnd.discard}`);
      ok(!multiEnd.mode && multiEnd.dropAttrs === 0 && multiEnd.aimed.length === 0
        && multiEnd.silhouettes === 0 && multiEnd.ghosts === 0,
      'multi-target drop clears every drag marker', JSON.stringify(multiEnd));

      // ---- #294c · THE FOUR CELLS HIS OWN SENTENCE HAS AND THIS DOOR DID NOT
      //
      // His words are already quoted above: "if a card is selected and the
      // enemy is highlighted, I can't drag the card on the enemy to use it."
      // The #311 cell proves ONE reading of that sentence — a SLOW press, the
      // read OPEN, the drag taking the press back. Every other reading of the
      // same sentence was unexercised, and the fix's own comment ASSERTS one of
      // them in prose: "while merely pending, a real drag crossing the shared
      // 12 px boundary abandons the inspect in the same event and proceeds
      // here." That is a claim with no cell behind it, so it is `unknown`.
      //
      // All four below start from the state he reported — a card ALREADY
      // SELECTED — because that is the half of his sentence the existing cells
      // vary least. They are cells 1-4 of Sunna's probe, re-derived here rather
      // than carried: her run reported all four playing exactly once and this
      // file does not take a reported green as a baseline.
      //
      // WHAT IS DELIBERATELY NOT HERE: a PLAIN (unselected) touch drag onto an
      // enemy. tools/gesture-cancel.mjs check 5 already drives that gesture
      // through synthesized CDP touch and asserts discard+1 — measured green at
      // 1200x730 on this tree. A second copy of it here would be the second
      // home Law 0 clause 4 forbids. Cell 4 is the SELECTED variant, which that
      // tool does not drive and which is the state he actually reported.
      const say = () => ev(`(() => { const p=window.__combat.piles; const m=(x)=>x.map(c=>c.instanceId);
        return {hand:m(p.hand),discard:m(p.discard),exhaust:m(p.exhaust),
          energy:document.querySelector('.energy-orb').textContent.trim(),
          selected:[...document.querySelectorAll('.hand .card.selected')].map(x=>x.dataset.instanceId),
          mode:document.querySelector('.combat').classList.contains('drag-targeting'),
          ghosts:document.querySelectorAll('.card-drag-ghost').length,
          inspectCopies:document.querySelectorAll('.card-inspect').length,
          dropAttrs:document.querySelectorAll('[data-drop-state]').length,
          silhouettes:document.querySelectorAll('.aim-silho').length}; })()`);
      // AIM, THEN PRESS. Every gesture below is aimed at the coordinates
      // `elementFromPoint` reports for the element, and the hit test travels
      // WITH the point — so a press that lands on something else is a named
      // failure here and never a quiet pass. Viki's A6 rule (#315), applied.
      // THE SCROLL AND THE MEASUREMENT ARE TWO ACTS, and that is a repair, not
      // tidiness. On the narrow layout `.hand` is a horizontal scroller, so
      // `scrollIntoView` MOVES the strip — and reading the rect in the same
      // synchronous block reads the box the card had BEFORE the scroll. The
      // stale point then lands on a different card: measured at 320x640 and
      // 390x844, where the tap meant to SELECT Slashing Strike PLAYED a Shield
      // Defend instead (discard 0 -> 1 before the cell had begun). Same artifact
      // gesture-cancel.mjs records in its header. Scroll, settle, then measure —
      // and the hit test travels with the point that was actually measured.
      const handCard = async (name) => {
        await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')]
          .find(x=>new RegExp(${JSON.stringify(name)}).test(x.textContent));
          if(c)c.scrollIntoView({inline:'center',block:'nearest'}); return !!c; })()`);
        await wait(220);
        return ev(`(() => {
          const c=[...document.querySelectorAll('.hand .card')].find(x=>new RegExp(${JSON.stringify(name)}).test(x.textContent));
          if(!c)return null;
          const r=c.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
          const hit=document.elementFromPoint(x,y);
          return {x,y,iid:c.dataset.instanceId||null,cardId:c.dataset.cardId||null,
            onTop:!!(hit&&hit.closest&&hit.closest('.hand .card')===c)}; })()`);
      };
      const foeAt = (i) => ev(`(() => { const e=[...document.querySelectorAll('.enemy:not(.dead)')][${i}];
        if(!e)return null; const r=e.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
        const hit=document.elementFromPoint(x,y);
        return {id:e.dataset.eid,x,y,onTop:!!(hit&&hit.closest&&hit.closest('.enemy')===e)}; })()`);
      const phaseOf = () => ev(`(() => { const c=document.querySelector('.hand .card[data-inspect="open"]')
        || document.querySelector('.hand .card[data-inspect="pending"]'); return c?c.dataset.inspect:'idle'; })()`);
      const freshBoard = async (label) => {
        await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${shotSettings}` }, S);
        await until(`!!document.querySelector('.combat .hand .card')`, label); await wait(350);
        await mouse('mouseMoved', 2, 2, false); await wait(80);
      };
      const tapSelect = async (box) => {
        await mouse('mousePressed', box.x, box.y, true);
        await mouse('mouseReleased', box.x, box.y, false); await wait(320);
      };

      // THE DIAL IS MEASURED, NOT TYPED. `data-inspect-progress` is written
      // every frame as (now - t0) / ms, so two samples a known wall-gap apart
      // solve for ms without this file ever naming 400. Cell 3's dwell is a
      // function of what came back; if the dial cannot be read, cell 3 says so
      // and fails rather than falling back to a number somebody remembered.
      await freshBoard('combat · the inspect dial, measured');
      const dialCard = await handCard('Slashing Strike');
      if (!dialCard) throw new Error(`${shape}: the four gesture cells need Slashing Strike in the opening hand`);
      await mouse('mousePressed', dialCard.x, dialCard.y, true);
      const dialMs = await ev(`(() => new Promise((res) => {
        const c = document.querySelector('.hand .card[data-inspect="pending"]');
        if (!c) return res(null);
        const t1 = performance.now(); const p1 = Number(c.dataset.inspectProgress || 0);
        setTimeout(() => { const t2 = performance.now(); const p2 = Number(c.dataset.inspectProgress || 0);
          res(p2 > p1 && p2 < 1 ? Math.round((t2 - t1) / (p2 - p1)) : null); }, 100); }))()`);
      await mouse('mouseReleased', dialCard.x, dialCard.y, false); await wait(250);
      ok(dialMs > 0, 'the inspect dial is read off the live page, so the medium dwell is derived and never typed',
        `${dialMs} ms`);

      // ---- CELL 1 · ALREADY SELECTED, THEN DRAGGED FAST ---------------------
      // One move, no dwell: the read is still `pending` when the 12 px boundary
      // is crossed. This is the sentence the fix wrote in a comment.
      await freshBoard('combat · cell 1');
      const c1 = await handCard('Slashing Strike');
      const f1 = await foeAt(0);
      if (!c1 || !f1) throw new Error(`${shape}: cell 1 needs one targetable card and one living enemy`);
      ok(c1.onTop && f1.onTop, 'cell 1 aims at what it presses — card and enemy are topmost at their own centres',
        JSON.stringify({ card: c1.onTop, foe: f1.onTop }));
      await tapSelect(c1);
      const sel1 = await say();
      ok(sel1.selected.length === 1 && sel1.selected[0] === c1.iid,
        'cell 1 the card is SELECTED before the drag, which is the state he reported', JSON.stringify(sel1.selected));
      const c1b = await handCard('Slashing Strike');
      await mouse('mousePressed', c1b.x, c1b.y, true);
      const phase1 = await phaseOf();
      await mouse('mouseMoved', f1.x, f1.y, true); await wait(140);
      const armed1 = await say();
      ok(phase1 === 'pending',
        'cell 1 the press is still a PENDING read when the fast drag begins — no read had opened', `data-inspect=${phase1}`);
      // THE AIM IS PART OF THE CELL, not decoration. ONE move both crosses the
      // 12 px boundary and has to aim the drag, and nothing downstream can tell
      // you it did not: the release commits off elementFromPoint whether or not
      // a target was ever lit, so a single-jump drag that armed no aim plays the
      // card and shows the player nothing on the way.
      ok(armed1.mode && armed1.ghosts === 1 && armed1.inspectCopies === 0
        && armed1.dropAttrs === 2 && armed1.silhouettes === 1,
      'cell 1 a fast drag off a selected card starts AND aims on the same single move', JSON.stringify(armed1));
      await mouse('mouseReleased', f1.x, f1.y, false); await wait(700);
      const end1 = await say();
      ok(end1.discard.length === sel1.discard.length + 1 && end1.discard.includes(c1.iid)
        && end1.hand.length === sel1.hand.length - 1 && !end1.hand.includes(c1.iid),
      'cell 1 the fast drag plays THAT card exactly once', JSON.stringify({ before: sel1.discard, after: end1.discard, iid: c1.iid }));
      ok(!end1.mode && end1.ghosts === 0 && end1.dropAttrs === 0 && end1.silhouettes === 0 && end1.selected.length === 0,
        'cell 1 the fast drag leaves no marker and no selection behind', JSON.stringify(end1));

      // ---- CELL 2 · CARD A SELECTED WHILE CARD B IS DRAGGED -----------------
      // Two different cardIds, so "which one played" is a fact and not a count.
      await freshBoard('combat · cell 2');
      // ONE CARD IS AIMED AT A TIME, and the order matters on a narrow board:
      // `handCard` SCROLLS the strip, so measuring B before tapping A hands the
      // tap a point B's scroll has already moved. Measured at 320x640 and
      // 390x844 — the tap meant to select Slashing Strike played a Shield
      // Defend, discard 0 -> 1 before the cell had begun, and the two shapes
      // where the hand is not a scroller were green throughout. Each card is
      // measured immediately before the gesture that uses it.
      const a2 = await handCard('Slashing Strike');
      const f2 = await foeAt(0);
      if (!a2 || !f2) throw new Error(`${shape}: cell 2 needs one targetable card and one living enemy`);
      ok(a2.onTop, 'cell 2 card A is topmost at the point the select will press', JSON.stringify(a2));
      await tapSelect(a2);
      const sel2 = await say();
      const b2 = await handCard('Gorefire Slash');
      if (!b2) throw new Error(`${shape}: cell 2 needs a second, differently-named targetable card`);
      ok(sel2.selected.length === 1 && sel2.selected[0] === a2.iid,
        'cell 2 card A is the selected one before card B is ever touched', JSON.stringify({ selected: sel2.selected, a: a2.iid, b: b2.iid }));
      ok(b2.onTop && b2.iid !== a2.iid,
        'cell 2 card B is a different card and is aimable after the selection raised card A', JSON.stringify(b2));
      await mouse('mousePressed', b2.x, b2.y, true);
      await mouse('mouseMoved', b2.x, b2.y - 30, true); await wait(60);
      await mouse('mouseMoved', f2.x, f2.y, true); await wait(140);
      await mouse('mouseReleased', f2.x, f2.y, false); await wait(700);
      const end2 = await say();
      ok(end2.discard.length === sel2.discard.length + 1 && end2.hand.length === sel2.hand.length - 1,
        'cell 2 exactly one card leaves the hand', JSON.stringify({ hand: [sel2.hand.length, end2.hand.length], discard: [sel2.discard.length, end2.discard.length] }));
      ok(end2.discard.includes(b2.iid) && !end2.discard.includes(a2.iid) && end2.hand.includes(a2.iid),
        'cell 2 the card that PLAYS is the one under the finger, never the one that was selected',
        JSON.stringify({ dragged: b2.iid, selected: a2.iid, discard: end2.discard }));
      ok(end2.selected.length === 0 && end2.ghosts === 0 && end2.mode === false,
        'cell 2 the drag clears card A’s selection instead of stranding it', JSON.stringify(end2));

      // ---- CELL 3 · A MEDIUM DRAG, AND EXACTLY ONE PLAY ---------------------
      // The dwell is a fraction of the MEASURED dial, and the phase is asserted
      // rather than assumed: this cell only means "inside the dial" if the read
      // is still pending when the drag starts.
      await freshBoard('combat · cell 3');
      const c3 = await handCard('Slashing Strike');
      const f3 = await foeAt(0);
      if (!c3 || !f3) throw new Error(`${shape}: cell 3 needs one targetable card and one living enemy`);
      await tapSelect(c3);
      const sel3 = await say();
      const c3b = await handCard('Slashing Strike');
      const dwell = dialMs > 0 ? Math.max(1, Math.round(dialMs * 0.65)) : null;
      await mouse('mousePressed', c3b.x, c3b.y, true);
      if (dwell) await wait(dwell);
      const phase3 = await phaseOf();
      for (let i = 1; i <= 5; i++) {
        await mouse('mouseMoved', c3b.x + (f3.x - c3b.x) * i / 5, c3b.y + (f3.y - c3b.y) * i / 5, true);
        await wait(30);
      }
      // MID-DRAG, BEFORE THE RELEASE. A read that opens ON TOP of a live drag
      // is a whole card-sized copy over the board while the player is still
      // aiming, and nothing after the release can see that it happened. The
      // extra settle is a fraction of the measured dial, so this sample sits
      // PAST the dial under a defect and never reaches it under the fix.
      await wait(dialMs > 0 ? dialMs : 400);
      const armed3 = await say();
      const phase3b = await phaseOf();
      await mouse('mouseReleased', f3.x, f3.y, false); await wait(800);
      const end3 = await say();
      ok(dwell !== null && phase3 === 'pending',
        'cell 3 the medium dwell sits INSIDE the measured dial and the read is still pending',
        `dwell ${dwell} ms of a measured ${dialMs} ms, data-inspect=${phase3}`);
      ok(end3.discard.length === sel3.discard.length + 1 && end3.hand.length === sel3.hand.length - 1
        && end3.discard.includes(c3.iid),
      'cell 3 a medium drag plays exactly ONCE — not zero, not twice',
      JSON.stringify({ hand: [sel3.hand.length, end3.hand.length], discard: [sel3.discard.length, end3.discard.length], energy: [sel3.energy, end3.energy] }));
      ok(armed3.mode && armed3.ghosts === 1 && armed3.inspectCopies === 0,
        'cell 3 no read opens ON TOP of the live medium drag', `data-inspect=${phase3b} ${JSON.stringify(armed3)}`);
      ok(end3.selected.length === 0 && end3.ghosts === 0 && end3.inspectCopies === 0 && end3.dropAttrs === 0,
        'cell 3 the medium drag arms nothing that outlives it', JSON.stringify(end3));

      // ---- CELL 4 · THE SAME SENTENCE, DRIVEN BY A REAL FINGER --------------
      // REAL touch: Emulation.setTouchEmulationEnabled + Input.dispatchTouch-
      // Event, aimed with elementFromPoint, with EVERY pointerdown recorded and
      // its pointerType read back — so a press that missed, or a press the page
      // saw as a mouse, is a named failure and never a quiet pass.
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);
      await freshBoard('combat · cell 4 (real touch)');
      await ev(`(() => { window.__cell4 = []; document.addEventListener('pointerdown', (e) => window.__cell4.push({
        type: e.pointerType,
        iid: ((e.target.closest && e.target.closest('.hand .card')) || { dataset: {} }).dataset.instanceId || null }), true);
        return 1; })()`);
      const touchAt = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 77 }],
      }, S);
      const c4 = await handCard('Slashing Strike');
      const f4 = await foeAt(0);
      if (!c4 || !f4) throw new Error(`${shape}: cell 4 needs one targetable card and one living enemy`);
      ok(c4.onTop && f4.onTop, 'cell 4 the finger aims at what elementFromPoint reports for the card and the enemy',
        JSON.stringify({ card: c4.onTop, foe: f4.onTop }));
      await touchAt('touchStart', c4.x, c4.y); await touchAt('touchEnd'); await wait(360);
      const sel4 = await say();
      ok(sel4.selected.length === 1 && sel4.selected[0] === c4.iid,
        'cell 4 a real finger SELECTS the card, which is the first half of his sentence', JSON.stringify(sel4.selected));
      const c4b = await handCard('Slashing Strike');
      await touchAt('touchStart', c4b.x, c4b.y);
      for (let i = 1; i <= 6; i++) {
        await touchAt('touchMove', c4b.x + (f4.x - c4b.x) * i / 6, c4b.y + (f4.y - c4b.y) * i / 6);
        await wait(30);
      }
      const armed4 = await say();
      await touchAt('touchEnd'); await wait(800);
      const end4 = await say();
      const downs4 = await ev('JSON.stringify(window.__cell4)');
      const presses4 = JSON.parse(downs4 || '[]');
      ok(presses4.length === 2 && presses4.every((d) => d.type === 'touch' && d.iid === c4.iid),
        'cell 4 both presses arrived as REAL TOUCH and both landed on that card', downs4);
      ok(armed4.mode && armed4.ghosts === 1 && armed4.inspectCopies === 0,
        'cell 4 the touch drag arms the drop off a selected card', JSON.stringify(armed4));
      ok(end4.discard.length === sel4.discard.length + 1 && end4.discard.includes(c4.iid)
        && end4.hand.length === sel4.hand.length - 1,
      'cell 4 the finger plays the selected card exactly once',
      JSON.stringify({ before: sel4.discard, after: end4.discard, iid: c4.iid }));
      ok(!end4.mode && end4.ghosts === 0 && end4.dropAttrs === 0 && end4.selected.length === 0,
        'cell 4 the touch drag leaves no marker and no selection behind', JSON.stringify(end4));
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }, S);

      await cdp.send('Target.closeTarget', { targetId });
    }
    if (!ran) throw new Error(`--only ${only} matched no shape`);
  } finally {
    cdp.close(); await browser.close(); if (served) served.server.close();
  }
}

// THE VERDICT LINE ENDS AT ITS COUNTED CLAIM. `readVerdict` (tools/verdict.mjs)
// refuses trailing prose outright — D103 — so the sentence this tool used to
// print ("PASS — card drag targeting and approved hand paging hold at every
// measured shape") matched no row and was refused, exit 3. It is one of the ~40
// D103 named and left to "whoever wraps next"; this is that wrap.
main().then(() => finish(fails ? 1 : 0)).catch((e) => finish(2, e.message));
