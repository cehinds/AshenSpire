// src/model/loadout/grip.js — grip: one-handed, two-handed or dual.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { slotHand } from './hands.js';
import { WeaponCardPackageModel } from './weaponPackages.js';
import { equippedIn } from './equipped.js';

/**
 * GRIP (plan phase 3c, proposal §5). How the hands hold what they hold, READ
 * off the loadout and never stored: a grip is a function of the two hand
 * slots, so a stored grip would be a second home for one fact (3NF), and the
 * moment the player gains a grip CHOICE (two-handing a one-hander) that
 * choice becomes the stored intent and this the reader of it.
 *
 *   two   either hand holds a piece whose package requires both hands
 *   dual  both hands hold a piece, neither two-handed, sharing an item
 *         type tag (item:blade, item:shield, …) — the "same armament group"
 *   one   anything else, including empty hands
 *
 * gripOf(registries, loadout, classId) → { mode, group, right, left } where
 * `group` is the shared item type tag under `dual` and null otherwise, and
 * right/left are the held piece ids (null when empty).
 */
export const GRIP_MODES = Object.freeze(['one', 'two', 'dual']);

function handHeld(registries, loadout, classId, hand) {
  const slot = (((registries || {}).equipment || {}).slots || []).find((row) => slotHand(row) === hand);
  if (!slot || !loadout) return { piece: null, twoHanded: false };
  const piece = equippedIn(registries, loadout, classId, slot.id);
  const pkg = piece ? WeaponCardPackageModel.fromPiece(registries, piece) : null;
  return { piece, twoHanded: Boolean(pkg && pkg.handsRequired === 2) };
}

export function gripOf(registries, loadout, classId) {
  const right = handHeld(registries, loadout, classId, 'right');
  const left = handHeld(registries, loadout, classId, 'left');
  const out = { mode: 'one', group: null, right: right.piece ? right.piece.id : null, left: left.piece ? left.piece.id : null };
  if (right.twoHanded || left.twoHanded) return { ...out, mode: 'two' };
  if (right.piece && left.piece) {
    const shared = (right.piece.itemTypeTags || []).find((tag) => (left.piece.itemTypeTags || []).includes(tag));
    if (shared) return { ...out, mode: 'dual', group: shared };
  }
  return out;
}

/** The framework tags a grip derives — read at the action snapshot, written to no card. */
export const GRIP_TAGS = Object.freeze({ one: Object.freeze([]), two: Object.freeze(['equipment.twoHanded']), dual: Object.freeze(['equipment.dualWield']) });
export function gripTags(grip) {
  const mode = grip && grip.mode;
  if (!GRIP_MODES.includes(mode)) throw new Error(`gripTags: '${mode}' is not a grip mode (${GRIP_MODES.join(', ')})`);
  return [...GRIP_TAGS[mode]];
}

/**
 * gripRefusal(registries, loadout, classId, slotId, setIndex, itemId) → '' or
 * the sentence that refuses the grip the hands would be left in. The one
 * illegal grip today is a two-handed piece beside an occupied other hand;
 * `dual` is legal on its own (its attribute gate is plan phase 9's row). The
 * loadout is judged AS THE EDIT LEAVES IT — the candidate in its cell, every
 * active index unchanged — against the other hand's active piece: the active
 * pair is the invariant, and it is also held by the deck plan's gate
 * (buildEquippedWeaponCardPlan throws on a two-hander beside an occupied
 * off-hand, which cycleSet and equipPiece both run). This is the same rule
 * asked EARLIER — at canEquip, with a sentence — so the Armoury can say why
 * before the act rather than after it.
 *
 * A MOVE IS NOT A SECOND COPY: equipping a piece that is already in the
 * other hand moves it (applyEquipTransition clears the old cell), so the
 * trial clears every other hand cell holding the candidate before it reads
 * the hands — else a two-hander moved from left to right would be refused
 * for being beside itself.
 */
export function gripRefusal(registries, loadout, classId, slotId, setIndex, itemId) {
  const slots = (((registries || {}).equipment || {}).slots || []);
  const slot = slots.find((row) => row.id === slotId);
  if (!slot || !slotHand(slot) || !loadout) return '';
  const trial = structuredClone(loadout);
  trial.sets = trial.sets || {}; trial.active = trial.active || {};
  for (const hand of slots.filter((row) => slotHand(row))) {
    trial.sets[hand.id] = [...(trial.sets[hand.id] || [])].map((held) => (itemId && held === itemId ? null : held));
  }
  // THE ACTIVE INDEX IS NOT MOVED: equipPiece edits the cell and never
  // activates it, so a two-hander laid in a prepared set beside an occupied
  // active hand is a legal edit here; the day the player cycles to it, the
  // deck plan's gate at cycleSet refuses the pair. Judging the loadout as it
  // will actually be is the only reading that cannot refuse a legal edit.
  if (Number.isInteger(setIndex) && setIndex >= 0) trial.sets[slotId][setIndex] = itemId || null;
  const right = handHeld(registries, trial, classId, 'right');
  const left = handHeld(registries, trial, classId, 'left');
  if ((right.twoHanded && left.piece) || (left.twoHanded && right.piece)) {
    const two = right.twoHanded ? right.piece : left.piece;
    const other = right.twoHanded ? left.piece : right.piece;
    return `${two.name || two.id} needs both hands, and ${other.name || other.id} is in the other one. Free that hand first.`;
  }
  return '';
}
