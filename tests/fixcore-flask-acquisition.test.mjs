import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createMemoryStorage, createSaveManager } from '../src/engine/save.js';
import { acquireFlask, chargeFlaskId, flaskAcquisitionPlan, reallocateFlaskCharges, utilityFlaskIds } from '../src/model/gracerefill.js';
import { claimGameProfileReward, gameProfileShopPurchasePlan, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';
import { rewardPlan } from '../src/model/rewardplan.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { rewardDom } from './helpers/reward-dom.mjs';

const profile=resolveGameProfile('core');
const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
const fresh=()=>createRunState({seed:16,classId:'reaver',registries:reg});
const hp=chargeFlaskId(reg,'hp'), mana=chargeFlaskId(reg,'mana'), utility=utilityFlaskIds(reg)[0];
const offer=(id,flaskId,source='combat')=>({id,source,options:[{kind:'potions',id:flaskId}],takeCount:1,taken:[],claimed:null,...(source==='shop'?{price:10}:{})});

test('charge acquisition bypasses full utility belt and grows the reallocation ledger exactly once per claim',()=>{
  const run=fresh(), before=structuredClone(run.flaskCharges);
  run.flasks=Array.from({length:reg.balance.flaskSlots},()=>({flaskId:utility}));
  run.gameProfileRewardOffers={reward:offer('reward',hp)};
  const plan=flaskAcquisitionPlan(reg,run,hp);
  assert.equal(plan.ok,true);assert.equal(plan.kind,'capacity');
  assert.equal(rewardPlan({flaskId:hp},{flaskSlotsFree:0,flaskCanAcquire:plan.ok}).rows[0].blockedBy,null);
  claimGameProfileReward(reg,run,'reward',0);
  assert.equal(run.flaskCharges.capacity,before.capacity+1);
  assert.equal(run.flaskCharges.hp,before.hp+1);
  assert.equal(run.flaskCharges.hpCurrent,before.hpCurrent+1);
  assert.equal(run.flaskCharges.granted,before.granted+1);
  assert.deepEqual(run.flaskCharges.grown,before.grown);
  assert.equal(run.flasks.length,reg.balance.flaskSlots);
  const after=JSON.stringify(run);
  assert.throws(()=>claimGameProfileReward(reg,run,'reward',0),/claimed/);
  assert.equal(JSON.stringify(run),after);
  reallocateFlaskCharges(run.flaskCharges,{hp:0,mana:run.flaskCharges.capacity});
  assert.equal(run.flaskCharges.mana,before.capacity+1);
});
test('capacity shop pickup debits once, persists through reload, and refused purchases leave ledgers untouched',()=>{
  const run=fresh(), before=structuredClone(run.flaskCharges);
  run.cinders=20;run.gameProfileRewardOffers={'shop:one':offer('shop:one',mana,'shop')};
  const quote=gameProfileShopPurchasePlan(reg,run,'one',0);
  const bought=purchaseGameProfileShopOffer(reg,run,'one',0,null,quote);
  assert.equal(run.cinders,10);assert.equal(run.flaskCharges.mana,before.mana+1);
  const after=JSON.stringify(run);
  assert.equal(bought.replacement?.kind,'potions');
  assert.throws(()=>purchaseGameProfileShopOffer(reg,run,'one',0,null,quote),/changed/);
  assert.equal(JSON.stringify(run),after);
  const saves=createSaveManager(createMemoryStorage());saves.saveRun(run,null);
  const restored=saves.loadRun(reg);
  assert.ok(restored,JSON.stringify(saves.runStatus()));assert.deepEqual(restored.flaskCharges,run.flaskCharges);
  run.gameProfileRewardOffers['shop:poor']=offer('shop:poor',hp,'shop');run.cinders=0;
  const poor=JSON.stringify(run);
  assert.throws(()=>purchaseGameProfileShopOffer(reg,run,'poor',0),/Insufficient/);assert.equal(JSON.stringify(run),poor);
});
test('utility pickups remain inventory, old snapshots retain charge-inventory policy, and bad ledgers fail atomically',()=>{
  const run=fresh(), before=structuredClone(run.flaskCharges);
  assert.equal(acquireFlask(reg,run,utility).kind,'consumable');assert.deepEqual(run.flaskCharges,before);
  run.flasks=Array.from({length:reg.balance.flaskSlots},()=>({flaskId:utility}));
  const full=JSON.stringify(run);assert.equal(acquireFlask(reg,run,utility).ok,false);assert.equal(JSON.stringify(run),full);
  run.flasks=[];delete run.gameProfile.modules.resources.chargeFlaskCapacityPerPickup;
  assert.equal(acquireFlask(reg,run,hp).kind,'consumable');assert.deepEqual(run.flaskCharges,before);
  run.gameProfile.modules.resources.chargeFlaskCapacityPerPickup=2;
  run.flaskCharges.granted++;
  const corrupt=JSON.stringify(run);
  assert.equal(acquireFlask(reg,run,mana).ok,false);assert.equal(JSON.stringify(run),corrupt);
  run.flaskCharges.granted--;
  assert.equal(acquireFlask(reg,run,mana).amount,2);
  assert.equal(run.flaskCharges.capacity,before.capacity+2,'JSON pickup tuning reaches the actual ledger');
});
test('reward screen rolls back a capacity pickup when saving fails, then permits one retry',()=>{
  const dom={...rewardDom(),customElements:{get:()=>true},NodeFilter:{SHOW_TEXT:4,FILTER_SKIP:3,FILTER_ACCEPT:1}}, saved=Object.fromEntries(Object.keys(dom).map(key=>[key,globalThis[key]]));
  Object.assign(globalThis,dom);
  try {
    document.documentElement=document.createElement('html');
    document.createTreeWalker=()=>({nextNode:()=>null});
    const element=Object.getPrototypeOf(document.createElement('div'));
    element.insertAdjacentHTML=function(position,html){
      assert.equal(position,'afterbegin');
      const fragment=document.createElement('div');fragment.innerHTML=html;
      for(const child of [...fragment.children])this.appendChild(child);
    };
    const run=fresh(), before=structuredClone(run.flaskCharges), checkpoint={states:{}};
    let fail=true;
    const app=document.createElement('main');document.body.append(app);
    mountRewards(app,{registries:reg,run,rewards:{flaskId:hp},checkpoint,onDone(){},onPersist(){if(fail)throw new Error('disk full');}});
    app.querySelector('[data-kind="flask"]').click();
    const take=app.querySelector('#reward-detail-take');assert.ok(take);
    assert.throws(()=>take.click(),/disk full/);
    assert.deepEqual(run.flaskCharges,before);assert.deepEqual(checkpoint.states,{});
    fail=false;take.click();
    assert.equal(run.flaskCharges.capacity,before.capacity+1);assert.equal(checkpoint.states.flask,'taken');
    take.click();assert.equal(run.flaskCharges.capacity,before.capacity+1);
  } finally {for(const [key,value] of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
