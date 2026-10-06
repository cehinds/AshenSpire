import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState,createCardInstance,serializeRun,deserializeRun,validateRunShape} from '../src/model/state.js';
import {openRunClassMastery,registriesForClassMastery} from '../src/model/classMasteryRun.js';
import {bankSkillXp,claimBankedSkillLevel,xpToNext,spendSkillDraft} from '../src/model/skills.js';
import {rollPendingAbilityOffers} from '../src/model/abilityOffers.js';
import {rollClassMilestoneRewards,claimClassMilestoneReward} from '../src/model/classMilestoneOffers.js';
import {pendingRewardCheckpoint} from '../src/model/rewardSourcePolicy.js';
import {createRng} from '../src/engine/rng.js';

const root=createRegistries(contentBundle);
function fixture(){
  const run=createRunState({registries:root,classId:'reaver',seed:3});
  openRunClassMastery(root,run,{}, {receiptId:'serialized-choice'});
  return {run,reg:registriesForClassMastery(root,run),rng:createRng(3)};
}
function verifySavedChoice(run,key,choice,rawId){
  const restored=deserializeRun(serializeRun(run));
  assert.deepEqual(validateRunShape(restored),[],'a committed unique grade is a valid resumable save');
  assert.equal(restored.pendingReward.chosenDraftCardIds[key],choice);
  restored.pendingReward.chosenDraftCardIds[key]=rawId;
  assert.ok(validateRunShape(restored).some(problem=>problem.includes(`chosenDraftCardIds.${key}`)),'raw family cannot identify a graded choice');
  restored.pendingReward.chosenDraftCardIds[key]=rawId+'@4';
  assert.ok(validateRunShape(restored).some(problem=>problem.includes(`chosenDraftCardIds.${key}`)),'an unoffered grade remains invalid');
}

test('serialized ability claims preserve a bonus grade of an already offered family',()=>{
  const {run,reg,rng}=fixture(),skillId='combatManeuvers';
  Object.assign(run.skills[skillId],{level:4,pendingDrafts:3});
  const rows=rollPendingAbilityOffers(reg,rng,run,{skillId,limit:4}),row=rows[2],offer=run.abilityOffers[row.offerId];
  const cardId=offer.cardIds[0];
  Object.assign(offer,{cardIds:[...offer.cardIds.slice(0,3),cardId],abilityRanks:[2,2,2,5],intelligenceSnapshot:20,bonusRank:5});
  offer.choiceIds=offer.cardIds.map((id,index)=>`${id}@${offer.abilityRanks[index]}`);
  Object.assign(row,structuredClone(offer));
  run.pendingReward=pendingRewardCheckpoint({skillDrafts:rows},{source:'normal',after:'map'});
  const choice=offer.choiceIds[3],key=`skillDraft:${offer.offerId}`;
  assert.equal(spendSkillDraft(run,skillId,offer.offerId,choice),true);
  run.deck.push({...createCardInstance(cardId),abilityRank:5,abilityOfferId:offer.offerId});
  run.pendingReward.states[key]='taken';run.pendingReward.chosenDraftCardIds[key]=choice;
  verifySavedChoice(run,key,choice,cardId);
});

test('serialized class milestone choices preserve a repeated family bonus grade',()=>{
  const {run,reg,rng}=fixture(),skillId='class:reaver';
  for(let level=0;level<2;level++){
    const cost=xpToNext(reg,'class',level);bankSkillXp(reg,run,skillId,cost);
    run.classMasteryState.earnedXp.reaver+=cost;claimBankedSkillLevel(reg,run,skillId);
  }
  const rows=rollClassMilestoneRewards(reg,rng,run),row=rows.find(row=>row.rewardKind==='cards'),offer=run.classMilestoneOffers[row.receiptId];
  const cardId=offer.options.find(id=>root.cards.get(id).gradeProfiles);
  assert.ok(cardId);
  offer.options.push(cardId);offer.abilityRanks.push(3);offer.choiceIds=offer.options.map((id,index)=>Number.isInteger(offer.abilityRanks[index])?`${id}@${offer.abilityRanks[index]}`:id);
  Object.assign(row,structuredClone(offer));
  run.pendingReward=pendingRewardCheckpoint({classMilestoneRewards:rows},{source:'normal',after:'map'});
  const choice=offer.choiceIds.at(-1),key=`classMilestone:${offer.receiptId}`;
  assert.equal(claimClassMilestoneReward(reg,run,offer.receiptId,choice),true);
  run.pendingReward.states[key]='taken';run.pendingReward.chosenDraftCardIds[key]=choice;
  verifySavedChoice(run,key,choice,cardId);
});

test('legacy raw-ID chosen draft saves remain valid',()=>{
  const {run}=fixture();
  run.pendingReward=pendingRewardCheckpoint({skillDrafts:[{skillId:'item:blade',level:1,cardIds:['strike'],ranks:[2]}]},{source:'normal',after:'map'});
  run.pendingReward.states['skillDraft:item:blade:0']='taken';run.pendingReward.chosenDraftCardIds['skillDraft:item:blade:0']='strike';
  assert.deepEqual(validateRunShape(deserializeRun(serializeRun(run))),[]);
});
