import assert from 'node:assert/strict';
import {test} from 'node:test';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries} from '../src/model/gameProfile.js';
import {createRunState} from '../src/model/state.js';
import {createRng} from '../src/engine/rng.js';
import {gameProfileRewardOffers,claimGameProfileReward,gameProfileShopStock,purchaseGameProfileShopOffer} from '../src/model/gameProfileRewards.js';
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
 const categories=new Set();for(let seed=0;seed<70;seed++){
  const run=fresh(),o=gameProfileRewardOffers(reg,run,createRng(seed),{offerId:'fight'});assert.equal(o.options.length,3);o.options.forEach(row=>categories.add(row.kind));
 }
 assert.deepEqual([...categories].sort(),['armor','combatCards','potions','relics','weaponArts','weapons'].sort());
 const profile=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{rewards:{offerCount:2,takeCount:1}}});
 const r=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile),run=createRunState({seed:1,classId:'reaver',registries:r});
 assert.equal(gameProfileRewardOffers(r,run,createRng(2),{offerId:'fight'}).options.length,2);
});
test('shop stock persists and failed purchases do not debit or grant',()=>{
 const run=fresh(),stock=gameProfileShopStock(reg,run,createRng(12),{shopId:'act1'});assert.equal(stock.options.length,3);assert.equal(stock.price,10);
 run.cinders=0;const before=JSON.stringify(run);assert.throws(()=>purchaseGameProfileShopOffer(reg,run,'act1',0),/Insufficient/);assert.equal(JSON.stringify(run),before);
 run.cinders=100;purchaseGameProfileShopOffer(reg,run,'act1',0);assert.equal(run.cinders,90);
 assert.throws(()=>purchaseGameProfileShopOffer(reg,run,'act1',0),/claimed/);assert.equal(run.cinders,90);
});
