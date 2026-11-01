// src/model/focusMana.js — the Focus Mana discount (owner, 2026-11-01: "armaments that have the focus tag
// (which is most sceptors) it reduces mana cost by 1 max(mp-1, 0)").
//
// While the player has an equipped armament carrying the Focus item type, every card's Mana cost is lower by
// balance.mana.focusManaDiscount, floored at 0. One Focus armament gives the discount; a second does not stack.
// Stamina is untouched. The tag id and amount are data (content/source/balanceMana.json).
import { equippedPieces } from './loadout.js';

/** focusManaDiscount(registries, loadout, classId) → the Mana taken off each card (0 without a Focus armament). */
export function focusManaDiscount(registries, loadout, classId) {
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
