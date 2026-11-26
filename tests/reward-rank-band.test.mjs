// Configured Core rewards and shop stock use the character-level combat-power
// rank band. The legacy reward entry point still accepts an act tier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, gameProfileShopStock } from '../src/model/gameProfileRewards.js';
import { productionBundle } from './helpers/production-bundle.mjs';
import { cardCombatPower } from '../src/content/generated/combatPower.js';
import { FilterToRankBand, RankBandForLevel } from '../src/model/levelLists.js';
import { scoring } from '../src/content/generated/scoring.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = (seed, level = 1) => { const run = createRunState({ seed, classId: 'reaver', registries: reg, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } }); run.level.level = level; return run; };
const offer = (seed, level) => gameProfileRewardOffers(reg, fresh(seed, level), createRng(seed), { offerId: `t:${seed}:${level}`, source: 'combat', pool: 'normal' });
const cardsOf = (o) => o.options.filter(x => x.kind === 'combatCards').map(x => x.id);
const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1);
const LEVEL_ONE_MAX = 2; // Level 1 plus the possible normal-pool rare boost.

test('character level 1 offers only Rank 0–2 cards when the band has any', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of cardsOf(offer(seed, 1))) {
    const row = cardCombatPower[id]; if (!row) continue; seen.add(id);
    assert.ok(row.rank >= 0 && row.rank <= LEVEL_ONE_MAX, `${id} rank ${row.rank}`);
  }
  assert.ok(seen.size > 5, `only ${seen.size} distinct scored cards seen`);
});

test('level 5 expands a controlled ranked pool and actual same-act offers remain in their current band', () => {
  const ids = ['fixture.low', 'fixture.high'];
  const table = { cardCombatPower: { 'fixture.low': { rank: 1 }, 'fixture.high': { rank: 5 } }, itemCombatPower: {} };
  assert.deepEqual(FilterToRankBand('cards', ids, { ...RankBandForLevel({ level: 1 }), table }), ['fixture.low']);
  assert.deepEqual(FilterToRankBand('cards', ids, { ...RankBandForLevel({ level: 5 }), table }), ids);
  const seen = new Set();
  for (const seed of SEEDS) for (const id of cardsOf(offer(seed, 5))) {
    const row = cardCombatPower[id]; if (!row) continue; seen.add(id);
    assert.ok(row.rank >= 0 && row.rank <= scoring.rank.maxRank, `${id} rank ${row.rank}`);
  }
  assert.ok(seen.size > 5, 'the actual current pool still offers distinct cards');
});

test('the same seed gives the same offer', () => {
  for (const seed of [3, 17, 91]) assert.deepEqual(offer(seed, 1).options, offer(seed, 1).options);
});

test('an empty tier falls back and the actual legacy door filters mixed pools through its tierId', () => {
  // Use known scored IDs so the production filter treats the controlled high
  // entries as out of band, rather than preserving them as unknown content.
  const ids = Object.keys(cardCombatPower).slice(0, 8), high = ids.slice(0, 4), low = ids.slice(4);
  assert.equal(ids.length, 8);
  const lists = { cards: { act1: low, act3: high }, items: {} };
  const bundled = productionBundle({ sourceOverrides: {
    'src/content/generated/levelLists.js': `export const levelLists = ${JSON.stringify(lists)};`,
  } });
  const { rollCardRewardIds } = bundled('src/engine/encounters.js');
  const { createRng } = bundled('src/engine/rng.js');
  const mk = ids => ({ balance: { rewards: { cardChoices: 3, rarityWeights: { normal: { common: 1 } } } }, classes: { get: () => ({ cardPool: ids }) }, cards: { get: id => ({ id, rarity: 'common' }), all: () => [] } });
  const draw = (pool, seed, tierId = 'act1') => Array.from(rollCardRewardIds(mk(pool), createRng(seed), { classId: 'x', pool: 'normal', tierId }));
  const fallback = draw(high, 5);
  assert.ok(fallback.length > 0); assert.ok(fallback.every(id => high.includes(id)), 'an empty tier keeps the original candidate pool');
  const mixed = draw([...high, ...low], 5);
  assert.ok(mixed.length > 0); assert.ok(mixed.every(id => low.includes(id)), 'the real tierId branch removes scored out-of-band candidates');
  const unfiltered = new Set();
  for (let seed = 1; seed <= 40; seed++) for (const id of draw([...high, ...low], seed, null)) unfiltered.add(id);
  assert.ok(high.some(id => unfiltered.has(id)), 'without tierId high candidates remain available');
  assert.deepEqual(draw([...high, ...low], 9), draw([...high, ...low], 9));
});

test('shop shelves use the same character-level rank band as rewards', () => {
  const stock = (seed, level) => gameProfileShopStock(reg, fresh(seed, level), createRng(seed), { shopId: 'm' }).options.filter(x => x.kind === 'combatCards').map(x => x.id);
  const seen = new Set(), later = new Set();
  for (const seed of SEEDS) {
    for (const id of stock(seed, 1)) { const row = cardCombatPower[id]; if (!row) continue; seen.add(id); assert.ok(row.rank >= 0 && row.rank <= LEVEL_ONE_MAX, `${id} rank ${row.rank}`); }
    for (const id of stock(seed, 5)) { const row = cardCombatPower[id]; if (!row) continue; later.add(id); assert.ok(row.rank >= 0 && row.rank <= scoring.rank.maxRank, `${id} rank ${row.rank}`); }
  }
  assert.ok(seen.size > 5, `only ${seen.size} distinct scored shop cards seen`);
  assert.ok(later.size > 5, 'higher-level shelves retain a real eligible pool even when no current common card exceeds Rank 2');
});
