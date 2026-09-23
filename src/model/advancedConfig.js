import { prologueRows, prologuePresetOverrides, migratePrologueSettingKey, migratePrologueEntries } from './prologue.js';
// Advanced game configuration is a sparse overlay on authored content.
// The authored bundle remains the default; only keys present in profile
// settings are projected into a fresh bundle for a new run.

import { handRulesRows, handRulesSettingsProblems } from './handRules.js';
import {
  startingStatRows, applyStartingStatConfig, kitAttributeMinimums, kitMinimum,
  startingStatPoolProblems, applyEquipmentRequirementConfig, bundleWithConfiguredEquipment,
} from './startingStatConfig.js';
import { combatRatingRows, resolveCombatRatings, combatRatingProblems, applyItemRatingConfig, migrateCombatRatingSettings, hasLegacyItemRatingSettings } from './combatRatings.js';
import { FORMATION_DEFAULTS, FORMATION_FIELDS, FORMATION_PRESETS, FORMATION_ROWS } from './formationLayout.js';
export const ADVANCED_CONFIG_PREFIX = 'gameConfig.';
export const ADVANCED_CONFIG_SCHEMA_VERSION = 1;

const PRESENTATION_DEFAULTS = Object.freeze({
  ...FORMATION_DEFAULTS,
  playerSpriteScale: 0.9,
  enemySpriteScale: 0.9,
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
  playerGridColor: '#d5cc63', enemyGridColor: '#e1a679',
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
const BALANCE_DOMAINS = Object.freeze({
  'rest.hpSmallPct': PERCENT,
  'rest.hpPartialPct': PERCENT,
  'rest.mana.floorPct': PERCENT,
  'atlas.townsPerActMax': Object.freeze({ min: 1 }),
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
  const migrated = migrateCombatRatingSettings(settings, bundle, warnings);
  if (migrated === settings) return settings;
  for (const key of Object.keys(settings)) if (!Object.hasOwn(migrated, key)) delete settings[key];
  Object.assign(settings, migrated);
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
const RETIRED_KEYS = /^(settings\.)?gameConfig\.(startingStats\.autoScale|combatRatings\.ratings\.(ar|dr|pr|poise|ward)\.(pointsPerIncrease|gain|multiplier))$/;

function withoutRetired(entries, warnings) {
  const kept = entries.filter(([key]) => !RETIRED_KEYS.test(key));
  if (kept.length !== entries.length) {
    warnings.push('Per-rating tiers and multipliers were replaced by direct attribute weights and one global multiplier. Retired entries were skipped; everything else in the file was imported.');
  }
  return kept;
}

function withoutSupersededLegacy(entries) {
  const present = new Set(entries.map(([key]) => key));
  // The opening's per-scene keys used to be POSITIONAL, and the scenes moved.
  // They are translated by scene id before anything looks a row up, so an
  // exported file written before the reorder still imports, and lands on the
  // scene it was written for. See migratePrologueEntries.
  return migratePrologueEntries(entries
    .filter(([key]) => !(key in LEGACY_BALANCE_KEYS) || !present.has(LEGACY_BALANCE_KEYS[key]))
    .map(([key, value]) => [LEGACY_BALANCE_KEYS[key] ?? key, value]));
}

// ONE TAB PER SUBJECT (owner, 2026-09-23: "settings duplicated in multiple
// sections making it hard to tell which does what"). The catch-all "Rules" tab
// held skills, talents, relics, XP, rest and co-op side by side, each of which
// has a real home elsewhere; it is gone, and anything not named here falls to
// Combat, the tab for rules of play.
//   - the legacy poise meter sits in Stats & Defence beside the ratings rows
//     that replace it while ratings are on;
//   - the fallback hand size sits in Hand & Draw beside the capacity in force;
//   - character XP, skills and talents are Progression;
//   - equipment and relic values are one Equipment tab;
//   - how a run is built — rest, the atlas, seats, run modifiers, gauntlet,
//     co-op, endless — is World.
function balanceGroup(path) {
  if (/^(poise|stagger)\./.test(path)) return 'Ratings & Resistance';
  if (path === 'handMax') return 'Hand & Draw';
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
// Stat conversions offers "Actions — base amount" and "Draw — base amount".
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
  'levelUp.tierSizeMin',
  'levelUp.tierSizeMax',
  ...['hp', 'damage', 'block', 'poise'].flatMap((stat) => ['perLevel', 'min', 'max']
    .map((leaf) => `levels.enemyScaling.${stat}.${leaf}`)),
  'equipment.swapAllowancePerTurn',
]);

// A note a player can act on, for the rows whose own name is not enough. The
// rest get "Applies to a new run.", which is what the screen used to paste
// over the engine's spelling anyway.
const BALANCE_NOTES = Object.freeze({
  // `combat.js` uses this ONLY when no hand rules are handed in, and the
  // shipped game always hands them in (`main.js` resolves them for every
  // fight), so the live capacity is Advanced → Hand & Draw → Hand capacity.
  // Saying so is the difference between a fallback and a second answer.
  handMax: 'Fallback hand capacity, used only when hand rules are unavailable.'
    + ' The capacity a fight actually uses is Hand & Draw → Hand capacity → Base hand capacity.',
  // THE LEGACY POISE METER. `dealPoiseDamage` hands every hit to the ratings
  // path while combat ratings are on (engine/actions.js), so these rows are
  // live only with Stats & Defence → General → "Enable ratings, Poise & Ward"
  // off. They sit beside the rows that replace them, and say which.
  'stagger.player.actionLoss': 'Only while combat ratings are off. With ratings on, Breaks → Poise action loss sets this.',
  'stagger.player.statuses.vulnerable': 'Only while combat ratings are off. With ratings on, a break costs actions and applies no status.',
  'stagger.player.statuses.weak': 'Only while combat ratings are off. With ratings on, a break costs actions and applies no status.',
  'poise.growthMult': 'Only while combat ratings are off. With ratings on, Breaks → Break threshold multiplier sets this.',
  'poise.playerImpactPerHit': 'Only while combat ratings are off. With ratings on, the Impact rows set how much each hit fills the meter.',
  'poise.onFill.0.stacks': 'Only while combat ratings are off. With ratings on, a break skips the enemy’s next turn instead.',
  // THE SWAP-COST NUMBERS the "Weapon swap cost" picker chooses between. The
  // picker is the control; these say which rule each number belongs to, so
  // turning a `gear` flag is not mistaken for picking a rule.
  'equipment.swapCost': 'Base swap cost under the Flat and Talisman & relic rules, and for a weapon no category matches. The rule itself is “Weapon swap cost” above.',
  'equipment.swapCostRules.0.gear': 'Flat rule: also apply talisman and relic modifiers. On makes Flat the same as Talisman & relic — pick the rule with “Weapon swap cost” instead.',
  'equipment.swapCostRules.1.gear': 'Talisman & relic rule: apply talisman and relic modifiers. Off makes it the same as Flat.',
  'equipment.swapCostRules.2.gear': 'Weapon category rule: also apply talisman and relic modifiers.',
  'equipment.swapCostByCategory.0.cost': 'Swap cost for a heavy weapon, under the Weapon category rule only.',
  'equipment.swapCostByCategory.1.cost': 'Swap cost for a flourish weapon, under the Weapon category rule only.',
  flaskCapacity: 'Each class’s HP flasks plus Mana flasks (Progression → the class) must add up to this, or a new run is refused. Applies to a new run.',
});

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
  const leaf = labelSegment(path[path.length - 1], true);
  const context = path.slice(0, -1).map((part) => labelSegment(part));
  return context.length ? `${context.join(' · ')} — ${leaf}` : leaf;
}

function leafRows(value, path = [], rows = []) {
  if (typeof value === 'number' || typeof value === 'boolean') {
    const joined = path.join('.');
    const domain = typeof value === 'number' ? { ...numberDomain(value), ...(BALANCE_DOMAINS[joined] || {}) } : {};
    rows.push({
      cat: 'Advanced',
      advancedGroup: balanceGroup(joined),
      key: `${ADVANCED_CONFIG_PREFIX}balance.${joined}`,
      type: typeof value === 'number' ? 'number' : undefined,
      def: value,
      ...domain,
      label: balanceLabel(path),
      note: (Object.hasOwn(BALANCE_NOTES, joined) && BALANCE_NOTES[joined]) || 'Applies to a new run.',
      configPath: ['balance', ...path],
      searchPath: joined,
      ...(RETIRED_BALANCE_PATHS.has(joined) ? { retired: true } : {}),
    });
    return rows;
  }
  if (!value || typeof value !== 'object') return rows;
  for (const [key, child] of Object.entries(value)) leafRows(child, [...path, key], rows);
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
        note: `Starting ${attribute.label.toLowerCase()} for ${classLabel}. The class's attributes must total the character's points, set under Assign points.`
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
      // derived HP rule (Stat conversions → HP), so the row moved nothing. The
      // key stays so an exported configuration carrying it still imports.
      retired: true,
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
  { key: 'settingsWidthPercent', label: 'Settings window width', min: 60, max: 100, step: 1, integer: true, suffix: '%', note: 'How much of the safe viewport the Settings window may use.' },
  { key: 'settingsHeightPercent', label: 'Settings window height', min: 60, max: 100, step: 1, integer: true, suffix: '%', note: 'How much of the safe viewport the Settings window may use.' },
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
      cat: 'Advanced', advancedGroup: 'Rewards', type: 'number', integer: false, step: 0.05,
      min: 0, max: 20, def: 1,
      key: `${ADVANCED_CONFIG_PREFIX}progression.rewardMultiplier`,
      label: 'Cinder gain multiplier',
      note: 'Multiply Cinders earned from combat rewards. 1 keeps authored rewards. Applies to a new run.',
      specialKey: 'rewardMultiplier', searchPath: 'progression experience exp cinder reward gain multiplier',
    },
  ];
}

const LEGACY_BALANCE_PATHS = new Set([
  'levelUp.pointsPerLevel',
]);

export function advancedConfigRows(bundle) {
  const generated = leafRows(bundle.balance || {}).filter((row) => !row.searchPath.startsWith('ui.') && !LEGACY_BALANCE_PATHS.has(row.searchPath));
  return [...combatRatingRows(bundle), ...startingStatRows(bundle), ...handRulesRows(bundle.attributes), ...prologueRows(), ...progressionRows(bundle), ...explicitRows(bundle), ...presentationRows(), ...generated];
}

export function advancedConfigSettings(settings = {}, additionalKeys = []) {
  const entries = withoutSupersededLegacy(Object.entries(settings).filter(([key]) => key.startsWith(ADVANCED_CONFIG_PREFIX)));
  if (settings.levelUpValue !== undefined) entries.push([`${ADVANCED_CONFIG_PREFIX}balance.levelUp.pointsPerLevel`, settings.levelUpValue]);
  if (settings.statTierSize !== undefined) entries.push([`${ADVANCED_CONFIG_PREFIX}derivedStatRules.defaults.pointsPerTier`, settings.statTierSize]);
  for (const key of additionalKeys) {
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
  const settings = settingsOrSnapshot?.overrides || settingsOrSnapshot || {};
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
  const classesById = Object.fromEntries(configured.classes.map((row) => [row.id, row]));
  for (const [key, raw] of withoutSupersededLegacy(Object.entries(settings))) {
    const row = byKey.get(key);
    if (!row?.configPath) continue;
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
  const rewardMultiplier = Number(settings[`${ADVANCED_CONFIG_PREFIX}progression.rewardMultiplier`]);
  if (Number.isFinite(rewardMultiplier) && configured.balance.rewards?.cinders) {
    for (const range of Object.values(configured.balance.rewards.cinders)) {
      if (!Array.isArray(range)) continue;
      for (let index = 0; index < range.length; index += 1) range[index] = Math.max(0, Math.round(range[index] * rewardMultiplier));
    }
  }
  const pointsPerLevel = Number(settings[`${ADVANCED_CONFIG_PREFIX}balance.levelUp.pointsPerLevel`] ?? settings.levelUpValue);
  if (Number.isInteger(pointsPerLevel) && pointsPerLevel > 0) configured.balance.levelUp.pointsPerLevel = pointsPerLevel;
  const pointsPerTier = Number(settings[`${ADVANCED_CONFIG_PREFIX}derivedStatRules.defaults.pointsPerTier`] ?? settings.statTierSize);
  if (Number.isInteger(pointsPerTier) && pointsPerTier > 0) configured.derivedStatRules.defaults.pointsPerTier = pointsPerTier;
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
        && values.reduce((sum, value) => sum + value, 0) === expected;
      if (!valid) configured.attributeRules.presets[mode.id][classDef.id] = structuredClone(defaultPresets[mode.id][classDef.id]);
    }
  }
  configured.balance.combatRatings = resolveCombatRatings(settings, bundle);
  if (settingsOrSnapshot.overrides && settingsOrSnapshot.ratingsVersion !== 1) configured.balance.combatRatings.enabled = false;
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
  const problems = [...startingStatPoolProblems(bundle, settings)];
  const poolDefaults = configuredContentBundle(bundle, Object.fromEntries(Object.entries(settings).filter(([key]) => !key.startsWith('gameConfig.attributeRules.presets.'))));
  const modeId = poolDefaults.attributeRules.defaultMode;
  const mode = poolDefaults.creationModes.find((row) => row.id === modeId);
  if (!mode) return problems;
  // The floor a class cell is judged against is the CONFIGURED one: he can now
  // lower what a starting kit asks for, and a cell refused against the authored
  // table would be refused for a requirement no run would ever enforce.
  const needs = kitAttributeMinimums(bundleWithConfiguredEquipment(bundle, settings));
  const floor = mode.belowBaseline === 'forbid' ? Math.max(mode.minimum, mode.baseline) : mode.minimum;
  const expected = mode.baseline * bundle.attributes.length + mode.bonusPool;
  const cellKey = (classId, attributeId) => `${ADVANCED_CONFIG_PREFIX}attributeRules.presets.${modeId}.${classId}.${attributeId}`;
  for (const classDef of bundle.classes) {
    const values = bundle.attributes.map((attribute) => {
      return Number(settings[cellKey(classDef.id, attribute.id)] ?? poolDefaults.attributeRules.presets[modeId][classDef.id][attribute.id]);
    });
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
  const problems = [...handRulesSettingsProblems(settings), ...combatRatingProblems(resolveCombatRatings(settings, bundle))];
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
    if (row.key === 'statTierSize') rows.set('gameConfig.derivedStatRules.defaults.pointsPerTier', row);
  }
  const changes = {};
  // A file exported before the per-item rows became the item's own ratings
  // carries `combatRatings.bonuses.<item>.<rating>`; `migrateCombatRatingSettings`
  // reads each as the value it used to make. Done HERE, at the door, because
  // the next line refuses an unknown key by aborting the whole file.
  const overrides = migrateCombatRatingSettings(file.overrides, bundle, warnings);
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

export async function saveAdvancedConfigFile(settings, options = {}) {
  return saveJsonFile(advancedConfigExport(settings, options.build || {}, options.includeKeys || []), options);
}

/**
 * saveJsonFile(text, options) → the Save As door, then the download fallback.
 *
 * Extracted from `saveAdvancedConfigFile` when the opening grew a file of its
 * own: two exports, one set of browser quirks. The caller decides what the
 * bytes are and what the file is called; this only decides how it leaves.
 */
export async function saveJsonFile(text, options = {}) {
  const win = options.window || globalThis.window;
  const doc = options.document || globalThis.document;
  const filename = options.filename || 'ashen-spire-game-config.json';
  if (win && typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: options.description || 'Ashen Spire game configuration', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return { ok: true, method: 'save-as', filename };
    } catch (error) {
      if (error?.name !== 'AbortError') console.warn('Game configuration Save As failed; using browser download.', error);
    }
  }
  if (!doc || !win?.URL) return { ok: false, method: 'unavailable', filename };
  const blob = new Blob([text], { type: 'application/json' });
  const url = win.URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 0);
  return { ok: true, method: 'download', filename };
}
