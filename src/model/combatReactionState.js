const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const queued = value => Array.isArray(value) && value.every(action => record(action) && record(action.effect) && text(action.effect.op));

import { reactionRulesProblems } from '../content/combatCardTraits.js';

export function combatReactionProblems(state, { ownerIds = new Set(['player']), queue = state.abilityQueue || state.queue || [] } = {}) {
  const problems = [];
  const fields = ['pendingReaction', 'reactionResume', 'reactionCursor', 'reactionHandCleanup', 'reactionStack', 'reactionRules'];
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
  const stack = state.reactionStack;
  if (stack !== undefined) {
    const stacked = seatId => stack.entries.filter(entry => entry.ownerId === seatId).length;
    if (state.reactionRulesVersion !== 2) problems.push('Reaction stack requires reaction rules version 2');
    else if (!record(stack) || !text(stack.groupKey) || typeof stack.resolving !== 'boolean' || !Array.isArray(stack.entries)
      || !stack.entries.length || stack.entries.some(entry => !record(entry) || entry.side !== 'player'
        || !ownerIds.has(entry.ownerId) || !text(entry.cardId) || !record(entry.play) || !text(entry.play.cardInstanceId)
        || (entry.maneuver !== null && entry.maneuver !== undefined && typeof entry.maneuver !== 'string'))
      || !incoming.some(action => action.meta?.expansionGroup?.key === stack.groupKey)) problems.push('Invalid reaction stack');
    else if ((() => {
      // The live engine never builds these; a saved stack must not bypass them either.
      const group = incoming.find(action => action.meta?.expansionGroup?.key === stack.groupKey).meta.expansionGroup;
      const caps = state.reactionRules?.stack || {};
      const cap = group.counterReturn ? caps.counterReturnMaxDepth : caps.maxDepth;
      return [...new Set(stack.entries.map(entry => entry.ownerId))].some(seatId => stacked(seatId) > cap
        || stack.entries.filter(entry => entry.ownerId === seatId && entry.maneuver === 'counter').length > 1);
    })()) problems.push('Reaction stack exceeds its per-seat limits');
    else if (state.pendingReaction !== undefined && (!record(state.pendingReaction) || state.pendingReaction.groupKey !== stack.groupKey
      || state.pendingReaction.id !== `${stack.groupKey}:${state.pendingReaction.ownerId}:${stacked(state.pendingReaction.ownerId)}`)) {
      problems.push('Reaction choice does not match its stack depth');
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
    if (!queued(queue) || !queue.some(action => action.meta?.expansionGroup?.key === pending.groupKey && !action.meta.expansionGroup.begun)) problems.push('Reaction choice requires its unstarted contact plan');
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
