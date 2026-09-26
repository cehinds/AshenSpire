// src/content/deckRules.js — the deck editor's rules (SPEC §14.1), as data.
//
// Every value here is a DEFAULT: Settings → Advanced → Deck shows one row per
// key and reads its default from this object, and model/deckRules.js resolves a
// profile's stored choices against it. The owner tunes these later; nothing
// else in the tree may spell one of these numbers.
export const deckRules = Object.freeze({
  defaults: Object.freeze({
    // The editor exists at all. Off: the deck changes only through rewards,
    // the merchant's removal and the Armoury, as before.
    deckEditing: true,
    // 'free' — from the map's Quick Access and the Armoury at any moment out of
    // combat; 'restOnly' — only at a place whose tags carry `deckEdit`.
    deckEditingWhere: 'free',
    deckMinSize: 10,
    deckMinUnlimited: false,
    deckMaxSize: 40,
    deckMaxUnlimited: true,
    // The draw pile is the deck in the order the editor arranged it.
    playInDeckOrder: false,
  }),
  // The range the Settings rows for the deck size accept.
  sizeRange: Object.freeze({ min: 0, max: 200 }),
  // Where the editor may be opened from ('free' | 'restOnly').
  where: Object.freeze(['free', 'restOnly']),
  // Plain card ids a run with no equipment may add without limit. An equipped
  // run's basics are its attack-slot and guard instances, matched by role.
  unlimitedCardIds: Object.freeze(['strike', 'defend']),
});
