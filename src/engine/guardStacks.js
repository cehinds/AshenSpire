// Counter and Reflect stack counts (owner 2026-10-31). Plain integers on the combat entity (`counterStacks`,
// `reflectStacks`), not statuses: absent means 0, the cap and fractions are data (content/framework/mechanics.json
// `counter` / `reflect`), and they clear only when the fight ends (a fresh entity carries none). Pure helpers.
import { mechanics } from '../framework/data/mechanics.js';

const whole = value => Math.max(0, Math.floor(Number(value) || 0));

export const counterStackCount = entity => whole(entity?.counterStacks);
export const reflectStackCount = entity => whole(entity?.reflectStacks);

/** Adds Counter stacks up to the cap; returns the number actually gained. Emits counterStacksChanged. */
export function gainCounterStacks(ctx, entity, amount) {
  if (!entity) return 0;
  const before = counterStackCount(entity);
  const next = Math.min(mechanics.counter.stackCap, before + whole(amount));
  if (next === before) return 0;
  entity.counterStacks = next;
  ctx?.emit?.('counterStacksChanged', { targetId: entity.id, stacks: next, amount: next - before,
    ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {}) });
  return next - before;
}

/** Adds Reflect stacks up to the cap; returns the number actually gained. Emits reflectStacksChanged. */
export function gainReflectStacks(ctx, entity, amount) {
  if (!entity) return 0;
  const before = reflectStackCount(entity);
  const next = Math.min(mechanics.reflect.stackCap, before + whole(amount));
  if (next === before) return 0;
  entity.reflectStacks = next;
  ctx?.emit?.('reflectStacksChanged', { targetId: entity.id, stacks: next, amount: next - before,
    ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {}) });
  return next - before;
}

/** Removes Reflect stacks (a reflected hit spends one); returns the number removed. */
export function spendReflectStacks(ctx, entity, amount = 1) {
  const before = reflectStackCount(entity);
  const next = Math.max(0, before - whole(amount));
  if (next === before) return 0;
  if (next === 0) delete entity.reflectStacks; else entity.reflectStacks = next;
  ctx?.emit?.('reflectStacksChanged', { targetId: entity.id, stacks: next, amount: next - before,
    ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {}) });
  return before - next;
}

/** The part of one incoming hit a Counter with `stacks` returns: floor(stacks x stackFraction x incoming). */
export const counterStackReturn = (stacks, incoming) =>
  Math.floor(whole(stacks) * mechanics.counter.stackFraction * Math.max(0, Math.floor(Number(incoming) || 0)) + 1e-9);

/** Reflect's fraction for `stacks`, capped: the share removed from a hit (reduce) or sent back (return). */
export const reflectReduceFraction = stacks => Math.min(mechanics.reflect.reduceCap, whole(stacks) * mechanics.reflect.reducePerStack);
export const reflectReturnFraction = stacks => Math.min(mechanics.reflect.reduceCap, whole(stacks) * mechanics.reflect.returnPerStack);

// Integer arithmetic (percent points from the mechanics constants x 100), so 1 - 0.9 style float error cannot cost a point.
const pct = value => Math.round(value * 100);
export const reflectReducePct = stacks => Math.min(pct(mechanics.reflect.reduceCap), pct(mechanics.reflect.reducePerStack) * whole(stacks));
export const reflectReturnPct = stacks => Math.min(pct(mechanics.reflect.reduceCap), pct(mechanics.reflect.returnPerStack) * whole(stacks));
/** The hit left after Reflect cuts it: floor(incoming x (100 - cut%) / 100). */
export const reflectCut = (incoming, stacks) => Math.floor(whole(incoming) * (100 - reflectReducePct(stacks)) / 100);
/** What a reflected hit sends back: floor(original x return% / 100). */
export const reflectReturned = (original, stacks) => Math.floor(whole(original) * reflectReturnPct(stacks) / 100);
