// Owner 2026-10-31: a potion already in the belt is offered at ownedPotionWeight per held copy (much lower, never a forced skip),
// in shops, chests and combat rewards alike. Core 1 keeps its neutral weight of 1.
import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, gameProfileShopStock } from '../src/model/gameProfileRewards.js';

const build = (modules = {}, core = 'ashen.core@2.0.0') => {
  const profile = resolveGameProfile({ formatVersion: 1, core, modules });
  const original=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  return Object.create(original,{flasks:{value:{all:()=>POTIONS,get:id=>POTIONS.find(row=>row.id===id)||original.flasks.get(id),has:id=>POTIONS.some(row=>row.id===id)||original.flasks.has(id)}}});
};
const POTIONS=Array.from({length:4},(_,i)=>({id:`fixture.potion.${i}`,name:`Potion ${i}`,rarity:'common',effects:[{op:'applyStatus',target:'self',status:'strength',stacks:1}]}));
const HELD=POTIONS[0].id;
const POTION_GROUPS=[{id:'fixture.potions',weight:1,categories:['potions']}];
const fresh = (registries, seed, held = []) => {
  const run = createRunState({ seed, classId: 'reaver', registries });
  run.flasks = held.map(flaskId => ({ flaskId }));
  run.gameProfile=structuredClone(run.gameProfile);
  const content=run.gameProfile.content;
  content.rewards.categories=['potions'];
  content.rewards.eligibility.potions={excludeKinds:[]};
  content.rewards.rewardGroups=content.rewards.treasureRewardGroups=POTION_GROUPS;
  content.rewards.combatOfferCount={min:1,max:1};
  run.gameProfile.modules.rewards.offerCount=1;
  run.gameProfile.modules.rewards.rewardGroups=POTION_GROUPS;
  run.gameProfile.modules.shops.itemsPerCategory=1;
  run.gameProfile.modules.shops.priceTable={flask:[1,1]};
  content.shops.trader=null;content.shops.rankUp={stockChancePct:0};content.shops.cardCopy={};
  return run;
};

// Count potion picks per id over many seeded shop stocks (one potion shelf each).
function shopPotionCounts(registries, held, n = 1000) {
  const counts = new Map();
  const run = fresh(registries, 1, held);
  for (let i = 0; i < n; i++) {
    delete run.gameProfileRewardOffers;
    for (const option of gameProfileShopStock(registries, run, createRng(900 + i), { shopId: 'm' }).options) if (option.kind === 'potions') counts.set(option.id, (counts.get(option.id) || 0) + 1);
  }
  return counts;
}
const ratio = counts => {
  const others = [...counts].filter(([id]) => id !== HELD).map(([, c]) => c);
  return { held: counts.get(HELD) || 0, mean: others.reduce((a, b) => a + b, 0) / others.length, kinds: others.length };
};

test('shop stock offers a held potion far less often than an unheld one, but not never', () => {
  const registries = build({'reward-ranks':{ownedPotionWeight:.05}});
  const { held, mean, kinds } = ratio(shopPotionCounts(registries, [HELD]));
  assert.equal(kinds, POTIONS.length-1, 'all controlled unheld kinds are offered');
  assert.ok(held > 0, 'not a forced skip');
  // Expected ratio is 0.05; leave room for sampling noise.
  assert.ok(held / mean < 0.12, `held ${held} vs mean unheld ${mean} (ratio ${held / mean})`);
  console.log(`potion ratio held/unheld = ${(held / mean).toFixed(3)} (held ${held}, mean unheld ${mean.toFixed(1)}, ${kinds} unheld kinds, 1000 shops)`);
  const none = ratio(shopPotionCounts(registries, []));
  assert.ok(none.held / none.mean > 0.7, `nothing held: ${none.held} vs ${none.mean}`);
});
// A controlled potion-only candidate pool isolates held-copy weighting.
test('chests and combat rewards use the same weighting', () => {
  const registries = build({ 'reward-ranks': { ownedPotionWeight:.05 } });
  for (const source of ['treasure', 'combat']) {
    let held = 0, other = 0;
    const run = fresh(registries, 1, [HELD]);
    for (let i = 0; i < 2000; i++) {
      delete run.gameProfileRewardOffers;
      for (const option of gameProfileRewardOffers(registries, run, createRng(40 + i), { offerId: 'o', source }).options) if (option.kind === 'potions') (option.id === HELD ? held++ : other++);
    }
    assert.ok(other > 100, `${source}: potion offers happen (${other})`);
    assert.ok(held / (other / (POTIONS.length-1)) < 0.15, `${source}: held ${held}, other ${other}`);
  }
});
test('nothing held leaves every offer byte-identical to the unweighted pick', () => {
  const weighted = build({'reward-ranks':{ownedPotionWeight:.05}}), uniform = build({ 'reward-ranks': { ownedPotionWeight: 1 } });
  for (let i = 0; i < 150; i++) for (const source of ['combat', 'treasure']) {
    const a = gameProfileRewardOffers(weighted, fresh(weighted, i + 1), createRng(i), { offerId: 'x', source });
    const b = gameProfileRewardOffers(uniform, fresh(uniform, i + 1), createRng(i), { offerId: 'x', source });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  }
});
test('the schema rejects an ownedPotionWeight outside 0..1', () => {
  for (const value of [1.5, -1]) assert.throws(() => build({ 'reward-ranks': { ownedPotionWeight: value } }), /ownedPotionWeight/);
  assert.doesNotThrow(() => build({ 'reward-ranks': { ownedPotionWeight: 0 } }));
});

test('authored held-potion weighting reaches the runtime rule',()=>{const current=build();assert.equal(current.gameProfile.content.rewards.eligibility.combatCards.ownedPotionWeight,JSON.parse(readFileSync(new URL('../engine/modules/reward-ranks/defaults.json',import.meta.url))).ownedPotionWeight);assert.equal(current.gameProfile.content.rewards.eligibility.combatCards.ownedPotionWeight,current.gameProfile.modules['reward-ranks'].ownedPotionWeight);});
