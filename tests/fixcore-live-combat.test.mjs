import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch,previewCard } from '../src/engine/combat.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { applyAttackDamage,executeRunEffects,gainBlock } from '../src/engine/actions.js';
import { profileDamageReceipt,setProfileStance,profileCardCosts } from '../src/engine/gameProfileCombat.js';
import { gameProfileEquipmentReceipt,gameProfileEffectiveAttributes,gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import { rollKnowledgeRead } from '../src/model/enemyIntentKnowledge.js';
import { enemyKnowledge } from '../src/content/enemyKnowledge.js';
import { attackHitPreview } from '../src/engine/stanceHit.js';
import { chargeFlaskId,utilityFlaskIds } from '../src/model/gracerefill.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
const profile=resolveGameProfile({formatVersion:1,core:'ashen.core@2.0.0',modules:{}});
const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
function live(classId='reaver') {
 const run=createRunState({registries:reg,classId,seed:511,profileMeta:{gameProfileUnlocks:{core:{completedRunIds:['a','b','c']}}}});
 const combat=createRunCombat({registries:reg,run,rng:createRng(511),enemyIds:['wanderingSoldier']});
 // Ward is toggled off in shipped data (owner, 2026-10-18); these tests exercise the Ward path, so switch it on.
 combat.fixCoreRules={...structuredClone(combat.fixCoreRules||combat.gameProfile.fixCoreRules),ward:{enabled:true}};
 combat.player.persistentWard={value:20,max:20};
 const target=combat.enemies[0];Object.assign(target,{hp:500,maxHp:500,block:0,barrier:0,statuses:{},persistentWard:{value:20,max:20},persistentPoise:{value:20,max:20},attributes:{dexterity:0}});
 delete target.combatStance;delete target.combatCounter;
 return {run,combat,target};
}
test('real Core 2 run forwards equipped attributes and accuracy bonuses to live checks',()=>{
 const {run,combat,target}=live('starseer');const gear=gameProfileEquipmentReceipt(reg,run),ratings=gameProfileRatingReceipt(reg,run);
 assert.deepEqual(combat.player.attributes,gameProfileEffectiveAttributes(reg,run));
 assert.equal(combat.player.baseEvasionBonus,gear.totals.evasion);assert.equal(combat.player.basePrecisionBonus,gear.totals.precision);
 assert.deepEqual(combat.player.ratings,ratings.totals);assert.equal(combat.piles.hand.length,run.drawPerTurn);
 const carrier={combatProfile:{camp:'physical',maneuver:'attack',range:'melee'}};
 const hit=attackHitPreview(combat,target,combat.player,carrier);
 assert.equal(hit.evasion,1); // no Evade stacks: Evasion is only its flat base
 combat.player.statuses.evade={stacks:2};
 assert.equal(attackHitPreview(combat,target,combat.player,carrier).evasion,1+2*(1+combat.player.attributes.dexterity+gear.totals.evasion));
 const read=rollKnowledgeRead({float:()=>.2},enemyKnowledge,{attributes:combat.player.attributes},'Attack',{ctx:combat,target});
 assert.equal(read.perception.total,5+combat.player.attributes.wisdom);
});
test('actual card dispatch matches selected target receipt and card face after equipped AR, Block and Poise',()=>{
 const {combat,target}=live();target.block=3;
 const card=combat.piles.hand.find(row=>previewCard(combat,row.instanceId,target.id).values.some(v=>v.op==='damage'));
 assert.ok(card);primeAccuracyRolls(combat);
 const before=JSON.stringify({target,rng:combat.rng.getCounters()});
 const preview=previewCard(combat,card.instanceId,target.id).values.find(v=>v.op==='damage');
 assert.equal(JSON.stringify({target,rng:combat.rng.getCounters()}),before);
 assert.equal(preview.totalDamage,preview.damageReceipt.totalDamage);
 const hp=target.hp;dispatch(combat,{type:'playCard',cardInstanceId:card.instanceId,targetId:target.id});
 assert.equal(hp-combat.enemies[0].hp,preview.totalDamage);
 const receipt=combat.eventLog.filter(row=>row.type==='damageDealt').at(-1).damageReceipt;
 assert.equal(receipt.totalDamage,preview.damageReceipt.totalDamage);
 assert.ok(receipt.hits[0].sources.some(row=>row.id.startsWith('ar:')));
});
test('mixed multihit receipt spends Block Barrier Ward and Poise sequentially and previews without RNG',()=>{
 const {combat,target}=live();Object.assign(target,{block:10,barrier:2,persistentWard:{value:1,max:20},persistentPoise:{value:1,max:20}});
 const carrier={skipRatingBonus:true,magicShare:.5,combatProfile:{camp:'physical',maneuver:'attack',range:'melee',damageComponents:[{damageType:'blunt',share:.5},{damageType:'magic',share:.5}]}};
 const before=JSON.stringify({target,rng:combat.rng.getCounters()});
 const preview=previewDamageHits(combat,combat.player,target,20,[],carrier,3);
 assert.equal(JSON.stringify({target,rng:combat.rng.getCounters()}),before);
 assert.deepEqual(preview.hitDamages,[6,19,25]);assert.equal(preview.totalDamage,50);// hit 2 meets 1 Poise (capped); the break then leaves Vulnerable x1.25
 const receipts=[];for(let i=0;i<3;i++){primeAccuracyRolls(combat);applyAttackDamage(combat,combat.player,target,20,[],carrier);receipts.push(combat.eventLog.filter(row=>row.type==='damageDealt').at(-1).damageReceipt.hits[0]);}
 assert.deepEqual(receipts.map(row=>row.hpLoss),preview.hitDamages);assert.equal(500-target.hp,50);
 assert.deepEqual(receipts.map(row=>[row.blocked,row.barrierReduced,row.wardReduced,row.poiseReduced]),[[10,2,2,0],[0,0,0,1],[0,0,0,0]]);
});
test('prepared spell stance matches casting cards for MP and fractional effect',()=>{
 const {combat}=live();const card={resourceCosts:{sp:0,mp:3},combatProfile:{camp:'spell',maneuver:'casting',range:'melee'}};
 setProfileStance(combat,combat.player,{...card});
 assert.equal(profileCardCosts(combat,card).mana,2);
});
test('event flask acquisition grows capacity through a full utility belt',()=>{
 const {run}=live();const utility=utilityFlaskIds(reg)[0],capacity=run.flaskCharges.capacity;
 run.flasks=Array.from({length:reg.balance.flaskSlots},()=>({flaskId:utility}));
 executeRunEffects({run,registries:reg,rng:createRng(7)},[{op:'addFlask',id:chargeFlaskId(reg,'hp')}]);
 assert.equal(run.flaskCharges.capacity,capacity+1);
 executeRunEffects({run,registries:reg,rng:createRng(7)},[{op:'addFlask',id:utility}]);
 assert.equal(run.flasks.length,reg.balance.flaskSlots);
});

test('authored enemy defense restores both pools and damage log carries remaining protection',()=>{
 const {combat,target}=live();target.ratings={ar:0,dr:0,ward:20,poise:20};target.persistentWard.value=2;target.persistentPoise.value=2;
 gainBlock(combat,target,5,{enemyId:target.enemyId,moveId:'guard',skipRatingBonus:true,combatProfile:{camp:'physical',maneuver:'defend'}});
 assert.equal(target.persistentWard.value,7);assert.equal(target.persistentPoise.value,7);
 primeAccuracyRolls(combat);applyAttackDamage(combat,combat.player,target,20,[],{skipRatingBonus:true,combatProfile:{camp:'physical',maneuver:'attack'}});
 const event=combat.eventLog.filter(row=>row.type==='damageDealt').at(-1);
 assert.equal(event.wardRemaining,target.persistentWard.value);assert.equal(event.poiseRemaining,target.persistentPoise.value);
});
test('selected card hit odds match configured stance entry and Evade grants actual stacks',async()=>{
 const {previewCardHit}=await import('../src/engine/combat.js');
 const {combat,target}=live();target.attributes.dexterity=10;
 const card=combat.piles.hand.find(row=>row.cardId==='core.strike');assert.ok(card);
 const preview=previewCardHit(combat,card.instanceId,target.id);primeAccuracyRolls(combat);
 dispatch(combat,{type:'playCard',cardInstanceId:card.instanceId,targetId:target.id});
 const actual=combat.eventLog.filter(row=>row.type==='attackHit').at(-1);
 assert.equal(actual.accuracy,preview.accuracy);assert.equal(actual.hitChance,preview.hitChance);
 combat.player.energy=10;combat.player.stamina=10;
 combat.piles.hand.push({cardId:'core.evade',instanceId:'actual-evade',upgraded:false});
 dispatch(combat,{type:'playCard',cardInstanceId:'actual-evade'});
 const dexterity=combat.player.attributes.dexterity;assert.equal(combat.player.statuses.evade?.stacks,1+dexterity);
 combat.piles.hand.push({cardId:'core.evade',instanceId:'actual-evade-second',upgraded:false});
 dispatch(combat,{type:'playCard',cardInstanceId:'actual-evade-second'});
 assert.equal(combat.player.statuses.evade.stacks,2*(1+dexterity));
});
test('registered owner and active card parameters affect live shared math and reject typos',async()=>{
 const {fixCoreRules,validateFixCoreRules}=await import('../src/model/fixCoreMechanics.js');
 const {stanceEffectiveness}=await import('../src/model/stanceRules.js');
 const {combat}=live(), entity=combat.player;
 entity.mechanicBindings=[{tag:'combat:stance',parameters:{effectivenessMultiplier:1.25}}];
 const card={combatProfile:{camp:'physical',maneuver:'attack'}};entity.combatStance=card.combatProfile;
 assert.equal(stanceEffectiveness(combat,entity,card),1.25);
 assert.equal(fixCoreRules(combat).stance.effectivenessMultiplier,1.25);
 entity.mechanicBindings=[];
 assert.equal(stanceEffectiveness(combat,entity,{...card,instanceId:'first',mechanicBindings:[{tag:'combat:stance',parameters:{effectivenessMultiplier:1.5}}]}),1.5);
 assert.equal(stanceEffectiveness(combat,entity,{...card,instanceId:'second',mechanicBindings:[{tag:'combat:stance',parameters:{effectivenessMultiplier:1.1}}]}),1.1);
 const bad=structuredClone(combat.fixCoreRules);bad.accuracy.precisonPerStack=5;
 assert.throws(()=>validateFixCoreRules(bad),/unknown parameter/);
});
test('saved combat preserves exact authored parameters and owner clocks without another roll',async()=>{
 const {serializeCombatSnapshot,restoreCombatSnapshot}=await import('../src/engine/combatSnapshot.js');
 const {combat}=live();combat.fixCoreRules.protectionParameters['defense.wardProtection'].multiplier=.6;
 const snapshot=serializeCombatSnapshot(combat), counters=combat.rng.getCounters();
 const restored=restoreCombatSnapshot({registries:reg,rng:createRng(combat.rng.seed,counters),snapshot,expectedGameProfile:profile});
 assert.deepEqual(restored.fixCoreRules,combat.fixCoreRules);assert.deepEqual(restored.rng.getCounters(),counters);
 const altered=structuredClone(snapshot);altered.fixCoreRules.perception.baseDC='oops';
 assert.throws(()=>restoreCombatSnapshot({registries:reg,rng:createRng(1),snapshot:altered}),/finite number/);
});
test('a combat saved with the v1 perception shape restores onto the bonuses formula',async()=>{
 const {serializeCombatSnapshot,restoreCombatSnapshot}=await import('../src/engine/combatSnapshot.js');
 const {fixCoreRules}=await import('../src/model/fixCoreMechanics.js');
 const {combat}=live();
 const snapshot=serializeCombatSnapshot(combat);
 const restoreOf=snap=>restoreCombatSnapshot({registries:reg,rng:createRng(combat.rng.seed,combat.rng.getCounters()),snapshot:snap,expectedGameProfile:profile});
 const current=restoreOf(snapshot);
 assert.deepEqual(current.fixCoreRules.perception,combat.fixCoreRules.perception);
 const old=structuredClone(snapshot);
 old.fixCoreRules.perception={baseDC:7,levelBaseline:1,intelligenceBaseline:0,levelWeight:1,intelligenceWeight:1};
 const restored=restoreOf(old);
 assert.deepEqual(restored.fixCoreRules.perception,{baseDC:7,bonuses:[]});
 assert.equal(fixCoreRules(restored).perception.baseDC,7);
 assert.equal(old.fixCoreRules.perception.levelWeight,1,'caller snapshot untouched');
 const typo=structuredClone(snapshot);typo.fixCoreRules.perception.levelBaselne=1;
 assert.throws(()=>restoreOf(typo),/unknown parameter/);
});
test('enemy heal-and-block move spends exactly three SP and cannot cast with two',()=>{
 for(const pool of [3,2]) {
  const {combat,target}=live();target.hp=250;target.maxStamina=pool;target.stamina=pool;
  const move={intent:'block',block:4,sp:1,effects:[{op:'heal',target:'self',amount:4}],tags:['camp:physical','maneuver:defend']};
  const enemies=reg.enemies;
  combat.registries={...reg,enemies:{...enemies,get:id=>id===target.enemyId ? {...enemies.get(id),moves:{...enemies.get(id).moves,healguard:move}} : enemies.get(id)}};
  target.intent={kind:'block',moveId:'healguard'};target.plannedMoves=[];target.planDue=false;
  dispatch(combat,{type:'endTurn'});
  const played=combat.eventLog.some(row=>row.type==='enemyMoveStarted' && row.moveId==='healguard');
  assert.equal(played,pool===3);
  if(pool===3)assert.equal(combat.enemies[0].fixCoreStaminaRemaining,0);
  else assert.ok(combat.eventLog.some(row=>row.type==='enemyMoveUnavailable' && row.required===3 && row.available===2));
 }
});
test('canonical equipped gear bindings mount with copy identity and disappear on unequip',async()=>{
 const {syncLoadoutProperties}=await import('../src/engine/properties.js');
 const {protectionReceipt}=await import('../src/model/fixCoreMechanics.js');
 const {combat}=live();const pinned=structuredClone(profile);
 const gear=pinned.content.gear.find(row=>row.source?.id==='greatsword');assert.ok(gear);
 gear.mechanicTags=['defense:wardProtection'];gear.mechanicBindings=[{tag:'defense:wardProtection',parameters:{multiplier:.5}}];
 combat.registries={...reg,gameProfile:pinned};combat.gameProfile=pinned;
 combat.player.ratings.ward=20;combat.player.persistentWard={value:20,max:20};
 syncLoadoutProperties(combat);
 assert.equal(protectionReceipt(combat,combat.player,'magical',20).amount,10);
 assert.ok(Object.keys(combat.propertyMounts.player).some(id=>id.includes('greatsword@rightHand')));
 combat.loadout.sets.leftHand[0]='greatsword';syncLoadoutProperties(combat);
 assert.equal(Object.keys(combat.propertyMounts.player).filter(id=>id.includes('greatsword@')).length,2);
 assert.equal(protectionReceipt(combat,combat.player,'magical',20).amount,10,'strongest protection group does not multiply identical copies');
 combat.loadout.sets.leftHand[0]=null;combat.loadout.sets.rightHand[0]=null;syncLoadoutProperties(combat);
 assert.equal(protectionReceipt(combat,combat.player,'magical',20).amount,15);
});

test('registered spell Block remains Block and refills both protection pools',async()=>{
 const {expandedEnemyMove,enemyMoveCarrier}=await import('../src/engine/combatCardTactics.js');
 const {combat,target}=live();const def=reg.enemies.get('briarHermit'),move=def.moves.rootShelter;
 assert.ok(move.block>0);target.enemyId='briarHermit';target.ratings={ar:0,dr:0,ward:20,poise:20};target.persistentWard={value:2,max:20};target.persistentPoise={value:2,max:20};
 const projected=expandedEnemyMove(target,move,'rootShelter',combat);
 assert.equal(projected.block,move.block);assert.equal(projected.barrier,move.barrier);
 gainBlock(combat,target,projected.block,enemyMoveCarrier(target,move,'rootShelter',combat));
 assert.equal(target.persistentWard.value,2+move.block);assert.equal(target.persistentPoise.value,2+move.block);
});
test('enemy held gear and relic behavior mounts are owner scoped and leave on unequip',async()=>{
 const {syncConfiguredEnemyProperties}=await import('../src/engine/properties.js');
 const {protectionReceipt}=await import('../src/model/fixCoreMechanics.js');
 const {combat,target}=live(),pinned=structuredClone(profile);
 const definition=pinned.content.enemies.find(row=>row.id===target.enemyId);
 const gear=pinned.content.gear.find(row=>row.id===definition.defaultGear[0].id);
 gear.mechanicBindings=[{tag:'defense:wardProtection',parameters:{multiplier:.5}}];
 const relic=pinned.content.enemyRelics[0];relic.mechanicBindings=[{tag:'defense:poiseProtection',parameters:{multiplier:.6}}];
 definition.defaultRelics=[{key:'test-relic',id:relic.id}];
 combat.gameProfile=pinned;syncConfiguredEnemyProperties(combat);
 assert.equal(protectionReceipt(combat,target,'magical',20).amount,10);
 assert.equal(protectionReceipt(combat,target,'physical',20).amount,12);
 assert.equal(protectionReceipt(combat,combat.player,'magical',20).amount,15);
 definition.defaultGear=[];definition.defaultRelics=[];syncConfiguredEnemyProperties(combat);
 assert.equal(protectionReceipt(combat,target,'magical',20).amount,15);assert.equal(protectionReceipt(combat,target,'physical',20).amount,15);
});

test('fractional offense reaches final rounding without a fabricated status modifier',()=>{
 const {combat,target}=live();
 const card={skipRatingBonus:true,combatProfile:{camp:'physical',maneuver:'attack',range:'melee'}};
 combat.player.combatStance={...card.combatProfile};delete target.combatStance;
 target.statuses={};combat.player.statuses={};
 const receipt=profileDamageReceipt(combat,combat.player,target,13,card);
 const sources=receipt.damageReceipt.hits[0].sources;
 // Owner 2026-10-18: no decimals. The chain floors once; the stance line shows its running floor (13 x 1.25 = 16.25 -> 16) and there is no separate rounding line.
 assert.ok(sources.some(row=>row.id==='matching-stance' && row.effective===16 && Number.isInteger(row.amount)));
 assert.equal(sources.some(row=>row.id==='status-rules'),false);
 assert.equal(sources.some(row=>row.id==='quantity-rounding'),false);
 assert.equal(receipt.damageReceipt.hits[0].incoming,16);
 const before=target.hp;primeAccuracyRolls(combat);
 applyAttackDamage(combat,combat.player,target,13,[],card);
 assert.equal(before-target.hp,receipt.hpLoss);
});
