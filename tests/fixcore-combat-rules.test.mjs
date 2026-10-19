import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { applyStatus, decayAtTurnStart, getMult } from '../src/engine/statuses.js';
import { staggerEnemy } from '../src/engine/actions.js';
import { fixCoreRules } from '../src/model/fixCoreMechanics.js';
import { sourceRatingValue } from '../src/model/combatRatings.js';
import { stanceStaminaCost, stanceManaCost, stanceEffectiveness } from '../src/model/stanceRules.js';
import { attackHitPreview, resolveAttackHit } from '../src/engine/stanceHit.js';
import { rollKnowledgeRead } from '../src/model/enemyIntentKnowledge.js';
import { enemyKnowledge } from '../src/content/enemyKnowledge.js';

function setup() {
 const ctx=createCombat({registries:createRegistries(contentBundle),rng:createRng(123),combatExpansionVersion:2,enemyIds:['wanderingSoldier'],
  player:{classId:'rogue',maxHp:100,hp:100,maxMana:10,mana:10,maxStamina:10,stamina:10,energyMax:10,drawPerTurn:1,deck:[]}});
 ctx.fixCoreRules=structuredClone(fixCoreRules(ctx));
 ctx.player.ratings={ar:8,dr:5,pr:2,ward:0,poise:0};ctx.player.statuses={};delete ctx.player.combatStance;
 const enemy=ctx.enemies[0];enemy.statuses={};enemy.attributes={dexterity:4};enemy.block=0;enemy.combatStance={maneuver:'attack',camp:'physical',range:'melee'};
 return {ctx,enemy};
}
test('equipped totals affect sourced cards and Weak scales AR only',()=>{
 const {ctx}=setup();ctx.player.ratingSources=[{kind:'attribute',ar:5},{kind:'equipment',sourceId:'sword',ar:2},{kind:'equipment',sourceId:'other',ar:100},{kind:'equipment',sourceId:'armor/reaver/plate',slot:'armor',ar:1}];
 assert.equal(sourceRatingValue(ctx,ctx.player,'ar','sword',true),8);
 applyStatus(ctx,ctx.player,'weak',2,ctx.player);
 assert.equal(sourceRatingValue(ctx,ctx.player,'ar','sword',true),6);
 assert.equal(getMult(ctx,ctx.player,'damageDealtMult'),1);
});
test('stagger (D13) is a stance: -1 SP, +1 Vulnerable per break, flat x1.25, no Weak, no skipped turn',()=>{
 const {ctx,enemy}=setup();staggerEnemy(ctx,enemy);staggerEnemy(ctx,enemy);
 assert.equal(enemy.combatStance.maneuver,'staggered');assert.equal(enemy.pendingStaminaLoss,2);
 assert.equal(enemy.statuses.staggered,undefined);assert.equal(enemy.statuses.weak,undefined);assert.ok(!enemy.skipNextTurn);
 assert.equal(enemy.statuses.vulnerable.stacks,2);
 assert.equal(getMult(ctx,enemy,'damageTakenMult'),1.25,'repeat breaks lengthen Vulnerable; the multiplier never compounds');
 decayAtTurnStart(ctx,enemy);decayAtTurnStart(ctx,enemy);
 assert.equal(enemy.statuses.vulnerable.stacks,1);
 ctx.turn++;decayAtTurnStart(ctx,enemy);assert.equal(enemy.statuses.vulnerable,undefined);
});
test('matching stance discounts only the used resource lane and preserves fractions',()=>{
 const {ctx}=setup();const physical={combatProfile:{camp:'physical',maneuver:'attack'}},magic={combatProfile:{camp:'spell',maneuver:'casting',range:'ranged'}};
 ctx.player.combatStance={camp:'physical',maneuver:'attack'};
 assert.equal(stanceStaminaCost(3,ctx.player,physical,ctx),2);assert.equal(stanceStaminaCost(0,ctx.player,physical,ctx),0);
 assert.equal(stanceEffectiveness(ctx,ctx.player,physical),1.25);
 ctx.player.combatStance={camp:'spell',maneuver:'casting'};
 assert.equal(stanceManaCost(3,ctx.player,magic,ctx),2);assert.equal(stanceManaCost(1,ctx.player,magic,ctx),1);assert.equal(stanceManaCost(0,ctx.player,magic,ctx),0);
 assert.equal(stanceStaminaCost(3,ctx.player,magic,ctx),2); // D6: an SP-only spell is discounted on SP; lane follows cost, not camp
});
test('D6: matching-stance discount lands on MP when the card costs MP, else on SP; one lane only',()=>{
 const {ctx}=setup();const physical={combatProfile:{camp:'physical',maneuver:'attack'}},magic={combatProfile:{camp:'spell',maneuver:'casting',range:'ranged'}};
 ctx.player.combatStance={camp:'physical',maneuver:'attack'};
 // physical card with an MP cost: MP discounted, SP untouched
 assert.equal(stanceManaCost(3,ctx.player,physical,ctx),2);assert.equal(stanceStaminaCost(3,ctx.player,physical,ctx,2),3);
 // physical card with SP only: SP discounted
 assert.equal(stanceStaminaCost(3,ctx.player,physical,ctx,0),2);assert.equal(stanceManaCost(0,ctx.player,physical,ctx),0);
 ctx.player.combatStance={camp:'spell',maneuver:'casting'};
 // spell with SP only: SP discounted (camp no longer picks the lane)
 assert.equal(stanceStaminaCost(3,ctx.player,magic,ctx,0),2);
 // spell with both: MP only
 assert.equal(stanceManaCost(3,ctx.player,magic,ctx),2);assert.equal(stanceStaminaCost(3,ctx.player,magic,ctx,3),3);
 // minimum-cost clamp on both lanes
 assert.equal(stanceManaCost(1,ctx.player,magic,ctx),1);assert.equal(stanceStaminaCost(1,ctx.player,magic,ctx,0),1);
});
test('d20 odds exactly match resolution, including natural limits and stance clamp',()=>{
 const {ctx,enemy}=setup();const carrier={combatProfile:{camp:'physical',maneuver:'smash',range:'melee'}};
 enemy.statuses.evade={stacks:3};enemy.stanceAdvantageRating=3;ctx.player.statuses.precision={stacks:2};
 const preview=attackHitPreview(ctx,ctx.player,enemy,carrier);
 assert.equal(preview.evasion,12);assert.equal(preview.accuracy,3);assert.equal(preview.stanceFactor,1.5);
 let hit=0;
 for(let roll=1;roll<=20;roll++) {ctx.rng={int:()=>roll};if(resolveAttackHit(ctx,ctx.player,{...enemy,statuses:structuredClone(enemy.statuses)},carrier).hit)hit++;}
 assert.equal(preview.hitChance,hit*5);
 ctx.rng={int:()=>1};assert.equal(resolveAttackHit(ctx,ctx.player,enemy,carrier).hit,false);
 enemy.attributes.dexterity=1000;ctx.rng={int:()=>20};assert.equal(resolveAttackHit(ctx,ctx.player,enemy,carrier).hit,true);
});
test('Perception DC is 5 + target INT + target WIS + bonuses; level is ignored; observer rolls d20 + own WIS (D8)',()=>{
 const {ctx}=setup();const target={level:9,attributes:{intelligence:2,wisdom:3}},observer={attributes:{wisdom:2}};
 // DC 5 + INT 2 + WIS 3 = 10; the target's level adds nothing. Roll 7 + WIS 2 = 9 fails.
 const failed=rollKnowledgeRead({float:()=>.3},enemyKnowledge,observer,'Attack',{ctx,target});
 assert.deepEqual(failed.perception,{roll:7,wisdom:2,dc:10,total:9,passed:false});
 assert.equal(failed.visibility,'unknown');
 // Roll 8 + WIS 2 = 10 meets the DC.
 const passed=rollKnowledgeRead({float:()=>.35},enemyKnowledge,observer,'Attack',{ctx,target});
 assert.deepEqual(passed.perception,{roll:8,wisdom:2,dc:10,total:10,passed:true});
 assert.equal(passed.visibility,'exact');
 // Configured bonuses sum into the DC.
 const bonus={...ctx,fixCoreRules:{...ctx.fixCoreRules,perception:{baseDC:5,bonuses:[2,-1]}}};
 assert.equal(rollKnowledgeRead({float:()=>.35},enemyKnowledge,observer,'Attack',{ctx:bonus,target}).perception.dc,11);
 assert.deepEqual(fixCoreRules(ctx).perception,{baseDC:5,bonuses:[]});
});
