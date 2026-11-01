// src/model/focusMana.js — the Focus Mana discount (owner, 2026-11-01: "armaments that have the focus tag
// (which is most sceptors) it reduces mana cost by 1 max(mp-1, 0)").
//
// Owner, 2026-11-01: "magic focus mana reduction effect only works on cards with the magic tag property". While the
// player has an equipped armament carrying the Focus item type, the Mana cost of each MAGIC card (one carrying the
// spell camp or spell source tag) is lower by balance.mana.focusManaDiscount, floored at 0. A non-magic card that
// costs Mana (a weapon art) is not discounted. One Focus armament gives the discount; a second does not stack.
// Stamina is untouched. The tag id and amount are data (content/source/balanceMana.json).
import { equippedPieces } from './loadout.js';

/** The tags that make a card a magic card (the spell camp / spell source identity). */
export const MAGIC_CARD_TAGS = Object.freeze(['camp:spell', 'source:spell']);

/** cardIsMagicTagged(card) → whether the card carries a magic tag (not the looser "costs Mana" reading). */
export function cardIsMagicTagged(card) {
  const tags = card?.cardTags ?? card?.tags ?? [];
  return MAGIC_CARD_TAGS.some((tag) => tags.includes(tag));
}

/** focusManaDiscount(registries, loadout, classId, card) → the Mana taken off this card (0 for a non-magic card or without a Focus armament). */
export function focusManaDiscount(registries, loadout, classId, card) {
  if (!cardIsMagicTagged(card)) return 0;
  const rule = registries?.balance?.mana;
  const amount = Number(rule?.focusManaDiscount);
  if (!(amount > 0) || !rule.focusItemType || !loadout) return 0;
  const held = equippedPieces(registries, loadout, classId)
    .some((piece) => piece.kind !== 'armor' && (piece.itemTypeTags || []).includes(rule.focusItemType));
  return held ? Math.floor(amount) : 0;
}

/** applyFocusManaDiscount(mana, discount) → max(mana - discount, 0). */
export function applyFocusManaDiscount(mana, discount) {
  return discount > 0 ? Math.max(0, mana - discount) : mana;
}
