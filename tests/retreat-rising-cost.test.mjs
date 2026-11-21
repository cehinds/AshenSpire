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

test('the second Retreat in a fight costs 2 Stamina, the third 3', () => {
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
  assert.deepEqual(costs, [1, 2, 3]);
});
