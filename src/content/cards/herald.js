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
    flavor: "The Chapel's rite for a wound taken in its service, done quickly, with the prayer cut to its first line. The rubric instructs the officiant to bind the wound beneath the brand and never over it, so the mark is left clear. The Chapel's physicians held this to be sound medicine. The rubric gives no medical reason.\n\nWe bind the wound beneath the unspent brand.\n— Chapel rubric",
    keywords: [], icon: '✚',
    effects: [{ op: 'heal', target: 'self', amount: 4 }],
    textTemplate: 'Heal {heal} HP.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 6 }] },
  },

  // ---- Commons ----------------------------------------------------------------
  {
    id: 'bloodPact', name: 'Blood Pact', class: 'herald', rarity: 'common', cost: 0, type: 'skill',
    flavor: "The second office of the birth-rite, in which the flame-mark was pressed into a newborn's wrist and the parents answered on the child's behalf. The Chapel called the mark a promise and a privilege. The birth-roll of the crown-born wards records one such marking in an unsteady hand, with a single word struck through beside it. The Herald's name is written above that word.\n\nWe press the promise into each newborn wrist.\n— Chapel birth-roll",
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
    id: 'blightTouch', name: 'Blight Touch', class: 'herald', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "We lay a hand on the brow and the warmth goes in. We learned the gesture from the Chapel's blessing of the sick, and we use it as the Chapel should have: to give, and to keep no account. The Saints call this heresy because they never learned to give without a ledger. Our converts say the touch is warm. We have yet to meet one who said otherwise.\n\n— Feral Ember sermon",
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
    flavor: "A penance of the Furnace Chapel's novices, performed with a knotted cord on the bare back. The Saints taught that pain offered freely spared the fire the trouble of taking it. Novice Wen practised it daily for three years and wrote that she could not say whether it had spared anyone. That entry in her confession ends there, with the Chapel's absolution written beneath it in advance.\n\n— novice's confession",
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
    flavor: "The rite of kneeling on the cold stone of the nave until the knees bleed, prescribed for small failures of devotion. The rubric calls the stone forgiving. Novices knew which flags were coldest. The Chapel's accounts show the nave repaved twice in the Mark Trade years, at great cost, with stone from the caldera, and the rubric gives no reason for the old stone's removal.\n\nWe kneel on the cold stone and are forgiven.\n— Chapel rubric",
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
    flavor: "The closing prayer of the funeral rite, spoken over the ledger once a name had been entered. The Saints taught that it returned a share of warmth to the mourners. Novices learned it before they could read the ledger themselves. The Chapel's last novice says it each night, though the ledger was lost in the Burning and there is no name left to close.\n\nWe close the ledger and thank the warmth.\n— Chapel remnant",
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
    flavor: "The offering made at the graves of the crown-born on the anniversary of their writing. The rubric had the mourners open the grave and set a coal beside what remained, to keep the dead company. The Chapel ended the practice in the Marking years, saying the dead no longer needed it. A note in the margin records that by then the mourners had noticed the graves were colder than they ought to be.\n\n— Chapel rubric, marginal note",
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
    flavor: "A small bleeding before the blessing of the bread, practised by the Saints so that nothing would be taken from the congregation that the Saint had not first given. The Chapel taught it as humility. A cook has added in the margin that the bread ran short on the days of the rite, and that the Saints ate first.\n\nWe bleed into the bowl before we bless the bread.\n— Chapel rubric",
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
    flavor: "The Chapel passed a cup along the pews and taught that the congregation became one body before the fire. We have revived the rite with a different cup. Our congregation is one body more truly than any the Saints assembled, and it grows each winter while theirs shrinks to a single man feeding an empty hearth.\n\nWe pass one cup along the pews, and every mouth is red.\n— Feral Ember sermon",
    keywords: [], icon: '☣',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 2 }],
    textTemplate: 'Apply {crimsonBlight} Crimson Blight to ALL enemies.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 3 }] },
  },
  {
    id: 'cullTheWeak', name: 'Cull the Weak', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
    flavor: "The Chapel's rite of gathering the failing first, performed in the sick-wards of the crown-born. The rubric frames it as mercy, so that the dying need not linger. I served in those wards and kept my own list of the patients gathered. Many of them I had expected to recover. I could not learn, afterward, who had decided otherwise.\n\n— Wandering Physician's notes",
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
    flavor: "Blood poured from one cup into another and called communion, a rite the Saints performed between themselves and the dying of good family. The rubric describes the Saint as giving and says nothing of receiving. Novice Wen wrote that the flow went both ways, and that the Saints came out of the rite looking younger. She does not say who told her so.\n\n— novice's confession",
    keywords: [], icon: '➕',
    effects: [{ op: 'heal', target: 'self', amount: 6 }],
    textTemplate: 'Heal {heal} HP.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 9 }] },
  },
  {
    id: 'blightward', name: 'Blightward', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
    flavor: "A cloth laid over an unfinished brand. The Chapel remnant began the practice for the Herald, whose mark started to burn on the night of the Burning and stopped partway, and now lays the same cloth over the brands of its dead. The remnant teaches that the fire will come back to finish what it began. The Herald wears the cloth, and has not accepted the teaching.\n\nThe fire started on me and stopped. I do not know why.\n— Chapel remnant, quoting the Herald",
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
    flavor: "The Saint's offering of their own blood at the altar when the censer ran low. The Chapel taught that a Saint's blood burned hotter than any incense. When the censers of the Furnace Chapel were cleaned in the Spire years, the cleaners found dried blood layered beneath the ash, so thick that the censers had been refitted to hold it.\n\nWe spend ourselves at the altar, and the censer swings faster.\n— Chapel sacristy book",
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
    flavor: "Red flowers that grow on the graves of the crown-born, first recorded in the Furnace Chapel's garden in the Long Winter. The remnant tends them as a sign that the dead are giving. The flowers spread fastest where the ground has been turned recently. The remnant has begun turning more ground.\n\nWe tend the red flowers on the graves, and they spread.\n— Chapel remnant garden-book",
    keywords: ['exhaust'], icon: '🌺',
    effects: [
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: { f: 'stacks', status: 'crimsonBlight', of: 'target' } },
    ],
    textTemplate: "Double the target's Crimson Blight. Exhaust.",
    upgrade: { keywords: [], textTemplate: "Double the target's Crimson Blight." },
  },
  {
    id: 'sacredHarvest', name: 'Sacred Harvest', class: 'herald', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "The Chapel's harvest rite, in which a gilded sickle was blessed and carried through the fields of the crown-born. The Chapel found the harvest beautiful and built a chapel for it, as it did with most things it found beautiful. The rubric lists what the sickle is to cut, in the fields and afterward. The second half of the list is written in the old script.\n\nWe gild the sickle and bless what it takes.\n— Chapel rubric",
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
    flavor: "A crown of briar worn by the Saints on the feast of the Founding, in memory of the first Saint, who by Chapel tradition wore thorns in the caldera. The Chapel held that each thorn stood for a name the Saint carried. The Thorn Matriarch of the Briar Sanctum grew her own crown in the Long Winter, and the remnant counts her a Saint, though she was a Warden and never swore to the Chapel.\n\n— Chapel remnant calendar",
    keywords: [], icon: '🌿',
    effects: [{ op: 'applyStatus', target: 'self', status: 'thornHalo', stacks: one }],
    textTemplate: 'At the start of your turn, apply 1 Crimson Blight to ALL enemies.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'communionCard', name: 'Communion', class: 'herald', rarity: 'uncommon', cost: 2, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "The sharing of warmth among the congregation, as practised at the Tidebound Chapel on the Drowned Coast, which the Saints raised to keep watch on the Spire. Our congregation has grown smaller each winter since the Spire was finished, and we have stopped reading the roll aloud.\n\nWe watched from Tidebound Chapel and never saw the heresy lit.\n— Tidebound Chapel register",
    keywords: [], icon: '🕊',
    effects: [{ op: 'applyStatus', target: 'self', status: 'communion', stacks: one }],
    textTemplate: 'At the start of your turn, heal 3 HP.',
    upgrade: { cost: 1 },
  },
  {
    id: 'gildedOath', name: 'Gilded Oath', class: 'herald', rarity: 'uncommon', cost: 2, type: 'skill',
    flavor: "The oath sworn to the Goldbough's crest, a gilded branch bearing three flames on three twigs. The Chapel taught that the branch was the kingdom and the flames its hearths. Novices swore it at their first vigil, before they were told what the hearths were kept on. The crest above the Furnace Chapel's nave has a fourth twig, bare, which the Chapel's accounts blame on a careless gilder.\n\n— Chapel accounts",
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
    flavor: "The censer-bearer walked before the Chapel's procession through the sick-wards, and the Saints taught that the smoke opened doors to the fire's blessing. We took up the office when the Chapel dropped it, and we carry the censers lit through the weald. The doors open for us more readily than they ever opened for the Saints.\n\n— Feral Ember sermon",
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
    flavor: "A giving of blood until the giver is light enough to rise, as the liturgy puts it. The Saints used it in the last extremity, when a hearth faltered and no other offering was at hand. The Chapel's records list the Saints who performed it and rose. They do not say where to, and the graves assigned to those Saints were found empty when the Chapel opened them.\n\n— Chapel record of Saints",
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
    flavor: "The marks of the Saints, worn openly on hands and brow. The Chapel held that they appeared on the devout as a favour of the fire. Novices learned that they appeared more reliably on Saints with access to a knife. Novice Wen's confession says so plainly, and then asks forgiveness for saying it, twice.\n\n— novice's confession",
    keywords: [], icon: '🩹',
    effects: [{ op: 'applyStatus', target: 'self', status: 'stigmata', stacks: one }],
    textTemplate: 'Whenever you lose HP, heal 2 HP.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'scourge', name: 'Scourge', class: 'herald', rarity: 'uncommon', cost: 2, type: 'attack',
    flavor: "The walk of penance down the nave of the Furnace Chapel, scourge in hand, while the congregation answered each blow. The rubric sets the number of blows by the number of names written that season. In the last seasons before the Burning the rite took all night. The rubric was never amended to shorten it.\n\nWe walk the nave with the scourge, and the pews answer.\n— Chapel rubric",
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
    flavor: "The taking back of warmth lent to the dying, performed by the Saints at a deathbed once the name had been read. The Chapel called it a courtesy returned. The rubric notes that the dying are colder afterward and the officiant warmer, and closes with an instruction not to explain the rite to the family.\n\n— Chapel rubric",
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
    flavor: "The Chapel's rite for recovery from grave illness, named for the second flowering of the weald's orchards, which came late in years when the Field Flame was strong. The Chapel claimed both as its own work. Neither has come since the Burning. The last novice performs the rite regardless, and says it works.\n\n— Chapel liturgy, novice's copy",
    keywords: ['exhaust'], icon: '🌸',
    effects: [
      { op: 'heal', target: 'self', amount: { f: 'mul', args: [0.5, { f: 'missingHp', of: 'self' }] } },
    ],
    textTemplate: 'Heal half of your missing HP. Exhaust.',
    upgrade: { cost: 1 },
  },
  {
    id: 'butterflyPlague', name: 'Plague of Butterflies', class: 'herald', rarity: 'rare', cost: 3, staminaCost: 1, manaCost: 1, type: 'skill',
    flavor: "A swarm of red moths released from the Furnace Chapel's ossuary, where they had lived among the bones for as long as the Chapel's records run. The Chapel called them the ossuary's keepers. After the Burning they left the ossuary and went out into the reach. The remnant says they know the way, and does not say to where.\n\nWe loose the red moths from the ossuary; they know the way.\n— Chapel remnant",
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
    flavor: "The tithe of life the Chapel asked of each crown-born family: one day in seven given to the Chapel's work, as the dead had given all their days. The Chapel called it a small thing beside the gift of the dead. In the Marking years the tithe was extended to newborns, who could not work, and so were counted instead.\n\nWe bring the cradle where the bier once stood.\n— Chapel liturgy",
    keywords: [], icon: '⚰',
    effects: [{ op: 'applyStatus', target: 'self', status: 'lifeTithe', stacks: one }],
    textTemplate: 'Whenever an enemy dies, heal 8 HP.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'crimsonRite', name: 'Crimson Rite', class: 'herald', rarity: 'rare', cost: 'X', staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "The drinking of the chalice at the high altar, a rite reserved to the Saints. The rubric describes the chalice as drawing from the Saint as the Saint draws from it. The Furnace Saint performs the rite alone now and keeps the chalice full. The remnant does not ask him with what.\n\nWe drink from the chalice, and it drinks from us.\n— Chapel remnant",
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
    flavor: "The reading of names aloud, all of them and all at once. The novices say this is what the fire did on the night of the Burning, and that the rite exists so it will be remembered. The Furnace Saint composed it afterward, and the remnant holds it the holiest of the liturgies. It has never been performed through to the end.\n\n— novices' account",
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
    flavor: "The rite for the dying who were not to be written: foreigners, criminals and, in the last years, the bought-marked the Chapel had not been told about. The rubric instructs that no name be carved on the headstone, and calls this discretion. The headstones of the lower cemetery stand blank by the thousand, and the ledger accounts for none of them.\n\nWe leave no name upon the cold headstone.\n— Chapel rubric",
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
    flavor: "We teach that each wound is a door the fire walks through, and we bless wounds instead of binding them. The Chapel knew this and hid it behind a ledger, so that the fire would come only to those it had promised. We promise nothing. Our converts do not live long. We bury them under antlers and wax at the shrine, and more come every week.\n\n— Feral Ember sermon",
    keywords: [], icon: '⚡',
    effects: [{ op: 'applyStatus', target: 'self', status: 'zealotry', stacks: one }],
    textTemplate: 'Whenever you lose HP, deal 3 damage to a random enemy.',
    upgrade: { cost: 1 },
  },
  {
    id: 'bloodHarvest', name: 'Blood Harvest', class: 'herald', rarity: 'rare', cost: 'X', staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "The reaping of the field of the marked, as the liturgy names the gathering of names at the close of a plague year. The Saints went out with sickles and ledgers, and the rite is described throughout as thanksgiving. The field-born families were not asked to give thanks. The rubric assumes they would.\n\nWe reap the field of the marked, and give thanks.\n— Chapel liturgy",
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
    flavor: "A small pain offered in advance, so that more is not asked later. The Chapel taught it to the children of the crown-born as good citizenship, and the children called it paying early. The habit outlived the Chapel in the Forsaken hamlets, which learned it from refugees after the Burning and keep it without knowing whom they are paying.\n\nWe give a little now, that we are not asked later.\n— Chapel liturgy",
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
    flavor: "A touch that withers growth, which the rubric permits on weeds in the weald's field-shrines and on nothing else. The permission was revised in the years the Field Flame dimmed, to add a clause forbidding the touch on crops. The clause is dated after three harvests had already failed, and it is signed by a Saint whose name does not appear in the roll of Saints.\n\n— Chapel rubric",
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
    flavor: "A rite for when the bier is already made up. The rubric instructs the officiant to pray louder and gives no other instruction. The Saints held that the fire listened to the strength of a voice. The novices held that it listened to nothing, and that the rubric was written for the family. The Herald has performed the rite on themselves, and keeps their conclusion private.\n\n— novices' account",
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
    flavor: "The Chapel's name for the night the fire read the names of the crown-born all at once. The novices say the censers kept swinging through it, untouched, while the congregation burned around them. The remnant teaches that the tide will come again and that the faithful should keep their censers moving. The censers of the Furnace Chapel have not stopped since.\n\nWe kept the censer swinging when the hearth went dark.\n— Chapel remnant",
    keywords: [], icon: '🌊',
    effects: [{ op: 'applyStatus', target: 'self', status: 'emberTide', stacks: one }],
    textTemplate: 'Whenever you heal, gain 1 Strength.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodOfferingRite', name: 'Blood Offering', class: 'herald', rarity: 'rare', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A bowl filled with the officiant's own blood, when there is no one else left to fill it. The rite dates from the Chapel's first years, when the Saints were few, and the Furnace Saint revived it after the Burning, when the Saints were fewer. He performs it daily and has grown thin on it. The bowl is always full.\n\nWe fill the bowl ourselves; nobody else is left to.\n— Chapel remnant",
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
    flavor: "We go before the fire, and it follows us gladly. The Chapel used the same title for the novice who walked ahead of a funeral bier with a bell, and in its day the fire followed them too. The Saints say we stole the word. It was never theirs to lend. It was the fire's, and the fire has given it to us.\n\n— Feral Ember sermon",
    keywords: [], icon: '❀',
    effects: [{ op: 'applyStatus', target: 'self', status: 'harbingerOfBlight', stacks: one }],
    textTemplate: 'Whenever Crimson Blight is applied to an enemy, heal 1 HP.',
    upgrade: { cost: 1 },
  },

  // ---- Content-pass additions (round 4) --------------------------------------
  {
    id: 'blightwardLash', name: 'Blightward Lash', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
    flavor: "The scourge turned on one's own rot, a discipline the Herald took up after the Burning and the Chapel remnant condemns. The Herald cuts the Blight from their own flesh and turns it outward. The remnant calls this heresy against the fire's gift. It has also, on two occasions, sent a novice to ask the Herald how it is done.\n\n— novices' account",
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
    flavor: "The warming of a dying hand so that the fire would find it gentle. The nursing sisters of the Chapel did it in the sick-wards with a coal wrapped in cloth, holding that a warm hand was easier to read. I learned it from them and do it without the coal. It seems to work as well, though I could not tell you what working means here.\n\n— Wandering Physician's notes",
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
    flavor: "The first prayer a novice of the Furnace Chapel learned, said over a small hurt to keep it warm. Novices were told the words were older than the Chapel itself, and that the first Saint had found them cut into the caldera wall. The last novice says it daily, over wounds that are not always small.\n\nWe give the name. We keep the warmth.\n— Chapel remnant",
    keywords: [], icon: '📿',
    effects: [{ op: 'heal', target: 'self', amount: 3 }, { op: 'block', target: 'self', amount: 3 }],
    textTemplate: 'Heal {heal}. Gain {block} Block.',
    upgrade: {
      effects: [{ op: 'heal', target: 'self', amount: 5 }, { op: 'block', target: 'self', amount: 5 }],
    },
  },
];
