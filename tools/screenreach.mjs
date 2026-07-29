// tools/screenreach.mjs — is every control on every screen reachable by a
// finger, at the shapes we claim to support?
//
// WHY THIS EXISTS, and it is not a hypothetical. tools/mobilefit.mjs measures
// the combat board in detail and says nothing about the rest of the game. The
// portrait work (EldenSpire#23) changes --ui-zoom for EVERY screen — from 0.62
// to ~0.90 on a phone, which is less local space, not more — while only combat
// gets a narrow layout. Combat came out at 45/45 and I would have shipped it,
// and this sweep found three controls that were reachable on dev at 390x844
// and were NOT on my branch:
//
//   COVERED  ⚒ (#combat-armoury)  <- div.pile.draw   my repositioned piles
//   COVERED  a map node           <- button.zbtn     the map's floating zoom stack (x2)
//
// Fixing a lockout in the fight and putting a different one in the top bar is
// not a fix. Both are fixed; this is the check that has to stay.
//
// WHAT IT DOES. Boots each ?shot= state at each shape, collects everything a
// player can press, and hit-tests the centre of each with elementFromPoint.
//
// THE ONE DISTINCTION THAT MAKES THE NUMBER MEAN ANYTHING — and the first two
// versions of this file got it wrong in opposite directions. A control that
// fails the hit-test is either:
//   - SCROLLED OUT: its centre is outside its scroll ancestor's visible box.
//     The player reaches it by scrolling. Not a defect. The act map is a
//     pannable canvas with 60+ nodes and most of them are off-screen at any
//     moment; counting those called the map 23-unreachable and the desktop
//     4-unreachable, all of it noise.
//   - COVERED: its centre IS inside the scrollport and something else answers
//     the hit-test. That is EldenSpire#21's mechanism, wherever it appears.
//   - OFF-SCREEN, NOTHING SCROLLS: past the viewport edge with no scroll
//     ancestor and no page scroll in that axis. Added 2026-07-29, and it is the
//     quiet-direction failure this header warned about, sitting in this file:
//     the SCROLLED OUT test fell back to the viewport box when there was no
//     scroll ancestor, so "off the edge forever" and "off the edge for now"
//     were the same answer, and the reward screen's lost cards were filed as
//     fine. Counted, like COVERED.
// Getting this wrong in the loud direction buries the real finding in false
// positives; getting it wrong in the quiet direction reports zero forever.
//
// Usage
//   node tools/screenreach.mjs                    source tree via tools/serve.mjs
//   node tools/screenreach.mjs --dist             dist/AshenSpire.html over file://
//   node tools/screenreach.mjs --only 390x844
//   CHROME=/path/to/chrome node tools/screenreach.mjs
//
// Exit codes
//   0  no control is covered at any shape
//   1  a covered control  (the known-bad: this branch before the two fixes)
//   2  usage / no browser / a screen that would not mount — never a pass
//
// BOUNDARY, printed again at the end: Linux headless Chromium only, and CDP
// emulation is not a phone. It reaches only the screens that have a ?shot=
// state — title, map, combat, boss, death. CUSTOMIZE, SHOP, REST, REWARDS and
// the overlays have no ?shot= and are NOT covered by this or anything else,
// which matters because #23's own bleed evidence came from customize. It
// hit-tests reachability at rest; it does not press anything, does not judge
// legibility, and cannot see a control that only appears mid-interaction.

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

// Every screen that can be reached without playing the game. `boss` holds a
// splash deliberately covering the board, so its controls ARE covered by
// design and it is listed with `overlay: true` rather than left out — a screen
// missing from a sweep is invisible, and a screen present with a reason is not.
const SCREENS = [
  { name: 'title', q: '', ready: `!!document.querySelector('#app button')` },
  { name: 'map', q: '?shot=map', ready: `!!document.querySelector('.map-node')` },
  { name: 'combat', q: '?shot=combat', ready: `!!document.querySelector('.combat .hand .card')` },
  { name: 'death', q: '?shot=death', ready: `!!document.querySelector('#app button')` },
  { name: 'boss', q: '?shot=boss', ready: `!!document.querySelector('.boss-intro')`, overlay: 'the boss splash covers the board on purpose and is dismissed on a timer' },
  // REWARDS, reachable at last (`?shot=reward`, added with this sweep row). It
  // is the screen a player meets after EVERY fight and it was in this file's own
  // boundary as "not covered here or anywhere". Both edges are listed, because
  // the count is the whole layout question: 0 cards is a relic/cinders-only
  // payout, 4 is the game's ceiling (rewards.cardChoices 3, +1 for an elite with
  // feralEye). The 3-card row is the ordinary case and rides in the middle.
  { name: 'reward0', q: '?shot=reward&shotCards=0', ready: `!!document.querySelector('#reward-continue')` },
  { name: 'reward', q: '?shot=reward', ready: `!!document.querySelector('.reward-row .card')` },
  { name: 'reward4', q: '?shot=reward&shotCards=4', ready: `!!document.querySelector('.reward-row .card')` },
];

const SHAPES = [
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop' }, // NON-REGRESSION EDGE
  { w: 390, h: 844, d: 3, mobile: true, tag: 'portrait' },
  // 412x915 was the one portrait shape this sweep did not test, and on
  // 2026-07-29 it was the only shape carrying a covered map node that dev does
  // not have. A gap in a shape list is not a smaller sweep, it is a blind spot
  // with a PASS on top: mobilefit.mjs has carried this row since it was written
  // and this file did not, so the two tools disagreed about what "every portrait
  // shape" meant and neither of them said so.
  { w: 412, h: 915, d: 2.6, mobile: true, tag: 'portrait' },
  { w: 360, h: 640, d: 2, mobile: true, tag: 'portrait' },
  { w: 844, h: 390, d: 3, mobile: true, tag: 'landscape' },
];

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A FILTER THAT MATCHES NOTHING IS A USAGE ERROR, NOT A PASS.
//
// `--only 412x915` on the version of this file that shipped yesterday skipped
// every shape, asserted nothing, printed `PASS — no covered controls` and
// exited 0 — and 412x915 was a real shape I was actually trying to look at, and
// a real defect was sitting on it. The tool answered a question about zero
// shapes with a green a reader takes as an answer about the game. That is the
// manufactured zero this family has removed four times, and it is worse in an
// instrument than in the app: the app tells the truth to one player, the
// instrument tells it to every reviewer downstream.
//
// Checked HERE, against the shape table, before a browser is even launched, so
// the failure names the typo and the legal values instead of failing later for
// a reason a reader has to reconstruct. Exit 2 = usage, per the header — never a
// pass. The end-of-run guard below is the second lock, for the day someone makes
// the loop skip a shape for a reason that is not `--only`.
function assertOnlyMatches(shapes, label) {
  if (!only) return;
  const names = shapes.map(label);
  if (names.includes(only)) return;
  console.error(`screenreach: --only ${only} matched no shape. Nothing would be tested, so this is unknown, not a pass.`);
  console.error(`  shapes: ${names.join(', ')}`);
  process.exit(2);
}
assertOnlyMatches(SHAPES, (vp) => `${vp.w}x${vp.h}`);

const PROBE = `(() => {
  const app = document.getElementById('app');
  const de = document.documentElement;
  const z = parseFloat(getComputedStyle(de).getPropertyValue('--ui-zoom')) || 1;
  // Everything a player can press. .map-node is an SVG <g>, so className is an
  // SVGAnimatedString and must never be string-formatted blindly.
  const sel = 'button,[role=button],.pile,.map-node,.card,.choice,.opt,.zbtn,.topbar-btn';
  const name = (e) => {
    if (!e) return 'null';
    const t = (e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 22);
    const c = typeof e.className === 'string' ? e.className.trim().split(/\\s+/)[0] : '';
    return (t || '') + (c ? ' .' + c : ' ' + e.tagName);
  };
  const scrollport = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)) return p;
    }
    return null;
  };
  const covered = [], scrolledOut = [], unreachable = [], lostUnderTransform = [];
  const de2 = document.documentElement, bd = document.body;
  // WHERE A COORDINATE LIVES IN ITS SCROLLER'S CONTENT, which is the only space
  // in which "can the player get to it" is answerable. A viewport coordinate is
  // where the thing is NOW; content position is where it is in the strip the
  // scroller can travel over. content = viewport - scrollerOrigin + scrollOffset.
  //
  // Reachable iff 0 <= content <= scrollSize. The upper bound is satisfied by
  // construction for anything the scroller lays out; THE LOWER BOUND IS NOT, and
  // that is the whole bug family. A centred flex row that overflows puts its
  // first item at a NEGATIVE content offset, and scrollLeft cannot go below 0 in
  // any browser — so the left of a centred overflowing row is not "off screen
  // for now", it is gone, on every device, forever. That is .reward-row: at
  // 390x844 with three cards the left card starts at content -13.8 and its cost
  // badge shows 5.2px of 27; with the four an elite can offer it starts at -86.7
  // and the badge shows 0 of 27.
  //
  // With no scroll ancestor the document IS the scroller, so the same arithmetic
  // covers both and there is no second rule to keep in step.
  const scrollerOf = (sp) => {
    if (sp) { const b = sp.getBoundingClientRect();
      return { ox: b.left, oy: b.top, sl: sp.scrollLeft, st: sp.scrollTop, sw: sp.scrollWidth, sh: sp.scrollHeight }; }
    return { ox: 0, oy: 0, sl: scrollX, st: scrollY,
             sw: Math.max(de2.scrollWidth, bd.scrollWidth), sh: Math.max(de2.scrollHeight, bd.scrollHeight) };
  };
  // A ROTATED ELEMENT'S RECT IS NOT ITS LAYOUT BOX, and this check would be
  // useless without the distinction. getBoundingClientRect returns the
  // axis-aligned box around the PAINTED result, so the combat hand's fanned
  // cards — rotated ~3 degrees each — report a box ~8px wider than the card and
  // hang that much past their scroller's content origin. Measured: at 390x844
  // the first hand card reads content x -7.6 while its own layout box starts at
  // 0. That is a decorative corner, not a control the player lost, and counting
  // it would put four false failures in front of every real one — the loud
  // direction this file's header warns about, which buries findings just as
  // effectively as the quiet one.
  //
  // So the line is drawn where it can be stated: an element under a non-identity
  // transform is REPORTED and not counted. BOUNDARY, and it is a real hole — a
  // genuinely lost control that happens to be transformed will be reported and
  // will not fail the run. Deriving the true layout box means walking offsetParent
  // in LOCAL px while every other number here is VISUAL, and mixing those two
  // rooms silently is the defect this repo has fixed three times (#15, zoomplace,
  // the fx showcase). I would rather carry a named hole than a quiet conversion.
  const transformed = (e) => {
    const t = getComputedStyle(e).transform;
    return !!t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)';
  };
  const lostIn = (s, r) => {
    // Measured on the BOX, not the centre: a control whose centre is on screen
    // but whose edge is amputated is not reachable-and-fine, and the cost badge
    // this misses is the number the whole screen is asking the player to compare.
    const cx0 = r.left - s.ox + s.sl, cx1 = r.right - s.ox + s.sl;
    const cy0 = r.top - s.oy + s.st, cy1 = r.bottom - s.oy + s.st;
    if (cx0 < -0.5) return 'left edge at content x ' + cx0.toFixed(1) + ' — no scroller goes below 0';
    if (cy0 < -0.5) return 'top edge at content y ' + cy0.toFixed(1) + ' — no scroller goes below 0';
    if (cx1 > s.sw + 0.5) return 'right edge at content x ' + cx1.toFixed(1) + ' past scrollable width ' + s.sw;
    if (cy1 > s.sh + 0.5) return 'bottom edge at content y ' + cy1.toFixed(1) + ' past scrollable height ' + s.sh;
    return null;
  };
  const all = [...app.querySelectorAll(sel)].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden';
  });
  for (const c of all) {
    const r = c.getBoundingClientRect();
    const sp = scrollport(c);
    // LOST is asked FIRST and independently of the hit-test, because the two
    // questions are different and the old order let one answer the other. A
    // control can hit-test perfectly at its centre and still have an edge no
    // gesture will ever bring back; the hit-test says nothing about that, and
    // for eleven of this screen's shapes it said "fine".
    const lost = lostIn(scrollerOf(sp), r);
    if (lost) {
      if (transformed(c)) lostUnderTransform.push(name(c) + '  <-  ' + lost);
      else { unreachable.push(name(c) + '  <-  ' + lost); continue; }
    }
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = (x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight) ? document.elementFromPoint(x, y) : null;
    if (hit && (hit === c || c.contains(hit))) continue;
    // Inside its own scrollport, or scrolled past the edge of it? Reaching here
    // means the box IS recoverable by scrolling, so this branch is now only
    // about where it happens to sit right now — which is what it always claimed
    // to be about, and was not.
    const box = sp ? sp.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const outside = x < box.left - 0.5 || x > box.right + 0.5 || y < box.top - 0.5 || y > box.bottom + 0.5;
    if (outside) { scrolledOut.push(name(c)); continue; }
    covered.push(name(c) + '  <-  ' + name(hit));
  }
  return { z, local: app.clientWidth + 'x' + app.clientHeight, total: all.length,
           covered, unreachable, lostUnderTransform, scrolledOut: scrolledOut.length };
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
  if (!browserPath) { console.error('screenreach: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'screenreach-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`screenreach: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: 8264, open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`screenreach — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);

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

  const fails = [];
  let ran = 0;
  for (const vp of SHAPES) {
    const shape = `${vp.w}x${vp.h}`;
    if (only && only !== shape) continue;
    ran++;
    console.log(`\n  ${shape} @ dSF ${vp.d}  (${vp.tag})`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: 5 }, S);
    for (const sc of SCREENS) {
      await cdp.send('Page.navigate', { url: `${base}${sc.q}` }, S);
      const t0 = Date.now();
      let up = false;
      while (Date.now() - t0 < 12000) { if (await evalIn(sc.ready).catch(() => false)) { up = true; break; } await wait(150); }
      if (!up) { console.log(`    ${sc.name.padEnd(8)} DID NOT MOUNT — never a pass`); fails.push(`${shape} ${sc.name}: screen would not mount`); continue; }
      await wait(900); // auto-zoom re-flexes on a 150ms debounce plus a boot re-apply
      const r = await evalIn(PROBE);
      const tail = sc.overlay ? `  (overlay screen: ${sc.overlay})` : '';
      console.log(`    ${sc.name.padEnd(8)} zoom ${String(r.z).padEnd(5)} local ${r.local.padEnd(10)} ${String(r.total).padStart(3)} controls · ${r.scrolledOut} scrolled-out (fine) · ${r.covered.length} COVERED · ${r.unreachable.length} OFF-SCREEN-NO-SCROLL${r.lostUnderTransform.length ? ` · ${r.lostUnderTransform.length} transformed (not counted)` : ''}${tail}`);
      for (const c of r.covered) console.log(`               ✗ ${c}`);
      for (const c of r.unreachable) console.log(`               ✗ ${c}`);
      for (const c of r.lostUnderTransform) console.log(`               · [transformed, reported not counted] ${c}`);
      if (r.covered.length && !sc.overlay) fails.push(`${shape} ${sc.name}: ${r.covered.length} covered control(s) — ${r.covered[0]}`);
      // An overlay screen covers its board on purpose; NOTHING puts a control
      // past the screen edge with no way back on purpose, so the overlay
      // exemption does not extend to this category.
      if (r.unreachable.length) fails.push(`${shape} ${sc.name}: ${r.unreachable.length} control(s) off-screen with nothing to scroll — ${r.unreachable[0]}`);
    }
  }

  console.log(`\n  BOUNDARY — Linux headless Chromium only; emulation is not a phone. Only the
  screens with a ?shot= state are reached: title, map, combat, boss, death and
  — as of 2026-07-29 — reward, at 0, 3 and 4 cards.
  CUSTOMIZE, SHOP, REST and every overlay still have NO ?shot= and are not
  covered here or anywhere. That is not a footnote: #23's own bleed evidence
  came from customize, where portrait bleed measured 139.80px with no scrollbar
  drawn, and NOTHING IN THIS REPO CAN SEE IT. The reward row was in this same
  sentence yesterday and was hiding a real defect at three portrait shapes.
  Reachability at rest only: nothing is pressed, legibility is not judged, and a
  control that appears only mid-interaction cannot be seen.
  An element under a non-identity transform can be reported off-screen and is
  NOT counted — see the note on transformed() above for why, and for the hole
  that leaves.

  AND THE SHAPE LIST IS STILL NOT THE OTHER TOOL'S — Rune's paragraph, kept
  because it is still true. This runs five shapes; tools/mobilefit.mjs runs
  nine, and neither list is a superset: 915x412, 844x344, 1920x1080 and the XL
  setting are measured there and not here. A defect can live in that gap, and
  one did — the covered map node at 412x915, at the one portrait shape this
  tool did not test. 412x915 is now IN the list above; the four other widths
  are not, and that is the live gap.`);

  // The second lock. assertOnlyMatches() catches the filter typo up front; this
  // catches every other way the loop can end up having measured nothing, and it
  // is what makes the guarantee "a green means shapes were tested" rather than
  // "a green means no failure was recorded."
  //
  // The word is Rune's, from the version of this fix he wrote in parallel six
  // hours before mine, and it is better than the one I had: a run that tested
  // nothing is `unknown`, which under SOP 2's silence guard BLOCKS — not merely
  // "not a pass". He also named what it is a copy of, and that is the part worth
  // keeping: development.md's own `verify-shipped: OK - 0 checks passed`
  // fixture, reproduced in tools whose headers cite that discipline.
  const measured = ran ? ` over ${ran} shape(s), ${SCREENS.length} screen(s) each` : '';
  if (!ran) {
    console.error(`\n  Nothing was tested, so this is unknown, not a pass.`);
    cdp.close(); child.kill(); if (server) server.close();
    process.exit(2);
  }
  console.log(`\n  ${fails.length ? `FAIL — ${fails.length}` : 'PASS — no covered controls'}${measured}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); child.kill(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`screenreach: ${e.message}`); process.exit(2); });
