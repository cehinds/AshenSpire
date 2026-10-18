import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { candidateState } from '../src/engine/combatRules.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
function live() {
  const gameProfile=resolveGameProfile('core');
  const registries=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,gameProfile)),gameProfile);
  const combat=createCombat({registries,rng:createRng(311),gameProfile,enemyIds:['wanderingSoldier'],
    player:{classId:'reaver',maxHp:100,hp:100,maxStamina:10,stamina:10,maxMana:5,mana:5,energyMax:10,drawPerTurn:5,poiseMax:4,
      attributes:{intelligence:1,strength:2,dexterity:1},deck:Array.from({length:10},(_,i)=>({instanceId:`core-${i}`,cardId:i<6?'core.strike':'core.defend',upgraded:false}))}});
  return {combat,registries};
}
test('real create/restore own immutable profiles while serialized snapshots remain detached and tamper checked',()=>{
  const {combat,registries}=live(),candidate=candidateState(combat,{detached:true});
  assert.equal(candidate.gameProfile,combat.gameProfile,'actual Core candidate must take the measured sharing path');
  assert.throws(()=>{candidate.gameProfile.modules.cards.handBase=50;},TypeError);
  const snapshot=serializeCombatSnapshot(combat);
  assert.notEqual(snapshot.gameProfile,combat.gameProfile);assert.equal(Object.isFrozen(snapshot.gameProfile),false);
  const restored=restoreCombatSnapshot({registries,snapshot,rng:createRng(combat.rng.seed),expectedGameProfile:combat.gameProfile});
  assert.equal(candidateState(restored,{detached:true}).gameProfile,restored.gameProfile);
  assert.deepEqual(serializeCombatSnapshot(restored),snapshot);
  snapshot.gameProfile.modules.cards.handBase=50;
  assert.throws(()=>restoreCombatSnapshot({registries,snapshot,rng:createRng(combat.rng.seed),expectedGameProfile:combat.gameProfile}),/digest mismatch/);
  assert.notEqual(combat.gameProfile.modules.cards.handBase,50);
});
test('owned sharing and unbranded cloning have identical real preview, outcome, events and RNG',()=>{
  const fast=live(),slow=live();slow.combat.gameProfile=structuredClone(slow.combat.gameProfile);
  assert.equal(candidateState(fast.combat,{detached:true}).gameProfile,fast.combat.gameProfile);
  assert.notEqual(candidateState(slow.combat,{detached:true}).gameProfile,slow.combat.gameProfile);
  const before=serializeCombatSnapshot(fast.combat),counters=fast.combat.rng.getCounters();
  const card=fast.combat.piles.hand.find(x=>x.cardId==='core.strike'),target=fast.combat.enemies[0].id;
  assert.deepEqual(previewCard(fast.combat,card.instanceId,target),previewCard(slow.combat,card.instanceId,target));
  assert.deepEqual(serializeCombatSnapshot(fast.combat),before);assert.deepEqual(fast.combat.rng.getCounters(),counters);
  const intent={type:'playCard',cardInstanceId:card.instanceId,targetId:target};
  assert.deepEqual(dispatch(fast.combat,intent),dispatch(slow.combat,intent));
  assert.deepEqual(serializeCombatSnapshot(fast.combat),serializeCombatSnapshot(slow.combat));
  assert.deepEqual(fast.combat.rng.getCounters(),slow.combat.rng.getCounters());
});

test('restore retains profile descendant aliases in the one owned snapshot graph',()=>{
  const {combat,registries}=live(),snapshot=serializeCombatSnapshot(combat);
  snapshot.enemies[0].profileAlias=snapshot.gameProfile.modules;
  const restored=restoreCombatSnapshot({registries,snapshot,rng:createRng(combat.rng.seed),expectedGameProfile:combat.gameProfile});
  assert.equal(restored.enemies[0].profileAlias,restored.gameProfile.modules);
  assert.notEqual(restored.enemies[0].profileAlias,snapshot.gameProfile.modules);
  const candidate=candidateState(restored,{detached:true});
  assert.notEqual(candidate.gameProfile,restored.gameProfile,'profile alias requires full one-graph clone');
  assert.equal(candidate.enemies[0].profileAlias,candidate.gameProfile.modules);
});
