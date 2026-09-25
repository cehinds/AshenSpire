// engine/busHooks.js — listeners and payload stamps that wrap a combat's
// `emit`, installed so they survive every copy of the combat.
//
// A wrapper assigned straight onto `combat.emit` lives in a closure over that
// one object. The foundation transaction (engine/combatRules.js) executes each
// play on a structured clone whose `emit` is rebuilt from the raw
// `_emitEvent`, so such a wrapper would hear nothing the candidate emits and
// its state would never reach the committed combat. Every hook installed here
// is recorded on the combat (non-enumerable, so neither cloned as data nor
// serialized) and re-applied, in the same order, to each candidate by
// `reinstallEmitHooks`.

const HOOKS = '_emitHooks';

/**
 * wrapEmit(ctx, wrap) — `wrap(ctx, inner)` returns the new emit for `ctx`,
 * calling `inner(type, payload)` for the bus beneath it. Always read state
 * through the `ctx` argument, never a captured combat, so the hook acts on
 * whichever copy is emitting.
 */
export function wrapEmit(ctx, wrap) {
  if (!Object.prototype.hasOwnProperty.call(ctx, HOOKS)) {
    Object.defineProperty(ctx, HOOKS, { value: [], enumerable: false, writable: true, configurable: true });
  }
  ctx[HOOKS].push(wrap);
  ctx.emit = wrap(ctx, ctx.emit);
  return ctx;
}

/** Re-apply `source`'s emit hooks onto `target`, whose `emit` is the raw bus. */
export function reinstallEmitHooks(source, target) {
  for (const wrap of source[HOOKS] || []) wrapEmit(target, wrap);
  return target;
}
