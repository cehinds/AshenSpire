import { primeAccuracyRolls } from './accuracyFixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction } from '../src/engine/actions.js';
const reg = createRegistries(contentBundle);
const make = () => {
 const combat = createCombat({registries:reg,rng:createRng(904),combatExpansionVersion:2,enemyIds:['wanderingSoldier'],player:{classId:'starseer',maxHp:100,hp:100,maxMana:10,mana:10,maxStamina:10,stamina:10,energyMax:10,drawPerTurn:1,deck:[{cardId:'starstonePebble',instanceId:'one',upgraded:false}]}});
 primeAccuracyRolls(combat);
 const enemy=combat.enemies[0];enemy.block=enemy.barrier=0;enemy.persistentWard.value=0;enemy.damageResistanceFlat={};enemy.damageWeaknessPercent={};enemy.ratings={ar:0,dr:0,pr:0,poise:0,ward:0};delete enemy.combatCounter;delete enemy.combatStance;
 return {combat,enemy};
};
const drain = combat => {while(combat.queue.length)executeAction(combat,combat.queue.shift());};
const play = (combat,enemy,{range='reach',targeting='single',pressure=true}={}) => {
 const carrier={cardId:'starstonePebble',tags:['camp:spell'],damageSchool:'magic',attack:{source:'spell',damageType:'blunt'},combatProfile:{camp:'spell',maneuver:'casting',school:'force',damageType:'blunt',range,targeting}};
 const effects=[{op:'damage',target:'enemy',amount:5,hits:3},...(pressure?[{op:'buildup',target:'enemy',status:'sleep',amount:6,camp:'spell',recoveryProfile:'mental'}]:[])];
 enqueueExpandedAction(combat,effects.map(effect=>({effect,source:combat.player,owner:combat.player,target:enemy,card:carrier,meta:{}})),{source:combat.player,target:enemy,carrier});drain(combat);
};
test('Invulnerability spends one stack across three hits and suppresses the whole hostile payload',()=>{
 const {combat,enemy}=make();enemy.statuses.invulnerability={stacks:2};enemy.combatEvade={charges:1,bonus:0};enemy.block=enemy.barrier=9;
 const hp=enemy.hp,before=combat.rng.getCounters();play(combat,enemy);
 assert.equal(enemy.hp,hp);assert.equal(enemy.statuses.invulnerability.stacks,1);assert.equal(enemy.combatEvade.charges,0,'one shared Evade attempt precedes Invulnerability');assert.equal(enemy.block,9);assert.equal(enemy.barrier,9);
 assert.equal(enemy.statuses.sleep,undefined,'the avoided action cannot apply its status payload');
 assert.equal(combat.eventLog.find(event=>event.type==='combatAvoidanceResolved')?.hitCheck,true,'legacy protection receipt is marked as part of the shared hit decision');
 assert.equal(combat.eventLog.filter(event=>event.type==='attackMissed').length,1,'one final action miss is published');
 assert.equal(combat.rng.getCounters().combatAvoidance,before.combatAvoidance+1,'one group Accuracy roll precedes protection; no second Evade roll');
 combat.enqueue({effect:{op:'loseHp',target:'enemy',amount:1},source:combat.player,target:enemy});drain(combat);
 assert.equal(enemy.hp,hp-1);assert.equal(enemy.statuses.invulnerability.stacks,1,'HP loss does not consume direct-action protection');
});
test('Decoy protects ranged Single delivery but Melee and Area actions connect',()=>{
 for(const [range,targeting,avoided]of[['ranged','single',true],['melee','single',false],['reach','area',false]]){
  const {combat,enemy}=make();enemy.statuses.decoy={stacks:2};const hp=enemy.hp;play(combat,enemy,{range,targeting,pressure:false});
  assert.equal(enemy.hp===hp,avoided,range+'/'+targeting);
  if(avoided){
   assert.equal(combat.eventLog.find(event=>event.type==='combatAvoidanceResolved'&&event.prevention==='decoy')?.hitCheck,true,'the emitted Decoy receipt is marked as shared');
   assert.equal(combat.eventLog.filter(event=>event.type==='attackMissed').length,1,'Decoy publishes one final miss');
  }
  assert.equal(enemy.statuses.decoy?.stacks,avoided?1:2,'bypassed Decoy stays until consumed or revealed');
 }
});
