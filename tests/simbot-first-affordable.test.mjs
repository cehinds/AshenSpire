import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState} from '../src/model/state.js';
import {createRunCombat} from '../src/engine/runCombat.js';
import {createRng} from '../src/engine/rng.js';
import {dispatch,cardChoicePlan} from '../src/engine/combat.js';
import {serializeCombatSnapshot} from '../src/engine/combatSnapshot.js';
import {botCardTargetId,affordableCards,firstAffordableCard,refusalsFor} from '../tools/simbot.mjs';

const reg=createRegistries(contentBundle);
function combatFor(classId,enemyIds,seed){
  const run=createRunState({seed:1,classId,registries:reg});
  return createRunCombat({registries:reg,run,rng:createRng(seed),enemyIds});
}
function fight(classId,enemyIds,seed,select){
  const combat=combatFor(classId,enemyIds,seed),decisions=[];
  let guard=0;
  while(!combat.result&&guard++<8000&&combat.turn<=150){
    if(combat.pendingReaction){const offerId=combat.pendingReaction.id;decisions.push(['skipReaction',offerId]);dispatch(combat,{type:'chooseReaction',offerId,optionId:null});continue;}
    const refused=refusalsFor(combat),card=select(reg,combat,refused);
    if(!card){decisions.push(['endTurn']);dispatch(combat,{type:'endTurn'});continue;}
    const targetId=botCardTargetId(reg,combat,card,combat.enemies.find(enemy=>enemy.alive)?.id);
    const choice=cardChoicePlan(combat,card.instanceId)?.options[0]?.id;
    try{dispatch(combat,{type:'playCard',cardInstanceId:card.instanceId,targetId,choice});decisions.push(['play',card.instanceId,targetId,choice]);}
    catch(error){assert.doesNotMatch(error.message,/Invalid (?:enemy|friendly|self|ally) target/,'the first-affordable bot must offer a valid destination');refused.add(card.instanceId);decisions.push(['refused',card.instanceId,error.message]);}
  }
  assert.ok(guard<8000,'the bot decision loop stays bounded');
  return {decisions,snapshot:serializeCombatSnapshot(combat)};
}

test('short-circuit selection preserves full decisions, RNG and combat state across all four starting classes',()=>{
  for(const {id:classId} of reg.classes.all())for(const encounterId of ['loneSoldier','patrol','packHunt'])for(const seed of [11,41]){
    const enemies=reg.encounters.get(encounterId).enemies;
    const eager=fight(classId,enemies,seed,(r,c,refused)=>affordableCards(r,c,refused)[0]);
    const lazy=fight(classId,enemies,seed,firstAffordableCard);
    assert.deepEqual(lazy,eager,`${classId}/${encounterId}/${seed}: every decision and final state must remain identical`);
  }
});

test('first-match search avoids later exact cost previews and still respects refusals and exhausted Actions',()=>{
  const combat=combatFor('reaver',['wanderingSoldier'],11);
  let previews=0;
  const emit=combat._emitEvent;
  combat._emitEvent=(ctx,type,payload)=>{if(type==='cardPreparing')previews++;return emit(ctx,type,payload);};
  const before=serializeCombatSnapshot(combat),eager=affordableCards(reg,combat),allPreviews=previews;
  assert.ok(eager.length>1,'the live opening hand has several affordable alternatives');
  previews=0;
  assert.equal(firstAffordableCard(reg,combat),eager[0]);
  assert.equal(previews,1,'the first affordable card requires only its own exact preview');
  assert.ok(previews<allPreviews,'later hand cards are not cloned to price an unused choice');
  assert.deepEqual(serializeCombatSnapshot(combat),before,'searches preserve live state and RNG');
  const refused=new Set([eager[0].instanceId]);
  assert.equal(firstAffordableCard(reg,combat,refused),affordableCards(reg,combat,refused)[0]);
  combat.player.energy=0;
  assert.equal(firstAffordableCard(reg,combat),affordableCards(reg,combat)[0]);
});
