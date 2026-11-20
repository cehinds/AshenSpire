// src/model/loadout/equipped.js — what is equipped where, and the figure it draws.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { resolveUpgradedEquipment } from '../itemUpgrades.js';
import { projectZones, WORN_SLOT_IDS, HAND_SLOT_IDS } from '../zones.js';
import { slotHand } from './hands.js';

/** The piece in a slot's active set, or null. Armour resolves per class. */
export function equippedIn(registries, loadout, classId, slotId) {
  const ids = (loadout.sets || {})[slotId] || [];
  const id = ids[(loadout.active || {})[slotId] || 0];
  if (!id) return null;
  const eq = registries.equipment || {};
  const slot = (eq.slots || []).find((s) => s.id === slotId);
  if (slot && slot.kinds.includes('armor')) {
    return (eq.armour || []).find((o) => o.classId === classId && o.id === id) || null;
  }
  return (eq.armaments || []).find((a) => a.id === id) || null;
}

/** Every currently-worn piece, in slot order — the order mods apply in. */
export function equippedPieces(registries, loadout, classId, { itemUpgradeLevels = {} } = {}) {
  if (!loadout) return [];
  const out = [];
  for (const slot of (registries.equipment || {}).slots || []) {
    const piece = equippedIn(registries, loadout, classId, slot.id);
    if (piece && piece.kind === 'armor') {
      const itemRef = `armor/${piece.classId}/${piece.id}`;
      out.push(resolveUpgradedEquipment(registries, itemRef, itemUpgradeLevels[itemRef] || 0));
    } else if (piece) out.push(piece);
  }
  return out;
}

/**
 * figureSpec(registries, loadout, classId) →
 *   { armourId, rightId, leftId, rightMirror, leftMirror }
 *
 * What the sprite layers should be, derived rather than stored. Slots declare
 * their own `kinds`, so this finds the armour slot by what it accepts instead
 * of hard-coding 'armor', and the hands by slotHand() — a renamed slot keeps
 * working, and a fourth hand would too.
 *
 * A piece is drawn in THE SLOT IT IS IN. It used to be drawn in the hand its
 * own row named, so a right-handed weapon put in the left hand was drawn in the
 * right — and two of them at once collapsed onto one layer, last writer
 * winning: two weapons equipped, one weapon on the figure, no error anywhere
 * (Bjorn photographed it on `dev`, 2026-08-07). Nothing here reads piece.hand;
 * that field gates equipping (fitsSlot), which is a different question.
 *
 * The current full-frame art is authored at the sword socket for every
 * non-shield and at the off-hand socket for shields. The figure itself is
 * mirrored for the viewer, so a slot swap needs a per-layer mirror flag too:
 * `rightMirror` / `leftMirror` move the art onto the socket the slot names.
 * Those flags disappear when the producer is re-rendered from slot-neutral art.
 */
export function figureSpec(registries, loadout, classId) {
  const slots = (registries.equipment || {}).slots || [];
  const spec = {
    armourId: 'default', rightId: null, leftId: null,
    rightMirror: false, leftMirror: false,
    // The three worn layers the slot split added (plan phase 3b). Art is keyed
    // `<slot>_<id>` and a missing file draws nothing (assets.js equippedFigure),
    // so a layer here is an id and never a promise that a picture exists.
    headId: null, handsId: null, feetId: null,
  };
  if (!loadout) return spec;
  // THE ZONES ARE WHAT IS DRAWN. The projection reads the same loadout the
  // run saves (zones.js projectZones, registry-free), so the figure and the
  // save cannot disagree about what is worn or held: body ← zones.worn.body,
  // the three new layers ← zones.worn.head/hands/feet, the hands ← zones.hands.
  const { zones } = projectZones({ class: classId, loadout, relics: [], deck: [] });
  // The body layer is the RESOLVED armour row for this class, as it always
  // was: a raw id the table does not know (a stale save, a co-op member's
  // loadout that never crossed the load door) keeps the default body rather
  // than asking for art that does not exist.
  const body = zones.worn.body ? equippedIn(registries, loadout, classId, WORN_SLOT_IDS.body) : null;
  if (body) spec.armourId = body.id;
  spec.headId = zones.worn.head;
  spec.handsId = zones.worn.hands;
  spec.feetId = zones.worn.feet;
  // The hands need the PIECE (art key, shield mirroring), so each hand zone
  // resolves its slot's piece; the zone said which id, the table says how it
  // is drawn.
  for (const [zone, slotId] of Object.entries(HAND_SLOT_IDS)) {
    if (!zones.hands[zone]) continue;
    const slot = slots.find((s) => s.id === slotId);
    const piece = slot ? equippedIn(registries, loadout, classId, slotId) : null;
    if (!piece) continue;
    const hand = slotHand(slot);
    if (hand === 'right') {
      spec.rightId = piece.artKey || piece.id;
      spec.rightMirror = piece.kind === 'shield';
    } else if (hand === 'left') {
      spec.leftId = piece.artKey || piece.id;
      spec.leftMirror = piece.kind !== 'shield';
    }
  }
  return spec;
}

/** Tags granted by what you're wearing (deduplicated, slot order). */
export function loadoutTags(registries, loadout, classId) {
  const seen = [];
  for (const p of equippedPieces(registries, loadout, classId)) {
    for (const t of p.tags || []) if (!seen.includes(t)) seen.push(t);
  }
  return seen;
}
