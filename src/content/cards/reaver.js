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
    flavor: "The first cut the hamlets teach, made with whatever edge the hamlet owns. Marl's Hollow sends one climber a winter, chosen by the elders at the well, and the one chosen spends the last evening at the whetting post learning this and nothing more. The elders say a Forsaken needs only the one cut, since the marked learned a thousand and it did them no good.\n\n— Marl's Hollow elders",
    keywords: [], icon: '⚔',
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }],
    textTemplate: 'Deal {damage} damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 9 }] },
  },
  {
    id: 'defend', name: 'Defend', class: 'colorless', rarity: 'starter', cost: 1, type: 'skill',
    flavor: "The first guard of the road, marked on cairn stones by climbers for climbers: two crossed lines, meaning hold. The mark does not say what to hold against, or for how long. The hamlets say it was cut by the first Forsaken to climb, before the Burning, when the ring was closed to them. Who those first climbers were, and what they climbed toward, the hamlets cannot agree.\n\n— told at the Grave of the Nameless",
    keywords: [], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 5 }],
    textTemplate: 'Gain {block} Block.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 8 }] },
  },
  {
    id: 'technique', name: 'Footwork', class: 'colorless', rarity: 'starter', cost: 1, type: 'skill',
    flavor: "Steps cut into the road by those who came before, and the way of moving that goes with them. The steps are too even to be natural and too worn to be recent. Climbers credit them to the Forsaken. They run on past the farthest point any Forsaken is known to have reached, and some lead out onto the viaducts, which are older than the kingdom.\n\nClimbers before you cut steps. Use them.\n— cairn-scratch",
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
    flavor: "The ice-fishers' way of giving ground: a step sideways onto ice that will hold one person and not two. The lakes of the Pale Marches have not thawed since the Burning, and the fishers say the ice cracks all year round and gives only under a second pair of feet. They learned to trust the sound. Widow Arne of Sallow Lake says the sound changed last winter, and she has stopped fishing.\n\n— ice-fishers' talk",
    keywords: [], icon: '🌀',
    effects: [{ op: 'block', target: 'self', amount: 1 }, { op: 'dodgeRoll', target: 'self' }],
    textTemplate: 'Gain {block} Block, then roll to evade: on a success, gain Block equal to the dodge.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 3 }, { op: 'dodgeRoll', target: 'self' }] },
  },
  {
    id: 'dodgeRoll', name: 'Dodge Roll', class: 'colorless', rarity: 'starter', cost: 0, staminaCost: 1, type: 'skill',
    flavor: "A tumble across a shifting deck, learned from the ship-breakers of the Grave of Ships, who work on hulls that move with each tide. Gull-Bet's gang teaches it to anyone who pays. She says the hulls were already rotting at anchor when the trade stopped, and that on the night of the Burning every hold went warm at once. Her gang opened the holds the next spring, and she has not told anyone what was in them.\n\n— ship-breakers' talk",
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
    flavor: "First cut of the Bastion's hired blades, set down in the years when the Wardens had more gates than sworn men to hold them. The drill has the edge wetted from the wielder's own forearm before the watch, so the steel goes out already red. The book calls this discipline, and adds that a sworn Warden never needed it. The page naming who first taught it is torn away below the words \"the old sergeant\".\n\n— Warden's field-book",
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
    flavor: "A wide, low cut for a gate choked with bodies, entered by the Fell Courtyard watch on the night the Bastion burned. The entry says the dead came up the Muster Stair in numbers the watch had no word for, and that this cut was the only one that answered them. It lists the watch as whole at the bell. The hand that wrote it changes halfway down the page.\n\n— Fell Courtyard gate log",
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
    flavor: "Rim-work from the Wardens' shield line, drilled in the years when neighbours came to the Bastion's gate to argue the price of a spring. The book prefers the rim to the face, the face being gilded with the crest and too costly to dent. It notes that envoys of the Northern Holds were struck with it twice, and that both times the Holds paid. It does not say what they were paying for.\n\n— Warden's field-book",
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
    flavor: "Short, flat steps for courtyard stone slick with moss, the way the Bastion's hired blades learned to move once the green came up between the flags and would not stop. Sellswords say the Wardens never taught it, because Wardens were never posted where the footing was worst. The steps are counted to the old dawn peal, which the Bell Keeper rings at an hour that no longer matches the light.\n\n— as the sellswords tell it",
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
    flavor: "A Warden's answer to a blow already caught on the guard. The book teaches it as the proper order of things: the enemy commits, the Bastion replies, and the reply is always the larger. Wardens said the same of the Spring Wars, in which they claim never to have struck first. A copyist has added, in a smaller hand, that the Holds would tell it differently.\n\n— Warden's field-book",
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
    flavor: "The standing order read out at the muster peal: a Warden holds until relieved, and relief comes from the bell. The bell-roll lists the names of those who held. After the Burning the list runs on for several pages in a hand the scribes did not know, and the names on those pages are ones the roll has no record of enlisting.\n\n— Bastion bell-roll",
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
    flavor: "A saw-backed blade from the forges under the Bastion ridge, made for clearing briar and taken up by the Wardens when the Blight came out of the weald. The smiths say they filed the teeth for thornwood, not for men, and that the Wardens never paid for the change of use. How the briar learned to bleed is a question the smiths decline to take up.\n\n— weald smiths' talk",
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
    flavor: "The breaking stance, first of the two the Wardens taught. The book describes it as holding the flame in the blade. Its margins say more than its text: burns dressed, a sergeant's warning that the stance takes the hand if held too long, and a note that sellswords held it longer than Wardens, which the note gives as proof of their greed. The last line in the margin is smudged past reading.\n\n— Warden's field-book",
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
    flavor: "The holding stance, second of the two. The Wardens called the gate a wall a man could carry, and taught this as the way to carry it: low, square, shield set against the hinge side. The book claims that no gate held in this stance ever fell. The passage was written well before the Burning, and whether anyone has thought to correct it since is not clear from the ink.\n\n— Warden's field-book",
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
    flavor: "A return taken off the guard, which the Citadel's fencing-masters claimed as their own and called too fine for field-born hands. The manual's example bout is fought on the bridges in the first year of the Mark Trade, between a Knight and an unnamed Warden. The text says the Knight won. The illustration beside it shows him on his back.\n\n— Citadel fencing manual",
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
    flavor: "A tearing cut for things of the weald that bleed black and stay standing. The entry is a late one, written after the Burning by whoever keeps the book now. It advises cutting the rot out of hounds and hamlet folk alike, and states that the rot came into the weald from outside, up the river road with the Court's traders. The ink is fresh and the hand is unsteady.\n\n— Warden's field-book, late entry",
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
    flavor: "A heavy sweep taught in the weald hamlets for the winters when blight-hounds come down out of the lanternwood in packs. The elders say they learned it by watching the Wardens from outside the walls, since no Warden would teach a Forsaken anything. The Wardens called the weald their charge. The hamlets remember paying for that charge in spring grain, and remember what it bought.\n\n— Marl's Hollow elders",
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
    flavor: "A heel brought down on a fallen enemy's chest, which the Wardens called unworthy and used regardless. Sellswords learned it in the Fell Courtyard, where the fallen seldom stayed down. They say the Wardens objected not to the blow but to being seen to deliver it. Several of the Bastion's older helms carry a heel-shaped dent, though whose heel is anyone's guess.\n\n— sellswords' talk",
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
    flavor: "The Wardens' banner of the muster, raised when the bell rang the line into place. The book gives the drill in plain terms: raise the standard, sound the bell, log that the line held. The log of the last muster reads that the line held. The same page gives the hour as dawn, and the Bastion has not seen a dawn since the Burning.\n\n— Warden's field-book",
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
    flavor: "The field practice of the Bastion's surgeon-wardens, who stitched wounds on the wall rather than below it. Their rule was that a Warden stitched standing remained a Warden, and one carried down to the stool was struck from the roll. The book credits them with a better record than the Chapel's physicians. The Chapel's own figures for those years burned with the Chapel.\n\n— Warden's field-book",
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
    flavor: "A second cut laid into a wound already open. The Court's surgeons, who studied such matters, recorded that Wardens bled longer than anyone else under the knife, and put it down to field-born blood running thin. The casebook gives no count of cases, only the conclusion, which the surgeons signed as a body in the ninth year of the Mark Trade.\n\n— Court surgeons' casebook",
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
    flavor: "Two short blades worked in turn, the habit of weald sellswords who could not afford a shield and would not carry a Warden's. The Bastion hired them for its narrow gates. Sellswords say part of their pay came as a mark on the wrist in place of coin, a right to the city's warmth. Those who took it are not around to confirm the story. Those who refused tell it often.\n\n— sellswords' talk",
    keywords: [], icon: '⚔',
    effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }],
    textTemplate: 'Deal {damage} damage {hits} times.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 3 }] },
  },
  {
    id: 'shieldwall', name: 'Shieldwall', class: 'reaver', rarity: 'uncommon', cost: 2, staminaCost: 1, type: 'skill',
    flavor: "Rims locked edge to edge across the Fell Courtyard, the formation the Wardens were proudest of. The book credits it with holding the Bastion gate through three hungry winters of the Spring Wars, when Hold petitioners camped below the walls. It enters the price of the spring harvest in the same column as the petitioners it turned away.\n\n— Warden's field-book",
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
    flavor: "A boot to the chest that sends an enemy back down the Muster Stair. Sellswords learned it on those steps, which are steep enough that the fall does most of the work. They say the Wardens forbade it as common and had copied it within a season. What climbs the stair now tends to climb it again, and the sellswords who remain have stopped counting how often.\n\n— sellswords' talk",
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
    flavor: "A guarded step forward that ends in the breaking stance, taught as the moment to stop holding and start taking ground. The book says a Warden should know the moment by the bell. After the Bellfoundry bell cracked, a new line was added beneath: know it by the smell of the courtyard. What that smell is supposed to be, the entry leaves to the reader.\n\n— Warden's field-book",
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
    flavor: "A thrust that pins a fallen enemy to the ground. The weald hamlets learned it for the things that came out of the drowned hamlet in the first winter of the Blight, which got up again when left lying. Hamlet folk say a pinned thing stops. The Wardens would once have burned them, but the fire went into the Wardens that winter, and the hamlets never had any to spare.\n\n— weald hamlet saying",
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
    flavor: "The bell-roll shouted aloud where the bell could not be heard, a custom of the gates farthest from the Bellfoundry. The Wardens held that the roll had a power of its own, so long as it was read in order. Sellswords, who were not on it, learned to shout it anyway. The Bell Keeper is said to answer when he hears it, with the bell, which is cracked.\n\n— Bastion bell-roll, marginal note",
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
    flavor: "A finishing blow as the Fell Warden taught it, before his leg went the way of the weald and his blade was ground down into a cane. The book gives his instruction in full and his reasons not at all. It states that he never struck a man already kneeling. The last page in his hand, dated the night of the Burning, is a list of kneeling men.\n\n— Warden's field-book",
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
    flavor: "The Wardens' word for the state a fighter reaches when enough of their own blood is on the ground that fear stops mattering. The book treats it as a virtue in sworn men and a vice in sellswords, though it describes the two in identical terms. It claims the state can be taught. The only instruction it offers is to keep standing.\n\n— Warden's field-book",
    keywords: [], icon: '♛',
    effects: [{ op: 'applyStatus', target: 'self', status: 'goreblood', stacks: one }],
    textTemplate: 'Poise thresholds no longer increase after filling.',
    upgrade: { cost: 2 },
  },
  {
    id: 'unbreakable', name: 'Unbreakable', class: 'reaver', rarity: 'rare', cost: 2, type: 'power',
    flavor: "The order to hold the Fell Courtyard gate until relieved, as it stands in the gate log: dated, signed, and never countermanded. The entries go on past the Burning in the second hand, at the same hour each night. Who relieved the writer, or whether anyone came to, the log does not record.\n\n— Fell Courtyard gate log",
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
    flavor: "A way of swinging a weapon lashed to the arm, copied from the Court's knights after their surgeons sewed them to their swords. The Citadel's record calls the stitching an honour: a knight's word made flesh, never to be set down. The record was written by the surgeons, and it treats the question of whether the knights were asked as settled.\n\n— Citadel surgeons' record",
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
    flavor: "The last entry in the Fell Courtyard gate log before the handwriting changes. One gate, one man, it reads, and the man is not named. The entry is written as though the writer expected nobody to need it. The count of the dead is given twice on the page, and the two counts do not agree.\n\n— Fell Courtyard gate log",
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
    flavor: "The contract read to sellswords hired for the Fell Courtyard: hold the gate until relieved, pay in advance. Weald sellswords treated a paid contract as sacred, having few other sacred things, and the Wardens thought them mercenary for it. The last contract on the roll was signed the week before the Burning. The space for the date of release is blank.\n\n— Bastion hiring roll",
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
    flavor: "The whole weight of the body brought down through the blade, which the book reserves for a gate where all else has failed. It calls this a Warden's last argument. It does not describe what becomes of the Warden afterward. The pages here are stained through, and the drill's final step can only be guessed at from what shows at the edges.\n\n— Warden's field-book",
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
    flavor: "A strike aimed where the quarry is already bleeding, taught by the Bastion's kennelmaster before the hounds turned. The kennel book calls them the finest hounds in the three cities, trained on the scent of blood alone, and credits the Wardens with never setting them on the weald's own people. The hamlets' dogs, which were never trained, were found in those same kennels after the Burning.\n\n— Bastion kennel book",
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
    flavor: "A soldier's bargain sworn at the Bastion's lesser shrine: blood spilled from an enemy is sworn to the one who spilled it. The Wardens held it a harmless custom of the field-born, like the harvest tithe. The Chapel called it a mockery of the Writing and fined the shrine. The fine is entered as paid, and the shrine was in use on the night of the Burning.\n\n— Warden's field-book",
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
    flavor: "A short, deep cut from the Bastion's hired blades, who had no patience for the long forms of the Wardens' drill. Sellswords say a long cut belongs in songs, and that the songs about the Bastion were paid for by the Wardens. They sing their own verse about the Fell Courtyard. Most of its words are lost, but the tune is known on both sides of the wall.\n\n— sellswords' talk",
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
    flavor: "Feet planted, shield braced against the Bastion's own wall: the stance recruits learned before they were trusted with either of the two proper ones. Drillmaster Hask, whom the book quotes at length, taught it for thirty winters. Her entries end the spring before the Burning with a list of recruits, a line drawn through every name but one, and that one scraped away.\n\n— Warden's field-book",
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
    flavor: "Lanternwood oil run along the edge and set alight, a practice the Wardens adopted late, once their plain steel no longer frightened what came out of the weald. The book is wary of it. It warns that the oil takes the sleeve before the enemy, and that the Chapel disapproved of Wardens carrying fire they had not been given. The warning about the sleeve is underlined twice.\n\n— Warden's field-book",
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
    flavor: "The oath a Warden swore to the Bastion, sword hand on the gate. Sworn Wardens were marked at birth like any field-born citizen, and the oath was understood as a second promise laid over the first. Sellswords swore it without the first promise, and the Wardens held that this left them less bound. What it left them on the night of the Burning, the book does not say.\n\n— Warden's field-book",
    keywords: [], icon: '⛓',
    effects: [{ op: 'applyStatus', target: 'self', status: 'ironVow', stacks: one }],
    textTemplate: 'Whenever you lose HP, gain 3 Block.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodTithe', name: 'Blood Tithe', class: 'reaver', rarity: 'rare', cost: 2, type: 'attack',
    flavor: "The harvest tithe of the weald, paid in blood at the Bastion's field-shrine in years when the grain failed. The Wardens administered it and called it voluntary. The tithe-roll records amounts and villages but no names, which the Wardens explained as a courtesy to the givers. The roll grows longer each year of the Mark Trade, and the villages it lists grow fewer.\n\n— weald tithe-roll",
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
    flavor: "Two blows to the knee, which Drillmaster Hask taught as the answer to anything larger than a Warden. Her notes say a knight and a kennel hound bend in the same place, and she drew both. Beside them, in later ink, someone has drawn a third figure grown out of briar, and given it a name the book uses nowhere else.\n\n— Warden's field-book",
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
    flavor: "A parry on the guard of a rondel dagger, favoured by the Bastion's older sellswords, who carried the short blade long after the Wardens stopped issuing it. They claim the rondels came from the Northern Holds as part of a year's tribute, and were worth more than the Bastion paid them in a season. The daggers are stamped with a crest the ring's heralds never recorded.\n\n— sellswords' talk",
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
    flavor: "A blow meant to split plate at the joints. The book says the Wardens designed it during the Mark Trade with the Court's knights in mind, \"in case the Court forgets which flame keeps it fed\". It records no occasion on which it was used. The entry is kept all the same, beside a sketch of a knight's gorget with the Court's crest scratched out.\n\n— Warden's field-book",
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
    flavor: "The crouch taught before either stance: knees bent, weight low, the body made ready to be struck. The book gives it the first page of the drill and calls it the one lesson all Wardens learned alike, sworn or hired, marked or not. It is among the few passages that treats sellswords as equals. A later hand has corrected it.\n\n— Warden's field-book",
    keywords: [], icon: '🦶',
    effects: [{ op: 'enterStance', stance: 'brace' }],
    textTemplate: 'Enter Brace Stance.',
    upgrade: {
      effects: [{ op: 'enterStance', stance: 'brace' }, { op: 'block', target: 'self', amount: 3 }],
      textTemplate: 'Enter Brace Stance. Gain {block} Block.',
    },
  },
];
