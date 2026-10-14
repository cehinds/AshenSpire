import { resolveCombatCard } from '../../engine/combatExpansion.js';

// The host preview belongs to this instance's owner and selected temporary
// tier. A missing tier preview must not reuse a different tier's target plan.
export function combatCardView(context, instance, upcastTier) {
  const baseTier = instance.combatPreview?.resolvedDefinition?.upcast?.baseTier ?? 0;
  const preview = upcastTier == null || upcastTier === baseTier
    ? instance.combatPreview : instance.upcastPreviews?.[upcastTier];
  return { ...(preview?.resolvedDefinition || resolveCombatCard(context, instance, { upcastTier })),
    combatPreview: preview };
}
