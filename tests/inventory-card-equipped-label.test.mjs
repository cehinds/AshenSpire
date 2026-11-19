// An inventory card reads plain "Equipped" (not "Equipped: Equipped") through the real
// inventoryItemCardModel -> renderInventoryItemCard path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { renderInventoryItemCard } from '../src/ui/components/armouryComponents.js';
import { inventoryItemCardModel } from '../src/ui/models/ArmouryModels.js';

const base = { key: 'axe', id: 'axe', name: 'Axe', category: 'Weapon', count: 1, item: { name: 'Axe' } };

test('plainly equipped row renders "Equipped", not "Equipped: Equipped"', () => withKitDom(() => {
  const row = { ...base, equippedLabels: ['Equipped'], equippedPlain: true };
  const model = inventoryItemCardModel(row);
  assert.equal(model.properties.equippedPlain, true);
  const text = renderInventoryItemCard(model).outerHTML;
  assert.ok(!text.includes('Equipped: Equipped'), text);
  assert.match(text, /Equipped/);
}));

test('positional equipped labels keep the "Equipped: ..." form', () => withKitDom(() => {
  const row = { ...base, equippedLabels: ['Right hand'], equippedPlain: false };
  assert.match(renderInventoryItemCard(inventoryItemCardModel(row)).outerHTML, /Equipped: Right hand/);
}));
