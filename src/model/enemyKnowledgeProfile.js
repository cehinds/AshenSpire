// SPEC §4.9. Receipt union is the truth; points and stage are projections.
import { enemyKnowledge } from '../content/enemyKnowledge.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const knowledgeKey = key => typeof key === 'string' && key.length > 0 && key.length <= 256
  && !['__proto__', 'prototype', 'constructor'].includes(key);
export const emptyEnemyKnowledge = () => ({ version: 1, enemies: {} });
export const knowledgePoints = row => Math.min(row?.target || 0,
  Object.values(row?.receipts || {}).reduce((sum, receipt) => sum + 1 + Number(receipt.bonus), 0));
export const KNOWLEDGE_STAGE_NAMES = Object.freeze(['Unencountered', 'Encountered', 'Studied', 'Familiar', 'Understood', 'Mastered']);
export function knowledgeThresholds(target) { return [1, Math.ceil(target * .2), Math.ceil(target * .4), Math.ceil(target * .7), target]; }
export function knowledgeProgress(row, fallbackTarget = enemyKnowledge.bestiary.encountersToMaster) {
  const target = row?.target ?? fallbackTarget;
  const points = knowledgePoints(row);
  const thresholds = knowledgeThresholds(target);
  const stage = thresholds.filter(value => points >= value).length;
  return { stage, label: KNOWLEDGE_STAGE_NAMES[stage], points, target,
    nextStage: stage < 5 ? { stage: stage + 1, label: KNOWLEDGE_STAGE_NAMES[stage + 1], points: thresholds[stage] } : null };
}
export function enemyKnowledgeProblems(state, enemyIds = null) {
  const problems = [];
  if (!object(state) || state.version !== 1 || !object(state.enemies)) return ['enemyKnowledge requires version 1 and an enemy ledger'];
  for (const [id, row] of Object.entries(state.enemies)) {
    if (!knowledgeKey(id) || (enemyIds && !enemyIds.has(id)) || !object(row)
      || !Number.isInteger(row.target) || row.target < 20 || row.target > 50 || !object(row.receipts)) {
      problems.push(`enemyKnowledge.${id} requires a known enemy, mastery target 20–50 and encounter receipts`); continue;
    }
    const entries = Object.entries(row.receipts);
    if (!entries.length || entries.length > row.target) problems.push(`enemyKnowledge.${id} has an empty or unbounded encounter ledger`);
    for (const [receiptId, receipt] of entries) if (!knowledgeKey(receiptId) || !object(receipt)
      || typeof receipt.bonus !== 'boolean' || Object.keys(receipt).some(key => key !== 'bonus')) problems.push(`enemyKnowledge.${id} has an invalid encounter receipt`);
  }
  return problems;
}

// Keep all current receipt IDs, even at mastery. Apply incoming bonuses by OR
// before accepting new encounters; stop as soon as the target is funded.
export function mergeEnemyKnowledge(incoming, current) {
  for (const state of [incoming, current]) {
    const problems = enemyKnowledgeProblems(state);
    if (problems.length) throw new Error(problems.join('; '));
  }
  const next = structuredClone(current);
  for (const [id, earned] of Object.entries(incoming.enemies)) {
    if (!Object.hasOwn(next.enemies, id)) next.enemies[id] = { target: earned.target, receipts: {} };
    const row = next.enemies[id];
    for (const [receiptId, receipt] of Object.entries(earned.receipts)) {
      if (Object.hasOwn(row.receipts, receiptId)) row.receipts[receiptId].bonus ||= receipt.bonus;
    }
    for (const [receiptId, receipt] of Object.entries(earned.receipts)) {
      if (knowledgePoints(row) >= row.target) break;
      if (!Object.hasOwn(row.receipts, receiptId)) row.receipts[receiptId] = { bonus: receipt.bonus };
    }
  }
  return next;
}
export function bankEnemyKnowledgeProfile(meta, receipts) {
  const current = meta.enemyKnowledge || emptyEnemyKnowledge();
  const merged = mergeEnemyKnowledge(receipts, current);
  return { meta: { ...meta, enemyKnowledge: merged }, changed: JSON.stringify(current) !== JSON.stringify(merged) };
}
