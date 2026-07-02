// src/content/events.js — Unknown-node events (SPEC §5.6, M2 launch set)
//
// Every choice is a real trade-off, StS-style. `requires` is checked by the
// event screen (e.g. { runes: 50 }); `effects` are run-level opcodes executed
// via executeRunEffects. A startCombat effect hands control to the combat
// orchestrator after resultText is shown.

export const events = [
  {
    id: 'erdtreeAvatar',
    name: 'Erdtree Avatar',
    art: '🌳',
    text:
      'A hulking avatar kneels in a clearing, grown into the roots of a golden sapling. ' +
      'It does not attack. It holds out one massive hand, palm up, waiting.',
    choices: [
      {
        label: 'Offer a card (lose a random card, take 6 damage)',
        effects: [
          { op: 'removeCardFromDeck', random: true },
          { op: 'damage', target: 'self', amount: 6 },
        ],
        resultText: 'The card crumbles to gold leaf in its palm. Its other hand closes around yours — the blessing is not gentle.',
      },
      {
        label: 'Pray (heal 20% max HP, gain a Guilt curse)',
        effects: [
          { op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 20 } },
          { op: 'addCardToDeck', card: 'guilt' },
        ],
        resultText: 'Warmth knits your wounds shut. Something else follows you out of the clearing.',
      },
      { label: 'Leave', effects: [], resultText: 'The hand stays open behind you for a long time.' },
    ],
  },
  {
    id: 'abandonedCart',
    name: 'Abandoned Merchant Cart',
    art: '🛒',
    text:
      'A trader’s cart lies tipped in the mud, one wheel still turning. ' +
      'Rune-light glints from a split strongbox. The mud around it is churned with bootprints.',
    choices: [
      {
        label: 'Loot the strongbox (gain 75 runes; the owners may object)',
        effects: [
          { op: 'addRunes', amount: 75 },
          { op: 'startCombat', encounterId: 'loneSoldier', if: { p: 'random', pct: 50 } },
        ],
        resultText: 'You scoop the runes from the mud. Behind you, someone clears their throat.',
      },
      { label: 'Leave', effects: [], resultText: 'Not every gift is free. You keep walking.' },
    ],
  },
  {
    id: 'weepingPilgrim',
    name: 'Weeping Pilgrim',
    art: '🧎',
    text:
      'A pilgrim sits at the roadside, robes soaked through, cradling something wrapped in cloth. ' +
      '"Fifty runes," she says, without looking up. "It was my sister’s. I can’t carry it further."',
    choices: [
      {
        label: 'Give 50 runes (gain a random relic)',
        requires: { runes: 50 },
        effects: [
          { op: 'addRunes', amount: -50 },
          { op: 'addRelic', random: true },
        ],
        resultText: 'She presses the bundle into your hands and walks into the rain without counting.',
      },
      { label: 'Refuse', effects: [], resultText: 'She nods, as if she expected nothing else.' },
    ],
  },
  {
    id: 'ancientRuneStone',
    name: 'Ancient Rune Stone',
    art: '🗿',
    text:
      'A standing stone hums with old script. Reading it makes your teeth ache and your hands steadier. ' +
      'It would also break beautifully.',
    choices: [
      {
        label: 'Study it (upgrade a random card, lose 7% max HP)',
        effects: [
          { op: 'upgradeCard', random: true },
          { op: 'loseMaxHpPct', pct: 7 },
        ],
        resultText: 'The script rearranges something behind your eyes. You are sharper, and less.',
      },
      {
        label: 'Smash it (gain 35 runes)',
        effects: [{ op: 'addRunes', amount: 35 }],
        resultText: 'The stone comes apart into rune-light. The hum does not entirely stop.',
      },
      { label: 'Leave', effects: [], resultText: 'Some doors are better left unread.' },
    ],
  },
];
