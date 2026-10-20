import assert from 'node:assert/strict';
import {test} from 'node:test';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries} from '../src/model/gameProfile.js';
import {createRunState} from '../src/model/state.js';
import {createRng} from '../src/engine/rng.js';
import {gameProfileRewardOffers,claimGameProfileReward,gameProfileShopStock,purchaseGameProfileShopOffer} from '../src/model/gameProfileRewards.js';
import { missingBasicStances } from '../src/model/stanceCoverage.js';
const p=resolveGameProfile('core'),reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,p)),p);
const fresh=()=>createRunState({seed:1,classId:'reaver',registries:reg});
test('mixed reward is stable across reload, choose one once, card acquisition does not edit deck',()=>{
 const run=fresh(),rng=createRng(19),deck=structuredClone(run.deck);
 const offer=gameProfileRewardOffers(reg,run,rng,{offerId:'level1',source:'level'});
 assert.equal(offer.options.length,3);assert.ok(offer.options.every(row=>row.kind==='combatCards'));
 const restored=structuredClone(run),counts=rng.getCounters();
 assert.deepEqual(gameProfileRewardOffers(reg,restored,rng,{offerId:'level1',source:'level'}),offer);assert.deepEqual(rng.getCounters(),counts);
 claimGameProfileReward(reg,run,'level1',0);assert.deepEqual(run.deck,deck);assert.equal(run.sideboard.length,1);
 assert.throws(()=>claimGameProfileReward(reg,run,'level1',1),/claimed/);
});
test('all six categories can occur and configured count overrides apply',()=>{
 const categories=new Set();for(let seed=0;seed<300;seed++){
  const run=fresh(),o=gameProfileRewardOffers(reg,run,createRng(seed),{offerId:'fight'});assert.equal(o.options.length,3);o.options.forEach(row=>categories.add(row.kind));
 }
 assert.deepEqual([...categories].sort(),['armor','combatCards','potions','relics','weaponArts','weapons'].sort());
 const profile=resolveGameProfile({formatVersion:1,core:'ashen.core@2.0.0',modules:{rewards:{offerCount:2,takeCount:1}}});
 const r=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile),run=createRunState({seed:1,classId:'reaver',registries:r});
 assert.equal(gameProfileRewardOffers(r,run,createRng(2),{offerId:'fight'}).options.length,2);
});
test('shop stock persists and failed purchases do not debit or grant',()=>{
 const run=fresh(),stock=gameProfileShopStock(reg,run,createRng(12),{shopId:'act1'});assert.equal(stock.options.length,16);assert.equal(stock.price,10);
 const counts=Object.groupBy(stock.options,row=>row.kind);
 for(const kind of ['weapons','armor','relics','potions','combatCards'])assert.equal(counts[kind].length,3,kind);
 assert.equal(counts.weaponArts.length,1,'only one eligible authored art');
 const counters=createRng(71);const beforeCounters=counters.getCounters();
 assert.deepEqual(gameProfileShopStock(reg,structuredClone(run),counters,{shopId:'act1'}),stock);assert.deepEqual(counters.getCounters(),beforeCounters);
 run.cinders=0;const before=JSON.stringify(run);assert.throws(()=>purchaseGameProfileShopOffer(reg,run,'act1',0),/Insufficient/);assert.equal(JSON.stringify(run),before);
 run.cinders=100;purchaseGameProfileShopOffer(reg,run,'act1',0);assert.equal(run.cinders,90);
 assert.throws(()=>purchaseGameProfileShopOffer(reg,run,'act1',0),/claimed/);assert.equal(run.cinders,90);
});

test('owned basic cards are never offered; most card offers are rank 1+ (owner 2026-10-17)',()=>{
 const rules=p.content.rewards.eligibility.combatCards;
 const rankOf=id=>{const card=p.content.cards.find(c=>c.id===id);return Number.isSafeInteger(card.rank)?card.rank:rules.rankOfRarity[card.rarity]??1;};
 let total=0,low=0;
 for(let seed=0;seed<120;seed++){
  const run=fresh(),owned=new Set(run.deck.map(c=>c.cardId));
  const o=gameProfileRewardOffers(reg,run,createRng(seed),{offerId:`level${seed}`,source:'level'});
  // The reserved missing-stance slot(s) are deliberately basic/cantrip (owner 2026-10-19; stanceCoverage tests own that); the 0.25 cap measures the ordinary draws.
  const reserved=missingBasicStances(run,reg).length?Math.min(rules.stanceCoverage?.reservedSlots??0,o.options.length):0;
  for(const row of o.options.slice(reserved)){
   total++;
   if(rankOf(row.id)<rules.minRank){low++;assert.ok(!owned.has(row.id),`seed ${seed}: owned basic ${row.id} offered`);}
  }
 }
 assert.ok(total>0);
 assert.ok(low/total<0.25,`rank-0 share ${low}/${total} should be small`);
});
