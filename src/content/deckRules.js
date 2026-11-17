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
    // 'free' — from the Armoury at any moment out of combat; 'restOnly' — only
    // at a place whose tags carry `deckEdit`.
    deckEditingWhere: 'free',
    deckMinSize: 10,
    deckMinUnlimited: false,
    deckMaxSize: 40,
    deckMaxUnlimited: true,
    // The draw pile is the deck in the order the editor arranged it.
    playInDeckOrder: false,
    // Owner ruling 2026-09-26: a class's own spells and Powers are limited to
    // this many copies in the deck (Strike/Defend stay unlimited; arts and
    // techniques stay limited to the copies owned).
    classSpellPowerCopies: 1,
  }),
  // What counts as a class spell or Power: a card of a class (not colorless)
  // whose type is one of `types` or that carries one of `tags`.
  singleCopy: Object.freeze({ types: Object.freeze(['power']), tags: Object.freeze(['source:spell']) }),
  // The range the copy-limit Settings row accepts.
  copyRange: Object.freeze({ min: 1, max: 10 }),
  // The range the Settings rows for the deck size accept.
  sizeRange: Object.freeze({ min: 0, max: 200 }),
  // Where the editor may be opened from ('free' | 'restOnly').
  where: Object.freeze(['free', 'restOnly']),
  // Owner, 2026-11-17: in Core the editor's minimum drops by 1 at each of
  // these character levels. With the min-slot relics (1 each) a typical run
  // lands near 8; relics and levels together may take it lower.
  minimumReductionLevels: Object.freeze([4, 8, 12]),
  // The hard safety floor (owner, 2026-11-17): levels and relics never take the
  // minimum below 1, so a deck is never empty. 1 is what the engine already
  // needs — sizeRange and deckMaxSize already require a deck to hold at least
  // one card. A player's own lower minimum setting (0, or unlimited) is kept.
  minimumReductionSafetyFloor: 1,
  // Owner, 2026-11-17: at Core creation the player chooses how many of each of
  // these unranked cards start in the deck (basic attack, smash, counter,
  // block, sweep). The class's other starting cards stay as authored.
  // Basic Training and Graduate (relic item properties) open unlimited copies only of
  // collected, own-class or colorless cards of these rarities (review of #2815).
  trainingRarities: Object.freeze(['starter', 'common']),
  creationPool: Object.freeze(['core.strike', 'core.smash', 'core.counter', 'core.defend', 'core.sweep']),
  // Owner, 2026-11-17: a caster's pool swaps the basic attack for the most basic
  // unranked spell, Arcane Spark (core.cantrip): the Starseer's own starter
  // cantrip, and the only loose starter cantrip in Core (the Herald's Mana Surge
  // is the sceptre's lent art, not a card the deck owns). Martial classes keep Strike.
  creationPoolSwaps: Object.freeze({
    starseer: Object.freeze({ 'core.strike': 'core.cantrip' }),
    herald: Object.freeze({ 'core.strike': 'core.cantrip' }),
  }),
  // Plain card ids a run with no equipment may add without limit. An equipped
  // run's basics are its attack-slot and guard instances, matched by role.
  unlimitedCardIds: Object.freeze(['strike', 'defend']),
  equipmentEligibility: Object.freeze({
    universalTags: Object.freeze(['basic']),
    weaponTags: Object.freeze(['blade', 'bow', 'ranged']),
  }),
});
