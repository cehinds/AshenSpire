import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PlanCardPool, PlanCardPoolInputs, Apportion, NormalisePercent, MeasurePoolShape, PoolCounts } from '../src/model/cardPoolPlan.js';
import { ScoreCard, CombatPower } from '../src/model/combatPower.js';
import { GenerateFace } from '../src/model/cardGenerator.js';
import { cardCombatPower } from '../src/content/generated/combatPower.js';

const coreCards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const coreShape = () => MeasurePoolShape(coreCards, { rankOf: (c) => cardCombatPower[c.id]?.rank ?? 0 });

test('card pool plan: largest-remainder rounding adds up exactly and spreads an all-zero group evenly', () => {
  assert.deepEqual(Apportion({ a: 1, b: 1, c: 1 }, 10), { a: 4, b: 3, c: 3 });
  assert.deepEqual(Apportion({ a: 47, b: 39, c: 14 }, 106), { a: 50, b: 41, c: 15 });
  assert.deepEqual(Apportion({ a: 0, b: 0 }, 5), { a: 3, b: 2 });
  for (let n = 0; n < 40; n++) assert.equal(Object.values(Apportion({ x: 3, y: 5, z: 11 }, n)).reduce((s, v) => s + v, 0), n);
  assert.deepEqual(NormalisePercent({ a: 1, b: 2 }), { a: 33, b: 67 });
});

test('card pool plan: today\'s Core pool shape is measured as the defaults', () => {
  const shape = coreShape();
  assert.equal(shape.total, coreCards.length);
  assert.equal(Object.values(shape.perSchool).reduce((s, v) => s + v, 0), coreCards.length);
  for (const group of ['rarity', 'rank', 'sp', 'mp', 'type', 'range', 'effects']) assert.equal(Object.values(shape[group]).reduce((s, v) => s + v, 0), 100, group);
  assert.ok(shape.allowedStatuses.includes('weak') && shape.allowedEffects.includes('poise'));
});

test('card pool plan: counts match the totals exactly; per-school counts win over total', () => {
  const opts = { ...coreShape(), total: 7 };
  const { count, inputs } = PlanCardPoolInputs(opts);
  assert.equal(count, coreCards.length, 'per-school counts set the card count');
  const counts = PoolCounts(inputs);
  for (const [school, n] of Object.entries(opts.perSchool)) assert.equal(counts.school[school] || 0, n, school);
  for (const [camp, n] of Object.entries(opts.perCamp)) assert.equal(counts.camp[camp] || 0, n, camp);
  const rarity = Apportion(opts.rarity, count, ['common', 'uncommon', 'rare']);
  for (const [r, n] of Object.entries(rarity)) assert.equal(counts.rarity[r] || 0, n, r);
  assert.equal(inputs.filter((t) => t.keyword).length, Math.round(count * opts.keywordOdds / 100));
  assert.equal(inputs.filter((t) => t.drawback).length, Math.round(count * opts.drawbackOdds / 100));
  assert.ok(inputs.every((t) => t.camp !== 'martial' || t.mp === 0), 'martial cards cost no MP');
  // magic cards take the real schools first
  const realSchools = count - opts.perSchool.none;
  assert.equal(inputs.filter((t) => t.camp === 'magic' && t.school === 'none').length, Math.max(0, opts.perCamp.magic - realSchools));
  const plain = PlanCardPoolInputs({ total: 30, rarity: { common: 1 }, rank: { 2: 1 }, seed: 4 });
  assert.equal(plain.count, 30, 'total is used when no per-school count is set');
  assert.ok(plain.inputs.every((t) => t.rarity === 'common' && t.rank === 2));
  assert.ok(plain.inputs.filter((t) => t.camp === 'martial').every((t) => t.school === 'none'));
  assert.ok(plain.inputs.filter((t) => t.camp === 'magic').every((t) => t.school !== 'none'));
});

test('card pool plan: every planned card lands on its target and the plan is deterministic by seed', () => {
  const opts = { ...coreShape(), seed: 'abc' };
  const a = PlanCardPool(opts), b = PlanCardPool(structuredClone(opts));
  assert.deepEqual(a.cards, b.cards);
  assert.equal(a.cards.length, a.count);
  assert.equal(new Set(a.cards.map((c) => c.id)).size, a.cards.length);
  a.inputs.forEach((t, i) => { const { face, cp, wanted } = GenerateFace(t); assert.equal(wanted, a.targets[i]); assert.equal(CombatPower(ScoreCard(face).raw, t.rarity), cp); });
  assert.equal(a.misses, a.cards.filter((c) => c._cpMiss !== undefined).length);
  const other = PlanCardPool({ ...opts, seed: 'xyz' });
  assert.notDeepEqual(other.cards.map((c) => c.name), a.cards.map((c) => c.name));
});

test('card pool plan: schools go only to magic and hybrid cards; extra school counts turn martial cards magic', () => {
  const plan = PlanCardPool({ perSchool: { fire: 6, frost: 4 }, perCamp: { martial: 10 }, rarity: { common: 1 }, rank: { 1: 1 }, seed: 2 });
  assert.equal(plan.count, 10);
  assert.equal(plan.martialToMagic, 10, 'all ten martial cards became magic to hold ten schools');
  for (const [i, t] of plan.inputs.entries()) {
    if (t.school !== 'none') assert.notEqual(t.camp, 'martial', 'no martial card has a school');
    const tags = plan.cards[i].tags;
    if (t.camp === 'martial') assert.ok(!tags.some((x) => x.startsWith('damage:') || x.startsWith('school:')), 'a martial card has no element tag');
    if (tags.some((x) => x.startsWith('damage:'))) assert.ok(tags.some((x) => x.startsWith('school:')), 'an element tag comes with its school');
  }
  const mixed = PlanCardPool({ perSchool: { fire: 3, none: 7 }, perCamp: { martial: 8, magic: 2 }, seed: 2 });
  assert.equal(mixed.martialToMagic, 1);
  assert.equal(mixed.inputs.filter((t) => t.camp === 'martial').length, 7);
  assert.ok(mixed.inputs.filter((t) => t.camp === 'martial').every((t) => t.school === 'none'));
});
