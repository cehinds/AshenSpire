// src/content/events.js — Unknown-node events (SPEC §5.6; grown to 10 in M3,
// 22 with the first quest chain)
//
// Every choice is a real trade-off, StS-style. `requires` is checked by the
// event screen (e.g. { cinders: 50 }); `effects` are run-level opcodes executed
// via executeRunEffects. A startCombat effect hands control to the combat
// orchestrator after resultText is shown. SPEC §9 M3 target: 10 events.

export const events = [
  {
    id: 'goldboughAvatar',
    name: 'Goldbough Avatar',
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
      'Cinder-light glints from a split strongbox. The mud around it is churned with bootprints.',
    choices: [
      {
        label: 'Loot the strongbox (gain 75 cinders; the owners may object)',
        effects: [
          { op: 'addCinders', amount: 75 },
          { op: 'startCombat', encounterId: 'loneSoldier', if: { p: 'random', pct: 50 } },
        ],
        resultText: 'You scoop the cinders from the mud. Behind you, someone clears their throat.',
      },
      { label: 'Leave', effects: [], resultText: 'Not every gift is free. You keep walking.' },
    ],
  },
  {
    id: 'weepingPilgrim',
    name: 'Wayward Pilgrim',
    art: '🧎',
    text:
      'A pilgrim sits at the roadside, robes soaked through, cradling something wrapped in cloth. ' +
      '"Fifty cinders," she says, without looking up. "It was my sister’s. I can’t carry it further."',
    choices: [
      {
        label: 'Give 50 cinders (gain a random relic)',
        requires: { cinders: 50 },
        effects: [
          { op: 'addCinders', amount: -50 },
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
      'A moth the size of a shield rests on a broken pillar, wings dusted with cinder-light. ' +
      'It is dying, slowly and without complaint. Cinders drip from its wings like pollen.',
    choices: [
      {
        label: 'Gather the falling cinders (gain 40 cinders)',
        effects: [{ op: 'addCinders', amount: 40 }],
        resultText: 'The cinders come away easily. The moth watches you with something like approval.',
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
    name: 'Shrine of the Feral Ember',
    art: '🐾',
    text:
      'A shrine no church would recognize: antlers, wax, and old blood. Ember pools here anyway — ' +
      'wild, unattended, and guarded by something that has not left claw marks this fresh by accident.',
    choices: [
      {
        label: 'Take the offering (gain a random relic — its keeper objects)',
        effects: [
          { op: 'addRelic', random: true },
          { op: 'startCombat', encounterId: 'eliteWyrm' },
        ],
        resultText: 'Your hand closes on the relic. Behind you, the undergrowth stands up.',
      },
      { label: 'Leave', effects: [], resultText: 'Wild ember keeps its own accounts. You leave the ledger closed.' },
    ],
  },
  {
    id: 'ancientRuneStone',
    name: 'Ancient Cinder Stone',
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
        label: 'Smash it (gain 35 cinders)',
        effects: [{ op: 'addCinders', amount: 35 }],
        resultText: 'The stone comes apart into cinder-light. The hum does not entirely stop.',
      },
      { label: 'Leave', effects: [], resultText: 'Some doors are better left unread.' },
    ],
  },
  {
    id: 'graveOfTheNameless',
    name: 'Grave of the Nameless',
    art: '⚰',
    text:
      'A cairn of broken swords marks a grave no one tends. Cinder-light seeps between the blades ' +
      'like frost. The mound is quiet — the particular quiet of something that could stop being quiet.',
    choices: [
      {
        label: 'Dig for cinders (gain 90 cinders; the keeper may wake)',
        effects: [
          { op: 'addCinders', amount: 90 },
          { op: 'startCombat', encounterId: 'loneSoldier', if: { p: 'random', pct: 40 } },
        ],
        resultText: 'The cinders come loose in cold handfuls. Somewhere under the swords, something shifts its weight.',
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
        label: 'Wake him (pay 30 cinders, heal 12% max HP)',
        requires: { cinders: 30 },
        effects: [
          { op: 'addCinders', amount: -30 },
          { op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 12 } },
        ],
        resultText: 'He blinks awake just long enough to press a cold coin into your palm, and something in you settles.',
      },
      { label: 'Leave', effects: [], resultText: 'You let him sleep. The blade goes on humming behind you.' },
    ],
  },
  {
    id: 'wyrmTrial',
    name: 'Wyrm Trial',
    art: '⚔',
    text:
      'A cracked stone ring marks a trial-ground no map names. A single soldier stands within it, ' +
      'unmoving, waiting for someone foolish or hungry enough to step inside.',
    choices: [
      {
        label: 'Enter the ring (fight the soldier for 60 cinders)',
        effects: [
          { op: 'addCinders', amount: 60 },
          { op: 'startCombat', encounterId: 'loneSoldier' },
        ],
        resultText: 'You step across the stone line. The soldier finally moves.',
      },
      {
        label: 'Circle it instead (lose 5% max HP crossing the rubble, gain 20 cinders)',
        effects: [
          { op: 'loseMaxHpPct', pct: 5 },
          { op: 'addCinders', amount: 20 },
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
        label: 'Take it with you (gain a Guilt curse; the pack has 45 cinders)',
        effects: [
          { op: 'addCardToDeck', card: 'guilt' },
          { op: 'addCinders', amount: 45 },
        ],
        resultText: 'You pick it up before you can think better of it. It settles into your deck like it was always there.',
      },
      {
        label: 'Burn the pack (gain 25 cinders; leave the card)',
        effects: [{ op: 'addCinders', amount: 25 }],
        resultText: 'The provisions catch fast. The face-down card curls to ash before you can read it.',
      },
      { label: 'Leave', effects: [], resultText: 'You step around the pack and do not look back.' },
    ],
  },
  {
    id: 'omensAltar',
    name: "Warden's Altar",
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
        label: 'Shatter the altar (fight what wakes, gain 70 cinders)',
        effects: [
          { op: 'addCinders', amount: 70 },
          { op: 'startCombat', encounterId: 'eliteWyrm' },
        ],
        resultText: 'The stone face cracks down the middle. What answers the noise is not stone at all.',
      },
      { label: 'Leave', effects: [], resultText: 'The many eyes stay open behind you, patient as ever.' },
    ],
  },
  {
    id: 'rotPriestOffer',
    name: "Blight-Priest's Offer",
    art: '☣',
    text:
      'A priest kneels in a ring of dead grass, robes fused to weeping skin. He is unbothered, almost radiant. ' +
      '"The Blight gives," he says, holding out a reliquary in one ruined hand. "It asks only a little flesh in return."',
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
        label: 'Rob him (gain 50 cinders; take a Guilt curse)',
        effects: [
          { op: 'addCinders', amount: 50 },
          { op: 'addCardToDeck', card: 'guilt' },
        ],
        resultText: 'He does not resist. He only smiles wider, as if you have taken exactly what he meant you to.',
      },
      { label: 'Leave', effects: [], resultText: '"The Blight is patient," he calls after you. "It will keep your seat."' },
    ],
  },

  // ---- Content-pass additions (round 3) --------------------------------------
  {
    id: 'handspiderNest',
    name: 'Handspider Nest',
    art: '🕷',
    text:
      'A cluster of pale, many-jointed hands scuttles in the dark ahead, nested around a strongbox ' +
      'they have dragged from somewhere below. They have not noticed you. Yet.',
    choices: [
      {
        label: 'Snatch the strongbox (gain 80 cinders; they may wake)',
        effects: [
          { op: 'addCinders', amount: 80 },
          { op: 'startCombat', encounterId: 'loneSoldier', if: { p: 'random', pct: 45 } },
        ],
        resultText: 'The box comes free with a wet scrape. All around you, fingers go still — then flex.',
      },
      { label: 'Back away slowly', effects: [], resultText: 'You retrace your steps one careful footfall at a time. The nest never stirs.' },
    ],
  },
  {
    id: 'fadedGrace',
    name: 'Seat of Faded Emberlight',
    art: '🕯',
    text:
      'A guiding ember once pooled here, now guttering to a thread of gold. It has just enough left ' +
      'to give — a mending, or a sharpening — but not both, and not for long.',
    choices: [
      {
        label: 'Warm yourself (heal 18% max HP)',
        effects: [{ op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 18 } }],
        resultText: 'The last of the light soaks into you. When it fades, the ground is only ground.',
      },
      {
        label: 'Temper a blade (upgrade a random card, lose 6% max HP)',
        effects: [
          { op: 'upgradeCard', random: true },
          { op: 'loseMaxHpPct', pct: 6 },
        ],
        resultText: 'You hold a card to the dying ember until it takes the edge. It costs you something to keep the flame that long.',
      },
      { label: 'Leave', effects: [], resultText: 'You let the ember fade unspent. Some kindnesses are not yours to take.' },
    ],
  },
  {
    id: 'merchantsGhost',
    name: "Merchant's Ghost",
    art: '👻',
    text:
      'A translucent figure keeps a stall that is no longer there, weighing wares no living hand can hold. ' +
      '"Custom," it sighs, almost grateful. "It has been so long. I have something you\'ll want."',
    choices: [
      {
        label: 'Pay in kind (give 60 cinders, gain a random relic)',
        requires: { cinders: 60 },
        effects: [
          { op: 'addCinders', amount: -60 },
          { op: 'addRelic', random: true },
        ],
        resultText: 'The cinders vanish from your hand into a ledger that isn\'t there. The relic is very solid, and very cold.',
      },
      {
        label: 'Take it and run (gain a random relic and a Guilt curse)',
        effects: [
          { op: 'addRelic', random: true },
          { op: 'addCardToDeck', card: 'guilt' },
        ],
        resultText: 'It does not chase you. It only watches, and writes something down, and the writing follows you out.',
      },
      { label: 'Leave', effects: [], resultText: '"Come again," it says, to no one, already forgetting you.' },
    ],
  },
  {
    id: 'cinderbearDen',
    name: 'Cinderbear Den',
    art: '🐻',
    text:
      'The cave reeks of musk and old kills. Cinder-light glitters in the bone-litter at the back — a fortune, ' +
      'if you are quiet, and quick, and the mound of fur by the wall keeps breathing slow.',
    choices: [
      {
        label: 'Go for the hoard (gain 100 cinders; it will almost certainly wake)',
        effects: [
          { op: 'addCinders', amount: 100 },
          { op: 'startCombat', encounterId: 'eliteWyrm', if: { p: 'random', pct: 75 } },
        ],
        resultText: 'Your hands fill with cold light. Behind you, the breathing stops.',
      },
      {
        label: 'Skim the edges (squeeze past the rubble, lose 5% max HP, gain 25 cinders)',
        effects: [
          { op: 'loseMaxHpPct', pct: 5 },
          { op: 'addCinders', amount: 25 },
        ],
        resultText: 'You take only what is within reach and pay for it in scraped ribs. The den keeps its heart.',
      },
      { label: 'Leave', effects: [], resultText: 'Some fortunes are guarded by teeth. You leave this one to its keeper.' },
    ],
  },
  {
    id: 'stakeOfTheMartyr',
    name: 'Stake of the Martyr',
    art: '⛧',
    text:
      'A stake of gilded thorn juts from the path, humming with the promise of return. It asks for a piece of you ' +
      'to hold in trust — a card, and a measure of your vigor — and offers a relic drawn up from where the dead wait.',
    choices: [
      {
        label: 'Give what it asks (remove a random card, lose 8% max HP, gain a random relic)',
        effects: [
          { op: 'removeCardFromDeck', random: true },
          { op: 'loseMaxHpPct', pct: 8 },
          { op: 'addRelic', random: true },
        ],
        resultText: 'The stake drinks a card and a breath of your strength, and hands back something older than either.',
      },
      { label: 'Leave', effects: [], resultText: 'You step around the thorn. It hums after you, patient, certain you\'ll be back.' },
    ],
  },
  {
    id: 'twoFingersRiddle',
    name: "The Oracle's Riddle",
    art: '✌',
    text:
      'A pair of enormous fingers rises from a font of still water, tapping a slow rhythm only they understand. ' +
      'Read one way, the rhythm sharpens the mind. Read another, it mends the flesh — but the second reading leaves a mark.',
    choices: [
      {
        label: 'Sharpen (upgrade 2 random cards, take 5 damage)',
        effects: [
          { op: 'upgradeCard', random: true },
          { op: 'upgradeCard', random: true },
          { op: 'damage', target: 'self', amount: 5 },
        ],
        resultText: 'The rhythm settles behind your eyes. Two of your cards come back keener; your hands ache with the knowing.',
      },
      {
        label: 'Mend (heal 22% max HP, gain a Guilt curse)',
        effects: [
          { op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 22 } },
          { op: 'addCardToDeck', card: 'guilt' },
        ],
        resultText: 'Warmth floods you, generous and total. Something reads back through the water, and does not look away.',
      },
      { label: 'Leave', effects: [], resultText: 'The fingers tap on. You leave the riddle unanswered, which is its own kind of answer.' },
    ],
  },
  // THE FIRST QUEST CHAIN (E12, #257: "questing and previous choices to
  // influence other events"). Three steps over the run: the Grave of the
  // Nameless above is step one; the two events below are gated by what was
  // chosen there (eventHistoryRequirements) and branch on it (choice-level
  // requiresHistory), so a later act answers an earlier act's choice. A gated
  // event never enters an Unknown node's pool until its step is earned.
  {
    id: 'namelessKeeper',
    name: 'The Keeper of the Nameless',
    art: '🕯',
    text:
      'A figure in grave-clothes waits at a fork in the road, a lantern of cinder-light held low. ' +
      'It knows the cairn of broken swords. It knows what you did there. It has been walking since.',
    choices: [
      {
        label: 'Return what you took (lose 90 cinders; the keeper stands down)',
        requires: { cinders: 90 },
        effects: [{ op: 'addCinders', amount: -90 }],
        resultText: 'The cinders go back into the lantern one by one. The keeper turns without a word and walks the way you came.',
      },
      {
        label: 'Face the keeper (fight; keep what you took)',
        effects: [{ op: 'startCombat', encounterId: 'patrol' }],
        resultText: 'The lantern goes out. Things that were following the keeper are not so patient.',
      },
      {
        label: "Accept the keeper's thanks (gain the Gravetender's Bell)",
        effects: [{ op: 'addRelic', id: 'gravetendersBell' }],
        resultText: 'A small bell, iron and cold, pressed into your palm. "One toll for each name," the keeper says. "You will know when."',
      },
      { label: 'Leave', effects: [], resultText: 'The keeper does not follow. It only needed to be seen.' },
    ],
  },
  {
    id: 'namelessRest',
    name: 'The Nameless at Rest',
    art: '🪦',
    text:
      'The road ends at a second cairn, newer than the first — every sword standing, every name struck ' +
      'into the stone. The keeper is not here. Whatever it was walking toward, it arrived.',
    choices: [
      {
        label: 'Keep the vigil (upgrade 2 random cards)',
        effects: [{ op: 'upgradeCard', random: true }, { op: 'upgradeCard', random: true }],
        resultText: 'You stand until the cinder-light gutters. The bell in your pack rings once, though nothing moved it.',
      },
      {
        label: 'Rest among the stones (heal 30% max HP)',
        effects: [{ op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 30 } }],
        resultText: 'What you returned bought you this much: a night among the nameless, and no one waking you.',
      },
      {
        label: 'Loot the barrow (gain 120 cinders, gain a Guilt curse)',
        effects: [{ op: 'addCinders', amount: 120 }, { op: 'addCardToDeck', card: 'guilt' }],
        resultText: 'Second time is easier. The names on the stone do not object. That is the part that follows you.',
      },
      { label: 'Leave', effects: [], resultText: 'You leave the cairn as you found it, which is more than the first one got.' },
    ],
  },
];

// Stable history ids live beside event content without widening the validated
// event opcode schema. Labels may change; these ids are durable save facts.
export const eventChoiceIds = Object.freeze({
  goldboughAvatar: ['offerCard', 'pray', 'leave'],
  abandonedCart: ['lootStrongbox', 'leave'],
  weepingPilgrim: ['giveCinders', 'refuse'],
  bloodstainedAltar: ['offerBlood', 'leave'],
  wanderingPhysician: ['procedure', 'patch', 'leave'],
  goldenMoth: ['gatherCinders', 'keepVigil', 'leave'],
  feralShrine: ['takeOffering', 'leave'],
  ancientRuneStone: ['studyStone', 'smashStone', 'leave'],
  graveOfTheNameless: ['digForCinders', 'payRespects', 'leave'],
  sleepingSmith: ['takeBlade', 'wakeSmith', 'leave'],
  wyrmTrial: ['enterRing', 'circleRing', 'leave'],
  discardedReliquary: ['takeCurse', 'burnPack', 'leave'],
  omensAltar: ['acceptGaze', 'shatterAltar', 'leave'],
  rotPriestOffer: ['acceptBlessing', 'robPriest', 'leave'],
  handspiderNest: ['snatchStrongbox', 'backAway'],
  fadedGrace: ['warmYourself', 'temperBlade', 'leave'],
  merchantsGhost: ['payInKind', 'stealRelic', 'leave'],
  cinderbearDen: ['takeHoard', 'skimEdges', 'leave'],
  stakeOfTheMartyr: ['makeOffering', 'leave'],
  twoFingersRiddle: ['sharpen', 'mend', 'leave'],
  namelessKeeper: ['returnCinders', 'faceKeeper', 'acceptThanks', 'leave'],
  namelessRest: ['keepVigil', 'restAmongStones', 'lootBarrow', 'leave'],
});

// The merchant will not trade with a traveler who previously looted the
// abandoned cart. Stealing remains available, and Leave is deliberately
// requirement-free so this history branch can never trap the player.
export const eventChoiceHistoryRequirements = Object.freeze({
  merchantsGhost: [
    { none: [{ eventId: 'abandonedCart', choiceId: 'lootStrongbox' }] },
    undefined,
    undefined,
  ],
  // The keeper answers what was done at the grave: the digger may pay or
  // fight, the mourner is thanked; Leave stays free so no branch can trap.
  namelessKeeper: [
    { all: [{ eventId: 'graveOfTheNameless', choiceId: 'digForCinders' }] },
    { all: [{ eventId: 'graveOfTheNameless', choiceId: 'digForCinders' }] },
    { all: [{ eventId: 'graveOfTheNameless', choiceId: 'payRespects' }] },
    undefined,
  ],
  // The second cairn answers the keeper: the thanked keep the vigil, the
  // penitent rest, the one who fought loots again.
  namelessRest: [
    { all: [{ eventId: 'namelessKeeper', choiceId: 'acceptThanks' }] },
    { all: [{ eventId: 'namelessKeeper', choiceId: 'returnCinders' }] },
    { all: [{ eventId: 'namelessKeeper', choiceId: 'faceKeeper' }] },
    undefined,
  ],
});

// EVENT-LEVEL history gates (quest steps). An event listed here enters an
// Unknown node's pool only once the run's history satisfies its requirement
// (engine/encounters.js resolveUnknownNode via model/quests.js) — so a chain
// step cannot be met before the step it answers. Events not listed are
// ungated, exactly as before.
export const eventHistoryRequirements = Object.freeze({
  namelessKeeper: {
    any: [
      { eventId: 'graveOfTheNameless', choiceId: 'digForCinders' },
      { eventId: 'graveOfTheNameless', choiceId: 'payRespects' },
    ],
  },
  namelessRest: {
    any: [
      { eventId: 'namelessKeeper', choiceId: 'returnCinders' },
      { eventId: 'namelessKeeper', choiceId: 'faceKeeper' },
      { eventId: 'namelessKeeper', choiceId: 'acceptThanks' },
    ],
  },
});

/** Enrich validated event choices with their durable history contract. */
export function eventChoicesWithHistory(event) {
  const ids = eventChoiceIds[event?.id];
  if (!event || !Array.isArray(event.choices) || !Array.isArray(ids)
    || ids.length !== event.choices.length) return [];
  const requirements = eventChoiceHistoryRequirements[event.id] || [];
  return event.choices.map((choice, index) => ({
    ...choice,
    id: ids[index],
    requiresHistory: requirements[index],
  }));
}
