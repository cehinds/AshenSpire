// SPEC 4.10: choices pause a committed contact plan before defense begins.
// Callbacks are supplied by the solo/co-op command door, never saved in state.
import { candidateState } from './combatRules.js';
import { resolveCombatCard } from './combatExpansion.js';
import { counterCoverageMatches } from './combatMatchups.js';
import { cardChoice } from '../model/cardChoices.js';
import { upcastOptions } from '../model/upcasting.js';
import { controlRestrictions } from './combatStatusControl.js';
import { cardTargetPlan } from '../model/cardTargets.js';

// Reaction rules: 1 = one reaction per root; 2 = card traits plus the reaction stack.
export const usesReactions = ctx => ctx.reactionRulesVersion >= 1;
export const stackedReactions = ctx => ctx.reactionRulesVersion === 2;
export const cardTraitsActive = ctx => ctx.reactionRulesVersion === 2;
export const reactionPaused = ctx => !!(ctx.pendingReaction || ctx.reactionResume || ctx.pendingAbilityDiscard);

export function setReactionsEnabled(ctx, entity, enabled) {
  if (!usesReactions(ctx)) throw new Error('Optional reactions are unavailable in this saved combat');
  if (typeof enabled !== 'boolean') throw new Error('Reaction preference must be enabled or disabled');
  if (ctx.phase !== 'player' || reactionPaused(ctx)) throw new Error('Change reactions between actions on the player turn');
  entity.reactionsEnabled = enabled;
}

const counterCovered = (ctx, def, row, tags) => row.contacts.some(contact =>
  counterCoverageMatches(def.counterCoverage || ctx.combatExpansionRules.matchups.counter.defaultCoverage[
    tags.includes('counter:spell') ? 'spell' : tags.includes('counter:ranged') ? 'ranged' : 'melee'], contact, contact.effect || 'damage'));

// Version 2: a `trait:reaction` card is eligible by tag (a Counter still needs coverage,
// anything else a positive contact). Untagged cards keep the version 1 rule until the
// trait projection tags them.
function eligible(ctx, def, row) {
  const tags = def.cardTags || def.tags || [];
  if (cardTraitsActive(ctx) && tags.includes('trait:reaction')) {
    return tags.includes('maneuver:counter') ? counterCovered(ctx, def, row, tags) : row.contacts.some(positive);
  }
  if (tags.includes('maneuver:counter')) return counterCovered(ctx, def, row, tags);
  return tags.includes('maneuver:sweep') && def.defensiveReaction === true;
}

// A hand card that could answer some incoming root by its maneuver (SPEC §4.10).
const candidateByManeuver = (ctx, def) => {
  const tags = def.cardTags || def.tags || [];
  if (cardTraitsActive(ctx) && tags.includes('trait:reaction')) return true;
  return tags.includes('maneuver:counter') || (tags.includes('maneuver:sweep') && def.defensiveReaction === true);
};
// The committed reaction stack of this incoming root (version 2 only).
const stackOf = (ctx, group) => (stackedReactions(ctx) && ctx.reactionStack?.groupKey === group.key ? ctx.reactionStack : null);
// The reported reason is the first failing check of the candidate that got furthest.
const REASON_RANK = { notCovered: 0, other: 1, controlled: 2, unplayable: 3, cost: 4 };
const handOf = (ctx, row) => (ctx.players ? ctx.players.get(row.playerId)?.piles.hand : ctx.piles.hand) || [];
const positive = contact => !!contact && (contact.amount > 0 || contact.pressure > 0);

function attackKind(row) {
  const hit = row.contacts.find(contact => positive(contact) && !contact.effect);
  if (!hit) return 'statusOnly';
  if (hit.maneuver === 'sweep') return 'sweep';
  if (hit.targeting === 'area') return 'area';
  if (hit.camp === 'spell') return 'spell';
  if (hit.reach === 'near' || hit.reach === 'far') return 'ranged';
  return 'attack';
}

function candidateCardIds(ctx, row) {
  const ids = [];
  for (const inst of handOf(ctx, row)) {
    if (candidateByManeuver(ctx, resolveCombatCard(ctx, inst)) && !ids.includes(inst.cardId)) ids.push(inst.cardId);
  }
  return ids;
}

function optionsFor(ctx, row, group, hooks, refusal = null) {
  const options = [];
  let inst;
  // The refusal also names the card it came from (cardId), so the log can name it.
  const note = (reason, extra = {}) => {
    if (refusal && (!refusal.reason || REASON_RANK[reason] > REASON_RANK[refusal.reason])) {
      for (const key of Object.keys(refusal)) delete refusal[key];
      Object.assign(refusal, { reason, ...extra, cardId: inst.cardId });
    }
  };
  // Version 2: stacked instances are not offered again, and a seat holding a Counter
  // entry is offered no further Counter. Each option is tried on top of the stack.
  const stack = stackOf(ctx, group);
  const entries = stack?.entries || [];
  const seat = ctx.players ? row.playerId : 'player';
  const counterStacked = entries.some(entry => entry.ownerId === seat && entry.maneuver === 'counter');
  for (inst of handOf(ctx, row)) {
    if (entries.some(entry => entry.play.cardInstanceId === inst.instanceId)) continue;
    const base = resolveCombatCard(ctx, inst);
    if (counterStacked && (base.cardTags || base.tags || []).includes('maneuver:counter')) continue;
    if (!eligible(ctx, base, row)) { if (candidateByManeuver(ctx, base)) note('notCovered'); continue; }
    const choices = cardChoice(ctx.registries, base, ctx.player.classId)?.options || [null];
    for (const tier of [0, ...upcastOptions(base).map(option => option.ranks)]) for (const choice of choices) {
      const candidate = candidateState(ctx);
      candidate.queue = []; delete candidate.pendingReaction; delete candidate.reactionResume;
      candidate._reactionPlaying = true; candidate._buffer = null;
      candidate.pendingExpansionActions = 0;
      if (candidate.foundation) { candidate.foundation.eventCount = 0; candidate.foundation.rolls = {}; candidate.foundation.counts = {}; }
      hooks.setOwner?.(candidate, row.playerId);
      const targetPlan = cardTargetPlan(base, row.playerId || 'player', candidate.enemies,
        candidate.players ? [...candidate.players.values()].map(seat => ({ id: seat.id, alive: seat.entity.alive, connected: seat.connected }))
          : [{ id: candidate.player.id, alive: true, connected: true }], { solo: !candidate.players });
      const play = { cardInstanceId: inst.instanceId, ...(targetPlan.mode === 'enemy' ? { targetId: group.sourceId } : {}),
        ...(choice ? { choice: choice.id } : {}), ...(tier ? { upcastTier: tier } : {}) };
      try {
        const paymentStart = candidate.eventLog.length;
        hooks.play(candidate, play);
        const paid = candidate.eventLog.slice(paymentStart).find(event => event.type === 'cardPlayed');
        if (!paid || !candidate.player.alive) { note('other'); continue; }
        // The stacked entries resolve after this option, last pushed first; all must play.
        for (const entry of [...entries].reverse()) {
          hooks.setOwner?.(candidate, entry.ownerId);
          const start = candidate.eventLog.length;
          hooks.play(candidate, { ...entry.play });
          if (!candidate.eventLog.slice(start).some(event => event.type === 'cardPlayed')) throw new Error('Stacked reaction did not play');
        }
        options.push({ id: `${inst.instanceId}:${tier}:${choice?.id || 'default'}`, name: base.name,
          cardId: inst.cardId, play, staminaCost: paid.staminaSpent ?? paid.energySpent ?? 0,
          manaCost: paid.manaSpent || 0, choiceName: choice?.label || choice?.name || null });
      } catch (error) {
        // Ineligible under the normal card/payment/control rules; the refusal names why.
        const { reason, ...extra } = error?.playRefusal || {};
        note(REASON_RANK[reason] === undefined ? 'other' : reason, extra);
      }
    }
  }
  return options;
}

// At most one receipt per incoming root and seat, and only for a seat holding a candidate.
// Candidates resolve under the owning seat's rules (co-op seats may run
// different combat versions), so that seat is active while they are read.
function reportUnavailable(ctx, group, id, row, reason, extra = {}, hooks = null) {
  if (group.reactionNoticed?.includes(id)) return;
  const previous = ctx.playerKey;
  if (ctx.players) hooks?.setOwner?.(ctx, id);
  let cardIds;
  try { cardIds = candidateCardIds(ctx, row); } finally { if (ctx.players) hooks?.setOwner?.(ctx, previous); }
  if (!cardIds.length) return;
  (group.reactionNoticed ||= []).push(id);
  const { cardId = cardIds[0], ...rest } = extra;
  ctx.emit('combatReactionUnavailable', { ownerId: id, sourceId: group.sourceId, reason, cardId, cardIds,
    attackKind: attackKind(row), ...rest });
}

const rowFor = (ctx, group, id) => Object.values(group.targets).find(target => ctx.players ? target.playerId === id : target.id === ctx.player.id);
function seatPresent(ctx, id) {
  const seat = ctx.players?.get(id);
  return !!(seat?.entity || ctx.player)?.alive && (!seat || seat.connected === true);
}

// Fallback for a later action of an already answered root (reportRestOfRoot usually fires first).
function reportAlreadyAnswered(ctx, action, group, hooks) {
  const contacts = (action.meta?.expansionContacts || []).flat();
  for (const id of group.reactionAnswered || []) {
    const row = rowFor(ctx, group, id);
    if (!row || group.reactionNoticed?.includes(id) || !seatPresent(ctx, id)) continue;
    if (!contacts.some(contact => group.targets[contact.key] === row && positive(row.contacts[contact.index]))) continue;
    reportUnavailable(ctx, group, id, row, 'alreadyAnswered', {}, hooks);
  }
}

export function beforeReactionAction(ctx, action, hooks) {
  if (!usesReactions(ctx) || ctx._reactionPlaying) return false;
  if (ctx.pendingReaction) return true;
  const group = action.meta?.expansionGroup;
  if (!group || group.carrier?.reactionDepth || action.source?.kind !== 'enemy') return false;
  if (group.begun) { reportAlreadyAnswered(ctx, action, group, hooks); return false; }
  if (stackedReactions(ctx)) return beforeStackedReaction(ctx, action, group, hooks);
  if (!action.source.alive) return false;
  const ids = ctx.players ? ctx.order : ['player'];
  const halted = action.source.skipNextTurn ? 'attackerStaggered'
    : controlRestrictions(ctx, action.source).locked ? 'attackerControlled' : null;
  if (halted) {
    for (const id of ids) {
      const row = rowFor(ctx, group, id);
      if (!row || !row.contacts.some(positive) || group.reactionAnswered?.includes(id) || !seatPresent(ctx, id)) continue;
      reportUnavailable(ctx, group, id, row, halted, {}, hooks);
    }
    return false;
  }
  group.reactionAnswered ||= [];
  for (const id of ids) {
    const row = rowFor(ctx, group, id);
    if (!row || !row.contacts.some(positive) || group.reactionAnswered.includes(id)) continue;
    const seat = ctx.players?.get(id);
    const entity = seat?.entity || ctx.player;
    if (!entity.alive || entity.reactionsEnabled === false || (seat && !seat.connected)) {
      if (entity.reactionsEnabled === false && seatPresent(ctx, id)) reportUnavailable(ctx, group, id, row, 'switchOff', {}, hooks);
      group.reactionAnswered.push(id); continue;
    }
    const previous = ctx.playerKey;
    hooks.setOwner?.(ctx, id);
    const refusal = {};
    const options = optionsFor(ctx, row, group, hooks, refusal);
    hooks.setOwner?.(ctx, previous);
    if (!options.length) {
      const { reason = 'other', ...extra } = refusal;
      reportUnavailable(ctx, group, id, row, reason, extra, hooks);
      group.reactionAnswered.push(id); continue;
    }
    ctx.pendingReaction = { id: `${group.key}:${id}`, groupKey: group.key, ownerId: id,
      sourceId: group.sourceId, options };
    ctx.emit('combatReactionOffered', { offerId: ctx.pendingReaction.id, ownerId: id, sourceId: group.sourceId });
    return true;
  }
  return false;
}

const haltReason = (ctx, source) => source.skipNextTurn ? 'attackerStaggered'
  : controlRestrictions(ctx, source).locked ? 'attackerControlled' : null;

// Version 2: each seat in saved order is offered again after every card it pushes,
// until it passes, has no option left or reaches the depth cap. A stack that exists
// for this root is kept even if the attacker is now halted or dead; it only stops
// new offers.
function beforeStackedReaction(ctx, action, group, hooks) {
  const stack = stackOf(ctx, group);
  const ids = ctx.players ? ctx.order : ['player'];
  if (!stack) {
    if (!action.source.alive) return false;
    const halted = haltReason(ctx, action.source);
    if (halted) {
      for (const id of ids) {
        const row = rowFor(ctx, group, id);
        if (!row || !row.contacts.some(positive) || group.reactionAnswered?.includes(id) || !seatPresent(ctx, id)) continue;
        reportUnavailable(ctx, group, id, row, halted, {}, hooks);
      }
      return false;
    }
  }
  const open = action.source.alive && !haltReason(ctx, action.source);
  const cap = group.counterReturn ? ctx.reactionRules.stack.counterReturnMaxDepth : ctx.reactionRules.stack.maxDepth;
  group.reactionAnswered ||= [];
  for (const id of ids) {
    const row = rowFor(ctx, group, id);
    if (!row || !row.contacts.some(positive) || group.reactionAnswered.includes(id)) continue;
    const seat = ctx.players?.get(id);
    const entity = seat?.entity || ctx.player;
    const depth = (stack?.entries || []).filter(entry => entry.ownerId === id).length;
    if (!open || depth >= cap || !entity.alive || entity.reactionsEnabled === false || (seat && !seat.connected)) {
      if (open && depth < cap && entity.reactionsEnabled === false && seatPresent(ctx, id)) reportUnavailable(ctx, group, id, row, 'switchOff', {}, hooks);
      group.reactionAnswered.push(id); continue;
    }
    const previous = ctx.playerKey;
    hooks.setOwner?.(ctx, id);
    const refusal = {};
    const options = optionsFor(ctx, row, group, hooks, refusal);
    hooks.setOwner?.(ctx, previous);
    if (!options.length) {
      if (!depth) {
        const { reason = 'other', ...extra } = refusal;
        reportUnavailable(ctx, group, id, row, reason, extra, hooks);
      }
      group.reactionAnswered.push(id); continue;
    }
    ctx.pendingReaction = { id: `${group.key}:${id}:${depth}`, groupKey: group.key, ownerId: id,
      sourceId: group.sourceId, options };
    ctx.emit('combatReactionOffered', { offerId: ctx.pendingReaction.id, ownerId: id, sourceId: group.sourceId });
    return true;
  }
  return stack?.entries.length ? resolveReactionStack(ctx, hooks) : false;
}

// Resolves the committed stack top first; returns true while a paid entry's own choice
// pauses it. The remaining entries stay on the stack and resume when restoreReactionQueue
// hands the paused action back, through the same beforeReactionAction call.
export function resolveReactionStack(ctx, hooks) {
  const stack = ctx.reactionStack;
  if (!stack?.entries.length) return false;
  const group = ctx.queue.find(action => action.meta?.expansionGroup?.key === stack.groupKey)?.meta.expansionGroup;
  if (!group) throw new Error('The reaction stack has no incoming action');
  stack.resolving = true;
  while (stack.entries.length) {
    const entry = stack.entries[stack.entries.length - 1];
    if (entry.side !== 'player') throw new Error('Enemy reactions are not implemented');
    stack.entries.pop();
    if (playStackEntry(ctx, group, entry, hooks)) return true;
  }
  delete ctx.reactionStack;
  return false;
}

// One entry under today's single-reaction mechanics. An entry whose card has left the hand,
// or whose play is refused, fizzles and pays nothing. Returns true when it paused.
function playStackEntry(ctx, group, entry, hooks) {
  const { ownerId, play } = entry;
  hooks.setOwner?.(ctx, ownerId);
  const hand = (ctx.players ? ctx.players.get(ownerId)?.piles.hand : ctx.piles.hand) || [];
  if (!hand.some(inst => inst.instanceId === play.cardInstanceId)) {
    ctx.emit('combatReactionFizzled', { ownerId, cardInstanceId: play.cardInstanceId, reason: 'notInHand' });
    reportRestOfRoot(ctx, group, ownerId, hooks);
    return false;
  }
  ctx.reactionResume = { queue: ctx.queue, foundation: ctx.foundation ? {
    actionSerial: ctx.foundation.actionSerial, eventCount: ctx.foundation.eventCount,
    rolls: ctx.foundation.rolls, counts: ctx.foundation.counts } : null };
  ctx.queue = [];
  if (ctx.foundation) {
    ctx.foundation.actionSerial = Math.max(ctx.foundation.actionSerial, ctx.foundationNextSerial || 0) + 1;
    ctx.foundationNextSerial = ctx.foundation.actionSerial;
    ctx.foundation.eventCount = 0; ctx.foundation.rolls = {}; ctx.foundation.counts = {};
  }
  ctx._reactionPlaying = true;
  ctx._reactionSourceId = group.sourceId;
  let refusal = null;
  try { hooks.play(ctx, { ...play }); }
  catch (error) { if (!error?.playRefusal) throw error; refusal = error.playRefusal; }
  finally { delete ctx._reactionPlaying; delete ctx._reactionSourceId; }
  if (refusal) {
    restoreReactionQueue(ctx);
    ctx.emit('combatReactionFizzled', { ownerId, cardInstanceId: play.cardInstanceId, reason: refusal.reason || 'other' });
    reportRestOfRoot(ctx, group, ownerId, hooks);
    return false;
  }
  if (ctx.player.combatCounter && play.cardInstanceId === ctx.player.combatCounter.carrier?.instanceId) {
    (group.manualCounterSerials ||= {})[ownerId] = ctx.player.combatCounter.serial;
  }
  reportRestOfRoot(ctx, group, ownerId, hooks);
  return !restoreReactionQueue(ctx);
}

export function finishReactions(ctx) {
  for (const field of ['reactionCursor', 'pendingReaction', 'reactionResume', 'reactionHandCleanup', 'reactionStack']) delete ctx[field];
  for (const seat of ctx.players?.values() || []) delete seat.reactionHandCleanup;
  ctx.pendingExpansionActions = 0;
  ctx.queue.length = 0;
}

export function answerReaction(ctx, ownerId, { offerId, optionId = null }, hooks) {
  const pending = ctx.pendingReaction;
  if (!pending || pending.id !== offerId || pending.ownerId !== ownerId) throw new Error('This reaction choice is unavailable');
  const group = ctx.queue.find(action => action.meta?.expansionGroup?.key === pending.groupKey)?.meta.expansionGroup;
  if (!group || group.begun) throw new Error('The incoming action has already resolved');
  let option = optionId === null ? null : pending.options.find(row => row.id === optionId);
  if (optionId !== null && !option) throw new Error('Choose an available reaction card');
  hooks.setOwner?.(ctx, ownerId);
  if (option) {
    const row = Object.values(group.targets).find(target => ctx.players ? target.playerId === ownerId : target.id === ctx.player.id);
    const canonical = optionsFor(ctx, row, group, hooks).find(current => current.id === optionId);
    if (!canonical || JSON.stringify(canonical.play) !== JSON.stringify(option.play)
      || canonical.cardId !== option.cardId || canonical.staminaCost !== option.staminaCost
      || canonical.manaCost !== option.manaCost) throw new Error('That reaction card is no longer playable');
    option = canonical;
  }
  if (option && stackedReactions(ctx)) {
    const instance = (ctx.players ? ctx.players.get(ownerId)?.piles.hand : ctx.piles.hand)?.find(inst => inst.instanceId === option.play.cardInstanceId);
    const def = resolveCombatCard(ctx, instance);
    const stack = ctx.reactionStack ||= { groupKey: group.key, entries: [], resolving: false };
    stack.entries.push({ side: 'player', ownerId, optionId: option.id, play: option.play, cardId: option.cardId,
      cardInstanceId: option.play.cardInstanceId, maneuver: (def.cardTags || def.tags || []).includes('maneuver:counter') ? 'counter' : null });
    delete ctx.pendingReaction;
    const depth = stack.entries.filter(entry => entry.ownerId === ownerId).length;
    ctx.emit('combatReactionChosen', { offerId, ownerId, cardInstanceId: option.play.cardInstanceId });
    ctx.emit('combatReactionStacked', { offerId, ownerId, cardInstanceId: option.play.cardInstanceId, depth });
    return;
  }
  group.reactionAnswered.push(ownerId);
  delete ctx.pendingReaction;
  ctx.emit('combatReactionChosen', { offerId, ownerId, cardInstanceId: option?.play.cardInstanceId || null });
  if (!option) { reportRestOfRoot(ctx, group, ownerId, hooks); return; }
  ctx.reactionResume = { queue: ctx.queue, foundation: ctx.foundation ? {
    actionSerial: ctx.foundation.actionSerial, eventCount: ctx.foundation.eventCount,
    rolls: ctx.foundation.rolls, counts: ctx.foundation.counts } : null };
  ctx.queue = [];
  if (ctx.foundation) {
    ctx.foundation.actionSerial = Math.max(ctx.foundation.actionSerial, ctx.foundationNextSerial || 0) + 1;
    ctx.foundationNextSerial = ctx.foundation.actionSerial;
    ctx.foundation.eventCount = 0; ctx.foundation.rolls = {}; ctx.foundation.counts = {};
  }
  ctx._reactionPlaying = true;
  try { hooks.play(ctx, option.play); }
  finally { delete ctx._reactionPlaying; }
  if (ctx.player.combatCounter && option.play.cardInstanceId === ctx.player.combatCounter.carrier?.instanceId) {
    (group.manualCounterSerials ||= {})[ownerId] = ctx.player.combatCounter.serial;
  }
  restoreReactionQueue(ctx);
  reportRestOfRoot(ctx, group, ownerId, hooks);
}

// The one offer covers the whole root: when it has further hits (in this action or
// later ones), the answering seat hears once that the rest can't be answered.
// A reaction that killed, staggered or locked the attacker cancels the rest, so
// there is nothing left to explain (Codex on #1849).
function reportRestOfRoot(ctx, group, ownerId, hooks) {
  const row = rowFor(ctx, group, ownerId);
  if (!row || row.contacts.filter(positive).length < 2 || !seatPresent(ctx, ownerId)) return;
  const source = (ctx.enemies || []).find(enemy => enemy.id === group.sourceId);
  if (source && (!source.alive || source.skipNextTurn || controlRestrictions(ctx, source).locked)) return;
  reportUnavailable(ctx, group, ownerId, row, 'alreadyAnswered', {}, hooks);
}

export function restoreReactionQueue(ctx) {
  if (!ctx.reactionResume || ctx.pendingAbilityDiscard || ctx.pendingAbilityPlay) return;
  const saved = ctx.reactionResume;
  ctx.queue.push(...saved.queue);
  if (ctx.foundation && saved.foundation) Object.assign(ctx.foundation, saved.foundation);
  delete ctx.reactionResume;
  return true;
}

export function revealActor(ctx, enemy) {
  enemy.actorIntentRevealed = true;
  ctx.emit('enemyActorTurnStarted', { sourceId: enemy.id, enemyId: enemy.enemyId,
    moveId: enemy.pendingMove?.moveId || enemy.intent?.moveId, intent: structuredClone(enemy.intent) });
}

export function startQueuedEnemy(ctx, action) {
  const group = action.meta?.expansionGroup;
  if (!group || group.payloadStarted || (!group.enemyMoveStart && !group.counterReturn)) return;
  group.payloadStarted = true;
  const enemy = action.source;
  group.cancelled = !enemy?.alive || enemy.skipNextTurn || controlRestrictions(ctx, enemy).locked;
  if (group.cancelled) return;
  if (group.counterReturn) { ctx.emit('combatCounterTriggered', group.counterReturn); return; }
  (enemy.performedMoves ||= []).push(group.enemyMoveStart.moveId);
  ctx.emit('enemyMoveStarted', group.enemyMoveStart);
}
