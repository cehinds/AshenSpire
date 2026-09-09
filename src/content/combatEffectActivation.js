// Cost changes the action treatment, never its aura, stance or outcome overlay.
export const RETAINED_EFFECT_RULES = Object.freeze([
 'barrier','frost-ward','arcane-ward','magic-ward','bulwark-guard',
 'weapon-parry','unarmed-guard','arcane-guard','magic-guard','physical-guard',
 'dodge','gorefire-stance-cast',
]);
export const MUNDANE_ATTACK_EFFECTS = Object.freeze([
 'slash','thrust','heavyImpact','shieldBash','parry','crossSlash','whirlwind','riposte',
]);
export const ACTIVATION_TREATMENTS = Object.freeze({
 mundaneLow: {sizeScale:.8,cast:null,impactKind:'steelGlint'},
 mundaneHigh: {sizeScale:1.12,cast:null,impactKind:'heavyImpact'},
 resourceLow: {sizeScale:1,cast:'focusMotes',impactKind:'impact'},
 resourceHigh: {sizeScale:1.25,cast:'focusMotes',impactKind:'impact'},
});
