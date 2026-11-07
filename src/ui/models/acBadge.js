import { t, tFull, tTip } from '../strings.js';
import { effectiveEvasion } from '../../engine/stanceHit.js';
import { fixCoreEnabled } from '../../model/fixCoreMechanics.js';

// The player's AC badge (owner 2026-11-01): the Evasion DC an enemy hit roll must reach, "vs Evasion N" in the hit receipt.
// The number comes from the engine's own effectiveEvasion (floored under FixCore exactly as attackHitPreview floors it); nothing
// here re-derives the formula. The Evade part is the difference between the live value and the value with Evade switched off.
const shown = (ctx, value) => fixCoreEnabled(ctx) ? Math.floor(value) : value;

/** { value, evade, base } for the player's AC, or null off Core 2 FixCore / for anyone but the player. */
export function acFor(ctx, entity) {
  // Evasion is a fixed DC only under FixCore (the same gate stanceHit.js uses); elsewhere the hit roll is not 'd20 + Precision >= AC'.
  if (!ctx || ctx.combatExpansionVersion !== 2 || !fixCoreEnabled(ctx) || entity?.kind !== 'player') return null;
  const value = shown(ctx, effectiveEvasion(ctx, entity));
  const without = shown(ctx, effectiveEvasion(ctx, entity, { evadeDisabled: true }));
  return { value, evade: value - without, base: without };
}

/** Tooltip lines for the AC badge: the title, the hit rule, then where the number comes from. */
export function acBadgeText(ac) {
  const lines = [tFull('combat.protection.ac', { value: ac.value })];
  if (ac.evade) lines.push(t('combat.protection.acEvade', { value: ac.evade }));
  lines.push(t('combat.protection.acBase', { value: ac.base }));
  return { title: tTip('combat.protection.ac', { value: ac.value }), lines };
}
