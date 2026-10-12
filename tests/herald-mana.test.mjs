import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { rollSkillDraftIds } from '../src/engine/encounters.js';

const reg = createRegistries(contentBundle);
function fight({ upgraded = false, hp = 60, mana = 0 } = {}) {
  return createCombat({ registries: reg, rng: createRng(13), enemyIds: [contentBundle.enemies[0].id],
    player: { classId: 'herald', hp, maxHp: 70, mana, maxMana: 3, stamina: 3, maxStamina: 3,
      energyMax: 3, drawPerTurn: 1, relicIds: [], flasks: [],
      deck: [{ instanceId: 'communion', cardId: 'emberCommunion', upgraded }] } });
}
const play = c => dispatch(c, { type: 'playCard', cardInstanceId: 'communion' });

// Under the cost formula (SPEC §4.3a) Ember Communion is a 1 SP + 1 MP spell: its school and spell camp price 1 Mana, so
// the Mana it restores pays its own Mana back and a dry Herald (0 Mana) cannot cast it. Replaced rule: a 1-SP card with no
// Mana (then the stance table's 2-SP cast). The owner has the open question of whether restored Mana should offset it.
test('a Herald with 1 Mana pays 1 SP + 1 MP, gets the Mana back with healing, then exhausts the base card', () => {
  const c = fight({ mana: 1 }); const before = c.player.stamina;
  play(c);
  assert.equal(c.player.mana, 1);
  assert.equal(c.player.hp, 62);
  assert.equal(c.player.stamina, before - 1);
  assert.equal(c.piles.exhaust.length, 1);
  assert.equal(c.piles.discard.length, 0);
});

test('a dry Herald cannot cast it: the formula prices it at 1 Mana', () => {
  assert.throws(() => play(fight()), /Not enough mana/);
});

test('the upgrade removes Exhaust without changing either recovery amount or cost', () => {
  const c = fight({ upgraded: true, mana: 1 });
  play(c);
  assert.equal(c.player.mana, 1); assert.equal(c.player.hp, 62);
  assert.equal(c.piles.exhaust.length, 0); assert.equal(c.piles.discard.length, 1);
  const def = resolveCard(reg, { cardId: 'emberCommunion', upgraded: true });
  assert.equal(def.cost, 1); assert.equal(def.manaCost, 1);
});

test('recovery respects the Mana and HP caps', () => {
  const c = fight({ hp: 69, mana: 3 }); play(c);
  assert.equal(c.player.hp, 70); assert.equal(c.player.mana, 3);
});

test('the card reaches Herald rewards and ritual drafts; Lodestar Shard remains the Starseer kit relic', () => {
  assert.ok(reg.classes.get('herald').cardPool.includes('emberCommunion'));
  assert.equal(reg.cards.get('emberCommunion').rarity, 'common');
  assert.ok(reg.cards.get('emberCommunion').tags.includes('ritual'));
  const offers = Array.from({ length: 64 }, (_, seed) => rollSkillDraftIds(reg, createRng(seed), {
    classId: 'herald', skillId: 'item:magic-focus', schools: ['ritual'], level: 1,
  }));
  assert.ok(offers.every(ids => ids.length === reg.balance.skill.draftSize));
  assert.ok(offers.some(ids => ids.includes('emberCommunion')), 'a seeded Ritual draft actually offers the card');
  assert.equal(reg.classes.get('starseer').kitRelic, 'lodestarShard');
});
