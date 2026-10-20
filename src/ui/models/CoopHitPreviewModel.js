import { coopRangePreview } from './CoopRangePreviewModel.js';
import { attackHitPreview, previewCardAttackHit, effectiveEvasion, previewTargetFor } from '../../engine/stanceHit.js';
import { combatProfileFor } from '../../model/combatCardProfile.js';

// Public combat rows carry current statuses/attributes; party rows carry equipment.
function coopCombatantContext(scene, registries, entity, member = entity) {
  return { ...scene, registries, combatExpansionVersion: 2, player: entity,
    characterLevel: entity.level ?? member?.level, attributes: entity.attributes ?? member?.attributes,
    loadout: member?.loadout ?? entity.loadout };
}

export function coopCombatantEvasion(scene, registries, entity, member) {
  const combatant = { ...entity, classId: entity.classId ?? member?.classId };
  return effectiveEvasion(coopCombatantContext(scene, registries, combatant, member), combatant);
}

// Rebuild the observing seat's Accuracy context from its public combat row.
export function coopCardHitPreview(scene, registries, actor, enemy, carrier, { selected = true, member = actor, observerId, rangeRoute = 'advance' } = {}) {
  const source = { ...actor, kind: 'player' };
  const target = observerId ? previewTargetFor({ ...enemy, kind: 'enemy' }, observerId, { turn: scene?.turn }) : { ...enemy, kind: 'enemy' };
  const context = coopCombatantContext(scene, registries, source, member);
  const definition = { ...carrier, combatProfile: combatProfileFor(carrier) };
  const preview = selected ? previewCardAttackHit : attackHitPreview;
  const shown = preview(context, source, target, definition, {
    additionalTargets: definition.effects?.some(effect => effect.target === 'allEnemies')
      ? Math.max(0, scene.enemies.filter(entry => entry.hp > 0).length - 1) : 0,
  });
  const quote = coopRangePreview(carrier.combatPreview, { targetId: enemy.id, rangeRoute });
  if (quote?.rangeQuoteUnavailable) return null;
  const contact = quote?.range?.targets?.find(row => row.targetId === enemy.id);
  return contact ? { ...shown, inRange: contact.inRange, hitChance: contact.hitChance, range: quote.range } : shown;
}

// Statuses the combat health row already shows as a badge (Evade, Precision):
// one home, so the co-op status tray skips them under the same condition the
// badge is drawn (expansion v2, and the seat may read the enemy exactly).
export function coopBadgedStatusIds(entity, isEnemy, seat) {
  const known = !isEnemy || entity?.knowledgeAction?.reads?.[seat]?.visibility === 'exact';
  return entity?.combatExpansionVersion === 2 && known ? new Set(['evade', 'precision']) : new Set();
}
