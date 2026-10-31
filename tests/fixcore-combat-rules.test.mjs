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
import { attackHitPreview, resolveAttackHit, effectiveEvasion, evadeStackGain, precisionStatMix, precisionEntryGrant } from '../src/engine/stanceHit.js';
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
test('same stance preserves offensive effectiveness and MP discount without discounting own-turn SP',()=>{
 const {ctx}=setup();const physical={combatProfile:{camp:'physical',maneuver:'attack'}},magic={combatProfile:{camp:'spell',maneuver:'casting',range:'ranged'}};
 ctx.phase='player';ctx.player.combatStance={camp:'physical',maneuver:'attack'};
 assert.equal(stanceStaminaCost(3,ctx.player,physical,ctx),3);assert.equal(stanceStaminaCost(0,ctx.player,physical,ctx),0);
 assert.equal(stanceEffectiveness(ctx,ctx.player,physical),1.25);
 assert.equal(stanceManaCost(3,ctx.player,physical,ctx),2);
 ctx.player.combatStance={camp:'spell',maneuver:'casting'};
 assert.equal(stanceManaCost(3,ctx.player,magic,ctx),2);assert.equal(stanceManaCost(1,ctx.player,magic,ctx),1);assert.equal(stanceManaCost(0,ctx.player,magic,ctx),0);
 assert.equal(stanceStaminaCost(3,ctx.player,magic,ctx),3);
});
test('enemy-turn same-stance reaction discounts SP once regardless of the MP lane',()=>{
 const {ctx}=setup();ctx.phase='enemy';
 const reaction={cardTags:['trait:reaction'],combatProfile:{camp:'physical',maneuver:'counter'}};
 ctx.player.combatStance={camp:'physical',maneuver:'counter'};
 assert.equal(stanceStaminaCost(3,ctx.player,reaction,ctx,0),2);
 assert.equal(stanceStaminaCost(3,ctx.player,reaction,ctx,2),2);
 assert.equal(stanceStaminaCost(1,ctx.player,reaction,ctx,0),0);
 assert.equal(stanceStaminaCost(0,ctx.player,reaction,ctx,0),0);
 assert.equal(stanceManaCost(3,ctx.player,reaction,ctx),2);
 assert.equal(stanceStaminaCost(3,ctx.player,{...reaction,cardTags:[]},ctx),3);
 ctx.player.combatStance.maneuver='attack';assert.equal(stanceStaminaCost(3,ctx.player,reaction,ctx),3);
});
test('fixed Evasion preview matches every attacker outcome and uses no defender RNG',()=>{
 const {ctx,enemy}=setup();const carrier={combatProfile:{camp:'physical',maneuver:'smash',range:'melee'}};
 ctx.player.attributes={dexterity:2,strength:0,wisdom:0,intelligence:0};ctx.player.level=2;ctx.player.statuses.precision={stacks:2};
 enemy.statuses.evade={stacks:3};
 for (const mode of ['normal','advantage','disadvantage']) {
  const source={...ctx.player,accuracyAdvantage:mode==='advantage',accuracyDisadvantage:mode==='disadvantage'};
  const before=JSON.stringify({enemy,source});
  ctx.rng={int:()=>{throw new Error('preview consumed RNG');}};
  const preview=attackHitPreview(ctx,source,enemy,carrier);
  assert.equal(JSON.stringify({enemy,source}),before);
  assert.equal(preview.accuracy,11);assert.equal(preview.evasion,20);assert.equal(preview.opposed,false);assert.equal(preview.fixedDefense,true);
  let hits=0,outcomes=0;
  for(let a=1;a<=20;a++) for(let b=1;b<=(mode==='normal'?1:20);b++) {
   const die=mode==='normal'?a:mode==='advantage'?Math.max(a,b):Math.min(a,b);
   const want=die===20||die!==1&&die+11>=20;
   const queue=mode==='normal'?[a]:[a,b];let draws=0;
   ctx.rng={int:(stream,min,max)=>{assert.equal(stream,'combatAvoidance');assert.equal(min,1);assert.equal(max,20);draws++;assert.ok(queue.length,'extra RNG draw');return queue.shift();}};
   const result=resolveAttackHit(ctx,source,{...enemy,statuses:structuredClone(enemy.statuses)},carrier);
   assert.equal(result.hit,want,`${mode}: ${a},${b}`);assert.equal(draws,mode==='normal'?1:2);
   assert.equal(result.attackTotal,die+11);assert.equal(result.evasionTotal,20);assert.equal(result.evasionDie,undefined);
   if(result.hit)hits++;outcomes++;
  }
  assert.equal(preview.hitChance,Math.floor(100*hits/outcomes));
 }
 // Natural limits still apply when the threshold is otherwise impossible or trivial.
 enemy.attributes.dexterity=1000;ctx.rng={int:()=>20};assert.equal(resolveAttackHit(ctx,ctx.player,enemy,carrier).hit,true);
 enemy.attributes.dexterity=0;ctx.rng={int:()=>1};assert.equal(resolveAttackHit(ctx,ctx.player,enemy,carrier).hit,false);
 const disadvantaged={...ctx.player,accuracyDisadvantage:true};const queue=[20,1];ctx.rng={int:()=>queue.shift()};
 assert.equal(resolveAttackHit(ctx,disadvantaged,enemy,carrier).hit,false,'disadvantage uses the selected die, including naturals');
});
test('fixed Evasion retains DEX at zero stacks and applies gear once',()=>{
 const {ctx}=setup();const defender={...ctx.enemies[0],attributes:{dexterity:2},statuses:{}};
 const evasion=stacks=>{defender.statuses={evade:{stacks}};return effectiveEvasion(ctx,defender);};
 assert.equal(evasion(0),3);assert.equal(evasion(1),6);assert.equal(evasion(2),9);
 defender.baseEvasionBonus=2;
 assert.equal(evasion(0),5);assert.equal(evasion(1),8);assert.equal(evasion(2),11);
 defender.combatEvade={charges:1,bonus:4};assert.equal(evasion(2),15);
 assert.equal(effectiveEvasion(ctx,defender,{evadeDisabled:true}),5,'only stacks and prepared bonus are suppressed');
 defender.combatEvade.charges=0;assert.equal(evasion(2),11,'spent preparation contributes no bonus');
 ctx.fixCoreRules.accuracy.baseAC=2;ctx.fixCoreRules.accuracy.evasionBase=4;
 assert.equal(evasion(2),16,'configured base and per-stack base stay data driven');
});
test('shipped Evade grants exactly three stacks for every DEX value (owner, 2026-10-25)',()=>{
 const {ctx}=setup();
 for(const dexterity of [0,2,17,100]) {
  ctx.player.attributes={dexterity};assert.equal(evadeStackGain(ctx,ctx.player),3);
 }
});
test('Precision entry remains 1 + stat mix; DEX 2, level 1 gives 3 stacks and Precision 9 (owner, 2026-10-19)',()=>{
 const {ctx,enemy}=setup();ctx.player.attributes={dexterity:2,strength:0,wisdom:0,intelligence:0};ctx.player.level=1;
 assert.equal(precisionStatMix(ctx,ctx.player),2);
 const grant=precisionEntryGrant(ctx,ctx.player,1);assert.equal(grant,3);assert.equal(precisionEntryGrant(ctx,ctx.player,0),0);
 ctx.player.statuses.precision={stacks:grant};
 assert.equal(attackHitPreview(ctx,ctx.player,enemy,{combatProfile:{camp:'physical',maneuver:'attack',range:'melee'}}).accuracy,1+2*4);
});
test('a card-scoped precisionWeights override changes the stat mix, grant and Precision',()=>{
 const {ctx,enemy}=setup();ctx.player.attributes={dexterity:2,strength:0,wisdom:0,intelligence:0};ctx.player.level=1;
 const carrier={combatProfile:{camp:'physical',maneuver:'attack',range:'melee'},instanceId:'scoped',mechanicTags:['combat:accuracy'],
  mechanicBindings:[{tag:'combat:accuracy',parameters:{precisionWeights:{dex:1,str:0,wis:0,int:0,level:0}}}]};
 assert.equal(precisionStatMix(ctx,ctx.player),2);assert.equal(precisionStatMix(ctx,ctx.player,carrier),2);
 carrier.mechanicBindings[0].parameters.precisionWeights.dex=2; // 2 x DEX 2 = 4, level ignored
 assert.equal(precisionStatMix(ctx,ctx.player,carrier),4);assert.equal(precisionEntryGrant(ctx,ctx.player,1,carrier),5);
 assert.equal(attackHitPreview(ctx,ctx.player,enemy,carrier).accuracy,1+4);
});
test('an enemy without a level profile counts as level 0 in the Precision mix; one with a profile uses its level',()=>{
 const {ctx}=setup();const enemy=ctx.enemies[0];enemy.attributes={dexterity:2,strength:0,wisdom:0,intelligence:0};enemy.level=1;
 const real=ctx.registries.enemies.get(enemy.enemyId);
 const withProfile=profile=>{ctx.registries={...ctx.registries,enemies:{...ctx.registries.enemies,has:()=>true,get:()=>({...real,levelProfile:profile})}};};
 withProfile(undefined);assert.equal(precisionStatMix(ctx,enemy),1); // floor(.5 x 2 + 0), no level
 withProfile({min:1,max:4});assert.equal(precisionStatMix(ctx,enemy),2); // plus its level 1
});
test('Perception DC is 5 + target INT + target WIS + bonuses; level is ignored; observer rolls d20 + own WIS (D8)',()=>{
 const {ctx}=setup();const target={level:9,attributes:{intelligence:2,wisdom:3}},observer={attributes:{wisdom:2}};
 // DC 5 + INT 2 + WIS 3 = 10; the target's level adds nothing. Roll 7 + WIS 2 = 9 fails.
 const failed=rollKnowledgeRead({float:()=>.3},enemyKnowledge,observer,'Attack',{ctx,target});
 // #2434: the read also carries dcParts for the roll log; the D8 numbers are what this pins.
 assert.deepEqual(failed.perception,{roll:7,wisdom:2,dc:10,total:9,passed:false,dcParts:[{label:'base',value:5},{label:'INT',value:2},{label:'WIS',value:3}]});
 assert.equal(failed.visibility,'unknown');
 // Roll 8 + WIS 2 = 10 meets the DC.
 const passed=rollKnowledgeRead({float:()=>.35},enemyKnowledge,observer,'Attack',{ctx,target});
 assert.deepEqual(passed.perception,{roll:8,wisdom:2,dc:10,total:10,passed:true,dcParts:[{label:'base',value:5},{label:'INT',value:2},{label:'WIS',value:3}]});
 assert.equal(passed.visibility,'exact');
 // Configured bonuses sum into the DC.
 const bonus={...ctx,fixCoreRules:{...ctx.fixCoreRules,perception:{baseDC:5,bonuses:[2,-1]}}};
 assert.equal(rollKnowledgeRead({float:()=>.35},enemyKnowledge,observer,'Attack',{ctx:bonus,target}).perception.dc,11);
 assert.deepEqual(fixCoreRules(ctx).perception,{baseDC:5,bonuses:[]});
});
