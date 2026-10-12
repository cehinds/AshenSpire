// Enemy reactions (docs/combat-card-traits-contract.md, "Enemy reactions").
// A reaction move is an enemy move with `reaction: { on, minIncoming, chance }`.
// These helpers decide nothing on their own: the window code asks decideEnemyReaction
// for each enemy in roster order. Pure data reads apart from the memoised roll.
import { controlRestrictions } from './combatStatusControl.js';

// Version 2 with the flag. Absent (or a version-1 snapshot) means no enemy reactions.
export const enemyReactionsActive = ctx => ctx.reactionRulesVersion === 2 && ctx.reactionRules?.enemyReactions === true;

// The enemy's reaction moves that list `window`, in authored order.
export function reactionMovesOf(ctx, enemy, window) {
  const def = ctx.registries?.enemies?.get(enemy.enemyId);
  return Object.entries(def?.moves || {}).filter(([, move]) => move.reaction?.on?.includes(window));
}

// The largest positive contact amount aimed at `id` in a group (or a committed plan,
// whose planned group is `plan.group`). Zero when nothing positive targets it.
export function incomingAgainst(source, id) {
  const group = source?.targets ? source : source?.group;
  let best = 0;
  for (const row of Object.values(group?.targets || {})) {
    if (row.id !== id && row.playerId !== id) continue;
    for (const contact of row.contacts || []) if (contact.amount > best) best = contact.amount;
  }
  return best;
}

// The move this enemy takes for one window, or null. Eligibility first (alive, not
// staggered, not control-locked, one reaction per combat turn). Then each reaction move
// in authored order: it qualifies when the incoming damage against this enemy is positive
// and at least minIncoming (default 1). chance 1 is taken and 0 is not, without a draw;
// otherwise one draw on the enemyReaction stream decides it, memoised per window in
// ctx.enemyReactionRolls. A candidate state (ctx._reactionPlaying) reads the memo only:
// an unmemoised roll there is "does not react" and never draws.
export function decideEnemyReaction(ctx, enemy, window, { groupKey, windowIndex, incoming }) {
  if (!enemyReactionsActive(ctx) || !enemy?.alive || enemy.skipNextTurn) return null;
  if (enemy.combatReactionTurn === ctx.turn) return null;
  if (controlRestrictions(ctx, enemy).locked) return null;
  for (const [moveId, move] of reactionMovesOf(ctx, enemy, window)) {
    const { minIncoming = 1, chance = 1 } = move.reaction;
    if (!(incoming > 0) || incoming < minIncoming) continue;
    if (chance >= 1) return moveId;
    if (chance <= 0) continue;
    const key = `${groupKey}:${windowIndex}:${enemy.id}:${moveId}`;
    ctx.enemyReactionRolls ||= {};
    if (!(key in ctx.enemyReactionRolls)) {
      if (ctx._reactionPlaying) continue;
      ctx.enemyReactionRolls[key] = ctx.rng.float('enemyReaction') < chance;
    }
    if (ctx.enemyReactionRolls[key]) return moveId;
  }
  return null;
}

// Cleared at each player-turn start (the memo is per window of one turn's roots).
export function clearEnemyReactionRolls(ctx) {
  delete ctx.enemyReactionRolls;
}
