// Core 2 Precision decays 1 stack at its owner's turn start in co-op too (owner, 2026-10-31); Persistent stacks are exempt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { runCombatPlayer } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, endTurn } from '../src/engine/coopCombat.js';
import { RANGE_POLICY_DEFAULTS } from '../src/model/combatEngagement.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture() {
  const players = ['p1', 'p2'].map(id => ({ ...runCombatPlayer(createRunState({ registries, classId: 'reaver', seed: 9 })), id, registries, orderedDraw: true, combatExpansionVersion: 2 }));
  return createCoopCombat({ registries, rng: createRng(9), players, enemyIds: ['wanderingSoldier'], gameProfile: profile, rangePolicy: RANGE_POLICY_DEFAULTS, combatExpansionVersion: 2 });
}
test('co-op seats and enemies lose one Precision stack at their next turn start; persistent stacks stay', () => {
  const combat = fixture(), seat = combat.players.get('p1').entity, other = combat.players.get('p2').entity, enemy = combat.enemies[0];
  seat.statuses.precision = { stacks: 3 };
  other.statuses.precision = { stacks: 5, persistentStacks: 2 };
  enemy.statuses.precision = { stacks: 3 };
  endTurn(combat, 'p1'); endTurn(combat, 'p2');
  assert.equal(combat.phase, 'player', 'the next player phase has started');
  assert.equal(seat.statuses.precision?.stacks, 2, 'a seat loses one stack');
  assert.equal(other.statuses.precision.stacks, 4, 'only temporary stacks decay');
  assert.equal(other.statuses.precision.persistentStacks, 2);
  // The enemy may regain an entry stack after its decay, so read the decay receipt rather than the final count.
  assert.ok(combat.eventLog.some(e => e.type === 'statusRemoved' && e.targetId === enemy.id && e.status === 'precision' && e.reason === 'ownerTurnStart' && e.amount === 1), 'the enemy lost one stack at its own turn start');
});
