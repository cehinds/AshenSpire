import { handDrawCount, handRow, scaledCards } from '../model/handRules.js';
import { resolveCard } from '../model/registries.js';
import { orderedReturn } from '../model/deckRules.js';

/** Return only ordinary unplayed cards; played/forced discards stay discarded. */
export function returnUnplayedCards(ctx, cards) {
  if (ctx.handRules?.shuffleHand) {
    refreshHandIntoDraw(ctx, cards);
    return;
  }
  for (const card of cards) {
    ctx.piles.discard.push(card);
    ctx.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'turnEnd' });
  }
}

// The turn-end refresh (shuffleHand). When the draw pile holds fewer cards than
// the next turn will draw, the discard joins the returned cards in this same
// shuffle, so a held hand cannot starve the discard of its reshuffle.
function refreshHandIntoDraw(ctx, cards) {
  const next = handDrawCount(ctx.handRules, ctx.attributes, { handSize: ctx.piles.hand.length, replacements: ctx.pendingDiscardDraw || 0, level: ctx.characterLevel }).value;
  const joins = ctx.handRules.reshuffle !== false && ctx.piles.discard.length > 0 && ctx.piles.draw.length < next;
  if (!cards.length && !joins) return;
  const moved = joins ? [...cards, ...ctx.piles.discard] : cards;
  if (joins) ctx.piles.discard.length = 0;
  // The explicit Play in deck order mode keeps its no-randomness contract.
  ctx.piles.draw.push(...(ctx.orderedDraw ? orderedReturn(moved, ctx.orderedDraw.order) : moved));
  if (!ctx.orderedDraw) ctx.piles.draw = ctx.rng.shuffle('shuffle', ctx.piles.draw);
  ctx.emit('deckShuffled', {
    size: ctx.piles.draw.length, reason: 'handRefresh',
    cardInstanceIds: moved.map(card => card.instanceId),
    ...(ctx.orderedDraw ? { ordered: true } : {}),
    ...(joins ? { reshuffledDiscard: true } : {}),
  });
}

export function turnDrawCount(ctx, opening = ctx.turn === 1) {
  const rules = ctx.handRules;
  if (!rules) return ctx.drawPerTurn ?? ctx.player.drawPerTurn;
  const draw = handDrawCount(rules, ctx.attributes, { handSize: ctx.piles.hand.length, opening, replacements: ctx.pendingDiscardDraw || 0, level: ctx.characterLevel });
  ctx.handMax = draw.capacity;
  ctx.pendingDiscardDraw = 0;
  return draw.value;
}

export function endTurnCardFate(ctx, card) {
  if (ctx.combatExpansionVersion === 2 && ctx.player.combatRetainedCards?.includes(card.instanceId)) return 'keep';
  const def = resolveCard(ctx.registries, card);
  const fate = ctx.foundation && def.effects.some(e => e.op === 'dodgeRoll') ? 'keep' : ctx.registries.framework.endTurnFate(def);
  return fate === 'discard' && ctx.handRules?.retain ? 'keep' : fate;
}

export function discardChoicePlan(ctx) {
  if (!ctx.handRules) return { cards: [], minimum: 0, maximum: 0, prompt: false };
  const cards = ctx.piles.hand.filter(card => endTurnCardFate(ctx, card) === 'keep');
  const capacity = scaledCards(handRow(ctx.handRules, 'handSize'), ctx.attributes, ctx.characterLevel);
  const minimum = ctx.handRules.overflow === 'discard' ? Math.max(0, cards.length - capacity) : 0;
  const optional = ctx.handRules.retain && ctx.handRules.promptDiscard;
  // A kept hand that already fills capacity draws nothing next turn, so the
  // prompt offers a free discard of any number; the next draw refills the room.
  const full = cards.length > 0 && cards.length >= capacity;
  const maximum = full ? cards.length : Math.min(cards.length, Math.max(minimum, optional ? ctx.handRules.discardLimit : 0));
  return { cards, minimum, maximum, prompt: minimum > 0 || full || (optional && maximum > 0) };
}

export function validateDiscardChoice(ctx, ids = []) {
  const plan = discardChoicePlan(ctx);
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !plan.cards.some(c => c.instanceId === id)) || ids.length > plan.maximum || ids.length < plan.minimum) {
    throw new Error(`Select ${plan.minimum}–${plan.maximum} eligible cards to discard.`);
  }
  return ids;
}

export function applyDiscardChoice(ctx, ids) {
  let discarded = 0;
  for (const id of ids) {
    const index = ctx.piles.hand.findIndex(c => c.instanceId === id);
    if (index < 0) continue;
    const card = ctx.piles.hand[index];
    // Turn-end hooks and Ethereal remain authoritative.
    if (endTurnCardFate(ctx, card) !== 'keep') continue;
    ctx.piles.hand.splice(index, 1);
    ctx.piles.discard.push(card);
    ctx.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'choice' });
    discarded++;
  }
  ctx.pendingDiscardDraw = ctx.handRules?.replaceDiscards ? discarded : 0;
}
