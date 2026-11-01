// Enemy weaknesses (SPEC 5.3) multiply damage on a real enemy. Combat-arithmetic suites that name another rule (Poise, Smash, Staggered,
// ratings...) strip them from their fixtures so they keep testing that rule; tests/enemy-weaknesses.test.mjs owns the weakness arithmetic.
import { createRunCombat as create } from '../src/engine/runCombat.js';
export function withoutWeaknesses(combat) {
  for (const enemy of combat.enemies || []) delete enemy.weaknesses;
  return combat;
}
export const createRunCombat = (...args) => withoutWeaknesses(create(...args));
