// Owner ruling 2026-11-18 section 21 (revised): each Pierce stack ignores 1 point of Block (pierce.blockIgnoredPerStack). What passes still routes
// Block, then Poise, then HP, with the Ward and Force rules. Stone Skin (gear branch) reduces the stack count at PierceStacks, the one place it is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight } from './elementFixture.mjs';
import * as Statuses from '../src/engine/statuses.js';
import { profileDamageReceipt, PierceStacks } from '../src/engine/gameProfileCombat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { fixCorePierceRules, validateFixCoreRules } from '../src/model/fixCoreMechanics.js';

const PIERCE = { combatProfile: { camp: 'physical', damageType: 'piercing', reach: 'contact' }, tags: ['camp:physical', 'pierce', 'damage:piercing'] };
const BLUNT = { combatProfile: { camp: 'physical', damageType: 'blunt', reach: 'contact' }, tags: ['camp:physical', 'damage:blunt'] };
const hit = (combat, target, carrier, base = 20) => profileDamageReceipt(combat, combat.player, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });

test('the Block a Pierce stack ignores is a config value: 1', () => {
  assert.equal(fixCoreMechanics.pierce.blockIgnoredPerStack, 1);
  assert.equal(fixCorePierceRules({}).blockIgnoredPerStack, 0, 'a fight saved without the key keeps the old fraction');
});

test('PierceStacks is the one place the stack count is read: 0 for a plain hit, 1 for Pierce, the carrier\'s own count otherwise', () => {
  const { combat, enemy } = fight({ enemies: 1 });
  assert.equal(PierceStacks(combat, enemy, BLUNT), 0);
  assert.equal(PierceStacks(combat, enemy, PIERCE), 1);
  assert.equal(PierceStacks(combat, enemy, { ...PIERCE, pierceStacks: 2 }), 2);
  assert.equal(PierceStacks(combat, enemy, { ...PIERCE, combatReaction: true }), 0, 'a reaction carries none');
});

test('Pierce 2 against 5 Block: 2 Block is ignored, the other 3 Block absorbs', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.persistentPoise = { value: 0, max: 0 };
  enemy.block = 5;
  const receipt = hit(combat, enemy, { ...PIERCE, pierceStacks: 2 });
  const incoming = receipt.damageReceipt.hits[0].incoming;
  assert.ok(incoming > 5);
  assert.equal(receipt.pierceBypassed, 2);
  assert.equal(receipt.blocked, 3, 'only 3 Block absorbs');
  assert.equal(receipt.hpLoss, incoming - 3);
  const plain = hit(combat, enemy, { ...PIERCE, pierceStacks: 1 });
  assert.equal(plain.blocked, 4, 'one stack ignores 1');
});

test('Pierce cannot ignore more Block than there is', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.persistentPoise = { value: 0, max: 0 };
  enemy.block = 1;
  const receipt = hit(combat, enemy, { ...PIERCE, pierceStacks: 3 });
  assert.equal(receipt.blocked, 0);
  assert.equal(receipt.pierceBypassed, 1);
});

test('stack Pierce leaves the whole post-Block hit on the ordinary Poise split', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 100 });
  enemy.block = 5;
  const receipt = hit(combat, enemy, { ...PIERCE, pierceStacks: 2 }, 40);
  assert.equal(receipt.damageReceipt.hits[0].incoming, 20);
  assert.equal(receipt.blocked, 3);
  assert.equal(receipt.blockRemaining, 0, 'Block spending stays the same as an unpierced hit');
  assert.equal(receipt.piercePoise, 0, 'Pierce adds no separate 1:1 Poise absorption');
  assert.equal(receipt.poiseMitigated, 5, 'the 17 post-Block damage uses the ordinary 25% split');
  assert.equal(receipt.hpLoss, 12);
});

test('stack Pierce leaves a Force hit on its half-Poise split after Block', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 100 });
  enemy.block = 5;
  const force = { combatProfile: { camp: 'spell', school: 'force', damageType: 'arcane' }, tags: ['school:force', 'pierce'], pierceStacks: 2 };
  const receipt = hit(combat, enemy, force, 40);
  assert.equal(receipt.damageReceipt.hits[0].incoming, 20);
  assert.equal(receipt.blocked, 3);
  assert.equal(receipt.blockRemaining, 0);
  assert.equal(receipt.piercePoise, 0);
  assert.equal(receipt.poiseMitigated, 9, 'Force absorbs half of the 17 remaining damage, keeping its existing rounding');
  assert.equal(receipt.hpLoss, 8);
});

test('a saved fight without stack Pierce retains the fraction bypass and separate 1:1 Poise absorption', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 100 });
  delete combat.fixCoreRules.pierce.blockIgnoredPerStack;
  enemy.block = 5;
  const receipt = hit(combat, enemy, { ...PIERCE, pierceStacks: 2 }, 40);
  assert.equal(receipt.damageReceipt.hits[0].incoming, 20);
  assert.equal(receipt.pierceBypassed, 4, 'legacy Pierce ignores 20% of the hit, rather than 2 Block');
  assert.equal(receipt.blocked, 1);
  assert.equal(receipt.blockRemaining, 0);
  assert.equal(receipt.piercePoise, 4);
  assert.equal(receipt.poiseMitigated, 8, '4 pierced damage meets Poise 1:1, then 15 uses the ordinary split');
  assert.equal(receipt.hpLoss, 11);
});

test('Pierce with Ward up: Block absorbs first minus Pierce, then Ward health buffer absorbs before Poise + HP', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.block = 5;
  Statuses.applyStatus(combat, enemy, 'ward', 1, enemy); // 5 Ward HP
  enemy.persistentPoise.value = 60;
  const receipt = hit(combat, enemy, { ...PIERCE, pierceStacks: 2 });
  const incoming = receipt.damageReceipt.hits[0].incoming;
  assert.equal(receipt.wardHpBuffer, true);
  assert.equal(receipt.blocked, 3, 'Block 5 less the 2 ignored');
  assert.equal(receipt.wardHpAbsorbed, 5, 'Ward absorbs 5 after Block');
  const afterWard = incoming - 3 - 5;
  assert.equal(receipt.poiseMitigated + receipt.hpLoss, afterWard, 'overflow past Ward splits into Poise + HP');
});

test('Pierce settings validate every new field and reject malformed saved combat rules', () => {
  for (const pierce of [null, [], { unknown: 1 }, { blockBypassFraction: -0.1 }, { blockBypassFraction: 1.1 },
    { blockIgnoredPerStack: -1 }, { blockIgnoredPerStack: 0.5 }, { blockIgnoredPerStack: '1' },
    { builtInElements: 'lightning' }, { builtInElements: [3] }, { builtInElements: [''] },
    { skinStatus: 2 }, { earthSource: {} }]) {
    assert.throws(() => validateFixCoreRules({ ...fixCoreMechanics, pierce }), /pierce/);
  }
  for (const pierce of [{}, { blockBypassFraction: 0.2 }, { blockIgnoredPerStack: 999999 },
    { builtInElements: [], skinStatus: null, earthSource: null }]) {
    assert.doesNotThrow(() => validateFixCoreRules({ ...fixCoreMechanics, pierce }));
  }
  const { combat } = fight();
  const snapshot = serializeCombatSnapshot(combat);
  snapshot.fixCoreRules.pierce.builtInElements = 'lightning';
  assert.throws(() => restoreCombatSnapshot({ registries: combat.registries, snapshot, rng: createRng(5), expectedGameProfile: combat.gameProfile }), /pierce/);
});
