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
//   node tools/screenreach.mjs --dist             dist/AshenSpire.html (file://; http if pack-shaped — browser.mjs buildPageUrl)
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
import { buildPageUrl, launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
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
  const { doorSelftest, resolveShard, selectShard } = await import('./doorplant.mjs');
  const corpus = {
    tool: 'screenreach.mjs',
    args: ['--only', '390x650'],
    timeoutMs: 600000,
    // Variant hit-test carriers require the authored figures in the copy.
    extraCopy: ['assets-display'],
    plants: [
      {
        // #28 moved the bar BELOW the map, so re-floating it is not one
        // property any more: `position: fixed` over the map's own bottom band
        // is the same geometry the pre-#28 tree shipped — a floating stack
        // answering the hit-test in a node's place.
        name: 'the zoom stack floats over the map canvas again (the #21-shaped covered node)',
        file: 'styles/map.css',
        // Cover the top half and explicitly restore hit interception. The old
        // 14vh plant only reported the unrelated Quick Access overlap; after
        // fixing that overlap it caught nothing. Keep this mutation focused
        // on the zoom strip intercepting otherwise reachable map controls.
        append: '.map-zoom { position: fixed !important; left: 0 !important; right: 0 !important; top: 0 !important; bottom: auto !important; height: 50vh !important; pointer-events: auto !important; z-index: 9999 !important; }',
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
        find: '<div class="cp-body">',
        replace: '<div>',
        all: true,
        expectRed: /Shrine choice cards missing their shared \.cp-body composition/,
      },
      {
        name: 'controls inside collapsed disclosures are counted as visible targets',
        file: 'tools/screenreach.mjs',
        find: "\n      && !e.closest('details:not([open]), [inert]')",
        replace: '',
        expectRed: /\b[1-9]\d* COVERED\b|UNREACHABLE/,
      },
      {
        // The closed reveal is now zero-height, so dropping only `inert`
        // leaves no covered control to find. Restore the actual bad geometry
        // too: an interactive closed tray floating across the map canvas.
        name: 'the closed map tray stays tall and interactive over the board',
        edits: [
          { file: 'src/ui/screens/map.js', find: 'trayReveal.inert = true;', replace: 'trayReveal.inert = false;', all: true },
          { file: 'styles/map.css', append: '.map-tray[data-open="false"] { position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; height: 50vh !important; pointer-events: auto !important; z-index: 9999 !important; } .map-tray[data-open="false"] > .map-tray-reveal { height: 50vh !important; pointer-events: auto !important; }' },
        ],
        expectRed: /^\s*map\s.*[1-9]\d* COVERED/m,
      },
      {
        name: 'an extra card text button returns beside Information',
        file: 'src/ui/components/cardInspection.js',
        find: 'card.append(info);',
        replace: 'card.append(info, Object.assign(document.createElement("button"), { className: "card-more-button", textContent: "›" }));',
        expectRed: /extra card text control returned/,
      },
      {
        name: 'enemy intent cannot be pressed anywhere in its badge',
        file: 'styles/combat.css',
        append: '.combatant-leading .intent { pointer-events: none !important; }',
        expectRed: /390x650 combat: [1-9]\d* covered control\(s\) — .*\.intent/,
      },
      {
        name: 'whole fighter frames once again trap intent badges under neighbouring sprites',
        file: 'src/ui/components/battlefieldStage.js',
        find: "      frame.style.zIndex = '';",
        replace: '      frame.style.zIndex = String(slot.layer + (growth > 1 ? wireframeUi.formation.focusPriority : 0));',
        expectRed: /390x650 combat-overlap: [1-9]\d* covered control\(s\) — .*\.intent\s+<-\s+[^;\r\n]*(?:\.enemy-pose-stage|\.alternative-silhouette \[authored-neighbour\])/,
      },
      {
        name: 'a silhouette loses its frame-level tap area',
        file: 'styles/combat.css',
        append: '.enemy-target-hitbox::after { pointer-events: none !important; }',
        expectRed: /390x650 combat-xl: [1-9]\d* covered control\(s\) — .*\.combatant/,
      },
      {
        name: 'a player loses its exposed artwork or frame-level tap area',
        file: 'styles/combat.css',
        append: '.player-target-hitbox::after, .combat[data-waist-overlap="true"] .player .sprite, .combat[data-waist-overlap="true"] .player .sprite * { pointer-events: none !important; }',
        expectRed: /390x650 combat-overlap: [1-9]\d* covered control\(s\) — .*\.combatant/,
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
        find: ' ? ` data-action="1" aria-label="${esc(r.label)}" aria-describedby="set-${r.key}-status"` : \'\'}',
        replace: ' ? ` data-action="1" aria-describedby="set-${r.key}-status"` : \'\'}',
        expectRed: /fullscreen switch lacks an accessible name or description/,
      },
      {
        name: 'the fullscreen lifecycle listener calls a synchronizer outside its scope',
        file: 'src/ui/screens/settings.js',
        find: 'const onFullscreenChange = () => syncFullscreen();',
        replace: 'const onFullscreenChange = () => missingFullscreenSynchronizer();',
        expectRed: /fullscreen lifecycle event threw/,
      },
      {
        name: 'the preserved R shortcut returns to the removed Relics tab',
        file: 'src/ui/screens/map.js',
        // #498: the shortcut handler gained an action argument
        // (onArmoury(armouryAction)) and the plant died patching the bare call.
        find: "if (onArmoury) onArmoury(armouryAction);",
        replace: "if (onMenu) onMenu('relics');",
        expectRed: /equipment shortcut did not open Armoury/,
      },
    ],
  };
  const shard = resolveShard();
  const ran = selectShard(corpus.plants, shard).length;
  const selftestCode = await doorSelftest({ ...corpus, shard });
  if (selftestCode === 0 && shard) console.log(`screenreach-selftest: shard ${shard.index}/${shard.count} of a ${corpus.plants.length}-plant corpus`);
  if (selftestCode === 0) console.log(`screenreach-selftest: OK — ${ran} plants, ${ran} caught`);
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
  const lifecycleErrors = [];
  const recordLifecycleError = (event) => lifecycleErrors.push(event.message || String(event.error || 'unknown error'));
  window.addEventListener('error', recordLifecycleError);
  const pause = () => new Promise((resolve) => setTimeout(resolve, 80));
  document.querySelector('#open-menu')?.click(); await pause();
  if (document.querySelector('.qn-panel')) {
    document.querySelector('.qn-row[data-act="tab"][data-tab="settings"]')?.click();
    await pause();
  }
  const tab = (id) => document.querySelector('.ov-tab[data-member="' + id + '"]');
  tab('controls')?.click(); await pause();
  const baseline = Object.fromEntries([...live].map(([type, listeners]) => [type, listeners.size]));
  tab('settings')?.click();
  await pause();
  const fullscreen = document.querySelector('.toggle[data-key="fullscreen"]');
  const described = fullscreen?.getAttribute('aria-describedby');
  window.__fullscreenA11y = !!(fullscreen?.getAttribute('aria-label')
    && described && document.getElementById(described));
  document.dispatchEvent(new Event('fullscreenchange'));
  document.dispatchEvent(new Event('fullscreenerror'));
  await pause();
  window.__fullscreenLifecycleErrors = lifecycleErrors;
  window.removeEventListener('error', recordLifecycleError);
  tab('controls')?.click(); await pause();
  tab('settings')?.click(); await pause();
  tab('controls')?.click(); await pause();
  window.__settingsListenerBalance = Object.fromEntries([...live]
    .map(([type, listeners]) => [type, listeners.size - (baseline[type] || 0)]));
  document.querySelector('#ov-close')?.click(); await pause();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true })); await pause();
  window.__armouryShortcutOpened = !!document.querySelector('.armoury-overlay');
  return true;
})()`;

// Keep the overlap regression independent of sprite proportions and formation
// spacing: place the intent over a real neighbouring sprite. The
// normal overhead layer must remain hittable; the frame-stacking plant below
// must hide it. Both the clean and planted runs use this same fixture.
const INTENT_OVERLAP = `(async () => {
  if (innerWidth !== 390 || innerHeight !== 650) return true;
  // Missing art uses a wider fallback figure in copied trees. Pin the small
  // player case below 24px when the visible plate supplies its tap area.
  // Waist-overlap players use exposed artwork and retain their authored size.
  const player = document.querySelector('.combatant.player .combatant-card > .sprite');
  const playerBefore = player?.getBoundingClientRect();
  if (!playerBefore || !Number.isFinite(playerBefore.width) || playerBefore.width <= 0)
    throw new Error('screenreach: small-player fixture is missing its sprite');
  const playerPlate = getComputedStyle(player.closest('.combatant'), '::after').display !== 'none';
  let playerAfter = playerBefore;
  if (playerPlate) {
    player.style.transformOrigin = 'center bottom';
    player.style.scale = String(Math.min(1, 16 / playerBefore.width));
    // Artwork may overhang its host. Keep this deliberately small fixture's
    // actual hit surface inside the measured 16px host.
    player.style.overflow = 'clip';
    playerAfter = player.getBoundingClientRect();
    if (playerAfter.width >= 24 || Math.abs(playerAfter.bottom - playerBefore.bottom) > 1
        || Math.abs(playerAfter.left + playerAfter.width / 2 - playerBefore.left - playerBefore.width / 2) > 1)
      throw new Error('screenreach: small-player fixture changed its foot anchor or is not small');
  }
  const frames = [...document.querySelectorAll('.combatant.enemy')];
  const depth = frame => Number(getComputedStyle(frame.querySelector('.combatant-card > .sprite')).zIndex);
  const low = frames.reduce((a, b) => depth(a) < depth(b) ? a : b);
  const high = frames.find(frame => depth(frame) > depth(low));
  const intent = low?.querySelector('.intent');
  const sprite = high?.querySelector('.combatant-card > .sprite');
  if (!intent || !sprite) throw new Error('screenreach: intent overlap fixture is missing its two enemies');
  const a = intent.getBoundingClientRect(), initial = sprite.getBoundingClientRect();
  const intentScale = a.width / intent.offsetWidth, spriteScale = initial.width / sprite.offsetWidth;
  // Authored formations can make this neighbour narrower than an XL badge.
  // Grow only the fixture's artwork, retaining its normal stacking context.
  sprite.style.transformOrigin = 'center bottom';
  sprite.style.scale = String(Math.max(1, (a.width + 16) / initial.width, (a.height + 64) / initial.height));
  const grown = sprite.getBoundingClientRect();
  const field = sprite.closest('.field'), fieldBox = field.getBoundingClientRect(), zoom = fieldBox.width / field.clientWidth;
  // A grid-cell centre can otherwise hit the player's name or artwork and
  // bypass the foot-patch check. Move the whole stack into a separate side
  // patch and reanchor the existing target; its size and stacking stay real.
  const playerFrame = player.closest('.combatant'), playerStack = player.closest('.combatant-stack');
  const playerFrameBox = playerFrame.getBoundingClientRect(), stackBox = playerStack.getBoundingClientRect();
  const centreX = playerFrameBox.left + playerFrameBox.width / 2, centreY = playerFrameBox.top + playerFrameBox.height / 2;
  // This fixture moves only sideways; keep the production target's fitted
  // vertical anchor, which may already be clamped above the hand.
  if (playerPlate) {
    const playerHitY = playerFrameBox.top + parseFloat(getComputedStyle(playerFrame, '::after').top) * zoom;
    const sideX = Math.max(fieldBox.left + fieldBox.width * 0.28, centreX + stackBox.width / 2 + 20);
    playerStack.style.translate = ((sideX - playerAfter.left - playerAfter.width / 2) / zoom) + 'px 0';
    const playerMoved = player.getBoundingClientRect(), playerMovedFrameBox = playerFrame.getBoundingClientRect();
    playerFrame.style.setProperty('--enemy-hit-x', ((playerMoved.left + playerMoved.width / 2 - playerMovedFrameBox.left) / zoom) + 'px');
    playerFrame.style.setProperty('--enemy-hit-y', ((playerHitY - playerMovedFrameBox.top) / zoom) + 'px');
    if (playerMoved.width >= 24 || Math.abs(playerMoved.bottom - playerAfter.bottom) > 1
        || playerMoved.left < fieldBox.left + 22 || playerMoved.right > fieldBox.right - 22)
      throw new Error('screenreach: moved small-player fixture has an invalid size or foot anchor');
  }
  // Stage the pair in the clear centre so neither existing fighter's target
  // becomes an accidental second obstruction in this controlled scene.
  sprite.style.translate = ((fieldBox.left + fieldBox.width / 2 - grown.left - grown.width / 2) / spriteScale) + 'px '
    + ((fieldBox.top + fieldBox.height / 2 - grown.top - grown.height / 2) / spriteScale) + 'px';
  const b = sprite.getBoundingClientRect(), frameBox = high.getBoundingClientRect();
  high.style.setProperty('--enemy-hit-x', ((b.left + b.width / 2 - frameBox.left) / zoom) + 'px');
  high.style.setProperty('--enemy-hit-y', ((b.bottom - frameBox.top) / zoom) + 'px');
  intent.style.translate = ((b.left + b.width / 2 - a.left - a.width / 2) / intentScale) + 'px '
    + ((b.top + 8 - a.top) / intentScale) + 'px';
  const moved = intent.getBoundingClientRect();
  if (b.left > moved.left || b.right < moved.right || b.top > moved.top || b.bottom < moved.bottom)
    throw new Error('screenreach: neighbouring sprite does not cover the intent fixture');
  const centreHit = document.elementFromPoint(centreX, centreY);
  if (playerPlate && centreHit && playerFrame.contains(centreHit))
    throw new Error('screenreach: small-player frame centre still hits its own stack: ' + centreHit.className);
  // Moving artwork above also moves fitted foot anchors. Let the production
  // stage fit the changed geometry before probing it; an immediate snapshot
  // otherwise judges the fixture's stale, manually overridden plate positions.
  document.querySelector('.combat').dispatchEvent(new Event('combatantselectionchange', { bubbles: true }));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const refittedPlayer = player.getBoundingClientRect();
  const refittedSprite = sprite.getBoundingClientRect(), refittedIntent = intent.getBoundingClientRect();
  if (playerPlate && refittedPlayer.width >= 24)
    throw new Error('screenreach: refit erased the small-player fixture');
  if (refittedSprite.left > refittedIntent.left || refittedSprite.right < refittedIntent.right
      || refittedSprite.top > refittedIntent.top || refittedSprite.bottom < refittedIntent.bottom)
    throw new Error('screenreach: refit erased the neighbouring intent cover');
  const refittedCentreHit = document.elementFromPoint(centreX, centreY);
  if (playerPlate && refittedCentreHit && playerFrame.contains(refittedCentreHit))
    throw new Error('screenreach: refit erased the separate player foot patch');
  return true;
})()`;

// Every screen that can be reached without playing the game. `boss` holds a
// splash deliberately covering the board, so its controls ARE covered by
// design and it is listed with `overlay: true` rather than left out — a screen
// missing from a sweep is invisible, and a screen present with a reason is not.
const SCREENS = [
  { name: 'startup', q: '?shot=startup', ready: `!!document.querySelector('.startup-gate')` },
  { name: 'title', q: '?shot=title', ready: `!!document.querySelector('#app button')` },
  { name: 'map', q: '?shot=map', ready: `!!document.querySelector('.map-node')` },
  { name: 'menu-cycle', q: '?shot=map', ready: `!!document.querySelector('.map-node')`, setup: SETTINGS_CYCLE,
    overlay: 'the Armoury opened by the preserved equipment shortcut covers the map on purpose' },
  { name: 'combat', q: '?shot=combat', ready: `!!document.querySelector('.combat .hand .card')` },
  { name: 'combat-xl', q: '?shot=combat&shotArcane=matrix&shotSettings=%7B%22textSize%22%3A%22xl%22%2C%22uprightGate%22%3Afalse%7D', ready: `!!document.querySelectorAll('.enemy-row .intent').length` },
  { name: 'combat-overlap', q: '?shot=combat&shotArcane=matrix&shotSettings=%7B%22textSize%22%3A%22xl%22%2C%22uprightGate%22%3Afalse%7D', ready: `!!document.querySelectorAll('.enemy-row .intent').length`, setup: INTENT_OVERLAP },
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
  // THE SMITH is a modal over the Shrine, and until 2026-09-11 it had no state
  // of its own — the review that photographed every room got the title screen
  // for `?shot=smith`. Its controls (the candidates, Back, Upgrade) are as
  // reachable-or-not as any room's.
  { name: 'smith', q: '?shot=smith', ready: `!!document.querySelector('.smith-candidate-region')`,
    overlay: 'the Smith is a modal over the Shrine; the Shrine\'s band and cards under its veil are covered on purpose' },
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
    return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden'
      && !e.closest('details:not([open]), [inert]');
  });
  const exposedPatch = (target, size, bounds = target?.getBoundingClientRect(), accepts = top => top === target || target.contains(top)) => {
    if (!target) return false;
    const half = size / 2;
    const owns = (px, py) => {
      const top = document.elementFromPoint(px, py);
      return top && accepts(top);
    };
    for (let py = Math.max(half, bounds.top + half); py <= Math.min(innerHeight - half, bounds.bottom - half); py += 8) {
      for (let px = Math.max(half, bounds.left + half); px <= Math.min(innerWidth - half, bounds.right - half); px += 8) {
        if ([[0,0],[-half,-half],[half,-half],[-half,half],[half,half]].every(([dx,dy]) => owns(px + dx, py + dy))) return true;
      }
    }
    return false;
  };
  for (const c of all) {
    const r = c.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = (x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight) ? document.elementFromPoint(x, y) : null;
    if (hit && (hit === c || c.contains(hit))) continue;
    // Formation frames span a grid cell. Measure the actual 44 px frame tap
    // target: final fitting can pack it away from an overlapping sprite foot.
    // The frame centre may still sit beneath another fighter.
    if (c.matches('.combatant[data-ui-component="combatant-frame"]')) {
      const sprite = c.querySelector('.combatant-card > .sprite');
      const sr = sprite?.getBoundingClientRect();
      const targetStyle = getComputedStyle(c, '::after');
      const tx = r.left + parseFloat(targetStyle.left) * z, ty = r.top + parseFloat(targetStyle.top) * z;
      const halfWidth = parseFloat(targetStyle.width) * z / 2, halfHeight = parseFloat(targetStyle.height) * z / 2;
      // Waist-overlap players expose their artwork; their plate is hidden.
      const hasPlate = targetStyle.display !== 'none' && targetStyle.content !== 'none';
      const reach = hasPlate && c.matches('.enemy-target-hitbox,.player-target-hitbox') && sr
        ? exposedPatch(c, 24, { left: tx - halfWidth, right: tx + halfWidth,
            top: ty - halfHeight, bottom: ty + halfHeight },
          top => top === c || top === sprite || sprite.contains(top))
        : exposedPatch(sprite, 24);
      if (reach) continue;
    }
    // A tall neighbouring enemy can paint across an intent badge's centre on
    // short phones. It is still usable if a finger-sized patch of that button
    // wins the hit test. A wholly blocked badge remains a failure.
    if (c.matches('.combatant-leading .overhead-control') && exposedPatch(c, 24)) continue;
    // A fan intentionally covers card centers. Require an exposed 24px square
    // on the actual card, and only permit another hand card to cover its center.
    if (c.matches('.hand .card') && hit?.closest('.hand .card')) {
      const owns = (px, py) => {
        const top = document.elementFromPoint(px, py);
        return top && (top === c || c.contains(top));
      };
      let reachable = false;
      for (let py = Math.max(12, r.top + 12); py <= Math.min(innerHeight - 12, r.bottom - 12) && !reachable; py += 8) {
        for (let px = Math.max(12, r.left + 12); px <= Math.min(innerWidth - 12, r.right - 12); px += 8) {
          if ([[0,0],[-12,-12],[12,-12],[-12,12],[12,12]].every(([dx,dy]) => owns(px + dx, py + dy))) { reachable = true; break; }
        }
      }
      if (reachable) continue;
    }
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
    // Identify an authored neighbouring figure without treating an arbitrary
    // image, a failed-art placeholder, or this intent's own enemy as that defect.
    const intentOwner = c.matches('.intent') ? c.closest('.combatant.enemy') : null;
    const silhouette = hit?.closest('.alternative-silhouette');
    const actor = silhouette?.closest('[data-alternative-sprite]');
    const blockerOwner = actor?.closest('.combatant.enemy');
    const authoredNeighbour = intentOwner && blockerOwner && intentOwner !== blockerOwner
      && hit.tagName === 'IMG' && hit.complete && hit.naturalWidth > 0 && hit.naturalHeight > 0;
    covered.push(name(c) + '  <-  ' + name(hit)
      + (authoredNeighbour ? ' via .alternative-silhouette [authored-neighbour]' : ''));
  }
  const visual = [];
  // The shared class-pick narrow composition expects one cp-body text
  // column beside its glyph. Shrine cards used the component class without the
  // component body, so every direct child became a new flex column: no literal
  // viewport overflow, but the flask name, stepper and Level-up buttons were
  // squeezed into unusable ribbons. Assert the component boundary, not a magic
  // width that happens to fit today's copy.
  if (document.querySelector('#flask-reallocate')) {
    // Descendant, not child: since W1s the option list stands in the choice
    // body's first slot, not directly under the screen.
    const bare = [...document.querySelectorAll('.screen .class-row > .class-pick')]
      .filter((card) => !card.matches('details.shrine-fold')
        && !card.querySelector(':scope > .cp-body'));
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
    // Information is the owner's one card-details control. Detect the removed
    // extra button through the rendered page, including a reintroduced box.
    if (document.querySelector('.card-more-button'))
      visual.push('extra card text control returned; use Information');
  }
  if (window.__settingsListenerBalance) {
    const leaks = Object.entries(window.__settingsListenerBalance).filter(([, count]) => count !== 0);
    if (leaks.length) visual.push('Settings revisit leaked listeners: ' + leaks.map(([type, count]) => type + '=' + count).join(', '));
    if (!window.__fullscreenA11y) visual.push('fullscreen switch lacks an accessible name or description');
    if (window.__fullscreenLifecycleErrors?.length) visual.push('fullscreen lifecycle event threw: ' + window.__fullscreenLifecycleErrors[0]);
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
    base = await buildPageUrl(f);
  } else {
    const s = await serve({ root: ROOT, port: 8264, open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`screenreach — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'screenreach-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling', '--disable-background-networking', '--disable-component-update'],
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
      if (r.covered.length && !sc.overlay) fails.push(`${shape} ${sc.name}: ${r.covered.length} covered control(s) — ${r.covered.join('; ')}`);
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
    await Promise.race([cdp.send('Browser.close').catch(() => {}), new Promise(done => setTimeout(done, 1200))]); cdp.close(); await dropBrowser(); if (server) server.close();
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
  await Promise.race([cdp.send('Browser.close').catch(() => {}), new Promise(done => setTimeout(done, 1200))]); cdp.close(); await dropBrowser(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`screenreach: ${e.message}`); process.exit(2); });
