import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ScoreCard, ScoreItem, CombatPower, RankOf, RankName, RankRange, CardName, ItemName } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';
import { cardCombatPower, itemCombatPower } from '../src/content/generated/combatPower.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

test('combat power: all 95 Core card faces score the expected raw value of the reference scorer', () => {
  const faces = fixture('combat-power-core-faces.json');
  assert.equal(faces.length, 95);
  for (const face of faces) assert.equal(ScoreCard(face).raw, face.pyScore, face.id);
});

test('combat power: every item scores what the standalone simulator scores (raw and convention name)', () => {
  const { items, props } = fixture('combat-power-items.json');
  const expected = fixture('combat-power-items-expected.json');
  assert.equal(items.length, 181);
  assert.equal(expected.length, items.length);
  items.forEach((item, i) => {
    assert.equal(`${item.kind}:${item.id}`, `${expected[i].kind}:${expected[i].id}`);
    assert.equal(ScoreItem(item, scoring, props).raw, expected[i].raw, `${item.kind}:${item.id}`);
    assert.equal(ItemName(item, 0, scoring, props), expected[i].name, `name of ${item.kind}:${item.id}`);
  });
});

test('combat power: rank bands and rarity discounts', () => {
  assert.equal(RankOf(0), 0); assert.equal(RankOf(-7), 0);
  assert.equal(RankName(0), 'Unranked');
  assert.deepEqual([1, 4, 5, 8, 36, 37, 40, 99].map(cp => RankOf(cp)), [1, 1, 2, 2, 9, 10, 10, 10]);
  assert.equal(RankName(RankOf(4)), 'Rank 1');
  assert.equal(RankRange(0), '<= 0'); assert.equal(RankRange(4), '13-16'); assert.equal(RankRange(10), '37-40');
  assert.equal(scoring.rank.maxCp, 40);
  assert.equal(CombatPower(10, 'common'), 10);
  assert.equal(CombatPower(10, 'uncommon'), 8);
  assert.equal(CombatPower(10, 'rare'), 5);
  assert.equal(CombatPower(10, 'boss'), 3);
  assert.equal(CombatPower(10, 'starter'), 10);
});

test('combat power: scoring overrides change the result and the shipped table is not mutated', () => {
  const face = fixture('combat-power-core-faces.json').find(f => f.id === 'smash');
  const edited = JSON.parse(JSON.stringify(scoring));
  edited.costs.sp.weight = -10;
  assert.equal(ScoreCard(face, edited).raw, ScoreCard(face).raw + face.sp * (-10 - scoring.costs.sp.weight)); // follows the shipped SP weight
  edited.rarity.discount.rare = 9;
  assert.equal(CombatPower(10, 'rare', edited), 1);
  assert.equal(scoring.rarity.discount.rare, 5);
  assert.match(CardName(face), /^\S+ \S+( [IVX]+)?$/);
});

test('combat power: rounding is half away from zero for cards', () => {
  const face = { ...fixture('combat-power-core-faces.json')[0], statuses: [], kw: [], tags: [], sp: 0, mp: 0, dmg: 0, blk: 1, poise: 0, draw: 0, heal: 0, loseHp: 0 };
  // a face worth exactly half a point under the shipped weights (damage 1 per 3, HP cost -1 per 2)
  assert.equal(ScoreCard({ ...face, blk: 0, dmg: 3, loseHp: 1 }).raw, 1); // 0.5 -> 1
  assert.equal(ScoreCard({ ...face, blk: 0, loseHp: 1 }).raw, -1); // -0.5 -> -1
});

test('combat power: the generated table is fresh and covers every Core card and item', () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/combat-power-report.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.ok(Object.keys(cardCombatPower).length >= 95);
  assert.equal(Object.keys(itemCombatPower).length, 181);
  for (const row of [...Object.values(cardCombatPower), ...Object.values(itemCombatPower)]) {
    assert.equal(row.cp, CombatPower(row.raw, row.rarity));
    assert.equal(row.rank, RankOf(row.cp));
    assert.ok(row.cp <= scoring.rank.maxCp, `cp ${row.cp} over the ${scoring.rank.maxCp} ceiling`);
  }
});
