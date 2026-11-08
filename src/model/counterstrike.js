// Counterstrike arithmetic, pure (moved from src/engine/combatCardTraitMath.js so src/model formulas need no engine import).
/** a > 0 becomes a + max(floor(a × pct), 1); zero, negatives and non-numbers are unchanged. */
export function counterstrikeAmount(amount, pct) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return amount;
  return amount + Math.max(Math.floor(amount * pct), 1);
}
