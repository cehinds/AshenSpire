import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArmouryLayout } from '../src/model/armouryLayout.js';
import { contentBundle } from '../src/content/index.js';

test('compact armaments share authored and engine default sizing', () => {
  const defaults = normalizeArmouryLayout({});
  const authored = normalizeArmouryLayout(contentBundle.equipment.armouryUi.layout);
  assert.deepEqual(authored.equipment.compactList, defaults.equipment.compactList);
  assert.deepEqual(authored.cardClasses.armamentItem, { holdAction: false, comparisonPresentation: 'inline' });
  assert.equal(authored.cardClasses.inventoryItem.holdAction, true, 'other inventory classes retain their capability');
});

test('compact thumbnail sizing is configurable without changing card inspection', () => {
  const layout = normalizeArmouryLayout({ equipment: { compactList: { thumbnailWidthPx: 90, phoneThumbnailWidthPx: 72 } } });
  assert.equal(layout.equipment.compactList.thumbnailWidthPx, 90);
  assert.equal(layout.equipment.compactList.phoneThumbnailWidthPx, 72);
  assert.equal(layout.equipment.compactList.inspectionWidthPx, normalizeArmouryLayout({}).equipment.compactList.inspectionWidthPx);
});

test('invalid compact dimensions are rejected by the layout boundary', () => {
  for (const key of ['thumbnailWidthPx', 'phoneThumbnailWidthPx', 'inspectionWidthPx']) {
    for (const value of [0, -1, 'invalid']) {
      assert.throws(() => normalizeArmouryLayout({ equipment: { compactList: { [key]: value } } }), new RegExp(key));
    }
  }
});

test('armament disclosure cannot acquire an equip hold or hide comparison in a hold tooltip', () => {
  assert.throws(() => normalizeArmouryLayout({ cardClasses: { armamentItem: { holdAction: true } } }), /read-only disclosure/);
  assert.throws(() => normalizeArmouryLayout({ cardClasses: { armamentItem: { comparisonPresentation: 'tooltip' } } }), /inline comparison/);
});
