// SPEC 4.10: choices pause a committed contact plan before defense begins.
// Callbacks are supplied by the solo/co-op command door, never saved in state.
import { candidateState } from './combatRules.js';
import { resolveCombatCard } from './combatExpansion.js';
import { counterCoverageMatches } from './combatMatchups.js';
import { cardChoice } from '../model/cardChoices.js';
import { upcastOptions } from '../model/upcasting.js';
import { controlRestrictions } from './combatStatusControl.js';
import { cardTargetPlan } from '../model/cardTargets.js';
import { fightReacts, incomingAgainst, openEnemyWindow, playerRootSeat, runEnemyPlan, seatGone } from './enemyReactions.js';

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

// A Counter (a card whose resolved maneuver is counter) answers an attack its coverage reaches (SPEC §4.10).
// Shared by the live offer and the Combat Rounds Preview's offer (SPEC §4.11), so both answer the same attacks.
export function counterCoversAttack(ctx, def, profile, effect = 'damage') {
  const tags = def.cardTags || def.tags || [];
  if (!tags.includes('maneuver:counter')) return false;
  const coverage = def.counterCoverage || ctx.combatExpansionRules.matchups.counter.defaultCoverage[
    tags.includes('counter:spell') ? 'spell' : tags.includes('counter:ranged') ? 'ranged' : 'melee'];
  return counterCoverageMatches(coverage, profile, effect);
}

const counterCovered = (ctx, def, row) => row.contacts.some(contact =>
  counterCoversAttack(ctx, def, contact, contact.effect || 'damage'));

// Version 2: a `trait:reaction` card is eligible by tag (a Counter still needs coverage,
// anything else a positive contact). Untagged cards keep the version 1 rule until the
// trait projection tags them.
function eligible(ctx, def, row) {
  const tags = def.cardTags || def.tags || [];
  if (cardTraitsActive(ctx) && tags.includes('trait:reaction')) {
    return tags.includes('maneuver:counter') ? counterCovered(ctx, def, row) : row.contacts.some(positive);
  }
  if (tags.includes('maneuver:counter')) return counterCovered(ctx, def, row);
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
  if (hit.range === 'reach' || hit.range === 'ranged') return 'ranged';
  return 'attack';
}

function candidateCardIds(ctx, row) {
  const ids = [];
  for (const inst of handOf(ctx, row)) {
    if (candidateByManeuver(ctx, resolveCombatCard(ctx, inst)) && !ids.includes(inst.cardId)) ids.push(inst.cardId);
  }
  return ids;
}

// The rows a seat answers on this root, as { enemyId, row }: each enemy entry's committed
// plan row against the seat (top of the stack first), then the root's own row on an enemy
// root. Without enemy entries this is the root row alone, as before.
function planRowFor(ctx, entry, seat) {
  return Object.values(entry.plan?.group?.targets || {}).find(target => ctx.players ? target.playerId === seat : target.id === ctx.player.id) || null;
}
function threatsFor(ctx, row, group, entries, seat) {
  const threats = [];
  for (const entry of [...entries].reverse()) {
    if (entry.side !== 'enemy' || entry.targetPlayerId !== seat) continue;
    const planRow = planRowFor(ctx, entry, seat);
    if (planRow?.contacts.some(positive)) threats.push({ enemyId: entry.ownerId, row: planRow });
  }
  if (row && !playerRootSeat(ctx, group) && (!threats.length || row.contacts.some(positive))) threats.push({ enemyId: group.sourceId, row });
  return threats;
}

function optionsFor(ctx, row, group, hooks, refusal = null, seatId = null) {
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
  const seat = seatId || (ctx.players ? row.playerId : 'player');
  const counterStacked = entries.some(entry => entry.side === 'player' && entry.ownerId === seat && entry.maneuver === 'counter');
  // Enemy entries on the stack: the seat answers each one's plan (and an enemy root's own
  // row); an enemy-targeted card gets one option per answered enemy, top of the stack first.
  const enemyEntries = entries.some(entry => entry.side === 'enemy');
  const threats = threatsFor(ctx, row, group, entries, seat);
  // A pushed card's contacts against each enemy decide the playerReaction window.
  const captureIncoming = fightReacts(ctx, 'playerReaction');
  const players = ctx.players ? [...ctx.players.values()].map(row => ({ id: row.id, alive: row.entity.alive, connected: row.connected }))
    : [{ id: ctx.player.id, alive: true, connected: true }];
  for (inst of ctx.players ? ctx.players.get(seat)?.piles.hand || [] : ctx.piles.hand || []) {
    // Instance ids are unique per seat only (co-op runs each start at rc1), so match the owner too.
    if (entries.some(entry => entry.side === 'player' && entry.ownerId === seat && entry.play?.cardInstanceId === inst.instanceId)) continue;
    const base = resolveCombatCard(ctx, inst);
    if (counterStacked && (base.cardTags || base.tags || []).includes('maneuver:counter')) continue;
    const answered = threats.filter(threat => eligible(ctx, base, threat.row));
    if (!answered.length) { if (candidateByManeuver(ctx, base)) note('notCovered'); continue; }
    const choices = cardChoice(ctx.registries, base, ctx.player.classId)?.options || [null];
    const aimed = cardTargetPlan(base, seat, ctx.enemies, players, { solo: !ctx.players }).mode === 'enemy';
    const aims = aimed ? [...new Set(answered.map(threat => threat.enemyId))] : [answered[0].enemyId];
    for (const aim of aims) for (const tier of [0, ...upcastOptions(base).map(option => option.ranks)]) for (const choice of choices) {
      const candidate = candidateState(ctx);
      candidate.queue = []; delete candidate.pendingReaction; delete candidate.reactionResume;
      candidate._reactionPlaying = true; candidate._buffer = null;
      candidate._reactionSourceId = aim;
      candidate.pendingExpansionActions = 0;
      if (candidate.foundation) { candidate.foundation.eventCount = 0; candidate.foundation.rolls = {}; candidate.foundation.counts = {}; }
      hooks.setOwner?.(candidate, seat);
      const play = { cardInstanceId: inst.instanceId, ...(aimed ? { targetId: aim } : {}),
        ...(choice ? { choice: choice.id } : {}), ...(tier ? { upcastTier: tier } : {}) };
      try {
        const paymentStart = candidate.eventLog.length;
        if (captureIncoming) candidate._groupSink = [];
        hooks.play(candidate, play);
        const planned = candidate._groupSink?.find(row => row.carrier?.instanceId === inst.instanceId);
        delete candidate._groupSink;
        const paid = candidate.eventLog.slice(paymentStart).find(event => event.type === 'cardPlayed');
        if (!paid || !candidate.player.alive) { note('other'); continue; }
        // The stacked entries resolve after this option, last pushed first; all must play.
        // An enemy entry runs its committed plan; one that fizzles is a valid outcome.
        for (const entry of [...entries].reverse()) {
          // Once the root has ended the rest fizzle and pay nothing, so the option stands.
          if (rootEnded(candidate, group)) break;
          if (entry.side === 'enemy') { runEnemyPlan(candidate, structuredClone(entry), hooks); continue; }
          hooks.setOwner?.(candidate, entry.ownerId);
          const start = candidate.eventLog.length;
          hooks.play(candidate, { ...entry.play });
          if (!candidate.eventLog.slice(start).some(event => event.type === 'cardPlayed')) throw new Error('Stacked reaction did not play');
        }
        const incoming = {};
        if (captureIncoming) for (const enemy of ctx.enemies) {
          const amount = incomingAgainst(planned, enemy.id);
          if (amount > 0) incoming[enemy.id] = amount;
        }
        options.push({ id: `${inst.instanceId}:${tier}:${choice?.id || 'default'}${aimed && enemyEntries ? `:${aim}` : ''}`, name: base.name,
          cardId: inst.cardId, play, staminaCost: paid.staminaSpent ?? paid.energySpent ?? 0,
          manaCost: paid.manaSpent || 0, choiceName: choice?.label || choice?.name || null,
          ...(captureIncoming ? { incoming } : {}), ...(enemyEntries ? { sourceId: aim } : {}) });
      } catch (error) {
        // Ineligible under the normal card/payment/control rules; the refusal names why.
        const { reason, ...extra } = error?.playRefusal || {};
        note(REASON_RANK[reason] === undefined ? 'other' : reason, extra);
      } finally {
        // Counterstrike reads the incoming attacker of this root, as resolution does.
        delete candidate._reactionSourceId;
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

// Version 2 root ended: the attacker is dead, or (a player-sourced root) its acting seat is
// dead or disconnected. Every entry still stacked then fizzles.
function rootEnded(ctx, group) {
  const source = (ctx.enemies || []).find(enemy => enemy.id === group.sourceId);
  if (source) return !source.alive;
  const acting = playerRootSeat(ctx, group);
  if (acting) return seatGone(ctx, acting);
  const seat = group.sourcePlayerId ? ctx.players?.get(group.sourcePlayerId) : null;
  return !!seat && (!seat.entity?.alive || seat.connected !== true);
}

// Enemy reactions: a player-card root whose acting seat is dead or gone once its stack
// has resolved is cancelled, and none of its actions run.
function cancelEndedPlayerRoot(ctx, group) {
  const acting = playerRootSeat(ctx, group);
  if (acting && seatGone(ctx, acting)) group.cancelled = true;
  restoreRootPlay(ctx);
}

const rowFor = (ctx, group, id) =>Object.values(group.targets).find(target => ctx.players ? target.playerId === id : target.id === ctx.player.id);
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
  if (!group || group.carrier?.reactionDepth) return false;
  if (action.source?.kind !== 'enemy') return !group.begun && action.source?.kind === 'player' && beforePlayerRoot(ctx, group, hooks);
  // Combat Rounds (SPEC §4.11): an enemy move resolving a timeline entry had its reaction point in the round prompt,
  // answered or not, so the live window never opens for it (one prompt per attack).
  if (group.roundSettled) return false;
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
  return offerSeats(ctx, group, ids, hooks, open);
}

// Enemy reactions, playerAction window: before a player card's root group begins, the
// enemies it hits decide in roster order. If any pushed, only the acting seat is offered
// (against every enemy entry), alternating with playerReaction windows; then the stack
// resolves and the root runs, or is cancelled when its seat is gone.
function beforePlayerRoot(ctx, group, hooks) {
  if (!stackedReactions(ctx) || !fightReacts(ctx)) return false;
  const acting = playerRootSeat(ctx, group);
  if (!acting || group.carrier?.combatReaction || group.counterReturn) return false;
  if (!stackOf(ctx, group)) {
    // A stack whose last entry paused for its own choice has emptied: the root resumes.
    if (group.enemyWindows !== undefined) { if (!ctx.reactionStack) restoreRootPlay(ctx); return false; }
    if (ctx.reactionStack || seatGone(ctx, acting)) return false;
    openEnemyWindow(ctx, group, 'playerAction', null, hooks);
    if (!stackOf(ctx, group)) return false;
  }
  return offerSeats(ctx, group, [acting], hooks, !seatGone(ctx, acting));
}

// Each seat in `ids`, in order, is offered again after every card it pushes, until it
// passes, has no option left or reaches the depth cap. Then the stack resolves.
function offerSeats(ctx, group, ids, hooks, open) {
  const stack = stackOf(ctx, group);
  const playerRoot = !!playerRootSeat(ctx, group);
  const cap = group.counterReturn ? ctx.reactionRules.stack.counterReturnMaxDepth : ctx.reactionRules.stack.maxDepth;
  group.reactionAnswered ||= [];
  for (const id of ids) {
    const row = playerRoot ? null : rowFor(ctx, group, id);
    const enemyRows = (stack?.entries || []).filter(entry => entry.side === 'enemy' && entry.targetPlayerId === id
      && planRowFor(ctx, entry, id)?.contacts.some(positive));
    if ((!row || !row.contacts.some(positive)) && !enemyRows.length) continue;
    if (group.reactionAnswered.includes(id)) continue;
    const seat = ctx.players?.get(id);
    const entity = seat?.entity || ctx.player;
    const depth = (stack?.entries || []).filter(entry => entry.side === 'player' && entry.ownerId === id).length;
    if (!open || depth >= cap || !entity.alive || entity.reactionsEnabled === false || (seat && !seat.connected)) {
      if (row && open && depth < cap && entity.reactionsEnabled === false && seatPresent(ctx, id)) reportUnavailable(ctx, group, id, row, 'switchOff', {}, hooks);
      group.reactionAnswered.push(id); continue;
    }
    const previous = ctx.playerKey;
    hooks.setOwner?.(ctx, id);
    const refusal = {};
    const options = optionsFor(ctx, row, group, hooks, refusal, id);
    hooks.setOwner?.(ctx, previous);
    if (!options.length) {
      if (!depth && row) {
        const { reason = 'other', ...extra } = refusal;
        reportUnavailable(ctx, group, id, row, reason, extra, hooks);
      }
      group.reactionAnswered.push(id); continue;
    }
    // A player-card root has no enemy attacker; the offer names the top enemy entry.
    const sourceId = playerRoot ? enemyRows.at(-1).ownerId : group.sourceId;
    ctx.pendingReaction = { id: `${group.key}:${id}:${depth}`, groupKey: group.key, ownerId: id,
      sourceId, options };
    ctx.emit('combatReactionOffered', { offerId: ctx.pendingReaction.id, ownerId: id, sourceId });
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
    // Checked after every resolved entry: a root that has ended fizzles what is left.
    if (rootEnded(ctx, group)) {
      while (stack.entries.length) {
        const entry = stack.entries.pop();
        if (entry.side === 'enemy') { ctx.emit('combatReactionFizzled', enemyFizzle(entry, 'rootEnded')); continue; }
        hooks.setOwner?.(ctx, entry.ownerId);
        ctx.emit('combatReactionFizzled', { ownerId: entry.ownerId, cardInstanceId: entry.play.cardInstanceId, reason: 'rootEnded' });
      }
      delete ctx.reactionStack;
      cancelEndedPlayerRoot(ctx, group);
      return false;
    }
    const entry = stack.entries.pop();
    if (entry.side === 'enemy') {
      // Its committed plan, exactly as committed; it pays nothing and fizzles when its
      // enemy is halted or its target seat is gone.
      const halted = runEnemyPlan(ctx, entry, hooks);
      if (halted) ctx.emit('combatReactionFizzled', enemyFizzle(entry, halted));
      if (ctx.result) { delete ctx.reactionStack; return false; }
      continue;
    }
    if (playStackEntry(ctx, group, entry, hooks)) {
      if (!stack.entries.length) delete ctx.reactionStack;
      return true;
    }
  }
  delete ctx.reactionStack;
  cancelEndedPlayerRoot(ctx, group);
  return false;
}

const enemyFizzle = (entry, reason) => ({ side: 'enemy', ownerId: entry.ownerId, enemyId: entry.enemyId, moveId: entry.moveId,
  targetPlayerId: entry.targetPlayerId, reason });

// One entry under today's single-reaction mechanics. An entry whose card has left the hand,
// or whose play is refused, fizzles and pays nothing. Returns true when it paused.
function playStackEntry(ctx, group, entry, hooks) {
  const { ownerId, play } = entry;
  hooks.setOwner?.(ctx, ownerId);
  // A seat that died or disconnected after committing pays nothing and plays nothing.
  if (!seatPresent(ctx, ownerId)) {
    ctx.emit('combatReactionFizzled', { ownerId, cardInstanceId: play.cardInstanceId, reason: 'ownerGone' });
    return false;
  }
  const hand = (ctx.players ? ctx.players.get(ownerId)?.piles.hand : ctx.piles.hand) || [];
  const instance = hand.find(inst => inst.instanceId === play.cardInstanceId);
  if (!instance) {
    ctx.emit('combatReactionFizzled', { ownerId, cardInstanceId: play.cardInstanceId, reason: 'notInHand' });
    reportRestOfRoot(ctx, group, ownerId, hooks);
    return false;
  }
  // One Counter per seat per stack, read from the card itself rather than the saved entry.
  const resolvedDef = resolveCombatCard(ctx, instance);
  if ((resolvedDef.cardTags || resolvedDef.tags || []).includes('maneuver:counter') && ctx.reactionStack) {
    const seats = ctx.reactionStack.counterSeats ||= [];
    if (seats.includes(ownerId)) {
      ctx.emit('combatReactionFizzled', { ownerId, cardInstanceId: play.cardInstanceId, reason: 'secondCounter' });
      reportRestOfRoot(ctx, group, ownerId, hooks);
      return false;
    }
    seats.push(ownerId);
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
  ctx._reactionSourceId = entry.sourceId || group.sourceId;
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
    // A stacked Counter also answers the enemy entries still beneath it.
    for (const below of ctx.reactionStack?.entries || []) {
      if (below.side === 'enemy' && below.targetPlayerId === ownerId) (below.plan.group.manualCounterSerials ||= {})[ownerId] = ctx.player.combatCounter.serial;
    }
  }
  reportRestOfRoot(ctx, group, ownerId, hooks);
  return !restoreReactionQueue(ctx);
}

export function finishReactions(ctx) {
  for (const field of ['reactionCursor', 'pendingReaction', 'reactionResume', 'reactionHandCleanup', 'reactionStack', 'reactionRootPlay']) delete ctx[field];
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
    const row = playerRootSeat(ctx, group) ? null : Object.values(group.targets).find(target => ctx.players ? target.playerId === ownerId : target.id === ctx.player.id);
    const canonical = optionsFor(ctx, row, group, hooks, null, ownerId).find(current => current.id === optionId);
    if (!canonical || JSON.stringify(canonical.play) !== JSON.stringify(option.play)
      || canonical.cardId !== option.cardId || canonical.staminaCost !== option.staminaCost
      || canonical.manaCost !== option.manaCost) throw new Error('That reaction card is no longer playable');
    option = canonical;
  }
  if (option && stackedReactions(ctx)) {
    const instance = (ctx.players ? ctx.players.get(ownerId)?.piles.hand : ctx.piles.hand)?.find(inst => inst.instanceId === option.play.cardInstanceId);
    const def = resolveCombatCard(ctx, instance);
    const stack = ctx.reactionStack ||= { groupKey: group.key, entries: [], resolving: false };
    const entry = { side: 'player', ownerId, optionId: option.id, play: option.play, cardId: option.cardId,
      cardInstanceId: option.play.cardInstanceId, maneuver: (def.cardTags || def.tags || []).includes('maneuver:counter') ? 'counter' : null,
      ...(option.sourceId ? { sourceId: option.sourceId } : {}), ...(option.incoming ? { incoming: option.incoming } : {}) };
    stack.entries.push(entry);
    delete ctx.pendingReaction;
    const depth = stack.entries.filter(row => row.side === 'player' && row.ownerId === ownerId).length;
    ctx.emit('combatReactionChosen', { offerId, ownerId, cardInstanceId: option.play.cardInstanceId });
    ctx.emit('combatReactionStacked', { offerId, ownerId, cardInstanceId: option.play.cardInstanceId, depth });
    // Enemy reactions: the push opens a playerReaction window, then the seat is re-offered.
    openEnemyWindow(ctx, group, 'playerReaction', entry, hooks);
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
  if (playerRootSeat(ctx, group)) return;
  const row = rowFor(ctx, group, ownerId);
  if (!row || row.contacts.filter(positive).length < 2 || !seatPresent(ctx, ownerId)) return;
  const source = (ctx.enemies || []).find(enemy => enemy.id === group.sourceId);
  if (source && (!source.alive || source.skipNextTurn || controlRestrictions(ctx, source).locked)) return;
  reportUnavailable(ctx, group, ownerId, row, 'alreadyAnswered', {}, hooks);
}

// Enemy reactions: while a player-card root waits on its reaction window, the card that
// opened it stays unresolved (no cardResolved, no discard). Version 1 and Counter-return
// pauses have no player-card root, so they resolve the card as before.
export function deferRootPlay(ctx) {
  const pending = ctx.pendingReaction;
  if (!pending || !ctx.pendingAbilityPlay) return false;
  const group = ctx.queue.find(action => action.meta?.expansionGroup?.key === pending.groupKey)?.meta.expansionGroup;
  if (!playerRootSeat(ctx, group)) return false;
  ctx.reactionRootPlay = ctx.pendingAbilityPlay;
  delete ctx.pendingAbilityPlay;
  return true;
}

// Once the stack has resolved, the deferred card is the resolving play again, so its own
// root actions (a discard choice among them) run as they would have; the command door
// that resumed the root then completes it (cardResolved, discard).
function restoreRootPlay(ctx) {
  if (!ctx.reactionRootPlay || ctx.pendingAbilityPlay) return;
  ctx.pendingAbilityPlay = { ...ctx.reactionRootPlay, deferredRoot: true };
  delete ctx.reactionRootPlay;
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
