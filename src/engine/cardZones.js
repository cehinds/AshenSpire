// Validated card-zone operations. Choices pause the ordinary paid-action queue;
// they never invoke a second interpreter or let the UI mutate combat piles.
export const CARD_ZONES = Object.freeze(['draw', 'hand', 'discard', 'exhaust']);
export function hasCardChoice(ctx) { return !!(ctx.pendingAbilityDiscard || ctx.pendingCardChoice); }
function stacked(ctx) {
  return new Set((ctx.reactionStack?.entries || []).filter(e => e.side === 'player' && e.ownerId === (ctx.playerKey || 'player')).map(e => e.play?.cardInstanceId));
}
export function zoneCandidates(ctx, effect) {
  const pile = ctx.piles[effect.from];
  if (!Array.isArray(pile)) throw new Error('Unknown card source zone');
  const excluded = stacked(ctx);
  return pile.filter(c => !excluded.has(c.instanceId)).slice(0, effect.look ?? pile.length);
}
export function validateZoneEffect(effect) {
  if (!CARD_ZONES.includes(effect.from) || !CARD_ZONES.includes(effect.to)) throw new Error('Unknown card zone');
  if (!['first', 'random', 'choose'].includes(effect.selection || 'first')) throw new Error('Unknown card selection');
  if (!['top', 'bottom', 'random'].includes(effect.position || 'bottom')) throw new Error('Unknown card destination position');
  if (effect.look !== undefined && (!Number.isSafeInteger(effect.look) || effect.look < 1 || effect.look > 100)) throw new Error('Card look must be 1–100');
}
function applyMove(ctx, effect, ids) {
  const source = ctx.piles[effect.from], destination = ctx.piles[effect.to];
  const cards = ids.map(id => source.find(c => c.instanceId === id));
  for (const card of cards) source.splice(source.indexOf(card), 1);
  for (const card of cards) {
    if (effect.transformTo) {
      ctx.registries.cards.get(effect.transformTo);
      card.cardId = effect.transformTo; card.upgraded = false;
    }
  }
  if ((effect.position || 'bottom') === 'top') destination.unshift(...cards);
  else for (const card of cards) {
    if (effect.to === 'hand' && destination.length >= ctx.handMax) ctx.piles.discard.push(card);
    else if (effect.position === 'random') destination.splice(Math.floor(ctx.rng.float('shuffle') * (destination.length + 1)), 0, card);
    else destination.push(card);
  }
  for (const card of cards) ctx.emit(effect.to === 'exhaust' ? 'cardExhausted' : effect.to === 'discard' ? 'cardDiscarded' : 'cardMoved', {
    cardInstanceId: card.instanceId, cardId: card.cardId, from: effect.from, to: effect.to, reason: 'chosen', explicit: true,
    sourceId: ctx.player.id, ...(ctx.playerKey ? { sourcePlayerId: ctx.playerKey, playerId: ctx.playerKey } : {}),
  });
}
export function moveCards(ctx, action, amount) {
  const effect = action.effect;
  validateZoneEffect(effect);
  if (effect.transformTo) ctx.registries.cards.get(effect.transformTo);
  const candidates = zoneCandidates(ctx, effect), count = Math.min(candidates.length, Math.max(0, Math.floor(amount)));
  if (!count) return;
  if (effect.selection === 'choose') {
    if (!ctx.pendingAbilityPlay) throw new Error('Card selection requires a resolving card');
    ctx.pendingCardChoice = { kind: 'moveCards', count, effect: structuredClone(effect), candidateIds: candidates.map(c => c.instanceId), playerId: ctx.playerKey || null, cardId: ctx.pendingAbilityPlay.instance.cardId };
    return;
  }
  const ordered = effect.selection === 'random' ? ctx.rng.shuffle('shuffle', candidates) : candidates;
  applyMove(ctx, effect, ordered.slice(0, count).map(c => c.instanceId));
}
export function chooseZoneCards(ctx, ids) {
  const pending = ctx.pendingCardChoice;
  if (!pending) throw new Error('No card-zone choice is pending');
  const valid = new Set(zoneCandidates(ctx, pending.effect).map(c => c.instanceId));
  if (!Array.isArray(ids) || ids.length !== pending.count || new Set(ids).size !== ids.length || ids.some(id => !pending.candidateIds.includes(id) || !valid.has(id))) throw new Error(`Choose exactly ${pending.count} distinct eligible cards`);
  applyMove(ctx, pending.effect, ids);
  delete ctx.pendingCardChoice;
}
