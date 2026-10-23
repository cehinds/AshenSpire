// Hit-% badge gate (owner ruling D8, 2026-10-18): the badge shows on each valid
// target while the player has selected a card that can inflict damage or an
// effect on that target. Perception does not gate it; it only governs intent
// knowledge. A self-only card, or no selection, shows nothing.
import { immediateCardEffects } from './combatCardEffects.js';
const ENEMY_TARGETS = ['enemy', 'allEnemies', 'randomEnemy'];
export function cardAffectsEnemies(definition) {
  if (!definition) return false;
  // A deferred reply (counterPayload, or a counter's stored damage/poiseDamage) fires later;
  // only immediate enemy-targeted effects make an enemy a valid target now.
  return immediateCardEffects(definition).some(effect => ENEMY_TARGETS.includes(effect.target));
}
/** Ids of the living enemies that show a badge for the selected card definition. */
export function hitBadgeTargetIds(definition, enemies) {
  // Authored movement changes the pair directly; it never makes an Accuracy
  // roll. Combined defensive/movement cards keep the same targeting door.
  if (!immediateCardEffects(definition).some(effect => ENEMY_TARGETS.includes(effect.target) && effect.op !== 'moveEngagement')) return [];
  return (enemies || []).filter(enemy => enemy && (enemy.alive ?? enemy.hp > 0)).map(enemy => enemy.id);
}
