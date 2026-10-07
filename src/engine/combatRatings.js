import { ratingReceipt, ratingValue, sourceRatingValue, attackImpact, isMagicalAttack } from '../model/combatRatings.js';
import { propertyMountsOf } from './properties.js';
import { passiveMult, passiveSum } from '../model/registries.js';
import { usesSingleBreakMeter, breakMeterIds } from '../model/breakMeter.js';
import * as statuses from '../framework/statusSemantics.js';

export function refreshCombatRatings(ctx) {
  if (!ctx.ratingsRules) return;
  const receipt = ratingReceipt(ctx.registries, ctx, ctx.ratingsRules);
  for (const mount of Object.values(propertyMountsOf(ctx, ctx.player) || {})) {
    for (const rule of mount.rules || []) {
      const values = { name: rule.tag, kind: 'property' };
      for (const id of ['ar', 'dr', 'pr', 'poise', 'ward']) {
        const bonus = rule.passives?.[`${id}Bonus`] || 0;
        values[id] = bonus; receipt.totals[id] += bonus;
      }
      if (Object.values(values).some(v => typeof v === 'number' && v !== 0)) receipt.sources.push(values);
    }
  }
  ctx.player.ratings = receipt.totals;
  ctx.player.ratingSources = receipt.sources;
  if (usesSingleBreakMeter(ctx)) { delete ctx.player.wardMeter; delete ctx.player.wardGuard; delete ctx.player.arcaneExposure; }
  for (const id of breakMeterIds(ctx)) {
    const key = id + 'Meter';
    const prior = ctx.player[key];
    let max = Math.max(1, Math.floor(receipt.totals[id]));
    for (let n = 0; n < (prior?.growths || 0); n++) max = Math.ceil(max * ctx.ratingsRules.breaks.thresholdGrowth);
    ctx.player[key] = { ...prior, value: Math.min(prior?.value || 0, max - 1), max, growths: prior?.growths || 0 };
  }
}

export function applyRatingImpact(ctx, source, target, carrier, explicitAmount = null, { triggerHit = true } = {}) {
  if (!ctx.ratingsRules || !target?.alive) return;
  const magical = isMagicalAttack(ctx, carrier);
  const single = usesSingleBreakMeter(ctx);
  const meterName = magical && !single ? 'ward' : 'poise';
  const meter = target[meterName + 'Meter'];
  if (!meter || meter.max <= 0) return;
  let amount = explicitAmount === null ? attackImpact(ctx, source, carrier) : Math.max(0, Math.floor(explicitAmount));
  if (single && magical && explicitAmount === null) amount = foldedMagicImpact(ctx, source, target, carrier, amount);
  const label = magical && !single ? 'Disruption' : 'Stagger';
  const seats = ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source), targetPlayerId: ctx.playerIdForEntity(target) } : {};
  if (amount <= 0) return;
  // A Poise or Ward guard (the Dodge Roll's gainPoise / gainWard) takes the
  // impact before the meter does, the way Block takes damage before HP.
  const guarded = absorbMeterGuard(target, meterName, amount);
  amount -= guarded;
  if (amount <= 0) {
    ctx.emit('ratingImpact', { ...seats, targetId: target.id, sourceId: source?.id, meter: meterName, amount: 0, guarded,
      ...meterGuardReceipt(target, meterName), value: meter.value, max: meter.max, breaks: 0, label });
    return;
  }
  meter.value += amount;
  const cfg = ctx.ratingsRules.breaks;
  let breaks = 0;
  const thresholdBeforeGrowth = meter.max;
  while (meter.value >= meter.max && breaks < 100) {
    meter.value -= meter.max;
    breaks++;
    if (target.kind === 'player') target.pendingActionLoss = (target.pendingActionLoss || 0) + cfg[magical && !single ? 'wardActionLoss' : 'poiseActionLoss'];
    else {
      target.skipNextTurn = true;
      target.pendingMove = null;
      target.intent = { kind: 'staggered', moveId: null };
    }
    meter.max = Math.max(1, Math.ceil(meter.max * cfg.thresholdGrowth));
    meter.growths = (meter.growths || 0) + 1;
    ctx.emit('meterFilled', { ...seats, targetId: target.id, meter: meterName, threshold: meter.max });
  }
  if (single && magical && breaks > 0) {
    if (triggerHit) ctx.emit('arcaneStagger', { ...seats, targetId: target.id, sourceId: source?.id ?? null,
      school: carrier?.damageSchool, threshold: thresholdBeforeGrowth });
    applyMagicalStaggerPayoff(ctx, source, target);
  }
  ctx.emit('ratingImpact', { ...seats, targetId: target.id, sourceId: source?.id, meter: meterName, amount,
    ...(guarded ? { guarded, ...meterGuardReceipt(target, meterName) } : {}),
    value: meter.value, max: meter.max, breaks, label });
}

function foldedMagicImpact(ctx, source, target, carrier, baseImpact) {
  const balance = ctx.registries.balance;
  const authored = target.kind === 'enemy' ? ctx.registries.enemies.get(target.enemyId).arcaneExposure : null;
  const schoolMult = balance.arcaneExposure?.schoolBuildupMultipliers?.[carrier?.damageSchool] || 0;
  const perHit = carrier?.exposureBuildupPerHit || 0;
  const mounts = propertyMountsOf(ctx, source);
  const mult = passiveMult(ctx.registries, source?.relicIds || [], 'exposureBuildupMult', mounts);
  const add = passiveSum(ctx.registries, source?.relicIds || [], 'magicalImpactAdd', {}, mounts);
  const buildup = perHit * schoolMult * (authored?.buildupMultiplier ?? 1) * mult * balance.exposure.foldScale;
  const amount = Math.max(0, Math.floor(baseImpact + add + buildup));
  // Focus XP keeps a receipt of paid magical buildup without retaining a meter.
  if (buildup > 0) ctx.emit('arcaneImpact', { sourceId: source?.id, targetId: target.id, amount: Math.floor(buildup),
    ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source) } : {}) });
  return amount;
}

function applyMagicalStaggerPayoff(ctx, source, target) {
  if (target.kind !== 'enemy') return;
  const authored = ctx.registries.enemies.get(target.enemyId).arcaneExposure;
  if (authored?.mode === 'immune') return;
  const payoff = authored?.onBreak || ctx.registries.balance.exposure.defaultPayoff;
  statuses.applyStatus(ctx, target, payoff.status, payoff.value, source);
  if (target.statuses[payoff.status]) target.statuses[payoff.status].duration = payoff.duration;
}

/**
 * A meter guard is a pool of Poise or Ward that absorbs impact before the
 * matching meter fills (entity.poiseGuard / entity.wardGuard), granted by the
 * gainPoise / gainWard opcodes and cleared at the start of its owner's turn,
 * as Block is. absorbMeterGuard spends up to `amount` of it and returns what
 * it took.
 */
export function absorbMeterGuard(entity, meterName, amount) {
  const key = meterName + 'Guard';
  const pool = Number.isFinite(entity?.[key]) ? Math.max(0, Math.floor(entity[key])) : 0;
  const taken = Math.min(pool, Math.max(0, Math.floor(amount)));
  if (taken > 0) entity[key] = pool - taken;
  return taken;
}

export function meterGuardReceipt(entity, meterName) {
  return { guardRemaining: entity?.[meterName + 'Guard'] || 0 };
}

/** clearMeterGuards — the guards expire with Block, at the owner's turn start. */
export function clearMeterGuards(entity) {
  if (!entity) return;
  delete entity.poiseGuard;
  delete entity.wardGuard;
}

export function recoverRatingMeters(ctx, entity) {
  if (!ctx.ratingsRules) return;
  for (const id of breakMeterIds(ctx)) {
    const meter = entity[id + 'Meter'];
    if (meter) meter.value = Math.max(0, meter.value - ctx.ratingsRules.breaks.recoveryPerTurn);
  }
}

export function cardRatingBonus(ctx, source, carrier, op, base = 0) {
  if (!source || !carrier?.cardId) return 0;
  const capped = (amount) => Number.isFinite(carrier.ratingCap)
    ? Math.max(0, Math.min(amount, carrier.ratingCap - base))
    : amount;
  if (!ctx.ratingsRules || !source.ratings) return capped(Number(carrier.ratingValue) || 0);
  const magical = isMagicalAttack(ctx, carrier);
  const value = (id) => {
    const amount = sourceRatingValue(ctx, source, id, carrier.sourceArmamentId, !!carrier.equipmentRole);
    return capped(amount);
  };
  if (carrier.ratingId && ['damage', 'block', 'heal'].includes(op)) return value(carrier.ratingId);
  if (op === 'damage') return value(magical ? 'pr' : 'ar');
  if (op === 'block' && (carrier.type === 'skill' || magical)) return value(magical ? 'pr' : 'dr');
  if (op === 'heal' && magical) return value('pr');
  return 0;
}
