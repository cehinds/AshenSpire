import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/rng.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

test('opposed Accuracy fixture pins each attacker without constraining defender dice', () => {
  const combat = { rng: createRng(511) };
  combat.rng.int('shuffle', 1, 20);
  const before = combat.rng.getCounters();
  primeAccuracyRolls(combat, { count: 3, drawsPerAttack: 2 });
  const primed = combat.rng.getCounters();
  assert.deepEqual({ ...primed, combatAvoidance: before.combatAvoidance }, before, 'priming changes no other stream');
  const pairs = Array.from({ length: 3 }, () => [combat.rng.int('combatAvoidance', 1, 20), combat.rng.int('combatAvoidance', 1, 20)]);
  assert.deepEqual(pairs.map(([attacker]) => attacker), [20, 20, 20]);
  assert.ok(pairs.some(([, defender]) => defender !== 20), 'the defender dice were not also primed to natural twenty');
  assert.equal(combat.rng.getCounters().combatAvoidance - primed.combatAvoidance, 6);
});

test('ordinary Accuracy fixture retains consecutive-die priming', () => {
  const combat = { rng: createRng(511) };
  primeAccuracyRolls(combat, { count: 3 });
  assert.deepEqual(Array.from({ length: 3 }, () => combat.rng.int('combatAvoidance', 1, 20)), [20, 20, 20]);
  assert.throws(() => primeAccuracyRolls(combat, { drawsPerAttack: 0 }), /positive integer/);
});
