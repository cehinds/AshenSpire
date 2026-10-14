import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState,serializeRun,deserializeRun,validateRunShape} from '../src/model/state.js';
import {openRunClassMastery,registriesForClassMastery} from '../src/model/classMasteryRun.js';
import {spendSkillDraft,rankUpCandidates,raiseCardRank} from '../src/model/skills.js';
import {rollPendingAbilityOffers} from '../src/model/abilityOffers.js';
import {abilityDraftId,pendingAbilityDraftLevels,abilityDraftClaimProblems} from '../src/model/abilityDraftReceipts.js';
import {mergeProgressionRewards,unclaimedProgressionRewards} from '../src/model/deferredProgression.js';
import {createRng} from '../src/engine/rng.js';
import {createSession,restoreSession} from '../tools/session.mjs';
import {rollSkillDraftIds} from '../src/engine/encounters.js';
import {rollGuaranteedSkillDraftIds} from '../src/engine/sourceRewardBonuses.js';

const root=createRegistries(contentBundle),skillId='combatManeuvers';
function fixture(){
  const run=createRunState({registries:root,classId:'reaver',seed:3,enemyKnowledgeVersion:null});openRunClassMastery(root,run,{}, {receiptId:'draft-ledger'});
  const base=registriesForClassMastery(root,run);
  const ids=['quickstep','backstep','stomp'],defs=ids.map(id=>({...root.cards.get(id),abilityKind:'maneuver',abilityRank:0,abilityFamily:id,tags:['source:unarmed'],gradeProfiles:Array.from({length:6},(_,rank)=>({rank,actionCost:1,manaCost:0,effects:[{op:'block',target:'self',amount:rank+1}]}))}));
  const cards={all:()=>defs,get:id=>defs.find(card=>card.id===id),has:id=>ids.includes(id)};
  const reg={...base,masterySource:null,cards,balance:{...base.balance,skill:{...base.balance.skill,draftsPerCombat:10},progression:{...base.balance.progression,lessons:{...base.balance.progression.lessons,[skillId]:ids}}}};
  Object.assign(run.skills[skillId],{level:3,pendingDrafts:3});
  return {run,reg,rng:createRng(3)};
}
test('out-of-order claims survive reward merging and save/reload without replay or RNG changes',()=>{
  const {run,reg,rng}=fixture(),rows=rollPendingAbilityOffers(reg,rng,run,{skillId}),third=rows[2];
  assert.equal(rows.length,3);const checkpoint={rewards:{skillDrafts:rows},states:{}};
  assert.equal(spendSkillDraft(run,skillId,third.offerId,third.choiceIds[0]),true);checkpoint.states['skillDraft:'+third.offerId]='taken';
  assert.equal(run.skills[skillId].level,3);assert.equal(run.skills[skillId].pendingDrafts,2);
  const counters=rng.getCounters(),saved=serializeRun(run),restored=deserializeRun(saved);
  const incoming=rollPendingAbilityOffers(reg,rng,restored,{skillId});
  assert.deepEqual(incoming.map(row=>row.level),[1,2]);assert.deepEqual(rng.getCounters(),counters);
  const merged=mergeProgressionRewards(unclaimedProgressionRewards(checkpoint),{skillDrafts:incoming},restored);
  assert.deepEqual(merged.skillDrafts.map(row=>row.offerId),rows.slice(0,2).map(row=>row.offerId));
  assert.equal(spendSkillDraft(restored,skillId,third.offerId,third.choiceIds[0]),false);
  assert.deepEqual(mergeProgressionRewards({skillDrafts:rows},{skillDrafts:rows},restored).skillDrafts.map(row=>row.level),[1,2]);
  for(const row of incoming)assert.equal(spendSkillDraft(restored,skillId,row.offerId,row.choiceIds[0]),true);
  assert.deepEqual(rollPendingAbilityOffers(reg,rng,restored,{skillId}),[]);assert.equal(restored.skills[skillId].pendingDrafts,0);
  assert.deepEqual(validateRunShape(restored),[]);assert.equal(Object.keys(restored.abilityDraftClaims[skillId]).length,3);
});
test('weapon rank-ups exclude authored ability grades and reject a direct no-op raise without consuming the queue',()=>{
  const {run,reg}=fixture();run.skills['item:blade']={level:3,xp:0,pendingDrafts:0,pendingRankUps:1};
  const original=reg.cards.get('quickstep'),definition={...original,tags:['blade']};
  const cards={...reg.cards,get:id=>id==='quickstep'?definition:reg.cards.get(id)};
  const fixtureReg={...reg,cards};const card={instanceId:'grade-card',cardId:'quickstep',abilityRank:2,upgraded:false};run.deck.push(card);
  assert.ok(!rankUpCandidates(fixtureReg,run,'item:blade').some(row=>row.instanceId===card.instanceId));
  assert.equal(raiseCardRank(fixtureReg,run,'item:blade',card.instanceId),null);assert.equal(run.skills['item:blade'].pendingRankUps,1);assert.equal(card.rank,undefined);
  delete card.abilityRank;card.legacyAbility=true;
  assert.ok(rankUpCandidates(fixtureReg,run,'item:blade').some(row=>row.instanceId===card.instanceId));
  delete card.legacyAbility;delete run.progressionRulesVersion;
  assert.ok(rankUpCandidates(fixtureReg,run,'item:blade').some(row=>row.instanceId===card.instanceId));
});
test('expanded legacy proficiency draft channels cannot stamp an authored family with a legacy rank',()=>{
  const {reg,run}=fixture(),ids=reg.cards.all().map(card=>card.id);
  const cards={...reg.cards,get:id=>({...reg.cards.get(id),tags:['blade'],rarity:'common'})};
  const classes={...reg.classes,get:id=>({...reg.classes.get(id),cardPool:ids})};
  const scoped={...reg,cards,classes,progressionEnabled:true},args={classId:'reaver',loadout:run.loadout,skillId:'item:blade',level:3,schools:['blade']};
  for(const roll of [rollSkillDraftIds,rollGuaranteedSkillDraftIds]){
    assert.deepEqual(roll(scoped,createRng(1),args),[]);
    assert.equal(roll({...scoped,progressionEnabled:false},createRng(1),args).length,3);
  }
});
test('unfunded previews, forged choices and ambiguous bonus-family IDs cannot spend a receipt',()=>{
  const {run,reg,rng}=fixture(),future=rollPendingAbilityOffers(reg,rng,run,{skillId,banked:1,limit:4})[3];
  const before=serializeRun(run);assert.equal(spendSkillDraft(run,skillId,future.offerId,future.choiceIds[0]),false);assert.equal(serializeRun(run),before);
  assert.equal(spendSkillDraft(run,skillId,abilityDraftId(skillId,1),'forged@5'),false);
  assert.equal(spendSkillDraft(run,'item:magic-focus',abilityDraftId(skillId,1),'quickstep@1'),false);
  Object.assign(run.skills[skillId],{level:4,pendingDrafts:4});assert.equal(spendSkillDraft(run,skillId,future.offerId,future.choiceIds[0]),true);
  const offer=run.abilityOffers[abilityDraftId(skillId,1)];offer.cardIds.push(offer.cardIds[0]);offer.abilityRanks.push(4);offer.choiceIds.push(offer.cardIds[0]+'@4');
  assert.equal(spendSkillDraft(run,skillId,offer.offerId,offer.cardIds[0]),false);
  assert.equal(spendSkillDraft(run,skillId,offer.offerId,offer.choiceIds.at(-1)),true);
  assert.equal(run.abilityDraftClaims[skillId][offer.offerId].abilityRank,4);
  run.abilityDraftClaims[skillId][offer.offerId].claimedLevel=0;assert.ok(abilityDraftClaimProblems(run).some(problem=>problem.includes('unfunded')));
});
test('pre-ledger saves recover exact taken checkpoint identities and keep legacy count-only claims',()=>{
  const {run,reg,rng}=fixture(),rows=rollPendingAbilityOffers(reg,rng,run,{skillId});delete run.abilityDraftClaims;
  run.skills[skillId].pendingDrafts=2;run.pendingReward={rewards:{skillDrafts:rows},states:{['skillDraft:'+rows[2].offerId]:'taken'}};
  assert.deepEqual(pendingAbilityDraftLevels(run,skillId),[1,2]);assert.equal(run.abilityDraftClaims[skillId][rows[2].offerId].migrated,true);
  const older=fixture().run;delete older.abilityDraftClaims;older.skills[skillId].pendingDrafts=2;
  assert.deepEqual(pendingAbilityDraftLevels(older,skillId),[2,3]);
  const legacy=fixture().run;delete legacy.progressionRulesVersion;
  assert.equal(spendSkillDraft(legacy,skillId),true);assert.equal(legacy.skills[skillId].pendingDrafts,2);assert.equal(legacy.abilityDraftClaims,undefined);
});
test('co-op host claims exact offers once across reload and its reconnect catch-up queue',()=>{
  const {run,reg,rng}=fixture(),rows=rollPendingAbilityOffers(reg,rng,run,{skillId});
  const S=createSession({registries:root,seedString:'CLAIMS'});for(const id of ['a','b'])S.addMember({id,name:id,classId:'reaver',classMastery:{}});S.start();
  const a=S.session.members.get('a'),b=structuredClone(S.session.members.get('b').run);Object.assign(a.run,run);
  S.session.scene={kind:'reward',offers:{a:{cardIds:[],skillDrafts:structuredClone(rows)}},chosen:{}};
  const third=rows[2];assert.equal(S.chooseAbilityDraft('a',third.offerId,third.choiceIds[0]).ok,true);
  assert.equal(S.chooseAbilityDraft('a',third.offerId,third.choiceIds[0]).ok,false);
  assert.deepEqual(S.session.members.get('b').run,b);assert.equal(a.run.deck.filter(card=>card.abilityOfferId===third.offerId).length,1);
  const saved=S.serialize(),restored=restoreSession(root,saved);assert.equal(restored.refusedMembers().length,0,JSON.stringify(restored.refusedMembers()));
  assert.equal(restored.chooseAbilityDraft('a',third.offerId,third.choiceIds[0]).ok,false);
  restored.setConnected('a',true);
  const member=restored.session.members.get('a');member.catchup=[{type:'reward',offer:{cardIds:[],skillDrafts:[rows[0]]}}];
  assert.equal(restored.chooseAbilityDraft('a',rows[0].offerId,rows[0].choiceIds[0],{catchup:true}).ok,true);
  assert.equal(member.catchup.length,1);assert.deepEqual(member.catchup[0].offer.skillDrafts,[]);
  assert.equal(restored.chooseAbilityDraft('a',rows[0].offerId,rows[0].choiceIds[0],{catchup:true}).ok,false);
  assert.equal(member.run.skills[skillId].pendingDrafts,1);assert.deepEqual(restored.serialize().rng,saved.rng);
});
