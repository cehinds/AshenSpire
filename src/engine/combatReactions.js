// SPEC 4.10: choices pause a committed contact plan before defense begins.
// Callbacks are supplied by the solo/co-op command door, never saved in state.
import { candidateState } from './combatRules.js';
import { resolveCombatCard } from './combatExpansion.js';
import { counterCoverageMatches } from './combatMatchups.js';
import { cardChoice } from '../model/cardChoices.js';
import { upcastOptions } from '../model/upcasting.js';
import { controlRestrictions } from './combatStatusControl.js';
import { cardTargetPlan } from '../model/cardTargets.js';

export const usesReactions = ctx => ctx.reactionRulesVersion === 1;
export const reactionPaused = ctx => !!(ctx.pendingReaction || ctx.reactionResume || ctx.pendingAbilityDiscard);

export function setReactionsEnabled(ctx, entity, enabled) {
  if (!usesReactions(ctx)) throw new Error('Optional reactions are unavailable in this saved combat');
  if (typeof enabled !== 'boolean') throw new Error('Reaction preference must be enabled or disabled');
  if (ctx.phase !== 'player' || reactionPaused(ctx)) throw new Error('Change reactions between actions on the player turn');
  entity.reactionsEnabled = enabled;
}

function eligible(ctx, def, row) {
  const tags = def.cardTags || def.tags || [];
  if (tags.includes('maneuver:counter')) return row.contacts.some(contact =>
    counterCoverageMatches(def.counterCoverage || ctx.combatExpansionRules.matchups.counter.defaultCoverage[
      tags.includes('counter:spell') ? 'spell' : tags.includes('counter:ranged') ? 'ranged' : 'melee'], contact, contact.effect || 'damage'));
  return tags.includes('maneuver:sweep') && def.defensiveReaction === true;
}

function optionsFor(ctx, row, group, hooks) {
  const options = [];
  const cards = ctx.players ? ctx.players.get(row.playerId)?.piles.hand : ctx.piles.hand;
  for (const inst of cards || []) {
    const base = resolveCombatCard(ctx, inst);
    if (!eligible(ctx, base, row)) continue;
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
        if (!paid || !candidate.player.alive) continue;
        options.push({ id: `${inst.instanceId}:${tier}:${choice?.id || 'default'}`, name: base.name,
          cardId: inst.cardId, play, staminaCost: paid.staminaSpent ?? paid.energySpent ?? 0,
          manaCost: paid.manaSpent || 0, choiceName: choice?.label || choice?.name || null });
      } catch { /* Ineligible under the normal card/payment/control rules. */ }
    }
  }
  return options;
}

export function beforeReactionAction(ctx, action, hooks) {
  if (!usesReactions(ctx) || ctx._reactionPlaying) return false;
  if (ctx.pendingReaction) return true;
  const group = action.meta?.expansionGroup;
  if (!group || group.begun || group.carrier?.reactionDepth || action.source?.kind !== 'enemy') return false;
  if (!action.source.alive || action.source.skipNextTurn || controlRestrictions(ctx, action.source).locked) return false;
  group.reactionAnswered ||= [];
  const ids = ctx.players ? ctx.order : ['player'];
  for (const id of ids) {
    const row = Object.values(group.targets).find(target => ctx.players ? target.playerId === id : target.id === ctx.player.id);
    if (!row || !row.contacts.some(contact => contact.amount > 0 || contact.pressure > 0) || group.reactionAnswered.includes(id)) continue;
    const seat = ctx.players?.get(id);
    const entity = seat?.entity || ctx.player;
    if (!entity.alive || entity.reactionsEnabled === false || (seat && !seat.connected)) { group.reactionAnswered.push(id); continue; }
    const previous = ctx.playerKey;
    hooks.setOwner?.(ctx, id);
    const options = optionsFor(ctx, row, group, hooks);
    hooks.setOwner?.(ctx, previous);
    if (!options.length) { group.reactionAnswered.push(id); continue; }
    ctx.pendingReaction = { id: `${group.key}:${id}`, groupKey: group.key, ownerId: id,
      sourceId: group.sourceId, options };
    ctx.emit('combatReactionOffered', { offerId: ctx.pendingReaction.id, ownerId: id, sourceId: group.sourceId });
    return true;
  }
  return false;
}

export function finishReactions(ctx) {
  for (const field of ['reactionCursor', 'pendingReaction', 'reactionResume', 'reactionHandCleanup']) delete ctx[field];
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
  group.reactionAnswered.push(ownerId);
  delete ctx.pendingReaction;
  ctx.emit('combatReactionChosen', { offerId, ownerId, cardInstanceId: option?.play.cardInstanceId || null });
  if (!option) return;
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
