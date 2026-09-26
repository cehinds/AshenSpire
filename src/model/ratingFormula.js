import { statRowValue } from './derivedStats.js';

export const ratingIds = Object.freeze(['ar', 'dr', 'pr', 'poise', 'ward']);
export const ratingAttributeIds = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);

// THE RATING FORMULA IS A STAT ROW (ruleset 7, owner 2026-09-24). AR, DR, PR,
// Poise and Ward are rows of the derived-stat table, priced by the one row
// formula (`statRowValue`), and `config.ratings` holds the rows THIS run reads
// (model/statRows.js ratingsConfigFor). The frozen ruleset-6 formula and its
// global multiplier live on only as the legacy adapter there, so a fight saved
// under them — whose rules still say `multiplier` — is priced as it was.

/**
 * attributeRatingReceipt(config, attributes, id, level) → the attribute part of
 * one rating: `{ base, weights, terms, weighted, attribute, value, … }`.
 */
export function attributeRatingReceipt(config, attributes, id, level = undefined) {
  const rule = config?.ratings?.[id];
  if (!rule) throw new Error(`Missing ${id} rating formula`);
  // A saved fight from before ruleset 7 states one multiplier for every row.
  const legacyMultiplier = Number.isFinite(config.multiplier) && config.multiplier !== 1 && rule.multiplier === undefined;
  const row = legacyMultiplier ? { ...rule, multiplier: config.multiplier } : rule;
  const receipt = statRowValue(row, { attributes, level, statId: id, lenientAttributes: true });
  const values = Object.fromEntries(ratingAttributeIds.map((attributeId) => [attributeId, Number(attributes?.[attributeId]) || 0]));
  const weights = Object.fromEntries(ratingAttributeIds.map((attributeId) => [attributeId, row[attributeId] || 0]));
  const terms = Object.fromEntries(ratingAttributeIds.map((attributeId) => [attributeId, receipt.terms[attributeId] || 0]));
  return {
    id,
    base: receipt.base,
    multiplier: Number.isFinite(row.multiplier) ? row.multiplier : 1,
    values,
    weights,
    terms,
    weighted: receipt.points,
    levelBonus: receipt.levelBonus,
    attribute: receipt.value - receipt.base,
    min: receipt.min,
    max: receipt.max,
    value: receipt.value,
  };
}

export function equipmentRatingBase(piece, id, profile = null) {
  if (!piece) return 0;
  if (id === 'ar' || id === 'pr') return piece.attackRating || 0;
  if (id === 'dr') return piece.defenseRating || 0;
  if (id === 'poise' && piece.kind === 'armor') return piece.poiseThreshold || 0;
  if (id === 'ward' && profile?.ratingId === 'ward') return piece.defenseRating || 0;
  return 0;
}

export function effectiveEquipmentRating(config, attributes, piece, profile, id = profile?.ratingId, level = undefined) {
  if (!ratingIds.includes(id)) throw new Error(`Unknown equipment rating '${id}'`);
  const attribute = attributeRatingReceipt(config, attributes, id, level);
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
