// Is this enemy's current move a delayed one that does NOT land this turn? (owner, 2026-11-14, Wave 2 rule 1)
// A delayed move (`move.delay`) commits on the enemy's turn (startDelayedMove) and resolves on a later one, so the HP number it carries is for
// that later turn: a turn that resolves nothing must not read as incoming damage. Headless and read-only.
//
//   head intent delayed, not yet committed -> it commits this coming enemy phase and lands `delay.turns` turns on; `block` is what the
//                                             commit gains now (delay.whileCharging.block).
//   committed (pendingMove)                -> `resolveOnTurn - combat.turn` turns remain; when none do, it lands this coming enemy phase and
//                                             is an ordinary attack (null here).

/**
 * EnemyChargingState(combat, enemy) → { moveId, turnsLeft, block } while the enemy's move is charging, else null.
 */
export function EnemyChargingState(combat, enemy) {
  if (!enemy?.alive || enemy.intent?.kind === 'staggered') return null;
  const pending = enemy.pendingMove;
  const moveId = pending?.moveId ?? (enemy.intent?.delayed ? enemy.intent.moveId : null);
  const authored = moveId && combat.registries?.enemies?.get(enemy.enemyId)?.moves?.[moveId];
  if (!authored?.delay) return null;
  if (pending) {
    const turnsLeft = pending.resolveOnTurn - combat.turn;
    return turnsLeft > 0 ? { moveId, turnsLeft, block: null } : null;
  }
  return { moveId, turnsLeft: authored.delay.turns ?? 1, block: authored.delay.whileCharging?.block ?? null };
}
