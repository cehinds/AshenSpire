// src/model/derivedStats.js — pure post-Phase-1 derived-stat rules.
//
// This module accepts an attribute allocation; it does not import, create or
// mutate one. That is the dependency seam which lets Phase 1 land first. It
// likewise has no run, combat, save, session or UI imports.
//
// The one import is the disclosure vocabulary (D26), which is itself
// import-free: the tier a row is authored into is checked here, beside the row
// it belongs to, rather than in a second validator that could drift.

import { disclosureProblem } from './disclosure.js';

// ---- ONE FORMAT FOR EVERY STAT AND RESOURCE (owner, 2026-09-21) ------------
//
// His words: "make mp hp and every resource now a similar calculation to AR,
// PR, DR, etc. I'll just use decimal values to set the growth per level, in
// fact I'd like all the resources and stats to be in the same format so that
// there was no confusion to include the base values and everything because
// they are way too separated."
//
// RULESET 6 IS THAT FORMAT. A row is the combat-rating row (model/
// ratingFormula.js — AR, DR, PR, Poise, Ward) with a level term on it, and
// nothing else:
//
//   base           what the row is worth before a single point is spent
//   <attributeId>  this attribute's DECIMAL contribution per point, floored on
//                  its own exactly as a rating's term is. Absent is 0, so a
//                  row names only the attributes it answers to.
//   perLevel       DECIMAL growth per character level — his sentence
//   cap            as before
//
// value = base + Σ floor(attribute × weight) + floor((level − 1) × perLevel)
//
// NO TIERS, NO GAIN. A ruleset-6 row cannot state `pointsPerIncrease`, `gain`,
// `rounding` or `perLevelEvery`. Those four exist only as CARRIERS: a
// ruleset 1–5 save's `{ sourceStat, pointsPerTier, gainPerTier, perLevel:
// { every, gain } }` normalizes onto them so its maxima do not move a point
// (the run door refuses a save whose persisted maximum disagrees with its
// snapshot), and the Advanced "Stat points per tier" dial still arrives as a
// layer that sets `pointsPerIncrease` on every row. An authored row that spells
// one is refused by name.
//
// EVERY ROW THIS ENGINE HANDS OUT IS RULESET-6 SHAPED, whatever version it was
// authored or saved in. Rulesets 1–5 are read at the door (their own shape,
// their own validator) and normalized ONCE, here, so no consumer downstream
// carries a second vocabulary — which is the whole of "they are way too
// separated" said in code.
export const DERIVED_STAT_IDS = Object.freeze(['energy', 'draw', 'hp', 'stamina', 'mana', 'poise',
  'openingHand', 'handSize', 'ar', 'dr', 'pr', 'ward']);
// ---- RULESET 7: EVERY STAT IS A ROW OF THIS TABLE (owner, 2026-09-24) -------
//
// "I'd like all features, handsize, draw amount, actions, ar, dr, pr, ward,
// poise, stamina, mana, hp settings to have a similiar interface and be driven
// by only that interface."
//
// Ruleset 7 adds the hand (opening hand, per-turn draw, hand size) and the
// combat ratings (AR, DR, PR, Ward) to the table the pools already lived in, so
// there is ONE row shape, ONE formula (`statRowValue` below) and ONE settings
// editor for all twelve. The three homes this retires — the rating formula's
// `ratings.<id>` + global `multiplier`, the hand rules' single-stat
// `{ statEnabled, stat, baseline, pointsPerCard, minimum, maximum }` groups, and
// the balance fallback hand size — survive only as LEGACY ADAPTERS (model/statRows.js) that
// turn a ruleset 1–6 run's own numbers into rows with carrier fields, so an old
// save is priced exactly as it always was.
export const HAND_STAT_IDS = Object.freeze(['openingHand', 'draw', 'handSize']);
export const RATING_STAT_IDS = Object.freeze(['ar', 'dr', 'pr', 'poise', 'ward']);
export const STAT_ROW_RULESET_VERSION = 7;
const RULESET_7_ONLY = new Set(['openingHand', 'handSize', 'ar', 'dr', 'pr', 'ward']);
// POISE BECAME A DERIVED ROW IN RULESET 5 (plan phase 9). Every ruleset before
// it snapshotted five rows, and those snapshots are restored through this same
// door, so the required set is a function of the version rather than a
// constant: asking a version-4 save for a Poise row would archive it.
export function derivedStatIdsFor(rulesetVersion) {
  const version = Number(rulesetVersion) || 0;
  return DERIVED_STAT_IDS.filter((id) => (id !== 'poise' || version >= 5) && (!RULESET_7_ONLY.has(id) || version >= 7));
}
export const DERIVED_STAT_ROUNDING = Object.freeze(['floor', 'ceil', 'round']);
// v1 is readable only so an unreleased class-base Mana snapshot can migrate to
// v2. New snapshots always use the authored v2 table.
export const DERIVED_STAT_RULESET_VERSIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
/** The first ruleset written in the one format above. */
export const UNIFIED_RULESET_VERSION = 6;
export const DERIVED_STAT_SNAPSHOT_VERSION = 3;
export const DERIVED_STAT_SNAPSHOT_VERSIONS = Object.freeze([1, 2, 3]);

const ROOT_FIELDS = ['rulesetVersion', 'defaults', 'rules', 'presentation'];
const PRESENTATION_FIELDS = ['label', 'faceLabel', 'order', 'disclosure', 'sense'];
const DEFAULT_FIELDS = ['pointsPerTier', 'rounding', 'cap'];
const RULE_FIELDS = ['base', 'sourceStat', 'pointsPerTier', 'gainPerTier', 'rounding', 'cap', 'perLevel'];
// The ruleset-6 vocabulary. Attribute weights are NOT listed: they are the
// attribute ids themselves, exactly as a combat-rating row states them, and the
// validator is handed the legal set so a typo is still refused by name.
const UNIFIED_DEFAULT_FIELDS = ['perLevel', 'cap'];
const UNIFIED_RULE_FIELDS = ['base', 'perLevel', 'cap'];
// Ruleset 7 states its bounds as `min` / `max` on the row itself (the hand
// rows carried them as `minimum` / `maximum`), and `cap` retires into `max`.
const STAT_ROW_DEFAULT_FIELDS = ['perLevel'];
const STAT_ROW_FIELDS = ['base', 'perLevel', 'min', 'max', 'attributeBaseline', 'byClass'];
// A ROW MAY STATE A PER-CLASS FORM (owner, 2026-09-24, on #1294 and #1296:
// "give the openingHand stat row a per-class form"). `byClass.<classId>` holds
// that class's base and attribute weights (and, optionally, its own perLevel,
// min, max or attributeBaseline); everything it does not state is the row's.
// A class with no entry — or no class at all: a fixture, a preview — reads the
// shared row. `attributeBaseline` is the attribute points a row counts from:
// each term is floor(max(0, attribute − attributeBaseline) × weight), so the
// opening hand's `floor((primary − 1) / 2)` is a weight of 0.5 from 1.
const CLASS_ROW_FIELDS = ['base', 'perLevel', 'min', 'max', 'attributeBaseline'];
// Legal only on a snapshot row or an override layer — see the header. The last
// two carry the retired hand and rating arithmetic (model/statRows.js):
// `pointsBaseline` is the hand rules' "points before bonuses", subtracted from
// the attribute total before the tier; `multiplier` is the rating formula's
// global multiplier, applied to the floored attribute total.
const CARRIER_FIELDS = ['pointsPerIncrease', 'gain', 'rounding', 'perLevelEvery', 'cap', 'pointsBaseline', 'multiplier'];
// Every key a row may carry that is NOT an attribute weight — the legacy
// spellings included, because a normalized row is built by stripping these.
const NON_WEIGHT_FIELDS = Object.freeze([...new Set([...RULE_FIELDS, ...UNIFIED_RULE_FIELDS, ...STAT_ROW_FIELDS, ...CARRIER_FIELDS])]);
const PER_LEVEL_FIELDS = ['every', 'gain'];
const OVERRIDE_FIELDS = ['defaults', 'rules'];
const BASE_FIELDS = ['strategy', 'field'];
// A tier is counted by division and division is where binary float lies:
// 0.2 x 15 is 3.0000000000000004 and 1 / 0.2 is 5.000000000000001. The same
// epsilon combatRatings.js uses, for the same reason.
const EPSILON = 1e-9;

/** True for a table (or snapshot envelope) written in the one format. */
export function isUnifiedRuleset(rulesetVersion) {
  return (Number(rulesetVersion) || 0) >= UNIFIED_RULESET_VERSION;
}

/** True for a table written with `min` / `max` bounds and the twelve rows. */
export function isStatRowRuleset(rulesetVersion) {
  return (Number(rulesetVersion) || 0) >= STAT_ROW_RULESET_VERSION;
}
const plainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (v, key) => Object.hasOwn(v, key);
const problem = (out, path, msg) => out.push({ path, msg });

function unknownFields(out, value, allowed, path) {
  if (!plainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) problem(out, path ? `${path}.${key}` : key, 'unknown field');
  }
}

function validatePoints(out, value, path, required) {
  if (value === undefined && !required) return;
  if (!Number.isFinite(value) || value <= 0) problem(out, path, 'must be a finite number > 0');
}

function validateGain(out, value, path, required, classFields) {
  if (value === undefined && !required) return;
  if (Number.isFinite(value)) return;
  if (!plainObject(value)) {
    problem(out, path, 'must be a finite number or a classField reference');
    return;
  }
  unknownFields(out, value, BASE_FIELDS, path);
  if (value.strategy !== 'classField') problem(out, `${path}.strategy`, "must be 'classField'");
  if (typeof value.field !== 'string' || !classFields.includes(value.field)) {
    problem(out, `${path}.field`, `must name one of ${classFields.join(', ')}`);
  }
}

function validateRounding(out, value, path, required) {
  if (value === undefined && !required) return;
  if (!DERIVED_STAT_ROUNDING.includes(value)) {
    problem(out, path, `must be one of ${DERIVED_STAT_ROUNDING.join(', ')}`);
  }
}

function validateCap(out, value, path, required) {
  if (value === undefined && !required) return;
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    problem(out, path, 'must be null or a finite number >= 0');
  }
}

function validateBase(out, value, path, { required, classFields }) {
  if (value === undefined && !required) return;
  if (Number.isFinite(value)) return;
  if (!plainObject(value)) {
    problem(out, path, 'must be a finite number or a classField reference');
    return;
  }
  unknownFields(out, value, BASE_FIELDS, path);
  if (value.strategy !== 'classField') problem(out, `${path}.strategy`, "must be 'classField'");
  if (typeof value.field !== 'string' || !classFields.includes(value.field)) {
    problem(out, `${path}.field`, `must name one of ${classFields.join(', ')}`);
  }
}

/**
 * `perLevel: { every, gain }` — the character-level term (plan phase 6): every
 * `every` levels past the first, the row's maximum gains `gain`. Optional per
 * row; a row without it never moves with the level. Snapshotted with the
 * row, so a run keeps the cadence it was born under.
 */
function validatePerLevel(out, value, path) {
  if (value === undefined) return;
  if (!plainObject(value)) { problem(out, path, 'must be { every, gain }'); return; }
  unknownFields(out, value, PER_LEVEL_FIELDS, path);
  if (!Number.isInteger(value.every) || value.every <= 0) problem(out, `${path}.every`, 'must be a positive integer number of levels');
  if (!Number.isFinite(value.gain) || value.gain < 0) problem(out, `${path}.gain`, 'must be a finite number >= 0');
}

function validateDefaults(out, value, path, { partial, unified, carriers = false, statRows = false }) {
  if (!plainObject(value)) {
    problem(out, path, 'must be a plain object');
    return;
  }
  const fields = statRows ? STAT_ROW_DEFAULT_FIELDS : unified ? UNIFIED_DEFAULT_FIELDS : DEFAULT_FIELDS;
  unknownFields(out, value, unified && carriers ? [...new Set([...fields, ...UNIFIED_DEFAULT_FIELDS, ...CARRIER_FIELDS])] : fields, path);
  for (const key of fields) if (!partial && !own(value, key)) problem(out, `${path}.${key}`, 'missing');
  if (unified) {
    validatePerLevelGrowth(out, value.perLevel, `${path}.perLevel`, !partial);
    validatePoints(out, value.pointsPerIncrease, `${path}.pointsPerIncrease`, false);
    validateGain(out, value.gain, `${path}.gain`, false, []);
    validateRounding(out, value.rounding, `${path}.rounding`, false);
  } else {
    validatePoints(out, value.pointsPerTier, `${path}.pointsPerTier`, !partial);
    validateRounding(out, value.rounding, `${path}.rounding`, !partial);
  }
  validateCap(out, value.cap, `${path}.cap`, !partial && !statRows);
}

/**
 * Ruleset 6's level term, and it is ONE DECIMAL — "I'll just use decimal
 * values to set the growth per level". `perLevel: 0.2` is a fifth of a point
 * of the row per level, which is the same climb ruleset 5 wrote as
 * `{ every: 5, gain: 1 }` and reads at every level rather than only at five.
 */
function validatePerLevelGrowth(out, value, path, required) {
  if (value === undefined && !required) return;
  if (!Number.isFinite(value) || value < 0) problem(out, path, 'must be a finite number >= 0');
}

/**
 * A ruleset-6 row: base, a decimal weight per attribute it answers to, and the
 * three dials AR/DR/PR already had. `attributeIds` is the legal weight set, so
 * a misspelt attribute is refused by name instead of silently weighing nothing.
 */
function validateUnifiedRule(out, value, path, options, partial) {
  if (!plainObject(value)) {
    problem(out, path, 'must be a plain object');
    return;
  }
  unknownFields(out, value, [...(options.statRows ? STAT_ROW_FIELDS : UNIFIED_RULE_FIELDS), ...options.attributeIds,
    // Only a snapshot row or a layer may carry these; an authored ruleset-6
    // table that spells one is refused by name (see the header).
    ...(options.carriers ? CARRIER_FIELDS : [])], path);
  if (value.perLevelEvery !== undefined
    && (!Number.isInteger(value.perLevelEvery) || value.perLevelEvery <= 0)) {
    problem(out, `${path}.perLevelEvery`, 'must be a positive integer number of levels');
  }
  if (!partial && !own(value, 'base')) problem(out, `${path}.base`, 'missing');
  validateBase(out, value.base, `${path}.base`, { required: !partial, classFields: options.classFields });
  // A BASE IS WHOLE POINTS on an authored ruleset-6 row. Every term after it is
  // floored, so a fractional base is the only way a pool could stop being a
  // whole number — and the run door refuses a fractional Actions or draw
  // (Codex, #1253). Carrier rows are snapshots the host already resolved.
  if (!options.carriers && Number.isFinite(value.base) && !Number.isInteger(value.base)) {
    problem(out, `${path}.base`, 'must be a whole number');
  }
  validatePoints(out, value.pointsPerIncrease, `${path}.pointsPerIncrease`, false);
  validateGain(out, value.gain, `${path}.gain`, false, options.classFields);
  validateRounding(out, value.rounding, `${path}.rounding`, false);
  validateCap(out, value.cap, `${path}.cap`, false);
  validatePerLevelGrowth(out, value.perLevel, `${path}.perLevel`, false);
  for (const bound of ['min', 'max']) {
    if (value[bound] !== undefined && value[bound] !== null && (!Number.isInteger(value[bound]) || value[bound] < 0)) {
      problem(out, `${path}.${bound}`, 'must be null or a whole number >= 0');
    }
  }
  if (Number.isInteger(value.min) && Number.isInteger(value.max) && value.min > value.max) {
    problem(out, `${path}.min`, `must not exceed max (${value.max})`);
  }
  if (value.pointsBaseline !== undefined && (!Number.isFinite(value.pointsBaseline) || value.pointsBaseline < 0)) {
    problem(out, `${path}.pointsBaseline`, 'must be a finite number >= 0');
  }
  if (value.attributeBaseline !== undefined && (!Number.isFinite(value.attributeBaseline) || value.attributeBaseline < 0)) {
    problem(out, `${path}.attributeBaseline`, 'must be a finite number >= 0');
  }
  if (value.byClass !== undefined) validateByClass(out, value.byClass, `${path}.byClass`, options);
  if (value.multiplier !== undefined && (!Number.isFinite(value.multiplier) || value.multiplier < 0)) {
    problem(out, `${path}.multiplier`, 'must be a finite number >= 0');
  }
  for (const id of options.attributeIds) {
    if (value[id] === undefined) continue;
    if (!Number.isFinite(value[id]) || value[id] < 0) {
      problem(out, `${path}.${id}`, 'must be a finite number >= 0 — the contribution of one point of this attribute');
    }
  }
}

/** A row's per-class form: one partial row per class id (see CLASS_ROW_FIELDS). */
function validateByClass(out, value, path, options) {
  if (!plainObject(value)) { problem(out, path, 'must be a plain object of class id → row'); return; }
  for (const [classId, row] of Object.entries(value)) {
    const at = `${path}.${classId}`;
    if (!plainObject(row)) { problem(out, at, 'must be a plain object'); continue; }
    unknownFields(out, row, [...CLASS_ROW_FIELDS, ...options.attributeIds], at);
    if (row.base !== undefined && (!Number.isInteger(row.base) || row.base < 0)) problem(out, `${at}.base`, 'must be a whole number >= 0');
    validatePerLevelGrowth(out, row.perLevel, `${at}.perLevel`, false);
    for (const bound of ['min', 'max']) {
      if (row[bound] !== undefined && row[bound] !== null && (!Number.isInteger(row[bound]) || row[bound] < 0)) {
        problem(out, `${at}.${bound}`, 'must be null or a whole number >= 0');
      }
    }
    if (Number.isInteger(row.min) && Number.isInteger(row.max) && row.min > row.max) problem(out, `${at}.min`, `must not exceed max (${row.max})`);
    if (row.attributeBaseline !== undefined && (!Number.isFinite(row.attributeBaseline) || row.attributeBaseline < 0)) {
      problem(out, `${at}.attributeBaseline`, 'must be a finite number >= 0');
    }
    for (const id of options.attributeIds) {
      if (row[id] !== undefined && (!Number.isFinite(row[id]) || row[id] < 0)) {
        problem(out, `${at}.${id}`, 'must be a finite number >= 0 — the contribution of one point of this attribute');
      }
    }
  }
}

function validateRule(out, value, path, options, partial) {
  if (options.unified) {
    validateUnifiedRule(out, value, path, options, partial);
    return;
  }
  if (!plainObject(value)) {
    problem(out, path, 'must be a plain object');
    return;
  }
  unknownFields(out, value, RULE_FIELDS, path);
  if (!partial) {
    for (const key of ['base', 'sourceStat', 'gainPerTier']) {
      if (!own(value, key)) problem(out, `${path}.${key}`, 'missing');
    }
  }
  validateBase(out, value.base, `${path}.base`, { required: !partial, classFields: options.classFields });
  if ((value.sourceStat !== undefined || !partial)
    && (typeof value.sourceStat !== 'string' || !options.attributeIds.includes(value.sourceStat))) {
    // The offending value is IN the message: a retired id (e.g.
    // 'constitution') arriving here must be refused by its own name, not
    // only by the legal list it is absent from.
    const got = typeof value.sourceStat === 'string' ? `'${value.sourceStat}' ` : '';
    problem(out, `${path}.sourceStat`, `${got}must name one of ${options.attributeIds.join(', ')}`);
  }
  validatePoints(out, value.pointsPerTier, `${path}.pointsPerTier`, false);
  validateGain(out, value.gainPerTier, `${path}.gainPerTier`, !partial, options.classFields);
  validateRounding(out, value.rounding, `${path}.rounding`, false);
  validateCap(out, value.cap, `${path}.cap`, false);
  validatePerLevel(out, value.perLevel, `${path}.perLevel`);
}

function normalizedOptions(options = {}) {
  return {
    attributeIds: Array.isArray(options.attributeIds) ? [...options.attributeIds] : [],
    classFields: Array.isArray(options.classFields) ? [...options.classFields] : ['maxHp', 'maxMana'],
    damageSchools: Array.isArray(options.damageSchools) ? [...options.damageSchools] : [],
    // Which vocabulary the TABLE BEING READ is written in. A caller never sets
    // this: the version says it, and a snapshot envelope says it for a snapshot
    // whose rows were normalized before they were saved.
    unified: !!options.unified,
    // Whether the table is ruleset 7 or later: `min` / `max` on the row, no
    // `cap`. Read off the version like `unified`, never set by a caller.
    statRows: !!options.statRows,
    // Whether the carrier fields (header) are legal: on a snapshot row and an
    // override layer, never on an authored table.
    carriers: !!options.carriers,
  };
}

// ---- THE ONE NORMALIZATION (rulesets 1-5 -> the format above) ---------------
//
// It runs at the two doors and nowhere else — `resolveDerivedStatRules` and
// `restoreDerivedStatRuleSnapshot` — so a second vocabulary can never reach a
// consumer. Every conversion below is EXACT: the same arithmetic, said the
// shipped way.

/** A legacy `{ base, sourceStat, pointsPerTier, gainPerTier, perLevel }` row as a ruleset-6 row. */
function normalizeRule(row) {
  if (!plainObject(row)) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'sourceStat' || key === 'pointsPerTier' || key === 'gainPerTier' || key === 'perLevel') continue;
    out[key] = value;
  }
  if (typeof row.sourceStat === 'string') out[row.sourceStat] = 1;
  if (own(row, 'pointsPerTier')) out.pointsPerIncrease = row.pointsPerTier;
  if (own(row, 'gainPerTier')) out.gain = row.gainPerTier;
  if (plainObject(row.perLevel)) {
    // THE OLD CURVE, TO THE POINT. `{ every: 5, gain: 5 }` is +5 every five
    // levels and stays that — a save's maximum may not move because the table
    // it was born under was restated. A ruleset-6 row leaves `perLevelEvery`
    // at 1 and the decimal does the whole of the work.
    out.perLevel = row.perLevel.gain;
    out.perLevelEvery = row.perLevel.every;
  } else if (own(row, 'perLevel')) {
    out.perLevel = row.perLevel;
  }
  return out;
}

/** A layer's `defaults` patch in ruleset-6 words — only the keys it stated. */
function normalizeDefaultsPatch(patch) {
  if (!plainObject(patch)) return patch;
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'pointsPerTier') out.pointsPerIncrease = value;
    else out[key] = value;
  }
  return out;
}

/** A layer's per-row patch in ruleset-6 words — only the keys it stated. */
function normalizeRulePatch(patch, attributeIds) {
  if (!plainObject(patch)) return patch;
  const out = normalizeRule(patch);
  // A patch that renames the source stat replaces the weights outright; a
  // half-rewritten row would answer to two attributes nobody authored.
  if (typeof patch.sourceStat === 'string') {
    for (const id of attributeIds) if (id !== patch.sourceStat) out[id] = 0;
  }
  return out;
}

/**
 * resolvedRuleRow(table, statId) → one row in ruleset-6 words, with the table's
 * defaults under it. The run door keeps a save's snapshot byte-for-byte when it
 * is current (model/state.js returns early), so a v2 snapshot can still reach a
 * reader in the retired vocabulary; every reader goes through here instead of
 * indexing `rules` itself.
 */
export function resolvedRuleRow(table, statId, classId = null) {
  const row = table && table.rules && table.rules[statId];
  if (!plainObject(row)) return null;
  return rowForClass(normalizeRule({ ...normalizeDefaultsPatch((table && table.defaults) || {}), ...row }), classId);
}

/**
 * rowForClass(row, classId) → the row one class reads: a row with a per-class
 * form (`byClass`, see CLASS_ROW_FIELDS) answers with that class's base and
 * weights over the shared bounds; the form itself never rides along, so a
 * snapshot or a fight states exactly the row it was priced by.
 */
export function rowForClass(row, classId = null) {
  if (!plainObject(row) || !Object.hasOwn(row, 'byClass')) return row;
  const { byClass, ...shared } = row;
  const own = classId && plainObject(byClass) ? byClass[classId] : null;
  if (!plainObject(own)) return shared;
  // The class's weights REPLACE the shared ones: a Reaver's opening hand
  // answers to Strength alone, not Strength on top of the shared Intelligence.
  const bounds = Object.fromEntries(Object.entries(shared).filter(([key]) => NON_WEIGHT_FIELDS.includes(key)));
  return { ...bounds, ...structuredClone(own) };
}

/** Every attribute this row answers to, as `[id, weight]`, weight non-zero. */
export function ruleWeights(row) {
  if (!plainObject(row)) return [];
  return Object.entries(row)
    .filter(([key, value]) => !NON_WEIGHT_FIELDS.includes(key) && Number.isFinite(value) && value !== 0);
}

/** Returns named schema problems; it never throws and never repairs input. */
export function derivedStatRuleProblems(source, options = {}) {
  const out = [];
  if (!plainObject(source)) return [{ path: 'derivedStatRules', msg: 'must be a plain object' }];
  // THE VERSION SAYS WHICH VOCABULARY, and only a snapshot envelope overrides
  // it: a ruleset-5 save whose rows were normalized before they were written
  // is read back in ruleset-6 words, which is what its envelope version says.
  const opts = normalizedOptions({
    ...options,
    unified: options.unified === undefined ? isUnifiedRuleset(source.rulesetVersion) : options.unified,
    statRows: isStatRowRuleset(source.rulesetVersion),
  });
  unknownFields(out, source, ROOT_FIELDS, 'derivedStatRules');
  if (!Number.isInteger(source.rulesetVersion) || !DERIVED_STAT_RULESET_VERSIONS.includes(source.rulesetVersion)) {
    problem(out, 'rulesetVersion', `must be one of ${DERIVED_STAT_RULESET_VERSIONS.join(', ')}`);
  }
  validateDefaults(out, source.defaults, 'defaults', { partial: false, unified: opts.unified, carriers: opts.carriers, statRows: opts.statRows });
  if (!plainObject(source.rules)) {
    problem(out, 'rules', 'must be a plain object');
    return out;
  }
  for (const id of derivedStatIdsFor(source.rulesetVersion)) {
    if (!own(source.rules, id)) problem(out, `rules.${id}`, 'missing required derived-stat row');
    else validateRule(out, source.rules[id], `rules.${id}`, opts, false);
  }
  // A row the version does not require is still validated when it is there.
  for (const id of DERIVED_STAT_IDS) {
    if (!derivedStatIdsFor(source.rulesetVersion).includes(id) && own(source.rules, id)) {
      validateRule(out, source.rules[id], `rules.${id}`, opts, false);
    }
  }
  for (const id of Object.keys(source.rules)) {
    if (!DERIVED_STAT_IDS.includes(id)) problem(out, `rules.${id}`, `unknown derived-stat row '${id}'`);
  }
  // A HAND HOLDS AT LEAST ONE CARD. The retired capacity group refused a floor
  // or ceiling under 1; the row that replaced it keeps that refusal, or a
  // fight could open with nothing to play.
  const hand = opts.statRows && plainObject(source.rules.handSize) ? source.rules.handSize : null;
  if (hand) {
    if (!Number.isInteger(hand.min) || hand.min < 1) problem(out, 'rules.handSize.min', 'must be a whole number >= 1: a hand holds at least one card');
    if (hand.max !== undefined && hand.max !== null && (!Number.isInteger(hand.max) || hand.max < 1)) problem(out, 'rules.handSize.max', 'must be a whole number >= 1: a hand holds at least one card');
  }
  return out;
}

/**
 * derivedStatPresentationProblems(source) → named problems, never thrown.
 *
 * D26's short form. The authored table must carry ONE presentation row per
 * derived-stat rule and no strays — the pairing is what makes "add a row and it
 * appears, correctly placed, with no code edit" true, and a missing half has to
 * fail LOUD AND BY NAME rather than draw a blank chip (Law 1 clause 5).
 *
 * Called from the CONTENT door only (model/validate.js). Snapshot restore
 * reconstitutes `rules` alone and must not be asked for prose it never saved —
 * `presentation` is optional to derivedStatRuleProblems for exactly that
 * reason, and required here.
 */
export function derivedStatPresentationProblems(source) {
  const out = [];
  if (!plainObject(source)) return [{ path: 'derivedStatRules', msg: 'must be a plain object' }];
  const table = source.presentation;
  if (!plainObject(table)) return [{ path: 'derivedStatRules.presentation', msg: 'must be a plain object with one row per derived stat' }];
  const orders = new Map();
  for (const id of derivedStatIdsFor(source.rulesetVersion)) {
    const path = `presentation.${id}`;
    if (!own(table, id)) { problem(out, path, 'missing presentation row for a shipped derived stat'); continue; }
    const row = table[id];
    if (!plainObject(row)) { problem(out, path, 'must be a plain object'); continue; }
    unknownFields(out, row, PRESENTATION_FIELDS, path);
    if (typeof row.label !== 'string' || !row.label.trim()) problem(out, `${path}.label`, 'must be a non-empty string');
    if (row.faceLabel !== undefined && (typeof row.faceLabel !== 'string' || !row.faceLabel.trim())) {
      problem(out, `${path}.faceLabel`, 'must be a non-empty string when present');
    }
    if (typeof row.sense !== 'string' || !row.sense.trim()) problem(out, `${path}.sense`, 'must be a non-empty player sentence');
    if (!Number.isInteger(row.order) || row.order <= 0) problem(out, `${path}.order`, 'must be an integer > 0');
    else if (orders.has(row.order)) problem(out, `${path}.order`, `duplicates presentation.${orders.get(row.order)}.order ${row.order}`);
    else orders.set(row.order, id);
    const tier = disclosureProblem(row.disclosure, `${path}.disclosure`);
    if (tier) out.push(tier);
  }
  for (const id of Object.keys(table)) {
    if (!DERIVED_STAT_IDS.includes(id)) problem(out, `presentation.${id}`, `unknown derived-stat row '${id}'`);
  }
  return out;
}

/**
 * A mode/run/debug layer, validated AFTER normalization and therefore always in
 * ruleset-6 words. A layer may still be WRITTEN in the retired vocabulary — an
 * exported configuration from before this format, a `pointsPerTier` dial — and
 * it means exactly what it always meant; it is simply read once, here, rather
 * than carried as a second spelling into the resolved table.
 */
function overrideProblems(value, path, options) {
  const out = [];
  if (!plainObject(value)) return [{ path, msg: 'must be a plain object' }];
  unknownFields(out, value, OVERRIDE_FIELDS, path);
  const unifiedOptions = { ...options, unified: true, carriers: true, statRows: true };
  if (value.defaults !== undefined) {
    validateDefaults(out, normalizeDefaultsPatch(value.defaults), `${path}.defaults`, { partial: true, unified: true, carriers: true });
  }
  if (value.rules !== undefined) {
    if (!plainObject(value.rules)) problem(out, `${path}.rules`, 'must be a plain object');
    else for (const [id, row] of Object.entries(value.rules)) {
      if (!DERIVED_STAT_IDS.includes(id)) problem(out, `${path}.rules.${id}`, `unknown derived-stat row '${id}'`);
      else validateRule(out, normalizeRulePatch(row, options.attributeIds), `${path}.rules.${id}`, unifiedOptions, true);
    }
  }
  return out;
}

function throwProblems(label, problems) {
  if (problems.length) throw new Error(`${label}: ${problems.map((p) => `${p.path}: ${p.msg}`).join('; ')}`);
}

/** Resolve authored rows plus mode/run/debug layers into a self-contained table. */
export function resolveDerivedStatRules(source, options = {}) {
  // The TABLE's own version decides its vocabulary, so the caller's options go
  // through untouched and `derivedStatRuleProblems` reads it off the source.
  // Normalizing first would have pinned every table to `unified: false`.
  const opts = normalizedOptions({ ...options, unified: isUnifiedRuleset(source && source.rulesetVersion), statRows: isStatRowRuleset(source && source.rulesetVersion) });
  throwProblems('derivedStatRules', derivedStatRuleProblems(source, opts));
  const layers = [
    ['modeModifiers', options.modeModifiers],
    ...((Array.isArray(options.runModifiers) ? options.runModifiers : options.runModifiers ? [options.runModifiers] : [])
      .map((value, index) => [`runModifiers[${index}]`, value])),
    ['explicitOverride', options.explicitOverride],
  ];
  for (const [path, layer] of layers) {
    if (layer === undefined || layer === null) continue;
    throwProblems(path, overrideProblems(layer, path, opts));
  }
  // A defaults override affects every row that was not explicitly patched by
  // the same or a later layer. Resolve layer-by-layer to keep that fact true.
  //
  // NORMALIZED ONCE, HERE. Every row this function returns is ruleset-6 shaped
  // whatever version the table was authored in, which is what lets the run
  // door, the relic fold, the settings rows and every projection read ONE set
  // of field names.
  const replayed = {
    rulesetVersion: source.rulesetVersion,
    // `perLevel: 0` UNDER a legacy table's defaults: rulesets 1–5 had no
    // table-wide level term, and a v3 envelope requires one, so a restored
    // v2 snapshot re-stamped as v3 must carry it or its NEXT load refuses it.
    defaults: { perLevel: 0, ...normalizeDefaultsPatch({ ...source.defaults }) },
    // ONLY THE ROWS THE TABLE ACTUALLY CARRIES. Mapping the whole id list
    // would invent a baseless row for a version that never had one.
    rules: Object.fromEntries(DERIVED_STAT_IDS
      .filter((id) => own(source.rules, id))
      .map((id) => [id, normalizeRule({ ...source.defaults, ...structuredClone(source.rules[id]) })])),
  };
  for (const [, layer] of layers) {
    if (!layer) continue;
    // A LAYER PATCHES THE ROWS THE TABLE HAS. Since the row set became a
    // function of the ruleset version, a table may legally lack a row the id
    // list carries, and patching it blindly threw an unnamed TypeError —
    // exactly what the Advanced stat-tier dial hands in (a `defaults` layer).
    if (layer.defaults) {
      const patch = normalizeDefaultsPatch(layer.defaults);
      Object.assign(replayed.defaults, patch);
      for (const id of DERIVED_STAT_IDS) if (replayed.rules[id]) Object.assign(replayed.rules[id], patch);
    }
    if (layer.rules) {
      for (const [id, patch] of Object.entries(layer.rules)) {
        if (!replayed.rules[id]) throw new Error(`Derived-stat override patches '${id}', which this ruleset ${replayed.rulesetVersion} table does not carry`);
        // `gainPerTier` and `sourceStat` describe a SINGLE-STAT TIERED row. On a
        // ruleset-6 row, whose weight already carries the coefficient, the same
        // words would multiply it twice (hp: floor(4 × CON) × 4) — refused by
        // name rather than guessed at.
        if (isUnifiedRuleset(replayed.rulesetVersion) && plainObject(patch)
          && (own(patch, 'gainPerTier') || own(patch, 'sourceStat'))) {
          throw new Error(`Derived-stat override patches '${id}' with ${own(patch, 'gainPerTier') ? 'gainPerTier' : 'sourceStat'}, which a ruleset ${replayed.rulesetVersion} row does not have — set the attribute weight instead`);
        }
        Object.assign(replayed.rules[id], normalizeRulePatch(patch, opts.attributeIds));
      }
    }
  }
  return replayed;
}

function baseValue(base, classDef, statId) {
  if (Number.isFinite(base)) return base;
  const value = classDef && base && classDef[base.field];
  if (!Number.isFinite(value)) throw new Error(`${statId}.base: class field '${base && base.field}' is not a finite number`);
  return value;
}

function gainValue(gain, classDef, statId, field = 'gain') {
  if (Number.isFinite(gain)) return gain;
  const value = classDef && gain && classDef[gain.field];
  if (!Number.isFinite(value)) throw new Error(`${statId}.${field}: class field '${gain && gain.field}' is not a finite number`);
  return value;
}

/**
 * Generic attribute-tier receipt for weapon/armour/resource projections.
 * The caller supplies one already-resolved rule row, so authored defaults,
 * mode/run layers and the explicit/debug override have already merged once.
 * This helper owns no weapon base and mutates nothing.
 */
export function deriveAttributeTierReceipt(rule, { attributes, sourceStat = rule && rule.sourceStat, classDef, statId = 'derivedStat' } = {}) {
  if (!plainObject(rule)) throw new Error('Attribute tier rule must be a resolved rule row');
  const points = attributes && attributes[sourceStat];
  if (!Number.isFinite(points)) throw new Error(`sourceStat '${sourceStat}' is not a finite number`);
  if (!Number.isFinite(rule.pointsPerTier) || rule.pointsPerTier <= 0) throw new Error('pointsPerTier must be a finite number > 0');
  const gainPerTier = gainValue(rule.gainPerTier, classDef, statId, 'gainPerTier');
  const round = Math[rule.rounding];
  if (typeof round !== 'function') throw new Error(`rounding '${rule.rounding}' is not executable`);
  const tier = round(points / rule.pointsPerTier);
  return {
    sourceStat,
    points,
    pointsPerTier: rule.pointsPerTier,
    rounding: rule.rounding,
    tier,
    gainPerTier,
    value: tier * gainPerTier,
  };
}

/**
 * levelBonus(row, level) → what the row's level term adds at a character level.
 *
 * ONE DECIMAL, HIS WORDS: `perLevel` is what the row gains per level, so
 * `perLevel: 0.2` climbs a point every five levels and `perLevel: 1` climbs
 * one every level. `perLevelEvery` is the retired `{ every, gain }` cadence a
 * ruleset-4/5 save normalizes to and defaults to 1 — a row a player can author
 * never states it, and a save that carries one keeps the exact curve it was
 * born under rather than being smoothed underneath a live character.
 *
 * `round` is the row's own rounding, so the level term and the attribute term
 * never disagree about which way a half goes. 0 for no level, for level 1, and
 * for a row with no term at all.
 */
export function levelBonus(row, level) {
  if (!plainObject(row) || !Number.isInteger(level) || level <= 1) return 0;
  const term = row.perLevel;
  // The retired shape, still read so a direct caller holding an un-normalized
  // authored row gets the answer that row means.
  if (plainObject(term)) {
    if (!Number.isInteger(term.every) || term.every <= 0 || !Number.isFinite(term.gain)) return 0;
    return Math.floor((level - 1) / term.every) * term.gain;
  }
  if (!Number.isFinite(term) || term === 0) return 0;
  // A normalized ruleset 1–5 cadence pays `steps × gain` UNROUNDED, exactly as
  // its `{ every, gain }` did; only the ruleset-6 decimal is floored.
  if (Number.isInteger(row.perLevelEvery) && row.perLevelEvery > 0) {
    return Math.floor((level - 1) / row.perLevelEvery) * term;
  }
  const every = 1;
  const steps = Math.floor((level - 1) / every);
  const round = typeof Math[row.rounding] === 'function' ? Math[row.rounding] : Math.floor;
  const raw = steps * term;
  return round === Math.floor ? Math.floor(raw + EPSILON) : round(raw);
}

/**
 * deriveStatIncrease(row, …) → the ATTRIBUTE term of a row, as a receipt:
 * `{ weights, terms, points, pointsPerIncrease, tier, gain, value }`.
 *
 * THIS IS THE RATINGS' ARITHMETIC (model/ratingFormula.js), because it is the
 * calculation he pointed at: every attribute's `value × weight` is floored ON
 * ITS OWN and the floored terms are summed, so a weight of 0.2 gives nothing
 * until the attribute reaches 5 — on HP exactly as on AR.
 *
 * The CARRIERS then apply, and for a ruleset-6 row they are the identity
 * (`pointsPerIncrease` 1, `gain` 1). They carry a ruleset 1–5 row's tier and
 * gain unchanged: its one weight is 1, so its term is the whole attribute and
 * `round(attribute / pointsPerTier) × gainPerTier` is what comes out, to the
 * bit — the division takes no epsilon, because those maxima are persisted and
 * the run door refuses a save whose maximum moves.
 */
export function deriveStatIncrease(row, { attributes, classDef, statId = 'derivedStat' } = {}) {
  if (!plainObject(row)) throw new Error('Derived-stat rule must be a resolved rule row');
  const pointsPerIncrease = Number.isFinite(row.pointsPerIncrease) ? row.pointsPerIncrease : 1;
  if (pointsPerIncrease <= 0) throw new Error('pointsPerIncrease must be a finite number > 0');
  const weights = ruleWeights(row);
  const terms = {};
  let points = 0;
  for (const [id, weight] of weights) {
    const value = attributes && attributes[id];
    if (!Number.isFinite(value)) throw new Error(`attribute '${id}' is not a finite number`);
    // Counted from `attributeBaseline` when the row states one (0 otherwise).
    const counted = Number.isFinite(row.attributeBaseline) && row.attributeBaseline > 0 ? Math.max(0, value - row.attributeBaseline) : value;
    terms[id] = Math.floor(counted * weight + EPSILON);
    points += terms[id];
  }
  const gain = row.gain === undefined ? 1 : gainValue(row.gain, classDef, statId);
  const rounding = row.rounding === undefined ? 'floor' : row.rounding;
  const round = Math[rounding];
  if (typeof round !== 'function') throw new Error(`rounding '${rounding}' is not executable`);
  // THE TWO RETIRED HOMES' ARITHMETIC, as carriers (model/statRows.js). A
  // ruleset-7 row states neither, and both are the identity when absent: the
  // hand rules counted only the points above a baseline, and the rating
  // formula scaled the floored total by one global multiplier.
  const counted = Number.isFinite(row.pointsBaseline) && row.pointsBaseline > 0
    ? Math.max(0, points - row.pointsBaseline) : points;
  const scaled = Number.isFinite(row.multiplier) ? Math.floor(counted * row.multiplier + EPSILON) : counted;
  const tier = pointsPerIncrease === 1 ? scaled : round(scaled / pointsPerIncrease);
  return {
    weights: Object.fromEntries(weights),
    terms,
    points,
    pointsPerIncrease,
    tier,
    gain,
    value: tier * gain,
  };
}

/**
 * Pure calculation. The returned receipt distinguishes base, tier, level
 * bonus, raw and cap. `level` is the character level (plan phase 6); a
 * caller that computes a run's pools passes it, a ceiling or a table probe
 * leaves it out and reads the attribute term alone.
 */
export function deriveStat(resolved, statId, { attributes, classDef, level = undefined } = {}) {
  const row = resolvedRuleRow(resolved, statId, classDef && classDef.id);
  if (!row) throw new Error(`Unknown derived stat '${statId}'`);
  return statRowValue(row, { attributes, classDef, level, statId });
}

/**
 * statRowValue(row, { attributes, level }) → the receipt of ONE row.
 *
 * THE ONE FORMULA (ruleset 7). Every stat — HP, Mana, Stamina, Actions, the
 * opening hand, the per-turn draw, the hand size, AR, DR, PR, Ward and Poise —
 * is priced by this function and nothing else:
 *
 *   value = clamp(base + Σ floor(attribute × weight)
 *                      + floor(perLevel × (level − 1)), min, max)
 *
 * Each attribute term is floored ON ITS OWN, so a weight of 0.125 adds
 * nothing until that attribute reaches 8. Equipment, relics and statuses are
 * added by their own receipts on top, exactly as before.
 *
 * `lenientAttributes` reads a missing attribute as 0 — the rating and hand
 * readers always did (a headless fixture carries none) — where the pool door
 * refuses one by name.
 */
export function statRowValue(row, { attributes, classDef, level = undefined, statId = 'derivedStat', lenientAttributes = false } = {}) {
  if (!plainObject(row)) throw new Error(`Derived stat '${statId}' has no row`);
  const read = lenientAttributes
    ? Object.fromEntries(ruleWeights(row).map(([id]) => [id, Number.isFinite(Number(attributes && attributes[id])) ? Number(attributes[id]) : 0]))
    : attributes;
  const increase = deriveStatIncrease(row, { attributes: read, classDef, statId });
  const base = baseValue(row.base, classDef, statId);
  const bonus = levelBonus(row, level);
  const raw = base + increase.value + bonus;
  const cap = row.cap === undefined ? null : row.cap;
  const min = Number.isFinite(row.min) ? row.min : null;
  const max = Number.isFinite(row.max) ? row.max : null;
  let value = cap === null ? raw : Math.min(raw, cap);
  if (min !== null) value = Math.max(min, value);
  if (max !== null) value = Math.min(max, value);
  return {
    id: statId,
    // EVERY TERM THE VALUE HAS, in the one vocabulary: which attributes the row
    // answers to and by how much, what an increase costs and pays, what the
    // level adds. No `sourceStat` — a row may answer to several attributes now,
    // and naming one of them would be the half-truth the old field became.
    weights: increase.weights,
    terms: increase.terms,
    points: increase.points,
    pointsPerIncrease: increase.pointsPerIncrease,
    tier: increase.tier,
    base,
    gain: increase.gain,
    perLevel: Number.isFinite(row.perLevel) ? row.perLevel : 0,
    level: Number.isInteger(level) ? level : null,
    levelBonus: bonus,
    raw,
    cap,
    min,
    max,
    value,
  };
}

/**
 * ruleTierSize(rule) → how many points of the rule's ONE attribute buy one
 * unit of its `gain`, or null when the row answers to more than one (or none),
 * or when its weight is not a whole number of units per point.
 *
 * A ruleset-6 row reads `floor(attribute × weight)`, so a whole weight is one
 * unit per point (size 1) and the relic term folds into the WEIGHT; a
 * normalized ruleset 1–5 row keeps its weight at 1 and its size in
 * `pointsPerIncrease`, and the term folds into `gain` as it always did.
 */
export function ruleTierSize(rule) {
  const row = normalizeRule(rule);
  const weights = ruleWeights(row);
  if (weights.length !== 1) return null;
  const perIncrease = Number.isFinite(row.pointsPerIncrease) ? row.pointsPerIncrease : 1;
  if (perIncrease !== 1 || (row.gain !== undefined && row.gain !== 1)) return weights[0][1] === 1 ? perIncrease : null;
  return Number.isInteger(weights[0][1]) ? 1 : null;
}

/** Where a foldable term lands on this row: its `gain` (a tiered row) or its weight. */
export function relicFoldTarget(rule) {
  const row = normalizeRule(rule);
  const perIncrease = Number.isFinite(row.pointsPerIncrease) ? row.pointsPerIncrease : 1;
  return perIncrease !== 1 || (row.gain !== undefined && row.gain !== 1) ? 'gain' : 'weight';
}

/**
 * One compatibility contract for folding an authored relic tier into a rule.
 *
 * A relic term says "+N of this resource per P points of one attribute". It is
 * only the same arithmetic as the rule when the rule counts that one attribute
 * at the same granularity (`ruleTierSize` above). A row weighted across two
 * attributes has no single tier to fold into, and says so.
 */
export function relicAttributeTierFoldProblems(term, rule) {
  const problems = [];
  if (!term || !rule) return [{ field: null, msg: 'requires a resolved target resource rule' }];
  const row = normalizeRule(rule);
  const weights = ruleWeights(row);
  if (weights.length !== 1) {
    problems.push({ field: null, msg: weights.length
      ? `cannot fold into a rule weighted across ${weights.map(([id]) => id).join(' and ')}; attribute-tier modifiers need a rule that answers to one attribute`
      : 'cannot fold into a rule that answers to no attribute' });
  } else if (term.sourceStat !== weights[0][0]) {
    problems.push({ field: 'sourceStat', msg: `must match the attribute the target rule answers to, '${weights[0][0]}'` });
  }
  // AN UNSTATED GRANULARITY INHERITS THE RULE IT FOLDS INTO and can never
  // mismatch it (Law 0 clause 1). A STATED one must still match exactly: "+1 HP
  // per 5 CON" genuinely cannot be added to a per-1 rule, and that refusal is
  // the arithmetic protecting itself, not a rule to relax.
  const size = ruleTierSize(row);
  if (weights.length === 1 && size === null) {
    problems.push({ field: null, msg: `cannot fold into a fractional weight of ${weights[0][1]}; the rule must count whole points` });
  } else if (term.pointsPerTier !== undefined && size !== null && term.pointsPerTier !== size) {
    problems.push({ field: 'pointsPerTier', msg: `must match the target rule's ${size} point(s) per increase` });
  }
  const rounding = row.rounding === undefined ? 'floor' : row.rounding;
  if (rounding !== 'floor') {
    problems.push({ field: null, msg: `cannot fold into target rule rounding '${rounding}'; attribute-tier modifiers require 'floor'` });
  }
  return problems;
}

function resolveSnapshotNumbers(rules, classDef, relicModifierReceipt, explicitOverride) {
  if (!classDef) throw new Error('Host snapshot creation requires a classDef');
  const out = structuredClone(rules);
  // A RUN SNAPSHOTS ITS OWN CLASS'S ROW: the per-class form resolves here,
  // with the class-field bases, so a save states the one row it is priced by.
  for (const [statId, row] of Object.entries(out.rules)) out.rules[statId] = rowForClass(row, classDef.id);
  for (const [statId, row] of Object.entries(out.rules)) {
    row.base = baseValue(row.base, classDef, statId);
    if (row.gain !== undefined) row.gain = gainValue(row.gain, classDef, statId);
  }
  const resources = relicModifierReceipt && relicModifierReceipt.resources || {};
  for (const [statId, bonus] of Object.entries(resources)) {
    if (!bonus || (!bonus.flat && !(bonus.attributeTiers || []).length)) continue;
    const row = out.rules[statId];
    if (!row) throw new Error(`Relic modifier targets unknown derived resource '${statId}'`);
    const explicitRow = explicitOverride && explicitOverride.rules && explicitOverride.rules[statId] || {};
    if (explicitRow.base === undefined) row.base += bonus.flat || 0;
    if (explicitRow.gain === undefined && explicitRow.gainPerTier === undefined
      && ruleWeights(row).every(([id]) => explicitRow[id] === undefined)) {
      for (const term of bonus.attributeTiers || []) {
        if (relicAttributeTierFoldProblems(term, row).length) {
          const answers = ruleWeights(row).map(([id, weight]) => `${id}x${weight}`).join('+') || 'nothing';
          throw new Error(`Relic ${statId} attribute tier ${term.sourceStat}/${term.pointsPerTier} cannot fold into host rule ${answers}/${row.pointsPerIncrease ?? 1}/${row.rounding ?? 'floor'}`);
        }
        // A whole weight is one unit per point, so "+N per point" IS N more
        // weight; a tiered (normalized legacy) row still takes it on `gain`.
        if (relicFoldTarget(row) === 'gain') row.gain = (row.gain === undefined ? 1 : row.gain) + term.amountPerTier;
        else row[term.sourceStat] += term.amountPerTier;
      }
    }
  }
  return out;
}

/** Host-created, immutable-by-convention rules receipt for co-op/save owners. */
export function createDerivedStatRuleSnapshot(source, options = {}) {
  if (options.authority !== 'host') throw new Error('Only the host authority may create a derived-stat rules snapshot');
  const rules = resolveSnapshotNumbers(
    resolveDerivedStatRules(source, options),
    options.classDef,
    options.relicModifierReceipt,
    options.explicitOverride,
  );
  return structuredClone({
    snapshotVersion: DERIVED_STAT_SNAPSHOT_VERSION,
    rulesetVersion: rules.rulesetVersion,
    rules,
    relicModifiers: options.relicModifierReceipt ? {
      damageBySchoolAdd: options.relicModifierReceipt.damageBySchoolAdd,
      sources: options.relicModifierReceipt.sources,
    } : { damageBySchoolAdd: {}, sources: [] },
  });
}

/** Restore exactly what the host saved; current authored data is not consulted. */
export function restoreDerivedStatRuleSnapshot(snapshot, options = {}) {
  if (!plainObject(snapshot)) throw new Error('Derived-stat snapshot must be an object');
  if (!DERIVED_STAT_SNAPSHOT_VERSIONS.includes(snapshot.snapshotVersion)) {
    throw new Error(`Unknown derived-stat snapshotVersion ${snapshot.snapshotVersion} (supported: ${DERIVED_STAT_SNAPSHOT_VERSIONS.join(', ')})`);
  }
  if (!DERIVED_STAT_RULESET_VERSIONS.includes(snapshot.rulesetVersion)) {
    throw new Error(`Unknown derived-stat rulesetVersion ${snapshot.rulesetVersion} (supported: ${DERIVED_STAT_RULESET_VERSIONS.join(', ')})`);
  }
  if (!plainObject(snapshot.rules) || snapshot.rules.rulesetVersion !== snapshot.rulesetVersion) {
    throw new Error('Derived-stat snapshot rulesetVersion disagrees with its rules');
  }
  // THE ENVELOPE SAYS WHICH VOCABULARY THE ROWS ARE IN, not the ruleset. Every
  // snapshot written from now on holds ruleset-6-shaped rows whatever table the
  // run was born under, because that is what the host resolved; v2 and v1
  // envelopes hold the retired shape and are normalized below, which is exactly
  // the arithmetic they always meant.
  const source = structuredClone(snapshot.rules);
  const rowsAreUnified = snapshot.snapshotVersion >= 3;
  if (snapshot.snapshotVersion >= 2) {
    for (const [id, row] of Object.entries(source.rules || {})) {
      // A ruleset-6 row has no gain unless it was normalized from an older
      // one; when it carries one, it must be the number the host resolved.
      const gain = rowsAreUnified ? (row.gain === undefined ? 1 : row.gain) : row.gainPerTier;
      if (!Number.isFinite(row.base) || !Number.isFinite(gain)) {
        throw new Error(`Derived-stat snapshot v${snapshot.snapshotVersion} '${id}' must carry numeric base and ${rowsAreUnified ? 'gain' : 'gainPerTier'}`);
      }
    }
    const modifiers = snapshot.relicModifiers;
    if (!plainObject(modifiers) || !plainObject(modifiers.damageBySchoolAdd) || !Array.isArray(modifiers.sources)) {
      throw new Error('Derived-stat snapshot v2 must carry relicModifiers { damageBySchoolAdd, sources }');
    }
    const legalSchools = normalizedOptions(options).damageSchools;
    for (const school of legalSchools) {
      if (!own(modifiers.damageBySchoolAdd, school)) {
        throw new Error(`Derived-stat snapshot v2 relicModifiers.damageBySchoolAdd.${school} is missing`);
      }
    }
    for (const [school, value] of Object.entries(modifiers.damageBySchoolAdd)) {
      if (legalSchools.length && !legalSchools.includes(school)) {
        throw new Error(`Derived-stat snapshot v2 relicModifiers.damageBySchoolAdd.${school} is not a legal damage school`);
      }
      if (!Number.isFinite(value) || value < 0) throw new Error(`Derived-stat snapshot v${snapshot.snapshotVersion} relicModifiers.damageBySchoolAdd.${school} must be a non-negative finite number`);
    }
  }
  // A ruleset that pre-dates the persisted, host-owned snapshot keeps its v1
  // envelope; every ruleset from 3 on may arrive in either the v2 envelope it
  // was written in before the one format, or the v3 envelope written since.
  const expectedEnvelopes = snapshot.rulesetVersion >= 3 ? [2, 3] : [1];
  if (!expectedEnvelopes.includes(snapshot.snapshotVersion)) {
    throw new Error(`Derived-stat rulesetVersion ${snapshot.rulesetVersion} requires snapshotVersion ${expectedEnvelopes.join(' or ')}`);
  }
  throwProblems('derivedStatSnapshot', derivedStatRuleProblems(source, { ...options, unified: rowsAreUnified, carriers: true }));
  const rules = {
    rulesetVersion: source.rulesetVersion,
    // `perLevel: 0` UNDER a legacy table's defaults: rulesets 1–5 had no
    // table-wide level term, and a v3 envelope requires one, so a restored
    // v2 snapshot re-stamped as v3 must carry it or its NEXT load refuses it.
    defaults: { perLevel: 0, ...normalizeDefaultsPatch({ ...source.defaults }) },
    rules: Object.fromEntries(Object.entries(source.rules)
      .map(([id, row]) => [id, normalizeRule({ ...source.defaults, ...row })])),
  };
  return {
    // RE-STAMPED AT THE ENVELOPE THE ROWS ARE NOW IN. The restored table is
    // handed straight back to the run, written to the next save and sent over
    // a co-op handshake; saying v2 over ruleset-6-shaped rows would refuse the
    // save it just produced.
    snapshotVersion: snapshot.rulesetVersion >= 3 ? DERIVED_STAT_SNAPSHOT_VERSION : snapshot.snapshotVersion,
    rulesetVersion: snapshot.rulesetVersion,
    rules,
    ...(snapshot.relicModifiers ? { relicModifiers: structuredClone(snapshot.relicModifiers) } : {}),
  };
}
