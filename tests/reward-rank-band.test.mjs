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
import { rollCardRewardIds } from '../src/engine/encounters.js';
import { cardCombatPower } from '../src/content/generated/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = (seed, level = 1) => { const run = createRunState({ seed, classId: 'reaver', registries: reg, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } }); run.level.level = level; return run; };
const offer = (seed, level) => gameProfileRewardOffers(reg, fresh(seed, level), createRng(seed), { offerId: `t:${seed}:${level}`, source: 'combat', pool: 'normal' });
const cardsOf = (o) => o.options.filter(x => x.kind === 'combatCards').map(x => x.id);
const act1 = scoring.levelLists.tiers[0];
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

test('level 5 reaches cards outside the level-one band in the same act', () => {
  const high = new Set();
  for (const seed of SEEDS) for (const id of cardsOf(offer(seed, 5))) if (cardCombatPower[id]?.rank > LEVEL_ONE_MAX) high.add(id);
  assert.ok(high.size > 0);
});

test('the same seed gives the same offer', () => {
  for (const seed of [3, 17, 91]) assert.deepEqual(offer(seed, 1).options, offer(seed, 1).options);
});

test('an empty band falls back to the unfiltered pool (legacy door, synthetic registries)', () => {
  const mk = (ids) => ({
    balance: { rewards: { cardChoices: 3, rarityWeights: { normal: { common: 1 } } } },
    classes: { get: () => ({ cardPool: ids }) },
    cards: { get: (id) => ({ id, rarity: 'common' }), all: () => [] },
  });
  const high = Object.keys(cardCombatPower).filter(id => cardCombatPower[id].rank > act1.maxRank).slice(0, 4);
  const low = Object.keys(cardCombatPower).filter(id => cardCombatPower[id].rank <= act1.maxRank).slice(0, 4);
  assert.deepEqual(rollCardRewardIds(mk(high), createRng(5), { classId: 'x', pool: 'normal', tierId: 'act1' }).every(id => high.includes(id)), true);
  assert.ok(rollCardRewardIds(mk(high), createRng(5), { classId: 'x', pool: 'normal', tierId: 'act1' }).length > 0);
  const mixed = rollCardRewardIds(mk([...high, ...low]), createRng(5), { classId: 'x', pool: 'normal', tierId: 'act1' });
  assert.ok(mixed.every(id => low.includes(id)));
  const unfiltered = new Set(); for (let s = 1; s <= 40; s++) for (const id of rollCardRewardIds(mk([...high, ...low]), createRng(s), { classId: 'x', pool: 'normal' })) unfiltered.add(id);
  assert.ok(high.some(id => unfiltered.has(id)), 'without tierId the high cards are still offered');
  assert.deepEqual(rollCardRewardIds(mk([...high, ...low]), createRng(9), { classId: 'x', pool: 'normal', tierId: 'act1' }), rollCardRewardIds(mk([...high, ...low]), createRng(9), { classId: 'x', pool: 'normal', tierId: 'act1' }));
});

test('shop shelves use the same character-level rank band as rewards', () => {
  const stock = (seed, level) => gameProfileShopStock(reg, fresh(seed, level), createRng(seed), { shopId: 'm' }).options.filter(x => x.kind === 'combatCards').map(x => x.id);
  const seen = new Set(), high = new Set();
  for (const seed of SEEDS) {
    for (const id of stock(seed, 1)) { const row = cardCombatPower[id]; if (!row) continue; seen.add(id); assert.ok(row.rank >= 0 && row.rank <= LEVEL_ONE_MAX, `${id} rank ${row.rank}`); }
    for (const id of stock(seed, 5)) if (cardCombatPower[id]?.rank > LEVEL_ONE_MAX) high.add(id);
  }
  assert.ok(seen.size > 5, `only ${seen.size} distinct scored shop cards seen`);
  assert.ok(high.size > 0);
});
