// src/model/validate/deckRulesTable.js — the deck-rules table shape check (SPEC §14.1).
// Split out of validate.js; validate.js re-exports deckRulesTableProblems.

import { CARD_TYPES } from '../schemas.js';

/**
 * deckRulesTableProblems(table, cards, err) — the shape the deck editor reads
 * (SPEC §14.1): whole-number ranges with min ≤ max, defaults inside them, a
 * `where` list holding the default, string lists for `singleCopy`, and
 * unlimited ids that name real cards.
 */
export function deckRulesTableProblems(table, cards, err, nodes) {
  const at = (path, msg) => err(`deckRules.${path}`, msg);
  if (!table || typeof table !== 'object') { at('', 'must be an object'); return; }
  const range = (key) => {
    const r = table[key];
    if (!r || !Number.isInteger(r.min) || !Number.isInteger(r.max) || r.min < 0 || r.min > r.max) {
      at(key, `must be { min, max } whole numbers with 0 ≤ min ≤ max, got ${JSON.stringify(r)}`);
      return null;
    }
    return r;
  };
  const sizes = range('sizeRange');
  const copies = range('copyRange');
  const d = table.defaults || {};
  for (const key of ['deckEditing', 'deckMinUnlimited', 'deckMaxUnlimited', 'playInDeckOrder']) {
    if (typeof d[key] !== 'boolean') at(`defaults.${key}`, `must be true or false, got ${JSON.stringify(d[key])}`);
  }
  for (const key of ['deckMinSize', 'deckMaxSize']) {
    if (!Number.isInteger(d[key]) || (sizes && (d[key] < sizes.min || d[key] > sizes.max))) at(`defaults.${key}`, `must be a whole number within sizeRange, got ${JSON.stringify(d[key])}`);
  }
  if (Number.isInteger(d.deckMinSize) && Number.isInteger(d.deckMaxSize) && d.deckMinSize > d.deckMaxSize) at('defaults.deckMinSize', `(${d.deckMinSize}) must not exceed deckMaxSize (${d.deckMaxSize})`);
  if (!Number.isInteger(d.classSpellPowerCopies) || (copies && (d.classSpellPowerCopies < copies.min || d.classSpellPowerCopies > copies.max))) at('defaults.classSpellPowerCopies', `must be a whole number within copyRange, got ${JSON.stringify(d.classSpellPowerCopies)}`);
  const where = table.where;
  if (!Array.isArray(where) || !where.length || !where.every((w) => typeof w === 'string')) at('where', 'must be a non-empty list of strings');
  else if (!where.includes(d.deckEditingWhere)) at('defaults.deckEditingWhere', `must be one of ${where.join(', ')}, got ${JSON.stringify(d.deckEditingWhere)}`);
  const single = table.singleCopy || {};
  for (const key of ['types', 'tags']) {
    if (!Array.isArray(single[key]) || !single[key].every((v) => typeof v === 'string' && v)) at(`singleCopy.${key}`, 'must be a list of non-empty strings');
  }
  // A typo here would silently lift the copy limit, so each value must name a
  // real card type or tag node.
  const nodeIds = new Set((Array.isArray(nodes) ? nodes : []).map((n) => n && n.id));
  if (Array.isArray(single.types)) single.types.forEach((v, i) => { if (!CARD_TYPES.includes(v)) at(`singleCopy.types[${i}]`, `names no card type: '${v}' (one of ${CARD_TYPES.join(', ')})`); });
  if (Array.isArray(single.tags) && nodeIds.size) single.tags.forEach((v, i) => { if (!nodeIds.has(v)) at(`singleCopy.tags[${i}]`, `names no tag node: '${v}'`); });
  for (const key of ['universalTags', 'weaponTags']) {
    const values = table.equipmentEligibility?.[key];
    if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !value)) at(`equipmentEligibility.${key}`, 'must be a list of tag ids');
    else values.forEach((value, index) => { if (nodeIds.size && !nodeIds.has(value)) at(`equipmentEligibility.${key}[${index}]`, `names no tag node: '${value}'`); });
  }
  const ids = new Set((Array.isArray(cards) ? cards : []).map((c) => c && c.id));
  if (!Array.isArray(table.unlimitedCardIds)) at('unlimitedCardIds', 'must be a list of card ids');
  else table.unlimitedCardIds.forEach((id, i) => { if (ids.size && !ids.has(id)) at(`unlimitedCardIds[${i}]`, `names no card: '${id}'`); });
}
