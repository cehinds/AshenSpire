// Owner, 2026-11-18: equipment has no class restriction; each pick draws from the class-themed items 75% of the time, each pick rolls on its own,
// and a class with no themed item left falls back to the whole pool.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ThemedItemPick, ItemIsThemed } from '../src/model/itemThemePick.js';
import { GEAR_TYPES } from '../src/content/gearTypes.js';
import { createRng } from '../src/engine/rng.js';

const rows = Object.fromEntries(['dagger', 'shortbow', 'greatsword', 'ashStaff', 'boneSceptre', 'katana'].map(id => [id, { id }]));
const ids = Object.keys(rows);
const pick = (rng, classId) => ThemedItemPick(rng, 'cardRewards', ids, { classId, kind: 'weapons', rowOf: id => rows[id] });

test('the themed share is 75% and is data', () => {
  assert.equal(GEAR_TYPES.themedPercent, 75);
  assert.ok(ItemIsThemed(rows.dagger, 'rogue', 'weapons'));
  assert.ok(!ItemIsThemed(rows.dagger, 'starseer', 'weapons'));
});

test('about three picks in four are themed, and the rest come from the whole pool', () => {
  const rng = createRng(77);
  let themed = 0, other = 0;
  for (let i = 0; i < 2000; i++) { const id = pick(rng, 'starseer'); if (ItemIsThemed(rows[id], 'starseer', 'weapons')) themed++; else other++; }
  assert.ok(other > 0, 'the whole pool is reachable: nothing is class-locked');
  const share = themed / 2000;
  assert.ok(share > 0.72 && share < 0.86, `themed share ${share}`);
});

test('with no themed item left, a pick falls back to the whole pool', () => {
  const rng = createRng(5);
  const left = ['dagger', 'shortbow'];
  for (let i = 0; i < 50; i++) assert.ok(left.includes(ThemedItemPick(rng, 'cardRewards', left, { classId: 'starseer', kind: 'weapons', rowOf: id => rows[id] })));
  assert.equal(ThemedItemPick(rng, 'cardRewards', [], { classId: 'rogue', kind: 'weapons', rowOf: id => rows[id] }), null);
});
