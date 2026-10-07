import {rollPendingAbilityOffers} from './abilityOffers.js';
import {isAbilitySkill} from './abilityGrades.js';
import {rollClassMilestoneRewards} from './classMilestoneOffers.js';
import {mergeProgressionRewards} from './deferredProgression.js';

/** Preserve activation offers without inserting a mandatory door before the map. */
export function queueInitialProgression(registries,rng,run,{meta={},onPersist=null}={}){
  if(!run.initialProgressionPending)return false;
  const before=structuredClone(run),counters=rng.getCounters();
  try{
    const skillDrafts=Object.keys(run.skills || {}).filter(isAbilitySkill)
      .flatMap(skillId=>rollPendingAbilityOffers(registries,rng,run,{skillId}));
    const classMilestoneRewards=rollClassMilestoneRewards(registries,rng,run,{meta});
    const rewards=mergeProgressionRewards(run.deferredProgression,{skillDrafts,classMilestoneRewards},run);
    if(Object.keys(rewards).length)run.deferredProgression=rewards;
    delete run.initialProgressionPending;
    if(onPersist?.()===false)throw new Error('Initial progression offers could not be saved.');
    return true;
  }catch(error){
    for(const key of Object.keys(run))delete run[key];
    Object.assign(run,before);rng.restoreCounters(counters);throw error;
  }
}
