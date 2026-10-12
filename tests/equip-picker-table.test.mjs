// tests/equip-picker-table.test.mjs — the Armoury equip-picker table model.
//
// Hand-made fixtures only; no registries. The sceptre-in-off-hand case is the
// regression: a staff held in the right hand must still be offered as fitting
// the left (either-hand) position.

import test from 'node:test';
import assert from 'node:assert/strict';
import { equipPickerTableRows, sortEquipPickerRows } from '../src/model/equipPickerTable.js';

const leftHand = { id: 'leftHand', kinds: ['weapon', 'shield', 'staff'], hand: 'left' };

const shield = {
  key: 'armament:kiteShield', id: 'kiteShield', name: 'Kite Shield', category: 'Shield',
  item: { id: 'kiteShield', kind: 'shield', hand: 'either', name: 'Kite Shield' },
};
const sceptre = {
  key: 'armament:boneSceptre', id: 'boneSceptre', name: 'Bone Sceptre', category: 'Staff',
  item: { id: 'boneSceptre', kind: 'staff', hand: 'either', name: 'Bone Sceptre' },
};
const armour = {
  key: 'armour:knight:plate', id: 'plate', name: 'Plate', category: 'Armour',
  item: { id: 'plate', kind: 'armor', name: 'Plate' },
};
const rightWeapon = {
  key: 'armament:longsword', id: 'longsword', name: 'Longsword', category: 'Weapon',
  item: { id: 'longsword', kind: 'weapon', hand: 'right', name: 'Longsword' },
};
const potion = {
  key: 'potion:healing', id: 'healing', name: 'Healing Draught', category: 'Potion',
  item: { id: 'healing', kind: 'potion', name: 'Healing Draught' },
};
const rows = [shield, sceptre, armour, rightWeapon, potion];

const baseLoadout = { sets: { rightHand: ['boneSceptre'], leftHand: [null] } };
const byId = (table, id) => table.find((r) => r.id === id);

test('potion rows are excluded and the other four are kept in input order', () => {
  const table = equipPickerTableRows(rows, leftHand, { setIndex: 0, loadout: baseLoadout });
  assert.equal(table.length, 4);
  assert.deepEqual(table.map((r) => r.id), ['kiteShield', 'boneSceptre', 'plate', 'longsword']);
  assert.equal(byId(table, 'healing'), undefined);
});

test('a staff held in the off hand is offered as fitting, status elsewhere', () => {
  const table = equipPickerTableRows(rows, leftHand, { setIndex: 0, loadout: baseLoadout });
  const row = byId(table, 'boneSceptre');
  assert.equal(row.fits, true);
  assert.equal(row.status, 'elsewhere');
  assert.equal(row.reason, null);
  assert.deepEqual(row.elsewhere, [{ slotId: 'rightHand', setIndex: 0 }]);
});

test('free, kind and hand statuses and reasons', () => {
  const table = equipPickerTableRows(rows, leftHand, { setIndex: 0, loadout: baseLoadout });
  assert.equal(byId(table, 'kiteShield').status, 'free');
  assert.equal(byId(table, 'kiteShield').fits, true);
  const plate = byId(table, 'plate');
  assert.equal(plate.status, 'nofit');
  assert.equal(plate.reason, 'kind');
  const sword = byId(table, 'longsword');
  assert.equal(sword.status, 'nofit');
  assert.equal(sword.reason, 'hand');
});

test('the shield already in this position is here', () => {
  const loadout = { sets: { rightHand: ['boneSceptre'], leftHand: ['kiteShield'] } };
  const table = equipPickerTableRows(rows, leftHand, { setIndex: 0, loadout });
  assert.equal(byId(table, 'kiteShield').status, 'here');
  assert.deepEqual(byId(table, 'kiteShield').elsewhere, []);
});

test('default sort is here or free, then elsewhere, then nofit', () => {
  const table = equipPickerTableRows(rows, leftHand, { setIndex: 0, loadout: baseLoadout });
  const sorted = sortEquipPickerRows(table);
  assert.deepEqual(sorted.map((r) => r.id), ['kiteShield', 'boneSceptre', 'longsword', 'plate']);
});

test('name sort is alphabetical ascending, desc reverses, input is untouched', () => {
  const table = equipPickerTableRows(rows, leftHand, { setIndex: 0, loadout: baseLoadout });
  const before = table.map((r) => r.id);
  const asc = sortEquipPickerRows(table, { column: 'name', direction: 'asc' });
  assert.deepEqual(asc.map((r) => r.name), ['Bone Sceptre', 'Kite Shield', 'Longsword', 'Plate']);
  const desc = sortEquipPickerRows(table, { column: 'name', direction: 'desc' });
  assert.deepEqual(desc.map((r) => r.name), ['Plate', 'Longsword', 'Kite Shield', 'Bone Sceptre']);
  assert.deepEqual(table.map((r) => r.id), before);
  assert.notEqual(asc, table);
});

test('sort rejects an unknown column or direction', () => {
  const table = equipPickerTableRows(rows, leftHand, { setIndex: 0, loadout: baseLoadout });
  assert.throws(() => sortEquipPickerRows(table, { column: 'category' }), /unknown column 'category'/);
  assert.throws(() => sortEquipPickerRows(table, { direction: 'up' }), /unknown direction 'up'/);
});

test('a negative setIndex throws', () => {
  assert.throws(
    () => equipPickerTableRows(rows, leftHand, { setIndex: -1, loadout: baseLoadout }),
    /equipPickerTableRows requires a slot and an integer setIndex/,
  );
});
