// src/content/sigils.js — sigils, the brief's "runes" (SPEC §14.3).
//
// A sigil is renamed from "rune" because that word is this spec's pre-scrub
// name for the currency (cinders). Each row is `{ id, name, rarity, cost,
// blurb, triggers }`, with triggers in the same `{ on, if?, do }` DSL relics
// and property rules use, so a sigil adds nothing to the engine's vocabulary.
//
// OWNED, NOT YET WORKING. §14.6 step 5 sells sigils at the market into the
// run's inventory (`run.sigils`); a sigil works only while installed in a
// sigil slot of an equipped armament, and cutting slots and installing sigils
// is the blacksmith's (step 6). Until then a bought sigil is carried and kept,
// and its triggers mount nowhere.
//
// PRICES. `cost` is the sigil's own price; the market charges
// `gameConfig.shops.market.sigils.pricePct` percent of it (content/shops.js),
// so the owner tunes what the shelf asks in Settings without editing a row.
//
// LEGENDARY SIGILS are SPEC §15.4's: attuned rather than slotted, authored
// without triggers, and never shop stock. None ships yet, and validateContent
// refuses the rarity here until that section lands.
export const sigils = [
  {
    id: 'emberSigil',
    name: 'Ember Sigil',
    rarity: 'common',
    cost: 180,
    blurb: 'At the start of each fight, gain 4 Block.',
    triggers: [{ on: 'combatStart', do: [{ op: 'block', target: 'owner', amount: 4 }] }],
  },
  {
    id: 'thornSigil',
    name: 'Thorn Sigil',
    rarity: 'common',
    cost: 180,
    blurb: 'The first time you hit with an attack each fight, apply 2 Bleed.',
    triggers: [{
      on: 'damageDealt',
      once: true,
      if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] },
      do: [{ op: 'applyStatus', status: 'bleed', stacks: 2 }],
    }],
  },
  {
    id: 'tideSigil',
    name: 'Tide Sigil',
    rarity: 'uncommon',
    cost: 260,
    blurb: 'Every 5th card you play in a fight draws a card.',
    triggers: [{ on: 'cardPlayed', if: { p: 'everyNthCardThisCombat', n: 5 }, do: [{ op: 'draw', amount: 1 }] }],
  },
  {
    id: 'hearthSigil',
    name: 'Hearth Sigil',
    rarity: 'rare',
    cost: 360,
    blurb: 'Whenever you heal, gain 3 Block.',
    triggers: [{ on: 'healed', if: { p: 'eventTargetIsOwner' }, do: [{ op: 'block', target: 'owner', amount: 3 }] }],
  },
];
