import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCombatAnimation as route, combatRestAfterEvent as restAfter } from '../src/model/combatAnimation.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { tagService } from '../src/model/tagService.js';
import { createSession } from '../tools/session.mjs';
import { equipmentAnimationForLoadout, animationClip, animationArt } from '../src/model/equipmentAnimation.js';
import { createRunState } from '../src/model/state.js';
import { paintedOutfit } from '../src/model/paintedOutfitArt.js';
const reg=createRegistries(contentBundle);
const items=ids=>reg.equipment.armaments.filter(item=>ids.includes(item.id));
const card=(id,profileId)=>{const def=resolveCard(reg,{cardId:id,profileId});return {...def,cardTags:def.cardTags?.length?def.cardTags:tagService(reg).tagsOf('card',def)};};
test('real shield equipment selects bash; dagger and lighting tools do not',()=>{
  for(const id of ['buckler','kiteShield','towerShield','roundShield','spikedShield']) {
    assert.equal(route(card('shieldBash'),items([id])).technique,'shieldBash');
    assert.equal(route(card('strike','shieldAttack'),items([id])).technique,'shieldBash');
    assert.equal(route(card('defend','shieldGuard'),items([id])).technique,'shieldGuard');
    assert.equal(route({kindIds:['classification.attack'],sourceArmamentId:id},items([id])).technique,'shieldBash');
    assert.equal(route({kindIds:['classification.skill'],tags:['guard']},items([id])).technique,'shieldGuard');
  }
  for(const id of ['parryDagger','torch','lantern']) assert.equal(route(card('shieldBash'),items([id])).technique,'attack');
  assert.equal(route(card('defend','shieldGuard'),items(['parryDagger'])).technique,'parry');
  assert.equal(route({...card('strike','shieldAttack'),sourceArmamentId:'parryDagger'},items(['parryDagger','buckler'])).technique,'attack');
  assert.equal(route({kindIds:['classification.attack'],animationTags:['fx:shield']},items(['buckler'])).technique,'shieldBash','the visual tag identifies any shield attack');
  assert.equal(route({kindIds:['classification.skill'],tags:['guard'],animationTags:['fx:shield']},items(['buckler'])).technique,'shieldGuard');
});
test('attack and Power kind precede guard tags; untagged skill casts',()=>{
  // The router reads a card's KIND TAG (model/tree.js cardKind), never its
  // `type` field, so a synthetic card states its kind the way a stamped def
  // does. A card with no kind row is no kind — it casts.
  const kind=(type,tags)=>({type,kindIds:[{attack:'classification.attack',power:'classification.power',skill:'classification.skill'}[type]],tags});
  assert.equal(route(kind('attack',['guard'])).group,'attack');
  assert.equal(route(kind('power',['guard'])).rest,'cast');
  assert.equal(route(kind('skill',[])).technique,'cast');
  assert.equal(route(kind('skill',['block'])).rest,'guard');
  assert.equal(route({type:'attack',tags:['guard']}).group,'cast','a type with no kind row is not quietly an attack');
});
test('card tags select spell casting and Blade choreography across held weapons',()=>{
  const run=createRunState({seed:14,classId:'reaver',registries:reg});
  run.loadout.active.rightHand=0;run.loadout.active.leftHand=0;run.loadout.active.armor=0;
  run.loadout.sets.armor[0]='default';
  const equip=(right,left)=>{run.loadout.sets.rightHand[0]=right;run.loadout.sets.leftHand[0]=left;return equipmentAnimationForLoadout(reg,run.loadout,'reaver');};
  for(const [right,left,profile] of [['straightSword',null,'greatswordTwoHand'],['battleaxe','buckler','swordShield'],['katana','straightSword','twinSword']]){
    const animation=equip(right,left);
    assert.equal(animation?.motionProfile,profile);
    const plan=route(card('strike','bladeAttack'),items([right,left]),{animation});
    assert.equal(plan.technique,'bladeAttack');
    assert.ok(animationClip(animation,plan.technique));
  }
  const sword=equip('straightSword',null);
  assert.equal(route(card('starSpark'),items(['straightSword']),{animation:sword}).technique,'cast');
  assert.equal(route(card('gorefireSlash'),items(['straightSword']),{animation:sword,action:{casting:true}}).technique,'bladeAttack','weapon-source slash keeps blade motion even when its effect family casts');
  const staffStrike=route(card('strike','staffMagicAttack'),items(['ashStaff']),{animation:sword,action:{family:'slash',motion:'impact'}});
  assert.deepEqual([staffStrike.technique,staffStrike.family,staffStrike.motion],['cast','spell','cast'],'the spell tag wins an ordinary Strike override');
  assert.equal(route(card('shieldBash'),items(['buckler']),{animation:equip('straightSword','buckler')}).technique,'shieldBash');
  assert.equal(route(card('defend','shieldGuard'),items(['buckler'])).technique,'shieldGuard');
  const shieldSet=equip('straightSword','buckler');
  const painted=paintedOutfit('reaver','default');
  const shieldArt=animationArt(shieldSet,painted);
  assert.equal(animationClip(shieldSet,'shieldBash'),null,'weapon attacks do not replace shield bash');
  assert.equal(animationClip(shieldSet,'shieldGuard'),null,'weapon defense does not replace shield guard');
  for(const pose of ['shieldBash1','shieldBash2','shieldBash3','shieldGuard1','shieldGuard2','shieldGuard3'])
    assert.equal(shieldArt.frames[pose].file,painted.frames[pose].file,pose);
  const bowClip=equip('shortbow',null);
  assert.equal(bowClip?.motionProfile,'bow');
  const bowPlan=route(card('strike','bowPierceAttack'),items(['shortbow']),{animation:bowClip});
  assert.deepEqual([bowPlan.technique,bowPlan.family,bowPlan.motion],
    ['bowAttack','projectile','release'],'a bow Attack uses the authored draw and release');
  assert.equal(route({...card('strike','bowPierceAttack'),sourceArmamentId:'dagger'},items(['shortbow','dagger']),{animation:bowClip}).technique,'attack');
  assert.equal(equip('warhammer',null),null,'the hammer lacks the Blade motion tag');
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
  // The actor/profile receipt fixture replays the pre-expansion character setup.
  const host=createSession({registries:createRegistries(legacyContentBundle),seedString:'GUARD2'});
  for(const id of ['p1','p2'])host.addMember({id,name:id,classId:'reaver'});
  host.start();
  for(const member of host.session.members.values())delete member.run.reactionRulesVersion;
  for(const id of ['p1','p2'])host.chooseNode(id,host.session.mapGraph.startIds[0]);
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
