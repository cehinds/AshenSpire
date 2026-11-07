// src/model/recoveryRules.js — after-combat and at-rest recovery, without a screen.
//
// Pure model. The authored defaults are content/recoveryRules.js; nothing in the
// profile changes them (cleanup 3i-A, owner-approved): a stored legacy
// `recovery.<pool>.<field>` key has no effect on Core 2 healing. The in-combat
// recovery rules (per turn, idle turns, every N rounds) were removed with the
// combat-rounds system.

import { RECOVERY_POOLS, recoveryRules } from '../content/recoveryRules.js';
import { mechanics } from '../framework/data/mechanics.js';

const D = recoveryRules.defaults;
const MAX_KEY = { hp: 'maxHp', stamina: 'maxStamina', mana: 'maxMana' };

/** The points one trigger restores: flat, or a percent of the maximum rounded down. */
export function recoveryAmount(amount, unit, max) {
  if (!(amount > 0) || !(max > 0)) return 0;
  return unit === 'percent' ? Math.floor(max * amount / 100) : amount;
}

// Between fights Stamina is inert while every fight opens with it full
// (mechanics.stamina.combatStartRefill 'full'): Settings shows no rows for it,
// and a stored value (an import, an older profile) restores nothing, so the
// Rest preview, which reports HP and Mana, never omits a gain the Rest gives.
// Likewise Mana's after-combat percent is inert while a fight's end refills it
// (mechanics.mana.combatEndRefill 'full'; owner 2026-10-31).
function percents(field) {
  return Object.fromEntries(RECOVERY_POOLS.map((pool) => [pool,
    (pool === 'stamina' && mechanics.stamina.combatStartRefill === 'full')
      || (pool === 'mana' && field === 'afterCombat' && mechanics.mana.combatEndRefill === 'full') ? 0 : D[pool][field]]));
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
 * applyAfterCombatRecovery(run) → { hp, stamina, mana } restored.
 * Called once a won fight has written its pools back to the run.
 */
export function applyAfterCombatRecovery(run) {
  return applyPercentRecovery(run, percents('afterCombat'));
}

/** restRecoveryBonus() → { hp, stamina, mana } percents a Rest adds. */
export function restRecoveryBonus() {
  return percents('atRest');
}
