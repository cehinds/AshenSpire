// src/content/events.js — Unknown-node events (SPEC §5.6; grown to 10 in M3)
//
// Every choice is a real trade-off, StS-style. `requires` is checked by the
// event screen (e.g. { runes: 50 }); `effects` are run-level opcodes executed
// via executeRunEffects. A startCombat effect hands control to the combat
// orchestrator after resultText is shown. SPEC §9 M3 target: 10 events.

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
    id: 'bloodstainedAltar',
    name: 'Bloodstained Altar',
    art: '🩸',
    text:
      'An altar of dark stone, its channels worn smooth by use. The instructions are carved plainly: ' +
      'the stone sharpens what is given to it, and it keeps a portion.',
    choices: [
      {
        label: 'Offer your blood (upgrade 2 random cards, lose 8% max HP)',
        effects: [
          { op: 'upgradeCard', random: true },
          { op: 'upgradeCard', random: true },
          { op: 'loseMaxHpPct', pct: 8 },
        ],
        resultText: 'The channels drink. Two of your cards come back keener than any smith could make them.',
      },
      { label: 'Leave', effects: [], resultText: 'The altar does not care. It has waited longer than you.' },
    ],
  },
  {
    id: 'wanderingPhysician',
    name: 'Wandering Physician',
    art: '🩺',
    text:
      'A physician in a rain-rotted coat unrolls his instruments without being asked. ' +
      '"I can cut something out of you," he says. "The procedure is not painless. Or I can simply patch you."',
    choices: [
      {
        label: 'The procedure (remove a random card, take 4 damage)',
        effects: [
          { op: 'removeCardFromDeck', random: true },
          { op: 'damage', target: 'self', amount: 4 },
        ],
        resultText: 'He holds something up to the light, nods, and does not let you see it.',
      },
      {
        label: 'The patch (heal 15% max HP)',
        effects: [{ op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 15 } }],
        resultText: 'Competent, quick, and strangely cold. He refuses payment.',
      },
      { label: 'Leave', effects: [], resultText: '"Suit yourself. The spire will finish what I would have started."' },
    ],
  },
  {
    id: 'goldenMoth',
    name: 'Golden Moth',
    art: '🦋',
    text:
      'A moth the size of a shield rests on a broken pillar, wings dusted with rune-light. ' +
      'It is dying, slowly and without complaint. Runes drip from its wings like pollen.',
    choices: [
      {
        label: 'Gather the falling runes (gain 40 runes)',
        effects: [{ op: 'addRunes', amount: 40 }],
        resultText: 'The runes come away easily. The moth watches you with something like approval.',
      },
      {
        label: 'Sit with it a while (heal 10% max HP)',
        effects: [{ op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 10 } }],
        resultText: 'You keep the vigil. When you rise, some of its lightness has passed to you.',
      },
      { label: 'Leave', effects: [], resultText: 'Some deaths are not yours to attend.' },
    ],
  },
  {
    id: 'feralShrine',
    name: 'Shrine of the Feral Grace',
    art: '🐾',
    text:
      'A shrine no church would recognize: antlers, wax, and old blood. Grace pools here anyway — ' +
      'wild, unattended, and guarded by something that has not left claw marks this fresh by accident.',
    choices: [
      {
        label: 'Take the offering (gain a random relic — its keeper objects)',
        effects: [
          { op: 'addRelic', random: true },
          { op: 'startCombat', encounterId: 'eliteCrucible' },
        ],
        resultText: 'Your hand closes on the relic. Behind you, the undergrowth stands up.',
      },
      { label: 'Leave', effects: [], resultText: 'Wild grace keeps its own accounts. You leave the ledger closed.' },
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
  {
    id: 'graveOfTheNameless',
    name: 'Grave of the Nameless',
    art: '⚰',
    text:
      'A cairn of broken swords marks a grave no one tends. Rune-light seeps between the blades ' +
      'like frost. The mound is quiet — the particular quiet of something that could stop being quiet.',
    choices: [
      {
        label: 'Dig for runes (gain 90 runes; the keeper may wake)',
        effects: [
          { op: 'addRunes', amount: 90 },
          { op: 'startCombat', encounterId: 'loneSoldier', if: { p: 'random', pct: 40 } },
        ],
        resultText: 'The runes come loose in cold handfuls. Somewhere under the swords, something shifts its weight.',
      },
      {
        label: 'Pay respects (heal 15% max HP)',
        effects: [{ op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 15 } }],
        resultText: 'You right a fallen blade and stand a while. When you leave, you are lighter than you came.',
      },
      { label: 'Leave', effects: [], resultText: 'You leave the nameless to their naming.' },
    ],
  },
  {
    id: 'sleepingSmith',
    name: 'Sleeping Smith',
    art: '🔨',
    text:
      'A smith slumps over his anvil, hammer still loose in one hand. His forge is cold, but the blade ' +
      'laid across it hums like it remembers heat. He does not stir when you approach.',
    choices: [
      {
        label: 'Take the blade (upgrade a random card)',
        effects: [{ op: 'upgradeCard', random: true }],
        resultText: 'The hum quiets the moment it leaves the anvil, as if it was only ever waiting for a hand.',
      },
      {
        label: 'Wake him (pay 30 runes, heal 12% max HP)',
        requires: { runes: 30 },
        effects: [
          { op: 'addRunes', amount: -30 },
          { op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 12 } },
        ],
        resultText: 'He blinks awake just long enough to press a cold coin into your palm, and something in you settles.',
      },
      { label: 'Leave', effects: [], resultText: 'You let him sleep. The blade goes on humming behind you.' },
    ],
  },
  {
    id: 'crucibleTrial',
    name: 'Crucible Trial',
    art: '⚔',
    text:
      'A cracked stone ring marks a trial-ground no map names. A single soldier stands within it, ' +
      'unmoving, waiting for someone foolish or hungry enough to step inside.',
    choices: [
      {
        label: 'Enter the ring (fight the soldier for 60 runes)',
        effects: [
          { op: 'addRunes', amount: 60 },
          { op: 'startCombat', encounterId: 'loneSoldier' },
        ],
        resultText: 'You step across the stone line. The soldier finally moves.',
      },
      {
        label: 'Circle it instead (lose 5% max HP crossing the rubble, gain 20 runes)',
        effects: [
          { op: 'loseMaxHpPct', pct: 5 },
          { op: 'addRunes', amount: 20 },
        ],
        resultText: 'The rubble takes its toll, but the ring — and whatever waits in it — stays quiet.',
      },
      { label: 'Leave', effects: [], resultText: 'Some rings are drawn for a reason. You leave this one closed.' },
    ],
  },
  {
    id: 'discardedReliquary',
    name: 'Discarded Reliquary',
    art: '📦',
    text:
      'A traveler\'s pack lies split open at the trail\'s edge, its owner nowhere to be found. ' +
      'Among the ruined provisions, a single card sits face-down, deliberately placed — as though left as a warning, not a gift.',
    choices: [
      {
        label: 'Take it with you (gain a Guilt curse; the pack has 45 runes)',
        effects: [
          { op: 'addCardToDeck', card: 'guilt' },
          { op: 'addRunes', amount: 45 },
        ],
        resultText: 'You pick it up before you can think better of it. It settles into your deck like it was always there.',
      },
      {
        label: 'Burn the pack (gain 25 runes; leave the card)',
        effects: [{ op: 'addRunes', amount: 25 }],
        resultText: 'The provisions catch fast. The face-down card curls to ash before you can read it.',
      },
      { label: 'Leave', effects: [], resultText: 'You step around the pack and do not look back.' },
    ],
  },
  {
    id: 'omensAltar',
    name: "Omen's Altar",
    art: '🔱',
    text:
      'An altar carved with a face too many-eyed to be a saint. A voice — or something like one — ' +
      'offers to lend you its strength, if you will let it watch through your eyes for the rest of the road.',
    choices: [
      {
        label: 'Accept its gaze (gain a random relic; take a Guilt curse)',
        effects: [
          { op: 'addRelic', random: true },
          { op: 'addCardToDeck', card: 'guilt' },
        ],
        resultText: 'The eyes close over yours like a second lid. You do not feel them leave.',
      },
      {
        label: 'Shatter the altar (fight what wakes, gain 70 runes)',
        effects: [
          { op: 'addRunes', amount: 70 },
          { op: 'startCombat', encounterId: 'eliteCrucible' },
        ],
        resultText: 'The stone face cracks down the middle. What answers the noise is not stone at all.',
      },
      { label: 'Leave', effects: [], resultText: 'The many eyes stay open behind you, patient as ever.' },
    ],
  },
  {
    id: 'rotPriestOffer',
    name: "Rot-Priest's Offer",
    art: '☣',
    text:
      'A priest kneels in a ring of dead grass, robes fused to weeping skin. He is unbothered, almost radiant. ' +
      '"The Rot gives," he says, holding out a reliquary in one ruined hand. "It asks only a little flesh in return."',
    choices: [
      {
        label: 'Accept the blessing (gain a random relic; lose 10% max HP)',
        effects: [
          { op: 'addRelic', random: true },
          { op: 'loseMaxHpPct', pct: 10 },
        ],
        resultText: 'His hand closes over yours. The reliquary is warm, and the warmth does not stop where your skin does.',
      },
      {
        label: 'Rob him (gain 50 runes; take a Guilt curse)',
        effects: [
          { op: 'addRunes', amount: 50 },
          { op: 'addCardToDeck', card: 'guilt' },
        ],
        resultText: 'He does not resist. He only smiles wider, as if you have taken exactly what he meant you to.',
      },
      { label: 'Leave', effects: [], resultText: '"The Rot is patient," he calls after you. "It will keep your seat."' },
    ],
  },
];
