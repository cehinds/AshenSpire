// Pin a real registered Accuracy outcome so transactional dispatch preserves it.
import { createRng } from '../src/engine/rng.js';
export function primeAccuracyRolls(combat, { die = 20, count = 1 } = {}) {
  const original = combat.rng.getCounters();
  const search = createRng(combat.rng.seed, original);
  let streak = 0, start = original.combatAvoidance || 0;
  for (let attempts = 0; attempts < 1000000; attempts++) {
    const before = search.getCounters().combatAvoidance;
    if (search.int('combatAvoidance', 1, 20) === die) {
      if (!streak) start = before;
      if (++streak === count) {
        combat.rng.restoreCounters({ ...original, combatAvoidance: start });
        return;
      }
    } else streak = 0;
  }
  throw new Error('Could not prime seeded Accuracy fixture');
}
