export const ratingIds = Object.freeze(['ar', 'dr', 'pr', 'poise', 'ward']);
export const ratingAttributeIds = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);
const rule = (weights, base = 0) => ({ base, ...Object.fromEntries(ratingAttributeIds.map(id => [id, weights[id] || 0])) });

export const defaultRatingFormula = Object.freeze({
  multiplier: 1,
  ratings: Object.freeze({
    ar: Object.freeze(rule({ strength: 0.5 })),
    dr: Object.freeze(rule({ dexterity: 0.5 })),
    pr: Object.freeze(rule({ wisdom: 0.5, intelligence: 0.5 })),
    poise: Object.freeze(rule({ constitution: 1, strength: 0.5 }, 1)),
    ward: Object.freeze(rule({ wisdom: 1, intelligence: 0.5 }, 1)),
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
  const equipmentBase = equipmentRatingBase(piece, id, profile);
  const itemKey = piece?.kind === 'armor' ? `armor:${piece.classId}:${piece.id}` : piece ? `armament:${piece.id}` : null;
  const itemBonus = itemKey ? config?.bonuses?.[itemKey]?.[id] || 0 : 0;
  return {
    id,
    attributeBase: attribute.base,
    attributeValue: attribute.value,
    equipmentBase,
    itemBonus,
    value: attribute.value + equipmentBase + itemBonus,
  };
}
