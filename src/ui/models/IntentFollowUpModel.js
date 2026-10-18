// The "?" rule for an actor's remaining actions (owner, 2026-10-18): once an actor has acted this turn and
// still has SP for more actions, an observer who did NOT pass the Perception check on that actor's intent
// sees each remaining action as "?"; one who passed sees them normally. Headless: no DOM.
//
// Privacy: the check is the one already rolled (the observer's read of the intent). Nothing here rolls, and
// a failed read never keeps the queue's moves: the plan holds only a count, so no move id, stance or
// damage can reach a symbol, the DOM or a tooltip.
import { stanceFor, moveKind } from '../../engine/combatRounds/stance.js';
import { iconForStance } from './CombatRoundsScreenModel.js';

/**
 * followUpPlan({ passed, queue, def }) → { passed, total, icons } taken before the actor's phase.
 * queue: the actor's planned follow-ups ({ moveId }), in play order, the head excluded. def: its enemy
 * definition, read for icons ONLY when `passed`. `icons` is null on a failed read.
 */
export function followUpPlan({ passed = false, queue = [], def = null } = {}) {
  const total = Array.isArray(queue) ? queue.length : 0;
  if (!passed || !def) return { passed: !!passed, total, icons: passed ? new Array(total).fill('prepare') : null };
  return { passed: true, total, icons: queue.map(entry => {
    const move = def.moves?.[entry?.moveId];
    return move ? iconForStance(stanceFor(moveKind(move), Array.isArray(move.tags) ? move.tags : [])) : 'prepare';
  }) };
}

/**
 * remainingFollowUps(plan, queued) → the symbols for the actions still queued after the one that just started.
 * queued: how many remain (the engine's count on `enemyMoveStarted`). [] when none remain or no plan exists.
 * Returns [{ kind: 'unknown' } | { kind: 'action', icon }], in play order.
 */
export function remainingFollowUps(plan, queued) {
  const left = Math.floor(Number(queued));
  if (!plan || !(left > 0)) return [];
  const count = Math.min(left, plan.total);
  if (!plan.passed || !plan.icons) return Array.from({ length: count }, () => ({ kind: 'unknown' }));
  return plan.icons.slice(plan.total - count).map(icon => ({ kind: 'action', icon }));
}
