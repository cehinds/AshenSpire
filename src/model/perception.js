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
// Owner, 2026-11-18 (ruling §12): Perception is switched off by `enemyKnowledge.perception.enabled: false` (src/content/enemyKnowledge.js, copied into each run's
// enemyKnowledgeRules). Off: no track, no XP, no intent-read bonus; intent reveals use the base rules. A rules snapshot without the key (an older run) keeps today's behaviour.
// $note (future): when re-enabled, roll once per enemy per fight for the percent chance of seeing each intent. Not built yet.
export const perceptionEnabled = rules => rules?.perception?.enabled !== false;
export function perceptionLevelFor(rules, skills) { return perceptionEnabled(rules) ? perceptionLevel(skills) : 0; }
export function perceptionLevel(skills) { return skills?.[PERCEPTION_SKILL]?.level || 0; }
export function perceptionProblems(row, curve) {
  if (!row || !Number.isSafeInteger(row.xp) || row.xp < 0 || !Number.isInteger(row.level)
    || row.level < 0 || row.level > curve.maxLevel || row.pendingDrafts !== 0
    || Object.keys(row).some(key => !['xp', 'level', 'pendingDrafts'].includes(key))) return ['Perception requires valid XP, level and zero pending drafts'];
  if (row.level < curve.maxLevel && row.xp >= xpStepCost(curve, row.level)) return ['Perception has an unclaimed automatic level'];
  return [];
}
