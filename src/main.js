// src/main.js — boot + run orchestrator (SPEC §7.1)
//
// M2 flow: Title → class select → act map → [combat | shrine | shop | event |
// treasure] → … → boss → game over. One rng is created from the seed and its
// stream counters are saved with the run after every committed choice, so a
// whole run is reproducible from its seed string and a reload restores
// exactly (mid-combat: the combat restarts from its start — StS behavior,
// because counters are saved BEFORE the combat begins).

import { contentBundle } from './content/index.js';
import { validateContent } from './model/validate.js';
import { createRegistries } from './model/registries.js';
import { createRunState, createDeck, createIdGen } from './model/state.js';
import { runMods, stampDeck, addToStorage, carriedIds, resolveSwapCostRule } from './model/loadout.js';
import { recordProgress, evaluateUnlocks } from './model/unlocks.js';
import { recordArmamentDiscovery } from './model/startingKits.js';
import { activeMods, isCustomRun, endlessActInfo, ENDLESS_HP_PER_LOOP, ENDLESS_STR_PER_LOOP } from './content/customMods.js';
import { createRng, seedToString, seedFromString, seedProblem } from './engine/rng.js';
import { createCombat } from './engine/combat.js';
import { buildActMap } from './engine/actmap.js';
import { createSaveManager, createMemoryStorage } from './engine/save.js';
import {
  rollEncounter,
  rollRuneReward,
  rollCardRewardIds,
  rollFlaskDrop,
  rollRelicReward,
  buildShopStock,
  rollArmamentDrop,
  applyGraceRefill,
} from './engine/encounters.js';
import { mountTitle } from './ui/screens/title.js';
import { mountProfileNotice } from './ui/screens/profileNotice.js';
import { mountCustomize } from './ui/screens/customize.js';
import { mountCustomRun } from './ui/screens/customRun.js';
import { mountDraft } from './ui/screens/draft.js';
import { KEEPSAKES } from './content/keepsakes.js';
import { executeRunEffects, drawCards, discardFromHand } from './engine/actions.js';
import { mountMap } from './ui/screens/map.js';
import { mountCombat } from './ui/screens/combat.js';
import { mountRewards } from './ui/screens/reward.js';
import { mountRest } from './ui/screens/rest.js';
import { mountShop } from './ui/screens/shop.js';
import { mountEvent } from './ui/screens/event.js';
import { mountGameOver } from './ui/screens/gameover.js';
import { mountHistory } from './ui/screens/history.js';
import { mountCompendium } from './ui/screens/compendium.js';
import { openSettings, settingOn, showSettingsNotice, resolveTapSize, resolveGraceRefill } from './ui/screens/settings.js';
import { mountEquipment } from './ui/screens/equipment.js';
import { openOverlay } from './ui/components/overlay.js';
import { setQuickNav } from './ui/components/quicknav.js';
import { showBossIntro } from './ui/components/intro.js';
import { initInput, setBindings, setKeyBindings } from './ui/input.js';
import { setSpritesEnabled, classGlyph, setClassGlyphs } from './ui/assets.js';
import { mountLobby } from './ui/screens/lobby.js';
import { mountCoop } from './ui/screens/coop.js';
import { lanInfo } from './net/lan.js';
import { setAnimSpeed, anchorLocalBox, clampBox, floatNum as fxFloatNum } from './ui/fx.js';
import { sfx } from './ui/sfx.js';
import { initAudio } from './ui/audio.js';
import { installHoldBeat } from './ui/components/holdbeat.js';
import { surfaceReport } from './ui/surfaces.js';
// failureBanner is the ONE home for "the game says something is structurally
// wrong" — the two boot checks below used to build that element by hand, and a
// third hand-built copy is the defect this import exists to prevent.
import { dlog, failureBanner } from './ui/debuglog.js';

const app = document.getElementById('app');

// ---- content validation at boot (SPEC §3.14) — loud, on-screen -------------
const validation = validateContent(contentBundle);
if (!validation.ok) {
  // The header said 34 and the list showed 12 and nothing said the list was cut
  // (#67, Sunna's D19). A tuning pass that sweeps one field wrong makes exactly
  // that shape: fix twelve, reload, get a fresh twelve, and never learn how
  // deep the hole goes or that the console has the rest. Same family as the
  // silent no-op — a number promising more than the screen shows. The
  // truncation is fine; hiding it was not.
  const shown = validation.errors.slice(0, 12);
  const hidden = validation.errors.length - shown.length;
  // Wording unchanged; the ELEMENT is no longer built here. failureBanner() is
  // the one home for "the game says something is structurally wrong", and this
  // banner now carries the Command log door the uncaught-error one does.
  failureBanner(
    'boot:content',
    `CONTENT VALIDATION FAILED (${validation.errors.length} errors)`,
    shown.map((e) => ` · ${e.path}: ${e.msg}`).join('\n') +
      (hidden > 0 ? `\n · …and ${hidden} more — all ${validation.errors.length} are in the browser console.` : '')
  );
  console.error('Content validation errors:', validation.errors);
}

// ---- navigable surfaces: declared, and handled (#78) -----------------------
// The same shape as the block above and for the same reason. A surface declared
// in data with no handler used to render something PLAUSIBLE — a hybrid layout,
// an empty panel, a lone heading — so it never reached a banner or a console.
//
// It does NOT throw here, deliberately. `assertSurfaces()` throws for the suite
// and for tools/surfaces.mjs, where a hard exit is the point; on the boot path a
// throw is the blank screen #77 was about, and a blank screen is a worse failure
// than the one being reported. Banner, name, console — then the game runs.
{
  const missing = surfaceReport().filter((r) => r.missing.length);
  if (missing.length) {
    failureBanner(
      'boot:surfaces',
      'NAVIGABLE SURFACE DECLARED WITH NO HANDLER',
      missing.flatMap((r) => r.missing.map((m) => ` · ${r.id}${m.member ? ` · ${m.member}` : ''}`
        + ` ${m.why} — ${m.fix}`)).join('\n')
    );
    console.error('[surfaces]', missing);
  }
}

const registries = createRegistries(contentBundle);
setClassGlyphs(registries.classes.all()); // class sigils are data (class defs)

// Dev screenshot hook (?shot=…). Read HERE, above pickStorage(), because storage
// selection depends on it; the hook that consumes it lives at the bottom of this
// file where the states are listed. One read, one home — parsing the query string
// twice would be the same fact in two places.
//
// ONE `URLSearchParams` construction in this file, deliberately, and every fact
// derives from it (`shot`, `shotSettings`). That collapse is Rune's and it is the
// thing that makes the gate below reach every state; keep the count at one.
const shotParams = new URLSearchParams(location.search);
const shotState = shotParams.get('shot');
const shotEvidence = shotParams.get('shotEvidence');
if (shotEvidence) document.documentElement.dataset.shotEvidence = shotEvidence;
if (shotParams.get('shotArcane') === 'matrix') document.documentElement.dataset.shotArcane = 'matrix';

function pickStorage() {
  // A ?shot= boot NEVER touches durable storage. It used to: the hook wrote
  // settings.seenTutorial into sote_meta_v1, and then newRun({ slot: 1 }) →
  // startClimb() → persist() → saveRun(run, rng, 1) clobbered sote_run_v1. So a
  // URL meant only for tools/screenshot.mjs destroyed a player's in-progress run
  // — and it shipped in dist/, reachable by anyone who typed it.
  //
  // The gate is the storage SEAM, not a guard at each write, because there are
  // two writes today and the third one would not know to ask. Memory storage is
  // the module's own documented stub (engine/save.js), and the shot states are
  // ephemeral showcases that never wanted persistence — so this removes a
  // capability rather than adding a branch. tools/screenshot.mjs is unchanged.
  if (shotState) return createMemoryStorage();
  try {
    window.localStorage.setItem('sote_probe', '1');
    window.localStorage.removeItem('sote_probe');
    return window.localStorage;
  } catch (e) {
    return createMemoryStorage(); // e.g. blocked third-party storage
  }
}
const saves = createSaveManager(pickStorage());

// `?shotSettings=<json>` — display settings for a ?shot= boot, written into the
// EPHEMERAL store above. Read only when shotState is truthy, so a normal boot
// cannot reach this at all, and it writes through the memory stub, so Rune's gate
// is untouched and there is still no durable write. The gate line itself is
// deliberately not modified: tools/shotguard-probe.mjs --mutate matches it
// byte-for-byte and REFUSES to run if it has changed.
//
// WHY THIS EXISTS. A ?shot= boot has no durable settings by construction, so
// sote_meta_v1 is never read and every display setting resolves to its default.
// Correct for the gate — and it silently broke my own instrument.
// tools/contrast-audit.mjs seeded each profile into localStorage and then
// measured nine profiles rendering identically on every ?shot= screen, reporting
// `hi-contrast-off` map Act/Floor at 6.33 where the truth is 3.74: a PASS
// standing in for an AA failure, in the direction that flatters the change.
// Vira caught it reviewing #10 and made it a merge condition; the invariant she
// wrote is "the profile reported is the profile rendered."
//
// The settings go through saves.loadMeta() like any other boot, so what gets
// measured is the app's OWN resolution — settingOn(), resolveZoom(),
// applyDisplaySettings() — and never the instrument's copy of those rules. That
// is the whole reason this is a URL parameter rather than the audit reaching in
// and setting `body.hi-contrast` itself, which would have been three lines and
// would have measured my own mock.
if (shotState) {
  const raw = shotParams.get('shotSettings');
  if (raw) {
    try {
      const incoming = JSON.parse(raw);
      if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
        const meta = saves.loadMeta();
        saves.saveMeta({ ...meta, settings: { ...(meta.settings || {}), ...incoming } });
      } else {
        console.warn('?shotSettings ignored: not a JSON object');
      }
    } catch (e) {
      // Loud but harmless: a malformed value must not take the boot down, and it
      // must not silently look like "the defaults were what you asked for."
      console.warn('?shotSettings ignored (not JSON):', e && e.message);
    }
  }
}

// Procedural audio engine (SPEC §7.4). The sink plugs into the existing sfx
// hook seam, so every sfx.play() call site makes sound with no change.
const audio = initAudio(saves.loadMeta().settings || {});
sfx.sink = (id) => audio.sfx(id);

// Keyboard + gamepad navigation (SPEC §7.3). Bindings live in meta.settings.
initInput({ getSettings: () => saves.loadMeta().settings || {} });

// All presentation config is data (content/balance.js → balance.ui): accent
// palettes, UI zoom scale, text sizes. Code never embeds these numbers.
const UI = registries.balance.ui;
const ACCENTS = UI.accents;
// Debug handle, same species as `window.__combat` in combat.js. EldenSpire#23's
// fit invariant is `appliedZoom x designW <= innerWidth`, and a probe that reads
// designW off disk is measuring the tree rather than the page in front of it —
// which is the whole difference for dist/, one inlined file. Read-only.
if (typeof window !== 'undefined') window.__uiScale = UI.uiScale;
// Same species, same reason, added at EldenSpire#41 for Vira's condition: a check
// that asks "is the opened Armoury view the one the table names" must READ the
// table off the page, not hold its own copy (Law 1 clause 2). A tool typing
// 'rack' would agree with a typo as happily as with the truth. Read-only.
if (typeof window !== 'undefined') window.__equipCfg = registries.balance.equipment;

// THE HOLD'S BEAT (ui/components/holdbeat.js). Installed once, here, and never
// mentioned again: it rides `data-hold` / `data-hold-progress`, the two facts
// armHold already publishes on every held control, so nothing at any call site
// wires it and a control that starts holding LATER is covered the day it does.
// `at` is the one home of the fractions; the sounds are content/sfx.js.
installHoldBeat({ root: document, at: (UI.holdBeat || {}).at || [] });

// Apply persisted display settings at boot (defaults: sprites on, motion normal).
let lastMusicFolder;
// UI size — the whole app is zoomed by `body.style.zoom` so every fixed-px
// element (cards, sprites, map nodes, menus) scales together. "Auto" flexes the
// zoom with the window against a design baseline so the board fills big screens
// and shrinks to fit small ones; S–XL are fixed overrides. Legacy numeric values
// ('90'/'100'…) still resolve. Clamped so it never gets unusably tiny/huge.
const UI_NAMED = UI.uiScale.named;

// EldenSpire#23 — TWO baselines, ONE decider.
//
// The wide baseline (1200x730) is the board this game is drawn for. The narrow
// one (430x780) is the portrait-phone board styles/combat.css lays out. No code
// here asks "is this a phone" — a question with no honest answer, since a
// desktop window can be 400px wide and a tablet can be 1200. The fit decides.
//
// WHY THIS IS ONE FUNCTION RETURNING TWO VALUES, AND NOT A CONTAINER QUERY.
// It was a container query until Vira swept 7.8M viewports and found the band
// this branch locked out (#24). The zoom took `max(wideFit, narrowFit)` and the
// stylesheet independently asked whether the app's local width was <= 520. Two
// deciders, on two different inputs, with nothing making them agree:
//
//   834x1194 (iPad Pro 11 portrait) — narrowFit is HEIGHT-limited, 1194/780 =
//   1.53, so it wins; but 834/1.53 = 545 local px, which is > 520, so the
//   stylesheet kept the WIDE layout. A board drawn for 1200px, rendered into
//   545. END TURN under the hand: 45/45 on dev, 0/45 here. Three of four
//   tablet shapes that work today, dead.
//
// The cliff sits at aspect ratio 2/3 exactly: when the narrow fit is
// height-limited, localW = narrowH x w/h, which crosses 520 at w/h = 520/780.
// 884/1326 = 0.66667 passes, 885/1326 = 0.66742 fails. A second door is the
// 1.70 ceiling, which pins localW = w/1.70 > 520 for every w above 884.
//
// Vira's sentence, which is the whole lesson and is not paraphrased: WHEN A FIX
// ADDS A SECOND DECIDER, THE DEFECT IS RARELY THE NEW VALUE. IT IS THAT NOTHING
// MAKES THE TWO AGREE — AND NO SINGLE-HOME CHECK CAN SEE IT, BECAUSE THERE IS
// NO DUPLICATED CONSTANT TO FIND. My 520 did have exactly one home. That was
// true and it was not the point.
//
// So the second decider is gone rather than reconciled. This function picks the
// mode AND the zoom together, and the stylesheet follows an attribute instead of
// measuring anything: `:root[data-layout='narrow']`. Reconciling two deciders
// would have needed 520 in the CSS *and* in here — the duplicated constant the
// single-home rule exists to prevent. Removing one needs it in neither: it is
// data, in balance.ui.uiScale, read once, right here.
//
// THE PROPERTY, and it is now true by construction rather than by care:
//   the zoom selects the narrow baseline  IFF  the narrow layout is active.
// A candidate is admissible only if it is self-consistent — the narrow baseline
// only when the zoom it produces really does leave <= narrowMax local px, the
// wide baseline otherwise. tools/mobilefit.mjs asserts it at every shape.
//
// The clamp is UNCHANGED. #23 reads as a floor bug and is not one: at 390x844
// the wide baseline wants 0.325, the floor gives 0.62, and BOTH are wrong,
// because both try to fit a 1200px layout onto a 390px screen.
// EldenSpire#26 — ONE FIT PATH, and `auto` is the uncapped case of it.
//
// `resolveZoom()` used to return the named S/M/L/XL values straight from data
// with no fit check at any viewport, so a fixed size could ask for more space
// than the screen has. Sunna measured the extent rather than an instance: TEN
// OF TWENTY-FIVE size x shape cells unreachable, and all four fixed sizes on
// landscape 844x390 were TOTAL LOCKOUTS — turn the phone sideways, open
// Settings, pick anything but Auto, and the fight cannot be advanced.
// Constantine's ruling, verbatim: "clamp like auto."
//
// So a named size is now a CAP on the same computation, not a separate answer.
// `layoutForCap(Infinity)` is `auto` and is byte-identical to 2c40fdb: with an
// infinite cap every `Math.min(v, cap)` is `v`, and the recovery branch below
// cannot be reached, because it needs the capped candidate to fail a test the
// uncapped one passed. Vira's sweep is the proof, not this paragraph.
//
// WHY THE CAP CANNOT SIMPLY BE `Math.min(named, autoZoom)`. Lowering the zoom
// RAISES the local width — localW = innerWidth / zoom — so a cap can push a
// shape out of the narrow band. At 500x800 the uncapped fit is 1.02 (narrow,
// 490 local px) and S = 0.85 gives 588, above narrowMax. When the UNCAPPED fit
// would have been narrow, the recovery below settles the zoom at the smallest
// value that keeps the band.
//
// WHAT THAT RECOVERY IS AND IS NOT FOR — corrected by Vira, who tested the
// claim I had written instead of reading it. My comment implied the recovery is
// what preserves #24's property. IT IS NOT. She deleted the branch and re-swept:
//
//   the zoom selects the narrow baseline  IFF  the narrow layout is active
//
// still holds at every cap without it, because the final unguarded return sets
// `narrow: false` alongside a wide-baseline zoom and is therefore self-consistent
// by arithmetic, not by that guard. What the recovery buys is OUTCOME QUALITY,
// not the invariant: 500x800 with S gives 0.97 narrow with it and 0.62 wide
// without, and BOTH satisfy #24 — one is usable and one is a 1200px board in
// 806 local px. The property is upheld by every return path; the recovery is
// upheld by nothing but its own usefulness, and that is the honest reason to
// keep it.
function layoutForCap(cap) {
  if (typeof window === 'undefined') return { zoom: 1, narrow: false };
  const z = UI.uiScale;
  const w = window.innerWidth, h = window.innerHeight;
  const clamp = (v) => Math.max(z.min, Math.min(z.max, v));
  const fitFor = (dw, dh) => Math.min(w / dw, h / dh);
  const capped = (v) => Math.min(v, cap);

  // THE TWO PATHS ROUND DIFFERENTLY, ON PURPOSE. The wide path keeps
  // `Math.round` byte-for-byte, because every zoom every existing player sees
  // comes out of it. The narrow path floors, because `Math.round` can hand back
  // a zoom LARGER than the one that fits (at 390x844 the narrow fit is 0.907,
  // round gives 0.91, and 0.91 x 430 = 391.3 px demanded against 390 available).
  // Flooring BOTH moved 1280x800 from 1.07 to 1.06 and turned
  // tools/tutorial-reach.mjs red — the guard on #7.
  const wideZoom = clamp(capped(Math.round(fitFor(z.designW, z.designH) * 100) / 100));
  if (!(z.narrowW && z.narrowH && z.narrowMax)) return { zoom: wideZoom, narrow: false };

  const narrowFit = clamp(Math.floor(fitFor(z.narrowW, z.narrowH) * 100) / 100);
  const narrowZoom = clamp(capped(narrowFit));
  if (w / narrowZoom <= z.narrowMax) return { zoom: narrowZoom, narrow: true };

  // Recovery: the cap, not the screen, is what pushed this out of the narrow
  // band. Unreachable when cap is Infinity — narrowZoom === narrowFit there, so
  // this test is the one that just failed. THAT IS NOW MEASURED RATHER THAN
  // ARGUED: Vira instrumented it and the counter enters 0 times at cap
  // Infinity and 47,790-265,908 times under the named caps. Not load-bearing
  // for #24's property — see the header — only for the quality of the answer.
  if (w / narrowFit <= z.narrowMax) {
    const bandFloor = clamp(Math.ceil((w / z.narrowMax) * 100) / 100);
    if (w / bandFloor <= z.narrowMax) return { zoom: bandFloor, narrow: true };
  }
  return { zoom: wideZoom, narrow: false };
}

// A named size is a CEILING the player asked for, not a value the app owes them
// at any cost. Anything that is not a named size (incl. legacy numeric
// '90'/'100'/'110'/'125') is Auto: the settings UI displays such values as Auto,
// so behaving as fixed zoom made the control look dead ("scaling stopped
// working") — balance.js records that complaint, and it is the reason the
// settings screen now shows the value actually applied.
function resolveLayout(uiScale) {
  const key = String(uiScale == null ? 'auto' : uiScale).toLowerCase();
  const named = key !== 'auto' ? UI_NAMED[key] : null;
  return layoutForCap(named != null ? named : Infinity);
}

function applyUiScale(settings) {
  const { zoom, narrow } = resolveLayout(settings.uiScale);
  // Set as a CSS var so base.css can compensate the body's width/height for the
  // zoom (avoids the zoom×100vh overflow). Any leftover inline zoom is cleared.
  document.body.style.zoom = '';
  document.documentElement.style.setProperty('--ui-zoom', String(zoom));
  // The layout mode, written by the same call that chose the zoom, so the two
  // cannot disagree. The stylesheets key off this and measure nothing (#24).
  document.documentElement.setAttribute('data-layout', narrow ? 'narrow' : 'wide');
}

// MINIMUM TAP SIZE → `--tap-target` on <html>, read by `--tap-floor` in
// base.css and through it by every floored rule (`.set-tab`, `.ov-tab`,
// `.choice`, `.region-fold`). Written HERE, beside applyUiScale, because the
// two custom properties are the same species: one number the player chose,
// resolved once by the app and handed to the stylesheets, which measure
// nothing. The stylesheet holds no copy of the constant — see base.css.
//
// LOUD ON BAD DATA (Law 1 clause 5). resolveTapSize distinguishes ABSENT (the
// sparse store's normal state — the default, nothing to say) from PRESENT AND
// NOT IN THE CLOSED SET (a hand-edited save, an older build, a profile
// restored from a tree with a different set). The second still has to render
// something and renders the default — but it says so, by name, with the value
// it refused, in the log the player can copy out of Settings → Advanced. A
// rejected setting that silently becomes 44 is the "it doesn't stick" bug
// nobody can ever reproduce.
function applyTapSize(settings) {
  const { px, stored, bad } = resolveTapSize(settings);
  document.documentElement.style.setProperty('--tap-target', `${px}px`);
  // THE EXEMPT FLOOR NEVER MOVES. `--tap-floor-default-target` is the DEFAULT,
  // not the choice: the one control whose resizing happens while it is being
  // pressed holds still at it (Marina's ruling). Written from the same `def`
  // the row's own default reads, so this is the same 44 asked a second question
  // and not a second copy of it. See styles/base.css for the pair.
  document.documentElement.style.setProperty('--tap-floor-default-target', `${UI.tapSize.def}px`);
  if (bad) {
    const msg = `settings.tapFloor: stored value ${JSON.stringify(stored)} is not one of `
      + `${UI.tapSize.sizes.join(', ')} — applying the default ${px} and saying so`;
    dlog('ERROR', msg);
    console.warn(msg);
  }
}

// Re-flex Auto sizing whenever the window changes. Only recomputes for Auto and
// only touches the zoom, so it's cheap. Also re-applies shortly after boot and
// on `load` — some environments report tiny window dims until layout settles,
// which would otherwise freeze Auto at the clamp floor.
let uiResizeTimer = null;
function reflexAutoScale() {
  // Re-applied for EVERY uiScale setting, not only Auto. The zoom does not move
  // for a fixed size, but the MODE does: innerWidth changes on resize while the
  // zoom stays put, so the local width crosses narrowMax with nothing else
  // changing. Gating this on Auto left the attribute stale at exactly the
  // shapes a fixed size is most likely to be small in (#24).
  applyUiScale((saves.loadMeta().settings) || {});
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    clearTimeout(uiResizeTimer);
    uiResizeTimer = setTimeout(reflexAutoScale, 150);
  });
  window.addEventListener('load', reflexAutoScale);
  setTimeout(reflexAutoScale, 300);
}

function applyDisplaySettings(settings) {
  setSpritesEnabled(settings.useSprites !== false);
  document.body.classList.toggle('reduced-motion', settings.reducedMotion === true);
  // High contrast is ON unless the player turned it off. Asked rather than
  // hand-written (`settingOn`, src/ui/screens/settings.js) because a sparse
  // store makes the polarity part of the default: `=== true` here silently
  // re-declares `def: false` there, and the pair drifts with nothing checking.
  document.body.classList.toggle('hi-contrast', settingOn(settings, 'highContrast'));
  // Text size sets the root font-size %; because all type + component dimensions
  // are rem, one value rescales the whole UI (base.css). Legacy boolean largeText
  // maps to L. Stacks with --ui-zoom (which additionally scales px hairlines).
  const TEXT_SIZES = UI.textSize;
  const tKey = TEXT_SIZES[settings.textSize] ? settings.textSize
    : (settings.largeText === true ? 'L' : 'M');
  document.documentElement.style.fontSize = TEXT_SIZES[tKey];
  document.body.classList.toggle('no-shake', settings.screenShake === false);
  // Card colour motif: mode on the root as a data attr, wash depth as a var, so
  // switching is a re-paint with no re-render. Both defaults live in balance.ui.
  const motif = UI.cardMotifModes.includes(settings.cardMotif) ? settings.cardMotif : UI.cardMotif;
  document.documentElement.dataset.cardMotif = motif;
  // Hand layout (C2) — same shape as cardMotif, one line up: the word's one
  // home is balance.ui.handLayout, a stored choice outside the closed set
  // lands on that default, and the renderer (combat's renderHand + the narrow
  // CSS) keys off this attribute and reads the word nowhere else. Garbage is
  // SAID, not swallowed — a player whose stored setting rotted should not
  // find the hand silently rearranged (same contract as tapFloor above).
  const handLayout = UI.handLayoutModes.includes(settings.handLayout) ? settings.handLayout : UI.handLayout;
  if (settings.handLayout != null && handLayout !== settings.handLayout) {
    const msg = `settings.handLayout: stored value ${JSON.stringify(settings.handLayout)} is not one of `
      + `${UI.handLayoutModes.join(', ')} — applying the default '${handLayout}' and saying so`;
    dlog('ERROR', msg);
    console.warn(msg);
  }
  document.documentElement.dataset.handLayout = handLayout;
  const strengths = UI.cardMotifStrength;
  const sKey = strengths[settings.cardMotifStrength] != null ? settings.cardMotifStrength : 'normal';
  document.documentElement.style.setProperty('--card-motif-strength', String(strengths[sKey]));
  document.body.classList.toggle('cb-safe', settings.colorblindSafe === true);
  document.body.classList.toggle('reduce-flashes', settings.reduceFlashes === true);
  document.body.classList.toggle('readable-ui', settings.readableHeadings === true);
  document.body.classList.toggle('hide-hints', settings.controlHints === false);
  document.body.classList.toggle('map-compact', settings.mapHeaderDensity === 'compact');
  document.body.classList.toggle('hide-header-relics', settings.mapHeaderRelics === false);
  document.body.classList.toggle('hide-header-seed', settings.mapHeaderSeed === false);
  // The quick-menu experiment. Handed to the component the same way input.js is
  // handed its bindings, so no screen has to thread `meta` down just to ask which
  // variant is running. `settingOn` because the store is sparse and the default
  // is part of the answer (see its own docstring).
  setQuickNav({ mode: settings.quickNav, fixedEnds: settingOn(settings, 'quickNavFixedEnds') });
  // Walked-node fade → data attr on the root; styles/map.css carries the ladder.
  // Same shape as `ambient` below: an unknown stored value lands on the default
  // rather than on a silent no-fade, and the default here restates the settings
  // row's `def` the way every fallback in this function does.
  const wf = ['off', 'subtle', 'half', 'strong'].includes(settings.walkedFade) ? settings.walkedFade : 'half';
  document.documentElement.dataset.walkedFade = wf;
  // Ambient effects level → data attr read by the title screen (ember count) + CSS.
  const amb = ['off', 'low', 'normal', 'high'].includes(settings.ambient) ? settings.ambient : 'normal';
  document.documentElement.dataset.ambient = amb;
  // Accent theme → CSS variables on the root (falls back to gold).
  const accent = ACCENTS[settings.accent] || ACCENTS.gold;
  const root = document.documentElement.style;
  root.setProperty('--gold', accent.hex);
  root.setProperty('--accent-rgb', accent.rgb);
  // UI size — zoom the whole app (see applyUiScale). Auto flexes with the window.
  applyUiScale(settings);
  // Minimum tap size — the floor every floored rule is measured from. AFTER
  // applyUiScale for readability only: `--tap-floor` divides one by the other
  // at use time, so neither write depends on the other's order.
  applyTapSize(settings);
  setAnimSpeed(settings.animSpeed || 'normal');
  audio.setVolumes(settings);
  // Re-point external music only when the folder actually changed (avoids
  // re-fetching the manifest on every unrelated settings tweak).
  const folder = settings.musicFolder || '';
  if (folder !== lastMusicFolder) {
    lastMusicFolder = folder;
    audio.configureMusic({ folder });
  }
}
applyDisplaySettings(saves.loadMeta().settings);

/**
 * applyRestoredSettings(restored) — re-dress the running app in a profile that
 * has just been swapped underneath it (#68 D22).
 *
 * A restore replaces the whole profile, so every setting the app applied at
 * boot is now the OTHER profile's. Before this, renderProfileSection accepted
 * an `onRestored` callback, called it — and nobody ever passed one, on either
 * door. The screen kept the old profile's contrast, motion and text size while
 * storage held the new ones: high contrast stored ON and off on screen,
 * reduced motion stored OFF and on on screen, root font-size unmoved.
 *
 * Marina's framing is the one worth building to: THE PLAYER WHO MOST NEEDS
 * THOSE SETTINGS IS THE PLAYER WHO JUST LOST A SAVE. Someone who restores a
 * profile because they cannot read the game without high contrast should not
 * have to find the toggle again from memory.
 *
 * Everything the boot path applies is re-applied here, from ONE list, so a new
 * setting cannot be applied at boot and forgotten on restore.
 */
function applyRestoredSettings(restored) {
  const settings = restored || {};
  applyDisplaySettings(settings); // sprites, contrast, motion, text size, shake, motif
  applyUiScale(settings);         // UI zoom / Auto fit
  audio.setVolumes(settings);     // music, sfx, mute
  audio.configureMusic({ folder: settings.musicFolder || '' });
  lastMusicFolder = settings.musicFolder || '';
  if (settings.bindings) setBindings(settings.bindings);
  if (settings.keyBindings) setKeyBindings(settings.keyBindings);
}


// ONE HOME for the quarantine sentence (#68 D21). I wrote "ONE sentence, both
// doors — two doors with two strings is how they drift" and then pasted the
// string into both doors, which is the drift I was naming. Copy: Sunna,
// 2026-08-07; her tail now names the crisis screen's own route, so it is true
// wherever it is shown rather than only where Profile happens to sit below.
const QUARANTINE_NOTICE =
  'This works right now, but it won\u2019t survive a restart \u2014 your profile is set aside and we\u2019re not writing over it. You can restore it or save a copy from Settings \u2192 Profile, whenever you want to.';

// ---- run state ----------------------------------------------------------------
let run = null;
let rng = null;
let activeSlot = 1; // which save slot the current run persists to (SPEC §3.12 + slots)

// Autosave the current run to its slot (after every committed choice).
function persist() {
  saves.saveRun(run, rng, activeSlot);
  sendLanStatus();
}

// ---- Forsaken Together (LAN) -------------------------------------------------
// The run is server-authoritative (the launcher owns it via tools/session.mjs);
// the browser is a thin client that renders snapshots and sends intents. Solo
// play never touches any of this.
let inCoop = false;

// A no-op in solo (kept so persist() stays simple); the co-op client, not the
// orchestrator, owns the LAN socket and rendering.
function sendLanStatus() { /* server-authoritative co-op needs no client push */ }
function dropLanLink() { inCoop = false; }

function showLobby() {
  audio.music('title');
  mountLobby(app, {
    registries,
    meta: saves.loadMeta(),
    defaultSeedString: randomSeedString(),
    onBack: () => showTitle(),
    onStart: ({ conn, myId, myIds }) => {
      inCoop = true;
      // `meta` because the ACT MAP is now one renderer and the map-zoom
      // preference is the VIEWER's (ui/components/mapboard.js): a co-op client
      // is a viewer, and it was opening at a literal while the same player's
      // solo map honoured their setting.
      mountCoop(app, { registries, conn, myId, myIds, meta: saves.loadMeta(), onLeave: () => showTitle() });
    },
  });
}

function randomSeedString() {
  return seedToString((Math.random() * 0xffffffff) >>> 0);
}

function newRun({ classId, seedString, customization, keepsakeId, custom, startingKitId, slot = 1 }) {
  // THE CATCH THAT USED TO BE HERE IS GONE, and it is the whole point of the
  // change. It read:
  //
  //     try  { seed = seedFromString(seedString || randomSeedString()); }
  //     catch { seed = seedFromString(randomSeedString()); }  // invalid chars → fresh seed
  //
  // A throw swallowed and replaced with Math.random(). Six boots of one URL,
  // six different maps, nothing said — while the tooltip on the very field the
  // seed was typed into promised "the same seed gives the same map, the same
  // shops and the same cards." Constantine asked for repeatable short runs; a
  // seed with a hyphen in it was never one.
  //
  // The three seed fields refuse before this is reached (ui/components/
  // seedfield.js), so a problem arriving HERE means a caller that bypassed a
  // field — which is precisely the thing that has to be visible rather than
  // absorbed. It banners by name and starts NO run: starting the wrong run is
  // the failure being fixed, and a reroll is how it hid.
  //
  // It banners rather than throwing, for the reason stated at the surfaces
  // check at the top of this file: an uncaught throw on a boot/start path is
  // the blank screen of #77, and a blank screen is a worse failure than the one
  // it reports. Banner, name, console — and the screen the player is on stays.
  const asked = seedString || randomSeedString();
  const why = seedProblem(asked);
  if (why) {
    failureBanner('run:seed', 'THIS SEED CANNOT START A RUN',
      ` · ${JSON.stringify(String(seedString))} — ${why}\n`
      + ' · No run was started, and nothing was rerolled: a different map under the same seed is the defect this refuses.');
    console.error('[seed] refused at newRun:', { seedString, why });
    return;
  }
  // THE PROFILE IS OLDER THAN THE CLIMB (M7 — "profile should be able to be
  // created before first run, not after"). Here, not on the customize screen's
  // first click: that screen's own Back button promises "Nothing here is saved",
  // and a profile written when a class card is highlighted would make its
  // tooltip a lie. BEGIN THE CLIMB is where a character stops being a preview,
  // and it is one line above the run being made, so the write order is the ask.
  // A refused seed returns above and creates nothing.
  saves.ensureProfile();
  activeSlot = slot;
  const seed = seedFromString(asked);
  run = createRunState({ seed, classId, registries, startingKitId, profileMeta: saves.loadMeta() });
  run.seedString = seedToString(seed);
  run.customization = customization || { name: 'Forsaken', glyph: '⚔', tint: 'gold' };
  run.custom = custom || { ascension: 0, mods: {}, deckMode: 'standard' };
  run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
  run.path = [];
  run.seenEvents = [];
  run.lastEncounters = [];
  rng = createRng(seed);

  // Keepsake: a one-time bundle of run-level effects (content/keepsakes.js).
  const keepsake = KEEPSAKES.find((k) => k.id === keepsakeId);
  if (keepsake && keepsake.effects.length) {
    executeRunEffects({ run, registries, rng }, keepsake.effects);
  }

  // Custom Climb: alternate starting decks + start-of-run rule effects.
  const deckMode = run.custom.deckMode || 'standard';
  const mods = activeMods(run.custom);
  if (deckMode === 'sealed') {
    run.deck = createDeck(sealedDeckIds(classId), createIdGen('rc'));
  } else if (deckMode === 'draft') {
    run.deck = createDeck(draftBaseIds(), createIdGen('rc'));
  }
  if (mods.cursedStart) run.deck.push(...createDeck(['guilt'], createIdGen('cx')));
  if (mods.hoarder) run.cinders += registries.balance.customMods.hoarderCinders;

  if (deckMode === 'draft') return showDraft(); // picks, then proceeds to the map
  startClimb();
}

// After the deck is finalized (incl. any draft), generate the map and go.
function startClimb() {
  run.mapGraph = buildActMap(registries, rng, contentAct(), runMapShape());
  persist();
  showMap();
}

// Sealed: keep a small basic core, fill the rest with random pool cards.
function sealedDeckIds(classId) {
  const pool = registries.classes.get(classId).cardPool.slice();
  const ids = ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend'];
  for (let i = 0; i < 3 && pool.length; i++) {
    const id = rng.pick('misc', pool);
    pool.splice(pool.indexOf(id), 1);
    ids.push(id);
  }
  return ids;
}
function draftBaseIds() {
  return ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend'];
}

// Generate the current act's map and pre-roll every '?' node (stream
// 'events') so outcomes are seed-determined and the Sealstone Key can
// reveal them (SPEC §6).
// Endless Spire: acts past 3 loop back through acts 1-3 content, harder each
// cycle (combatMods). All content lookups go through contentAct(); the real
// run.actNumber keeps counting up for labels, saves, and history.
function endlessOn() {
  return !!(run.custom && activeMods(run.custom).endless);
}
function contentAct() {
  return endlessOn() ? endlessActInfo(run.actNumber).contentAct : run.actNumber;
}

// The Custom Climb debug shape (floors cap, columns cap, node weights) or null
// for an ordinary run. It rides on `run.custom`, so it is saved and reloaded
// with everything else the run chose — a resumed short run stays short, and act
// 2 is generated at the same shape act 1 was.
function runMapShape() {
  return (run.custom && run.custom.mapShape) || null;
}

// The map-build sequence itself lives in engine/actmap.js (the one boot path,
// #54) — this file only decides which act and where the graph is stored.

// Between acts: ember holds the spire together a little longer.
function advanceAct() {
  run.actNumber += 1;
  run.floor = 0;
  run.mapNodeId = null;
  run.path = [];
  run.lastEncounters = [];
  // Full heal between acts — halved under the "Scarce Embers" custom rule.
  if (run.custom && activeMods(run.custom).lessHealing) {
    run.hp = Math.min(run.maxHp, run.hp + Math.floor((run.maxHp - run.hp) * registries.balance.customMods.lessHealingMult));
  } else {
    run.hp = run.maxHp;
  }
  run.mapGraph = buildActMap(registries, rng, contentAct(), runMapShape());
  persist();
  showMap();
}

function resumeRun(slot = 1) {
  activeSlot = slot;
  run = saves.loadRun(registries, slot);
  if (!run) return showTitle();
  rng = createRng(run.seed, run.streamCounters);
  if (run.combatEntered && run.combatEntered.encounterId) {
    // Mid-combat save: restart that combat from its start (SPEC §3.12).
    enterCombat(run.combatEntered.nodeId, run.combatEntered.encounterId, { resuming: true });
  } else if (run.shopStock) {
    showShop();
  } else {
    showMap();
  }
}

// ---- screens --------------------------------------------------------------------
// #67 property 3/5: a profile that could not be read is a NAMED, VISIBLE state
// with a reachable handle — never a fresh profile wearing the same filename.
// This sits in front of the title because the title is where a player would
// otherwise see "no saves" and draw their own conclusion.
let profileNoticeShown = false;
function showProfileNoticeIfNeeded() {
  if (profileNoticeShown) return false;
  const status = saves.profileStatus();
  if (status.ok) return false;
  profileNoticeShown = true;
  mountProfileNotice(app, {
    saves,
    status,
    onContinue: () => showTitle(),
  });
  return true;
}

function showTitle() {
  if (showProfileNoticeIfNeeded()) return;
  audio.music('title');
  run = null;
  dropLanLink(); // a LAN session spans one run; back at the title it's over
  const slots = saves.listSlots().map(({ slot, summary }) => ({
    slot,
    summary: summary && {
      ...summary,
      className: registries.classes.has(summary.class) ? registries.classes.get(summary.class).name : summary.class,
    },
  }));
  mountTitle(app, {
    slots,
    onContinue: (slot) => resumeRun(slot),
    onNew: (slot) => showCustomize(slot),
    onDelete: (slot) => {
      saves.clearRun(slot);
      showTitle();
    },
    onHistory: showHistory,
    onCompendium: showCompendium,
    onSettings: showSettings,
    onQuit: quitGame,
    onCustom: () => {
      const empty = slots.find((s) => !s.summary);
      showCustomRun(empty ? empty.slot : 1);
    },
    onLan: showLobby,
  });
  // Forsaken Together needs the launcher's server behind the page.
  lanInfo().then((info) => {
    const btn = app.querySelector('#lan-play');
    if (info && btn) btn.hidden = false;
  });
}

function showSettings() {
  openSettings({
    meta: saves.loadMeta(),
    // The Profile section (#67) needs the manager itself: it lists, exports and
    // restores archives. Without it the section does not render at all.
    saves,
    // …and a restore swaps the whole profile, so the screen must be re-dressed
    // in the RESTORED settings (#68 D22) — otherwise the player who just lost a
    // save keeps the old profile's contrast, motion and text size.
    onProfileRestored: (restored) => applyRestoredSettings(restored),
    onChange: (changed) => {
      const meta = saves.loadMeta();
      Object.assign(meta.settings, changed);
      // saveMeta refuses while the profile is quarantined — correctly, it is
      // protecting the original bytes. Nobody read that {ok:false}, so a player
      // who pressed "Not now" and then turned the music down got a silent
      // no-op: the change applies for this session and does not persist, and
      // they were never told (Sunna's find, carried by Saga). Nothing is lost;
      // saying so is the whole fix.
      const res = saves.saveMeta(meta);
      applyDisplaySettings(meta.settings);
      remountMapIfShowing(changed);
      if (res && res.ok === false) {
        showSettingsNotice(QUARANTINE_NOTICE);
      }
    },
  });
}

/**
 * The Armoury. Outside combat it edits the loadout directly and re-stamps the
 * deck; the chosen view is a setting so it survives the session.
 */
function showArmoury() {
  mountEquipment(document.body, {
    registries,
    run,
    meta: saves.loadMeta(),
    inCombat: false,
    onChange: (loadout, settingChange) => {
      if (settingChange) {
        const meta = saves.loadMeta();
        Object.assign(meta.settings, settingChange);
        saves.saveMeta(meta);
      }
      run.loadout = loadout;
      stampDeck(registries, run);
      persist();
    },
    onClose: showMap,
  });
}

function showHistory() {
  mountHistory(app, { meta: saves.loadMeta(), onBack: showTitle });
}

/**
 * The Compendium — every armament the Spire keeps, most of it withheld.
 * A PROFILE surface: no run, no class, so `meta.found` is the whole of "yours".
 */
function showCompendium() {
  mountCompendium(app, { registries, meta: saves.loadMeta(), onBack: showTitle });
}

// Quit the game entirely. In a real browser tab window.close() is usually
// blocked (the tab wasn't script-opened), so we stop the game and show a
// graceful "safe to close" screen; in a standalone/launcher window the close
// succeeds. Any in-progress run is persisted first, so nothing is lost.
function quitGame() {
  if (run) persist();
  audio.stopMusic();
  run = null;
  app.innerHTML = `
    <div class="screen farewell">
      <h1 class="title-big">THE EMBER GUTTERS</h1>
      <p class="subtitle" style="text-align:center">Your climb is saved. You may close this window.</p>
      <button class="subtle" id="farewell-back">Return to title</button>
    </div>`;
  const closeTimer = setTimeout(() => {
    try {
      window.close();
    } catch (e) {
      /* browser blocked it — the farewell screen stands in */
    }
  }, 120);
  const back = app.querySelector('#farewell-back');
  if (back) {
    back.addEventListener('click', () => {
      clearTimeout(closeTimer); // changed their mind before the window closed
      showTitle();
    });
  }
}

// The in-run tabbed overlay (Deck / Relics / Stats / Settings), shared by the
// map and combat screens via their onMenu callback.
function showOverlay(initialTab = 'deck') {
  if (!run) return;
  openOverlay({
    registries,
    run,
    meta: saves.loadMeta(),
    initialTab,
    // The overlay gets the save manager too (#67, Sunna's D18). Without it this
    // door discarded saveMeta's {ok:false} exactly as the modal used to, and
    // this is the WORSE door: the settings people change mid-run are the
    // comfort ones — pacing, reduced motion, flashes — and the person quietly
    // turning those down mid-fight is the one who most needs them to still be
    // there tomorrow.
    saves,
    onProfileRestored: (restored) => applyRestoredSettings(restored),
    onSettingsChange: (changed) => {
      const meta = saves.loadMeta();
      Object.assign(meta.settings, changed);
      const res = saves.saveMeta(meta);
      applyDisplaySettings(meta.settings);
      remountMapIfShowing(changed);
      if (changed.bindings) setBindings(changed.bindings);
      if (changed.keyBindings) setKeyBindings(changed.keyBindings);
      // ONE sentence, both doors — and now literally one: QUARANTINE_NOTICE.
      if (res && res.ok === false) {
        showSettingsNotice(QUARANTINE_NOTICE);
      }
    },
    onSave: () => {
      persist();
      return activeSlot;
    },
    onQuit: () => {
      persist(); // the run is resumable from its slot via Continue
      showTitle();
    },
    onExit: quitGame, // "Quit Game" — leave the app entirely
  });
}

// A run-history record (SPEC §3.12) — enriched so the history screen can show
// class, progress, and per-class win rates.
function runResult(victory) {
  return {
    victory,
    seed: run.seedString,
    class: run.class,
    className: registries.classes.get(run.class).name,
    act: run.actNumber,
    floor: run.floor,
    fightsWon: run.stats.fightsWon,
    damageDealt: run.stats.damageDealt,
    damageTaken: run.stats.damageTaken,
    name: run.customization && run.customization.name,
    custom: isCustomRun(run.custom),
    ascension: (run.custom && run.custom.ascension) || 0,
    // Which bosses fell. beatBoss unlocks need this, and a run that ends in
    // act 3 has already earned the act 1 and 2 kills whatever happens next.
    bosses: [...(run.bossesBeaten || [])],
  };
}

/**
 * Close out a run: record it, advance the durable progress tally, and hand back
 * anything newly earned. Kept in one place so a defeat and a victory can never
 * disagree about what counts.
 */
/**
 * rollDrop(source) → armament id | null, and it is REMEMBERED.
 *
 * Finding a piece does two things at once, which is the whole bargain: it goes
 * into this run's storage so you can use it now, and into the profile's found
 * set so it stays available in every run after — a climb that ends badly still
 * widens the wardrobe.
 */
function rollDrop(source) {
  const meta = saves.loadMeta();
  const id = rollArmamentDrop(registries, rng, {
    source,
    found: meta.found || [],
    carried: carriedIds(run.loadout),
  });
  if (!id) return null;
  addToStorage(run.loadout, id, registries.balance.equipment.storageSlots || 8);
  if ((registries.balance.equipment.drops || {}).permanentOnFind) {
    meta.found = [...(meta.found || []), id];
    const progressionMode = shotState ? 'showcase' : isCustomRun(run.custom) ? 'custom' : 'normal';
    const recorded = recordArmamentDiscovery(meta, id, {
      progressionMode, source, runSeed: run.seedString,
      receiptLimit: registries.balance.equipment.startingKitDiscovery.receiptLimit,
    });
    saves.saveMeta(recorded.meta);
  }
  return id;
}

function finishRun(victory) {
  const result = runResult(victory);
  const meta = saves.recordResult(result);
  meta.progress = recordProgress(meta.progress, result);
  const fresh = evaluateUnlocks(registries.unlocks, meta);
  if (fresh.length) meta.unlocked = [...(meta.unlocked || []), ...fresh];
  saves.saveMeta(meta);
  return fresh.map((id) => registries.unlocks.find((u) => u.id === id)).filter(Boolean);
}

function showCustomize(slot = 1) {
  mountCustomize(app, {
    registries,
    meta: saves.loadMeta(),
    // A ?shot= boot gets a fixed seed so the field photographs identically on
    // every capture; a real boot still gets a random one.
    defaultSeedString: shotState === 'customize' ? 'SHOWCASE' : randomSeedString(),
    onBack: showTitle,
    onStart: (config) => newRun({ ...config, slot }),
  });
}

function showCustomRun(slot = 1) {
  mountCustomRun(app, {
    registries,
    defaultSeedString: randomSeedString(),
    onBack: showTitle,
    onStart: (config) => newRun({ ...config, slot }),
  });
}

// Draft deck builder (Custom Climb): pick cards, then start the climb.
function showDraft() {
  mountDraft(app, {
    registries,
    classId: run.class,
    rng,
    onDone: (picks) => {
      run.deck.push(...picks);
      startClimb();
    },
  });
}

/**
 * SETTINGS THAT ONLY THE MAP CAN SHOW YOU — redraw it under the open menu.
 *
 * Both settings doors apply their change immediately (`applyDisplaySettings`),
 * and that reaches everything expressed as a class or a custom property. The map
 * is not: its zoom and now its reveal mode are read ONCE, at mount, by
 * `mountMap`. So flipping Map reveal used to take effect on the next screen
 * change — which for the one setting whose whole purpose is a side-by-side is
 * the same as not working.
 *
 * Marina's ruling put the toggle in Settings precisely because that is the only
 * surface reachable while you are looking at the thing you are judging. This
 * function is what makes that sentence true. The overlay and the modal both
 * mount on `document.body`, so the map re-renders behind them and is there when
 * they close.
 *
 * NAMED KEYS, NOT "any settings change": a blanket re-mount would redraw the act
 * on every volume nudge, and `mountMap` re-runs the framing camera. The list is
 * the map's own reads — grep `meta.settings` in ui/screens/map.js and
 * model/mapknowledge.js and it is these two.
 */
const MAP_REMOUNT_KEYS = ['mapMode', 'mapZoom'];
function remountMapIfShowing(changed) {
  if (!run || !changed) return;
  if (!MAP_REMOUNT_KEYS.some((k) => k in changed)) return;
  if (!app.querySelector('.mapscreen')) return;
  showMap();
}

function showMap() {
  audio.music('map');
  mountMap(app, {
    registries,
    run,
    meta: saves.loadMeta(),
    onPick: enterNode,
    onSettings: showSettings,
    onMenu: showOverlay,
    onArmoury: showArmoury,
    onSave: () => {
      persist();
      return activeSlot;
    },
    onQuit: () => {
      persist(); // the run is resumable from its slot via Continue
      showTitle();
    },
  });
}

function enterNode(nodeId) {
  sfx.play('nodeTravel');
  const node = run.mapGraph.nodes[nodeId];
  run.mapNodeId = nodeId;
  run.path.push(nodeId);
  run.floor = node.floor;

  let kind = node.type;
  if (kind === 'event') {
    const res = node.resolved || { kind: 'fight' };
    if (res.kind === 'event') {
      run.seenEvents.push(res.eventId);
      persist();
      return showEvent(res.eventId);
    }
    kind = res.kind; // fight | shrine | treasure
  }

  switch (kind) {
    case 'monster':
    case 'fight':
      return startFight('normal', nodeId);
    case 'elite':
      return startFight('elite', nodeId);
    case 'boss':
      return startFight('boss', nodeId);
    case 'shrine':
      persist();
      return showRest();
    case 'merchant': {
      const stock = buildShopStock(registries, rng, run);
      const pm = shopPriceMult();
      if (pm !== 1) {
        for (const kind of ['cards', 'relics', 'flasks']) {
          for (const item of stock[kind]) item.cost = Math.ceil(item.cost * pm);
        }
        stock.removeCost = Math.ceil(stock.removeCost * pm);
      }
      run.shopStock = stock;
      persist();
      return showShop();
    }
    case 'treasure': {
      const relicId = rollRelicReward(registries, rng, run.relics);
      const armamentId = rollDrop('treasure');
      return mountRewards(app, {
        registries,
        run,
        rewards: { relicId, armamentId, title: 'TREASURE' },
        onDone: () => {
          persist();
          showMap();
        },
      });
    }
    default:
      throw new Error(`Unknown node kind '${kind}'`);
  }
}

// ---- combat ------------------------------------------------------------------------
// Custom Climb combat rules → generic createCombat options for a given pool.
function combatMods(pool) {
  const mods = run.custom ? activeMods(run.custom) : {};
  let hpMult = 1;
  const enemyStatuses = [];
  const playerStatuses = [];
  const cm = registries.balance.customMods;
  if ((pool === 'elite' || pool === 'boss') && mods.toughElites) hpMult *= cm.toughElitesHpMult;
  if (pool === 'boss' && mods.bigBosses) hpMult *= cm.bigBossesHpMult;
  if (mods.deadlyEnemies) enemyStatuses.push({ status: 'strength', stacks: 1 });
  if (mods.glassCannon) playerStatuses.push({ status: 'glassCannon', stacks: 1 });
  if (mods.endless) {
    const { loop } = endlessActInfo(run.actNumber);
    if (loop > 0) {
      hpMult *= 1 + ENDLESS_HP_PER_LOOP * loop;
      enemyStatuses.push({ status: 'strength', stacks: ENDLESS_STR_PER_LOOP * loop });
    }
  }
  return { hpMult, enemyStatuses, playerStatuses };
}

function startFight(pool, nodeId) {
  // "Elite Gauntlet" chaos rule promotes ordinary monster nodes to elites.
  if (pool === 'normal' && run.custom && activeMods(run.custom).allElite) pool = 'elite';
  const encounterId = rollEncounter(registries, rng, { pool, act: contentAct(), exclude: run.lastEncounters });
  if (pool === 'normal') {
    run.lastEncounters.push(encounterId);
    if (run.lastEncounters.length > 2) run.lastEncounters.shift();
  }
  enterCombat(nodeId, encounterId);
}

function enterCombat(nodeId, encounterId, { resuming = false } = {}) {
  run.combatEntered = { nodeId, encounterId };
  if (!resuming) persist(); // counters BEFORE the combat → reload restarts it identically
  const enc = registries.encounters.get(encounterId);
  audio.music(enc.pool === 'boss' ? 'boss' : enc.pool === 'elite' ? 'elite' : 'combat');
  const cm = combatMods(enc.pool);
  const combat = createCombat({
    registries,
    rng,
    player: {
      classId: run.class,
      attributes: run.attributes,
      maxHp: run.maxHp,
      hp: run.hp,
      maxMana: run.maxMana,
      mana: run.mana,
      maxStamina: run.maxStamina,
      stamina: run.stamina,
      energyMax: run.energyMax,
      drawPerTurn: run.drawPerTurn,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
      deck: run.deck,
      relicIds: run.relics,
      flasks: run.flasks,
      flaskCharges: run.flaskCharges,
      loadout: run.loadout,
    },
    enemyIds: enc.enemies,
    hpMult: cm.hpMult,
    enemyStatuses: cm.enemyStatuses,
    // WHICH SWAP PRICE THIS FIGHT IS UNDER (A8). Read once, here, at the same
    // point the other per-fight rules are decided — Settings → Advanced changes
    // it for the NEXT fight, which is what the row's note promises, and is why
    // there is no live re-read inside the swap.
    swapCostRule: resolveSwapCostRule(registries, saves.loadMeta()),
    // `self.*` mods (Strength from an oathsworn set, Regen from a warm habit)
    // enter through the same door Custom Climb buffs already used — the engine
    // has no equipment code, only statuses applied at combat start.
    playerStatuses: [...cm.playerStatuses, ...runMods(registries, run.loadout, run.class).startStatuses],
  });
  // `?shotHand=<n>` — STAND WITH A FULLER HAND.
  //
  // A REACH STATE, the same shape and reason as ?shotMaxHp beside it: the
  // hand-layout word (C2) is a claim about how the hand behaves ACROSS hand
  // sizes, and no instrument could pose one — every capture of the combat hand
  // was taken at the opening draw, so "ten cards fit with zero travel" had no
  // photograph and no measurement. The cards enter through drawCards, the door
  // every real draw enters (reshuffle and the handMax overflow included), not
  // through the renderer or the piles directly.
  //
  // LOUD at both edges: a non-integer or out-of-band ask refuses by name, and
  // a deck too small to reach the asked hand refuses rather than photograph an
  // eight-card hand labelled ten — a silent shortfall here would quietly turn
  // every downstream sliver measurement into a fact about a different hand.
  if (shotState === 'combat' && shotParams.has('shotHand')) {
    const wantHand = Number(shotParams.get('shotHand'));
    if (!Number.isInteger(wantHand) || wantHand < 1 || wantHand > combat.handMax) {
      throw new Error(`?shotHand=${shotParams.get('shotHand')}: needs a whole number from 1 to handMax (${combat.handMax}).`);
    }
    if (combat.piles.hand.length < wantHand) drawCards(combat, wantHand - combat.piles.hand.length);
    // Reaching DOWN goes through the discard op's own body (discardFromHand) —
    // the same splice, pile and event a played-down hand produces, so a small
    // posed hand carries its honest receipt: the discard pile shows where the
    // cards went.
    if (combat.piles.hand.length > wantHand) discardFromHand(combat, combat.piles.hand.length - wantHand);
    if (combat.piles.hand.length !== wantHand) {
      throw new Error(`?shotHand=${wantHand}: the deck ran out at ${combat.piles.hand.length} cards — this pose cannot reach the asked hand.`);
    }
  }
  if (shotState === 'combat' && shotParams.get('shotArcane') === 'matrix') {
    // A host-state visual fixture, before the renderer receives the combat.
    // It covers all three schema states without client mutation: two configured
    // meters (zero and nonzero) plus one enemy whose config is absent.
    const authored = registries.enemies.get('wanderingSoldier').arcaneExposure;
    if (combat.enemies.length < 3 || !authored || authored.mode !== 'configured') {
      throw new Error('?shotArcane=matrix needs three enemies and the authored Wandering Soldier Arcane Exposure row');
    }
    combat.enemies[0].arcaneExposure = { ...structuredClone(authored), value: 0 };
    combat.enemies[1].arcaneExposure = { ...structuredClone(authored), value: Math.max(1, Math.floor(authored.threshold / 2)) };
    delete combat.enemies[2].arcaneExposure;
  }
  const label =
    enc.pool === 'boss'
      ? registries.enemies.get(enc.enemies[0]).name.toUpperCase()
      : enc.pool === 'elite'
        ? `ELITE · FLOOR ${run.floor}`
        : `ACT ${run.actNumber} · FLOOR ${run.floor}`;
  mountCombat(app, {
    registries,
    run,
    combat,
    label,
    // The second-beat dial lives in meta.settings, and combat has two actions
    // in the table (End Turn, drinking a flask). Same read as the event screen.
    meta: saves.loadMeta(),
    onEnd: (result, endedCombat) => onCombatEnd(result, endedCombat, enc),
    onSettings: showSettings,
    onMenu: showOverlay,
    onSave: () => {
      persist();
      return activeSlot;
    },
    onQuit: () => {
      persist();
      showTitle();
    },
    showTutorial: !saves.loadMeta().settings.seenTutorial,
    onTutorialDone: () => {
      const meta = saves.loadMeta();
      meta.settings.seenTutorial = true;
      saves.saveMeta(meta);
    },
  });
  // Boss fights open on a name splash (skippable; not repeated on reload-resume).
  if (enc.pool === 'boss' && !resuming) {
    showBossIntro(
      { name: registries.enemies.get(enc.enemies[0]).name, act: run.actNumber },
      { hold: shotState === 'boss' }
    );
  }
}

function onCombatEnd(result, combat, enc) {
  run.flasks = combat.player.flasks; // drunk flasks stay drunk
  run.flaskCharges = combat.player.flaskCharges ? { ...combat.player.flaskCharges } : run.flaskCharges;
  // A weapon swapped mid-fight stays swapped: combat works on copies of the
  // deck's instances, so the run's own copies need the new numbers stamped in.
  stampDeck(registries, run);

  if (result !== 'victory') {
    audio.stopMusic();
    sfx.play('youDied');
    run.hp = 0;
    sendLanStatus({ dead: true });
    saves.clearRun(activeSlot);
    const earnedOnDeath = finishRun(false);
    return mountGameOver(app, { registries, game: run, victory: false, earned: earnedOnDeath, onTitle: showTitle, onHistory: showHistory });
  }

  run.hp = combat.player.hp;
  run.mana = combat.player.mana;
  run.stamina = combat.player.stamina;
  run.stats.fightsWon += 1;
  run.combatEntered = null;

  if (enc.pool === 'boss') {
    run.bossesBeaten = run.bossesBeaten || [];
    for (const id of enc.enemies) if (!run.bossesBeaten.includes(id)) run.bossesBeaten.push(id);
    // Endless Spire: no summit — the climb loops until death.
    if (run.actNumber >= 3 && !endlessOn()) {
      // The Blighted Valkyrie falls: the Sovereign Ember is restored.
      audio.music('victory');
      sendLanStatus({ victory: true });
      saves.clearRun(activeSlot);
      const earned = finishRun(true);
      return mountGameOver(app, { registries, game: run, victory: true, earned, onTitle: showTitle, onHistory: showHistory });
    }
    // Act boss down: boss rewards, then the climb continues.
    // A boss always drops an armament — unless you already own every one it
    // could give, in which case it pays out instead of dropping nothing.
    const bossArmament = rollDrop('boss');
    const drops = registries.balance.equipment.drops || {};
    const bossRewards = {
      title: `${registries.enemies.get(enc.enemies[0]).name.toUpperCase()} FALLS`,
      cinders: rollRuneReward(registries, rng, 'boss', run.relics) + (bossArmament ? 0 : drops.consolationCinders || 0),
      cardIds: rollCardRewardIds(registries, rng, { classId: run.class, pool: 'boss', relicIds: run.relics, flatRarity: chaosRewardsOn() }),
      relicId: rollRelicReward(registries, rng, run.relics, { rarities: ['boss'] }),
      armamentId: bossArmament,
    };
    return mountRewards(app, {
      registries,
      run,
      rewards: bossRewards,
      onDone: () => advanceAct(),
    });
  }

  const rewards = {
    title: enc.pool === 'elite' ? 'ELITE VANQUISHED' : 'VICTORY',
    cinders: rollRuneReward(registries, rng, enc.pool, run.relics),
    cardIds: rollCardRewardIds(registries, rng, { classId: run.class, pool: enc.pool, relicIds: run.relics, flatRarity: chaosRewardsOn() }),
    flaskId: rollFlaskDrop(registries, rng, run),
    relicId: enc.pool === 'elite' ? rollRelicReward(registries, rng, run.relics) : null,
    // Elites are the mid-run source of armaments; ordinary fights are not
    // (balance.equipment.drops.chance has no 'normal' key, so the roll is a
    // no-op there rather than a hidden 0%).
    armamentId: rollDrop(enc.pool),
  };
  mountRewards(app, {
    registries,
    run,
    rewards,
    onDone: () => {
      persist();
      showMap();
    },
  });
}

// Custom Climb helpers used across nodes.
function chaosRewardsOn() {
  return !!(run.custom && activeMods(run.custom).chaosRewards);
}
function shopPriceMult() {
  const mods = run.custom ? activeMods(run.custom) : {};
  let m = 1;
  if (mods.expensiveShops) m *= registries.balance.customMods.expensiveShopsMult;
  if (mods.hoarder) m *= registries.balance.customMods.hoarderShopMult;
  return m;
}

// ---- non-combat nodes -----------------------------------------------------------------
function showRest() {
  audio.music('rest');
  const healMult = run.custom && activeMods(run.custom).lessHealing ? registries.balance.customMods.lessHealingMult : 1;
  // AUTOMATIC, AND IT HAPPENS BEFORE THE CHOICE. Constantine: "flasks should
  // refill automatically at graces". Not a third option beside Rest and Smith —
  // arriving is the trigger, so a run that comes to smith is refilled exactly
  // like a run that comes to rest. The counts come from balance.graceRefill
  // through the Advanced debug rows; `bad` is a stored override that is not on
  // the ladder, and it is named in the command log rather than swallowed
  // (the same treatment applyTapSize gives a bad tapFloor).
  const { counts, bad } = resolveGraceRefill(saves.loadMeta().settings || {});
  for (const b of bad) {
    dlog('ERROR', `settings.${b.key}: stored value ${JSON.stringify(b.stored)} is not one of the counts this row offers — using ${b.used}.`);
  }
  const refill = applyGraceRefill(registries, run, { counts });
  if (refill.total) persist();
  mountRest(app, {
    registries,
    run,
    healMult,
    refill,
    meta: saves.loadMeta(),
    onReallocate: () => persist(),
    onDone: () => {
      persist();
      showMap();
    },
  });
}

function showShop() {
  audio.music('shop');
  mountShop(app, {
    registries,
    run,
    meta: saves.loadMeta(),
    onChanged: () => persist(),
    onLeave: () => {
      run.shopStock = null;
      persist();
      showMap();
    },
  });
}

function showEvent(eventId) {
  mountEvent(app, {
    registries,
    run,
    // The hold-to-confirm dial lives in meta.settings; the screen reads it the
    // same way every other screen reads a display setting.
    meta: saves.loadMeta(),
    rng,
    eventId,
    onDone: () => {
      if (run.combatEntered) {
        // A startCombat effect stored the encounter id (string form).
        const encounterId = typeof run.combatEntered === 'string' ? run.combatEntered : run.combatEntered.encounterId;
        run.combatEntered = null;
        return enterCombat(run.mapNodeId, encounterId);
      }
      persist();
      showMap();
    },
  });
}

// Dev screenshot hook (?shot=map|combat|fx|death): boot straight into a seeded
// showcase run so headless captures (tools/screenshot.mjs) can photograph
// deeper screens without interaction. `fx` poses the combat FX frozen
// mid-animation (negative animation-delay + paused) so the transient slash /
// glyph / spark / recoil effects are photographable. `death` mounts the game-over
// screen on a spent run — added because YOU PERISHED was the one screen no tool
// could photograph, so its contrast could only ever be inferred from the
// stylesheet, and an inferred number is the adjacent thing, not the thing.
// Normal boots unaffected.
//
// `shotState` is declared beside pickStorage() near the top of this file, not
// here, because storage selection reads it: a ?shot= boot runs on memory storage
// so it cannot touch the player's save. See the comment there for what it broke.
// That gate is `if (shotState)` — truthy, not a list of states — so `death` is
// inside it by construction and needs no guard of its own. Do not re-read
// location.search down here to add a state: the single const IS the gate's reach.

function poseFxShowcase() {
  const layer = document.querySelector('.fx-layer');
  const enemies = [...document.querySelectorAll('.combatant.enemy .sprite')];
  const player = document.querySelector('.combatant.player .sprite');
  if (!layer || !enemies.length || !player) return;
  // Container: THE FX LAYER — these are `position: absolute` children of
  // `.fx-layer`, so the layer is the containing block and the bound, NOT the
  // viewport (the layer is `inset: 0` over the combat board only).
  //
  // EldenSpire#15 listed this site as "already differences a rect against the
  // layer's own rect — may be correct." It was not. Differencing two visual rects
  // gives a visual delta, and `style.left` reads local: byte-for-byte the deviant
  // removed from tutorial.js in 3a0def9, missing only the `/ z`. Measured at seven
  // viewports: the miss runs from −400 local px at zoom 0.62 to +822 at 1.70, dead
  // on only at 1.00, and at 1.48 and above two of the five elements sat outside the
  // layer entirely. Dev-only (`?shot=fx`) — so no player saw it, and every
  // screenshot this repo has ever used as evidence did.
  //
  // `anchorLocalBox` is exactly this arithmetic with the conversion in it, so the
  // hand-rolled copy goes and the one home takes it. The dx/dy extras were already
  // local px, authored in the same space as fx.js floatNum's own −14, and stay.
  const view = anchorLocalBox(layer, layer);
  const put = (cls, text, anchor, atMs, extra) => {
    const b = anchorLocalBox(layer, anchor);
    const el = document.createElement('div');
    el.className = cls;
    if (text) el.textContent = text;
    const at = clampBox(
      {
        left: b.left + b.width / 2 + ((extra && extra.dx) || 0),
        top: b.top + b.height * 0.4 + ((extra && extra.dy) || 0),
        width: 0, // a point, not a box: these elements are centred by their own CSS
        height: 0,
      },
      view,
      { pad: 0 }
    );
    el.style.left = `${at.left}px`;
    el.style.top = `${at.top}px`;
    el.style.animationDelay = `-${atMs}ms`; // jump mid-animation…
    el.style.animationPlayState = 'paused'; // …and hold the frame
    layer.appendChild(el);
  };
  const e0 = enemies[0];
  const e1 = enemies[1] || enemies[0];
  put('fx-slash', '', e0, 120);
  put('float-num crit', '-26', e0, 200, { dy: -34 });
  put('fx-spark', '✦', e1, 140);
  put('float-num blk small', 'BLOCKED', e1, 220, { dy: -30 });
  put('fx-glyph', '✦', player, 170);
  // Victim recoil held mid-knockback; the second enemy teeters (stagger).
  e0.classList.add('hitflash', 'hit-heavy');
  if (e0.firstElementChild) {
    e0.firstElementChild.style.animationDelay = '-95ms';
    e0.firstElementChild.style.animationPlayState = 'paused';
  }
  if (e1 !== e0) {
    e1.classList.add('wobble');
    if (e1.firstElementChild) {
      e1.firstElementChild.style.animationDelay = '-110ms';
      e1.firstElementChild.style.animationPlayState = 'paused';
    }
  }
}

// Co-op screenshot states (?shot=coop|coopmap): mount the LAN thin client with
// a canned server snapshot through a stub socket — no server/second player
// needed — so the co-op board/map can be photographed like the solo shots.
function coopStubMount(snapshot, myId) {
  const stub = { _h: null, setHandlers(h) { this._h = h; }, send() {}, close() {}, get open() { return false; } };
  mountCoop(app, { registries, conn: stub, myId, meta: saves.loadMeta(), onLeave() {} });
  if (stub._h && stub._h.onMessage) stub._h.onMessage({ t: 'state', snapshot });
}
function coopCombatShot() {
  const hand = ['strike', 'rallyingBanner', 'defend', 'defend', 'stomp'].map((cardId, i) => ({ instanceId: `h${i}`, cardId, upgraded: i === 4 }));
  const party = [
    { id: 'p1', name: 'Wren', classId: 'starseer', connected: true, alive: true, hp: 61, maxHp: 72, mana: 1, maxMana: 2, stamina: 2, maxStamina: 2, cinders: 45, deckSize: 12, relics: 1, flasks: 1, catchup: 0, catchupQueue: [] },
    { id: 'p2', name: 'Fenn', classId: 'reaver', connected: true, alive: true, hp: 84, maxHp: 84, mana: 2, maxMana: 2, stamina: 2, maxStamina: 2, cinders: 30, deckSize: 10, relics: 1, flasks: 0, catchup: 0, catchupQueue: [] },
  ];
  const snapshot = {
    actNumber: 1, floor: 3, seedString: 'SHOWCASE', endless: false,
    scene: {
      kind: 'combat', pool: 'normal', phase: 'player', turn: 2, headcount: 2,
      enemies: [
        { id: 'e1', enemyId: 'blightHound', hp: 13, maxHp: 30, block: 0, alive: true, intent: { kind: 'attack', moveId: 'bite', damage: 6, hits: 1, delayed: false }, statuses: { bleed: { meter: { value: 4, max: 12 } } }, poiseMeter: { value: 4, max: 10 } },
        { id: 'e2', enemyId: 'blightHound', hp: 30, maxHp: 30, block: 5, alive: true, intent: { kind: 'block', moveId: 'guard', block: 5 }, statuses: {}, poiseMeter: { value: 0, max: 10 } },
        { id: 'e3', enemyId: 'graveWisp', hp: 22, maxHp: 22, block: 0, alive: true, intent: { kind: 'attack', moveId: 'hex', damage: 4, hits: 2, delayed: true }, statuses: { vulnerable: { stacks: 1 } }, poiseMeter: { value: 0, max: 8 } },
      ],
      players: [
        { id: 'p1', hp: 61, maxHp: 72, mana: 1, maxMana: 2, stamina: 2, maxStamina: 2, block: 8, energy: 2, energyMax: 3, connected: true, alive: true, ended: false, statuses: { strength: { stacks: 1 } }, stanceId: null, hand, drawCount: 5, discardCount: 2, flasks: [], flaskCharges: { capacity: 3, hp: 2, mana: 1, hpCurrent: 2, manaCurrent: 1 } },
        { id: 'p2', hp: 84, maxHp: 84, mana: 2, maxMana: 2, stamina: 2, maxStamina: 2, block: 0, energy: 3, energyMax: 3, connected: true, alive: true, ended: true, statuses: {}, stanceId: null, hand: [], drawCount: 6, discardCount: 1, flasks: [], flaskCharges: { capacity: 3, hp: 2, mana: 1, hpCurrent: 2, manaCurrent: 1 } },
      ],
    },
    party,
  };
  if (shotParams.get('shotArcane') === 'matrix') {
    const [locked, immune] = snapshot.scene.enemies;
    locked.arcaneExposure = {
      mode: 'configured', threshold: 8, value: 0, buildupMultiplier: 1,
      resetMode: 'zero', overflowPolicy: 'discard', lockPolicy: 'whileMagicVulnerable',
      onBreak: { status: 'magicVulnerable', value: 25, duration: 2 },
    };
    locked.statuses.magicVulnerable = { stacks: 25, duration: 2 };
    immune.arcaneExposure = { mode: 'immune' };
    snapshot.scene.events = [
      { type: 'arcaneBreak', targetId: locked.id, status: 'magicVulnerable', value: 25, duration: 2 },
      { type: 'arcaneExposureRefused', targetId: immune.id, reason: 'immune', school: 'magic', attempted: 1 },
    ];
  }
  return snapshot;
}
// `?shot=coopmap[&shotWalk=N]` — the co-op act map, at the doors or MID-CLIMB.
//
// `shotWalk` is the same pose `?shotAt` / `?shotWalk` give the solo map, and it
// is here for the same reason those exist: every co-op map measurement this repo
// has taken was taken at the ENTRANCE ROW, because that was the only co-op map
// position anything could open. That is why nobody noticed the co-op map never
// drew `cursorId` — at the doors there IS no current node, so the missing mark
// was invisible to every instrument and to every screenshot.
//
// The walk is the solo one's, deliberately not a second algorithm: from the
// lowest-numbered entrance, take the lowest-numbered `next` each step. It uses
// the graph's own edges, so a pose this produces is a pose a party could
// actually be in. Running out of graph is LOUD.
function coopMapShot(steps = 0) {
  newRun({ classId: 'reaver', seedString: 'SHOWCASE', slot: 1 });
  const g = run.mapGraph;
  const nodeType = (n) => (n.type === 'event' ? 'unknown' : n.type);
  let cursorId = null;
  let reachableIds = g.startIds.slice();
  let floor = 0;
  if (steps > 0) {
    let id = [...g.startIds].sort()[0];
    for (let i = 1; i < steps; i++) {
      const next = [...(g.nodes[id].next || [])].sort();
      if (!next.length) throw new Error(`?shotWalk=${steps}: this act runs out at step ${i} (${id} has nowhere to go). The boss is the last node; ask for fewer steps.`);
      id = next[0];
    }
    cursorId = id;
    floor = g.nodes[id].floor;
    reachableIds = [...(g.nodes[id].next || [])];
  }
  return {
    actNumber: 1, floor, seedString: 'SHOWCASE', endless: false,
    // Fenn has already voted; Wren (you) is still deciding.
    scene: { kind: 'map', votes: { p2: reachableIds[1] || reachableIds[0] } },
    // THE PARTY'S POSITION, and it has always been on the real snapshot
    // (tools/session.mjs) — the client just never drew it.
    cursorId,
    reachableIds,
    map: { floors: g.floors, columns: g.columns, startIds: g.startIds, bossId: g.bossId, nodes: Object.values(g.nodes).map((n) => ({ id: n.id, type: nodeType(n), floor: n.floor, col: n.col, next: n.next })) },
    party: [
      { id: 'p1', name: 'Wren', classId: 'starseer', connected: true, alive: true, hp: 61, maxHp: 72, catchupQueue: [] },
      { id: 'p2', name: 'Fenn', classId: 'reaver', connected: true, alive: true, hp: 84, maxHp: 84, catchupQueue: [] },
    ],
  };
}

function coopShotParty() {
  return [
    { id: 'p1', name: 'Wren', classId: 'starseer', connected: true, alive: true, hp: 61, maxHp: 72, cinders: 45, deckSize: 12, relics: 1, flasks: 1, catchup: 0, catchupQueue: [] },
    { id: 'p2', name: 'Fenn', classId: 'reaver', connected: true, alive: true, hp: 84, maxHp: 84, cinders: 30, deckSize: 10, relics: 1, flasks: 0, catchup: 0, catchupQueue: [] },
  ];
}
function coopRewardShot() {
  return {
    actNumber: 1, floor: 4, seedString: 'SHOWCASE', endless: false,
    scene: { kind: 'reward', pool: 'elite', chosen: {}, afterReward: null, offers: { p1: { pool: 'elite', cardIds: ['stomp', 'executioner', 'crimsonCleave'], cinders: 32, flaskId: 'crimsonFlask', relicId: 'forsakenMedallion' } } },
    party: coopShotParty(),
  };
}
function coopShrineShot() {
  return { actNumber: 1, floor: 5, seedString: 'SHOWCASE', endless: false, scene: { kind: 'shrine', done: {} }, party: coopShotParty() };
}
function coopCatchupShot() {
  const party = coopShotParty();
  party[0].catchup = 2;
  party[0].catchupQueue = [
    { type: 'reward', act: 1, floor: 2, offer: { pool: 'normal', cardIds: ['guardCounter', 'rend', 'gildedOath'], relicId: 'forsakenMedallion' } },
    { type: 'treasure', act: 1, floor: 3, relicId: 'forsakenMedallion' },
  ];
  return { actNumber: 1, floor: 6, seedString: 'SHOWCASE', endless: false, scene: { kind: 'map' }, reachableIds: [], map: null, party };
}

// Dev-only float probe (#69). Screenshot modes are already dev-only, and this
// hands the harness the REAL floatNum so a clipping assertion measures the
// shipped path — including the multi-codepoint strings, where any width GUESS
// lies worst. Never reachable without a ?shot= URL.
if (shotState) {
  // `which` picks the anchor: 'last' is the RIGHTMOST combatant, which is where
  // the clipping lives — a probe anchored to the leftmost cannot reproduce the
  // defect and would be a green that can't fail.
  window.__fxProbe = (text, cls = 'dmg', which = 'last') => {
    const layer = document.querySelector('.fx-layer');
    const all = [...document.querySelectorAll('[data-eid]')]
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const host = which === 'first' ? all[0] : all[all.length - 1];
    const anchorEl = host && (host.querySelector('.sprite') || host);
    if (layer && anchorEl) fxFloatNum(layer, anchorEl, text, cls);
  };
}

if (shotState === 'map' || shotState === 'combat' || shotState === 'fx' || shotState === 'boss' || shotState === 'death' || shotState === 'rest' || shotState === 'event' || shotState === 'shop') {
  // Suppress the first-run tutorial so captures show a clean board.
  const shotMeta = saves.loadMeta();
  shotMeta.settings.seenTutorial = true;
  saves.saveMeta(shotMeta);
  // `?shotSeed=<string>` — ONE MAP IS NOT THE MAP (EldenSpire#28).
  //
  // Every reachability measurement this repo has taken of the act map was taken
  // on the seed literal that used to sit here, so "0 covered at 390x844" was a
  // fact about ONE map graph. Node positions are a function of the seed; a node
  // trapped under a floating button is a coincidence between the two; and a
  // coincidence measured once is an anecdote. tools/mapreach.mjs sweeps seeds
  // because of this line, and the default is unchanged so every existing
  // capture and every existing sweep still means what it meant.
  //
  // Read through `shotParams`, the single const declared beside pickStorage() —
  // NOT a fresh location.search read, which the note up there forbids, for the
  // reason it gives: that const IS the gate's reach.
  newRun({ classId: 'reaver', seedString: shotParams.get('shotSeed') || 'SHOWCASE', slot: 1 });
  // `?shotAt=<nodeId|floor:N>` — STAND SOMEWHERE ON THE MAP.
  //
  // A REACH STATE, same shape and same reason as `?shotEvent` above. Every map
  // measurement this repo has ever taken was taken at the entrance row, because
  // that is the only map position any instrument could open — so "the framing
  // hides a next-step option" was 12 numbers about one screen out of thirteen.
  // The framing MID-CLIMB is a different problem with a different shape (the
  // fan-out from one node, not the spread of the doors), and it could not be
  // measured at all. `floor:N` picks a node on that floor rather than naming an
  // id, so a sweep can walk the act without knowing the graph first.
  const shotAt = shotState === 'map' ? shotParams.get('shotAt') : null;
  if (shotAt) {
    const g = run.mapGraph;
    const byFloor = /^floor:(\d+)$/.exec(shotAt);
    const at = byFloor
      ? Object.values(g.nodes).filter((n) => n.floor === Number(byFloor[1])).map((n) => n.id)[0]
      : (g.nodes[shotAt] ? shotAt : null);
    if (!at) throw new Error(`?shotAt=${shotAt}: no such node in this act. Use a node id (n4_2) or floor:N — a silent fallback here would report a framing measured somewhere else.`);
    run.mapNodeId = at;
    run.floor = g.nodes[at].floor;
    run.path = [at];
    showMap();
  }
  // `?shotWalk=<n>` — STAND SOMEWHERE WITH A TRAIL BEHIND YOU.
  //
  // A REACH STATE, and the third of the same shape (`?shotEvent`, `?shotAt`).
  // `?shotAt` teleports: it sets `run.path = [at]`, a path of length one, which
  // is the right answer for a FRAMING measurement and the wrong one for
  // everything about fog. Fog is a function of the trail — "previously visited
  // locations remain revealed" — so a map posed with no history can only ever
  // photograph the first frame of it, and the one claim worth photographing is
  // that the light MOVES and the trail STAYS.
  //
  // It walks the graph rather than naming nodes: from the first entrance, take
  // the lowest-numbered `next` each step, n times. Deterministic given the seed,
  // so two runs of the camera produce the same picture; and it uses the graph's
  // own edges, so a walk this produces is a walk a player could have taken —
  // a hand-written path list would eventually name an edge that does not exist
  // and pose a state the game cannot reach.
  const shotWalk = shotState === 'map' ? shotParams.get('shotWalk') : null;
  if (shotWalk != null) {
    if (shotAt) throw new Error('?shotWalk and ?shotAt both set: they pose the same thing two ways. Use one — shotAt teleports, shotWalk leaves a trail.');
    const steps = Number(shotWalk);
    if (!Number.isInteger(steps) || steps < 1) {
      throw new Error(`?shotWalk=${shotWalk}: needs a positive whole number of steps. A silent fallback would photograph a different map than the one asked for.`);
    }
    const g = run.mapGraph;
    let id = [...g.startIds].sort()[0];
    const walked = [id];
    for (let i = 1; i < steps; i++) {
      const next = [...(g.nodes[id].next || [])].sort();
      // Running out of graph is LOUD. A walk that quietly stopped short would
      // hand back a screenshot of floor 4 labelled floor 9, and the reader would
      // have no way to tell.
      if (!next.length) throw new Error(`?shotWalk=${steps}: this act runs out at step ${i} (${id} has nowhere to go). The boss is the last node; ask for fewer steps.`);
      id = next[0];
      walked.push(id);
    }
    run.mapNodeId = id;
    run.floor = g.nodes[id].floor;
    run.path = walked;
    showMap();
  }
  if (shotState === 'death') {
    // A run that ended on floor 4 with a few fights behind it, so the stats
    // table has real numbers under the title instead of a row of zeroes.
    run.floor = 4;
    run.stats.fightsWon = 3;
    run.stats.damageDealt = 214;
    run.stats.damageTaken = 96;
    run.hp = 0;
    mountGameOver(app, { registries, game: run, victory: false, earned: [], onTitle: showTitle, onHistory: showHistory });
  } else if (shotState === 'boss') {
    // Straight into the act-1 boss; the intro card is held for the camera.
    enterCombat(run.mapGraph.startIds[0], 'bossOmen');
  } else if (shotState === 'event') {
    // A REACH STATE, and the precedent is `rest` directly below — added for the
    // identical reason and quoting its own words: "one state for the one screen
    // being fixed, so the fix has a picture instead of an assertion." The event
    // screen is one of the screens no instrument this repo owns can open, which
    // is why 24 of 24 of its choice bars sat under the tap floor with nothing
    // ever regressing against it (Sunna's run-loop sweep). That COUNT is the
    // census card and is not touched here.
    //
    // `graveOfTheNameless` on purpose: three choices, and the last one is
    // "Leave" sitting 9-11 px under a choice with a real and irreversible
    // consequence. It is the exact adjacency the fix is about, so the picture
    // shows the thing rather than a friendlier event that happens to have three
    // bars. `?shotEvent=<id>` overrides it, through the one `shotParams` const.
    const evId = shotParams.get('shotEvent') || 'graveOfTheNameless';
    showEvent(evId);
  } else if (shotState === 'rest') {
    // A REACH STATE, not the denominator. Constantine could not scroll the
    // Smith grid on a phone; the reason nobody caught it is that the Shrine is
    // one of seven player-facing screens no instrument we own can open, so
    // there was never a baseline to regress against. That COUNT — sixteen
    // screens mounted against nine ?shot= states — is Bjorn's card and is not
    // touched here. This is one state for the one screen being fixed, so the
    // fix has a picture instead of an assertion.
    //
    // POSED MID-CLIMB ON PURPOSE, because the defect is a function of HOW MANY
    // cards the grid holds and a fresh 10-card deck may not overflow at all.
    // Ten more from the class's own authored pool, in authored order — no rng,
    // so the grid photographs identically every run — gives the twenty-card
    // deck the bug was reproduced on.
    run.floor = 8;
    run.deck.push(...createDeck(registries.classes.get(run.class).cardPool.slice(0, 10), createIdGen('shot')));
    showRest();
  } else if (shotState === 'shop') {
    // A REACH STATE, and the fourth of the same shape (`?shotEvent`, `?shotAt`,
    // `?shot=rest`). The merchant is one of the screens no instrument this repo
    // owns can open, which is why "burn a card out of the deck for good, one
    // tap, no confirm" sat in shipped code with nobody's number against it —
    // the same reason the Shrine's Smith grid overflowed a phone unseen.
    //
    // POSED WITH A DECK WORTH REMOVING FROM and a purse that can pay: the
    // remove grid only renders at `cinders >= removeCost && deck.length > 1`,
    // so a fresh run (0 cinders) mounts the screen with the one control this
    // state exists to reach ABSENT — a green on nothing, which is the
    // wrong-place empty SOP 2 calls malformed.
    run.floor = 8;
    run.deck.push(...createDeck(registries.classes.get(run.class).cardPool.slice(0, 10), createIdGen('shot')));
    run.cinders = 999;
    run.shopStock = buildShopStock(registries, rng, run);
    showShop();
  } else if (shotState === 'combat' || shotState === 'fx') {
    // `?shotMaxHp=<n>` — STAND AT A DIFFERENT MAXIMUM.
    //
    // A REACH STATE, exactly the shape and reason as ?shotAt and ?shotEvent
    // above. His bar-scaling rule ("the size of that bar should scale depending
    // on the max total") is a claim about how the HUD behaves ACROSS maxima,
    // and no instrument could vary a maximum: every capture this repo has ever
    // taken of the combat HUD was taken at the reaver's 84. One max is not the
    // scale, in the same way one map is not the map. This is the lever
    // tools/hudbars.mjs sweeps, and the proof that the bar length tracks the
    // number is worth nothing without it.
    //
    // It moves the RUN's maxHp, which is the same field a curse and an armour
    // mod move (actions.js:549, loadout.js runMods) — so the value enters
    // through the door a real maximum enters, not through the renderer.
    const shotMaxHp = Number(shotParams.get('shotMaxHp'));
    if (Number.isFinite(shotMaxHp) && shotMaxHp > 0) {
      run.maxHp = Math.floor(shotMaxHp);
      run.hp = Math.min(run.hp, run.maxHp);
    }
    // Current mana enters through the run, before combat entity creation; the
    // renderer never receives a fabricated value.
    const shotMana = Number(shotParams.get('shotMana'));
    if (shotParams.has('shotMana') && Number.isFinite(shotMana)) {
      run.mana = Math.max(0, Math.min(run.maxMana, Math.floor(shotMana)));
    }
    const shotMaxMana = Number(shotParams.get('shotMaxMana'));
    if (Number.isFinite(shotMaxMana) && shotMaxMana > 0) {
      run.maxMana = Math.floor(shotMaxMana);
      run.mana = Math.min(run.mana, run.maxMana);
    }
    const shotMaxStamina = Number(shotParams.get('shotMaxStamina'));
    if (Number.isFinite(shotMaxStamina) && shotMaxStamina > 0) {
      run.maxStamina = Math.floor(shotMaxStamina);
      run.stamina = Math.min(run.stamina, run.maxStamina);
    }
    // TWO FLASKS IN THE POSE, ONE OF EACH KIND, AND IT IS NOT DRESSING. A
    // drunk flask does not come back this climb, and `useFlask` is a row in the
    // second-beat table — but a board with an EMPTY flask row draws no flask
    // control at all, so the census could not tell "this action is not wired"
    // from "this pose has nothing to press". Those two readings are opposite
    // and looked identical. An untargeted flask owes a hold, a targeted one
    // does not (it enters aim mode, which is already a second beat), so the
    // pose carries one of each and the check sees both cells of the row.
    run.flasks = [{ flaskId: 'crimsonFlask' }, { flaskId: 'blightCoating' }];
    const g = run.mapGraph;
    const startId = g.startIds.find((id) => g.nodes[id].type === 'monster') || g.startIds[0];
    if (shotParams.get('shotArcane') === 'matrix') enterCombat(startId, 'packHunt');
    else enterNode(startId);
    if (shotState === 'fx') setTimeout(poseFxShowcase, 1600);
  }
} else if (shotState === 'coop') {
  coopStubMount(coopCombatShot(), 'p1');
} else if (shotState === 'coopmap') {
  const w = shotParams.get('shotWalk');
  if (w != null && !(Number.isInteger(Number(w)) && Number(w) >= 1)) {
    throw new Error(`?shotWalk=${w}: needs a positive whole number of steps. A silent fallback would photograph a different map than the one asked for.`);
  }
  coopStubMount(coopMapShot(w == null ? 0 : Number(w)), 'p1');
} else if (shotState === 'coopreward') {
  coopStubMount(coopRewardShot(), 'p1');
} else if (shotState === 'coopshrine') {
  coopStubMount(coopShrineShot(), 'p1');
} else if (shotState === 'coopcatchup') {
  coopStubMount(coopCatchupShot(), 'p1');
} else if (shotState === 'compendium') {
  // A ?shot= STATE, AND THAT IS THE POINT (Marina's condition on #78, and Rune's
  // census). tools/release-shots.mjs derives its denominator from the states
  // this file declares, and tools/screenreach.mjs can only reach a screen that
  // has one — so a new screen without a shot state is a screen no instrument
  // owns, which is the eight the census already counts. The seeded variant
  // (?shot=compendium&shotFound=…) photographs the other edge: what the screen
  // looks like once pieces are yours. Both edges, both shapes.
  const found = new URLSearchParams(location.search).get('shotFound');
  const meta = saves.loadMeta();
  if (found != null) meta.found = found ? found.split(',') : [];
  mountCompendium(app, { registries, meta, onBack: showTitle });
} else if (shotState === 'customize') {
  // EldenSpire#29 slice 1. The character-creation screen had no ?shot= state,
  // and #29's own boundary records what that cost: no sweep can open a screen
  // it cannot reach, so customize went unexamined for the whole week combat
  // was measured three times over. A seed is passed rather than randomised so
  // the seed field photographs the same on every run.
  showCustomize(1);
} else {
  showTitle();
}
