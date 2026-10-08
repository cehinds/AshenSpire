import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries,resolveCard} from '../src/model/registries.js';
import {createRunState,createCardInstance,serializeRun,deserializeRun} from '../src/model/state.js';
import {openRunClassMastery,registriesForClassMastery} from '../src/model/classMasteryRun.js';
import {initialClassTreeChoices} from '../src/model/classTree.js';
import {createRunCombat} from '../src/engine/runCombat.js';
import {createRng} from '../src/engine/rng.js';
import {dispatch,previewCard} from '../src/engine/combat.js';
import {serializeCombatSnapshot,restoreCombatSnapshot} from '../src/engine/combatSnapshot.js';
import {skillXpReceipt} from '../src/engine/skillXp.js';
import {bankSkillXp,pendingSkillLevelCount} from '../src/model/skills.js';
import {getStacks} from '../src/engine/statuses.js';
import {createSession,restoreSession} from '../tools/session.mjs';

const root=createRegistries(contentBundle);
const graded=(cardId,abilityRank,id)=>({...createCardInstance(cardId),instanceId:id,abilityRank});
const liveCard=(piles,id)=>Object.values(piles).filter(Array.isArray).flat().find(card=>card.instanceId===id);
function runFor(inst,{legacy=false,classId='starseer',combatExpansionVersion=2}={}){
  const source=legacy?root.legacyProgressionSource:root;
  const run=createRunState({registries:source,classId,seed:11,attributeMode:'standard',combatExpansionVersion,enemyKnowledgeVersion:null});
  openRunClassMastery(source,run,{}, {receiptId:`entry-${classId}-${legacy}`});
  run.deck.unshift(inst);
  return deserializeRun(serializeRun(run));
}
function durableEnemies(combat){for(const enemy of combat.enemies)enemy.hp=enemy.maxHp=10000;}

for(const abilityRank of [0,5])test(`solo combat entry and snapshot retain earned grade ${abilityRank} and pay its printed spell XP once`,()=>{
  const inst=graded('starShower',abilityRank,`solo-grade-${abilityRank}`),run=runFor(inst);
  const reg=registriesForClassMastery(root,run),rng=createRng(11);
  const fresh=createRunCombat({registries:reg,run,rng,enemyIds:['wanderingSoldier'],settings:{playInDeckOrder:true}});
  durableEnemies(fresh);
  const copied=liveCard(fresh.piles,inst.instanceId);
  assert.equal(copied.abilityRank,abilityRank,'the production draw-pile copy must retain rank zero too');
  assert.equal(resolveCard(reg,copied).manaCost,abilityRank);
  const combat=restoreCombatSnapshot({registries:reg,rng,snapshot:serializeCombatSnapshot(fresh)});
  const card=liveCard(combat.piles,inst.instanceId);assert.equal(card.abilityRank,abilityRank);
  assert.ok(combat.piles.hand.includes(card),'the original production opening draw is used');
  const prior=structuredClone(combat.skillXp),beforeMana=combat.player.mana,beforeActions=combat.player.energy;
  previewCard(combat,card.instanceId);assert.deepEqual(combat.skillXp,prior);
  const face=resolveCard(reg,card);
  dispatch(combat,{type:'playCard',cardInstanceId:card.instanceId,targetId:combat.enemies[0].id});
  assert.equal(combat.player.mana,beforeMana-abilityRank);
  assert.equal(combat.player.energy,beforeActions-face.cost);
  const resolved=combat.eventLog.filter(event=>event.type==='cardResolved'&&event.cardInstanceId===card.instanceId);
  assert.equal(resolved.length,1);assert.equal(resolved[0].printedManaCost,abilityRank);
  assert.equal(skillXpReceipt(combat)['item:magic-focus'],abilityRank===0?5:10);
});

test('legacy marker survives the production solo draw copy and combat snapshot without adopting a new grade',()=>{
  const inst={...createCardInstance('desperateRite'),instanceId:'legacy-rite',legacyAbility:true};
  const run=runFor(inst,{legacy:true,classId:'herald'}),reg=registriesForClassMastery(root,run),rng=createRng(13);
  const combat=createRunCombat({registries:reg,run,rng,enemyIds:['wanderingSoldier']});
  const copied=liveCard(combat.piles,inst.instanceId);assert.equal(copied.legacyAbility,true);
  assert.equal(copied.abilityRank,undefined);
  const original=resolveCard(root,inst),face=resolveCard(root,copied);
  assert.equal(face.manaCost,original.manaCost);assert.deepEqual(face.effects,original.effects);
  const restored=restoreCombatSnapshot({registries:reg,rng,snapshot:serializeCombatSnapshot(combat)});
  assert.equal(liveCard(restored.piles,inst.instanceId).legacyAbility,true);
  assert.ok(!restored.registries.progressionEnabled);
});

function sessionFor(rows){
  const session=createSession({registries:root,seedString:'REVIEW'});
  for(const row of rows)session.addMember({id:row.id,name:row.id,classId:row.classId||'starseer',classMastery:{},playInDeckOrder:true});
  session.start();
  for(const row of rows){
    const member=session.session.members.get(row.id);
    member.run=runFor(row.card,{legacy:row.legacy,classId:row.classId||'starseer',combatExpansionVersion:row.combatExpansionVersion||2});
    if(row.skillFeats)member.run.skillFeats=[...row.skillFeats];
    const options=initialClassTreeChoices(registriesForClassMastery(root,member.run),member.run);
    if(options.length)assert.equal(session.chooseMasteryNode(row.id,options[0]).ok,true);
  }
  const saved=session.serialize(),restored=restoreSession(root,saved);
  assert.deepEqual(restored.refusedMembers(),[]);
  restored.setConnectedMany(rows.map(row=>row.id),true);
  return restored;
}
function enterFirstCombat(session){
  for(let step=0;step<24&&session.scene.kind!=='combat';step++){
    if(session.scene.kind==='map')for(const member of session.connectedMembers())session.chooseNode(member.id,session.session.reachableIds[0]);
    else if(session.scene.kind==='event')for(const member of session.connectedMembers())session.scene.next?session.eventContinue(member.id):session.eventChoice(member.id,0);
    else if(session.scene.kind==='reward')for(const member of session.connectedMembers())session.chooseReward(member.id,{});
    else assert.fail(`Unexpected pre-combat scene ${session.scene.kind}`);
  }
  assert.equal(session.scene.kind,'combat');durableEnemies(session.live.combat);
}

for(const abilityRank of [0,5])test(`actual co-op session save/entry preserves grade ${abilityRank}, printed cost and its owner's XP`,()=>{
  const inst=graded('starShower',abilityRank,`coop-grade-${abilityRank}`),session=sessionFor([{id:'a',card:inst}]);
  const wire=session.snapshot().party.find(member=>member.id==='a').deck.find(card=>card.instanceId===inst.instanceId);
  assert.equal(wire.abilityRank,abilityRank,'the client inspection reference must retain the earned grade');
  enterFirstCombat(session);
  const combat=session.live.combat,seat=combat.players.get('a'),card=liveCard(seat.piles,inst.instanceId);
  assert.equal(card.abilityRank,abilityRank);assert.ok(seat.piles.hand.includes(card));
  const beforeMana=seat.entity.mana,beforeActions=seat.entity.energy;
  assert.equal(session.combatPlay('a',card.instanceId,combat.enemies[0].id).ok,true);
  assert.equal(seat.entity.mana,beforeMana-abilityRank);
  assert.equal(seat.entity.energy,beforeActions-resolveCard(root,card).cost);
  const event=combat.eventLog.find(event=>event.type==='cardResolved'&&event.cardInstanceId===card.instanceId);
  assert.equal(event.printedManaCost,abilityRank);assert.equal(event.sourcePlayerId,'a');
  assert.equal(skillXpReceipt(combat,'a')['item:magic-focus'],abilityRank===0?5:10);
});

test('an actual mixed legacy/new co-op session keeps each face and ability-XP mode with its owner',()=>{
  const fresh=graded('starShower',5,'mixed-new');
  const old={...createCardInstance('desperateRite'),instanceId:'mixed-old',legacyAbility:true};
  const session=sessionFor([{id:'new',card:fresh},{id:'old',card:old,legacy:true,classId:'herald'}]);
  const wire=session.snapshot().party.find(member=>member.id==='old').deck[0];assert.equal(wire.legacyAbility,true);
  enterFirstCombat(session);
  const combat=session.live.combat;
  for(const [id,inst] of [['new',fresh],['old',old]]){
    const seat=combat.players.get(id),card=liveCard(seat.piles,inst.instanceId);
    assert.ok(seat.piles.hand.includes(card));
    if(id==='new')assert.equal(card.abilityRank,5);else assert.equal(card.legacyAbility,true);
    const face=resolveCard(id==='new'?root:root.legacyProgressionSource,card),before=seat.entity.mana;
    assert.equal(session.combatPlay(id,card.instanceId,combat.enemies[0].id).ok,true);
    assert.equal(seat.entity.mana,before-(face.manaCost||0));
    const event=combat.eventLog.find(event=>event.type==='cardResolved'&&event.cardInstanceId===card.instanceId);
    assert.equal(event.printedManaCost,face.manaCost||0);assert.equal(event.sourcePlayerId,id);
  }
  assert.equal(skillXpReceipt(combat,'new')['item:magic-focus'],10);
  assert.equal(skillXpReceipt(combat,'old')['item:magic-focus'],undefined,'the legacy seat receives no new per-resolved-spell payout');
  assert.equal(skillXpReceipt(combat,'old').combatManeuvers,undefined);
  assert.equal(combat.eventLog.filter(event=>event.type==='cardResolved').length,2);
});

test('actual co-op settlement banks printed spell XP on the saved linear curve for a manual claim',()=>{
  const inst=graded('starShower',5,'settlement-grade5'),session=sessionFor([{id:'a',card:inst}]);
  const member=session.session.members.get('a'),reg=registriesForClassMastery(root,member.run);
  bankSkillXp(reg,member.run,'item:magic-focus',90);
  assert.equal(member.run.skills['item:magic-focus'].level,1);
  enterFirstCombat(session);
  const combat=session.live.combat,seat=combat.players.get('a'),card=liveCard(seat.piles,inst.instanceId);
  for(const enemy of combat.enemies)enemy.hp=1;
  assert.equal(session.combatPlay('a',card.instanceId,combat.enemies[0].id).ok,true);
  assert.equal(session.scene.kind,'reward');
  assert.equal(skillXpReceipt(combat,'a')['item:magic-focus'],10,'no legacy equipped-focus victory bonus');
  assert.equal(member.run.skills['item:magic-focus'].xp,100);
  assert.equal(member.run.skills['item:magic-focus'].level,1,'the victory banks rather than auto-claims the new ability level');
  assert.equal(pendingSkillLevelCount(reg,member.run,'item:magic-focus'),1);
  const saved=session.serialize(),restored=restoreSession(root,saved);
  assert.deepEqual(restored.refusedMembers(),[]);
  assert.deepEqual(restored.session.members.get('a').run.skills['item:magic-focus'],member.run.skills['item:magic-focus']);
  restored.setConnectedMany(['a'],true);
  const beforeClaim=structuredClone(restored.serialize());
  assert.equal(restored.claimMemberSkillLevel('a','item:magic-focus',{saveSession:()=>false}).ok,false);
  assert.deepEqual(restored.serialize(),beforeClaim,'a failed host save preserves the real-play payout and pending level');
  let committed;
  assert.equal(restored.claimMemberSkillLevel('a','item:magic-focus',{saveSession:candidate=>{committed=structuredClone(candidate);return true;}}).ok,true);
  const claimed=restored.session.members.get('a').run;
  assert.equal(claimed.skills['item:magic-focus'].level,2);
  assert.equal(claimed.skills['item:magic-focus'].xp,0);
  assert.equal(claimed.skills['item:magic-focus'].pendingDrafts,beforeClaim.members.find(row=>row.id==='a').run.skills['item:magic-focus'].pendingDrafts+1);
  const ownerOffers=restored.snapshot().party.find(row=>row.id==='a').pendingProgression.skillDrafts;
  assert.ok(ownerOffers.length>0&&ownerOffers.every(offer=>offer.skillId==='item:magic-focus'&&offer.level<=2),'the oldest unpaid ability receipt remains visible within the configured draft limit');
  const reloaded=restoreSession(root,committed);
  assert.deepEqual(reloaded.refusedMembers(),[]);
  assert.deepEqual(reloaded.session.members.get('a').run.skills['item:magic-focus'],claimed.skills['item:magic-focus']);
  assert.deepEqual(reloaded.session.members.get('a').run.abilityOffers,claimed.abilityOffers,'the saved manual claim contains the exact owner offer');
});

test('owned class feat rules mount through the real co-op member transport after reload',()=>{
  const inst=graded('progression-rime-mirror',0,'transport-rime'),session=sessionFor([{id:'a',card:inst,skillFeats:['progression-mirror-of-rime'],combatExpansionVersion:1}]);
  enterFirstCombat(session);
  const combat=session.live.combat,seat=combat.players.get('a'),card=liveCard(seat.piles,inst.instanceId),enemy=combat.enemies[0];
  assert.equal(card.abilityRank,0);assert.ok(seat.piles.hand.includes(card));
  const preview=session.snapshot().scene.players.find(player=>player.id==='a').hand.find(ref=>ref.instanceId===card.instanceId).combatPreview;
  assert.equal(preview.needsTarget,true);
  assert.equal(preview.values.find(value=>value.status==='frost').value,2);
  assert.equal(getStacks(enemy,'frost'),0,'inspection must not mount a live charge or apply its status');
  assert.equal(session.combatPlay('a',card.instanceId,enemy.id).ok,true);
  assert.equal(getStacks(enemy,'frost'),2);
});
