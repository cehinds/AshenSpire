import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickRewardCategory, rewardGroupProblems } from '../engine/kernel/rewardPolicy.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileRewardOffers, gameProfileShopStock } from '../src/model/gameProfileRewards.js';

const rules = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/rewards.json', import.meta.url)));
const groupOf = kind => rules.rewardGroups.find(group => group.categories.includes(kind)).id;
test('authored 66/4/20/10 card, weapon-art, potion, weapon groups govern seeded draws, including exhausted-group renormalization', () => {
  assert.deepEqual(rewardGroupProblems(rules.rewardGroups, rules.categories), []);
  const rng = createRng(417), counts = { cards: 0, weaponArts: 0, potions: 0, weapons: 0, retired: 0 }, total = 30000;
  for (let i = 0; i < total; i++) { const group = groupOf(pickRewardCategory(rng, 'cardRewards', rules.categories, rules.rewardGroups)); counts[group === 'flaskRelic' ? 'potions' : group]++; } // the flask relic sits inside the 20% potions share
  for (const [kind, fraction] of Object.entries({cards: .66, weaponArts: .04, potions: .2, weapons: .1, retired: 0})) assert.ok(Math.abs(counts[kind] / total - fraction) < .012, JSON.stringify(counts));
  // After all weapons are exhausted, 66:4:20 renormalizes (cards 66/90).
  const remaining = rules.categories.filter(kind => groupOf(kind) !== 'weapons');
  let cards = 0;
  for (let i = 0; i < total; i++) if (groupOf(pickRewardCategory(rng, 'cardRewards', remaining, rules.rewardGroups)) === 'cards') cards++;
  assert.ok(Math.abs(cards / total - 66 / 90) < .012);
  assert.equal(pickRewardCategory(rng, 'cardRewards', [], rules.rewardGroups), null);
  assert.equal(pickRewardCategory(rng, 'cardRewards', ['potions'], [{id:'off',weight:0,categories:['potions']}]), null);
});
test('reward policy rejects missing, duplicate, negative and unknown group assignments', () => {
  for (const groups of [rules.rewardGroups.slice(1), [...rules.rewardGroups, rules.rewardGroups[0]], [{id:'bad',weight:-1,categories:rules.categories}], [{id:'bad',weight:1,categories:['invented']}], rules.rewardGroups.map(group => ({...group,weight:0}))]) {
    assert.ok(rewardGroupProblems(groups, rules.categories).length);
    assert.throws(() => resolveGameProfile({formatVersion:1,core:'ashen.core@2.0.0',modules:{rewards:{rewardGroups:groups}}}), /rewardGroups|weight/);
  }
});
test('JSON tuning reaches live offers; exhausted pools fall back and saved offers consume no more RNG', () => {
  const groups=rules.rewardGroups.map(group=>({...group,weight:group.id==='potions'?1:0}));
  const profile=resolveGameProfile({formatVersion:1,core:'ashen.core@2.0.0',modules:{rewards:{offerCount:100,rewardGroups:groups},shops:{itemsPerCategory:2}}});
  const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
  const run=createRunState({seed:1,classId:'reaver',registries:reg}), rng=createRng(31);
  const offer=gameProfileRewardOffers(reg,run,rng,{offerId:'combat'});
  assert.ok(offer.options.length>0 && offer.options.length<100);
  assert.ok(offer.options.every(row=>row.kind==='potions'));
  assert.equal(new Set(offer.options.map(row=>row.id)).size,offer.options.length);
  const counters=rng.getCounters();
  assert.deepEqual(gameProfileRewardOffers(reg,structuredClone(run),rng,{offerId:'combat'}),offer);
  assert.deepEqual(rng.getCounters(),counters);
  const shop=gameProfileShopStock(reg,run,rng,{shopId:'one'});
  for(const rows of Object.values(Object.groupBy(shop.options,row=>row.kind))) assert.ok(rows.length<=2);
  assert.equal(shop.options.filter(row=>row.kind==='potions').length,2);
  assert.ok(shop.options.some(row=>row.kind==='weapons'),'combat weights do not restrict shop shelves');
  assert.equal(rng.getCounters().cardRewards,counters.cardRewards,'shop uses its own RNG stream');
});
test('older shop snapshots retain their total count and cardRewards stream', () => {
  const profile=resolveGameProfile('core');
  const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
  const run=createRunState({seed:1,classId:'reaver',registries:reg});
  delete run.gameProfile.modules.shops.itemsPerCategory;
  delete run.gameProfile.content.shops.itemsPerCategory;
  delete run.gameProfile.content.shops.priceTable;   // an older snapshot also predates per-offer prices (no shop-stream draws)
  const rng=createRng(71), before=rng.getCounters();
  const stock=gameProfileShopStock(reg,run,rng,{shopId:'legacy-snapshot'});
  assert.equal(stock.options.length,3);
  assert.equal(rng.getCounters().shop,before.shop);
  assert.ok(rng.getCounters().cardRewards>before.cardRewards);
});
