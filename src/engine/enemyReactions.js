// Enemy reactions (docs/combat-card-traits-contract.md, "Enemy reactions").
// A reaction move is an enemy move with `reaction: { on, minIncoming, chance }`.
// openEnemyWindow asks decideEnemyReaction for each enemy in roster order and commits
// a taken move's plan at push (pushEnemyReaction); runEnemyPlan plays it when the stack
// (engine/combatReactions.js) reaches it.
import { controlRestrictions } from './combatStatusControl.js';
import { enqueueExpandedAction } from './combatExpansionActions.js';

// Version 2 with the flag. Absent (or a version-1 snapshot) means no enemy reactions.
export const enemyReactionsActive = ctx => ctx.reactionRulesVersion === 2 && ctx.reactionRules?.enemyReactions === true;

// The enemy's reaction moves that list `window`, in authored order.
export function reactionMovesOf(ctx, enemy, window) {
  const def = ctx.registries?.enemies?.get(enemy.enemyId);
  return Object.entries(def?.moves || {}).filter(([id, move]) => move.reaction?.on?.includes(window)
    && (!move.locked || (enemy.unlockedMoves || []).includes(id)));
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

// Any enemy of this fight holds a reaction move (for `window`, or for either window).
// Without one the window machinery stays out of the state entirely, so such a fight
// is identical to a flag-off run.
export function fightReacts(ctx, window = null) {
  if (!enemyReactionsActive(ctx)) return false;
  const windows = window ? [window] : ['playerAction', 'playerReaction'];
  return (ctx.enemies || []).some(enemy => windows.some(name => reactionMovesOf(ctx, enemy, name).length));
}

const refOf = (ctx, entity) => {
  if (!entity) return null;
  const playerId = ctx.players ? ctx.playerIdForEntity?.(entity) : null;
  return playerId ? { id: entity.id, playerId } : { id: entity.id };
};
function entityOf(ctx, ref) {
  if (!ref) return null;
  if (ref.playerId) return ctx.players?.get(ref.playerId)?.entity || null;
  if (!ctx.players && ctx.player && ref.id === ctx.player.id) return ctx.player;
  return (ctx.enemies || []).find(enemy => enemy.id === ref.id) || null;
}

/**
 * Commit at push: plan the reaction move as a combatReaction carrier into a sink (no
 * crit draw, nothing enqueued) and stack it as `{ side: 'enemy', ownerId, moveId,
 * targetPlayerId, plan }`. The plan keeps id references only; relinkEnemyPlan
 * reconnects them to the live (or candidate) entities when it runs.
 */
export function pushEnemyReaction(ctx, group, enemy, moveId, targetPlayerId, hooks) {
  const stack = ctx.reactionStack ||= { groupKey: group.key, entries: [], resolving: false };
  const previous = ctx.playerKey;
  const sink = [];
  const enqueue = ctx.enqueue, pendingCount = ctx.pendingExpansionActions;
  let planned;
  try {
    const built = hooks.planEnemyReaction(ctx, enemy, moveId, targetPlayerId);
    const carrier = { ...built.carrier, combatReaction: true, reactionDepth: stack.entries.length + 1 };
    for (const action of built.actions) action.card = carrier;
    ctx.enqueue = action => sink.push(action);
    planned = enqueueExpandedAction(ctx, built.actions, { source: enemy, target: built.target, carrier });
    if (!planned) throw new Error('An enemy reaction requires expanded combat');
    planned.kind = built.kind || null;
  } finally {
    ctx.enqueue = enqueue;
    ctx.pendingExpansionActions = pendingCount;
    if (ctx.players) hooks.setOwner?.(ctx, previous);
  }
  const actions = sink.map(({ source, owner, target, meta, ...action }) => {
    const { expansionGroup, ...rest } = meta || {};
    return { ...action, meta: rest, sourceRef: refOf(ctx, source), ownerRef: refOf(ctx, owner), targetRef: refOf(ctx, target) };
  });
  const entry = { side: 'enemy', ownerId: enemy.id, enemyId: enemy.enemyId, moveId, targetPlayerId, plan: { group: planned, actions } };
  stack.entries.push(entry);
  enemy.combatReactionTurn = ctx.turn;
  ctx.emit('combatEnemyReactionStacked', { sourceId: enemy.id, enemyId: enemy.enemyId, moveId, targetPlayerId,
    groupKey: group.key, depth: stack.entries.length });
  return entry;
}

// The committed plan's actions bound to the entities of `ctx`, all sharing one group.
export function relinkEnemyPlan(ctx, plan) {
  return plan.actions.map(({ sourceRef, ownerRef, targetRef, meta, ...action }) => ({ ...action,
    source: entityOf(ctx, sourceRef), owner: entityOf(ctx, ownerRef), target: entityOf(ctx, targetRef),
    meta: { ...meta, expansionGroup: plan.group } }));
}

// A seat that can no longer act: dead (or at 0 HP before the end check marks it), or
// a co-op seat that disconnected.
export function seatGone(ctx, playerId) {
  const seat = ctx.players?.get(playerId);
  const body = ctx.players ? seat?.entity : ctx.player;
  return !body?.alive || body.hp <= 0 || (!!ctx.players && seat?.connected !== true);
}

// Why an enemy entry fizzles when reached: its enemy is dead, staggered or locked
// (enemyHalted), or its target seat is dead or gone (targetGone). Null when it plays.
export function enemyEntryHalt(ctx, entry) {
  const enemy = (ctx.enemies || []).find(row => row.id === entry.ownerId);
  if (!enemy?.alive || enemy.hp <= 0 || enemy.skipNextTurn || controlRestrictions(ctx, enemy).locked) return 'enemyHalted';
  return seatGone(ctx, entry.targetPlayerId) ? 'targetGone' : null;
}

// Runs one enemy entry's committed plan in `ctx` (live resolution or an offer check's
// candidate) on its own queue, as a reaction, so no window, rider roll or automatic
// Counter return chains from it. Returns the halt reason when it fizzled instead.
export function runEnemyPlan(ctx, entry, hooks) {
  const halted = enemyEntryHalt(ctx, entry);
  if (halted) return halted;
  const saved = ctx.queue;
  const foundation = ctx.foundation ? { actionSerial: ctx.foundation.actionSerial, eventCount: ctx.foundation.eventCount,
    rolls: ctx.foundation.rolls, counts: ctx.foundation.counts } : null;
  ctx.queue = [];
  if (ctx.foundation) {
    ctx.foundation.actionSerial = Math.max(ctx.foundation.actionSerial, ctx.foundationNextSerial || 0) + 1;
    ctx.foundationNextSerial = ctx.foundation.actionSerial;
    ctx.foundation.eventCount = 0; ctx.foundation.rolls = {}; ctx.foundation.counts = {};
  }
  hooks.setOwner?.(ctx, entry.targetPlayerId);
  const wasPlaying = ctx._reactionPlaying;
  ctx._reactionPlaying = true;
  try {
    const enemy = (ctx.enemies || []).find(row => row.id === entry.ownerId);
    if (enemy) (enemy.performedMoves ||= []).push(entry.moveId);
    ctx.emit('enemyMoveStarted', { sourceId: entry.ownerId, enemyId: entry.enemyId, moveId: entry.moveId,
      kind: entry.plan.group.kind ?? null, reaction: true });
    ctx.pendingExpansionActions = (ctx.pendingExpansionActions || 0) + 1;
    for (const action of relinkEnemyPlan(ctx, entry.plan)) ctx.queue.push(action);
    hooks.drain(ctx);
  } finally {
    if (wasPlaying) ctx._reactionPlaying = wasPlaying; else delete ctx._reactionPlaying;
    const left = ctx.queue;
    ctx.queue = saved;
    if (ctx.result) saved.length = 0; else saved.unshift(...left);
    if (ctx.foundation && foundation) Object.assign(ctx.foundation, foundation);
  }
  return null;
}

// The acting seat of a player-card root ('player' in solo), else null.
export function playerRootSeat(ctx, group) {
  if (!group?.carrier?.instanceId || (ctx.enemies || []).some(enemy => enemy.id === group.sourceId)) return null;
  return ctx.players ? group.sourcePlayerId || null : 'player';
}

/**
 * One enemy window on `group`'s root. playerAction: enemies the root card hits with a
 * positive contact. playerReaction: enemies that own the (non Counter-return) root or
 * that the pushed player entry targets; each qualifies on the pushed card's contact
 * against it. Roster order, each enemy at most once, enemy entries capped at maxDepth
 * in total. Returns the entries pushed.
 */
export function openEnemyWindow(ctx, group, window, pushed, hooks) {
  if (!fightReacts(ctx, window) || group.counterReturn || group.carrier?.combatReaction || group.carrier?.reactionDepth) return [];
  const index = group.enemyWindows || 0;
  group.enemyWindows = index + 1;
  const targetPlayerId = window === 'playerAction' ? playerRootSeat(ctx, group) : pushed.ownerId;
  if (!targetPlayerId) return [];
  const cap = ctx.reactionRules.stack.maxDepth;
  const pushedEntries = [];
  for (const enemy of ctx.enemies) {
    const stacked = ctx.reactionStack?.groupKey === group.key ? ctx.reactionStack.entries : [];
    if (stacked.filter(entry => entry.side === 'enemy').length >= cap) break;
    const incoming = window === 'playerAction' ? incomingAgainst(group, enemy.id) : pushed.incoming?.[enemy.id] || 0;
    // The window opens for enemies the root card targets, or (playerReaction) that own the
    // root or that the root card targets (contract); the decision then qualifies on `incoming`.
    if (window === 'playerAction' ? !(incoming > 0) : group.sourceId !== enemy.id && !(incomingAgainst(group, enemy.id) > 0)) continue;
    const moveId = decideEnemyReaction(ctx, enemy, window, { groupKey: group.key, windowIndex: index, incoming });
    if (moveId) pushedEntries.push(pushEnemyReaction(ctx, group, enemy, moveId, targetPlayerId, hooks));
  }
  return pushedEntries;
}
