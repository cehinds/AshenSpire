// src/model/validate/schemaWalks.js — the central schema walks and the meaning rules that ride on them.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { weaknessProblems } from '../enemyWeaknessRules.js';
import {
  SCHEMAS,
  RUN_LEVEL_EVENTS,
  REGISTRY_TYPES,
  DAMAGE_SCHOOLS,
  RELIC_MODIFIER_TAGS,
} from '../schemas.js';
import { treeProblems } from '../tree.js';
import { locationTaggingProblems } from '../locations.js';
import { attributeContentProblems } from '../attributes.js';
import {
  derivedStatPresentationProblems,
  derivedStatRuleProblems,
  relicAttributeTierFoldProblems,
} from '../derivedStats.js';
import { derivedStatFloorProblems } from '../startingStatConfig.js';
import { walkSchema } from './schemaWalk.js';
import { propertyRuleProblems } from './propertyRules.js';

export function schemaWalkProblems(b, err, ctx) {
  const { vctx } = ctx;
  // ---- schema walks --------------------------------------------------------
  const typeToSchema = {
    attributes: SCHEMAS.attribute,
    creationModes: SCHEMAS.creationMode,
    cards: SCHEMAS.card,
    resources: SCHEMAS.resource,
    relics: SCHEMAS.relic,
    statuses: SCHEMAS.status,
    stances: SCHEMAS.stance,
    keywords: SCHEMAS.keyword,
    enemies: SCHEMAS.enemy,
    encounters: SCHEMAS.encounter,
    events: SCHEMAS.event,
    flasks: SCHEMAS.flask,
    classes: SCHEMAS.class,
    seats: SCHEMAS.seat,
  };
  for (const type of REGISTRY_TYPES) {
    // A registry that is present but not an array was SILENTLY SKIPPED here —
    // every rule below read it as empty — and then a later unguarded `for…of`
    // threw, so the bundle failed with a stack instead of an answer. Named, so
    // the author is told which registry and what it should be.
    if (b[type] !== undefined && !Array.isArray(b[type])) {
      err(type, `must be an array of ${type} rows (got ${Array.isArray(b[type]) ? 'array' : typeof b[type]})`);
    }
    const defs = Array.isArray(b[type]) ? b[type] : [];
    defs.forEach((def) => {
      const path = `${type}.${(def && def.id) || '?'}`;
      walkSchema(def, typeToSchema[type], path, vctx);
    });
  }
  propertyRuleProblems(b, vctx);
  // The tree the tag tables and the property rules are derived from: parents,
  // cycles, edges, families, variables against bindings, kinds against
  // collections (model/tree.js says what each refusal is).
  // A combat source hooked on a run-level event (arrived, rested) would never
  // fire: only the location visit emits them, outside any fight.
  for (const [collection, field] of [['statuses', 'hooks'], ['stances', 'hooks'], ['enemies', 'phases']]) {
    for (const def of Array.isArray(b[collection]) ? b[collection] : []) {
      (def && Array.isArray(def[field]) ? def[field] : []).forEach((hook, i) => {
        if (hook && RUN_LEVEL_EVENTS.includes(hook.on)) err(`${collection}.${def.id}.${field}[${i}].on`, `'${hook.on}' is a run-level event (the location visit's) that no ${collection.slice(0, -1)} hook can hear`);
      });
    }
  }
  for (const p of treeProblems(b)) err(p.path, p.message);
  // Locations (plan phase 7): a `location` tagging row names a map id, every
  // rest-mana mode has its rule, and a restDenied filter names a carried tag.
  for (const p of locationTaggingProblems(b)) err(p.path, p.message);
  for (const enemy of Array.isArray(b.enemies) ? b.enemies : []) {
    const base = `enemies.${enemy && enemy.id || '?'}`;
    const cfg = enemy && enemy.arcaneExposure;
    if (cfg && cfg.mode === 'configured') {
      for (const field of ['threshold', 'buildupMultiplier', 'resetMode', 'overflowPolicy', 'lockPolicy', 'onBreak']) {
        if (cfg[field] === undefined) err(`${base}.arcaneExposure.${field}`, `Missing required configured field '${field}'`);
      }
      if (!Number.isInteger(cfg.threshold) || cfg.threshold <= 0) err(`${base}.arcaneExposure.threshold`, 'must be a positive integer');
      if (!Number.isFinite(cfg.buildupMultiplier) || cfg.buildupMultiplier <= 0) err(`${base}.arcaneExposure.buildupMultiplier`, 'must be finite and > 0');
      if (cfg.onBreak && (!Number.isFinite(cfg.onBreak.value) || cfg.onBreak.value <= 0)) err(`${base}.arcaneExposure.onBreak.value`, 'must be finite and > 0');
      if (cfg.onBreak && (!Number.isInteger(cfg.onBreak.duration) || cfg.onBreak.duration <= 0)) err(`${base}.arcaneExposure.onBreak.duration`, 'must be a positive integer');
    } else if (cfg && cfg.mode === 'immune') {
      for (const field of Object.keys(cfg)) if (field !== 'mode') err(`${base}.arcaneExposure.${field}`, `immune policy may not author '${field}'`);
    }
    if (enemy && enemy.weaknesses !== undefined) for (const problem of weaknessProblems(enemy.weaknesses)) err(`${base}.weaknesses`, problem);
    for (const [school, percent] of Object.entries((enemy && enemy.damageResistanceBySchool) || {})) {
      if (!DAMAGE_SCHOOLS.includes(school)) err(`${base}.damageResistanceBySchool.${school}`, `unknown damage school '${school}'`);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) err(`${base}.damageResistanceBySchool.${school}`, 'must be a finite percent from 0 to 100');
    }
  }
  walkSchema(b.attributeRules, SCHEMAS.attributeRules, 'attributeRules', vctx);
  for (const problem of attributeContentProblems(b)) err(problem.path, problem.msg);
  const equipmentProfileIds = new Set((((b.equipment || {}).basicCardProfiles) || []).map((row) => row && row.id));
  for (const mode of b.creationModes || []) {
    for (const [profileId, patch] of Object.entries((mode && mode.equipmentProfiles) || {})) {
      const path = `creationModes.${mode.id}.equipmentProfiles.${profileId}`;
      if (!equipmentProfileIds.has(profileId)) err(path, `unknown equipment profile '${profileId}'`);
      if (patch.baseValue !== undefined && !Number.isFinite(patch.baseValue)) err(`${path}.baseValue`, 'must be finite');
      if (patch.ratingId !== undefined && !['ar', 'dr', 'pr', 'poise', 'ward'].includes(patch.ratingId)) err(`${path}.ratingId`, 'must be a known rating');
      if (patch.cap !== undefined && patch.cap !== null && (!Number.isFinite(patch.cap) || patch.cap < 0)) err(`${path}.cap`, 'must be null or finite and >= 0');
    }
  }
  for (const problem of derivedStatRuleProblems(b.derivedStatRules, {
    attributeIds: (b.attributes || []).map((row) => row.id),
    classFields: ['maxHp'],
  })) err(problem.path, problem.msg);
  // A row's per-class form names shipped classes only: a misspelt class id
  // would silently open that class on the shared row.
  const classIds = new Set((b.classes || []).map((row) => row.id));
  for (const [id, row] of Object.entries(b.derivedStatRules?.rules || {})) {
    for (const classId of Object.keys((row && typeof row.byClass === 'object' && row.byClass) || {})) {
      if (!classIds.has(classId)) err(`derivedStatRules.rules.${id}.byClass.${classId}`, `unknown class '${classId}'`);
    }
  }
  // D26's short form: every derived stat carries how it READS, beside the rule
  // it describes. Content-door only — a save's restored snapshot has rules and
  // no prose, and asking it for prose it never stored would refuse a legal save.
  for (const problem of derivedStatPresentationProblems(b.derivedStatRules)) err(problem.path, problem.msg);
  // Mana must be at least 1 for the weakest character creation allows: a run
  // born with 0 Mana fails its own shape check (model/startingStatConfig.js).
  for (const problem of derivedStatFloorProblems(b)) err(problem.path, problem.message);

  // Relic modifier tags are a compact passive DSL. The tag is the behavior;
  // every other word is data. Validate the exact row here so a typo never
  // becomes a plausible-looking inert bonus.
  const attributeIds = new Set((b.attributes || []).map((row) => row && row.id));
  const resourceIds = new Set(['hp', 'mana', 'stamina']);
  const starterRelicIds = new Set((b.classes || []).map((row) => row && row.startingRelic));
  for (const relic of b.relics || []) {
    const rows = relic && relic.passives && relic.passives.modifiers;
    if (rows === undefined) continue;
    const base = `relics.${relic.id}.passives.modifiers`;
    if (!Array.isArray(rows)) {
      err(base, 'must be an array');
      continue;
    }
    if (rows.length && (relic.rarity !== 'starter' || !starterRelicIds.has(relic.id))) {
      err(base, 'resource/damage modifier tags are restricted to class starting relics');
    }
    rows.forEach((row, index) => {
      const path = `${base}[${index}]`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        err(path, 'must be an object');
        return;
      }
      if (!RELIC_MODIFIER_TAGS.includes(row.tag)) {
        err(`${path}.tag`, `'${row.tag}' is unknown (legal: ${RELIC_MODIFIER_TAGS.join(', ')})`);
        return;
      }
      const fields = row.tag === 'resource.flat'
        ? ['tag', 'resource', 'amount']
        : row.tag === 'resource.attributeTier'
          ? ['tag', 'resource', 'sourceStat', 'pointsPerTier', 'amountPerTier']
          : row.tag === 'damage.school.flat'
            ? ['tag', 'school', 'amount']
            : [];
      // `pointsPerTier` is ALLOWED and no longer REQUIRED on an attributeTier
      // row: omitted, it inherits the derived rule it folds into
      // (model/relicModifiers.js). It stayed required while the tier size was a
      // constant; the day Constantine asked for that size to be a dial, a row
      // restating it became a copy that made a reaver unable to start a run.
      const optional = row.tag === 'resource.attributeTier' ? ['pointsPerTier'] : [];
      for (const key of Object.keys(row)) if (!fields.includes(key)) err(`${path}.${key}`, `unknown field '${key}' for '${row.tag}'`);
      for (const key of fields) if (row[key] === undefined && !optional.includes(key)) err(`${path}.${key}`, `missing required field '${key}'`);
      if (row.resource !== undefined && !resourceIds.has(row.resource)) err(`${path}.resource`, `unknown resource '${row.resource}'`);
      if (row.sourceStat !== undefined && !attributeIds.has(row.sourceStat)) err(`${path}.sourceStat`, `unknown attribute '${row.sourceStat}'`);
      if (row.school !== undefined && !DAMAGE_SCHOOLS.includes(row.school)) err(`${path}.school`, `unknown damage school '${row.school}'`);
      for (const key of ['amount', 'amountPerTier']) {
        if (row[key] !== undefined && (!Number.isInteger(row[key]) || row[key] <= 0)) err(`${path}.${key}`, 'must be a positive integer');
      }
      if (row.pointsPerTier !== undefined && (!Number.isInteger(row.pointsPerTier) || row.pointsPerTier <= 0)) {
        err(`${path}.pointsPerTier`, 'must be a positive integer');
      }
      if (row.tag === 'resource.attributeTier') {
        const authoredRule = b.derivedStatRules && b.derivedStatRules.rules && b.derivedStatRules.rules[row.resource];
        const defaults = b.derivedStatRules && b.derivedStatRules.defaults || {};
        const resolvedRule = authoredRule && { ...defaults, ...authoredRule };
        if (resolvedRule) {
          for (const foldProblem of relicAttributeTierFoldProblems(row, resolvedRule)) {
            err(foldProblem.field ? `${path}.${foldProblem.field}` : path,
              `${foldProblem.msg} so the ${row.resource} modifier can fold at content boot`);
          }
        }
      }
    });
  }

  for (const cls of b.classes || []) {
  }
}
