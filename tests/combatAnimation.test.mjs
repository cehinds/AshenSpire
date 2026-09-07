import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCombatAnimation as route, combatRestAfterEvent as restAfter } from '../src/model/combatAnimation.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { tagService } from '../src/model/tagService.js';
import { createSession } from '../tools/session.mjs';
const reg=createRegistries(contentBundle);
const items=ids=>reg.equipment.armaments.filter(item=>ids.includes(item.id));
const card=(id,profileId)=>{const def=resolveCard(reg,{cardId:id,profileId});return {...def,cardTags:def.cardTags?.length?def.cardTags:tagService(reg).tagsOf('card',def)};};
test('real shield equipment selects bash; dagger and lighting tools do not',()=>{
  for(const id of ['buckler','kiteShield','towerShield','roundShield','spikedShield']) {
    assert.equal(route(card('shieldBash'),items([id])).technique,'shieldBash');
    assert.equal(route(card('strike','shieldAttack'),items([id])).technique,'shieldBash');
    assert.equal(route(card('defend','shieldGuard'),items([id])).technique,'shieldGuard');
  }
  for(const id of ['parryDagger','torch','lantern']) assert.equal(route(card('shieldBash'),items([id])).technique,'attack');
  assert.equal(route(card('defend','shieldGuard'),items(['parryDagger'])).technique,'parry');
  assert.equal(route({...card('strike','shieldAttack'),sourceArmamentId:'parryDagger'},items(['parryDagger','buckler'])).technique,'attack');
});
test('attack and Power type precede guard tags; untagged skill casts',()=>{
  assert.equal(route({type:'attack',tags:['guard']}).group,'attack');
  assert.equal(route({type:'power',tags:['guard']}).rest,'cast');
  assert.equal(route({type:'skill',tags:[]}).technique,'cast');
  assert.equal(route({type:'skill',tags:['block']}).rest,'guard');
});
test('rest reducer is owner-relative and paced/flush reduction agree',()=>{
  const events=[{type:'cardPlayed',playerId:'a'},{type:'cardPlayed',playerId:'a'},{type:'playerTurnStart',playerId:'b'},{type:'playerTurnStart',playerId:'a'}];
  const plans=[{rest:'parry'},{rest:null},null,null];
  let rest='idle';rest=restAfter(rest,events[0],'a',plans[0]);assert.equal(rest,'parry');
  rest=restAfter(rest,events[1],'a',plans[1]);assert.equal(rest,'parry');
  rest=restAfter(rest,events[2],'a');assert.equal(rest,'parry');
  rest=restAfter(rest,events[3],'a');assert.equal(rest,'idle');
  assert.equal(events.reduce((r,e,i)=>restAfter(r,e,'a',plans[i]),'idle'),rest);
});
test('authoritative co-op digest carries accepted actor and equipment profile, plus owner turn resets',()=>{
  const host=createSession({registries:reg,seedString:'GUARD2'});
  for(const id of ['p1','p2'])host.addMember({id,name:id,classId:'reaver'});
  host.start();for(const id of ['p1','p2'])host.chooseNode(id,host.session.mapGraph.startIds[0]);
  const combat=host.live.combat,p= combat.players.get('p2');
  p.piles.hand.push({instanceId:'animation-guard',cardId:'defend',profileId:'shieldGuard',equipmentRole:'guard',upgraded:false});
  p.entity.energy=10;p.entity.stamina=100;
  const accepted=host.combatPlay('p2','animation-guard');assert.ok(accepted.ok,accepted.error);
  const snapshot=host.snapshot();
  const event=snapshot.scene.events.find(event=>event.type==='cardPlayed');
  assert.equal(event.playerId,'p2');assert.equal(event.profileId,'shieldGuard');
  assert.ok(snapshot.party.every(member=>member.loadout));
  assert.equal(host.combatPlay('p2','not-in-hand').ok,false);
  host.combatEndTurn('p1');host.combatEndTurn('p2');
  const starts=host.snapshot().scene.events.filter(event=>event.type==='playerTurnStart');
  assert.deepEqual(starts.map(event=>event.playerId).sort(),['p1','p2']);
});
