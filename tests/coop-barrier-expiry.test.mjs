import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, endTurn } from '../src/engine/coopCombat.js';

const registries = createRegistries({ ...contentBundle });

// The co-op fixture shape used by coop-ashen-blight.test.mjs: two expanded seats, one enemy.
function player(id, cardId = 'strike') {
  return { id, classId: 'herald', combatExpansionVersion: 2, maxHp: 80, hp: 70,
    maxStamina: 30, stamina: 30, energyMax: 30, maxMana: 30, mana: 30, drawPerTurn: 3,
    attributes: { strength: 4, dexterity: 4, constitution: 4, intelligence: 4, wisdom: 4 },
    relicIds: [], orderedDraw: true, deck: [{ instanceId: `${id}-native`, cardId },
      ...Array.from({ length: 5 }, (_, index) => ({ instanceId: `${id}-${index}`, cardId: 'strike' }))] };
}

test("co-op Barrier expires at its seat's turn start and at each enemy's owner turn start", () => {
  const combat = createCoopCombat({ registries, rng: createRng(123), players: [player('a'), player('b', 'defend')],
    enemyIds: ['wanderingSoldier'], ratingsRules: null, combatKey: 'run:barrier-expiry', combatExpansionVersion: 2 });
  const seat = combat.players.get('a').entity;
  seat.barrier = 5;
  endTurn(combat, 'a');
  endTurn(combat, 'b');
  assert.equal(combat.phase, 'player', 'the next player phase has started');
  assert.equal(seat.barrier, 0, "the seat's Barrier expired at its own turn start");
  const enemy = combat.enemies[0];
  enemy.barrier = 7;
  endTurn(combat, 'a');
  endTurn(combat, 'b');
  assert.ok(enemy.barrier < 7, "the enemy's Barrier expired at its owner turn start");
});
