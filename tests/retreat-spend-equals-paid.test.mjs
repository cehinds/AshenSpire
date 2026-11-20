// Delta review of b6252d3b727: stacks spent equal Advances paid on both sides; each paid Advance closes on every enemy; a charged enemy move spends only
// what its frozen plan priced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { SetEnemyRow, SpendRetreatAdvances } from '../src/engine/bandRows.js';
import { rangeActionPlan } from '../src/model/combatEngagement.js';
import { applyStatus } from '../src/engine/statuses.js';
import { bandsFight } from './helpers/bands-fight.mjs';

const stacks = entity => entity.statuses?.retreat?.stacks || 0;
const hold = (combat, enemy, n) => { SetEnemyRow(combat, enemy, 'back', 'push'); applyStatus(combat, enemy, 'retreat', n, null); };
const enemyPlan = (combat, enemy, contactExtra) => rangeActionPlan(combat.rangeState, `enemy:${enemy.id}`, [{ targetKey: 'player:player', coverage: 0, ...contactExtra }]);

test('an enemy source holding 3 stacks pays 3 Advances and spends all 3, and steps forward', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  hold(combat, enemy, 3);
  const plan = enemyPlan(combat, enemy, { enemyStacks: 3 });
  assert.equal(plan.advanceSp, 3);
  SpendRetreatAdvances(combat, enemy, plan);
  assert.equal(stacks(enemy), 0);
  assert.equal(enemy.row, 'front');
});

test('an enemy source with 2 stacks against a player with 1 pays 3 and spends 2 + 1', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  hold(combat, enemy, 2);
  applyStatus(combat, combat.player, 'retreat', 1, null);
  const plan = enemyPlan(combat, enemy, { enemyStacks: 2, playerStacks: 1 });
  assert.equal(plan.advanceSp, 3);
  SpendRetreatAdvances(combat, enemy, plan);
  assert.equal(stacks(enemy), 0);
  assert.equal(stacks(combat.player), 0);
});

test('each Advance the player pays closes on every enemy: strike at A (2 stacks) pays 2, B loses 2 (3 to 1)', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier'], hand: ['core.strike'], stamina: 8 });
  const [a, b] = combat.enemies;
  hold(combat, a, 2); hold(combat, b, 3);
  const before = combat.player.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: a.id });
  assert.equal(stacks(a), 0, 'the contacted enemy spends all of its stacks');
  assert.equal(stacks(b), 1, 'the other enemy loses one per Advance paid');
  assert.equal(before - combat.player.stamina, 1 + 2, 'the strike plus 2 Advances');
});

test('a charged move spends only what its frozen plan priced: stacks the player gained since stay', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  applyStatus(combat, combat.player, 'retreat', 1, null);
  const plan = enemyPlan(combat, enemy, { playerStacks: 1 }); // priced at the charge: 1
  assert.equal(plan.advanceSp, 1);
  applyStatus(combat, combat.player, 'retreat', 2, null); // 3 now
  SpendRetreatAdvances(combat, enemy, plan, { frozen: true });
  assert.equal(stacks(combat.player), 2, 'only the 1 it paid for is spent');
});

test('a throw route (no SetAdvanced) still closes every other enemy by each Advance paid', async () => {
  const { acceptRangeActions } = await import('../src/engine/combatEngagement.js');
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier'], stamina: 8 });
  const [a, b] = combat.enemies;
  hold(combat, a, 3); hold(combat, b, 2);
  const plan = rangeActionPlan(combat.rangeState, 'player:player', [{ targetKey: `enemy:${a.id}`, coverage: 0, throwCapable: true, enemyStacks: 3, playerStacks: 0 }], { route: 'throw' });
  assert.equal(plan.advanceSp, 2, 'the throw pays its two Retreat Advances');
  acceptRangeActions(combat, combat.player, [], { rangePlan: plan }, 'root-throw');
  assert.equal(stacks(a), 0, 'the contacted enemy spends all of its stacks');
  assert.equal(stacks(b), 0, 'the other enemy loses one per Advance paid (2 to 0), not paid - 1');
});

test('a charged enemy move spends only the player stacks its plan priced, not those gained after the charge', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  hold(combat, enemy, 3);
  const plan = enemyPlan(combat, enemy, { enemyStacks: 3, playerStacks: 0 }); // charged: 3 own stacks, the player holds none
  assert.equal(plan.advanceSp, 3);
  assert.equal(plan.targets[0].playerStacks, 0, 'the plan freezes the player\'s priced stack count apart from the sum');
  applyStatus(combat, combat.player, 'retreat', 2, null); // the player retreats twice before it resolves
  SpendRetreatAdvances(combat, enemy, plan, { frozen: true });
  assert.equal(stacks(enemy), 0);
  assert.equal(stacks(combat.player), 2, 'the player keeps both new stacks');
});
