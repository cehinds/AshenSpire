// src/content/cards/rogue.js — Rogue parity slice.
//
// Prepared is a content-owned one-hit opening: Rogue attacks read it before
// removing it. Venom is a normal status hook. No Rogue behavior needs a new
// opcode, predicate, formula, or script.

const one = { f: 'add', args: [1] };
const PREPARED = { p: 'hasStatus', of: 'self', status: 'prepared' };
const TARGET_WEAK = { p: 'hasStatus', of: 'target', status: 'weak' };
const TARGET_VULNERABLE = { p: 'hasStatus', of: 'target', status: 'vulnerable' };
const TARGET_BLEED = { p: 'hasStatus', of: 'target', status: 'bleed' };
const TARGET_VENOM = { p: 'hasStatus', of: 'target', status: 'venom' };
const prepare = () => ({ op: 'applyStatus', target: 'self', status: 'prepared', stacks: one });
const spendPrepared = () => ({ op: 'removeStatus', target: 'self', status: 'prepared' });

export const rogueCards = [
  // ---- Non-reward cards: signature + two generated tools -----------------
  {
    id: 'ambush', name: 'Ambush', class: 'rogue', rarity: 'starter', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "The dock way of opening a fight: from under a bridge, from behind, before the other party has decided whether there is one. Dock folk say they learned it from the Court's surgeons, who walked the bridges at night with their bags and always seemed to arrive first. The surgeons' day-books list those walks as house calls, without listing the houses.\n\n— east bank dock talk",
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'damage', target: 'enemy', amount: 8, if: PREPARED },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 },
      spendPrepared(),
    ],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Apply {vulnerable} Vulnerable. Consume Prepared.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'damage', target: 'enemy', amount: 10, if: PREPARED },
        { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 },
        spendPrepared(),
      ],
    },
  },
  {
    id: 'rogueShiv', name: 'Shiv', class: 'rogue', rarity: 'special', cost: 0, type: 'attack',
    flavor: "A sliver of iron chipped from the rail of the Fourth Bridge, where the ironwork froze brittle the night the Court Flame went out. Dock children carry them in their boots. They say the railings were cast from melted oath-tokens of the Court and are worth more in the right hands than any blade. Whose hands would be right, the children keep to themselves.\n\n— dock children's talk",
    keywords: ['exhaust'], icon: '🔪',
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }],
    textTemplate: 'Deal {damage} damage. Exhaust.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }] },
  },
  {
    id: 'smokePellet', name: 'Smoke Pellet', class: 'rogue', rarity: 'special', cost: 0, type: 'skill',
    flavor: "Tallow, ash and a pinch of something bitter, rolled into balls in a back room on the Chandlers' Stair. The chandler sells them as lamp-starters and has never asked why the docks buy so many in winter. He says the recipe was his grandmother's, and that she had it from a Court surgeon, though in his telling the surgeon is sometimes a knight and once a Marionette.\n\n— as told on the Chandlers' Stair",
    keywords: ['exhaust'], icon: '🌫',
    effects: [{ op: 'block', target: 'self', amount: 3 }, prepare()],
    textTemplate: 'Gain {block} Block. Become Prepared. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 5 }, prepare()] },
  },

  // ---- Commons (13) -------------------------------------------------------
  {
    id: 'quickCut', name: 'Quick Cut', class: 'rogue', rarity: 'common', cost: 0, type: 'attack', keywords: [], icon: '╱',
    flavor: "Quick work with a short knife, the only kind of cut the Tollmouth fence will pay for. He holds that a slow cut is a confession and a quick one is an accident. He says the Court's magistrates agreed with him once, before the Decree, when a dock child caught with a knife was hanged rather than branded. He considers that the better arrangement.\n\n— the Tollmouth fence",
    effects: [{ op: 'damage', target: 'enemy', amount: 3 }, { op: 'damage', target: 'enemy', amount: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'damage', target: 'enemy', amount: 4, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'feint', name: 'Feint', class: 'rogue', rarity: 'common', cost: 0, type: 'skill', keywords: [], icon: '↝',
    flavor: "A glance at the purse and a hand on the knife, the oldest trick of the frozen docks. Dock folk say the Court's knights fell for it easily because they had sworn to look wherever a threat was declared. The knights' oath-book contains no such clause. Dock folk say that is because the knights wrote the oath-book.\n\n— east bank dock talk",
    effects: [prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Become Prepared. Draw {draw} card.',
    upgrade: { effects: [prepare(), { op: 'draw', amount: 1 }, { op: 'block', target: 'self', amount: 3 }], textTemplate: 'Become Prepared. Draw {draw} card. Gain {block} Block.' },
  },
  {
    id: 'backstep', name: 'Backstep', class: 'rogue', rarity: 'common', cost: 1, staminaCost: 1, type: 'skill', keywords: [], icon: '👣',
    flavor: "A step back onto ice the pursuer does not trust. The ice-cutters of the lower river know which stretches under the bridges freeze solid and which only look it, and they sell the knowledge by the season. The map is drawn on the inside of a cutter's coat and passed down with the coat. Its present owner says it has been wrong since the second winter, and will not say where.\n\n— lower river ice-cutters",
    effects: [{ op: 'block', target: 'self', amount: 6 }, prepare()],
    textTemplate: 'Gain {block} Block. Become Prepared.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 9 }, prepare()] },
  },
  {
    id: 'twinPrick', name: 'Twin Prick', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '†',
    flavor: "Two small punctures close together, which the Court's surgeons entered as bites when they found them on bodies along the bridges. Their receipts note the hour, the bridge and the fee for the inquest, and not one case closed. The dock children who did the work call the mark the Surgeon's Signature, and consider the name a compliment the surgeons earned.\n\n— dock children's talk",
    effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 2 }, { op: 'damage', target: 'enemy', amount: 2, hits: 2, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage {hits} times. Prepared: deal {damage.2} damage {hits.2} times. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 2 }, { op: 'damage', target: 'enemy', amount: 2, hits: 2, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'pocketSand', name: 'Pocket Sand', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '✺',
    flavor: "A pinch of kiln ash kept in the coat lining, from the south-bank lime kilns where the dock poor worked for the Court's builders. The ash was the one thing the kilns gave away free. Dock folk say the Court paid kiln hands in lime and taxed them in coin, so the ash in a courtier's eye is only what was owed. The kilns went cold with the Court Flame. The ash has not run short.\n\n— south bank kiln talk",
    effects: [{ op: 'block', target: 'self', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 }] },
  },
  {
    id: 'hamstringRogue', name: 'Hamstring', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '🦵',
    flavor: "A cut behind the knee, the answer the docks found for the Court's stitched knights, who cannot kneel and so cannot easily rise once down. The surgeons called the knights unbending in their duty. On the docks the word is taken literally, and a knight down on the ice is left there. The rail of the Fourth Bridge carries a tally of them, cut by children too young to remember the knights before they were sewn.\n\n— dock children's talk",
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 }],
    textTemplate: 'Deal {damage} damage. Apply {vulnerable} Vulnerable.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 9 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 }] },
  },
  {
    id: 'serratedShiv', name: 'Serrated Shiv', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '🩸',
    flavor: "A shiv sawn from the steel rod the Court's surgeons set in a Marionette's spine to hold it upright through the dance. The rods take an edge badly and keep it anyway. Dock thieves say taking one from a dancer is a mercy. The dancers are in no position to argue, and the surgeons who fitted the rods took their reasons under the ice with them.\n\n— east bank dock talk",
    effects: [{ op: 'damage', target: 'enemy', amount: 5 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed. Prepared: apply {bleed.2} more. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 7 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'smokeVeil', name: 'Smoke Veil', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '🌁',
    flavor: "River fog, gathered and thickened with ash, which the docks treat as common property. The fog rose off the water the night the Court Flame died and never lifted. The Court's lamplighters,, paid to burn it off, were the first to be lost in it, or so the docks tell it. The lamplighters' guild-book ends on a list of lamps to be relit, none of them ticked.\n\n— east bank dock talk",
    effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak to ALL enemies.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'ricochet', name: 'Ricochet', class: 'rogue', rarity: 'common', cost: 1, staminaCost: 1, type: 'attack', keywords: [], icon: '➶',
    flavor: "A blade thrown to skip off the ice and strike someone watching the thrower's hand. Children on the frozen river play at it with pebbles, and the older ones with knives. They say the ice keeps no witnesses. The Marrow Organist, who plays beneath it, is said to hear the blades land, though he has never come up to say so.\n\n— dock children's talk",
    effects: [{ op: 'damage', target: 'allEnemies', amount: 4 }],
    textTemplate: 'Deal {damage} damage to ALL enemies.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 7 }] },
  },
  {
    id: 'lowBlow', name: 'Low Blow', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '↘',
    flavor: "A strike below the belt, which the Court's code of arms forbade and the docks consider good manners. The code is posted on the Citadel gate in frost-bitten gilt, and dock children read it aloud to each other as a joke. Its closing clause, on the treatment of the unmarked, has been chipped off the stone. The docks disagree about who chipped it and when.\n\n— east bank dock talk",
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'poiseDamage', target: 'enemy', amount: 4 }, { op: 'poiseDamage', target: 'enemy', amount: 5, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. Prepared: deal {poiseDamage.2} more Poise damage. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 8 }, { op: 'poiseDamage', target: 'enemy', amount: 5 }, { op: 'poiseDamage', target: 'enemy', amount: 6, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'pilfer', name: 'Pilfer', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '🖐',
    flavor: "A lift worked in the crowds that gathered to watch the Court's hounds paraded over the bridges. The Court counted wrists and kept careful rolls of them, but never counted its purses. Old Keel, the Tollmouth fence, taught that lifting from a courtier sewn to his post was salvage rather than theft. He claimed he had been a courtier once himself, and the children laughed until they saw his wrist.\n\n— east bank dock talk",
    effects: [{ op: 'draw', amount: 2 }, { op: 'discard', amount: 1, random: true }],
    textTemplate: 'Draw {draw} cards. Discard 1 card at random.',
    upgrade: { effects: [{ op: 'draw', amount: 3 }, { op: 'discard', amount: 1, random: true }] },
  },
  {
    id: 'vanish', name: 'Vanish', class: 'rogue', rarity: 'common', cost: 1, staminaCost: 1, type: 'skill', keywords: ['exhaust'], icon: '◌',
    flavor: "Under the bridges there is nothing but ice, if anyone asks, and the docks have made an art of being part of that nothing. The trick is older than the Burning. Dock folk say it was taught to them by the unmarked who lived beneath the bridges before the Decree, when being seen meant being entered on a roll. Most of those teachers did vanish, in the end. The docks do not agree on where to.\n\n— east bank dock talk",
    effects: [{ op: 'block', target: 'self', amount: 8 }, prepare(), { op: 'addCard', card: 'smokePellet', pile: 'hand' }],
    textTemplate: 'Gain {block} Block. Become Prepared. Add a Smoke Pellet to your hand. Exhaust.',
    upgrade: { keywords: [], effects: [{ op: 'block', target: 'self', amount: 8 }, prepare(), { op: 'addCard', card: 'smokePellet', pile: 'hand' }], textTemplate: 'Gain {block} Block. Become Prepared. Add a Smoke Pellet to your hand.' },
  },
  {
    id: 'cheapShot', name: 'Cheap Shot', class: 'rogue', rarity: 'common', cost: 2, type: 'attack', keywords: [], icon: '✹',
    flavor: "A blow at someone already weakened, which the Tollmouth fence calls the only honest bargain on the river. He charges for lessons in teeth, which he keeps in a jar, and says he learned the trade from a Court magistrate who took his fines the same way. The jar sits on his counter, nearly full.\n\n— the Tollmouth fence",
    effects: [{ op: 'damage', target: 'enemy', amount: 10 }, { op: 'damage', target: 'enemy', amount: 6, if: TARGET_WEAK }],
    textTemplate: 'Deal {damage} damage. If the target is Weak, deal {damage.2} more.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 13 }, { op: 'damage', target: 'enemy', amount: 8, if: TARGET_WEAK }] },
  },

  // ---- Uncommons (13) -----------------------------------------------------
  {
    id: 'bladeDanceRogue', name: 'Blade Dance', class: 'rogue', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'attack', keywords: [], icon: '⚔',
    flavor: "A spinning run of cuts copied from the Marionettes, the courtiers the surgeons stitched to their dance after the Court Flame went out. Thieves learned it watching from the frozen river, where the dancers perform for no one. They say the dance was meant to end at dawn. A small Marionette on the Fourth Bridge seems to be waiting for the ending, and the thieves who pass her leave a coin.\n\n— east bank dock talk",
    effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }, { op: 'damage', target: 'enemy', amount: 1, hits: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage {hits} times. Prepared: deal {damage.2} damage {hits.2} times. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 3 }, { op: 'damage', target: 'enemy', amount: 1, hits: 3, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'garrote', name: 'Garrote', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '➰',
    flavor: "A loop of the gilt thread the Court's tailors used for formal sleeves, bought cheap on the docks once the tailors had no further use for it. The surgeons bought the same thread, for purposes they never explained to the tailors. Dock folk say the surgeons and the stranglers were always the thread's best customers, and they say it the way one trade speaks of another.\n\n— east bank dock talk",
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 5 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed and {weak} Weak.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 6 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'fanOfKnives', name: 'Fan of Knives', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '🗡',
    flavor: "A surgeon's roll of scalpels thrown all at once. The rolls turn up on the docks more often than the surgeons do, sold by ice-cutters who find them frozen into the river with the coat still around them. The cutters say the surgeons tried to leave the Citadel on the night of the Burning, and that the ice closed over the ones who ran. They tell it with some satisfaction.\n\n— lower river ice-cutters",
    effects: [{ op: 'damage', target: 'allEnemies', amount: 5 }, { op: 'draw', amount: 1 }],
    textTemplate: 'Deal {damage} damage to ALL enemies. Draw {draw} card.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 7 }, { op: 'draw', amount: 1 }] },
  },
  {
    id: 'setupRogue', name: 'Setup', class: 'rogue', rarity: 'uncommon', cost: 0, type: 'skill', keywords: ['exhaust'], icon: '⚙',
    flavor: "The arranging of a job before anyone moves: a window left open on the Lantern Bridge, a lamp turned low, a guard paid to cough at the right moment. The docks credit the method to a woman they call the Wick, who planned the first robbery of the Regent's hall in the Mark Trade years. They say the Court itself paid her to rob it. What was taken has never been agreed.\n\n— east bank dock talk",
    effects: [prepare(), { op: 'gainEnergy', amount: 1 }, { op: 'addCard', card: 'rogueShiv', pile: 'hand' }],
    textTemplate: 'Become Prepared. Gain {gainEnergy} Energy. Add a Shiv to your hand. Exhaust.',
    upgrade: { effects: [prepare(), { op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 1 }, { op: 'addCard', card: 'rogueShiv', pile: 'hand' }], textTemplate: 'Become Prepared. Gain {gainEnergy} Energy. Draw {draw} card. Add a Shiv to your hand. Exhaust.' },
  },
  {
    id: 'acrobaticsRogue', name: 'Acrobatics', class: 'rogue', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'skill', keywords: [], icon: '🤸',
    flavor: "Bridge rail, lamp post, gutter, never the street: the rooftop road of the frozen docks. Dock folk say the Court's watch walked only the paved ways, because the paving had been blessed at the Founding and the rooftops had not. Whether the watch was pious or merely idle is argued on the docks most evenings, and the pious side generally loses.\n\n— east bank dock talk",
    effects: [{ op: 'block', target: 'self', amount: 7 }, { op: 'draw', amount: 2 }, { op: 'discard', amount: 1, random: true }],
    textTemplate: 'Gain {block} Block. Draw {draw} cards. Discard 1 at random.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 9 }, { op: 'draw', amount: 3 }, { op: 'discard', amount: 1, random: true }] },
  },
  {
    id: 'disorient', name: 'Disorient', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '💫',
    flavor: "A spin and a shove that leave the victim facing the wrong way, practised in the Glass Regent's Hall of Mirrors by thieves who went in for the silver. The mirrors are the frozen river under the bridges, and they show more than is standing in front of them. The thieves say the Regent lost her own bearings in that hall long ago, and has been ruling from the wrong side of the glass since.\n\n— east bank dock talk",
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 }],
    textTemplate: 'Apply {weak} Weak and {vulnerable} Vulnerable. Exhaust.',
    upgrade: { keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 }], textTemplate: 'Apply {weak} Weak and {vulnerable} Vulnerable.' },
  },
  {
    id: 'coupDeGrace', name: 'Coup de Grace', class: 'rogue', rarity: 'uncommon', cost: 2, type: 'attack', keywords: [], icon: '☠',
    flavor: "The finishing thrust the Court's surgeons called a courtesy and billed as a procedure. Their fee schedule survives on the docks as a curiosity, and lists it between a stitching and a funeral. The docks learned it by watching the surgeons at work on the bridges after the Burning. The schedule has since been amended by hand, and the new price is higher.\n\n— Court surgeons' fee schedule",
    effects: [{ op: 'damage', target: 'enemy', amount: 10 }, { op: 'damage', target: 'enemy', amount: 10, if: TARGET_VULNERABLE }],
    textTemplate: 'Deal {damage} damage. If the target is Vulnerable, deal {damage.2} more.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 13 }, { op: 'damage', target: 'enemy', amount: 13, if: TARGET_VULNERABLE }] },
  },
  {
    id: 'sap', name: 'Sap', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '♠',
    flavor: "A sand-weighted sock to the back of the skull, meant to fell a person without killing them. It does not work on the Marionettes, who go on dancing with their strings slack. Dock thieves say one of their own used it on a girl at the foot of the Stitched Throne, a dancer no older than a dock child, and came back unwilling to talk of her, except to ask whether anyone knew the tune she hummed.\n\n— east bank dock talk",
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'poiseDamage', target: 'enemy', amount: 4 }],
    textTemplate: 'Deal {damage} damage. Apply {weak} Weak. Deal {poiseDamage} Poise damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 }, { op: 'poiseDamage', target: 'enemy', amount: 5 }] },
  },
  {
    id: 'shadowstep', name: 'Shadowstep', class: 'rogue', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'skill', keywords: [], icon: '◐',
    flavor: "A step into the shadow of a pier and out on its far side. Dock folk say the shadows under the bridges are let by the season, and the rent goes to whoever held the pier before you, so tenancies pass down like a trade. The oldest tenancy, they say, belongs to someone not seen since the Decree, who has somehow kept up with the rent.\n\n— east bank dock talk",
    effects: [{ op: 'block', target: 'self', amount: 5 }, prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Gain {block} Block. Become Prepared. Draw {draw} card.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 7 }, prepare(), { op: 'draw', amount: 1 }] },
  },
  {
    id: 'afterimageCard', name: 'Afterimage', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'power', keywords: [], icon: '👤',
    flavor: "The trick of leaving one's reflection in the Regent's mirrors while the body moves on. Thieves found that the glass in the Hall of Mirrors held an image a heartbeat longer than it should. The Regent's stewards recorded this as the Hall's loyalty. Dock thieves say the glass is only slow, and has grown slower each winter since the Burning.\n\n— east bank dock talk",
    effects: [{ op: 'applyStatus', target: 'self', status: 'afterimage', stacks: one }],
    textTemplate: 'Every third card you play grants 3 Block.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodletterRogue', name: 'Bloodletter', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '🩸',
    flavor: "Receipt form of the Citadel's surgeons, for bleeding. It records the patient's name, the quantity drawn, and a line for the patient's satisfaction, which is ticked on every copy that survives. The surgeons held that bleeding balanced a courtier's humours before an oath. The receipts from the last month before the Burning carry no patient names at all.\n\n— Citadel surgeons' receipts",
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: { f: 'stacks', status: 'bleed', of: 'target' } }],
    textTemplate: "Double the target's Bleed. Exhaust.",
    upgrade: { keywords: [], textTemplate: "Double the target's Bleed." },
  },
  {
    id: 'venomcoat', name: 'Venomcoat', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: [], icon: '🐍',
    flavor: "A paste the Court's surgeons sold by the vial as a sedative for courtiers who could not sleep in the weeks before the Decree. The docks found it worked on a blade as well as it worked in wine. The label promises a dreamless night in gilt letters, and the docks peel it off before selling the vial on.\n\n— surgeons' vial label, dock copy",
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'venom', stacks: 4 }, prepare()],
    textTemplate: 'Apply {venom} Venom. Become Prepared.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'venom', stacks: 6 }, prepare()] },
  },
  {
    id: 'misdirect', name: 'Misdirect', class: 'rogue', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'skill', keywords: [], icon: '↪',
    flavor: "The dock art of sending the watch the long way round. Dock folk say it was perfected on the night of the Courtly Decree, when the brand-men came down to the river to mark the last of the unmarked by dawn, and the ice-cutters paid the bridge watch to lead them in circles. The Decree said dawn. The docks say dawn came late on that side of the river.\n\n— lower river ice-cutters",
    effects: [{ op: 'block', target: 'self', amount: 6 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }, prepare()],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak to ALL enemies. Become Prepared.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 9 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }, prepare()] },
  },

  // ---- Rares (10) ---------------------------------------------------------
  {
    id: 'assassinate', name: 'Assassinate', class: 'rogue', rarity: 'rare', cost: 2, staminaCost: 1, type: 'attack', keywords: ['exhaust'], icon: '🗡',
    flavor: "A killing blow struck after a single question has been asked, the method of a dock thief hunting one particular Court surgeon. The thief has told the docks the question but never the surgeon's name. Some on the docks believe the question concerns a stitching. Others believe the surgeon is the thief's own blood. The docks have learned not to ask twice.\n\n— east bank dock talk",
    effects: [{ op: 'damage', target: 'enemy', amount: 14 }, { op: 'damage', target: 'enemy', amount: 14, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Consume Prepared. Exhaust.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 18 }, { op: 'damage', target: 'enemy', amount: 18, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'thousandCutsRogue', name: 'Thousand Cuts', class: 'rogue', rarity: 'rare', cost: 2, staminaCost: 1, type: 'attack', keywords: [], icon: '✣',
    flavor: "Many small cuts, each one undoing a stitch. The Court's surgeons called unstitching the procedure run backward and forbade it, since a courtier sewn to his post had taken an oath. Dock folk say a surgeon was caught unstitching his own wife from the palace stair the winter after the Burning. The surgeons' day-book records only that a stitching failed.\n\n— east bank dock talk",
    effects: [{ op: 'damage', target: 'enemy', amount: 2, hits: 6 }, { op: 'damage', target: 'enemy', amount: 1, hits: 6, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage {hits} times. Prepared: deal {damage.2} damage {hits.2} times. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 6 }, { op: 'damage', target: 'enemy', amount: 1, hits: 6, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'deadlyTempoCard', name: 'Deadly Tempo', class: 'rogue', rarity: 'rare', cost: 2, type: 'power', keywords: [], icon: '⏱',
    flavor: "The rhythm dock thieves keep in their heads since the dock clock froze at the Burning, its hands stopped at the King's Hour. Before that, thieves timed their work by the clock and the Court timed its watch by it too. Dock folk say the clock stopped so that neither side would have the advantage. The docks have kept time by their own pulses since, and argue about whose is right.\n\n— east bank dock talk",
    effects: [{ op: 'applyStatus', target: 'self', status: 'deadlyTempo', stacks: one }],
    textTemplate: 'At the start of your turn, become Prepared and draw a card.',
    upgrade: { cost: 1 },
  },
  {
    id: 'opportunistCard', name: 'Opportunist', class: 'rogue', rarity: 'rare', cost: 1, type: 'power', keywords: [], icon: '◎',
    flavor: "The first rule of the frozen docks: when a knight stumbles, the purse swings. Dock folk say the Court's knights stumble more since they were sewn into their armour, and the docks have done well by it. They say it quietly, the knights being their own fathers and brothers in a fair number of cases, and the docks prefer not to name which.\n\n— east bank dock talk",
    effects: [{ op: 'applyStatus', target: 'self', status: 'opportunist', stacks: one }],
    textTemplate: 'Whenever an enemy Staggers, become Prepared and draw a card.',
    upgrade: { cost: 0 },
  },
  {
    id: 'envenomCard', name: 'Envenom', class: 'rogue', rarity: 'rare', cost: 2, type: 'power', keywords: [], icon: '☣',
    flavor: "Poison from the second shelf of a Court surgeon's cabinet, which held what the first shelf could not treat. Thieves who went through the surgeons' houses after the Burning found the second shelves full and the first ones bare. They took it to mean the surgeons had been busy. The surgeons' apprentices, who live on the docks now, will not say which shelf was emptied first.\n\n— east bank dock talk",
    effects: [{ op: 'applyStatus', target: 'self', status: 'envenom', stacks: one }],
    textTemplate: 'Your attacks apply 1 Venom per stack.',
    upgrade: { cost: 1 },
  },
  {
    id: 'toxicVolley', name: 'Toxic Volley', class: 'rogue', rarity: 'rare', cost: 2, type: 'skill', keywords: [], icon: '🏹',
    flavor: "Vials of the surgeons' sedative broken into the river fog upwind of the bridge watch. Dock folk say the river smelled of it for weeks and the watch slept through three robberies. The watch ledger records the same three weeks as quiet, and commends the men for their vigilance.\n\n— east bank dock talk",
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'venom', stacks: 5 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }],
    textTemplate: 'Apply {venom} Venom and {weak} Weak to ALL enemies.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'venom', stacks: 7 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'smokeBomb', name: 'Smoke Bomb', class: 'rogue', rarity: 'rare', cost: 1, staminaCost: 1, type: 'skill', keywords: ['exhaust'], icon: '💨',
    flavor: "A pig's bladder packed with kiln ash and split on the stones. The bridge watch reports the fogs that follow as hauntings. Dock thieves say the reports are not entirely wrong, because the ash comes from the south-bank kilns, and in the Court's last years those kilns were fired with something other than lime. They stop there.\n\n— south bank kiln talk",
    effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 3 }],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 10 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 4 }] },
  },
  {
    id: 'executionWindow', name: 'Execution Window', class: 'rogue', rarity: 'rare', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '⌛',
    flavor: "The moment on the bridges when the watch looks away. Dock thieves say each guard has one, and that during the Mark Trade the Court's watch had theirs written into the roster, for a fee. The roster survives. It lists the hours each bridge would stand unwatched, and beside each hour a name, and none of the names appear in any Court record.\n\n— east bank dock talk",
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 3 }, prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Apply {vulnerable} Vulnerable. Become Prepared. Draw {draw} card. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 4 }, prepare(), { op: 'draw', amount: 1 }] },
  },
  {
    id: 'perfectHeist', name: 'Perfect Heist', class: 'rogue', rarity: 'rare', cost: 0, staminaCost: 1, type: 'skill', keywords: ['exhaust'], icon: '💎',
    flavor: "The theft of the Glass Regent's mirrors, every one entered in the Hall's inventory and every one gone. The docks tell it as the finest job ever done on the river, and cannot agree who did it, though the older thieves credit the Wick. The Hall of Mirrors is full of glass to this day. The docks say that is how you know the job was perfect.\n\n— east bank dock talk",
    effects: [{ op: 'draw', amount: 3 }, { op: 'gainEnergy', amount: 1 }],
    textTemplate: 'Draw {draw} cards. Gain {gainEnergy} Energy. Exhaust.',
    upgrade: { effects: [{ op: 'draw', amount: 4 }, { op: 'gainEnergy', amount: 1 }] },
  },
  {
    id: 'deathblow', name: 'Deathblow', class: 'rogue', rarity: 'rare', cost: 3, type: 'attack', keywords: [], icon: '☠',
    flavor: "Cold work: the killing stroke of the frozen docks, made where the river keeps what the surgeons leave. Dock folk say the river never thaws because it is full, and that the Court knew as much and built more bridges rather than ask why. The Marrow Organist plays the funeral service under the ice for whoever is down there. The docks have never heard him reach the end of it.\n\n— east bank dock talk",
    effects: [
      { op: 'damage', target: 'enemy', amount: 24 },
      { op: 'damage', target: 'enemy', amount: 10, if: TARGET_BLEED },
      { op: 'damage', target: 'enemy', amount: 10, if: TARGET_VENOM },
    ],
    textTemplate: 'Deal {damage} damage. If the target has Bleed, deal {damage.2} more. If it has Venom, deal {damage.3} more.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 30 }, { op: 'damage', target: 'enemy', amount: 12, if: TARGET_BLEED }, { op: 'damage', target: 'enemy', amount: 12, if: TARGET_VENOM }] },
  },
  // ---- The class ability card (plan phase 5a, proposal §4) -----------------
  // Prepare: the Rogue's loop is setup then payoff; the cheapest way in.
  {
    id: 'prepare', name: 'Prepare', class: 'rogue', rarity: 'starter', cost: 0, staminaCost: 1, type: 'skill',
    flavor: "Hands warmed before work, under the arms or over a candle stub, since cold hands drop knives. Dock children learn to warm their hands before they learn to steal, and learn never to warm them at a fire someone else has lit. Asked why, the older thieves say only that the fires on the Citadel side burn more than wood.\n\n— dock children's talk",
    keywords: ['exhaust'], icon: '◈',
    effects: [{ op: 'applyStatus', target: 'self', status: 'prepared', stacks: one }],
    textTemplate: 'Become Prepared. Exhaust.',
    upgrade: {
      keywords: [],
      effects: [{ op: 'applyStatus', target: 'self', status: 'prepared', stacks: one }],
      textTemplate: 'Become Prepared.',
    },
  },
];
