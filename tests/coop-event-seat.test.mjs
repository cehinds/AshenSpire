import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRng} from '../src/engine/rng.js';
import {createCoopCombat,playCard,endTurn} from '../src/engine/coopCombat.js';
import {createCombat,dispatch} from '../src/engine/combat.js';
import {emitEvent} from '../src/engine/triggers.js';

const reg=createRegistries({...contentBundle,enemies:contentBundle.enemies.map(enemy=>enemy.id==='wanderingSoldier'
  ? {...enemy,hp:[10000,10000],moves:{strike:{intent:'attack',weight:1,damage:3,effects:[{op:'applyStatus',target:'player',status:'weak',stacks:1}]}}}
  : enemy)});
const refs=ids=>ids.map(cardId=>({instanceId:cardId,cardId,upgraded:false,...(cardId==='quickCut'?{abilityRank:2}:{})}));
const player=(id,cards)=>({id,classId:'herald',hp:80,maxHp:100,mana:20,maxMana:20,stamina:10,maxStamina:10,energyMax:10,drawPerTurn:5,relicIds:[],flasks:[],deck:refs(cards)});
const coop=()=>createCoopCombat({registries:reg,rng:createRng(11),players:[player('p1',['ashOath','sharedFlame','smokePellet','quickCut']),player('p2',['flagellation'])],enemyIds:['wanderingSoldier']});

test('transactional ally and self effects retain actual co-op target seats in the shared event bus',()=>{
  const combat=coop();
  const oath=playCard(combat,'p1','ashOath','p2').events.filter(event=>event.type==='statusApplied'&&event.status==='strength');
  assert.deepEqual(oath.map(event=>[event.targetId,event.targetPlayerId,event.playerId,event.total]),[['player','p2','p2',2],['player','p1','p1',1]]);
  const healed=playCard(combat,'p1','sharedFlame','p2').events.find(event=>event.type==='healed');
  assert.equal(healed.amount,7);assert.equal(healed.targetPlayerId,'p2');assert.equal(healed.playerId,'p2','an inactive ally receives its own healing receipt');
  const readiness=playCard(combat,'p1','smokePellet').events.find(event=>event.type==='statusApplied'&&event.status==='prepared');
  assert.equal(readiness.playerId,'p1');assert.equal(readiness.targetPlayerId,'p1');
  const consumed=playCard(combat,'p1','quickCut',combat.enemies[0].id).events.find(event=>event.type==='statusExpired'&&event.status==='prepared');
  assert.equal(consumed.playerId,'p1','transactional readiness consumption keeps the active seat');
  const blood=playCard(combat,'p2','flagellation',combat.enemies[0].id).events.find(event=>event.type==='hpLost');
  assert.ok(blood.amount>0);assert.equal(blood.playerId,'p2');assert.equal(blood.targetPlayerId,'p2');
});

test('a real enemy phase attributes damage, HP loss and statuses to each attacked seat',()=>{
  const combat=coop(),before=combat.eventLog.length;
  endTurn(combat,'p1');endTurn(combat,'p2');
  const events=combat.eventLog.slice(before);
  for(const type of ['damageDealt','hpLost','statusApplied']){
    const hits=events.filter(event=>event.type===type&&event.targetId==='player');
    assert.equal(hits.length,2,`${type}: both players are attacked`);
    assert.deepEqual(hits.map(event=>event.playerId).sort(),['p1','p2']);
    for(const event of hits)assert.equal(event.playerId,event.targetPlayerId);
  }
  const expired=events.filter(event=>event.type==='statusExpired'&&event.targetId==='player');
  for(const event of expired)assert.ok(['p1','p2'].includes(event.playerId));
});

test('canonical seat precedence is explicit owner, explicit target, then active seat; solo shape stays unchanged',()=>{
  const combat=coop();
  const explicit=emitEvent(combat,'healed',{targetId:'player',playerId:'p2',targetPlayerId:'p1',amount:0});
  assert.equal(explicit.playerId,'p2','an explicit receipt owner is preserved');
  const target=emitEvent(combat,'statusExpired',{targetId:'player',targetPlayerId:'p2',status:'prepared'});
  assert.equal(target.playerId,'p2');
  const active=emitEvent(combat,'statusExpired',{targetId:'player',status:'prepared'});
  assert.equal(active.playerId,combat.playerKey);
  const enemy=emitEvent(combat,'statusExpired',{targetId:combat.enemies[0].id,status:'prepared'});
  assert.equal(Object.hasOwn(enemy,'playerId'),false,'enemy-targeted events do not acquire seat ownership');
  const solo=createCombat({registries:reg,rng:createRng(11),player:player('unused',['smokePellet']),enemyIds:['wanderingSoldier']});
  const event=dispatch(solo,{type:'playCard',cardInstanceId:'smokePellet'}).events.find(event=>event.type==='statusApplied'&&event.status==='prepared');
  assert.equal(event.targetId,'player');assert.equal(Object.hasOwn(event,'playerId'),false,'solo event payloads remain unchanged');
});
