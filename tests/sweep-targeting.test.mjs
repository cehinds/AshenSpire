import { COOP_TESTS_ENABLED, COOP_TEST_SKIP_REASON } from './feature-scopes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRegistries,resolveCard } from '../src/model/registries.js';
import { resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { cardTargetPlan,upcastNextStep } from '../src/model/cardTargets.js';
import { cardNeedsEnemyTarget } from '../src/model/friendlyTargets.js';
import { createCombat,dispatch,previewCard,cardPlayCosts } from '../src/engine/combat.js';
import { createCoopCombat,playCard,previewCoopCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { combatCardView } from '../src/ui/models/CombatCardView.js';

function fixture(profileId,cardId,{abilityRank,upgraded=false,expanded=false,coop=false}={}) {
 const gameProfile=resolveGameProfile(profileId),registries=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,gameProfile)),gameProfile);
 const instance={instanceId:'sweep-test',cardId,upgraded,...(abilityRank===undefined ? {} : {abilityRank})};
 const player={classId:'reaver',hp:200,maxHp:200,mana:100,maxMana:100,stamina:100,maxStamina:100,energyMax:100,drawPerTurn:1,deck:[instance]};
 const args={registries,rng:createRng(17),gameProfile,enemyIds:Array(3).fill('wanderingSoldier'),...(profileId==='current' ? {ruleset:combatRules} : {}),...(expanded ? {combatExpansionVersion:2,reactionRulesVersion:1} : {})};
 const combat=coop ? createCoopCombat({...args,players:[{...player,id:'a',...(expanded ? {combatExpansionVersion:2} : {})}]}) : createCombat({...args,player});
 for(const foe of combat.enemies){foe.hp=foe.maxHp=1000;foe.block=0;foe.statuses={};foe.combatStance={maneuver:'attack',camp:'physical',range:'melee'};}
 combat.enemies[2].hp=0;combat.enemies[2].alive=false;
 const int=combat.rng.int;combat.rng.int=(stream,min,max)=>stream==='combatAvoidance' ? max : int(stream,min,max);
 return {combat,registries,instance};
}
function verifySweep(profileId,cardId,options={}) {
 const {combat,registries,instance}=fixture(profileId,cardId,options),seat=options.coop ? combat.players.get('a') : {entity:combat.player};
 if(cardId==='crimsonCleave' && options.abilityRank===5)combat.piles.draw.push({instanceId:'sweep-draw-filler',cardId:'strike'});
 const beforeRng=combat.rng.getCounters(),preview=options.coop ? previewCoopCard(combat,'a',instance.instanceId) : previewCard(combat,instance.instanceId);
 assert.equal(preview.needsTarget,false,'Sweep never opens a single-foe picker');assert.deepEqual(combat.rng.getCounters(),beforeRng,'preview consumes no randomness');
 const context=options.coop ? {registries,player:seat.entity,gameProfile:combat.gameProfile,combatExpansionVersion:combat.combatExpansionVersion,breakMeterVersion:combat.breakMeterVersion} : combat;
 const view=combatCardView(context,{...instance,combatPreview:preview});
 assert.equal(cardNeedsEnemyTarget(view),false,'browser target model agrees with combat');
 const plan=cardTargetPlan(view,options.coop ? 'a' : combat.player.id,combat.enemies,[{id:options.coop ? 'a' : combat.player.id,alive:true,connected:true}],{solo:!options.coop});
 assert.equal(upcastNextStep(plan,false,null),'playUntargeted');assert.equal(plan.legalIds.length,2);
 const costs=options.coop ? {stamina:preview.staminaCost,mana:preview.manaCost} : cardPlayCosts(combat,instance.instanceId);
 const resources={stamina:seat.entity.stamina,mana:seat.entity.mana},block=seat.entity.block;
 const {events}=options.coop ? playCard(combat,'a',instance.instanceId) : dispatch(combat,{type:'playCard',cardInstanceId:instance.instanceId});
 for(const foe of combat.enemies.slice(0,2))assert.ok(foe.hp<1000,`${cardId} hits ${foe.id} without a supplied target`);
 assert.equal(combat.enemies[2].hp,0);assert.ok(!events.some(e=>e.type==='damageDealt' && e.targetId===combat.enemies[2].id));
 assert.equal(events.filter(e=>e.type==='cardPlayed' && e.cardInstanceId===instance.instanceId).length,1);
 assert.equal(resources.stamina-seat.entity.stamina,costs.stamina,'SP paid once for the card');assert.equal(resources.mana-seat.entity.mana,costs.mana,'MP paid once for the card');
 if(cardId==='crimsonCleave' && options.abilityRank>=4)assert.equal(events.filter(e=>e.type==='blockGained' && e.targetId===seat.entity.id).length,1,'grade self Block applies once');
 if(cardId==='crimsonCleave' && options.abilityRank===5)assert.equal(events.filter(e=>e.type==='cardDrawn' && e.cardInstanceId==='sweep-draw-filler').length,1,'grade draw applies once');
 if(cardId==='whirlingGuard'){
  assert.equal(events.filter(e=>e.type==='blockGained' && e.targetId===seat.entity.id).length,1,'self Block is gained once');assert.ok(seat.entity.block>block);
  for(const foe of combat.enemies.slice(0,2))assert.equal(events.filter(e=>e.type==='damageDealt' && e.targetId===foe.id).length,3,'all three hits reach each living foe');
 }
 return {combat,events};
}

test('core Sweep hits every living foe without aiming and pays its single SP once',()=>verifySweep('core','core.sweep'));
for(const expanded of [false,true])for(const cardId of ['hewingArc','whirlingGuard','cleavingBlow','sweepingBlow','progression-ashen-cleaver'])test(`current ${cardId} is automatic area damage (${expanded ? 'expanded' : 'foundation'})`,()=>verifySweep('current',cardId,{expanded}));
for(const abilityRank of [0,1,2,3,4,5])test(`Crimson Cleave grade ${abilityRank} keeps Sweep area targeting`,()=>verifySweep('current','crimsonCleave',{abilityRank,expanded:true}));
test('co-op Sweep uses the same untargeted area plan and pays once', { skip: !COOP_TESTS_ENABLED && COOP_TEST_SKIP_REASON }, ()=>verifySweep('current','whirlingGuard',{coop:true,expanded:true}));
test('corrected Sweep definitions preserve their previous resolved prices and leave utility/single-target cards alone',()=>{
 const r=createRegistries(contentBundle);
 for(const [id,upgraded,cost] of [['hewingArc',false,2],['hewingArc',true,3],['whirlingGuard',false,2],['whirlingGuard',true,2]])assert.equal(resolveCard(r,{cardId:id,upgraded}).cost,cost);
 assert.deepEqual([0,1,2,3,4,5].map(abilityRank=>resolveCard(r,{cardId:'crimsonCleave',abilityRank}).cost),[2,2,3,3,3,4]);
 const utility=r.cards.get('base.auto-sweep');assert.ok(utility.effects.every(e=>e.target!=='allEnemies'));assert.equal(cardNeedsEnemyTarget(utility),false);
 for(const cardId of ['core.strike','core.smash']){const {combat}=fixture('core',cardId);assert.equal(previewCard(combat,'sweep-test').needsTarget,true);}
 for(const def of r.cards.all().filter(c=>combatProfileFor(c).maneuver==='sweep'))assert.ok(def.effects.filter(e=>e.op==='damage').every(e=>e.target==='allEnemies'),def.id);
});
