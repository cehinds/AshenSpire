import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { ASHEN_BLIGHT_RULES } from '../src/content/ashenBlight.js';
import { createRegistries } from '../src/model/registries.js';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { equippedPieces } from '../src/model/loadout.js';
import { createSession } from '../tools/session.mjs';
import { projectLanSnapshot } from '../tools/lan-state.mjs';
import { coopEnemyIntent } from '../src/ui/models/CoopIntentModel.js';
import { resolveCoopPlayedCombatCard } from '../src/ui/models/PlayedCombatCard.js';
import { payAshenBlight } from '../src/engine/ashenBlight.js';

const registries=createRegistries({...contentBundle,equipment:{...contentBundle.equipment,
  targets:[...contentBundle.equipment.targets,{target:'receiptShield',classId:'*',cardId:'shieldBash'}],
  armaments:contentBundle.equipment.armaments.map(piece=>piece.id==='roundShield'?{...piece,mods:[...(piece.mods||[]),'receiptShield.block=+1']}:piece)},balance:{...contentBundle.balance,
  enemyKnowledge:{...contentBundle.balance.enemyKnowledge,reads:{...contentBundle.balance.enemyKnowledge.reads,
    minimumExact:0,maximumExact:0,minimumClue:0,maximumClue:0}}}});
function fixture({version=2,convertedSeat=null}={}) {
  let refuseSave=false;
  const host=createSession({registries,seedString:'GUARD2',combatExpansionVersion:version,
    knowledgeAuthority:version===2?{roomId:'played-card-receipt-'+(convertedSeat||'ordinary'),privateSeed:0x24681357}:null,
    saveSession:()=>!refuseSave});
  host.addMember({id:'p1',name:'Different owner',classId:'rogue',playInDeckOrder:true});
  host.addMember({id:'p2',name:'Counter owner',classId:'reaver',playInDeckOrder:true});
  host.start();
  for(const member of host.session.members.values()) {
    while(member.run.classMasteryState?.initialTreeTiers.length) {
      const choices=initialClassTreeChoices(registriesForClassMastery(registries,member.run),member.run);
      assert.equal(host.chooseMasteryNode(member.id,choices[0]).ok,true);
    }
    if(member.id==='p2') {
      const card=member.run.deck.find(card=>card.cardId==='shieldBash'&&card.grantedBy==='roundShield');
      assert.ok(card,'actual mounted Round Shield card');
      card.abilityRank=1;
      member.run.deck=[card,...member.run.deck.filter(other=>other!==card)];
    }
  }
  for(const id of ['p1','p2']) assert.equal(host.chooseNode(id,host.session.mapGraph.startIds[0]).ok,true);
  const combat=host.live.combat;
  if(convertedSeat) {
    const owner=combat.players.get(convertedSeat).entity;
    assert.equal(payAshenBlight({...combat,draw:()=>.99},owner,{amount:100,receiptId:'projection-'+convertedSeat,combatKey:combat.combatKey}).converted,true);
    for(const threshold of [25,50,75]) assert.equal(host.combatBlightFeat(convertedSeat,{threshold,path:'martial'}).ok,true);
  }
  for(const seat of combat.players.values()) seat.entity.energy=seat.entity.stamina=seat.entity.mana=20;
  assert.equal(host.combatEndTurn('p1').ok,true,'a real host action refreshes the funded fixture projection');
  const card=combat.players.get('p2').piles.hand.find(card=>card.cardId==='shieldBash'&&card.grantedBy==='roundShield');
  assert.ok(card,'the real ordered starter hand contains its mounted card');
  assert.ok(card.mods.includes('block=+1'),'the supported equipment modifier is stamped onto the real mounted instance');
  return{host,combat,card,refuse:()=>{refuseSave=true;}};
}
const state=({host,combat})=>JSON.stringify({saved:host.serialize(),events:combat.eventLog,rng:combat.rng.getCounters()});

for(const convertedSeat of [null,'p1','p2']) test(`real session projects p2's paid mounted card/tier with ${convertedSeat||'neither seat'} converted`,()=>{
  const f=fixture({convertedSeat}),{host,combat,card}=f;
  const instance=structuredClone(card),hp=combat.enemies.map(enemy=>enemy.hp);
  const before=host.snapshot().scene.players.find(player=>player.id==='p2');
  const price=before.hand.find(row=>row.instanceId===card.instanceId).upcastPreviews[2];
  assert.equal(host.combatPlay('p2',card.instanceId,'p2',undefined,2).ok,true);
  const snapshot=host.snapshot(),scene=snapshot.scene;
  const engine=combat.eventLog.filter(event=>event.type==='cardPlayed').at(-1);
  const event=scene.events.find(event=>event.type==='cardPlayed');
  assert.ok(event,'accepted host action publishes its played-card receipt');
  assert.deepEqual(event.cardInstance,instance);assert.equal(event.cardInstance.abilityRank,1);
  assert.deepEqual(event.cardTags,engine.cardTags);
  assert.equal(event.upcastTier,2);assert.equal(event.playerId,'p2');
  assert.notEqual(event.cardInstance,engine.cardInstance);assert.notEqual(event.cardTags,engine.cardTags);
  const after=scene.players.find(player=>player.id==='p2');
  assert.equal(after.hand.some(row=>row.instanceId===instance.instanceId),false);
  assert.equal(after.energy,before.energy-price.cost);assert.equal(after.mana,before.mana-price.manaCost);
  assert.deepEqual(combat.enemies.map(enemy=>enemy.hp),hp);
  const def=resolveCoopPlayedCombatCard(registries,snapshot,event),run=host.session.members.get('p2').run;
  assert.equal(Boolean(def.ashenBlightConverted),convertedSeat==='p2');
  assert.deepEqual(def,resolveCoopPlayedCombatCard(registries,snapshot,engine),'projected receipt resolves the same paid owner/tier/permanent rank');
  const modifiedBase=resolveCoopPlayedCombatCard(registries,snapshot,{...event,upcastTier:0});
  assert.equal(def.upcastTier,2);
  assert.equal(def.effects.find(effect=>effect.op==='block').amount,modifiedBase.effects.find(effect=>effect.op==='block').amount+4,'the paid Tier2 adds its actual primary Block bonus');
  assert.equal(def.counterPayload.poise,modifiedBase.counterPayload.poise+2,'the paid Tier2 adds its actual Counter Poise bonus');
  const unmodified=resolveCoopPlayedCombatCard(registries,snapshot,{...event,upcastTier:0,cardInstance:{...instance,mods:instance.mods.filter(mod=>mod!=='block=+1')}});
  const block=definition=>definition.effects.filter(effect=>effect.op==='block').reduce((sum,effect)=>sum+effect.amount,0);
  assert.equal(block(modifiedBase)-block(unmodified),convertedSeat==='p2'?1+ASHEN_BLIGHT_RULES.convertedPrintedBonusPct/100:1,'a real permanent modifier remains effective after projection');
  assert.equal(resolveCombatAnimation(def,equippedPieces(registries,run.loadout,run.class),{combatExpansionVersion:2}).group,'defend');
  const wire=projectLanSnapshot(snapshot,['p1']),wireEvent=wire.scene.events.find(event=>event.type==='cardPlayed');
  assert.deepEqual(wireEvent.cardInstance,instance,'the played public card survives the actual connection projection');
  assert.equal(wireEvent.upcastTier,2);
  assert.equal(wire.party.find(member=>member.id==='p2').enemyKnowledgeState,undefined);
  for(const held of wire.scene.players.find(player=>player.id==='p2').hand) {
    assert.equal(held.combatPreview,undefined);assert.equal(held.upcastPreviews,undefined);
  }
  for(const enemy of wire.scene.enemies) {
    assert.deepEqual(Object.keys(enemy.knowledgeAction.reads),['p1']);
    assert.equal(enemy.knowledgeAction.category,undefined);assert.equal(enemy.combatStance,undefined);
    assert.equal(coopEnemyIntent(enemy,'p1').hidden,true);
  }
  for(const other of scene.events.filter(row=>row.type!=='cardPlayed')) for(const key of ['cardInstance','cardTags','upcastTier']) assert.equal(Object.hasOwn(other,key),false);
  for(const key of ['abilityEntities','abilityBefore','rng','privateSeed','enemyKnowledge']) assert.equal(Object.hasOwn(event,key),false);
  assert.doesNotMatch(JSON.stringify(wire),/privateSeed|readCounters|knowledgeAuthority/);
  wireEvent.cardInstance.mods.push('block=+99');wireEvent.cardInstance.abilityRank=99;wireEvent.cardTags.push('injected-tag');
  assert.deepEqual(event.cardInstance,instance);assert.deepEqual(engine.cardInstance,instance);
  assert.equal(event.cardTags.includes('injected-tag'),false);assert.equal(engine.cardTags.includes('injected-tag'),false);
});

test('preview/cancel boundary and rejected tier, seat, or price publish no play and spend nothing',()=>{
  const f=fixture(),{host,combat,card}=f;
  const prior=state(f);
  host.snapshot();host.snapshot();
  assert.equal(state(f),prior,'tier previews may be abandoned without a host action');
  for(const [owner,tier] of [['p2',99],['p1',2]]) {
    assert.equal(host.combatPlay(owner,card.instanceId,'p2',undefined,tier).ok,false);
    assert.equal(state(f),prior);
  }
  const seat=combat.players.get('p2');seat.entity.energy=seat.entity.stamina=2;
  const lowSP=state(f);
  assert.equal(host.combatPlay('p2',card.instanceId,'p2',undefined,2).ok,false);
  assert.equal(state(f),lowSP);
  assert.equal(host.snapshot().scene.events.some(event=>event.type==='cardPlayed'),false);
});

test('refused durable host commit retains the full original card, resources, RNG and event stream',()=>{
  const f=fixture(),prior=state(f);f.refuse();
  assert.equal(f.host.combatPlay('p2',f.card.instanceId,'p2',undefined,2).ok,false);
  assert.equal(state(f),prior);
  assert.equal(f.host.snapshot().scene.events.some(event=>event.type==='cardPlayed'),false);
});

test('legacy session preserves absent expanded instance/tier metadata',()=>{
  const {host,combat,card}=fixture({version:1});
  assert.equal(host.combatPlay('p2',card.instanceId,combat.enemies[0].id).ok,true);
  const event=host.snapshot().scene.events.find(event=>event.type==='cardPlayed');
  assert.ok(event);
  assert.equal(Object.hasOwn(event,'cardInstance'),false);assert.equal(Object.hasOwn(event,'upcastTier'),false);
});
