// The Core gear item (games/ashenspire/packs/core/gear.json) a worn piece resolves to.
// Owner, 2026-11-18: a class's starting outfit row (`default` in outfits.csv) names its gear item in the `gearId` column
// (Wayfarer Plate, Nightweave, Rite Vestments, Gutter Leathers), so the starting armour carries the Poise and attribute points of that item.
// Every other piece is its own gear item.
export const GearIdOf = (piece) => piece?.gearId || piece?.id;
