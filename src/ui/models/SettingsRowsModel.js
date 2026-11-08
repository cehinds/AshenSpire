// src/ui/models/SettingsRowsModel.js — the settings row table, as data.
//
// Every row the Settings screen draws is declared here (SETTINGS_ROWS) or
// derived here from content (the authored advanced-config rows, the wireframe
// choice catalogue, the grace-refill table). The screen, src/ui/screens/
// settings.js, reads this table and draws it; nothing in here touches the DOM.
// The hooks a row carries (`note`, `applied`, `choiceDisabled`) are plain
// functions of the settings bag that return text or markup strings.

import { balance } from '../../content/balance.js';
import { cardLevels, cardWidthBounds } from './CardSizeModel.js';
import { liveAdvancedConfigRows } from '../../model/advancedConfig.js';
import { contentBundle } from '../../content/index.js';
import { t, tFull } from '../strings.js';
import { WIREFRAME_CHOICE_GROUPS } from './WireframeChoiceModel.js';
import { flaskSlotCap, graceRefillTable, graceRefillLadder, firstFlaskOfKind } from '../../model/gracerefill.js';
import { esc } from '../kit/index.js';
import { flasks } from '../../content/flasks.js';
import { COMBAT_LOG_PALETTE_DEFAULTS } from './CombatLogPaletteModel.js';
import { rangeSettingsRows } from './RangeSettingsModel.js';
import { tooltipSettingsRows } from '../../model/tooltipSettings.js';
import { AUTOMATION_DEFAULTS, ACTION_PACING } from '../../model/autoCombatPolicy.js';
import { resolveMotionIdle } from '../performance.js';
import { TITLE_ENTRANCE_TIMING } from './StartupGateModels.js';
import { MAP_ZOOM_DEFAULT, ZOOM_STEPS, MAP_FREE_PAN_DEFAULT } from '../../model/map/mapview.js';
import { MAP_MODE_DEFAULT, MAP_MODES, SHRINE_GLOW_DEFAULT } from '../../model/map/mapknowledge.js';
import { VICTORY_XP_DEFAULTS } from '../../model/victoryXpPresentation.js';
import { ART_QUALITY_KEY, ART_AUTO, ART_QUALITY_CHOICES, LEGACY_ART_QUALITY } from '../highResArt.js';
import { tierChoiceDisabled } from '../artTier.js';
import { CARD_ART_STYLE_KEY, CARD_ART_SIMPLE, CARD_ART_STYLE_CHOICES } from '../cardArtStyle.js';
import { LORE_TYPE_DEFAULTS, LORE_FACES, LEGACY_LORE_FACES, LORE_SIZES, LORE_LEADING, LORE_TRACKING, LORE_SLANTS } from './LoreTypeModel.js';
import { offlinePlay } from '../../content/offlinePlay.js';
import { HUD_VISIBILITY_SETTINGS } from './HudVisibilityModel.js';
import { AUDIO_DEFAULTS, resolveMusicEnabled } from '../audio.js';
import { HAPTICS_DEFAULT_ON } from '../../content/haptics.js';
import { deckRules } from '../../content/deckRules.js';

// ---- hooks the screen supplies -----------------------------------------------
//
// A few rows carry a line that needs the live page (the Art quality status reads
// the tier loader, Interface scale reads --ui-zoom) or a resolver that is the
// screen's own export. They cannot live in a model that never touches the DOM,
// so the screen hands them over once at load (bindSettingsRowHooks) and each row
// calls through. The row's shape is unchanged: `note` and `applied` are still
// functions of (settings, row).
const hooks = {};
export function bindSettingsRowHooks(supplied) { Object.assign(hooks, supplied); }

const EQ_DEFAULTS = balance.equipment;
const LEVEL_DEFAULTS = balance.levelUp || {};
export const UI_DEFAULTS = balance.ui;
// The card's authored sizes, so the rows below state a DEFAULT they read
// rather than a number typed twice. content/config/ui/components/card.json is
// the one home; these rows lay a tuning override over it.
const CARD_LEVELS = cardLevels();
// The same authored range the model clamps to, so the control and the width it
// produces cannot disagree about what is in bounds.
const CARD_WIDTH_BOUNDS = cardWidthBounds();
// `retired: true` is a row that keeps its KEY so an exported configuration
// still imports and still applies, and stays off the screen because nothing a
// player can reach depends on it — today, the creation pools of the modes
// `characterCreation.visibleModeIds` does not offer. The screen showed three
// near-identical "starting stat pool" rows for one reachable pool; this is the
// line that stops that. parseAdvancedConfigFile reads advancedConfigRows()
// directly, so import is unaffected.
// Only the opening and presentation rows are still settings (cleanup row 3e):
// Core 2 reads none of the legacy mechanics rows advancedConfig.js still generates
// for the content-bundle path.
const authoredAdvancedRows = liveAdvancedConfigRows(contentBundle);
const ADVANCED_CONFIG_ROWS = authoredAdvancedRows.filter((row) => !row.retired)
  .map((row) => (row.uiTextId ? { ...row, label: t(row.uiTextId), note: tFull(row.uiTextId) } : row));

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
// (models/AdvancedSettingsGroups.js): the group's stable id, which is also what
// `settingsAdvancedSubgroup.Wireframes` stores. `wireframeTopicLabel` is the
// rewordable uiStrings label the topic tab wears, and only that (Codex, #1489).
function wireframeChoiceRows() {
  return WIREFRAME_CHOICE_GROUPS.flatMap((group) => group.choices.map((choice) => ({
    cat: 'Advanced',
    advancedGroup: 'Wireframes',
    wireframeTopic: group.id,
    wireframeTopicLabel: group.label,
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
  for (const r of SETTINGS_ROWS) {
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

export const SETTINGS_ROWS = [
  { cat: 'Combat', key: 'askToUpcastAfterTarget', type: 'toggle', def: false, label: t('settings.row.askToUpcastAfterTarget'),
    note: tFull('settings.row.askToUpcastAfterTarget') },
  { cat: 'Combat', key: 'combatLogConsole', type: 'toggle', def: false, label: t('settings.row.combatLogConsole'),
    note: tFull('settings.row.combatLogConsole') },
  { cat: 'Combat', key: 'combatLogPlayerColor', type: 'color', def: COMBAT_LOG_PALETTE_DEFAULTS.player,
    label: t('settings.row.combatLogPlayerColor'), note: tFull('settings.row.combatLogPlayerColor') },
  { cat: 'Combat', key: 'combatLogEnemyColor', type: 'color', def: COMBAT_LOG_PALETTE_DEFAULTS.enemy,
    label: t('settings.row.combatLogEnemyColor'), note: tFull('settings.row.combatLogEnemyColor') },
  ...rangeSettingsRows(),
  ...tooltipSettingsRows(),
  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: t('settings.row.fullscreen'),
    note: tFull('settings.row.fullscreen') },
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
  { cat: 'Combat', key: 'useSprites', def: true, label: t('settings.row.useSprites'),
    note: tFull('settings.row.useSprites') },
  { cat: 'Combat', key: 'autoCombat', def: AUTOMATION_DEFAULTS.autoCombat, label: t('settings.row.autoCombat'),
    note: tFull('settings.row.autoCombat') },
  { cat: 'Combat', key: 'combatSpeed', type: 'number', def: AUTOMATION_DEFAULTS.combatSpeed,
    min: AUTOMATION_DEFAULTS.speedMinimum, max: AUTOMATION_DEFAULTS.speedMaximum, step: 0.25, integer: false, label: t('settings.row.combatSpeed'),
    note: tFull('settings.row.combatSpeed') },
  { cat: 'Combat', key: 'combatPreference', type: 'choice', def: AUTOMATION_DEFAULTS.combatPreference,
    choices: ['offense', 'defense'], label: t('settings.row.combatPreference'), note: tFull('settings.row.combatPreference') },
  { cat: 'Combat', key: 'autoCombatSpeed', type: 'number', def: AUTOMATION_DEFAULTS.autoCombatSpeed,
    min: AUTOMATION_DEFAULTS.autoSpeedMinimum, max: AUTOMATION_DEFAULTS.autoSpeedMaximum, step: 0.25, integer: false, label: t('settings.row.autoCombatSpeed'),
    note: tFull('settings.row.autoCombatSpeed') },
  { cat: 'Combat', key: 'combatStepPause', type: 'number', def: ACTION_PACING.stageGapMs,
    min: AUTOMATION_DEFAULTS.stageGapMinimumMs, max: AUTOMATION_DEFAULTS.stageGapMaximumMs, step: 250, label: t('settings.row.combatStepPause'),
    note: tFull('settings.row.combatStepPause') },
  { cat: 'Combat', key: 'animationStepDuration', type: 'number', def: ACTION_PACING.animationStepDefaultMs,
    min: AUTOMATION_DEFAULTS.animationStepMinimumMs, max: AUTOMATION_DEFAULTS.animationStepMaximumMs, step: 25,
    label: t('settings.row.animationStepDuration'), note: tFull('settings.row.animationStepDuration') },
  // Owner 2026-11-06: the enemy's pacing is separate from the player's (both default 750 ms).
  { cat: 'Combat', key: 'enemyAttackMs', type: 'number', def: ACTION_PACING.enemyAttackDefaultMs,
    min: AUTOMATION_DEFAULTS.enemyPacingMinimumMs, max: AUTOMATION_DEFAULTS.enemyPacingMaximumMs, step: 50,
    label: t('settings.row.enemyAttackMs'), note: tFull('settings.row.enemyAttackMs') },
  { cat: 'Combat', key: 'enemyFloaterIntervalMs', type: 'number', def: ACTION_PACING.enemyFloaterIntervalDefaultMs,
    min: AUTOMATION_DEFAULTS.enemyPacingMinimumMs, max: AUTOMATION_DEFAULTS.enemyPacingMaximumMs, step: 50,
    label: t('settings.row.enemyFloaterIntervalMs'), note: tFull('settings.row.enemyFloaterIntervalMs') },
  { cat: 'Combat', key: 'combatPacingPreset', type: 'choice', def: 'custom', choices: ['custom', 'mobile-fast'],
    label: t('settings.row.combatPacingPreset'), note: tFull('settings.row.combatPacingPreset') },
  { cat: 'Combat', key: 'animSpeed', type: 'choice', def: 'auto',
    choices: ['auto', 'slow', 'normal', 'fast', 'instant'], label: t('settings.row.animSpeed'),
    note: tFull('settings.row.animSpeed') },
  // RENDERING QUALITY FOLDED INTO EFFECTS (owner, 2026-10-30). The key stays so a
  // settings file that names it still imports; ui/performance.js reads a saved
  // 'full' once as `effects: true` (migrateEffectsSetting).
  { cat: 'Combat', key: 'performanceMode', type: 'choice', def: 'auto', retired: true,
    choices: ['auto', 'full', 'lite'], label: t('settings.row.performanceMode'),
    note: tFull('settings.row.performanceMode') },
  // EFFECTS (default OFF) turns the decoration on: animated stance glow, hit sparks
  // and flashes, card motion, blur and shadows, live-tracking bars. Off stays fully
  // informative. The four fighter-motion rows are independent of it (default ON).
  { cat: 'Combat', key: 'effects', def: false, label: t('settings.row.effects'),
    note: tFull('settings.row.effects') },
  { cat: 'Combat', key: 'motionAttack', def: true, label: t('settings.row.motionAttack'), selfEvident: true,
    note: tFull('settings.row.motionAttack') },
  { cat: 'Combat', key: 'motionHit', def: true, label: t('settings.row.motionHit'), selfEvident: true,
    note: tFull('settings.row.motionHit') },
  { cat: 'Combat', key: 'motionIdle', def: true, resolve: resolveMotionIdle, label: t('settings.row.motionIdle'), selfEvident: true,
    note: tFull('settings.row.motionIdle') },
  { cat: 'Combat', key: 'motionDefeat', def: true, label: t('settings.row.motionDefeat'), selfEvident: true,
    note: tFull('settings.row.motionDefeat') },
  { cat: 'Display', key: 'titleCityHold', type: 'choice', def: TITLE_ENTRANCE_TIMING.holdDefault,
    choices: Object.keys(TITLE_ENTRANCE_TIMING.holdDurations), label: t('settings.row.titleCityHold'),
    note: tFull('settings.row.titleCityHold') },
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
    choices: ['Fit', ...ZOOM_STEPS.map((z) => String(Math.round(z * 100)))], label: t('settings.row.mapZoom'),
    note: tFull('settings.row.mapZoom') },
  // THE FOG A/B, and it sits HERE rather than in Custom Climb — Marina's ruling,
  // reversed from Custom Climb on the argument that Settings is the only surface
  // reachable WHILE YOU ARE LOOKING AT THE THING YOU ARE JUDGING. Fog cannot be
  // A/B'd mid-run: once you have seen the map you cannot unsee it. So the
  // comparison is Custom Climb's existing seed field plus this row — same seed,
  // same act, two readings — and Custom Climb grows nothing new.
  //
  // DEFAULT IS `fog` since 2026-08-08 — his word, and the one token is in
  // model/map/mapknowledge.js so this row cannot disagree with the resolver.
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
    choices: MAP_MODES, label: t('settings.row.mapMode'),
    note: tFull('settings.row.mapMode') },
  // HIS OWN PARENTHESIS, AS ONE ROW — "as new paths open, the path to the
  // nearest shrine should have a glowing effect. (make this toggleable in the
  // settings)". He scoped the switch himself in the same sentence that asked
  // for the effect, so the row exists whatever anyone thinks the glow needs.
  // `def` is the resolver's own const (model/map/mapknowledge.js) rather than a
  // second `true` typed here — the row three above learned that lesson with the
  // zoom ladder.
  // E13 (#258), his words: "a toggle for multi-use rest stops". OFF is the
  // shipped Shrine — Rest or Smith, and taking either leaves. ON keeps the
  // Shrine open: Rest once, Smith while you have Stones, Level while you have
  // cinders, and leave when you choose. On by default (owner's uploaded
  // configuration, #1254).
  { cat: 'Advanced', advancedGroup: 'World', key: 'shrineMultiUse', def: true, label: t('settings.row.shrineMultiUse'),
    note: tFull('settings.row.shrineMultiUse') },
  // A SETTING, NOT A SWITCH IN THE FLOW. The creation screen's Starting
  // equipment head carried an "Auto-advance on valid choice" toggle beside
  // the List/Grid control — a preference standing in the middle of a decision
  // (review, 2026-09-11). It lives here with the other Gameplay preferences;
  // the screen reads it the way it reads every other display setting. OFF
  // matches the shipped creation layout (content/source/characterCreation.json
  // `equipmentAutoAdvance`), which stays the screen's fallback when no
  // settings bag reaches it.
  { cat: 'Advanced', advancedGroup: 'Progression', key: 'creationAutoAdvance', def: false, label: t('settings.row.creationAutoAdvance'),
    note: tFull('settings.row.creationAutoAdvance') },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'victorySummaryMode', type: 'choice', def: 'continue',
    choices: ['continue', 'anywhere', 'auto'], choiceLabels: { continue: t('common.continue'), anywhere: 'Click anywhere', auto: 'Expand automatically' },
    label: t('settings.row.victorySummaryMode'), note: tFull('settings.row.victorySummaryMode') },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'victoryReceiptSeconds', type: 'number', def: VICTORY_XP_DEFAULTS.seconds, min: 0, max: 12, step: 0.1,
    label: t('settings.row.victoryReceiptSeconds'), note: tFull('settings.row.victoryReceiptSeconds') },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'victoryReceiptPauseMs', type: 'number', def: VICTORY_XP_DEFAULTS.pauseMs, min: 0, max: 500, step: 10,
    label: t('settings.row.victoryReceiptPauseMs'), note: tFull('settings.row.victoryReceiptPauseMs') },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'victoryReceiptReadySeconds', type: 'number', def: VICTORY_XP_DEFAULTS.readySeconds, min: 0, max: 5, step: 0.1,
    label: t('settings.row.victoryReceiptReadySeconds'), note: tFull('settings.row.victoryReceiptReadySeconds') },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'victoryReceiptFormulaTerms', type: 'number', def: VICTORY_XP_DEFAULTS.formulaTerms, min: 1, max: 20, step: 1,
    label: t('settings.row.victoryReceiptFormulaTerms'), note: tFull('settings.row.victoryReceiptFormulaTerms') },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'victoryReceiptVisibleRows', type: 'number', def: VICTORY_XP_DEFAULTS.visibleRows, min: 2, max: 8, step: 1,
    label: t('settings.row.victoryReceiptVisibleRows'), note: tFull('settings.row.victoryReceiptVisibleRows') },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'victoryXpSeconds', type: 'number', def: 3, min: 0, max: 12, step: 0.25,
    label: t('settings.row.victoryXpSeconds'), note: tFull('settings.row.victoryXpSeconds') },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'rewardLevelStatPoints', def: true, label: t('settings.row.rewardLevelStatPoints'),
    note: tFull('settings.row.rewardLevelStatPoints') },
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'rewardLevelCards', def: false, label: t('settings.row.rewardLevelCards'),
    note: tFull('settings.row.rewardLevelCards') },
  { cat: 'Display', key: 'shrinePathGlow', def: SHRINE_GLOW_DEFAULT, label: t('settings.row.shrinePathGlow'),
    note: tFull('settings.row.shrinePathGlow') },
  // The map's Potions control and the run HUD read this on every profile
  // (components/runPotions.js, components/runHud.js) and the map's refusal points
  // the player at Settings, so it lives with the Map & HUD preferences every build
  // shows (Rewards is retired on Core 2 and hidden on release builds).
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'useRestorativeFlasksOutsideCombat', def: true, label: t('settings.row.useRestorativeFlasksOutsideCombat'),
    note: tFull('settings.row.useRestorativeFlasksOutsideCombat') },
  // How strongly the nodes already walked fade behind you — his clause, with
  // his number as the default and the customization he asked for as the row
  // (D17 message 4: "previous nodes shoudl be faded, maybe 50% saturation or
  // higher (settings for customization)"). The ladder itself is CSS
  // (styles/map.css, keyed on data-walked-fade); this row only picks the rung.
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'walkedFade', type: 'choice', def: 'half',
    choices: ['off', 'subtle', 'half', 'strong'], label: t('settings.row.walkedFade'),
    note: tFull('settings.row.walkedFade') },
  // `selfEvident`: W1a shows help only where the effect is not obvious. The
  // note stays on the row as the one place the sentence lives; it is not drawn.
  { cat: 'Display', key: 'accent', type: 'choice', def: 'gold', selfEvident: true,
    choices: ['gold', 'crimson', 'frost', 'verdant', 'violet'], label: t('settings.row.accent'),
    note: tFull('settings.row.accent') },
  // ART QUALITY (LFS / art-tier plan, step 4, 2026-09-26; Auto / Light / High,
  // docs/EXTERNAL-ASSETS-PLAN.md step 8c). Auto, Light and High choose which
  // pack the web edition loads (src/ui/artTier.js); a single file carries its
  // light art inside it, so there Light and High are disabled and the live line
  // says why. Local high-res lays full-resolution files from this device over
  // Auto's tier (src/ui/highResArt.js); anything the folder lacks stays
  // built-in. 'Built-in', the old default, reads as Auto. A per-device key
  // (LOCAL_ONLY_KEYS, never synced): a folder here means nothing on another device.
  { cat: 'Display', key: ART_QUALITY_KEY, type: 'choice', def: ART_AUTO,
    choices: ART_QUALITY_CHOICES, choiceLabels: { [ART_AUTO]: t('settings.viewPreset.auto') }, legacyChoices: LEGACY_ART_QUALITY, choiceDisabled: tierChoiceDisabled, describedBy: 'set-artQuality-tier',
    label: t('settings.row.artQuality'), applied: (settings, row) => hooks.artQualityHtml(settings, row),
    note: tFull('settings.row.artQuality') },
  { cat: 'Display', key: CARD_ART_STYLE_KEY, type: 'choice', def: CARD_ART_SIMPLE,
    choices: CARD_ART_STYLE_CHOICES, label: t('settings.row.cardArtStyle'),
    note: tFull('settings.row.cardArtStyle') },
  { cat: 'Display', key: 'viewPreset', type: 'choice', def: 'auto', dropdown: true,
    choices: ['auto', 'desktop', 'mobile', 'widescreen', 'tablet'],
    choiceLabels: Object.fromEntries(['auto', 'desktop', 'mobile', 'widescreen', 'tablet'].map(id => [id, t(`settings.viewPreset.${id}`)])),
    label: t('settings.row.viewPreset'), note: tFull('settings.row.viewPreset') },
  { cat: 'Display', key: 'uiScale', type: 'choice', def: 'Auto',
    choices: ['Auto', 'S', 'M', 'L', 'XL'], choiceLabels: { Auto: t('settings.viewPreset.auto') }, label: t('settings.row.uiScale'), applied: (settings, row) => hooks.appliedHtml(settings, row),
    note: tFull('settings.row.uiScale') },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'cardMotif', type: 'choice', def: UI_DEFAULTS.cardMotif,
    choices: UI_DEFAULTS.cardMotifModes, label: t('settings.row.cardMotif'),
    note: tFull('settings.row.cardMotif') },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'cardMotifStrength', type: 'choice', def: 'normal', selfEvident: true,
    choices: ['subtle', 'normal', 'strong'], label: t('settings.row.cardMotifStrength'),
    note: tFull('settings.row.cardMotifStrength') },
  // CARD LORE TYPE (owner, 2026-09-23): "make it configurable in the advanced
  // settings for text related things, with sub options for flavor text". The
  // lists and defaults live in models/LoreTypeModel.js, which also stamps the
  // answer on <html>. Interface text size and readable headings stay in
  // General → Accessibility, their one home; the tab's tip says so.
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Flavor text', key: 'loreFace', type: 'choice', def: LORE_TYPE_DEFAULTS.loreFace,
    choices: LORE_FACES.map((face) => face.id), choiceLabels: Object.fromEntries(LORE_FACES.map((face) => [face.id, face.label])),
    legacyChoices: LEGACY_LORE_FACES, label: t('settings.row.loreFace'),
    note: tFull('settings.row.loreFace') },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Flavor text', key: 'loreSize', type: 'choice', def: LORE_TYPE_DEFAULTS.loreSize,
    choices: LORE_SIZES, label: t('settings.row.loreSize'),
    note: tFull('settings.row.loreSize') },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Lore window', key: 'loreLeading', type: 'choice', def: LORE_TYPE_DEFAULTS.loreLeading,
    choices: LORE_LEADING, label: t('settings.row.loreLeading'), selfEvident: true,
    note: tFull('settings.row.loreLeading') },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Flavor text', key: 'loreTracking', type: 'choice', def: LORE_TYPE_DEFAULTS.loreTracking,
    choices: LORE_TRACKING, label: t('settings.row.loreTracking'), selfEvident: true,
    note: tFull('settings.row.loreTracking') },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Lore window', key: 'loreSlant', type: 'choice', def: LORE_TYPE_DEFAULTS.loreSlant,
    choices: LORE_SLANTS, label: t('settings.row.loreSlant'), selfEvident: true,
    note: tFull('settings.row.loreSlant') },
  { cat: 'Advanced', advancedGroup: 'Text', textTopic: 'Flavor text', key: 'loreIdentitySlant', type: 'choice', def: LORE_TYPE_DEFAULTS.loreIdentitySlant,
    choices: LORE_SLANTS, label: t('settings.row.loreIdentitySlant'), selfEvident: true,
    note: tFull('settings.row.loreIdentitySlant') },
  { cat: 'Combat', key: 'screenShake', def: true, label: t('settings.row.screenShake'), selfEvident: true,
    note: tFull('settings.row.screenShake') },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'ambient', type: 'choice', def: 'normal',
    choices: ['off', 'low', 'normal', 'high'], label: t('settings.row.ambient'),
    note: tFull('settings.row.ambient') },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'controlHints', def: true, label: t('settings.row.controlHints'),
    note: tFull('settings.row.controlHints') },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'mapFreePan', def: MAP_FREE_PAN_DEFAULT, label: t('settings.row.mapFreePan'),
    note: tFull('settings.row.mapFreePan') },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'mapHeaderDensity', type: 'choice', def: 'compact',
    choices: ['comfortable', 'compact'], label: t('settings.row.mapHeaderDensity'),
    note: tFull('settings.row.mapHeaderDensity') },
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'mapHeaderRelics', def: true, label: t('settings.row.mapHeaderRelics'), selfEvident: true,
    note: tFull('settings.row.mapHeaderRelics') },
  // RETIRED (owner, 2026-09-23). The solo map header never draws the seed —
  // the header model receives it and prints nothing — and the co-op header's
  // `.mh-seed` has no rule under the `hide-header-seed` class main.js sets, so
  // this switch moved nothing anywhere. The key stays so a settings file that
  // names it still imports.
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'mapHeaderSeed', def: false, label: t('settings.row.mapHeaderSeed'), selfEvident: true, retired: true,
    note: tFull('settings.row.mapHeaderSeed') },
  // Short-screen warning is optional on narrow landscape screens.
  { cat: 'Advanced', advancedGroup: 'Interface', key: 'uprightGate', def: false, label: t('settings.row.uprightGate'),
    note: tFull('settings.row.uprightGate') },

  { cat: 'Display', key: 'quickNav', type: 'choice', def: 'mirror',
    choices: ['off', 'mirror', 'switcher'], label: t('settings.row.quickNav'),
    note: tFull('settings.row.quickNav') },
  // One visible door to Reset all (owner, 2026-10-04): the ⋮ menu item is easy
  // to miss. Both doors ask first through confirmResetAll. Last in Interface on
  // purpose: tools/displayfirst.mjs plants expect fullscreen then accent first.
  // The only door to Download & saves from Settings now the top action row is
  // gone (owner, 2026-10-26); it opens the same panel the row used to.
  { cat: 'Display', key: 'downloadSaves', id: 'settings-download', type: 'button', btn: offlinePlay.title, label: t('settings.row.downloadSaves'),
    note: tFull('settings.row.downloadSaves') },
  { cat: 'Display', key: 'resetAllSettings', type: 'button', btn: `${t('settings.resetAll.confirm')}…`, label: t('settings.row.resetAllSettings'),
    note: tFull('settings.row.resetAllSettings') },

  { cat: 'Combat', key: 'armamentsPresentation', type: 'choice', def: 'radial',
    choices: ['radial', 'fixed'], label: t('settings.row.armamentsPresentation'),
    note: tFull('settings.row.armamentsPresentation') },
  { cat: 'Combat', key: 'armamentsPhonePlacement', type: 'choice', def: 'left',
    choices: ['left', 'center', 'right'], label: t('settings.row.armamentsPhonePlacement'),
    note: tFull('settings.row.armamentsPhonePlacement') },

  { cat: 'Combat', key: 'showPlayedCard', def: false, label: t('settings.row.showPlayedCard'),
    note: tFull('settings.row.showPlayedCard') },

  { cat: 'Combat', key: 'manaRing', def: true, label: t('settings.manaRing'),
    note: t('settings.manaRing.note') },

  ...HUD_VISIBILITY_SETTINGS,

  { cat: 'Audio', key: 'musicEnabled', def: AUDIO_DEFAULTS.musicEnabled,
    resolve: resolveMusicEnabled, label: t('settings.row.musicEnabled'), note: (settings) => hooks.musicEnabledCondition(settings) },
  { cat: 'Audio', key: 'muteAudio', def: false, positiveWhen: false, label: t('settings.row.muteAudio'),
    note: tFull('settings.row.muteAudio') },
  { cat: 'Audio', key: 'musicVolume', type: 'range', def: AUDIO_DEFAULTS.musicVolume, label: t('settings.row.musicVolume'), selfEvident: true,
    note: tFull('settings.row.musicVolume') },
  { cat: 'Audio', key: 'sfxVolume', type: 'range', def: AUDIO_DEFAULTS.sfxVolume, label: t('settings.row.sfxVolume'), selfEvident: true,
    note: tFull('settings.row.sfxVolume') },
  { cat: 'Audio', key: 'haptics', def: HAPTICS_DEFAULT_ON, label: t('settings.row.haptics'),
    note: tFull('settings.row.haptics') },
  { cat: 'Advanced', advancedGroup: 'Export', debugTopic: true, key: 'musicFolder', type: 'text', def: '', label: t('settings.row.musicFolder'),
    placeholder: t('settings.row.musicFolder.placeholder'),
    note: tFull('settings.row.musicFolder') },

  { cat: 'Accessibility', key: 'touchFlickPlay', def: UI_DEFAULTS.touchFlick.enabled, label: t('settings.row.touchFlickPlay'),
    note: tFull('settings.row.touchFlickPlay') },
  { cat: 'Accessibility', key: 'touchFlickDistance', type: 'number', def: UI_DEFAULTS.touchFlick.distance.def,
    min: UI_DEFAULTS.touchFlick.distance.min, max: UI_DEFAULTS.touchFlick.distance.max, slider: true, practice: true, label: t('settings.row.touchFlickDistance'),
    note: tFull('settings.row.touchFlickDistance') },
  // Owner, 2026-10-18 14:15: "make sure I don't auto play a card when I click on it once"; 14:32: "keep the switch but make it default to not be 1 tap".
  // Off by default. On is an opt-in: a tap on a card with an unambiguous target
  // plays it. Off is select, then the next tap on the selected card.
  { cat: 'Accessibility', key: 'oneTapPlay', def: false, label: t('settings.row.oneTapPlay'),
    note: tFull('settings.row.oneTapPlay') },
  { cat: 'Accessibility', key: 'reducedMotion', def: false, label: t('settings.row.reducedMotion'),
    note: tFull('settings.row.reducedMotion') },
  // ON by default. Measured, not assumed: at the old default eight text targets
  // sat below the WCAG AA floor and the secondary buttons' own outlines sat at
  // 1.64:1 against a 3.0 floor. High contrast clears all of that and costs one
  // thing — see the note. `node tools/contrast-audit.mjs` re-runs the numbers.
  { cat: 'Accessibility', key: 'highContrast', def: true, label: t('settings.row.highContrast'),
    note: tFull('settings.row.highContrast') },
  { cat: 'Accessibility', key: 'textSize', type: 'choice', def: 'Auto',
    choices: ['Auto', 'S', 'L', 'XL'], choiceLabels: { Auto: t('settings.viewPreset.auto') }, label: t('settings.row.textSize'),
    note: tFull('settings.row.textSize') },
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
    choices: UI_DEFAULTS.tapSize.sizes.map(String), label: t('settings.row.tapFloor'),
    applied: (settings, row) => hooks.tapCostHtml(settings, row), resizesWhilePressed: true,
    note: tFull('settings.row.tapFloor') },
  { cat: 'Accessibility', key: 'colorblindSafe', def: false, label: t('settings.row.colorblindSafe'),
    note: tFull('settings.row.colorblindSafe') },
  { cat: 'Accessibility', key: 'reduceFlashes', def: false, label: t('settings.row.reduceFlashes'),
    note: tFull('settings.row.reduceFlashes') },
  { cat: 'Accessibility', key: 'readableHeadings', def: false, label: t('settings.row.readableHeadings'),
    note: tFull('settings.row.readableHeadings') },
  { cat: 'Advanced', advancedGroup: 'Export', debugTopic: true, key: 'debugMode', def: false, label: t('settings.row.debugMode'),
    note: tFull('settings.row.debugMode') },
  { cat: 'Advanced', advancedGroup: 'Export', debugTopic: true, key: 'commandLog', type: 'button', btn: 'Open', label: t('settings.row.commandLog'),
    note: tFull('settings.row.commandLog') },
  // E2 (#247): the recorded answer on the row — Sell is its own bar at the
  // merchant, conditional on THIS toggle, DEFAULT ON until he says otherwise,
  // and the bar is ABSENT (not greyed) when off. shop.js reads it through
  // settingOn so the default's polarity has one home, here. ONE ROW, appended
  // on purpose while another seat serializes this file for E3 — named in the
  // E2 claim (#247) so the touch is on the record, not smuggled.
  { cat: 'Advanced', advancedGroup: 'Rewards', key: 'shopSell', def: true, label: t('settings.row.shopSell'),
    note: tFull('settings.row.shopSell') },
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
    choices: Object.keys(UI_DEFAULTS.holdConfirm.steps), label: t('settings.row.holdConfirm'),
    // SHORT ON PURPOSE, and I measured why. My own ruling on the Map zoom row
    // tonight was that a long note plus a chip strip squeezes the text column
    // to a ribbon; the first draft of THIS note ran three sentences and took
    // the row to 216.9 px against 92.1 for Combat pacing. A rule I hold someone
    // else to on a Thursday holds on my own row on the same Thursday.
    note: tFull('settings.row.holdConfirm') },
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
    choices: UI_DEFAULTS.rewardCollect.modes, label: t('settings.row.rewardCollect'),
    note: tFull('settings.row.rewardCollect') },
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
    choices: (EQ_DEFAULTS.swapCostRules || []).map((r) => r.id), label: t('settings.row.swapCostRule'),
    // ONE SENTENCE PER RULE AND NO MORE, on the measurement in the row above:
    // a long note squeezes the text column beside a chip strip. Three chips,
    // three clauses.
    note: tFull('settings.row.swapCostRule') },
  // ---- HIS TWO LEVELLING DIALS (2026-08-17) --------------------------------
  //
  //   "leave the level up value configurable. also, let's make the increment of
  //    5 points for reasonable change be confurable as well. that way I can
  //    test each."
  //
  // ADVANCED, AND THE PRECEDENT IS HIS OWN SENTENCE TWO SETTINGS_ROWS UP: *"alternatively,
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
    def: CARD_LEVELS.glance.widthPx, min: CARD_WIDTH_BOUNDS.min, max: CARD_WIDTH_BOUNDS.max, slider: true, label: t('settings.row.cardWidth_glance'),
    note: tFull('settings.row.cardWidth_glance') },
  { cat: 'Advanced', advancedGroup: 'Wireframes', cardSizeTopic: true, key: 'cardWidth_glance_mobile', type: 'number',
    def: CARD_LEVELS.glance.variants.mobile, min: CARD_WIDTH_BOUNDS.min, max: CARD_WIDTH_BOUNDS.max, slider: true, label: t('settings.row.cardWidth_glance_mobile'),
    note: tFull('settings.row.cardWidth_glance_mobile') },
  { cat: 'Advanced', advancedGroup: 'Wireframes', cardSizeTopic: true, key: 'cardWidth_focus', type: 'number',
    def: CARD_LEVELS.focus.widthPx, min: CARD_WIDTH_BOUNDS.min, max: CARD_WIDTH_BOUNDS.max, slider: true, label: t('settings.row.cardWidth_focus'),
    note: tFull('settings.row.cardWidth_focus') },
  { cat: 'Advanced', advancedGroup: 'Wireframes', cardSizeTopic: true, key: 'cardWidth_inspect', type: 'number',
    def: CARD_LEVELS.inspect.widthPx, min: CARD_WIDTH_BOUNDS.min, max: CARD_WIDTH_BOUNDS.max, slider: true, label: t('settings.row.cardWidth_inspect'),
    note: tFull('settings.row.cardWidth_inspect') },
  { cat: 'Advanced', advancedGroup: 'Wireframes', cardSizeTopic: true, key: 'cardSizeExport', type: 'button', btn: t('common.copy'),
    label: t('settings.row.cardSizeExport'),
    note: tFull('settings.row.cardSizeExport') },
  { cat: 'Advanced', advancedGroup: 'Progression', key: 'levelUpValue', type: 'number', def: LEVEL_DEFAULTS.pointsPerLevel,
    min: LEVEL_DEFAULTS.pointsPerLevelMin, max: LEVEL_DEFAULTS.pointsPerLevelMax,
    label: t('settings.row.levelUpValue'), applied: (settings, row) => hooks.numberAppliedHtml(settings, row),
    note: tFull('settings.row.levelUpValue') },
  // THE DECK EDITOR'S RULES (SPEC §14.1, owner brief 2026-09-26). Each
  // default is content/deckRules.js — the one home; model/deckRules.js reads
  // the stored choice against the same object. Live settings, not gameConfig
  // rows: a change applies the next time the editor opens (and Play in deck
  // order at the next fight), never to a fight already under way.
  { cat: 'Advanced', advancedGroup: 'Deck', key: 'deckEditing', def: deckRules.defaults.deckEditing, label: t('settings.row.deckEditing'),
    note: tFull('settings.row.deckEditing') },
  { cat: 'Advanced', advancedGroup: 'Deck', key: 'deckEditingWhere', type: 'choice', dropdown: true, def: deckRules.defaults.deckEditingWhere,
    choices: [...deckRules.where], choiceLabels: { free: 'Free (anywhere out of combat)', restOnly: 'Rest sites only' },
    gates: [{ key: 'deckEditing' }], label: t('settings.row.deckEditingWhere'),
    note: tFull('settings.row.deckEditingWhere') },
  { cat: 'Advanced', advancedGroup: 'Deck', key: 'deckMinUnlimited', def: deckRules.defaults.deckMinUnlimited, label: t('settings.row.deckMinUnlimited'),
    gates: [{ key: 'deckEditing' }], note: tFull('settings.row.deckMinUnlimited') },
  { cat: 'Advanced', advancedGroup: 'Deck', key: 'deckMinSize', type: 'number', def: deckRules.defaults.deckMinSize, min: deckRules.sizeRange.min, max: deckRules.sizeRange.max,
    gates: [{ key: 'deckEditing' }, { key: 'deckMinUnlimited', when: false }], label: t('settings.row.deckMinSize'), applied: (settings, row) => hooks.numberAppliedHtml(settings, row),
    note: tFull('settings.row.deckMinSize') },
  { cat: 'Advanced', advancedGroup: 'Deck', key: 'deckMaxUnlimited', def: deckRules.defaults.deckMaxUnlimited, label: t('settings.row.deckMaxUnlimited'),
    gates: [{ key: 'deckEditing' }], note: tFull('settings.row.deckMaxUnlimited') },
  { cat: 'Advanced', advancedGroup: 'Deck', key: 'deckMaxSize', type: 'number', def: deckRules.defaults.deckMaxSize, min: Math.max(1, deckRules.sizeRange.min), max: deckRules.sizeRange.max,
    gates: [{ key: 'deckEditing' }, { key: 'deckMaxUnlimited', when: false }], label: t('settings.row.deckMaxSize'), applied: (settings, row) => hooks.numberAppliedHtml(settings, row),
    note: tFull('settings.row.deckMaxSize') },
  { cat: 'Advanced', advancedGroup: 'Deck', key: 'classSpellPowerCopies', type: 'number', def: deckRules.defaults.classSpellPowerCopies,
    min: deckRules.copyRange.min, max: deckRules.copyRange.max, gates: [{ key: 'deckEditing' }], label: t('settings.row.classSpellPowerCopies'), applied: (settings, row) => hooks.numberAppliedHtml(settings, row),
    note: tFull('settings.row.classSpellPowerCopies') },
  { cat: 'Advanced', advancedGroup: 'Deck', key: 'playInDeckOrder', def: deckRules.defaults.playInDeckOrder, label: t('settings.row.playInDeckOrder'),
    note: tFull('settings.row.playInDeckOrder') },
  ...ADVANCED_CONFIG_ROWS,
  { cat: 'Advanced', advancedGroup: 'Export', key: 'promptSettingsExport', def: true, label: t('settings.row.promptSettingsExport'),
    note: tFull('settings.row.promptSettingsExport') },
  { cat: 'Advanced', advancedGroup: 'Export', key: 'gameConfigExport', type: 'button', btn: 'Export JSON', label: t('settings.row.gameConfigExport'),
    note: tFull('settings.row.gameConfigExport') },
  { cat: 'Advanced', advancedGroup: 'Export', key: 'gameConfigImport', type: 'button', btn: 'Load JSON', label: t('settings.row.gameConfigImport'),
    note: tFull('settings.row.gameConfigImport') },
  // Advanced is the debugging surface — his word, and where Hold to confirm
  // already lives. These rows are generated from balance.graceRefill; see the
  // block above the SETTINGS_ROWS array.
  ...graceRefillRows(),
  ...wireframeChoiceRows(),
];
