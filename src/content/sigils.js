// src/content/sigils.js — sigils, the brief's "runes" (SPEC §14.3).
//
// A sigil is renamed from "rune" because that word is this spec's pre-scrub
// name for the currency (cinders). Each row is `{ id, name, rarity, cost,
// blurb }`.
//
// WHAT IT DOES IS NOT WRITTEN HERE (Codex on #1376; coordinator ruling). A
// sigil's effect is a property rule, as a relic's and a companion's are: its
// `family = sigil` row in content/source/tagging.csv names a leaf under the
// `sigil` branch of `property` in nodes.csv, whose rule lives in
// nodeEffects.json with its numbers bound to balance.sigils.*. stampTags
// derives `propertyTags`. Its numbers are Settings rows, so a blurb names
// none (the rule's own words are nodeTerms.csv's). A sigil set into a slot of
// an EQUIPPED armament mounts as a `sigil` carrier (engine/properties.js, SPEC §14.4). One carried
// in `run.sigils`, or slotted in a piece that is not worn, mounts nowhere.
// validateContent refuses a row that writes `triggers` or `modifiers`, and one
// with no property tag.
//
// PRICES. `cost` is the sigil's own price; the market charges
// `gameConfig.shops.market.sigils.pricePct` percent of it (content/shops.js),
// so the owner tunes what the shelf asks in Settings without editing a row.
// The blacksmith sells no sigils; it cuts slots and sets them (§14.4).
//
// LEGENDARY SIGILS are SPEC §15.4's: `{ id, name, rarity: 'legendary', blurb }`,
// with no cost, never shop stock, and never slotted. One works while it is
// ATTUNED in the Armoury's Sigils panel (model/sigils.js attuneSigil), up to
// `balance.sigils.attuneMax` at a time, and a fight or a treasure room can drop
// one (balance.sigils.dropChancePct, shipped off). Each derives exactly one
// property tag, and each rule is an on/if combination no relic uses.
export const sigils = [
  { id: 'emberSigil', name: 'Ember Sigil', rarity: 'common', cost: 180, blurb: 'An ember set in steel: it raises a guard at the start of each fight.' },
  { id: 'thornSigil', name: 'Thorn Sigil', rarity: 'common', cost: 180, blurb: 'A thorn set in steel: your first attack hit of each fight makes the foe bleed.' },
  { id: 'tideSigil', name: 'Tide Sigil', rarity: 'uncommon', cost: 260, blurb: 'A tide set in steel: every few cards you play in a fight draw you another.' },
  { id: 'hearthSigil', name: 'Hearth Sigil', rarity: 'rare', cost: 360, blurb: 'A hearth set in steel: whenever you heal, it raises a guard.' },
  { id: 'vigilSigil', name: 'Sigil of the Last Vigil', rarity: 'legendary', blurb: 'A candle that never gutters: when you enter a fight already wounded, it raises a guard.' },
  { id: 'pyreSigil', name: 'Pyre Sigil', rarity: 'legendary', blurb: 'An ember of the old pyres: every card you burn away raises a guard.' },
  { id: 'gravelightSigil', name: 'Gravelight Sigil', rarity: 'legendary', blurb: 'A cold light over the barrows: while you stand wounded, each foe that falls mends you.' },
];
