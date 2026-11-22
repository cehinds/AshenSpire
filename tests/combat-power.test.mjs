import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scoreCard, scoreItem, combatPower, rankOf, rankName, rankRange, cardName, itemName } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';
import { cardCombatPower, itemCombatPower } from '../src/content/generated/combatPower.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

test('combat power: all 95 Core card faces score the expected raw value of the reference scorer', () => {
  const faces = fixture('combat-power-core-faces.json');
  assert.equal(faces.length, 95);
  for (const face of faces) assert.equal(scoreCard(face).raw, face.pyScore, face.id);
});

test('combat power: every item scores what the standalone simulator scores (raw and convention name)', () => {
  const { items, props } = fixture('combat-power-items.json');
  const expected = fixture('combat-power-items-expected.json');
  assert.equal(items.length, 181);
  assert.equal(expected.length, items.length);
  items.forEach((item, i) => {
    assert.equal(`${item.kind}:${item.id}`, `${expected[i].kind}:${expected[i].id}`);
    assert.equal(scoreItem(item, scoring, props).raw, expected[i].raw, `${item.kind}:${item.id}`);
    assert.equal(itemName(item, 0, scoring, props), expected[i].name, `name of ${item.kind}:${item.id}`);
  });
});

test('combat power: rank bands and rarity discounts', () => {
  assert.equal(rankOf(0), 0); assert.equal(rankOf(-7), 0);
  assert.equal(rankName(0), 'Unranked');
  assert.deepEqual([1, 2, 3, 4, 18, 19, 20, 99].map(cp => rankOf(cp)), [1, 1, 2, 2, 9, 10, 10, 10]);
  assert.equal(rankName(rankOf(2)), 'Rank 1');
  assert.equal(rankRange(0), '<= 0'); assert.equal(rankRange(4), '7-8'); assert.equal(rankRange(10), '>= 19');
  assert.equal(combatPower(10, 'common'), 10);
  assert.equal(combatPower(10, 'uncommon'), 8);
  assert.equal(combatPower(10, 'rare'), 5);
  assert.equal(combatPower(10, 'boss'), 3);
  assert.equal(combatPower(10, 'starter'), 10);
});

test('combat power: scoring overrides change the result and the shipped table is not mutated', () => {
  const face = fixture('combat-power-core-faces.json').find(f => f.id === 'smash');
  const edited = JSON.parse(JSON.stringify(scoring));
  edited.costs.sp.weight = -10;
  assert.equal(scoreCard(face, edited).raw, scoreCard(face).raw - 10);
  edited.rarity.discount.rare = 9;
  assert.equal(combatPower(10, 'rare', edited), 1);
  assert.equal(scoring.rarity.discount.rare, 5);
  assert.match(cardName(face), /^\S+ \S+( [IVX]+)?$/);
});

test('combat power: rounding is half away from zero for cards', () => {
  const face = { ...fixture('combat-power-core-faces.json')[0], statuses: [], kw: [], tags: [], sp: 0, mp: 0, dmg: 0, blk: 1, poise: 0, draw: 0, heal: 0, loseHp: 0 };
  assert.equal(scoreCard(face).raw, 1); // 0.5 -> 1
  assert.equal(scoreCard({ ...face, blk: -1 }).raw, -1); // -0.5 -> -1
});

test('combat power: the generated table is fresh and covers every Core card and item', () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/combat-power-report.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.ok(Object.keys(cardCombatPower).length >= 95);
  assert.equal(Object.keys(itemCombatPower).length, 181);
  for (const row of [...Object.values(cardCombatPower), ...Object.values(itemCombatPower)]) {
    assert.equal(row.cp, combatPower(row.raw, row.rarity));
    assert.equal(row.rank, rankOf(row.cp));
  }
});
