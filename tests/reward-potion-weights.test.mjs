// Owner 2026-10-31: a potion already in the belt is offered at ownedPotionWeight per held copy (much lower, never a forced skip),
// in shops, chests and combat rewards alike. Core 1 keeps its neutral weight of 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, gameProfileShopStock } from '../src/model/gameProfileRewards.js';

const build = (modules = {}, core = 'ashen.core@2.0.0') => {
  const profile = resolveGameProfile({ formatVersion: 1, core, modules });
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
};
const fresh = (registries, seed, held = []) => {
  const run = createRunState({ seed, classId: 'reaver', registries });
  run.flasks = held.map(flaskId => ({ flaskId }));
  return run;
};
const HELD = 'flaskOfStone';
// Count potion picks per id over many seeded shop stocks (one potion shelf each).
function shopPotionCounts(registries, held, n = 1000) {
  const counts = new Map();
  for (let i = 0; i < n; i++) {
    const run = fresh(registries, i + 1, held);
    for (const option of gameProfileShopStock(registries, run, createRng(900 + i), { shopId: 'm' }).options) if (option.kind === 'potions') counts.set(option.id, (counts.get(option.id) || 0) + 1);
  }
  return counts;
}
const ratio = counts => {
  const others = [...counts].filter(([id]) => id !== HELD).map(([, c]) => c);
  return { held: counts.get(HELD) || 0, mean: others.reduce((a, b) => a + b, 0) / others.length, kinds: others.length };
};

test('shop stock offers a held potion far less often than an unheld one, but not never', () => {
  const registries = build();
  const { held, mean, kinds } = ratio(shopPotionCounts(registries, [HELD]));
  assert.ok(kinds >= 3, 'several unheld potion kinds are on offer');
  assert.ok(held > 0, 'not a forced skip');
  // Expected ratio is 0.05; leave room for sampling noise.
  assert.ok(held / mean < 0.12, `held ${held} vs mean unheld ${mean} (ratio ${held / mean})`);
  console.log(`potion ratio held/unheld = ${(held / mean).toFixed(3)} (held ${held}, mean unheld ${mean.toFixed(1)}, ${kinds} unheld kinds, 1000 shops)`);
  const none = ratio(shopPotionCounts(registries, []));
  assert.ok(none.held / none.mean > 0.7, `nothing held: ${none.held} vs ${none.mean}`);
});
test('chests and combat rewards use the same weighting', () => {
  const registries = build({ 'reward-ranks': { stanceCoverage: { enabled: false, reservedSlots: 0, preferTiers: ['basic'], excludePools: ['special'] } }, rewards: { offerCount: 1 } });
  for (const source of ['treasure', 'combat']) {
    let held = 0, other = 0;
    for (let i = 0; i < 2000; i++) {
      const run = fresh(registries, i + 1, [HELD]);
      for (const option of gameProfileRewardOffers(registries, run, createRng(40 + i), { offerId: 'o', source }).options) if (option.kind === 'potions') (option.id === HELD ? held++ : other++);
    }
    assert.ok(other > 100, `${source}: potion offers happen (${other})`);
    assert.ok(held / (other / 3) < 0.15, `${source}: held ${held}, other ${other}`);
  }
});
test('nothing held leaves every offer byte-identical to the unweighted pick', () => {
  const weighted = build(), uniform = build({ 'reward-ranks': { ownedPotionWeight: 1 } });
  for (let i = 0; i < 150; i++) for (const source of ['combat', 'treasure']) {
    const a = gameProfileRewardOffers(weighted, fresh(weighted, i + 1), createRng(i), { offerId: 'x', source });
    const b = gameProfileRewardOffers(uniform, fresh(uniform, i + 1), createRng(i), { offerId: 'x', source });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  }
});
test('weight 1 restores the uniform pick even with a potion held; Core 1 is neutral', () => {
  const uniform = build({ 'reward-ranks': { ownedPotionWeight: 1 } });
  const { held, mean } = ratio(shopPotionCounts(uniform, [HELD]));
  assert.ok(held / mean > 0.7, `${held} vs ${mean}`);
  assert.equal(fresh(uniform, 1).gameProfile.content.rewards.eligibility.combatCards.ownedPotionWeight, 1);
  const core1 = build({}, 'ashen.core@1.0.0');
  assert.equal(fresh(core1, 1).gameProfile.content.rewards.eligibility.combatCards.ownedPotionWeight, 1);
});
test('the schema rejects an ownedPotionWeight outside 0..1', () => {
  for (const value of [1.5, -1]) assert.throws(() => build({ 'reward-ranks': { ownedPotionWeight: value } }), /ownedPotionWeight/);
  assert.doesNotThrow(() => build({ 'reward-ranks': { ownedPotionWeight: 0 } }));
});
