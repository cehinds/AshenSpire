
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

export function cardRatingBonus(ctx, source, carrier, op, base = 0) {
  if (!source || !carrier?.cardId) return 0;
  const amount = Number(carrier.ratingValue) || 0;
  return Number.isFinite(carrier.ratingCap)
    ? Math.max(0, Math.min(amount, carrier.ratingCap - base))
    : amount;
}

/** A spell defense's rating bonus: Block for a Defense card, Ward otherwise. */
export function spellDefenseRatingBonuses(ctx, source, carrier, base = 0) {
  if (!source || !carrier?.cardId) return { block: 0, ward: 0 };
  const fallback = cardRatingBonus(ctx, source, carrier, 'block', base);
  return carrier.ratingId === 'dr' ? { block: fallback, ward: 0 } : { block: 0, ward: fallback };
}
