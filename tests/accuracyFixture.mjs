// Pin a real registered Accuracy outcome so transactional dispatch preserves it.
import { createRng } from '../src/engine/rng.js';
export function primeAccuracyRolls(combat, { die = 20, count = 1, drawsPerAttack = 1 } = {}) {
  if (!Number.isSafeInteger(drawsPerAttack) || drawsPerAttack < 1) throw new Error('drawsPerAttack must be a positive integer');
  const original = combat.rng.getCounters();
  const search = createRng(combat.rng.seed, original);
  let streak = 0, start = original.combatAvoidance || 0;
  for (let attempts = 0; attempts < 1000000; attempts++) {
    const before = search.getCounters().combatAvoidance;
    const attacker = search.int('combatAvoidance', 1, 20);
    // Normal Core Accuracy draws attacker then defender. Pin only the attack
    // die; opposed defender rolls remain real seeded outcomes.
    for (let draw = 1; draw < drawsPerAttack; draw++) search.int('combatAvoidance', 1, 20);
    if (attacker === die) {
      if (!streak) start = before;
      if (++streak === count) {
        combat.rng.restoreCounters({ ...original, combatAvoidance: start });
        return;
      }
    } else streak = 0;
  }
  throw new Error('Could not prime seeded Accuracy fixture');
}
