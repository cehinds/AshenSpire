// Tactical profiles share the ordinary action queue. No card IDs or UI state.
import { combatMatchups } from '../content/combatMatchups.js';

export function matchupRules(ctx) {
  return ctx?.combatMatchupRules || ctx?.registries?.balance?.combatMatchups || combatMatchups;
}

export function combatProfileOf(carrier) {
  const profile = carrier?.combatProfile;
  return ['physical', 'spell', 'spells', 'magic', 'magical'].includes(profile?.camp) ? profile : null;
}

function physicalProjectile(profile) {
  return profile?.camp === 'physical' && (profile.maneuver === 'ranged' || profile.delivery === 'projectile');
}

function isSpell(profile) {
  return ['spell', 'spells', 'magic', 'magical'].includes(profile?.camp);
}

function eventCarrier(source, carrier) {
  return { sourceKind: source?.kind, cardId: carrier?.cardId,
    cardInstanceId: carrier?.instanceId, cardType: carrier?.type,
    cardTags: carrier?.authoredTags || carrier?.tags || [], abilityKind: carrier?.abilityKind };
}

function counterEligible(ctx, target, carrier, profile) {
  const counter = target?.combatCounter;
  if (!counter || !profile || carrier?.combatReaction || counter.charges <= 0) return false;
  if (counter.expiresOnTurn != null && Number.isFinite(ctx?.turn) && ctx.turn >= counter.expiresOnTurn) return false;
  const rules = matchupRules(ctx);
  const cfg = rules.counter;
  const mode = counter.mode || 'melee';
  if (profile.maneuver === 'sweep') return false;
  if (mode === 'spell' || mode === 'magic') return isSpell(profile) || physicalProjectile(profile);
  if (mode === 'ranged') return physicalProjectile(profile);
  return profile.camp === 'physical'
    && cfg.meleeIncomingManeuvers.includes(profile.maneuver)
    && !physicalProjectile(profile)
    && !cfg.meleeBypassDamageTypes.includes(rules.damageAliases?.[profile.damageType] || profile.damageType);
}

export function armCombatCounter(ctx, entity, carrier, options = {}) {
  const profile = combatProfileOf(carrier);
  if (!entity || !profile) return null;
  entity.combatCounter = {
    charges: 1,
    mode: options.mode || profile.counterMode || (isSpell(profile) ? 'spell' : 'melee'),
    damage: Math.max(0, Number(options.damage) || 0),
    poiseDamage: Math.max(0, Number(options.poiseDamage) || 0),
    bonus: Math.max(0, Number(options.bonus) || 0),
    ...(Number.isFinite(ctx?.turn) ? { expiresOnTurn: ctx.turn + 1 } : {}),
    carrier: structuredClone(carrier),
  };
  ctx.emit?.('combatCounterArmed', { ...eventCarrier(entity, carrier),
    ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(entity) } : {}),
    sourceId: entity.id, mode: entity.combatCounter.mode });
  return entity.combatCounter;
}

export function clearCombatCounter(entity, ctx = null) {
  if (!entity) return;
  delete entity.combatCounter;
  // A triggered reply has spent its charge, but may still be waiting behind
  // the root action's remaining effects. Interruption cancels only that reply.
  for (const action of ctx?.queue || []) {
    if (action.source === entity && action.meta?.combatCounterReaction) {
      action.meta = { ...action.meta, combatCounterInterrupted: true };
    }
  }
}

/** Pure: both ordinary damage previews and live resolution call this once. */
export function prepareMatchupHit(ctx, source, target, carrier, computedDamage) {
  const profile = combatProfileOf(carrier);
  const raw = Math.max(0, Number(computedDamage) || 0);
  const guardBefore = Math.max(0, (target?.block || 0) - (target?.wardBlock || 0));
  const cfg = matchupRules(ctx);
  const smash = !!profile && !carrier?.combatReaction && profile.maneuver === 'smash' && guardBefore > 0;
  const counter = raw > 0 && counterEligible(ctx, target, carrier, profile);
  const damageType = cfg.damageAliases?.[profile?.damageType] || profile?.damageType;
  const targetKey = ctx.playerIdForEntity?.(target) || target?.id;
  const riderSpent = carrier?.combatRiderTargets?.includes(targetKey);
  const bypass = profile && !carrier?.combatReaction && !riderSpent ? cfg.damageRiders?.[damageType]?.guardBypass || 0 : 0;
  const amount = Math.max(0, Math.floor(raw * (smash ? cfg.smash.guardedMultiplier : 1) * (counter ? cfg.counter.incomingMultiplier : 1)));
  return { amount, profile, guardBefore, smash, counterEligible: counter,
    counter: counter ? structuredClone(target.combatCounter) : null,
    guardBypass: counter && ['ranged', 'spell', 'magic'].includes(target.combatCounter.mode) ? 0 : Math.min(amount, guardBefore, bypass) };
}

export function matchupPoiseMultiplier(ctx, source, target, carrier) {
  const profile = combatProfileOf(carrier);
  if (!profile || carrier?.combatReaction || profile.camp !== 'physical' || profile.maneuver !== 'attack') return 1;
  const targetProfile = target?.intent?.combatProfile || target?.combatProfile;
  const prepared = target?.pendingMove || target?.intent?.delayed || target?.intent?.pending
    || targetProfile?.maneuver === 'smash' || isSpell(targetProfile);
  return prepared ? matchupRules(ctx).attack.preparedPoiseMultiplier : 1;
}

function seats(ctx, source, target) {
  return ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source), targetPlayerId: ctx.playerIdForEntity(target) } : {};
}

/** Runs only from an executed action; Ward loss cannot spill into Health. */
export function stripCombatWard(ctx, source, target, amount) {
  if (!target?.alive) return 0;
  let remaining = Math.max(0, Math.floor(amount));
  const ward = Math.max(0, Math.min(target.block || 0, target.wardBlock || 0));
  const blockLoss = Math.min(ward, remaining);
  if (blockLoss > 0) {
    target.block -= blockLoss;
    target.wardBlock = ward - blockLoss;
    remaining -= blockLoss;
  }
  const guardLoss = Math.min(Math.max(0, target.wardGuard || 0), remaining);
  if (guardLoss > 0) target.wardGuard -= guardLoss;
  const stripped = blockLoss + guardLoss;
  if (stripped) ctx.emit?.('combatWardStripped', { ...seats(ctx, source, target), sourceId: source?.id, sourceKind: source?.kind, targetId: target.id, amount: stripped });
  return stripped;
}

export function completeMatchupHit(ctx, source, target, carrier, receipt, { blocked = 0, hpLoss = 0 } = {}) {
  if (!receipt.profile || carrier?.combatReaction) return;
  const cfg = matchupRules(ctx);
  if (receipt.counterEligible && target?.combatCounter?.charges > 0) {
    const counter = receipt.counter;
    delete target.combatCounter;
    ctx.emit?.('combatCounterConsumed', { ...eventCarrier(target, counter.carrier), ...seats(ctx, target, source), sourceId: target.id, targetId: source?.id, fullyBlocked: hpLoss === 0 && blocked >= receipt.amount });
    if (receipt.amount > 0 && hpLoss === 0 && blocked >= receipt.amount && target.alive && source?.alive) {
      const amount = Math.floor(counter.damage * cfg.counter.retaliationMultiplier) + cfg.counter.retaliationFlat + counter.bonus;
      const poise = counter.poiseDamage > 0 ? Math.floor(counter.poiseDamage * cfg.counter.poiseMultiplier) : 0;
      const wardOnly = ['spell', 'magic'].includes(counter.mode) && !isSpell(receipt.profile);
      ctx.emit?.('combatCounterTriggered', { ...eventCarrier(target, counter.carrier), ...seats(ctx, target, source), sourceId: target.id, targetId: source.id, amount, poiseDamage: wardOnly ? 0 : poise, wardOnly });
      if (wardOnly) stripCombatWard(ctx, target, source, amount);
      else {
        const reactionCarrier = { ...counter.carrier, combatReaction: true, skipRatingBonus: true };
        ctx.enqueue({ effect: { op: 'damage', amount }, source: target, owner: target, target: source, card: reactionCarrier, meta: { combatCounterReaction: true } });
        if (poise > 0) ctx.enqueue({ effect: { op: 'poiseDamage', amount: poise }, source: target, owner: target, target: source, card: reactionCarrier, meta: { combatCounterReaction: true } });
      }
    }
  }
  if (receipt.smash && receipt.guardBefore > 0 && (target.block || 0) - (target.wardBlock || 0) <= 0 && target.alive) {
    const amount = Math.max(0, receipt.profile.breakPoiseBonus ?? cfg.smash.guardBreakPoiseBonus);
    if (amount) ctx.enqueue({ effect: { op: 'poiseDamage', amount }, source, owner: source, target, card: { ...carrier, combatReaction: true }, meta: { combatSmashBreak: true } });
  }
}

/** Once per action and target. Reactions never generate another rider chain. */
export function matchupRiderEffects(ctx, source, target, carrier, { amount = 0, hpLoss = 0 } = {}) {
  const profile = combatProfileOf(carrier);
  if (!profile || carrier?.combatReaction || !(amount > 0) || !target) return [];
  const key = ctx.playerIdForEntity?.(target) || target.id;
  const seen = carrier.combatRiderTargets;
  if (seen?.includes(key)) return [];
  const cfg = matchupRules(ctx);
  const type = cfg.damageAliases?.[profile.damageType] || profile.damageType;
  const rider = cfg.damageRiders?.[type];
  if (!rider || (rider.requiresHpLoss && hpLoss <= 0)
    || (!target.alive && !(rider.cleanse && source?.alive))) return [];
  if (seen) seen.push(key);
  const effects = [];
  if (target.alive && rider.poise) effects.push({ op: 'poiseDamage', amount: rider.poise });
  if (target.alive && rider.wardDrain) stripCombatWard(ctx, source, target, rider.wardDrain);
  if (target.alive && rider.status && !carrier.appliedStatuses?.includes(rider.status) && ctx.registries?.statuses?.has(rider.status)) {
    effects.push({ op: 'applyStatus', status: rider.status, stacks: rider.stacks });
  }
  if (rider.cleanse && source?.alive) {
    const status = cfg.cleanseStatuses.find(id => source.statuses?.[id] && ctx.registries?.statuses?.has(id));
    if (status) effects.push({ op: 'removeStatus', target: 'self', status, amount: rider.cleanse });
  }
  return effects;
}
