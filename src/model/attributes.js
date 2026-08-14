// src/model/attributes.js — the one reader for creation-stat data.
// No combat or derived-resource behavior belongs here.

const plainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function tables(source) {
  if (source && source.attributes && typeof source.attributes.all === 'function') {
    return {
      attributes: source.attributes.all(),
      creationModes: source.creationModes.all(),
      attributeRules: source.attributeRules,
      classes: source.classes.all(),
    };
  }
  return {
    attributes: Array.isArray(source && source.attributes) ? source.attributes : [],
    creationModes: Array.isArray(source && source.creationModes) ? source.creationModes : [],
    attributeRules: source && source.attributeRules,
    classes: Array.isArray(source && source.classes) ? source.classes : [],
  };
}

export function orderedAttributes(source) {
  return tables(source).attributes.slice().sort((a, b) => a.order - b.order);
}

export function defaultCreationModeId(source) {
  const t = tables(source);
  const id = t.attributeRules && t.attributeRules.defaultMode;
  if (typeof id !== 'string' || !t.creationModes.some((m) => m && m.id === id)) {
    throw new Error(`attributeRules.defaultMode '${id}' does not resolve`);
  }
  return id;
}

export function creationMode(source, modeId = defaultCreationModeId(source)) {
  const mode = tables(source).creationModes.find((m) => m && m.id === modeId);
  if (!mode) throw new Error(`Unknown attribute creation mode '${modeId}'`);
  return mode;
}

export function allocationTotal(source, modeId = defaultCreationModeId(source)) {
  const mode = creationMode(source, modeId);
  return mode.baseline * orderedAttributes(source).length + mode.bonusPool;
}

function retiredNames(t) {
  const map = plainObject(t.attributeRules) ? t.attributeRules.retired : undefined;
  return plainObject(map) ? map : {};
}

function allocationProblems(t, classId, modeId, values, path) {
  const problems = [];
  const attrs = t.attributes.slice().sort((a, b) => a.order - b.order);
  const mode = t.creationModes.find((m) => m && m.id === modeId);
  if (!mode) problems.push({ path: 'attributeMode', msg: `unknown creation mode '${modeId}'` });
  if (!t.classes.some((c) => c && c.id === classId)) problems.push({ path: 'class', msg: `unknown class '${classId}'` });
  if (!plainObject(values)) {
    problems.push({ path, msg: 'must be a plain object keyed by attribute id' });
    return problems;
  }
  const ids = attrs.map((a) => a && a.id).filter((id) => typeof id === 'string');
  const retired = retiredNames(t);
  for (const id of ids) if (!Object.hasOwn(values, id)) problems.push({ path: `${path}.${id}`, msg: 'missing attribute cell' });
  for (const id of Object.keys(values)) {
    if (ids.includes(id)) continue;
    problems.push({ path: `${path}.${id}`, msg: Object.hasOwn(retired, id)
      ? `'${id}' is a retired attribute id (its heir is '${retired[id]}')`
      : `unknown attribute id '${id}'` });
  }
  if (!mode) return problems;
  let total = 0;
  let allIntegers = true;
  for (const id of ids) {
    const value = values[id];
    if (!Number.isInteger(value)) {
      allIntegers = false;
      problems.push({ path: `${path}.${id}`, msg: 'must be an integer' });
      continue;
    }
    const floor = mode.belowBaseline === 'forbid' ? Math.max(mode.minimum, mode.baseline) : mode.minimum;
    if (value < floor || value > mode.maximum) problems.push({ path: `${path}.${id}`, msg: `must be between ${floor} and ${mode.maximum} for mode '${mode.id}'` });
    total += value;
  }
  if (allIntegers && mode.redistribution === 'fixedTotal') {
    const expected = mode.baseline * ids.length + mode.bonusPool;
    if (total !== expected) problems.push({ path, msg: `total ${total} must equal ${expected} for mode '${mode.id}'` });
  }
  return problems;
}

export function attributeAllocationProblems(source, classId, modeId, values, path = 'attributes') {
  return allocationProblems(tables(source), classId, modeId, values, path);
}

export function classAttributePreset(source, classId, modeId = defaultCreationModeId(source)) {
  const t = tables(source);
  const values = t.attributeRules && t.attributeRules.presets
    && t.attributeRules.presets[modeId] && t.attributeRules.presets[modeId][classId];
  const path = `attributeRules.presets.${modeId}.${classId}`;
  const problems = allocationProblems(t, classId, modeId, values, path);
  if (problems.length) throw new Error(problems.map((p) => `${p.path}: ${p.msg}`).join('; '));
  return Object.fromEntries(orderedAttributes(source).map((def) => [def.id, values[def.id]]));
}

/**
 * migrateRetiredAttributeNames(run, source) — heal a persisted run written
 * under a since-retired attribute id, IN PLACE, before validation rules on it.
 *
 * The one legitimate carrier is a save from before the rename ('constitution'
 * held the HP seat 2026-08-11 → 2026-08-14, d465cfc). Such a save spells the
 * dead name in exactly two persisted homes, and this walks both:
 *   · run.attributes — the allocation keys;
 *   · run.derivedStatRuleSnapshot.rules.rules[*].sourceStat — the snapshot
 *     restoreDerivedStatRuleSnapshot would otherwise refuse.
 *
 * DELIBERATE: a run carrying BOTH the dead name and its heir in one
 * allocation is NOT migrated — it falls through to validation and is refused
 * by name (Law 0 clause 5: a wrong-but-reasonable guess is invisible; this
 * save has two claims on one seat and no honest way to pick).
 */
export function migrateRetiredAttributeNames(run, source) {
  const retired = retiredNames(tables(source));
  for (const [dead, heir] of Object.entries(retired)) {
    if (plainObject(run.attributes) && Object.hasOwn(run.attributes, dead) && !Object.hasOwn(run.attributes, heir)) {
      run.attributes[heir] = run.attributes[dead];
      delete run.attributes[dead];
    }
    const snapshot = run.derivedStatRuleSnapshot;
    const rules = snapshot && plainObject(snapshot.rules) && plainObject(snapshot.rules.rules)
      ? snapshot.rules.rules : null;
    if (rules) {
      for (const rule of Object.values(rules)) {
        if (plainObject(rule) && rule.sourceStat === dead) rule.sourceStat = heir;
      }
    }
  }
  return run;
}

export function normalizeRunAttributes(run, registries) {
  const modeAbsent = run.attributeMode === undefined;
  const valuesAbsent = run.attributes === undefined;
  if (modeAbsent !== valuesAbsent) throw new Error('attributeMode and attributes must both be present or both be absent');
  migrateRetiredAttributeNames(run, registries);
  if (modeAbsent) {
    run.attributeMode = defaultCreationModeId(registries);
    run.attributes = classAttributePreset(registries, run.class, run.attributeMode);
    return run;
  }
  const problems = attributeAllocationProblems(registries, run.class, run.attributeMode, run.attributes);
  if (problems.length) throw new Error(problems.map((p) => `${p.path}: ${p.msg}`).join('; '));
  run.attributes = Object.fromEntries(orderedAttributes(registries).map((def) => [def.id, run.attributes[def.id]]));
  return run;
}

export function attributeContentProblems(source) {
  const t = tables(source);
  const out = [];
  if (!t.attributes.length) out.push({ path: 'attributes', msg: 'must define at least one attribute' });
  if (!t.creationModes.length) out.push({ path: 'creationModes', msg: 'must define at least one creation mode' });
  const orders = new Map();
  for (const attr of t.attributes) {
    if (!attr || typeof attr.id !== 'string' || !attr.id) continue;
    if (!Number.isInteger(attr.order) || attr.order < 0) out.push({ path: `attributes.${attr.id}.order`, msg: 'must be a non-negative integer' });
    else if (orders.has(attr.order)) out.push({ path: `attributes.${attr.id}.order`, msg: `duplicates order ${attr.order} used by '${orders.get(attr.order)}'` });
    else orders.set(attr.order, attr.id);
  }
  for (const mode of t.creationModes) {
    if (!mode || typeof mode.id !== 'string' || !mode.id) continue;
    const path = `creationModes.${mode.id}`;
    if (Number.isInteger(mode.minimum) && Number.isInteger(mode.baseline) && mode.minimum > mode.baseline) out.push({ path, msg: `minimum ${mode.minimum} exceeds baseline ${mode.baseline}` });
    if (Number.isInteger(mode.baseline) && Number.isInteger(mode.maximum) && mode.baseline > mode.maximum) out.push({ path, msg: `baseline ${mode.baseline} exceeds maximum ${mode.maximum}` });
    if (Number.isInteger(mode.bonusPool) && mode.bonusPool < 0) out.push({ path: `${path}.bonusPool`, msg: 'must be >= 0' });
  }
  if (!plainObject(t.attributeRules)) return [...out, { path: 'attributeRules', msg: 'must be a plain object' }];
  // Retired vocabulary (content/retiredNames.js): a dead name may never
  // return as an attribute id — the refusal names it — and its heir must be
  // a live one, or the load-door healing would migrate saves onto a ghost.
  const liveIds = t.attributes.map((a) => a && a.id).filter((id) => typeof id === 'string');
  for (const [dead, heir] of Object.entries(retiredNames(t))) {
    if (liveIds.includes(dead)) out.push({ path: `attributes.${dead}`, msg: `'${dead}' is a retired attribute id (heir '${heir}') and may not return as a row` });
    if (!liveIds.includes(heir)) out.push({ path: `attributeRules.retired.${dead}`, msg: `heir '${heir}' is not a live attribute id` });
  }
  const modeIds = t.creationModes.map((m) => m && m.id).filter((id) => typeof id === 'string');
  const classIds = t.classes.map((c) => c && c.id).filter((id) => typeof id === 'string');
  const presets = plainObject(t.attributeRules.presets) ? t.attributeRules.presets : {};
  for (const id of Object.keys(presets)) if (!modeIds.includes(id)) out.push({ path: `attributeRules.presets.${id}`, msg: `unknown creation mode '${id}'` });
  for (const modeId of modeIds) {
    const byClass = presets[modeId];
    if (!plainObject(byClass)) {
      out.push({ path: `attributeRules.presets.${modeId}`, msg: 'missing mode preset table' });
      continue;
    }
    for (const id of Object.keys(byClass)) if (!classIds.includes(id)) out.push({ path: `attributeRules.presets.${modeId}.${id}`, msg: `unknown class '${id}'` });
    for (const classId of classIds) {
      const path = `attributeRules.presets.${modeId}.${classId}`;
      if (!Object.hasOwn(byClass, classId)) out.push({ path, msg: 'missing class × mode preset cell' });
      else out.push(...allocationProblems(t, classId, modeId, byClass[classId], path));
    }
  }
  return out;
}
