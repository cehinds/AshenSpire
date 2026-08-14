// src/model/derivedStats.js — pure post-Phase-1 derived-stat rules.
//
// This module accepts an attribute allocation; it does not import, create or
// mutate one. That is the dependency seam which lets Phase 1 land first. It
// likewise has no run, combat, save, session or UI imports.

export const DERIVED_STAT_IDS = Object.freeze(['energy', 'draw', 'hp', 'stamina', 'mana']);
export const DERIVED_STAT_ROUNDING = Object.freeze(['floor', 'ceil', 'round']);
// v1 is readable only so an unreleased class-base Mana snapshot can migrate to
// v2. New snapshots always use the authored v2 table.
export const DERIVED_STAT_RULESET_VERSIONS = Object.freeze([1, 2]);
export const DERIVED_STAT_SNAPSHOT_VERSION = 1;

const ROOT_FIELDS = ['rulesetVersion', 'defaults', 'rules'];
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

function validateGain(out, value, path, required) {
  if (value === undefined && !required) return;
  if (!Number.isFinite(value)) problem(out, path, 'must be a finite number');
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
  validateGain(out, value.gainPerTier, `${path}.gainPerTier`, !partial);
  validateRounding(out, value.rounding, `${path}.rounding`, false);
  validateCap(out, value.cap, `${path}.cap`, false);
}

function normalizedOptions(options = {}) {
  return {
    attributeIds: Array.isArray(options.attributeIds) ? [...options.attributeIds] : [],
    classFields: Array.isArray(options.classFields) ? [...options.classFields] : ['maxHp', 'maxMana'],
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

/**
 * Generic attribute-tier receipt for weapon/armour/resource projections.
 * The caller supplies one already-resolved rule row, so authored defaults,
 * mode/run layers and the explicit/debug override have already merged once.
 * This helper owns no weapon base and mutates nothing.
 */
export function deriveAttributeTierReceipt(rule, { attributes, sourceStat = rule && rule.sourceStat } = {}) {
  if (!plainObject(rule)) throw new Error('Attribute tier rule must be a resolved rule row');
  const points = attributes && attributes[sourceStat];
  if (!Number.isFinite(points)) throw new Error(`sourceStat '${sourceStat}' is not a finite number`);
  if (!Number.isFinite(rule.pointsPerTier) || rule.pointsPerTier <= 0) throw new Error('pointsPerTier must be a finite number > 0');
  if (!Number.isFinite(rule.gainPerTier)) throw new Error('gainPerTier must be a finite number');
  const round = Math[rule.rounding];
  if (typeof round !== 'function') throw new Error(`rounding '${rule.rounding}' is not executable`);
  const tier = round(points / rule.pointsPerTier);
  return {
    sourceStat,
    points,
    pointsPerTier: rule.pointsPerTier,
    rounding: rule.rounding,
    tier,
    gainPerTier: rule.gainPerTier,
    value: tier * rule.gainPerTier,
  };
}

/** Pure calculation. The returned receipt distinguishes base, tier, raw and cap. */
export function deriveStat(resolved, statId, { attributes, classDef } = {}) {
  const row = resolved && resolved.rules && resolved.rules[statId];
  if (!row) throw new Error(`Unknown derived stat '${statId}'`);
  const tierReceipt = deriveAttributeTierReceipt(row, { attributes });
  const { points, tier } = tierReceipt;
  const base = baseValue(row.base, classDef, statId);
  const raw = base + tier * row.gainPerTier;
  const value = row.cap === null ? raw : Math.min(raw, row.cap);
  return { id: statId, sourceStat: row.sourceStat, points, pointsPerTier: row.pointsPerTier, tier, base, gainPerTier: row.gainPerTier, raw, cap: row.cap, value };
}

/** Host-created, immutable-by-convention rules receipt for co-op/save owners. */
export function createDerivedStatRuleSnapshot(source, options = {}) {
  if (options.authority !== 'host') throw new Error('Only the host authority may create a derived-stat rules snapshot');
  const rules = resolveDerivedStatRules(source, options);
  return structuredClone({
    snapshotVersion: DERIVED_STAT_SNAPSHOT_VERSION,
    rulesetVersion: rules.rulesetVersion,
    rules,
  });
}

/** Restore exactly what the host saved; current authored data is not consulted. */
export function restoreDerivedStatRuleSnapshot(snapshot, options = {}) {
  if (!plainObject(snapshot)) throw new Error('Derived-stat snapshot must be an object');
  if (snapshot.snapshotVersion !== DERIVED_STAT_SNAPSHOT_VERSION) {
    throw new Error(`Unknown derived-stat snapshotVersion ${snapshot.snapshotVersion} (expected ${DERIVED_STAT_SNAPSHOT_VERSION})`);
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
  throwProblems('derivedStatSnapshot', derivedStatRuleProblems(source, normalizedOptions(options)));
  return { snapshotVersion: snapshot.snapshotVersion, rulesetVersion: snapshot.rulesetVersion, rules: source };
}
