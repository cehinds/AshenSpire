import {test} from 'node:test';import assert from 'node:assert/strict';import {combatEffectFor as effect, combatEffectPlan, combatEffectTags, combatEffectTargetIds} from '../src/model/combatEffects.js';
test('ranged identity, not mana or class, selects projectiles',()=>{const hit={op:'damage',target:'enemy'};assert.equal(effect({type:'attack',manaCost:2,effects:[hit]},'starseer').projectile,false);assert.equal(effect({type:'attack',tags:['starstone','ranged'],effects:[hit]}).kind,'starbolt');assert.equal(effect({type:'attack',tags:['blade','starstone'],effects:[hit]}).projectile,false);});
test('guards and Powers use local effects and heals wait for actual receipts',()=>{assert.deepEqual(effect({type:'skill',tags:['guard']}),{kind:'physicalGuard',projectile:false});assert.equal(effect({type:'power'},'reaver').kind,'focusMotes');assert.equal(effect({type:'skill',tags:['heal'],effects:[{op:'heal',target:'self'}]}).kind,'cleanse');});
import {createRegistries} from '../src/model/registries.js';import {contentBundle} from '../src/content/index.js';import {createSession} from '../tools/session.mjs';
test('co-op stance receipt identifies the actor for its visual effect',()=>{const host=createSession({registries:createRegistries(contentBundle),seedString:'GUARD2'});for(const id of ['p1','p2'])host.addMember({id,name:id,classId:'reaver'});host.start();for(const id of ['p1','p2'])host.chooseNode(id,host.session.mapGraph.startIds[0]);const p=host.live.combat.players.get('p2');p.piles.hand.push({instanceId:'stance-fx',cardId:'enterBulwark',upgraded:false});p.entity.energy=20;p.entity.stamina=99;const r=host.combatPlay('p2','stance-fx');assert.ok(r.ok,r.error);const receipt=host.snapshot().scene.events.find(e=>e.type==='stanceEntered');assert.equal(receipt.playerId,'p2');assert.equal(receipt.stance,'bulwark');});
import { COMBAT_EFFECT_ART } from '../src/content/combatEffectArt.js';
import { combatEffectPresentation } from '../src/content/combatEffectPresentation.js';
import { combatEffectForEvent } from '../src/model/combatEffectEvents.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('every shipped effect has six distinct painted frames',()=>{
 assert.equal(Object.keys(COMBAT_EFFECT_ART).length,56);
 for(const [kind,frames]of Object.entries(COMBAT_EFFECT_ART)){
  assert.equal(frames.length,6,kind);
  const hashes=frames.map(file=>createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex'));
  assert.equal(new Set(hashes).size,6,kind+' must not repeat artwork');
 }
});

test('defensive cards and equipment distinguish physical, magic, arcane and barrier effects',()=>{
 const reg=createRegistries(contentBundle);
 for(const [id,kind]of [['crystalBarrier','barrier'],['umbralWard','barrier'],['starstoneWard','arcaneWard'],['wardingStar','magicGuard'],['frostVeil','frostAura']]){
  const card=resolveCard(reg,{cardId:id});assert.equal(effect({...card,cardTags:combatEffectTags(reg,card)},card.class).kind,kind);
 }
 for(const [profile,kind]of [['shieldGuard','physicalGuard'],['staffGuard','magicGuard'],['sceptreGuard','arcaneWard']]){
  const card=resolveCard(reg,{cardId:'defend',profileId:profile});assert.equal(effect({...card,cardTags:combatEffectTags(reg,card)}).kind,kind);
 }
});

test('actual status receipts own afflictions and resisted attempts do not burst',()=>{
 for(const [status,kind]of [['bleed','bloodLoss'],['frost','frostbite']])assert.deepEqual(combatEffectForEvent({type:'procBurst',status,targetId:'e1'}),{kind,targetId:'e1'});
 for(const [status,kind]of [['bleed','bloodAura'],['frost','frostAura'],['venom','poisoned'],['prepared','duelistStance'],['starstoneCharge','channelStance']])assert.equal(combatEffectForEvent({type:'statusApplied',status,stacks:1,targetId:'p2'}).kind,kind);
 assert.deepEqual(combatEffectForEvent({type:'stanceEntered',stance:'bulwark',playerId:'p2'}),{kind:'bulwarkStance',targetId:'p2'});
 assert.equal(combatEffectForEvent({type:'stanceEntered',stance:'gorefire'}).kind,'berserkStance');
 assert.equal(combatEffectForEvent({type:'enemyStaggered',targetId:'e1'}).kind,'staggerBreak');
 for(const e of [{type:'procResisted',status:'frost',targetId:'e1'},{type:'statusApplied',status:'venom',stacks:0,targetId:'e1'},{type:'hpLost',cause:'proc:bleed',amount:10,targetId:'e1'}])assert.equal(combatEffectForEvent(e),null);
});

test('co-op digest preserves the fields needed to render status and stagger receipts',()=>{
 const host=createSession({registries:createRegistries(contentBundle),seedString:'FX77'});
 host.addMember({id:'p1',name:'p1',classId:'reaver'});host.start();host.chooseNode('p1',host.session.mapGraph.startIds[0]);
 host.snapshot();
 const added=[{type:'statusApplied',targetId:'p1',status:'venom',stacks:2,total:2},{type:'procBurst',targetId:'p1',status:'frost'},{type:'enemyStaggered',targetId:'e1'}];
 host.live.combat.eventLog.push(...added);
 const player=host.live.combat.players.get('p1');player.entity.energy=99;player.entity.stamina=99;
 player.piles.hand.push({instanceId:'publish-status-fx',cardId:'defend',upgraded:false});
 assert.ok(host.combatPlay('p1','publish-status-fx').ok);
 const events=host.snapshot().scene.events;
 for(const wanted of added){const found=events.find(e=>e.type===wanted.type);assert.ok(found);for(const [key,value]of Object.entries(wanted))assert.equal(found[key],value);assert.ok(combatEffectForEvent(found));}
 const seq=host.snapshot().scene.receiptSeq;assert.equal(host.snapshot().scene.receiptSeq,seq);
});

test('subtle utility effects stay smaller and dimmer than combat releases',()=>{
 for(const [tag,kind]of [['precision','steelGlint'],['flourish','dustStep'],['guile','dustStep'],['starstone','focusMotes'],['ritual','focusMotes']]){
  assert.equal(effect({type:'skill',tags:[tag]}).kind,kind);
  const subtle=combatEffectPresentation(kind),release=combatEffectPresentation('starbolt');
  assert.ok(subtle.opacity<release.opacity);assert.ok(subtle.sizeScale<release.sizeScale);
 }
 assert.equal(effect({type:'skill',tags:['guard'],equipmentProfileId:'unarmedGuard'}).kind,'guardPulse');
 assert.equal(effect({type:'power',tags:['ritual']}).kind,'ritual');
});
import { combatEffectAngle, combatEffectOrientation } from '../src/ui/combatEffectDirection.js';

test('effect directions preserve upright left art and aim between box centers',()=>{
 assert.equal(combatEffectOrientation('right'),'rotate(0deg) scaleX(1)');
 assert.equal(combatEffectOrientation('left'),'rotate(0deg) scaleX(-1)');
 assert.equal(combatEffectOrientation('up'),'rotate(-90deg) scaleX(1)');
 assert.equal(combatEffectOrientation('down'),'rotate(90deg) scaleX(1)');
 const from={left:0,top:0,width:20,height:40};
 assert.equal(combatEffectAngle(from,{left:100,top:110,width:20,height:20}),45);
 assert.equal(combatEffectAngle(from,{left:-100,top:110,width:20,height:20}),135);
 assert.equal(combatEffectOrientation(135),'rotate(-45deg) scaleX(-1)');
 assert.equal(combatEffectAngle(from,from),0);
 assert.equal(combatEffectAngle(from,null),0);
});
import { tagService } from '../src/model/tagService.js';
import { resolveCard } from '../src/model/registries.js';
test('authored styles use deterministic effects and melee is target-local',()=>{
 for(const [tag,kind]of [['blade','slash'],['pierce','thrust'],['heavy','heavyImpact']]){const plan=effect({type:'attack',tags:[tag],effects:[{op:'damage',target:'enemy'}]});assert.equal(plan.kind,kind);}
 for(const tag of ['blade','pierce','heavy','blood','precision','flourish'])assert.equal(effect({type:'attack',tags:[tag],effects:[{op:'damage',target:'enemy'}]}).at,'target');
 const a={type:'attack',tags:['blood','blade'],effects:[{op:'damage',target:'enemy'}]};assert.deepEqual(effect(a),effect({...a,tags:[...a.tags].reverse()}));assert.equal(effect(a).kind,'bloodSlash');
 assert.equal(effect({type:'attack',tags:['shield'],equipmentProfileId:'shieldAttack',effects:[{op:'damage',target:'enemy'}]}).kind,'shieldBash');
});
test('live named card styles select their authored effects',()=>{
 const reg=createRegistries(contentBundle);
 for(const [id,kind]of [['starstonePebble','starbolt'],['bloodPact','focusMotes']]){const card=resolveCard(reg,{cardId:id});assert.equal(effect({...card,cardTags:combatEffectTags(reg,card)}).kind,kind);}
});

test('expanded effects follow live cards and equipment profiles without changing resource auras',()=>{
 const reg=createRegistries(contentBundle);
 for(const [id,kind]of [['twinPrick','crossSlash'],['bladeDanceRogue','whirlwind'],['sacredHarvest','lifeDrain'],['disorient','bind']]){
  const card=resolveCard(reg,{cardId:id});assert.equal(effect({...card,cardTags:combatEffectTags(reg,card)},card.class).kind,kind,id);
 }
 const healing=reg.cards.all().find(c=>c.class==='herald'&&c.type==='skill'&&c.effects?.every(e=>e.op==='heal'));
 assert.ok(healing);assert.equal(effect({...healing,cardTags:combatEffectTags(reg,healing)},'herald').kind,'cleanse');
 assert.equal(effect({type:'skill',tags:['guard'],equipmentProfileId:'weaponGuard'}).kind,'parry');
 for(const [profile,kind]of [['shieldAttack','shieldBash'],['sceptreArcaneAttack','arcaneBurst']]){
  const card=resolveCard(reg,{cardId:'strike',profileId:profile});assert.equal(effect({...card,cardTags:combatEffectTags(reg,card)}).kind,kind);
 }
});
