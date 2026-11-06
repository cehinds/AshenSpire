// Owner 2026-11-06, enemy turn: SP check -> reveal -> the enemy pays (enemyStaminaSpent) -> move -> the plan only
// shrinks; an SP loss during the turn drops the RIGHT-MOST planned move first (enemyPlanTrimmed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, trimEnemyPlanDuringTurn } from '../src/engine/combat.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fight(id, seed) {
  const run = createRunState({ registries, classId: 'reaver', seed });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [id] });
  combat.player.hp = combat.player.maxHp = 100000;
  return combat;
}
const settle = combat => { for (let i = 0; combat.pendingReaction && i < 50; i++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }); };
function enemyTurn(combat) {
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' }); settle(combat);
  return combat.eventLog.slice(start);
}

test('every move the enemy plays is paid for first: enemyStaminaSpent precedes its enemyMoveStarted', () => {
  let paidMoves = 0;
  for (const id of ['wanderingSoldier', 'fellWarden']) for (const seed of [511, 2, 3]) {
    const combat = fight(id, seed);
    const events = enemyTurn(combat);
    events.forEach((event, i) => {
      if (event.type !== 'enemyMoveStarted' || event.reaction) return;
      const spent = events.slice(0, i).reverse().find(row => row.type === 'enemyStaminaSpent' && row.moveId === event.moveId);
      if (event.actionPreview?.spCost > 0) { assert.ok(spent, `${id}/${seed}: ${event.moveId} is paid before it starts`); assert.equal(spent.amount, event.actionPreview.spCost); paidMoves++; }
    });
  }
  assert.ok(paidMoves > 0, 'the fixture exercises at least one paid move');
});

test('an SP loss during the enemy turn trims the plan from the right-most move, with an enemyPlanTrimmed receipt', () => {
  const combat = fight('fellWarden', 511);
  const enemy = combat.enemies[0];
  assert.ok(enemy.plannedMoves.length >= 2, 'the fixture has a plan');
  const plan = enemy.plannedMoves.map(row => row.moveId);
  // The head was paid and left 2 SP; then a Poise break takes the rest, so nothing after it is affordable.
  combat.eventLog.push({ type: 'enemyStaminaSpent', sourceId: enemy.id, moveId: plan[0], amount: 1, remaining: 2 });
  enemy.stamina = enemy.fixCoreStaminaRemaining = 0;
  const start = combat.eventLog.length;
  trimEnemyPlanDuringTurn(combat, enemy);
  const [first] = combat.eventLog.slice(start).filter(row => row.type === 'enemyPlanTrimmed');
  assert.ok(first, 'the plan is trimmed');
  assert.equal(first.dropped.at(-1), plan.at(-1), 'the right-most planned move is dropped first');
  assert.deepEqual(first.remaining, plan.slice(0, first.remaining.length), 'what remains is the plan prefix, in order');
});

test('without an SP loss since the last payment nothing is trimmed (a range shortfall is still a refusal at act time)', () => {
  const combat = fight('fellWarden', 511);
  const enemy = combat.enemies[0];
  combat.eventLog.push({ type: 'enemyStaminaSpent', sourceId: enemy.id, moveId: 'x', amount: 1, remaining: 0 });
  enemy.stamina = enemy.fixCoreStaminaRemaining = 0;
  const before = enemy.plannedMoves.map(row => row.moveId).join();
  trimEnemyPlanDuringTurn(combat, enemy);
  assert.equal(enemy.plannedMoves.map(row => row.moveId).join(), before);
});

test('the trim prices the kept plan in sequence: one band out of reach, two 1 SP melee moves left, 3 SP keeps both', async () => {
  const { uncappedRun } = await import('./helpers/uncapped-range.mjs');
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  uncappedRun(run);
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  const key = Object.keys(combat.rangeState.engagements)[0];
  combat.rangeState = { ...combat.rangeState, engagements: { ...combat.rangeState.engagements, [key]: 1 } };
  enemy.plannedMoves = [{ moveId: 'slash', sp: 1 }, { moveId: 'slash', sp: 1 }];
  // It was due to have 4 SP left and now has 3 (a 1 SP loss): the first attack pays 1 + 1 Advance, the second (at band 0) 1.
  combat.eventLog.push({ type: 'enemyStaminaSpent', sourceId: enemy.id, moveId: 'guard', amount: 1, remaining: 4, expectedLeft: 4 });
  enemy.stamina = enemy.fixCoreStaminaRemaining = 3;
  const start = combat.eventLog.length;
  trimEnemyPlanDuringTurn(combat, enemy);
  assert.equal(combat.eventLog.slice(start).filter(row => row.type === 'enemyPlanTrimmed').length, 0, 'both affordable attacks are kept');
  assert.equal(enemy.plannedMoves.length, 2);
  // One more SP lost: only the first attack (2 SP with its Advance) fits, so the right-most goes.
  enemy.stamina = enemy.fixCoreStaminaRemaining = 2;
  trimEnemyPlanDuringTurn(combat, enemy);
  const [trim] = combat.eventLog.slice(start).filter(row => row.type === 'enemyPlanTrimmed');
  assert.deepEqual([trim?.dropped, trim?.remaining], [['slash'], ['slash']]);
});
