import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState} from '../src/model/state.js';
import {createRunCombat} from '../src/engine/runCombat.js';
import {createCombat,cardPlayCosts,dispatch,cardChoicePlan} from '../src/engine/combat.js';
import {createCoopCombat} from '../src/engine/coopCombat.js';
import {createRng} from '../src/engine/rng.js';
import {emitEvent,hasEventTriggers} from '../src/engine/triggers.js';
import {serializeCombatSnapshot} from '../src/engine/combatSnapshot.js';
import {grantAbilityCharge} from '../src/engine/abilityRiders.js';
import {botCardTargetId,firstAffordableCard,refusalsFor} from '../tools/simbot.mjs';

const base=createRegistries(contentBundle);
const charge={op:'grantCardCharge',target:'self',key:'cost-probe',manaDiscount:2};
const mount=triggers=>({kind:'feat',id:'cost-probe',instanceId:'cost-probe',rules:[{tag:'probe',triggers}]});
function fixture(coop=false){
  const def={...base.cards.get('stigmataCard'),cost:3,manaCost:4,effects:[{op:'block',target:'self',amount:1}],upgrade:{}};
  const registries={...base,cards:{...base.cards,get:id=>id==='stigmataCard'?def:base.cards.get(id)}};
  const player={id:'a',classId:'herald',hp:80,maxHp:80,mana:10,maxMana:10,stamina:10,maxStamina:10,energyMax:10,drawPerTurn:1,relicIds:[],deck:[{instanceId:'probe',cardId:'stigmataCard',upgraded:false}]};
  return coop?createCoopCombat({registries,rng:createRng(11),players:[player,{...player,id:'b'}],enemyIds:['wanderingSoldier']}):createCombat({registries,rng:createRng(11),player,enemyIds:['wanderingSoldier']});
}
function clonePrice(combat,id){
  const saved=combat._emitEvent;
  combat._emitEvent=(...args)=>saved(...args); // Same bus; unknown identity forces the original detached path.
  try{return cardPlayCosts(combat,id);}finally{combat._emitEvent=saved;}
}
function combatData(combat){
  // Paused/queued fixtures cannot be saved mid-resolution. Compare their
  // entire mutable combat graph, including that queue, rather than a save.
  return structuredClone(Object.fromEntries(Object.entries(combat).filter(([key,value])=>typeof value!=='function'&&!['registries','rng'].includes(key))));
}
function assertPureEqual(combat){
  const before=combatData(combat),rng=combat.rng.getCounters();
  const expected=clonePrice(combat,'probe'),actual=cardPlayCosts(combat,'probe');
  assert.deepEqual(actual,expected);assert.deepEqual(combatData(combat),before);assert.deepEqual(combat.rng.getCounters(),rng);
  return actual;
}

test('no-listener pricing retains live charge discounts and passive costs with exact clone parity',()=>{
  for(const coop of [false,true]){
    const combat=fixture(coop),key=coop?combat.playerKey:'player';
    combat.propertyMounts[key] ||= {};
    combat.propertyMounts[key].probe={...mount([]),rules:[{tag:'probe',passives:{powerCostReduction:1}}]};
    grantAbilityCharge(combat.player,charge);
    assert.equal(hasEventTriggers(combat,'cardPreparing'),false);
    assert.deepEqual(assertPureEqual(combat),{energy:2,mana:2,stamina:2});
    assert.ok(combat.player.abilityRiders.charges['cost-probe'],'a price never consumes its charge');
  }
});

test('preparing properties, status hooks, stances, enemy phases and inactive co-op mounts all retain detached pricing',()=>{
  const cases=[
    combat=>{combat.propertyMounts.player ||= {};combat.propertyMounts.player.probe=mount([{on:'cardPreparing',do:[charge]}]);},
    combat=>{const statuses=combat.registries.statuses;combat.registries={...combat.registries,statuses:{...statuses,get:id=>id==='prepared'?{...statuses.get(id),hooks:[{on:'cardPreparing',do:[charge]}]}:statuses.get(id)}};combat.player.statuses.prepared={stacks:1};},
    combat=>{const stances=combat.registries.stances;combat.registries={...combat.registries,stances:{...stances,get:id=>({...stances.get(id),hooks:[{on:'cardPreparing',do:[charge]}]})}};combat.player.stanceId='bulwark';},
    combat=>{const enemies=combat.registries.enemies;combat.registries={...combat.registries,enemies:{...enemies,get:id=>({...enemies.get(id),phases:[{on:'cardPreparing',do:[]}]})}};},
  ];
  for(const setup of cases){const combat=fixture();setup(combat);assert.equal(hasEventTriggers(combat,'cardPreparing'),true);assertPureEqual(combat);}
  const discount=fixture();discount.propertyMounts.player ||= {};discount.propertyMounts.player.probe=mount([{on:'cardPreparing',do:[charge]}]);
  assert.equal(assertPureEqual(discount).mana,2,'an enqueued preparing discount affects the exact cost');
  const coop=fixture(true),inactive=[...coop.players.keys()].find(id=>id!==coop.playerKey);
  coop.propertyMounts[inactive] ||= {};coop.propertyMounts[inactive].probe=mount([{on:'cardPreparing',do:[charge]}]);
  assert.equal(hasEventTriggers(coop,'cardPreparing'),true,'inactive seat listeners conservatively retain the full bus');assertPureEqual(coop);
});

test('queued work, paused discard and unknown buses keep clone semantics without mutating live state',()=>{
  const queued=fixture();queued.queue.push({effect:charge,source:queued.player,owner:queued.player,target:queued.player,meta:{}});
  assert.equal(assertPureEqual(queued).mana,2,'the existing queue is priced only in the candidate');
  const paused=fixture();paused.pendingAbilityDiscard={count:1};paused.queue.push({effect:charge,source:paused.player,owner:paused.player,target:paused.player,meta:{}});
  assert.equal(assertPureEqual(paused).mana,4,'a paused discard does not drain its queue');
  const custom=fixture();custom._emitEvent=(ctx,type,payload)=>{if(type==='cardPreparing')grantAbilityCharge(ctx.player,charge);return emitEvent(ctx,type,payload);};
  assert.equal(assertPureEqual(custom).mana,2,'unknown bus effects still participate in exact pricing');
  for(const terminal of ['player','enemies','result']){
    const combat=fixture();
    if(terminal==='player')combat.player.alive=false;
    else if(terminal==='enemies')for(const enemy of combat.enemies)enemy.alive=false;
    else combat.result='victory';
    assertPureEqual(combat);
  }
  const terminal=fixture();for(const enemy of terminal.enemies)enemy.alive=false;
  terminal.foundation={rules:{triggers:{maxEvents:1,maxDepth:64}},profiles:{},actionSerial:0,eventSerial:0,eventCount:0,counts:{},rolls:{}};
  const before=combatData(terminal);
  assert.throws(()=>clonePrice(terminal,'probe'),/combat event limit exceeded/);
  assert.throws(()=>cardPlayCosts(terminal,'probe'),/combat event limit exceeded/,'terminal endCheck still emits and validates combatEnd in the candidate');
  assert.deepEqual(combatData(terminal),before);
});

function trace(classId,encounterId,seed,forceClone){
  const run=createRunState({seed:1,classId,registries:base}),combat=createRunCombat({registries:base,run,rng:createRng(seed),enemyIds:base.encounters.get(encounterId).enemies});
  if(forceClone)combat._emitEvent=(...args)=>emitEvent(...args);
  const decisions=[];let guard=0;
  while(!combat.result&&combat.turn<=150&&guard++<8000){
    if(combat.pendingReaction){const offerId=combat.pendingReaction.id;decisions.push(['skipReaction',offerId]);dispatch(combat,{type:'chooseReaction',offerId,optionId:null});continue;}
    const refused=refusalsFor(combat),card=firstAffordableCard(base,combat,refused);
    if(!card){decisions.push(['endTurn']);dispatch(combat,{type:'endTurn'});continue;}
    const targetId=botCardTargetId(base,combat,card,combat.enemies.find(enemy=>enemy.alive)?.id),choice=cardChoicePlan(combat,card.instanceId)?.options[0]?.id;
    try{dispatch(combat,{type:'playCard',cardInstanceId:card.instanceId,targetId,choice});decisions.push(['play',card.instanceId,targetId,choice]);}
    catch(error){assert.doesNotMatch(error.message,/Invalid (?:enemy|friendly|self|ally) target/,'the cost-parity bot must offer a valid destination');refused.add(card.instanceId);decisions.push(['refused',card.instanceId,error.message]);}
  }
  assert.ok(guard<8000);return {decisions,snapshot:serializeCombatSnapshot(combat),rng:combat.rng.getCounters()};
}
test('actual fights preserve every decision and complete saved state versus the original eager detached cost path',()=>{
  for(const {id} of base.classes.all())for(const encounter of ['patrol','eliteWyrm','bossOmen'])for(const seed of [11,41])assert.deepEqual(trace(id,encounter,seed,false),trace(id,encounter,seed,true),`${id}/${encounter}/${seed}`);
});
