import { previewPrologue } from './prologue.js';
import { openPrologueSceneEditor } from './prologueSceneEditor.js';
// src/ui/screens/settings.js — settings controls (SPEC §7)
//
// Rows are declarative and grouped into categories. `renderSettings` builds the
// controls into any container and wires change events, so the same controls
// back both the standalone modal (openSettings) and the in-run overlay's
// Settings tab. Each row declares its default so stored settings stay sparse.
// `onChange({key:value})` lets the orchestrator persist + apply immediately.

import { HUD_VISIBILITY_SETTINGS } from '../models/HudVisibilityModel.js';
import { advancedSubgroups, statsSection, CLASS_TOPICS } from '../models/AdvancedSettingsGroups.js';
import { statsTopicPreview, statsExampleClasses, STATS_EXAMPLE_CLASS_KEY } from '../models/StatsPreviewModel.js';
import { WIREFRAME_CHOICE_GROUPS } from '../models/WireframeChoiceModel.js';
import { handRulesRows, resolveHandRules, HAND_RULES_PREFIX } from '../../model/handRules.js';
import { formationSettingsHtml, mountFormationSettings, applyPendingFormationSettings } from '../components/formationSettings.js';
import { mountFlickPractice } from '../components/flickPractice.js';
import { settingsPreviewHtml, settingsPreviewShown, mountSettingsPreview } from '../components/settingsPreview.js';
import { offlinePlay } from '../../content/offlinePlay.js';
import { openDebugLog } from '../debuglog.js';
import { esc, attachTooltip } from '../components/tooltip.js';
import { setTabRing, hasTabRing } from '../input.js';
import { renderAboutSection, renderChangelogSection } from './about.js';
import { AUDIO_DEFAULTS, resolveMusicEnabled } from '../audio.js';
import { balance } from '../../content/balance.js';
import { tooltipSettingsRows } from '../../model/tooltipSettings.js';
import { TITLE_ENTRANCE_TIMING } from '../models/StartupGateModels.js';
import { ZOOM_STEPS, MAP_ZOOM_DEFAULT, MAP_FREE_PAN_DEFAULT } from '../../model/mapview.js';
import {
  MAP_MODES, MAP_MODE_DEFAULT, FOG_TRAIL_CLAUSE, SHRINE_GLOW_DEFAULT,
} from '../../model/mapknowledge.js';
import { flasks } from '../../content/flasks.js';
import { graceRefillTable, graceRefillLadder, flaskSlotCap, firstFlaskOfKind } from '../../model/gracerefill.js';
import { openModal, button } from '../kit/index.js';
import { t } from '../strings.js';
import { LORE_FACES, LORE_SIZES, LORE_LEADING, LORE_TRACKING, LORE_SLANTS, LORE_TYPE_DEFAULTS } from '../models/LoreTypeModel.js';
import { settingsRowShowsHelp, stepCategory } from '../models/SettingsWorkspaceModel.js';
import { cardLevels, cardLevelsWithOverrides, cardSizingExport, cardSizingExportPath, cardWidthBounds, normalizeTunedNumber } from '../models/CardSizeModel.js';
import { contentBundle } from '../../content/index.js';
import { pageDebug } from '../buildChannel.js';
import { SETTINGS_DEFAULTS } from '../../content/settingsDefaults.js';
import { SEED_KEY } from '../../model/settingsDefaults.js';
import { renderSettingsSync } from '../components/settingsSync.js';
import { gateOpen, ownOn } from '../../model/settingOverrides.js';
import { advancedConfigProblemRows, advancedConfigRows, configuredContentBundle, parseAdvancedConfigFile } from '../../model/advancedConfig.js';
import { saveAdvancedConfigFile, saveJsonFile } from '../services/saveJsonFile.js';
import {
  prologueScenePreset, prologueConfig, prologueSequence, prologueSlotPayload, prologueSlotChanges,
  prologueSettingKey, isPrologueSlot, prologueReorderChanges, prologueSceneCopy, prologueSceneClear,
  prologueFreeSlot, prologueStagedOrder, PROLOGUE_PREFIX, PROLOGUE_DEFAULTS,
} from '../../model/prologue.js';

const UI_DEFAULTS = balance.ui;
// The card's authored sizes, so the rows below state a DEFAULT they read
// rather than a number typed twice. content/config/ui/components/card.json is
// the one home; these rows lay a tuning override over it.
const CARD_LEVELS = cardLevels();
// The same authored range the model clamps to, so the control and the width it
// produces cannot disagree about what is in bounds.
const CARD_WIDTH_BOUNDS = cardWidthBounds();
// A CLIPBOARD WRITE OUTLIVES THE PANEL THAT STARTED IT, so the guard against a
// second export cannot live inside `renderSettings`. It did, and closing and
// reopening Settings handed the button a fresh `false` while the first write
// was still unsettled — two writes in flight again, free to land in either
// order, which is the one thing the guard exists to prevent. It belongs to the
// clipboard operation's lifetime, so it sits here.
//
// IT CARRIES NOTHING ELSE, AND THE REASON IS A CLAIM I GOT WRONG. It held the
// block and the settings bag that produced it, so a late landing could say
// whether that block was still the one on the sliders. I justified that with
// "there is ONE bag" — and there is not: `persistSettingsChange`
// (`src/main.js`) reassigns `activeSettings` from a fresh `saves.loadMeta()`
// on every change, and `loadMeta` returns a NEW object each call. A render
// therefore holds the bag it opened with, not the one in force later, so the
// comparison could report the opposite of the truth. A notice that cannot be
// made reliable should not be made at all, so the late landing now states only
// what is always true: the block on the clipboard is the one from that copy.
let exportWritePending = false;
// THE BAG IN FRONT OF THE USER, which is not the one a handler closed over.
// `persistSettingsChange` (`src/main.js`) reassigns `activeSettings` from a
// fresh `saves.loadMeta()` on every change, so each render opens with a
// DIFFERENT object: a panel writes into its own bag (`settings[key] = val`
// below) and therefore stays right about itself, while a handler left over
// from a CLOSED panel keeps reading a bag nobody writes to any more. Anything
// that asks "what do the sliders read NOW" has to ask the live panel, so the
// current render records itself here and the export's settlement reads this
// rather than its own closure.
let panelSettings = null;
// A NOTICE POSTED TO A CLOSED PANEL IS LOST, and the late clipboard landing is
// the only notice in this screen that can arrive after its panel has gone:
// `showSettingsNotice` finds no `[data-settings-host]` and returns. So the
// clipboard would be overwritten after the UI had said it was not, with the
// announcement that was supposed to cover exactly that dropped on the floor.
// It is held here instead and posted by the next render. The console gets it
// either way, because a panel that is never reopened must not swallow it.
let deferredCardSizeNotice = null;
const EQ_DEFAULTS = balance.equipment;
const LEVEL_DEFAULTS = balance.levelUp || {};
// `retired: true` is a row that keeps its KEY so an exported configuration
// still imports and still applies, and stays off the screen because nothing a
// player can reach depends on it — today, the creation pools of the modes
// `characterCreation.visibleModeIds` does not offer. The screen showed three
// near-identical "starting stat pool" rows for one reachable pool; this is the
// line that stops that. parseAdvancedConfigFile reads advancedConfigRows()
// directly, so import is unaffected.
const ADVANCED_CONFIG_ROWS = advancedConfigRows(contentBundle).filter((row) => !row.retired)
  // An override switch shows its EFFECTIVE state: stored, else on when the
  // class ships its own value or a profile already pinned one.
  .map((row) => (row.own ? { ...row, resolve: (settings) => ownOn(settings, row.own) } : row));
const INERT_CONFIG_ROWS = advancedConfigRows(contentBundle).filter((row) => row.inert);

// A row that holds no value of its own: a button, the fullscreen action, the
// opening's list editor. They are never exported and never reset, because
// there is nothing under their key to export or take away.
const CONTROL_ROW_TYPES = new Set(['button', 'action', 'sceneList']);

// ---- the Wireframes tab: DERIVED from the choice catalogue ------------------
//
// "I want to customize the wireframe choices for modals and menus and scenes"
// (owner, 2026-09-20), as one Advanced group whose topics are the three
// families and whose rows are dropdowns. Not one row typed per choice: the
// catalogue (models/WireframeChoiceModel.js) already has to name every option
// for the components that read them, and a second copy here is the drift this
// screen has learned to refuse everywhere else (see graceRefillRows above). A
// fourth family, or a third option on an existing one, is an edit to the model
// and NOTHING here.
//
// `dropdown: true` on every row although two of them have three options: the
// chip strip is the default under four, and the owner asked for drop downs.
// `wireframeTopic` is what files a row under Modals, Menus or Scenes
// (models/AdvancedSettingsGroups.js).
function wireframeChoiceRows() {
  return WIREFRAME_CHOICE_GROUPS.flatMap((group) => group.choices.map((choice) => ({
    cat: 'Advanced',
    advancedGroup: 'Wireframes',
    wireframeTopic: group.label,
    key: choice.key,
    type: 'choice',
    dropdown: true,
    def: choice.def,
    choices: choice.options.map((entry) => entry.id),
    choiceLabels: Object.fromEntries(choice.options.map((entry) => [entry.id, entry.label])),
    label: choice.label,
    note: choice.note,
  })));
}

// ---- the grace-refill rows: DERIVED, one per row of the table --------------
//
// Constantine asked for the flask refill to be "configurable in teh debug
// settings and be data driven" in one breath, and this is the only shape that
// is both at once. These rows are not authored. `balance.graceRefill` is walked
// and each row becomes one Advanced chip strip, so a third refilled kind is a
// row in content and NOTHING here — which is the Law 0 falsifier for this
// feature, and `tools/gracerefill.mjs --selftest` runs it.
//
// THE LADDER IS DERIVED TOO: 0 … balance.flaskSlots, from graceRefillLadder.
// Raising the carry cap lengthens every strip with no edit here, and 0 is a
// real position — his own debug switch for turning the whole thing off.
//
// FIVE CHIPS AT flaskSlots: 3. Marina measured four chips at 92.1 px tall on
// 390x844 and seven at 301.2 px with the last chip off-viewport; five is inside
// that, and tools/axisfit.mjs is what says so rather than this comment.
//
// KEY SHAPE `graceRefill.<kind>`: one key per kind, so a stored override
// survives a table reorder. `settingOn` is not involved — these are choices.
const GRACE_REFILL_KEY = (kind) => `graceRefill.${kind}`;

// What a kind is CALLED to a human. A kind with no entry here falls back to the
// id, so a new kind gets a working row before anyone writes it prose — the row
// appears ugly rather than not at all.
const KIND_LABELS = { hp: 'HP', mana: 'Mana', utility: 'Utility' };
const kindLabel = (k) => KIND_LABELS[k] || k;

function graceRefillRows() {
  const cap = flaskSlotCap(balance);
  return graceRefillTable(balance).map((row) => ({
    cat: 'Advanced',
    advancedGroup: 'Rewards',
    key: GRACE_REFILL_KEY(row.kind),
    type: 'choice',
    def: String(row.count),
    choices: graceRefillLadder(balance),
    label: `Grace refill — ${kindLabel(row.kind)} flasks`,
    applied: graceRefillAppliedHtml,
    graceRefillKind: row.kind,
    // SHORT, and Marina's own measurement is why: a long note beside a chip
    // strip squeezes the text column to a ribbon (she took one row from 92.1 px
    // to 216.9 px proving it). What the row DOES is one clause; what it
    // RESOLVES TO is the applied line below, which changes with the value and
    // therefore earns its space.
    note: `Topped up automatically on arrival at a shrine. 0 is off; ${cap} slots in total.`,
  }));
}

/**
 * hiddenTuningKeys(settings, debug) → stored keys this build has no row for:
 * every row of a debug-only section (tuning or not — `shrineMultiUse`, say),
 * and any `gameConfig.*` key no shown row carries. On a release build these
 * still apply, but nothing on screen can see or reset them — so the options
 * menu offers to clear them.
 */
export function hiddenTuningKeys(settings = {}, debug = pageDebug()) {
  if (debug) return [];
  const hidden = releaseHidden();
  return Object.keys(settings).filter((key) => settings[key] !== undefined && hidden(key));
}

/** releaseHidden() → key => true when a release build shows no row for it. */
function releaseHidden() {
  const shown = new Set();
  const debugOnly = new Set();
  const advanced = categoryHandler('Advanced')?.rows || [];
  const releaseGroups = new Set(visibleAdvancedGroups(false).map((group) => group.id));
  for (const group of visibleAdvancedGroups(true)) {
    if (MOUNTED_ADVANCED_GROUPS[group.id]) continue;
    const into = releaseGroups.has(group.id) ? shown : debugOnly;
    for (const sub of cachedSubgroups(advanced, group.id)) for (const row of sub.rows) into.add(row.key);
  }
  for (const row of ROWS) if (GENERAL_GROUPS.includes(row.cat) || row.cat === 'Accessibility') shown.add(row.key);
  return (key) => !shown.has(key) && (debugOnly.has(key) || key.startsWith('gameConfig.'));
}

/**
 * promotionFor(defaults, debug) → the promotion this build applies. A release
 * build never applies a value it has no row for (the player could neither see
 * nor reset it), so those keys are left out there — and a value an earlier
 * promotion seeded for one is withdrawn by the seed's own "dropped key" rule.
 */
export function promotionFor(defaults, debug = pageDebug()) {
  if (debug) return defaults;
  const hidden = releaseHidden();
  const values = Object.fromEntries(Object.entries(defaults?.values || {}).filter(([key]) => !hidden(key)));
  return { ...defaults, values };
}

/**
 * buildPromotion(debug) → the promoted values this build applies: what a
 * Reset goes back to. On a release build that leaves out every row it does
 * not show, as boot does, so no Reset reinstalls hidden tuning.
 */
function buildPromotion(debug = pageDebug()) {
  return debug ? PROMOTED_DEFAULTS : promotionFor(SETTINGS_DEFAULTS, false).values;
}

/** The owner's promoted defaults, by setting key (tools/settings-defaults.mjs). */
const PROMOTED_DEFAULTS = Object.freeze({ ...(SETTINGS_DEFAULTS.values || {}) });

/** settingsRows() → every row this screen draws (the sync profile's key list). */
export function settingsRows() { return ROWS; }

const ROWS = [
  ...tooltipSettingsRows(),
  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: 'Fullscreen',
    note: 'Fill the screen when this browser supports app-controlled fullscreen.' },
  // Fullscreen and Music are persistent quick controls on Title, Map, and
  // Combat. Settings does not duplicate them with a second stateful surface.
  // ---- cat: 'Combat' -----------------------------------------------------
  //
  // HIS REPORT, LOOKING AT THE ADVANCED SECTION LIST: "no good section to
  // customize combat, combat animation, etc". He was right, and the reason is
  // that combat's presentation had no home — it had three.
  //
  //   Combat pacing / Rendering quality / Screen shake / played-card animation
  //     -> General > Display > "Effects & pacing", a bag that also held the
  //        TITLE SCREEN's lit-city pause, so its name did not promise combat.
  //   Character sprites -> Advanced > Interface > "Characters", i.e. behind the
  //        debugging surface, for a row that decides what a player looks at for
  //        the whole run.
  //   Combat Armaments / phone placement -> General > Display > "Interface",
  //        filed with the accent colour and the UI scale.
  //
  // And the one section NAMED for combat — Advanced > "Combat & actors" — is
  // authored balance constants (poise, exposure), which is the opposite of what
  // the name offers someone hunting for an animation switch.
  //
  // So these seven rows carry `cat: 'Combat'` and the General tab grows a third
  // group beside Display and Audio (GENERAL_GROUPS). NOT a fourth top-level tab:
  // `filedCategories()` is authored, so a new `cat` adds a GROUP and never a tab
  // — the tab strip stays three wide at every screen size it was measured at.
  //
  // NOTHING IS DUPLICATED. A row has one home; each of these moved, and the
  // Advanced tip now says where the feel settings went so the section named for
  // combat stops being a dead end.
  { cat: 'Combat', key: 'useSprites', def: true, label: 'Character sprites',
    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },
  { cat: 'Combat', key: 'animSpeed', type: 'choice', def: 'auto',
    choices: ['auto', 'slow', 'normal', 'fast', 'instant'], label: 'Combat pacing',
    note: 'Auto uses Fast with Lite rendering and Normal with Full. Choose a pace to override it.' },
  { cat: 'Combat', key: 'performanceMode', type: 'choice', def: 'auto',
    choices: ['auto', 'full', 'lite'], label: 'Rendering quality',
    note: 'Auto uses lighter effects on touch devices. Lite keeps targeting and hit feedback, reduces decorative effects, and uses fast combat pacing when pacing is Auto.' },
  { cat: 'Display', key: 'titleCityHold', type: 'choice', def: TITLE_ENTRANCE_TIMING.holdDefault,
    choices: Object.keys(TITLE_ENTRANCE_TIMING.holdDurations), label: 'Lit city pause',
    note: 'Pause with the city fully lit before fading to the menu. Reduced motion skips this pause.' },
  // `choices` and `def` are DERIVED. The four numbers here used to be typed, and
  // they were a second copy of the zoom ladder that had already drifted: the
  // ladder has six steps and this row offered four of them, so 175% and 200%
  // were reachable with the in-map + button and unreachable as a default.
  //
  // `def` IS MAP_ZOOM_DEFAULT AND NOT A LITERAL. It reads '115' today because
  // Sunna held #107 on that token; the map screen reads the same const, so the
  // default cannot be flipped in one place and stay in the other.
  //
  // THE NOTE PROMISES PLAINLY AGAIN, AND ONLY BECAUSE THE PROMISE IS NOW TRUE.
  //
  // It said this sentence for one night while 8 of 12 seeds broke it at the
  // entrance row — the first map of every run — which is a settings note the
  // game could not keep, and Sunna held #107 partly on that. I had already
  // bounded it ("gets as close as it can and you pan for the rest"). Then
  // Constantine shipped one map entrance, and the honest move is to re-measure
  // the sentence rather than keep a hedge that has stopped being true:
  //
  //   node tools/mapfit.mjs --dist --zoom Fit   ->  0 of 120 framings hide a
  //   next step; 390x844 and 1200x730, 12 seeds, entrance + four mid-climb rows.
  //
  // A hedge nobody needs teaches a player the game is unsure of itself. The
  // BOUNDARY still exists and still belongs to a maintainer, not to this string:
  // 120 measured cells is not every seed, so the map keeps reporting a frame it
  // could not fit (`.map-scroll[data-framing]`, and the warning it logs).
  { cat: 'Display', key: 'mapZoom', type: 'choice', def: MAP_ZOOM_DEFAULT,
    choices: ['Fit', ...ZOOM_STEPS.map((z) => String(Math.round(z * 100)))], label: 'Map zoom',
    note: 'Fit opens the map close enough that your current node and every node it connects to are on screen. A percentage fixes the zoom instead; + / − and ⊙ still work in the map.' },
  // THE FOG A/B, and it sits HERE rather than in Custom Climb — Marina's ruling,
  // reversed from Custom Climb on the argument that Settings is the only surface
  // reachable WHILE YOU ARE LOOKING AT THE THING YOU ARE JUDGING. Fog cannot be
  // A/B'd mid-run: once you have seen the map you cannot unsee it. So the
  // comparison is Custom Climb's existing seed field plus this row — same seed,
  // same act, two readings — and Custom Climb grows nothing new.
  //
  // DEFAULT IS `fog` since 2026-08-08 — his word, and the one token is in
  // model/mapknowledge.js so this row cannot disagree with the resolver.
  //
  // AND THE TRAIL SENTENCE IS NOT TYPED HERE ANY MORE. It read "Fog never closes
  // behind you — somewhere you have seen stays seen" — the WIDE reading, written
  // beside code running the narrow one, and measured false on 144 of 156 screens
  // (Bjorn). Constantine has since answered the fork question the wide way, so
  // the sentence is true; it moved to `FOG_TRAIL_CLAUSE`, beside the function
  // that makes it true, because a promise typed on the screen it is displayed on
  // is a promise nothing can check. Sunna's ruling, and it could not wait: fog
  // is the default, so this is the first thing a new player reads about the mode
  // they are already in.
  //
  // `choices` and `def` are the ladder's own, never a second list (the row three
  // above learned this the hard way — it carried four of the zoom ladder's six
  // steps for a night).
  { cat: 'Display', key: 'mapMode', type: 'choice', def: MAP_MODE_DEFAULT,
    choices: MAP_MODES, label: 'Map reveal',
    note: `FOG is the climb as it is meant to be read: only the door you started from, the boss, everywhere you have been, and the places you can step to next are drawn — the rest is unlit parchment. ${FOG_TRAIL_CLAUSE} PATH draws the whole act at once, the way the map looked before the fog. Switching redraws the map straight away, so you can hold the two against the same seed.` },
  // HIS OWN PARENTHESIS, AS ONE ROW — "as new paths open, the path to the
  // nearest shrine should have a glowing effect. (make this toggleable in the
  // settings)". He scoped the switch himself in the same sentence that asked
  // for the effect, so the row exists whatever anyone thinks the glow needs.
  // `def` is the resolver's own const (model/mapknowledge.js) rather than a
  // second `true` typed here — the row three above learned that lesson with the
  // zoom ladder.
  // E13 (#258), his words: "a toggle for multi-use rest stops". OFF is the
  // shipped Shrine — Rest or Smith, and taking either leaves. ON keeps the
  // Shrine open: Rest once, Smith while you have Stones, Level while you have
  // cinders, and leave when you choose. On by default (owner's uploaded
  // configuration, #1254).
  { cat: 'Advanced', advancedGroup: 'World', key: 'shrineMultiUse', def: true, label: 'Multi-use Shrines',
    note: 'Rest, Smith and Level at one Shrine, then leave when you choose. Off: taking Rest or Smith leaves the Shrine, as before.' },
  // A SETTING, NOT A SWITCH IN THE FLOW. The creation screen's Starting
  // equipment head carried an "Auto-advance on valid choice" toggle beside
  // the List/Grid control — a preference standing in the middle of a decision
  // (review, 2026-09-11). It lives here with the other Gameplay preferences;
  // the screen reads it the way it reads every other display setting. OFF
  // matches the shipped creation layout (content/source/characterCreation.json
  // `equipmentAutoAdvance`), which stays the screen's fallback when no
  // settings bag reaches it.
  { cat: 'Advanced', advancedGroup: 'Progression', key: 'creationAutoAdvance', def: false, label: 'Auto-advance character creation',
    note: 'After a valid starting-equipment choice, open the next equipment section. Off: each section waits for you to continue.' },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'useRestorativeFlasksOutsideCombat', def: true, label: 'Use flasks outside combat',
    note: 'Allow Crimson and Azure Flask charges to restore Health or Mana from the map. Their charges still refill only at a Shrine.' },
  { cat: 'Display', key: 'shrinePathGlow', def: SHRINE_GLOW_DEFAULT, label: 'Shrine path glow',
    note: 'Light the way to the nearest shrine on the act map. The lane re-aims itself as new paths open, and under fog it is drawn only as far as you can already see — it never shows you a node the fog is covering.' },
  // How strongly the nodes already walked fade behind you — his clause, with
  // his number as the default and the customization he asked for as the row
  // (D17 message 4: "previous nodes shoudl be faded, maybe 50% saturation or
  // higher (settings for customization)"). The ladder itself is CSS
  // (styles/map.css, keyed on data-walked-fade); this row only picks the rung.
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'walkedFade', type: 'choice', def: 'half',
    choices: ['off', 'subtle', 'half', 'strong'], label: 'Walked nodes',
    note: 'How much the nodes you have already visited fade on the act map, so the way forward stands out from the trail behind you. Half mutes them to half saturation; Off keeps the trail as bright as the choice.' },
  // `selfEvident`: W1a shows help only where the effect is not obvious. The
  // note stays on the row as the one place the sentence lives; it is not drawn.
  { cat: 'Display', key: 'accent', type: 'choice', def: 'gold', selfEvident: true,
    choices: ['gold', 'crimson', 'frost', 'verdant', 'violet'], label: 'Accent color',
    note: 'Tint the interface — highlights, borders, focus ring, and glow.' },
  { cat: 'Display', key: 'uiScale', type: 'choice', def: 'Auto',
    choices: ['Auto', 'S', 'M', 'L', 'XL'], label: 'UI size', applied: appliedHtml,
    note: 'Auto flexes the whole interface with your screen; S–XL asks for a fixed size and gets as much of it as fits.' },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'cardMotif', type: 'choice', def: UI_DEFAULTS.cardMotif,
    choices: UI_DEFAULTS.cardMotifModes, label: 'Card motif',
    note: 'Colour cards by their class. Wash tints the card body; Accent puts your accent on the border and moves rarity to a corner pip; Band adds a class stripe. Off keeps every card the same frame.' },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'cardMotifStrength', type: 'choice', def: 'normal', selfEvident: true,
    choices: ['subtle', 'normal', 'strong'], label: 'Motif strength',
    note: 'How strongly the class colour tints a card.' },
  // CARD LORE TYPE (owner, 2026-09-23): "make it configurable in the advanced
  // settings for text related things, with sub options for flavor text". The
  // lists and defaults live in models/LoreTypeModel.js, which also stamps the
  // answer on <html>. Interface text size and readable headings stay in
  // General → Accessibility, their one home; the tab's tip says so.
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Flavor text', key: 'loreFace', type: 'choice', def: LORE_TYPE_DEFAULTS.loreFace,
    choices: LORE_FACES.map((face) => face.label), label: 'Typeface',
    note: 'The face card lore is set in: the one line in card inspection and the lore window it opens. Every face ships with the game; Cinzel has no italic and is always set upright.' },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Flavor text', key: 'loreSize', type: 'choice', def: LORE_TYPE_DEFAULTS.loreSize,
    choices: LORE_SIZES, label: 'Size',
    note: 'How large card lore is set. Stacks with Text size and UI size.' },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Lore window', key: 'loreLeading', type: 'choice', def: LORE_TYPE_DEFAULTS.loreLeading,
    choices: LORE_LEADING, label: 'Line spacing', selfEvident: true,
    note: 'Space between the lines of the lore window.' },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Flavor text', key: 'loreTracking', type: 'choice', def: LORE_TYPE_DEFAULTS.loreTracking,
    choices: LORE_TRACKING, label: 'Letter spacing', selfEvident: true,
    note: 'Space between the letters of card lore.' },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Lore window', key: 'loreSlant', type: 'choice', def: LORE_TYPE_DEFAULTS.loreSlant,
    choices: LORE_SLANTS, label: 'Lore slant', selfEvident: true,
    note: 'Italic or upright for the body of the lore window.' },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Flavor text', key: 'loreIdentitySlant', type: 'choice', def: LORE_TYPE_DEFAULTS.loreIdentitySlant,
    choices: LORE_SLANTS, label: 'Identity line slant', selfEvident: true,
    note: 'Italic or upright for the one-line identity shown in card inspection.' },
  { cat: 'Combat', key: 'screenShake', def: true, label: 'Screen shake', selfEvident: true,
    note: 'Camera kick on heavy hits and staggers. Off keeps combat steady.' },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'ambient', type: 'choice', def: 'normal',
    choices: ['off', 'low', 'normal', 'high'], label: 'Ambient effects',
    note: 'Drifting embers and the title-screen glow. Off is the calmest.' },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'controlHints', def: true, label: 'Control hints',
    note: 'Show the bar of keyboard shortcuts along the bottom of the map and combat.' },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'mapFreePan', def: MAP_FREE_PAN_DEFAULT, label: 'Two-axis map dragging',
    note: 'Drag the act map left and right as well as up and down. Off keeps the map centred horizontally and allows vertical dragging only.' },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'mapHeaderDensity', type: 'choice', def: 'compact',
    choices: ['comfortable', 'compact'], label: 'Map header',
    note: 'Comfortable shows your name and full stats; Compact tightens the bar.' },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'mapHeaderRelics', def: true, label: 'Relics in map header', selfEvident: true,
    note: 'Show your relic icons in the map header bar.' },
  // RETIRED (owner, 2026-09-23). The solo map header never draws the seed —
  // the header model receives it and prints nothing — and the co-op header's
  // `.mh-seed` has no rule under the `hide-header-seed` class main.js sets, so
  // this switch moved nothing anywhere. The key stays so a settings file that
  // names it still imports.
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'mapHeaderSeed', def: true, label: 'Seed in map header', selfEvident: true, retired: true,
    note: 'Show the run seed in the map header bar.' },
  // Short-screen warning is optional on narrow landscape screens.
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'uprightGate', def: false, label: 'Short-screen warning',
    note: 'On a screen too short for the board — a phone turned sideways, or a very short window — the game explains instead of drawing a board you cannot finish a turn on. Turn this off to draw it anyway: nothing is lost, but END TURN sits off screen on a sideways phone and there is no way to scroll to it.' },

  { cat: 'Display', key: 'quickNav', type: 'choice', def: 'mirror',
    choices: ['off', 'mirror', 'switcher'], label: 'Quick menu',
    note: 'MIRROR keeps the menu tabs and adds the destination list. SWITCHER folds the tab strip into one button on narrow screens. OFF keeps the direct-to-Settings route. Fresh or invalid values use MIRROR.' },

  { cat: 'Combat', key: 'armamentsPresentation', type: 'choice', def: 'radial',
    choices: ['radial', 'fixed'], label: 'Combat Armaments',
    note: 'RADIAL SHORTCUTS moves flasks and potions into the combat Armaments cluster. FIXED HUD keeps them in the top HUD.' },
  { cat: 'Combat', key: 'armamentsPhonePlacement', type: 'choice', def: 'left',
    choices: ['left', 'center', 'right'], label: 'Phone Armaments location',
    note: 'Geometry only: place the radial at the lower left, lower center, or lower right on narrow screens.' },

  { cat: 'Combat', key: 'showPlayedCard', def: false, label: 'Show played card animation',
    note: 'Show the played card flying toward its target. Off by default. Character animations, combat effects and auras still play.' },

  ...HUD_VISIBILITY_SETTINGS,

  { cat: 'Audio', key: 'musicEnabled', def: AUDIO_DEFAULTS.musicEnabled,
    resolve: resolveMusicEnabled, label: 'Music', note: musicEnabledCondition },
  { cat: 'Audio', key: 'muteAudio', def: false, positiveWhen: false, label: 'Audio',
    note: 'Turn music and sound effects on. Music also has a quick toggle beside the HUD.' },
  { cat: 'Audio', key: 'musicVolume', type: 'range', def: AUDIO_DEFAULTS.musicVolume, label: 'Music volume', selfEvident: true,
    note: 'Ambient score for the title, map, and battles.' },
  { cat: 'Audio', key: 'sfxVolume', type: 'range', def: AUDIO_DEFAULTS.sfxVolume, label: 'Sound effects', selfEvident: true,
    note: 'Hits, blocks, status bursts, cards, and pickups.' },
  { cat: 'Advanced', advancedGroup: 'Export', debugTopic: true, key: 'musicFolder', type: 'text', def: '', label: 'Custom music folder',
    placeholder: 'e.g. music/ or https://…',
    note: 'Folder/URL with a manifest.json mapping combat/boss/shop/rest/… to track files. Empty = the score shipped in music/ beside the game, or the built-in generated score where that is unavailable.' },

  { cat: 'Accessibility', key: 'touchFlickPlay', def: UI_DEFAULTS.touchFlick.enabled, label: 'Card flick to play',
    note: 'Flick a card upward with touch, mouse, trackpad or pen to play it on the nearest valid target. Selection and the information button work as usual.' },
  { cat: 'Accessibility', key: 'touchFlickDistance', type: 'number', def: UI_DEFAULTS.touchFlick.distance.def,
    min: UI_DEFAULTS.touchFlick.distance.min, max: UI_DEFAULTS.touchFlick.distance.max, slider: true, practice: true, label: 'Card flick distance',
    note: 'Upward travel in screen pixels. Shorter needs less movement; longer helps avoid accidental plays. Release with an upward flick.' },
  { cat: 'Accessibility', key: 'reducedMotion', def: false, label: 'Reduced motion',
    note: 'Calm ambient effects, drop the map pulse, and shorten animations.' },
  // ON by default. Measured, not assumed: at the old default eight text targets
  // sat below the WCAG AA floor and the secondary buttons' own outlines sat at
  // 1.64:1 against a 3.0 floor. High contrast clears all of that and costs one
  // thing — see the note. `node tools/contrast-audit.mjs` re-runs the numbers.
  { cat: 'Accessibility', key: 'highContrast', def: true, label: 'High contrast',
    note: 'Brighter text and stronger borders throughout for readability. On by default — turn it off for the dimmer, more atmospheric palette.' },
  { cat: 'Accessibility', key: 'textSize', type: 'choice', def: 'Auto',
    choices: ['Auto', 'S', 'L', 'XL'], label: 'Text size',
    note: 'Scale interface text from the browser baseline. Auto follows the browser stylesheet; S/L/XL aid readability. Stacks with UI size.' },
  // Constantine, twice: "just make the tabs about 20% smaller or the size
  // configurable or scalable with UI or both", then "actually, I think it
  // should be able to go smaller than 44px." Range 24–44 is Marina's call, and
  // it is told to him as a choice we made rather than a limit he ran into: we
  // let it go below 44 as asked and stopped at 24, WCAG 2.2 AA's minimum. His
  // no is free.
  //
  // NUMBERS, NOT S/M/L/XL. Text size is S/M/L/XL and UI size is S/M/L/XL, both
  // within a few rows of this one. A third four-letter ladder doing a third job
  // is Law 4's defect — two controls with one job, the weaker reading as broken
  // — with better manners. These are the numbers he typed.
  //
  // ACCESSIBILITY, NOT DISPLAY: it sits with Text size, High contrast and
  // Reduced motion because it is an ergonomic floor, not a look.
  //
  // DEFAULT 44 = TODAY, TO THE PIXEL. Nobody who never opens this sees anything
  // move — the same principle `quickNav: def 'off'` already carries above.
  // `choices` and `def` are DERIVED from balance.ui.tapSize; the four numbers
  // are not written here, or the closed set would have two homes.
  //
  // `resizesWhilePressed` — THE ONE CONTROL EXEMPT FROM THE FLOOR IT SETS.
  // Marina's ruling, on the narrowest reason available so it cannot spread:
  // this is the only control in the game whose resizing happens WHILE IT IS
  // BEING PRESSED. Measured cause: at the 44 step the pressed chip landed 61.44
  // device px from the finger because the whole group re-lays-out, which is
  // wider than a fingertip and which no `scrollTop` can answer.
  // Declared as a CHARACTERISTIC rather than handled by name, so the stylesheet
  // keys on the property and not on `tapFloor` (Law 1 clause 3, one layer up).
  { cat: 'Accessibility', key: 'tapFloor', type: 'choice', def: String(UI_DEFAULTS.tapSize.def),
    choices: UI_DEFAULTS.tapSize.sizes.map(String), label: 'Minimum tap size',
    applied: tapCostHtml, resizesWhilePressed: true,
    note: 'How small a button, tab, or option is allowed to get. 44 is the size a fingertip reliably hits; smaller fits more on screen.' },
  { cat: 'Accessibility', key: 'colorblindSafe', def: false, label: 'Colorblind-friendly',
    note: 'Shift danger/heal/blight/frost colors to a more distinguishable palette.' },
  { cat: 'Accessibility', key: 'reduceFlashes', def: false, label: 'Reduce flashes',
    note: 'Suppress bright impact and proc flashes (photosensitivity). Damage numbers stay.' },
  { cat: 'Accessibility', key: 'readableHeadings', def: false, label: 'Readable headings',
    note: 'Use the plain UI font for titles instead of the decorative serif.' },
  { cat: 'Advanced', advancedGroup: 'Export', debugTopic: true, key: 'commandLog', type: 'button', btn: 'Open', label: 'Command log',
    note: 'The recent commands and results between the interface and the engine. Copy it into a bug report if the game misbehaves.' },
  // E2 (#247): the recorded answer on the row — Sell is its own bar at the
  // merchant, conditional on THIS toggle, DEFAULT ON until he says otherwise,
  // and the bar is ABSENT (not greyed) when off. shop.js reads it through
  // settingOn so the default's polarity has one home, here. ONE ROW, appended
  // on purpose while another seat serializes this file for E3 — named in the
  // E2 claim (#247) so the touch is on the record, not smuggled.
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'shopSell', def: true, label: 'Merchant buys back',
    note: 'The shop offers a Sell bar for relics and flasks, at his prices. Off removes the bar entirely.' },
  // HOLD TO CONFIRM. Constantine: "yes press and hold" / "configurable in
  // debugging settings as enum drop down". Advanced is the debugging surface,
  // which is where he put it and where it stays.
  //
  // IT IS A CHIP ROW AND NOT A `<select>`, AND THAT IS AN ANSWER, NOT A
  // SHORTCUT. This game has no dropdown anywhere; `.choice-group` IS its enum
  // control. A native `<select>` would be the only one in the build, and it
  // would arrive outside everything this row gets for free: `--tap-floor` has
  // no relationship to a UA-drawn select, the accent theme and the
  // high-contrast profile do not reach inside one, it renders as three
  // different surfaces (iOS wheel / Android sheet / desktop popup) and none of
  // the three can be photographed or measured by any instrument in this repo —
  // `tools/tapsize.mjs` and `tools/settingsreach.mjs` both count `.choice`, so
  // they would read this row as ABSENT, which is silence, which is `unknown`.
  // Four chips is also the shape I measured safe tonight: Combat pacing is four
  // and renders 92.1 px tall at 390x844, where the seven-chip Map zoom row runs
  // to 301.2 px and puts its last chip off the viewport.
  //   IF HE MEANT THE NATIVE WIDGET SPECIFICALLY, that is one word and I will
  // swap it — but adding the game's only `<select>` on a guess, on the one page
  // no instrument here can see, is not a thing to do quietly.
  //
  // `choices` and `def` are DERIVED from balance.ui.holdConfirm. Adding a fifth
  // speed is a row there and nothing here.
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'holdConfirm', type: 'choice', def: UI_DEFAULTS.holdConfirm.def,
    choices: Object.keys(UI_DEFAULTS.holdConfirm.steps), label: 'Hold to confirm',
    // SHORT ON PURPOSE, and I measured why. My own ruling on the Map zoom row
    // tonight was that a long note plus a chip strip squeezes the text column
    // to a ribbon; the first draft of THIS note ran three sentences and took
    // the row to 216.9 px against 92.1 for Combat pacing. A rule I hold someone
    // else to on a Thursday holds on my own row on the same Thursday.
    note: 'Choices a run can’t take back fill as you hold them, so a mis-tap can be let go before it lands. Off returns to one tap.' },
  // REWARD COLLECTION (E11, #256). His sentence IS this row: "Continue is
  // ALWAYS pressable and a setting decides what it means — auto-collect ON
  // takes everything, picking at random where there is a choice; OFF gives
  // only what was chosen, no nagging." The meanings live in
  // model/rewardplan.js resolveContinue (test 61); this row only picks the
  // word. ADVANCED for the Hold-to-confirm precedent one row up: a knob about
  // what an interaction MEANS, tried by playing.
  //
  // `choices` and `def` are DERIVED from balance.ui.rewardCollect — a third
  // mode is a row there and nothing here. THE ROW ARRIVED LATE, ON A RULING:
  // it shipped one PR behind the dial because this file was under E3's live
  // claim at authoring; Saga's #290 review ruled it owed the moment Marina
  // released that claim ("manual has a reader and no writer a player can
  // reach").
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'rewardCollect', type: 'choice', def: UI_DEFAULTS.rewardCollect.def,
    choices: UI_DEFAULTS.rewardCollect.modes, label: 'Reward collection',
    note: 'Auto: Continue takes everything you didn’t skip, picking a card for you. Manual: Continue means done — only what you chose comes along.' },
  // WEAPON SWAP COST — his three prices, switchable (A8). Constantine,
  // 2026-08-08: *"let's default to costing 2 actions. alternatively, or by a
  // setting, different weapon categories have weapon swap costs. THAT WAY I CAN
  // TRY EACH."* He asked to feel three prices, so the row is the way to feel
  // them; the rules themselves are rows in balance.equipment.swapCostRules.
  //
  // ADVANCED, because Advanced is this game's debugging surface and that is
  // where the last knob he asked to "try" went (Hold to confirm, same
  // category). It is a tuning question he wants to answer by playing, not a
  // preference the game should be asking a first-time player.
  //
  // `choices` and `def` are DERIVED, never typed. The zoom row two screens up
  // carried four of a six-step ladder for a night because someone typed the
  // list; a fourth rule row is a row in balance.js and nothing here.
  { cat: 'Advanced', advancedGroup: 'Equipment', key: 'swapCostRule', type: 'choice', def: EQ_DEFAULTS.swapCostRule,
    choices: (EQ_DEFAULTS.swapCostRules || []).map((r) => r.id), label: 'Weapon swap cost',
    // ONE SENTENCE PER RULE AND NO MORE, on the measurement in the row above:
    // a long note squeezes the text column beside a chip strip. Three chips,
    // three clauses.
    note: 'What switching armament sets costs mid-fight. FLAT charges the same for every weapon; TALISMAN & RELIC starts there and lets your gear make it dearer or cheaper; WEAPON CATEGORY prices it by the weapon you are drawing — a heavy one is slow, a quick one is not. Takes effect on the next fight.' },
  // ---- HIS TWO LEVELLING DIALS (2026-08-17) --------------------------------
  //
  //   "leave the level up value configurable. also, let's make the increment of
  //    5 points for reasonable change be confurable as well. that way I can
  //    test each."
  //
  // ADVANCED, AND THE PRECEDENT IS HIS OWN SENTENCE TWO ROWS UP: *"alternatively,
  // or by a setting, different weapon categories have weapon swap costs. THAT
  // WAY I CAN TRY EACH."* That ask was ruled into an Advanced row for a reason
  // that applies here word for word — a tuning question he wants to answer by
  // playing, not a preference to put in front of a first-time player. Advanced
  // is this game's debugging surface, his word, and the third knob he has asked
  // to "test" now sits beside the other two.
  //
  // A ROW, NOT A FILE HE EDITS AND REBUILDS. "That way I can test each" is the
  // requirement and not a footnote: a content edit plus `node tools/launch.mjs
  // --build-only` between every comparison is a friction that ends an
  // experiment after two turns of the dial.
  //
  // `choices` and `def` are DERIVED and NEITHER NUMBER IS TYPED HERE: the
  // ladders are `balance.levelUp`, the level value's default is that table's own
  // `pointsPerLevel`.
  // CARD SIZE, TUNABLE IN PLACE. The three levels a card is drawn at live in
  // content/config/ui/components/card.json and ship as the default; these rows
  // lay an override over that table so a size can be tried against real cards
  // without a rebuild, and `cardSizingExport` hands back the exact JSON block
  // to paste into the file when a number is worth keeping.
  //
  // The ladder is the contract: a card you opened to read is never smaller
  // than one you were browsing past. A set of numbers that breaks it is
  // REFUSED and the authored table stands — see cardLevelsWithOverrides.
  { cat: 'Advanced', advancedGroup: 'Wireframes', cardSizeTopic: true, key: 'cardWidth_glance', type: 'number',
    def: CARD_LEVELS.glance.widthPx, min: CARD_WIDTH_BOUNDS.min, max: CARD_WIDTH_BOUNDS.max, slider: true, label: 'Resting card width',
    note: 'How wide a card is while you are browsing past it, in pixels. Must stay smaller than the selected width.' },
  { cat: 'Advanced', advancedGroup: 'Wireframes', cardSizeTopic: true, key: 'cardWidth_glance_mobile', type: 'number',
    def: CARD_LEVELS.glance.variants.mobile, min: CARD_WIDTH_BOUNDS.min, max: CARD_WIDTH_BOUNDS.max, slider: true, label: 'Resting card width, phone',
    note: 'The resting width on a narrow screen. It ships equal to the resting width above, so nothing changes until you move it.' },
  { cat: 'Advanced', advancedGroup: 'Wireframes', cardSizeTopic: true, key: 'cardWidth_focus', type: 'number',
    def: CARD_LEVELS.focus.widthPx, min: CARD_WIDTH_BOUNDS.min, max: CARD_WIDTH_BOUNDS.max, slider: true, label: 'Selected card width',
    note: 'How wide the card you have picked out becomes. Must sit between the resting and reading widths.' },
  { cat: 'Advanced', advancedGroup: 'Wireframes', cardSizeTopic: true, key: 'cardWidth_inspect', type: 'number',
    def: CARD_LEVELS.inspect.widthPx, min: CARD_WIDTH_BOUNDS.min, max: CARD_WIDTH_BOUNDS.max, slider: true, label: 'Reading card width',
    note: 'How wide a card is in the window you open to read it. Must stay larger than the selected width.' },
  { cat: 'Advanced', advancedGroup: 'Wireframes', cardSizeTopic: true, key: 'cardSizeExport', type: 'button', btn: 'Copy',
    label: 'Export card sizes',
    note: 'Copies the tuned sizes as a JSON fragment shaped like content/config/ui/components/card.json itself — merge it in at the FILE ROOT, where it replaces sizing.levels. It carries only the widths, so ratio, bands and behavior are left alone.' },
  { cat: 'Advanced', advancedGroup: 'Progression', key: 'levelUpValue', type: 'number', def: LEVEL_DEFAULTS.pointsPerLevel,
    min: LEVEL_DEFAULTS.pointsPerLevelMin, max: LEVEL_DEFAULTS.pointsPerLevelMax,
    label: 'Level-up value', applied: numberAppliedHtml,
    note: 'How many stat points one level grants — type any whole number from 1 to 20. Takes effect on the next level you reach, in any run, including one already in progress; the points wait at the shrine until you assign them.' },
  ...ADVANCED_CONFIG_ROWS,
  { cat: 'Advanced', advancedGroup: 'Export', key: 'promptSettingsExport', def: true, label: 'Offer export when done',
    note: 'Ask to export a configuration file after Done and Save.' },
  { cat: 'Advanced', advancedGroup: 'Export', key: 'gameConfigExport', type: 'button', btn: 'Export JSON', label: 'Export game configuration',
    note: 'Save every non-default game configuration value. Desktop opens Save As when available; mobile downloads the JSON locally.' },
  { cat: 'Advanced', advancedGroup: 'Export', key: 'gameConfigImport', type: 'button', btn: 'Load JSON', label: 'Load game configuration',
    note: 'Choose an exported settings JSON file. Included values replace your current settings; other settings and saved runs are untouched. Presentation changes apply immediately; starting stats and balance apply to new runs.' },
  // Advanced is the debugging surface — his word, and where Hold to confirm
  // already lives. These rows are generated from balance.graceRefill; see the
  // block above the ROWS array.
  ...graceRefillRows(),
  ...wireframeChoiceRows(),
];

// ---- categories: a heading is DERIVED from what is under it (#78) ----------
//
// This used to be a hand-written list of six names, and `renderSettings` looked
// up `ROWS.filter(r => r.cat === cat)`. A name in that list with no rows and no
// section rendered a LONE HEADING — the author did the data-driven thing and got
// a promise with nothing behind it, in silence.
//
// So the list is no longer authored. A category EXISTS because something is
// filed under it: a `cat:` on a row, or a section below. What stays authored is
// the ORDER, which is a design decision and not derivable — and a name in the
// order that nothing files under is a defect that fails by name at boot
// (assertSurfaces, src/ui/surfaces.js), not a heading over nothing.
//
// Adding a settings row under a brand-new category needs NO edit here: the
// heading appears, after the ordered ones, in the order its first row appears.
//
// SECTIONS are categories whose contents are code rather than rows.
// Profile is a title-screen route; Settings no longer duplicates that drawer.
// About carries the AI-use acknowledgement, rendered from its one home in
// src/content/aiDisclosure.js — the same text the store page shows (#69).
//
// `tip` IS THE ONE THING A SECTION HAS TO WRITE, and it is the honest edge of
// clause 7 on this screen. A category made of rows derives its tooltip from the
// rows filed under it — the author writes nothing. A section has no rows to
// read, so its one sentence is authored here, where its code already is. That
// is Law 0 clause 2 exactly: a section is a WORD, not a row, and a word costs
// an edit. Say it out loud rather than pretend the whole screen is free.
const SECTIONS = {
  Changelog: { mount: 'set-changelog-mount', needs: null,
    tip: 'Newest player-visible changes first.' },
  About: { mount: 'set-about-mount', needs: null,
    tip: 'Version, credits, and how AI was used to make this game.' },
};

const ADVANCED_GROUPS = Object.freeze([
  // ---- ONE HOME PER SETTING (owner, 2026-09-23) ----------------------------
  //
  // "a lot of the advanced settings have settings duplicated in multiple
  // sections making it hard to tell which does what." Sixteen tabs became
  // thirteen, read top to bottom as: the run's content (opening, character,
  // combat, hand, defence, rewards, equipment, world), then how it is drawn
  // (interface, battlefield, layout), then files and diagnostics.
  //
  //   Rules      gone — its skills, talents and XP went to Progression, its
  //              relic values to Equipment, rest / co-op / gauntlet / endless
  //              to World, costs and deck limits to Combat.
  //   Gameplay   gone — each preference joined the subject it changes.
  //   Tuning     gone — the swap-cost rule sits with the swap-cost numbers.
  //   Card size  folded into Layout with the wireframe and window sizes: every
  //              "how big is it drawn" control in one tab.
  //   Debug      folded into Import, export & debug.
  //
  // Where two rows still touch one quantity (the tier dial and each stat's
  // own tier; the legacy poise meter and the ratings breaks; the fallback hand
  // size and the hand rules) they now share a topic and the row note names
  // the winner. Rows that moved nothing are retired: off the screen, still
  // importable.
  //
  // A retired tab id resolves through `activeAdvancedGroup`, so a profile that
  // last had "Rules" open lands on the first tab rather than a blank panel.
  { id: 'Opening', label: 'Opening sequence', tip: 'Opening artwork, dialogue, timing, motif and preview. Included in configuration exports.' },
  { id: 'Progression', label: 'Character & progression', tip: 'Creation points, each class’s defaults, level-up, experience, skills and talents. What the points turn into is under Stats.' },
  // THE TIP CARRIES A FORWARDING ADDRESS: this section is NAMED for combat and
  // holds authored constants, so it is exactly where someone looking for an
  // animation switch lands. One clause ends that walk.
  { id: 'Combat', label: 'Combat rules', tip: 'Action and resource costs, card values, deck limits and arcane exposure. Combat pacing, animation, sprites and Armaments are in General → Combat.' },
  // ONE TAB PER IDEA, AND STATS IS ONE IDEA (owner, 2026-09-21). Hand & Draw,
  // Stats & Defence, Progression → Stats & resources and the Poise, Stagger
  // and Mana constants were four doors onto the same traits. Each trait is one
  // topic here (models/AdvancedSettingsGroups.js) with a live worked example
  // (models/StatsPreviewModel.js).
  { id: 'Stats', label: 'Stats', tip: 'Everything that turns attributes into Actions, Draw and hand size, HP, Stamina, Mana, Poise, Ward and the combat ratings — one topic per trait, each with a live worked example.' },
  { id: 'Rewards', label: 'Rewards & economy', tip: 'Cinders, reward rarity, merchants, flasks and smithing.' },
  { id: 'Equipment', label: 'Equipment & relics', tip: 'Starting kits, drops, swapping, equipment balance and relic values.' },
  { id: 'World', label: 'Run & world', tip: 'Rest and shrines, the atlas and seats, run modifiers, gauntlet, co-op and endless.' },
  { id: 'Interface', label: 'Interface', tip: 'Map and HUD, card appearance, and confirmation controls.' },
  { id: 'Text', label: 'Text & lore', tip: 'Typeface, size and spacing for card lore. Interface text size and readable headings are in General → Accessibility.' },
  { id: 'Battlefield', label: 'Battlefield', tip: 'Formation layout, grid, character placement and formation movement.' },
  // The wireframe decisions the drawings leave open, one topic per family of
  // surfaces, now beside the other size controls (cards, the settings window):
  // every "how big and where" answer in one place.
  { id: 'Wireframes', label: 'Layout', tip: 'How windows, menus, scenes and cards are sized and laid out. Every choice starts where the game already draws it.' },
  { id: 'Export', label: 'Import, export & debug', tip: 'Load or save game configuration as a portable JSON file, and diagnostics.' },
  { id: 'Sync', label: 'Defaults & sync', tip: 'Save your settings as your defaults on GitHub and load them on any device.' },
  { id: 'Changelog', label: 'Changelog', tip: 'Recent changes.' },
  { id: 'About', label: 'About', tip: 'Version and credits.' },
]);

// ---- DEBUG-ONLY SECTIONS (owner, 2026-09-24) --------------------------------
// "most of the advanced features probably should be locked behind a debug flag
// that should only appear in dev and test builds. main should not have them."
// A release build keeps the player-facing parts of Advanced — how the map, HUD,
// cards and lore text look and confirm — plus Changelog and About. Every
// tuning, rules, layout, import/export, diagnostics and sync section is shown
// only where `pageDebug()` is true (src/ui/buildChannel.js says where that is).
// Stored values are untouched either way: hiding a section changes what is
// drawn, never what a profile holds.
export const RELEASE_ADVANCED_GROUP_IDS = Object.freeze(['Interface', 'Text', 'Changelog', 'About']);
/** Groups with their own mounted panel instead of rows. */
const MOUNTED_ADVANCED_GROUPS = Object.freeze({ Changelog: 'set-changelog-mount', About: 'set-about-mount', Sync: 'set-sync-mount' });

/** visibleAdvancedGroups(debug) → the Advanced sections this build shows. */
export function visibleAdvancedGroups(debug = pageDebug()) {
  return debug ? ADVANCED_GROUPS : ADVANCED_GROUPS.filter((group) => RELEASE_ADVANCED_GROUP_IDS.includes(group.id));
}

/** The key the chosen category rides in. `meta.settings` is a free bag. */
const CAT_KEY = 'settingsCategory';
const ADVANCED_CAT_KEY = 'settingsAdvancedCategory';

/**
 * activeAdvancedGroup(settings) → the Advanced group actually on screen.
 *
 * ONE RESOLUTION, READ BY BOTH DOORS. The painter fell back to the first group
 * when the stored id no longer existed and never wrote the fallback back, so
 * "Class defaults" — a tab this change retired — stayed in the profile. The
 * reset button then read the RAW stored value, asked for the subgroups of a
 * group that is gone, got none, reset zero keys and said nothing. Anyone whose
 * last-open tab was that one met it on first launch of the new build.
 */
export const ADVANCED_GROUP_IDS = Object.freeze(ADVANCED_GROUPS.map((group) => group.id));

/**
 * formationLayoutRows() → the rows the formation editor edits, found by TOPIC
 * in whichever tab files them. The mount named its tab ('Interface') and the
 * topic moved to Battlefield under it, handing the editor no rows: every
 * number threw on `row.max` and Apply saved nothing (Codex, on #1256). Asking
 * every tab means the next move cannot do that again.
 */
export function formationLayoutRows() {
  return ADVANCED_GROUP_IDS.flatMap((id) => advancedSubgroups(ROWS, id))
    .find((group) => group.id === 'Formation layout')?.rows || [];
}

// Tabs merged into Stats, and topics that moved there out of tabs that still
// exist. A profile last left on one of them opens on Stats rather than on the
// first tab, or on an unrelated first topic of the tab it was in (Codex, on
// #1252).
const MERGED_ADVANCED_GROUPS = Object.freeze({ 'Ratings & Resistance': 'Stats', 'Hand & Draw': 'Stats' });
const MOVED_ADVANCED_TOPICS = Object.freeze({
  Progression: ['Stat conversions', 'Stats & resources'],
  Combat: ['Poise', 'Stagger', 'Mana'],
  Rules: ['Poise', 'Stagger', 'Mana'],
});

export function activeAdvancedGroup(settings) {
  const raw = settings?.[ADVANCED_CAT_KEY];
  const moved = MOVED_ADVANCED_TOPICS[raw]?.includes(settings?.[`settingsAdvancedSubgroup.${raw}`]);
  const stored = moved ? 'Stats' : MERGED_ADVANCED_GROUPS[raw] || raw;
  const shown = visibleAdvancedGroups();
  return shown.some((group) => group.id === stored) ? stored : shown[0].id;
}

// The Stats topic a migrated profile lands on: where the rows it was last
// looking at went, not Overview.
const MIGRATED_STATS_TOPICS = Object.freeze({ 'Hand & Draw': 'Draw & hand', Poise: 'Poise', Stagger: 'Poise', Mana: 'Mana' });

/** storedAdvancedTopic(settings, groupId) → the topic id a tab opens on, or undefined for its first. */
export function storedAdvancedTopic(settings, groupId) {
  const stored = settings?.[`settingsAdvancedSubgroup.${groupId}`];
  if (stored !== undefined || groupId !== 'Stats') return stored;
  const raw = settings?.[ADVANCED_CAT_KEY];
  const old = settings?.[`settingsAdvancedSubgroup.${raw}`];
  // A topic that kept its name under Stats (Resistance, Impact, Breaks, the
  // per-item tables) reopens as itself (Codex, on #1252).
  if (MERGED_ADVANCED_GROUPS[raw] && advancedSubgroups(ROWS, 'Stats').some((group) => group.id === old)) return old;
  // Stats & Defence's own General and legacy-poise topics.
  if (raw === 'Ratings & Resistance') return { General: 'Overview', 'Without ratings (legacy poise)': 'Poise' }[old];
  return MIGRATED_STATS_TOPICS[raw] || MIGRATED_STATS_TOPICS[old];
}

export const CATEGORY_ORDER = ['General', 'Accessibility', 'Advanced'];

// The groups the General tab's first picker offers, in the order it offers
// them. ONE HOME: the tab's row filter, the picker, the stored-value migration
// and Reset-this-group all read this list, and a fifth group is one entry here
// plus a branch in `generalGroups`. They were four separate `['Display',
// 'Audio']` literals before Combat existed, which is four places for a fifth
// group to be forgotten in.
export const GENERAL_GROUPS = ['Display', 'Combat', 'Audio'];

/** The General group a stored value names, or the first one. Never undefined:
 *  a bag written by an older build can hold a group this one dropped. */
export function generalGroup(settings) {
  return GENERAL_GROUPS.includes(settings?.settingsGeneralCategory)
    ? settings.settingsGeneralCategory : GENERAL_GROUPS[0];
}

// W1a names the first category Display, as its id already is. (It read "Game"
// from f17d9a2e; restoring that is one entry here.)
const CATEGORY_LABELS = {};

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || cat;
}

/**
 * categoryHandler(cat) → what will render under that heading, or null.
 *
 * Null is the whole point: it is the difference between a heading with contents
 * and a heading with a promise. assertSurfaces() turns null into a named boot
 * failure; nothing here guesses.
 */
export function categoryHandler(cat) {
  if (cat === 'General') return { rows: ROWS.filter(row => GENERAL_GROUPS.includes(row.cat) && !row.retired) };
  if (SECTIONS[cat]) return SECTIONS[cat];
  const rows = ROWS.filter((r) => r.cat === cat && !r.retired);
  return rows.length ? { rows } : null;
}

/**
 * filedCategories() → every category something is actually FILED under: a row's
 * `cat`, or a SECTIONS key. The DERIVED half of this set.
 *
 * Exported because it is one of the set's two homes and surfaces.js now asks
 * each home for its own members rather than asking the set for a union (Vira,
 * re-gate of #78: a guard proven over one home must be re-proven when the set
 * gains a second — with one union, `CATEGORY_ORDER = []` left six categories,
 * a green verdict, and the only authored fact about this screen silently gone).
 * It is a read of the rows, not a copy of them: `settingsCategories()` below is
 * derived from it, so the two cannot drift.
 */
export function filedCategories() {
  return ['General', 'Accessibility', 'Advanced'];
}

/** Every category that exists, in the order it is drawn. Derived, one home. */
export function settingsCategories() {
  const found = filedCategories();
  // An authored name nothing files under is KEPT in place, not dropped: dropping
  // it is the silence again. It renders its own defect and assertSurfaces names
  // it. Anything filed under a name the order does not mention goes last.
  return [...CATEGORY_ORDER, ...found.filter((c) => !CATEGORY_ORDER.includes(c))];
}

/**
 * categoryTip(cat) → the sentence a tab says on hover AND on the pad's focus
 * cursor (Law 3 clause 4). DERIVED for a category of rows, authored for a
 * section.
 *
 * It answers the question the tabs create. Six names hide five sixths of the
 * screen, and the player's question stops being "what is under this heading"
 * and becomes "WHICH TAB HOLDS THE THING I CAME FOR". Counting the rows and
 * naming the first few of them answers exactly that, and it costs an author
 * nothing — the labels are already written, once, on the rows.
 *
 * Three labels, then an ellipsis: enough to recognise, short enough to finish.
 */
export function categoryTip(cat) {
  if (cat === 'Advanced') return pageDebug() ? 'Optional gameplay rules, tuning, diagnostics, sync, and the changelog.' : 'Map, HUD and card appearance, lore text, the changelog and About.';
  const h = categoryHandler(cat);
  if (!h) return `Nothing is filed under "${cat}".`;
  if (h.mount) return h.tip || `The ${cat} section.`;
  const labels = h.rows.map((r) => r.label);
  const n = labels.length;
  const shown = labels.slice(0, 3).join(', ');
  return `${n} setting${n === 1 ? '' : 's'} — ${shown}${n > 3 ? '…' : ''}`;
}

// Resolve a stored value against its default (defaults keep settings sparse).
function valueOf(settings, row) {
  if (row.resolve) return row.resolve(settings);
  return row.def ? settings[row.key] !== false : settings[row.key] === true;
}

export function musicEnabledCondition(settings = {}) {
  if (!resolveMusicEnabled(settings)) return 'Music off · sound effects unchanged.';
  if (settings.muteAudio === true) return 'Music on · all audio muted.';
  const volume = typeof settings.musicVolume === 'number'
    ? settings.musicVolume
    : AUDIO_DEFAULTS.musicVolume;
  return `Music on · volume ${volume}%.`;
}

export function resolveArmamentsPresentation(settings = {}) {
  return ['radial', 'fixed'].includes(settings.armamentsPresentation)
    ? settings.armamentsPresentation : 'radial';
}

export function resolveArmamentsPhonePlacement(settings = {}) {
  return ['left', 'center', 'right'].includes(settings.armamentsPhonePlacement)
    ? settings.armamentsPhonePlacement : 'left';
}

function rowNote(settings, row) {
  return typeof row.note === 'function' ? row.note(settings) : row.note;
}

// ---- A ROW THAT DOES NOTHING RIGHT NOW IS DISABLED, AND SAYS WHY ----------
//
// (owner, 2026-09-23: "Disable fields if toggle isn't on.") `gates` on a row
// (model/advancedConfig.js, model/startingStatConfig.js) name the switch that
// decides whether it takes effect. While any gate is closed the row's controls
// are disabled and a line under its label says which switch opens it; an
// override row also shows the value it is inheriting in place of its own, so
// the number on screen is always the number in force. Its own stored value is
// kept, and comes back when the switch does.
const GATED_ROWS = ROWS.filter((row) => row.gates?.length);
const rowByKey = (key) => ROWS.find((row) => row.key === key);

function inheritedValue(gate, settings) {
  if (gate.inherited) return gate.inherited(settings);
  if (!gate.inheritedKey) return undefined;
  const row = rowByKey(gate.inheritedKey);
  return Object.hasOwn(settings, gate.inheritedKey) ? settings[gate.inheritedKey] : row?.def;
}

export function gateSentence(gate, settings) {
  const switchRow = rowByKey(gate.key);
  const name = `“${switchRow?.label || gate.key}”`;
  if (gate.own) {
    const value = inheritedValue(gate, settings);
    const from = gate.inheritedKey ? `“${rowByKey(gate.inheritedKey)?.label || gate.inheritedKey}”` : 'the authored value × the multiplier';
    return `Following ${from}${value === undefined ? '' : ` (${value})`}. Turn on ${name} to set this one.`;
  }
  if (gate.when === false) return `Used only while ${name} is off.`;
  if (gate.when === undefined || gate.when === true) return `Used only while ${name} is on.`;
  const label = switchRow?.choiceLabels?.[gate.when] || gate.when;
  return `Used only while ${name} is set to ${String(label).toUpperCase()}.`;
}

export function closedGate(settings, row) {
  return (row.gates || []).find((gate) => !gateOpen(settings, gate, rowByKey)) || null;
}

export function refreshGates(container, settings) {
  const controls = new Map();
  for (const el of container.querySelectorAll('[data-key]')) {
    if (!controls.has(el.dataset.key)) controls.set(el.dataset.key, []);
    controls.get(el.dataset.key).push(el);
  }
  for (const row of GATED_ROWS) {
    const els = controls.get(row.key);
    if (!els) continue;
    const closed = closedGate(settings, row);
    const inherited = closed?.own ? inheritedValue(closed, settings) : undefined;
    for (const el of els) {
      el.disabled = !!closed;
      el.setAttribute('aria-disabled', String(!!closed));
      if (el.tagName !== 'INPUT' || el.type === 'checkbox' || el.type === 'color') continue;
      if (closed && inherited !== undefined) {
        el.value = String(inherited);
        el.dataset.showingInherited = '1';
      } else if (!closed && el.dataset.showingInherited) {
        delete el.dataset.showingInherited;
        el.value = String(settings[row.key] ?? row.def);
      }
    }
    const wrapper = els[0].closest('.set-row');
    if (!wrapper) continue;
    wrapper.classList.toggle('set-row-gated', !!closed);
    let hint = wrapper.querySelector('.set-gate-note');
    if (closed) {
      if (!hint) {
        hint = (wrapper.ownerDocument || document).createElement('span');
        hint.className = 'ls-hint set-note set-gate-note';
        (wrapper.querySelector('.as-labelstack') || wrapper).append(hint);
      }
      hint.textContent = gateSentence(closed, settings);
      hint.hidden = false;
    } else if (hint) hint.hidden = true;
  }
}

function refreshConditionNotes(container, settings) {
  container.querySelectorAll('[data-setting-condition]').forEach((node) => {
    const row = ROWS.find((candidate) => candidate.key === node.dataset.settingCondition);
    if (row) node.textContent = rowNote(settings, row);
  });
}

// Save data keeps legacy negative keys such as `muteAudio`; controls should
// still describe the positive effect players are choosing. Invert only here.
function controlOn(settings, row) {
  const storedOn = valueOf(settings, row);
  return row.positiveWhen === false ? !storedOn : storedOn;
}

/**
 * settingOn(settings, key) → is this boolean setting ON, given a sparse store?
 *
 * Exported because a default lives in exactly one place — the `def` field on the
 * row above — and everything else asks. Stored settings are sparse (an untouched
 * key is simply absent), so "is it on" is not `!!settings[key]`: it depends on
 * the default, and the polarity inverts with it. `def: false` must be read as
 * `=== true`; `def: true` must be read as `!== false`. Writing that test out by
 * hand at the point of use means the default is recorded twice, once here and
 * once as a comparison operator somewhere else — and the two are only ever
 * checked by a human noticing that the toggle in Settings disagrees with the
 * screen. That is the second copy this project keeps finding. This function is
 * the one home.
 *
 * NOT YET the one home for every toggle: applyDisplaySettings in src/main.js
 * still hand-writes the polarity for useSprites, reducedMotion, screenShake,
 * controlHints, colorblindSafe, reduceFlashes, readableHeadings, mapHeaderRelics
 * and mapHeaderSeed. Those are all still `def:`-agreeing today, and converting
 * them is a mechanical change I deliberately did not make in the same commit as
 * a default flip: one wrong polarity there silently changes a different default,
 * and nothing in the suite would catch it. Convert them when someone next has a
 * reason to touch that function, one at a time.
 */
export function settingOn(settings, key) {
  const row = ROWS.find((r) => r.key === key);
  if (!row) throw new Error(`settingOn: no settings row named '${key}'`);
  return valueOf(settings || {}, row);
}

/**
 * compactRowLabel(label, topic) → the label with the leading subjects the tab
 * already names taken off.
 *
 * The row owns its full label; a tab is a heading, and a heading repeated in
 * every line beneath it is noise. "Reaver — Strength" under the Reaver tab is
 * "Strength"; "Levels · Enemy Scaling · HP — Per level" under Enemy scaling is
 * "HP — Per level". Nothing is invented and nothing is recased: this only ever
 * removes whole leading subjects, and only when they ARE the tab.
 *
 * A TAB NAME CAN SPAN SEVERAL SUBJECTS, and comparing one at a time missed
 * every such tab. `Equipment drops` is one heading over rows that read
 * "Equipment · Drops — Enabled": no single subject folds to "equipmentdrops",
 * so all nine rows said the tab's name back to it. Rules → Skill xp and
 * Rules → Skill class did the same. So a RUN of adjacent subjects is matched,
 * longest reach first, which subsumes the single-subject case.
 *
 * A tab that renames what it covers still matches nothing, by design: Rewards
 * → `Shop · Card prices` heads rows built from `shop.cardCost.*`, and "Card
 * prices" is not "Card Cost". Those keep their full label rather than have
 * this function guess.
 *
 * It never returns an empty label. A row whose every subject matches its tab
 * keeps its leaf, and a leaf that is itself blank keeps the whole label,
 * because a blank row is worse than a redundant one.
 */
export function compactRowLabel(label, topic) {
  const text = String(label || '');
  // The LAST em dash separates the leaf, so a leaf containing one of its own
  // ("Enter: Bulwark — impact override" under a two-part subject) still splits
  // where a reader would split it.
  const cut = text.lastIndexOf(' — ');
  if (cut < 0) return text;
  const leaf = text.slice(cut + 3);
  const subjects = text.slice(0, cut).split(/ · | — /);
  const fold = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const want = fold(topic);
  if (!want) return text;
  let matched = -1;
  for (let end = subjects.length - 1; end >= 0 && matched < 0; end -= 1) {
    for (let start = 0; start <= end; start += 1) {
      if (fold(subjects.slice(start, end + 1).join(' ')) === want) { matched = end; break; }
    }
  }
  if (matched < 0) return text;
  const kept = subjects.slice(matched + 1);
  if (kept.length) return `${kept.join(' · ')} — ${leaf}`;
  return leaf.trim() || text;
}

// ---- ONE GRAMMAR FOR EVERY VALUE (2026-09-24 revamp) -------------------------
//
// Owner: "easier to edit values with sliders direct input and buttons to
// increase and decrease. make it so that options are consistent for all
// buttons and have the standard expected options."
//
// Every number is now − · slider · field · + , and every row that holds a
// value carries the same two affordances: a dot when it differs from its
// default, and a Reset that puts that one row back. Nothing else about a row
// changed — the same keys, the same commit path, the same refusals.

/**
 * wireStepper(wrap, { read, commit, min, max, step, stepFor }) — the − and + buttons and
 * the slider of one stepper. A press steps once; holding repeats and speeds up.
 * The slider shows its value in the field while dragging and saves at most
 * every 120 ms, then once more when released, so a drag is not a save per pixel.
 */
function wireStepper(wrap, { read, commit, min, max, step, stepFor = null }) {
  const slider = wrap.querySelector('input[type="range"]');
  const field = wrap.querySelector('input[type="number"]');
  // Only floating-point noise is removed (0.1 + 0.2 → 0.3). A value off the
  // step grid (0.01 on a 0.05 step) steps from where it is, not to the grid.
  const round = (v) => Number(v.toFixed(10));
  const buttons = [...wrap.querySelectorAll('.set-step')];
  // A compact slider (sliderSpan) widens to hold any value committed outside
  // it — typed, stepped or loaded — so thumb and field never disagree.
  const fit = (v) => {
    if (!slider || !Number.isFinite(v)) return;
    if (v > Number(slider.max)) slider.max = String(Math.min(max, niceCeil(v * 1.5)));
    if (v < Number(slider.min)) slider.min = String(Math.max(min, -niceCeil(Math.abs(v) * 1.5)));
    slider.value = String(v);
  };
  const sync = () => {
    const v = read();
    fit(v);
    for (const b of buttons) b.disabled = Number(b.dataset.step) < 0 ? v <= min : v >= max;
  };
  // A gate or a hand rule disables the FIELD (it carries the key); the
  // buttons and slider follow it rather than keeping a second lock.
  const locked = () => !!field?.disabled;
  const stepOnce = (b, times = 1) => {
    if (locked()) return;
    // Step from what the field shows: a number typed but not yet committed
    // (a press does not blur the field) is the one the player means.
    const typed = field && field.value.trim() !== '' ? Number(field.value) : NaN;
    const base = Number.isFinite(typed) ? typed : read();
    // A row whose button step scales with its value (buttonStep) asks again
    // for the value it steps from, not the one it was drawn with.
    const by = (stepFor ? stepFor(base) : Number(b.dataset.stepBy)) || step;
    const next = Math.min(max, Math.max(min, round(base + Number(b.dataset.step) * by * times)));
    commit(next);
    sync();
  };
  for (const b of buttons) {
    let timer = null;
    let count = 0;
    const stop = () => { clearTimeout(timer); timer = null; count = 0; };
    b.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || b.disabled) return;
      event.preventDefault();
      stepOnce(b);
      const repeat = () => {
        count += 1;
        stepOnce(b, count > 15 ? 5 : 1);
        if (!b.disabled) timer = setTimeout(repeat, count > 5 ? 50 : 90);
      };
      timer = setTimeout(repeat, 380);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) b.addEventListener(type, stop);
    // Keyboard and switch access arrive as a click with no pointer (detail 0).
    b.addEventListener('click', (event) => { if (event.detail === 0) stepOnce(b); });
  }
  if (slider) {
    let pending = null;
    slider.addEventListener('input', () => {
      if (locked()) { slider.value = field.value; return; }
      if (field) field.value = slider.value;
      if (pending) return;
      pending = setTimeout(() => { pending = null; commit(slider.value); sync(); }, 120);
    });
    slider.addEventListener('change', () => { clearTimeout(pending); pending = null; if (!locked()) { commit(slider.value); sync(); } });
  }
  field?.addEventListener('change', sync);
}

/** markModified(container, settings, changes) — the dot and Reset follow each save. */
function markModified(container, settings, changes) {
  for (const [key, value] of Object.entries(changes || {})) {
    const row = rowByKey(key);
    if (!row) continue;
    const probe = { ...settings, [key]: value === undefined ? undefined : value ?? settings[key] };
    const on = rowModified(probe, row);
    container.querySelectorAll(`[data-row-key="${CSS.escape(key)}"]`).forEach((el) => {
      if (on) el.dataset.modified = 'true'; else delete el.dataset.modified;
      const reset = el.querySelector('.set-row-reset');
      if (reset) reset.hidden = !on;
    });
  }
}

/**
 * rowDefault(row) → the value Reset restores: the owner's promoted default
 * (src/content/settingsDefaults.js) when there is one, else the row's own.
 */
export function rowDefault(row, promoted = PROMOTED_DEFAULTS) {
  if (row && Object.hasOwn(promoted, row.key)) return promoted[row.key];
  return row?.def;
}

// ---- UNDO for anything that changes many values at once ---------------------
// A row Reset, a group or results reset, Reset all, clearing hidden tuning and
// a profile load each leave one "… · Undo" bar for UNDO_MS. The snapshot is the
// value every touched key held before (undefined = was not stored).
const UNDO_MS = 8000;
let undoOffer = null;
/** offerUndo(label, snapshot) — the next paint shows "label · Undo". */
export function offerUndo(label, snapshot) {
  if (!snapshot || !Object.keys(snapshot).length) return;
  undoOffer = { label, snapshot, until: Date.now() + UNDO_MS };
}

/**
 * resetKeys(settings, onChange, keys, label) → the snapshot taken. Each key goes
 * back to its promoted default when there is one, else is cleared so the row's
 * own default applies; an Undo is offered.
 */
export function resetKeys(settings, onChange, keys, label = 'Reset', { promoted = buildPromotion() } = {}) {
  const snapshot = {};
  const changed = {};
  const seedBefore = settings[SEED_KEY];
  for (const key of keys) {
    snapshot[key] = settings[key];
    if (Object.hasOwn(promoted, key)) { settings[key] = promoted[key]; changed[key] = promoted[key]; }
    else { delete settings[key]; changed[key] = undefined; }
  }
  const moved = Object.keys(snapshot).filter((key) => snapshot[key] !== changed[key]);
  // A key reset to its promoted value is the promotion's again: say so in the
  // seed record, so a later promotion may move it along.
  const back = keys.filter((key) => Object.hasOwn(promoted, key));
  if (back.length) {
    const record = settings[SEED_KEY] && typeof settings[SEED_KEY] === 'object' ? settings[SEED_KEY] : {};
    const next = { ...record };
    for (const key of back) next[key] = promoted[key];
    for (const key of keys) if (!Object.hasOwn(promoted, key)) delete next[key];
    settings[SEED_KEY] = next;
    changed[SEED_KEY] = next;
  }
  const result = onChange(changed);
  if (result?.ok === false) {
    // Not saved, so not reset: put every value (and the seed record) back —
    // here and, through the same onChange, in the game and its live state.
    const back = {};
    for (const [key, value] of Object.entries(snapshot)) {
      back[key] = value;
      if (value === undefined) delete settings[key]; else settings[key] = value;
    }
    if (Object.hasOwn(changed, SEED_KEY)) {
      back[SEED_KEY] = seedBefore;
      if (seedBefore === undefined) delete settings[SEED_KEY]; else settings[SEED_KEY] = seedBefore;
    }
    onChange(back);
    return snapshot;
  }
  const undo = Object.fromEntries(moved.map((key) => [key, snapshot[key]]));
  // Undo puts back which values the promotion owned, as well as the values.
  if (moved.length && Object.hasOwn(changed, SEED_KEY)) undo[SEED_KEY] = seedBefore;
  offerUndo(label, undo);
  return snapshot;
}

const VALUE_ROW_TYPES = new Set(['number', 'range', 'choice', 'color', 'colorSwatch', 'text', 'textarea', undefined, 'toggle']);

/** rowModified(settings, row) → true when the stored value differs from the default. */
export function rowModified(settings, row, promoted = PROMOTED_DEFAULTS) {
  if (!row || !VALUE_ROW_TYPES.has(row.type)) return false;
  const stored = settings?.[row.key];
  if (stored === undefined) return false;
  // A resolved row (Music, the "uses its own" switches) is changed when
  // setting its key back to its default (the promoted one if there is one,
  // else cleared) would change what it resolves to.
  if (row.resolve) {
    const base = Object.hasOwn(promoted, row.key) ? promoted[row.key] : undefined;
    return row.resolve(settings) !== row.resolve({ ...settings, [row.key]: base });
  }
  const def = rowDefault(row, promoted);
  if (row.type === 'number' && typeof stored === 'number' && typeof def === 'number') return Math.abs(stored - def) > 1e-9;
  return stored !== def;
}

function resetButtonHtml(settings, r) {
  if (!VALUE_ROW_TYPES.has(r.type) || r.type === 'action') return '';
  const on = rowModified(settings, r);
  return `<button type="button" class="as-btn set-row-reset${r.type === 'number' ? ' set-num-reset' : ''}" data-reset-key="${esc(r.key)}"`
    + ` aria-label="Reset ${esc(stripTags(r.label))} to default" title="Reset to default"${on ? '' : ' hidden'}>Reset</button>`;
}

function stripTags(text) { return String(text ?? '').replace(/<[^>]*>/g, ''); }

/**
 * sliderSpan(row, value) → [min, max] for the slider. A row whose declared
 * range is huge (most tuning rows allow 0–999) gets a slider around its value
 * and default instead, so a drag moves in useful steps; the field and the
 * buttons still reach the whole declared range.
 */
export function sliderSpan(row, value) {
  const min = Number.isFinite(row.min) ? row.min : 0;
  const max = Number.isFinite(row.max) ? row.max : 100;
  const step = row.step ?? 1;
  // An authored design range wins: `sliderRange: [lo, hi]` on the row.
  if (Array.isArray(row.sliderRange) && row.sliderRange.length === 2) {
    const lo = Math.max(min, Math.min(Number(row.sliderRange[0]), Number(value)));
    const hi = Math.min(max, Math.max(Number(row.sliderRange[1]), Number(value)));
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) return [lo, hi];
  }
  if (row.slider || (max - min) / step <= 400) return [min, max];
  const anchor = Math.max(Math.abs(Number(value) || 0), Math.abs(Number(row.def) || 0), step * 10);
  const reach = niceCeil(anchor * 3);
  // A signed domain (−999…999) is centred too: both ends come in around the
  // value, each clamped to the declared range.
  const low = Math.max(min, -reach);
  return [low, Math.max(low + step, Math.min(max, reach))];
}

/** niceCeil(x) → the smallest 1, 2 or 5 × 10ⁿ at or above x. */
export function niceCeil(x) {
  if (!(x > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(x));
  const lead = x / power;
  return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * power;
}

/** buttonStep(row, value) → how far − / + move one press. */
export function buttonStep(row, value = row.def) {
  const step = row.step ?? 1;
  if (row.buttonStep) return row.buttonStep;
  if (step >= 1 || row.integer) return Math.max(1, step);
  const size = Math.abs(Number(value) || Number(row.def) || 0);
  const coarse = size >= 20 ? 1 : size >= 2 ? 0.1 : 0.05;
  return Math.max(step, coarse);
}

function stepperHtml({ key, label, value, min, max, step, span, fieldClass, sliderClass, unit = '', inputMode = 'numeric', keyOnSlider = false, bStep, sliderStep = step }) {
  const name = esc(stripTags(label));
  const sliderValue = Math.min(Math.max(Number(value), span[0]), span[1]);
  return `<span class="set-stepper" data-stepper>`
    + `<button type="button" class="as-btn set-step" data-step="-1" data-step-by="${bStep}" aria-label="Decrease ${name}"${value <= min ? ' disabled' : ''}>−</button>`
    + `<input type="range" class="${sliderClass}"${keyOnSlider ? ` data-key="${esc(key)}"` : ''} min="${span[0]}" max="${span[1]}" step="${sliderStep}" value="${sliderValue}" aria-label="${name} slider">`
    + `<input type="number" class="${fieldClass}" data-key="${esc(key)}" value="${value}" min="${min}" max="${max}" step="${step}" inputmode="${inputMode}" aria-label="${name}">`
    + (unit ? `<span class="set-unit" aria-hidden="true">${esc(unit)}</span>` : '')
    + `<button type="button" class="as-btn set-step" data-step="1" data-step-by="${bStep}" aria-label="Increase ${name}"${value >= max ? ' disabled' : ''}>+</button>`
    + `</span>`;
}

export function settingsRowHtml(settings, r, doc = globalThis.document) {
  // W1a: help only where the effect is not obvious. Condition and status lines
  // are feedback, and settingsRowShowsHelp always keeps them.
  const note = settingsRowShowsHelp(r) ? rowNote(settings, r) : '';
  const condition = typeof r.note === 'function'
    ? ` data-setting-condition="${r.key}" aria-live="polite"`
    : '';
  const status = r.type === 'action'
    ? ` id="set-${r.key}-status" data-fullscreen-status aria-live="polite"`
    : condition;
  // THE ROW IS THE KIT'S Row·setting: a LabelStack (what the setting does, and
  // one line on how — the note is that line, always visible, never behind a
  // disclosure) and the control in the trail. One grammar for every type.
  const stack = (extra = '') => `<span class="as-labelstack">
        <span class="ls-label"><span class="set-mod-dot" aria-hidden="true"></span>${r.label}${resetButtonHtml(settings, r)}</span>${note ? `
        <span class="ls-hint set-note"${status}>${note}</span>` : ''}${extra}
      </span>`;
  const modified = rowModified(settings, r);
  const rowOpen = (extraClass = '', attrs = '') => `<div class="as-row setting set-row${extraClass ? ` ${extraClass}` : ''}" data-row-key="${esc(r.key)}"${modified ? ' data-modified="true"' : ''}${attrs}>`;
  if (r.type === 'color') {
    const value = /^#[0-9a-f]{6}$/i.test(settings[r.key] || '') ? settings[r.key] : r.def;
    return `${rowOpen()}${stack()}<span class="r-trail"><input type="color" class="set-color" data-key="${r.key}" value="${value}" aria-label="${r.label}"></span></div>`;
  }
  // ---- 'sceneList': THE OPENING AS A LIST, BECAUSE THAT IS WHAT IT IS ------
  //
  // Order was a number typed into a row per scene, which is workable at five
  // scenes and clumsy the moment there are nine: to move one scene you edit two
  // numbers, and nothing shows you the running order you are editing. The list
  // IS the running order — drag it, or use the arrows, and the `order` keys are
  // rewritten to match. Add / Duplicate / Remove work the empty slots the
  // settings file already names, so a scene the owner adds is still a scene the
  // importer can refuse a bad value for.
  if (r.type === 'sceneList') {
    const config = prologueConfig(settings);
    const playing = prologueSequence(config);
    // THE LIST IS THE STAGING, NOT "PLAYING, THEN THE REST". Listing the parked
    // scenes after the playing ones meant every edit renumbered them to the end
    // — switch a scene off, move anything, switch it back on, and it came back
    // last. A scene that is off keeps its place here and gets it back.
    const staged = prologueStagedOrder(config);
    const live = index => config.scenes[index].enabled !== false;
    const anyLive = staged.some(live);
    const free = prologueFreeSlot(config);
    const item = (index, at) => {
      const scene = config.scenes[index];
      const on = live(index);
      // Duplicate reads the scene it is beside, so the row that IS the next
      // free slot cannot be the source: it would be both sides of the copy.
      const canCopy = free && scene.id !== free;
      return `<li class="set-scene" draggable="true" data-scene="${esc(scene.id)}" data-live="${on ? '1' : '0'}">
        <span class="set-scene-grip" aria-hidden="true">⠿</span>
        <span class="set-scene-name">${esc(scene.name || scene.id)}${isPrologueSlot(scene) ? ' <em>(added)</em>' : ''}</span>
        <span class="set-scene-at">${on ? `${at + 1} / ${playing.length}` : 'not playing'}</span>
        <span class="set-scene-acts">
          <button type="button" class="as-btn" data-scene-move="up" data-scene-id="${esc(scene.id)}" aria-label="Move ${esc(scene.name)} earlier"${staged[0] === index ? ' disabled' : ''}>↑</button>
          <button type="button" class="as-btn" data-scene-move="down" data-scene-id="${esc(scene.id)}" aria-label="Move ${esc(scene.name)} later"${staged.at(-1) === index ? ' disabled' : ''}>↓</button>
          <button type="button" class="as-btn" data-scene-toggle="${esc(scene.id)}" aria-pressed="${on}">${on ? 'On' : 'Off'}</button>
          <button type="button" class="as-btn set-scene-edit" data-scene-edit="${esc(scene.id)}" aria-label="Edit ${esc(scene.name)} with live preview">Edit & preview</button>
          ${scene.character && scene.actor ? `<button type="button" class="as-btn set-scene-edit" data-scene-place="${esc(scene.id)}" aria-label="Place traveller in ${esc(scene.name)}">Place traveller</button>` : ''}
          <button type="button" class="as-btn" data-scene-copy="${esc(scene.id)}"${canCopy ? '' : ' disabled'}>Duplicate</button>
          ${isPrologueSlot(scene) ? `<button type="button" class="as-btn" data-scene-remove="${esc(scene.id)}">Remove</button>` : ''}
        </span>
      </li>`;
    };
    let at = -1;
    const list = staged.map(index => item(index, live(index) ? ++at : -1)).join('');
    const slotsLeft = config.scenes.filter(scene => isPrologueSlot(scene) && scene.enabled === false && !String(scene.text || '').trim()).length;
    return `${rowOpen('set-row-wide set-row-scenes')}${stack()}
      <div class="r-trail set-scene-trail">
        <ol class="set-scene-list" data-scene-list>${list}</ol>
        <div class="set-scene-tools">
          <button type="button" class="as-btn" data-scene-add${free ? '' : ' disabled'}>Add a scene</button>
          <button type="button" class="as-btn set-scene-edit" data-scene-edit="${esc(config.scenes[staged[0]]?.id || 'warmth')}">Open live scene editor</button>
          <span class="as-status">${slotsLeft} empty slot${slotsLeft === 1 ? '' : 's'} left</span>
          ${anyLive ? '' : '<span class="as-status set-scene-warn">Nothing is switched on — the opening falls back to the five scenes it shipped with.</span>'}
        </div>
      </div></div>`;
  }
  // ---- 'presetSlot': a whole opening, parked under a name ------------------
  if (r.type === 'presetSlot') {
    const parkedName = typeof settings[r.nameKey] === 'string' && settings[r.nameKey].trim()
      ? settings[r.nameKey] : PROLOGUE_DEFAULTS.presets[r.presetId].name;
    const filled = typeof settings[r.key] === 'string' && settings[r.key].length > 2;
    return `${rowOpen('set-row-wide set-row-preset')}<span class="as-labelstack">
        <span class="ls-label">${esc(parkedName)}</span>
        <span class="ls-hint set-note">${filled ? 'Holds a saved opening.' : 'Empty.'} ${note}</span>
      </span>
      <span class="r-trail set-preset-acts">
        <button type="button" class="as-btn" data-preset-save="${esc(r.presetId)}">Save</button>
        <button type="button" class="as-btn" data-preset-load="${esc(r.presetId)}"${filled ? '' : ' disabled'}>Load</button>
        <button type="button" class="as-btn" data-preset-clear="${esc(r.presetId)}"${filled ? '' : ' disabled'}>Clear</button>
      </span></div>`;
  }
  // ---- 'colorSwatch': BOTH WAYS OF NAMING A COLOUR, ONE OF THEM FOLDED -----
  //
  // The swatches are the palette this game already paints with, so the common
  // answer is one tap. The wheel is every other colour, and it is DISCLOSED
  // rather than always open: a permanently mounted system colour input made a
  // one-line setting two lines tall on a phone, times every colour row the
  // opening now has. Both write the same key, and the swatch row shows which
  // one the stored value matches — including "none of them", which is itself
  // the answer to "did I pick this from the wheel?".
  if (r.type === 'colorSwatch') {
    const value = /^#[0-9a-f]{6}$/i.test(settings[r.key] || '') ? settings[r.key] : r.def;
    const chips = (r.swatches || []).map((color) => {
      const on = String(color).toLowerCase() === String(value).toLowerCase();
      return `<button type="button" class="as-swatch set-swatch${on ? ' on' : ''}" style="--swatch:${esc(color)}" data-key="${esc(r.key)}" data-color="${esc(color)}" aria-pressed="${on}" aria-label="${esc(color)}" title="${esc(color)}"></button>`;
    }).join('');
    return `${rowOpen('set-row-wide set-row-swatches')}${stack()}<span class="r-trail set-swatch-trail">
        <span class="as-swatches" role="group" aria-label="${esc(r.label)}">${chips}</span>
        <button type="button" class="as-btn set-wheel-toggle" data-wheel-toggle="${esc(r.key)}" aria-controls="set-wheel-${esc(r.key)}" aria-expanded="false">Colour wheel</button>
        <input type="color" id="set-wheel-${esc(r.key)}" class="set-color set-wheel" data-key="${esc(r.key)}" value="${value}" aria-label="${esc(r.label)} — colour wheel" hidden>
      </span></div>`;
  }
  if (r.type === 'textarea') {
    const val = typeof settings[r.key] === 'string' ? settings[r.key] : r.def;
    return `${rowOpen('set-row-wide set-row-prologue')}${stack()}<span class="r-trail"><textarea class="set-prologue-text" data-key="${esc(r.key)}" maxlength="${r.maxLength}" aria-label="${esc(r.label)}">${esc(val)}</textarea></span></div>`;
  }
  if (r.type === 'text') {
    const val = typeof settings[r.key] === 'string' ? settings[r.key] : r.def;
    return `${rowOpen('set-row-wide')}
        ${stack()}
        <span class="r-trail"><input type="text" class="set-text" spellcheck="false" data-key="${r.key}" value="${(val || '').replace(/"/g, '&quot;')}" placeholder="${r.placeholder || ''}"></span>
      </div>`;
  }
  // ---- 'number': A FIELD HE TYPES INTO (Constantine, 2026-08-17). min/max
  // are the ROW's, so the domain lives in content and this markup states no
  // number of its own. The synced slider (Part B) is still held behind #181.
  if (r.type === 'number') {
    const val = resolveNumberRow(settings, r);
    const step = r.step ?? 1;
    const inputMode = r.integer === false ? 'decimal' : 'numeric';
    return `${rowOpen('set-row-wide set-row-number')}
        ${stack(appliedSlot(settings, r))}
        <span class="r-trail num-wrap">
          ${stepperHtml({ key: r.key, label: r.label, value: val, min: r.min, max: r.max, step, span: sliderSpan(r, val), fieldClass: 'set-num', sliderClass: 'set-num-slider', inputMode, bStep: buttonStep(r, val), unit: r.unit || '',
            // A fractional row's authored values need not sit on its step grid
            // (0.01 on a 0.05 step); `any` lets the thumb stand where the value is.
            sliderStep: r.integer === false || !Number.isInteger(step) ? 'any' : step })}
        </span>
        ${r.practice ? '<div class="flick-practice" data-flick-practice role="group" aria-label="Card flick practice"><span>Practice here — flick upward</span><output aria-live="polite">No cards or resources are spent.</output></div>' : ''}
      </div>`;
  }
  if (r.type === 'range') {
    const val = typeof settings[r.key] === 'number' ? settings[r.key] : r.def;
    return `${rowOpen('set-row-wide set-row-number')}
        ${stack()}
        <span class="r-trail range-wrap">
          ${stepperHtml({ key: r.key, label: r.label, value: val, min: 0, max: 100, step: 1, span: [0, 100], fieldClass: 'set-range-num', sliderClass: 'set-range', keyOnSlider: true, unit: '%', bStep: 5 })}
        </span>
      </div>`;
  }
  if (r.type === 'button') {
    return `${rowOpen()}
        ${stack()}
        <span class="r-trail"><button type="button" class="as-btn" data-btn="${r.key}">${r.btn || 'Open'}</button></span>
      </div>`;
  }
  if (r.type === 'choice') {
    const stored = r.legacyChoices?.[settings[r.key]] ?? settings[r.key];
    const cur = r.choices.includes(stored) ? stored : r.def;
    if (r.dropdown || r.choices.length > 3) {
      const options = r.choices.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(r.choiceLabels?.[c] || c)}</option>`).join('');
      return `${rowOpen('set-row-dropdown')}${stack(appliedSlot(settings, r))}<span class="r-trail"><select class="set-choice-select" data-key="${r.key}" aria-label="${esc(r.label)}">${options}</select></span></div>`;
    }
    const opts = r.choices
      .map((c) => `<button type="button" class="choice${c === cur ? ' on' : ''}" aria-pressed="${c === cur}" data-key="${r.key}" data-val="${c}">${r.choiceLabels?.[c] || c}</button>`)
      .join('');
    return `${rowOpen(r.slider ? 'set-row-wide' : '')}
        ${stack(appliedSlot(settings, r))}
        <span class="r-trail"><span class="as-seg choice-group"${r.resizesWhilePressed ? ' data-resizes-while-pressed="1"' : ''}>${opts}</span></span>
      </div>`;
  }
  if (r.type === 'action' && !fullscreenCapability(doc).supported) {
    return `${rowOpen('set-row-unavailable', ` data-action-row="${r.key}"`)}
      <span class="as-labelstack">
        <span class="ls-label">${r.label}</span>
        <span class="ls-hint set-note">${note}</span>
        <span class="ls-hint set-note" id="set-${r.key}-status" data-fullscreen-status aria-live="polite">On iPhone, use Safari’s Share menu → Add to Home Screen, then launch the saved game icon.</span>
      </span>
      <span class="r-trail"><button type="button" class="as-toggle toggle" data-key="${r.key}" data-action="1" aria-label="${esc(r.label)}" aria-describedby="set-${r.key}-status" role="switch" aria-checked="false" disabled aria-disabled="true"><span class="knob"></span></button></span>
    </div>`;
  }
  const on = r.type === 'action' ? isFullscreen(doc) : controlOn(settings, r);
  return `${rowOpen()}
      ${stack()}
      <span class="r-trail"><button type="button" class="as-toggle toggle ${on ? 'on' : ''}" data-key="${r.key}"${r.type === 'action' ? ` data-action="1" aria-label="${esc(r.label)}" aria-describedby="set-${r.key}-status"` : ''} role="switch" aria-checked="${on}"><span class="knob"></span></button></span>
    </div>`;
}

// ---- the line under a row that says what the choice actually means ---------
//
// `applied:` USED TO BE `true` AND MEANT ONE FUNCTION. One row had it, and
// `rowHtml` called `appliedHtml` by name — a flag whose only legal value stood
// for a function the flag could not name. The second row that wants a line
// under it (Minimum tap size) would have made that an `if` per key, which is
// exactly the shape Law 1 clause 3 forbids one layer down: `if (key === …)`
// deciding behaviour that the row could have declared.
//
// So the field HOLDS THE FUNCTION. That is Law 0 clause 2 said honestly — a
// row that wants a derived line under it is data, and the derivation is a word,
// authored in code, joined here by the row that asks for it. It is the same
// declaration/handler join `src/ui/surfaces.js` makes for navigable sets, at
// one row's scale.
//
// THE SLOT IS ALWAYS RENDERED, even when the line is empty. A function may
// legitimately say nothing (Minimum tap size is SILENT at 44 — Sunna: "a state
// that needs no words needs silence"), and a slot that only exists while it has
// something to say is a slot `refreshApplied` cannot find the moment it starts
// having something to say. Empty div, no padding, no margin: zero height, no
// stylesheet change.
function appliedSlot(settings, r) {
  if (!r.applied) return '';
  return `<div class="set-applied-slot" data-applied="${r.key}">${r.applied(settings, r) || ''}</div>`;
}

/**
 * resolveGraceRefill(settings) → { counts, bad: [{ key, kind, stored, used }] }
 *
 * THE ONE HOME FOR "how many flasks does a grace give", asked by the shrine
 * (main.js showRest), by the co-op session, and by the row below that prints
 * it. The authored numbers are `balance.graceRefill`; this only ever layers a
 * stored override on top, and the override has to be a position on the row's
 * own ladder.
 *
 * `bad` IS THE POINT, exactly as it is for resolveTapSize: a sparse store is
 * normal and absence means "use the authored count" with nothing to report. A
 * key that is PRESENT and not on the ladder is bad data — a hand-edited save, a
 * restored profile from a tree with a smaller carry cap — and it still has to
 * resolve to something, so it resolves to the authored count and SAYS SO. A
 * refill that quietly ignores the number on the screen is the failure this
 * whole feature is supposed to be the opposite of.
 */
export function resolveGraceRefill(settings) {
  const s = settings || {};
  const counts = {};
  const bad = [];
  for (const r of ROWS) {
    if (!r.graceRefillKind) continue;
    const def = Number(r.def);
    const stored = s[r.key];
    if (stored === undefined || stored === null || stored === '') {
      counts[r.graceRefillKind] = def;
      continue;
    }
    const v = String(stored);
    if (r.choices.includes(v)) {
      counts[r.graceRefillKind] = Number(v);
    } else {
      counts[r.graceRefillKind] = def;
      bad.push({ key: r.key, kind: r.graceRefillKind, stored: v, used: def });
    }
  }
  return { counts, bad };
}

// THE LINE UNDER A GRACE-REFILL ROW. It exists to make two states impossible to
// miss and one impossible to fake:
//
//   NOT BINDING — the kind has no flask entry, so whatever number is showing,
//   this restores nothing. Freja's pattern, and the reason it is not silence:
//   a chip strip reading 3 over a refill that gives 0 is a knob whose value is
//   ignored, which Law 0 clause 5 calls the dangerous failure.
//
//   the rejected stored value — same sentence resolveTapSize's row prints.
//
//   0 says "off" in words, because a lone 0 chip is ambiguous between "off"
//   and "not set".
//
// It names the flask a kind resolves to, at the value chosen, so the derivation
// is visible on the screen the choice is made on rather than inferable from
// content/flasks.js.
function graceRefillAppliedHtml(settings, r) {
  const { counts, bad } = resolveGraceRefill(settings);
  const kind = r.graceRefillKind;
  const n = counts[kind];
  const rejected = bad.find((b) => b.kind === kind);
  const lead = rejected
    ? `<b>${esc(rejected.stored)}</b> is not one of these — using ${rejected.used}. `
    : '';
  // Asked of the content array rather than the registry: this module is UI and
  // is never handed registries. The RULE is `firstFlaskOfKind`, one home,
  // shared with the plan and with boot validation.
  const entry = firstFlaskOfKind(flasks, kind);
  if (!entry) {
    return `${lead}<b>NOT BINDING</b> — nothing declares kind “${esc(kind)}”, so a grace restores none. `
      + `Declared so it works the day something does.`;
  }
  if (n === 0) return `${lead}Off — a grace tops up no ${esc(kindLabel(kind))} flasks.`;
  return `${lead}A grace tops you up to ${n} × ${esc(entry.name)}.`;
}

/**
 * resolveTapSize(settings) → { px, stored, bad }
 *
 * THE ONE HOME FOR "what tap floor is in force", asked by the settings row and
 * by applyTapSize() in src/main.js. The closed set and the default are read off
 * the row, which reads them off `balance.ui.tapSize` — so the four numbers are
 * written once, in content, and nothing here restates them.
 *
 * `bad` IS THE POINT, and it is Law 1 clause 5. A sparse store is normal — an
 * untouched key is simply absent, and absent resolves to the default with
 * nothing to report. A key that is PRESENT and not in the closed set is bad
 * data: a hand-edited save, an older build's value, a restored profile from a
 * tree where the set was different. It still has to render something, so it
 * renders the default — but it must not do that SILENTLY, which is the failure
 * that gets called "the setting doesn't stick". `bad` is what lets both callers
 * say so: main.js writes it into the command log by name, and the row prints
 * the rejected value where the choice is made.
 */
/**
 * resolveLevelUpValue(settings) → how many stat points one level grants.
 *
 * HIS LEVEL DIAL, resolved the way every other row in this file is: a stored
 * value the row does not offer, or no value at all, is the SHIPPING DEFAULT —
 * the same rule `savedZoom`, `resolveMapMode` and `resolveTapSize` use, and for
 * the same reason. A hand-edited profile or an older build's value must behave
 * exactly like an absent one, because the alternative is a run created under a
 * number nothing in the game admits to.
 *
 * IT RETURNS THE ROW'S OWN `def` WHEN UNSET, and the row derives that `def`
 * from content, so this function contains no number. (Its sibling, the "Stat
 * points per tier" dial, was retired with ruleset 6: every stat now states its
 * own decimal weight per attribute.)
 */
/**
 * resolveNumberRow(settings, row) → the integer this 'number' row resolves to.
 *
 * THE ONE GATE. Every road into a `number` setting runs through here: the markup
 * that renders it, the handler that commits it, the resolver the game reads it
 * with, and a hand-edited profile arriving from disk. So the model can only ever
 * receive an integer inside the row's own domain, whatever is stored — which is
 * the property `tests/engine.test.js` 60d asserts over a table of rubbish.
 *
 * A TYPED FIELD IS A DOOR A LADDER NEVER OPENED, and every one of these answers
 * had no reason to exist an hour ago:
 *
 *   ''  ·  null  ·  undefined      the DEFAULT. An empty field is not a zero.
 *   'lots'  ·  NaN  ·  Infinity    the DEFAULT. Unreadable is unset — the same
 *                                  rule `savedZoom` and `resolveMapMode` use.
 *   0  ·  -3                       CLAMPED UP to `min`. A level that grants
 *                                  nothing is a purchase that does nothing, and
 *                                  a negative one would take points away.
 *   1e9                            CLAMPED DOWN to `max`.
 *   2.7                            FLOORED. `validateRunShape` requires integer
 *                                  attributes, so a fractional grant would break
 *                                  the run's shape three files downstream. It
 *                                  never gets to leave this function.
 *   '  7  '                        7. Trimmed, because a field lets him type it.
 *
 * FLOOR, NOT ROUND, and it is the tree's own rule rather than my preference:
 * `derivedStatRules.defaults.rounding` is 'floor' and Constantine settled it in
 * his own words on the HP formula — "CON 14 gives +2, not +3".
 */
export function resolveNumberRow(settings, row) {
  if (!row) throw new Error('resolveNumberRow: no row');
  if (settings?.[row.key] === undefined && row.key.startsWith('gameConfig.attributeRules.presets.')) {
    const path = row.key.slice('gameConfig.'.length).split('.');
    return path.reduce((value, key) => value[key], configuredContentBundle(contentBundle, settings));
  }
  const raw = (settings || {})[row.key];
  // The rule itself lives in CardSizeModel so the card-size model and this row
  // cannot disagree about what a stored number means — they did, by a floor
  // against a round.
  if (row.integer !== false) return normalizeTunedNumber(raw, { min: row.min, max: row.max, def: Number(row.def) });
  const numeric = raw === '' || raw === null || raw === undefined ? Number(row.def) : Number(raw);
  if (!Number.isFinite(numeric)) return Number(row.def);
  const clamped = Math.min(row.max, Math.max(row.min, numeric));
  const step = Number(row.step) || 0.01;
  const precision = Math.max(0, String(step).split('.')[1]?.length || 0);
  return Number(clamped.toFixed(precision));
}

/**
 * typedNumberRefusal(row, raw) → the sentence for a number HE TYPED that the
 * row's domain will not take, or null.
 *
 * THE CLAMP IS NOT A REFUSAL HE CAN SEE. `resolveNumberRow` is the one gate and
 * it clamps: type 8 into a row whose floor is 12 and 12 is what gets stored,
 * displayed, and handed to `advancedConfigProblemRows` — which then finds a
 * perfectly legal number and says nothing. The refusal naming the Starseer's
 * kit was reachable only by injecting a bad value past the field.
 *
 * AND IT CANNOT BORROW THE EXISTING SENTENCE. `startingStatPoolProblems` ends
 * "The value in use is 35" — true when the bad value was STORED and the
 * authored default stood, and a lie here, where the clamp means 12 is in use.
 * So this says what the clamp actually did: what was typed, the bound, why the
 * bound is there (the row's own `boundsNote`, which names the class and kit),
 * and the number the game is now using.
 *
 * Null the moment the typed value is legal — the message must LEAVE, which is
 * the same rule `numberAppliedHtml` and `paintConfigProblems` live by.
 */
export function typedNumberRefusal(row, raw) {
  if (!row || row.type !== 'number') return null;
  const text = String(raw ?? '').trim();
  if (text === '') return null;                        // an empty field is not a zero
  const typed = Number(text);
  if (!Number.isFinite(typed)) return null;            // unreadable is unset, as everywhere else
  const wanted = row.integer !== false ? Math.floor(typed) : typed;
  if (wanted >= row.min && wanted <= row.max) return null;
  const used = resolveNumberRow({ [row.key]: raw }, row);
  return `${row.label}: ${JSON.stringify(typed)} is outside ${row.min}\u2013${row.max} and was refused.`
    + `${row.boundsNote ? ` ${row.boundsNote}` : ''}`
    + ` The value in use is ${used}; every other setting you changed is still applied.`;
}

/**
 * commitNumberRow(settings, row, raw) → { value, refusal }
 *
 * WHAT A TYPED NUMBER BECOMES, as one answer. The handler below wires it to the
 * field and the slider; this holds the decision, so the node suite can drive the
 * SAME code the screen runs instead of a second copy of its rules.
 */
export function commitNumberRow(settings, row, raw) {
  return { value: resolveNumberRow({ [row.key]: raw }, row), refusal: typedNumberRefusal(row, raw) };
}

/**
 * settingsRow(key) → the declared row, for anything that needs its DOMAIN rather
 * than its value. Exported so a test asserts against the row the screen actually
 * renders instead of a second copy of its bounds.
 */
export function settingsRow(key) {
  const row = ROWS.find((r) => r.key === key);
  if (!row) throw new Error(`settingsRow: no settings row named '${key}'`);
  return row;
}

export function resolveLevelUpValue(settings) {
  return resolveNumberRow(settings, ROWS.find((r) => r.key === 'levelUpValue'));
}

/**
 * The `applied` line for ANY `number` row — SILENT WHEN THE PROMISE IS KEPT,
 * which is Sunna's rule and is why this is not just a readout: "a line that says
 * the same thing every time you open the screen is not a warning, it is
 * decoration with a worried face."
 *
 * It speaks only when what he typed is NOT what the game will use, which is the
 * one case a typed field creates and a ladder never could.
 */
function numberAppliedHtml(settings, row) {
  const stored = (settings || {})[row.key];
  if (stored === undefined || stored === null || stored === '') return '';
  const used = resolveNumberRow(settings, row);
  if (String(stored).trim() === String(used)) return '';
  return `<p class="set-note set-applied">Using <b>${used}</b> — ${row.min}–${row.max}, whole numbers.</p>`;
}



export function resolveTapSize(settings) {
  const row = ROWS.find((r) => r.key === 'tapFloor');
  const def = Number(row.def);
  const stored = (settings || {}).tapFloor;
  if (stored === undefined || stored === null || stored === '') {
    return { px: def, stored: null, bad: false };
  }
  const s = String(stored);
  if (row.choices.includes(s)) return { px: Number(s), stored: s, bad: false };
  return { px: def, stored: s, bad: true };
}

// THE COST LINE. Sunna's ruling, and it is her own rule from the day before
// aimed at her own proposal: "a line that says the same thing every time you
// open the screen is not a warning, it is decoration with a worried face." So
// the NOTE is constant and carries no percentages, and THIS line appears only
// below the largest size, and changes with the value chosen.
//
// THE PERCENTAGES ARE NOT WRITTEN HERE. `balance.ui.tapSize.missRate` carries
// one entry per size that has research behind it — 44 and 24, the two points
// WCAG gives us — and this function prints a number only where an entry exists.
// 36 and 30 get the sentence and no statistic, because interpolating between
// two measured points would be fabricating one, and a fabricated number in a
// player-facing line is the worst place this house could put one.
//
// The leading "NN px —" is the one thing I added to Sunna's wording: the
// dispatch asks the line to NAME THE VALUE CHOSEN, and without it 36 and 30
// render the identical sentence — a line that does not change when the setting
// does, which is the test she set for it. Her sentence is untouched underneath.
function tapCostHtml(settings) {
  const { px, stored, bad } = resolveTapSize(settings);
  const sizes = UI_DEFAULTS.tapSize.sizes;
  const max = Math.max(...sizes);
  // Bad data is loud HERE too, not only in the log: the player who typed 32
  // into a save file is the one person who needs to be told 32 is not a size.
  const badLine = bad
    ? `<p class="set-applied limited">Stored value ${esc(String(stored))} is not one of `
      + `${esc(sizes.join(', '))} — using ${px}.</p>`
    : '';
  if (px >= max) return badLine;
  const rate = UI_DEFAULTS.tapSize.missRate;
  const here = rate[px];
  const there = rate[max];
  const tail = here && there
    ? `: about ${here} misses here, against ${there} at ${max}`
    : '';
  return `${badLine}<p class="set-applied">${px} px — below the size a fingertip`
    + ` reliably hits${tail}.</p>`;
}

// EldenSpire#26 — SHOW THE VALUE ACTUALLY APPLIED.
//
// Clamping the named sizes without this makes the control a liar: pick XL on a
// 1200x730 window and the fit path holds it at 1.00, so the button lights up
// and nothing on screen changes. balance.js records that exact complaint
// landing once before, when Auto "looked dead" — a setting that bricks the
// fight is a trap, one that silently shrinks is a liar, and only the pair is
// neither. The clamp is Constantine's ruling; this half is why it is safe.
//
// IT READS --ui-zoom RATHER THAN RECOMPUTING THE FIT. main.js already resolved
// it and wrote it to <html>; asking the same question a second way is how the
// tablet lockout happened (#24), and a readout that disagrees with the screen
// is worse than no readout. The requested value comes from the same balance
// data main.js caps against, so "limited" is a comparison of one computed
// number against one authored one, not of two computations.
function appliedHtml(settings) {
  if (typeof document === 'undefined') return '';
  const applied = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'));
  if (!applied) return '';
  const key = String(settings.uiScale == null ? 'auto' : settings.uiScale).toLowerCase();
  const asked = UI_DEFAULTS.uiScale.named[key];
  const shown = `${applied.toFixed(2)}\u00d7`;
  // A hundredth of slack: the fit path rounds to two decimals, so an exact
  // grant can miss by 0.004 and must not be reported as a limit.
  const limited = asked != null && applied < asked - 0.005;
  // "your screen", not "this window". Shown on three phone shapes, where a
  // window is not a thing the player has; "your screen" is true on both.
  // Sunna's, and the row's own note carries the same noun for the same reason.
  //
  // THE HINT IS UNCONDITIONAL, and that is the decision rather than an
  // oversight. Its job is to reach one person: the player who sets XL BECAUSE
  // SHE CANNOT READ THE GAME, gets 0.82x and a polite explanation, and is not
  // helped at all — the clamp fixes reachability and does nothing for
  // legibility, and the player who most needs XL is the one on the smallest
  // screen. Every condition I drafted for showing it (limited-only, named-size
  // only, L-and-XL-only) had a screen where she asks for bigger, is refused or
  // under-served, and is told nothing. A five-word pointer to a sibling control
  // cannot be wrong; a condition deciding when she deserves to see it can, and
  // this week has been a week of conditions that were. Wording is Sunna's.
  // `data-applied` lives on the SLOT now (appliedSlot, above), not on this
  // paragraph — one row, one slot, one key, whether or not the line has
  // anything to say this frame. A selector of `[data-applied="uiScale"]` still
  // resolves; it lands on the wrapper instead of the paragraph inside it.
  return `<p class="set-applied${limited ? ' limited' : ''}">`
    + (limited
      ? `Showing ${shown} — the largest that fits your screen (${key.toUpperCase()} is ${asked.toFixed(2)}\u00d7)`
      : `Showing ${shown}`)
    + ` <span class="set-applied-hint">For bigger text, try Text size.</span>`
    + `</p>`;
}

// Re-read after the orchestrator has applied the change, and on resize, because
// Auto's applied value moves with the window while the chosen setting does not.
//
// EVERY SLOT ON THE PANEL, not a named one. It used to replace the uiScale
// paragraph by selector, which meant the second row with a derived line under
// it would need this function to learn its key. It reads the slots the panel
// actually drew and asks each row's own function — so a third row costs nothing
// here, and a line that is EMPTY this frame (Minimum tap size at 44) still has
// a slot to come back into. Refilling rather than replacing is what makes the
// empty case work at all.
function refreshApplied(container, settings) {
  container.querySelectorAll('[data-applied]').forEach((slot) => {
    const row = ROWS.find((r) => r.key === slot.dataset.applied);
    if (!row || !row.applied) return;
    slot.innerHTML = row.applied(settings, row) || '';
  });
}

/**
 * paintConfigProblems(container, settings) → the problem sentences, deduped.
 *
 * A REFUSAL IS ADDRESSED TO A ROW (owner, 2026-09-20 — "the new game assign
 * and standard loadout don't seem to change on a new game despite having the
 * values change in the settings"). The game was refusing his creation pool and
 * saying so in one line at the top of Settings, four screens away from the
 * twenty class cells and the pool row it was about; from where he sat the dial
 * simply did nothing.
 *
 * Same seam as `refreshApplied` above: this reads the rows the panel actually
 * drew and asks the model which keys are in trouble, so a new row costs
 * nothing here. The line is REMOVED when the row is fine — a warning that is
 * always on is decoration with a worried face (Sunna, and `numberAppliedHtml`
 * lives by the same rule).
 */
export function paintConfigProblems(container, settings, extra = []) {
  // `extra` carries the refusals the MODEL cannot see, because the value never
  // reached it: a typed number the field clamped on its way in (see
  // `typedNumberRefusal`). Same shape, same painting, same dedupe.
  const entries = [...advancedConfigProblemRows(contentBundle, settings), ...extra];
  const byKey = new Map();
  for (const entry of entries) {
    for (const key of entry.keys || []) {
      if (!byKey.has(key)) byKey.set(key, []);
      const messages = byKey.get(key);
      if (!messages.includes(entry.message)) messages.push(entry.message);
    }
  }
  const painted = new Set();
  container.querySelectorAll('.set-row [data-key]').forEach((control) => {
    const row = control.closest('.set-row');
    if (!row || painted.has(row)) return;
    painted.add(row);
    const stack = row.querySelector('.as-labelstack') || row;
    const existing = stack.querySelector('[data-row-problem]');
    const messages = byKey.get(control.dataset.key) || [];
    if (!messages.length) {
      existing?.remove();
      delete row.dataset.refused;
      return;
    }
    const slot = existing || stack.appendChild(container.ownerDocument.createElement('p'));
    slot.className = 'set-note set-applied limited';
    slot.dataset.rowProblem = '';
    slot.setAttribute('role', 'status');
    slot.textContent = messages.join(' ');
    row.dataset.refused = '';
  });
  const seen = new Set();
  return entries.map((entry) => entry.message).filter((message) => !seen.has(message) && seen.add(message));
}

/**
 * anchorPressed(container, btn, wasAt) — keep the pressed control where the
 * finger left it.
 *
 * SUNNA'S FLOOR, and it is a property this build has to satisfy rather than a
 * nicety: *a control that changes layout must still be under the finger that
 * changed it.* Minimum tap size is the case that produced the rule — its own
 * chips are floored by the value it sets, and so is every floored control above
 * it, so choosing a smaller size lifts the whole row up the page and the finger
 * ends on empty background. Measured before this existed: pressing 36 moved the
 * chip 36.4 device px, and 3 of 4 transitions left the chip behind.
 *
 * THE MECHANISM IS HERS: give the difference back through the scrolling pane's
 * `scrollTop`, so nothing about the layout is faked and no element is moved.
 *
 * THE BOUNDARY IS HERS TOO AND SHE STATED IT UNPROMPTED: at `scrollTop 0` with
 * SHRINKING content there is nothing to give back — you cannot scroll above the
 * top of a pane. That is not a bug in this function, it is the arithmetic, and
 * it is exactly where the 44 and 36 steps land when the panel is already at the
 * top. This function reports nothing; `underfinger.mjs` measures which
 * transitions it rescues and which fall in that hole, and the residual is handed
 * back rather than papered over.
 *
 * Applied to EVERY choice row, not to this one by name. A row that changes no
 * layout produces a delta of zero and pays nothing — cheaper than a list of
 * which keys move the page, and a list is a second copy of a fact the layout
 * already knows.
 */
function anchorPressed(container, btn, wasAt) {
  if (typeof document === 'undefined' || !btn.isConnected) return;
  const delta = btn.getBoundingClientRect().top - wasAt;
  if (!delta) return;
  // The nearest ancestor that can actually scroll. Asked of the live boxes, not
  // assumed to be `.set-panel`: both doors mount this container differently and
  // the modal scrolls at a different level than the in-run overlay.
  for (let el = btn.parentElement; el; el = el.parentElement) {
    const canScroll = el.scrollHeight > el.clientHeight + 1;
    if (canScroll) {
      const before = el.scrollTop;
      el.scrollTop = before + delta;
      // It moved as far as it could, which may be zero. Whatever is left is the
      // hole Sunna named, and it belongs to the measurement, not to a retry.
      if (el.scrollTop !== before) return;
    }
    if (el === container) break;
  }
}

export function fullscreenCapability(doc = globalThis.document) {
  const root = doc && doc.documentElement;
  const request = root && (root.requestFullscreen || root.webkitRequestFullscreen);
  const exit = doc && (doc.exitFullscreen || doc.webkitExitFullscreen);
  const enabled = doc && (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
  return {
    supported: !!(root && request && exit && enabled !== false),
    root,
    enter: request,
    request,
    exit,
  };
}

export function isFullscreen(doc = globalThis.document) {
  return !!(doc && (doc.fullscreenElement || doc.webkitFullscreenElement));
}

export async function toggleFullscreen(doc = globalThis.document) {
  const capability = fullscreenCapability(doc);
  if (!capability.supported) return { ok: false, reason: 'unsupported' };
  try {
    if (isFullscreen(doc)) await capability.exit.call(doc);
    else await capability.request.call(doc.documentElement);
    return { ok: true, active: isFullscreen(doc), reason: '' };
  } catch (error) {
    return {
      ok: false,
      reason: 'refused',
      message: 'The browser refused fullscreen. Try Safari’s Share menu → Add to Home Screen, then launch the saved game icon.',
      error: error && error.message ? error.message : String(error || 'Fullscreen request refused.'),
    };
  }
}

/** The categories that will actually DRAW, given whether a save manager exists.
 *  A section that needs `saves` and has none renders nothing, so it must not
 *  get a tab either — a tab onto an empty panel is the lone heading with a
 *  bigger promise. This is the one place `saves` narrows the set. */
function shownCategories(saves) {
  return settingsCategories().filter((cat) => {
    const h = categoryHandler(cat);
    return !(h && h.needs === 'saves' && !saves);
  });
}

/** The topics one General group is drawn in, as Map(label -> rows).
 *
 * EXPORTED so the Combat group's shape is asserted rather than described: the
 * report that created it ("no good section to customize combat, combat
 * animation") is a claim about which NAME holds which ROW, and that claim is
 * only worth anything if something reads it back. */
export function generalGroups(category) {
  const groups = new Map();
  for (const row of categoryHandler(category).rows) {
    const key = row.key;
    const label = category === 'Display' ? /^hud/.test(key) ? 'HUD' : /map|shrine/.test(key) ? 'Map'
      // "Effects & pacing" USED TO CATCH THE COMBAT ROWS TOO, and that is the
      // bag the report was about: a player hunting for an animation switch had
      // to guess that combat lived under a title-screen word. Those keys are
      // `cat: 'Combat'` now, so what is left here is the title entrance — and
      // the topic is named for the one thing it holds.
      : /titleCity/.test(key) ? 'Title screen' : 'Interface'
      : category === 'Combat' ? /armaments/i.test(key) ? 'Armaments' : 'Animation & effects'
      : category === 'Accessibility' ? /tooltip/i.test(key) ? 'Tooltips' : /Flick/.test(key) ? 'Touch gestures'
      : /Motion|Flashes|colorblind/.test(key) ? 'Motion & colour' : 'Readability' : 'Audio';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row);
  }
  return groups;
}

/**
 * compactAdvancedRow(row, groupId, subgroupId) → the row as the Advanced panel
 * draws it, where the panel's own tab already carries part of the row's name.
 *
 * EXPORTED SO IT CAN BE ASSERTED. It was an anonymous block inside the render
 * expression, which meant the one line that decides whether a generated
 * balance row keeps its description was reachable only by rendering the whole
 * panel — so a change putting the old 'Applies to a new run.' boilerplate back
 * could pass every test in the repo (Copilot, #1243). It is a pure function of
 * the row and its two tab ids now, and tests/advanced-config.test.mjs holds it.
 */
export function compactAdvancedRow(row, groupId, subgroupId) {
  // SHORTEN WHAT THE TAB ALREADY SAYS — and only that. The label itself has
  // ONE home (`leafRows` in model/advancedConfig.js); a branch here used to
  // rebuild every generated balance row's label out of `row.key`, splitting
  // camelCase without capitalising it, which is how "hand Max" and "levels ·
  // player Starting Level" came to sit two rows under "HP — base amount" in
  // one menu. That is gone. What is left is presentation: under a tab named
  // "Enemy scaling", a row called "Levels · Enemy Scaling · HP — Per Level"
  // says the tab's own name back to the reader, and the class tabs have always
  // compacted that away. Now every tab does.
  const compact = { ...row, label: compactRowLabel(row.label, subgroupId) };
  if (groupId === 'Progression' && CLASS_TOPICS.includes(subgroupId)) {
    // The class's own topic already says which class this is, so the note goes
    // — EXCEPT the sentence naming the kit floor, which is the only place the
    // row's minimum explains itself. Dropping it left the floor a number from
    // nowhere.
    compact.note = row.floorNote || '';
  }
  // EVERY OTHER ROW KEEPS ITS OWN NOTE. A generated balance row's used to be
  // replaced here with 'Applies to a new run.' — the same five words under
  // all 325 of them — and each now carries the sentence written beside its
  // number in content/balance.js, closing clause included.
  return compact;
}

// ---- Advanced → Stats: the live worked example ------------------------------
//
// Computed by models/StatsPreviewModel.js from the same configured bundle a new
// run is born from, and redrawn after every edit (`refreshStatsPreviews`), so
// the numbers under a dial are the ones the dial produces.
// The last example drawn, keyed by everything it reads, so the render that
// paints the panel and the refresh that follows it compute it once.
let lastStatsPreview = { key: null, html: '' };

export function statsTopicPreviewHtml(settings, topic, previewAttributes = null, previewLevel = null) {
  const key = JSON.stringify([topic, previewAttributes, previewLevel, settings]);
  if (key === lastStatsPreview.key) return lastStatsPreview.html;
  const html = statsTopicPreviewMarkup(settings, topic, previewAttributes, previewLevel);
  lastStatsPreview = { key, html };
  return html;
}

function statsTopicPreviewMarkup(settings, topic, previewAttributes, previewLevel) {
  const preview = statsTopicPreview(settings, topic, previewAttributes, previewLevel);
  if (!preview) return '';
  if (preview.problem) return `<div class="set-example set-example-problem" role="status"><p>${esc(preview.problem)}</p></div>`;
  const classes = statsExampleClasses();
  const who = preview.subject.current || classes.length < 2
    ? `<span>${esc(preview.subject.label)}</span>`
    : `<label class="set-example-who">Example character <select data-stats-example-class aria-label="Example character">${classes.map((entry) => `<option value="${esc(entry.id)}"${entry.id === preview.subject.classId ? ' selected' : ''}>New ${esc(entry.label)}</option>`).join('')}</select></label>`;
  const examples = preview.examples.map((example) => `<div class="set-example-block${example.off ? ' is-off' : ''}" data-stat-example="${esc(example.id)}">`
    + `<div class="set-example-title">${esc(example.title)}${example.legacy ? ` <small>${esc(example.legacy)}</small>` : ''}</div>`
    + (example.lines.length ? `<dl class="set-example-lines">${example.lines.map((line) => `<div><dt>${esc(line.label)}</dt><dd><span class="set-example-math">${esc(line.expression)}</span> <b class="set-example-total">= ${esc(String(line.total))}</b>${line.capped != null ? ` <small>(capped at ${esc(String(line.capped))})</small>` : ''}</dd></div>`).join('')}</dl>` : '')
    + (example.hint ? `<p class="set-example-hint">${esc(example.hint)}</p>` : '')
    + '</div>').join('');
  return `<div class="set-example" aria-live="polite"><div class="set-example-head"><strong>Worked example</strong>${who}</div>`
    + (preview.refused ? `<p class="set-example-refused" role="status">${esc(preview.refused)}</p>` : '')
    + `<p class="set-example-attrs">${esc(preview.attributes)}</p>${examples}</div>`;
}

function visibleAdvancedSubgroups(rows, groupId) {
  const groups = advancedSubgroups(rows, groupId);
  // The scene editor owns per-scene values and shows their actual effect beside
  // the painting. Keeping another 70-plus controls under each scene tab meant
  // the inactive private staging looked editable while changing nothing.
  if (groupId !== 'Opening') return groups;
  return groups.filter(group => !group.rows.some(row => row.prologuePath?.[0] === 'scenes'));
}

// ---- search: EVERY section at once (2026-09-24 revamp) ----------------------
//
// Find used to filter the rows of the Advanced section already open, so a
// setting under another tab answered "0 of 212" — and to have anything to
// filter, every one of Advanced's ~3,000 rows had to be in the page, hidden.
// That page was the slowness: opening Advanced built and wired all of them.
// Now a query draws its matches, from every section this build shows, and
// nothing else; a section draws only the topic that is open.
const SEARCH_LIMIT = 120;
const subgroupCache = new Map();
function cachedSubgroups(rows, groupId) {
  if (!subgroupCache.has(groupId)) subgroupCache.set(groupId, visibleAdvancedSubgroups(rows, groupId));
  return subgroupCache.get(groupId);
}

/**
 * settingsSearchHits(query, debug, settings) → [{ row, where }] across every
 * shown section. With `settings`, a row the hand rules currently hide (the
 * fixed-draw rows while drawing to a hand size) is not a hit: it would be
 * counted, and reset, without being on screen.
 */
export function settingsSearchHits(query, debug = pageDebug(), settings = null, { changedOnly = false } = {}) {
  const q = String(query || '').trim().toLocaleLowerCase();
  if (!q && !changedOnly) return [];
  const words = q ? q.split(/\s+/) : [];
  const hiddenByRules = new Set();
  if (settings && resolveHandRules(settings, contentBundle.attributes).drawMode !== 'fixed') {
    for (const row of handRulesRows(contentBundle.attributes)) if (row.fixedOnly) hiddenByRules.add(row.key);
  }
  const hit = (row) => {
    if (hiddenByRules.has(row.key)) return false;
    if (changedOnly && !rowModified(settings, row)) return false;
    const hay = `${row.label || ''} ${typeof row.note === 'string' ? row.note : ''} ${row.key || ''}`.toLocaleLowerCase();
    return words.every((word) => hay.includes(word));
  };
  const hits = [];
  for (const row of ROWS) {
    if (row.retired || !(GENERAL_GROUPS.includes(row.cat) || row.cat === 'Accessibility')) continue;
    if (hit(row)) hits.push({ row, where: row.cat === 'Accessibility' ? 'Accessibility' : `General › ${row.cat}` });
  }
  const advanced = categoryHandler('Advanced')?.rows || [];
  for (const group of visibleAdvancedGroups(debug)) {
    if (MOUNTED_ADVANCED_GROUPS[group.id]) continue;
    for (const sub of cachedSubgroups(advanced, group.id)) {
      for (const row of sub.rows) if (hit(row)) hits.push({ row, where: `${group.label} › ${sub.label}` });
    }
  }
  return hits;
}

function searchResultsHtml(settings, query, changedOnly = false) {
  const hits = settingsSearchHits(query, pageDebug(), settings, { changedOnly });
  if (!hits.length) {
    return `<p class="set-note set-search-empty" data-search-results="0">${changedOnly
      ? (query ? `No changed setting matches “${esc(query)}”.` : 'Nothing is changed: every setting is at its default.')
      : `No setting matches “${esc(query)}”.`}</p>`;
  }
  let where = null;
  const shown = hits.slice(0, SEARCH_LIMIT);
  const body = shown.map(({ row, where: at }) => {
    const heading = at !== where ? `<h4 class="set-subsection-heading set-search-where">${esc(at)}</h4>` : '';
    where = at;
    return heading + settingsRowHtml(settings, row);
  }).join('');
  const more = hits.length > shown.length ? `<p class="set-note">${hits.length - shown.length} more — add a word to narrow the search.</p>` : '';
  const lead = changedOnly ? 'Every setting you have changed, from every section.' : 'Results from every section.';
  const noun = changedOnly ? `${hits.length} changed` : `${hits.length} match${hits.length === 1 ? '' : 'es'}`;
  return `<div class="set-group-summary"><span>${lead}</span><output data-config-count aria-live="polite">${noun}</output></div>`
    + `<div class="set-card-list" data-search-results="${hits.length}">${body}</div>${more}`;
}

/** categoryHtml(cat, settings, …) → one pane's markup (exported for tests). */
export function categoryHtml(cat, settings, saves, previewAttributes = null, previewLevel = null, query = '', changedOnly = false) {
  if (query || changedOnly) return searchResultsHtml(settings, query, changedOnly);
  if (cat === 'General' || cat === 'Accessibility') {
    const groups = cat === 'Accessibility' ? ['Accessibility'] : GENERAL_GROUPS;
    const selected = groups.includes(settings.settingsGeneralCategory) ? settings.settingsGeneralCategory : groups[0];
    const topics = generalGroups(selected);
    const storedTopic = settings[`settingsGeneralTopic.${selected}`];
    const topic = topics.has(storedTopic) ? storedTopic : topics.keys().next().value;
    return '<div class="set-general-pickers">'
      + (groups.length > 1 ? `<select class="set-general-select" data-general-select aria-label="General section">${groups.map(group => `<option${group === selected ? ' selected' : ''}>${group}</option>`).join('')}</select>` : '')
      + (topics.size > 1 ? `<select class="set-general-select" data-general-topic aria-label="${cat} option group">${[...topics.keys()].map(label => `<option${label === topic ? ' selected' : ''}>${label}</option>`).join('')}</select>` : '')
      + `</div>${settingsPreviewShown(cat, selected) ? settingsPreviewHtml(settings) : ''}<div class="set-card-list">${topics.get(topic).map(row => settingsRowHtml(settings, row)).join('')}</div>`;
  }
  const h = categoryHandler(cat);
  if (!h) {
    // The lone heading, made loud — now a lone TAB, which is louder still: it
    // is on screen from the moment Settings opens instead of 2000px down. It
    // cannot reach a player (the boot assert fails first), so this is what a
    // developer sees on the way.
    return `<p class="set-note">Nothing is filed under "${esc(cat)}".`
      + ' Give it a row (<code>cat:</code>) or a section, or take it out of'
      + ' CATEGORY_ORDER in src/ui/screens/settings.js.</p>';
  }
  // NO PANE HEADING (W1a). It printed "Settings / <category> / <tip>" under a
  // door already titled Settings, beside a tab already naming the category.
  // The selected tab is the pane's identity: the panel is labelled by it
  // (aria-labelledby), and the tip is still the tab's tooltip.
  if (cat === 'Advanced') {
    const shownGroups = visibleAdvancedGroups();
    const active = activeAdvancedGroup(settings);
    const tabs = shownGroups.map((group) => `<button class="set-subtab${group.id === active ? ' on' : ''}"`
      + ` type="button" role="tab" aria-selected="${group.id === active}" aria-pressed="${group.id === active}"`
      + ` data-advanced-group="${esc(group.id)}">${esc(group.label)}</button>`).join('');
    // ONLY THE OPEN SECTION, AND ONLY ITS OPEN TOPIC, IS DRAWN. The others are
    // empty shells marked `data-lazy`; choosing one repaints the panel.
    const groups = shownGroups.map((group) => {
      if (group.id !== active) {
        return `<section class="set-advanced-group" data-advanced-panel="${esc(group.id)}" data-lazy hidden></section>`;
      }
      if (MOUNTED_ADVANCED_GROUPS[group.id]) {
        return `<section class="set-advanced-group" data-advanced-panel="${esc(group.id)}"`
          + `><div class="${MOUNTED_ADVANCED_GROUPS[group.id]}"></div></section>`;
      }
      const subgroups = cachedSubgroups(h.rows, group.id);
      const selected = storedAdvancedTopic(settings, group.id);
      const activeSub = subgroups.find(sub => sub.id === selected) || subgroups[0];
      const subTabs = subgroups.length > 1 ? `<div class="set-topic-tabs" role="tablist" aria-label="${esc(group.label)} groups">`
        + subgroups.map((sub, index) => `<button type="button" class="as-btn${sub === activeSub ? ' on' : ''}" role="tab" aria-selected="${sub === activeSub}" aria-controls="set-topic-${group.id}-${index}" data-topic="${esc(sub.id)}">${esc(sub.label)}</button>`).join('') + '</div>' : '';
      return `<section class="set-advanced-group" data-advanced-panel="${esc(group.id)}"`
        + `>${subTabs}<div class="set-group-summary"><span>${esc(group.tip)}${group.id === 'Progression' ? ' New runs only.' : ''}</span><output data-config-count aria-live="polite"></output></div>`
        + subgroups.map((sub, index) => sub !== activeSub
          ? `<div class="set-card-list set-topic-panel" id="set-topic-${group.id}-${index}" data-topic-panel="${esc(sub.id)}" data-lazy hidden></div>`
          : `<div class="set-card-list set-topic-panel" id="set-topic-${group.id}-${index}" data-topic-panel="${esc(sub.id)}">`
          + (group.id === 'Stats' ? `<div data-stats-preview="${esc(sub.id)}">${statsTopicPreviewHtml(settings, sub.id, previewAttributes, previewLevel)}</div>` : '')
          + (sub.id === 'Formation layout' ? formationSettingsHtml(settings, sub.rows)
            : sub.rows.map((row, rowIndex) => {
              // A Stats topic reads as short subsections (Formula, Level
              // growth, Starting hand, …): a heading wherever the section
              // changes. `advancedSubgroups` keeps each one contiguous.
              const section = group.id === 'Stats' ? statsSection(row) : null;
              const heading = section && section !== (rowIndex ? statsSection(sub.rows[rowIndex - 1]) : null)
                ? `<h4 class="set-subsection-heading" data-subsection="${esc(section)}">${esc(section)}</h4>` : '';
              return heading + settingsRowHtml(settings, compactAdvancedRow(row, group.id, sub.id));
            }).join(''))
          + '</div>').join('') + '</section>';
    }).join('');
    return `<div class="as-pane-head set-advanced-head"><span class="set-subtabs" role="tablist" aria-label="Advanced settings sections">${tabs}</span></div>`
      + `<div class="set-mobile-pickers"><select class="set-section-select" aria-label="Advanced section">${shownGroups.map(group => `<option value="${esc(group.id)}"${group.id === active ? ' selected' : ''}>${esc(group.label)}</option>`).join('')}</select><select class="set-topic-select" aria-label="Option group"></select></div>`
      + groups;
  }
  if (h.mount) return `<div class="${h.mount}"></div>`;
  return `<div class="set-card-list">${h.rows.map((r) => settingsRowHtml(settings, r)).join('')}</div>`;
}

/**
 * renderSettings(container, { settings, onChange, grouped })
 * Fills `container` with the settings controls and wires change events.
 * grouped=true draws the category TAB STRIP and one category at a time.
 *
 * SIX SECTIONS USED TO BE SIX HEADINGS DOWN ONE SCROLLING COLUMN. One name was
 * on screen when Settings opened, at every shape and every text size measured;
 * AUDIO sat 1848px below DISPLAY at 390/Text M, and the last section was five
 * thumb-drags away — eight at Text XL, and six at 1200x730, so it was never
 * only a phone. A gold, letter-spaced, uppercase heading promises a taxonomy;
 * hiding five sixths of it is the promise broken in silence.
 *
 * BOTH EDGES, because a tab strip can break this in the other direction:
 *   - six sections must not become six screens a player has to HUNT — so the
 *     whole strip is on screen at once and wraps rather than scrolling
 *     sideways. All six names are readable before the first tap.
 *   - a section that scrolls internally must STILL SCROLL — the panel keeps
 *     the container's overflow, so Display's sixteen rows are all reachable.
 *
 * NOTHING NEW IS AUTHORED to add a seventh. `settingsCategories()` already
 * derives the set from what is filed; a tab, its tooltip, its bumper stop and
 * its place in the ring all follow from that one list.
 */
const MARKS_MODIFIED = Symbol('marks modified rows');
export function renderSettings(container, { settings, onChange, grouped = true, saves = null, onOffline = null, headerTools = null, previewAttributes = null, previewLevel = null }) {
  panelSettings = settings;
  if (!onChange[MARKS_MODIFIED]) {
    const report = onChange;
    onChange = Object.assign((changes) => {
      const out = report(changes);
      markModified(container, settings, changes);
      syncHeaderState();
      return out;
    }, { [MARKS_MODIFIED]: true });
  }
  let html = '';
  let cats = [];
  let current = null;
  if (!headerTools) {
    headerTools = settingsHeaderTools();
    headerTools.dataset.inlineSettings = 'true';
  }
  const searchQuery = () => (grouped ? headerTools.querySelector('[data-advanced-search]')?.value.trim() || '' : '');
  const changedOnly = () => grouped && headerTools.dataset.changedOnly === '1';
  const filtering = () => !!searchQuery() || changedOnly();
  if (grouped) {
    cats = shownCategories(saves);
    // A stored category that no longer exists must not blank the screen. Fail
    // SAFE and visibly: fall back to the first tab, which is where a player who
    // never chose one lands anyway.
    const stored = settings[CAT_KEY];
    current = cats.includes(stored) ? stored : ['Changelog', 'About'].includes(stored) ? 'Advanced' : cats[0] || null;
    if (['Changelog', 'About'].includes(stored)) settings[ADVANCED_CAT_KEY] = stored;
    if ([...GENERAL_GROUPS, 'Accessibility'].includes(stored)) settings.settingsGeneralCategory = stored;
    if (!cats.length) {
      // Nothing is filed anywhere. assertSurfaces fails the boot before a
      // player can meet this, so it is a developer's message, not a player's.
      html = '<p class="set-note">No settings categories exist —'
        + ' nothing is filed under any name in src/ui/screens/settings.js.</p>';
    } else {
      // `data-member` on each TAB is the house convention for a navigable set
      // (#78): the host names the set, each member names itself, so an
      // instrument reads this off the rendered page instead of importing three
      // modules. It moved from the heading to the tab because the tab is now
      // what a player navigates — the heading is gone, since the selected tab
      // IS the heading and printing the name twice costs a phone a line it
      // does not have.
      //
      // role=tab / tablist / tabpanel / aria-selected are the FIRST in this
      // repo. Before tonight a screen reader had no tabs on any surface here,
      // including the overlay's six — that half is still open and is not mine
      // to fix in this file.
      // THE RAIL IS VERTICAL AT EVERY WIDTH (kit §04 NavRail): a column of
      // destinations behind a pane separator, never a strip lying down.
      const tabs = cats.map((cat) => `<button class="as-railitem set-tab${cat === current ? ' on' : ''}" type="button"`
        + ` role="tab" id="set-tab-${esc(cat)}" aria-selected="${cat === current}"${cat === current ? ' aria-current="true"' : ''}`
        + ` aria-controls="set-panel" data-member="${esc(cat)}">${esc(categoryLabel(cat))}</button>`).join('');
      // W1a COMPACT: one selector above the pane, naming the selected
      // category — the kit's categoryNav, added below once the markup is in
      // the page. It opens the SAME tabs, so every tool, tooltip and ring that
      // reads `.set-tab` reads one set either way.
      html = `<div class="as-railed set-railed" data-settings-nav="rail">`
        + `<div class="as-rail set-tabs" id="set-tabs" role="tablist" aria-label="${esc(t('settings.nav.sections'))}"`
        + ` aria-orientation="vertical" data-surface="settingsCategory">${tabs}</div>`
        + `<div class="as-pane set-panel" id="set-panel" role="tabpanel"`
        + ` aria-labelledby="set-tab-${esc(current)}">${categoryHtml(current, settings, saves, previewAttributes, previewLevel, searchQuery(), changedOnly())}</div></div>`;
    }
  } else {
    html = ROWS.filter((r) => !r.retired).map((r) => settingsRowHtml(settings, r)).join('');
  }
  container.innerHTML = html;
  container.setAttribute('data-settings-host', '');
  // ONE BAR, NOT TWO LOOSE BLOCKS. The modal hangs these tools in its head; the
  // in-run overlay has no head to hang them in, so they used to be prepended
  // one after the other and landed as two stacked rows above the rail — the
  // download button on its own line, the icon pair floating at the right of the
  // next. Both ride one row now, and the CSS that styles them keys off
  // `[data-settings-host]` so the overlay gets the same faces as the modal.
  const inlineBar = document.createElement('div');
  inlineBar.className = 'set-inline-bar';
  if (onOffline) {
    const offline = button({ label: offlinePlay.title, id: 'settings-download' });
    offline.addEventListener('click', onOffline);
    inlineBar.append(offline);
  }
  if (headerTools.dataset.inlineSettings) inlineBar.append(headerTools);
  if (inlineBar.childElementCount) container.prepend(inlineBar);
  // The overlay reuses one connected `.overlay-body` between tabs. A sentinel
  // belongs to this render, so clearing Settings for Deck disconnects it and
  // releases listeners even while the shared container remains on the page.
  const lifecycleSentinel = document.createComment('settings-render-lifecycle');
  container.appendChild(lifecycleSentinel);

  const syncFullscreen = (message = '') => {
    const btn = container.querySelector('.toggle[data-key="fullscreen"][data-action]');
    if (!btn) return;
    const capability = fullscreenCapability();
    const on = isFullscreen();
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', String(on));
    btn.disabled = !capability.supported;
    btn.setAttribute('aria-disabled', String(!capability.supported));
    const status = btn.closest('.set-row')?.querySelector('[data-fullscreen-status]');
    if (status) {
      status.textContent = message || (capability.supported
        ? 'Fill the screen when this browser allows it.'
        : 'Fullscreen is unavailable in this browser. On iPhone, Add to Home Screen provides the closest app-like view.');
    }
  };

  // ---- everything below wires ONE PANEL'S controls -------------------------
  // It used to run once over the whole column, because the whole column was on
  // screen. With one category at a time it has to run again after every tab
  // switch — the old nodes go with the innerHTML that replaced them, so nothing
  // accumulates. The one listener that is NOT per-panel (the resize handler for
  // the applied-zoom readout) is installed once per open, below.
  // Move one set of section tabs between the sidebar and compact content pane.
  const placeAdvancedNavigation = (mode = container.querySelector('.set-railed')?.dataset.settingsNav) => {
    const sections = container.querySelector('.set-advanced-head');
    if (!sections) return;
    const vertical = mode !== 'selector';
    sections.querySelector('[role="tablist"]').setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
    if (vertical) container.querySelector('.set-tabs [data-member="Advanced"]')?.after(sections);
    else container.querySelector('.set-panel')?.prepend(sections);
  };
  // ONE REPAINT for everything that changes what the pane shows — a category,
  // an Advanced section or topic, a search, a row reset. Only the pane is
  // rebuilt; the rail, the header tools and the page-level listeners stay.
  let searchTimer = null;
  function repaintPanel({ keepScroll = false } = {}) {
    // The formation editor holds an unapplied draft in its DOM; apply it before
    // the pane it lives in is rebuilt, or stay put when it cannot be applied.
    if (!applyPendingFormationSettings(container)) return;
    const panel = container.querySelector('.set-panel');
    if (!panel) { renderSettings(container, { settings, onChange, grouped, saves, onOffline, headerTools, previewAttributes, previewLevel }); return; }
    const scroll = keepScroll ? panel.scrollTop : 0;
    const outer = keepScroll ? panel.parentElement?.scrollTop || 0 : 0;
    container.querySelector('.set-tabs > .set-advanced-head')?.remove();
    panel.innerHTML = categoryHtml(current, settings, saves, previewAttributes, previewLevel, searchQuery(), changedOnly());
    panel.setAttribute('aria-labelledby', `set-tab-${current}`);
    panel.dataset.searching = String(filtering());
    const groupReset = headerTools.querySelector('[data-reset-config="group"]');
    if (groupReset) groupReset.textContent = filtering() ? 'Reset these results' : 'Reset this group';
    paintUndo();
    wire();
    panel.scrollTop = scroll;
    if (panel.parentElement) panel.parentElement.scrollTop = outer;
  }
  // ---- the Undo bar, the first-open tip, the Changed toggle --------------
  let undoTimer = null;
  function paintUndo() {
    container.querySelector(':scope > .set-undo')?.remove();
    if (!undoOffer || Date.now() > undoOffer.until) { undoOffer = null; return; }
    const offer = undoOffer;
    const bar = document.createElement('div');
    bar.className = 'set-undo';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<span>${esc(offer.label)}</span><button type="button" class="as-btn" data-undo>Undo</button>`;
    bar.querySelector('[data-undo]').onclick = () => {
      const restore = {};
      for (const [key, value] of Object.entries(offer.snapshot)) {
        if (value === undefined) delete settings[key]; else settings[key] = value;
        restore[key] = value;
      }
      undoOffer = null;
      onChange(restore);
      repaintPanel({ keepScroll: true });
    };
    container.insertBefore(bar, container.querySelector(':scope > .set-railed') || container.firstChild);
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { if (undoOffer === offer) { undoOffer = null; bar.remove(); } }, Math.max(0, offer.until - Date.now()));
  }
  function paintTip() {
    if (!grouped || settings.settingsTipSeen || container.querySelector(':scope > .set-tip')) return;
    const tip = document.createElement('div');
    tip.className = 'set-tip';
    tip.setAttribute('role', 'note');
    tip.innerHTML = '<span><b>Tip:</b> the magnifier finds any setting in every section. A dot marks a setting you changed, and its Reset puts it back. <b>Changed</b> lists all of them.</span>'
      + '<button type="button" class="as-btn" data-tip-dismiss>Got it</button>';
    tip.querySelector('[data-tip-dismiss]').onclick = () => {
      settings.settingsTipSeen = true;
      onChange({ settingsTipSeen: true });
      tip.remove();
    };
    container.insertBefore(tip, container.querySelector(':scope > .set-railed') || container.firstChild);
  }
  function syncHeaderState() {
    const toggle = headerTools.querySelector('[data-changed-toggle]');
    if (toggle) {
      // The rows Changed can show: on a release build, hidden tuning is
      // counted by Clear hidden tuning instead.
      const count = settingsSearchHits('', pageDebug(), settings, { changedOnly: true }).length;
      toggle.textContent = count ? `Changed · ${count}` : 'Changed';
      toggle.setAttribute('aria-pressed', String(changedOnly()));
      toggle.classList.toggle('on', changedOnly());
    }
    const clear = headerTools.querySelector('[data-clear-tuning]');
    if (clear) {
      const hidden = hiddenTuningKeys(settings);
      clear.hidden = !hidden.length;
      clear.textContent = `Clear hidden tuning (${hidden.length})`;
    }
  }
  const wire = () => {
  mountFormationSettings(container, settings, onChange, formationLayoutRows());
  mountSettingsPreview(container, settings, onChange);
  placeAdvancedNavigation();
  headerTools.querySelector('[data-search-toggle]').onclick = () => {
    const input = headerTools.querySelector('[data-advanced-search]');
    input.hidden = !input.hidden;
    headerTools.classList.toggle('search-open', !input.hidden);
    headerTools.querySelector('[data-search-toggle]').setAttribute('aria-expanded', String(!input.hidden));
    if (!input.hidden) input.focus();
    else if (input.value) { input.value = ''; repaintPanel(); }
  };
  const changedToggle = headerTools.querySelector('[data-changed-toggle]');
  if (changedToggle) changedToggle.onclick = () => {
    if (changedOnly()) delete headerTools.dataset.changedOnly; else headerTools.dataset.changedOnly = '1';
    repaintPanel();
  };
  const clearTuning = headerTools.querySelector('[data-clear-tuning]');
  if (clearTuning) clearTuning.onclick = () => {
    const keys = hiddenTuningKeys(settings);
    if (!keys.length) return;
    // Cleared, not reset: a promoted value for hidden tuning is not this
    // build's default either (promotionFor leaves it out at boot).
    resetKeys(settings, onChange, keys, `Hidden tuning cleared (${keys.length})`, { promoted: {} });
    headerTools.querySelector('details').open = false;
    repaintPanel({ keepScroll: true });
  };
  syncHeaderState();
  container.querySelector('[data-general-select]')?.addEventListener('change', event => {
    settings.settingsGeneralCategory = event.target.value;
    onChange({ settingsGeneralCategory: event.target.value });
    renderSettings(container, { settings, onChange, grouped, saves, onOffline, headerTools, previewAttributes, previewLevel });
  });
  container.querySelector('[data-general-topic]')?.addEventListener('change', event => {
    const key = `settingsGeneralTopic.${current === 'Accessibility' ? 'Accessibility' : generalGroup(settings)}`;
    settings[key] = event.target.value;
    onChange({ [key]: event.target.value });
    renderSettings(container, { settings, onChange, grouped, saves, onOffline, headerTools, previewAttributes, previewLevel });
  });
  const syncTopicPicker = () => {
    const picker = container.querySelector('.set-topic-select');
    if (!picker) return;
    const tabs = [...container.querySelectorAll('.set-advanced-group:not([hidden]) [data-topic]')];
    picker.hidden = !tabs.length;
    picker.innerHTML = tabs.map(tab => `<option${tab.getAttribute('aria-selected') === 'true' ? ' selected' : ''}>${esc(tab.dataset.topic)}</option>`).join('');
  };
  syncTopicPicker();
  container.querySelector('.set-topic-select')?.addEventListener('change', event => {
    [...container.querySelectorAll('.set-advanced-group:not([hidden]) [data-topic]')].find(tab => tab.dataset.topic === event.target.value)?.click();
  });
  container.querySelector('.set-section-select')?.addEventListener('change', event => {
    [...container.querySelectorAll('.set-subtab')].find(tab => tab.dataset.advancedGroup === event.target.value)?.click();
  });
  // A typed value the field clamped is refused HERE and nowhere else: it never
  // reaches `settings`, so the model has nothing to report. Keyed by row, so a
  // legal re-entry clears exactly the message it replaced.
  const typedRefusals = new Map();
  // Only the topic on screen draws its example. A search can open several
  // topics at once; they show their rows without an example until it clears.
  const drawnPreviews = new WeakMap();
  const refreshStatsPreviews = () => {
    const searching = !!headerTools?.querySelector('[data-advanced-search]')?.value.trim();
    container.querySelectorAll('[data-stats-preview]').forEach((node) => {
      const shown = !searching && !node.closest('.set-advanced-group')?.hidden && !node.closest('.set-topic-panel')?.hidden;
      const html = shown ? statsTopicPreviewHtml(settings, node.dataset.statsPreview, previewAttributes, previewLevel) : '';
      if (drawnPreviews.get(node) === html) return;
      node.innerHTML = html;
      drawnPreviews.set(node, html);
      node.querySelector('[data-stats-example-class]')?.addEventListener('change', (event) => {
        settings[STATS_EXAMPLE_CLASS_KEY] = event.target.value;
        onChange({ [STATS_EXAMPLE_CLASS_KEY]: event.target.value });
        refreshStatsPreviews();
        // The picker was redrawn under the focus; hand it back.
        node.querySelector('[data-stats-example-class]')?.focus();
      });
    });
  };
  // A subsection whose every row is hidden (fixed-draw rows while drawing to
  // capacity, or a search) draws no heading over nothing.
  const syncSubsectionHeadings = () => {
    container.querySelectorAll('.set-subsection-heading').forEach((heading) => {
      let node = heading.nextElementSibling;
      let visible = false;
      while (node && !node.classList.contains('set-subsection-heading')) {
        if (node.classList.contains('set-row') && !node.hidden) { visible = true; break; }
        node = node.nextElementSibling;
      }
      heading.hidden = !visible;
    });
  };
  const reportAdvancedProblems = () => {
    refreshGates(container, settings);
    for (const input of container.querySelectorAll('[data-key^="gameConfig.attributeRules.presets."]')) {
      if (settings[input.dataset.key] === undefined) input.value = resolveNumberRow(settings, ROWS.find(row => row.key === input.dataset.key));
    }
    const rules = resolveHandRules(settings, contentBundle.attributes);
    // The Stats → Draw & hand worked example states the hand these rules deal
    // (`refreshStatsPreviews`); what is left here is which rows apply.
    // The whole pane, not just Stats: a search result lists these rows too.
    const section = container;
    if (section) {
      for (const row of handRulesRows(contentBundle.attributes)) {
        const controls = [...section.querySelectorAll('[data-key]')].filter(el => el.dataset.key === row.key);
        const read = path => path.split('.').reduce((v, k) => v[k], rules);
        const disabled = (row.requires && read(row.requires[0]) !== row.requires[1])
          || (row.fixedOnly && rules.drawMode !== 'fixed')
          || (['discardLimit', 'replaceDiscards'].includes(row.key.slice(HAND_RULES_PREFIX.length)) && !rules.retain);
        controls.forEach(control => { control.disabled = !!disabled; control.setAttribute('aria-disabled', String(!!disabled)); });
        controls.forEach(control => {
          const wrapper = control.closest('.set-row');
          wrapper.dataset.handHidden = String(!!row.fixedOnly && rules.drawMode !== 'fixed');
          if (row.fixedOnly) wrapper.hidden = rules.drawMode !== 'fixed';
        });
      }
    }
    refreshStatsPreviews();
    syncSubsectionHeadings();
    // ---- THE REFUSAL IS PRINTED ON THE ROW THAT CAUSED IT ------------------
    //
    // This used to be one notice at the top of Settings carrying `problems[0]`
    // and nothing else. It was TRUE and it was UNADDRESSED: with twenty class
    // cells and a creation pool on screen, "which number is it refusing?" was
    // a guess, and the owner's read was that the dial did nothing. Each row
    // now says, under its own label, what was refused, why, and what the game
    // is using instead. The banner stays for the problems that belong to no
    // row (cross-field ranges), and as the thing you see from the other tab.
    const problems = paintConfigProblems(container, settings, [...typedRefusals.entries()].map(([key, message]) => ({ keys: [key], message })));
    if (problems.length) showSettingsNotice(problems[0], 'game-config');
    else clearSettingsNotice('game-config');
  };
  // The acknowledgement needs no manager and no settings — it always renders.
  const aboutMount = container.querySelector('.set-about-mount');
  if (aboutMount) renderAboutSection(aboutMount);
  const changelogMount = container.querySelector('.set-changelog-mount');
  if (changelogMount) renderChangelogSection(changelogMount);
  const syncMount = container.querySelector('.set-sync-mount');
  if (syncMount) renderSettingsSync(syncMount, { settings, onChange, rows: ROWS, afterApply: (moved, before) => {
    if (moved) offerUndo(`Profile loaded (${moved} setting${moved === 1 ? '' : 's'})`, before);
    repaintPanel({ keepScroll: true });
  } });

  container.querySelectorAll('.set-subtab').forEach((button) => {
    button.classList.add('as-railitem');
    button.addEventListener('keydown', (event) => {
      const tabs = [...container.querySelectorAll('.set-subtab')];
      const vertical = button.closest('[role="tablist"]').getAttribute('aria-orientation') === 'vertical';
      const delta = event.key === (vertical ? 'ArrowDown' : 'ArrowRight') ? 1
        : event.key === (vertical ? 'ArrowUp' : 'ArrowLeft') ? -1 : 0;
      const target = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1)
        : delta ? tabs[(tabs.indexOf(button) + delta + tabs.length) % tabs.length] : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const id = target.dataset.advancedGroup;
      target.click();
      container.querySelector(`.set-subtab[data-advanced-group="${CSS.escape(id)}"]`)?.focus();
    });
    button.addEventListener('click', () => {
      const group = button.dataset.advancedGroup;
      settings[ADVANCED_CAT_KEY] = group;
      const picker = container.querySelector('.set-section-select');
      if (picker) picker.value = group;
      onChange({ [ADVANCED_CAT_KEY]: group });
      // A section not yet drawn is drawn now — the whole panel, once.
      if (container.querySelector(`.set-advanced-group[data-advanced-panel="${CSS.escape(group)}"][data-lazy]`)) {
        repaintPanel();
        container.querySelector(`.set-subtab[data-advanced-group="${CSS.escape(group)}"]`)?.focus({ preventScroll: true });
        return;
      }
      container.querySelectorAll('.set-subtab').forEach((candidate) => {
        const selected = candidate.dataset.advancedGroup === group;
        candidate.classList.toggle('on', selected);
        candidate.setAttribute('aria-selected', String(selected));
        candidate.setAttribute('aria-pressed', String(selected));
      });
      container.querySelectorAll('.set-advanced-group').forEach((panel) => {
        panel.hidden = panel.dataset.advancedPanel !== group;
      });
      syncTopicPicker();
      const panel = container.querySelector('.set-panel');
      if (panel) panel.scrollTop = 0;
      filterAdvancedRows();
      refreshStatsPreviews();
    });
  });

  const advancedSearch = headerTools.querySelector('[data-advanced-search]');
  // Rows are no longer filtered in place: a query repaints the panel with its
  // matches from every section (`searchResultsHtml`). What is left here is the
  // open topic's own bookkeeping — rows the hand rules hide, the count.
  const filterAdvancedRows = () => {
    const section = container.querySelector('.set-advanced-group:not([hidden])');
    if (section) {
      let total = 0;
      section.querySelectorAll('.set-topic-panel:not([hidden]) .set-row').forEach((row) => {
        total += 1;
        row.hidden = row.dataset.handHidden === 'true';
      });
      const count = section.querySelector('[data-config-count]');
      if (count) count.textContent = `${total} settings`;
    }
    syncSubsectionHeadings();
    refreshStatsPreviews();
  };
  if (advancedSearch) {
    advancedSearch.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { if (lifecycleSentinel.isConnected) repaintPanel(); }, 160);
    };
  }
  container.querySelectorAll('.set-advanced-group').forEach(section => {
    const selectTopic = topic => {
      const key = `settingsAdvancedSubgroup.${section.dataset.advancedPanel}`;
      settings[key] = topic;
      onChange({ [key]: topic });
      section.querySelectorAll('[data-topic]').forEach(tab => {
        const active = tab.dataset.topic === topic;
        tab.setAttribute('aria-selected', String(active));
        tab.classList.toggle('on', active);
      });
      if (advancedSearch) advancedSearch.value = '';
      repaintPanel();
      container.querySelector(`.set-advanced-group:not([hidden]) [data-topic="${CSS.escape(topic)}"]`)?.focus({ preventScroll: true });
    };
    section.querySelectorAll('[data-topic]').forEach(tab => {
      tab.addEventListener('click', () => selectTopic(tab.dataset.topic));
      tab.addEventListener('keydown', event => {
        const tabs = [...section.querySelectorAll('[data-topic]')];
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1)
          : step ? tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length] : null;
        if (!next) return;
        event.preventDefault();
        event.stopPropagation();
        next.click();
      });
    });
    section.querySelector('.set-topic-select')?.addEventListener('change', event => selectTopic(event.target.value));
  });
  filterAdvancedRows();

  headerTools.querySelectorAll('[data-reset-config]').forEach((button) => {
    button.onclick = () => {
      const currentGroup = activeAdvancedGroup(settings);
      const groups = visibleAdvancedSubgroups(ROWS, currentGroup);
      const selected = storedAdvancedTopic(settings, currentGroup);
      // Reset all also clears inert retired keys: they are off the screen, so
      // this is the only door that can take a stale one out of a profile.
      // While a search is open the pane shows its matches, so "this group" IS
      // the matches — every one the pane counts, not only the page it draws —
      // and never the section that was open behind the search.
      const query = searchQuery();
      const rows = button.dataset.resetConfig === 'all' ? [...ROWS, ...INERT_CONFIG_ROWS]
        : filtering() ? settingsSearchHits(query, pageDebug(), settings, { changedOnly: changedOnly() }).map((hit) => hit.row)
        : current === 'General' || current === 'Accessibility' ? (() => {
          const section = current === 'Accessibility' ? 'Accessibility' : generalGroup(settings);
          const topics = generalGroups(section);
          return topics.get(settings[`settingsGeneralTopic.${section}`]) || topics.values().next().value;
        })()
        : (groups.find(group => group.id === selected) || groups[0])?.rows || [];
      const keys = rows.filter(row => !CONTROL_ROW_TYPES.has(row.type)).map(row => row.key);
      const label = button.dataset.resetConfig === 'all' ? 'All settings reset' : filtering() ? 'Results reset' : 'Group reset';
      resetKeys(settings, onChange, keys, label);
      headerTools.querySelector('details').open = false;
      renderSettings(container, { settings, onChange, grouped, saves, onOffline, headerTools, previewAttributes, previewLevel });
    };
  });

  container.querySelectorAll('[data-btn="prologuePreview"]').forEach(btn => {
    btn.onclick = () => previewPrologue(settings);
  });
  container.querySelectorAll('[data-scene-edit]').forEach(btn => {
    btn.addEventListener('click', () => openPrologueSceneEditor(settings, onChange, { sceneId: btn.dataset.sceneEdit }));
  });
  container.querySelectorAll('[data-scene-place]').forEach(btn => {
    btn.addEventListener('click', () => openPrologueSceneEditor(settings, onChange, { sceneId: btn.dataset.scenePlace, tab: 'Traveller' }));
  });
  container.querySelectorAll('.set-prologue-text').forEach(input => {
    input.addEventListener('input', () => {
      settings[input.dataset.key] = input.value;
      onChange({[input.dataset.key]:input.value});
    });
  });
  // `[data-key]`: only a control that names a setting saves one. The Defaults &
  // sync panel's token field and switch carry no key and are its own to wire.
  container.querySelectorAll('.set-text[data-key]').forEach((input) => {
    // Commit on change/blur (not each keystroke) so we don't re-fetch a manifest
    // mid-type.
    const commit = () => {
      settings[input.dataset.key] = input.value.trim();
      onChange({ [input.dataset.key]: input.value.trim() });
    };
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
  });

  const commitColor = (key, value) => {
    settings[key] = value;
    onChange({ [key]: value });
    // The swatch row is the readout as well as the control: a colour picked on
    // the wheel lights its swatch if it happens to be one, and lights none if
    // it is not.
    container.querySelectorAll(`.set-swatch[data-key="${CSS.escape(key)}"]`).forEach(chip => {
      const on = chip.dataset.color.toLowerCase() === value.toLowerCase();
      chip.classList.toggle('on', on);
      chip.setAttribute('aria-pressed', String(on));
    });
    const wheel = container.querySelector(`.set-wheel[data-key="${CSS.escape(key)}"]`);
    if (wheel && wheel.value.toLowerCase() !== value.toLowerCase()) wheel.value = value;
  };
  container.querySelectorAll('.set-color').forEach(input => {
    input.addEventListener('input', () => commitColor(input.dataset.key, input.value));
  });
  container.querySelectorAll('.set-swatch').forEach(chip => {
    chip.addEventListener('click', () => commitColor(chip.dataset.key, chip.dataset.color));
  });
  // ---- the opening's list editor and preset slots -------------------------
  //
  // Every write goes through one door: the model decides WHICH keys change
  // (prologueReorderChanges / prologueSceneCopy / prologueSceneClear), this
  // applies them the way the reset button already does — `undefined` unsets —
  // and re-renders, because the list, the counts and the per-scene topics are
  // all reading the same settings.
  const applyPrologue = (changes, refocus = null) => {
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) delete settings[key]; else settings[key] = value;
    }
    if (onChange(changes)?.ok === false) { showSettingsNotice('Settings could not be saved.'); return; }
    renderSettings(container, { settings, onChange, grouped, saves, onOffline, headerTools, previewAttributes, previewLevel });
    // A re-render replaces the button that was pressed, so reordering three
    // places from the keyboard meant hunting for the arrow again after each
    // press. The same control on the same scene takes the focus back.
    if (refocus) container.querySelector(refocus)?.focus({ preventScroll: true });
  };
  // THE ORDER COMES FROM THE SETTINGS, NOT FROM THE DOM. A drag that is
  // abandoned outside the list leaves the rows rearranged with nothing saved,
  // and reading the DOM meant the next arrow press quietly persisted that
  // abandoned arrangement. Every action re-derives the staging and edits it.
  const stagedIds = () => {
    const config = prologueConfig(settings);
    return prologueStagedOrder(config).map(index => config.scenes[index].id);
  };
  container.querySelectorAll('[data-scene-list]').forEach(list => {
    list.querySelectorAll('[data-scene-move]').forEach(btn => btn.addEventListener('click', () => {
      const ids = stagedIds();
      const from = ids.indexOf(btn.dataset.sceneId);
      const to = from + (btn.dataset.sceneMove === 'up' ? -1 : 1);
      if (from < 0 || to < 0 || to >= ids.length) return;
      ids.splice(to, 0, ...ids.splice(from, 1));
      applyPrologue(prologueReorderChanges(ids), `[data-scene-move="${btn.dataset.sceneMove}"][data-scene-id="${CSS.escape(btn.dataset.sceneId)}"]`);
    }));
    list.querySelectorAll('[data-scene-toggle]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.sceneToggle;
      const scene = prologueConfig(settings).scenes.find(row => row.id === id);
      applyPrologue({ [prologueSettingKey(['scenes', id, 'enabled'])]: scene?.enabled === false },
        `[data-scene-toggle="${CSS.escape(id)}"]`);
    }));
    list.querySelectorAll('[data-scene-copy]').forEach(btn => btn.addEventListener('click', () => {
      const source = btn.dataset.sceneCopy;
      const slot = prologueFreeSlot(prologueConfig(settings));
      // The free slot is never its own source — the markup disables that row's
      // Duplicate, and this refuses it too rather than inserting at the front.
      if (!slot || slot === source) return;
      const ids = stagedIds().filter(id => id !== slot);
      ids.splice(ids.indexOf(source) + 1, 0, slot);
      applyPrologue({ ...prologueSceneCopy(settings, source, slot), ...prologueReorderChanges(ids) },
        `[data-scene-remove="${CSS.escape(slot)}"]`);
    }));
    list.querySelectorAll('[data-scene-remove]').forEach(btn => btn.addEventListener('click', () => {
      applyPrologue(prologueSceneClear(btn.dataset.sceneRemove), '[data-scene-add]');
    }));
    // Dragging writes the same keys as the arrows. A drag that ends anywhere
    // but on another row is ABANDONED: the rows are put back by a re-render,
    // so what is on screen is always what is saved.
    let dragging = null, dropped = false;
    list.querySelectorAll('[data-scene]').forEach(item => {
      item.addEventListener('dragstart', event => {
        dragging = item; dropped = false; item.classList.add('set-scene-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.dataset.scene);
      });
      item.addEventListener('dragend', () => {
        dragging?.classList.remove('set-scene-dragging');
        const moved = !dropped && dragging;
        dragging = null;
        if (moved) renderSettings(container, { settings, onChange, grouped, saves, onOffline, headerTools, previewAttributes, previewLevel });
      });
      item.addEventListener('dragover', event => {
        if (!dragging || dragging === item) return;
        event.preventDefault();
        const box = item.getBoundingClientRect();
        item.parentNode.insertBefore(dragging, event.clientY - box.top < box.height / 2 ? item : item.nextSibling);
      });
    });
    list.addEventListener('dragover', event => { if (dragging) event.preventDefault(); });
    list.addEventListener('drop', event => {
      if (!dragging) return;
      event.preventDefault();
      dropped = true;
      applyPrologue(prologueReorderChanges([...list.querySelectorAll('[data-scene]')].map(node => node.dataset.scene)));
    });
  });
  container.querySelectorAll('[data-scene-add]').forEach(btn => btn.addEventListener('click', () => {
    const slot = prologueFreeSlot(prologueConfig(settings));
    if (!slot) return;
    applyPrologue({
      [prologueSettingKey(['scenes', slot, 'enabled'])]: true,
      ...prologueReorderChanges([...stagedIds().filter(id => id !== slot), slot]),
    }, `[data-scene-remove="${CSS.escape(slot)}"]`);
  }));
  container.querySelectorAll('[data-preset-save]').forEach(btn => btn.addEventListener('click', () => {
    try {
      applyPrologue({ [prologueSettingKey(['presets', btn.dataset.presetSave, 'data'])]: prologueSlotPayload(panelSettings || settings) });
      showSettingsNotice('Opening saved to this slot. It travels in your configuration file.');
    } catch (error) { showSettingsNotice(error.message); }
  }));
  container.querySelectorAll('[data-preset-load]').forEach(btn => btn.addEventListener('click', () => {
    try {
      // Loading REPLACES the opening: prologueSlotChanges names the keys to
      // take away as well as the ones to write.
      applyPrologue(prologueSlotChanges(settings[prologueSettingKey(['presets', btn.dataset.presetLoad, 'data'])], settings));
      showSettingsNotice('Opening loaded from this slot. Every other setting is unchanged.');
    } catch (error) { showSettingsNotice(`That slot could not be loaded: ${error.message}`); }
  }));
  container.querySelectorAll('[data-preset-clear]').forEach(btn => btn.addEventListener('click', () => {
    applyPrologue({ [prologueSettingKey(['presets', btn.dataset.presetClear, 'data'])]: undefined });
  }));
  container.querySelectorAll('.set-wheel-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const wheel = container.querySelector(`.set-wheel[data-key="${CSS.escape(toggle.dataset.wheelToggle)}"]`);
      if (!wheel) return;
      wheel.hidden = !wheel.hidden;
      toggle.setAttribute('aria-expanded', String(!wheel.hidden));
      if (!wheel.hidden) wheel.focus({ preventScroll: true });
    });
  });

  // 'number' rows: the typed field and its slider are ONE value.
  //
  // THE FIELD COMMITS ON change/blur, NOT ON EVERY KEYSTROKE, and that is the
  // whole reason a typed field is usable here: clamping mid-type would fight
  // him. Typing "12" passes through "1", and a per-keystroke clamp would rewrite
  // it under his fingers. The slider commits on `input`, because dragging IS the
  // gesture.
  //
  // EVERY COMMIT GOES THROUGH `resolveNumberRow`, so what reaches the profile is
  // always an integer inside the row's own domain — and it WRITES BACK what it
  // resolved, so a clamp or a rejection is visible in the field instead of being
  // swallowed (Law 0 clause 5).
  container.querySelectorAll('.num-wrap').forEach((wrap) => {
    const field = wrap.querySelector('.set-num');
    const key = field.dataset.key;
    const row = ROWS.find((r) => r.key === key);
    // ONE COMMIT PATH, WRITTEN FOR TWO CONTROLS BEFORE THE SECOND ONE EXISTS.
    // `mirror` walks every input in the wrap, so Part B's slider is three lines
    // — a tag in the markup above — and cannot fall out of sync with the field,
    // because neither control is the value: the resolved number is.
    const mirror = (val) => {
      for (const input of wrap.querySelectorAll('input')) input.value = String(val);
    };
    const commit = (raw) => {
      // THE CLAMP SAYS SO. `val` is always legal, so the model will never
      // report what he typed; the row does, and stops the moment he types a
      // number the row can take.
      const { value: val, refusal } = commitNumberRow(settings, row, raw);
      mirror(val);
      settings[key] = val;
      onChange({ [key]: val });
      if (refusal) typedRefusals.set(key, refusal); else typedRefusals.delete(key);
      if (key.startsWith('gameConfig.')) reportAdvancedProblems();
      // A profile key can be what a gated row inherits, so the inherited
      // values and their sentences are redrawn whatever the key (Codex, #1260).
      else refreshGates(container, settings);
    };
    // change/blur, NEVER per keystroke: typing "12" passes through "1", and a
    // clamp on every keypress would rewrite the value under his fingers.
    field.addEventListener('change', () => commit(field.value));
    field.addEventListener('blur', () => commit(field.value));
    wireStepper(wrap, { read: () => resolveNumberRow(settings, row), commit, min: row.min, max: row.max, step: row.step ?? 1, stepFor: (v) => buttonStep(row, v) });
  });

  mountFlickPractice(container, settings, UI_DEFAULTS.touchFlick);

  container.querySelectorAll('.range-wrap').forEach((wrap) => {
    const slider = wrap.querySelector('.set-range');
    const field = wrap.querySelector('.set-range-num');
    const key = slider.dataset.key;
    const commit = (raw) => {
      const val = Math.min(100, Math.max(0, Math.round(Number(raw)) || 0));
      slider.value = String(val);
      field.value = String(val);
      settings[key] = val;
      onChange({ [key]: val });
      refreshConditionNotes(container, settings);
    };
    field.addEventListener('change', () => commit(field.value));
    wireStepper(wrap, { read: () => Number(field.value), commit, min: 0, max: 100, step: 1 });
  });

  container.querySelectorAll('[data-reset-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.resetKey;
      if (btn.closest('.set-row')?.querySelector('[data-key]:disabled')) return;
      typedRefusals.delete(key);
      resetKeys(settings, onChange, [key], `${stripTags(rowByKey(key)?.label || key)} reset`);
      repaintPanel({ keepScroll: true });
      container.querySelector(`[data-row-key="${CSS.escape(key)}"] [data-key], [data-row-key="${CSS.escape(key)}"] .toggle`)?.focus({ preventScroll: true });
    });
  });

  container.querySelectorAll('[data-btn="commandLog"]').forEach((btn) => {
    btn.addEventListener('click', openDebugLog);
  });

  container.querySelectorAll('[data-btn="gameConfigExport"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Saving…';
      const result = await saveAdvancedConfigFile(panelSettings || settings, {
        build: { contentVersion: contentBundle.version },
        includeKeys: ROWS.filter((row) => row.cat === 'Advanced' && !CONTROL_ROW_TYPES.has(row.type)).map((row) => row.key),
      });
      btn.disabled = false;
      btn.textContent = result.ok ? (result.method === 'save-as' ? 'Saved' : 'Downloaded') : 'Unavailable';
      showSettingsNotice(result.ok
        ? `${result.filename} ${result.method === 'save-as' ? 'saved.' : 'downloaded locally.'}`
        : 'This browser could not create a local configuration file.');
      setTimeout(() => { if (btn.isConnected) btn.textContent = 'Export JSON'; }, 2000);
    });
  });

  // ONE IMPORTER, TWO DOORS. The opening's scene file is the same format under
  // a narrower name (parseAdvancedConfigFile recognises an art-studio preset and
  // turns it into ordinary overrides), so the scene door is this door with a
  // different label — not a second reader that could drift from it.
  //
  // THE SCENE DOOR IS STILL NARROWER THAN THE READER. Both exports are .json and
  // the whole-game one has the likelier filename, so picking the wrong one in
  // Advanced → Opening is one mis-click — and the reader would have applied
  // every balance and interface override in it under a notice that said only
  // "Loaded 412 settings". The door that says scenes takes scenes, and says so
  // by name when handed something wider.
  for (const buttonKey of ['gameConfigImport', 'prologueSceneImport']) container.querySelectorAll(`[data-btn="${buttonKey}"]`).forEach(btn => {
    const openingOnly = buttonKey === 'prologueSceneImport';
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.json,application/json';
    picker.hidden = true;
    picker.dataset.configImport = '';
    btn.after(picker);
    btn.addEventListener('click', () => { picker.value = ''; picker.click(); });
    picker.addEventListener('change', async () => {
      const file = picker.files?.[0];
      if (!file) return;
      btn.disabled = true;
      try {
        if (file.size > 1024 * 1024) throw new Error('Choose a settings JSON file smaller than 1 MB.');
        // A raised floor is reported, not thrown: the rest of the file lands.
        const warnings = [];
        const changes = parseAdvancedConfigFile(await file.text(), contentBundle, settings, ROWS, warnings);
        const outside = openingOnly ? Object.keys(changes).filter(key => !key.startsWith(PROLOGUE_PREFIX)) : [];
        if (outside.length) {
          throw new Error(`that file carries ${outside.length} setting${outside.length === 1 ? '' : 's'} from outside the opening. Load it under Advanced → Export, or export the opening on its own first. Nothing was imported.`);
        }
        if (!container.isConnected) return;
        const result = onChange(changes);
        if (result?.ok === false) throw new Error('Settings could not be saved.');
        Object.assign(settings, changes);
        renderSettings(container, { settings, onChange, grouped, saves, onOffline, headerTools, previewAttributes, previewLevel });
        showSettingsNotice(`Loaded ${Object.keys(changes).length} settings. Existing saved runs are unchanged.${warnings.length ? ` ${warnings.join(' ')}` : ''}`);
      } catch (error) {
        showSettingsNotice(`Import failed: ${error.message}`);
      } finally { btn.disabled = false; }
    });
  });

  container.querySelectorAll('[data-btn="prologueSceneExport"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Saving…';
      const result = await saveJsonFile(prologueScenePreset(panelSettings || settings), {
        filename: 'ashen-spire-opening.json',
        description: 'Ashen Spire opening scenes',
      });
      btn.disabled = false;
      btn.textContent = result.ok ? (result.method === 'save-as' ? 'Saved' : 'Downloaded') : 'Unavailable';
      showSettingsNotice(result.ok
        ? `${result.filename} ${result.method === 'save-as' ? 'saved.' : 'downloaded locally.'} The same settings also travel in the whole game configuration.`
        : 'This browser could not create a local configuration file.');
      setTimeout(() => { if (btn.isConnected) btn.textContent = 'Export JSON'; }, 2000);
    });
  });

  // EXPORT WHAT THE FILE EXPECTS, AND SAY WHERE IT GOES. The block this copies
  // is the shape content/config/ui/components/card.json already uses, so a size
  // worth keeping is pasted in rather than transcribed — transcription is where
  // a number would get changed on the way home.
  //
  // It is a FRAGMENT, nested at `sizing.levels`, and the row note says so. An
  // earlier draft emitted a bare `{ levels: … }` and described it as the file:
  // pasted over card.json that leaves no `sizing` block at all and the config
  // builder refuses it. The path comes from `cardSizingExportPath` so this note
  // and the model cannot drift about where the text belongs.
  // A REFUSAL RESOLVED AT BOOT HAS NOBODY TO TELL, SO IT IS RE-ASKED HERE.
  // `showSettingsNotice` is a no-op before this panel exists, and a bad ladder
  // stored in a profile is decided at startup — so on reload the sliders showed
  // the rejected numbers, the authored widths were in force, and nothing said
  // why until the next edit. Re-running the pure validator when Settings opens
  // costs nothing and closes that window; it reads the same settings bag the
  // boot path did, so the two cannot disagree.
  {
    const { refused } = cardLevelsWithOverrides(settings);
    if (refused) showSettingsNotice(`Card sizes unchanged: ${refused}. The authored sizes are in use, and Export will copy those.`, 'card-size');
    else clearSettingsNotice('card-size');
  }
  // A LATE CLIPBOARD LANDING THAT HAD NO PANEL TO SPEAK TO WAITS HERE FOR ONE,
  // and it waits until AFTER the refusal check above: that check clears the
  // `card-size` tag when the ladder is valid, so flushing any earlier would
  // have posted the held notice and wiped it in the same render.
  if (deferredCardSizeNotice) {
    const held = deferredCardSizeNotice;
    deferredCardSizeNotice = null;
    showSettingsNotice(held.msg);
  }
  container.querySelectorAll('[data-btn="cardSizeExport"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { levels, refused } = cardLevelsWithOverrides(settings);
      const text = cardSizingExport(levels);
      // A CLIPBOARD THAT NEVER ANSWERS IS NOT THE SAME AS ONE THAT REFUSES, AND
      // ONLY THE SECOND WAS HANDLED. `catch` covers a rejection; it does not
      // cover a promise that simply never settles, which is what
      // `navigator.clipboard.writeText` does here — measured in headless
      // Chromium on a secure context with the API present: still `pending`
      // after 1.5s, never resolved, never rejected. The `await` then never
      // returned, so nothing below it ran: no notice, no console fallback, and
      // the button sat on "Copy" for ever. The export had no failure path at
      // all on such a browser, only the appearance of one.
      //
      // So the wait is bounded, and a clipboard that has not answered in time
      // is treated exactly like one that said no.
      // NO API IS A FAILURE, NOT A SUCCESS. Wrapping the call in
      // `Promise.resolve(...)` to bound the wait turned the MISSING-clipboard
      // case into a pass: `navigator.clipboard?.writeText(text)` is `undefined`
      // on an insecure context or an older browser, and
      // `Promise.resolve(undefined).then(() => true)` says it worked. The button
      // would read "Copied", the notice would agree, and the console fallback
      // would be skipped — leaving no export anywhere. The API is checked before
      // the race rather than inferred from it.
      // A RACE DOES NOT CANCEL THE LOSER. `writeText` cannot be aborted, so a
      // write that is merely SLOW — a browser holding it while it asks for
      // clipboard permission — still lands after the timeout has declared it
      // failed. Two consequences, and only the second can be prevented:
      //
      //   * The clipboard ends up holding this block after the UI said it did
      //     not. Nothing in the platform can undo that, so it is SAID rather
      //     than hidden: a late landing posts a notice naming what arrived.
      //   * Two exports could otherwise be in flight at once and land in
      //     either order, so the newer text loses to the older. That one is
      //     preventable: while a write is outstanding the button refuses to
      //     start another, and says why.
      // REFUSING THE WRITE IS NOT REFUSING THE EXPORT, and the first version of
      // this guard confused the two. `writeText` that NEVER settles — the very
      // case the timeout exists for — leaves the flag raised for the rest of
      // the session, because only `write.then` lowers it. Returning early there
      // meant the second click did nothing at all: no console block, no button
      // change, and a slider moved afterwards could not be exported by ANY
      // route. So a held clipboard now takes the fallback path instead of the
      // door: the block is serialised and logged exactly as an unreachable
      // clipboard's is, and only the second WRITE is withheld.
      const CLIPBOARD_WAIT_MS = 1200;
      let copied = false;
      const held = exportWritePending;
      if (!held && typeof navigator.clipboard?.writeText === 'function') {
        const write = navigator.clipboard.writeText(text).then(() => true, () => false);
        exportWritePending = true;
        // ASK THE TIMER, NOT THE RESULT, WHETHER THIS WAS LATE. Keying the
        // announcement on `copied` was wrong by one microtask: this handler is
        // subscribed to `write` BEFORE `Promise.race` is, so on an ordinary
        // fast copy it runs while `copied` is still its initial `false` and
        // announced a late landing that never happened. The timeout callback
        // runs before the race resolves, so its own flag is the honest witness.
        let timedOut = false;
        const timeout = new Promise((settle) => setTimeout(() => { timedOut = true; settle(false); }, CLIPBOARD_WAIT_MS));
        // Whenever it settles — before or long after the timeout — the flag is
        // released, and a landing the user was told had failed is announced. By
        // then the panel may have been closed and reopened and the sliders
        // moved, and this callback CANNOT TELL: the bag it could compare
        // against is the one its own render opened with. So it names what it
        // knows — the block is the one from that copy, not a fresh read of the
        // sliders — and leaves the reader to look at them.
        write.then((landed) => {
          exportWritePending = false;
          if (!landed || !timedOut) return;
          // UNTAGGED ON PURPOSE. The `card-size` tag exists so a REFUSAL can be
          // withdrawn once the ladder is valid — and `applyCardSizeSettings`
          // (`src/main.js`) clears that tag on every settings change, so a
          // tagged announcement was wiped by the next tab click: measured as an
          // EMPTY notice element after reopening Settings. This is news, not a
          // standing claim about the sliders, so nothing should withdraw it.
          const msg = 'The clipboard answered late: it now holds the block from that copy, not a fresh read of the sliders.';
          console.warn(`card sizes: ${msg}`);
          if (!showSettingsNotice(msg)) deferredCardSizeNotice = { msg };
        });
        try {
          copied = await Promise.race([write, timeout]);
        } catch {
          copied = false;
        }
      }
      btn.textContent = copied ? 'Copied' : 'See log';
      if (!copied) console.log(`${cardSizingExportPath}\n${text}`);
      // "Copied" WHEN NOTHING WAS COPIED IS THE WORST OF THE THREE OUTCOMES.
      // The notice below said it regardless, so a browser that refuses the
      // clipboard produced a confident lie. The wording now follows `copied`.
      // SAY WHAT WAS COPIED WHEN IT IS NOT WHAT IS ON THE SLIDERS. A refused
      // ladder falls back to the authored table, so this button hands over the
      // AUTHORED numbers while the controls still show the rejected ones —
      // silently, until now. Copying the wrong sizes and passing them on as a
      // new default is the one outcome this feature must not produce quietly.
      // THE WAIT IS A WINDOW, AND THE SIZES CAN MOVE INSIDE IT. Bounding the
      // clipboard wait made this visible: the notice is posted up to
      // CLIPBOARD_WAIT_MS after the click, and a slider moved in between left it
      // announcing "the AUTHORED sizes are in use" while the tuned ones were
      // live — the same lie as the stale refusal, arriving late instead of
      // staying behind. So the ladder is re-asked at the moment of speaking, and
      // when it has changed the notice says the text is stale rather than
      // describing a state that has passed.
      // ASK THE LIVE PANEL, NOT THIS CLOSURE. Within one render the captured
      // bag is right — the rows write into it before calling `onChange` — but
      // a panel closed and reopened inside this wait leaves this handler
      // holding a bag the new panel never touches, so it would compare the
      // copied block against numbers nobody is looking at and could call it
      // current while the visible sliders say otherwise.
      const settled = cardLevelsWithOverrides(panelSettings || settings);
      const settledRefusal = settled.refused;
      // COMPARE THE THING, NOT A PROXY FOR IT. The first version of this asked
      // whether the REFUSAL MESSAGE had changed, which cannot see one valid
      // ladder replaced by another — both are `null`, so a slider moved from
      // 300 to 320 inside the wait left the notice claiming the tuned sizes
      // were copied while `text` still held the old ones. The question is
      // whether the block that was serialised is still the block the settings
      // would produce, so that is what is asked.
      // BOTH HALVES, because either alone has a blind spot. Comparing only the
      // block misses valid -> INVALID: a refused ladder falls back to the
      // authored table, so an export that started from the authored defaults
      // serialises identically and `moved` stays false — then the captured
      // `refused` (null) says "Copied the tuned sizes" while the controls are
      // being rejected. Comparing only the verdict misses valid -> valid, which
      // is what the previous commit fixed. The pair covers both.
      const moved = settledRefusal !== refused || cardSizingExport(settled.levels) !== text;
      const what = moved
        ? 'sizes that have since changed — copy again'
        : settledRefusal
          ? `the AUTHORED sizes, not the ones shown: ${settledRefusal}`
          : `the tuned sizes — ${cardSizingExportPath}`;
      if (refused) console.warn(`card sizes: override refused — ${refused}; the authored table is in use.`);
      // TAGGED WHEN IT SPEAKS ABOUT A REFUSAL, because an untagged notice cannot
      // be withdrawn by the one that posted it. Exporting under a broken ladder
      // replaced the tagged refusal with an untagged one, and then correcting
      // the slider could not clear it — Settings went on claiming the authored
      // sizes had been copied while the tuned ones were live. The tag follows
      // whether this notice is about a refusal, not who happened to post it.
      showSettingsNotice(copied
        ? `Copied ${what}.`
        : held
          ? `A copy is still with the clipboard, so this one is in the browser console instead — ${what}. Starting a second write could land out of order.`
          : `Could not reach the clipboard. The block is in the browser console — ${what}.`,
      settledRefusal ? 'card-size' : '');
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });

  container.querySelectorAll('.set-choice-select').forEach(select => {
    select.addEventListener('change', () => {
      const wasAt = select.getBoundingClientRect().top;
      settings[select.dataset.key] = select.value;
      onChange({ [select.dataset.key]: select.value });
      if (select.dataset.key.startsWith('gameConfig.')) reportAdvancedProblems();
      else refreshGates(container, settings);
      refreshApplied(container, settings);
      refreshConditionNotes(container, settings);
      anchorPressed(container, select, wasAt);
    });
  });

  container.querySelectorAll('.choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      // SUNNA'S FLOOR: a control that changes layout must still be under the
      // finger that changed it. Read where the pressed chip is BEFORE the change
      // lands, so the anchor below has something to aim at.
      const wasAt = btn.getBoundingClientRect().top;
      btn.parentElement.querySelectorAll('.choice').forEach((b) => {
        b.classList.toggle('on', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      settings[btn.dataset.key] = btn.dataset.val;
      onChange({ [btn.dataset.key]: btn.dataset.val });
      if (btn.dataset.key.startsWith('gameConfig.')) reportAdvancedProblems();
      else refreshGates(container, settings);
      // AFTER onChange, which is what applies the zoom. Reading before it would
      // report the previous value and the readout would always be one click
      // behind — a display that lies more quietly than the one it replaced.
      //
      // Unconditional, over every slot on the panel. The old `if (key ===
      // 'uiScale')` was the row's identity written a second time in the wiring,
      // and the second row with a derived line under it would have been a
      // second clause. There are at most two slots on a panel; asking both is
      // cheaper than remembering which one moved.
      refreshApplied(container, settings);
      // ANCHOR LAST, and the order is load-bearing — it cost me a measurement.
      // I anchored straight after onChange first, and the 44 step still lost the
      // finger by 16.25 device px: the cost line above had not gone silent yet,
      // so the anchor aimed at a layout that was one paragraph taller than the
      // one the player ends up looking at. Everything that moves the page in
      // response to this press has to have moved before the correction is read.
      anchorPressed(container, btn, wasAt);
    });
  });

  container.querySelectorAll('.toggle[data-key]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.action) {
        const result = await toggleFullscreen();
        syncFullscreen(result.ok || result.reason === 'unsupported'
          ? ''
          : 'Fullscreen was refused by the browser. Try again from this button or use the browser controls.');
        return;
      }
      const now = !btn.classList.contains('on');
      btn.classList.toggle('on', now);
      btn.setAttribute('aria-checked', String(now));
      const row = ROWS.find((candidate) => candidate.key === btn.dataset.key);
      const stored = row && row.positiveWhen === false ? !now : now;
      settings[btn.dataset.key] = stored;
      onChange({ [btn.dataset.key]: stored });
      if (btn.dataset.key.startsWith('gameConfig.')) reportAdvancedProblems();
      refreshConditionNotes(container, settings);
    });
  });
  reportAdvancedProblems();
  }; // ---- end wire() ---------------------------------------------------

  wire();
  paintTip();
  paintUndo();

  // Declared before the observer that reads it: the early return below skips
  // the claim, and a `let` read before its declaration is a crash, not a false.
  let claimedRing = false;
  // Assigned below once the strip exists; declared here for the same reason.
  let nav = null;

  // Auto's applied value moves with the window even though the setting does not.
  // ONE listener per open, not one per tab switch: the readout lives on a row
  // inside Display, so a player who visits Display four times would otherwise
  // collect four handlers that all write the same number.
  const onResize = () => { refreshApplied(container, settings); };
  window.addEventListener('resize', onResize);
  const onFullscreenChange = () => syncFullscreen();
  const onFullscreenError = () => syncFullscreen('Fullscreen was refused by the browser. Try again from this button or use the browser controls.');
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  document.addEventListener('fullscreenerror', onFullscreenError);
  document.addEventListener('webkitfullscreenerror', onFullscreenError);
  // The settings container is rebuilt on every open, so the listener is dropped
  // with it rather than accumulating one per visit. Same observer releases the
  // bumpers if this strip took them.
  const obs = new MutationObserver(() => {
    if (lifecycleSentinel.isConnected) return;
    window.removeEventListener('resize', onResize);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    document.removeEventListener('fullscreenerror', onFullscreenError);
    document.removeEventListener('webkitfullscreenerror', onFullscreenError);
    if (claimedRing) setTabRing(null);
    nav?.release();
    obs.disconnect();
  });
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (!grouped || !cats.length) return;

  // ---- the strip: selection, tooltips, and the ring ------------------------

  // RAIL OR SELECTOR is the kit's W1 category navigation (kit/categoryNav.js,
  // CategoryNavModel): the same component, model and budget as every other
  // categorized W1 surface. It adopts the `.set-tabs` rail drawn above, puts
  // the `[Section ▾]` selector (`.set-cat-select`) before it, and Escape with
  // its list open closes the list, not Settings. `data-settings-nav` and
  // `data-nav-open` mirror its state for the instruments that read them.
  const railed = container.querySelector('.set-railed');
  railed.dataset.catNav = 'selector';
  railed.dataset.settingsNav = 'selector';
  placeAdvancedNavigation('selector');
  const rail = container.querySelector('.set-tabs');
  rail.setAttribute('aria-orientation', 'horizontal');
  nav = { start: () => rail.querySelector('[aria-selected="true"]'), release() {} };
  rail.querySelectorAll('.set-tab').forEach(tab => {
    tab.addEventListener('click', () => selectCategory(tab.dataset.member));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? cats[0] : event.key === 'End' ? cats.at(-1)
        : stepCategory(cats, current, event.key === 'ArrowRight' ? 1 : -1);
      selectCategory(next);
      nav.start()?.focus();
    });
  });

  function selectCategory(cat) {
    const searching = !!searchQuery();
    if (!cats.includes(cat) || (cat === current && !searching)) return;
    if (searching) headerTools.querySelector('[data-advanced-search]').value = '';
    current = cat;
    settings[CAT_KEY] = cat;
    // Persisted through the same free bag every other setting rides in
    // (`meta.settings`) — no save-schema change. IN COMBAT IT DOES NOT PERSIST
    // and cannot: that mount passes a synthetic meta with no onChange, so the
    // choice is per-mount there. Stated, not hidden — and not new: the armoury
    // view has always been per-mount at that same call site.
    onChange({ [CAT_KEY]: cat });
    container.querySelectorAll('.set-tab').forEach((b) => {
      const on = b.dataset.member === cat;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-selected', String(on));
    });
    // A tab switch is a new screenful: repaintPanel starts it at the top, or
    // the player lands mid-way down a section they have never seen.
    repaintPanel();
  }

  // Selection is the nav's `choose`; a pick from the opened selector list
  // closes it and hands focus back to the selector, which now names the pick.
  container.querySelectorAll('.set-tab').forEach((b) => {
    // Law 3 clause 4: hover AND the pad/keyboard focus cursor. `title=` alone
    // does not satisfy it — touch and gamepad players never see one.
    attachTooltip(b, () => `<b>${esc(categoryLabel(b.dataset.member))}</b><br>${esc(categoryTip(b.dataset.member))}`);
  });

  // Law 3 clauses 1 + 1a: RB → next, LB → previous, wrap at BOTH ends, over the
  // same set in the same order. The ring is the `cats` array — one order, and
  // the widget is not consulted.
  //
  // CLAIMED ONLY IF FREE. See hasTabRing() in input.js for the ruling: on the
  // in-run overlay this strip sits INSIDE another tab set, and the bumpers stay
  // with the outer one so RB never changes meaning between two tabs of the same
  // menu. Nothing is passed in; the answer is derived from whether a ring is
  // already held.
  if (!hasTabRing()) {
    claimedRing = true;
    const step = (d) => selectCategory(stepCategory(cats, current, d));
    setTabRing({ prev: () => step(-1), next: () => step(1) });
  }
  return { nav };
}

/**
 * showSettingsNotice(msg) — say something in the open Settings modal. Exists so
 * a refused write can answer instead of being a silent no-op (#67); no-op when
 * Settings is not open.
 */
export function showSettingsNotice(msg, tag = '') {
  // BOTH doors. This used to look only for the modal's own body, so on the
  // in-run overlay it would have been a silent no-op — the very defect it
  // exists to fix, one layer down (#67, Sunna's D18). renderSettings marks
  // whatever container it filled, so the notice lands wherever Settings is.
  const host = document.querySelector('[data-settings-host]');
  // RETURNS WHETHER IT SPOKE, because one caller — the late clipboard landing —
  // has to know: its news arrives after its panel may have closed, and a false
  // here is what sends it to the deferred slot instead of nowhere.
  if (!host) return false;
  let el = host.querySelector('.set-notice');
  if (!el) {
    el = document.createElement('p');
    el.className = 'set-notice';
    el.setAttribute('role', 'status');
    host.prepend(el);
  }
  el.textContent = msg;
  if (tag) el.dataset.noticeTag = tag; else delete el.dataset.noticeTag;
  return true;
}

/**
 * Withdraw a notice this caller put up, and only that one.
 *
 * A refusal that has since been resolved must stop being announced — a slider
 * moved back into a valid ladder left "the authored sizes are in use" standing
 * while the tuned sizes were in force. Clearing unconditionally would wipe
 * whatever else had spoken last, so a notice carries its owner's tag and only
 * its owner can take it down.
 */
export function clearSettingsNotice(tag) {
  const host = document.querySelector('[data-settings-host]');
  const el = host?.querySelector('.set-notice');
  if (el && el.dataset.noticeTag === tag) {
    el.textContent = '';
    delete el.dataset.noticeTag;
  }
}

function settingsHeaderTools() {
  const tools = document.createElement('div');
  tools.className = 'set-header-tools';
  tools.innerHTML = '<input hidden type="search" data-advanced-search aria-label="Find a setting" placeholder="Find a setting…">'
    + '<button type="button" class="as-btn set-changed-toggle" data-changed-toggle aria-pressed="false" title="Show only the settings you have changed">Changed</button>'
    + '<button type="button" class="as-btn set-search-toggle" data-search-toggle aria-label="Search settings" aria-expanded="false" title="Search settings"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg></button>'
    + '<details class="set-options"><summary class="as-btn" aria-label="Settings options" title="Settings options"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></summary><div class="set-options-menu">'
    + '<button type="button" class="as-btn" data-reset-config="group">Reset this group</button><button type="button" class="as-btn" data-reset-config="all">Reset all settings</button>'
    + (pageDebug() ? '<button type="button" class="as-btn" data-export-settings>Export configuration</button>'
      : '<button type="button" class="as-btn" data-clear-tuning hidden>Clear hidden tuning</button>') + '</div></details>';
  const exportItem = tools.querySelector('[data-export-settings]');
  // Import and export are debug tools (owner, 2026-09-24): a release build has
  // neither the menu item, the Load button, nor the export prompt on Done.
  if (exportItem) exportItem.onclick = () => saveAdvancedConfigFile(panelSettings || {}, {
    build: { contentVersion: contentBundle.version },
    includeKeys: ROWS.filter(row => !CONTROL_ROW_TYPES.has(row.type)).map(row => row.key),
  });
  return tools;
}

// `onOffline` was destructured here and then dropped: both renderSettings calls
// below left it out, so main.js handed this door `showOfflinePlay` and the
// title screen's Settings never grew the button it opens. The changelog for
// #1213 promises Download & saves "from Title or Settings", and only one of
// those two was telling the truth. It is forwarded now, and lands in the same
// one-row bar the in-run overlay uses.
export function openSettings({ meta, onChange, saves = null, onOffline = null, previewAttributes = null, previewLevel = null }) {
  const settings = meta.settings || (meta.settings = {});
  // ONE DOOR-OPENER (kit §09): the shell owns veil, head, foot and dismissal;
  // this surface owns only the body, which is the NavRail + Pane it always was.
  const done = button({ label: 'Done and Save', weight: 'primary', id: 'set-close' });
  const load = button({ label: 'Load settings', id: 'settings-load' });
  const headerTools = settingsHeaderTools();
  // W1a header: the title and the exit, nothing above them. The old eyebrow
  // ("Title") named the door it was opened from, which W1a does not carry.
  let rendered = null;
  const door = openModal({
    size: 'lg',
    className: 'settings-modal',
    titleId: 'settings-modal-title',
    title: t('settings.title'),
    closeLabel: t('settings.close'),
    bodyClassName: 'set-body',
    body: (host) => { rendered = renderSettings(host, { settings, onChange, saves, onOffline, headerTools, previewAttributes, previewLevel }); },
    secondary: pageDebug() ? [load] : [],
    primary: done,
    footSize: 'short',
  });
  door.head.querySelector('.modal-head-actions').prepend(headerTools);
  const picker = document.createElement('input');
  picker.type = 'file'; picker.accept = '.json,application/json'; picker.hidden = true;
  load.after(picker);
  load.addEventListener('click', () => { picker.value = ''; picker.click(); });
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Choose a file smaller than 1 MB.');
      const warnings = [];
      const changes = parseAdvancedConfigFile(await file.text(), contentBundle, settings, ROWS, warnings);
      if (onChange(changes)?.ok === false) throw new Error('Settings could not be saved.');
      Object.assign(settings, changes);
      rendered = renderSettings(door.body, { settings, onChange, saves, onOffline, headerTools, previewAttributes, previewLevel });
      showSettingsNotice(warnings.length ? `Settings loaded. ${warnings.join(' ')}` : 'Settings loaded.');
    } catch (error) { showSettingsNotice(`Import failed: ${error.message}`); }
  });
  done.addEventListener('click', () => {
    if (!applyPendingFormationSettings(door.body)) return;
    if (!pageDebug() || settings.promptSettingsExport === false) { door.close(); return; }
    const exportButton = button({ label: 'Export configuration', weight: 'primary' });
    const skip = button({ label: 'Not now' });
    const body = document.createElement('div');
    body.innerHTML = '<p>Your settings are saved. Export a configuration file to keep a backup?</p>'
      + '<label class="set-export-choice"><input type="checkbox" checked> Ask when I press Done and Save</label>';
    body.querySelector('input').addEventListener('change', event => {
      settings.promptSettingsExport = event.target.checked;
      onChange({ promptSettingsExport: event.target.checked });
    });
    const prompt = openModal({ size: 'sm', title: 'Export configuration?', bodyClassName: 'set-export-body', body, primary: exportButton, secondary: [skip] });
    skip.addEventListener('click', () => { prompt.close(); door.close(); });
    exportButton.addEventListener('click', async () => {
      exportButton.disabled = true;
      const result = await saveAdvancedConfigFile(panelSettings || settings, {
        build: { contentVersion: contentBundle.version },
        includeKeys: ROWS.filter(row => !CONTROL_ROW_TYPES.has(row.type)).map(row => row.key),
      });
      exportButton.disabled = false;
      if (result.ok) { prompt.close(); door.close(); }
      else exportButton.textContent = 'Try export again';
    });
  });
  // The selected tab on a rail; the [Section ▾] selector on a compact host.
  (rendered?.nav?.start() || door.veil.querySelector('#set-close'))?.focus({ preventScroll: true });
}
