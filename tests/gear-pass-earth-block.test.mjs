import test from 'node:test';
import assert from 'node:assert/strict';
import { fight } from './elementFixture.mjs';
import { gainBlock, applyAttackDamage } from '../src/engine/actions.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { damagePreviewState, previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';

const earth = { tags: ['school:earth'] };
const plain = { tags: ['camp:physical', 'classification.attack'], combatProfile: { camp: 'physical', damageType: 'blunt' }, skipRatingBonus: true };
const lightning = { tags: ['camp:spell', 'school:lightning', 'classification.attack'], combatProfile: { camp: 'spell', school: 'lightning' }, skipRatingBonus: true };

function world() {
  const state = fight({ enemies: 1, poise: 0 });
  // No Block stat bonus: these grants are exactly their authored amounts.
  state.enemy.attributes.dexterity = 0;
  state.enemy.ratings = { ...state.enemy.ratings, dr: 0 };
  // An explicit empty list preserves this arithmetic fixture across restore's historical weakness backfill.
  state.enemy.weaknesses = [];
  delete state.enemy.barrier; // Retired legacy field: current snapshots restore without it.
  return state;
}
const quote = (combat, enemy, carrier, base = 10) => profileDamageReceipt(combat, combat.player, enemy, base, carrier, { roll: 0 });
const hit = (combat, enemy, carrier, base = 10) => applyAttackDamage(combat, combat.player, enemy, base, carrier.tags, carrier);

test('consumed Earth Block does not protect a later ordinary Block grant from Lightning Pierce', () => {
  const { combat, enemy } = world();
  assert.equal(gainBlock(combat, enemy, 5, earth), 5);
  assert.equal(enemy.earthBlock, 5);
  hit(combat, enemy, plain);
  assert.equal(enemy.block, 0);
  assert.equal(gainBlock(combat, enemy, 5), 5);
  const receipt = quote(combat, enemy, lightning);
  assert.equal(receipt.pierceBypassed, 1, 'the new ordinary 5 Block has no Earth provenance');
  assert.equal(enemy.earthBlock, 0);
  const hp = enemy.hp;
  hit(combat, enemy, lightning);
  assert.equal(hp - enemy.hp, receipt.hpLoss);
});

test('partial consumption retains only the Earth Block still held before ordinary Block is added', () => {
  const { combat, enemy } = world();
  gainBlock(combat, enemy, 5, earth);
  hit(combat, enemy, plain, 6); // Core halves the base: 3 Block spent.
  assert.equal(enemy.block, 2);
  assert.equal(gainBlock(combat, enemy, 1), 1);
  const receipt = quote(combat, enemy, lightning);
  assert.equal(receipt.pierceBypassed, 1, '2 Earth + 1 ordinary Block allows the built-in Pierce');
  assert.equal(enemy.earthBlock, 2);
  assert.equal(receipt.damageReceipt.hits[0].incoming, 6, 'the matching Prepared stance keeps its existing spell multiplier');
  assert.equal(receipt.hpLoss, 4);
  const hp = enemy.hp;
  hit(combat, enemy, lightning);
  assert.equal(hp - enemy.hp, receipt.hpLoss);
  assert.equal(enemy.earthBlock, 0);
});

test('mixed Earth and ordinary Block stays bounded across repeated pure multi-hit previews and live hits', () => {
  const { combat, enemy } = world();
  gainBlock(combat, enemy, 5, earth);
  gainBlock(combat, enemy, 5);
  const before = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
  const state = damagePreviewState(combat, enemy);
  const first = previewDamageHits(combat, combat.player, enemy, 6, plain.tags, plain, 3, state);
  assert.deepEqual(previewDamageHits(combat, combat.player, enemy, 6, plain.tags, plain, 3), first);
  assert.deepEqual(serializeCombatSnapshot(combat), before, 'quotes leave live defenses and provenance untouched');
  assert.deepEqual(combat.rng.getCounters(), counters);
  for (let i = 0; i < 3; i++) hit(combat, enemy, plain, 6);
  assert.equal(enemy.block, 1);
  assert.equal(state.defender.earthBlock, 1, 'detached provenance follows the same remaining-Block pool');
  assert.equal(enemy.earthBlock, state.defender.earthBlock);
  gainBlock(combat, enemy, 4);
  const secondBefore = serializeCombatSnapshot(combat);
  const second = previewDamageHits(combat, combat.player, enemy, 6, lightning.tags, lightning, 3);
  assert.deepEqual(previewDamageHits(combat, combat.player, enemy, 6, lightning.tags, lightning, 3), second);
  assert.deepEqual(serializeCombatSnapshot(combat), secondBefore);
  const hp = enemy.hp;
  for (let i = 0; i < 3; i++) hit(combat, enemy, lightning, 6);
  assert.equal(hp - enemy.hp, second.hpLoss);
  assert.equal(enemy.earthBlock, 0);
});

test('Earth provenance does not cancel explicit or gear Pierce', () => {
  for (const carrier of [
    { ...plain, tags: [...plain.tags, 'pierce'], pierceStacks: 2 },
    { ...plain, gear: { pierce: 2 } },
  ]) {
    const { combat, enemy } = world();
    gainBlock(combat, enemy, 5, earth);
    const receipt = quote(combat, enemy, carrier);
    assert.equal(receipt.pierceBypassed, 2);
    const hp = enemy.hp;
    hit(combat, enemy, carrier);
    assert.equal(hp - enemy.hp, receipt.hpLoss);
  }
});

test('consuming ordinary Block never adds an Earth provenance field to live or previewed entities', () => {
  const { combat, enemy } = world();
  gainBlock(combat, enemy, 5);
  assert.equal(Object.hasOwn(enemy, 'earthBlock'), false);
  const state = damagePreviewState(combat, enemy);
  previewDamageHits(combat, combat.player, enemy, 6, plain.tags, plain, 1, state);
  hit(combat, enemy, plain, 6);
  assert.equal(Object.hasOwn(enemy, 'earthBlock'), false);
  assert.equal(Object.hasOwn(state.defender, 'earthBlock'), false);
});

for (const [base, remaining, ordinary] of [[6, 2, 1], [10, 0, 5]]) {
  test(`save/restore retains ${remaining} Earth Block after consumption and preserves the next Lightning hit`, () => {
    const { combat, enemy } = world();
    gainBlock(combat, enemy, 5, earth);
    hit(combat, enemy, plain, base);
    const snapshot = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
    const restored = restoreCombatSnapshot({ registries: combat.registries, snapshot, rng: createRng(combat.rng.seed, counters), expectedGameProfile: combat.gameProfile });
    assert.equal(restored.enemies[0].earthBlock, remaining);
    for (const ctx of [combat, restored]) gainBlock(ctx, ctx.enemies[0], ordinary);
    assert.deepEqual(quote(restored, restored.enemies[0], lightning), quote(combat, enemy, lightning));
    assert.equal(quote(restored, restored.enemies[0], lightning).pierceBypassed, 1);
    hit(combat, enemy, lightning);
    hit(restored, restored.enemies[0], lightning);
    assert.deepEqual(serializeCombatSnapshot(restored), serializeCombatSnapshot(combat));
  });
}
