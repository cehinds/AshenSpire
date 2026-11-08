// src/model/loadout/slotLadder.js — the slot ladder: three states, not a three-valued field.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

//
// Constantine: *"starts with slots locked (but only shows the next locked
// thing). so for weapon slots, it may start with just 1 with the second one
// shows a locked icon, but the third one doesn't show until the second is
// unlocked."*
//
// THE OBVIOUS FORM IS A THREE-VALUED FIELD PER CELL AND IT IS #78 AGAIN. A
// closed set of `open|next|hidden` written on each cell is a closed set PER
// CELL, so the vocabulary is the PRODUCT over cells — and that product is full
// of things nobody built: a ladder with two locked steps, a hidden cell BEFORE
// an open one, a slot with no open cell at all. Marina's property, house-wide:
// A CLOSED SET MUST STAY CLOSED UNDER WHATEVER FACTORISATION REPLACES IT.
//
// SO THE STATES ARE A DERIVATION, NOT A VOCABULARY. There is exactly one number
// — how many sets of this slot are open — and the three states are arithmetic
// on it against the cell's index. Out-of-order and two-locked are not invalid,
// they are UNREPRESENTABLE, which is the stronger thing and the same move as
// #91's `subject` pointer. Nothing here is authored per cell, so there is
// nothing for an author to write and therefore nothing to fall out of the set.
//
// AND THE NUMBER IS NOT A NEW SAVE KEY EITHER. A rung is something you EARN, and
// this game already has one home for earned things: `meta.unlocked`, filled by
// evaluateUnlocks from unlocks.csv. A rung is a ROW there — `kind` is already a
// column, and **the EARNING path never reads it**: `evaluateUnlocks` tests
// `condition` against progress and returns ids, so a new `kind` value is earned
// with no engine change at all (Law 0 clause 2). What is new is the CONSUMER,
// and that is this file: one word, one act, schema-free.
//
// *(Corrected by Vira at gate: the first draft of this comment said "nothing in
// the tree branches on its value", and `slotRungs` two screens down branches on
// it in the same commit that shipped the sentence. It was true of the earning
// path and false of the tree, and the difference is the whole claim — so it now
// says which path it is talking about.)*
//
//     id,kind,ref,name,condition,param,reveal,hint
//     rack2,slot,rightHand,Second Rack Slot,reachAct,2,listed,Reach the Stitched Court.
//
// A "TURN ONE" LADDER THAT NOTHING CAN CLIMB WOULD BE A REFUSAL WITH NO REASON.
// The next cell is shown only when a rung exists that would open it — so a slot
// with no rungs authored shows its open cells and stops, and refuses(){} is
// never asked to mark a control whose reason is the empty string. The reason a
// locked cell gives IS that rung's own `hint`, which is content. No sentence
// about locks is written in this file or in the screen.

/** The unlocks.csv `kind` that opens a set slot. One string, one home. */
export const SLOT_RUNG_KIND = 'slot';

/** The rungs of one slot's ladder, in authored order. Rung N opens set N+1. */
export function slotRungs(registries, slotId) {
  return ((registries || {}).unlocks || [])
    .filter((u) => u && u.kind === SLOT_RUNG_KIND && u.ref === slotId);
}

/**
 * openedSets(registries, slot, { meta, loadout }) → how many sets are USABLE.
 *
 * One open always: a slot you cannot use at all is not a slot, it is an absence,
 * and `sets` already says the slot exists.
 *
 * THE LEGACY FLOOR IS THE EDGE THAT WILL ACTUALLY BITE, and it is the state my
 * change INVENTS. Every loadout written before today has `sets` full-width and
 * all of it reachable, so a save can hold a weapon in set 3 with zero rungs
 * earned. Without this line that weapon is in a cell the player cannot see,
 * still counted by carriedIds, still stamping their deck — a piece stranded
 * behind a lock that did not exist when they put it there. So the loadout's own
 * contents raise the floor: what you are already holding is by definition open.
 */
export function openedSets(registries, slot, { meta = {}, loadout = null } = {}) {
  const cap = Math.max(1, Number(slot && slot.sets) || 1);
  const earned = new Set((meta && meta.unlocked) || []);
  let opened = 1;
  for (const u of slotRungs(registries, slot.id)) if (earned.has(u.id)) opened += 1;
  const ids = ((loadout && loadout.sets) || {})[slot.id] || [];
  for (let i = 0; i < ids.length; i += 1) if (ids[i]) opened = Math.max(opened, i + 1);
  return Math.min(cap, opened);
}

/**
 * visibleSets(...) → how many cells the slot DRAWS: the open ones, plus the one
 * step ahead when there is a rung left to earn. Exactly one lookahead, because
 * it is `+1` and not a range.
 */
export function visibleSets(registries, slot, ctx = {}) {
  const cap = Math.max(1, Number(slot && slot.sets) || 1);
  const opened = openedSets(registries, slot, ctx);
  const ceiling = Math.min(cap, 1 + slotRungs(registries, slot.id).length);
  return opened < ceiling ? opened + 1 : opened;
}

/** The rung that would open cell `index`, or null if nothing can. */
export function rungFor(registries, slot, index) {
  return slotRungs(registries, slot.id)[index - 1] || null;
}

/**
 * setCellState(index, opened, visible) → 'open' | 'next' | 'hidden'.
 * Total, ordered, and derived — the whole closed set, in three comparisons.
 */
export function setCellState(index, opened, visible) {
  if (index < opened) return 'open';
  if (index < visible) return 'next';
  return 'hidden';
}
