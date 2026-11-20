// A filled enemy Poise bar still applies Staggered (balance.poise.onFill),
// outside Core 2's FixCore riders (SPEC §4.4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { dealPoiseDamage } from '../src/engine/actions.js';
import { createRng } from '../src/engine/rng.js';

const registries = createRegistries(contentBundle);

function fight() {
  return createCombat({ registries, rng: createRng(50), enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', maxHp: 1000, hp: 1000, maxMana: 99, mana: 99, energyMax: 10, drawPerTurn: 5,
      attributes: { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 },
      deck: ['strike', 'executioner'].map((cardId, i) => ({ instanceId: 'c' + i, cardId })), relicIds: [] } });
}
const queuedStaggered = (c) => c.queue.filter((a) => a.effect?.op === 'applyStatus' && a.effect.status === 'staggered').length;

test('a filled Poise bar applies Staggered', () => {
  const c = fight();
  const enemy = c.enemies[0];
  enemy.poiseMeter = { value: 0, max: 1, growths: 0 };
  dealPoiseDamage(c, enemy, 1);
  assert.ok(enemy.skipNextTurn);
  assert.equal(queuedStaggered(c), 1);
});
