const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const queued = value => Array.isArray(value) && value.every(action => record(action) && record(action.effect) && text(action.effect.op));

import { reactionRulesProblems } from '../content/combatCardTraits.js';

const playerEntry = (entry, ownerIds) => ownerIds.has(entry.ownerId) && text(entry.cardId) && record(entry.play) && text(entry.play.cardInstanceId)
  && (entry.maneuver === null || entry.maneuver === undefined || typeof entry.maneuver === 'string')
  && (entry.incoming === undefined || (record(entry.incoming) && Object.values(entry.incoming).every(value => Number.isFinite(value) && value > 0)));
// An enemy entry: its enemy, move, target seat and the committed plan (id references
// to entities plus the one planned group they share).
const ref = value => value === null || (record(value) && text(value.id) && (value.playerId === undefined || text(value.playerId)));
const enemyEntry = (entry, state, ownerIds, stack) => (state.enemies || []).some(enemy => enemy.id === entry.ownerId)
  && text(entry.moveId) && ownerIds.has(entry.targetPlayerId) && record(entry.plan) && record(entry.plan.group)
  && text(entry.plan.group.key) && entry.plan.group.key !== stack.groupKey && record(entry.plan.group.targets)
  && entry.plan.group.carrier?.combatReaction === true && Array.isArray(entry.plan.actions) && entry.plan.actions.length > 0
  && entry.plan.actions.every(action => record(action) && record(action.effect) && text(action.effect.op)
    && !('source' in action) && !('target' in action) && ref(action.sourceRef ?? null) && ref(action.targetRef ?? null) && ref(action.ownerRef ?? null));

export function combatReactionProblems(state, { ownerIds = new Set(['player']), queue = state.abilityQueue || state.queue || [] } = {}) {
  const problems = [];
  const fields = ['pendingReaction', 'reactionResume', 'reactionCursor', 'reactionHandCleanup', 'enemyReactionRolls', 'reactionRootPlay', 'reactionStack', 'reactionRules'];
  if (state.reactionRulesVersion === undefined) {
    if (fields.some(field => state[field] !== undefined)) problems.push('Paused reaction requires its carried rules');
    return problems;
  }
  if (![1, 2].includes(state.reactionRulesVersion) || (state.sharedExpansionVersion || state.combatExpansionVersion) !== 2) problems.push('Reaction rules require expanded combat');
  if (state.reactionRulesVersion === 2) problems.push(...reactionRulesProblems(state.reactionRules).map(problem => `Reaction rules: ${problem}`));
  else if (state.reactionRules !== undefined) problems.push('Reaction rules tuning requires reaction rules version 2');
  if (state.foundationNextSerial !== undefined && (!Number.isSafeInteger(state.foundationNextSerial) || state.foundationNextSerial < 0)) problems.push('Invalid reaction foundation serial');
  if (state.reactionCursor !== undefined && (!record(state.reactionCursor) || !Number.isSafeInteger(state.reactionCursor.index)
    || state.reactionCursor.index < 0 || state.reactionCursor.index >= state.enemies.length
    || !['start', 'payload', 'drain'].includes(state.reactionCursor.stage))) problems.push('Invalid enemy reaction cursor');
  if (state.reactionHandCleanup !== undefined && !record(state.reactionHandCleanup)) problems.push('Invalid pending hand cleanup');
  const paused = state.pendingReaction || state.reactionResume;
  const incoming = [...queue, ...(Array.isArray(state.reactionResume?.queue) ? state.reactionResume.queue : [])];
  const enemyPayload = incoming.some(action => action.meta?.expansionGroup?.enemyMoveStart);
  if (paused && (state.phase === 'enemy' || enemyPayload) && !state.reactionCursor) problems.push('Enemy reaction requires its turn cursor');
  if (state.reactionCursor && !['enemy', 'suspended'].includes(state.phase)) problems.push('Enemy reaction cursor is outside its phase');
  if (state.reactionCursor && !state.result) {
    const owed = state.players instanceof Map ? [...state.players.values()].filter(seat =>
      (seat.endedBeforeDisconnect ?? seat.ended) === true) : null;
    const cleanup = owed ? owed.length > 0 && owed.every(seat => record(seat.reactionHandCleanup)
      && typeof seat.reactionHandCleanup.locked === 'boolean') : record(state.reactionHandCleanup);
    if (!cleanup) problems.push('Enemy reaction requires its pending hand cleanup');
  }
  // Enemy reactions: the per-turn roll memo, and a player-card root's deferred card.
  if (state.enemyReactionRolls !== undefined && (state.reactionRulesVersion !== 2 || !record(state.enemyReactionRolls)
    || Object.values(state.enemyReactionRolls).some(value => typeof value !== 'boolean'))) problems.push('Invalid enemy reaction rolls');
  if (state.reactionRootPlay !== undefined && (state.reactionRulesVersion !== 2 || !record(state.reactionRootPlay)
    || !record(state.reactionRootPlay.instance) || !text(state.reactionRootPlay.instance.cardId)
    || !(state.pendingReaction || state.reactionStack || state.reactionResume))) problems.push('Invalid deferred reaction root card');
  const stack = state.reactionStack;
  if (stack !== undefined) {
    // Enemy entries are keyed by enemy id and never count toward a player seat's cap.
    const stacked = seatId => stack.entries.filter(entry => entry.side === 'player' && entry.ownerId === seatId).length;
    const stackCap = () => {
      const group = incoming.find(action => action.meta?.expansionGroup?.key === stack.groupKey).meta.expansionGroup;
      const caps = state.reactionRules?.stack || {};
      return group.counterReturn ? caps.counterReturnMaxDepth : caps.maxDepth;
    };
    if (state.reactionRulesVersion !== 2) problems.push('Reaction stack requires reaction rules version 2');
    else if (!record(stack) || !text(stack.groupKey) || typeof stack.resolving !== 'boolean' || !Array.isArray(stack.entries)
      || !stack.entries.length || stack.entries.some(entry => !record(entry) || !['player', 'enemy'].includes(entry.side)
        || (entry.side === 'player' ? !playerEntry(entry, ownerIds) : !enemyEntry(entry, state, ownerIds, stack)))
      || !incoming.some(action => action.meta?.expansionGroup?.key === stack.groupKey)
      || (stack.counterSeats !== undefined && (!Array.isArray(stack.counterSeats) || new Set(stack.counterSeats).size !== stack.counterSeats.length
        || stack.counterSeats.some(seatId => !ownerIds.has(seatId))))) problems.push('Invalid reaction stack');
    else if ((() => {
      // The live engine never builds these; a saved stack must not bypass them either.
      const group = incoming.find(action => action.meta?.expansionGroup?.key === stack.groupKey).meta.expansionGroup;
      const caps = state.reactionRules?.stack || {};
      const cap = stackCap();
      const players = stack.entries.filter(entry => entry.side === 'player');
      return [...new Set(players.map(entry => entry.ownerId))].some(seatId => stacked(seatId) > cap
        || players.filter(entry => entry.ownerId === seatId && entry.maneuver === 'counter').length > 1)
        // Enemy entries: none on a Counter-return root, at most maxDepth in total otherwise.
        || stack.entries.filter(entry => entry.side === 'enemy').length > (group.counterReturn ? 0 : caps.maxDepth);
    })()) problems.push('Reaction stack exceeds its per-seat limits');
    else if (state.pendingReaction !== undefined && (!record(state.pendingReaction) || state.pendingReaction.groupKey !== stack.groupKey
      || state.pendingReaction.id !== `${stack.groupKey}:${state.pendingReaction.ownerId}:${stacked(state.pendingReaction.ownerId)}`)) {
      problems.push('Reaction choice does not match its stack depth');
    } else if (state.pendingReaction !== undefined && stacked(state.pendingReaction.ownerId) >= stackCap()) {
      // The live engine stops offering at the cap; a saved offer past it would push entry cap + 1.
      problems.push('Reaction choice is past its seat limit');
    }
  }
  const pending = state.pendingReaction;
  if (pending !== undefined) {
    if (!record(pending) || !text(pending.id) || !text(pending.groupKey) || !ownerIds.has(pending.ownerId)
      || !state.enemies.some(enemy => enemy.id === pending.sourceId)
      || !Array.isArray(pending.options) || !pending.options.length
      || pending.options.some(option => !record(option) || !text(option.id) || !record(option.play) || !text(option.play.cardInstanceId)
        || !Number.isFinite(option.staminaCost) || option.staminaCost < 0 || !Number.isFinite(option.manaCost) || option.manaCost < 0)
      || new Set(pending.options.map(option => option.id)).size !== pending.options.length) problems.push('Invalid pending reaction choice');
    // A Combat Rounds Preview pause (SPEC §4.11) holds its attack in the round, not in the action queue.
    const roundPause = Boolean(state.combatRounds?.paused && state.combatRounds.round?.awaiting);
    if (!roundPause && (!queued(queue) || !queue.some(action => action.meta?.expansionGroup?.key === pending.groupKey && !action.meta.expansionGroup.begun))) problems.push('Reaction choice requires its unstarted contact plan');
    if (!['enemy', 'player', 'suspended'].includes(state.phase)) problems.push('Reaction choice is outside combat');
  }
  if (state.reactionResume !== undefined && (!record(state.reactionResume) || !queued(state.reactionResume.queue)
    || !state.pendingAbilityDiscard || !state.pendingAbilityPlay)) problems.push('Paid reaction continuation requires its nested choice');
  if (record(state.reactionResume)) {
    const saved = state.reactionResume.foundation;
    if (state.foundation ? !record(saved) : saved !== null) problems.push('Reaction continuation requires its retained foundation context');
    if (record(saved) && (!Number.isSafeInteger(saved.actionSerial) || saved.actionSerial < 0
      || !Number.isSafeInteger(saved.eventCount) || saved.eventCount < 0
      || !record(saved.rolls) || Object.values(saved.rolls).some(value => typeof value !== 'boolean')
      || !record(saved.counts) || Object.values(saved.counts).some(value => !Number.isSafeInteger(value) || value < 0))) {
      problems.push('Invalid retained reaction foundation context');
    }
  }
  return problems;
}
