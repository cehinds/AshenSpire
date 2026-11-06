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
import { dispatch } from '../src/engine/combat.js';

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
  let trimmed = null;
  for (const seed of [511, 2, 3, 4, 5, 6, 7, 8]) {
    const combat = fight('fellWarden', seed);
    const enemy = combat.enemies[0];
    if ((enemy.plannedMoves?.length || 0) < 2) continue;
    const plan = enemy.plannedMoves.map(row => row.moveId);
    // The enemy can afford its head move but nothing after it (a Poise break took the rest of its SP).
    enemy.pendingStaminaLoss = Math.max(0, (enemy.maxStamina ?? 3) - 1);
    const log = enemyTurn(combat);
    const events = log.filter(row => row.type === 'enemyPlanTrimmed');
    const original = null;
    if (events.length) { trimmed = { events, plan, original }; break; }
  }
  assert.ok(trimmed, 'a fixture plan is trimmed');
  const [first] = trimmed.events;
  assert.equal(first.dropped.at(-1), trimmed.plan.at(-1), 'the right-most planned move is dropped first');
  assert.deepEqual(first.remaining, trimmed.plan.filter((id, i) => i < first.remaining.length), 'what remains is the plan prefix, in order');
  assert.ok(first.remaining.length + first.dropped.length <= trimmed.plan.length);
});

test('the trim prices the kept plan in sequence: a first move that closes the distance makes the next one cheaper', async () => {
  const { rangePairKey } = await import('../src/model/combatEngagement.js');
  const { uncappedRun } = await import('./helpers/uncapped-range.mjs');
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  uncappedRun(run);
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  combat.player.hp = combat.player.maxHp = 100000;
  const enemy = combat.enemies[0];
  const pair = rangePairKey(`enemy:${enemy.id}`, 'player:player');
  const key = Object.keys(combat.rangeState.engagements)[0] ?? pair;
  combat.rangeState = { ...combat.rangeState, engagements: { ...combat.rangeState.engagements, [key]: 1 } };
  // Head: a move that does not close distance (guard). Then two 1 SP melee attacks from Reach distance:
  // the first pays 1 + 1 Advance, the second is at band 0 and pays 1, so 3 SP afford both (4 would be the per-move quote).
  enemy.intent = { ...enemy.intent, moveId: 'guard' };
  enemy.plannedMoves = [{ moveId: 'slash', sp: 1 }, { moveId: 'slash', sp: 1 }];
  const guardSp = registries.enemies.get('wanderingSoldier').moves.guard;
  enemy.maxStamina = (guardSp.sp ?? 1) + 3; enemy.pendingStaminaLoss = 0; // the turn start refills the pool from these
  const events = enemyTurn(combat);
  assert.ok(events.some(row => row.type === 'enemyMoveStarted' && row.moveId === 'guard'), 'the head played');
  assert.equal(events.filter(row => row.type === 'enemyPlanTrimmed').length, 0, 'both affordable attacks are kept');
});
