import { MAX_ENEMIES_PER_COMBAT } from './combatLimits.js';
import { fixCoreProtection } from '../content/generated/fixCoreProtection.js';
// src/model/validate.js — content validation (SPEC §3.14)
//
// Runs at boot in dev mode and from the test page. Checks, across ALL content:
//   1. Schema conformance (fields, types, enums; unknown fields fail loudly).
//   2. Every id cross-reference resolves (no dangling ids).
//   3. Every opcode, formula op, trigger event, and predicate is in the
//      closed sets of SPEC §3.4–§3.6.
//   4. Every text-template token binds, and every player-visible literal
//      numeric effect has a token (SPEC §3.13) — enforced for cards + relics.
//   5. scripts.js budget report: script-using content stays < 5% of content.
//
// Headless: no document/window/localStorage/timers.

import { weaknessProblems } from './enemyWeaknessRules.js';
import { sigils as shippedSigils } from '../content/sigils.js';
import { consumables as shippedConsumables } from '../content/consumables.js';
import { companions as shippedCompanions } from '../content/companions.js';
import { consumableTableProblems, companionTableProblems } from './consumables.js';
import { resolveFloorPlan } from './floorplan.js';
import { assertTableSane } from './secondbeat.js';
import { viewRefusals, geometryRefusals } from './map/mapview.js';
import { graceRefillRefusals } from './gracerefill.js';
import { flaskGrowthRefusals } from './flaskgrowth.js';
import { SCHEMAS, RUN_LEVEL_EVENTS, REGISTRY_TYPES, DAMAGE_SCHOOLS, RELIC_MODIFIER_TAGS } from './schemas.js';
import { RESOURCE_SOURCE_IDS } from './resources.js';
import { treeProblems } from './tree.js';
import { locationTaggingProblems } from './locations.js';
import { attributeContentProblems } from './attributes.js';
import { derivedStatPresentationProblems, derivedStatRuleProblems, relicAttributeTierFoldProblems } from './derivedStats.js';
import { derivedStatFloorProblems } from './startingStatConfig.js';
import { enemyLevelProfileProblems, levelBandProblems, levelConfigProblems } from './levels.js';
import { describe, isPlainObject } from './validate/shared.js';
import {
  validateEffects as validateEffects_,
  validateTriggers as validateTriggers_,
  validatePredicate as validatePredicate_,
  validateFormula as validateFormula_,
} from './validate/effectGrammar.js';
export const validateEffects = validateEffects_;
export const validateTriggers = validateTriggers_;
export const validatePredicate = validatePredicate_;
export const validateFormula = validateFormula_;
import {
  TOKENIZABLE_OPS as TOKENIZABLE_OPS_,
  REQUIRED_TOKEN_OPS as REQUIRED_TOKEN_OPS_,
  relicTokens as relicTokens_,
  computeTokenBindings as computeTokenBindings_,
  cardTokenEffects as cardTokenEffects_,
  extractTemplateTokens as extractTemplateTokens_,
} from './validate/tokenBindings.js';
export const TOKENIZABLE_OPS = TOKENIZABLE_OPS_;
export const REQUIRED_TOKEN_OPS = REQUIRED_TOKEN_OPS_;
export const relicTokens = relicTokens_;
export const computeTokenBindings = computeTokenBindings_;
export const cardTokenEffects = cardTokenEffects_;
export const extractTemplateTokens = extractTemplateTokens_;
import { validateSfxRecipes, validateMusicBeds, walkSchema } from './validate/schemaWalk.js';
import {
  validateCardRamp,
  validateCardContest,
  validateCardTemplates,
  validateRelicTemplate,
} from './validate/templates.js';
import { relicPropertyTagIndex, propertyRuleProblems, usesScript } from './validate/propertyRules.js';
import { deckRulesTableProblems as deckRulesTableProblems_ } from './validate/deckRulesTable.js';
export const deckRulesTableProblems = deckRulesTableProblems_;
import { validateSigils } from './validate/sigilRows.js';
import { rootProblems } from './validate/root.js';
import { questProblems } from './validate/quests.js';
import { idSetProblems } from './validate/idSets.js';
import { cardCostProblems } from './validate/cardCosts.js';
import { balanceRowProblems } from './validate/balanceRows.js';
import { rewardScheduleProblems } from './validate/rewardSchedule.js';
import { progressionProblems } from './validate/progression.js';
import { classTreeProblems } from './validate/classTree.js';
import { tagContextProblems } from './validate/tagContext.js';
import { equipmentProblems } from './validate/equipment.js';

/**
 * The template-token grammar, in ONE place. `{block}`, `{bleed}`, `{damage.2}`.
 *
 * EldenSpire#41, Bjorn's deletability review: this regex had FOUR copies —
 * validate.js:150, loadout.js:258 (already named TOKEN_RE), and twice in
 * card.js. A factory rather than a shared instance on purpose: a `g` regex
 * carries `lastIndex`, so one exported object shared across modules is a
 * cross-module mutable, and loadout.js was already resetting it defensively at
 * three call sites. Each caller gets its own.
 */
// The grammar lives in model/tokens.js (a leaf, so tree.js can read it without
// importing this file back); re-exported here as plain consts because
// tools/bundle.mjs inlines `export const` and does not read `export … from`.
import { TOKEN_PATTERN as TOKEN_PATTERN_, tokenRe as tokenRe_ } from './tokens.js';
export const TOKEN_PATTERN = TOKEN_PATTERN_;
export const tokenRe = tokenRe_;

/**
 * validateContent(bundle) → { ok, errors: [{ path, msg }], scriptReport }.
 * `bundle` is the raw content bundle (same shape createRegistries takes).
 */
/**
 * A VALIDATION DOOR MAY NOT THROW — the structural half of that rule.
 *
 * Four rounds of review found the same shape at four addresses: a pass that
 * exists to ANSWER questions about content, crashing on content instead
 * (`sourceOrder.join`, `keywords.map`, `global.grants` iteration, a non-string
 * tag `source`). Each was a real gap and each got a named rule, but fixing them
 * one at a time is how the fifth arrives. Malformed content is infinite and this
 * pass reads hundreds of fields, so the guarantee cannot rest on having guarded
 * every one — it rests on the door being structurally unable to throw.
 *
 * So the whole pass runs inside a catch, and an unexpected throw becomes the
 * last problem in the list rather than an exception at the boot banner. Specific
 * rules still come first and still say the useful thing; this is the floor under
 * them, not a substitute for them.
 */
export function validateContent(bundle, options = {}) {
  // The accumulator is created HERE and handed in, so a throw partway through
  // KEEPS every field-addressed error found before it. A floor that returns a
  // fresh list erases the diagnosis it was meant to stand behind.
  const errors = [];
  try {
    return collectContentProblems(bundle, errors, options);
  } catch (error) {
    errors.push({
      path: '<bundle>',
      msg: `content validation could not finish reading this bundle: ${error && error.message} — a field is malformed in a way no rule names yet; any errors listed above were found before it, and the stack points at the field that threw`,
    });
    return { ok: false, errors, scriptReport: null };
  }
}

function collectContentProblems(bundle, errors = [], options = {}) {
  const err = (path, msg) => errors.push({ path, msg });
  const b = bundle || {};
  const ctx = { bundle };
  rootProblems(b, err, ctx);

  questProblems(b, err, ctx);

  idSetProblems(b, err, ctx);
  const { ids } = ctx; // inline reads

  cardCostProblems(b, err, ctx);
  balanceRowProblems(b, err, ctx);
  rewardScheduleProblems(b, err, ctx);

  progressionProblems(b, err, ctx);
  classTreeProblems(b, err, ctx);

  // JSON mechanic attachments are validated by the same compiler that live
  // mounts use. Ordinary normalized classification tags keep their own door.
  const behaviorMechanics = new Map(fixCoreProtection);
  tagContextProblems(b, err, ctx);
  const { tagIds, creatureTagIds, vctx, equipment } = ctx; // inline reads
  equipmentProblems(b, err, ctx);
  const { dependencySafeBundle } = ctx; // inline reads

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
          : ['tag', 'school', 'amount'];
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

  // ---- HUD resource rows: MEANING, not shape (Law 1 clause 5) --------------
  // The shape walk above already rejects a missing `source`. This rejects a
  // source the engine cannot READ — the defect that would otherwise ship a
  // trough reading 0/0 forever on Constantine's HUD, looking finished.
  //
  // A new row whose resource has no engine reader dies HERE at boot, naming the
  // row and legal sources instead of drawing a 0/0 trough that looks finished.
  for (const row of (Array.isArray(b.resources) ? b.resources : [])) {
    if (!row || typeof row.source !== 'string') continue; // shape walk owns this
    if (!RESOURCE_SOURCE_IDS.includes(row.source)) {
      err(`resources.${row.id || '?'}`, `source ${JSON.stringify(row.source)} has no reader — `
        + `the engine cannot get a value for it, so this bar would render an empty trough forever. `
        + `Readable sources are: ${RESOURCE_SOURCE_IDS.join(', ')}. `
        + `Adding one is an engine change (a reader in model/resources.js), not a row.`);
    }
    if (row.domainMax != null && !(Number.isFinite(row.domainMax) && row.domainMax > 0)) {
      err(`resources.${row.id || '?'}.domainMax`, `must be a positive number when present — got ${JSON.stringify(row.domainMax)}. `
        + `It is the bar's full-row ceiling; a zero or negative one divides the length by nothing.`);
    }
    if (Array.isArray(row.surfaces) && row.surfaces.length === 0) {
      err(`resources.${row.id || '?'}.surfaces`, 'names no surface, so this row can never draw — omit the row or give it a surface.');
    }
  }

  if (b.balance != null && (typeof b.balance !== 'object' || Array.isArray(b.balance))) {
    err('balance', 'balance must be a plain object of constants');
  }
  for (const problem of levelConfigProblems(b.balance)) err(problem.path, problem.msg);
  for (const enemy of Array.isArray(b.enemies) ? b.enemies : []) {
    if (enemy?.equipmentPower !== undefined && !(Number.isFinite(enemy.equipmentPower) && enemy.equipmentPower >= 0 && enemy.equipmentPower <= 1)) {
      err(`enemies.${enemy.id || '?'}.equipmentPower`, 'must be a number from 0 to 1');
    }
    if (!enemy || enemy.levelProfile == null) continue;
    for (const problem of enemyLevelProfileProblems(enemy.levelProfile, `enemies.${enemy.id || '?'}.levelProfile`)) {
      err(problem.path, problem.msg);
    }
  }
  for (const encounter of Array.isArray(b.encounters) ? b.encounters : []) {
    if (!encounter) continue;
    // Owner (2026-11-03): "Limit to just 3 enemies max" (SPEC §4, Encounters).
    if (Array.isArray(encounter.enemies) && encounter.enemies.length > MAX_ENEMIES_PER_COMBAT) {
      err(`encounters.${encounter.id || '?'}.enemies`, `lists ${encounter.enemies.length} enemies; a combat holds at most ${MAX_ENEMIES_PER_COMBAT} (owner, 2026-11-03)`);
    }
    for (const field of ['floorBand', 'targetBand']) {
      if (encounter[field] == null) continue;
      for (const problem of levelBandProblems(encounter[field], `encounters.${encounter.id || '?'}.${field}`)) {
        err(problem.path, problem.msg);
      }
    }
  }

  // ---- Seats (SPEC §13) ------------------------------------------------------
  // Three rules the schema cannot say: baselines are one per seat and cover
  // 1..N; the null seat is exactly one boss row; every seat can be climbed —
  // it has a normal, an elite and a boss row, or a map for it cannot be built.
  {
    const seats = Array.isArray(b.seats) ? b.seats.filter(Boolean) : [];
    const encounters = Array.isArray(b.encounters) ? b.encounters.filter(Boolean) : [];
    const tiers = seats.map((seat) => seat.baseTier).sort((x, y) => x - y);
    if (seats.length && tiers.some((tier, i) => tier !== i + 1)) {
      err('seats', `baseTier values must be exactly 1..${seats.length}, one per seat (got ${JSON.stringify(tiers)})`);
    }
    const nullSeat = encounters.filter((encounter) => encounter.seat === null);
    if (encounters.length && nullSeat.length !== 1) {
      err('encounters', `exactly one encounter may carry seat: null — the final tier's extra terminal (got ${nullSeat.length}: ${nullSeat.map((e) => e.id).join(', ') || 'none'})`);
    }
    for (const encounter of nullSeat) {
      if (encounter.pool !== 'boss') err(`encounters.${encounter.id}.seat`, 'the null-seat encounter must be a boss');
    }
    for (const seat of seats) {
      for (const pool of ['normal', 'elite', 'boss']) {
        if (!encounters.some((encounter) => encounter.seat === seat.id && encounter.pool === pool)) {
          err(`seats.${seat.id}`, `no '${pool}' encounter is bound to this seat; a map for it cannot be built`);
        }
      }
    }
    const table = b.balance && b.balance.seatTiers;
    const cycle = b.balance && b.balance.endless && b.balance.endless.actsPerCycle;
    if (b.balance !== undefined) {
      if (!isPlainObject(table)) {
        err('balance.seatTiers', 'must be an object keyed by tier (1..actsPerCycle) with a positive multiplier each');
      } else {
        for (let tier = 1; tier <= (Number(cycle) || 0); tier++) {
          const mult = table[tier];
          if (typeof mult !== 'number' || !(mult > 0)) err(`balance.seatTiers.${tier}`, `tier ${tier} needs a positive multiplier (got ${JSON.stringify(mult)})`);
        }
        if (table[1] !== 1) err('balance.seatTiers.1', `tier 1 is the definition of scale 1 and must be exactly 1 (got ${JSON.stringify(table[1])})`);
        for (const key of Object.keys(table)) {
          const tier = Number(key);
          if (!Number.isInteger(tier) || tier < 1 || tier > (Number(cycle) || 0)) err(`balance.seatTiers.${key}`, `tier keys must be 1..${cycle}`);
        }
      }
      // balance.bossTiers (§13.3): one { hp, damage } per tier, both positive.
      const bossTable = b.balance.bossTiers;
      if (!isPlainObject(bossTable)) {
        err('balance.bossTiers', 'must be an object keyed by tier (1..actsPerCycle), each { hp, damage } with positive multipliers');
      } else {
        for (let tier = 1; tier <= (Number(cycle) || 0); tier++) {
          const row = bossTable[tier];
          if (!isPlainObject(row)) { err(`balance.bossTiers.${tier}`, `tier ${tier} needs a { hp, damage } row`); continue; }
          for (const field of ['hp', 'damage']) {
            if (typeof row[field] !== 'number' || !(row[field] > 0)) err(`balance.bossTiers.${tier}.${field}`, `needs a positive multiplier (got ${JSON.stringify(row[field])})`);
          }
          for (const field of Object.keys(row)) if (field !== 'hp' && field !== 'damage') err(`balance.bossTiers.${tier}.${field}`, 'unknown field (a tier row is { hp, damage })');
        }
        for (const key of Object.keys(bossTable)) {
          const tier = Number(key);
          if (!Number.isInteger(tier) || tier < 1 || tier > (Number(cycle) || 0)) err(`balance.bossTiers.${key}`, `tier keys must be 1..${cycle}`);
        }
      }
    }
  }
  // balance.ui.holdConfirm — THE DIAL THAT DISABLES A SAFETY FEATURE WHEN IT IS
  // WRONG, so it is the last thing that may fail quiet. Vira's finding: it
  // validated against NOTHING. `steps: { normal: 'abc' }` reaches
  // `Number('abc') || 0` in ui/components/holdconfirm.js, resolves to 0 ms, and
  // the hold silently does not exist — while `validateContent` returns ok:true
  // with zero errors naming it. Law 1 clause 5 failing quiet, on the one control
  // whose failure is invisible by construction: nothing on the screen looks
  // different, the bars just commit on a tap again.
  //
  // Meaning, not shape, which is why it is here and not in SCHEMAS: whether
  // `def` names a step that EXISTS needs two fields to ask.
  if (b.balance && b.balance.ui && b.balance.ui.holdConfirm != null) {
    const hc = b.balance.ui.holdConfirm;
    if (typeof hc !== 'object' || Array.isArray(hc)) {
      err('balance.ui.holdConfirm', 'must be an object { def, steps }');
    } else {
      const steps = hc.steps;
      if (typeof steps !== 'object' || steps == null || Array.isArray(steps)) {
        err('balance.ui.holdConfirm.steps', 'must be an object of name -> milliseconds');
      } else {
        const names = Object.keys(steps);
        if (!names.length) err('balance.ui.holdConfirm.steps', 'must offer at least one position');
        for (const k of names) {
          const v = steps[k];
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            err(`balance.ui.holdConfirm.steps.${k}`, `must be a non-negative number of milliseconds — got ${JSON.stringify(v)}. `
              + `A value the code cannot read resolves to 0 ms, which silently turns the confirm step OFF.`);
          }
        }
        if (!Object.hasOwn(steps, hc.def)) {
          err('balance.ui.holdConfirm.def', `${JSON.stringify(hc.def)} is not one of the steps offered (${names.join(', ')}) — `
            + `the default position must exist, or every player starts on a setting the row cannot show.`);
        }
      }
    }
  }
  // balance.ui.titleLoadHold — the title slot's quick-load gesture. A malformed
  // value would otherwise fall back inside the view and make the authored row
  // decorative rather than authoritative, so fail by the row's own name.
  if (b.balance && b.balance.ui && b.balance.ui.titleLoadHold != null) {
    const lh = b.balance.ui.titleLoadHold;
    if (typeof lh !== 'object' || Array.isArray(lh)) {
      err('balance.ui.titleLoadHold', 'must be an object { ms }');
    } else if (typeof lh.ms !== 'number' || !Number.isFinite(lh.ms) || lh.ms <= 0) {
      err('balance.ui.titleLoadHold.ms', `must be a positive number of milliseconds — got ${JSON.stringify(lh.ms)}. `
        + `The title quick-load gesture needs a real hold boundary distinct from an ordinary tap.`);
    }
  }
  // balance.ui.holdBeat — THE SAME FAILURE SHAPE AS holdConfirm, one control
  // over. The beat is the only feedback a held control has once a thumb is on
  // top of the fill, and every way this row can be wrong is SILENT: a fraction
  // of 1.4 never arrives, a NaN compares false against every progress value, a
  // descending list fires the late tick first and then never again, and a
  // duplicate fires two ticks in one frame that a player hears as one. In all
  // four the screen is unchanged and the sound simply is not there — which is
  // the exact state the beat exists to distinguish from a tap that missed.
  //
  // An EMPTY array is legal and means "no ticks, commit only": turning the
  // train off is a tuning decision, and refusing it here would make the row a
  // lie about what one edit can do.
  if (b.balance && b.balance.ui && b.balance.ui.holdBeat != null) {
    const hb = b.balance.ui.holdBeat;
    if (typeof hb !== 'object' || Array.isArray(hb)) {
      err('balance.ui.holdBeat', 'must be an object { at: [fractions] }');
    } else if (!Array.isArray(hb.at)) {
      err('balance.ui.holdBeat.at', `must be an array of fractions of the fill (0 <= f < 1) — got ${JSON.stringify(hb.at)}. `
        + `A value the beat cannot read fires no ticks, and a hold with no ticks is the defect this row exists for.`);
    } else {
      let prev = -1;
      hb.at.forEach((f, i) => {
        if (typeof f !== 'number' || !Number.isFinite(f) || f < 0 || f >= 1) {
          err(`balance.ui.holdBeat.at[${i}]`, `must be a number in [0, 1) — got ${JSON.stringify(f)}. `
            + `1.0 is not a tick: the arrival is the 'holdCommit' recipe, and putting it here would give the landing two homes.`);
        } else if (f <= prev) {
          err(`balance.ui.holdBeat.at[${i}]`, `must be strictly greater than at[${i - 1}] (${prev}) — got ${f}. `
            + `The fill only ever runs forward, so an out-of-order or duplicated fraction is a tick that fires twice in one frame or never fires at all.`);
        } else {
          prev = f;
        }
      });
    }
  }
  // balance.ui.inspectHold — the reading hold on the hand. The consumer is
  // `Number(...) || 0` shaped like holdConfirm's, so a typo'd row would resolve
  // to 0 and silently REMOVE the gesture: nothing on screen looks different, a
  // held card simply never expands — the same silent-plausible failure as the
  // rows above (Law 0 clause 5). `ms: 0` on purpose is legal and means off; a
  // row that cannot be READ is not a zero, it is a mistake, and it fails here
  // by name.
  if (b.balance && b.balance.ui && b.balance.ui.inspectHold != null) {
    const ih = b.balance.ui.inspectHold;
    if (typeof ih !== 'object' || Array.isArray(ih)) {
      err('balance.ui.inspectHold', 'must be an object { ms }');
    } else if (typeof ih.ms !== 'number' || !Number.isFinite(ih.ms) || ih.ms < 0) {
      err('balance.ui.inspectHold.ms', `must be a non-negative number of milliseconds — got ${JSON.stringify(ih.ms)}. `
        + `The consumer resolves an unreadable value to 0, which takes the inspect gesture off every card with nothing on the screen looking different.`);
    }
  }
  // balance.ui.handLayout — the hand-layout word (C2: overlap AND paging, one
  // knob). The consumer guards a stored player setting against the modes list
  // and falls back to THIS row — so if this row itself is garbage, the
  // fallback is garbage and the narrow hand silently renders in whatever the
  // CSS default happens to be, with nothing on screen saying a mode was ever
  // chosen (Law 0 clause 5, again). Loud, by name, at boot.
  if (b.balance && b.balance.ui && (b.balance.ui.handLayout != null || b.balance.ui.handLayoutModes != null)) {
    const modes = b.balance.ui.handLayoutModes;
    if (!Array.isArray(modes) || modes.length === 0 || modes.some((m) => typeof m !== 'string' || !m)) {
      err('balance.ui.handLayoutModes', `must be a non-empty array of mode names — got ${JSON.stringify(modes)}. `
        + `It is the closed set the settings guard checks a stored value against; unreadable, every stored choice would land on the default without the player ever being told why.`);
    } else if (typeof b.balance.ui.handLayout !== 'string' || !modes.includes(b.balance.ui.handLayout)) {
      err('balance.ui.handLayout', `must be one of ${modes.join(' | ')} — got ${JSON.stringify(b.balance.ui.handLayout)}. `
        + `This row is the fallback every garbage stored setting lands on; a fallback outside the closed set leaves the hand with no layout word at all.`);
    }
  }
  // OVERLAP DOES NOT FLATTEN WITHOUT ITS READER (Sunna's ruling, 2026-08-14).
  // Two rows, each defensible alone: 'overlap' is a legal layout mode, and
  // inspectHold.ms 0 is the inspect gesture's legal off position. TOGETHER
  // they author a hand nobody can read — ten cards flattened to ~27-30
  // viewport px exposed slivers (measured, tools/handlayout.mjs, 390x844),
  // under the tap floor, with the one compensating reader turned off — from a
  // table edit that never fails a shape check, because each row's own shape is
  // fine (Law 1 clause 5: the failure a content edit can cause, not just the
  // rows it can malform). Ruled a REFUSAL, not a warning ("a warning that
  // boots is the fourth silent state") and not accept-in-writing.
  //
  // It binds the OFFERED set, not the default: offering 'overlap' at all puts
  // the sliver hand one legal settings write away, so the default being
  // 'paging' discharges nothing. Paging-only with ms 0 stays legal — the
  // strip needs no reader, and turning the gesture off is a tuning row this
  // check must not eat. The reader is resolved exactly as its consumer
  // resolves it (combat.js: `Number((ui.inspectHold || {}).ms) || 0`), so an
  // ABSENT inspectHold row is the same off position as ms: 0 and refuses too
  // — guarding on the entry would let deleting the entry silence the check
  // that watches it (the tapSize precedent below). A MALFORMED ms is not
  // handled here: it is already red by name in the inspectHold block above,
  // and a second error calling garbage "0" would misname the defect.
  // Corpus: tools/overlapreader.mjs — known-bads enter as content rows
  // through a real boot; observed red at b277ec2 before this block existed.
  if (b.balance && b.balance.ui) {
    const ui = b.balance.ui;
    const hp = ui.hudPresentation;
    if (!hp || typeof hp !== 'object' || Array.isArray(hp)) {
      err('balance.ui.hudPresentation', 'must be an object with shared HUD spacing, sizing, metadata, and mobile density tokens');
    } else {
      for (const [key, min, max] of [
        ['componentBackgroundOpacityPct', 0, 100],
        ['metadataFontPx', 8, 24],
        ['beltItemGapPx', 0, 12],
        ['portraitScale', 0.5, 1],
        ['primaryRowGapPx', 0, 24],
        ['controlGapPx', 0, 12],
        ['resourceRowGapPx', 0, 12],
        ['panelPadPx', 0, 12],
        ['mobilePanelPadPx', 0, 12],
        ['mobileControlGapPx', 0, 12],
        ['mobileOuterPadPx', 0, 12],
        ['mobileRowGapPx', 0, 12],
        ['cindersMaxWidthPct', 20, 40],
        ['metadataMaxWidthPct', 20, 40],
      ]) {
        const value = hp[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
          err(`balance.ui.hudPresentation.${key}`, `must be a finite number in [${min}, ${max}] — got ${JSON.stringify(value)}`);
        }
      }
      if (typeof hp.metadataShowTotals !== 'boolean') {
        err('balance.ui.hudPresentation.metadataShowTotals', `must be boolean — got ${JSON.stringify(hp.metadataShowTotals)}`);
      }
    }
    const shrinePresentation = ui.shrinePresentation;
    if (!shrinePresentation || typeof shrinePresentation !== 'object' || Array.isArray(shrinePresentation)) {
      err('balance.ui.shrinePresentation', 'must be an object with optionLayout');
    } else if (!['list', 'grid'].includes(shrinePresentation.optionLayout)) {
      err('balance.ui.shrinePresentation.optionLayout', `must be 'list' or 'grid' — got ${JSON.stringify(shrinePresentation.optionLayout)}`);
    }
    const quickSettings = ui.hudQuickSettings;
    const quickPlaces = ['title', 'map', 'combat'];
    if (!quickSettings || typeof quickSettings !== 'object' || Array.isArray(quickSettings)) {
      err('balance.ui.hudQuickSettings', 'must be an object with places, spacing, visual sizing, background, and label settings');
    } else {
      if (!Array.isArray(quickSettings.places)
        || quickSettings.places.some((place) => !quickPlaces.includes(place))
        || new Set(quickSettings.places).size !== quickSettings.places.length) {
        err('balance.ui.hudQuickSettings.places', `must contain unique values from ${quickPlaces.join(', ')} — got ${JSON.stringify(quickSettings.places)}`);
      }
      for (const key of ['edgeGapPx', 'stackGapPx']) {
        const value = quickSettings[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 24) {
          err(`balance.ui.hudQuickSettings.${key}`, `must be a finite number in [0, 24] — got ${JSON.stringify(value)}`);
        }
      }
      for (const [key, min, max] of [
        ['cardSizePx', 32, 44],
        ['glyphSizePx', 16, 32],
        ['stateDotPx', 3, 12],
        ['activeTintPct', 0, 30],
      ]) {
        const value = quickSettings[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
          err(`balance.ui.hudQuickSettings.${key}`, `must be a finite number in [${min}, ${max}] — got ${JSON.stringify(value)}`);
        }
      }
      if (typeof quickSettings.showCardBackground !== 'boolean') {
        err('balance.ui.hudQuickSettings.showCardBackground', `must be boolean — got ${JSON.stringify(quickSettings.showCardBackground)}`);
      }
      if (typeof quickSettings.showLabels !== 'boolean') {
        err('balance.ui.hudQuickSettings.showLabels', `must be boolean — got ${JSON.stringify(quickSettings.showLabels)}`);
      }
    }
    const combatantStage = ui.combatantStage;
    if (!combatantStage || typeof combatantStage !== 'object' || Array.isArray(combatantStage)) {
      err('balance.ui.combatantStage', 'must be an object with viewport clearances, intent gap, and center position');
    } else {
      for (const key of ['hudClearanceViewportPct', 'actionClearanceViewportPct']) {
        const value = combatantStage[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 25) {
          err(`balance.ui.combatantStage.${key}`, `must be a finite viewport percentage in [0, 25] — got ${JSON.stringify(value)}`);
        }
      }
      if (typeof combatantStage.intentGapPx !== 'number' || !Number.isFinite(combatantStage.intentGapPx)
        || combatantStage.intentGapPx < 0 || combatantStage.intentGapPx > 24) {
        err('balance.ui.combatantStage.intentGapPx', `must be a finite device-pixel gap in [0, 24] — got ${JSON.stringify(combatantStage.intentGapPx)}`);
      }
      if (typeof combatantStage.centerPct !== 'number' || !Number.isFinite(combatantStage.centerPct)
        || combatantStage.centerPct < 25 || combatantStage.centerPct > 75) {
        err('balance.ui.combatantStage.centerPct', `must be a finite center percentage in [25, 75] — got ${JSON.stringify(combatantStage.centerPct)}`);
      }
    }
    const tooltipPlacement = ui.tooltipPlacement;
    if (!tooltipPlacement || typeof tooltipPlacement !== 'object' || Array.isArray(tooltipPlacement)) {
      err('balance.ui.tooltipPlacement', 'must be an object with hover, fade, and safe-placement tokens');
    } else {
      for (const [key, min, max] of [
        ['hoverDelayMs', 0, 600000],
        ['autoFadeMs', 0, 600000],
        ['topBandViewportPct', 0, 50],
        ['sideBandViewportPct', 0, 50],
      ]) {
        const value = tooltipPlacement[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
          err(`balance.ui.tooltipPlacement.${key}`, `must be a finite number in [${min}, ${max}] — got ${JSON.stringify(value)}`);
        }
      }
    }
    const offersOverlap = Array.isArray(ui.handLayoutModes) && ui.handLayoutModes.includes('overlap');
    const ih = ui.inspectHold;
    const wellFormedMs = ih != null && typeof ih === 'object' && !Array.isArray(ih)
      && typeof ih.ms === 'number' && Number.isFinite(ih.ms) && ih.ms >= 0;
    const readerOff = ih == null ? true : (wellFormedMs && ih.ms === 0);
    if (offersOverlap && readerOff) {
      const floor = ui.tapSize && typeof ui.tapSize.def === 'number' ? `the ${ui.tapSize.def} px tap floor` : 'the tap floor (balance.ui.tapSize.def)';
      err('balance.ui.handLayoutModes + balance.ui.inspectHold.ms',
        `'overlap' is offered while the inspect hold is off (${ih == null ? 'the inspectHold row is ABSENT, which the hand resolves to ms 0' : 'ms: 0'}) — refused. `
        + `Overlap flattens a full hand into ~27-30 px exposed slivers, under ${floor}, and hold-to-inspect is the one reader that makes a sliver legible; ms 0 turns that reader off. `
        + `These two entries conflict: drop 'overlap' from balance.ui.handLayoutModes, or give balance.ui.inspectHold.ms a non-zero hold. `
        + `Paging-only with ms 0 stays legal — the strip needs no reader.`);
    }
  }
  // THE SECOND-BEAT TABLE, checked at the same boot and for the same reason as
  // the dial above. It is CODE, not content, so it can never be a row a
  // designer breaks — but it is a table, and a table whose row is malformed
  // resolves to a plausible 'none' and takes a safety step off a button with
  // nothing on the screen looking different. That is Law 0 clause 5 exactly:
  // the dangerous failure is the silent plausible derivation, so the derivation
  // is asked to prove itself out loud on every boot that validates anything.
  for (const complaint of assertTableSane()) err('secondBeat', complaint);

  // THE MAP'S VERTICAL MARGIN, and it belongs here because it has exactly one
  // data input. `balance.ui.tapSize.def` is what the map node's radius is SOLVED
  // FROM (model/map/mapview.js), so raising it grows the target and eats the space
  // BETWEEN two adjacent targets in the same stroke — at 08e184a, 44.09 px of
  // node against a 47.0 px row pitch at 390x844, under 3 px of air between taps
  // both start a fight nobody can undo (Sunna, 2026-08-08). Nothing was watching
  // that number; a refusal that prints a verdict and not a margin cannot be.
  // THE MAP'S COLLISION MARGIN, and it belongs here because it has exactly one
  // data input. `balance.ui.tapSize.def` is what EVERY map circle's radius is
  // SOLVED FROM (model/map/mapview.js), so raising it grows every circle while the
  // pitches they are measured against do not move — targets grow, the space
  // between them does not. Sunna's sentence, written about the event screen's
  // choice bars weeks ago and true here too: nothing in this game read a gap.
  // A refusal that prints a verdict and not a margin cannot be watched.
  //
  // It rules on the pairs a content edit is answerable for. The boss/shrine pair
  // is RED at the shipped default — rendered, every act, since #107 — and is
  // deliberately NOT gated here, because a boot banner the player cannot act on
  // is a worse failure than the overlap. That exemption carries a latch:
  // `mapplan --selftest` asserts the pair is still red, so the excuse cannot
  // outlive its reason. `node tools/mapplan.mjs --margins` is where it is red.
  //
  // Asked ONCE of the bundle rather than per act: it does not vary with
  // mapConfigs, and three identical errors would be three copies of one fact.
  // The corpus it has to turn red is `node tools/mapplan.mjs --selftest` — the
  // same corpus the mapConfigs block below points at, and its rows for this
  // refusal are in it, so neither pointer dangles.
  // Guarded on `balance` and NOT on `balance.ui.tapSize`, deliberately: guarding
  // on the entry means deleting the entry silences the check that watches it.
  if (b.balance != null && typeof b.balance === 'object' && !Array.isArray(b.balance)) {
    for (const e of geometryRefusals(b.balance)) err(e.key, e.msg);
  }
  // balance.graceRefill — what a grace hands back (Constantine, 2026-08-08).
  //
  // TAKES THE WHOLE BUNDLE, not `b.balance`, and that is the point: three of its
  // eight refusals can only be asked with the flask ENTRIES in hand (does this
  // kind have a member, does this override resolve, is the override of the kind
  // the row claims). A refusal that could only see `balance` would be checking
  // the half that was never in doubt.
  //
  // Its corpus is `node tools/gracerefill.mjs --selftest`, which plants each
  // refusal into the real bundle and watches this call go red.
  for (const e of graceRefillRefusals(b)) err(e.key, e.msg);

  // The growth chain (balance.flaskGrowth) — same refusal shape, same door.
  // Its corpus is `node tools/flaskgrowth.mjs --selftest`, which plants each
  // refusal into the real bundle and watches this call go red.
  for (const e of flaskGrowthRefusals(dependencySafeBundle)) err(e.key, e.msg);

  // balance.poise is engine-consulted data: { growthMult?, onFill? } (see ENGINE-API.md)
  if (b.balance && b.balance.poise) {
    const p = b.balance.poise;
    if (p.growthMult != null && typeof p.growthMult !== 'number') err('balance.poise.growthMult', 'must be a number');
    if (p.onFill != null) validateEffects(p.onFill, 'balance.poise.onFill', vctx);
  }

  if (b.mapConfigs != null) {
    if (typeof b.mapConfigs !== 'object' || Array.isArray(b.mapConfigs)) {
      err('mapConfigs', 'mapConfigs must be an object keyed by act number');
    } else {
      for (const act of Object.keys(b.mapConfigs)) {
        const cfg = b.mapConfigs[act];
        walkSchema(cfg, SCHEMAS.mapConfig, `mapConfigs.${act}`, vctx);
        // THE SECOND LAYER — meaning, not shape. The schema cannot know whether
        // floor 9 exists in THIS act; that needs `floors`, so it is asked here.
        // This is the boot-time half of Law 1 clause 5: bad data fails loud and
        // NAMES THE ENTRY, rather than being clamped, defaulted, or ignored.
        // The corpus it has to turn red is in tools/mapplan.mjs --selftest.
        if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
          for (const e of resolveFloorPlan(cfg).errors) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
          // AND THE SAME LAYER FOR THE KNOBS WHOSE FAILURE IS A VIEW FAILURE.
          // `floors: 2` already refused by name; `columns: 10` did not, and it
          // makes Constantine's "the current node and its connecting nodes fit"
          // unsatisfiable at every zoom the ladder has — a knob that hands him a
          // broken climb instead of a reason (Law 1 clause 5).
          //
          // AND EVERY ONE OF THESE NOW CARRIES ITS MARGIN, not just its verdict.
          // `columns: 9` was accepted at 1.02x with zero spare columns and the
          // word "accepted" was the whole answer (Vira, 2026-08-08).
          for (const e of viewRefusals(cfg)) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
        }
      }
    }
  }

  if (b.sfx != null) validateSfxRecipes(b.sfx, 'sfx', vctx);
  if (b.music != null) validateMusicBeds(b.music, 'music', vctx);

  // ---- entity-specific cross checks ----------------------------------------
  for (const card of b.cards || []) {
    const path = `cards.${card.id}`;
    if (typeof card.class === 'string' && card.class !== 'colorless' && !ids.classes.has(card.class)) {
      err(`${path}.class`, `class '${card.class}' is neither a class id nor 'colorless'`);
    }
    validateCardTemplates(card, path, err);
    validateCardRamp(card, path, err);
    validateCardContest(card, path, err);
    if (card.burden) {
      for(const key of ['skipActions','staminaTax','manaTax']) if(card.burden[key]!==undefined && (!Number.isSafeInteger(card.burden[key]) || card.burden[key]<0 || card.burden[key]>10)) err(`${path}.burden.${key}`,'must be bounded nonnegative integer');
    }
    if (card.costGrowth) {
      for (const key of ['stamina','mana']) if (card.costGrowth[key]!==undefined && (!Number.isSafeInteger(card.costGrowth[key]) || Math.abs(card.costGrowth[key])>10)) err(`${path}.costGrowth.${key}`,'must be an integer from -10 to 10');
      for (const key of ['perUse','max']) if (card.costGrowth[key]!==undefined && (!Number.isSafeInteger(card.costGrowth[key]) || card.costGrowth[key]<1 || card.costGrowth[key]>100)) err(`${path}.costGrowth.${key}`,'must be an integer from 1 to 100');
    }
    for (const [i,variant] of (card.effectVariants || []).entries()) { validatePredicate(variant.if,`${path}.effectVariants[${i}].if`,vctx);validateEffects(variant.effects,`${path}.effectVariants[${i}].effects`,vctx); }
  }

  const relicTagsByRelic = relicPropertyTagIndex(b);
  const propertyRulesByTag = new Map(
    (Array.isArray(b.propertyRules) ? b.propertyRules : [])
      .filter((rule) => rule && typeof rule.tag === 'string')
      .map((rule) => [rule.tag, rule]));
  for (const relic of b.relics || []) {
    validateRelicTemplate(relic, `relics.${relic.id}`, err, propertyRulesByTag, relicTagsByRelic, b);
    if (Array.isArray(relic.triggers) && relic.triggers.length) {
      err(`relics.${relic.id}.triggers`, `authors triggers on the relic, which no longer reads them — a relic's triggers are its property rule now: register a '${relic.id}' tag in content/source/tags.csv with domain 'property', move these to content/source/propertyRuleEffects.json under that tag, and add 'relic,,${relic.id},${relic.id}' to content/source/tagging.csv`);
    }
    const poiseAdd = relic && relic.passives && relic.passives.poiseThresholdAdd;
    if (poiseAdd != null && (!Number.isFinite(poiseAdd) || !Number.isInteger(poiseAdd) || poiseAdd < 0)) {
      err(`relics.${relic.id}.passives.poiseThresholdAdd`, `must be a finite non-negative integer, got ${JSON.stringify(poiseAdd)}`);
    }
  }

  // ---- sigils (SPEC §14.3, §15.4): { id, name, rarity, cost?, blurb } --------
  // What a sigil does is its tagging row and that leaf's rule, so a sigil adds
  // nothing to the engine's vocabulary. A legendary sigil is §15.4's: attuned,
  // no cost, never stock, and exactly one property tag.
  validateSigils(b.sigils === undefined ? shippedSigils : b.sigils, vctx, b);

  // ---- consumables and companions (SPEC §14.3, step 5b) ----------------------
  // Whole numbers with a [NOTE] each, a sale never above the price, a skill
  // book's track a derived non-class one; a companion writes no triggers — its
  // property is its tagging.csv row, a leaf under the companion branch.
  consumableTableProblems(b.consumables === undefined ? shippedConsumables : b.consumables, b, err);
  companionTableProblems(b.companions === undefined ? shippedCompanions : b.companions, b, err);

  // ---- threshold-proc second layer (#61): meaning, not shape ---------------
  // Every red names its row and, for tag errors, lists the legal tags — a
  // wrong tag teaches the vocabulary instead of just refusing (silence-word
  // standard).
  //
  // finitePositive is the SHARED gate for every numeric knob in this layer
  // (Vira's gate finding 1 — the recurring class: `typeof x === 'number' &&
  // x > 0` waves Infinity through, and Infinity validates green then
  // multiplies damage at play). One helper, every site, instead of a fourth
  // hand-written patch.
  const finitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const finitePositiveInt = (v) => Number.isInteger(v) && v > 0; // isInteger already rejects ±Infinity/NaN
  const finitePercent = (v) => finitePositive(v) && v <= 100;
  for (const st of b.statuses || []) {
    const path = `statuses.${st.id}`;
    if (st.proc) {
      const p = st.proc;
      if (!finitePositiveInt(p.threshold)) {
        err(`${path}.proc.threshold`, `threshold must be a finite integer > 0, got ${JSON.stringify(p.threshold)}`);
      }
      if (!finitePercent(p.burstPercent)) {
        err(`${path}.proc.burstPercent`, `burstPercent must be a finite number in (0, 100], got ${JSON.stringify(p.burstPercent)}`);
      }
      // The burst band is a damage floor/ceiling: negatives validate a proc
      // that fires and silently no-ops (loseHp clamps at 0) — a dead row in
      // burst clothing (Vira's finding 1, second half).
      if (!(Number.isInteger(p.burstMin) && p.burstMin >= 0)) {
        err(`${path}.proc.burstMin`, `burstMin must be a finite integer ≥ 0, got ${JSON.stringify(p.burstMin)}`);
      }
      if (!finitePositiveInt(p.burstMax)) {
        err(`${path}.proc.burstMax`, `burstMax must be a finite integer > 0 — a 0-or-negative cap is a proc that silently no-ops, got ${JSON.stringify(p.burstMax)}`);
      }
      if (Number.isInteger(p.burstMin) && Number.isInteger(p.burstMax) && p.burstMin > p.burstMax) {
        err(`${path}.proc`, `burstMin ${p.burstMin} exceeds burstMax ${p.burstMax}`);
      }
      if (p.poiseDamage != null && !(Number.isInteger(p.poiseDamage) && p.poiseDamage >= 0)) {
        err(`${path}.proc.poiseDamage`, `poiseDamage must be an integer ≥ 0, got ${JSON.stringify(p.poiseDamage)}`);
      }
      if (p.resistance) {
        for (const tag of p.resistance.tags || []) {
          if (!creatureTagIds.includes(tag)) {
            err(`${path}.proc.resistance.tags`, `unknown creature tag '${tag}' (legal: ${creatureTagIds.join(', ')})`);
          }
        }
        // Empty tag list = a resistance the proc can never grant — same dead
        // shape as an empty taggedVulnerability list, held to the same red
        // (Vira's finding 3: one screen, one rule).
        if (!(p.resistance.tags || []).length) {
          err(`${path}.proc.resistance.tags`, 'tag list must be non-empty — a resistance no creature tag can trigger is a dead row; omit resistance instead');
        }
        const resistDef = (b.statuses || []).find((s) => s && s.id === p.resistance.status);
        if (resistDef && !resistDef.resists) {
          err(`${path}.proc.resistance.status`, `'${p.resistance.status}' has no resists block — a proc's resistance status must declare what it resists`);
        }
      }
    }
    if (st.resists) {
      if (!finitePercent(st.resists.percent)) {
        err(`${path}.resists.percent`, `resist percent must be a finite number in (0, 100], got ${JSON.stringify(st.resists.percent)}`);
      }
      // Reverse-direction check (Vira's finding 2): a resist row naming a
      // status that never procs is consulted by nobody — dead, silently.
      const resisted = (b.statuses || []).find((s) => s && s.id === st.resists.status);
      if (resisted && !resisted.proc) {
        err(`${path}.resists.status`, `'${st.resists.status}' is not a threshold-proc status — this resist row would never be consulted`);
      }
      if (!(st.decay && typeof st.decay === 'object' && Number.isInteger(st.decay.duration) && st.decay.duration > 0)) {
        err(`${path}.decay`, `a resist row needs decay {duration: int > 0} — its duration is a table knob, got ${JSON.stringify(st.decay)}`);
      }
    }
    if (st.taggedVulnerability) {
      const tv = st.taggedVulnerability;
      for (const tag of tv.tags || []) {
        if (!tagIds.has(tag)) {
          err(`${path}.taggedVulnerability.tags`, `unknown effect tag '${tag}' (legal: ${[...tagIds].join(', ')})`);
        }
      }
      if (!finitePositive(tv.mult)) {
        err(`${path}.taggedVulnerability.mult`, `mult must be a finite number > 0, got ${JSON.stringify(tv.mult)}`);
      }
      if (!(tv.tags || []).length) {
        err(`${path}.taggedVulnerability.tags`, 'tag list must be non-empty — an unscoped extra vulnerability is plain Vulnerable, use modifiers instead');
      }
    }
  }

  for (const enemy of b.enemies || []) {
    const path = `enemies.${enemy.id}`;
    // An enemy's own tags are checked with every other carrier's, by
    // tagContentProblems above — one rule, one message, for all of them.
    const moveIds = new Set(Object.keys(enemy.moves || {}));
    if (enemy.rangeClosingMove !== undefined && (!moveIds.has(enemy.rangeClosingMove) || !enemy.moves[enemy.rangeClosingMove].effects?.some(effect => effect.op === 'moveEngagement'))) err(`${path}.rangeClosingMove`, 'must name an owned movement move');
    if (enemy.rangeRetreatMove !== undefined && (!moveIds.has(enemy.rangeRetreatMove) || !enemy.moves[enemy.rangeRetreatMove].effects?.some(effect => effect.op === 'moveEngagement' && effect.bands === 1))) err(`${path}.rangeRetreatMove`, 'must name an owned retreat (bands 1) movement move');
    for (const id of Object.keys(enemy.moveSources || {})) if (!moveIds.has(id)) err(`${path}.moveSources.${id}`, 'must name an owned move');
    if (enemy.firstMove != null && !moveIds.has(enemy.firstMove)) {
      err(`${path}.firstMove`, `firstMove '${enemy.firstMove}' is not one of this enemy's moves`);
    } else if (enemy.firstMove != null && enemy.moves[enemy.firstMove].reaction !== undefined) {
      err(`${path}.firstMove`, `firstMove '${enemy.firstMove}' is a reaction move and is never rolled as an intent`);
    }
    // A reaction move is never rolled, so it carries no weight; every other move
    // is rolled and needs one. `reaction` bounds mirror docs/combat-card-traits-contract.md.
    for (const [moveId, move] of Object.entries(enemy.moves || {})) {
      const movePath = `${path}.moves.${moveId}`;
      if (move.reaction !== undefined) {
        const { on, minIncoming, chance } = move.reaction;
        if (!Array.isArray(on) || on.length === 0) err(`${movePath}.reaction.on`, 'reaction.on must be a non-empty list');
        if (move.weight !== undefined) err(`${movePath}.weight`, 'a reaction move is never rolled and must not carry a weight');
        if (minIncoming !== undefined && !(Number.isInteger(minIncoming) && minIncoming >= 0)) err(`${movePath}.reaction.minIncoming`, 'minIncoming must be an integer >= 0 (0: no incoming damage required)');
        if (chance !== undefined && !(typeof chance === 'number' && chance >= 0 && chance <= 1)) err(`${movePath}.reaction.chance`, 'chance must be a number in [0, 1]');
      } else if (typeof move.weight !== 'number' || Number.isNaN(move.weight)) {
        err(`${movePath}.weight`, `Expected number, got ${describe(move.weight)}`);
      }
    }
    for (const [pi, phase] of (enemy.phases || []).entries()) {
      for (const mv of phase.unlockMoves || []) {
        if (!moveIds.has(mv)) err(`${path}.phases[${pi}].unlockMoves`, `unlockMoves '${mv}' is not one of this enemy's moves`);
      }
      if (phase.on === 'hpBelowPct' && typeof phase.pct !== 'number') {
        err(`${path}.phases[${pi}]`, "phases with on:'hpBelowPct' require a numeric pct");
      }
    }
  }

  // ---- scripts budget (SPEC §3.1(6), §3.14(5)) -----------------------------
  const scriptUsers = [];
  let totalObjects = 0;
  for (const type of REGISTRY_TYPES) {
    for (const def of Array.isArray(b[type]) ? b[type] : []) {
      totalObjects++;
      if (usesScript(def)) scriptUsers.push(`${type}.${def.id}`);
    }
  }
  const scriptPct = totalObjects === 0 ? 0 : (scriptUsers.length / totalObjects) * 100;
  if (scriptPct >= 5) {
    err('scripts', `scripts budget exceeded: ${scriptUsers.length}/${totalObjects} content objects (${scriptPct.toFixed(1)}%) use scripts (must stay < 5%). Users: ${scriptUsers.join(', ')}`);
  }
  const scriptReport = {
    count: scriptUsers.length,
    total: totalObjects,
    pct: scriptPct,
    users: scriptUsers,
  };

  return { ok: errors.length === 0, errors, scriptReport };
}

// ---------------------------------------------------------------------------
// SFX recipes (#46) — shape via the layer schemas, meaning via the ramp checks
// ---------------------------------------------------------------------------
