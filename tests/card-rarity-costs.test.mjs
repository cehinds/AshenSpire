import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const reg = createRegistries(contentBundle);
const legacyReg = reg.legacyProgressionSource;
const rewardIds = new Set(contentBundle.legacyProgression.classes.flatMap(c => c.cardPool));

test('preserved legacy reward cards retain their pinned Mana rarity shares and one turn cost', () => {
  for (const [rarity, count, manaShare, exceptions] of [['common',62,0.15,5], ['uncommon',63,0.3,0], ['rare',49,0.5,0]]) {
    const cards = legacyReg.cards.all().filter(c => rewardIds.has(c.id) && c.rarity === rarity);
    assert.equal(cards.length, count);
    assert.equal(cards.filter(c => c.manaCost > 0).length, Math.round(count * manaShare) - exceptions);
    for (const c of cards) for (const upgraded of [false,true]) {
      const def = resolveCard(legacyReg, {cardId:c.id,upgraded});
      const cost = legacyReg.framework.costProfile(def);
      assert.equal(cost.stamina, def.cost === 'X' ? 0 : def.cost);
      assert.equal(def.staminaCost || 0, 0, 'no obsolete additive stamina charge');
      assert.ok(!def.manaCost || def.cost === 'X' || def.cost >= 1);
    }
  }
});

test('every expanded ability grade pays its authored Action cost and Mana equal to rank', () => {
  const families = reg.cards.all().filter(card => card.gradeProfiles);
  assert.equal(families.length, 82, 'forty new families and forty-two retuned existing abilities');
  for (const card of families) {
    assert.equal(card.gradeProfiles.length, 6, card.id);
    for (let rank = 0; rank <= 5; rank++) {
      const profile = card.gradeProfiles[rank];
      const def = resolveCard(reg, { cardId: card.id, abilityRank: rank });
      const cost = reg.framework.costProfile(def);
      assert.equal(profile.rank, rank, card.id);
      assert.equal(def.manaCost || 0, rank, `${card.id} grade ${rank}: printed Mana`);
      assert.equal(def.cost, profile.actionCost, `${card.id} grade ${rank}: authored Actions`);
      assert.ok(def.cost >= 1 && def.cost <= (rank === 0 ? 3 : rank));
      assert.equal(cost.stamina, def.cost, 'Actions and Stamina are the same resource');
      assert.equal(def.staminaCost || 0, 0, 'no additional Stamina charge');
    }
  }
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
  for (const cardId of ['serratedBlade', 'shieldBash', 'starstoneArc']) {
    for (const upgraded of [false, true]) {
      const c = fight(cardId, upgraded);
      const def = resolveCard(reg, { cardId, upgraded });
      play(c);
      assert.equal(c.player.energy, 3 - def.cost, `${cardId}: Actions`);
      assert.equal(c.player.stamina, 3 - def.cost, `${cardId}: stamina`);
      assert.equal(c.player.mana, 3 - (def.manaCost || 0), `${cardId}: mana`);
    }
  }
});

test('either missing dual resource refuses atomically before payment or card movement', () => {
  for (const upgraded of [false, true]) {
    for (const missing of ['mana', 'stamina']) {
      const c = fight('starstoneArc', upgraded);
      c.player[missing] = 0;
      const before = { energy: c.player.energy, stamina: c.player.stamina, mana: c.player.mana,
        hand: structuredClone(c.piles.hand), hp: c.enemies[0].hp };
      assert.throws(() => play(c), missing === 'mana' ? /Not enough mana/ : /Not enough Actions \(Stamina\)/);
      assert.deepEqual({ energy: c.player.energy, stamina: c.player.stamina, mana: c.player.mana,
        hand: c.piles.hand, hp: c.enemies[0].hp }, before);
    }
  }
});
