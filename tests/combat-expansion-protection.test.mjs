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
 const enemy=combat.enemies[0];enemy.block=enemy.barrier=0;enemy.persistentWard.value=0;enemy.damageResistanceFlat={};enemy.damageWeaknessPercent={};enemy.ratings={ar:0,dr:0,pr:0,poise:0,ward:0};delete enemy.combatCounter;delete enemy.combatStance;
 return {combat,enemy};
};
const drain = combat => {while(combat.queue.length)executeAction(combat,combat.queue.shift());};
const play = (combat,enemy,{reach='near',targeting='single',pressure=true}={}) => {
 const carrier={cardId:'starstonePebble',tags:['camp:spell'],damageSchool:'magic',attack:{source:'spell',damageType:'blunt'},combatProfile:{camp:'spell',maneuver:'casting',school:'force',damageType:'blunt',reach,targeting}};
 const effects=[{op:'damage',target:'enemy',amount:5,hits:3},...(pressure?[{op:'buildup',target:'enemy',status:'sleep',amount:6,camp:'spell',recoveryProfile:'mental'}]:[])];
 enqueueExpandedAction(combat,effects.map(effect=>({effect,source:combat.player,owner:combat.player,target:enemy,card:carrier,meta:{}})),{source:combat.player,target:enemy,carrier});drain(combat);
};
test('Invulnerability spends one stack for all three hits, keeps Evade RNG and admits independent pressure',()=>{
 const {combat,enemy}=make();enemy.statuses.invulnerability={stacks:2};enemy.combatEvade={charges:1,bonus:0};enemy.block=enemy.barrier=9;
 const hp=enemy.hp,before=combat.rng.getCounters();play(combat,enemy);
 assert.equal(enemy.hp,hp);assert.equal(enemy.statuses.invulnerability.stacks,1);assert.equal(enemy.combatEvade.charges,1);assert.equal(enemy.block,9);assert.equal(enemy.barrier,9);
 assert.equal(enemy.statuses.sleep?.stacks,1,'avoided damage does not cancel a separate magical ailment');
 assert.equal(combat.rng.getCounters().avoidance,before.avoidance);
 combat.enqueue({effect:{op:'loseHp',target:'enemy',amount:1},source:combat.player,target:enemy});drain(combat);
 assert.equal(enemy.hp,hp-1);assert.equal(enemy.statuses.invulnerability.stacks,1,'HP loss does not consume direct-action protection');
});
test('Decoy protects ranged Single delivery but Contact and Area actions connect',()=>{
 for(const [reach,targeting,avoided]of[['far','single',true],['contact','single',false],['near','area',false]]){
  const {combat,enemy}=make();enemy.statuses.decoy={stacks:2};const hp=enemy.hp;play(combat,enemy,{reach,targeting,pressure:false});
  assert.equal(enemy.hp===hp,avoided,reach+'/'+targeting);assert.equal(enemy.statuses.decoy?.stacks,avoided?1:2,'bypassed Decoy stays until consumed or revealed');
 }
});
