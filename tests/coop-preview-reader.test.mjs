import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { runCombatPlayer } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, previewCoopCard, createCoopCardPreviewReader } from '../src/engine/coopCombat.js';
import { RANGE_POLICY_DEFAULTS, movedEngagementState } from '../src/model/combatEngagement.js';
const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture() {
  const players = ['p1', 'p2'].map(id => {
    const run = createRunState({ registries, classId: 'reaver', seed: 9 });
    return { ...runCombatPlayer(run), id, registries, orderedDraw: true };
  });
  return createCoopCombat({ registries, rng: createRng(9), players, enemyIds: ['wanderingSoldier', 'wanderingSoldier'],
    gameProfile: profile, rangePolicy: RANGE_POLICY_DEFAULTS });
}
test('one owner reader matches scalar target/tier/route quotes without live mutation', () => {
  const combat = fixture();
  combat.rangeState = movedEngagementState(combat.rangeState, 'player:p1', 'enemy:e2', 1);
  const before = JSON.stringify({ players: [...combat.players], enemies: combat.enemies, range: combat.rangeState, rng: combat.rng.getCounters(), log: combat.eventLog, queue: combat.queue });
  for (const ownerId of ['p1', 'p2']) {
    const read = createCoopCardPreviewReader(combat, ownerId);
    for (const card of combat.players.get(ownerId).piles.hand.slice(0, 3)) for (const target of [...combat.enemies].reverse()) for (const rangeRoute of ['throw', 'advance']) {
      const args = [card.instanceId, target.id, 0, { rangeRoute }];
      assert.deepEqual(read(...args), previewCoopCard(combat, ownerId, ...args));
      assert.equal(read(...args), read(...args), 'repeated exact quotes share the same immutable revision');
    }
    const card = combat.players.get(ownerId).piles.hand[0];
    assert.throws(() => read('no-such-card', 'e1'));
    assert.deepEqual(read(card.instanceId, 'e1'), previewCoopCard(combat, ownerId, card.instanceId, 'e1'), 'a refused read cannot poison subsequent quotes');
  }
  assert.equal(JSON.stringify({ players: [...combat.players], enemies: combat.enemies, range: combat.rangeState, rng: combat.rng.getCounters(), log: combat.eventLog, queue: combat.queue }), before);
});
