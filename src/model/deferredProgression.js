import { rewardPlan } from './rewardplan.js';

const FIELDS = { levelCard: 'levelCards', levelChoice: 'levelChoices', skillDraft: 'skillDrafts', skillRankUp: 'skillRankUps', classDraft: 'classDrafts' };
export const isProgressionReward = (row) => Object.hasOwn(FIELDS, row.kind);
export const progressionTrack = (row) => row.kind === 'classDraft' ? `class:${row.classId}` : row.skillId || 'character';
export const progressionRewardClass = (row) => row.classId || (row.skillId?.startsWith('class:') ? row.skillId.slice(6) : null);
export function progressionRewardUnlocked(row, run) {
  if (!Number.isInteger(row.requiredLevel)) return true;
  const track = progressionTrack(row);
  return (track === 'character' ? run.level?.level || 1 : run.skills?.[track]?.level || 0) >= row.requiredLevel;
}

// Offers keep their original choices and absolute unlock level across victories.
// Skill drafts and rank-ups are re-offered by the combat ledger; reserve each existing draft
// before accepting freshly rolled offers so leaving cannot multiply rewards.
export function mergeProgressionRewards(saved = {}, incoming = {}, run, { manual = true, characterStart = run.level?.level || 1 } = {}) {
  const result = { ...incoming };
  for (const [kind, field] of Object.entries(FIELDS)) {
    const old = structuredClone(saved[field] || []);
    const reservedDrafts = {};
    if (kind === 'skillDraft' || kind === 'skillRankUp' || kind === 'classDraft') for (const row of old) {
      const track = progressionTrack({ ...row, kind });
      reservedDrafts[track] = (reservedDrafts[track] || 0) + 1;
    }
    const fresh = (incoming[field] || []).flatMap((raw, i) => {
      const row = { ...structuredClone(raw), kind };
      if (kind === 'levelChoice' && !row.classId && row.options?.some(option => option.kind === 'classNode')) row.classId = run.class;
      const track = progressionTrack(row);
      if (reservedDrafts[track] > 0) { reservedDrafts[track]--; return []; }
      const requiredLevel = row.requiredLevel ?? (row.source === 'combat' ? run.level?.level || 1 : track === 'character'
        ? manual ? characterStart + (row.ordinal ?? i) + 1 : run.level?.level || 1
        : (run.skills?.[track]?.level || 0) + (row.claimOrdinal || 0));
      if (row.source === 'class' && old.some(savedRow => savedRow.source === 'class'
        && savedRow.skillId === row.skillId && savedRow.requiredLevel === requiredLevel)) return [];
      delete row.kind;
      return [{ ...row, requiredLevel }];
    });
    const combined = [...old, ...fresh].map((row, ordinal) => ({ ...row, ordinal }));
    if (combined.length) result[field] = combined;
    else delete result[field];
  }
  return result;
}

// A class card may be set aside while its rewards wait. Keep those offers out
// of the active checkpoint: the save contract and claim model both bind class
// drafts to the equipped class. Their original choices stay on the run.
export function partitionProgressionRewards(rewards, run) {
  const available = { ...rewards }, deferred = {};
  for (const field of Object.values(FIELDS)) {
    const active = [], waiting = [];
    for (const row of rewards[field] || []) {
      const classId = progressionRewardClass(row);
      (classId && (run.classUnequipped || classId !== run.class) ? waiting : active).push(row);
    }
    if (active.length) available[field] = active.map((row, ordinal) => ({ ...row, ordinal }));
    else delete available[field];
    if (waiting.length) deferred[field] = waiting.map((row, ordinal) => ({ ...row, ordinal }));
  }
  return { available, deferred };
}

export function deferredOtherClassRewardCount(run) {
  return Object.values(FIELDS).reduce((count, field) => count + (run.deferredProgression?.[field] || [])
    .filter(row => progressionRewardClass(row) && (run.classUnequipped || progressionRewardClass(row) !== run.class)).length, 0);
}

export function unclaimedProgressionRewards(checkpoint) {
  const result = {};
  for (const row of rewardPlan(checkpoint.rewards).rows) {
    if (!isProgressionReward(row) || checkpoint.states?.[row.key]) continue;
    const field = FIELDS[row.kind];
    const { kind, key, choice, blockedBy, ...offer } = row;
    (result[field] ||= []).push(offer);
  }
  return result;
}

export function deferredProgressionCount(run) {
  return Object.values(FIELDS).reduce((count, field) => count + (run.deferredProgression?.[field]?.length || 0), 0);
}
