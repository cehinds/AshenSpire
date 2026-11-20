// src/model/loadout/hands.js — which hand a piece is in, which it may be held in, and the gate between them.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).
//
// HANDS — one fact, one home (Law 0 clause 4). Which hand a piece is IN is the
// SLOT's fact: the player put it there. The piece's own `hand` column says only
// which hand it MAY be held in — eligibility, never location. Those are two
// different facts and they used to be read out of one field, which is how two
// weapons could go in and one come out (Bjorn, 2026-08-07). slotHand() is the
// only answer to "which hand is this", pieceHand() the only answer to "which
// hand may this go in", and fitsSlot() is the only gate between them.

import { cardManaPolicy } from '../../content/generated/cardManaPolicy.js';

/** The closed set. A third hand is a new word — engine, one act (Law 1 c1). */
export const HANDS = Object.freeze(['left', 'right']);
export const EQUIPMENT_ROLES = Object.freeze(['attack', 'guard', 'technique']);
export const ARMAMENT_INTRINSIC_STAT_FIELDS = Object.freeze([
  'attackRating',
  'defenseRating',
  'weight',
  'weaponArtManaCost',
  'uniqueSkillStaminaCost',
]);

/**
 * Validate presentation-only armament facts without folding them into card or
 * combat math. Every field is explicit: absence is never interpreted as zero.
 */
export function armamentIntrinsicStatProblems(piece) {
  const id = piece && piece.id || '?';
  const problems = [];
  for (const field of ARMAMENT_INTRINSIC_STAT_FIELDS) {
    const value = piece && piece[field];
    if (!Number.isInteger(value) || value < 0) {
      problems.push(`${id}: ${field} must be an explicit non-negative integer`);
    }
  }
  if (Number.isInteger(piece?.weight) && piece.weight !== piece.poiseThreshold) {
    problems.push(`${id}: weight ${piece.weight} must equal authored poiseThreshold ${piece.poiseThreshold}`);
  }
  const isStaffTechnique = (piece?.itemTypeTags || []).includes('item:magic-focus')
    && piece?.techniqueProfile === 'staffTechnique';
  const hasWeaponArts = (piece?.weaponCardPackage?.weaponArtDefaults || []).length > 0;
  const minimumManaCost = hasWeaponArts || isStaffTechnique ? cardManaPolicy.minimumMana : 0;
  if (piece?.weaponArtManaCost < minimumManaCost) {
    problems.push(`${id}: weaponArtManaCost must be at least ${minimumManaCost} for its authored weapon arts`);
  }
  if (piece?.uniqueSkillStaminaCost !== 0) {
    problems.push(`${id}: uniqueSkillStaminaCost must remain 0 until an explicit unique-skill consumer exists`);
  }
  return problems;
}

/**
 * slotHand(slot) → 'left' | 'right' | null — WHERE A SLOT IS.
 *
 * The one home. `null` is not "unknown", it is "this slot is not a hand":
 * armour is worn and a talisman is carried, so neither is held in one and
 * neither is drawn in one. equipSlots.csv `hand` is the only input, on purpose
 * — the id used to be sniffed for the substring 'left', which meant renaming
 * the slot moved the sprite and said nothing.
 */
export function slotHand(slot) {
  const h = slot && slot.hand;
  return HANDS.includes(h) ? h : null;
}

/**
 * pieceHand(piece) → 'left' | 'right' | null — WHERE A PIECE MAY GO.
 *
 * Eligibility, and only eligibility. `either` and a piece with no `hand` at all
 * (every armour set) are unconstrained, and read as null.
 */
export function pieceHand(piece) {
  const h = piece && piece.hand;
  return HANDS.includes(h) ? h : null;
}

/**
 * fitsSlot(slot, piece) → boolean — may this piece go in this slot?
 *
 * Two gates, both of them data: the slot's `kinds` and the piece's `hand`. The
 * only predicate in the tree that answers this, so the picker cannot offer what
 * equipPiece() refuses — offering a piece and then silently not taking it is
 * the exact shape of a player saying "the slot won't accept it".
 */
export function fitsSlot(slot, piece) {
  if (!slot || !piece) return false;
  if (!(slot.kinds || []).includes(piece.kind)) return false;
  const may = pieceHand(piece);
  return may === null || may === slotHand(slot);
}
