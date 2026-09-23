// src/content/cards/reaver.js — the Reaver pool (SPEC §5.2; grown to 30
// rewardable cards to match the other classes).
//
// Pure data. Every card's numbers come from the SPEC §5.2 table; text tokens
// bind to effects per SPEC §3.13. Powers with invisible stack counts use
// formula-valued stacks ({f:'add',args:[1]}) — formula values are exempt from
// the literal-number token rule (documented in DEVELOPER.md).
//
// Content-pass additions deepen the stance / Bleed / Poise identity: Riposte &
// Cleaving Blow (Poise), Rend & Bloodhunter's Strike (Bleed), Warding Lunge
// (defense + Gorefire), Impale (Stagger→Bleed), and Sanguine Pact (a power
// that turns Bleed bursts into Strength).

const one = { f: 'add', args: [1] };

export const reaverCards = [
  // ---- Starters -------------------------------------------------------------
  {
    // Shared basic (all three classes start with Strikes/Defends — colorless).
    id: 'strike', name: 'Strike', class: 'colorless', rarity: 'starter', cost: 1, type: 'attack',
    flavor: "First cut of the hamlets.\n\nMade with whatever edge the hamlet owns. Marl's Hollow sends one climber each winter, chosen at the well, and the chosen spends the last evening at the whetting post learning this and nothing more.\n\nThe marked learned a thousand cuts. It did them no good.",
    keywords: [], icon: '⚔',
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }],
    textTemplate: 'Deal {damage} damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 9 }] },
  },
  {
    id: 'defend', name: 'Defend', class: 'colorless', rarity: 'starter', cost: 1, type: 'skill',
    flavor: "First guard of the road.\n\nTwo crossed lines upon a cairn stone: hold. Cut by climbers for climbers, before the Burning, when the ring was closed to the unmarked.\n\nThe mark does not say what to hold against, nor for how long.",
    keywords: [], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 5 }],
    textTemplate: 'Gain {block} Block.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 8 }] },
  },
  {
    id: 'technique', name: 'Footwork', class: 'colorless', rarity: 'starter', cost: 1, type: 'skill',
    flavor: "Steps cut into the road.\n\nToo even to be natural, too worn to be recent. The Forsaken credit them to the climbers before. They run past the farthest point any Forsaken is known to have reached, and some lead onto the viaducts, older than the kingdom.\n\nClimbers before you cut steps. Use them.",
    keywords: [], icon: '✧',
    effects: [{ op: 'block', target: 'self', amount: 3 }, { op: 'draw', amount: 1 }],
    textTemplate: 'Gain {block} Block. Draw {draw} card.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'draw', amount: 1 }] },
  },
  // THE UNARMED PACKAGE (framework contract: Unarmed fallback — the entities
  // framework.evasiveGuard and framework.dodgeRoll, authored here as the base
  // cards the unarmed guard and technique profiles resolve to). Evasive Guard
  // is a guard that also dodges; Dodge Roll is the pure dodge, priced by the
  // Weight Class the player stands in (mechanics.json), not by this cost.
  {
    id: 'evasiveGuard', name: 'Evasive Guard', class: 'colorless', rarity: 'starter', cost: 1, type: 'skill',
    flavor: "Sidestep of the Pale Marches ice-fishers.\n\nThe lakes have not thawed since the Burning. The ice cracks all the year round, and gives only beneath a second pair of feet; the fishers learned to trust the sound.\n\nWidow Arne of Sallow Lake says the sound changed last winter. She fishes no longer.",
    keywords: [], icon: '🌀',
    effects: [{ op: 'block', target: 'self', amount: 1 }, { op: 'dodgeRoll', target: 'self' }],
    textTemplate: 'Gain {block} Block, then roll to evade: on a success, gain Block equal to the dodge.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 3 }, { op: 'dodgeRoll', target: 'self' }] },
  },
  {
    id: 'dodgeRoll', name: 'Dodge Roll', class: 'colorless', rarity: 'starter', cost: 0, staminaCost: 1, type: 'skill',
    flavor: "Tumble of the ship-breakers.\n\nLearned upon hulls that shift with every tide at the Grave of Ships. The hulls were already rotting at anchor when the trade stopped, and on the night of the Burning, every hold went warm at once.\n\nGull-Bet's gang opened the holds the following spring. She has not said what was inside.",
    keywords: [], icon: '💨',
    effects: [{ op: 'dodgeRoll', target: 'self' }],
    textTemplate: 'Roll to evade: on a success, gain Block from the dodge. Light: 1 Stamina. Medium: 2 Stamina, 1 Energy. Heavy: 3 Stamina, 2 Energy.',
    // No `upgrade`: the pure dodge has nothing of its own to improve — its
    // check is Dexterity and the Weight Class, its guard is the framework
    // rule's, its price is the class's. An upgrade that changed none of them
    // would spend an upgrade for nothing, so the card offers none and the
    // upgrade opcode never lists a composed instance (see actions.js).
  },
  {
    id: 'gorefireSlash', name: 'Gorefire Slash', class: 'reaver', rarity: 'starter', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Art of the sellswords of the Bastion.\n\nThe hired blades who held the Fell Courtyard wetted their steel with their own blood before each watch, for the Gorefire takes more readily to a blade already red.\n\nThe Wardens called it discipline. The sellswords knew it as a price, paid in advance.",
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 5 },
      ],
    },
  },

  // ---- Commons ---------------------------------------------------------------
  {
    id: 'crimsonCleave', name: 'Crimson Cleave', class: 'reaver', rarity: 'common', cost: 2, staminaCost: 1, type: 'attack',
    flavor: "Wide cut of the Fell Courtyard watch.\n\nTaught for a gate choked with bodies. On the night the Bastion burned, the dead came up the Muster Stair in numbers the watch had no word for, and this was the only answer it had.\n\nThe gate log names the watch whole at the bell. Its hand changes halfway down the page.",
    keywords: [], icon: '🪓',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 8 },
      { op: 'applyStatus', target: 'allEnemies', status: 'bleed', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Apply {bleed} Bleed to ALL.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 11 },
        { op: 'applyStatus', target: 'allEnemies', status: 'bleed', stacks: 2 },
      ],
    },
  },
  {
    id: 'shieldBash', name: 'Shield Bash', class: 'reaver', rarity: 'common', cost: 1, staminaCost: 1, type: 'attack',
    flavor: "Rim-strike of the Wardens' shield line.\n\nDrilled in the years of the Spring Wars, when envoys of the Northern Holds came to the Bastion gate to haggle the price of a spring. The Wardens struck with the rim, for the face bore the gilded crest.\n\nTwice the Holds were struck. Twice they paid.",
    keywords: [], icon: '🛡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'poiseDamage', target: 'enemy', amount: 4 },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'poiseDamage', target: 'enemy', amount: 5 },
      ],
    },
  },
  {
    id: 'quickstep', name: 'Quickstep', class: 'reaver', rarity: 'common', cost: 1, staminaCost: 1, type: 'skill',
    flavor: "Footwork of the Bastion's hired blades.\n\nAfter the Burning the weald's spring would not turn, and green came up between the courtyard flags. The sellswords learned short, flat steps upon the moss. The Wardens, who never stood where the footing was worst, did not.\n\nThe steps are counted to a dawn peal that brings no dawn.",
    keywords: [], icon: '👣',
    effects: [
      { op: 'block', target: 'self', amount: 6 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Gain {block} Block. Draw {draw} card.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 8 },
        { op: 'draw', amount: 1 },
      ],
    },
  },
  {
    id: 'guardCounter', name: 'Guard Counter', class: 'reaver', rarity: 'common', cost: 1, staminaCost: 1, type: 'attack',
    flavor: "Riposte of the sworn Wardens.\n\nThe enemy commits; the Bastion answers, and its answer is always the greater. So the Wardens taught the drill, and so they told of the Spring Wars, in which they claimed never to have struck first.\n\nThe Northern Holds remember it otherwise.",
    keywords: [], icon: '↩',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4, if: { p: 'not', pred: { p: 'hasBlock', of: 'self' } } },
      { op: 'damage', target: 'enemy', amount: 10, if: { p: 'hasBlock', of: 'self' } },
    ],
    textTemplate: 'Deal {damage} damage. If you have Block: deal {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6, if: { p: 'not', pred: { p: 'hasBlock', of: 'self' } } },
        { op: 'damage', target: 'enemy', amount: 14, if: { p: 'hasBlock', of: 'self' } },
      ],
    },
  },
  {
    id: 'ironResolve', name: 'Iron Resolve', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Standing order of the Bastion.\n\nRead at the muster peal: a Warden holds until relieved, and relief comes by the bell. The bell-roll kept the names of all who held.\n\nAfter the Burning, the roll runs on for many pages, in a hand no scribe knew, bearing names no Warden ever enlisted.",
    keywords: [], icon: '⛨',
    effects: [
      { op: 'block', target: 'self', amount: 5, if: { p: 'not', pred: { p: 'inStance', stance: 'bulwark' } } },
      { op: 'block', target: 'self', amount: 9, if: { p: 'inStance', stance: 'bulwark' } },
    ],
    textTemplate: 'Gain {block} Block. If in Bulwark Stance: gain {block.2} instead.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7, if: { p: 'not', pred: { p: 'inStance', stance: 'bulwark' } } },
        { op: 'block', target: 'self', amount: 12, if: { p: 'inStance', stance: 'bulwark' } },
      ],
    },
  },
  {
    id: 'serratedBlade', name: 'Serrated Blade', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Saw-backed blade from the forges beneath the Bastion ridge.\n\nWeald smiths filed its teeth for clearing briar, and the Wardens took it up when the Blight came out of the woods. The smiths were never paid for the change of use.\n\nHow the briar learned to bleed, the smiths will not speak of.",
    keywords: [], icon: '🪚',
    effects: [
      { op: 'damage', target: 'enemy', amount: 7 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: { p: 'hasStatus', of: 'target', status: 'bleed' } },
    ],
    textTemplate: 'Deal {damage} damage. If the target has Bleed: apply {bleed} more Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 9 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 4, if: { p: 'hasStatus', of: 'target', status: 'bleed' } },
      ],
    },
  },
  {
    id: 'enterGorefire', name: 'Enter: Gorefire', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    flavor: "The breaking stance, first of the Wardens' two.\n\nThe drill is to hold the flame in the blade, not the hand. Sergeants warned that the stance takes the hand if held too long. Sellswords held it longest of all, which the Wardens took for greed.\n\nHold the flame in the blade; it still takes the hand.",
    keywords: [], icon: '🔥',
    effects: [
      { op: 'enterStance', stance: 'gorefire' },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Enter Gorefire Stance. Draw {draw} card.',
    upgrade: { cost: 0 },
  },
  {
    id: 'enterBulwark', name: 'Enter: Bulwark', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    flavor: "The holding stance, second of the Wardens' two.\n\nLow and square, shield set to the hinge side. The Wardens called the gate a wall a man could carry, and held that no gate kept in this stance had ever fallen.\n\nThat teaching was set down before the Burning, and was never amended.",
    keywords: [], icon: '🛡',
    effects: [{ op: 'enterStance', stance: 'bulwark' }],
    textTemplate: 'Enter Bulwark Stance.',
    upgrade: {
      effects: [
        { op: 'enterStance', stance: 'bulwark' },
        { op: 'block', target: 'self', amount: 3 },
      ],
      textTemplate: 'Enter Bulwark Stance. Gain {block} extra Block.',
    },
  },
  {
    id: 'riposte', name: 'Riposte', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Return off the guard, as the Citadel fencing-masters taught it.\n\nThe Court held it too fine for field-born hands. Its manual shows a bout upon the bridges in the first year of the Mark Trade, a Knight against an unnamed Warden, and declares the Knight victorious.\n\nIn the illustration, the Knight lies upon his back.",
    keywords: [], icon: '⚔',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'poiseDamage', target: 'enemy', amount: 4, if: { p: 'hasBlock', of: 'self' } },
    ],
    textTemplate: 'Deal {damage} damage. If you have Block: deal {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'poiseDamage', target: 'enemy', amount: 6, if: { p: 'hasBlock', of: 'self' } },
      ],
    },
  },
  {
    id: 'rend', name: 'Rend', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Tearing cut for the rot of the weald.\n\nWritten into the field-book after the Burning, by whoever keeps it now. It bids the reader cut the rot from hound and hamlet folk alike, for the rot came up the river road with the Court's traders.\n\nThe ink is fresh. The hand shakes.",
    keywords: [], icon: '🩸',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2, if: { p: 'inStance', stance: 'gorefire' } },
    ],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed. Gorefire: apply {bleed.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2, if: { p: 'inStance', stance: 'gorefire' } },
      ],
    },
  },
  {
    id: 'cleavingBlow', name: 'Cleaving Blow', class: 'reaver', rarity: 'common', cost: 2, type: 'attack',
    flavor: "Heavy sweep of the weald hamlets.\n\nLearned by watching the Wardens from beyond the walls, for no Warden would teach the unmarked. It is swung in the winters when blight-hounds come down out of the lanternwood in packs.\n\nThe Wardens called the weald their charge. The hamlets paid for that charge in spring grain.",
    keywords: [], icon: '🪓',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 7 },
      { op: 'poiseDamage', target: 'allEnemies', amount: 3 },
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Deal {poiseDamage} Poise damage to ALL.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 9 },
        { op: 'poiseDamage', target: 'allEnemies', amount: 4 },
      ],
    },
  },

  // ---- Uncommons --------------------------------------------------------------
  {
    id: 'stomp', name: 'Stomp', class: 'reaver', rarity: 'uncommon', cost: 2, staminaCost: 1, type: 'attack',
    flavor: "Heel-strike of the Fell Courtyard.\n\nThe Wardens named it unworthy and used it all the same, for in the courtyard the fallen seldom stayed down. Sellswords held that the Wardens objected only to being seen at it.\n\nMany an old Bastion helm bears the dent of a heel.",
    keywords: [], icon: '🦶',
    effects: [
      { op: 'damage', target: 'enemy', amount: 12 },
      { op: 'poiseDamage', target: 'enemy', amount: 8 },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 16 },
        { op: 'poiseDamage', target: 'enemy', amount: 10 },
      ],
    },
  },
  {
    id: 'rallyingStandard', name: 'Rallying Standard', class: 'reaver', rarity: 'uncommon', cost: 1, type: 'power',
    flavor: "Banner of the Bastion muster.\n\nRaised when the bell rang the line into place. The drill ends thus: raise the standard, sound the bell, log that the line held.\n\nThe final muster is logged as held, at dawn. The Bastion has seen no dawn since the Burning.",
    keywords: [], icon: '⚑',
    effects: [{ op: 'applyStatus', target: 'self', status: 'rallyingStandard', stacks: one }],
    textTemplate: 'At the start of your turn, gain 1 Strength and take 1 damage.',
    upgrade: {
      effects: [{ op: 'applyStatus', target: 'self', status: 'rallyingStandardUp', stacks: one }],
      textTemplate: 'At the start of your turn, gain 1 Strength.',
    },
  },
  {
    id: 'warSurgeon', name: 'War Surgeon', class: 'reaver', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'skill',
    flavor: "Field practice of the Bastion's surgeon-wardens.\n\nThey stitched wounds upon the wall, never below it, for a Warden stitched standing remained a Warden, and one carried to the stool was struck from the roll. The Wardens claimed their surgeons outdid the Chapel's physicians.\n\nThe Chapel's own figures burned with the Chapel.",
    keywords: ['exhaust'], icon: '⚕',
    effects: [
      {
        op: 'heal', target: 'self',
        amount: { f: 'mul', args: [2, { f: 'stacks', status: 'bleed', of: 'allEnemies', per: 4 }] },
      },
    ],
    textTemplate: 'Heal 2 HP for every 4 Bleed on all enemies. Exhaust.',
    upgrade: {
      effects: [
        {
          op: 'heal', target: 'self',
          amount: { f: 'mul', args: [2, { f: 'stacks', status: 'bleed', of: 'allEnemies', per: 3 }] },
        },
      ],
      textTemplate: 'Heal 2 HP for every 3 Bleed on all enemies. Exhaust.',
    },
  },
  {
    id: 'hemorrhage', name: 'Hemorrhage', class: 'reaver', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Second cut, laid into an open wound.\n\nThe Court's surgeons, who studied such matters, recorded that Wardens bled longer than other men beneath the knife, and blamed the thinness of field-born blood. The finding was signed by the surgeons as one body.\n\nNo cases were attached to it.",
    keywords: ['exhaust'], icon: '🩸',
    effects: [
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: { f: 'stacks', status: 'bleed', of: 'target' } },
    ],
    textTemplate: "Double the target's Bleed. Exhaust.",
    upgrade: {
      keywords: [],
      textTemplate: "Double the target's Bleed.",
    },
  },
  {
    id: 'twinbladeFlurry', name: 'Twinblade Flurry', class: 'reaver', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'attack',
    flavor: "Two short blades, worked in turn, as the weald's sellswords used them.\n\nToo poor for a shield and too proud to carry a Warden's, they were hired for the Bastion's narrow gates. It is said part of their wage was paid in marks rather than coin: a right to the city's warmth.\n\nThose who refused the mark are the ones who tell of it.",
    keywords: [], icon: '⚔',
    effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }],
    textTemplate: 'Deal {damage} damage {hits} times.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 3 }] },
  },
  {
    id: 'shieldwall', name: 'Shieldwall', class: 'reaver', rarity: 'uncommon', cost: 2, staminaCost: 1, type: 'skill',
    flavor: "Formation of the Bastion's shield line.\n\nRim locked to rim across the Fell Courtyard. The Wardens credited it with holding the gate through three hungry winters of the Spring Wars, when Hold petitioners camped below the walls.\n\nThe field-book enters the price of spring in the same column as the petitioners turned away.",
    keywords: [], icon: '🧱',
    effects: [
      { op: 'block', target: 'self', amount: 12 },
      { op: 'applyStatus', target: 'self', status: 'bulwarkEcho', stacks: one, if: { p: 'inStance', stance: 'bulwark' } },
    ],
    textTemplate: 'Gain {block} Block. If in Bulwark Stance: gain 4 Block next turn.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 16 },
        { op: 'applyStatus', target: 'self', status: 'bulwarkEcho', stacks: one, if: { p: 'inStance', stance: 'bulwark' } },
      ],
    },
  },
  {
    id: 'kickOff', name: 'Kick Off', class: 'reaver', rarity: 'uncommon', cost: 0, staminaCost: 1, type: 'attack',
    flavor: "Boot-strike of the Muster Stair.\n\nSellswords learned it upon steps steep enough that the fall does the killing. The Wardens forbade it as common, and had adopted it within a season.\n\nWhat is kicked from the stair now climbs it again.",
    keywords: ['exhaust'], icon: '🥾',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'poiseDamage', target: 'enemy', amount: 3 },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. Exhaust.',
    upgrade: {
      keywords: [],
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'poiseDamage', target: 'enemy', amount: 3 },
      ],
      textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    },
  },
  {
    id: 'wardingLunge', name: 'Warding Lunge', class: 'reaver', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'skill',
    flavor: "Guarded advance into the breaking stance.\n\nTaught as the moment to cease holding and begin taking ground. The Warden was to know that moment by the bell. When the Bellfoundry bell cracked, a new line was added beneath.\n\nKnow it by the smell of the courtyard.",
    keywords: [], icon: '🛡',
    effects: [
      { op: 'block', target: 'self', amount: 8 },
      { op: 'enterStance', stance: 'gorefire' },
    ],
    textTemplate: 'Gain {block} Block. Enter Gorefire Stance.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 11 },
        { op: 'enterStance', stance: 'gorefire' },
      ],
    },
  },
  {
    id: 'impale', name: 'Impale', class: 'reaver', rarity: 'uncommon', cost: 2, type: 'attack',
    flavor: "Pinning thrust of the weald hamlets.\n\nLearned in the first winter of the Blight, against what rose from the drowned hamlet and would not stay down. A pinned thing stops, the hamlets say. The Wardens would once have burned such things.\n\nBut the fire went into the Wardens that winter.",
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 9 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 6, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
    ],
    textTemplate: 'Deal {damage} damage. If the target is Staggered: apply {bleed} Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 12 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 8, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
      ],
    },
  },
  {
    id: 'warcry', name: 'Warcry', class: 'reaver', rarity: 'uncommon', cost: 0, staminaCost: 1, type: 'skill',
    flavor: "The bell-roll, shouted.\n\nA custom of the gates farthest from the Bellfoundry, where the bell could not be heard. The Wardens held that the roll bore power of its own if read in order. Sellswords, who were not on it, shouted it all the same.\n\nIt is said the Bell Keeper answers, with a cracked bell.",
    keywords: ['exhaust'], icon: '📣',
    effects: [
      { op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Gain {strength} Strength. Draw {draw} card. Exhaust.',
    upgrade: {
      keywords: [],
      textTemplate: 'Gain {strength} Strength. Draw {draw} card.',
    },
  },

  // ---- Rares -------------------------------------------------------------------
  {
    id: 'executioner', name: 'Executioner', class: 'reaver', rarity: 'rare', cost: 2, staminaCost: 1, type: 'attack',
    flavor: "Finishing blow of the Fell Warden.\n\nTaught before his leg went the way of the weald and his blade was ground into a cane. The field-book holds that he never struck a man already kneeling.\n\nThe last page in his hand, dated the night of the Burning, is a list of kneeling men.",
    keywords: [], icon: '⚰',
    effects: [
      { op: 'damage', target: 'enemy', amount: 10, if: { p: 'not', pred: { p: 'hasStatus', of: 'target', status: 'staggered' } } },
      { op: 'damage', target: 'enemy', amount: 25, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
    ],
    textTemplate: 'Deal {damage} damage. If the target is Staggered: deal {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 14, if: { p: 'not', pred: { p: 'hasStatus', of: 'target', status: 'staggered' } } },
        { op: 'damage', target: 'enemy', amount: 32, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
      ],
    },
  },
  {
    id: 'goreblood', name: "Goreblood", class: 'reaver', rarity: 'rare', cost: 3, type: 'power',
    flavor: "The Wardens' name for blood-madness.\n\nThe state in which a fighter has spilled enough of their own blood that fear no longer holds. In sworn men the Wardens called it virtue; in sellswords, vice. The two are described in the same words.\n\nIts only instruction: keep standing.",
    keywords: [], icon: '♛',
    effects: [{ op: 'applyStatus', target: 'self', status: 'goreblood', stacks: one }],
    textTemplate: 'Poise thresholds no longer increase after filling.',
    upgrade: { cost: 2 },
  },
  {
    id: 'unbreakable', name: 'Unbreakable', class: 'reaver', rarity: 'rare', cost: 2, type: 'power',
    flavor: "Order to hold the Fell Courtyard gate.\n\nDated, signed and never countermanded. The gate log continues past the Burning in a second hand, one entry each night, at the same hour.\n\nNo relief is recorded.",
    keywords: [], icon: '⬟',
    effects: [{ op: 'applyStatus', target: 'self', status: 'unbreakable', stacks: one }],
    textTemplate: 'Block no longer expires at the start of your turn. (Block capped at 30.)',
    upgrade: {
      effects: [{ op: 'applyStatus', target: 'self', status: 'unbreakableUp', stacks: one }],
      textTemplate: 'Block no longer expires at the start of your turn. (Block capped at 40.)',
    },
  },
  {
    id: 'stitchedArms', name: 'Stitched Arms', class: 'reaver', rarity: 'rare', cost: 'X', staminaCost: 1, type: 'attack',
    flavor: "Swordwork of the Court's stitched knights.\n\nAfter the Court Flame died, the surgeons sewed the knights to their swords, that no oath might be set down. The Citadel's record names it an honour: a knight's word made flesh.\n\nThe record was written by the surgeons.",
    keywords: [], icon: '🦾',
    effects: [{ op: 'damage', target: 'randomEnemy', amount: 6, hits: { f: 'energySpent' } }],
    textTemplate: 'Deal {damage} damage to a random enemy, scaling with Energy spent.',
    upgrade: {
      effects: [{ op: 'damage', target: 'randomEnemy', amount: 8, hits: { f: 'energySpent' } }],
      textTemplate: 'Deal {damage} damage to a random enemy, scaling with Energy spent.',
    },
  },
  {
    id: 'lastStand', name: 'Last Stand', class: 'reaver', rarity: 'rare', cost: 1, staminaCost: 1, type: 'skill',
    flavor: "Final entry of the Fell Courtyard gate log.\n\nOne gate, one man, it reads. The man is not named, as though the writer thought none would need it.\n\nThe dead are counted twice upon the page, and the counts do not agree.",
    keywords: ['ethereal'], icon: '🕯',
    effects: [{ op: 'block', target: 'self', amount: { f: 'missingHp', of: 'self', max: 20 } }],
    textTemplate: 'Ethereal. Gain Block equal to your missing HP (max 20).',
    upgrade: {
      effects: [{ op: 'block', target: 'self', amount: { f: 'missingHp', of: 'self', max: 30 } }],
      textTemplate: 'Ethereal. Gain Block equal to your missing HP (max 30).',
    },
  },
  {
    id: 'warriorsVow', name: "Warrior's Vow", class: 'reaver', rarity: 'rare', cost: 0, staminaCost: 1, type: 'skill',
    flavor: "Contract of the sellswords of the Fell Courtyard.\n\nHold the gate until relieved; pay in advance. The weald's hired blades held a paid contract sacred, having few other sacred things, and the Wardens despised them for it.\n\nThe last was signed the week before the Burning. Its date of release is blank.",
    keywords: ['innate', 'exhaust'], icon: '📜',
    effects: [{ op: 'enterStance', stance: 'gorefire' }],
    textTemplate: 'Innate. Enter Gorefire Stance. Exhaust.',
    upgrade: {
      effects: [
        { op: 'enterStance', stance: 'gorefire' },
        { op: 'draw', amount: 1 },
      ],
      textTemplate: 'Innate. Enter Gorefire Stance. Draw {draw} card. Exhaust.',
    },
  },
  {
    id: 'ruinousBlow', name: 'Ruinous Blow', class: 'reaver', rarity: 'rare', cost: 3, type: 'attack',
    flavor: "Whole-body blow of the Wardens.\n\nReserved for a gate where all else has failed, and called a Warden's last argument. What becomes of the Warden who makes it, the drill does not say.\n\nThe pages that follow are stained through.",
    keywords: [], icon: '🔨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 20 },
      { op: 'poiseDamage', target: 'enemy', amount: 12 },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 26 },
        { op: 'poiseDamage', target: 'enemy', amount: 14 },
      ],
    },
  },
  {
    id: 'bloodhuntersStrike', name: "Bloodhunter's Strike", class: 'reaver', rarity: 'rare', cost: 1, type: 'attack',
    flavor: "Strike of the Bastion kennels.\n\nTaught by the kennelmaster before the hounds turned. The kennel book names them the finest in the three cities, trained upon the scent of blood alone, and never loosed on the weald's own people.\n\nAfter the Burning, the hamlets' dogs were found in those same kennels.",
    keywords: [], icon: '🩸',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'damage', target: 'enemy', amount: { f: 'stacks', status: 'bleed', of: 'target' } },
    ],
    textTemplate: 'Deal {damage} damage, plus 1 for each Bleed on the target.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'damage', target: 'enemy', amount: { f: 'stacks', status: 'bleed', of: 'target' } },
      ],
    },
  },
  {
    id: 'sanguinePactCard', name: 'Sanguine Pact', class: 'reaver', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Soldier's bargain of the Bastion's lesser shrine.\n\nBlood spilled from an enemy is sworn to the one who spilled it. The Wardens thought it a harmless field-born custom, like the harvest tithe. The Chapel called it a mockery of the Writing, and fined the shrine.\n\nThe fine was paid. The shrine was in use the night of the Burning.",
    keywords: [], icon: '🩸',
    effects: [{ op: 'applyStatus', target: 'self', status: 'sanguinePact', stacks: one }],
    textTemplate: 'Whenever Bleed bursts on an enemy, gain 2 Strength.',
    upgrade: { cost: 1 },
  },

  // ---- Content-pass additions (round 2) ---------------------------------------
  // Two more commons (Bleed/Poise upkeep), two uncommons (a stance-flip attack
  // and a power that turns HP loss into Block), two rares (Bleed-scaling finisher
  // and a Poise-scaling finisher) — rounding the pool to 36.
  {
    id: 'goreslash', name: 'Goreslash', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Short cut of the Bastion's hired blades.\n\nThe sellswords had no patience for the Wardens' long forms. A long cut belongs in songs, they said, and the songs of the Bastion were paid for by the Wardens.\n\nThe sellswords kept a verse of their own. Only its tune survives.",
    keywords: [], icon: '🩸',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 },
      ],
    },
  },
  {
    id: 'bracingStance', name: 'Bracing Stance', class: 'reaver', rarity: 'common', cost: 1, staminaCost: 1, type: 'skill',
    flavor: "First stance of the Bastion recruit.\n\nFeet planted, shield braced against the Bastion's own wall, before either true stance was taught. Drillmaster Hask taught it thirty winters.\n\nHer last entry is a roll of recruits, every name struck through but one, and that one scraped away.",
    keywords: [], icon: '🛡',
    effects: [
      { op: 'block', target: 'self', amount: 6 },
      { op: 'block', target: 'self', amount: 3, if: { p: 'inStance', stance: 'bulwark' } },
    ],
    textTemplate: 'Gain {block} Block. If in Bulwark Stance: gain {block.2} more.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 8 },
        { op: 'block', target: 'self', amount: 4, if: { p: 'inStance', stance: 'bulwark' } },
      ],
    },
  },
  {
    id: 'flameToBlade', name: 'Flame to Blade', class: 'reaver', rarity: 'uncommon', cost: 2, type: 'attack',
    flavor: "Lanternwood oil, set alight upon the edge.\n\nA late practice of the Wardens, adopted when plain steel no longer frightened what came out of the weald. The Chapel frowned upon Wardens bearing fire they had not been given.\n\nMind the sleeve; the oil takes it before the enemy.",
    keywords: [], icon: '🔥',
    effects: [
      { op: 'damage', target: 'enemy', amount: 8 },
      { op: 'damage', target: 'enemy', amount: 6, if: { p: 'inStance', stance: 'gorefire' } },
      { op: 'enterStance', stance: 'gorefire' },
    ],
    textTemplate: 'Deal {damage} damage. If already in Gorefire Stance: deal {damage.2} more. Enter Gorefire Stance.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 10 },
        { op: 'damage', target: 'enemy', amount: 8, if: { p: 'inStance', stance: 'gorefire' } },
        { op: 'enterStance', stance: 'gorefire' },
      ],
    },
  },
  {
    id: 'ironVowCard', name: 'Iron Vow', class: 'reaver', rarity: 'uncommon', cost: 1, type: 'power',
    flavor: "Oath of the Wardens, sworn with the sword hand upon the gate.\n\nSworn Wardens bore the flame-mark from birth, and the oath was laid over it as a second promise. Sellswords swore it with no first promise beneath, and so the Wardens held them less bound.\n\nWhat that meant on the night of the Burning, no oath foretold.",
    keywords: [], icon: '⛓',
    effects: [{ op: 'applyStatus', target: 'self', status: 'ironVow', stacks: one }],
    textTemplate: 'Whenever you lose HP, gain 3 Block.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodTithe', name: 'Blood Tithe', class: 'reaver', rarity: 'rare', cost: 2, type: 'attack',
    flavor: "Harvest tithe of the weald, paid in blood.\n\nGiven at the Bastion's field-shrine in years the grain failed. The Wardens called it voluntary, and kept no names, as a courtesy to the givers.\n\nThe tithe-roll lengthens with each year of the Mark Trade, and the villages it lists grow fewer.",
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [2, { f: 'stacks', status: 'bleed', of: 'target' }] } },
    ],
    textTemplate: 'Deal {damage} damage, plus double the Bleed on the target.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 9 },
        { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [2, { f: 'stacks', status: 'bleed', of: 'target' }] } },
      ],
    },
  },
  {
    id: 'poiseBreaker', name: 'Poise Breaker', class: 'reaver', rarity: 'rare', cost: 2, type: 'attack',
    flavor: "Knee-strike of Drillmaster Hask.\n\nHer answer to anything larger than a Warden: a knight and a kennel hound, she wrote, bend at the same place. She drew them both.\n\nBeside them, in later ink, a third figure grown of briar, under a name found nowhere else in the book.",
    keywords: [], icon: '🔨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 11 },
      { op: 'poiseDamage', target: 'enemy', amount: 10 },
      { op: 'poiseDamage', target: 'enemy', amount: 8, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. If the target is Staggered: deal {poiseDamage.2} more Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 14 },
        { op: 'poiseDamage', target: 'enemy', amount: 12 },
        { op: 'poiseDamage', target: 'enemy', amount: 10, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
      ],
    },
  },

  // ---- Content-pass additions (round 4) --------------------------------------
  {
    id: 'rondelParry', name: 'Rondel Parry', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Parry upon the guard of a rondel dagger.\n\nFavoured by the Bastion's older sellswords, who kept the short blade long after the Wardens ceased to issue it. The rondels came from the Northern Holds as tribute, and were worth more than a season's wage.\n\nThey bear a crest no herald of the ring recorded.",
    keywords: [], icon: '🗡',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'poiseDamage', target: 'enemy', amount: 5 },
    ],
    textTemplate: 'Gain {block} Block and deal {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'poiseDamage', target: 'enemy', amount: 7 },
      ],
    },
  },
  {
    id: 'sunderplate', name: 'Sunderplate', class: 'reaver', rarity: 'uncommon', cost: 2, type: 'attack',
    flavor: "Joint-splitting blow of the Wardens.\n\nDevised in the years of the Mark Trade with the Court's knights in mind, lest the Court forget which flame kept it fed. No occasion of its use is recorded.\n\nBeside the drill, a knight's gorget, its crest scratched out.",
    keywords: [], icon: '⚒',
    effects: [
      { op: 'damage', target: 'enemy', amount: 9 },
      { op: 'poiseDamage', target: 'enemy', amount: 10 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. If the target is Staggered: apply {bleed} Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 12 },
        { op: 'poiseDamage', target: 'enemy', amount: 13 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 4, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
      ],
    },
  },
  // ---- The class ability card (plan phase 5a, proposal §4) -----------------
  // Brace: the Reaver's loop is stance switching as tempo. Enter Brace, a
  // stance that holds the line; leaving it hits harder (stances.js brace).
  {
    id: 'brace', name: 'Brace', class: 'reaver', rarity: 'starter', cost: 1, staminaCost: 1, type: 'skill',
    flavor: "The crouch before either stance.\n\nKnees bent, weight low, the body made ready to be struck. The field-book gives it the first page, and calls it the one lesson all Wardens learned alike, sworn or hired, marked or not.\n\nA later hand has corrected it.",
    keywords: [], icon: '🦶',
    effects: [{ op: 'enterStance', stance: 'brace' }],
    textTemplate: 'Enter Brace Stance.',
    upgrade: {
      effects: [{ op: 'enterStance', stance: 'brace' }, { op: 'block', target: 'self', amount: 3 }],
      textTemplate: 'Enter Brace Stance. Gain {block} Block.',
    },
  },
];
