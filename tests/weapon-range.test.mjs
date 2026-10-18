// tests/weapon-range.test.mjs — every armament states a default range
// (content/source/weapons.csv, column `range`): melee | reach | ranged.
//
// Wave 1 of the ranges feature only adds the data and the helper. The table
// below is the owner's (2026-10-12): swords, axes, hammers, daggers, fists and
// shields are melee; spears, halberds, polearms, whips, staves and sceptres
// are reach; bows, crossbows and throwing weapons are ranged. Every assertion
// reads the generated def or the helper, never a copy of the table.

import test from 'node:test';
import assert from 'node:assert/strict';
import { weapons } from '../src/content/generated/weapons.js';
import { ARMAMENTS, WEAPON_RANGES, weaponRangeOf, armamentById } from '../src/content/equipment.js';

test('the closed range vocabulary is melee, reach and ranged', () => {
  assert.deepEqual([...WEAPON_RANGES], ['melee', 'reach', 'ranged']);
});

test('every weapon row states a valid range, and weaponRangeOf returns it', () => {
  assert.equal(weapons.length, 28, 'the weapons table has 28 armaments');
  for (const def of weapons) {
    assert.ok(WEAPON_RANGES.includes(def.range), `${def.id} states range '${def.range}'`);
    assert.equal(weaponRangeOf(def), def.range, `${def.id} helper matches its def`);
  }
});

test('every armament carries its range through normalisation', () => {
  assert.equal(ARMAMENTS.length, weapons.length);
  for (const piece of ARMAMENTS) {
    assert.ok(WEAPON_RANGES.includes(piece.range), `${piece.id} keeps range '${piece.range}'`);
  }
});

test('representative armaments hold the owner table', () => {
  const expected = {
    straightSword: 'melee', // sword
    greatsword: 'melee', // sword
    battleaxe: 'melee', // axe
    warhammer: 'melee', // hammer
    dagger: 'melee', // dagger
    buckler: 'melee', // shield
    kiteShield: 'melee', // shield
    halberd: 'reach', // polearm
    frostSpear: 'reach', // spear
    ashStaff: 'reach', // staff
    boneSceptre: 'reach', // sceptre
    shortbow: 'ranged', // bow
  };
  for (const [id, range] of Object.entries(expected)) {
    const def = armamentById(id);
    assert.ok(def, `${id} exists`);
    assert.equal(weaponRangeOf(def), range, `${id} is ${range}`);
  }
});

test('weaponRangeOf refuses a def with no range or an unknown one', () => {
  assert.throws(() => weaponRangeOf({ id: 'nobody' }), /nobody.*not one of melee\|reach\|ranged/);
  assert.throws(() => weaponRangeOf({ id: 'spear', range: 'contact' }), /spear.*'contact'/);
  assert.throws(() => weaponRangeOf(undefined), /weaponRangeOf/);
});
