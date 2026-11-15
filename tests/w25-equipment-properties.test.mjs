// W25-R: the Armoury lists an item's properties (name and one-line effect), rank and upgrade count: chips on the tile, a section in the detail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEM_PROPERTIES } from '../src/content/itemProperties.js';
import { ItemPropertyLines, ArmouryItemRef } from '../src/model/itemPropertyLines.js';
import { ItemPropertyChips, ItemPropertyDetail, ItemPropertyCounts } from '../src/ui/components/itemProperties.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const REF = 'armament/greatsword';
const runWith = (extra = {}) => ({
  class: 'reaver',
  itemUpgradePicks: { [REF]: [{ id: 'prop:edgeFire', k: 'prop', prop: 'edgeFire' }, { id: 'ar', k: 'stat', stat: 'ar', n: 1 }] },
  itemProps: { [REF]: ['bleedingEdge', 'handSize1', 'startBlock2'] },
  itemRanks: { [REF]: 2 },
  ...extra,
});
const walk = (node, out = []) => { out.push(node); for (const child of node.children || []) walk(child, out); return out; };
const isChip = (n) => /(^| )item-prop-chip( |$)/.test(n.className || '');
const text = (node) => walk(node).map((n) => n.textContent ?? '').join(' ');

test('every property of the data has a name and a one-line effect', () => {
  for (const row of ITEM_PROPERTIES) {
    assert.ok(row.name && row.name.length <= 24, `${row.id} name`);
    assert.ok(row.text && row.text.length <= 70, `${row.id} text`);
  }
  assert.equal(new Set(ITEM_PROPERTIES.map((row) => row.name)).size, ITEM_PROPERTIES.length, 'names are distinct');
});

test('the lines carry every property the item holds, its rank and its upgrade count', () => {
  const lines = ItemPropertyLines(runWith(), REF);
  assert.deepEqual(lines.properties.map((row) => row.id), ['edgeFire', 'bleedingEdge', 'handSize1', 'startBlock2']);
  for (const row of lines.properties) {
    const data = ITEM_PROPERTIES.find((entry) => entry.id === row.id);
    assert.deepEqual([row.name, row.text], [data.name, data.text]);
  }
  assert.deepEqual([lines.rank, lines.upgrades], [2, 2]);
});

test('an item nothing was done to, or a save from before properties, reads as a plain item', () => {
  const lines = ItemPropertyLines({ class: 'reaver' }, REF);
  assert.deepEqual(lines, { itemRef: REF, rank: 0, upgrades: 0, properties: [] });
  assert.equal(ItemPropertyChips(lines), null);
  assert.equal(ItemPropertyDetail(lines), null);
  assert.deepEqual(ItemPropertyLines({}, null).properties, []);
});

test('item refs follow the Blacksmith: armament, armor by class, relic', () => {
  const run = { class: 'reaver' };
  assert.equal(ArmouryItemRef(run, 'armament', { id: 'greatsword' }), 'armament/greatsword');
  assert.equal(ArmouryItemRef(run, 'armor', { id: 'warden', classId: 'reaver' }), 'armor/reaver/warden');
  assert.equal(ArmouryItemRef(run, 'armor', { id: 'warden' }), 'armor/reaver/warden');
  assert.equal(ArmouryItemRef(run, 'relic', { id: 'goldenSprout' }), 'relic/goldenSprout');
});

test('the detail lists every property with its name and effect, plus rank and upgrades (fake DOM)', () => withKitDom(() => {
  const lines = ItemPropertyLines(runWith(), REF);
  const section = ItemPropertyDetail(lines);
  const rows = walk(section).filter((n) => n.className === 'item-prop-row');
  assert.equal(rows.length, lines.properties.length);
  for (const [index, row] of rows.entries()) {
    assert.match(text(row), new RegExp(lines.properties[index].name));
    assert.ok(text(row).includes(lines.properties[index].text));
  }
  assert.match(text(section), /Rank 2 · 2 upgrades/);
}));

test('the tile shows a short chip list: three names, then how many more (fake DOM)', () => withKitDom(() => {
  const chips = ItemPropertyChips(ItemPropertyLines(runWith(), REF));
  const items = walk(chips).filter(isChip);
  assert.equal(items.length, 4, 'three names and the +1 more');
  assert.match(items[3].textContent, /\+1 more/);
  const few = ItemPropertyChips(ItemPropertyLines(runWith({ itemProps: {}, itemUpgradePicks: { [REF]: [{ id: 'prop:edgeFire', k: 'prop', prop: 'edgeFire' }] } }), REF));
  assert.equal(walk(few).filter(isChip).length, 1);
}));

test('counts read singular for one upgrade and nothing for an untouched item', () => {
  assert.equal(ItemPropertyCounts({ rank: 1, upgrades: 1 }), 'Rank 1 · 1 upgrade');
  assert.equal(ItemPropertyCounts({ rank: 0, upgrades: 0 }), '');
});

test('the screen reads the lines through the shared model on the tile, the detail and a relic', () => {
  const source = readFileSync(new URL('../src/ui/screens/equipment.js', import.meta.url), 'utf8');
  assert.match(source, /ItemPropertyChips\(propertyLinesOf\(position\.summary\.item/);
  assert.match(source, /ItemPropertyDetail\(propertyLinesOf\(item, category\)\)/);
  assert.match(source, /relicPropertyLines\(id\)/);
});
