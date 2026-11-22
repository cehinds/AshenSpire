import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tierFor, levelList, buildLevelLists, filterToBand, tierRow } from '../src/model/levelLists.js';
import { scoring } from '../src/content/generated/scoring.js';
import { levelLists } from '../src/content/generated/levelLists.js';
import { cardCombatPower, itemCombatPower } from '../src/content/generated/combatPower.js';

const tiers = scoring.levelLists.tiers;

test('level lists: tierFor maps the run act to its tier and clamps past the last', () => {
  assert.equal(tierFor({ actNumber: 1 }), 'act1');
  assert.equal(tierFor({ actNumber: 2 }), 'act2');
  assert.equal(tierFor({ actNumber: 3 }), 'act3');
  assert.equal(tierFor({ actNumber: 7 }), 'act3');
  assert.equal(tierFor({}), 'act1');
});

test('level lists: every listed id has its rank inside the tier band (when the band is not empty)', () => {
  for (const t of tiers) {
    const cards = levelList('cards', t.id);
    assert.ok(cards.length, t.id);
    for (const id of cards) assert.ok(cardCombatPower[id].rank >= t.minRank && cardCombatPower[id].rank <= t.maxRank, `${t.id} ${id}`);
    for (const kind of ['weapon', 'armour', 'relic']) {
      for (const id of levelList(kind, t.id)) { const r = itemCombatPower[`${kind}:${id}`].rank; assert.ok(r >= t.minRank && r <= t.maxRank, `${t.id} ${kind}:${id}`); }
    }
  }
});

test('level lists: an empty band falls back to every id of the kind', () => {
  const table = { cardCombatPower: { a: { rank: 9 }, b: { rank: 10 } }, itemCombatPower: {} };
  assert.deepEqual(levelList('cards', 'act1', { table }), ['a', 'b']);
  assert.deepEqual(levelList('weapon', 'act1', { table }), []);
  assert.deepEqual(levelList('cards', 'act3', { table }), ['a', 'b']);
  const sc = { ...scoring, levelLists: { ...scoring.levelLists, tiers: [{ id: 'low', minRank: 0, maxRank: 1 }] } };
  assert.deepEqual(levelList('cards', 'low', { scoring: sc, table }), ['a', 'b']);
  assert.throws(() => levelList('cards', 'nope'), /unknown tier/);
  assert.throws(() => levelList('gem', 'act1'), /unknown kind/);
});

test('level lists: filterToBand narrows to the band and falls back when nothing is inside', () => {
  const inBand = levelLists.cards.act1[0], high = Object.keys(cardCombatPower).find(id => cardCombatPower[id].rank > tierRow('act1').maxRank);
  assert.deepEqual(filterToBand('cards', 'act1', [inBand, high]), [inBand]);
  assert.deepEqual(filterToBand('cards', 'act1', [high]), [high]);
  assert.deepEqual(filterToBand('cards', 'act1', ['unscored.card']), ['unscored.card']);
});

test('level lists: the generated file matches the combat-power table and scoring (fresh)', () => {
  assert.deepEqual(levelLists, buildLevelLists());
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/level-lists.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
