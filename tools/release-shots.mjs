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
// Usage:  node tools/release-shots.mjs [--out DIR] [--only NAME]
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
import { SETTINGS_CATEGORIES } from '../src/ui/screens/settings.js';
import { balance } from '../src/content/balance.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = resolve(ROOT, oi >= 0 && args[oi + 1] ? args[oi + 1] : 'docs/release-shots');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

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
  //  settings categories are now generated from SETTINGS_CATEGORIES, so Profile
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
//   settings sections src/ui/screens/settings.js SETTINGS_CATEGORIES (a const in a screen)
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
// equipment.js, the alignment from styles/ui.css. `authoredIn` asks the
// STYLESHEET whether anyone authored this view. It needs no browser, so it runs
// in the pre-browser gate and costs nothing.
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
        const b = document.querySelector('.ov-tab[data-tab=${q(id)}]');
        if (!b) return 'no tab button for ' + ${q(id)};
        b.click();
        return true;
      })()`,
      // The assertion that earns the shot. A tab that is SELECTED and renders an
      // EMPTY body is the failure this group exists to catch: MENU_TABS is the
      // home of the tab LIST, but overlay.js selectTab() is a hardcoded if-chain
      // over the same ids — a second, implicit home of "which ids render".
      assert: `(() => {
        const on = document.querySelector('.ov-tab[data-tab=${q(id)}].on');
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
    home: 'src/ui/screens/settings.js — SETTINGS_CATEGORIES',
    ids: () => SETTINGS_CATEGORIES.slice(),
    reach: (id) => ({
      query: '',
      landmark: '.set-body',
      drive: `(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => /settings/i.test(b.textContent));
        if (!btn) return 'no Settings button on the title screen';
        btn.click();
        const h = [...document.querySelectorAll('.set-cat')].find((e) => e.textContent.trim() === ${q(id)});
        if (!h) return 'no ' + ${q(id)} + ' heading in the settings screen';
        h.scrollIntoView({ block: 'center' });
        return true;
      })()`,
      // Same shape as the overlay's: SETTINGS_CATEGORIES is the home of the
      // category LIST, and ROWS[].cat plus renderSettings()'s two special cases
      // decide what actually appears under each heading. A heading with nothing
      // under it is a surface that exists in the list and renders nothing.
      assert: `(() => {
        const h = [...document.querySelectorAll('.set-cat')].find((e) => e.textContent.trim() === ${q(id)});
        if (!h) return 'category heading absent: ' + ${q(id)};
        const r = h.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return 'heading still off-screen after scrollIntoView';
        let n = h.nextElementSibling, text = 0;
        while (n && !n.classList.contains('set-cat')) { text += (n.innerText || '').trim().length; n = n.nextElementSibling; }
        if (!text) return 'category ' + ${q(id)} + ' renders a heading and NOTHING under it';
        return true;
      })()`,
      probe: `(() => {
        const h = [...document.querySelectorAll('.set-cat')].find((e) => e.textContent.trim() === ${q(id)});
        if (!h) return null;
        // The section is the run of siblings up to the next heading — the same
        // span the assert walks, so the two agree about what "this category" is.
        let n = h.nextElementSibling, html = '';
        while (n && !n.classList.contains('set-cat')) { html += n.outerHTML; n = n.nextElementSibling; }
        return ${SIG_FN}(html);
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
    // The second home of this closed set, and the one the DOM cannot see: a
    // layout view IS a stylesheet rule. `kanban` renders under no rule at all,
    // which is why its alignment was a value nobody authored. Pre-browser.
    authoredIn: {
      what: '`.view-<id>` rule in styles/',
      dir: 'styles',
      pattern: (id) => new RegExp(`\\.view-${id}\\b`),
    },
    reach: (id) => ({
      query: '?shot=combat',
      landmark: '.armoury',
      drive: `(() => {
        const a = document.querySelector('#combat-armoury');
        if (!a) return 'no #combat-armoury on the combat screen';
        a.click();
        const b = document.querySelector('.armoury-views [data-view=${q(id)}]');
        if (!b) return 'no view button for ' + ${q(id)};
        b.click();
        return true;
      })()`,
      assert: `(() => {
        const el = document.querySelector('.armoury.view-' + ${q(id)});
        if (!el) return 'armoury never carried view-' + ${q(id)};
        const on = document.querySelector('.armoury-views [data-view=${q(id)}].on');
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
  const gaps = app.filter((s) => !covered.has(s) && !EXCLUDED_STATES[s]);
  console.log(`DENOMINATOR 1 — top-level states · home: src/main.js (?shot= states)`);
  console.log(`  ${app.length} states: ${covered.size} photographed, ${Object.keys(EXCLUDED_STATES).length} excluded by name, ${gaps.length} unaccounted`);
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
    // THIS CHECK READ THE FILE, NOT THE STYLESHEET, AND I FOUND IT BY RUNNING
    // THE TOOL AGAINST #78 (2026-08-07). That branch converts every
    // `.armoury.view-<id>` rule to `[data-figure]` / `[data-slots]` and leaves
    // ONE comment behind naming the three ids it deleted:
    //
    //   /* … used to name an id (.view-grid / .view-rack / .view-hybrid), which
    //      made the stylesheet a second, silent decider of the layout … */
    //
    // `pattern(id).test(css)` matched that comment. Every view passed. A gate
    // whose whole job is "somebody authored a rule for this view" was satisfied
    // by prose SAYING THE RULE WAS REMOVED — and unlike the other three couplings
    // to that branch, this one does not crash and does not MISS. It goes green.
    // Measured both edges on a `5c49fed` worktree: as Viki wrote it, the gate
    // passes; delete six words from inside that comment and nothing else, and it
    // reds on grid, rack and hybrid. A stylesheet whose RULES are byte-identical
    // must not change this verdict.
    //
    // So the pattern is tested against SELECTOR TEXT ONLY: comments stripped,
    // then everything before each `{` — which is the only place a rule can name
    // a class. Declaration values and prose cannot answer for a selector.
    const selectorTextOf = (css) => css
      .replace(/\/\*[\s\S]*?\*\//g, ' ')      // comments are not rules
      .split('}')
      .map((block) => block.split('{')[0])    // …and neither are declarations
      .join('\n');
    if (g.authoredIn) {
      const dir = resolve(ROOT, g.authoredIn.dir);
      const css = readdirSync(dir).filter((f) => f.endsWith('.css'))
        .map((f) => readFileSync(resolve(dir, f), 'utf8')).join('\n');
      if (!css.length) {
        console.error(`\nrelease-shots: '${g.group}' declares authoredIn ${g.authoredIn.dir}/ and read ZERO bytes there.`);
        console.error('An unreadable home is unknown, not authored. Fix the path.');
        process.exit(1);
      }
      const selectors = selectorTextOf(css);
      // A check that cannot fail is not a check — the same clause the armoury's
      // `assert` already carries. If stripping left nothing, the reader is
      // broken, and reporting "all authored" from an empty string is the exact
      // green this whole block exists to stop.
      if (!selectors.trim().length) {
        console.error(`\nrelease-shots: '${g.group}' read ${css.length} bytes of CSS and found ZERO selector text.`);
        console.error('The selector reader is broken; every member would pass for the wrong reason.');
        process.exit(1);
      }
      const unauthored = ids.filter((id) => !EXCLUDED_SUBSURFACES[`${g.group}:${id}`]
        && !g.authoredIn.pattern(id).test(selectors));
      if (unauthored.length) {
        console.error(`\nrelease-shots: ${g.group} member(s) with no ${g.authoredIn.what}: ${unauthored.join(', ')}`);
        console.error(`A member of ${g.home} that nothing in ${g.authoredIn.dir}/ styles renders under whatever`);
        console.error('rule happens to apply — a layout nobody authored. Author it, or name it in');
        console.error('EXCLUDED_SUBSURFACES with the reason.');
        process.exit(1);
      }
    }
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
    console.log(`            photographed: ${mine.join(', ')}`);
    for (const id of ids) {
      const why = EXCLUDED_SUBSURFACES[`${g.group}:${id}`];
      if (why) console.log(`  EXCLUDED  ${g.group}:${id} — ${why}`);
    }
  }
  console.log(`  ${total} sub-surfaces across ${SUB_SURFACE_GROUPS.length} homes: ${shot} photographed and asserted, ${excluded} excluded by name`);
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

spawn('/opt/pw-browsers/chromium', [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=9431', 'about:blank',
], { stdio: 'ignore' });

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

const c = await cdp(9431);
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
for (const shape of only ? [] : SHAPES) {
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
    : `'${DISTINCT_PANELS}' holds in every group at both shapes, `)
  + `no validation banner. → ${OUT}`);
server.close();
process.exit(0);
