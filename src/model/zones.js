// src/model/zones.js — the character's zones, and which loadout slot fills each
// (plan phases 3a and 3b). A LEAF: it imports nothing, so state.js (the run)
// and loadout.js (the figure) and validate.js (the slot table's door) can all
// read one map without a cycle.
//
// THE MAP IS THE ONE HOME of "which slot is which zone". equipSlots.csv says
// what a slot is called, holds and swaps; this says where the run carries it.
// A slot row that no zone names is refused at boot (validate.js), because a
// piece the player put there would have nowhere to ride in the save.

/** The worn zone's slots, in order. `talisman` is the slot the slot table
 * already declared before the split; the other four are the proposal's (§4). */
export const WORN_ZONE_SLOTS = Object.freeze(['body', 'head', 'hands', 'feet', 'talisman']);

/** worn zone slot → the loadout slot id that fills it. `body` is the legacy
 * `armor` slot: renaming the slot id would move every save's `loadout.sets.armor`,
 * so the zone is the new word and the slot keeps the old one. */
export const WORN_SLOT_IDS = Object.freeze({ body: 'armor', head: 'head', hands: 'hands', feet: 'feet', talisman: 'talisman' });

/** hands zone slot → the loadout slot id that fills it. */
export const HAND_SLOT_IDS = Object.freeze({ main: 'rightHand', off: 'leftHand' });

const invert = (map) => Object.freeze(Object.fromEntries(Object.entries(map).map(([zone, slotId]) => [slotId, zone])));
const WORN_ZONE_OF = invert(WORN_SLOT_IDS);
const HAND_ZONE_OF = invert(HAND_SLOT_IDS);

/** The worn zone slot a loadout slot fills, or null when it is not worn. */
export const wornZoneOf = (slotId) => WORN_ZONE_OF[slotId] || null;
/** The hands zone slot a loadout slot fills, or null when it is not held. */
export const handZoneOf = (slotId) => HAND_ZONE_OF[slotId] || null;

const idOrNull = (v) => (typeof v === 'string' && v ? v : null);

/** The item a loadout slot has ACTIVE, or null. */
export function activeIn(loadout, slotId) {
  const sets = loadout && loadout.sets && loadout.sets[slotId];
  if (!Array.isArray(sets)) return null;
  const index = loadout.active && Number.isInteger(loadout.active[slotId]) ? loadout.active[slotId] : 0;
  return idOrNull(sets[index]);
}

/**
 * projectZones(run) → { zones, collection }
 *
 * The character's cards, by zone, READ OFF THE FIELDS THAT OWN THEM TODAY:
 *   core     the class (phase 5 gives the class card content; the id is the
 *            class id, as the plan states)
 *   worn     each slot ← the active piece in the loadout slot WORN_SLOT_IDS
 *            names for it (body ← armor; head/hands/feet ← their own slots,
 *            null while no piece is authored; talisman ← talisman)
 *   hands    main ← the active right-hand piece, off ← the active left-hand
 *   passive  the relics, in the order held
 *   collection  every card instance the run owns — today exactly the deck,
 *            because nothing yet lets a card be owned and not decked
 *
 * Pure, and registry-free: a migration must be able to call it on a save
 * with no content in hand (DEVELOPER.md rule 1). It never reads `zones`.
 */
export function projectZones(run) {
  const loadout = run && run.loadout;
  const worn = {};
  for (const zone of WORN_ZONE_SLOTS) worn[zone] = activeIn(loadout, WORN_SLOT_IDS[zone]);
  const hands = {};
  for (const [zone, slotId] of Object.entries(HAND_SLOT_IDS)) hands[zone] = activeIn(loadout, slotId);
  return {
    zones: {
      core: idOrNull(run && run.class),
      // The core card's picked tree nodes (plan phase 5b), a copy of run.coreTags.
      coreTags: Array.isArray(run && run.coreTags) ? run.coreTags.filter((id) => typeof id === 'string' && id) : [],
      worn,
      hands,
      passive: Array.isArray(run && run.relics) ? run.relics.filter((id) => typeof id === 'string' && id) : [],
    },
    collection: Array.isArray(run && run.deck) ? run.deck.filter(Boolean).map((card) => structuredClone(card)) : [],
  };
}
