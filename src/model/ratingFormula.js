export const ratingIds = Object.freeze(['ar', 'dr', 'pr', 'poise', 'ward']);
export const ratingAttributeIds = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);
const rule = (weights, base = 0) => ({ base, ...Object.fromEntries(ratingAttributeIds.map(id => [id, weights[id] || 0])) });

export const defaultRatingFormula = Object.freeze({
  multiplier: 1,
  ratings: Object.freeze({
    // Owner defaults, 2026-09-24 (ashen-spire-game-config_4.json).
    ar: Object.freeze(rule({ strength: 0.75, dexterity: 0.5, constitution: 0.25, wisdom: 0.25, intelligence: 0.25 })),
    dr: Object.freeze(rule({ strength: 0.5, dexterity: 0.75, constitution: 0.25, wisdom: 0.35, intelligence: 0.15 })),
    pr: Object.freeze(rule({ dexterity: 0.25, constitution: 0.5, wisdom: 0.5, intelligence: 0.75 })),
    poise: Object.freeze(rule({ constitution: 1, strength: 0.5, wisdom: 0.2, intelligence: 0.1 }, 1)),
    ward: Object.freeze(rule({ dexterity: 0.2, constitution: 0.3, wisdom: 1, intelligence: 0.5 }, 1)),
  }),
});

export function attributeRatingReceipt(config, attributes, id) {
  const rule = config?.ratings?.[id];
  if (!rule) throw new Error(`Missing ${id} rating formula`);
  const values = Object.fromEntries(ratingAttributeIds.map((attributeId) => [
    attributeId,
    attributes?.[attributeId] || 0,
  ]));
  const weights = Object.fromEntries(ratingAttributeIds.map((attributeId) => [
    attributeId,
    rule[attributeId],
  ]));
  const terms = Object.fromEntries(ratingAttributeIds.map((attributeId) => [
    attributeId,
    Math.floor(values[attributeId] * weights[attributeId] + 1e-9),
  ]));
  const weighted = Object.values(terms).reduce((sum, value) => sum + value, 0);
  const attribute = Math.floor(weighted * (config.multiplier ?? 1) + 1e-9);
  return { id, base: rule.base, multiplier: config.multiplier ?? 1, values, weights, terms, weighted, attribute, value: rule.base + attribute };
}

export function equipmentRatingBase(piece, id, profile = null) {
  if (!piece) return 0;
  if (id === 'ar' || id === 'pr') return piece.attackRating || 0;
  if (id === 'dr') return piece.defenseRating || 0;
  if (id === 'poise' && piece.kind === 'armor') return piece.poiseThreshold || 0;
  if (id === 'ward' && profile?.ratingId === 'ward') return piece.defenseRating || 0;
  return 0;
}

export function effectiveEquipmentRating(config, attributes, piece, profile, id = profile?.ratingId) {
  if (!ratingIds.includes(id)) throw new Error(`Unknown equipment rating '${id}'`);
  const attribute = attributeRatingReceipt(config, attributes, id);
  // THE ITEM'S RATING IS ITS OWN NUMBER, NOT A PLUS ON TOP OF IT (#1242). A
  // rating the item has a column for was written onto the piece by
  // `applyItemRatingConfig`, so `equipmentRatingBase` already reads it; one it
  // has no column for travels in the rules as `itemRatings` and REPLACES the
  // authored base. The old `bonuses.<item>` table is not read: a saved fight
  // still carries it, but the registries it is restored into already hold
  // authored + plus on the piece, and adding it here scored the plus twice.
  const itemKey = piece?.kind === 'armor' ? `armor:${piece.classId}:${piece.id}` : piece ? `armament:${piece.id}` : null;
  const configured = itemKey ? config?.itemRatings?.[itemKey]?.[id] : undefined;
  const equipmentBase = Number.isFinite(configured) ? configured : equipmentRatingBase(piece, id, profile);
  return {
    id,
    attributeBase: attribute.base,
    attributeValue: attribute.value,
    equipmentBase,
    value: attribute.value + equipmentBase,
  };
}
