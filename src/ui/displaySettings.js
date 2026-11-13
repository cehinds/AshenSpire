// src/ui/displaySettings.js — the display-settings cluster, moved out of
// src/main.js (code review H4 seam c): the HUD token projection, the UI-scale /
// layout decider, the tap-size and card-size custom properties, and
// applyDisplaySettings itself. All of it is CSS-property / attribute / class
// application on <html> and <body>. Persistence, registries and screen mounting
// stay in main.js and are handed in once through configureDisplaySettings().
// No import-time side effects: the global listeners register from
// installDisplaySettings() / installCardSizeResize(), which main.js calls at the
// spots the inline registrations used to sit.
import { applyViewViewport, resolveViewViewport, VIEW_PRESETS } from './viewViewport.js';
import { formFactorFor } from './models/FormFactorModel.js';
import { applyHudVisibility } from './models/HudVisibilityModel.js';
import { cardLevelsWithOverrides, cardLevelCssPropertiesFor, cardShelfCssProperties, restingWidthPx, levelRestingWidthPx } from './models/CardSizeModel.js';
import { applyLoreType } from './models/LoreTypeModel.js';
import { refreshCardDoorShape } from './components/cardInspection.js';
import { setSpritesEnabled } from './assets.js';
import { setCombatPacing } from './animationPace.js';
import { setAnimSpeed } from './fx.js';
import { resolveMusicEnabled, AUDIO_DEFAULTS } from './audio.js';
import { SHIPPED_MUSIC_FOLDER } from '../content/music.js';
import { resolvePerformanceMode, resolveCombatPacing, effectsEnabled, motionFlags, coarsePointer } from './performance.js';
import { clearPosePreloads } from './services/posePreloads.js';
import { scheduleCardFits } from './components/card.js';
import { updateUprightGate } from './components/upright.js';
import { dlog } from './debuglog.js';
import { applyCardArtStyle } from './cardArtStyle.js';
import { applyDisplayAppearance } from './displayAppearance.js';
import { applyArtQuality } from './highResArt.js';
import { applyArtTier } from './artTier.js';
import { presentationConfig } from '../model/advancedConfig.js';
import { configureTooltipSettings } from './components/tooltip.js';
import { setQuickNav } from './components/quicknav.js';
import { settingOn, settingsRow, resolveTapSize, showSettingsNotice, clearSettingsNotice, resolveArmamentsPresentation, resolveArmamentsPhonePlacement } from './screens/settings.js';
import { applyWireframeChoices } from './wireframeChoices.js';
import { restampModalWireframes } from './components/modalShell.js';
import { restampWorkspaceFrames } from './components/w1Workspace.js';
import { replanCategoryNavs } from './kit/categoryNav.js';

// Handed in once by main.js (configureDisplaySettings), before first use.
let UI;          // registries.balance.ui
let UI_NAMED;    // UI.uiScale.named
let ACCENTS;     // UI.accents
let audio;       // the audio handle (setVolumes)
let bootMusic;   // musicHold(...): apply(folder, { indexed })
let saves;       // the save manager (loadMeta), read by reflexAutoScale
let getActiveSettings = () => ({});
// The last music folder applied, so an unrelated tweak does not re-fetch.
let lastMusicFolder;

export function configureDisplaySettings(deps) {
  UI = deps.ui;
  UI_NAMED = UI.uiScale.named;
  ACCENTS = UI.accents;
  audio = deps.audio;
  bootMusic = deps.bootMusic;
  saves = deps.saves;
  getActiveSettings = deps.getActiveSettings;
}

// Boot-time projection of balance.ui.hudPresentation / hudQuickSettings onto <html>.
export function projectHudPresentation(UI) {
  const HUD_PRESENTATION = UI.hudPresentation || {};
  const projectHudToken = (key, min, max, cssName, unit) => {
    const value = Number(HUD_PRESENTATION[key]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`balance.ui.hudPresentation.${key} must be in [${min}, ${max}], got ${JSON.stringify(HUD_PRESENTATION[key])}`);
    }
    document.documentElement.style.setProperty(cssName, `${value}${unit}`);
  };
  projectHudToken('componentBackgroundOpacityPct', 0, 100, '--hud-component-background-opacity', '%');
  projectHudToken('metadataFontPx', 8, 24, '--hud-metadata-font-px', 'px');
  projectHudToken('beltItemGapPx', 0, 12, '--hud-belt-item-gap-px', 'px');
  projectHudToken('portraitScale', 0.5, 1, '--hud-portrait-scale', '');
  projectHudToken('primaryRowGapPx', 0, 24, '--hud-primary-row-gap-px', 'px');
  projectHudToken('controlGapPx', 0, 12, '--hud-control-gap-px', 'px');
  projectHudToken('resourceRowGapPx', 0, 12, '--hud-resource-row-gap-px', 'px');
  projectHudToken('panelPadPx', 0, 12, '--hud-panel-pad-px', 'px');
  projectHudToken('mobilePanelPadPx', 0, 12, '--hud-mobile-panel-pad-px', 'px');
  projectHudToken('mobileControlGapPx', 0, 12, '--hud-mobile-control-gap-px', 'px');
  projectHudToken('mobileOuterPadPx', 0, 12, '--hud-mobile-outer-pad-px', 'px');
  projectHudToken('mobileRowGapPx', 0, 12, '--hud-mobile-row-gap-px', 'px');
  projectHudToken('cindersMaxWidthPct', 20, 40, '--hud-cinders-max-width', 'vw');
  projectHudToken('metadataMaxWidthPct', 20, 40, '--hud-metadata-max-width', 'vw');
  if (typeof HUD_PRESENTATION.metadataShowTotals !== 'boolean') {
    throw new Error(`balance.ui.hudPresentation.metadataShowTotals must be boolean, got ${JSON.stringify(HUD_PRESENTATION.metadataShowTotals)}`);
  }
  document.documentElement.dataset.hudMetadataShowTotals = String(HUD_PRESENTATION.metadataShowTotals);
  const HUD_QUICK_SETTINGS = UI.hudQuickSettings || {};
  for (const [key, cssName] of [
    ['edgeGapPx', '--hud-quick-edge-gap'],
    ['stackGapPx', '--hud-quick-stack-gap'],
    ['cardSizePx', '--hud-quick-card-size'],
    ['glyphSizePx', '--hud-quick-glyph-size'],
    ['stateDotPx', '--hud-quick-state-dot'],
    ['activeTintPct', '--hud-quick-active-tint'],
  ]) {
    document.documentElement.style.setProperty(cssName, `${HUD_QUICK_SETTINGS[key]}px`);
  }
  document.documentElement.dataset.hudQuickCardBackground = String(HUD_QUICK_SETTINGS.showCardBackground);
}

// UI size — the whole app is zoomed by `body.style.zoom` so every fixed-px
// element (cards, sprites, map nodes, menus) scales together. "Auto" flexes the
// zoom with the window against a design baseline so the board fills big screens
// and shrinks to fit small ones; S–XL are fixed overrides. Legacy numeric values
// ('90'/'100'…) still resolve. Clamped so it never gets unusably tiny/huge.

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
// That old cliff was a height-derived mode decision: when the narrow fit was
// height-limited, localW = narrowH x w/h, so a transient browser-chrome resize
// could cross 520 and flip the whole composition. Height still participates in
// the zoom chosen for the current frame, but it no longer changes the mode.
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
// THE PROPERTY: layout mode is width-owned. `narrowMax` is a viewport-width
// threshold, so a height-only resize cannot change `data-layout`; tools/mobilefit
// asserts that it agrees with the rendered attribute at every shape. The zoom
// remains height-aware and can change without changing the composition mode.
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
//
// THE THIRD AND FOURTH VALUES — `compact` and `short`. They ride here and not in
// a stylesheet for EXACTLY the reason above: a `@media (orientation: landscape)`
// would be a second decider on a second input, which is #24 rebuilt from
// scratch. It is also not an orientation at all — a 1024x768 tablet is landscape
// and fine, and a 400x400 desktop window is not.
//
//   COMPACT <=> h is in [shortWideMinH, gateBelowH) AND the wide baseline fits
//   SHORT   <=> h < gateBelowH AND no complete compact/narrow answer fits
//
// Both edges are rendered measurements in balance.js. #27 inserts the compact
// answer where the old code raised the refusal, while preserving the refusal
// below the compact layout's own first complete frame. CSS reads the published
// composition and never re-asks either question.
//
// `vw`/`vh` are parameters so the SAME decider can be asked about a viewport
// that does not exist yet — applyUiScale asks it about the TURNED phone before
// the gate is allowed to say "turn your phone". Omit them and it reads the
// window, byte-for-byte as before.
export function layoutForCap(cap, vw, vh) {
  const given = vw != null && vh != null;
  if (!given && typeof window === 'undefined') return { zoom: 1, narrow: false, compact: false, short: false };
  const z = UI.uiScale;
  const w = given ? vw : window.innerWidth, h = given ? vh : window.innerHeight;
  const clamp = (v) => Math.max(z.min, Math.min(z.max, v));
  const fitFor = (dw, dh) => Math.min(w / dw, h / dh);
  const capped = (v) => Math.min(v, cap);
  // One derived band and the same answer on every return path. `gateBelowH`
  // absent (an older content bundle) means neither a compact band nor a gate;
  // a missing threshold must never invent either at a guessed number.
  const shortWide = (zoom) => z.gateBelowH != null && h < z.gateBelowH
    && w / zoom >= z.designW
    && h >= (z.shortWideMinH || 0);
  const answer = (zoom, narrow) => {
    const compact = !narrow && shortWide(zoom);
    return { zoom, narrow, compact, short: z.gateBelowH != null && h < z.gateBelowH && !compact };
  };

  // THE TWO PATHS ROUND DIFFERENTLY, ON PURPOSE. The wide path keeps
  // `Math.round` byte-for-byte, because every zoom every existing player sees
  // comes out of it. The narrow path floors, because `Math.round` can hand back
  // a zoom LARGER than the one that fits (at 390x844 the narrow fit is 0.907,
  // round gives 0.91, and 0.91 x 430 = 391.3 px demanded against 390 available).
  // Flooring BOTH moved 1280x800 from 1.07 to 1.06 and turned
  // tools/tutorial-reach.mjs red — the guard on #7.
  const wideZoom = clamp(capped(Math.round(fitFor(z.designW, z.designH) * 100) / 100));
  if (!(z.narrowW && z.narrowH && z.narrowMax)) return answer(wideZoom, false);

  const narrowFit = clamp(Math.floor(fitFor(z.narrowW, z.narrowH) * 100) / 100);
  const narrowZoom = clamp(capped(narrowFit));
  if (w <= z.narrowMax) return answer(narrowZoom, true);

  // Recovery: the cap, not the screen, is what pushed this out of the narrow
  // band. Unreachable when cap is Infinity — narrowZoom === narrowFit there, so
  // this test is the one that just failed. THAT IS NOW MEASURED RATHER THAN
  // ARGUED: Vira instrumented it and the counter enters 0 times at cap
  // Infinity and 47,790-265,908 times under the named caps. Not load-bearing
  // for #24's property — see the header — only for the quality of the answer.
  if (w <= z.narrowMax) return answer(narrowFit, true);
  return answer(wideZoom, false);
}

// A named size is a CEILING the player asked for, not a value the app owes them
// at any cost. Anything that is not a named size (incl. legacy numeric
// '90'/'100'/'110'/'125') is Auto: the settings UI displays such values as Auto,
// so behaving as fixed zoom made the control look dead ("scaling stopped
// working") — balance.js records that complaint, and it is the reason the
// settings screen now shows the value actually applied.
export function resolveLayout(uiScale, vw, vh) {
  const key = String(uiScale == null ? 'auto' : uiScale).toLowerCase();
  const named = key !== 'auto' ? UI_NAMED[key] : null;
  return layoutForCap(named != null ? named : Infinity, vw, vh);
}

// While the combat screen is mounted, View = Auto lays out on the form
// factor's fixed canvas (docs/design/fixed-form-factor-layouts.md). Outside
// combat Auto is native; a manual View preset wins everywhere.
let combatCanvas = false;

export function effectiveViewPreset(viewPreset, combatOn, width, height) {
  const key = String(viewPreset || 'auto').toLowerCase();
  if (VIEW_PRESETS[key]) return key;
  return combatOn ? formFactorFor(width, height, UI.uiScale.formFactor) : 'auto';
}

export function setCombatCanvas(on) {
  on = !!on;
  if (on === combatCanvas) return;
  combatCanvas = on;
  if (!saves) return;
  const settings = saves.loadMeta().settings || {};
  applyUiScale(settings);
  applyCardSizeSettings(settings);
}

export function applyUiScale(settings) {
  const viewport = window.visualViewport;
  const visibleHeight = viewport && viewport.scale === 1 ? viewport.height : window.innerHeight;
  const effective = effectiveViewPreset(settings.viewPreset, combatCanvas, window.innerWidth, visibleHeight);
  const view = applyViewViewport(effective, window.innerWidth, visibleHeight);
  // A canvas picked by combat Auto is a layout frame, not the player's screen:
  // the short-screen / turn-your-phone gate is still decided from the real window.
  const gateFromWindow = !VIEW_PRESETS[String(settings.viewPreset || 'auto').toLowerCase()] && view.preset !== 'auto';
  document.documentElement.style.setProperty('--visible-height', view.height + 'px');
  const { zoom, narrow, compact, short: canvasShort } = resolveLayout(settings.uiScale, view.width, view.height);
  const short = gateFromWindow ? resolveLayout(settings.uiScale, window.innerWidth, visibleHeight).short : canvasShort;
  // Set as a CSS var so base.css can compensate the body's width/height for the
  // zoom (avoids the zoom×100vh overflow). Any leftover inline zoom is cleared.
  document.body.style.zoom = '';
  document.documentElement.style.setProperty('--ui-zoom', String(zoom));
  // The layout mode, written by the same call that chose the zoom, so the two
  // cannot disagree. The stylesheets key off this and measure nothing (#24).
  document.documentElement.setAttribute('data-layout', narrow ? 'narrow' : 'wide');
  document.documentElement.setAttribute('data-composition', compact ? 'short-wide' : 'standard');
  // The HUD form factor (docs/hud-layout-tokens.md) — which
  // content/hud-layout/<form-factor>.json styles the combat HUD. Written here,
  // beside data-layout, so styling has no decider of its own; it never picks
  // the mode or the zoom above. It does change HUD geometry (the tools span
  // and the px offset tokens), so the combat tools row and the battlefield
  // stage observe this attribute and re-measure when it changes.
  // Thresholds: balance.ui.uiScale.formFactor.
  document.documentElement.setAttribute('data-form-factor',
    view.preset === 'auto' ? formFactorFor(view.width, view.height, UI.uiScale.formFactor) : view.preset);
  // Publish the short/refusal value from that same decider for layout consumers too.
  // This is not another short-screen predicate: CSS reads the answer computed
  // above, just as it reads `data-layout`. In particular, combat may let its
  // field yield to the hand at Text XL on a fitting viewport without silently
  // making the established upright refusal outlive (or lose) its premise.
  document.documentElement.setAttribute('data-short', short ? 'true' : 'false');
  // THE ORIENTATION GATE (ui/components/upright.js — the decision lives in its
  // header, not here). Written by the SAME call that chose the zoom and the
  // layout, from the same decider, so there is no second opinion about whether
  // this screen is too short. The wording is derived, not guessed: ask the
  // decider about the TURNED viewport and only then are we allowed to say "turn
  // your phone" — a gate that tells a desktop player to rotate their monitor is
  // a gate nobody believes the second time.
  const turned = typeof window === 'undefined'
    ? { short: true }
    : gateFromWindow ? resolveLayout(settings.uiScale, visibleHeight, window.innerWidth)
    : resolveLayout(settings.uiScale, view.height, view.width);
  // AND ONE CAPABILITY QUERY, FOR THE WORDS ONLY. "Turn your phone upright" read
  // on an 800x410 DESKTOP WINDOW is a false instruction, and a screen that tells
  // you one wrong thing is a screen you stop reading. `(pointer: coarse)` is NOT
  // "is this a phone" — the question this file refuses to ask, because it has no
  // honest answer — it is "is the primary pointer a finger", which is exactly the
  // population for whom turning a device is a thing you can do. It chooses the
  // WORDING and never the refusal: if it is wrong the player still gets a true
  // recovery line, and the gate stands or falls on the geometry either way.
  const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
  // AND HIS AMENDMENT (2026-08-17): *"revert that back, or make that a
  // configurable setting."* One row — `Display / Short-screen warning`. It is
  // passed as its OWN argument rather than folded into `short`, deliberately:
  // `short` is a fact about the viewport that this decider computes, and the
  // setting is a fact about what the player asked us to do about it. Collapsing
  // them would hide a preference inside the geometry, and the next reader of
  // `layoutForCap` would find a `short` that is sometimes false on a short
  // screen. `!== false` so a profile written before this row existed keeps the
  // gate — and so does a `?shot=` boot, which by construction has no durable
  // settings and resolves every one of them to its default.
  updateUprightGate({ short, offerRotate: !turned.short && coarse, enabled: settingOn(settings, 'uprightGate') });
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
export function applyTapSize(settings) {
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
export function reflexAutoScale() {
  // Re-applied for EVERY uiScale setting, not only Auto. The zoom does not move
  // for a fixed size, but the MODE does: innerWidth changes on resize while the
  // zoom stays put, so the local width crosses narrowMax with nothing else
  // changing. Gating this on Auto left the attribute stale at exactly the
  // shapes a fixed size is most likely to be small in (#24).
  applyUiScale((saves.loadMeta().settings) || {});
}

// A resize fires many times a second; most of the card-size properties come out
// the same each time, and rewriting an unchanged custom property still dirties
// style for the whole page. Write only what differs.
export function setRootPropertyIfChanged(name, value) {
  const style = document.documentElement.style;
  if (style.getPropertyValue(name) !== String(value)) style.setProperty(name, value);
}
// CARD SIZE IS TUNABLE WHILE YOU LOOK AT A CARD. The authored table in
// content/config/ui/components/card.json is the default and the only thing
// that ships; Settings > Advanced > Card size lays an override over it, and
// re-projecting the same custom properties here means a slider moves every
// card on screen rather than waiting for a reload. A set of numbers that
// breaks `glance < focus < inspect` is refused by the model and the authored
// table stands — the console says which key was wrong rather than the cards
// silently going back to normal.
export function applyCardSizeSettings(settings) {
  const { levels, refused } = cardLevelsWithOverrides(settings);
  for (const [name, value] of Object.entries(cardLevelCssPropertiesFor(levels))) {
    setRootPropertyIfChanged(name, value);
  }
  // A RESTING CARD IS SIZED FOR THE VIEWPORT IT IS RESTING IN. `glance` is the
  // browsing size and `glance.variants.mobile` is that size on a phone; the
  // chosen one is written to the SAME property name, so a card, a stylesheet
  // and a tool all keep asking one question. Redeclaring `--card-w-glance`
  // inside a media query would have been the later-rule-wins shape that has
  // already produced three defects in this component.
  const resting = restingWidthPx(resolveViewViewport(effectiveViewPreset(settings.viewPreset, combatCanvas, window.innerWidth, window.innerHeight), window.innerWidth, window.innerHeight).width, levels);
  setRootPropertyIfChanged('--card-w-glance', `${resting}px`);
  // Focus and inspect rest the same way: the phone keeps its `mobile` variant, a desktop gets the authored (20% larger) width.
  for (const level of ['focus', 'inspect']) {
    setRootPropertyIfChanged(`--card-w-${level}`, `${levelRestingWidthPx(level, resolveViewViewport(effectiveViewPreset(settings.viewPreset, combatCanvas, window.innerWidth, window.innerHeight), window.innerWidth, window.innerHeight).width, levels)}px`);
  }
  // The shelf floors its tracks at a legible width; that floor cannot stand
  // above the resting card it floors, so it is re-projected against the width
  // just chosen rather than left at the authored one.
  for (const [name, value] of Object.entries(cardShelfCssProperties(undefined, resting))) {
    setRootPropertyIfChanged(name, value);
  }
  // The door's threshold reads `--card-w-inspect`, which has just moved. Its
  // observer only sees the layout's own box change, and the modal layout is
  // 100% x 100% — so a door standing open would keep its old shape until a
  // resize or a reopen. Tell it the term it depends on has changed.
  refreshCardDoorShape();
  // A REFUSAL HAS TO ANSWER, NOT JUST BE LOGGED. The slider keeps the number
  // that was typed, the game quietly goes back to the authored table, and the
  // export copies the authored values — so from the player's chair the control
  // moved and nothing happened. `showSettingsNotice` exists for exactly this
  // ("a refused write can answer instead of being a silent no-op", #67), and
  // leaving this one to `console.warn` reintroduced the defect that helper was
  // written to prevent. It is a no-op when Settings is not open, which is the
  // right shape for a refusal resolved at boot rather than at a slider.
  if (refused) {
    console.warn(`card sizes: override refused — ${refused}; the authored table is in use.`);
    showSettingsNotice(`Card sizes unchanged: ${refused}. The authored sizes are in use, and Export will copy those.`, 'card-size');
  } else {
    // A refusal that has been resolved must stop being announced: moving a
    // slider back into a valid ladder left the old notice standing while the
    // tuned sizes were actually in force.
    clearSettingsNotice('card-size');
  }
}

export function applyDisplaySettings(settings) {
  applyCardArtStyle(settings);
  applyDisplayAppearance(settings);
  // Art quality: lay a local high-res source over the built-in art, or clear
  // it. Asynchronous (a served hd/ folder is fetched); screens drawn after it
  // resolves use the new tier, and anything the source lacks stays built-in.
  applyArtQuality(settings);
  // Auto / Light / High: which pack the web edition loads (src/ui/artTier.js).
  // A change in play reloads the indexes; a single file and the source tree
  // pin no packs and this does nothing.
  applyArtTier(settings);
  applyHudVisibility(document.documentElement, settings);
  applyCardSizeSettings(settings);
  const advancedPresentation = presentationConfig(settings);
  document.documentElement.dataset.formationSettings = JSON.stringify(advancedPresentation);
  document.documentElement.dataset.formationMovement = String(advancedPresentation.movementEnabled);
  document.documentElement.style.setProperty('--selection-color', advancedPresentation.selectionColor);
  document.documentElement.dataset.formationGrid = String(advancedPresentation.showFormationGrid);
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--settings-window-width', `calc(${advancedPresentation.settingsWidthPercent} * var(--view-vw, 1vw))`);
  rootStyle.setProperty('--settings-window-height', `calc(${advancedPresentation.settingsHeightPercent} * var(--view-vh, 1dvh))`);
  document.documentElement.dataset.playerSpawnRow = advancedPresentation.playerSpawnRow;
  document.documentElement.dataset.enemySpawnRow = advancedPresentation.enemySpawnRow;
  document.documentElement.dataset.playerSpawnColumn = advancedPresentation.playerSpawnColumn;
  document.documentElement.dataset.enemySpawnColumn = advancedPresentation.enemySpawnColumn;
  const quality = resolvePerformanceMode(settings, typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  document.documentElement.dataset.performance = quality;
  // Effects (owner, 2026-10-30): `data-performance` stays the CSS hook (lite = off);
  // `data-effects` is its readable alias. The fighter-motion options are body
  // classes (`motion-attack-off`, ...), each independent of Effects.
  document.documentElement.dataset.effects = effectsEnabled(settings) ? 'on' : 'off';
  const motion = motionFlags(settings);
  for (const kind of Object.keys(motion)) document.body.classList.toggle(`motion-${kind}-off`, !motion[kind]);
  if (quality === 'lite' || settings.reducedMotion) clearPosePreloads();
  configureTooltipSettings(settings);
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
  const storedText = String(settings.textSize || '').toUpperCase();
  const tKey = storedText === 'M' || storedText === 'AUTO' ? null
    : TEXT_SIZES[storedText] ? storedText
      : (settings.largeText === true ? 'L' : null);
  if (tKey) document.documentElement.style.fontSize = TEXT_SIZES[tKey];
  else document.documentElement.style.removeProperty('font-size');
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
  document.documentElement.dataset.armamentsPresentation = resolveArmamentsPresentation(settings);
  document.documentElement.dataset.armamentsPhonePlacement = resolveArmamentsPhonePlacement(settings);
  const strengths = UI.cardMotifStrength;
  const sKey = strengths[settings.cardMotifStrength] != null ? settings.cardMotifStrength : 'normal';
  document.documentElement.style.setProperty('--card-motif-strength', String(strengths[sKey]));
  document.body.classList.toggle('cb-safe', settings.colorblindSafe === true);
  document.body.classList.toggle('reduce-flashes', settings.reduceFlashes === true);
  document.body.classList.toggle('readable-ui', settings.readableHeadings === true);
  // Card lore type (Advanced → Text & lore): words on <html>, read by kit.css.
  applyLoreType(settings);
  document.body.classList.toggle('hide-hints', settings.controlHints === false);
  // A profile that never touched the row — or holds a value the row does not
  // offer — gets the row's default (compact), as the settings screen shows it.
  const densityRow = settingsRow('mapHeaderDensity');
  const density = densityRow.choices.includes(settings.mapHeaderDensity) ? settings.mapHeaderDensity : densityRow.def;
  document.body.classList.toggle('map-compact', density === 'compact');
  document.body.classList.toggle('hide-header-relics', settings.mapHeaderRelics === false);
  document.body.classList.toggle('hide-header-seed', settings.mapHeaderSeed !== true);
  // The quick-menu experiment. Handed to the component the same way input.js is
  // handed its bindings, so no screen has to thread `meta` down just to ask which
  // variant is running. `settingOn` because the store is sparse and the default
  // is part of the answer (see its own docstring).
  setQuickNav({ mode: settings.quickNav });
  // Walked-node fade → data attr on the root; styles/map.css carries the ladder.
  // Same shape as `ambient` below: an unknown stored value lands on the default
  // rather than on a silent no-fade, and the default here restates the settings
  // row's `def` the way every fallback in this function does.
  const wf = ['off', 'subtle', 'half', 'strong'].includes(settings.walkedFade) ? settings.walkedFade : 'half';
  document.documentElement.dataset.walkedFade = wf;
  // Ambient effects level → data attr read by the title screen (ember count) + CSS.
  const amb = ['off', 'low', 'normal', 'high'].includes(settings.ambient) ? settings.ambient : 'normal';
  document.documentElement.dataset.ambient = quality === 'lite' ? 'off' : amb;
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
  setAnimSpeed(resolveCombatPacing(settings, coarsePointer()));
  setCombatPacing(settings);
  // A cleared key (a Reset, a profile that leaves it out) means the default:
  // setVolumes ignores a missing field, so say the default out loud.
  audio.setVolumes({
    ...settings,
    musicEnabled: resolveMusicEnabled(settings),
    musicVolume: settings.musicVolume ?? AUDIO_DEFAULTS.musicVolume,
    sfxVolume: settings.sfxVolume ?? AUDIO_DEFAULTS.sfxVolume,
    muteAudio: settings.muteAudio === true,
  });
  scheduleCardFits(document.querySelectorAll('.card'));
  // Re-point external music only when the folder actually changed (avoids
  // re-fetching the manifest on every unrelated settings tweak). Blank means the
  // shipped score (content/music.js SHIPPED_MUSIC_FOLDER: the common pack's
  // objects in the web edition, the music/ folder beside a single file) when
  // served over http(s); a file:// page cannot fetch it and keeps the synth.
  // That holds for a double-clicked web edition too (docs/EXTERNAL-ASSETS-PLAN.md
  // §3.9, step 4): its art, tiles and fonts load from the objects beside it,
  // but Web Audio cannot play a file: track (a CORS-mode load Chrome refuses,
  // or silence without one), so the score stays synthesized there.
  const served = /^https?:$/.test(globalThis.location?.protocol || '');
  const folder = settings.musicFolder || (served ? SHIPPED_MUSIC_FOLDER : '');
  // Only the shipped score is read through the asset index; a folder the
  // player typed is fetched by its literal path, even one spelled `music/`.
  const indexed = !settings.musicFolder && served;
  const musicKey = `${indexed ? 'shipped' : 'custom'}:${folder}`;
  if (musicKey !== lastMusicFolder) {
    lastMusicFolder = musicKey;
    bootMusic.apply(folder, { indexed });
  }
  // THE WIREFRAME CHOICES (Settings → Advanced → Wireframes). One word per
  // choice on the root, read by the modal shell, the kit's category navigation,
  // the W1 workspace frame and the scene fitter — the same shape as cardMotif
  // above. Then the three surfaces that can be ON SCREEN while the answer
  // changes are re-resolved in place: Settings is itself a W1 door, and an
  // answer a player cannot see land is an answer they cannot judge. Everything
  // else takes its word the next time it draws.
  //
  // AFTER applyUiScale AND applyTapSize, and that order is load-bearing: the
  // category navigation re-measures against `--ui-zoom` and the rail item's
  // tap floor, so re-planning before those two are written would judge this
  // pass against the last pass's numbers (review, 2026-09-20). It is last in
  // this function for a second reason: nothing below it can be skipped by a
  // throw from a door that is already on screen.
  applyWireframeChoices(settings);
  restampModalWireframes(document);
  restampWorkspaceFrames(document);
  replanCategoryNavs();
}

// Registers the resize / load listeners the UI-scale decider needs, at the spot
// main.js used to register them inline (before the first applyDisplaySettings).
export function installDisplaySettings() {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      clearTimeout(uiResizeTimer);
      uiResizeTimer = setTimeout(reflexAutoScale, 150);
    });
    window.visualViewport?.addEventListener('resize', () => {
      clearTimeout(uiResizeTimer);
      uiResizeTimer = setTimeout(reflexAutoScale, 150);
    });
    window.addEventListener('load', reflexAutoScale);
    setTimeout(reflexAutoScale, 300);
    // The combat canvas follows the combat screen: it mounts as a direct child
    // of #app and every other screen replaces it. Observed here so no screen
    // file has to announce itself.
    const app = document.getElementById('app');
    if (app && typeof MutationObserver === 'function') {
      const sync = () => setCombatCanvas(!!app.querySelector(':scope > .combat'));
      new MutationObserver(sync).observe(app, { childList: true });
      sync();
    }
  }
}

// Registered by main.js right after the first applyDisplaySettings, as before.
export function installCardSizeResize() {
  // The resting width depends on the viewport, so it is re-resolved when the
  // viewport changes — a phone rotated into landscape crosses the compact
  // breakpoint, and a desktop window dragged narrow crosses it too.
  let cardSizeResizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(cardSizeResizeTimer);
    cardSizeResizeTimer = setTimeout(() => applyCardSizeSettings(getActiveSettings()), 150);
  });
}
