import { enemyMoveCarrier } from '../../engine/combatCardTactics.js';

// What the reaction prompt is answering. When the prompt answers a committed enemy reaction move
// (a version 2 stack entry, listed by name in the reaction modal), the incoming maneuver is that
// move's maneuver; the enemy's separately selected normal intent is a different action and says
// nothing about it. The stack entry is public (the modal names it), so it is known. Returns
// { hidden: false, revealed: true, profile: { maneuver } }, an unknown read when the move cannot
// be read, or null when no enemy entry of the prompt's source is stacked for this seat (the
// caller then reads the visible intent as before).
export function stackedEnemyReactionIntent(combat, pending, seat) {
  const stack = combat?.reactionStack;
  if (!stack || !pending || stack.groupKey !== pending.groupKey) return null;
  const entry = [...(stack.entries || [])].reverse().find(row => row.side === 'enemy'
    && row.ownerId === pending.sourceId && (row.targetPlayerId == null || row.targetPlayerId === seat));
  if (!entry) return null;
  const enemy = combat.enemies?.find(row => row.id === entry.ownerId);
  const move = combat.registries?.enemies?.get(entry.enemyId ?? enemy?.enemyId)?.moves?.[entry.moveId];
  const unknown = { hidden: true, revealed: false, profile: {} };
  if (!enemy || !move) return unknown;
  let maneuver = null;
  try { maneuver = enemyMoveCarrier(enemy, move, entry.moveId, combat)?.combatProfile?.maneuver ?? null; } catch { maneuver = null; }
  return maneuver ? { hidden: false, revealed: true, profile: { maneuver } } : unknown;
}
