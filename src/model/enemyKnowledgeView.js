// Construct only learned facts. Locked facts never enter renderer models.
import { knowledgeProgress, KNOWLEDGE_STAGE_NAMES } from './enemyKnowledgeProfile.js';
import { combatProfileFor } from './combatCardProfile.js';
import { enemyMoveCards } from './enemyMoveCards.js';
import { predictionCategory, broadIntentLabel } from './enemyIntentKnowledge.js';
import { enemyKnowledge } from '../content/enemyKnowledge.js';
const words = value => String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, char => char.toUpperCase());

export function learnedEnemyMoveCards(def, stage, { registries = null, combatMatchupRules = null } = {}) {
  if (stage < 3) return null;
  if (stage === 3) return Object.entries(def.moves || {}).map(([moveId, move]) => {
    const profile = combatProfileFor({ ...move, enemyId: def.id, moveId });
    const category = predictionCategory({ kind: move.intent }, profile);
    return { id: `${def.id}:${moveId}`, moveId, name: move.name || words(moveId), active: false,
      detail: broadIntentLabel(category).replace('?', ''), meta: 'Known move', tags: [], combatTags: [] };
  });
  // Strip phase/repeat/delay/lock rules before the ordinary card projector sees
  // them. Stage four gets authored base effects, with no current enemy scaling.
  const catalog = stage >= 5 ? def : {
    id: def.id,
    moves: Object.fromEntries(Object.entries(def.moves || {}).map(([moveId, move]) => [moveId,
      Object.fromEntries(Object.entries(move).filter(([key]) => ['name', 'intent', 'damage', 'hits', 'block', 'effects', 'tags', 'counterDamage', 'counterPoiseDamage'].includes(key)))])),
  };
  return enemyMoveCards(catalog, { registries, combatMatchupRules });
}

export function projectEnemyKnowledge(def, record, { target = enemyKnowledge.bestiary.encountersToMaster, registries = null, combatMatchupRules = null } = {}) {
  const progress = knowledgeProgress(record, target);
  const stage = progress.stage;
  const stages = KNOWLEDGE_STAGE_NAMES.slice(1).map((label, index) => ({ stage: index + 1, label,
    learned: stage >= index + 1, requiredPoints: [1, Math.ceil(progress.target * .2), Math.ceil(progress.target * .4), Math.ceil(progress.target * .7), progress.target][index] }));
  return {
    id: stage >= 1 ? def.id : null, name: stage >= 1 ? def.name : 'Unknown enemy', progress, stages,
    lore: stage >= 1 ? (Array.isArray(def.lore) ? [...def.lore] : def.lore ? [def.lore] : []) : null,
    role: stage >= 1 ? (def.role || words(def.size)) : null,
    resources: stage >= 2 ? [
      Array.isArray(def.hp) && { label: 'Base HP', value: `${def.hp[0]}–${def.hp[1]}` },
      def.poiseMax != null && { label: 'Base Poise', value: String(def.poiseMax) },
      def.wardMax != null && { label: 'Base Ward', value: String(def.wardMax) },
      ...Object.entries(def.damageResistanceBySchool || {}).map(([school, amount]) => ({ label: `${words(school)} resistance`, value: String(amount) })),
    ].filter(Boolean) : null,
    traits: stage >= 2 ? (def.traits || []).map(trait => typeof trait === 'string' ? { name: words(trait) } : { name: trait.name, detail: trait.detail || '' }) : null,
    moveCards: learnedEnemyMoveCards(def, stage, { registries, combatMatchupRules }),
  };
}
