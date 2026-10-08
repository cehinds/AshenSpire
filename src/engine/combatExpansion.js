import { resolveCard } from '../model/registries.js';
import { upcastCard } from '../model/upcasting.js';
import { applyCombatExpansionCard } from '../content/combatExpansionCards.js';
import { corruptedCardProjection } from './ashenBlight.js';

export function resolveCombatCard(ctx, instance, { upcastTier, upcastRanks } = {}) {
  const def = resolveCard(ctx.registries, instance, ctx.breakMeterVersion || 0);
  if (ctx.combatExpansionVersion !== 2) {
    if (upcastTier || upcastRanks) throw new Error('Upcasting requires the expanded combat rules');
    if (def.minCombatExpansionVersion > 1) throw new Error('This card requires the expanded combat rules');
    return def;
  }
  const expanded = applyCombatExpansionCard(def);
  if (expanded.minCombatExpansionVersion > ctx.combatExpansionVersion) throw new Error('This card requires newer combat rules');
  // Corruption scales the printed base once; upcast bonuses are a separate price.
  return upcastCard(corruptedCardProjection(ctx, ctx.player, expanded), upcastTier ?? upcastRanks);
}
