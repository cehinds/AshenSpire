import { enemyKnowledge } from '../content/enemyKnowledge.js';
import { xpStepCost } from './xpCurve.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = value => Number.isFinite(value) && value >= 0 && value <= 1;
export function enemyKnowledgeRuleProblems(rules, enemyIds = null) {
  if (!object(rules) || rules.version !== 1 || !object(rules.reads) || !object(rules.perception)
    || !object(rules.bestiary) || !object(rules.bestiary.perEnemy)) return ['enemyKnowledge rules require version 1, reads, Perception and bestiary pacing'];
  const problems = [];
  for (const key of Object.keys(enemyKnowledge.reads)) if (!bounded(rules.reads[key])) problems.push(`enemyKnowledge.reads.${key} must be a probability coefficient from 0 to 1`);
  for (const kind of ['Exact', 'Clue']) if (rules.reads[`minimum${kind}`] > rules.reads[`maximum${kind}`]) problems.push(`enemyKnowledge.reads minimum${kind} exceeds maximum${kind}`);
  const curve = rules.perception;
  if (!Number.isFinite(curve.base) || curve.base <= 0 || !Number.isFinite(curve.growth) || curve.growth < 1 || curve.growth > 10
    || !Number.isInteger(curve.roundTo) || curve.roundTo < 1 || !Number.isInteger(curve.maxLevel) || curve.maxLevel < 1 || curve.maxLevel > 50
    || !Number.isSafeInteger(curve.correctPredictionXp) || curve.correctPredictionXp < 1) problems.push('enemyKnowledge.perception requires a finite positive XP curve, maximum level 1–50 and integer award');
  if (!Number.isSafeInteger(xpStepCost(curve, curve.maxLevel - 1))) problems.push('enemyKnowledge.perception level costs exceed the safe integer range');
  const target = value => Number.isInteger(value) && value >= 20 && value <= 50;
  if (!target(rules.bestiary.encountersToMaster)) problems.push('enemyKnowledge.bestiary.encountersToMaster must be 20–50');
  for (const [id, row] of Object.entries(rules.bestiary.perEnemy)) if (!id || ['__proto__', 'prototype', 'constructor'].includes(id)
    || (enemyIds && !enemyIds.has(id)) || !object(row)
    || !target(row.encountersToMaster) || Object.keys(row).some(key => key !== 'encountersToMaster')) problems.push(`enemyKnowledge.bestiary.perEnemy.${id} requires a known enemy and mastery target 20–50`);
  return problems;
}
export function snapshotEnemyKnowledgeRules(registries) {
  const rules = structuredClone({ version: enemyKnowledge.version, ...(registries?.balance?.enemyKnowledge || enemyKnowledge) });
  const problems = enemyKnowledgeRuleProblems(rules, registries?.enemies ? new Set(registries.enemies.all().map(row => row.id)) : null);
  if (problems.length) throw new Error(problems.join('; '));
  return rules;
}
export function enemyMasteryTarget(rules, enemyId) {
  return rules.bestiary.perEnemy[enemyId]?.encountersToMaster ?? rules.bestiary.encountersToMaster;
}
