// Insight contests (owner, 2026-10-31; SPEC §17 Contests).
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollContest, contestPreview } from '../src/engine/contest.js';
import { createRng } from '../src/engine/rng.js';

const caster = { kind: 'player', attributes: { intelligence: 1, wisdom: 2, dexterity: 3, constitution: 4 }, level: { level: 1 } };
const enemy = { kind: 'enemy', attributes: { wisdom: 1, constitution: 2 }, level: 1, persistentPoise: { max: 7, value: 7 } };
const stub = roll => ({ int: (stream, lo, hi) => { assert.equal(stream, 'combatContest'); assert.deepEqual([lo, hi], [1, 20]); return roll; } });
const ctx = { attributesForEntity: entity => entity.attributes };

test("owner's example: roll 5 + INT 1 + WIS 2 + rank 1 = 9 vs Poise 7 + WIS 1 + level 1 = 9 passes on the tie", () => {
  const result = rollContest({ rng: stub(5), caster, target: enemy, kind: 'mental', rank: 1, ctx });
  assert.equal(result.total, 9); assert.equal(result.dc, 9); assert.equal(result.passed, true);
  assert.deepEqual(result.parts, [{ id: 'intelligence', value: 1 }, { id: 'wisdom', value: 2 }]);
  assert.deepEqual(result.dcParts.map(part => part.id), ['poise', 'wisdom', 'level']);
});
test('a roll of 4 fails the same contest', () => {
  assert.equal(rollContest({ rng: stub(4), caster, target: enemy, kind: 'mental', rank: 1, ctx }).passed, false);
});
test('the DC reads CURRENT Poise, not the maximum', () => {
  const broken = { ...enemy, persistentPoise: { max: 7, value: 0 } };
  assert.equal(contestPreview({ caster, target: broken, kind: 'mental', rank: 1, ctx }).dc, 2);
  assert.equal(rollContest({ rng: stub(1), caster, target: broken, kind: 'mental', rank: 1, ctx }).passed, true);
});
test('physical contests use DEX + CON against CON', () => {
  const preview = contestPreview({ caster, target: enemy, kind: 'physical', rank: 2, ctx });
  assert.equal(preview.bonus, 3 + 4 + 2); assert.equal(preview.dc, 7 + 2 + 1);
});
test('the roll is deterministic per seed', () => {
  const roll = seed => rollContest({ rng: createRng(seed), caster, target: enemy, kind: 'mental', ctx }).roll;
  assert.equal(roll(42), roll(42));
});
