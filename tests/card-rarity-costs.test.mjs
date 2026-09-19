import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const reg = createRegistries(contentBundle);
const rewardIds = new Set(contentBundle.classes.flatMap(c => c.cardPool));
const profile = c => [c.staminaCost || 0, c.manaCost || 0];

test('combat reward costs meet inclusive rounded rarity shares, including upgrades', () => {
  for (const [rarity, count, staminaShare, dualShare] of [
    ['common', 52, 0.3, 0.15], ['uncommon', 51, 0.5, 0.3], ['rare', 41, 0.7, 0.5],
  ]) {
    const cards = reg.cards.all().filter(c => rewardIds.has(c.id) && c.rarity === rarity);
    assert.equal(cards.length, count, `${rarity}: distinct combat-reward denominator`);
    assert.equal(cards.filter(c => c.staminaCost > 0).length, Math.round(count * staminaShare));
    assert.equal(cards.filter(c => c.manaCost > 0).length, Math.round(count * dualShare));
    for (const c of cards) {
      assert.ok(!c.manaCost || c.staminaCost, `${c.id}: dual costs include stamina`);
      // 0–2: a signature art costs 2 stamina beside its Mana (plan phase 8).
      assert.ok(profile(c).every(n => n >= 0 && n <= 2), `${c.id}: authored small resource costs`);
      assert.deepEqual(profile(resolveCard(reg, { cardId: c.id, upgraded: true })), profile(c), `${c.id}: upgrade preserves profile`);
    }
    const weaponAttacks = cards.filter(c => c.type === 'attack' && c.tags.includes('source:weapon'));
    assert.ok(weaponAttacks.filter(c => profile(c).every(n => n === 0)).length > weaponAttacks.length / 2,
      `${rarity}: most weapon attacks remain Actions-only`);
  }
});

test('weapon basics, merchant-only cards and starter exceptions retain their costs', () => {
  for (const id of ['strike', 'honedEdge', 'fieldDressing', 'masterOfStrategy', 'rondelParry', 'starSpark']) {
    assert.deepEqual(profile(reg.cards.get(id)), [0, 0], id);
  }
  assert.deepEqual(profile(reg.cards.get('katanaDrawCut')), [1, 0]);
  assert.deepEqual(profile(reg.cards.get('greatswordSunderingHew')), [1, 0]);
  assert.deepEqual(profile(reg.cards.get('starstonePebble')), [2, 1], 'a signature art: 2 stamina beside its Mana (plan phase 8)');
  assert.deepEqual(profile(reg.cards.get('dodgeRoll')), [1, 0]);
});

function fight(cardId, upgraded = false) {
  const c = createCombat({ registries: reg, rng: createRng(13), enemyIds: [contentBundle.enemies[0].id],
    player: { classId: 'starseer', hp: 80, maxHp: 80, mana: 3, maxMana: 3, stamina: 3, maxStamina: 3,
      energyMax: 9, drawPerTurn: 1, relicIds: [], flasks: [],
      deck: [{ instanceId: 'cost-probe', cardId, upgraded }] } });
  c.player.energy = 9;
  c.player.mana = 3;
  c.player.stamina = 3;
  return c;
}
const play = c => dispatch(c, { type: 'playCard', cardInstanceId: 'cost-probe', targetId: c.enemies[0].id });

test('real plays pay all authored pools at base and upgraded levels', () => {
  for (const cardId of ['serratedBlade', 'shieldBash', 'cometFragment']) {
    for (const upgraded of [false, true]) {
      const c = fight(cardId, upgraded);
      const def = resolveCard(reg, { cardId, upgraded });
      play(c);
      assert.equal(c.player.energy, 9 - def.cost, `${cardId}: Actions`);
      assert.equal(c.player.stamina, 3 - (def.staminaCost || 0), `${cardId}: stamina`);
      assert.equal(c.player.mana, 3 - (def.manaCost || 0), `${cardId}: mana`);
    }
  }
});

test('either missing dual resource refuses atomically before payment or card movement', () => {
  for (const upgraded of [false, true]) {
    for (const missing of ['mana', 'stamina']) {
      const c = fight('cometFragment', upgraded);
      c.player[missing] = 0;
      const before = { energy: c.player.energy, stamina: c.player.stamina, mana: c.player.mana,
        hand: structuredClone(c.piles.hand), hp: c.enemies[0].hp };
      assert.throws(() => play(c), new RegExp(`Not enough ${missing}`));
      assert.deepEqual({ energy: c.player.energy, stamina: c.player.stamina, mana: c.player.mana,
        hand: c.piles.hand, hp: c.enemies[0].hp }, before);
    }
  }
});
