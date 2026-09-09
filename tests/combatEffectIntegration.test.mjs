import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries,resolveCard} from '../src/model/registries.js';
import {combatEffectPlan,combatEffectTags,combatEffectTargetIds} from '../src/model/combatEffects.js';
import {decorateCombatEffects,combatEffectForEvent,combatEffectReceipt} from '../src/model/combatEffectEvents.js';
import {createSession} from '../tools/session.mjs';
import {COMBAT_EFFECT_ART} from '../src/content/combatEffectArt.js';
import {COMBAT_EFFECT_RULES} from '../src/content/combatEffectRules.js';
import {applyAttackDamage} from '../src/engine/actions.js';
const reg=createRegistries(contentBundle);
const plan=(id,profileId,upgraded=false)=>{const card=resolveCard(reg,{cardId:id,profileId,upgraded});return combatEffectPlan({...card,cardTags:combatEffectTags(reg,card)});};
test('action-only magic motifs use mundane variants; paid activations retain fantastical effects',()=>{
 const card={type:'attack',cost:1,manaCost:1,cardTags:['blood','blade'],effects:[{op:'damage',target:'enemy'}]};
 const paid=combatEffectPlan(card,{energySpent:1,manaSpent:1,staminaSpent:0});
 const free=combatEffectPlan(card,{energySpent:1,manaSpent:0,staminaSpent:0});
 assert.equal(paid.kind,'bloodSlash');assert.equal(paid.cast,'focusMotes');
 assert.equal(free.kind,'slash');assert.equal(free.cast,null);assert.equal(free.activation,'mundaneLow');
 const heavy=combatEffectPlan({...card,cost:2,manaCost:0});
 assert.equal(heavy.kind,'whirlwind');assert.ok(heavy.sizeScale>free.sizeScale);
 const stamina=combatEffectPlan({...card,manaCost:0,staminaCost:2});
 assert.equal(stamina.kind,'bloodSlash');assert.equal(stamina.activation,'resourceHigh');assert.ok(stamina.sizeScale>paid.sizeScale);
 assert.equal(plan('crimsonCleave').kind,'whirlwind');
 assert.equal(plan('disorient').kind,'steelGlint');
});
test('cost variants retain auras, defensive identities and actual X spending',()=>{
 for(const id of ['crystalBarrier','starstoneWard','frostVeil','goreblood']){
  const card=resolveCard(reg,{cardId:id}),tagged={...card,cardTags:combatEffectTags(reg,card)};
  assert.deepEqual(combatEffectPlan(tagged,{energySpent:0,manaSpent:0,staminaSpent:0}),combatEffectPlan(tagged,{energySpent:3,manaSpent:3,staminaSpent:3}),id);
 }
 const x={type:'attack',cost:'X',cardTags:['blade'],effects:[{op:'damage',target:'enemy'}]};
 assert.equal(combatEffectPlan(x,{energySpent:1}).activation,'mundaneLow');
 assert.equal(combatEffectPlan(x,{energySpent:3}).activation,'mundaneHigh');
});
test('real co-op receipts retain the casting seat and a different friendly recipient',()=>{
 const host=createSession({registries:reg,seedString:'GUARD2'});
 for(const id of ['p1','p2'])host.addMember({id,name:id,classId:'reaver'});
 host.start();for(const id of ['p1','p2'])host.chooseNode(id,host.session.mapGraph.startIds[0]);
 const p=host.live.combat.players.get('p2');p.entity.energy=99;p.entity.mana=99;p.entity.stamina=99;
 p.piles.hand.push({instanceId:'fx-hit',cardId:'gorefireSlash',upgraded:false},{instanceId:'fx-ally',cardId:'rallyingBanner',upgraded:false},{instanceId:'fx-status',cardId:'ashOath',upgraded:false});
 host.snapshot();assert.ok(host.combatPlay('p2','fx-hit','e1').ok);
 const hit=host.snapshot().scene.events.map(combatEffectReceipt);
 assert.equal(hit.find(e=>e.type==='cardPlayed').energySpent,1);
 assert.deepEqual(combatEffectTargetIds(plan('gorefireSlash'),hit,'p2'),['e1']);
 assert.deepEqual(combatEffectTargetIds(plan('gorefireSlash'),hit,'p1'),[]);
 assert.ok(host.combatPlay('p2','fx-ally','p1').ok);
 const guard=host.snapshot().scene.events.map(combatEffectReceipt).find(e=>e.type==='blockGained');
 assert.equal(guard.targetId,'p1');assert.ok(guard.amount>0);
 assert.ok(host.combatPlay('p2','fx-status','p1').ok);
 const buffs=host.snapshot().scene.events.map(combatEffectReceipt).filter(e=>e.type==='statusApplied'&&e.status==='strength');
 assert.deepEqual(buffs.map(e=>[e.sourceId,e.targetId,e.stacks]),[['p2','p1',2],['p2','p2',1]]);
});
test('presentation associations do not change materialized combat card or equipment tags',()=>{
 const b={...contentBundle};
 b.tags=b.tags.filter(t=>t.domain!=='presentation');b.tagDomains=b.tagDomains.filter(d=>d.id!=='presentation');
 b.tagFamilyDomains=b.tagFamilyDomains.filter(p=>p.domain!=='presentation');b.tagging=b.tagging.filter(t=>!t.tagId.startsWith('fx:'));
 const baseline=createRegistries(b);
 assert.deepEqual(reg.cards.all(),baseline.cards.all());
 assert.deepEqual(reg.equipment.basicCardProfiles,baseline.equipment.basicCardProfiles);
});
test('every authored playable card and equipment profile resolves to existing art',()=>{
 for(const card of reg.cards.all().filter(c=>['attack','skill','power'].includes(c.type))){
  for(const upgraded of [false,true]){
   const p=plan(card.id,null,upgraded);assert.ok(p,card.id);assert.ok(COMBAT_EFFECT_ART[p.kind],card.id);if(p.cast)assert.ok(COMBAT_EFFECT_ART[p.cast]);
   assert.ok(combatEffectTags(reg,card).length,card.id);
  }
 }
 for(const profile of reg.equipment.basicCardProfiles)assert.ok(plan(profile.baseCardId,profile.id));
 assert.equal(new Set(COMBAT_EFFECT_RULES.map(r=>r.id)).size,COMBAT_EFFECT_RULES.length);
 for(const rule of COMBAT_EFFECT_RULES)assert.ok(COMBAT_EFFECT_ART[rule.kind],rule.id);
});
test('specific combinations beat generic schools and defensive tags',()=>{
 for(const [id,kind]of [['shieldBash','shieldBash'],['gorefireSlash','bloodSlash'],['riposte','riposte'],['guardCounter','riposte'],['crystalBarrier','barrier'],['enterBulwark','ward'],['starstonePebble','starbolt']])assert.equal(plan(id).kind,kind,id);
 assert.equal(plan('strike','shieldAttack').kind,'shieldBash');
 assert.equal(plan('defend','staffGuard').kind,'magicGuard');
 assert.equal(plan('defend','sceptreGuard').kind,'arcaneWard');
 const original=resolveCard(reg,{cardId:'gorefireSlash'}),tags=combatEffectTags(reg,original);
 assert.deepEqual(combatEffectPlan({...original,cardTags:tags}),combatEffectPlan({...original,cardTags:[...tags].reverse()}));
});
test('outcomes select every actual target once and never invent an impact',()=>{
 const p=plan('crimsonCleave');
 assert.deepEqual(combatEffectTargetIds(p,[{type:'damageDealt',targetId:'a',amount:4},{type:'damageDealt',targetId:'b',amount:2},{type:'damageDealt',targetId:'a',amount:4},{type:'damageDealt',targetId:'c',amount:0}]),['a','b']);
 assert.deepEqual(combatEffectTargetIds(p,[]),[]);
 assert.deepEqual(combatEffectTargetIds(p,[{type:'damageDealt',sourceId:'p1',targetId:'e1',amount:3},{type:'damageDealt',sourceId:'e1',targetId:'p1',amount:2},{type:'damageDealt',sourceId:'p2',targetId:'e2',amount:4}],'p1'),['e1']);
 assert.deepEqual(combatEffectTargetIds(plan('disorient'),[{type:'procResisted',targetId:'a',blocked:2},{type:'statusApplied',targetId:'a',stacks:0}]),[]);
});
test('barrier reactions require successful protection and distinguish its last absorbed hit',()=>{
 const barriers=new Map();
 decorateCombatEffects([{type:'cardPlayed',cardId:'crystalBarrier'},{type:'blockGained',targetId:'p2',amount:8}],reg,barriers);
 const events=decorateCombatEffects([{type:'damageDealt',targetId:'p2',blocked:3,blockRemaining:5},{type:'damageDealt',targetId:'p2',blocked:5,blockRemaining:0},{type:'damageDealt',targetId:'p2',blocked:0,blockRemaining:0}],reg,barriers);
 assert.equal(combatEffectForEvent(events[0]).kind,'barrierHit');assert.equal(combatEffectForEvent(events[1]).kind,'barrierBreak');assert.equal(combatEffectForEvent(events[2]),null);
 assert.equal(barriers.size,0);
 decorateCombatEffects([{type:'cardPlayed',cardId:'crystalBarrier'},{type:'blockGained',targetId:'p2',amount:0}],reg,barriers);assert.equal(barriers.size,0);
 assert.equal(combatEffectForEvent({type:'damageDealt',targetId:'p1',blocked:1,blockRemaining:0}).kind,'physicalGuard');
});
test('new status, resistance, dodge and buff sprites need their real outcome',()=>{
 for(const status of ['crimsonBlight','weak','vulnerable','frail','strength','dexterity'])assert.equal(combatEffectForEvent({type:'statusApplied',targetId:'x',status,stacks:1}).kind,status);
 assert.equal(combatEffectForEvent({type:'procBurst',status:'insanity',targetId:'x'}).kind,'insanity');
 assert.equal(combatEffectForEvent({type:'procResisted',blocked:2,targetId:'x'}).kind,'resist');
 assert.equal(combatEffectForEvent({type:'dodgeRolled',sourceId:'p2',success:true}).kind,'dodge');
 assert.equal(combatEffectForEvent({type:'dodgeRolled',sourceId:'p2',success:false}),null);
 for(const stacks of [0,-1])assert.equal(combatEffectForEvent({type:'statusApplied',targetId:'x',status:'strength',stacks}),null);
});
