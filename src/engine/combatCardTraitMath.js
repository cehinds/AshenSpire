// Shared arithmetic for the version-2 card traits (docs/combat-card-traits-contract.md).
// Pure: reads entities and rules, writes nothing.
import { CARD_TRAIT_RULES } from '../content/combatCardTraits.js';

const rulesOf = ctx => ctx?.reactionRules || CARD_TRAIT_RULES;

/** The maneuver an enemy or player stands in: resolving move, tactical stance, shown intent. */
export function stanceManeuverOf(entity, resolvingManeuver = null) {
  if (!entity) return null;
  return resolvingManeuver || entity.combatStance?.maneuver
    || entity.intent?.combatProfile?.maneuver || entity.combatProfile?.maneuver || null;
}

/** True when the player's stance beats the target's in the contract's advantage table. */
export function hasStanceAdvantage(ctx, playerManeuver, targetManeuver) {
  if (!playerManeuver || !targetManeuver) return false;
  return (rulesOf(ctx).advantage[playerManeuver] || []).includes(targetManeuver);
}

/** Counterstrike percentage: advantaged when the target is known and beaten, else the base. */
export function counterstrikePct(ctx, playerManeuver, targetManeuver) {
  const { pct, advantagedPct } = rulesOf(ctx).counterstrike;
  return hasStanceAdvantage(ctx, playerManeuver, targetManeuver) ? advantagedPct : pct;
}

/** a > 0 becomes a + max(floor(a × pct), 1); zero, negatives and non-numbers are unchanged. */
export function counterstrikeAmount(amount, pct) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return amount;
  return amount + Math.max(Math.floor(amount * pct), 1);
}

/** Impact/Flux extra on hit: the card's own amount again (doubling it) when positive, else N. */
export function traitHitAmount(ownAmount, n) {
  return ownAmount > 0 ? ownAmount : (n > 0 ? n : 0);
}
