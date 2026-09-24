// src/content/cards/herald.js — the Herald pool (SPEC §5.1: M3)
//
// Class identity: HP AS A RESOURCE — pay life for tempo (loseHp riders),
// spread Crimson Blight, and claw the blood back through heals that the Gold
// Figurine converts into armor. Mistakes compound: HP is one pool (GDD §4.3).
//
// M3 note: pool grown to 30 rewardable cards in the M3 content pass (toward
// SPEC's ~50). New cards deepen the blood/Blight identity — Blight spread & payoff
// (Contagion, Scourge, Cull the Weak, Blight Nova, Reclamation), HP-for-value
// (Bloodletting, Exsanguinate, Blood Harvest), and blood-fed powers (Stigmata
// heals on HP loss, Zealotry retaliates on HP loss).

const one = { f: 'add', args: [1] };

export const heraldCards = [
  // ---- Starter ---------------------------------------------------------------
  {
    id: 'urgentHeal', name: 'Urgent Heal', class: 'herald', rarity: 'starter', cost: 1, staminaCost: 1, manaCost: 1, type: 'skill',
    flavor: "Rite of the Furnace Chapel, for wounds taken in its service.\n\nPerformed swiftly, its prayer cut to the first line. The rubric bids the wound be bound beneath the brand, never over it, that the mark be left clear.\n\nWe bind the wound beneath the unspent brand.",
    keywords: [], icon: '✚',
    effects: [{ op: 'heal', target: 'self', amount: 4 }],
    textTemplate: 'Heal {heal} HP.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 6 }] },
  },

  // ---- Commons ----------------------------------------------------------------
  {
    id: 'bloodPact', name: 'Blood Pact', class: 'herald', rarity: 'common', cost: 0, type: 'skill',
    flavor: "Second office of the birth-rite.\n\nThe flame-mark was pressed into the newborn's wrist, and the parents answered in the child's stead. The Chapel called it a promise and a privilege.\n\nIn the birth-roll of the crown-born wards, beside the Herald's name, one word is struck through.",
    keywords: [], icon: '🩸',
    effects: [
      { op: 'loseHp', target: 'self', amount: 2 },
      { op: 'gainEnergy', amount: 1 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Lose {loseHp} HP. Gain {gainEnergy} Energy. Draw {draw} card.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 1 },
        { op: 'gainEnergy', amount: 1 },
        { op: 'draw', amount: 1 },
      ],
    },
  },
  {
    // A2 Herald starvation: no Mana line (Stamina 1 stays). The Herald's one
    // starting attack cost Mana that carries between fights, so a dry Herald
    // could only stall: `node tools/runsim.mjs 120` with the A2 boss rows,
    // Herald 45 -> 66/120 wins and stalled fights 5 -> 4.
    id: 'blightTouch', name: 'Blight Touch', class: 'herald', rarity: 'common', cost: 1, staminaCost: 1, type: 'attack',
    flavor: "Blessing of the Feral Ember.\n\nTaken from the Chapel's blessing of the sick and turned to what the Feral Ember holds its truer purpose: to give warmth and keep no account. The Saints name it heresy.\n\nThe converts say the touch is warm. None have said otherwise.",
    keywords: [], icon: '🦠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {crimsonBlight} Crimson Blight.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 3 },
      ],
    },
  },
  {
    id: 'flagellation', name: 'Flagellation', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Penance of the Chapel's novices.\n\nPerformed with a knotted cord upon the bare back. The Saints taught that pain offered freely spares the fire the trouble of taking it. Novice Wen kept the penance daily for three years.\n\nShe wrote that she could not say whom it had spared.",
    keywords: [], icon: '⛓',
    effects: [
      { op: 'loseHp', target: 'self', amount: 2 },
      { op: 'damage', target: 'enemy', amount: 9 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 2 },
        { op: 'damage', target: 'enemy', amount: 12 },
      ],
    },
  },
  {
    id: 'penance', name: 'Penance', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Kneeling upon the cold stone of the nave.\n\nPrescribed for small failings of devotion, until the knees bled. The nave was repaved twice in the years of the Mark Trade, with stone from the caldera, and no reason given.\n\nWe kneel on the cold stone and are forgiven.",
    keywords: [], icon: '🙏',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'heal', target: 'self', amount: 2 },
    ],
    textTemplate: 'Gain {block} Block. Heal {heal} HP.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'heal', target: 'self', amount: 3 },
      ],
    },
  },
  {
    // THE HERALD IS WHERE INSANITY LIVES (Rune, 2026-08-08). The Insanity row
    // shipped complete — threshold 14, the biggest burst, +8 Poise, a
    // guaranteed Stagger, `insanityExposed` — and NOTHING in the game applied
    // it. It belongs to this class and not to the Reaver or the Starseer for a
    // reason already in the data: insanityExposed raises `ritual`- and
    // `blight`-tagged damage, and those two tags are the Herald's
    // (content/source/tagging.csv). A chant repeated until the mind gives
    // is the cheapest, slowest door in; 14 is deliberately the hardest
    // threshold to fill, so a common has to be able to start it.
    // Numbers PROVISIONAL, like the row's.
    id: 'litany', name: 'Litany', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Closing prayer of the funeral rite.\n\nSpoken over the ledger once a name was entered, and said to return a share of warmth to the mourners. Novices learned it before they could read. The last novice says it each night.\n\nThe ledger was lost in the Burning. There is no name to close.",
    keywords: [], icon: '📿',
    effects: [
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 },
      { op: 'applyStatus', target: 'enemy', status: 'insanity', stacks: 3 },
    ],
    textTemplate: 'Apply {weak} Weak and {insanity} Insanity.',
    upgrade: {
      effects: [
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 },
        { op: 'applyStatus', target: 'enemy', status: 'insanity', stacks: 4 },
      ],
    },
  },
  {
    id: 'graveOffering', name: 'Grave Offering', class: 'herald', rarity: 'common', cost: 2, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Offering at the graves of the crown-born.\n\nUpon the anniversary of their writing, mourners opened the grave and set a coal beside what remained. The Chapel ended the rite in the years of the Marking, saying the dead no longer needed company.\n\nBy then, the mourners had found the graves colder than they ought to be.",
    keywords: [], icon: '🪦',
    effects: [
      { op: 'loseHp', target: 'self', amount: 3 },
      { op: 'damage', target: 'allEnemies', amount: 7 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage to ALL enemies.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 3 },
        { op: 'damage', target: 'allEnemies', amount: 10 },
      ],
    },
  },
  {
    id: 'bloodletting', name: 'Bloodletting', class: 'herald', rarity: 'common', cost: 0, type: 'skill',
    flavor: "Bleeding before the blessing of bread.\n\nThe Saints bled into the bowl first, that nothing be taken from the congregation the Saint had not first given. The Chapel taught it as humility.\n\nOn the days of the rite, the bread ran short, and the Saints ate first.",
    keywords: [], icon: '🩸',
    effects: [
      { op: 'loseHp', target: 'self', amount: 3 },
      { op: 'block', target: 'self', amount: 8 },
    ],
    textTemplate: 'Lose {loseHp} HP. Gain {block} Block.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 3 },
        { op: 'block', target: 'self', amount: 11 },
      ],
    },
  },
  {
    id: 'contagion', name: 'Contagion', class: 'herald', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 1, type: 'skill',
    flavor: "Communion of the Feral Ember.\n\nThe Chapel passed one cup along the pews, that the congregation be one body before the fire. The Feral Ember revived the rite with another cup.\n\nWe pass one cup along the pews, and every mouth is red.",
    keywords: [], icon: '☣',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 2 }],
    textTemplate: 'Apply {crimsonBlight} Crimson Blight to ALL enemies.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 3 }] },
  },
  {
    id: 'cullTheWeak', name: 'Cull the Weak', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Rite of gathering the failing.\n\nPerformed in the sick-wards of the crown-born, that the dying need not linger. The Wandering Physician, who served in those wards, kept his own list of those gathered. The ward rolls name none of them.\n\nMany he had expected to recover.",
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'damage', target: 'enemy', amount: 4, if: { p: 'hasStatus', of: 'target', status: 'crimsonBlight' } },
    ],
    textTemplate: 'Deal {damage} damage. If the target has Crimson Blight: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'damage', target: 'enemy', amount: 6, if: { p: 'hasStatus', of: 'target', status: 'crimsonBlight' } },
      ],
    },
  },
  {
    id: 'transfusion', name: 'Transfusion', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Communion of blood, between Saint and dying.\n\nBlood poured from cup to cup, for the dying of good family. The rubric speaks of the Saint giving, never receiving. Novice Wen wrote that the flow ran both ways.\n\nThe Saints rose from the rite looking younger.",
    keywords: [], icon: '➕',
    effects: [{ op: 'heal', target: 'self', amount: 6 }],
    textTemplate: 'Heal {heal} HP.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 9 }] },
  },
  {
    id: 'blightward', name: 'Blightward', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Cloth laid over an unfinished brand.\n\nBegun for the Herald, whose mark began to burn on the night of the Burning and stopped partway. The Chapel remnant now lays such cloths over the brands of its dead, and teaches that the fire will return to finish its work.\n\nThe fire started on me and stopped. I do not know why.",
    keywords: [], icon: '🛡',
    effects: [
      { op: 'block', target: 'self', amount: 6 },
      { op: 'block', target: 'self', amount: 4, if: { p: 'hpBelowPct', of: 'self', pct: 50 } },
    ],
    textTemplate: 'Gain {block} Block. If below half HP: gain {block.2} more.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 8 },
        { op: 'block', target: 'self', amount: 4, if: { p: 'hpBelowPct', of: 'self', pct: 50 } },
      ],
    },
  },

  // ---- Uncommons -----------------------------------------------------------------
  {
    id: 'martyrBlood', name: "Martyr's Blood", class: 'herald', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Offering of the Saint's own blood.\n\nMade at the altar when the censer ran low, for a Saint's blood was held to burn hotter than any incense. When the censers were cleaned in the years of the Spire, dried blood lay layered beneath the ash.\n\nWe spend ourselves at the altar, and the censer swings faster.",
    keywords: ['exhaust'], icon: '🥀',
    effects: [
      { op: 'loseHp', target: 'self', amount: 5 },
      { op: 'gainEnergy', amount: 2 },
      { op: 'draw', amount: 2 },
    ],
    textTemplate: 'Lose {loseHp} HP. Gain {gainEnergy} Energy. Draw {draw} cards. Exhaust.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 3 },
        { op: 'gainEnergy', amount: 2 },
        { op: 'draw', amount: 2 },
      ],
    },
  },
  {
    id: 'blightBloom', name: 'Blight Bloom', class: 'herald', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'skill',
    flavor: "Red flowers upon the graves of the crown-born.\n\nThey first appeared in the Furnace Chapel's garden in the Long Winter. The remnant tends them as a sign that the dead are giving yet.\n\nThey spread fastest where the earth is freshly turned. The remnant has begun turning more.",
    keywords: ['exhaust'], icon: '🌺',
    effects: [
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: { f: 'stacks', status: 'crimsonBlight', of: 'target' } },
    ],
    textTemplate: "Double the target's Crimson Blight. Exhaust.",
    upgrade: { keywords: [], textTemplate: "Double the target's Crimson Blight." },
  },
  {
    id: 'sacredHarvest', name: 'Sacred Harvest', class: 'herald', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Harvest rite of the Chapel.\n\nA gilded sickle, blessed and carried through the fields of the crown-born. The Chapel found the harvest beautiful, and built a chapel to it. The rubric lists what the sickle is to cut, in the fields and after.\n\nThe second half of the list is written in the old script.",
    keywords: [], icon: '🌾',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'heal', target: 'self', amount: 3 },
    ],
    textTemplate: 'Deal {damage} damage. Heal {heal} HP.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'heal', target: 'self', amount: 4 },
      ],
    },
  },
  {
    id: 'thornHaloCard', name: 'Thorn Halo', class: 'herald', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Crown of briar, worn at the feast of the Founding.\n\nIn memory of the first Saint, who by Chapel tradition wore thorns in the caldera; each thorn stood for a name carried. In the Long Winter, the Thorn Matriarch grew a crown of her own.\n\nThe remnant counts her a Saint. She was a Warden, and never swore to them.",
    keywords: [], icon: '🌿',
    effects: [{ op: 'applyStatus', target: 'self', status: 'thornHalo', stacks: one }],
    textTemplate: 'At the start of your turn, apply 1 Crimson Blight to ALL enemies.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'communionCard', name: 'Communion', class: 'herald', rarity: 'uncommon', cost: 2, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Sharing of warmth, as kept at the Tidebound Chapel.\n\nThe Saints raised that chapel upon the Drowned Coast to keep watch upon the Spire, which they called heresy. Its congregation shrank with each winter after the Spire was finished.\n\nWe watched from Tidebound Chapel and never saw the heresy lit.",
    keywords: [], icon: '🕊',
    effects: [{ op: 'applyStatus', target: 'self', status: 'communion', stacks: one }],
    textTemplate: 'At the start of your turn, heal 3 HP.',
    upgrade: { cost: 1 },
  },
  {
    id: 'gildedOath', name: 'Gilded Oath', class: 'herald', rarity: 'uncommon', cost: 2, type: 'skill',
    flavor: "Oath of the Goldbough crest.\n\nA gilded branch, three flames upon three twigs: the kingdom and its hearths. Novices swore it at their first vigil, before they were told what the hearths were fed.\n\nThe crest above the Furnace Chapel's nave bears a fourth twig, bare, blamed upon a careless gilder.",
    keywords: [], icon: '🌞',
    effects: [
      { op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 },
      { op: 'applyStatus', target: 'self', status: 'dexterity', stacks: 2 },
    ],
    textTemplate: 'Gain {strength} Strength and {dexterity} Dexterity.',
    upgrade: {
      effects: [
        { op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 },
        { op: 'applyStatus', target: 'self', status: 'dexterity', stacks: 3 },
      ],
    },
  },
  {
    id: 'plagueBearer', name: 'Plague Bearer', class: 'herald', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Office of the censer-bearer.\n\nThe Saints taught that the censer's smoke opened doors to the fire's blessing. When the Chapel set the office down, the Feral Ember took it up, and bears the censers lit through the weald.\n\nThe doors open for them more readily than ever they did for the Saints.",
    keywords: [], icon: '🐀',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 2 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {crimsonBlight} Crimson Blight. Draw {draw} card.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5 },
        { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 3 },
        { op: 'draw', amount: 1 },
      ],
    },
  },
  {
    id: 'exsanguinate', name: 'Exsanguinate', class: 'herald', rarity: 'uncommon', cost: 1, type: 'attack',
    flavor: "Giving of blood, until the giver is light enough to rise.\n\nPerformed by the Saints in the last extremity, when a hearth faltered and no other offering remained. The Chapel's record names those who performed it and rose.\n\nThe graves assigned to them were found empty.",
    keywords: [], icon: '🔻',
    effects: [
      { op: 'loseHp', target: 'self', amount: 3 },
      { op: 'damage', target: 'enemy', amount: 14 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 3 },
        { op: 'damage', target: 'enemy', amount: 18 },
      ],
    },
  },
  {
    id: 'stigmataCard', name: 'Stigmata', class: 'herald', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Marks of the Saints.\n\nWorn openly upon hands and brow, and held by the Chapel to be a favour of the fire. Novices learned they appeared more reliably upon Saints with a knife at hand.\n\nNovice Wen wrote so plainly, then begged forgiveness for it, twice.",
    keywords: [], icon: '🩹',
    effects: [{ op: 'applyStatus', target: 'self', status: 'stigmata', stacks: one }],
    textTemplate: 'Whenever you lose HP, heal 2 HP.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'scourge', name: 'Scourge', class: 'herald', rarity: 'uncommon', cost: 2, type: 'attack',
    flavor: "Penitent's walk down the nave.\n\nScourge in hand, while the congregation answered each blow. The number of blows was set by the number of names written that season. In the last seasons before the Burning, the rite lasted the night.\n\nWe walk the nave with the scourge, and the pews answer.",
    keywords: [], icon: '🌊',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 6 },
      { op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Apply {crimsonBlight} Crimson Blight to ALL.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 8 },
        { op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 2 },
      ],
    },
  },
  {
    id: 'reclamation', name: 'Reclamation', class: 'herald', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Return of warmth lent to the dying.\n\nPerformed at the deathbed once the name was read, and called a courtesy returned. After the rite the dying were colder, and the Saint warmer.\n\nThe rubric closes: do not explain this to the family.",
    keywords: ['exhaust'], icon: '🍂',
    effects: [
      { op: 'heal', target: 'self', amount: { f: 'stacks', status: 'crimsonBlight', of: 'allEnemies', per: 2 } },
    ],
    textTemplate: 'Heal 1 HP for every 2 Crimson Blight on all enemies. Exhaust.',
    upgrade: {
      keywords: ['exhaust'],
      effects: [
        { op: 'heal', target: 'self', amount: { f: 'stacks', status: 'crimsonBlight', of: 'allEnemies' } },
      ],
      textTemplate: 'Heal 1 HP for every Crimson Blight on all enemies. Exhaust.',
    },
  },

  // ---- Rares -----------------------------------------------------------------------
  {
    id: 'secondBloom', name: 'Second Bloom', class: 'herald', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'skill',
    flavor: "Rite of recovery, named for the weald's second flowering.\n\nThe orchards bloomed a second time in years when the Field Flame burned strong, and the Chapel claimed both the blossom and the healing as its work. Neither has come since the Burning.\n\nThe last novice performs the rite regardless, and says it works.",
    keywords: ['exhaust'], icon: '🌸',
    effects: [
      { op: 'heal', target: 'self', amount: { f: 'mul', args: [0.5, { f: 'missingHp', of: 'self' }] } },
    ],
    textTemplate: 'Heal half of your missing HP. Exhaust.',
    upgrade: { cost: 1 },
  },
  {
    id: 'butterflyPlague', name: 'Plague of Butterflies', class: 'herald', rarity: 'rare', cost: 3, staminaCost: 1, manaCost: 1, type: 'skill',
    flavor: "Red moths of the Furnace Chapel's ossuary.\n\nThey dwelt among the bones for as long as the Chapel kept records, and were called the ossuary's keepers. After the Burning, they left the ossuary for the reach.\n\nWe loose the red moths from the ossuary; they know the way.",
    keywords: [], icon: '🦋',
    effects: [
      { op: 'loseHp', target: 'self', amount: 4 },
      { op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 6 },
    ],
    textTemplate: 'Lose {loseHp} HP. Apply {crimsonBlight} Crimson Blight to ALL enemies.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 4 },
        { op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 8 },
      ],
    },
  },
  {
    id: 'lifeTitheCard', name: 'Life Tithe', class: 'herald', rarity: 'rare', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Tithe of life, owed by each crown-born family.\n\nOne day in seven, given to the Chapel's work, as the dead had given all their days. In the years of the Marking, the tithe was extended to newborns, who could not work.\n\nWe bring the cradle where the bier once stood.",
    keywords: [], icon: '⚰',
    effects: [{ op: 'applyStatus', target: 'self', status: 'lifeTithe', stacks: one }],
    textTemplate: 'Whenever an enemy dies, heal 8 HP.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'crimsonRite', name: 'Crimson Rite', class: 'herald', rarity: 'rare', cost: 'X', staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Chalice of the high altar.\n\nReserved to the Saints. It draws from the Saint as the Saint draws from it. The Furnace Saint performs the rite alone now, and keeps the chalice full.\n\nWe drink from the chalice, and it drinks from us.",
    keywords: [], icon: '🔺',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5, hits: { f: 'energySpent' } },
      { op: 'heal', target: 'self', amount: { f: 'energySpent', per: 2 } },
    ],
    textTemplate: 'Deal {damage} damage, scaling with Energy spent, then heal 2 per Energy.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7, hits: { f: 'energySpent' } },
        { op: 'heal', target: 'self', amount: { f: 'energySpent', per: 3 } },
      ],
      textTemplate: 'Deal {damage} damage, scaling with Energy spent, then heal 3 per Energy.',
    },
  },
  {
    id: 'blightNova', name: 'Blight Nova', class: 'herald', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Reading of every name, aloud and at once.\n\nComposed by the Furnace Saint after the Burning. The novices say it is what the fire did that night, and that the rite exists so it will be remembered. The remnant holds it holiest of the liturgies.\n\nIt has never been performed to its end.",
    keywords: [], icon: '💥',
    effects: [
      { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [2, { f: 'stacks', status: 'crimsonBlight', of: 'target' }] } },
    ],
    textTemplate: "Deal damage equal to twice the target's Crimson Blight.",
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [3, { f: 'stacks', status: 'crimsonBlight', of: 'target' }] } },
      ],
      textTemplate: "Deal damage equal to three times the target's Crimson Blight.",
    },
  },
  {
    id: 'lastRites', name: 'Last Rites', class: 'herald', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'skill',
    flavor: "Rite for those not to be written.\n\nForeigners, criminals, and in the last years, the bought-marked of whom the Chapel had not been told. The rubric forbids a name upon the headstone, and calls this discretion.\n\nThe lower cemetery stands blank by the thousand.",
    keywords: ['exhaust'], icon: '🕯',
    effects: [
      { op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 20 } },
      { op: 'draw', amount: 2 },
    ],
    textTemplate: 'Heal 20% of your max HP. Draw {draw} cards. Exhaust.',
    upgrade: {
      keywords: [],
      textTemplate: 'Heal 20% of your max HP. Draw {draw} cards.',
    },
  },
  {
    id: 'zealotryCard', name: 'Zealotry', class: 'herald', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Creed of the Feral Ember.\n\nEach wound is a door the fire walks through. Its priests bless wounds rather than bind them, and hold that the Chapel knew as much, and hid it behind a ledger.\n\nIts converts do not live long. More come each week.",
    keywords: [], icon: '⚡',
    effects: [{ op: 'applyStatus', target: 'self', status: 'zealotry', stacks: one }],
    textTemplate: 'Whenever you lose HP, deal 3 damage to a random enemy.',
    upgrade: { cost: 1 },
  },
  {
    id: 'bloodHarvest', name: 'Blood Harvest', class: 'herald', rarity: 'rare', cost: 'X', staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Reaping of the field of the marked.\n\nSo the liturgy names the gathering of names at the close of a plague year. The Saints went out with sickles and ledgers, and the rite is spoken throughout as thanksgiving.\n\nWe reap the field of the marked, and give thanks.",
    keywords: [], icon: '🌾',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 4, hits: { f: 'energySpent' } },
      { op: 'heal', target: 'self', amount: { f: 'energySpent', per: 3 } },
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies, scaling with Energy spent. Then heal 3 per Energy.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 6, hits: { f: 'energySpent' } },
        { op: 'heal', target: 'self', amount: { f: 'energySpent', per: 3 } },
      ],
      textTemplate: 'Deal {damage} damage to ALL enemies, scaling with Energy spent. Then heal 3 per Energy.',
    },
  },

  // ---- Content-pass additions (round 2) ---------------------------------------
  // Two more commons (a cheap blood-payment attack and a Blight poke), two
  // uncommons (an HP-gated finisher and a heal-fed power), two rares (a heavy
  // HP-for-damage attack and a Blight-fed power) — rounding the pool to 36.
  {
    id: 'painOffering', name: 'Pain Offering', class: 'herald', rarity: 'common', cost: 0, type: 'attack',
    flavor: "Small pain, offered in advance.\n\nTaught to crown-born children as good citizenship; the children called it paying early. The habit outlived the Chapel among the Forsaken hamlets, learned from refugees after the Burning.\n\nThey keep it without knowing whom they pay.",
    keywords: [], icon: '🩸',
    effects: [
      { op: 'loseHp', target: 'self', amount: 2 },
      { op: 'damage', target: 'enemy', amount: 7 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 2 },
        { op: 'damage', target: 'enemy', amount: 10 },
      ],
    },
  },
  {
    id: 'witheringTouch', name: 'Withering Touch', class: 'herald', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Touch that withers growth.\n\nPermitted by the rubric upon the weeds of the weald's field-shrines, and nothing else. In the years the Field Flame dimmed, a clause was added forbidding its use upon crops.\n\nThe clause is dated after three harvests had failed, and signed by a Saint absent from the roll of Saints.",
    keywords: [], icon: '🦠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 3 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {crimsonBlight} Crimson Blight.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 4 },
      ],
    },
  },
  {
    id: 'desperateRite', name: 'Desperate Rite', class: 'herald', rarity: 'uncommon', cost: 1, type: 'attack',
    flavor: "Rite for when the bier is already made.\n\nThe rubric bids the officiant pray louder, and nothing more. The Saints held that the fire heeds the strength of a voice; the novices, that the rubric was written for the family.\n\nThe Herald has performed it upon themselves.",
    keywords: [], icon: '🔺',
    effects: [
      { op: 'damage', target: 'enemy', amount: 9, if: { p: 'not', pred: { p: 'hpBelowPct', of: 'self', pct: 50 } } },
      { op: 'damage', target: 'enemy', amount: 16, if: { p: 'hpBelowPct', of: 'self', pct: 50 } },
    ],
    textTemplate: 'Deal {damage} damage. If below half HP: deal {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 12, if: { p: 'not', pred: { p: 'hpBelowPct', of: 'self', pct: 50 } } },
        { op: 'damage', target: 'enemy', amount: 20, if: { p: 'hpBelowPct', of: 'self', pct: 50 } },
      ],
    },
  },
  {
    id: 'emberTideCard', name: 'Ember Tide', class: 'herald', rarity: 'uncommon', cost: 1, type: 'power',
    flavor: "The Chapel's name for the night of the Burning.\n\nThe night the fire read the names of the crown-born all at once. The novices say the censers swung untouched through it, as the congregation burned around them. The censers of the Furnace Chapel have not stopped since.\n\nWe kept the censer swinging when the hearth went dark.",
    keywords: [], icon: '🌊',
    effects: [{ op: 'applyStatus', target: 'self', status: 'emberTide', stacks: one }],
    textTemplate: 'Whenever you heal, gain 1 Strength.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodOfferingRite', name: 'Blood Offering', class: 'herald', rarity: 'rare', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Bowl filled with the officiant's own blood.\n\nFrom the Chapel's first years, when the Saints were few; revived by the Furnace Saint after the Burning, when they were fewer. He performs it daily, and grows thin.\n\nThe bowl is always full.",
    keywords: [], icon: '⚰',
    effects: [
      { op: 'loseHp', target: 'self', amount: 6 },
      { op: 'damage', target: 'enemy', amount: 24 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 6 },
        { op: 'damage', target: 'enemy', amount: 30 },
      ],
    },
  },
  {
    id: 'harbingerOfBlightCard', name: 'Harbinger of Blight', class: 'herald', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Title of the Feral Ember's preachers.\n\nThe Chapel gave the same name to the novice who walked before a bier with a bell. The Feral Ember holds that the word was never the Chapel's to give, but the fire's.\n\nWe go before the fire, and it follows us gladly.",
    keywords: [], icon: '❀',
    effects: [{ op: 'applyStatus', target: 'self', status: 'harbingerOfBlight', stacks: one }],
    textTemplate: 'Whenever Crimson Blight is applied to an enemy, heal 1 HP.',
    upgrade: { cost: 1 },
  },

  // ---- Content-pass additions (round 4) --------------------------------------
  {
    id: 'blightwardLash', name: 'Blightward Lash', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Scourge turned upon one's own rot.\n\nA discipline the Herald took up after the Burning: to cut the Blight from their own flesh and turn it outward. The Chapel remnant condemns it as heresy against the fire's gift.\n\nTwice the remnant has sent a novice to ask how it is done.",
    keywords: [], icon: '🦠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 2 },
      { op: 'loseHp', target: 'self', amount: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {crimsonBlight} Crimson Blight. Lose {loseHp} HP.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 3 },
        { op: 'loseHp', target: 'self', amount: 2 },
      ],
    },
  },
  {
    id: 'lastMercy', name: "Last Mercy", class: 'herald', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Warming of a dying hand.\n\nThe Chapel's nursing sisters did it with a coal wrapped in cloth, that the fire might find the hand gentle. The Wandering Physician learned it from them, and does it without the coal.\n\nIt seems to work as well. He cannot say what working means.",
    keywords: [], icon: '🙏',
    effects: [
      { op: 'heal', target: 'self', amount: 5 },
      { op: 'block', target: 'self', amount: 4 },
    ],
    textTemplate: 'Heal {heal} HP. Gain {block} Block.',
    upgrade: {
      effects: [
        { op: 'heal', target: 'self', amount: 7 },
        { op: 'block', target: 'self', amount: 6 },
      ],
    },
  },
  // ---- The class ability card (plan phase 5a, proposal §4) -----------------
  // Litany: the Herald's loop is overheal turned to offence; one card that
  // heals and braces in the same breath.
  {
    id: 'warmLitany', name: 'Warm Litany', class: 'herald', rarity: 'starter', cost: 1, staminaCost: 1, type: 'skill',
    flavor: "First prayer of the Furnace Chapel's novices.\n\nSaid over a small hurt, to keep it warm. The novices were taught its words were older than the Chapel, found by the first Saint cut into the caldera wall.\n\nWe give the name. We keep the warmth.",
    keywords: [], icon: '📿',
    effects: [{ op: 'heal', target: 'self', amount: 3 }, { op: 'block', target: 'self', amount: 3 }],
    textTemplate: 'Heal {heal}. Gain {block} Block.',
    upgrade: {
      effects: [{ op: 'heal', target: 'self', amount: 5 }, { op: 'block', target: 'self', amount: 5 }],
    },
  },
];
