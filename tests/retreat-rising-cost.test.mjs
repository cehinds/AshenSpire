// Retreat (SPEC, Retreat): +1 Stamina each time you play Retreat this fight, shared by every granted copy (costGrowth scope 'card').
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch, cardPlayCosts } from '../src/engine/combat.js';

const profile = resolveGameProfile('core');
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

test('Retreat costs 0 Stamina on first play, then 1, then 2 across granted copies', () => {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 5, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(5), enemyIds: ['wanderingSoldier'] });
  combat.player.stamina = combat.player.energy = 20;
  const copies = ['r1', 'r2', 'r3'].map(instanceId => ({ instanceId, cardId: 'core.retreat', upgraded: false }));
  combat.piles.hand.unshift(...copies);
  const costs = [];
  for (const { instanceId } of copies) {
    // Playing Retreat (a Defense card) enters Defend stance, whose own discount would hide the rise; price outside it.
    delete combat.player.combatStance;
    costs.push(cardPlayCosts(combat, instanceId).stamina);
    dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: combat.player.id });
    assert.ok(combat.piles.exhaust.some(c => c.instanceId === instanceId), 'Retreat still exhausts');
  }
  assert.deepEqual(costs, [0, 1, 2]);
});

test('an Evade card costs 1, 2, 3, 4 then stays at +3 across copies, and each copy withers on its third play', () => {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 5, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(5), enemyIds: ['wanderingSoldier'] });
  combat.player.stamina = combat.player.energy = 40;
  const order = ['g1', 'g1', 'g1', 'g2', 'g2'];
  const costs = [];
  for (const instanceId of order) {
    for (const pile of [combat.piles.discard, combat.piles.draw]) { const at = pile.findIndex(c => c.instanceId === instanceId); if (at >= 0) pile.splice(at, 1); }
    if (!combat.piles.hand.some(c => c.instanceId === instanceId)) combat.piles.hand.unshift({ instanceId, cardId: 'evasiveGuard', upgraded: false });
    delete combat.player.combatStance;
    costs.push(cardPlayCosts(combat, instanceId).stamina);
    dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: combat.player.id });
  }
  assert.deepEqual(costs, [1, 2, 3, 4, 4]);
  assert.ok(combat.piles.exhaust.some(c => c.instanceId === 'g1'), 'the first copy withered on its third play');
  assert.ok(!combat.piles.exhaust.some(c => c.instanceId === 'g2'), 'the second copy has one play left');
});
