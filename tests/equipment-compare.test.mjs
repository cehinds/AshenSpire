// The Replace comparison model: equipped on the left (before), candidate on the
// right (after); higher AR/DR/Poise is better, a higher requirement is worse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { equipmentCompareRows, equipmentModLines, weaponArtName } from '../src/model/equipmentCompare.js';

const registries = createRegistries(contentBundle);
const weapon = (id) => registries.equipment.armaments.find((row) => row.id === id);
const outfit = (id) => registries.equipment.armour.find((row) => row.id === id);
const byId = (rows, id) => rows.find((row) => row.id === id);
const pick = (row) => [row.before, row.after, row.verdict];

test('weapon rows read equipped to candidate, with better and worse marked', () => {
  const rows = equipmentCompareRows(registries, weapon('greatsword'), weapon('ashStaff'), { attributes: {} });
  assert.deepEqual(pick(byId(rows, 'attackRating')), [4, 1, 'worse']);
  assert.deepEqual(pick(byId(rows, 'defenseRating')), [2, 1, 'worse']);
  assert.deepEqual(pick(byId(rows, 'poise')), [8, 3, 'worse']);
});

test('a lower requirement is better and a higher one is worse', () => {
  const rows = equipmentCompareRows(registries, weapon('greatsword'), weapon('ashStaff'), { attributes: {} });
  assert.deepEqual(pick(byId(rows, 'req:strength')), [3, 0, 'better']);
  assert.deepEqual(pick(byId(rows, 'req:intelligence')), [0, 3, 'worse']);
});

test('the reverse comparison flips every verdict; an identical item is all same', () => {
  const rows = equipmentCompareRows(registries, weapon('ashStaff'), weapon('greatsword'), { attributes: {} });
  assert.deepEqual(pick(byId(rows, 'attackRating')), [1, 4, 'better']);
  assert.deepEqual(pick(byId(rows, 'req:strength')), [0, 3, 'worse']);
  const same = equipmentCompareRows(registries, weapon('ashStaff'), weapon('ashStaff'), { attributes: {} });
  assert.ok(same.every((row) => row.verdict === 'same'), 'no text rows and no better or worse for an identical item');
});

test('weapon art and modifiers are text rows, shown only when they differ', () => {
  const rows = equipmentCompareRows(registries, weapon('greatsword'), weapon('ashStaff'), { attributes: {} });
  assert.deepEqual(pick(byId(rows, 'weaponArt')), [weaponArtName(registries, weapon('greatsword')), weaponArtName(registries, weapon('ashStaff')), 'changed']);
  assert.equal(byId(rows, 'mods').before, equipmentModLines(registries, weapon('greatsword')).join(', '));
  assert.notEqual(byId(rows, 'weaponArt').before, 'None');
});

test('armour compares DR and Poise the same way', () => {
  const current = { ...outfit('default'), defenseRating: 1, poiseThreshold: 6 };
  const next = { ...outfit('default'), defenseRating: 3, poiseThreshold: 4 };
  const rows = equipmentCompareRows(registries, current, next, { attributes: {} });
  assert.deepEqual(pick(byId(rows, 'defenseRating')), [1, 3, 'better']);
  assert.deepEqual(pick(byId(rows, 'poise')), [6, 4, 'worse']);
});

test('it refuses a comparison with nothing equipped', () => {
  assert.throws(() => equipmentCompareRows(registries, null, weapon('ashStaff')), /equipped item and the candidate/);
});
