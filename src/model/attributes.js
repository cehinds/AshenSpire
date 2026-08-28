// src/model/attributes.js — the one reader for creation-stat data.
// No combat or derived-resource behavior belongs here.

// The run door's witness (src/model/healLedger.js). `note` is a no-op unless a
// door is open and never changes a value — this file's behaviour is unchanged.
import { note } from './healLedger.js';

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

/**
 * grantedAttributePoints(run) — points this run holds ON TOP OF its creation
 * allocation.
 *
 * THE CREATION RULES ARE ABOUT CREATION, AND THIS IS THE LINE THAT SAYS SO.
 * `standard` is `fixedTotal` at 55 with every cell in 10..15 — rules about the
 * five minutes at the character screen, enforced at the LOAD DOOR, where they
 * were the only rules that had ever applied because nothing could change an
 * allocation after creation. Levelling at a shrine changes one (Constantine:
 * "at level up they may increase a stat by 1 point"), so those two clauses now
 * have to be told how many points the run legitimately grew by.
 *
 * THIS IS NOT A LOOSENING. A run claiming points it did not buy is still
 * refused by name; what moved is that the expected total is `55 + granted` and
 * the per-cell ceiling rises by the same points, since a player may pour every
 * level into one stat.
 *
 * WHY THE SEAM IS HERE AND NOT IN THE SHRINE SCREEN, measured: `save.js` calls
 * `normalizeRunAttributes` inside the try whose catch ARCHIVES THE SAVE. A
 * level-up that only incremented `run.attributes` would look perfect on screen
 * and destroy the player's run at the next load.
 *
 * ⚠ THE HAZARD THIS FUNCTION SHIPPED WITH IS GONE, AND THE FIX WAS NOT A BETTER
 * ERROR MESSAGE. At `e05be89` it multiplied `run.levelUps` by a LIVE read of
 * `balance.levelUp.pointsPerLevel`. Constantine then asked for that number to be
 * a dial he turns between test runs — which would have made every in-flight save
 * fail this check the first time he turned it, and `save.js` ARCHIVES what fails
 * here. The right answer was to delete the dependency, not to soften the
 * refusal: the run records the points it was actually granted, at the moment it
 * was granted them, and this reads what the run recorded.
 *
 * **NOTHING IN THIS FUNCTION READS CONTENT ANY MORE.** No setting, no table and
 * no edit anywhere can refuse a save that was legal when it was written. That is
 * also why `source` is gone from the signature — a parameter nothing uses is an
 * invitation to start using it again.
 *
 * `levelUps` IS THE FALLBACK AND IT IS EXACT, NOT A GUESS. Runs saved by
 * `e05be89` carry `levelUps` and no `levelPoints`; THAT BUILD HAD EXACTLY ONE
 * POSSIBLE VALUE, 1, because the dial did not exist in it. So one point per
 * level is what those saves were made under — read off the build that wrote
 * them, never inferred from today's tables (Law 0 clause 5: the plausible guess
 * is the dangerous one).
 */
export function grantedAttributePoints(run) {
  if (run && Number.isInteger(run.levelPoints)) return Math.max(0, run.levelPoints);
  return run && Number.isInteger(run.levelUps) ? Math.max(0, run.levelUps) : 0;
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

function allocationProblems(t, classId, modeId, values, path, granted = 0) {
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
    // The ceiling rises with granted points because a player may pour every
    // level into one stat; the FLOOR does not move, because nothing about
    // levelling can take a point away.
    const ceiling = mode.maximum + granted;
    if (value < floor || value > ceiling) {
      problems.push({ path: `${path}.${id}`, msg: granted
        ? `must be between ${floor} and ${ceiling} for mode '${mode.id}' with ${granted} levelled point(s)`
        : `must be between ${floor} and ${ceiling} for mode '${mode.id}'` });
    }
    total += value;
  }
  if (allIntegers && mode.redistribution === 'fixedTotal') {
    const expected = mode.baseline * ids.length + mode.bonusPool + granted;
    if (total !== expected) {
      problems.push({ path, msg: granted
        ? `total ${total} must equal ${expected} for mode '${mode.id}' with ${granted} levelled point(s)`
        : `total ${total} must equal ${expected} for mode '${mode.id}'` });
    }
  }
  return problems;
}

export function attributeAllocationProblems(source, classId, modeId, values, path = 'attributes', granted = 0) {
  return allocationProblems(tables(source), classId, modeId, values, path, granted);
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
    const snapshot = run.derivedStatRuleSnapshot;
    const rules = snapshot && plainObject(snapshot.rules) && plainObject(snapshot.rules.rules)
      ? snapshot.rules.rules : null;
    const allocationDead = plainObject(run.attributes) && Object.hasOwn(run.attributes, dead);
    const allocationHeir = plainObject(run.attributes) && Object.hasOwn(run.attributes, heir);
    const sourceRows = rules ? Object.entries(rules).filter(([, rule]) => plainObject(rule)) : [];
    const snapshotDead = sourceRows.filter(([, rule]) => rule.sourceStat === dead).map(([id]) => id);
    const snapshotHeir = sourceRows.filter(([, rule]) => rule.sourceStat === heir).map(([id]) => id);
    const deadPaths = [
      ...(allocationDead ? [`attributes.${dead}`] : []),
      ...snapshotDead.map((id) => `derivedStatRuleSnapshot.rules.rules.${id}.sourceStat`),
    ];
    const heirPaths = [
      ...(allocationHeir ? [`attributes.${heir}`] : []),
      ...snapshotHeir.map((id) => `derivedStatRuleSnapshot.rules.rules.${id}.sourceStat`),
    ];
    // Preflight before touching either carrier: mixed vocabularies are two
    // competing claims on one stat seat, even when they occur in different
    // persisted homes. Refuse atomically and name every witness.
    if (deadPaths.length && heirPaths.length) {
      throw new Error(`Mixed retired attribute '${dead}' and heir '${heir}' at ${[...deadPaths, ...heirPaths].join(', ')}`);
    }
    if (allocationDead) {
      note(run, {
        kind: 'rename',
        site: 'attributes.js:migrateRetiredAttributeNames',
        field: `attributes.${dead}`,
        was: { [dead]: run.attributes[dead] },
        now: { [heir]: run.attributes[dead] },
        why: `the retired seat '${dead}' was carried to its heir '${heir}', points intact`,
      });
      run.attributes[heir] = run.attributes[dead];
      delete run.attributes[dead];
    }
    if (rules) {
      const moved = [];
      for (const [id, rule] of Object.entries(rules)) {
        if (plainObject(rule) && rule.sourceStat === dead) { rule.sourceStat = heir; moved.push(id); }
      }
      if (moved.length) {
        note(run, {
          kind: 'rename',
          site: 'attributes.js:migrateRetiredAttributeNames',
          field: 'derivedStatRuleSnapshot.rules.rules[*].sourceStat',
          was: { [dead]: moved },
          now: { [heir]: moved },
          why: `${moved.length} persisted snapshot rule(s) re-pointed from '${dead}' to '${heir}'`,
        });
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
    // ONE OF THE THREE UNGATED HEALS, and the one that started this: the pair is
    // optional in RUN_SHAPE with no schemaVersion gate, so a CURRENT-schema save
    // whose allocation is gone comes back wearing the class preset. Somebody
    // else's build. It still does; it says so now, with the schemaVersion of the
    // save it happened to, which is the number the parked refuse question turns on.
    note(run, {
      kind: 'heal',
      site: 'attributes.js:normalizeRunAttributes',
      field: 'attributes+attributeMode',
      was: undefined,
      now: { attributeMode: run.attributeMode, attributes: { ...run.attributes } },
      why: `absent in the save: REFILLED FROM THE CLASS PRESET for '${run.class}' — this is a plausible allocation, not the player's`,
    });
    return run;
  }
  // THE ALLOCATION IS JUDGED AGAINST CREATION PLUS WHAT WAS LEVELLED. A run
  // that has bought no levels is judged by exactly the rules it always was —
  // `granted` is 0 and every message is byte-for-byte the one it printed
  // before.
  const problems = attributeAllocationProblems(
    registries, run.class, run.attributeMode, run.attributes, 'attributes',
    grantedAttributePoints(run),
  );
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
