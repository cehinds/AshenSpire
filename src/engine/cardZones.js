// Validated card-zone operations. Choices pause the ordinary paid-action queue;
// they never invoke a second interpreter or let the UI mutate combat piles.
import { CARD_ZONES, validateZoneEffect } from '../model/cardZoneRules.js';

export { CARD_ZONES, validateZoneEffect };
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
function applyMove(ctx, effect, ids) {
  if (effect.op === 'modifyCards') {
    for (const id of ids) {
      const card = ctx.piles[effect.from].find(c => c.instanceId === id);
      card.proposalChanges = {...card.proposalChanges,...effect.changes};
      if (effect.changes.retain) card.proposalChanges.retainUntilTurn=ctx.turn+(effect.changes.retainTurns || 1)-1;
      if (effect.changes.hideTurns) {
        ctx.hiddenCards ||= []; ctx.hiddenCards.push({card,playerId:ctx.playerKey || null,returnTurn:ctx.turn+effect.changes.hideTurns});
        ctx.piles[effect.from].splice(ctx.piles[effect.from].indexOf(card),1);
      }
      ctx.emit('cardModified',{cardInstanceId:id,cardId:card.cardId,changes:effect.changes});
    }
    return;
  }
  const source = ctx.piles[effect.from], destination = ctx.piles[effect.to];
  const cards = ids.map(id => source.find(c => c.instanceId === id));
  for (const card of cards) source.splice(source.indexOf(card), 1);
  for (const card of cards) {
    if (effect.transformTo) {
      ctx.registries.cards.get(effect.transformTo);
      card.cardId = effect.transformTo; card.upgraded = false;
    }
  }
  const moved=[];
  for (const card of cards) {
    const actualTo=effect.to==='hand' && destination.length>=ctx.handMax ? 'discard' : effect.to;
    const pile=ctx.piles[actualTo];
    if (effect.position === 'random') pile.splice(Math.floor(ctx.rng.float('shuffle') * (pile.length+1)),0,card);
    else if (effect.position==='top') { const prior=moved.filter(row=>row.to===actualTo).length; pile.splice(prior,0,card); }
    else pile.push(card);
    moved.push({card,to:actualTo});
  }
  for (const {card,to} of moved) ctx.emit(to === 'exhaust' ? 'cardExhausted' : to === 'discard' ? 'cardDiscarded' : 'cardMoved', {
    cardInstanceId: card.instanceId, cardId: card.cardId, from: effect.from, to, reason: to!==effect.to ? 'handFull' : 'chosen', explicit: true,
    sourceId: ctx.player.id, ...(ctx.playerKey ? { sourcePlayerId: ctx.playerKey, playerId: ctx.playerKey } : {}),
  });
}
export function moveCards(ctx, action, amount) {
  const effect = action.effect;
  validateZoneEffect(effect);
  if (effect.transformTo) ctx.registries.cards.get(effect.transformTo);
  const candidates = zoneCandidates(ctx, effect), count = Math.min(candidates.length, Math.min(100,Math.max(0, Math.floor(amount))));
  if (!count) return;
  if (effect.selection === 'choose') {
    if (!ctx.pendingAbilityPlay) throw new Error('Card selection requires a resolving card');
    ctx.pendingCardChoice = { kind: 'moveCards', count, effect: {...structuredClone(effect),amount:count}, candidateIds: candidates.map(c => c.instanceId), candidates:candidates.map(c=>({...c})), playerId: ctx.playerKey || null, cardId: ctx.pendingAbilityPlay.instance.cardId };
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

export function returnHiddenCards(ctx) {
  const remaining=[];
  for (const row of ctx.hiddenCards || []) if (row.returnTurn <= ctx.turn && (row.playerId || null)===(ctx.playerKey || null)) {
    (ctx.piles.hand.length < ctx.handMax ? ctx.piles.hand : ctx.piles.discard).push(row.card);
    ctx.emit('cardMoved',{cardInstanceId:row.card.instanceId,cardId:row.card.cardId,from:'hidden',to:'hand',reason:'returned'});
  } else remaining.push(row);
  if (ctx.hiddenCards) ctx.hiddenCards=remaining;
}

export function cardChoiceForSeat(ctx,playerId) {
 const pending=ctx.pendingCardChoice;
 return pending && pending.playerId===playerId ? structuredClone(pending) : null;
}
