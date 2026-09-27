// src/model/recoveryRules.js — the recovery settings, without a screen.
//
// Pure model: settings in, rules and one-step answers out. The defaults are
// content/recoveryRules.js; a profile's stored `recovery.<pool>.<field>` keys
// override them. The fight reads `recoveryRulesFor(settings)` once, at its
// door (engine/runCombat.js), and snapshots it, so a fight never changes its
// rules halfway through; after-combat and at-rest recovery read the live
// settings when they happen.

import { RECOVERY_POOLS, RECOVERY_UNITS, recoveryRules } from '../content/recoveryRules.js';
import { mechanics } from '../framework/data/mechanics.js';

export const RECOVERY_PREFIX = 'recovery.';
export const RECOVERY_FIELDS = Object.freeze(['perTurn', 'unit', 'idleTurns', 'everyRounds', 'afterCombat', 'atRest']);
const D = recoveryRules.defaults;
const R = recoveryRules.ranges;
const MAX_KEY = { hp: 'maxHp', stamina: 'maxStamina', mana: 'maxMana' };

/** recoveryKey('stamina', 'idleTurns') → 'recovery.stamina.idleTurns'. */
export function recoveryKey(pool, field) { return `${RECOVERY_PREFIX}${pool}.${field}`; }

function stored(settings, pool, field) {
  const value = settings?.[recoveryKey(pool, field)];
  if (field === 'unit') return RECOVERY_UNITS.includes(value) ? value : D[pool].unit;
  const range = R[field];
  return Number.isInteger(value) && value >= range.min && value <= range.max ? value : D[pool][field];
}

/** resolvedRecovery(settings) → { hp, stamina, mana }, every field resolved. */
export function resolvedRecovery(settings) {
  return Object.fromEntries(RECOVERY_POOLS.map((pool) => [pool,
    Object.fromEntries(RECOVERY_FIELDS.map((field) => [field, stored(settings, pool, field)]))]));
}

/**
 * recoveryRulesFor(settings) → the in-combat rules a fight is built with, or
 * null when every in-combat field is at its default — the fight then runs the
 * engine's own idle-Stamina rule and writes no recovery state at all.
 */
export function recoveryRulesFor(settings) {
  const all = resolvedRecovery(settings);
  const inCombat = ['perTurn', 'unit', 'idleTurns', 'everyRounds'];
  const changed = RECOVERY_POOLS.some((pool) => inCombat.some((field) => all[pool][field] !== D[pool][field]));
  if (!changed) return null;
  return Object.fromEntries(RECOVERY_POOLS.map((pool) => [pool,
    Object.fromEntries(inCombat.map((field) => [field, all[pool][field]]))]));
}

/** recoveryRulesProblems(rules) → [] or the refusals, by name (the fight and snapshot doors). */
export function recoveryRulesProblems(rules) {
  if (!rules || typeof rules !== 'object') return ['Recovery rules must be an object'];
  const problems = [];
  for (const pool of RECOVERY_POOLS) {
    const row = rules[pool];
    if (!row || typeof row !== 'object') { problems.push(`Recovery rules: missing ${pool}`); continue; }
    if (!RECOVERY_UNITS.includes(row.unit)) problems.push(`Recovery rules: ${pool}.unit must be one of ${RECOVERY_UNITS.join(', ')}`);
    for (const field of ['perTurn', 'idleTurns', 'everyRounds']) {
      const range = R[field];
      if (!Number.isInteger(row[field]) || row[field] < range.min || row[field] > range.max) {
        problems.push(`Recovery rules: ${pool}.${field} must be a whole number from ${range.min} to ${range.max}`);
      }
    }
  }
  return problems;
}

/** The points one trigger restores: flat, or a percent of the maximum rounded down. */
export function recoveryAmount(amount, unit, max) {
  if (!(amount > 0) || !(max > 0)) return 0;
  return unit === 'percent' ? Math.floor(max * amount / 100) : amount;
}

/**
 * turnRecovery({ rules, pool, round, idleStreak, current, max }) → the points
 * this turn restores. `idleStreak` counts this turn: 1 means the pool went
 * unused this turn, 0 that it was used.
 */
export function turnRecovery({ rules, pool, round, idleStreak, current, max }) {
  const row = rules[pool];
  if (!row || !(max > 0) || current >= max) return 0;
  if (row.idleTurns > 0 && idleStreak < row.idleTurns) return 0;
  if (row.everyRounds > 1 && round % row.everyRounds !== 0) return 0;
  return Math.min(max - current, recoveryAmount(row.perTurn, row.unit, max));
}

// Between fights Stamina is inert while every fight opens with it full
// (mechanics.stamina.combatStartRefill 'full'): Settings shows no rows for it,
// and a stored value (an import, an older profile) restores nothing, so the
// Rest preview, which reports HP and Mana, never omits a gain the Rest gives.
function percents(settings, field) {
  const all = resolvedRecovery(settings);
  return Object.fromEntries(RECOVERY_POOLS.map((pool) => [pool,
    pool === 'stamina' && mechanics.stamina.combatStartRefill === 'full' ? 0 : all[pool][field]]));
}

/**
 * applyPercentRecovery(run, { hp, stamina, mana }) → the points each percent
 * of the maximum added (rounded down, capped at the maximum).
 */
export function applyPercentRecovery(run, byPool) {
  const gained = {};
  for (const pool of RECOVERY_POOLS) {
    const max = run[MAX_KEY[pool]];
    gained[pool] = Number.isFinite(max) && Number.isFinite(run[pool]) && run[pool] < max
      ? Math.min(max - run[pool], recoveryAmount(byPool?.[pool] || 0, 'percent', max)) : 0;
    run[pool] += gained[pool];
  }
  return gained;
}

/**
 * applyAfterCombatRecovery(run, settings) → { hp, stamina, mana } restored.
 * Called once a won fight has written its pools back to the run.
 */
export function applyAfterCombatRecovery(run, settings) {
  return applyPercentRecovery(run, percents(settings, 'afterCombat'));
}

/** restRecoveryBonus(settings) → { hp, stamina, mana } percents a Rest adds. */
export function restRecoveryBonus(settings) {
  return percents(settings, 'atRest');
}
