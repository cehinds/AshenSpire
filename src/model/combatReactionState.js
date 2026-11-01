const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const queued = value => Array.isArray(value) && value.every(action => record(action) && record(action.effect) && text(action.effect.op));

import { reactionRulesProblems } from '../content/combatCardTraits.js';
import { rangeStateProblems, rangePlanProblems, opposingRangeKeys, rangeBand } from './combatEngagement.js';
import { rangeLineagePlanProblems, rangeLineageProblems, rangeSiteBatchesProblems, rangeOriginProblems } from './combatRangeLineageState.js';

const playerEntry = (entry, ownerIds) => ownerIds.has(entry.ownerId) && text(entry.cardId) && record(entry.play) && text(entry.play.cardInstanceId)
  && (entry.maneuver === null || entry.maneuver === undefined || typeof entry.maneuver === 'string')
  && (entry.incoming === undefined || (record(entry.incoming) && Object.values(entry.incoming).every(value => Number.isFinite(value) && value > 0)));
// An enemy entry: its enemy, move, target seat and the committed plan (id references
// to entities plus the one planned group they share).
const ref = value => value === null || (record(value) && text(value.id) && (value.playerId === undefined || text(value.playerId)));
const enemyEntry = (entry, state, ownerIds, stack) => (state.enemies || []).some(enemy => enemy.id === entry.ownerId)
  && (entry.spPayment === undefined || enemySpPaymentValid(entry.spPayment))
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
      // The card-less auto-Counter option (owner 2026-10-31) has no card instance: {id:'autoCounter', cardId:null, autoCounter:true}.
      || pending.options.some(option => !record(option) || !text(option.id) || !record(option.play)
        || !(option.autoCounter === true ? option.id === 'autoCounter' && option.cardId === null && option.play.autoCounter === true : text(option.play.cardInstanceId))
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
  if (state._rangeContext !== undefined || state._rangeIncoming !== undefined) problems.push('Transient range context cannot cross a save boundary');
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
  const seen = new Set(), plans = [], reservations = [], groups = [], lineagePlans = [], rangeCarriers = [];
  const inspect = (value, quoted = false) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (text(value.key) && record(value.targets) && value.carrier?.rangePlan) groups.push(value);
    if (Object.hasOwn(value, 'rangeContactId') && (!hasRange || !text(value.rangeContactId))) problems.push('Invalid frozen range contact identity');
    if (Object.hasOwn(value, 'resolvedRangeSource')) {
      const source = value.resolvedRangeSource;
      const keys = ['sourceType', 'itemId', 'range', 'propertyTags'];
      const valid = hasRange && record(source) && Object.keys(source).every(key => keys.includes(key))
        && ['weapon', 'unarmed', 'spell'].includes(source.sourceType)
        && ['melee', 'reach', 'ranged'].includes(source.range)
        && (source.sourceType === 'weapon' ? text(source.itemId) : source.itemId === null)
        && Array.isArray(source.propertyTags) && source.propertyTags.length <= 1
        && source.propertyTags.every(tag => tag === 'throw' && source.sourceType === 'weapon');
      if (!valid) problems.push('Invalid frozen range source');
      else if (Array.isArray((value.rangeCounterReservation?.rangePlan || value.rangePlan)?.targets)
        && (value.rangeCounterReservation?.rangePlan || value.rangePlan).targets.length
        && !(value.rangeCounterReservation?.rangePlan || value.rangePlan).targets.some(row =>
        row?.sourceWeaponId === source.itemId && row.coverage === rangeBand(source.range)
        && row.weapon === (source.sourceType === 'weapon') && row.throwCapable === source.propertyTags.includes('throw'))) problems.push('Frozen range source does not match its contact receipt');
    }
    let actionSourceKey = null;
    if (record(value.effect)) {
      const index = value.meta?.rangeEffectIndex;
      if (index !== undefined && (!hasRange || !Number.isInteger(index) || index < 0 || index > 2
        || value.card?.combatReaction !== true
        || ![['damage', 'poiseDamage', 'wardDamage'][index], 'completeCombatAction'].includes(value.effect.op))) problems.push('Invalid reserved Counter range effect index');
      const ref = value.sourceRef;
      const id = ref?.id || value.sourceId;
      actionSourceKey = value.source?.rangeActorKey || (ref?.playerId ? `player:${ref.playerId}`
        : id === state.player?.id && !(state.players instanceof Map) ? 'player:player'
          : id && actorKeys.includes(`enemy:${id}`) ? `enemy:${id}` : null);
      if (value.card?.rangePlan && actionSourceKey && value.card.rangePlan.sourceKey !== actionSourceKey) problems.push('Queued range receipt belongs to another actor');
    }
    if (record(value.effect) && value.card?.resolvedRangeSource && value.meta?.expansionGroup) {
      const group = value.meta.expansionGroup;
      const targets = group.contactSequence?.contacts?.[value.meta.contactIndex]?.targets || group.targets;
      const plan = group.carrier?.rangePlan;
      for (const batch of Array.isArray(value.meta.expansionContacts) ? value.meta.expansionContacts : []) for (const ref of Array.isArray(batch) ? batch : []) {
        const contact = targets?.[ref?.key]?.contacts?.[ref?.index];
        if (!contact?.rangeContactId || !Array.isArray(plan?.targets)) continue;
        const planned = plan.targets.find(row => row?.contactId === contact.rangeContactId), source = value.card.resolvedRangeSource;
        if (!planned || planned.sourceWeaponId !== source.itemId || planned.coverage !== rangeBand(source.range)
          || planned.weapon !== (source.sourceType === 'weapon') || planned.throwCapable !== (Array.isArray(source.propertyTags) && source.propertyTags.includes('throw'))) problems.push('Queued range source does not match its exact contact');
      }
    }
    if (Object.hasOwn(value, 'rangeLineagePlan')) {
      const errors = hasRange ? rangeLineagePlanProblems(value.rangeLineagePlan, value.rangePlan, actorKeys)
        : ['Range lineage plan requires engagement state'];
      problems.push(...errors);
      if (!errors.length) lineagePlans.push(value.rangeLineagePlan);
    }
    if (Object.hasOwn(value, 'rangeLineage')) problems.push(...rangeLineageProblems(value.rangeLineage, value.rangeLineagePlan));
    if (record(value.effect) && value.card?.rangeLineage
      && (!Array.isArray(value.meta?.rangeSiteBatches) || !record(value.meta?.event?.rangeOrigin))) problems.push('Inherited range action requires its frozen event and target sites');
    if (record(value.effect) && value.meta?.rangeSiteBatches !== undefined) {
      const graph = value.card?.rangeLineagePlan || value.meta?.expansionGroup?.carrier?.rangeLineagePlan;
      problems.push(...rangeSiteBatchesProblems(value.meta.rangeSiteBatches, graph, { edgeId: value.card?.rangeLineage?.edgeId ?? null }));
      const source = value.card?.resolvedRangeSource;
      for (const [index, batch] of (Array.isArray(value.meta.rangeSiteBatches) ? value.meta.rangeSiteBatches : []).entries()) {
        for (const ref of Array.isArray(batch) ? batch : []) {
          const site = Array.isArray(graph?.sites) && graph.sites.find(site => site?.id === ref?.siteId);
          if (source && site?.delivery && (site.delivery.coverage !== rangeBand(source.range)
            || site.delivery.sourceWeaponId !== source.itemId || site.delivery.weapon !== (source.sourceType === 'weapon')
            || site.delivery.throwCapable !== (Array.isArray(source.propertyTags) && source.propertyTags.includes('throw')))) problems.push('Queued range source does not match its exact lineage site');
        }
        const targets = value.meta.expansionTargets?.[index];
        if (Array.isArray(batch) && Array.isArray(targets) && (batch.length !== targets.length
          || batch.some(ref => !targets.some(target => target?.id === ref?.id && (target.playerId ?? null) === (ref?.playerId ?? null))))) problems.push('Queued range target does not match its exact lineage site');
      }
    }
    if (record(value.effect) && value.meta?.event?.rangeOrigin !== undefined) {
      const graph = value.card?.rangeLineagePlan || value.meta?.expansionGroup?.carrier?.rangeLineagePlan;
      if ((actionSourceKey === value.meta.event.rangeOrigin?.sourceKey
        || value.card?.rangePlan?.rootId === value.meta.event.rangeOrigin?.rootId) && !value.card?.rangeLineage) problems.push('Same-actor range trigger requires its inherited envelope');
      // Another actor can receive the event but cannot inherit its paid root.
      // Such an independent action does not carry range authority from it.
      if (graph) problems.push(...rangeOriginProblems(value.meta.event.rangeOrigin, value.meta.event, graph, value.card?.rangeLineage));
    }
    if (Object.hasOwn(value, 'rangeQuote')) {
      if (!hasRange) problems.push('Range quote requires engagement state');
      else problems.push(...rangePlanProblems(value.rangeQuote, state.rangeState, actorKeys));
    }
    if (Object.hasOwn(value, 'rangeCounterReservation')) {
      const reservation = value.rangeCounterReservation;
      reservations.push(reservation);
      const allowed = ['version', 'sourceKey', 'targetKey', 'incomingRootId', 'contactId', 'rangePlan', 'rangeLineagePlan', 'consumed'];
      if (!hasRange || !record(reservation) || Object.keys(reservation).some(key => !allowed.includes(key))
        || reservation.version !== 1 || reservation.consumed !== false
        || !actorKeys.includes(reservation.sourceKey) || !actorKeys.includes(reservation.targetKey)
        || !opposingRangeKeys(reservation.sourceKey, reservation.targetKey)
        || !text(reservation.incomingRootId) || !text(reservation.contactId)
        || reservation.rangePlan?.sourceKey !== reservation.sourceKey
        || !Array.isArray(reservation.rangePlan?.targets) || !reservation.rangePlan.targets.length
        || !reservation.rangePlan.targets.some(row => row?.targetKey === reservation.targetKey)
        || reservation.rangePlan.targets.some(row => row?.targetKey !== reservation.targetKey
          && !(Array.isArray(reservation.rangeLineagePlan?.edges) && reservation.rangeLineagePlan.edges.some(edge => Array.isArray(edge?.targets)
            && edge.targets.some(target => target?.contactId === row?.contactId && target.targetKey === row?.targetKey))))) problems.push('Invalid range Counter reservation');
    }
    if (Object.hasOwn(value, 'rangePlan')) {
      rangeCarriers.push(value);
      const plan = value.rangePlan;
      if (!hasRange) problems.push('Range action plan requires engagement state');
      else {
        const planProblems = rangePlanProblems(plan, state.rangeState, actorKeys);
        problems.push(...planProblems);
        if (!planProblems.length) plans.push(plan);
        if (!quoted && (!record(plan) || !text(plan.rootId) || !record(plan.paid) || plan.available !== true)) problems.push('Accepted range action requires its paid available receipt');
      }
    }
    for (const [key, child] of Object.entries(value)) if (!['rangePlan', 'rangeQuote', 'rangeLineagePlan'].includes(key)) inspect(child, quoted);
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
  const lineagesById = new Map();
  for (const graph of lineagePlans) {
    const signature = JSON.stringify(stable(graph));
    if (lineagesById.has(graph.rootId) && lineagesById.get(graph.rootId) !== signature) problems.push('Conflicting range lineages for one root action');
    lineagesById.set(graph.rootId, signature);
  }
  for (const carrier of rangeCarriers) if (lineagesById.has(carrier.rangePlan?.rootId)
    && !Object.hasOwn(carrier, 'rangeLineagePlan')) problems.push('Frozen range lineage is missing from an executable root copy');
  const targetKey = row => row?.playerId ? `player:${row.playerId}`
    : row?.id === 'player' && !(state.players instanceof Map) ? 'player:player' : `enemy:${row?.id}`;
  for (const group of groups) for (const row of Object.values(group.targets)) {
    if (!Array.isArray(row?.contacts)) continue;
    for (const contact of row.contacts) if (contact?.rangeContactId !== undefined
      && (!Array.isArray(group.carrier.rangePlan.targets) || !group.carrier.rangePlan.targets.some(planned =>
        planned?.contactId === contact.rangeContactId && planned.targetKey === targetKey(row)))) problems.push('Frozen range contact is outside its root receipt');
  }
  for (const reservation of reservations) {
    if (!record(reservation)) continue;
    const incoming = groups.find(group => group.carrier.rangePlan?.rootId === reservation.incomingRootId
      && group.carrier.rangePlan.sourceKey === reservation.targetKey && Object.values(group.targets).some(row =>
        targetKey(row) === reservation.sourceKey && Array.isArray(row?.contacts)
        && row.contacts.some(contact => contact?.rangeContactId === reservation.contactId)));
    if (!incoming) problems.push('Range Counter reservation requires its exact incoming contact');
  }
  return [...new Set(problems)];
}
import { enemySpPaymentValid } from './core2ActionPolicy.js';
