import { rewardPlan } from './rewardplan.js';

const FIELDS = { levelCard: 'levelCards', levelChoice: 'levelChoices', skillDraft: 'skillDrafts', classDraft: 'classDrafts' };
export const isProgressionReward = (row) => Object.hasOwn(FIELDS, row.kind);
export const progressionTrack = (row) => row.kind === 'classDraft' ? `class:${row.classId}` : row.skillId || 'character';
export function progressionRewardUnlocked(row, run) {
  if (!Number.isInteger(row.requiredLevel)) return true;
  const track = progressionTrack(row);
  return (track === 'character' ? run.level?.level || 1 : run.skills?.[track]?.level || 0) >= row.requiredLevel;
}

// Offers keep their original choices and absolute unlock level across victories.
// Skill drafts are re-offered by the combat ledger; reserve each existing draft
// before accepting freshly rolled offers so leaving cannot multiply rewards.
export function mergeProgressionRewards(saved = {}, incoming = {}, run, { manual = true, characterStart = run.level?.level || 1 } = {}) {
  const result = { ...incoming };
  for (const [kind, field] of Object.entries(FIELDS)) {
    const old = structuredClone(saved[field] || []);
    const reservedDrafts = {};
    if (kind === 'skillDraft' || kind === 'classDraft') for (const row of old) {
      const track = progressionTrack({ ...row, kind });
      reservedDrafts[track] = (reservedDrafts[track] || 0) + 1;
    }
    const fresh = (incoming[field] || []).flatMap((raw, i) => {
      const row = { ...structuredClone(raw), kind };
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
