import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ScoreCard, ScoreItem, CombatPower, RankOf, RankName, RankRange, CardName, ItemName, ApplyScoringOverride } from '../src/model/combatPower.js';
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
    assert.ok(Number.isFinite(row.raw) && Number.isFinite(row.cp), `non-finite score ${JSON.stringify(row)}`);
    if (!row.overridden) {
      assert.equal(row.cp, CombatPower(row.raw, row.rarity));
      assert.equal(row.rank, RankOf(row.cp));
    }
    assert.ok(row.rank >= 0 && row.rank <= scoring.rank.maxRank, `rank ${row.rank} outside 0..${scoring.rank.maxRank}`);
  }
});

test('RankRange labels agree with RankOf when unrankedMax is not 0', () => {
  const custom = { ...scoring, rank: { ...scoring.rank, unrankedMax: 2 } };
  const parse = label => { const m = /^(\d+)-(\d+)$/.exec(label); return m ? [Number(m[1]), Number(m[2])] : null; };
  assert.equal(RankRange(0, custom), '<= 2');
  assert.equal(RankRange(1, custom), '3-4', 'Rank 1 starts at unrankedMax + 1');
  assert.equal(RankRange(2, custom), '5-8');
  for (let cp = -1; cp <= scoring.rank.maxCp; cp++) {
    const k = RankOf(cp, custom);
    if (k === 0) { assert.ok(cp <= 2, `cp ${cp}`); continue; }
    const [lo, hi] = parse(RankRange(k, custom));
    assert.ok(cp >= lo && cp <= hi, `cp ${cp} is Rank ${k} but its label is ${RankRange(k, custom)}`);
  }
  assert.equal(RankRange(1), '1-4', 'the shipped table (unrankedMax 0) is unchanged');
});

test('the effect count sees a status even when a tag shares its part key', async () => {
  const { BaseFace } = await import('../src/model/combatPower.js');
  const face = tags => Object.assign(BaseFace(), { sp: 1, dmg: 4, statuses: [['venom', 2, 'enemy']], tags });
  const plain = ScoreCard(face([])), tagged = ScoreCard(face(['venom']));
  assert.ok(plain.parts['effect count'] > 0, 'damage + Venom is two effects');
  assert.equal(tagged.parts['effect count'], plain.parts['effect count'], 'a venom tag does not hide the Venom status');
});

test('ApplyScoringOverride leaves rows untouched when absent and overrides rank, cp, or rarity when set', () => {
  const base = { raw: 64, cp: 59, rank: 10, rarity: 'rare' };
  assert.equal(ApplyScoringOverride(base, null), base);
  assert.equal(ApplyScoringOverride(base, {}), base);
  assert.deepEqual(ApplyScoringOverride(base, { rank: 5 }), { ...base, rank: 5, overridden: true });
  assert.deepEqual(ApplyScoringOverride(base, { rank: 99 }), { ...base, rank: scoring.rank.maxRank, overridden: true });
  assert.deepEqual(ApplyScoringOverride(base, { cp: 14 }), { raw: 64, cp: 14, rank: RankOf(14), rarity: 'rare', overridden: true });
  assert.deepEqual(ApplyScoringOverride(base, { rarity: 'common' }), { raw: 64, cp: 64, rank: 10, rarity: 'common', overridden: true });
});
