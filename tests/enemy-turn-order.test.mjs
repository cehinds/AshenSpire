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
