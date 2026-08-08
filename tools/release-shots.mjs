#!/usr/bin/env node
// tools/release-shots.mjs — photograph the RELEASE BUILD, screen by screen,
// at the two shapes Constantine looks at (Bjorn, 2026-08-07, Track C).
//
// WHY THIS EXISTS AND WHY IT IS NOT tools/screenshot.mjs. That tool serves the
// SOURCE TREE and captures the ?shot= states that existed when it was written.
// Two gaps make it the wrong instrument for a release:
//   1. It photographs src/, not dist/AshenSpire.html. What Constantine runs is
//      the single-file bundle; a shot of the source tree is evidence about a
//      thing he never opens.
//   2. Five player-facing surfaces have NO ?shot= state and therefore cannot
//      appear in it at all — the Armoury, the menu tabs, Settings,
//      Settings → Profile, and the profile crisis notice (#66/#67, the newest
//      surface in the release). A capture set that silently omits the newest
//      screens is a green that means nothing.
// So this drives the built artifact over CDP: ?shot= where one exists, real
// clicks where one does not, and a seeded localStorage for the crisis notice —
// which is exactly the precondition a player with unreadable bytes has.
//
// THE ARTIFACT IS NEVER MODIFIED. The crisis states are reached by writing
// storage from outside and reloading, never by injecting script into the HTML.
// A shot of a patched bundle is a shot of something we do not ship.
//
// Usage:  node tools/release-shots.mjs [--out DIR] [--only SHOT] [--shape TAG]
// Exit 0 = every shot captured and its screen asserted present; 1 = any miss.
//
// BOUNDARY: this proves a screen RENDERED and that its landmark element is on
// it. It does not prove the screen is legible (Sunna), correct (Vira), or that
// the art reads (Freja). Two viewports only — 390x844 and 1200x730.
//
// TWO DENOMINATORS (Bjorn, 2026-08-07, Marina's ruling). Coverage used to be
// counted against ONE list — the ?shot= states in src/main.js — which is the
// set of TOP-LEVEL screens. A player also navigates INSIDE a state: six overlay
// tabs, six settings categories, three armoury views. None of those has a
// ?shot= state, so the old gate printed `0 unaccounted` while fifteen surfaces
// went unphotographed. It proved the two lists agreed and was silent on whether
// the surviving list was every surface — a check that could not fail.
// So: denominator 1 = top-level states (unchanged), denominator 2 = navigable
// sub-surfaces, DERIVED from the homes that actually define them. Both print,
// each with what was and was not photographed.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
// DENOMINATOR 2's three homes, imported rather than parsed: the tool reads the
// APP'S OWN VALUES, so there is no second list and no regex to rot. See
// SUB_SURFACE_GROUPS below for why there are three of them and not one.
import { menuTabs } from '../src/ui/uiContent.js';
// #88 dissolved SETTINGS_CATEGORIES: a category now EXISTS because a row is
// filed under it, and `settingsCategories()` is the derived union — "every
// category that exists, in the order it is drawn. Derived, one home."
// NOT `CATEGORY_ORDER`, which is the surviving authored half: Viki measured
// that emptying it leaves all six categories rendering, so an order is not a
// denominator. This tool wants what the screen draws.
import { settingsCategories } from '../src/ui/screens/settings.js';
import { balance } from '../src/content/balance.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// WHAT TREE DID THIS SEE? Naming the file is not naming its freshness — this
// tool measured a two-merge-stale bundle and printed OK once already. One home:
// tools/artifact-provenance.mjs. Facts only; it never fails a run.
import { printArtifactProvenance } from './artifact-provenance.mjs';
printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = resolve(ROOT, oi >= 0 && args[oi + 1] ? args[oi + 1] : 'docs/release-shots');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
// --only takes a SHOT name. I reached for it with a SHAPE tag and got a green
// zero-shot run, so the flag I wanted exists now rather than as a comment.
const onlyShape = args.includes('--shape') ? args[args.indexOf('--shape') + 1] : null;

const SHAPES = [
  { tag: '390x844', width: 390, height: 844, dsf: 2, mobile: true },
  { tag: '1200x730', width: 1200, height: 730, dsf: 1, mobile: false },
];

// D2 (Vira): coverage was HAND-LISTED and had already drifted from the app by
// five — eleven ?shot= states exist in src/, this file covered six, and the
// five co-op states were silently absent. That is precisely the failure this
// harness exists to correct in screenshot.mjs, reproduced by me in the tool
// that was supposed to be the fix. So the list is now DERIVED: the app's own
// states are read out of src/main.js, and any state with neither a shot entry
// nor an explicit exclusion below is a hard failure. A silent gap cannot
// recur; an intentional gap must be typed out and justified in one line.
const EXCLUDED_STATES = {
  // Co-op is a LAN mode whose shots need a canned server snapshot through a
  // stub socket (main.js coopStubMount, tools/coop-shoot.mjs is its own
  // instrument). Whether co-op ships in 0.4.x is Marina's call; until it is
  // in the release set, these are excluded BY NAME rather than missing.
  coop: 'LAN co-op — photographed by tools/coop-shoot.mjs; not in the 0.4.x solo delivery set',
  coopmap: 'LAN co-op — see coop',
  coopreward: 'LAN co-op — see coop',
  coopshrine: 'LAN co-op — see coop',
  coopcatchup: 'LAN co-op — see coop',
};

/** The states the APP actually has, read from src/main.js — never retyped. */
function appShotStates() {
  const src = readFileSync(resolve(ROOT, 'src', 'main.js'), 'utf8');
  return [...new Set([...src.matchAll(/shotState === '([a-z]+)'/g)].map((m) => m[1]))].sort();
}

// Each screen: how to reach it on the BUILT artifact, and the landmark that
// proves it actually rendered. A shot with no landmark assertion is a picture
// of whatever happened to be on screen — including a blank page.
// `state:` ties an entry to the app state it covers (the derivation above).
const SCREENS = [
  { name: 'title', query: '', landmark: '.title-screen' },
  { name: 'map', query: '?shot=map', landmark: '.mapscreen', state: 'map' },
  { name: 'map-atmospheric', query: '?shot=map&shotSettings=' + encodeURIComponent('{"highContrast":false}'), landmark: '.mapscreen' },
  { name: 'combat', query: '?shot=combat', landmark: '.combat', state: 'combat' },
  { name: 'combat-procs', query: '?shot=fx', landmark: '.combat', state: 'fx', poseWait: 1900 },
  { name: 'boss', query: '?shot=boss', landmark: '.combat', state: 'boss' },
  { name: 'death', query: '?shot=death', landmark: '.stats-table', state: 'death' },
  { name: 'customize', query: '?shot=customize', landmark: '.customize', state: 'customize' },
  // The Shrine — #84, and it is here rather than in EXCLUDED_STATES on purpose.
  // Excluding it by name would have been one line and would have put back the
  // exact condition the bug lived in: this is the screen Constantine could not
  // scroll, and nothing we own had ever opened it. A state added so a fix could
  // be photographed, then excluded from the photographs, is a state that earns
  // nothing.
  { name: 'shrine', query: '?shot=rest', landmark: '#smith-opt', state: 'rest' },
  // The event screen. Rune added `?shot=event` in the tap-size work (#104) and
  // did not register it here, so THIS TOOL REFUSED TO RUN at `52e0bc1` —
  // "1 app shot state neither photographed nor excluded: event" — and
  // Constantine's shots that night came from screenshot.mjs instead. The refusal
  // was correct and it is the whole point of the derivation above: a state the
  // app has and this list does not is a silent gap, and the tool would rather
  // stop than photograph around one.
  //
  // A SCREENS entry and NOT an EXCLUDED_STATES line, for the reason written
  // eight lines above about the Shrine: the state exists BECAUSE the fix needed
  // a picture instead of an assertion (main.js — "a state so anyone can see
  // them", and 24 of 24 choice bars sat under the tap floor with nothing ever
  // regressing against it). Excluding it by name would be one line and would put
  // back the exact condition the defect lived in.
  //
  // `.ev-choice` and not `.event-art`: the landmark has to prove the thing the
  // state was added FOR actually rendered. The art is a glyph that draws whether
  // or not the choice bars exist; the bars are the subject. main.js boots this
  // state on `graveOfTheNameless` — three choices, the last one "Leave" — so the
  // photograph shows the adjacency the fix is about.
  { name: 'event', query: '?shot=event', landmark: '.ev-choice', state: 'event' },
  {
    // AND THE GRID OPEN, driven, because the closed Shrine FITS. A baseline of
    // the screen in the state that never overflowed could not have caught the
    // defect it was created for — it would have gone green through the whole
    // bug. The overflow only exists once the Smith grid is on screen.
    //
    // `#smith-grid .card`, and the first version of this line said
    // `.deck-strip .mini` — WHICH NOTHING ON THIS SCREEN EMITS. renderCard()
    // writes `card rarity-… cls-… type-…` and `opts.small` is a transform, not
    // a class; `.mini` is hand-built by gameover.js and shop.js and lives
    // nowhere near the Smith. Bjorn caught it on the first full run of my own
    // check, an hour after I wrote it.
    //
    // What that cost is the lesson and it belongs next to the line: I DID
    // measure byte-stability first — 3 runs x 2 shapes, six identical
    // captures — and every one of those captures was taken AFTER a wait loop
    // that had timed out on a selector that can never match. The pictures were
    // right and the confirmation was vacuous, so the stability was real and
    // proved nothing. A MISS still writes a photograph. Stability of a screen
    // whose landmark never resolved is Bjorn's animated-title finding pointed
    // the other way, and the instrument that catches it has to assert the
    // landmark RESOLVED before it is allowed to hash anything.
    name: 'shrine-smith', query: '?shot=rest', landmark: '#smith-grid .card',
    drive: `document.querySelector('#smith-opt').click()`,
  },
  // --- driven: no ?shot= state exists for any of these ---
  {
    name: 'armoury', query: '?shot=combat', landmark: '.armoury, .equip-screen, .equipment',
    drive: `document.querySelector('#combat-armoury').click()`,
  },
  {
    // The quicknav experiment defaults to 'off' (quicknav.js `let mode = 'off'`),
    // so #combat-menu opens the TABS OVERLAY directly (onMenu('deck') →
    // showOverlay, components/overlay.js `.overlay-tabs`). My first two
    // landmarks here were both wrong — `.menu-tabs` and then `.qn-panel`,
    // neither of which the shipped default path ever renders. Measured, not
    // guessed: this is the surface Law 3's bumpers ride.
    name: 'menu-tabs', query: '?shot=combat', landmark: '.overlay-tabs',
    drive: `document.querySelector('#combat-menu').click()`,
  },
  {
    name: 'settings', query: '', landmark: '.settings, .set-body',
    drive: `[...document.querySelectorAll('button')].find(b=>/settings/i.test(b.textContent)).click()`,
  },
  // (the hand-written `settings-profile` entry lived here and is DELETED: the
  //  settings categories are now generated from settingsCategories(), so Profile
  //  is `settings-Profile` below and no longer a name anyone types. Collapsing a
  //  duplicate that leaves nothing deletable is a patch, not a collapse.)
  // The crisis notice: seeded storage, never a patched bundle. Corrupt bytes
  // (truncated JSON) is the 'corrupt' state; a future schemaVersion is 'newer'.
  {
    name: 'crisis-corrupt', query: '', landmark: '.profile-notice',
    seed: `localStorage.clear(); localStorage.setItem('sote_meta_v1','{"schemaVersion":1,"progress":{"runs":2000},');`,
  },
  {
    name: 'crisis-newer', query: '', landmark: '.profile-notice',
    seed: `localStorage.clear(); localStorage.setItem('sote_meta_v1', JSON.stringify({schemaVersion: 999, progress:{runs:2000}}));`,
  },
];

// ---------------------------------------------------------------------------
// DENOMINATOR 2 — the navigable sub-surfaces, and THE FINDING.
//
// THERE IS NO SINGLE HOME THAT DEFINES THE TAB LIST. I looked for one and it
// does not exist. What exists is three homes in three different layers:
//
//   overlay tabs      src/ui/uiContent.js       MENU_TABS      (a UI content table)
//   settings sections src/ui/screens/settings.js settingsCategories() (derived from the rows)
//   armoury views     src/content/balance.js     balance.equipment.views (game data)
//
// Each of those IS a single home for its own set — the overlay strip and the
// quick-nav dropdown already derive from MENU_TABS, which is the shape we want.
// What has no home is the set OF SETS. So this tool cannot ask the tree "what
// tabbed surfaces exist"; it can only ask "what is in the three I was told
// about." A fourth surface added tomorrow in a fourth place is invisible here,
// and no amount of care in this file fixes that — the fix is upstream and is
// stated in the report and in the BOUNDARY block at the end of this run.
//
// What I did NOT do, deliberately: hand-list the tabs here. A list of tabs in
// the harness is a second home for the fact, which is the exact defect this
// tool exists to catch, wearing my own hat. Below, each group names its home
// and reads it; the ids are never retyped.
//
// `reach(id)` is a RECIPE FOR ANY MEMBER of the set, never a per-id table: it
// is written once per group and knows nothing about which ids exist. That is
// what makes the derivation load-bearing — add a row to MENU_TABS and it gets
// photographed and asserted on the next run with no edit here.
// ---------------------------------------------------------------------------
const q = (s) => JSON.stringify(s);

// ---------------------------------------------------------------------------
// B1 (Vira's, and she was right). My first version asserted three things about
// each armoury view — the `view-<id>` class, `[data-view=<id>].on`, and a
// non-empty body — and ALL THREE are printed from the id the harness handed in.
// She planted a fourth view, `kanban`, with no branch in equipment.js and no
// rule in ui.css: 58 shots, every assertion true, exit 0. I reproduced it in my
// own tree before touching this file. `kanban` renders HYBRID'S DOM (draw() is
// `if (view === 'grid') … else …`, so every unknown id lands in the else) under
// NEITHER view's CSS — a fourth alignment no rule in the tree authors. Six of my
// fifty-six shots were the thing I wrote the naked-assert guard against.
//
// Her property, taken as offered: THE MEMBERS OF A SET ARE DISTINCT, so no two
// ids may render the same panel. It consults the HANDLER instead of the id,
// which is what the other two groups have by accident and this one did not.
// Green today pairwise, red on kanban — measured, not reasoned.
//
// I add a second, INDEPENDENT detector for the armoury, because the two halves
// of what she measured live in two different homes: the DOM comes from
// equipment.js, the alignment from styles/ui.css. That second decider is GONE
// as of #88 — the stylesheet keys off characteristics written off the row — so
// the check that guarded it is gone too, and the note is kept to say why.
//
// What neither of these is: a check that the view is CORRECT. Two distinct,
// authored layouts can both be wrong. Consistency, not correctness — mine, said
// about my own fix.
// ---------------------------------------------------------------------------

// One home for the signature, interpolated into each group's probe: the
// normalised structure of a panel, with data-* stripped exactly as Vira's probe
// stripped it, so this measures the same quantity her finding is about. Text is
// included deliberately — hybrid and kanban are identical down to the character,
// and a signature that excluded text would still separate them for the wrong
// reason.
const SIG_FN = `((html) => {
  const s = String(html).replace(/\\sdata-[a-z-]+="[^"]*"/g, '');
  let h = 7;
  for (const ch of s) h = ((h * 31 + ch.charCodeAt(0)) >>> 0);
  return s.length + ':' + h.toString(16);
})`;

const SUB_SURFACE_GROUPS = [
  {
    group: 'overlay',
    what: 'in-run menu tabs',
    home: 'src/ui/uiContent.js — MENU_TABS, read through menuTabs()',
    ids: () => menuTabs({ hasSave: true }).map((t) => t.id),
    reach: (id) => ({
      query: '?shot=combat',
      landmark: '.overlay-body',
      drive: `(() => {
        const m = document.querySelector('#combat-menu');
        if (!m) return 'no #combat-menu on the combat screen';
        m.click();
        const b = document.querySelector('[data-surface="overlayTab"] [data-member=${q(id)}]');
        if (!b) return 'no tab button for ' + ${q(id)};
        b.click();
        return true;
      })()`,
      // The assertion that earns the shot. A tab that is SELECTED and renders an
      // EMPTY body is the failure this group exists to catch: MENU_TABS is the
      // home of the tab LIST, but overlay.js selectTab() is a hardcoded if-chain
      // over the same ids — a second, implicit home of "which ids render".
      assert: `(() => {
        const on = document.querySelector('[data-surface="overlayTab"] [data-member=${q(id)}].on');
        if (!on) return 'tab ' + ${q(id)} + ' never became the selected tab';
        const body = document.querySelector('.overlay-body');
        const len = body ? body.innerText.trim().length : 0;
        if (!len) return 'tab ' + ${q(id)} + ' is selected and its panel is EMPTY';
        return true;
      })()`,
      probe: `(() => {
        const b = document.querySelector('.overlay-body');
        return b ? ${SIG_FN}(b.innerHTML) : null;
      })()`,
    }),
  },
  {
    group: 'settings',
    what: 'settings categories',
    home: 'src/ui/screens/settings.js — settingsCategories(), derived from the filed rows',
    ids: () => settingsCategories().slice(),
    reach: (id) => ({
      query: '',
      landmark: '.set-body',
      // #90: the categories are a TAB STRIP now, not six headings down one
      // column, so the drive CLICKS instead of scrolling. This is the harness
      // following the surface, which is the point of driving a control rather
      // than photographing a coordinate — a scrollIntoView on a heading that no
      // longer exists would have failed LOUD, and did.
      drive: `(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => /settings/i.test(b.textContent));
        if (!btn) return 'no Settings button on the title screen';
        btn.click();
        const t = [...document.querySelectorAll('.set-tab')].find((e) => e.dataset.member === ${q(id)});
        if (!t) return 'no ' + ${q(id)} + ' tab in the settings screen';
        t.click();
        return true;
      })()`,
      // Same shape as the overlay's: settingsCategories() is the home of the
      // category LIST, and ROWS[].cat plus renderSettings()'s two special cases
      // decide what actually appears in the panel. A tab whose panel is empty
      // is a surface that exists in the list and renders nothing.
      assert: `(() => {
        const t = [...document.querySelectorAll('.set-tab')].find((e) => e.dataset.member === ${q(id)});
        if (!t) return 'category tab absent: ' + ${q(id)};
        if (!t.classList.contains('on')) return 'tab ' + ${q(id)} + ' did not select';
        if (t.getAttribute('aria-selected') !== 'true') return 'tab ' + ${q(id)} + ' is on but not aria-selected';
        const r = t.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return 'tab off-screen: ' + ${q(id)};
        const p = document.querySelector('.set-panel');
        if (!p) return 'no settings panel';
        if (!(p.innerText || '').trim().length) return 'category ' + ${q(id)} + ' selected its tab and its panel is EMPTY';
        return true;
      })()`,
      probe: `(() => {
        const p = document.querySelector('.set-panel');
        return p ? ${SIG_FN}(p.innerHTML) : null;
      })()`,
    }),
  },
  {
    group: 'armoury',
    what: 'armoury layout views',
    home: 'src/content/balance.js — balance.equipment.views',
    // The home holds a LIST OF NAMES; what a name is written as is the home's
    // business, not this tool's. Today it is a bare string; EldenSpire#78 makes
    // it `{ id, figure, slots }`, because two characteristics are the smallest
    // honest description of three layouts. Both are read here, and ANYTHING ELSE
    // STOPS THE RUN BY NAME — never `.filter(Boolean)`, which would drop the
    // unreadable row and quietly shrink the denominator. That is Law 0 clause 5
    // and it is the failure this whole file exists to make loud.
    ids: () => (balance.equipment.views || []).map((v, i) => {
      if (typeof v === 'string' && v) return v;
      if (v && typeof v === 'object' && typeof v.id === 'string' && v.id) return v.id;
      console.error(`\nrelease-shots: balance.equipment.views[${i}] is ${JSON.stringify(v)} —`);
      console.error('this tool reads a view name as a string or as a row with a string `id`.');
      console.error('Neither fits, so the armoury denominator cannot be derived and no number');
      console.error('printed below it would mean anything. Fix the row, or teach this reader.');
      return process.exit(1);
    }),
    // NO `authoredIn` ANY MORE, and its absence is the point. It asked the
    // stylesheet whether anyone had authored a `.view-<id>` rule, because the
    // stylesheet was a SECOND, SILENT DECIDER of the layout — `kanban` rendered
    // under no rule at all. #88 dissolved that home: `ui.css` now keys off
    // `[data-figure]`/`[data-slots]`, written by equipment.js straight off the
    // row, so there is no id-named rule left to be missing. The property it
    // held — a view the tree cannot draw must fail by name — is held better and
    // earlier by `viewLayout()` returning null and `assertSurfaces()` throwing
    // at boot. Deleting it is the answer to "did anything become deletable?";
    // keeping it would be a check guarding a home that no longer exists.
    reach: (id) => ({
      query: '?shot=combat',
      landmark: '.armoury',
      drive: `(() => {
        const a = document.querySelector('#combat-armoury');
        if (!a) return 'no #combat-armoury on the combat screen';
        a.click();
        const b = document.querySelector('[data-surface="armouryView"] [data-member=${q(id)}]');
        if (!b) return 'no view button for ' + ${q(id)};
        b.click();
        return true;
      })()`,
      // The `.armoury.view-<id>` class is gone (#88) and its absence is correct:
      // the screen is described by WHAT THE VIEW IS, not what it is called. The
      // host still carries `data-view`, but that is the id read back to itself
      // and is not evidence — the selected state and the painted body are.
      // (This note sits OUT here because the assert is a template literal: my
      // first attempt put it inside, where `//` is text and a `<` is a syntax
      // error. The tool told me immediately, which is the arrangement working.)
      assert: `(() => {
        const on = document.querySelector('[data-surface="armouryView"] [data-member=${q(id)}].on');
        if (!on) return 'view ' + ${q(id)} + ' is not the selected view';
        const body = document.querySelector('.armoury-body');
        if (!body || !body.innerText.trim().length) return 'view ' + ${q(id)} + ' renders an EMPTY armoury body';
        return true;
      })()`,
      // Every predicate above is the id read back to itself. THIS is the one
      // that asks the handler what it built.
      probe: `(() => {
        const b = document.querySelector('.armoury-body');
        return b ? ${SIG_FN}(b.innerHTML) : null;
      })()`,
    }),
  },
];

// The property, one sentence, checked per shape after the shots are taken:
// two members of a set that render the same panel are not two members.
const DISTINCT_PANELS = 'no two ids in a set render the same panel';

// Excluded sub-surfaces, keyed `group:id`, named exactly as the co-op states
// are (SPEC §8 clause 5: a release-gating instrument prints what it did NOT
// check). Empty today — every derived sub-surface is photographed.
const EXCLUDED_SUBSURFACES = {};

// Sub-surface SETS this tool knows exist and does NOT enumerate. This list is
// the honest edge of denominator 2 and is printed with the run: it is the part
// no derivation can close while the set-of-sets has no home.
const UNENUMERATED_SETS = [
  ['co-op seat tabs', 'src/ui/screens/coop.js renderSeatTabs() — one tab per connected player, built at runtime from the lobby; no static list exists and the whole co-op surface is excluded from the 0.4.x solo delivery set (see EXCLUDED_STATES)'],
];

// D2's gate: derived denominators vs what this file covers. Runs BEFORE the
// browser so a coverage gap costs no time and cannot be mistaken for a render
// failure.
{
  const app = appShotStates();
  const covered = new Set(SCREENS.map((s) => s.state).filter(Boolean));
  // -------------------------------------------------------------------------
  // DENOMINATOR 1 GETS THE FLOOR I WROTE FOR DENOMINATOR 2 AND NEVER GAVE IT.
  //
  // Vira withheld b7c8142 on this and blocked with my own reasons, which is the
  // right way to be caught. `appShotStates()` is a REGEX OVER src/main.js. She
  // reformatted 18 comparisons from `shotState === 'x'` to `shotState==='x'` —
  // pure whitespace, the game unaffected — and got:
  //
  //   0 states: 6 to photograph, 5 excluded by name, 0 unaccounted
  //   release-shots: OK — 2 shots …                                    exit=0
  //
  // A line that contradicts itself in place, and nothing failed. `gaps` cannot
  // save it: filtering an empty list gives an empty list, so the emptier the
  // reader gets the cleaner the report looks. The per-home floor for D2 is
  // eighteen lines below at `:407` and says exactly this — I wrote the sentence
  // once and gave it to one of the two denominators.
  //
  // TWO checks, because a floor only catches TOTAL blindness. Her plant killed
  // all 18 matches; an edit that kills three would slip under a floor and print
  // a smaller, confident number — the partial case is the one that survives.
  // -------------------------------------------------------------------------
  if (!app.length) {
    console.error(`\nrelease-shots: derived ZERO ?shot= states from src/main.js.`);
    console.error('An empty denominator is not full coverage — it is a home this tool can no longer');
    console.error('read. appShotStates() is a regex over source; if the source moved, the regex is');
    console.error('the thing to fix, not the number to trust.');
    server.close();
    process.exit(1);
  }
  // The JOIN, and it is the partial-blindness half: every state the SCREENS
  // table claims to cover must actually appear in what the reader derived. If
  // this tool says it photographs `map` and the derivation cannot see `map`,
  // one of the two is wrong and neither is allowed to be silent about it.
  const unseen = [...covered].filter((s) => !app.includes(s));
  if (unseen.length) {
    console.error(`\nrelease-shots: SCREENS claims to cover state(s) the reader cannot find in src/main.js: ${unseen.join(', ')}.`);
    console.error(`It derived ${app.length}: ${app.join(', ')}.`);
    console.error('Either the state was renamed and this table is stale, or appShotStates() has gone');
    console.error('partly blind. Both are defects; a smaller confident number is the worse one.');
    server.close();
    process.exit(1);
  }
  const gaps = app.filter((s) => !covered.has(s) && !EXCLUDED_STATES[s]);
  console.log(`DENOMINATOR 1 — top-level states · home: src/main.js (?shot= states)`);
  // "photographed" is a PAST TENSE about work that has not started — this block
  // prints before the browser launches. It cost me a false claim in the session
  // that added it: I reported a plant as photographing three views on a run that
  // photographed none, because I read this line as a result. The denominators are
  // DERIVED here; what was photographed is the verdict's to say, at the end.
  console.log(`  ${app.length} states: ${covered.size} to photograph, ${Object.keys(EXCLUDED_STATES).length} excluded by name, ${gaps.length} unaccounted`);
  for (const s of app) {
    if (covered.has(s)) continue;
    console.log(`  EXCLUDED  ?shot=${s} — ${EXCLUDED_STATES[s] || 'NO REASON GIVEN'}`);
  }
  if (gaps.length) {
    console.error(`\nrelease-shots: ${gaps.length} app shot state(s) neither photographed nor excluded: ${gaps.join(', ')}`);
    console.error('Add a SCREENS entry, or name it in EXCLUDED_STATES with the reason. A silent gap is the defect this tool exists to correct.');
    process.exit(1);
  }
}

// The artifact this run photographs, read ONCE and named, so the staleness
// check below and the reader both know which file the shots are of.
const idOfArtifact = 'dist/AshenSpire.html';
const ARTIFACT = readFileSync(resolve(ROOT, idOfArtifact), 'utf8');

// Denominator 2: derive, generate a shot per member, and REFUSE to report a
// percentage of nothing.
{
  console.log(`\nDENOMINATOR 2 — navigable sub-surfaces · NO SINGLE HOME DEFINES THESE (see the header)`);
  let total = 0, shot = 0, excluded = 0;
  for (const g of SUB_SURFACE_GROUPS) {
    const ids = g.ids();
    // THE REFERENT GUARD (SOP 2's ⚙, and the reason this is not a percentage).
    // An empty derivation and a fully-photographed set both print "0 missing".
    // A home that stops resolving must go RED, never quietly shrink the
    // denominator to zero and call the run complete.
    if (!Array.isArray(ids) || !ids.length) {
      console.error(`\nrelease-shots: sub-surface group '${g.group}' derived ZERO ids from ${g.home}.`);
      console.error('An empty denominator is not full coverage — it is a home this tool can no longer read. Fix the import or the home.');
      process.exit(1);
    }
    // Pre-browser: is every derived member authored in its OTHER home? For the
    // armoury that home is the stylesheet, and it is where `kanban` was absent.
    //
    // STALENESS. The denominators are derived from src/, and the photographs
    // are of dist/AshenSpire.html — a COMMITTED artifact. Nothing made those
    // the same build. I hit this on my own bench: a planted tab was still in
    // dist/ after I had reverted src/, so a run derived 6 members and
    // photographed a 7-tab bundle and printed OK. That is one fact with two
    // homes, in the instrument that exists to find them.
    // The dangerous direction is detectable and cheap: a member the source
    // declares must appear in the artifact we are about to photograph. (The
    // reverse — dist carrying something src no longer has — is verify-shipped's
    // job, and the BOUNDARY block says so rather than pretending otherwise.)
    for (const id of ids) {
      if (EXCLUDED_SUBSURFACES[`${g.group}:${id}`]) continue;
      if (!ARTIFACT.includes(JSON.stringify(id)) && !ARTIFACT.includes(`'${id}'`)) {
        console.error(`\nrelease-shots: '${g.group}:${id}' is declared in ${g.home}`);
        console.error(`but does not appear in ${idOfArtifact} — the bundle is OLDER than the source.`);
        console.error('Rebuild (node tools/launch.mjs --build-only) before photographing; a shot of a stale');
        console.error('artifact is evidence about a build nobody is shipping.');
        process.exit(1);
      }
    }
    const mine = [];
    for (const id of ids) {
      const key = `${g.group}:${id}`;
      total++;
      if (EXCLUDED_SUBSURFACES[key]) { excluded++; mine.push(`${id} (EXCLUDED)`); continue; }
      const r = g.reach(id);
      SCREENS.push({ name: `${g.group}-${id}`, sub: key, ...r });
      shot++;
      mine.push(id);
    }
    console.log(`  ${g.group.padEnd(9)} ${String(ids.length).padStart(2)} ${g.what} · home: ${g.home}`);
    console.log(`            to photograph: ${mine.join(', ')}`);
    for (const id of ids) {
      const why = EXCLUDED_SUBSURFACES[`${g.group}:${id}`];
      if (why) console.log(`  EXCLUDED  ${g.group}:${id} — ${why}`);
    }
  }
  console.log(`  ${total} sub-surfaces across ${SUB_SURFACE_GROUPS.length} homes: ${shot} derived to photograph, ${excluded} excluded by name`);
  for (const [name, why] of UNENUMERATED_SETS) {
    console.log(`  NOT ENUMERATED  ${name} — ${why}`);
  }
  // Every entry claiming a sub-surface must carry an assertion. A generated shot
  // with no assert is a picture of the same settings screen six times: coverage
  // that cannot fail, which is what this whole change is against.
  const naked = SCREENS.filter((s) => s.sub && !s.assert).map((s) => s.name);
  if (naked.length) {
    console.error(`\nrelease-shots: sub-surface shot(s) with no assert: ${naked.join(', ')} — a shot that cannot fail is not coverage.`);
    process.exit(1);
  }
  // And the same guard for the property. An assert can be satisfied by the id
  // it was handed (B1: all three of the armoury's were), so the panel probe is
  // the only per-group evidence that consults the handler. A group that ships
  // without one is back where the armoury was.
  const unprobed = SUB_SURFACE_GROUPS.filter((g) => !g.reach(g.ids()[0]).probe).map((g) => g.group);
  if (unprobed.length) {
    console.error(`\nrelease-shots: sub-surface group(s) with no panel probe: ${unprobed.join(', ')}`);
    console.error(`Without one, '${DISTINCT_PANELS}' cannot be checked and the group's assertions may all be`);
    console.error('derived from the id they were handed. That is what B1 was.');
    process.exit(1);
  }
}

mkdirSync(OUT, { recursive: true });
const { server, port } = await serve({ root: ROOT, port: 8231, open: false });
const BASE = `http://localhost:${port}/dist/AshenSpire.html`;

// ---------------------------------------------------------------------------
// THE BROWSER THIS RUN MEASURES MUST BE THE BROWSER THIS RUN SPAWNED.
//
// Marina's ruling on my own best find, pointed at the browser: EVIDENCE MUST
// COME FROM ONE ARTIFACT, NEVER TWO ASSUMED EQUAL. This tool used to spawn
// chromium on a FIXED port 9431 and then `fetch('127.0.0.1:9431/json/list')` and
// attach to whatever answered. Two failures, and they compound:
//
//   1. NOTHING EVER KILLED THE CHILD — no `child.kill()` on any path, success or
//      failure. Every run leaked a browser tree. Vira found 81 orphans this
//      afternoon; I reaped 152 on this port a few hours later.
//   2. A second run cannot bind 9431, so its own chromium dies — and `cdp(9431)`
//      then attaches to the PREVIOUS RUN'S BROWSER and drives that. The process
//      spawned and the process measured were two browsers with nothing checking
//      they were the same one. A run goes quiet instead of red, which is the
//      worst way for an instrument to fail.
//
// Fixed BY CONSTRUCTION rather than by a check: `--remote-debugging-port=0` gets
// a kernel-assigned port, and the endpoint is parsed off MY OWN CHILD'S stderr.
// There is no shared name left to collide on, so "is this my browser?" stops
// being a question the tool has to get right. `menufit` has done it this way all
// along (`tools/menufit.mjs:161`) — I had the answer in the tree and did not use
// it. This also ends a collision I did not own: `contrast-audit.mjs:545` picks
// `9222 + (pid % 400)` = 9222…9621, a range that CONTAINS 9431, so it would
// silently take this tool's browser about one run in four hundred.
// ---------------------------------------------------------------------------
const browser = spawn('/opt/pw-browsers/chromium', [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=0', 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

// One reaper, on every path out — normal exit, refusal, throw, Ctrl-C. A tool
// that leaks a browser per run is how the pile above gets built.
let reaped = false;
const reap = () => {
  if (reaped) return;
  reaped = true;
  try { browser.kill('SIGKILL'); } catch { /* already gone */ }
};
process.on('exit', reap);
// SIGHUP too (Vira's word): a closed terminal is the commonest way a long run
// ends, and it was the one signal that still leaked. SIGKILL cannot be caught
// and that browser survives — an honest limit, not an oversight.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { reap(); process.exit(130); });
process.on('uncaughtException', (err) => { reap(); console.error(err); process.exit(2); });

const BROWSER_WS = await new Promise((ok, no) => {
  let buf = '';
  const read = (d) => {
    buf += d;
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
    if (m) ok(m[1]);
  };
  browser.stderr.on('data', read);
  browser.stdout.on('data', read);
  browser.on('error', no);
  browser.on('exit', (code) => no(new Error(`chromium exited (${code}) before naming an endpoint:\n${buf.slice(-400)}`)));
  setTimeout(() => no(new Error(`chromium never printed a DevTools endpoint:\n${buf.slice(-400)}`)), 20000);
}).catch((err) => { reap(); console.error(`\nrelease-shots: ${err.message}`); process.exit(2); });

// The port is this child's and no one else's — derived from what it printed,
// never typed here.
const CDP_PORT = Number(new URL(BROWSER_WS.replace(/^ws:/, 'http:')).port);
// Both shared names this run could have collided on, printed. serve() bumps to
// the next free HTTP port, so two runs never share one; the CDP port is the
// kernel's. A reader who suspects a crossed run can check these against another
// run's line instead of taking my word for it.
console.log(`  this run: browser pid ${browser.pid} · CDP port ${CDP_PORT} · HTTP port ${port} — both its own`);

async function cdp(p) {
  let l;
  for (let i = 0; i < 100; i++) {
    try { l = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json(); if (l.length) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const ws = new WebSocket(l.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const w = new Map();
  ws.onmessage = (m) => {
    const g = JSON.parse(m.data);
    if (g.id != null && w.has(g.id)) { const { ok, no } = w.get(g.id); w.delete(g.id); g.error ? no(new Error(g.error.message)) : ok(g.result); }
  };
  return { send: (m2, p2 = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method: m2, params: p2 })); return new Promise((ok, no) => w.set(n, { ok, no })); } };
}

const c = await cdp(CDP_PORT);
await c.send('Page.enable');
await c.send('Runtime.enable');
// A screen that fails to mount because its boot THREW must say so. Without
// this a MISS reads as "slow" and gets waited on harder, which is how a real
// error hides behind a longer deadline.
const pageErrors = [];
c.onEvent = (m) => {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => {
  const r = await c.send('Runtime.evaluate', { expression: e, returnByValue: true });
  if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || 'eval error' };
  return r.result.value;
};

// D1 (Vira's, and the defect that matters): every wait used to be a fixed
// sleep, so the landmark was read at a WALL-CLOCK MOMENT rather than when the
// app mounted. One of two full runs went red on a healthy tree — and I
// reproduced it on the first try afterwards, on a different screen, with the
// same signature (a ~193-char body: the title screen still booting). A release
// gate that reds half the time trains everyone to re-run until green, and then
// a real red is indistinguishable from noise. So: poll for the landmark with a
// deadline. Returns as soon as it is there, which also makes the tool faster —
// the fixed sleeps were sized for the slowest screen and paid on every one.
// Page.navigate RESOLVES BEFORE THE LOAD COMMITS. Until it does, evaluate()
// runs against the PREVIOUS page — so a poll can read the old screen and
// answer about the wrong document entirely. That is the actual cause of the
// flake: the misses reported ~193 chars, which is the TITLE still on screen
// from the storage-clear navigation, not the shot state failing to mount.
// Polling harder could never fix it, and a longer deadline would have hidden
// it. So: assert we are on the URL we asked for, and that its document has
// begun, before asserting anything about its contents.
async function waitForUrl(expectQuery, { deadline = 10000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadline) {
    const at = await ev(`({ q: location.search, ready: document.readyState })`);
    if (at && !at.__err && at.q === expectQuery && at.ready !== 'loading') return Date.now() - t0;
    await sleep(50);
  }
  return null;
}

async function waitFor(selector, { deadline = 8000, quiet = 220 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadline) {
    const hit = await ev(`!!document.querySelector(${JSON.stringify(selector)})`);
    if (hit === true) {
      // One settle tick AFTER the landmark exists, so a screen that mounts and
      // then paints its children is photographed whole, not mid-mount.
      await sleep(quiet);
      return Date.now() - t0;
    }
    await sleep(60);
  }
  return null; // caller reports it as a MISS, with the deadline named
}

// Console errors are part of "rendered as meant": a screen that paints while
// throwing is not a green. Collected per shot, reported with it.
let consoleErrors = [];
await c.send('Log.enable').catch(() => {});
await c.send('Runtime.consoleAPICalled', {}).catch(() => {});

let misses = 0;
const rows = [];

for (const shape of SHAPES) {
  if (onlyShape && shape.tag !== onlyShape) continue;
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: shape.width, height: shape.height, deviceScaleFactor: shape.dsf, mobile: shape.mobile,
  });
  for (const s of SCREENS) {
    if (only && s.name !== only) continue;
    consoleErrors = [];
    // Clear storage before EVERY shot. Without this the crisis seed survives
    // into the next shot's boot and photographs the notice under another
    // screen's name — measured: `title` passed at 390x844 and "failed" at
    // 1200x730 purely because a seeded shot ran between them. My instrument,
    // not the game (the standing lesson: a measurement that agrees with the
    // thesis harder than it should is the instrument talking).
    await c.send('Page.navigate', { url: BASE });
    await waitForUrl('');
    await ev('localStorage.clear(); 1');
    if (s.seed) {
      await c.send('Page.navigate', { url: BASE });
      await waitForUrl('');
      await waitFor('body *', { deadline: 8000, quiet: 60 });
      await ev(s.seed + ' 1');
    }
    await c.send('Page.navigate', { url: BASE + s.query });
    const landed = await waitForUrl(s.query);
    if (landed === null) console.error(`  ${s.name}: navigation to '${s.query || '(no query)'}' never committed within 10s`);
    // A driven screen mounts its BASE screen first, then the drive opens the
    // target; poll for each in turn rather than sleeping through both.
    const preWait = s.drive ? await waitFor('body *', { deadline: 10000 }) : null;
    if (s.drive) {
      if (preWait === null) console.error(`  ${s.name}: base screen never mounted within 10s — drive will report the miss`);
      const d = await ev(s.drive);
      if (d && d.__err) console.error(`  drive failed on ${s.name}: ${d.__err}`);
      // A generated sub-surface recipe returns a SENTENCE when the control it
      // needs isn't there. Silence here would leave the shot to fail later on a
      // landmark and blame the screen for the drive's problem.
      else if (typeof d === 'string') console.error(`  drive failed on ${s.name}: ${d}`);
    }
    const waited = await waitFor(s.landmark, { deadline: 10000 });
    if (s.after) await ev(s.after);
    // The proc cascade is a TIMED animation, not a mount: ?shot=fx poses itself
    // 1600ms after boot (main.js poseFxShowcase). This is the one place a fixed
    // wait is the honest instrument — it is waiting for an animation to reach
    // its pose, not for a DOM node to exist.
    if (s.poseWait) await sleep(s.poseWait);
    await sleep(120);

    const diag = ok0 => ok0;
    const seen = await ev(`(()=>{
      const el = document.querySelector(${JSON.stringify(s.landmark)});
      const banner = document.querySelector('.validation-banner');
      const body = document.body ? document.body.innerText.trim().length : 0;
      return {
        landmark: !!el, banner: banner ? banner.textContent.slice(0,180) : null, textLen: body,
        url: location.href.slice(-42), ready: document.readyState,
        bodyHead: (document.body ? document.body.innerText.trim().slice(0,60).replace(/\s+/g,' ') : ''),
        bootErr: (window.__bootError && String(window.__bootError).slice(0,120)) || null,
      };
    })()`);

    // The sub-surface assertion (denominator 2). Returns `true` or a SENTENCE
    // saying what was wrong — a boolean-only assert tells you a tab failed and
    // not which way, and the two failures here (never selected / selected and
    // empty) want different people.
    let assertOk = true, assertWhy = '';
    if (s.assert) {
      const a = await ev(s.assert);
      assertOk = a === true;
      if (!assertOk) assertWhy = typeof a === 'string' ? a : `assert returned ${JSON.stringify(a)}`;
    }

    // The panel signature, read while we are standing on the surface. Compared
    // against its siblings' after every shot is taken — a member cannot be
    // compared to the others until the others exist.
    let probeVal = null;
    if (s.probe) probeVal = await ev(s.probe);

    const file = `${OUT}/${s.name}-${shape.tag}.png`;
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(shot.data, 'base64'));

    const ok = seen && seen.landmark && !seen.banner && seen.textLen > 0 && assertOk;
    if (!ok) misses++;
    rows.push({ shape: shape.tag, name: s.name, sub: s.sub || null, ok, seen, file, waited, probe: probeVal });
    const why = seen && seen.banner
      ? 'VALIDATION BANNER: ' + seen.banner
      : seen && !seen.landmark
        ? `landmark '${s.landmark}' never appeared within 10000ms — url…${seen.url} ready=${seen.ready} text=${seen.textLen} on screen: "${seen.bodyHead}"${seen.bootErr ? ' BOOT ERROR: ' + seen.bootErr : ''}`
        : !assertOk
          ? `SUB-SURFACE ${s.sub}: ${assertWhy}`
          : '';
    console.log(`${ok ? 'RENDERED' : 'MISS    '}  ${shape.tag.padEnd(9)} ${s.name.padEnd(18)} ${ok ? `${waited}ms` : why}`);
  }
}

// ---------------------------------------------------------------------------
// THE PROPERTY (B1) — checked per group per shape, after every shot is taken.
// A per-shot assert only ever sees one surface, so it can be satisfied by facts
// printed from the id. This is the one check that compares members to each
// other, which is the only way to ask the handler what it actually built.
// Reported on green too: a property nobody sees hold is a property nobody will
// notice stop holding.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// NOTHING MEASURED — SAY THAT AND STOP. This gate is FIRST, above the property
// block, the boundary block and the float summary, and its position is the
// whole point.
//
// Marina's amended audit question, off Vira's sweep (2026-08-07): *a boundary
// block is a claim about a run that HAPPENED. A run that measured nothing prints
// its emptiness, not its boundaries.* `tutorial-reach --only 9999x9999` printed
// `all checks passed` and then a boundary naming four other things as uncovered.
//
// This tool did the same and I only found it by tripping over it. My first
// version of this guard sat down beside the verdict line, so a zero-shot run
// still printed `PROPERTY —`, `BOUNDARY — what this green does NOT cover` (of a
// green that did not exist) and `float-clip: OK … both shapes` — seventy lines
// of confidence above the refusal. A guard written at one door is a door, not a
// property; this one is at the top of the report.
// ---------------------------------------------------------------------------
if (!rows.length) {
  console.error(`\nrelease-shots: ZERO shots were taken, so nothing was measured and this is NOT a pass.`);
  console.error('No property was evaluated and no boundary is printed below — a boundary is a');
  console.error('claim about a run that happened.');
  if (only) {
    console.error(`\n--only takes a SHOT NAME, not a shape. No shot is called ${JSON.stringify(only)}.`);
    console.error(`Shapes are chosen with --shape (${SHAPES.map((x) => x.tag).join(', ')}); shot names are:`);
    console.error('  ' + SCREENS.map((s) => s.name).join(', '));
  } else {
    console.error('No screen and no sub-surface produced a row. Both denominators are empty.');
  }
  server.close();
  process.exit(1);
}
let propertyFails = 0;
console.log(`\nPROPERTY — ${DISTINCT_PANELS}`);
// --only narrows the run to one shot, so every other group has no members and
// the property has nothing to compare. Reporting that as VIOLATED would make
// --only permanently red, which trains its reader to ignore the line — the same
// harm as a green that means nothing, pointed the other way. It is NOT checked,
// and the run says so instead of guessing.
if (only) {
  console.log(`  NOT CHECKED  --only ${only} photographs one shot; the property needs a whole set.`);
  console.log('               Re-run without --only before citing this run as coverage.');
}
// Iterate the shapes that PRODUCED ROWS, not the shapes this file declares. I
// added --shape and it made the property red at the shape it had deliberately
// skipped — "no members photographed — unknown, not distinct", which is the
// property behaving correctly against a list that no longer described the run.
// The list of shapes measured is a fact about the run; deriving it from `rows`
// means it cannot disagree with what happened.
const shapesShot = SHAPES.filter((s) => rows.some((r) => r.shape === s.tag));
for (const shape of only ? [] : shapesShot) {
  for (const g of SUB_SURFACE_GROUPS) {
    const mine = rows.filter((r) => r.shape === shape.tag && r.sub && r.sub.startsWith(`${g.group}:`));
    const bySig = new Map();
    let unread = 0;
    for (const r of mine) {
      if (r.probe == null || typeof r.probe !== 'string') { unread++; continue; }
      if (!bySig.has(r.probe)) bySig.set(r.probe, []);
      bySig.get(r.probe).push(r.sub.slice(g.group.length + 1));
    }
    // An unreadable panel is `unknown`, not distinct — the empty-referent rule
    // applied to my own probe rather than to someone else's home.
    if (unread || !mine.length) {
      propertyFails++;
      console.log(`  VIOLATED  ${shape.tag.padEnd(9)} ${g.group.padEnd(9)} ${mine.length ? `${unread} of ${mine.length} panels could not be read` : 'no members photographed'} — unknown, not distinct`);
      continue;
    }
    const dupes = [...bySig.entries()].filter(([, ids]) => ids.length > 1);
    if (dupes.length) {
      propertyFails++;
      for (const [, ids] of dupes) {
        console.log(`  VIOLATED  ${shape.tag.padEnd(9)} ${g.group.padEnd(9)} ${ids.join(' and ')} render the SAME panel — they are not ${ids.length} members`);
      }
    } else if (mine.length < 2) {
      // One member cannot be distinct from anything. Printing HOLDS here would
      // be a green earned by having nothing to compare — vacuously true, and
      // indistinguishable in the output from a set that actually passed.
      console.log(`  n/a       ${shape.tag.padEnd(9)} ${g.group.padEnd(9)} 1 member — distinctness needs at least 2, nothing was compared`);
    } else {
      console.log(`  HOLDS     ${shape.tag.padEnd(9)} ${g.group.padEnd(9)} ${mine.length} members, ${bySig.size} distinct panels`);
    }
  }
}

console.log(`\nBOUNDARY — what this green does NOT cover:
  - rendered is not legible: nothing here reads a screen the way a tired human
    does at 11pm (Sunna's gate), and nothing judges whether the art reads (Freja).
  - a landmark present is not a screen CORRECT: this asserts the screen mounted
    and painted text, never that its numbers are right (Vira).
  - two shapes only (390x844, 1200x730); everything between is unphotographed.
  - the driven screens depend on a control's selector; if a button is renamed
    the drive fails LOUD (a MISS), never silently photographs the wrong screen.
  - DENOMINATOR 2's edge, and it is the one worth reading: there is no single
    home listing the tabbed SURFACES, only three homes each listing its own
    members. This run enumerated the three it was told about. A fourth tabbed
    surface added in a fourth place would not appear in any number above — it
    would be missing, silently, exactly as the fifteen sub-surfaces were before
    this change. The sets known to exist and not enumerated are printed as
    NOT ENUMERATED at the top of this run.
  - a sub-surface asserted is a panel that SELECTED, PAINTED TEXT, and rendered
    something no sibling in its set renders. It is NOT a panel whose contents
    are right (Vira) or readable (Sunna): Vira swapped the Stats tab's handler
    for the Deck's and all 56 shots stayed green, because a wrong-but-non-empty
    panel is distinct from its siblings and full of text. All thirty sub-surface
    shots are blind to that, by construction, and it is why this block exists.
  - the property compares members WITHIN a set. It cannot see a set whose every
    member is wrong together, and it says nothing about correctness — two
    distinct, authored layouts can both be bad.
  - the denominators are read from src/ and the photographs are of
    dist/AshenSpire.html. This run proves every DECLARED member exists in that
    artifact, so the bundle is not older than the source in the way that hides
    a surface. It does NOT prove the artifact matches src/ in general — a bundle
    carrying something src/ no longer has passes here. That is
    node tools/verify-shipped.mjs, and it is a separate command.`);

// ---------------------------------------------------------------------------
// FLOAT CENTRING / CLIP ASSERTION (#69) — Rune, re-applied onto the canonical
// harness after Marina ruled Bjorn's copy canonical: mine carried fixed sleeps,
// and a float assertion running under fixed sleeps against a possibly-stale
// page is an assertion that can pass while blind. It now stands on this file's
// own guarantees — waitForUrl (we are on the document we asked for) and
// waitFor (the landmark exists) — instead of guessing at time.
//
// It spawns the exact strings Bjorn measured through the SHIPPED floatNum
// (window.__fxProbe, dev-only, ?shot= URLs only) and reads the RENDERED rect.
//
// THREE THINGS THIS ASSERTION HAD TO LEARN, each after it lied once, kept here
// because each is a way an instrument passes while blind:
//  1. Anchor. The clip lives on the RIGHTMOST combatant; anchored to the
//     leftmost it reported everything in-box and could not have failed.
//  2. Jitter. floatNum offsets by Math.random()*26-13, so the defect is
//     intermittent — a probe that rolls the dice reports the roll. Math.random
//     is pinned to the worst case the shipped code can emit (+13 right, -13
//     left).
//  3. The measured quantity. Clipping only shows when a wide string meets a
//     right-hand anchor, so a screen whose rightmost sprite sits 20px further
//     in reads clean while the bug is fully present. The deterministic
//     quantity — and the one Bjorn's per-string table reports — is the CENTRE
//     ERROR: floats are meant to sit centred on their anchor, and floatNum
//     centred them with a hardcoded half-width, so the error was
//     (realHalfWidth - thatConstant). Clipping is its consequence, not its
//     cause. And the rect must be read with the pop animation frozen, because
//     num-pop animates scale() and a mid-animation read shrank a 139px string
//     and a 15px one to the same 45px.
// ---------------------------------------------------------------------------
const FLOAT_STRINGS = [
  ['-7', 'dmg small', 'last'],
  ['+15', 'blk', 'last'],
  ['BLOCKED', 'blk small', 'last'],
  ['\u{1FA78} 12 RESISTED', 'blk small', 'last'],
  ['\u{1FA78} 12 RESISTED', 'blk small', 'first'],
];
let floatMisses = 0;
for (const shape of SHAPES) {
  if (onlyShape && shape.tag !== onlyShape) continue;
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: shape.width, height: shape.height, deviceScaleFactor: shape.dsf, mobile: shape.mobile,
  });
  await c.send('Page.navigate', { url: `${BASE}?shot=combat` });
  const onUrl = await waitForUrl('?shot=combat');
  const mounted = onUrl == null ? null : await waitFor('.combat');
  if (onUrl == null || mounted == null) {
    console.log(`FLOAT MISS  ${shape.tag} — combat did not mount (url ${onUrl == null ? 'never matched' : 'ok'})`);
    floatMisses++;
    continue;
  }
  for (const [text, cls, which] of FLOAT_STRINGS) {
    const m = await ev(`(() => {
      document.querySelectorAll('.float-num').forEach((n) => n.remove());
      if (!window.__fxProbe) return { noProbe: true };
      const _rand = Math.random;
      Math.random = () => (${JSON.stringify(which)} === 'first' ? 0 : 1);
      try { window.__fxProbe(${JSON.stringify(text)}, ${JSON.stringify(cls)}, ${JSON.stringify(which)}); }
      finally { Math.random = _rand; }
      const el = document.querySelector('.float-num');
      if (!el) return { noFloat: true };
      el.style.animation = 'none';
      const r = el.getBoundingClientRect();
      const layer = document.querySelector('.fx-layer').getBoundingClientRect();
      const hosts = [...document.querySelectorAll('[data-eid]')]
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      const pick = (${JSON.stringify(which)} === 'first' ? hosts[0] : hosts[hosts.length - 1]);
      const hb = (pick.querySelector('.sprite') || pick).getBoundingClientRect();
      const jitter = (${JSON.stringify(which)} === 'first' ? -13 : 13);
      const wantCentre = hb.left + hb.width / 2 + jitter;
      const gotCentre = r.left + r.width / 2;
      return {
        right: Math.round(r.right), width: Math.round(r.width), vw: window.innerWidth,
        centreErr: Math.round(gotCentre - wantCentre),
        atEdge: Math.round(r.left - layer.left) <= 7 || Math.round(layer.right - r.right) <= 7,
        overRight: Math.round(r.right - Math.min(window.innerWidth, layer.right)),
        overLeft: Math.round(Math.max(0, layer.left) - r.left),
      };
    })()`);
    // Never clipped, and centred unless the clamp is holding it at an edge —
    // that shift is by design and is labelled CLAMPED, not passed silently.
    const ok = m && !m.noProbe && !m.noFloat && m.overRight <= 0 && m.overLeft <= 0
      && (Math.abs(m.centreErr) <= 1 || m.atEdge);
    if (!ok) floatMisses++;
    const tag = ok ? (m && m.atEdge && Math.abs(m.centreErr) > 1 ? 'CLAMPED ' : 'CENTRED ') : 'OFF     ';
    console.log(`${tag}  ${shape.tag.padEnd(9)} ${JSON.stringify(text).padEnd(22)} ${which.padEnd(5)} ` +
      (m && m.right != null
        ? `off-centre=${m.centreErr > 0 ? '+' + m.centreErr : m.centreErr}px  w=${m.width} right=${m.right} vw=${m.vw}` +
          `${m.overRight > 0 ? ` CLIPPED +${m.overRight}px` : ''}${m.overLeft > 0 ? ` CLIPPED LEFT +${m.overLeft}px` : ''}`
        : JSON.stringify(m)));
  }
}
console.log(floatMisses
  ? `\nfloat-clip: ${floatMisses} float(s) off-centre or clipped — the half-width is a constant, not the string's own.`
  : '\nfloat-clip: OK — every measured float is centred on its anchor and inside the layer, both shapes.');
// Rune's call, and it is the right one: a clipped float is unreachable text and
// fails the run like any MISS. But the two counts must not merge into one NOUN.
// Folded into `misses` alone, a run with 28 perfect screens and 10 bad floats
// printed "10 screen(s) did not render as meant" — measured, on the red run I
// watched — and sends its reader hunting ten broken screens that do not exist.
// A summary that misnames what failed is the same defect class as a check that
// cannot fail: technically true, and it costs someone an hour. So the exit code
// is shared and the sentence stays specific.
if (misses || floatMisses || propertyFails) {
  const parts = [];
  if (misses) parts.push(`${misses} screen(s) did not render as meant`);
  if (floatMisses) parts.push(`${floatMisses} float(s) off-centre or clipped`);
  // Named separately for the same reason floats are: a property violation is
  // not a broken screen, and a summary that misnames what failed costs someone
  // an hour hunting screens that render perfectly.
  if (propertyFails) parts.push(`${propertyFails} group/shape(s) violated '${DISTINCT_PANELS}'`);
  // Point at the block that actually holds the evidence. A property violation
  // prints no MISS line, and sending its reader to hunt for one is the same
  // class of defect as a summary that misnames what failed.
  const where = [misses && 'MISS', floatMisses && 'OFF', propertyFails && 'PROPERTY'].filter(Boolean);
  console.error(`\nrelease-shots: ${parts.join(' · ')} — see the ${where.join('/')} line(s) above.`);
  server.close();
  process.exit(1);
}
const subShots = rows.filter((r) => r.sub).length;
console.log(`\nrelease-shots: OK — ${rows.length} shots (${rows.length - subShots} top-level, ${subShots} sub-surface), `
  + `every landmark present, every sub-surface assertion true, `
  // The summary must not claim a property the run did not evaluate. Under
  // --only it was NOT CHECKED, and saying it held would be this tool asserting
  // coverage it skipped — one line away from the defect the whole change is
  // against, in the sentence a tired reader is most likely to read alone.
  + (only
    ? `and the panel property NOT CHECKED (--only), `
    // "at both shapes" was typed into this sentence, so --shape made the verdict
    // line claim two shapes on a one-shape run. The count comes from the run.
    : `'${DISTINCT_PANELS}' holds in every group at ${shapesShot.length === SHAPES.length
      ? 'both shapes' : `${shapesShot.map((s) => s.tag).join(' and ')} (--shape)`}, `)
  + `no validation banner. → ${OUT}`);
server.close();
process.exit(0);
