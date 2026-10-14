import { persistentWardMaximum, persistentPoiseMaximum } from '../model/combatRatings.js';

// The rating-driven pools (Ward and Poise). A small module of its own so that
// both actions.js and the status and rating paths can sync a pool without an
// import cycle through the action interpreter.

// Stamps the seat on an event the way actions.js does for every other combat event.
const seatOf = (ctx, entity) => ctx.playerIdForEntity && entity.kind === 'player' ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {};

/**
 * A rating swing keeps the MISSING amount fixed (owner's rule). A rise of N
 * from full gives +N; a dip clamps the value but remembers the missing amount
 * in `missing`, so a recovery cannot refill a pool the fight already emptied.
 * `missing` is stored only while the clamp has lost some of it.
 */
function resizePool(pool, max) {
  const missing = Math.max(0, pool.missing !== undefined && pool.value === 0 ? pool.missing : pool.max - pool.value);
  pool.max = max;
  pool.value = Math.max(0, max - missing);
  if (missing > max) pool.missing = missing;
  else delete pool.missing;
}

export function syncWardMaximum(ctx, entity) {
  const ward = entity?.persistentWard;
  // A fight with no rating table has nothing to follow: its pools keep what they were given.
  if (!ward || !entity.ratings || ctx.combatExpansionVersion !== 2) return;
  const max = persistentWardMaximum(ctx, entity);
  if (max === ward.max) return;
  resizePool(ward, max);
  ctx.emit('persistentWardChanged', { targetId: entity.id, value: ward.value, max: ward.max, source: 'rating', ...seatOf(ctx, entity) });
}

/**
 * The Poise maximum follows the live Poise rating, exactly as Ward does: a rise
 * adds the same to current Poise, a fall clamps.
 */
export function syncPoiseMaximum(ctx, entity) {
  const poise = entity?.persistentPoise;
  if (!poise || !entity.ratings || ctx.combatExpansionVersion !== 2) return;
  const max = persistentPoiseMaximum(ctx, entity);
  if (max === poise.max) return;
  resizePool(poise, max);
  ctx.emit('persistentPoiseChanged', { targetId: entity.id, value: poise.value, max: poise.max, source: 'rating', ...seatOf(ctx, entity) });
}

