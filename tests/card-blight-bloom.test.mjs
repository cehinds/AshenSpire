import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, getEntity } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import * as S from '../src/engine/statuses.js';

const REG = createRegistries(contentBundle);

function combatWith(deck, enemies = ['huskBrute'], upgraded = false) {
  return createCombat({
    registries: REG, rng: createRng(0xc0ffee),
    player: { classId: 'reaver', maxHp: 78, hp: 78, mana: 2, maxMana: 2, stamina: 3, maxStamina: 3, energyMax: 3, drawPerTurn: 5,
      deck: deck.map((cardId, i) => ({ instanceId: `c${i + 1}`, cardId, upgraded })), relicIds: [] },
    enemyIds: enemies,
  });
}

function playBloom(combat) {
  const inst = combat.piles.hand.find(c => c.cardId === 'blightBloom');
  return dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId, targetId: 'e1' });
}

test('Blight Bloom doubles a necrotic-only target Necrotic Blight and leaves Crimson at zero', () => {
  const c = combatWith(['blightBloom']);
  const e1 = getEntity(c, 'e1');
  S.applyStatus(c, e1, 'necroticBlight', 3);
  playBloom(c);
  assert.equal(S.getStacks(e1, 'necroticBlight'), 6);
  assert.equal(S.getStacks(e1, 'crimsonBlight'), 0);
});

test('Blight Bloom doubles a crimson-only target Crimson Blight and leaves Necrotic at zero', () => {
  const c = combatWith(['blightBloom']);
  const e1 = getEntity(c, 'e1');
  S.applyStatus(c, e1, 'crimsonBlight', 2);
  playBloom(c);
  assert.equal(S.getStacks(e1, 'crimsonBlight'), 4);
  assert.equal(S.getStacks(e1, 'necroticBlight'), 0);
});

test('Blight Bloom upgraded doubles both Blights on a target carrying both', () => {
  const c = combatWith(['blightBloom'], ['huskBrute'], true);
  const e1 = getEntity(c, 'e1');
  S.applyStatus(c, e1, 'crimsonBlight', 1);
  S.applyStatus(c, e1, 'necroticBlight', 2);
  playBloom(c);
  assert.equal(S.getStacks(e1, 'crimsonBlight'), 2);
  assert.equal(S.getStacks(e1, 'necroticBlight'), 4);
});
