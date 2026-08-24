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
// Only COVERED is counted. Getting this wrong in the loud direction buries the
// real finding in false positives; getting it wrong in the quiet direction
// reports zero forever.
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
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

// DOOR, and why --selftest exists (Rune, 2026-08-15). The real input is the
// RENDERED PAGE: this tool serves the real tree, boots each ?shot= state in a
// real browser, and hit-tests real rects with elementFromPoint. That is the
// right door and always was. What it lacked was a re-runnable known-bad: its
// only observation was "this branch before the two fixes" — a ref nobody can
// check out now, which under SOP 2's drift clause is `unknown`, not coverage.
// Vira's audit (2026-08-14) rated it OBSERVED-ONCE for exactly that.
// `--selftest` puts the ORIGINAL defect back as CSS BYTES in a copy of the
// tree — the map's zoom stack floating over the canvas again, which is the
// literal shape of the covered map node — and re-runs this whole tool against
// the copy: same serve.mjs, same browser, same hit-test.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const selftestCode = await doorSelftest({
    tool: 'screenreach.mjs',
    args: ['--only', '390x650'],
    timeoutMs: 600000,
    plants: [
      {
        // #28 moved the bar BELOW the map, so re-floating it is not one
        // property any more: `position: fixed` over the map's own bottom band
        // is the same geometry the pre-#28 tree shipped — a floating stack
        // answering the hit-test in a node's place.
        name: 'the zoom stack floats over the map canvas again (the #21-shaped covered node)',
        file: 'styles/map.css',
        // It floats over the TOP band, where the map's own controls actually
        // sit at this shape — the bottom band is a pannable canvas whose nodes
        // are mostly SCROLLED OUT, which this tool correctly does not count, so
        // a bottom-floating plant reproduces nothing. Measured, not assumed:
        // bottom => 0 COVERED, top => 3 COVERED.
        append: '.map-zoom { position: fixed; left: 0; right: 0; top: 0; height: 14vh; z-index: 60; }',
        // `map` by name, because the boss screen legitimately reports 10
        // COVERED by design (its splash) — a bare `N COVERED` regex matches
        // that expected line and would have called a green run a catch.
        expectRed: /^\s*map\s.*[1-9]\d* COVERED/m,
      },
      {
        name: 'a full-bleed veil is laid over every screen — nothing can answer its own hit-test',
        file: 'styles/ui.css',
        append: '.screen::after { content: ""; position: fixed; inset: 0; z-index: 9000; background: transparent; }',
        expectRed: /^\s*title\s.*[1-9]\d* COVERED/m,
      },
      {
        name: 'Shrine cards lose the shared body wrapper and split into narrow sibling columns',
        file: 'src/ui/screens/rest.js',
        find: '<div class="cp-body">\n            <h3>Rest</h3>',
        replace: '<div>\n            <h3>Rest</h3>',
        expectRed: /Shrine choice cards missing their shared \.cp-body composition/,
      },
      {
        name: 'the narrow combatant frame regains its intrinsic gaps and crosses both HUD bands',
        file: 'styles/combat.css',
        find: ":root[data-layout='narrow'] .combatant { gap: 0; }",
        replace: ":root[data-layout='narrow'] .combatant { gap: 0.4rem; }",
        expectRed: /frame paints under the HUD/,
      },
      {
        name: 'Settings cleanup watches the shared connected panel instead of its own render',
        file: 'src/ui/screens/settings.js',
        find: 'if (lifecycleSentinel.isConnected) return;',
        replace: 'if (container.isConnected) return;',
        expectRed: /Settings revisit leaked listeners/,
      },
      {
        name: 'the fullscreen switch loses its accessible name',
        file: 'src/ui/screens/settings.js',
        find: ' aria-label="${esc(r.label)}" aria-describedby="set-${r.key}-status"',
        replace: ' aria-describedby="set-${r.key}-status"',
        expectRed: /fullscreen switch lacks an accessible name or description/,
      },
      {
        name: 'the preserved R shortcut returns to the removed Relics tab',
        file: 'src/ui/screens/map.js',
        find: "if (onArmoury) onArmoury();",
        replace: "if (onMenu) onMenu('relics');",
        expectRed: /equipment shortcut did not open Armoury/,
      },
    ],
  });
  if (selftestCode === 0) console.log('screenreach-selftest: OK — 7 checks passed');
  process.exit(selftestCode);
}

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// WHAT TREE DID THIS SEE? Naming the file is not naming its freshness — this
// tool measured a two-merge-stale bundle and printed OK once already. One home:
// tools/artifact-provenance.mjs. Facts only; it never fails a run.
import { printArtifactProvenance } from './artifact-provenance.mjs';
printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const SETTINGS_CYCLE = `(async () => {
  const types = ['resize', 'fullscreenchange', 'webkitfullscreenchange', 'fullscreenerror', 'webkitfullscreenerror'];
  const live = new Map(types.map((type) => [type, new Set()]));
  const wrap = (target) => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = (type, listener, options) => {
      if (live.has(type)) live.get(type).add(listener);
      return add(type, listener, options);
    };
    target.removeEventListener = (type, listener, options) => {
      if (live.has(type)) live.get(type).delete(listener);
      return remove(type, listener, options);
    };
  };
  wrap(window); wrap(document);
  const pause = () => new Promise((resolve) => setTimeout(resolve, 80));
  document.querySelector('#open-menu')?.click(); await pause();
  const tab = (id) => document.querySelector('.ov-tab[data-member="' + id + '"]');
  tab('settings')?.click(); await pause();
  const fullscreen = document.querySelector('.toggle[data-key="fullscreen"]');
  const described = fullscreen?.getAttribute('aria-describedby');
  window.__fullscreenA11y = !!(fullscreen?.getAttribute('aria-label')
    && described && document.getElementById(described));
  tab('deck')?.click(); await pause();
  tab('settings')?.click(); await pause();
  tab('deck')?.click(); await pause();
  window.__settingsListenerBalance = Object.fromEntries([...live].map(([type, listeners]) => [type, listeners.size]));
  document.querySelector('#ov-close')?.click(); await pause();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true })); await pause();
  window.__armouryShortcutOpened = !!document.querySelector('.armoury-overlay');
  return true;
})()`;

// Every screen that can be reached without playing the game. `boss` holds a
// splash deliberately covering the board, so its controls ARE covered by
// design and it is listed with `overlay: true` rather than left out — a screen
// missing from a sweep is invisible, and a screen present with a reason is not.
const SCREENS = [
  { name: 'title', q: '', ready: `!!document.querySelector('#app button')` },
  { name: 'map', q: '?shot=map', ready: `!!document.querySelector('.map-node')` },
  { name: 'menu-cycle', q: '?shot=map', ready: `!!document.querySelector('.map-node')`, setup: SETTINGS_CYCLE,
    overlay: 'the Armoury opened by the preserved equipment shortcut covers the map on purpose' },
  { name: 'combat', q: '?shot=combat', ready: `!!document.querySelector('.combat .hand .card')` },
  { name: 'combat-xl', q: '?shot=combat&shotArcane=matrix&shotSettings=%7B%22textSize%22%3A%22xl%22%2C%22uprightGate%22%3Afalse%7D', ready: `!!document.querySelectorAll('.enemy-row .intent').length` },
  { name: 'death', q: '?shot=death', ready: `!!document.querySelector('#app button')` },
  // EldenSpire#29 slice 1. Added the day the state existed. This file's own
  // boundary has said since it was written that customize/shop/rest/rewards
  // have no ?shot= and are therefore covered by nothing — and that is exactly
  // why customize went unexamined for the week combat was measured three times
  // over. One of the four is now swept; the boundary still names the other three.
  { name: 'customize', q: '?shot=customize', ready: `!!document.querySelector('.cz-portrait')` },
  { name: 'boss', q: '?shot=boss', ready: `!!document.querySelector('.boss-intro')`, overlay: 'the boss splash covers the board on purpose and is dismissed on a timer' },
  // The Compendium (Freja). Twenty-four buttons in a scrolling grid on a phone
  // is what this sweep is FOR, and a new screen that skips it is the eight
  // screens Rune's census counts as owned by no instrument. It is added in the
  // act that creates the screen for the same reason customize was added late
  // and cost a week.
  { name: 'compendium', q: '?shot=compendium', ready: `!!document.querySelector('.cp-cell')` },
  // THE SHRINE AND THE MERCHANT. The boundary below said for weeks that REST
  // has no `?shot=` state — and it HAS had one since the Smith grid was fixed;
  // the sentence went stale the moment somebody added the state and did not add
  // the row. A boundary that lies about its own scope is worse than none (this
  // file's own words, about this file). Both screens now carry a second-beat
  // control apiece (Rest holds, the Smith confirms, the brazier confirms), and
  // a confirm panel that pushes a CANCEL button off a 360 px screen is exactly
  // the class this sweep exists to catch.
  { name: 'rest', q: '?shot=rest', ready: `!!document.querySelector('#rest-opt')` },
  { name: 'shop', q: '?shot=shop', ready: `!!document.querySelector('#leave-shop')` },
];

const SHAPES = [
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop' }, // NON-REGRESSION EDGE
  { w: 390, h: 844, d: 3, mobile: true, tag: 'portrait' },
  // Safari's visible game viewport after browser chrome is materially shorter
  // than the device screen; this is the iPhone edge that exposed HUD overlap.
  { w: 390, h: 650, d: 3, mobile: true, tag: 'safari-like' },
  { w: 360, h: 640, d: 2, mobile: true, tag: 'portrait' },
  { w: 844, h: 390, d: 3, mobile: true, tag: 'landscape' },
];

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `(() => {
  const app = document.getElementById('app');
  const de = document.documentElement;
  const z = parseFloat(getComputedStyle(de).getPropertyValue('--ui-zoom')) || 1;
  // Everything a player can press. .map-node is an SVG <g>, so className is an
  // SVGAnimatedString and must never be string-formatted blindly.
  // WIDENED FOR #29 slice 1, and the widening is the point. Adding customize to
  // SCREENS without this reported "2 controls · 0 COVERED" and PASSED — the
  // screen has 25, and the three that were unreachable (the name field, the
  // seed field and a class card) were none of the two it looked at. A sweep
  // that opens a screen and inspects 8% of it is the '0 checks passed' shape
  // wearing a screen name.
  const sel = 'button,[role=button],input,.pile,.map-node,.card,.choice,.opt,.zbtn,.topbar-btn,.cz-opt,.class-pick,.cz-keepsake';
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
  const covered = [], scrolledOut = [];
  const all = [...app.querySelectorAll(sel)].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden';
  });
  for (const c of all) {
    const r = c.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = (x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight) ? document.elementFromPoint(x, y) : null;
    if (hit && (hit === c || c.contains(hit))) continue;
    // Inside its own scrollport, or scrolled past the edge of it?
    const sp = scrollport(c);
    const box = sp ? sp.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const outX = x < box.left - 0.5 || x > box.right + 0.5;
    const outY = y < box.top - 0.5 || y > box.bottom + 0.5;
    if (outX || outY) {
      // SCROLLED-OUT IS ONLY FINE IF SCROLLING CAN ACTUALLY GET THERE.
      //
      // The first version of this classifier stopped at "outside its
      // scrollport" and called that recoverable. Run against the customize
      // screen before #29 slice 1 fixed it, with the preview pane, the name
      // field and the seed field sitting at x = -139.8 and no horizontal
      // scroll anywhere on the page, it reported 0 COVERED and exited 0. The
      // sweep could not see the defect it had just been added for.
      //
      // A container whose computed overflow is auto is not necessarily a
      // container that scrolls: '.screen' sets overflow-y:auto, which makes
      // overflow-x compute to auto too, so every horizontally-absent control
      // on that screen looked recoverable. Ask the port for real travel on the
      // axis that is actually short.
      const port = sp || document.scrollingElement || document.documentElement;
      // DIRECTION MATTERS, and the first version of this test missed it. It
      // asked only whether the port had travel, and the customize screen HAD
      // travel — the class row overflowed ~71px to the RIGHT — so a preview
      // pane sitting 139px off the LEFT was called recoverable. You cannot
      // scroll to a negative offset: in LTR, content laid out before the
      // origin is unreachable no matter how wide the content is. Ask whether
      // the port can move THE WAY THIS CONTROL IS.
      const canGoLeft = port.scrollLeft > 1;
      const canGoRight = port.scrollWidth - port.clientWidth - port.scrollLeft > 1;
      const canGoUp = port.scrollTop > 1;
      const canGoDown = port.scrollHeight - port.clientHeight - port.scrollTop > 1;
      const offLeft = x < box.left - 0.5, offRight = x > box.right + 0.5;
      const offTop = y < box.top - 0.5, offBottom = y > box.bottom + 0.5;
      const recoverable =
        (!offLeft || canGoLeft) && (!offRight || canGoRight)
        && (!offTop || canGoUp) && (!offBottom || canGoDown);
      const travelX = port.scrollWidth - port.clientWidth;
      const travelY = port.scrollHeight - port.clientHeight;
      if (recoverable) { scrolledOut.push(name(c)); continue; }
      const dir = [offLeft && 'left', offRight && 'right', offTop && 'above', offBottom && 'below'].filter(Boolean).join('+');
      covered.push(name(c) + '  <-  UNREACHABLE: ' + dir + ' of its scrollport, which cannot scroll that way'
        + ' (travel ' + Math.round(travelX) + 'x' + Math.round(travelY) + ', at ' + Math.round(port.scrollLeft) + ',' + Math.round(port.scrollTop) + ')');
      continue;
    }
    covered.push(name(c) + '  <-  ' + name(hit));
  }
  const visual = [];
  // The shared class-pick narrow composition expects one cp-body text
  // column beside its glyph. Shrine cards used the component class without the
  // component body, so every direct child became a new flex column: no literal
  // viewport overflow, but the flask name, stepper and Level-up buttons were
  // squeezed into unusable ribbons. Assert the component boundary, not a magic
  // width that happens to fit today's copy.
  if (document.querySelector('#flask-reallocate')) {
    const bare = [...document.querySelectorAll('.screen > .class-row > .class-pick')]
      .filter((card) => !card.querySelector(':scope > .cp-body'));
    if (bare.length) visual.push('Shrine choice cards missing their shared .cp-body composition: ' + bare.length);
  }
  // A tall enemy can be centred through the flexible battlefield boundary.
  // Its complete receipt still has to remain between the two interaction bands;
  // checking only the intent would miss meters or statuses painting under hand.
  if (document.querySelector('.combat')) {
    const hud = document.querySelector('.combat-hud')?.getBoundingClientRect();
    const hand = document.querySelector('.hand-area')?.getBoundingClientRect();
    for (const frame of document.querySelectorAll('.enemy-row .combatant')) {
      const r = frame.getBoundingClientRect();
      const label = frame.querySelector('.nm')?.textContent?.trim() || frame.dataset.eid || 'enemy';
      if (hud && r.top < hud.bottom - 0.5) visual.push(label + ' frame paints under the HUD by ' + (hud.bottom - r.top).toFixed(1) + 'px');
      if (hand && r.bottom > hand.top + 0.5) visual.push(label + ' frame paints under the hand by ' + (r.bottom - hand.top).toFixed(1) + 'px');
    }
  }
  if (window.__settingsListenerBalance) {
    const leaks = Object.entries(window.__settingsListenerBalance).filter(([, count]) => count !== 0);
    if (leaks.length) visual.push('Settings revisit leaked listeners: ' + leaks.map(([type, count]) => type + '=' + count).join(', '));
    if (!window.__fullscreenA11y) visual.push('fullscreen switch lacks an accessible name or description');
    if (!window.__armouryShortcutOpened) visual.push('equipment shortcut did not open Armoury');
  }
  return { z, local: app.clientWidth + 'x' + app.clientHeight, total: all.length,
           covered, scrolledOut: scrolledOut.length, visual };
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


async function main() {
  if (!browserPath) { console.error('screenreach: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
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

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'screenreach-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling'],
    timeoutMs: 12000,
  });
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
  let shapesRun = 0;
  for (const vp of SHAPES) {
    const shape = `${vp.w}x${vp.h}`;
    if (only && only !== shape) continue;
    shapesRun++;
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
      if (sc.setup) await evalIn(sc.setup);
      const r = await evalIn(PROBE);
      const tail = sc.overlay ? `  (overlay screen: ${sc.overlay})` : '';
      console.log(`    ${sc.name.padEnd(8)} zoom ${String(r.z).padEnd(5)} local ${r.local.padEnd(10)} ${String(r.total).padStart(3)} controls · ${r.scrolledOut} scrolled-out (fine) · ${r.covered.length} COVERED${tail}`);
      for (const c of r.covered) console.log(`               ✗ ${c}`);
      if (r.covered.length && !sc.overlay) fails.push(`${shape} ${sc.name}: ${r.covered.length} covered control(s) — ${r.covered[0]}`);
      for (const finding of r.visual) console.log(`               ✗ ${finding}`);
      if (r.visual.length) fails.push(`${shape} ${sc.name}: ${r.visual[0]}`);
    }
  }

  // A CHECK THAT RAN NOTHING IS `unknown`, NEVER A PASS. This exact command —
  // `--only 412x915` — printed "PASS — no covered controls" and exited 0 at the
  // one shape where Sunna had measured a covered map node. It is
  // development.md's `verify-shipped: OK - 0 checks passed` fixture, reproduced
  // in a tool whose own header cites that discipline. She found it despite this
  // tool rather than with it.
  if (shapesRun === 0) {
    console.error(`\nscreenreach: --only ${only} matched no shape. Nothing was tested, so this is unknown, not a pass.`);
    console.error(`  shapes: ${SHAPES.map((v) => `${v.w}x${v.h}`).join(', ')}`);
    cdp.close(); await dropBrowser(); if (server) server.close();
    process.exit(2);
  }

  // The list of swept screens is DERIVED from SCREENS rather than retyped. It
  // was a hand-written sentence, and a boundary that has to be edited by hand
  // when the list grows is a second copy of the list — it had already stopped
  // naming customize in its first clause while sweeping it in the next. A
  // boundary that lies about its own scope is worse than none.
  console.log(`\n  BOUNDARY — Linux headless Chromium only; emulation is not a phone. Only the
  screens with a ?shot= state plus the declared menu-cycle setup are reached:
  ${SCREENS.map((s) => s.name).join(', ')}.
  REWARDS and the DRAFT still have no direct state or declared setup here. Neither is a second-beat surface today
  (rewardPick and draftPick are declared 'none' in src/model/secondbeat.js), so
  what is unmeasured there is their reach, not a confirm step.
  Reachability at rest only: nothing is pressed, legibility is not judged, and a
  control that appears only mid-interaction cannot be seen.

  AND THE SHAPE LIST IS NOT THE OTHER TOOL'S. This runs 1200x730, 390x844,
  Safari-like 390x650, 360x640 and 844x390; tools/mobilefit.mjs runs nine, and
  neither list is a superset. A defect can live in the gap, and one does: Sunna swept nine widths
  by hand and found a covered map node at 412x915 — a shape THIS TOOL DOES NOT
  TEST — that dev does not have. Closing the gap is a card, not a silent edit,
  because adding that shape turns this red on a finding she carried without
  blocking.`);

  console.log(`\n  ${fails.length ? `FAIL — ${fails.length}` : `screenreach: OK — ${shapesRun * SCREENS.length} checks passed`}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); await dropBrowser(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`screenreach: ${e.message}`); process.exit(2); });
