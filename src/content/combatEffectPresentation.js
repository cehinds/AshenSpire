// Restraint belongs to the effect, so preview and combat use the same treatment.
export const SUBTLE_COMBAT_EFFECTS = Object.freeze(['steelGlint','dustStep','focusMotes','guardPulse']);
export function combatEffectPresentation(kind){
 if(['bloodAura','frostAura','poisonAura','sacredAura'].includes(kind))return {sizeScale:1,opacity:.55,startScale:.92,endScale:1.04};
 return SUBTLE_COMBAT_EFFECTS.includes(kind)
  ? {sizeScale:.72,opacity:.55,startScale:.9,endScale:1.04}
  : {sizeScale:1,opacity:1,startScale:.65,endScale:.9};
}
