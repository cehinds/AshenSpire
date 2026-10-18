// Hit-% badge gate (owner ruling D8, 2026-10-18): the badge shows on each valid
// target while the player has selected a card that can inflict damage or an
// effect on that target. Perception does not gate it; it only governs intent
// knowledge. A self-only card, or no selection, shows nothing.
const ENEMY_TARGETS = ['enemy', 'allEnemies', 'randomEnemy'];
export function cardAffectsEnemies(definition) {
  if (!definition) return false;
  return !!(definition.counterPayload || definition.effects?.some(effect => ENEMY_TARGETS.includes(effect.target)));
}
/** Ids of the living enemies that show a badge for the selected card definition. */
export function hitBadgeTargetIds(definition, enemies) {
  if (!cardAffectsEnemies(definition)) return [];
  return (enemies || []).filter(enemy => enemy && (enemy.alive ?? enemy.hp > 0)).map(enemy => enemy.id);
}
