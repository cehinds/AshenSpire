const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const queued = value => Array.isArray(value) && value.every(action => record(action) && record(action.effect) && text(action.effect.op));

import { reactionRulesProblems } from '../content/combatCardTraits.js';
import { rangeStateProblems, rangePlanProblems, opposingRangeKeys } from './combatEngagement.js';

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
  const groups = new Set(incoming.filter(action => action.meta?.expansionGroup)
    .map(action => action.meta.expansionGroup));
  for (const group of groups) {
    const sequence = group.contactSequence;
    if (sequence === undefined) continue;
    const targets = value => record(value) && Object.values(value).every(row => record(row) && text(row.id)
      && Array.isArray(row.contacts) && row.contacts.length > 0 && row.contacts.every(record));
    if (state.reactionRules?.contactPolicy !== 'perHit' || !record(sequence) || !text(sequence.rootKey)
      || !Array.isArray(sequence.contacts) || !sequence.contacts.length
      || sequence.contacts.some(contact => !record(contact) || !targets(contact.targets))
      || !Number.isSafeInteger(sequence.index) || sequence.index < 0 || sequence.index >= sequence.contacts.length
      || group.key !== `${sequence.rootKey}:hit:${sequence.index}` || !targets(sequence.rootTargets)
      || !record(sequence.gates) || Object.values(sequence.gates).some(value => typeof value !== 'boolean')) {
      problems.push('Invalid combat contact sequence'); continue;
    }
    for (const action of incoming.filter(action => action.meta?.expansionGroup?.key === group.key)) {
      const index = action.meta.contactIndex;
      if (index !== undefined && (!Number.isSafeInteger(index) || index < sequence.index || index >= sequence.contacts.length
        || !Number.isSafeInteger(action.meta.contactEffectIndex) || action.meta.contactEffectIndex < 0
        || typeof action.meta.contactEffectFirst !== 'boolean')) problems.push('Invalid queued combat contact');
    }
  }
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
      return state.reactionRules?.contactPolicy === 'perHit' ? 1 : group.counterReturn ? caps.counterReturnMaxDepth : caps.maxDepth;
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
    || !(state.pendingAbilityDiscard || state.pendingCardChoice) || !state.pendingAbilityPlay)) problems.push('Paid reaction continuation requires its nested choice');
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


/** Validate the range transaction graph at either solo or co-op save boundaries.
 * Identity comes from the seat map, never from the shared player entity id.
 * Dead actors remain in this list because their engagement pairs remain inert.
 */
export function combatRangeProblems(state, { queue = state.abilityQueue || state.queue || [] } = {}) {
  const problems = [];
  const actors = state.players instanceof Map
    ? [...state.players].map(([id, seat]) => [seat?.entity, `player:${id}`])
    : [[state.player, 'player:player']];
  actors.push(...(Array.isArray(state.enemies) ? state.enemies : []).map(entity => [entity, `enemy:${entity?.id}`]));
  const actorKeys = actors.map(([, key]) => key);
  const hasRange = state.rangeState !== undefined;
  if (hasRange) {
    problems.push(...rangeStateProblems(state.rangeState, actorKeys));
    if ((state.sharedExpansionVersion || state.combatExpansionVersion) !== 2 || state.fixCoreRules?.enabled === false
      || !(state.fixCoreRules?.version === 1 || state.gameProfile?.modules?.effects?.fixCoreVersion === 1)) problems.push('Engagement state requires Core combat');
    for (const [entity, expected] of actors) if (entity?.rangeActorKey !== expected) problems.push(`Invalid range actor identity: expected ${expected}`);
  } else if (actors.some(([entity]) => entity?.rangeActorKey !== undefined)) problems.push('Range actor identities require engagement state');

  // Only transaction-bearing runtime records are traversed. Logs, registries,
  // catalogues and RNG state do not carry authority to execute an action.
  const roots = [queue, state.reactionResume, state.reactionStack, state.pendingAbilityPlay,
    state.reactionRootPlay, state.combatRounds, ...actors.map(([entity]) => entity?.combatCounter)];
  const seen = new Set(), plans = [], reservations = [];
  const inspect = (value, quoted = false) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Object.hasOwn(value, 'rangeQuote')) {
      if (!hasRange) problems.push('Range quote requires engagement state');
      else problems.push(...rangePlanProblems(value.rangeQuote, state.rangeState, actorKeys));
    }
    if (Object.hasOwn(value, 'rangeCounterReservation')) {
      const reservation = value.rangeCounterReservation;
      reservations.push(reservation);
      const allowed = ['version', 'sourceKey', 'targetKey', 'incomingRootId', 'contactId', 'rangePlan', 'consumed'];
      if (!hasRange || !record(reservation) || Object.keys(reservation).some(key => !allowed.includes(key))
        || reservation.version !== 1 || reservation.consumed !== false
        || !actorKeys.includes(reservation.sourceKey) || !actorKeys.includes(reservation.targetKey)
        || !opposingRangeKeys(reservation.sourceKey, reservation.targetKey)
        || !text(reservation.incomingRootId) || !text(reservation.contactId)
        || reservation.rangePlan?.sourceKey !== reservation.sourceKey
        || !Array.isArray(reservation.rangePlan?.targets) || !reservation.rangePlan.targets.length
        || reservation.rangePlan.targets.some(row => row?.targetKey !== reservation.targetKey)) problems.push('Invalid range Counter reservation');
    }
    if (Object.hasOwn(value, 'rangePlan')) {
      const plan = value.rangePlan;
      if (!hasRange) problems.push('Range action plan requires engagement state');
      else {
        const planProblems = rangePlanProblems(plan, state.rangeState, actorKeys);
        problems.push(...planProblems);
        if (!planProblems.length) plans.push(plan);
        if (!quoted && (!record(plan) || !text(plan.rootId) || !record(plan.paid) || plan.available !== true)) problems.push('Accepted range action requires its paid available receipt');
      }
    }
    for (const [key, child] of Object.entries(value)) if (!['rangePlan', 'rangeQuote'].includes(key)) inspect(child, quoted);
  };
  for (const root of roots) inspect(root);
  inspect(state.pendingReaction, true);
  // JSON duplicates shared carrier references. Every copy of one accepted root
  // must still describe the same frozen payment and contact envelope.
  const stable = value => Array.isArray(value) ? value.map(stable) : record(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  const rootsById = new Map();
  for (const plan of plans) {
    if (!text(plan?.rootId)) continue;
    const receipt = JSON.stringify(stable(plan));
    if (rootsById.has(plan.rootId) && rootsById.get(plan.rootId) !== receipt) problems.push('Conflicting range receipts for one root action');
    rootsById.set(plan.rootId, receipt);
  }
  for (const reservation of reservations) {
    if (!record(reservation)) continue;
    const incoming = plans.find(plan => plan?.rootId === reservation.incomingRootId
      && plan.sourceKey === reservation.targetKey && Array.isArray(plan.targets) && plan.targets.some(contact =>
        contact?.contactId === reservation.contactId && contact.targetKey === reservation.sourceKey));
    if (!incoming) problems.push('Range Counter reservation requires its exact incoming contact');
  }
  return [...new Set(problems)];
}
