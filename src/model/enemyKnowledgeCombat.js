import { enemyKnowledgeRuleProblems } from './enemyKnowledgeRules.js';
import { enemyKnowledgeProblems, knowledgeKey } from './enemyKnowledgeProfile.js';
import { PREDICTION_CHOICES } from './enemyIntentKnowledge.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const choices = new Set([...PREDICTION_CHOICES, 'Staggered']);

export function combatEnemyKnowledgeProblems(state, enemies, { enemyIds = null, ownerIds = null, coop = false } = {}) {
  if (state === undefined) return enemies.some(enemy => enemy.knowledgeAction !== undefined) ? ['Enemy action knowledge requires a versioned combat knowledge state'] : [];
  if (!object(state) || state.version !== 1 || !object(state.owners) || !count(state.nextSerial)
    || typeof state.bankable !== 'boolean') return ['combat.enemyKnowledge requires version 1, owner ledgers and action serials'];
  const problems = enemyKnowledgeRuleProblems(state.rules, enemyIds);
  const encounter = state.encounter;
  if ((state.bankable && !encounter) || (encounter !== null && (!object(encounter) || !knowledgeKey(encounter.id)
    || !Array.isArray(encounter.enemyIds) || !encounter.enemyIds.length || new Set(encounter.enemyIds).size !== encounter.enemyIds.length
    || encounter.enemyIds.some(id => !knowledgeKey(id) || (enemyIds && !enemyIds.has(id)))))) problems.push('Combat learning requires a valid unique encounter receipt');
  if (coop || Object.hasOwn(state, 'privateSeed')) {
    const counters = state.readCounters;
    const required = ['enemyIntentVisibility', 'enemyIntentClue'];
    if (!Number.isInteger(state.privateSeed) || state.privateSeed < 0 || state.privateSeed > 0xffffffff || !object(state.readCounters)
      || required.some(key => !Object.hasOwn(counters, key) || !Number.isInteger(counters[key]) || counters[key] < 0 || counters[key] > 0xffffffff)
      || Object.keys(counters).some(key => !required.includes(key)) || counters.enemyIntentVisibility !== counters.enemyIntentClue
      || counters.enemyIntentVisibility < enemies.reduce((sum, enemy) => sum + Object.keys(enemy.knowledgeAction?.reads || {}).length, 0)) problems.push('Co-op read continuation requires a host-private seed and equal carried visibility/clue counters');
  }
  for (const [ownerId, owner] of Object.entries(state.owners)) {
    if (!knowledgeKey(ownerId) || (ownerIds && !ownerIds.has(ownerId)) || !object(owner) || !count(owner.earnedXp)
      || owner.earnedXp > state.nextSerial * (state.rules?.perception?.correctPredictionXp || 0)
      || !Array.isArray(owner.feedback) || owner.feedback.length > 12 || !Array.isArray(owner.counterEnemyIds)
      || new Set(owner.counterEnemyIds).size !== owner.counterEnemyIds.length
      || owner.counterEnemyIds.some(id => !knowledgeKey(id) || !encounter?.enemyIds.includes(id))) {
      problems.push(`combat.enemyKnowledge.owners.${ownerId} has invalid XP, feedback or counter caps`); continue;
    }
    problems.push(...enemyKnowledgeProblems(owner.knowledge, enemyIds), ...enemyKnowledgeProblems(owner.pending, enemyIds));
    for (const row of owner.feedback) if (!object(row) || !knowledgeKey(row.enemyInstanceId) || !knowledgeKey(row.enemyId)
      || !Number.isSafeInteger(row.actionSerial) || row.actionSerial < 1 || row.actionSerial > state.nextSerial
      || !PREDICTION_CHOICES.includes(row.prediction) || !['executed', 'cancelled'].includes(row.outcome)
      || (row.outcome === 'cancelled' ? row.correct !== null : typeof row.correct !== 'boolean')) problems.push('Combat prediction feedback is invalid');
  }
  const serials = new Set();
  for (const enemy of enemies) {
    const action = enemy.knowledgeAction;
    if (action === undefined) continue; // an enemy without a selected action
    if (!object(action) || !Number.isSafeInteger(action.serial) || action.serial < 1 || action.serial > state.nextSerial
      || serials.has(action.serial) || !choices.has(action.category) || typeof action.executed !== 'boolean'
      || (action.cancelled !== undefined && typeof action.cancelled !== 'boolean') || !object(action.reads)) {
      problems.push(`enemy ${enemy.id} has invalid knowledge action state`); continue;
    }
    serials.add(action.serial);
    for (const [ownerId, read] of Object.entries(action.reads)) {
      if (!Object.hasOwn(state.owners, ownerId) || !object(read) || !['exact', 'clue', 'unknown'].includes(read.visibility)
        || (read.visibility === 'exact' ? read.label !== null : read.visibility === 'unknown' ? read.label !== '?' : !['Attack?', 'Magic?', 'Preparing?'].includes(read.label))
        || (read.prediction !== null && (!PREDICTION_CHOICES.includes(read.prediction) || read.visibility !== 'unknown'))
        || typeof read.resolved !== 'boolean' || typeof read.credited !== 'boolean' || (read.credited && read.visibility !== 'unknown')
        || (read.correct !== null && (typeof read.correct !== 'boolean' || !read.resolved || read.prediction === null))
        || (action.executed && !read.resolved) || (action.cancelled && (action.executed || !read.resolved || read.correct !== null))) problems.push(`enemy ${enemy.id} observer ${ownerId} has an invalid committed read`);
    }
  }
  return problems;
}
