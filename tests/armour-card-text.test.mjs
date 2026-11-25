import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { equipmentCardModel, GearEffectText } from '../src/model/equipmentCard.js';

const profile = resolveGameAuthor(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))), loadGameProfileCatalog());
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const body = (classId, id) => equipmentCardModel(reg, reg.equipment.armour.find(p => p.classId === classId && p.id === id)).bonuses.map(b => b.label);

test('armour with attribute grants states the rating and spells out each attribute', () => {
  assert.equal(GearEffectText(reg, { poise: 3, dexterity: 1, constitution: 1 }, { poise: 'Poise' }, 'Flavour.').text, '3 Poise. Gain 1 Dexterity and 1 Constitution.');
  // Common/uncommon armour carry 0 free flat attributes under the tightened attribute budget.
  assert.deepEqual(body('reaver', 'vigil'), [
    '3 Poise.',
    '+1 Poise', 'Block cards: +1 Block',
  ]);
  assert.deepEqual(body('reaver', 'wayfarerPlate'), [
    '6 Poise.',
    '+2 Poise', '-1 DEX',
  ]);
});

test('armour with only a Poise value says just that', () => {
  assert.equal(GearEffectText(reg, { poise: 3 }, { poise: 'Poise' }, 'Flavour.').text, '3 Poise.');
});

test('armour with no concrete effect shows its authored flavour, never rank or points', () => {
  assert.equal(GearEffectText(reg, { poise: 0, dexterity: 0 }, {}, 'Plain cloth, plainly kept.').text, 'Plain cloth, plainly kept.');
  for (const piece of reg.equipment.armour) {
    for (const label of equipmentCardModel(reg, piece).bonuses.map(b => b.label)) assert.doesNotMatch(label, /points|Rank \d/);
  }
});
