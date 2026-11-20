// The saved `run.deferredProgression` ledger (rewards a victory left unclaimed under the retired legacy reward door).
// Nothing writes it any more; an old save may still carry one, and the Character sheet counts what it holds.
const FIELDS = { classMilestone: 'classMilestoneRewards', levelCard: 'levelCards', levelChoice: 'levelChoices', skillDraft: 'skillDrafts', skillRankUp: 'skillRankUps', skillAttribute: 'skillAttributes', skillFeat: 'skillFeats', classDraft: 'classDrafts' };
const progressionRewardClass = (row) => row.classId || (row.skillId?.startsWith('class:') ? row.skillId.slice(6) : null);

export function deferredOtherClassRewardCount(run) {
  return Object.values(FIELDS).reduce((count, field) => count + (run.deferredProgression?.[field] || [])
    .filter(row => progressionRewardClass(row) && (run.classUnequipped || progressionRewardClass(row) !== run.class)).length, 0);
}

export function deferredProgressionCount(run) {
  return Object.values(FIELDS).reduce((count, field) => count + (run.deferredProgression?.[field]?.length || 0), 0);
}
