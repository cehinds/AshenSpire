// The twelve Rebalance element cards (poison, psychic, earth): each one plays in
// an expanded run and puts its stated status where the card says it goes.
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
const SELF = ['stoneskin'];
const CLASSLESS = ['mindSpike', 'dissonance', 'mindFracture', 'wakingNightmare', 'stoneSling', 'rockfall', 'stoneskin', 'entomb'];

function play(cardId, { upgraded = false, enemyId = 'wanderingSoldier', setup, seed = 4107 } = {}) {
  const classId = ROGUE.includes(cardId) ? 'rogue' : 'reaver';
  const combat = createCombat({ registries, rng: createRng(seed), combatExpansionVersion: 2, enemyIds: [enemyId],
    player: { classId, maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId, instanceId: 'p', upgraded }] } });
  const enemy = combat.enemies[0];
  enemy.block = enemy.barrier = 0;
  if (setup) setup(combat, enemy);
  const hp = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'p', ...(SELF.includes(cardId) ? {} : { targetId: enemy.id }) });
  const landed = id => out.events.some(event => ['statusApplied', 'statusPressure'].includes(event.type) && event.status === id
    && (event.targetId === undefined || event.targetId === enemy.id));
  return { combat, enemy, out, hp, landed };
}

test('the twelve cards exist with a face, a flavor, an icon and an upgrade', () => {
  for (const id of [...ROGUE, ...CLASSLESS]) {
    const card = contentBundle.cards.find(row => row.id === id);
    assert(card, id);
    assert(card.flavor && card.icon && card.textTemplate && card.upgrade, `${id} is fully authored`);
    assert.equal(card.class, ROGUE.includes(id) ? 'rogue' : 'colorless', id);
  }
  const pool = contentBundle.classes.find(cls => cls.id === 'rogue').cardPool;
  for (const id of ROGUE) assert(pool.includes(id), `${id} is in the Rogue pool`);
});

test('Psychic and Earth cards are in no class pool', () => {
  for (const cls of contentBundle.classes) for (const id of CLASSLESS) assert(!cls.cardPool.includes(id), `${cls.id} / ${id}`);
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
  assert.equal(hp - enemy.hp, 18, '6 + 4 per Venom stack, v2 caps Venom at 3');
  assert.equal(getStacks(enemy, 'venom'), 0);
});

test('Lethal Dose upgraded deals 8 + 5 per Venom stack', () => {
  // 23 damage would kill the default soldier before Venom is removed, so give the target room to survive the hit.
  const { enemy, hp } = play('lethalDose', { upgraded: true, setup: (combat, target) => { target.hp = 100; applyStatus(combat, target, 'venom', 3); } });
  assert.equal(hp - enemy.hp, 23, '8 + 5 x 3 Venom');
  assert.equal(getStacks(enemy, 'venom'), 0);
});

test('Lethal Dose with no Venom still deals its 6 base damage', () => {
  const { enemy, hp } = play('lethalDose');
  assert.equal(hp - enemy.hp, 6, 'base 6 with 0 Venom');
});

test('Psychic cards confuse; Dissonance also silences', () => {
  for (const id of ['mindSpike', 'dissonance', 'mindFracture', 'wakingNightmare']) {
    const { landed } = play(id);
    assert(landed('confused'), `${id} applies Confused`);
  }
  assert(play('dissonance').landed('silenced'), 'Dissonance applies Silenced');
  const sleeps = [1, 2, 3, 4, 5, 6, 7, 8].filter(seed => play('wakingNightmare', { seed }).landed('sleep')).length;
  assert(sleeps > 0 && sleeps < 8, `Waking Nightmare builds Sleep up on a coin flip (${sleeps}/8)`);
});

test('Earth attacks slow; Entomb entombs', () => {
  for (const id of ['stoneSling', 'rockfall']) {
    const { enemy, hp, landed } = play(id);
    assert(enemy.hp < hp, `${id} deals damage`);
    assert(landed('slowed'), `${id} applies Slowed`);
  }
  const entomb = play('entomb');
  assert(entomb.landed('entombed'));
  assert.equal(getStacks(entomb.enemy, 'entombed'), 1);
});

test('Stoneskin gives Block that survives the next turn start', () => {
  const { combat } = play('stoneskin');
  assert(getStacks(combat.player, 'stoneskin') >= 1);
  const block = combat.player.block;
  assert(block >= 6);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.player.block >= block, true, 'Block was kept into the next turn');
});

test('upgraded faces play too', () => {
  for (const id of [...ROGUE, ...CLASSLESS]) {
    assert.doesNotThrow(() => play(id, { upgraded: true }), id);
  }
});
