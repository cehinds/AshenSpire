import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TierFor, LevelList, BuildLevelLists, FilterToBand } from '../src/model/levelLists.js';
import { scoring } from '../src/content/generated/scoring.js';
import { levelLists } from '../src/content/generated/levelLists.js';
import { cardCombatPower, itemCombatPower } from '../src/content/generated/combatPower.js';

const tiers = scoring.levelLists.tiers;

test('level lists: TierFor maps each authored tier and clamps beyond the last', () => {
  assert.ok(tiers.length > 0);
  for (const [index, tier] of tiers.entries()) assert.equal(TierFor({ actNumber: index + 1 }), tier.id);
  assert.equal(TierFor({ actNumber: tiers.length + 4 }), tiers.at(-1).id);
  assert.equal(TierFor({}), tiers[0].id);
});

test('level lists contain exactly the current scored IDs in each band, falling back only for empty bands', () => {
  for (const tier of tiers) for (const kind of ['cards', 'weapon', 'armour', 'relic']) {
    const rows = kind === 'cards' ? Object.entries(cardCombatPower)
      : Object.entries(itemCombatPower).filter(([id]) => id.startsWith(`${kind}:`)).map(([id, row]) => [id.slice(kind.length + 1), row]);
    const matching = rows.filter(([, row]) => row.rank >= tier.minRank && row.rank <= tier.maxRank).map(([id]) => id);
    const expected = matching.length ? matching : rows.map(([id]) => id);
    assert.deepEqual(LevelList(kind, tier.id).sort(), expected.sort(), `${tier.id}/${kind}`);
  }
});

const fixtureScoring = { levelLists: { tiers: [{ id: 'low', minRank: 0, maxRank: 1 }, { id: 'high', minRank: 2, maxRank: 3 }] } };
const fixtureTable = { cardCombatPower: { a: { rank: 2 }, b: { rank: 3 } }, itemCombatPower: {} };
test('level lists: a controlled empty band falls back to every id of the kind', () => {
  const opts = { scoring: fixtureScoring, table: fixtureTable };
  assert.deepEqual(LevelList('cards', 'low', opts), ['a', 'b']);
  assert.deepEqual(LevelList('weapon', 'low', opts), []);
  assert.deepEqual(LevelList('cards', 'high', opts), ['a', 'b']);
  assert.throws(() => LevelList('cards', 'nope', opts), /unknown tier/);
  assert.throws(() => LevelList('gem', 'low', opts), /unknown kind/);
});

test('level lists: FilterToBand narrows controlled lists and falls back when nothing is inside', () => {
  const lists = { cards: { low: ['a'], high: ['b'] }, items: {} };
  assert.deepEqual(FilterToBand('cards', 'low', ['a', 'b'], { lists }), ['a']);
  assert.deepEqual(FilterToBand('cards', 'low', ['b'], { lists }), ['b']);
  assert.deepEqual(FilterToBand('cards', 'low', ['unscored.card'], { lists }), ['unscored.card']);
});

test('level lists: the generated file matches the combat-power table and scoring (fresh)', () => {
  assert.deepEqual(levelLists, BuildLevelLists());
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/level-lists.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
