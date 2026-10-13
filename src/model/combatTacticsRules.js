// Saved tactical tuning is authoritative for the rest of that fight.
import { combatMatchups } from '../content/combatMatchups.js';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const nonNegative = value => Number.isFinite(value) && value >= 0;
const whole = value => Number.isSafeInteger(value) && value >= 0;

export function combatIntentRulesProblems(rules, path = 'combatIntentRules') {
  if (!record(rules)) return [`${path} must be an object`];
  const keys = ['baseHiddenChance', 'wisdomReduction', 'intelligenceReduction', 'minimumHiddenChance', 'maximumHiddenChance'];
  const problems = Object.keys(rules).filter(key => !keys.includes(key)).map(key => `${path}.${key} is unknown`);
  for (const key of keys) if (!nonNegative(rules[key]) || rules[key] > 1) problems.push(`${path}.${key} must be a probability from 0 to 1`);
  if (rules.minimumHiddenChance > rules.maximumHiddenChance) problems.push(`${path}.minimumHiddenChance cannot exceed maximumHiddenChance`);
  return problems;
}

export function combatMatchupRulesProblems(rules, path = 'combatMatchupRules') {
  if (!record(rules)) return [`${path} must be an object`];
  const problems = [];
  const object = (value, at, keys) => {
    if (!record(value)) { problems.push(`${at} must be an object`); return false; }
    for (const key of Object.keys(value)) if (!keys.includes(key)) problems.push(`${at}.${key} is unknown`);
    return true;
  };
  const numeric = (value, at, integer = false) => {
    if (!(integer ? whole(value) : nonNegative(value))) problems.push(`${at} must be a finite non-negative ${integer ? 'whole number' : 'number'}`);
  };
  const list = (value, at) => {
    if (!Array.isArray(value) || value.some(item => !text(item)) || new Set(value).size !== value.length) problems.push(`${at} must contain unique non-empty strings`);
  };
  object(rules, path, ['counter', 'smash', 'attack', 'damageRiders', 'tagRiders', 'damageAliases', 'cleanseStatuses']);
  const counterNumbers = ['incomingMultiplier', 'retaliationMultiplier', 'retaliationFlat', 'poiseMultiplier', 'guard', 'ward', 'defaultDamage'];
  if (object(rules.counter, `${path}.counter`, [...counterNumbers, 'meleeBypassDamageTypes', 'meleeIncomingManeuvers'])) {
    for (const key of counterNumbers) numeric(rules.counter[key], `${path}.counter.${key}`, !key.endsWith('Multiplier'));
    list(rules.counter.meleeBypassDamageTypes, `${path}.counter.meleeBypassDamageTypes`);
    list(rules.counter.meleeIncomingManeuvers, `${path}.counter.meleeIncomingManeuvers`);
  }
  if (object(rules.smash, `${path}.smash`, ['guardedMultiplier', 'guardBreakPoiseBonus'])) {
    numeric(rules.smash.guardedMultiplier, `${path}.smash.guardedMultiplier`);
    numeric(rules.smash.guardBreakPoiseBonus, `${path}.smash.guardBreakPoiseBonus`, true);
  }
  if (object(rules.attack, `${path}.attack`, ['preparedPoiseMultiplier'])) numeric(rules.attack.preparedPoiseMultiplier, `${path}.attack.preparedPoiseMultiplier`);
  if (!record(rules.damageRiders)) problems.push(`${path}.damageRiders must be an object`);
  // Technique riders (keyed by card tag) are optional: older frozen tables have none.
  if (rules.tagRiders !== undefined && !record(rules.tagRiders)) problems.push(`${path}.tagRiders must be an object`);
  for (const [group, label] of [['damageRiders', 'damage type'], ['tagRiders', 'card tag']]) if (record(rules[group])) for (const [type, rider] of Object.entries(rules[group])) {
    const at = `${path}.${group}.${type}`;
    if (!text(type)) problems.push(`${at} requires a ${label}`);
    if (!object(rider, at, ['status', 'stacks', 'requiresHpLoss', 'poise', 'guardBypass', 'wardDrain', 'cleanse'])) continue;
    for (const key of ['stacks', 'poise', 'guardBypass', 'wardDrain', 'cleanse']) if (rider[key] !== undefined) numeric(rider[key], `${at}.${key}`, true);
    if (rider.status !== undefined && !text(rider.status)) problems.push(`${at}.status must be a non-empty string`);
    if (rider.status !== undefined && rider.stacks === undefined) problems.push(`${at}.stacks is required for a status rider`);
    if (rider.requiresHpLoss !== undefined && typeof rider.requiresHpLoss !== 'boolean') problems.push(`${at}.requiresHpLoss must be boolean`);
  }
  if (!record(rules.damageAliases) || Object.entries(rules.damageAliases).some(([key, value]) => !text(key) || !text(value))) problems.push(`${path}.damageAliases must map non-empty damage type strings`);
  list(rules.cleanseStatuses, `${path}.cleanseStatuses`);
  return problems;
}

export function combatCounterProblems(counter, path, version = 1) {
  if (version === 2 || counter?.version === 2) return expansionCounterProblems(counter, path);
  if (!record(counter)) return [`${path} must be an object`];
  const problems = [];
  if (counter.charges !== 1) problems.push(`${path}.charges must be 1 for an armed reaction`);
  if (!['melee', 'ranged', 'spell', 'magic'].includes(counter.mode)) problems.push(`${path}.mode must name a supported Counter mode`);
  for (const key of ['damage', 'poiseDamage', 'bonus']) if (!nonNegative(counter[key])) problems.push(`${path}.${key} must be finite and non-negative`);
  if (counter.expiresOnTurn !== undefined && (!Number.isSafeInteger(counter.expiresOnTurn) || counter.expiresOnTurn < 1)) problems.push(`${path}.expiresOnTurn must be a positive whole number`);
  if (!record(counter.carrier) || !record(counter.carrier.combatProfile)) problems.push(`${path}.carrier must preserve its combat profile`);
  return problems;
}

const CAMPS = ['physical', 'spell'];
const REACHES = ['contact', 'near', 'far'];
const TARGETING = ['single', 'area'];
const MANEUVERS = ['attack', 'defend', 'counter', 'sweep', 'ranged', 'smash', 'casting'];
const SCHOOLS = ['frost', 'fire', 'lightning', 'force', 'alteration', 'illusion', 'divine', 'decay', 'earth'];

function stringsProblems(value, path, allowed = null, required = false) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length === 0 || value.some(item => !text(item) || (allowed && !allowed.includes(item)))
    || new Set(value).size !== value.length) return [`${path} must contain distinct supported strings`];
  return [];
}

export function counterCoverageProblems(coverage, path = 'counterCoverage') {
  if (!record(coverage)) return [`${path} must be an object`];
  const allowed = ['camps', 'schools', 'reaches', 'targeting', 'maneuvers', 'effects', 'requiredTraits', 'excludedTraits'];
  const problems = Object.keys(coverage).filter(key => !allowed.includes(key)).map(key => `${path}.${key} is unknown`);
  for (const [key, values, required] of [['camps', CAMPS, true], ['schools', SCHOOLS, false],
    ['reaches', REACHES, true], ['targeting', TARGETING, true], ['maneuvers', MANEUVERS, false],
    ['effects', ['damage', 'status', 'support'], true], ['requiredTraits', null, false], ['excludedTraits', null, false]]) {
    problems.push(...stringsProblems(coverage[key], `${path}.${key}`, values, required));
  }
  return problems;
}

export function expansionCounterProblems(counter, path = 'combatCounter') {
  if (!record(counter)) return [`${path} must be an object`];
  const problems = [];
  const fields = ['version', 'charges', 'serial', 'mode', 'expiresOnOwnerCycle', 'coverage', 'payload', 'schoolEffect', 'carrier'];
  for (const key of Object.keys(counter)) if (!fields.includes(key)) problems.push(`${path}.${key} is unknown`);
  if (counter.version !== undefined && counter.version !== 2) problems.push(`${path}.version must be 2`);
  if (![0, 1].includes(counter.charges)) problems.push(`${path}.charges must be 0 or 1`);
  if (!whole(counter.serial) || counter.serial === 0) problems.push(`${path}.serial must be a positive whole number`);
  if (!['melee', 'ranged', 'spell'].includes(counter.mode)) problems.push(`${path}.mode is unsupported`);
  if (!whole(counter.expiresOnOwnerCycle) || counter.expiresOnOwnerCycle === 0) problems.push(`${path}.expiresOnOwnerCycle must be a positive whole number`);
  problems.push(...counterCoverageProblems(counter.coverage, `${path}.coverage`));
  if (!record(counter.payload)) problems.push(`${path}.payload must be an object`);
  else {
    for (const key of ['hp', 'poise', 'ward']) if (!whole(counter.payload[key])) problems.push(`${path}.payload.${key} must be a non-negative whole number`);
    if (counter.payload.smashPoiseBonus !== undefined && !whole(counter.payload.smashPoiseBonus)) problems.push(`${path}.payload.smashPoiseBonus must be a non-negative whole number`);
    if (counter.payload.hpAgainstNonCaster !== undefined && typeof counter.payload.hpAgainstNonCaster !== 'boolean') problems.push(`${path}.payload.hpAgainstNonCaster must be boolean`);
    for (const key of ['hpBase', 'hpRating', 'poiseBase']) if (counter.payload[key] !== undefined && !whole(counter.payload[key])) problems.push(`${path}.payload.${key} must be a non-negative whole number`);
    for (const key of Object.keys(counter.payload)) if (!['hp', 'poise', 'ward', 'hpAgainstNonCaster', 'smashPoiseBonus', 'hpBase', 'hpRating', 'poiseBase'].includes(key)) problems.push(`${path}.payload.${key} is unknown`);
  }
  if (counter.schoolEffect !== undefined && !['hp', 'poise', 'ward'].includes(counter.schoolEffect)) problems.push(`${path}.schoolEffect must name one return effect`);
  if (!record(counter.carrier) || !record(counter.carrier.combatProfile)) problems.push(`${path}.carrier must preserve its combat profile`);
  else if (counter.carrier.traitValues !== undefined) problems.push(...traitValuesProblems(counter.carrier.traitValues, `${path}.carrier.traitValues`));
  return problems;
}

// Card trait values a saved carrier may hold (combat-card-traits-contract); magnitudes stay small.
const TRAIT_MAGNITUDE_MAX = 99;
export function traitValuesProblems(values, path) {
  if (!record(values)) return [`${path} must be an object`];
  const problems = [];
  for (const [key, value] of Object.entries(values)) {
    if (['reaction', 'counterstrike'].includes(key)) { if (value !== true) problems.push(`${path}.${key} must be true when present`); }
    else if (['impact', 'flux'].includes(key)) { if (!whole(value) || value > TRAIT_MAGNITUDE_MAX) problems.push(`${path}.${key} must be a whole number from 0 to ${TRAIT_MAGNITUDE_MAX}`); }
    else problems.push(`${path}.${key} is unknown`);
  }
  return problems;
}

// A trait guard holds at most a doubled card amount plus Impact/Flux, far below this; the cap keeps the meter fill loop finite.
const TRAIT_GUARD_MAX = 999;

/** Reaction rules v2 Defend trait guard: whole, non-negative Impact Poise and Flux Ward (combat-card-traits-contract). */
export function combatTraitGuardProblems(guard, path) {
  if (!record(guard)) return [`${path} must be an object`];
  const problems = [];
  for (const key of ['poise', 'ward']) if (!whole(guard[key]) || guard[key] > TRAIT_GUARD_MAX) problems.push(`${path}.${key} must be a whole number from 0 to ${TRAIT_GUARD_MAX}`);
  for (const key of Object.keys(guard)) if (!['poise', 'ward'].includes(key)) problems.push(`${path}.${key} is unknown`);
  return problems;
}

export function combatExpansionEntityProblems(entity, path = 'entity') {
  if (!record(entity)) return [`${path} must be an object`];
  const problems = [];
  for (const key of ['combatOwnerCycle', 'combatPreparationSerial', 'combatCounterReturnedCycle']) {
    if (entity[key] !== undefined && !whole(entity[key])) problems.push(`${path}.${key} must be a non-negative whole number`);
  }
  if (entity.combatTraitGuard !== undefined) problems.push(...combatTraitGuardProblems(entity.combatTraitGuard, `${path}.combatTraitGuard`));
  const stance = entity.combatStance;
  if (stance !== undefined) {
    if (!record(stance)) problems.push(`${path}.combatStance must be an object`);
    else {
      for (const [key, allowed] of [['maneuver', MANEUVERS], ['camp', CAMPS], ['reach', REACHES]]) {
        if (!allowed.includes(stance[key])) problems.push(`${path}.combatStance.${key} is unsupported`);
      }
      if (stance.school !== undefined && !SCHOOLS.includes(stance.school)) problems.push(`${path}.combatStance.school is unsupported`);
      if (stance.expiresOnOwnerCycle !== undefined && !whole(stance.expiresOnOwnerCycle)) problems.push(`${path}.combatStance.expiresOnOwnerCycle must be a non-negative whole number`);
    }
  }
  if (entity.combatCounter !== undefined) {
    problems.push(...expansionCounterProblems(entity.combatCounter, `${path}.combatCounter`));
    if (stance?.maneuver !== 'counter') problems.push(`${path}.combatCounter requires Counter stance`);
    if (entity.combatPreparationSerial !== entity.combatCounter.serial) problems.push(`${path}.combatCounter.serial must match its preparation serial`);
  }
  const evade = entity.combatEvade;
  if (evade !== undefined) {
    if (!record(evade)) problems.push(`${path}.combatEvade must be an object`);
    else {
      if (!whole(evade.charges)) problems.push(`${path}.combatEvade.charges must be a non-negative whole number`);
      if (!Number.isFinite(evade.bonus)) problems.push(`${path}.combatEvade.bonus must be finite`);
      for (const key of ['advantage', 'disadvantage']) if (typeof evade[key] !== 'boolean') problems.push(`${path}.combatEvade.${key} must be boolean`);
      if (evade.whileStatus !== undefined && !text(evade.whileStatus)) problems.push(`${path}.combatEvade.whileStatus must be a non-empty status id`);
      if (!whole(evade.expiresOnOwnerCycle) || evade.expiresOnOwnerCycle === 0) problems.push(`${path}.combatEvade.expiresOnOwnerCycle must be a positive whole number`);
    }
  }
  return problems;
}

/** Validates just the matchup table; other expansion owners validate theirs. */
export function combatExpansionMatchupRulesProblems(rules, path = 'combatExpansionRules.matchups') {
  if (!record(rules)) return [`${path} must be an object`];
  const problems = [];
  const numbers = (group, keys) => {
    if (!record(rules[group])) { problems.push(`${path}.${group} must be an object`); return; }
    for (const key of keys) if (!nonNegative(rules[group][key])) problems.push(`${path}.${group}.${key} must be finite and non-negative`);
  };
  numbers('counter', ['incomingMultiplier', 'maxReturnsPerCycle', 'schoolStrongMultiplier', 'schoolWeakMultiplier']);
  numbers('attack', ['smashMultiplier', 'preparedPoiseMultiplier']);
  numbers('smash', ['defendedMultiplier', 'guardBreakPoiseBonus']);
  numbers('defend', ['sweepMultiplier', 'turnStartProtection']);
  numbers('evade', ['die', 'baseDC']);
  numbers('distance', ['nearChance', 'farChance', 'maximumBaseChance']);
  if (rules.evade?.die !== 20) problems.push(`${path}.evade.die must be 20`);
  if (rules.counter?.maxReturnsPerCycle !== 1) problems.push(`${path}.counter.maxReturnsPerCycle must be 1`);
  if (rules.distance?.maximumBaseChance > 50) problems.push(`${path}.distance.maximumBaseChance cannot exceed 50`);
  for (const [group, keys] of [['armorPenalty', ['light', 'medium', 'heavy']], ['areaDifficulty', REACHES]]) {
    for (const key of keys) if (!nonNegative(rules.evade?.[group]?.[key])) problems.push(`${path}.evade.${group}.${key} must be finite and non-negative`);
  }
  if (!record(rules.counter?.defaultCoverage)) problems.push(`${path}.counter.defaultCoverage must be an object`);
  else for (const mode of ['melee', 'ranged', 'spell']) problems.push(...counterCoverageProblems(rules.counter.defaultCoverage[mode], `${path}.counter.defaultCoverage.${mode}`));
  if (!record(rules.counter?.schoolMatchups)) problems.push(`${path}.counter.schoolMatchups must be an object`);
  else for (const [school, match] of Object.entries(rules.counter.schoolMatchups)) {
    if (!SCHOOLS.includes(school) || !record(match)) { problems.push(`${path}.counter.schoolMatchups.${school} is unsupported`); continue; }
    for (const [key, values] of Object.entries(match)) {
      if (!/^(strong|weak)(Schools|DamageTypes|Reaches|Targeting|Traits)$/.test(key)) problems.push(`${path}.counter.schoolMatchups.${school}.${key} is unknown`);
      problems.push(...stringsProblems(values, `${path}.counter.schoolMatchups.${school}.${key}`));
    }
  }
  // Normalize only the validator view. Version 2 authors gauge pressure; its
  // actual data never inherits version 1's direct active-stack applications.
  const normalized = { damageRiders: {}, tagRiders: {} };
  if (!record(rules.damageRiders)) problems.push(`${path}.damageRiders must be an object`);
  if (rules.tagRiders !== undefined && !record(rules.tagRiders)) problems.push(`${path}.tagRiders must be an object`);
  for (const group of ['damageRiders', 'tagRiders']) if (record(rules[group])) for (const [type, rider] of Object.entries(rules[group])) {
    if (!record(rider)) { problems.push(`${path}.${group}.${type} must be an object`); continue; }
    const { pressure, recoveryProfile, ...rest } = rider;
    if (rider.status !== undefined && (!whole(pressure) || pressure === 0)) problems.push(`${path}.${group}.${type}.pressure must be a positive whole number`);
    if (rider.status !== undefined && !['bodily', 'elemental', 'mental', 'curse'].includes(recoveryProfile)) problems.push(`${path}.${group}.${type}.recoveryProfile is unsupported`);
    if (rider.stacks !== undefined) problems.push(`${path}.${group}.${type}.stacks must be authored as pressure`);
    normalized[group][type] = { ...rest, ...(rider.status ? { stacks: pressure } : {}) };
  }
  const riderRules = { ...combatMatchups, damageRiders: normalized.damageRiders,
    ...(rules.tagRiders !== undefined ? { tagRiders: normalized.tagRiders } : {}), damageAliases: rules.damageAliases, cleanseStatuses: rules.cleanseStatuses };
  if (rules.tagRiders === undefined) delete riderRules.tagRiders;
  problems.push(...combatMatchupRulesProblems(riderRules, path).filter(problem => /damageRiders|tagRiders|damageAliases|cleanseStatuses/.test(problem)));
  problems.push(...stringsProblems(rules.reactionLocks, `${path}.reactionLocks`));
  return problems;
}
