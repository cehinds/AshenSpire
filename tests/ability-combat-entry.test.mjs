import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries,resolveCard} from '../src/model/registries.js';
import {createRunState,createCardInstance,serializeRun,deserializeRun} from '../src/model/state.js';
import {openRunClassMastery,registriesForClassMastery} from '../src/model/classMasteryRun.js';
import {createRunCombat} from '../src/engine/runCombat.js';
import {createRng} from '../src/engine/rng.js';
import {dispatch,previewCard} from '../src/engine/combat.js';
import {serializeCombatSnapshot,restoreCombatSnapshot} from '../src/engine/combatSnapshot.js';
import {skillXpReceipt} from '../src/engine/skillXp.js';

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
// A grade's printed Mana is the cost formula's at that grade (SPEC §4.3a); the XP pays 5 plus 1 per printed Mana.
// Replaced rule: printed Mana equal to the grade's rank.
const printedMana=(cardId,abilityRank)=>resolveCard(root,{cardId,abilityRank}).manaCost||0;
const spellXp=(mana)=>5+mana;
function durableEnemies(combat){for(const enemy of combat.enemies)enemy.hp=enemy.maxHp=10000;}

for(const abilityRank of [0,5])test(`solo combat entry and snapshot retain earned grade ${abilityRank} and pay its printed spell XP once`,()=>{
  const inst=graded('starShower',abilityRank,`solo-grade-${abilityRank}`),run=runFor(inst);
  const reg=registriesForClassMastery(root,run),rng=createRng(11);
  const fresh=createRunCombat({registries:reg,run,rng,enemyIds:['wanderingSoldier'],settings:{playInDeckOrder:true}});
  durableEnemies(fresh);
  const copied=liveCard(fresh.piles,inst.instanceId);
  assert.equal(copied.abilityRank,abilityRank,'the production draw-pile copy must retain rank zero too');
  const mana=printedMana('starShower',abilityRank);
  assert.equal(resolveCard(reg,copied).manaCost||0,mana);
  const combat=restoreCombatSnapshot({registries:reg,rng,snapshot:serializeCombatSnapshot(fresh)});
  const card=liveCard(combat.piles,inst.instanceId);assert.equal(card.abilityRank,abilityRank);
  assert.ok(combat.piles.hand.includes(card),'the original production opening draw is used');
  const prior=structuredClone(combat.skillXp),beforeMana=combat.player.mana,beforeActions=combat.player.energy;
  previewCard(combat,card.instanceId);assert.deepEqual(combat.skillXp,prior);
  const face=resolveCard(reg,card);
  dispatch(combat,{type:'playCard',cardInstanceId:card.instanceId,targetId:combat.enemies[0].id});
  assert.equal(combat.player.mana,beforeMana-mana);
  assert.equal(combat.player.energy,beforeActions-face.cost);
  const resolved=combat.eventLog.filter(event=>event.type==='cardResolved'&&event.cardInstanceId===card.instanceId);
  assert.equal(resolved.length,1);assert.equal(resolved[0].printedManaCost,mana);
  assert.equal(skillXpReceipt(combat)['item:magic-focus'],spellXp(mana));
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

