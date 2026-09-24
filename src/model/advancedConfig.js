import { prologueRows, prologuePresetOverrides, migratePrologueSettingKey, migratePrologueEntries } from './prologue.js';
import { presetGearProblems } from './attributes.js';
import { balanceNote, NEW_RUN_CLAUSE } from './balanceNotes.js';
// Advanced game configuration is a sparse overlay on authored content.
// The authored bundle remains the default; only keys present in profile
// settings are projected into a fresh bundle for a new run.

import { handRulesRows, handRulesSettingsProblems } from './handRules.js';
import {
  startingStatRows, applyStartingStatConfig, kitAttributeMinimums, kitMinimum, derivedStatFloorProblems,
  startingStatPoolProblems, applyEquipmentRequirementConfig, bundleWithConfiguredEquipment,
} from './startingStatConfig.js';
import { combatRatingRows, resolveCombatRatings, combatRatingProblems, applyItemRatingConfig, migrateCombatRatingSettings, hasLegacyItemRatingSettings } from './combatRatings.js';
import { materializeCardValueBonuses } from './attackCardDamage.js';
import { FORMATION_DEFAULTS, FORMATION_FIELDS, FORMATION_PRESETS, FORMATION_ROWS } from './formationLayout.js';
import { gateOpen, ownKey, ownOn, withoutUnowned } from './settingOverrides.js';
export const ADVANCED_CONFIG_PREFIX = 'gameConfig.';
export const ADVANCED_CONFIG_SCHEMA_VERSION = 1;

const PRESENTATION_DEFAULTS = Object.freeze({
  ...FORMATION_DEFAULTS,
  playerSpriteScale: 1,
  enemySpriteScale: 2,
  playerSpawnRow: 'C',
  enemySpawnRow: 'C',
  playerSpawnColumn: '2',
  enemySpawnColumn: '3',
  showFormationGrid: false,
  movementEnabled: false, movementNeedsSelection: true, movementCostsAction: true,
  tileActivation: 'hold', moveActivation: 'hold', selectionColor: '#59bd75',
  rowAScale: 1, rowBScale: 1, rowCScale: 1, rowDScale: 1, rowEScale: 1, rowFScale: 1,
  frontOffsetX: 0, frontOffsetY: 0, backOffsetX: 0, backOffsetY: 0,
  frontLayer: 0, backLayer: 200,
  rowALayer: 0, rowBLayer: 0, rowCLayer: 0, rowDLayer: 0, rowELayer: 0, rowFLayer: 0,
  gridShape: 'wide-rhombus', gridLayer: 'behind',
  playerGridColor: '#0000ff', enemyGridColor: '#ff0000',
  settingsWidthPercent: 100,
  settingsHeightPercent: 100,
});

const word = (value) => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[._-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

function numberDomain(value) {
  const integer = Number.isInteger(value);
  const magnitude = Math.max(1, Math.abs(value));
  return {
    integer,
    step: integer ? 1 : (magnitude < 1 ? 0.01 : 0.1),
    min: value < 0 ? -Math.max(100, Math.ceil(magnitude * 10)) : 0,
    max: Math.max(integer ? 20 : 10, Math.ceil(magnitude * 10)),
  };
}

// A generated row's domain is read off its shipped value (numberDomain), which
// knows nothing of what validate.js will accept. These paths do: a percent
// that validation caps at 100, a cap that must be positive. The row says so,
// so a value the editor accepts is a value a run can start on.
const PERCENT = Object.freeze({ integer: true, step: 1, min: 0, max: 100 });
// A card-value bonus is SIGNED (SPEC §3.4: "The signed card-specific bonus is
// added after flooring"), and validation accepts any finite number. Read off
// the shipped value alone, a bonus that ships at 0 or above would floor at 0,
// and a card could never be made weaker than its cost says.
const SIGNED_CARD_BONUS = /^damage\.[A-Za-z]+Cards\.cardBonuses\./;
const SIGNED_BONUS = Object.freeze({ integer: true, step: 1, min: -999, max: 999 });
const BALANCE_DOMAINS = Object.freeze({
  'rest.hpSmallPct': PERCENT,
  'rest.hpPartialPct': PERCENT,
  'rest.mana.floorPct': PERCENT,
  'atlas.townsPerActMax': Object.freeze({ min: 1 }),
  // XP CURVES THIS BUILD LOWERED (owner, 2026-09-24: every base to 5). A range
  // read off 5 tops out at 50, which would refuse an exported file written on
  // the old bases (100, 60, 30) and every larger tuning — and a refused value
  // aborts the whole import. These are costs and awards with no natural cap.
  'level.xp.base': Object.freeze({ max: 1000 }),
  'skill.xp.base': Object.freeze({ max: 1000 }),
  'skill.class.xp.base': Object.freeze({ max: 1000 }),
  'xp.combatWin': Object.freeze({ max: 1000 }),
  'xp.kill.normal': Object.freeze({ max: 1000 }),
  'xp.kill.elite': Object.freeze({ max: 1000 }),
  'xp.kill.boss': Object.freeze({ max: 2000 }),
});

// A balance path this build renamed keeps its stored override: the old key is
// read as the new one wherever settings are read (the configured bundle, the
// snapshot, an imported file), and the new key wins when both are present.
// `shrine.healPct` became `rest.hpPartialPct` (plan phase 7, SPEC §13.4j).
const LEGACY_BALANCE_KEYS = Object.freeze({
  [`${ADVANCED_CONFIG_PREFIX}balance.shrine.healPct`]: `${ADVANCED_CONFIG_PREFIX}balance.rest.hpPartialPct`,
});

export function currentAdvancedKey(key) {
  return LEGACY_BALANCE_KEYS[key] ?? migratePrologueSettingKey(key);
}

// THE ×20 CINDERS ARE RETIRED (owner, 2026-09-24: "I hate the 20x cinder,
// that needs to die"). His exported configuration carried
// `progression.rewardMultiplier: 20`; it is not a default and it is not carried
// across. The row is `progression.cinderMultiplier`, default 1 (the authored
// table). A stored or imported old key — and its `settings.`-prefixed export
// mirror — is DROPPED with a warning, never converted, so no profile or file
// can bring the ×20 back by accident.
const CINDER_KEY = `${ADVANCED_CONFIG_PREFIX}progression.cinderMultiplier`;
const LEGACY_CINDER_KEY = `${ADVANCED_CONFIG_PREFIX}progression.rewardMultiplier`;
const LEGACY_CINDER_KEYS = Object.freeze([LEGACY_CINDER_KEY, `settings.${LEGACY_CINDER_KEY}`]);

function withoutRetiredCinderKey(entries) {
  return entries.filter(([key]) => !LEGACY_CINDER_KEYS.includes(key));
}

const LEGACY_CINDER_WARNING = 'The old Cinder gain multiplier is retired and was left out: Cinders pay the authored table. Use Rewards → Cinder gain multiplier to scale them.';

/**
 * bringRunSnapshotForward(run, save, warnings) → `warnings`, with the retired
 * Cinder warning pushed once when the run's `advancedConfigSnapshot` held the
 * old key (either spelling), and the run handed to `save(run)` once.
 *
 * A RUN SNAPSHOT IS DROPPED ALOUD TOO (Codex, on #1294). `configuredContentBundle`
 * already leaves the key out of a snapshot, so the payouts were right — but a
 * resumed run lost it in silence, where SPEC §5.1 promises a warning for "a
 * profile, run snapshot or imported file". Saved, because the snapshot is read
 * back from storage on every load: an un-saved run would warn every resume.
 * A snapshot without the key is left untouched and not re-saved.
 */
export function bringRunSnapshotForward(run, save, warnings = []) {
  const overrides = run?.advancedConfigSnapshot?.overrides;
  if (!overrides || typeof overrides !== 'object') return warnings;
  const retired = LEGACY_CINDER_KEYS.filter((key) => Object.hasOwn(overrides, key));
  if (!retired.length) return warnings;
  // The snapshot is frozen when a run begins in this session; one read back
  // from storage is a plain object. Either way the run gets a clean copy.
  const kept = Object.fromEntries(withoutRetiredCinderKey(Object.entries(overrides)));
  run.advancedConfigSnapshot = { ...run.advancedConfigSnapshot, overrides: kept };
  warnings.push(LEGACY_CINDER_WARNING);
  save(run);
  return warnings;
}

/** True when a stored profile holds a key `normalizeAdvancedSettings` rewrites. */
export function hasLegacyAdvancedSettings(settings = {}) {
  return hasLegacyItemRatingSettings(settings) || Object.hasOwn(settings || {}, LEGACY_CINDER_KEY);
}

/**
 * normalizeAdvancedSettings(settings, bundle) → the same object, holding only
 * keys this build knows.
 *
 * ONE NUMBER, ONE ROW, WHEREVER IT IS READ (Copilot, on #1242). The per-item
 * rating migration is value-bearing — it reads the item's authored rating to
 * turn an old plus into the value it used to make — so it cannot live in the
 * static key map above, and a reader that skipped it saw a different number
 * from a reader that did: the item card took the migrated 8 while the settings
 * row still opened on the authored 5, and typing in that row overwrote the 8.
 * Rewriting the profile ITSELF, once, at boot, leaves every reader — the row,
 * the export, the configured bundle, the fight — looking at one key.
 *
 * In place, because the profile object is shared (`main.js` holds
 * `activeMeta.settings` by reference and saves it); the return value is the
 * same object, for callers that would rather read than mutate.
 */
export { hasLegacyItemRatingSettings };

export function normalizeAdvancedSettings(settings, bundle, warnings = null) {
  if (!settings || typeof settings !== 'object' || !bundle) return settings;
  if (Object.hasOwn(settings, LEGACY_CINDER_KEY)) {
    delete settings[LEGACY_CINDER_KEY];
    if (Array.isArray(warnings)) warnings.push(LEGACY_CINDER_WARNING);
  }
  const migrated = migrateCombatRatingSettings(settings, bundle, warnings);
  if (migrated === settings) return settings;
  for (const key of Object.keys(settings)) if (!Object.hasOwn(migrated, key)) delete settings[key];
  Object.assign(settings, migrated);
  return settings;
}

/**
 * bringProfileForward(meta, bundle, save, warnings) → `meta.settings`,
 * rewritten to this build's keys and — when there was anything to rewrite —
 * handed to `save(meta)`.
 *
 * ONE DOOR FOR A PROFILE ARRIVING FROM STORAGE (Codex, on #1273). Boot brought
 * the profile forward and a restore did not, so a restored profile could keep
 * a key this build has retired. Boot and restore both come through here now.
 * The retired `progression.rewardMultiplier` (the ×20 Cinders, #1294) is
 * DROPPED with a warning — never converted — and the profile saved, so the
 * Advanced Settings row and `configuredContentBundle` both read the authored
 * table (or the profile's own `cinderMultiplier`, kept as it was). Saved, not
 * only rewritten, because `loadMeta` re-reads the stored bytes on every call:
 * a profile left un-saved would hand the next reader the retired key again.
 */
export function bringProfileForward(meta, bundle, save, warnings = null) {
  const settings = meta.settings || (meta.settings = {});
  if (!hasLegacyAdvancedSettings(settings)) return settings;
  normalizeAdvancedSettings(settings, bundle, warnings);
  save(meta);
  return settings;
}

// A DIAL THIS BUILD RETIRED, so an older export still imports. `parseAdvanced-
// ConfigFile` refuses an unknown key OUTRIGHT — "Nothing was imported" — which
// is right for a typo and wrong for a key this build itself removed: the
// owner's own exported file would refuse to come back. These are dropped with
// a named warning instead, and the file lands.
//
//   ratings.<id>.pointsPerIncrease / .gain / .multiplier
//                                           superseded by the one global multiplier
//                                           and the global `multiplier`
//                                           (model/combatRatings.js).
//   startingStats.autoScale                 the creation scale no longer
//                                           reaches any formula, so the dial
//                                           that switched it off has nothing
//                                           left to switch.
//   derivedStatRules.rules.<id>.pointsPerTier / .gainPerTier — <id> is one
//                                           of the six stat ids, never a
//                                           wildcard, so a typo such as `hhp`
//                                           is still refused as unknown,
//   derivedStatRules.defaults.pointsPerTier,
//   balance.levelUp.tierSizeMin / .tierSizeMax
//                                           ruleset 6 (owner, 2026-09-21): HP,
//                                           Mana and every pool read as the
//                                           ratings do — a decimal weight per
//                                           attribute — so a tier and its gain
//                                           have no row left to land on, and
//                                           the "Stat points per tier" dial
//                                           and its bounds retired with them.
const RETIRED_KEYS = /^(settings\.)?gameConfig\.(startingStats\.autoScale|combatRatings\.ratings\.(ar|dr|pr|poise|ward)\.(pointsPerIncrease|gain|multiplier)|derivedStatRules\.(rules\.(energy|draw|hp|stamina|mana|poise)\.(pointsPerTier|gainPerTier)|defaults\.pointsPerTier)|balance\.levelUp\.tierSize(Min|Max))$/;

function withoutRetired(entries, warnings) {
  const kept = entries.filter(([key]) => !RETIRED_KEYS.test(key));
  if (kept.length !== entries.length) {
    warnings.push('Per-rating tiers and multipliers, and the per-stat tier and gain on HP, Mana, Stamina, Actions, draw and Poise, were replaced by direct attribute weights. Retired entries were skipped; everything else in the file was imported.');
  }
  return kept;
}

function withoutSupersededLegacy(entries) {
  const present = new Set(entries.map(([key]) => key));
  // The opening's per-scene keys used to be POSITIONAL, and the scenes moved.
  // They are translated by scene id before anything looks a row up, so an
  // exported file written before the reorder still imports, and lands on the
  // scene it was written for. See migratePrologueEntries.
  return migratePrologueEntries(withoutRetiredCinderKey(entries)
    .filter(([key]) => !(key in LEGACY_BALANCE_KEYS) || !present.has(LEGACY_BALANCE_KEYS[key]))
    .map(([key, value]) => [LEGACY_BALANCE_KEYS[key] ?? key, value]));
}

// ONE TAB PER SUBJECT (owner, 2026-09-23: "settings duplicated in multiple
// sections making it hard to tell which does what"). The catch-all "Rules" tab
// held skills, talents, relics, XP, rest and co-op side by side, each of which
// has a real home elsewhere; it is gone, and anything not named here falls to
// Combat, the tab for rules of play.
//   - everything that decides a trait is one topic of the Stats tab (owner,
//     2026-09-21): the legacy poise meter sits under Stats → Poise beside the
//     rating that replaces it while ratings are on, the fallback hand size
//     under Stats → Draw & hand beside the capacity in force, and the Mana
//     card rules under Stats → Mana;
//   - character XP, skills and talents are Progression;
//   - equipment and relic values are one Equipment tab;
//   - how a run is built — rest, the atlas, seats, run modifiers, gauntlet,
//     co-op, endless — is World.
function balanceGroup(path) {
  if (/^(poise|stagger|mana)\./.test(path) || path === 'handMax') return 'Stats';
  if (/^(level|xp\.|skill\.|classTree\.)/.test(path)) return 'Progression';
  if (/^(equipment|powers)\./.test(path)) return 'Equipment';
  if (/^(rewards|shop|smith|graceRefill|flask|startingCinders)/.test(path)) return 'Rewards';
  if (/^(map|floors|act|seat|event|treasure|journey|node|atlas|rest|gauntlet|coop|endless|customMods)/.test(path)) return 'World';
  return 'Combat';
}

// ---- THE ROWS THAT SHOWED A SECOND, DEAD ANSWER (owner, 2026-09-21) -------
//
// The other half of "the menus aren't matching", and the worse half: two rows
// in two groups claiming the same thing, with different numbers, one of which
// does nothing at all.
//
// Progression → Starting values offered `energy` and `draw`; Progression →
// Stat conversions offered "Actions — base amount" and "Draw — base amount"
// (now Stats → Actions and Stats → Draw & hand).
// The second pair is what a run is actually born with — `state.js` reads
// `energy.value` and `draw.value` off the derived-stat rules and nothing in
// src, tools or tests reads `balance.energy` or `balance.draw` at all. Setting
// them to 99 moves neither `run.energyMax` nor `run.drawPerTurn`. They are
// inert, and the reason nobody caught it is that the authored values AGREE
// with the live ones (3 and 5) until you touch them: the phantom row reads
// true right up to the moment you use it.
//
// RETIRED, NOT DELETED. The key stays known so a configuration file already
// carrying it still imports whole — deleting a row makes `parseAdvancedConfig-
// File` abort the file on an unknown key, which is the defect #1238 fixed for
// the preset cells. `retired` is the same flag a hidden creation mode's pool
// row carries, and settings.js filters on it.
const RETIRED_BALANCE_PATHS = new Set([
  'energy',
  'draw',
  // THE SAME TEST, APPLIED TO THE REST OF THE MENU (owner, 2026-09-23: "multiple
  // settings changing the same setting"). Each of these moved nothing:
  //   - the level-up and tier-size bounds are read once, from the AUTHORED
  //     content, as the min/max of Progression's "Level-up value" and "Stat
  //     points per tier" rows (settings.js `LEVEL_DEFAULTS`); an override here
  //     never reached those rows, so the menu showed three dials for one number
  //     and two of them were decoration;
  //   - enemy level scaling is inert #238 content — `levelScalingReceipt` has
  //     no caller in src (balance.js says so above the table);
  //   - the per-turn swap allowance is consulted only when `swapCostKind` is
  //     'allowance', which is authored text and has no row.
  'levelUp.pointsPerLevelMin',
  'levelUp.pointsPerLevelMax',
  // (`levelUp.tierSizeMin/Max` left with the tier dial itself — ruleset 6,
  // #1253 — and are skipped on import as RETIRED_KEYS, not kept as rows.)
  ...['hp', 'damage', 'block', 'poise'].flatMap((stat) => ['perLevel', 'min', 'max']
    .map((leaf) => `levels.enemyScaling.${stat}.${leaf}`)),
  'equipment.swapAllowancePerTurn',
]);

// THE NOTES LIVE BESIDE THEIR NUMBERS, in content/balance.js (owner,
// 2026-09-23: "move the descriptions into balance.js"). A `BALANCE_NOTES`
// table sat here and gave every generated row it did not name "Applies to a
// new run." — the same five words under most of 325 rows. Every sentence it
// held now sits beside its own number, with the facts it established kept:
// the legacy poise and stagger rows are live only while combat ratings are
// off; `handMax` is a fallback a solo fight never reads; each class's flasks
// must add up to `flaskCapacity`; and the swap-cost numbers belong to the
// rule the "Weapon swap cost" picker chooses, not to the `gear` flags.

// ---- ONE LABEL HOME, AND THE ROW IS IT (owner, 2026-09-21) ----------------
//
// "why aren't the menus matching? … make them consistent with what I see with
// each other."
//
// Advanced spoke two languages. A hand-authored row carried a sentence a
// person wrote — "HP — base amount", "Reaver — Strength", "Straight Sword —
// Strength required": the subject in Title Case because it names a thing, the
// leaf in sentence case because it is a phrase. A row generated from `balance`
// carried
// `word(<last path segment>)` and a note beginning "Authored balance value:".
// That note is engine-speak, and the label was WORSE than short: `leafRows`
// only ever saw the LAST segment, so `levels.enemyScaling.hp.perLevel`,
// `…damage.perLevel` and `…block.perLevel` were three rows all called "Per
// Level", stacked in one group, indistinguishable.
//
// The screen's answer was to rebuild the label from the KEY at render time
// (`settings.js`, now deleted): it recovered the missing context but split
// camelCase without capitalising anything, so the same menu showed "HP — base
// amount" two rows above "hand Max" and "levels · player Starting Level". One
// fact — what this row is called — had two homes and they disagreed by
// construction.
//
// So the label is built ONCE, here, with the context the leaf needs and the
// casing the rest of the menu uses: Title Case subjects, a sentence-case leaf,
// measured against the hand-authored corpus rather than guessed at (1234 of
// its leaves read as a sentence, 262 as a heading).
//
// Nothing is lost by taking the engine's spelling off the row. Search reads
// the rendered row text AND the input's `data-key` (settings.js, in
// `filterAdvancedRows`), and `data-key` is the full `gameConfig.balance.<path>`
// — so every segment this label drops is still typeable. `searchPath` is NOT
// what search reads; it never reaches the DOM, and its only consumer is the
// `ui.`/legacy filter below.

// Words the menu already writes as acronyms ("HP — base amount", "Reaver —
// base HP"). Without this, `hp` title-cases to "Hp" beside a hand-authored
// "HP", which is the very mismatch this block exists to end.
const LABEL_ACRONYMS = new Map(Object.entries({
  hp: 'HP', xp: 'XP', ar: 'AR', dr: 'DR', pr: 'PR', mp: 'MP', ui: 'UI', id: 'ID', pct: '%',
}));

/**
 * One path segment as the menu writes it.
 *
 * A SUBJECT is a heading — `enemyScaling` → `Enemy Scaling` — because it names
 * a thing, and every hand-authored subject in this menu ("Straight Sword",
 * "Wayfarer Plate", "Reaver") is written that way.
 *
 * A LEAF is a phrase, so it is sentence case — `perLevel` → `Per level`,
 * `hpSmallPct` → `HP small %`. That is not a preference: the hand-authored
 * corpus this menu has to match is 1234 sentence-case leaves ("Resistance
 * cap", "Break threshold multiplier", "Strength required") against 262 Title
 * Case ones. Title-casing generated leaves left three tabs — Level-up, General
 * and Experience & rewards — showing both styles at once, which is the mismatch
 * this block exists to end, not a new home for it.
 *
 * Acronyms survive either way; `LABEL_ACRONYMS` is consulted before the case
 * rule, so `hp` is `HP` whether it opens the leaf or sits inside it.
 */
function labelSegment(part, sentence = false) {
  return String(part)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((piece, index) => LABEL_ACRONYMS.get(piece.toLowerCase())
      || (sentence && index > 0 ? piece.toLowerCase() : piece[0].toUpperCase() + piece.slice(1)))
    .join(' ');
}

// The generated rows filed under Advanced → Stats sit beside hand-written rows
// ("Hand capacity — Base cards", "Keep unplayed cards after your turn"), so
// they say what they do rather than spell their key; "Poise · On Fill · 0 —
// Stacks" named an array index. Everything else keeps its key-derived label.
const BALANCE_LABELS = Object.freeze({
  handMax: 'Fallback hand capacity',
  'poise.growthMult': 'Poise meter growth after each fill',
  'poise.onFill.0.stacks': 'Staggered stacks when an enemy meter fills',
  'poise.playerImpactPerHit': 'Poise damage you take per enemy hit',
  'stagger.player.actionLoss': 'Actions you lose when your meter fills',
  'stagger.player.statuses.vulnerable': 'Vulnerable stacks when your meter fills',
  'stagger.player.statuses.weak': 'Weak stacks when your meter fills',
  'mana.minActionCost': 'Least action cost of a mana card',
  'mana.minStaminaCost': 'Least stamina cost of a mana card',
});

/**
 * balanceLabel(path) → the row's one label.
 *
 * `subject · subject — leaf`, which is the shape every hand-authored row in
 * this menu already uses: the em dash separates what the row IS from what it
 * belongs to, and the middle dot stacks the owners. `levels.enemyScaling.hp
 * .perLevel` becomes "Levels · Enemy Scaling · HP — Per Level" — long, and the
 * only reason its two siblings are now telling apart.
 */
function balanceLabel(path) {
  const named = BALANCE_LABELS[path.join('.')];
  if (named) return named;
  const leaf = labelSegment(path[path.length - 1], true);
  const context = path.slice(0, -1).map((part) => labelSegment(part));
  return context.length ? `${context.join(' · ')} — ${leaf}` : leaf;
}

// EVERY GENERATED ROW SAYS WHAT IT DOES. This used to read `Authored balance
// value: <path>. Applies to a new run.` for all 325 of them — one sentence,
// repeated, saying only what the key beside it already said (owner,
// 2026-09-21: "the description for most of the settings say the same thing and
// aren't very helpful descriptions"). The sentences sit beside their numbers
// in content/balance.js, and model/balanceNotes.js reads them and fills in
// every name from the bundle; the old line survives only as the fallback for a
// number with no sentence, and a test holds that fallback at zero.
//
// `parent` is the object or array the leaf sits in, handed down so a row
// inside an authored list (a swap-cost category, an armoury view, a flask
// growth row) can name itself by its own tag or id instead of by its index.
function leafRows(value, path = [], rows = [], bundle = null, parent = null) {
  if (typeof value === 'number' || typeof value === 'boolean') {
    const joined = path.join('.');
    const domain = typeof value === 'number' ? { ...numberDomain(value), ...(BALANCE_DOMAINS[joined] || {}), ...(SIGNED_CARD_BONUS.test(joined) ? SIGNED_BONUS : {}) } : {};
    const described = balanceNote(joined, { bundle, parent });
    rows.push({
      cat: 'Advanced',
      advancedGroup: balanceGroup(joined),
      key: `${ADVANCED_CONFIG_PREFIX}balance.${joined}`,
      type: typeof value === 'number' ? 'number' : undefined,
      def: value,
      ...domain,
      label: balanceLabel(path),
      // The flag, not the sentence, is what marks a generated row: the Advanced
      // panel used to recognise one by the boilerplate it carried, which meant
      // giving a row a real description would have quietly changed how it drew.
      generatedBalance: true,
      // The whole note, closing clause included: a row the game does not read
      // must not end by promising it applies to a new run, so the note beside
      // the number decides that rather than this line appending it to
      // everything.
      note: described || `Authored balance value: ${joined}. ${NEW_RUN_CLAUSE}`,
      configPath: ['balance', ...path],
      searchPath: joined,
      // `inert` as well as `retired`: nothing reads it, so a stored value is
      // never applied — see `configuredContentBundle`.
      ...(RETIRED_BALANCE_PATHS.has(joined) ? { retired: true, inert: true } : {}),
    });
    return rows;
  }
  if (!value || typeof value !== 'object') return rows;
  for (const [key, child] of Object.entries(value)) leafRows(child, [...path, key], rows, bundle, value);
  return rows;
}

// CLASS DEFAULTS LIVE UNDER PROGRESSION (owner, 2026-09-20: "class defaults
// should be in Progression"). They are the other half of the one starting-stat
// driver — the pool says how many points a character carries, these say where
// each class puts them — and a tab of their own put one idea in two menus.
function explicitRows(bundle) {
  const rows = [];
  const modeId = bundle.attributeRules?.defaultMode || 'tuned';
  const needs = kitAttributeMinimums(bundle);
  // EVERY MODE WITH A PRESET TABLE GETS ROWS, AND ONLY THE DEFAULT ONE IS ON
  // SCREEN. `startingStatRows` has always done this with the pool keys, and
  // this table had to learn it the day the default mode changed: an exported
  // configuration holds `…presets.<old default>.<class>.<attribute>` keys, and
  // `parseAdvancedConfigFile` refuses an UNKNOWN key by aborting the whole
  // file — so one retired key took every unrelated setting in it down, and the
  // current build could even export a file it then refused to import. The
  // retired rows keep the keys importable and stay off the screen (`retired`,
  // the same filter settings.js applies to a retired pool row).
  const modeIds = Object.keys(bundle.attributeRules?.presets || {})
    .sort((a, b) => Number(b === modeId) - Number(a === modeId));
  for (const presetModeId of modeIds) {
  const retired = presetModeId === modeId ? {} : { retired: true };
  const tuned = bundle.attributeRules?.presets?.[presetModeId] || {};
  for (const classDef of bundle.classes || []) {
    const classLabel = classDef.name || word(classDef.id);
    for (const attribute of bundle.attributes || []) {
      const def = tuned[classDef.id]?.[attribute.id];
      if (!Number.isFinite(def)) continue;
      // THE ROW STATES THE FLOOR VALIDATION WILL INSIST ON. validate.js refuses
      // a preset that cannot hold the kit its class starts in; a row whose
      // domain started at 1 let him type a number that failed at boot and took
      // the whole configuration down with it.
      // The kit floor is validate.js's rule for the DEFAULT mode only, so a
      // retired mode's cells keep the bare floor of 1 they were admitted under.
      const need = presetModeId === modeId ? needs[classDef.id]?.[attribute.id] : undefined;
      rows.push({
        cat: 'Advanced', advancedGroup: 'Progression', classTopic: classLabel, ...retired,
        type: 'number', integer: true, step: 1,
        min: Math.max(1, need?.minimum || 0), max: 495, def,
        // The floor MOVED UP after schema version 1 shipped, so a configuration
        // exported before it holds values this row no longer accepts. Refusing
        // them is right; refusing his whole file over them is not.
        floorGroup: `attributeRules.presets.${presetModeId}.${classDef.id}`,
        raisedFloor: need ? { group: `attributeRules.presets.${presetModeId}.${classDef.id}` } : undefined,
        key: `${ADVANCED_CONFIG_PREFIX}attributeRules.presets.${presetModeId}.${classDef.id}.${attribute.id}`,
        label: `${classLabel} — ${attribute.label}`,
        // The floor sentence is its OWN field as well as part of the note: the
        // class topics compact a row's note away (the label already names the
        // class), and compacting it away took the only explanation of where the
        // floor comes from with it.
        floorNote: need ? `It cannot go below ${need.minimum}: the ${need.kit} kit this class starts in asks that much.` : '',
        note: `Starting ${attribute.label.toLowerCase()} for ${classLabel}. The class's attributes must total the character's points, set under Starting stats.`
          + (need ? ` It cannot go below ${need.minimum}: the ${need.kit} kit this class starts in asks that much.` : '')
          + ' Applies to a new run.',
        configPath: ['attributeRules', 'presets', presetModeId, classDef.id, attribute.id],
        searchPath: `class ${classDef.id} starting ${attribute.id}`,
      });
    }
  }
  }
  for (const classDef of bundle.classes || []) {
    const classLabel = classDef.name || word(classDef.id);
    rows.push({
      cat: 'Advanced', advancedGroup: 'Progression', classTopic: classLabel,
      type: 'number', integer: true, step: 1,
      min: 1, max: 999, def: classDef.maxHp,
      key: `${ADVANCED_CONFIG_PREFIX}classes.${classDef.id}.maxHp`,
      label: `${classLabel} — Base HP`, note: `Base HP for ${classLabel}. Applies to a new run.`,
      // RETIRED (owner, 2026-09-23). `createRunState` writes this into maxHp and
      // `initializeRunDerivedStats` overwrites it a few lines later with the
      // derived HP rule (Stats → HP), so the row moved nothing. The
      // key stays so an exported configuration carrying it still imports.
      retired: true, inert: true,
      configPath: ['classesById', classDef.id, 'maxHp'], searchPath: `class ${classDef.id} max hp`,
    });
    for (const kind of ['hp', 'mana']) {
      const def = classDef.startingFlaskAllocation?.[kind];
      if (!Number.isFinite(def)) continue;
      rows.push({
        cat: 'Advanced', advancedGroup: 'Progression', classTopic: classLabel,
        type: 'number', integer: true, step: 1,
        min: 0, max: 20, def,
        key: `${ADVANCED_CONFIG_PREFIX}classes.${classDef.id}.startingFlaskAllocation.${kind}`,
        // `HP` is an acronym and `Mana` is a word; the class tab compacts the
        // class name away, so these sit directly beside "Strength" and have to
        // read like it.
        label: `${classLabel} — ${kind === 'hp' ? 'HP' : 'Mana'} flasks`, note: `Starting ${kind.toUpperCase()} flask allocation for ${classLabel}. Applies to a new run.`,
        configPath: ['classesById', classDef.id, 'startingFlaskAllocation', kind], searchPath: `class ${classDef.id} flask ${kind}`,
      });
    }
  }
  return rows;
}

const PRESENTATION_ROWS = Object.freeze([
  ...FORMATION_FIELDS.map(field => ({ ...field, note: 'Preview and apply in Formation layout. Grid dimensions are shared by both sides.' })),
  ...[...FORMATION_ROWS].flatMap(row => [
    { key: `row${row}Scale`, label: `Row ${row} character scale multiplier`, min: 0.25, max: 3, step: 0.05, integer: false, note: 'Multiplies the character size for this row. Feet remain anchored to their tile.' },
    { key: `row${row}Layer`, label: `Row ${row} layer adjustment`, min: -500, max: 500, step: 1, integer: true, note: 'Added to the front/back character layer. Higher numbers draw above lower numbers.' },
  ]),
  ...['front', 'back'].flatMap(column => [
    { key: `${column}OffsetX`, label: `${word(column)} column horizontal offset`, min: -150, max: 150, step: 1, integer: true, note: 'Screen pixels; positive moves inward toward the opponent, negative moves outward. Applies to both sides and their tiles; limited at battlefield edges.' },
    { key: `${column}OffsetY`, label: `${word(column)} column vertical offset`, min: -100, max: 100, step: 1, integer: true, note: 'Screen pixels; positive moves down, negative moves up. Moves characters and their tiles together.' },
    { key: `${column}Layer`, label: `${word(column)} column character layer`, min: 0, max: 500, step: 1, integer: true, note: 'Higher layers draw above lower layers. Row layer adjustments are added to this value.' },
  ]),
  { key: 'playerSpriteScale', label: 'Player sprite scale', min: 0.5, max: 2, step: 0.05, integer: false, note: 'Scale the player figure without changing its combat footprint.' },
  { key: 'enemySpriteScale', label: 'Enemy sprite scale', min: 0.5, max: 2, step: 0.05, integer: false, note: 'Scale enemy figures without changing targeting or combat rules.' },
  { key: 'settingsWidthPercent', label: 'Settings panel width', min: 60, max: 100, step: 1, integer: true, suffix: '%', note: 'How much of the safe viewport the Settings panel may use.' },
  { key: 'settingsHeightPercent', label: 'Settings panel height', min: 60, max: 100, step: 1, integer: true, suffix: '%', note: 'How much of the safe viewport the Settings panel may use.' },
]);

function presentationRows() {
  return [
    { cat: 'Advanced', advancedGroup: 'Interface', type: 'choice',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.formationPreset`, presentationKey: 'formationPreset',
      def: FORMATION_DEFAULTS.formationPreset, choices: FORMATION_PRESETS.map(p => p.value),
      choiceLabels: Object.fromEntries(FORMATION_PRESETS.map(p => [p.value, p.label])),
      label: 'Formation preset', note: 'Straight ranks, parallel slants or the classic V. Changes positions without changing combat range rules.' },
    ...[
      ['movementEnabled', 'Enable formation movement', 'Make empty player-side tiles interactive in combat.'],
      ['movementNeedsSelection', 'Select a tile before moving', 'In tap mode, select a destination, then use Move. When off, tapping moves immediately. Hold mode always moves on completion or opens Move / Cancel on early release.'],
      ['movementCostsAction', 'Movement costs an action', 'Spend one action per move. When off, movement is free.'],
    ].map(([key, label, note]) => ({ cat: 'Advanced', advancedGroup: 'Interface', key: `${ADVANCED_CONFIG_PREFIX}presentation.${key}`, presentationKey: key, def: PRESENTATION_DEFAULTS[key], label, note })),
    ...[['tileActivation', 'Tile activation'], ['moveActivation', 'Move button activation']].map(([key, label]) => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice', key: `${ADVANCED_CONFIG_PREFIX}presentation.${key}`, presentationKey: key,
      def: PRESENTATION_DEFAULTS[key], choices: ['tap', 'hold'], label,
      note: 'Hold uses the shared loading delay and moves directly when complete; releasing early opens Move / Cancel. Tap uses the selection-step preference.',
    })),
    { cat: 'Advanced', advancedGroup: 'Interface', type: 'color', key: `${ADVANCED_CONFIG_PREFIX}presentation.selectionColor`, presentationKey: 'selectionColor',
      def: PRESENTATION_DEFAULTS.selectionColor, label: 'Shared selection color', note: 'Highlight selected tiles, cards, characters and selected menu choices with this color.' },
    {
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.gridShape`, presentationKey: 'gridShape',
      def: 'wide-rhombus', choices: ['square', 'rectangle', 'rhombus', 'wide-rhombus', 'circle', 'ellipse'],
      choiceLabels: { 'wide-rhombus': 'rectangular rhombus' },
      label: 'Formation tile shape', note: 'Changes the tile outline while keeping its placement anchor fixed.', slider: true,
    },
    {
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.gridLayer`, presentationKey: 'gridLayer',
      def: 'behind', choices: ['behind', 'above'], label: 'Formation grid layer',
      note: 'Draw the grid behind characters or above them for checking positions. The grid never blocks clicks.',
    },
    ...['player', 'enemy'].map(side => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'color',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.${side}GridColor`, presentationKey: `${side}GridColor`,
      def: PRESENTATION_DEFAULTS[`${side}GridColor`], label: `${word(side)} tile color`,
      note: 'Outline and highlight color for this side of the formation grid.',
    })),
    {
      cat: 'Advanced', advancedGroup: 'Interface',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.showFormationGrid`,
      presentationKey: 'showFormationGrid', def: false,
      label: 'Show formation grid',
      note: 'Show labeled positions for the selected grid, up to A1–F6. The left half belongs to your team; the right half to enemies.',
    },
    ...PRESENTATION_ROWS.map((row) => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'number',
      ...row, def: PRESENTATION_DEFAULTS[row.key],
      key: `${ADVANCED_CONFIG_PREFIX}presentation.${row.key}`,
      presentationKey: row.key,
    })),
    ...['player', 'enemy'].map((side) => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.${side}SpawnRow`,
      presentationKey: `${side}SpawnRow`, def: 'C', choices: [...FORMATION_ROWS],
      choiceLabels: Object.fromEntries([...FORMATION_ROWS].map(row => [row, `Row ${row}`])),
      legacyChoices: side === 'player'
        ? { front: 'A', middle: 'B', back: 'C' }
        : { front: 'C', middle: 'B', back: 'A' },
      label: `${word(side)} preferred row (A–F)`,
      note: 'A is the top row. A row outside the chosen grid uses its last row. Additional characters fill available columns, then earlier rows.',
    })),
    ...['player', 'enemy'].map((side) => ({
      cat: 'Advanced', advancedGroup: 'Interface', type: 'choice',
      key: `${ADVANCED_CONFIG_PREFIX}presentation.${side}SpawnColumn`,
      presentationKey: `${side}SpawnColumn`,
      def: side === 'player' ? '2' : '3',
      choices: side === 'player' ? ['1', '2', '3'] : ['2', '3', '4', '5', '6'],
      legacyChoices: side === 'player'
        ? { left: '1', center: '2', right: '2' }
        : { left: '3', center: '3', right: '4' },
      label: `${word(side)} preferred column`,
      note: 'Numbered left to right across the battlefield. A column outside this team’s grid uses the nearest valid column. Front is nearer the center.',
    })),
  ];
}

function progressionRows(bundle) {
  return [
    {
      cat: 'Advanced', advancedGroup: 'Progression', type: 'number', integer: false, step: 0.05,
      min: 0.05, max: 20, def: 1,
      key: `${ADVANCED_CONFIG_PREFIX}progression.xpMultiplier`,
      label: 'Experience gain multiplier',
      note: 'Multiply the XP a won fight, a kill and a quest pay toward your character level. 1 keeps authored awards. Applies to a new run.',
      specialKey: 'xpMultiplier', searchPath: 'progression experience exp level gain multiplier',
    },
    {
      // Cinders only — it never touched XP, whatever its old label said — so it
      // is filed with the Cinders it multiplies (Rewards → Combat rewards).
      // A new key: the old `progression.rewardMultiplier` is retired (see
      // LEGACY_CINDER_KEY).
      cat: 'Advanced', advancedGroup: 'Rewards', type: 'number', integer: false, step: 0.01,
      min: 0, max: 20, def: 1,
      key: CINDER_KEY,
      label: 'Cinder gain multiplier',
      note: 'Multiply Cinders earned from combat rewards. 1 keeps the authored table. Applies to a new run.',
      specialKey: 'cinderMultiplier', searchPath: 'progression experience exp cinder reward gain multiplier',
    },
  ];
}

const LEGACY_BALANCE_PATHS = new Set([
  'levelUp.pointsPerLevel',
]);

// ---- PER-CLASS VALUES THAT WIN OVER A GLOBAL, BY A SWITCH (2026-09-23) -----
//
// A class's reward-rarity table replaces the global one outright, and a class's
// strike bias replaces the default — but nothing on screen said which was in
// force, or let a class go back to following the global. Each now has a
// "uses its own …" switch (model/settingOverrides.js). It starts ON because
// these classes ship their own values; turning it off drops the class entry
// from the configured bundle, so the engine's own fallback — the global —
// applies.
function balanceOwnRows(bundle) {
  const rows = [];
  const className = (id) => bundle.classes?.find((row) => row.id === id)?.name || word(id);
  for (const classId of Object.keys(bundle.balance?.rewards?.rarityWeightsByClass || {})) {
    const member = `${ADVANCED_CONFIG_PREFIX}balance.rewards.rarityWeightsByClass.${classId}`;
    rows.push({
      cat: 'Advanced', advancedGroup: 'Rewards', key: ownKey(member), def: true,
      own: { member, defaultOn: true, dropPath: ['balance', 'rewards', 'rarityWeightsByClass', classId] },
      label: `${className(classId)} uses its own reward rarity`, searchPath: `rewards rarity ${classId} own override`,
      note: `On: ${className(classId)}'s combat rewards use the table below. Off: they use Reward rarity, like every other class. Applies to a new run.`,
    });
  }
  for (const [classId, entry] of Object.entries(bundle.balance?.equipment?.startingDeck?.classes || {})) {
    if (!Number.isFinite(entry?.strikeBias)) continue;
    const member = `${ADVANCED_CONFIG_PREFIX}balance.equipment.startingDeck.classes.${classId}.strikeBias`;
    rows.push({
      cat: 'Advanced', advancedGroup: 'Equipment', key: ownKey(member), def: true,
      // The whole class entry goes: validation requires an entry to carry a
      // strike bias, and the bias is all an entry holds.
      own: { member, defaultOn: true, dropPath: ['balance', 'equipment', 'startingDeck', 'classes', classId] },
      label: `${className(classId)} uses its own strike bias`, searchPath: `starting deck strike bias ${classId} own override`,
      note: `On: ${className(classId)}'s starting deck uses its own strike bias. Off: it uses the default strike bias. Applies to a new run.`,
    });
  }
  return rows;
}

// ---- A ROW THAT DOES NOTHING RIGHT NOW IS DISABLED, AND SAYS WHY ---------
//
// Each rule names the switch whose value decides whether a row takes effect
// (`gate`, read by model/settingOverrides.js `gateOpen`). The engine already
// ignores these rows in that state; the screen now shows it instead of
// accepting a number that does nothing.
const RATINGS_SWITCH = `${ADVANCED_CONFIG_PREFIX}combatRatings.enabled`;
const DECK_SWITCH = `${ADVANCED_CONFIG_PREFIX}balance.equipment.startingDeck.enabled`;
// Drops that stay live with drops off: `consolationCinders` (paid for every
// boss once nothing drops), `requireFound` (ownership) and `permanentOnFind`
// (trader purchases) are read whether or not drops are on (review, #1260), so
// only the roll itself is gated.
const DROP_ROLL = /^gameConfig\.balance\.equipment\.drops\.(chance|rarityWeights|preferUnfound)(\.|$)/;
function enableGates(key, swapRuleIds = []) {
  const balance = `${ADVANCED_CONFIG_PREFIX}balance.`;
  if (key.startsWith(`${ADVANCED_CONFIG_PREFIX}combatRatings.`) && key !== RATINGS_SWITCH) return [{ key: RATINGS_SWITCH }];
  // The older poise meter, and the derived Poise rule, run only with ratings off.
  if (/^gameConfig\.(balance\.(poise|stagger)\.|derivedStatRules\.rules\.poise\.)/.test(key)) return [{ key: RATINGS_SWITCH, when: false }];
  // Formation movement's own rules do nothing while movement is off: a move is
  // refused before cost, selection or activation is read (formationMovement.js).
  // The shared selection colour stays live — it also marks cards and menus.
  if (/^gameConfig\.presentation\.(movementNeedsSelection|movementCostsAction|tileActivation|moveActivation)$/.test(key)) {
    return [{ key: `${ADVANCED_CONFIG_PREFIX}presentation.movementEnabled` }];
  }
  if (DROP_ROLL.test(key)) return [{ key: `${balance}equipment.drops.enabled` }];
  const mounts = `${balance}equipment.cardMounts.extraMounts`;
  if (key.startsWith(`${mounts}.`) && key !== `${mounts}.enabled`) return [{ key: `${mounts}.enabled` }];
  if (key.startsWith(`${balance}equipment.startingDeck.`) && key !== DECK_SWITCH) return [{ key: DECK_SWITCH }];
  if (key.startsWith(`${balance}equipment.roleCopies.`)) return [{ key: DECK_SWITCH, when: false }];
  if (key.startsWith(`${balance}equipment.swapCostByCategory.`)) return [{ key: 'swapCostRule', when: 'category' }];
  // The rule a `swapCostRules.<n>` row belongs to is read from the content by
  // index, so reordering the rules cannot gate the wrong row (review, #1260).
  const rule = key.match(/^gameConfig\.balance\.equipment\.swapCostRules\.(\d+)\./);
  if (rule && swapRuleIds[Number(rule[1])]) return [{ key: 'swapCostRule', when: swapRuleIds[Number(rule[1])] }];
  return [];
}

function withGates(rows, bundle) {
  const swapRuleIds = (bundle.balance?.equipment?.swapCostRules || []).map((rule) => rule.id);
  const owns = rows.filter((row) => row.own);
  const inheritedKey = (key) => {
    const rarity = key.match(/^gameConfig\.balance\.rewards\.rarityWeightsByClass\.[^.]+\.(.+)$/);
    if (rarity) return `${ADVANCED_CONFIG_PREFIX}balance.rewards.rarityWeights.${rarity[1]}`;
    if (/startingDeck\.classes\.[^.]+\.strikeBias$/.test(key)) return `${ADVANCED_CONFIG_PREFIX}balance.equipment.startingDeck.defaultStrikeBias`;
    return null;
  };
  return rows.map((row) => {
    // An override switch keeps its `own`, and also takes the gates of the row
    // it governs: a class's strike-bias switch does nothing while the starting
    // deck rules are off (Codex, on #1260).
    if (row.own) {
      const gates = [...enableGates(row.own.member, swapRuleIds), ...(row.gates || [])];
      return gates.length ? { ...row, gates } : row;
    }
    // THE SUBSYSTEM FIRST. When both are closed the screen names the first,
    // and "turn on its own switch" is the wrong advice while the whole feature
    // is off — that switch is itself disabled (Codex, on #1260).
    const gates = [...enableGates(row.key, swapRuleIds), ...(row.gate ? [row.gate] : [])];
    const owner = owns.find((toggle) => toggle.own.dropPath && (row.key === toggle.own.member || row.key.startsWith(`${toggle.own.member}.`)));
    if (owner) gates.push({ key: owner.key, own: owner.own, inheritedKey: inheritedKey(row.key) });
    return gates.length ? { ...row, gates } : row;
  });
}

export function advancedConfigRows(bundle) {
  const generated = leafRows(materializeCardValueBonuses(bundle).balance || {}, [], [], bundle).filter((row) => !row.searchPath.startsWith('ui.') && !LEGACY_BALANCE_PATHS.has(row.searchPath));
  return withGates([...combatRatingRows(bundle), ...startingStatRows(bundle), ...handRulesRows(bundle.attributes, bundle.classes), ...prologueRows(), ...progressionRows(bundle), ...explicitRows(bundle), ...presentationRows(), ...balanceOwnRows(bundle), ...generated], bundle);
}

/**
 * Every override switch's `own`, for the readers that must honour them.
 * Cached per bundle: `configuredContentBundle` asks on every call, and
 * rebuilding every row for it doubled that call's cost (review, #1260).
 */
const OWNS_BY_BUNDLE = new WeakMap();
export function advancedConfigOwns(bundle) {
  if (!OWNS_BY_BUNDLE.has(bundle)) OWNS_BY_BUNDLE.set(bundle, advancedConfigRows(bundle).filter((row) => row.own).map((row) => row.own));
  return OWNS_BY_BUNDLE.get(bundle);
}

export function advancedConfigSettings(settings = {}, additionalKeys = []) {
  const entries = withoutSupersededLegacy(Object.entries(settings).filter(([key]) => key.startsWith(ADVANCED_CONFIG_PREFIX)));
  if (settings.levelUpValue !== undefined) entries.push([`${ADVANCED_CONFIG_PREFIX}balance.levelUp.pointsPerLevel`, settings.levelUpValue]);
  for (const key of additionalKeys) {
    // `statTierSize` is the retired tier dial (ruleset 6); it is never exported.
    if (key === 'levelUpValue' || key === 'statTierSize' || settings[key] === undefined) continue;
    entries.push([`settings.${key}`, settings[key]]);
  }
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

export function advancedConfigSnapshot(settings = {}) {
  return Object.freeze({
    schemaVersion: ADVANCED_CONFIG_SCHEMA_VERSION,
    ratingsVersion: 1,
    overrides: advancedConfigSettings(settings),
  });
}

function cloneConfigurableBundle(bundle) {
  bundle = materializeCardValueBonuses(bundle);
  return {
    ...bundle,
    balance: structuredClone(bundle.balance),
    classes: bundle.classes.map((row) => structuredClone(row)),
    attributeRules: structuredClone(bundle.attributeRules),
    creationModes: structuredClone(bundle.creationModes),
    derivedStatRules: structuredClone(bundle.derivedStatRules),
  };
}

function setPath(target, path, value) {
  let cursor = target;
  for (let index = 0; index < path.length - 1; index += 1) cursor = cursor[path[index]];
  cursor[path[path.length - 1]] = value;
}

export function configuredContentBundle(bundle, settingsOrSnapshot = {}) {
  const raw = settingsOrSnapshot?.overrides || settingsOrSnapshot || {};
  // A specific value whose "uses its own" switch is off is not applied: the
  // global it would otherwise override decides (model/settingOverrides.js).
  const owns = advancedConfigOwns(bundle);
  const settings = withoutUnowned(raw, owns);
  const configured = cloneConfigurableBundle(bundle);
  // EQUIPMENT REQUIREMENTS RESOLVE FIRST, because every floor the starting-stat
  // dials are measured against is read off that table (kitAttributeMinimums).
  // Resolving them second would bound his pool by numbers his own settings had
  // already moved.
  applyEquipmentRequirementConfig(configured, bundle, settings);
  applyStartingStatConfig(configured, bundle, settings);
  const defaultPresets = structuredClone(configured.attributeRules.presets);
  const rows = advancedConfigRows(bundle);
  const byKey = new Map(rows.filter((row) => row.configPath).map((row) => [row.key, row]));
  const rowFor = (key) => rows.find((candidate) => candidate.key === key) || null;
  // A ROW WHOSE FEATURE IS SWITCHED OFF IS NOT APPLIED (Codex, on #1260). The
  // engine ignores it in that state and the screen disables it, so a stored
  // value there — even an invalid one — can neither be corrected nor be allowed
  // to refuse the whole configuration (which would fall back to authored
  // content and drop every unrelated setting). It is applied, and validated,
  // again the moment its switch is back on and the row is editable. Only gates
  // on configuration switches are read here: a profile-only switch (the swap
  // rule picker) is not in a run's snapshot to be read.
  // A snapshot from before combat ratings existed is played with ratings OFF
  // (see `ratingsVersion` below), whatever its settings say, so its gates are
  // read that way too — otherwise its poise and stagger tuning, which is in
  // force exactly then, would be set aside (review, #1260).
  const legacyRatings = Boolean(settingsOrSnapshot?.overrides) && settingsOrSnapshot.ratingsVersion !== 1;
  const gateSettings = legacyRatings ? { ...settings, [RATINGS_SWITCH]: false } : settings;
  const dormant = (row) => (row.gates || []).some((gate) => !gate.own
    && gate.key.startsWith(ADVANCED_CONFIG_PREFIX) && !gateOpen(gateSettings, gate, rowFor));
  const classesById = Object.fromEntries(configured.classes.map((row) => [row.id, row]));
  for (const [key, raw] of withoutSupersededLegacy(Object.entries(settings))) {
    const row = byKey.get(key);
    // AN INERT ROW IS NEVER APPLIED (review, #1256). It moved nothing, but a
    // stored value still landed in the bundle, where the structural walk could
    // refuse the WHOLE configuration over it (tierSizeMin 15 over tierSizeMax
    // 3) — naming a row no longer on screen. Retired preset cells are not
    // inert: a non-default mode's cells are still validated and applied.
    if (!row?.configPath || row.inert || dormant(row)) continue;
    const value = typeof row.def === 'boolean' ? raw === true : Number(raw);
    if (typeof row.def !== 'boolean' && !Number.isFinite(value)) continue;
    const root = row.configPath[0] === 'classesById'
      ? { classesById }
      : configured;
    setPath(root, row.configPath, value);
  }
  const xpMultiplier = Number(settings[`${ADVANCED_CONFIG_PREFIX}progression.xpMultiplier`]);
  if (Number.isFinite(xpMultiplier) && configured.balance.xp) {
    const xp = configured.balance.xp;
    for (const key of ['combatWin', 'quest']) if (Number.isFinite(xp[key])) xp[key] = Math.max(0, Math.round(xp[key] * xpMultiplier));
    for (const key of Object.keys(xp.kill || {})) xp.kill[key] = Math.max(0, Math.round(xp.kill[key] * xpMultiplier));
  }
  // Read through the legacy filter, so a run snapshot that still carries the
  // retired `rewardMultiplier` pays the authored table, never ×20.
  const cinderSetting = Object.fromEntries(withoutRetiredCinderKey(Object.entries(settings)))[CINDER_KEY];
  const rewardMultiplier = cinderSetting === undefined ? NaN : Number(cinderSetting);
  if (Number.isFinite(rewardMultiplier) && rewardMultiplier !== 1 && configured.balance.rewards?.cinders) {
    for (const range of Object.values(configured.balance.rewards.cinders)) {
      if (!Array.isArray(range)) continue;
      for (let index = 0; index < range.length; index += 1) range[index] = Math.max(0, Math.round(range[index] * rewardMultiplier));
    }
  }
  const pointsPerLevel = Number(settings[`${ADVANCED_CONFIG_PREFIX}balance.levelUp.pointsPerLevel`] ?? settings.levelUpValue);
  if (Number.isInteger(pointsPerLevel) && pointsPerLevel > 0) configured.balance.levelUp.pointsPerLevel = pointsPerLevel;
  const mode = configured.creationModes.find((row) => row.id === configured.attributeRules.defaultMode);
  if (mode) {
    // ONE BAD CLASS COSTS THAT CLASS, NOT THE BUNDLE. `defaultPresets` was
    // captured after the pool was applied, so the fallback is the pool-scaled
    // default and not the authored 35-point table — and the kit floor is
    // checked HERE because validateContent checks it in main.js, where a
    // failure discarded every configured value the owner had set.
    const needs = kitAttributeMinimums(configured);
    const expected = mode.baseline * configured.attributes.length + mode.bonusPool;
    const floor = mode.belowBaseline === 'forbid' ? Math.max(mode.minimum, mode.baseline) : mode.minimum;
    for (const classDef of configured.classes) {
      const preset = configured.attributeRules.presets[mode.id]?.[classDef.id];
      const values = configured.attributes.map((attribute) => preset?.[attribute.id]);
      const valid = values.every((value, index) => Number.isInteger(value)
        && value >= Math.max(floor, kitMinimum(needs, classDef.id, configured.attributes[index].id))
        && value <= mode.maximum)
        && values.reduce((sum, value) => sum + value, 0) === expected
        // ...and the ARMOUR creation offers the class, which validateContent
        // refuses on the same terms (presetGearProblems) and which the kit
        // floor above does not read. Without it Settings promised this class
        // its authored attributes while the boot threw every setting away
        // (review, #1255).
        && !presetGearProblems({
          presets: { [mode.id]: { [classDef.id]: preset } },
          defaultMode: mode.id,
          startingKits: [],
          equipmentRequirements: configured.equipment?.equipmentRequirements || [],
          creationClasses: configured.characterCreation?.classes || {},
        }).length;
      if (!valid) configured.attributeRules.presets[mode.id][classDef.id] = structuredClone(defaultPresets[mode.id][classDef.id]);
    }
  }
  configured.balance.combatRatings = resolveCombatRatings(settings, bundle);
  if (legacyRatings) configured.balance.combatRatings.enabled = false;
  // THE ITEM'S RATINGS RIDE ON THE ITEM, and only while the ratings system is
  // switched on. Written HERE, after that decision, for two reasons: the
  // requirement pass above restates both equipment arrays, so columns written
  // before it would be handed to a map that replaces the rows; and a set's
  // Poise threshold is also its WEIGHT, so a run with ratings off — a fresh
  // one, or an older snapshot the line above disables — would otherwise have
  // its equip load moved by a dial that changes nothing else (review, #1242).
  if (configured.balance.combatRatings.enabled) {
    applyItemRatingConfig(configured, bundle, migrateCombatRatingSettings(settings, bundle));
  }
  // A per-class value switched off leaves the class following the global:
  // drop its entry and the engine's own fallback applies.
  for (const own of owns) {
    if (!own.dropPath || ownOn(raw, own)) continue;
    const parent = own.dropPath.slice(0, -1).reduce((node, key) => node?.[key], configured);
    if (parent && typeof parent === 'object') delete parent[own.dropPath.at(-1)];
  }
  return configured;
}

// A cross-field problem names its own path ("balance.rewards.cinders.normal
// must keep its first value at or below its second"), and that path IS the row
// key once `gameConfig.` is put back on the front. A two-value range is two
// rows, so both ends are addressed. Anything that is not a balance path — the
// hand rules, the combat ratings — keeps the banner alone.
function structuralKeys(message) {
  const path = /^(balance\.[A-Za-z0-9_.]+)/.exec(message)?.[1];
  if (!path) return [];
  const base = `${ADVANCED_CONFIG_PREFIX}${path}`;
  return [base, `${base}.0`, `${base}.1`];
}

/**
 * advancedConfigProblemRows(bundle, settings) → [{ keys, message }]
 *
 * THE SAME SENTENCES, NOW ADDRESSED. They used to reach the screen as one
 * notice at the top of Settings — true, but not attached to the row that
 * caused it, so "which number is it refusing?" was a guess. Each entry now
 * carries the keys of the rows it is about; `advancedConfigProblems` keeps the
 * old string list for callers that only want the first sentence.
 */
export function advancedConfigProblemRows(bundle, settings = {}) {
  const problems = [...startingStatPoolProblems(bundle, settings),
    ...derivedStatFloorProblems(configuredContentBundle(bundle, settings)).map(({ keys, message }) => ({ keys, message }))];
  const poolDefaults = configuredContentBundle(bundle, Object.fromEntries(Object.entries(settings).filter(([key]) => !key.startsWith('gameConfig.attributeRules.presets.'))));
  const modeId = poolDefaults.attributeRules.defaultMode;
  const mode = poolDefaults.creationModes.find((row) => row.id === modeId);
  if (!mode) return problems;
  // The floor a class cell is judged against is the CONFIGURED one: he can now
  // lower what a starting kit asks for, and a cell refused against the authored
  // table would be refused for a requirement no run would ever enforce.
  const withEquipment = bundleWithConfiguredEquipment(bundle, settings);
  const needs = kitAttributeMinimums(withEquipment);
  const floor = mode.belowBaseline === 'forbid' ? Math.max(mode.minimum, mode.baseline) : mode.minimum;
  const expected = mode.baseline * bundle.attributes.length + mode.bonusPool;
  const cellKey = (classId, attributeId) => `${ADVANCED_CONFIG_PREFIX}attributeRules.presets.${modeId}.${classId}.${attributeId}`;
  const edited = {};
  for (const classDef of bundle.classes) {
    const values = bundle.attributes.map((attribute) => {
      return Number(settings[cellKey(classDef.id, attribute.id)] ?? poolDefaults.attributeRules.presets[modeId][classDef.id][attribute.id]);
    });
    edited[classDef.id] = Object.fromEntries(bundle.attributes.map((attribute, index) => [attribute.id, values[index]]));
    const outside = bundle.attributes.filter((attribute, index) => !Number.isInteger(values[index])
      || values[index] < floor || values[index] > mode.maximum);
    const total = values.reduce((sum, value) => sum + value, 0);
    if (outside.length || total !== expected) {
      // Name the cells, not just the rule. "must each be 3-12" over twenty
      // rows is a rule; "Wisdom 16 is outside it" is the row he has to move.
      const named = outside.length
        ? ` ${outside.map((attribute) => `${attribute.label} ${values[bundle.attributes.indexOf(attribute)]}`).join(', ')} ${outside.length === 1 ? 'is' : 'are'} outside that range.`
        : '';
      problems.push({
        keys: bundle.attributes.map((attribute) => cellKey(classDef.id, attribute.id)),
        message: `${classDef.name}: starting attributes must each be ${floor}–${mode.maximum} and total ${expected}; current total ${total}.${named} Authored defaults stay active until the set is valid.`,
      });
    }
    // The kit floor, said per cell, because that is the row he has to move.
    bundle.attributes.forEach((attribute, index) => {
      const need = needs[classDef.id]?.[attribute.id];
      if (!need || !(values[index] < need.minimum)) return;
      problems.push({
        keys: [cellKey(classDef.id, attribute.id)],
        message: `${classDef.name}: ${attribute.label} ${values[index]} is below the ${need.minimum} the ${need.kit} kit ('${need.itemId}') this class starts in asks for. ${classDef.name} keeps its authored attributes until it can hold its own kit; every other setting you changed is still applied.`,
      });
    });
  }
  // THE SAME QUESTION THE BOOT ASKS, for the half the kit floor above does
  // not reach. kitAttributeMinimums reads the baseline kit's two hands;
  // validateContent also refuses a preset that cannot hold the ARMOUR
  // creation offers that class, and main.js answers that refusal by throwing
  // away the WHOLE game configuration — every unrelated Advanced setting with
  // it — behind a generic "unchanged" notice, while this row read as applied.
  // Asking it here means the edit is refused where it is made, in words. The
  // kits are passed empty so the hands are said once, by the cell check above,
  // and the minima are the CONFIGURED ones for the same reason the kit floor
  // reads them: the boot validates the configured bundle, so judging armour
  // against the authored table would refuse a preset a lowered minimum admits
  // and pass one a raised minimum then fails (review, #1217 and #1255).
  const byName = new Map(bundle.classes.map((row) => [row.id, row.name || row.id]));
  for (const problem of presetGearProblems({
    presets: { [modeId]: edited },
    defaultMode: modeId,
    startingKits: [],
    equipmentRequirements: (withEquipment.equipment || {}).equipmentRequirements || [],
    creationClasses: (withEquipment.characterCreation || {}).classes || {},
  })) {
    const [, , , classId, attributeId] = problem.path.split('.');
    const attributeLabel = bundle.attributes.find((row) => row.id === attributeId)?.label || attributeId;
    problems.push({
      keys: [cellKey(classId, attributeId)],
      message: `${byName.get(classId) || classId}: ${attributeLabel} ${problem.msg}. Authored defaults stay active until the set is valid.`,
    });
  }
  return [...problems, ...advancedConfigStructuralProblems(bundle, settings).map((message) => ({ keys: structuralKeys(message), message }))];
}

export function advancedConfigProblems(bundle, settings = {}) {
  const seen = new Set();
  return advancedConfigProblemRows(bundle, settings)
    .map((problem) => problem.message)
    .filter((message) => !seen.has(message) && seen.add(message));
}

export function advancedConfigStructuralProblems(bundle, settings = {}) {
  const configured = configuredContentBundle(bundle, settings);
  // DORMANT RATINGS ARE NOT JUDGED (Codex, on #1260). With ratings off their
  // rows are disabled — so an invalid pair there could neither be fixed nor
  // stop refusing the whole configuration, which then fell back to authored
  // content with ratings ON. They are judged again the moment ratings are
  // switched back on, when the rows are editable.
  const ratings = resolveCombatRatings(settings, bundle);
  const problems = [...handRulesSettingsProblems(settings), ...(ratings.enabled ? combatRatingProblems(ratings) : [])];
  const walk = (value, path = []) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      if (value.length === 2 && value.every(Number.isFinite) && value[0] > value[1]) {
        problems.push(`${path.join('.')} must keep its first value at or below its second value.`);
      }
      value.forEach((child, index) => walk(child, [...path, String(index)]));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (!ratings.enabled && path.length === 1 && key === 'combatRatings') continue;
      if (key.endsWith('Min')) {
        const maxKey = `${key.slice(0, -3)}Max`;
        if (Number.isFinite(child) && Number.isFinite(value[maxKey]) && child > value[maxKey]) {
          problems.push(`${[...path, key].join('.')} must stay at or below ${[...path, maxKey].join('.')}.`);
        }
      }
      walk(child, [...path, key]);
    }
  };
  walk(configured.balance, ['balance']);
  return problems;
}

export function presentationConfig(settings = {}) {
  const values = { ...PRESENTATION_DEFAULTS };
  for (const row of presentationRows()) {
    if (!(row.key in settings)) continue;
    const raw = settings[row.key];
    if (row.type === 'choice') {
      const normalized = row.legacyChoices?.[raw] ?? raw;
      if (row.choices.includes(normalized)) values[row.presentationKey] = normalized;
    } else if (row.type === 'color') {
      if (typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw)) values[row.presentationKey] = raw;
    } else if (typeof row.def === 'boolean') {
      values[row.presentationKey] = raw === true;
    } else {
      const number = Number(raw);
      if (Number.isFinite(number)) values[row.presentationKey] = Math.min(row.max, Math.max(row.min, row.integer ? Math.round(number) : number));
    }
  }
  return values;
}

export function advancedConfigExport(settings = {}, build = {}, additionalKeys = []) {
  return JSON.stringify({
    schemaVersion: ADVANCED_CONFIG_SCHEMA_VERSION,
    game: 'Ashen Spire',
    build,
    overrides: advancedConfigSettings(settings, additionalKeys),
  }, null, 2) + '\n';
}

/**
 * A ROW'S FLOOR MOVED, AND HIS FILE PREDATES IT.
 *
 * `parseAdvancedConfigFile` is all-or-nothing on purpose: a file that half
 * applies is worse than one that does not. But two floors were raised while the
 * schema version stayed at 1 — the character's total points (the attribute
 * count → the kit floor) and each class's attribute cells (1 → the kit
 * minimum) — so values that imported last week now abort the entire file and
 * take every unrelated setting with them.
 *
 * Refusing the value is still right. This decides what refusing it COSTS:
 *   · the total is CLAMPED to the floor, because the class tables rescale to
 *     whatever total stands and a clamped total is a working one;
 *   · a class's attribute cells are SKIPPED AS A SET, because raising one cell
 *     to its kit floor would break the set's total and fail validation anyway —
 *     that class keeps its authored table, and every other class still imports.
 * Both say so by name in `warnings`, which the import door shows.
 */
function tolerateRaisedFloors(entries, rows, warnings) {
  const skippedGroups = new Set();
  const kept = [];
  for (const [key, raw] of entries) {
    const row = rows.get(key);
    const floor = row?.raisedFloor;
    if (!floor || typeof raw !== 'number' || !Number.isFinite(raw) || raw >= row.min) { kept.push([key, raw]); continue; }
    if (floor.clamp) {
      warnings.push(`${row.label}: ${raw} is below the ${row.min} this version requires and was raised to ${row.min}. Everything else in the file was imported.`);
      kept.push([key, row.min]);
    } else {
      skippedGroups.add(floor.group);
      warnings.push(`${row.label}: ${raw} is below the ${row.min} this class's starting kit asks for, so its attribute table was left as authored. Everything else in the file was imported.`);
    }
  }
  // A skipped class is skipped WHOLE: one cell below its kit floor invalidates
  // the set's total, so leaving its siblings in would fail validation anyway.
  return kept.filter(([key]) => !skippedGroups.has(rows.get(key)?.floorGroup));
}

export function parseAdvancedConfigFile(text, bundle, current = {}, additionalRows = [], warnings = []) {
  if (typeof text !== 'string' || text.length > 1024 * 1024) throw new Error('Choose a settings JSON file smaller than 1 MB.');
  let file;
  try { file = JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
  if (file?.kind === 'AshenSpire prologue art') file = { schemaVersion: ADVANCED_CONFIG_SCHEMA_VERSION, game: 'Ashen Spire', overrides: prologuePresetOverrides(file) };
  if (!file || file.game !== 'Ashen Spire' || file.schemaVersion !== ADVANCED_CONFIG_SCHEMA_VERSION
    || !file.overrides || typeof file.overrides !== 'object' || Array.isArray(file.overrides)) {
    throw new Error('Choose an Ashen Spire configuration exported by this version.');
  }
  const rows = new Map(advancedConfigRows(bundle).map(row => [row.key, row]));
  for (const row of additionalRows) {
    if (!['button', 'action'].includes(row.type)) rows.set(`settings.${row.key}`, row);
    if (row.key === 'levelUpValue') rows.set('gameConfig.balance.levelUp.pointsPerLevel', row);
  }
  const changes = {};
  // A file exported before the per-item rows became the item's own ratings
  // carries `combatRatings.bonuses.<item>.<rating>`; `migrateCombatRatingSettings`
  // reads each as the value it used to make. Done HERE, at the door, because
  // the next line refuses an unknown key by aborting the whole file.
  const overrides = migrateCombatRatingSettings(file.overrides, bundle, warnings);
  // The retired Cinder multiplier is dropped by withoutSupersededLegacy below,
  // before an unknown key could refuse the file; said here, once.
  if (Object.keys(overrides).some((key) => LEGACY_CINDER_KEYS.includes(key))) warnings.push(LEGACY_CINDER_WARNING);
  for (const [key, raw] of tolerateRaisedFloors(withoutRetired(withoutSupersededLegacy(Object.entries(overrides)), warnings), rows, warnings)) {
    const row = rows.get(key);
    if (!row) throw new Error(`Unknown setting: ${key}. Nothing was imported.`);
    const value = row.type === 'choice' && Object.hasOwn(row.legacyChoices || {}, raw) ? row.legacyChoices[raw] : raw;
    let valid = false;
    if (row.type === 'choice') valid = row.choices.includes(value);
    else if (['color', 'colorSwatch'].includes(row.type)) valid = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    else if (typeof row.def === 'boolean') valid = typeof value === 'boolean';
    else if (['number', 'range'].includes(row.type) || typeof row.def === 'number') {
      valid = typeof value === 'number' && Number.isFinite(value)
        && value >= (row.min ?? 0) && value <= (row.max ?? 100)
        && (!row.integer || Number.isInteger(value));
    } else if (typeof row.def === 'string') valid = typeof value === 'string' && value.length <= (row.maxLength ?? 1000);
    if (!valid) throw new Error(`Invalid value for ${row.label || key}. Nothing was imported.`);
    changes[row.key] = value;
  }
  const problems = advancedConfigProblems(bundle, { ...current, ...changes });
  if (problems.length) throw new Error(`Nothing was imported. ${problems[0]}`);
  return changes;
}
