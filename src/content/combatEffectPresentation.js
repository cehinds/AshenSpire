// Restraint belongs to the effect, so preview and combat use the same treatment.
//
// The tables, and every number the two functions below used to spell out inline,
// live in content/config/ui/presentation/combatEffectPresentation.json. The
// three treatments are named there (aura, subtle, full) rather than being three
// anonymous object literals inside a conditional.
import { uiConfig } from '../config/generated/ui.js';

const { behavior, layering } = uiConfig.presentation.combatEffectPresentation;

export const SUBTLE_COMBAT_EFFECTS = behavior.subtleEffects;
export const LAYERED_CARD_EFFECTS = behavior.layeredCardEffects;
// Shared presentation data: a faded wake behind the face and a feathered edge
// above its artwork. Keep the name, costs and rules clear in the center.
export const CARD_EFFECT_LAYERS = layering.cardEffectLayers;

export function combatEffectOpacity(kind) {
  return LAYERED_CARD_EFFECTS.includes(kind) ? behavior.cardOpacity.layered : behavior.cardOpacity.plain;
}
export function combatEffectPresentation(kind) {
  const { auraEffects, treatments } = behavior;
  // A fresh object each call, as before: the config rows are frozen and a
  // caller that adjusts what it is handed must not reach the table.
  if (auraEffects.includes(kind)) return { ...treatments.aura };
  if (SUBTLE_COMBAT_EFFECTS.includes(kind)) return { ...treatments.subtle };
  return { ...treatments.full, opacity: combatEffectOpacity(kind) };
}
