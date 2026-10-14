import { attackHitPreview, previewCardAttackHit } from '../../engine/stanceHit.js';
import { combatProfileFor } from '../../model/combatCardProfile.js';

// Rebuild the observing seat's Accuracy context from its public combat row.
export function coopCardHitPreview(scene, registries, actor, enemy, carrier, { selected = true } = {}) {
  const source = { ...actor, kind: 'player' };
  const target = { ...enemy, kind: 'enemy' };
  const context = { ...scene, registries, combatExpansionVersion: 2,
    player: source, characterLevel: actor.level, attributes: actor.attributes };
  const definition = { ...carrier, combatProfile: combatProfileFor(carrier) };
  const preview = selected ? previewCardAttackHit : attackHitPreview;
  return preview(context, source, target, definition, {
    additionalTargets: definition.effects?.some(effect => effect.target === 'allEnemies')
      ? Math.max(0, scene.enemies.filter(entry => entry.hp > 0).length - 1) : 0,
  });
}
