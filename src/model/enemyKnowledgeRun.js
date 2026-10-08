// The caller owns unique run identity and accepts an encounter before opening
// it here. Seeds are reproducible gameplay inputs, never learning identities.
import { knowledgeKey, emptyEnemyKnowledge, mergeEnemyKnowledge, enemyKnowledgeProblems, knowledgePoints } from './enemyKnowledgeProfile.js';
import { enemyMasteryTarget, enemyKnowledgeRuleProblems } from './enemyKnowledgeRules.js';
import { advancePerception, perceptionProblems, PERCEPTION_SKILL } from './perception.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
export const knowledgeEncounterId = (receiptId, visit, nodeId, encounterId) => `ek1:${JSON.stringify([receiptId || 'sandbox', visit, nodeId, encounterId])}`;

export function openRunEnemyKnowledge(run, { receiptId = null, bankable = false } = {}) {
  if (run.enemyKnowledgeRules?.version !== 1) return false;
  if (bankable && (!knowledgeKey(receiptId) || receiptId.length > 128)) throw new Error('Enemy learning requires a caller-owned unique run receipt');
  run.enemyKnowledgeState = { version: 1, receiptId, bankable, visitOrdinal: 0, currentEncounter: null,
    pending: emptyEnemyKnowledge(), appliedXp: {} };
  run.skills ||= {};
  run.skills[PERCEPTION_SKILL] = { xp: 0, level: 0, pendingDrafts: 0 };
  return true;
}
export function openKnowledgeEncounter(run, nodeId, encounterId, enemyIds, current = emptyEnemyKnowledge()) {
  const state = run.enemyKnowledgeState;
  if (!state) return null;
  if (!knowledgeKey(nodeId) || !knowledgeKey(encounterId) || !Array.isArray(enemyIds)
    || !enemyIds.length || enemyIds.some(id => !knowledgeKey(id))) throw new Error('Enemy learning requires an accepted encounter and enemy definition IDs');
  const visit = state.visitOrdinal + 1;
  if (!count(visit)) throw new Error('Enemy encounter visit exceeds the safe integer range');
  const id = knowledgeEncounterId(state.receiptId, visit, nodeId, encounterId);
  if (!knowledgeKey(id)) throw new Error('Enemy encounter receipt is too long');
  const encounter = { id, nodeId, encounterId, visit, enemyIds: [...new Set(enemyIds)] };
  let pending = state.pending;
  if (state.bankable) {
    const earned = { version: 1, enemies: Object.fromEntries(encounter.enemyIds.map(enemyId => [enemyId,
      { target: enemyMasteryTarget(run.enemyKnowledgeRules, enemyId), receipts: { [id]: { bonus: false } } }])) };
    // A failed storage write may leave previous entries pending. Merge those
    // first so failure/retry cannot accumulate an unbounded second ledger.
    const funded = mergeEnemyKnowledge(pending, current);
    const accepted = mergeEnemyKnowledge(earned, funded);
    for (const enemyId of encounter.enemyIds) if (Object.hasOwn(accepted.enemies[enemyId].receipts, id)) {
      pending = mergeEnemyKnowledge({ version: 1, enemies: { [enemyId]: {
        target: accepted.enemies[enemyId].target, receipts: { [id]: { bonus: false } },
      } } }, pending);
    }
  }
  state.visitOrdinal = visit;
  state.currentEncounter = encounter;
  state.pending = pending;
  return encounter;
}
export function addKnowledgeCounterBonus(pending, encounter, enemyId, target, current = emptyEnemyKnowledge()) {
  if (!encounter?.enemyIds.includes(enemyId)) return pending;
  const funded = mergeEnemyKnowledge(pending, current);
  const row = funded.enemies[enemyId];
  if (row && knowledgePoints(row) >= row.target && !Object.hasOwn(row.receipts, encounter.id)) return pending;
  return mergeEnemyKnowledge({ version: 1, enemies: { [enemyId]: { target: row?.target || target,
    receipts: { [encounter.id]: { bonus: true } } } } }, pending);
}
export function reconcilePerception(run, encounterId, earnedXp) {
  const state = run.enemyKnowledgeState;
  if (!state || !knowledgeKey(encounterId) || !count(earnedXp)) throw new Error('Perception reconciliation requires saved encounter identity and whole earned XP');
  const paid = Object.hasOwn(state.appliedXp, encounterId) ? state.appliedXp[encounterId] : 0;
  const delta = Math.max(0, earnedXp - paid);
  const award = advancePerception(run.skills[PERCEPTION_SKILL], run.enemyKnowledgeRules.perception, delta);
  state.appliedXp[encounterId] = Math.max(paid, earnedXp);
  return award;
}

// A storage owner acknowledges only the captured successful write. A bonus
// earned while an async lock was pending remains queued for the next bank.
export function acknowledgeKnowledgeBank(run, captured) {
  const pending = run.enemyKnowledgeState?.pending;
  if (!pending) return;
  for (const [enemyId, row] of Object.entries(captured.enemies)) {
    const live = pending.enemies[enemyId];
    if (!live) continue;
    for (const [id, receipt] of Object.entries(row.receipts)) {
      if (Object.hasOwn(live.receipts, id) && (receipt.bonus || !live.receipts[id].bonus)) delete live.receipts[id];
    }
    if (!Object.keys(live.receipts).length) delete pending.enemies[enemyId];
  }
}
export function enemyKnowledgeRunProblems(run, enemyIds = null) {
  if (run.enemyKnowledgeRules === undefined && run.enemyKnowledgeState === undefined) return [];
  const problems = enemyKnowledgeRuleProblems(run.enemyKnowledgeRules, enemyIds);
  const state = run.enemyKnowledgeState;
  if (!object(state) || state.version !== 1 || typeof state.bankable !== 'boolean' || !count(state.visitOrdinal)
    || (state.bankable && (!knowledgeKey(state.receiptId) || state.receiptId.length > 128)) || !object(state.appliedXp)) return [...problems, 'run.enemyKnowledgeState is invalid'];
  problems.push(...enemyKnowledgeProblems(state.pending, enemyIds));
  for (const [id, xp] of Object.entries(state.appliedXp)) if (!knowledgeKey(id) || !count(xp)) problems.push('run enemy Perception receipts require valid identity and XP');
  const encounter = state.currentEncounter;
  if (encounter !== null && (!object(encounter) || !knowledgeKey(encounter.id) || !knowledgeKey(encounter.nodeId)
    || !knowledgeKey(encounter.encounterId) || !count(encounter.visit) || encounter.visit < 1 || encounter.visit > state.visitOrdinal
    || !Array.isArray(encounter.enemyIds) || !encounter.enemyIds.length || new Set(encounter.enemyIds).size !== encounter.enemyIds.length
    || encounter.enemyIds.some(id => !knowledgeKey(id) || (enemyIds && !enemyIds.has(id)))
    || encounter.id !== knowledgeEncounterId(state.receiptId, encounter.visit, encounter.nodeId, encounter.encounterId))) problems.push('run current enemy learning encounter is invalid');
  if (!problems.length) problems.push(...perceptionProblems(run.skills?.[PERCEPTION_SKILL], run.enemyKnowledgeRules.perception));
  return problems;
}
