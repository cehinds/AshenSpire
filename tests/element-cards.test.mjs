// The Rebalance element cards: each one plays in an expanded run and puts its
// stated status where the card says it goes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { applyStatus, getStacks } from '../src/engine/statuses.js';

const registries = createRegistries(contentBundle);

// Poison cards belong to the Rogue; Psychic and Earth belong to no class (owner #13).
const ROGUE = ['aspDart', 'viperStrike', 'septicBlade', 'lethalDose'];
const CLASSLESS = [];

function play(cardId, { upgraded = false, enemyId = 'wanderingSoldier', setup } = {}) {
  const classId = ROGUE.includes(cardId) ? 'rogue' : 'reaver';
  const combat = createCombat({ registries, rng: createRng(4107), combatExpansionVersion: 2, enemyIds: [enemyId],
    player: { classId, maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId, instanceId: 'p', upgraded }, { cardId: 'strike', instanceId: 'filler', upgraded: false }] } });
  const enemy = combat.enemies[0];
  enemy.block = enemy.barrier = 0;
  if (setup) setup(combat, enemy);
  const hp = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'p', targetId: enemy.id });
  const landed = id => out.events.some(event => ['statusApplied', 'statusPressure'].includes(event.type) && event.status === id
    && (event.targetId === undefined || event.targetId === enemy.id));
  return { combat, enemy, out, hp, landed };
}

test('the element cards exist with a face, a flavor, an icon and an upgrade', () => {
  for (const id of [...ROGUE, ...CLASSLESS]) {
    const card = contentBundle.cards.find(row => row.id === id);
    assert(card, id);
    assert(card.flavor && card.icon && card.textTemplate && card.upgrade, `${id} is fully authored`);
    assert.equal(card.class, ROGUE.includes(id) ? 'rogue' : 'colorless', id);
  }
  const pool = contentBundle.classes.find(cls => cls.id === 'rogue').cardPool;
  for (const id of ROGUE) assert(pool.includes(id), `${id} is in the Rogue pool`);
});

test('the Poison attacks put Venom on the target', () => {
  for (const id of ['aspDart', 'viperStrike', 'septicBlade']) {
    const { enemy, hp, landed } = play(id);
    assert(enemy.hp < hp, `${id} deals damage`);
    assert(landed('venom'), `${id} applies Venom`);
  }
});

test('Septic Blade hits harder on a target already carrying 3 Venom', () => {
  const cold = play('septicBlade');
  const primed = play('septicBlade', { setup: (combat, enemy) => applyStatus(combat, enemy, 'venom', 3) });
  assert(primed.hp - primed.enemy.hp > cold.hp - cold.enemy.hp);
});

test('Lethal Dose cashes the target\'s Venom out as damage and removes it', () => {
  const { enemy, hp } = play('lethalDose', { setup: (combat, target) => applyStatus(combat, target, 'venom', 3) });
  assert.equal(hp - enemy.hp, 12, '4 damage per Venom stack (v2 caps Venom at 3)');
  assert.equal(getStacks(enemy, 'venom'), 0);
});

test('upgraded faces play too', () => {
  for (const id of [...ROGUE, ...CLASSLESS]) {
    assert.doesNotThrow(() => play(id, { upgraded: true }), id);
  }
});
