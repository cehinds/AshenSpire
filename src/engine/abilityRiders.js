// Shared data-driven ability riders. State is per entity and bounded to a turn;
// it is saved with the combat entity, never reconstructed from a growing log.
import { ABILITY_TURN_METRICS } from '../model/schemas.js';
export const TURN_METRICS = ABILITY_TURN_METRICS;

function stateFor(entity) {
  return entity.abilityRiders || (entity.abilityRiders = {
    cardsPlayed: 0, tagPlays: {}, distinctTagPlays: {}, manaSpent: 0,
    discarded: 0, hpLostSinceTurnStart: 0, hpLostThisRound: 0,
    offeringsPaid: 0, previousSpell: 0, turnStartHpPct: 100,
    charges: {}, once: {},
  });
}

export function beginAbilityTurn(entity) {
  const old = stateFor(entity);
  entity.abilityRiders = {
    cardsPlayed: 0, tagPlays: {}, distinctTagPlays: {}, manaSpent: 0,
    discarded: 0, hpLostSinceTurnStart: old.hpLostThisRound || 0,
    hpLostThisRound: 0, offeringsPaid: 0, previousSpell: 0,
    turnStartHpPct: entity.maxHp > 0 ? 100 * entity.hp / entity.maxHp : 0,
    charges: {}, once: {},
    sameCardPlays: {}, attacksPlayed: 0, cardPlaysCombat: old.cardPlaysCombat || 0,
  };
}

export function abilitySnapshot(entity) {
  return structuredClone(stateFor(entity));
}

export function abilityMetric(entity, predicate, snapshot) {
  const state = snapshot || entity?.abilityRiders || {};
  if (predicate.metric === 'tagPlays') return state.tagPlays?.[predicate.tag] || 0;
  if (predicate.metric === 'distinctTagPlays') return Object.keys(state.distinctTagPlays?.[predicate.tag] || {}).length;
  if (predicate.metric === 'sameCardPlays') return state.sameCardPlays?.[predicate.cardId] || 0;
  return state[predicate.metric] || 0;
}

export function recordAbilityCard(entity, card, manaSpent) {
  const state = stateFor(entity);
  state.cardsPlayed += 1;
  state.cardPlaysCombat = (state.cardPlaysCombat || 0) + 1;
  state.attacksPlayed = (state.attacksPlayed || 0) + (card.type === 'attack' ? 1 : 0);
  state.sameCardPlays ||= {};
  state.sameCardPlays[card.cardId] = (state.sameCardPlays[card.cardId] || 0) + 1;
  state.manaSpent += manaSpent;
  state.previousSpell = card.abilityKind === 'spell' || card.authoredTags?.includes('source:spell') ? 1 : 0;
  for (const tag of new Set(card.authoredTags || card.tags || [])) {
    state.tagPlays[tag] = (state.tagPlays[tag] || 0) + 1;
    const names = state.distinctTagPlays[tag] || (state.distinctTagPlays[tag] = {});
    names[card.cardId] = true;
  }
}

export function recordAbilityEvent(ctx, type, payload) {
  if (type === 'hpLost') {
    const entity = payload.targetPlayerId && ctx.players
      ? ctx.players.get(payload.targetPlayerId)?.entity
      : payload.targetId === ctx.player?.id ? ctx.player : ctx.enemies?.find(e => e.id === payload.targetId);
    if (entity) {
      const state = stateFor(entity);
      const amount = Math.max(0, payload.amount || 0);
      state.hpLostSinceTurnStart += amount;
      state.hpLostThisRound += amount;
    }
  }
  if (type === 'cardDiscarded' && ['effect', 'chosen', 'random'].includes(payload.reason) && ctx.player) {
    const owner = payload.playerId && ctx.players ? ctx.players.get(payload.playerId)?.entity : ctx.player;
    if (owner) stateFor(owner).discarded += 1;
  }
}

export function allowAbilityOnce(entity, marker, card, effectIndex) {
  const state = stateFor(entity);
  const family = card?.abilityFamily || card?.cardId || 'effect';
  const key = `${family}:${typeof marker === 'string' ? marker : effectIndex}`;
  if (state.once[key]) return false;
  state.once[key] = true;
  return true;
}

function chargeMatches(charge, card) {
  return (!charge.cardType || charge.cardType === card.type)
    && (!charge.cardTag || (card.authoredTags || card.tags || []).includes(charge.cardTag))
    && (!charge.abilityKind || charge.abilityKind === card.abilityKind);
}

export function matchingAbilityCharges(entity, card, { enemyAvailable = true } = {}) {
  const entries = Object.entries(entity?.abilityRiders?.charges || {}).filter(([, charge]) => chargeMatches(charge, card)
    && (enemyAvailable || !charge.buildup || ['damage', 'manaDiscount', 'block', 'heal', 'break'].some(field => charge[field] > 0)));
  return { keys: entries.map(([key]) => key), ...Object.fromEntries(['damage', 'manaDiscount', 'block', 'heal', 'break'].map(field => [field, entries.reduce((sum, [, charge]) => sum + (field === 'damage' && charge.damageScope === 'effect' ? 0 : charge[field] || 0), 0)])), damageEffect: entries.reduce((sum, [, charge]) => sum + (charge.damageScope === 'effect' ? charge.damage || 0 : 0), 0), buildupBonuses: entries.filter(([, c]) => c.buildup).map(([, c]) => ({ status: c.buildupStatus, amount: c.buildup })) };
}

export function cardTargetsAllEnemies(def) {
  return (def.effects || []).some(effect => effect.op === 'damage' && effect.target === 'allEnemies');
}

// A buildup charge augments the first authored application of its status. If
// this grade has no application yet, add one after its primary effect. A pure
// guard may therefore apply its charged buildup to the selected living enemy,
// or the first living enemy when the play has no selection.
export function abilityChargedEffects(effects, charges, enemyAvailable = true) {
  if (!enemyAvailable) return effects;
  const missing = [...new Set((charges.buildupBonuses || []).map(bonus => bonus.status))]
    .filter(status => !effects.some(effect => effect.op === 'applyStatus' && effect.status === status));
  if (!missing.length) return effects;
  const primary = effects.findIndex(effect => ['damage', 'block', 'heal'].includes(effect.op));
  const index = primary < 0 ? effects.length : primary + 1;
  return [...effects.slice(0, index), ...missing.map(status => ({ op: 'applyStatus', target: 'enemy', status, stacks: 0 })), ...effects.slice(index)];
}

export function consumeAbilityCharges(entity, keys) {
  const charges = stateFor(entity).charges;
  for (const key of keys) delete charges[key];
}

export function grantAbilityCharge(entity, effect) {
  const charges = stateFor(entity).charges;
  const old = charges[effect.key];
  // A repeated source can replace its own charge, never accumulate it.
  charges[effect.key] = { ...(effect.cardType ? { cardType: effect.cardType } : {}), ...(effect.cardTag ? { cardTag: effect.cardTag } : {}), ...(effect.abilityKind ? { abilityKind: effect.abilityKind } : {}), damage: Math.max(old?.damage || 0, effect.damage || 0), manaDiscount: Math.max(old?.manaDiscount || 0, effect.manaDiscount || 0) };
  for (const field of ['block', 'heal', 'break', 'buildup']) if (effect[field]) charges[effect.key][field] = Math.max(old?.[field] || 0, effect[field]);
  if (effect.buildupStatus) charges[effect.key].buildupStatus = effect.buildupStatus;
  if (effect.damageScope) charges[effect.key].damageScope = effect.damageScope;
}

export function attachAbilityCharges(action, charges, applied) {
  const map = { damage: 'damage', block: 'block', heal: 'heal' };
  if (action.effect.op === 'damage' && charges.break && !applied.has('break')) { applied.add('break'); action.meta = { ...action.meta, abilityChargeBreak: charges.break }; }
  if (action.effect.op === 'damage' && charges.damageEffect && !applied.has('damageEffect')) { applied.add('damageEffect'); action.meta = { ...action.meta, abilityChargeDamageEffect: charges.damageEffect }; }
  if (action.effect.op === 'applyStatus' && !applied.has(`buildup:${action.effect.status}`)) {
    const amount = (charges.buildupBonuses || []).filter(bonus => bonus.status === action.effect.status).reduce((sum, bonus) => sum + bonus.amount, 0);
    if (amount) { applied.add(`buildup:${action.effect.status}`); action.meta = { ...action.meta, abilityChargeBuildup: amount }; }
  }
  const field = map[action.effect.op];
  if (!field || !charges[field] || applied.has(field)) return;
  applied.add(field);
  action.meta = { ...action.meta, [`abilityCharge${field[0].toUpperCase()}${field.slice(1)}`]: charges[field] };
}

export function recordAbilityOffering(entity, amount) {
  if (amount > 0) stateFor(entity).offeringsPaid += 1;
}

export function abilityEntityKey(ctx, entity) {
  return ctx.playerIdForEntity?.(entity) || entity?.id;
}

export function beforeAbilityPlay(ctx, source) {
  const entities = ctx.players ? [...ctx.players.values()].map(p => p.entity) : [ctx.player];
  return { abilityBefore: abilitySnapshot(source), abilityEntities: Object.fromEntries([...entities, ...ctx.enemies].map(e => [abilityEntityKey(ctx, e), structuredClone(e)])) };
}

export function priorAbilityEntity(ctx, entity, meta) {
  if (entity?.id === meta?.targetId && meta?.targetStatusesBefore) return { ...entity, statuses: meta.targetStatusesBefore };
  return meta?.abilityEntities?.[abilityEntityKey(ctx, entity)] || entity;
}

export function requestAbilityDiscard(ctx, action, amount) {
  const count = Math.min(Math.max(0, amount), ctx.piles.hand.length);
  if (!count) return;
  if (!ctx.pendingAbilityPlay) throw new Error('Chosen discard requires a resolving card');
  ctx.pendingAbilityDiscard = { count, playerId: ctx.playerKey || null, cardId: ctx.pendingAbilityPlay.instance.cardId };
}

export function chooseAbilityDiscard(ctx, ids) {
  const pending = ctx.pendingAbilityDiscard;
  if (!pending) throw new Error('No discard choice is pending');
  if (!Array.isArray(ids) || ids.length !== pending.count || new Set(ids).size !== ids.length || ids.some(id => !ctx.piles.hand.some(c => c.instanceId === id))) throw new Error(`Choose exactly ${pending.count} distinct cards from your hand`);
  for (const id of ids) {
    const index = ctx.piles.hand.findIndex(c => c.instanceId === id);
    const card = ctx.piles.hand.splice(index, 1)[0];
    ctx.piles.discard.push(card);
    ctx.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'chosen', explicit: true, sourceId: ctx.player.id, ...(ctx.playerKey ? { sourcePlayerId: ctx.playerKey, playerId: ctx.playerKey } : {}) });
  }
  delete ctx.pendingAbilityDiscard;
}

export function assertNoAbilityChoice(ctx) {
  if (ctx.pendingAbilityDiscard) throw new Error('Choose the cards to discard before taking another action');
}

export function abilityResolved(ctx) {
  const play = ctx.pendingAbilityPlay;
  if (!play || ctx.pendingAbilityDiscard) return null;
  delete ctx.pendingAbilityPlay;
  ctx.emit('cardResolved', { ...play.before, cardInstanceId: play.instance.instanceId, cardId: play.instance.cardId, cardType: play.kind, cardTags: play.ref.authoredTags || play.ref.tags || [], abilityKind: play.ref.abilityKind, printedManaCost: play.printedManaCost, targetId: play.targetId, sourceId: ctx.player.id, ...(ctx.playerKey ? { sourcePlayerId: ctx.playerKey, playerId: ctx.playerKey } : {}), magicalResolved: play.ref.abilityKind === 'spell' });
  return play;
}
