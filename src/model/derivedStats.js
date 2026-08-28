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

export const DERIVED_STAT_IDS = Object.freeze(['energy', 'draw', 'hp', 'stamina', 'mana']);
export const DERIVED_STAT_ROUNDING = Object.freeze(['floor', 'ceil', 'round']);
// v1 is readable only so an unreleased class-base Mana snapshot can migrate to
// v2. New snapshots always use the authored v2 table.
export const DERIVED_STAT_RULESET_VERSIONS = Object.freeze([1, 2, 3]);
export const DERIVED_STAT_SNAPSHOT_VERSION = 2;
export const DERIVED_STAT_SNAPSHOT_VERSIONS = Object.freeze([1, 2]);

const ROOT_FIELDS = ['rulesetVersion', 'defaults', 'rules', 'presentation'];
const PRESENTATION_FIELDS = ['label', 'faceLabel', 'order', 'disclosure', 'sense'];
const DEFAULT_FIELDS = ['pointsPerTier', 'rounding', 'cap'];
const RULE_FIELDS = ['base', 'sourceStat', 'pointsPerTier', 'gainPerTier', 'rounding', 'cap'];
const OVERRIDE_FIELDS = ['defaults', 'rules'];
const BASE_FIELDS = ['strategy', 'field'];
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

function validateDefaults(out, value, path, { partial }) {
  if (!plainObject(value)) {
    problem(out, path, 'must be a plain object');
    return;
  }
  unknownFields(out, value, DEFAULT_FIELDS, path);
  for (const key of DEFAULT_FIELDS) if (!partial && !own(value, key)) problem(out, `${path}.${key}`, 'missing');
  validatePoints(out, value.pointsPerTier, `${path}.pointsPerTier`, !partial);
  validateRounding(out, value.rounding, `${path}.rounding`, !partial);
  validateCap(out, value.cap, `${path}.cap`, !partial);
}

function validateRule(out, value, path, options, partial) {
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
}

function normalizedOptions(options = {}) {
  return {
    attributeIds: Array.isArray(options.attributeIds) ? [...options.attributeIds] : [],
    classFields: Array.isArray(options.classFields) ? [...options.classFields] : ['maxHp', 'maxMana'],
    damageSchools: Array.isArray(options.damageSchools) ? [...options.damageSchools] : [],
  };
}

/** Returns named schema problems; it never throws and never repairs input. */
export function derivedStatRuleProblems(source, options = {}) {
  const out = [];
  const opts = normalizedOptions(options);
  if (!plainObject(source)) return [{ path: 'derivedStatRules', msg: 'must be a plain object' }];
  unknownFields(out, source, ROOT_FIELDS, 'derivedStatRules');
  if (!Number.isInteger(source.rulesetVersion) || !DERIVED_STAT_RULESET_VERSIONS.includes(source.rulesetVersion)) {
    problem(out, 'rulesetVersion', `must be one of ${DERIVED_STAT_RULESET_VERSIONS.join(', ')}`);
  }
  validateDefaults(out, source.defaults, 'defaults', { partial: false });
  if (!plainObject(source.rules)) {
    problem(out, 'rules', 'must be a plain object');
    return out;
  }
  for (const id of DERIVED_STAT_IDS) {
    if (!own(source.rules, id)) problem(out, `rules.${id}`, 'missing required derived-stat row');
    else validateRule(out, source.rules[id], `rules.${id}`, opts, false);
  }
  for (const id of Object.keys(source.rules)) {
    if (!DERIVED_STAT_IDS.includes(id)) problem(out, `rules.${id}`, `unknown derived-stat row '${id}'`);
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
  for (const id of DERIVED_STAT_IDS) {
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

function overrideProblems(value, path, options) {
  const out = [];
  if (!plainObject(value)) return [{ path, msg: 'must be a plain object' }];
  unknownFields(out, value, OVERRIDE_FIELDS, path);
  if (value.defaults !== undefined) validateDefaults(out, value.defaults, `${path}.defaults`, { partial: true });
  if (value.rules !== undefined) {
    if (!plainObject(value.rules)) problem(out, `${path}.rules`, 'must be a plain object');
    else for (const [id, row] of Object.entries(value.rules)) {
      if (!DERIVED_STAT_IDS.includes(id)) problem(out, `${path}.rules.${id}`, `unknown derived-stat row '${id}'`);
      else validateRule(out, row, `${path}.rules.${id}`, options, true);
    }
  }
  return out;
}

function throwProblems(label, problems) {
  if (problems.length) throw new Error(`${label}: ${problems.map((p) => `${p.path}: ${p.msg}`).join('; ')}`);
}

/** Resolve authored rows plus mode/run/debug layers into a self-contained table. */
export function resolveDerivedStatRules(source, options = {}) {
  const opts = normalizedOptions(options);
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
  const replayed = {
    rulesetVersion: source.rulesetVersion,
    defaults: { ...source.defaults },
    rules: Object.fromEntries(DERIVED_STAT_IDS.map((id) => [id, { ...source.defaults, ...structuredClone(source.rules[id]) }])),
  };
  for (const [, layer] of layers) {
    if (!layer) continue;
    if (layer.defaults) {
      Object.assign(replayed.defaults, layer.defaults);
      for (const id of DERIVED_STAT_IDS) Object.assign(replayed.rules[id], layer.defaults);
    }
    if (layer.rules) for (const [id, patch] of Object.entries(layer.rules)) Object.assign(replayed.rules[id], patch);
  }
  return replayed;
}

function baseValue(base, classDef, statId) {
  if (Number.isFinite(base)) return base;
  const value = classDef && base && classDef[base.field];
  if (!Number.isFinite(value)) throw new Error(`${statId}.base: class field '${base && base.field}' is not a finite number`);
  return value;
}

function gainValue(gain, classDef, statId) {
  if (Number.isFinite(gain)) return gain;
  const value = classDef && gain && classDef[gain.field];
  if (!Number.isFinite(value)) throw new Error(`${statId}.gainPerTier: class field '${gain && gain.field}' is not a finite number`);
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
  const gainPerTier = gainValue(rule.gainPerTier, classDef, statId);
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

/** Pure calculation. The returned receipt distinguishes base, tier, raw and cap. */
export function deriveStat(resolved, statId, { attributes, classDef } = {}) {
  const row = resolved && resolved.rules && resolved.rules[statId];
  if (!row) throw new Error(`Unknown derived stat '${statId}'`);
  const tierReceipt = deriveAttributeTierReceipt(row, { attributes, classDef, statId });
  const { points, tier } = tierReceipt;
  const base = baseValue(row.base, classDef, statId);
  const raw = base + tier * tierReceipt.gainPerTier;
  const value = row.cap === null ? raw : Math.min(raw, row.cap);
  return { id: statId, sourceStat: row.sourceStat, points, pointsPerTier: row.pointsPerTier, tier, base, gainPerTier: tierReceipt.gainPerTier, raw, cap: row.cap, value };
}

/** One compatibility contract for folding an authored relic tier into a rule. */
export function relicAttributeTierFoldProblems(term, rule) {
  const problems = [];
  if (!term || !rule) return [{ field: null, msg: 'requires a resolved target resource rule' }];
  if (term.sourceStat !== rule.sourceStat) {
    problems.push({ field: 'sourceStat', msg: `must match target rule sourceStat '${rule.sourceStat}'` });
  }
  // AN UNSTATED GRANULARITY INHERITS THE RULE IT FOLDS INTO and can never
  // mismatch it (Law 0 clause 1). A STATED one must still match exactly: "+1 HP
  // per 5 CON" genuinely cannot be added to a per-1 rule, and that refusal is
  // the arithmetic protecting itself, not a rule to relax.
  if (term.pointsPerTier !== undefined && term.pointsPerTier !== rule.pointsPerTier) {
    problems.push({ field: 'pointsPerTier', msg: `must match target rule pointsPerTier ${rule.pointsPerTier}` });
  }
  if (rule.rounding !== 'floor') {
    problems.push({ field: null, msg: `cannot fold into target rule rounding '${rule.rounding}'; attribute-tier modifiers require 'floor'` });
  }
  return problems;
}

function resolveSnapshotNumbers(rules, classDef, relicModifierReceipt, explicitOverride) {
  if (!classDef) throw new Error('Host snapshot creation requires a classDef');
  const out = structuredClone(rules);
  for (const [statId, row] of Object.entries(out.rules)) {
    row.base = baseValue(row.base, classDef, statId);
    row.gainPerTier = gainValue(row.gainPerTier, classDef, statId);
  }
  const resources = relicModifierReceipt && relicModifierReceipt.resources || {};
  for (const [statId, bonus] of Object.entries(resources)) {
    if (!bonus || (!bonus.flat && !(bonus.attributeTiers || []).length)) continue;
    const row = out.rules[statId];
    if (!row) throw new Error(`Relic modifier targets unknown derived resource '${statId}'`);
    const explicitRow = explicitOverride && explicitOverride.rules && explicitOverride.rules[statId] || {};
    if (explicitRow.base === undefined) row.base += bonus.flat || 0;
    if (explicitRow.gainPerTier === undefined) {
      for (const term of bonus.attributeTiers || []) {
        if (relicAttributeTierFoldProblems(term, row).length) {
          throw new Error(`Relic ${statId} attribute tier ${term.sourceStat}/${term.pointsPerTier} cannot fold into host rule ${row.sourceStat}/${row.pointsPerTier}/${row.rounding}`);
        }
        row.gainPerTier += term.amountPerTier;
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
  // Reconstitute an authored-shape table, validate it through the same door,
  // and resolve it without any live overrides. Resolved rows contain defaults;
  // those extra row keys are all legal authored override keys.
  const source = structuredClone(snapshot.rules);
  if (snapshot.snapshotVersion === 2) {
    for (const [id, row] of Object.entries(source.rules || {})) {
      if (!Number.isFinite(row.base) || !Number.isFinite(row.gainPerTier)) {
        throw new Error(`Derived-stat snapshot v2 '${id}' must carry numeric base and gainPerTier`);
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
      if (!Number.isFinite(value) || value < 0) throw new Error(`Derived-stat snapshot v2 relicModifiers.damageBySchoolAdd.${school} must be a non-negative finite number`);
    }
  }
  const expectedEnvelope = snapshot.rulesetVersion >= 3 ? 2 : 1;
  if (snapshot.snapshotVersion !== expectedEnvelope) {
    throw new Error(`Derived-stat rulesetVersion ${snapshot.rulesetVersion} requires snapshotVersion ${expectedEnvelope}`);
  }
  throwProblems('derivedStatSnapshot', derivedStatRuleProblems(source, normalizedOptions(options)));
  return {
    snapshotVersion: snapshot.snapshotVersion,
    rulesetVersion: snapshot.rulesetVersion,
    rules: source,
    ...(snapshot.relicModifiers ? { relicModifiers: structuredClone(snapshot.relicModifiers) } : {}),
  };
}
