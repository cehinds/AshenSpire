// Restraint belongs to the effect, so preview and combat use the same treatment.
export const SUBTLE_COMBAT_EFFECTS = Object.freeze(['steelGlint','dustStep','focusMotes','guardPulse','weak','frail','resist','strength','dexterity']);
export const LAYERED_CARD_EFFECTS = Object.freeze(['slash','shieldBash','starbolt','bloodSlash']);
// Shared presentation data: a faded wake behind the face and a feathered edge
// above its artwork. Keep the name, costs and rules clear in the center.
export const CARD_EFFECT_LAYERS = Object.freeze([
 Object.freeze({id:'wake',plane:'behind',opacity:.44,scale:1.95,x:.4,y:.35,mask:'linear-gradient(to right,#000 20%,#0009 55%,transparent 88%)'}),
 Object.freeze({id:'edge',plane:'front',opacity:.66,scale:1.65,x:.68,y:.35,mask:'linear-gradient(to right,transparent 24%,#0005 52%,#000 78%)'}),
]);
export function combatEffectOpacity(kind){return LAYERED_CARD_EFFECTS.includes(kind) ? .72 : 1;}
export function combatEffectPresentation(kind){
 if(['bloodAura','frostAura','poisonAura','sacredAura'].includes(kind))return {sizeScale:1,opacity:.55,startScale:.92,endScale:1.04};
 return SUBTLE_COMBAT_EFFECTS.includes(kind)
  ? {sizeScale:.72,opacity:.55,startScale:.9,endScale:1.04}
  : {sizeScale:1,opacity:combatEffectOpacity(kind),startScale:.65,endScale:.9};
}
