import { attackHitPreview, previewCardAttackHit, effectiveEvasion } from '../../engine/stanceHit.js';
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
export function coopCardHitPreview(scene, registries, actor, enemy, carrier, { selected = true, member = actor } = {}) {
  const source = { ...actor, kind: 'player' };
  const target = { ...enemy, kind: 'enemy' };
  const context = coopCombatantContext(scene, registries, source, member);
  const definition = { ...carrier, combatProfile: combatProfileFor(carrier) };
  const preview = selected ? previewCardAttackHit : attackHitPreview;
  return preview(context, source, target, definition, {
    additionalTargets: definition.effects?.some(effect => effect.target === 'allEnemies')
      ? Math.max(0, scene.enemies.filter(entry => entry.hp > 0).length - 1) : 0,
  });
}
