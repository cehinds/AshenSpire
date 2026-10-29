// Card upgrades 10: co-op combat carries upgradeSteps the way solo combat does, so it cannot play a different card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';

const STEPS = [{ k: 'authored' }, { k: 'dmg', n: 3 }];

test('co-op combat start copies upgradeSteps onto each player\'s cards (fresh copies)', () => {
  const registries = createRegistries(contentBundle);
  const deck = (steps, id) => Array.from({ length: 12 }, (_, i) => ({ instanceId: `${id}${i}`, cardId: 'strike', upgraded: !!steps && i === 0, ...(steps && i === 0 ? { upgradeSteps: steps } : {}) }));
  const player = (id, steps) => ({ id, classId: 'reaver', maxHp: 80, hp: 80, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 5, relicIds: [], deck: deck(steps, id) });
  const combat = createCoopCombat({ registries, rng: createRng(9), players: [player('a', STEPS), player('b', null)], enemyIds: ['wanderingSoldier'] });
  const cards = [...combat.players.values()].map((seat) => seat.piles).flatMap((piles) => Object.values(piles).flat());
  const found = cards.filter((c) => c.instanceId === 'a0' && c.upgradeSteps);
  assert.ok(found.length >= 1, 'the stored steps reached the co-op card');
  assert.deepEqual(found[0].upgradeSteps, STEPS);
  assert.notEqual(found[0].upgradeSteps, STEPS);
  assert.ok(cards.filter((c) => c.upgradeSteps).every((c) => c.upgraded === true));
});
