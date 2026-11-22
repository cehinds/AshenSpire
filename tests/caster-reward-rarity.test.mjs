// Card reward rarity is ONE table for every class (owner ruling 2026-11-21):
// rare is under 10% from every source, and the chance a specific card is
// offered falls as rarity rises. Math: docs/balance/reward-rates-2026-11-21.md.
import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createRng } from '../src/engine/rng.js';
import { cardRewardRarityWeights, rollCardRewardIds } from '../src/engine/encounters.js';
const r = createRegistries(contentBundle);
const rarity = id => r.cards.get(id).rarity;
const CLASSES = ['reaver', 'rogue', 'starseer', 'herald'];
const POOLS = ['normal', 'elite', 'boss'];
const TABLE = { normal: [65, 30, 5], elite: [57, 35, 8], boss: [52, 39, 9] };
const poolSizes = classId => {
  const n = { common: 0, uncommon: 0, rare: 0 };
  for (const id of r.classes.get(classId).cardPool) n[rarity(id)]++;
  return n;
};
const withRewards = patch => validateContent({ ...contentBundle, balance: { ...contentBundle.balance, rewards: { ...contentBundle.balance.rewards, ...patch } } });

test('every class reads the same authored table, and the old per-class override is gone', () => {
  assert.equal(r.balance.rewards.rarityWeightsByClass, undefined);
  for (const pool of POOLS) for (const classId of CLASSES) {
    assert.deepEqual(Object.values(cardRewardRarityWeights(r, { classId, pool })), TABLE[pool]);
    assert.deepEqual(cardRewardRarityWeights(r, { classId, pool }), cardRewardRarityWeights(r, { classId: 'reaver', pool }));
  }
  for (const classId of CLASSES) assert.deepEqual(cardRewardRarityWeights(r, { classId, pool: 'unknown' }), cardRewardRarityWeights(r, { classId, pool: 'normal' }));
});

test('rare is under 10% of every source', () => {
  for (const pool of POOLS) {
    const { common, uncommon, rare } = cardRewardRarityWeights(r, { pool });
    assert.ok(rare / (common + uncommon + rare) < 0.1, `${pool}: rare share`);
  }
});

test('a specific card is less likely as rarity rises, per class and source', () => {
  for (const classId of CLASSES) {
    const n = poolSizes(classId);
    for (const pool of POOLS) {
      const w = cardRewardRarityWeights(r, { classId, pool });
      const each = k => w[k] / n[k];
      assert.ok(each('common') > each('uncommon') && each('uncommon') > each('rare'), `${classId}/${pool}: ${each('common')} > ${each('uncommon')} > ${each('rare')}`);
    }
  }
});

test('the rolled rarity honours the table at each interval boundary', () => {
  for (const classId of CLASSES) for (const pool of POOLS) {
    const values = TABLE[pool];
    const eps = 1e-9; // rolls straddle each boundary; the exact float product can land either side
    for (const [roll, expected] of [[0, 'common'], [values[0] / 100 - eps, 'common'], [values[0] / 100 + eps, 'uncommon'], [(values[0] + values[1]) / 100 - eps, 'uncommon'], [(values[0] + values[1]) / 100 + eps, 'rare']]) {
      const rng = { float: () => roll, pick: (_stream, items) => items[0] };
      assert.equal(rarity(rollCardRewardIds(r, rng, { classId, pool })[0]), expected, `${classId}/${pool}@${roll}`);
    }
  }
});

test('Chaos Rewards still flattens the table for every class', () => {
  for (const classId of CLASSES) assert.deepEqual(cardRewardRarityWeights(r, { classId, pool: 'boss', flatRarity: true }), { common: 1, uncommon: 1, rare: 1 });
});

test('the validator refuses a retired per-class table, a rare of 10% or more, and a per-card order violation', () => {
  assert.ok(validateContent(contentBundle).ok);
  const bad = withRewards({ rarityWeightsByClass: { herald: { normal: { common: 1, uncommon: 1, rare: 1 } } } });
  assert.ok(!bad.ok && JSON.stringify(bad.errors).includes('rarityWeightsByClass'));
  const rareHigh = withRewards({ rarityWeights: { ...contentBundle.balance.rewards.rarityWeights, normal: { common: 60, uncommon: 30, rare: 10 } } });
  assert.ok(!rareHigh.ok && JSON.stringify(rareHigh.errors).includes('under 10%'));
  const order = withRewards({ rarityWeights: { ...contentBundle.balance.rewards.rarityWeights, normal: { common: 20, uncommon: 75, rare: 5 } } });
  assert.ok(!order.ok && JSON.stringify(order.errors).includes('rarer than'));
  for (const weights of [{ common: -1, uncommon: 1, rare: 1 }, { common: 1, uncommon: 1 }, { common: 0, uncommon: 0, rare: 0 }, { common: 1, uncommon: 1, rare: 1, mythic: 1 }]) {
    assert.ok(!withRewards({ rarityWeights: { ...contentBundle.balance.rewards.rarityWeights, normal: weights } }).ok, JSON.stringify(weights));
  }
});
