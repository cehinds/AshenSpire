import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TierFor, LevelList, BuildLevelLists, FilterToBand } from '../src/model/levelLists.js';
import { scoring } from '../src/content/generated/scoring.js';
import { levelLists } from '../src/content/generated/levelLists.js';
import { cardCombatPower, itemCombatPower } from '../src/content/generated/combatPower.js';

const tiers = scoring.levelLists.tiers;

test('level lists: TierFor maps the run act to its tier and clamps past the last', () => {
  assert.equal(TierFor({ actNumber: 1 }), 'act1');
  assert.equal(TierFor({ actNumber: 2 }), 'act2');
  assert.equal(TierFor({ actNumber: 3 }), 'act3');
  assert.equal(TierFor({ actNumber: 7 }), 'act3');
  assert.equal(TierFor({}), 'act1');
});

test('level lists: every listed id has its rank inside the tier band (when the band is not empty)', () => {
  for (const t of tiers) {
    const cards = LevelList('cards', t.id);
    assert.ok(cards.length, t.id);
    for (const id of cards) assert.ok(cardCombatPower[id].rank >= t.minRank && cardCombatPower[id].rank <= t.maxRank, `${t.id} ${id}`);
    for (const kind of ['weapon', 'armour', 'relic']) {
      for (const id of LevelList(kind, t.id)) { const r = itemCombatPower[`${kind}:${id}`].rank; assert.ok(r >= t.minRank && r <= t.maxRank, `${t.id} ${kind}:${id}`); }
    }
  }
});

test('level lists: an empty band falls back to every id of the kind', () => {
  const table = { cardCombatPower: { a: { rank: 9 }, b: { rank: 10 } }, itemCombatPower: {} };
  assert.deepEqual(LevelList('cards', 'act1', { table }), ['a', 'b']);
  assert.deepEqual(LevelList('weapon', 'act1', { table }), []);
  assert.deepEqual(LevelList('cards', 'act3', { table }), ['a', 'b']);
  const sc = { ...scoring, levelLists: { ...scoring.levelLists, tiers: [{ id: 'low', minRank: 0, maxRank: 1 }] } };
  assert.deepEqual(LevelList('cards', 'low', { scoring: sc, table }), ['a', 'b']);
  assert.throws(() => LevelList('cards', 'nope'), /unknown tier/);
  assert.throws(() => LevelList('gem', 'act1'), /unknown kind/);
});

test('level lists: FilterToBand narrows to the band and falls back when nothing is inside', () => {
  const inBand = 'fixture.low', high = 'fixture.high';
  const lists = { cards: { act1: [inBand], act3: [high] }, items: {} };
  assert.deepEqual(FilterToBand('cards', 'act1', [inBand, high], { lists }), [inBand]);
  assert.deepEqual(FilterToBand('cards', 'act1', [high], { lists }), [high]);
  assert.deepEqual(FilterToBand('cards', 'act1', ['unscored.card'], { lists }), ['unscored.card']);
  assert.deepEqual(FilterToBand('cards', 'act1', levelLists.cards.act1), levelLists.cards.act1, 'all actual eligible cards remain eligible under the shipped lists');
});

test('level lists: the generated file matches the combat-power table and scoring (fresh)', () => {
  assert.deepEqual(levelLists, BuildLevelLists());
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/level-lists.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
