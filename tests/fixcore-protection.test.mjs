import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction, previewExpandedActions } from '../src/engine/combatExpansionActions.js';
import { executeAction, gainBlock } from '../src/engine/actions.js';
import { fixCoreRules, protectionReceipt } from '../src/model/fixCoreMechanics.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

function fixture(kind, points=20) {
  const combat=createCombat({registries:createRegistries(contentBundle),rng:createRng(901),combatExpansionVersion:2,
    enemyIds:['wanderingSoldier'],player:{classId:'starseer',maxHp:100,hp:100,maxMana:10,mana:10,maxStamina:10,stamina:10,energyMax:10,drawPerTurn:1,deck:[]}});
  combat.fixCoreRules=structuredClone(fixCoreRules(combat));
  const target=combat.enemies[0];
  Object.assign(target,{hp:100,maxHp:100,block:0,barrier:0,statuses:{},ratings:{ar:0,dr:0,pr:0,ward:points,poise:points},
    persistentWard:{value:points,max:points},persistentPoise:{value:points,max:points},damageResistanceFlat:{},damageWeaknessPercent:{}});
  delete target.combatCounter; delete target.combatEvade; delete target.combatStance;
  primeAccuracyRolls(combat);
  const carrier={skipRatingBonus:true,tags:[`camp:${kind==='magical'?'spell':'physical'}`,'maneuver:attack',`damage:${kind==='magical'?'arcane':'blunt'}`],
    combatProfile:{camp:kind==='magical'?'spell':'physical',maneuver:'attack',damageType:kind==='magical'?'arcane':'blunt',range:'melee',targeting:'single'},magicShare:kind==='magical'?1:0};
  return {combat,target,carrier};
}
for (const kind of ['physical','magical']) test(`${kind} live damage and detached preview share typed 25% protection`,()=>{
  const {combat,target,carrier}=fixture(kind);
  const make=()=>({effect:{op:'damage',target:'enemy',amount:20},source:combat.player,owner:combat.player,target,card:carrier,meta:{}});
  const before=JSON.stringify({target,rng:combat.rng.getCounters()});
  const preview=previewExpandedActions(combat,[make()],{source:combat.player,target,carrier});
  assert.equal(preview[0][0].amount,15);
  assert.equal(JSON.stringify({target,rng:combat.rng.getCounters()}),before);
  enqueueExpandedAction(combat,[make()],{source:combat.player,target,carrier});
  while(combat.queue.length)executeAction(combat,combat.queue.shift());
  assert.equal(target.hp,85);
  const receipt=combat.eventLog.filter(e=>e.type==='damageDealt').at(-1).damageReceipt;
  assert.equal(receipt.totalDamage,15);
  assert.equal(receipt.hits[0][kind==='magical'?'wardReduced':'poiseReduced'],5);
});
test('JSON tuning and independent attachment overrides reach live protection',()=>{
  const {combat,target,carrier}=fixture('magical');
  combat.fixCoreRules=structuredClone(fixCoreRules(combat));
  combat.fixCoreRules.protectionParameters = {'defense.wardProtection':{multiplier:.6}};
  const action={effect:{op:'damage',target:'enemy',amount:20},source:combat.player,owner:combat.player,target,card:carrier,meta:{}};
  const preview=previewExpandedActions(combat,[action],{source:combat.player,target,carrier});
  assert.equal(preview[0][0].amount,12);
  enqueueExpandedAction(combat,[action],{source:combat.player,target,carrier});
  while(combat.queue.length)executeAction(combat,combat.queue.shift());
  assert.equal(target.hp,88);
  const other={...target,id:'other',mechanicBindings:[{tag:'defense:wardProtection',parameters:{multiplier:.5}}]};
  assert.equal(protectionReceipt(combat,other,'magical',20).amount,10);
  assert.equal(protectionReceipt(combat,target,'magical',20).amount,12);
  other.mechanicTags=[];other.mechanicBindings=[];
  assert.equal(protectionReceipt(combat,other,'magical',20).amount,20);
});
test('Block cards replenish both pools once and independently cap',()=>{
  const {combat,target}=fixture('physical'); target.persistentWard.value=18;target.persistentPoise.value=2;
  gainBlock(combat,target,5,{cardId:'defend',type:'skill',skipRatingBonus:true});
  assert.equal(target.block,5);assert.equal(target.persistentWard.value,20);assert.equal(target.persistentPoise.value,7);
});

// Partial projections have no active pool unless explicitly present.
test('partial preview targets treat absent protection pools as inactive without mutation',()=>{
  const {combat,target}=fixture('physical');
  delete target.persistentPoise;delete target.persistentWard;
  const before=JSON.stringify(target);
  assert.equal(protectionReceipt(combat,target,'physical',20).amount,20);
  assert.equal(protectionReceipt(combat,target,'magical',20).amount,20);
  assert.equal(JSON.stringify(target),before);
});

test('zero typed damage never reports an inapplicable protection multiplier',()=>{
  const {combat,target}=fixture('physical');
  const receipt=protectionReceipt(combat,target,'magical',0);
  assert.equal(receipt.amount,0);
  assert.deepEqual(receipt.sources,[]);
});
