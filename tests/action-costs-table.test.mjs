// Action costs (owner decision, 2026-10-12, SPEC §4 Action costs): the stance → SP table, its validation, and the
// stance a card or enemy move is classified under.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_COST_TABLE, ENEMY_SP_POOL, TWO_COST_EFFECT_MULTIPLIER, SCALED_EFFECT_OPS } from '../src/content/actionCosts.js';
import { validateActionCostTable, stanceCost, actionStance } from '../src/model/actionCosts.js';

test('the cost table is the owner table: attack 1, block 1, smash 2, counter 2, cast 2, sweep 2', () => {
  assert.deepEqual({ ...ACTION_COST_TABLE }, { attack: 1, block: 1, smash: 2, counter: 2, cast: 2, sweep: 2 });
  assert.ok(Object.isFrozen(ACTION_COST_TABLE), 'the table is data that cannot be edited in place');
  assert.doesNotThrow(() => validateActionCostTable(ACTION_COST_TABLE));
});

test('the validator refuses a missing, negative or fractional stance by name', () => {
  const { smash: _smash, ...missing } = ACTION_COST_TABLE;
  assert.throws(() => validateActionCostTable(missing), /smash/);
  assert.throws(() => validateActionCostTable({ ...ACTION_COST_TABLE, attack: -1 }), /attack.*-1/);
  assert.throws(() => validateActionCostTable({ ...ACTION_COST_TABLE, cast: 1.5 }), /cast.*1\.5/);
  assert.throws(() => validateActionCostTable({ ...ACTION_COST_TABLE, sweep: '2' }), /sweep/);
});

test('stanceCost reads the table, and a stance outside it (evade) has no table price', () => {
  assert.equal(stanceCost('smash'), 2);
  assert.equal(stanceCost('block'), 1);
  assert.equal(stanceCost('evade'), null, 'the dodge keeps its weight-class price, so it has no table entry');
  assert.equal(stanceCost(null), null);
});

test('a maneuver tag names the stance before the timeline kind does', () => {
  assert.equal(actionStance({ kind: 'attack', tags: ['maneuver:smash'] }), 'smash');
  assert.equal(actionStance({ kind: 'attack', tags: ['maneuver:sweep'] }), 'sweep');
  assert.equal(actionStance({ kind: 'attack', tags: ['maneuver:counter'] }), 'counter');
  assert.equal(actionStance({ kind: 'guard', tags: ['maneuver:defend'] }), 'block');
  assert.equal(actionStance({ kind: 'attack', tags: ['maneuver:ranged'] }), 'attack', 'a ranged attack is an attack');
  assert.equal(actionStance({ kind: 'attack', tags: [] }), 'attack');
  assert.equal(actionStance({ kind: 'guard', tags: [] }), 'block');
  assert.equal(actionStance({ kind: 'counter', tags: [] }), 'counter');
});

test('a spell or a casting maneuver is a cast, whatever its kind', () => {
  assert.equal(actionStance({ kind: 'attack', tags: ['camp:spell'] }), 'cast');
  assert.equal(actionStance({ kind: 'guard', tags: ['camp:spell', 'maneuver:defend'] }), 'cast');
  assert.equal(actionStance({ kind: 'other', tags: ['maneuver:casting'] }), 'cast');
});

test('an unclassified move has no stance, and an evade has one that the table does not price', () => {
  assert.equal(actionStance({ kind: 'other', tags: [] }), null);
  assert.equal(actionStance({ kind: 'evade', tags: [] }), 'evade');
  assert.equal(stanceCost(actionStance({ kind: 'evade', tags: [] })), null);
});

test('the provisional 1.8 multiplier, the 2-SP enemy pool and the scaled effect ops are the shipped defaults', () => {
  assert.equal(ENEMY_SP_POOL, 2);
  assert.equal(TWO_COST_EFFECT_MULTIPLIER, 1.8);
  assert.deepEqual([...SCALED_EFFECT_OPS].sort(), ['block', 'buildup', 'damage', 'gainBarrier', 'gainPoise', 'gainWard', 'heal', 'poiseDamage', 'wardDamage']);
  for (const never of ['draw', 'discard', 'addCard', 'applyStatus', 'loseHp']) assert.ok(!SCALED_EFFECT_OPS.includes(never), `${never} is never scaled`);
});
