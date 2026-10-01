import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, endTurn } from '../src/engine/coopCombat.js';

const registries = createRegistries(contentBundle);
const seat = (id) => ({
  id, classId: 'reaver', maxHp: 100, hp: 100,
  mana: 2, maxMana: 2, stamina: 0, maxStamina: 0,
  energyMax: 3, drawPerTurn: 5, relicIds: [], flasks: [],
  deck: Array.from({ length: 20 }, (_, i) => ({ instanceId: `${id}:strike:${i}`, cardId: 'strike', upgraded: false })),
});

for (const [enemyId, moveId, cardId] of [
  ['huskBrute', 'bellow', 'slimed'],
  ['courtSurgeon', 'scalpel', 'wound'],
]) {
  test(`${enemyId}'s ${moveId} injects one ${cardId} into each living co-op seat`, () => {
    const combat = createCoopCombat({ registries, rng: createRng(21), enemyIds: [enemyId], players: [seat('p1'), seat('p2')] });
    // Select the real authored move, independent of the AI's random roll.
    combat.enemies[0].intent = { moveId };
    endTurn(combat, 'p1');
    endTurn(combat, 'p2');
    assert.ok(combat.eventLog.some((event) => event.type === 'enemyMoveStarted' && event.enemyId === enemyId && event.moveId === moveId), 'the production enemy phase executed the authored action');
    for (const id of ['p1', 'p2']) {
      const player = combat.players.get(id);
      assert.equal(player.entity.alive, true);
      const cards = Object.values(player.piles).flat().filter((card) => card.cardId === cardId);
      assert.equal(cards.length, 1, `${id} receives exactly one ${cardId}`);
      assert.equal(player.piles.discard.filter((card) => card.cardId === cardId).length, 1, 'the new card stays in the authored discard pile');
    }
  });
}
