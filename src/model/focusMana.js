// src/model/focusMana.js — the Focus Mana discount (owner, 2026-11-01: "armaments that have the focus tag
// (which is most sceptors) it reduces mana cost by 1 max(mp-1, 0)").
//
// Owner, 2026-11-01: "magic focus mana reduction effect only works on cards with the magic tag property". Magic cards
// cost 1 less Mana while in Prepared stance: only while the player is in the Prepared stance (any other stance, or none,
// gives no discount) and has an equipped armament carrying the Focus item type, the Mana cost of each MAGIC card (one
// carrying the spell camp or spell source tag) is lower by balance.mana.focusManaDiscount, floored at 0. A non-magic card that
// costs Mana (a weapon art) is not discounted. One Focus armament gives the discount; a second does not stack.
// Stamina is untouched. The tag id and amount are data (content/source/balanceMana.json).
import { equippedPieces } from './loadout.js';
import { activeCombatStance } from './combatTacticsDisplay.js';

/** The stored maneuver ids of the Prepared stance (Core maps casting to prepared; see stanceRules.js / profileStance.js). */
export const PREPARED_STANCE_MANEUVERS = Object.freeze(['casting', 'prepared']);

/** inPreparedStance(actor) → whether the actor's active combat stance is Prepared. */
export function inPreparedStance(actor) {
  const stance = activeCombatStance(actor);
  return !!stance && !stance.staggered && PREPARED_STANCE_MANEUVERS.includes(stance.maneuver);
}

/** The tags that make a card a magic card (the spell camp / spell source identity). */
export const MAGIC_CARD_TAGS = Object.freeze(['camp:spell', 'source:spell']);

/** cardIsMagicTagged(card) → whether the card carries a magic tag (not the looser "costs Mana" reading). */
export function cardIsMagicTagged(card) {
  const tags = card?.cardTags ?? card?.tags ?? [];
  return MAGIC_CARD_TAGS.some((tag) => tags.includes(tag));
}

/** focusManaDiscount(registries, loadout, classId, card, actor) → the Mana taken off this card (0 for a non-magic card, without a Focus armament, or outside the Prepared stance). */
export function focusManaDiscount(registries, loadout, classId, card, actor) {
  if (!cardIsMagicTagged(card) || !inPreparedStance(actor)) return 0;
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
