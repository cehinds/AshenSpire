// Named defensive cards have an explicit visual identity, independent of costs.
export const CARD_DEFENSE_EFFECTS = Object.freeze({
 crystalBarrier:'barrier',umbralWard:'barrier',starstoneWard:'arcaneWard',
 wardingStar:'magicGuard',frostVeil:'frostAura',bracingStance:'bulwarkStance',
});
export const STANCE_EFFECTS = Object.freeze({bulwark:'bulwarkStance',gorefire:'berserkStance'});
export const STATUS_EFFECTS = Object.freeze({
 bleed:'bloodAura',frost:'frostAura',venom:'poisoned',
 prepared:'duelistStance',starstoneCharge:'channelStance',
});
export const PROC_EFFECTS = Object.freeze({bleed:'bloodLoss',frost:'frostbite'});
