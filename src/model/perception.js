// Run-only skill arithmetic. No drafts, card ranks, class XP or storage.
import { xpStepCost } from './xpCurve.js';
export const PERCEPTION_SKILL = 'perception';
export function advancePerception(row, curve, amount) {
  const gained = Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
  if (!Number.isSafeInteger(row.xp + gained)) throw new Error('Perception XP exceeds the safe integer range');
  const before = row.level;
  row.xp += gained;
  while (row.level < curve.maxLevel && row.xp >= xpStepCost(curve, row.level)) {
    row.xp -= xpStepCost(curve, row.level);
    row.level++;
  }
  return { skillId: PERCEPTION_SKILL, before, after: row.level, levelUps: row.level - before, gained };
}
export function perceptionLevel(skills) { return skills?.[PERCEPTION_SKILL]?.level || 0; }
export function perceptionProblems(row, curve) {
  if (!row || !Number.isSafeInteger(row.xp) || row.xp < 0 || !Number.isInteger(row.level)
    || row.level < 0 || row.level > curve.maxLevel || row.pendingDrafts !== 0
    || Object.keys(row).some(key => !['xp', 'level', 'pendingDrafts'].includes(key))) return ['Perception requires valid XP, level and zero pending drafts'];
  if (row.level < curve.maxLevel && row.xp >= xpStepCost(curve, row.level)) return ['Perception has an unclaimed automatic level'];
  return [];
}
