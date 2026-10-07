import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState,serializeRun,deserializeRun,validateRunShape} from '../src/model/state.js';
import {openRunClassMastery,registriesForClassMastery} from '../src/model/classMasteryRun.js';
import {createRng} from '../src/engine/rng.js';
import {queueInitialProgression} from '../src/model/initialProgression.js';
import {mergeProgressionRewards} from '../src/model/deferredProgression.js';
import {abilityDraftChoice} from '../src/model/abilityDraftReceipts.js';

const root=createRegistries(contentBundle);
test('activation offers are guaranteed and immutable in the saved queue without a mandatory reward door',()=>{
  for(const classId of contentBundle.classes.map(row=>row.id)){
    const run=createRunState({registries:root,classId,seed:9}),rng=createRng(9);
    openRunClassMastery(root,run,{}, {receiptId:`activation:${classId}`});
    const reg=registriesForClassMastery(root,run),before=structuredClone(run.skills),xp=structuredClone(run.level);
    assert.equal(queueInitialProgression(reg,rng,run),true);
    const rows=run.deferredProgression.skillDrafts;
    assert.equal(rows.length,1,classId);assert.equal(rows[0].level,1);assert.equal(rows[0].abilityRanks.slice(0,3).every(rank=>rank===0),true);
    assert.ok(rows[0].choiceIds.every(id=>abilityDraftChoice(rows[0],id)));
    assert.equal(run.pendingReward,undefined,'map entry has no forced reward checkpoint');
    assert.equal(run.initialProgressionPending,undefined);
    assert.deepEqual(run.skills,before);assert.deepEqual(run.level,xp,'queuing never pays or claims XP');
    const offers=structuredClone(run.abilityOffers),counters=rng.getCounters(),queued=structuredClone(run.deferredProgression);
    assert.equal(queueInitialProgression(reg,rng,run),false);
    assert.deepEqual(run.abilityOffers,offers);assert.deepEqual(rng.getCounters(),counters);assert.deepEqual(run.deferredProgression,queued);
    const restored=deserializeRun(serializeRun(run));
    assert.deepEqual(validateRunShape(restored),[]);
    assert.deepEqual(restored.deferredProgression,queued);assert.deepEqual(restored.abilityOffers,offers);
    const nextDoor=mergeProgressionRewards(restored.deferredProgression,{skillDrafts:[structuredClone(rows[0])]},restored);
    assert.equal(nextDoor.skillDrafts.length,1,'first reward merges the same receipt rather than duplicating activation');
    assert.deepEqual(nextDoor.skillDrafts[0].choiceIds,rows[0].choiceIds);
  }
});

test('veteran entitlements and existing deferred choices survive optional initial queuing',()=>{
  const run=createRunState({registries:root,classId:'reaver',seed:11}),rng=createRng(11);
  openRunClassMastery(root,run,{classMastery:{reaver:{xp:10000,level:12,unlockedRows:[]}}},{receiptId:'veteran:initial'});
  const reg=registriesForClassMastery(root,run);run.skills['item:blade']={level:4,xp:0,pendingDrafts:0,pendingAttributePicks:1};
  run.deferredProgression={skillAttributes:[{skillId:'item:blade',level:4,requiredLevel:4,attributeIds:['strength','dexterity']}]};
  const skills=structuredClone(run.skills),level=structuredClone(run.level);
  queueInitialProgression(reg,rng,run);
  assert.equal(run.deferredProgression.skillAttributes.length,1);
  assert.ok(run.deferredProgression.classMilestoneRewards.some(row=>row.rewardKind==='feat'));
  assert.ok(run.deferredProgression.classMilestoneRewards.some(row=>row.rewardKind==='attribute'));
  assert.ok(run.deferredProgression.classMilestoneRewards.every(row=>!['cards','armory','relic'].includes(row.rewardKind)),'spent veteran rewards stay spent');
  assert.deepEqual(run.skills,skills);assert.deepEqual(run.level,level);
  assert.deepEqual(validateRunShape(deserializeRun(serializeRun(run))),[]);
  const ledger=structuredClone(run.classMilestones);assert.equal(queueInitialProgression(reg,rng,run),false);assert.deepEqual(run.classMilestones,ledger);
});

test('refused or throwing initial save restores the whole run and random streams before retry',()=>{
  for(const throwing of [false,true]){
    const run=createRunState({registries:root,classId:'reaver',seed:7}),rng=createRng(7);
    openRunClassMastery(root,run,{}, {receiptId:'activation:save'});
    const reg=registriesForClassMastery(root,run),before=structuredClone(run),counters=rng.getCounters();
    const save=()=>{run.cinders+=10;run.classMilestones.extra={test:true};rng.float('events');if(throwing)throw new Error('disk full');return false;};
    assert.throws(()=>queueInitialProgression(reg,rng,run,{onPersist:save}),/could not be saved|disk full/);
    assert.deepEqual(run,before);assert.deepEqual(rng.getCounters(),counters);
    const successful=structuredClone(run),control=createRng(7);control.restoreCounters(counters);
    queueInitialProgression(reg,control,successful);
    let saved;assert.equal(queueInitialProgression(reg,rng,run,{onPersist:()=>{saved=serializeRun(run);return true;}}),true);
    assert.deepEqual(run,successful);assert.deepEqual(rng.getCounters(),control.getCounters());
    assert.deepEqual(deserializeRun(saved).deferredProgression,successful.deferredProgression);
  }
});
