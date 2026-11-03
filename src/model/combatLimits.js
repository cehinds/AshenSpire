// src/model/combatLimits.js — the one home of the per-fight enemy cap.
// Owner decision (2026-11-03): "Limit to just 3 enemies max" — a combat never
// holds more than three enemies, in every layout (SPEC §4, Encounters).
// Pure data helpers; headless.

export const MAX_ENEMIES_PER_COMBAT = 3;

/** The enemy ids a fight may open with: the first MAX_ENEMIES_PER_COMBAT, in row order. */
export function limitEnemyIds(enemyIds) {
  return Array.isArray(enemyIds) ? enemyIds.slice(0, MAX_ENEMIES_PER_COMBAT) : enemyIds;
}

/** True when one more enemy may join a fight that already holds `alive` of them (summons, splits). */
export function enemySlotFree(alive) {
  return Number(alive) < MAX_ENEMIES_PER_COMBAT;
}
