// src/engine/d20Chance.js — every percentage chance is rolled as a d20 (owner, 2026-11-01).
//
// A chance p (percent) becomes a target T = 21 - k, k = clamp(round(p / 5), 0, 20); the roll succeeds on d20 >= T.
// p = 0 gives k = 0 (T = 21, never succeeds) and callers keep their "no chance, no roll" short-circuit;
// p = 100 gives k = 20 (T = 1, always succeeds). Advantage keeps the HIGHER die, disadvantage the LOWER;
// both together cancel and one die is rolled. Headless.

export const D20_STEP = 5;

/** Number of d20 faces that succeed for a percentage chance (0..20). */
export function chanceToD20Steps(percent) {
  const p = Number(percent);
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(20, Math.round(p / D20_STEP)));
}

/** The chance a d20 check really rolls for a percentage chance: round(p / 5) × 5, clamped 0–100. Display uses this. */
export function effectiveD20Percent(percent) {
  return chanceToD20Steps(percent) * D20_STEP;
}

/** The d20 target: success on roll >= target. 21 means it can never succeed. */
export function chanceToD20Target(percent) {
  return 21 - chanceToD20Steps(percent);
}

/** The chance a d20 check succeeds with advantage or disadvantage, from the rounded chance it rolls. */
export function d20ModeChance(percent, { advantage = false, disadvantage = false } = {}) {
  const p = effectiveD20Percent(percent) / 100;
  if (Boolean(advantage) === Boolean(disadvantage)) return 100 * p;
  return 100 * (advantage ? 1 - (1 - p) ** 2 : p ** 2);
}

export function d20Mode({ advantage = false, disadvantage = false } = {}) {
  return Boolean(advantage) === Boolean(disadvantage) ? 'normal' : advantage ? 'advantage' : 'disadvantage';
}

/** The d20 check for a percentage chance. Returns { roll, rolls, target, success, mode, chance }. */
export function rollD20Check(rng, stream, percent, { advantage = false, disadvantage = false } = {}) {
  const target = chanceToD20Target(percent);
  const mode = d20Mode({ advantage, disadvantage });
  const rolls = [rng.int(stream, 1, 20)];
  if (mode !== 'normal') rolls.push(rng.int(stream, 1, 20));
  const roll = mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0];
  return { roll, rolls, target, success: roll >= target, mode, chance: Number(percent) || 0 };
}
