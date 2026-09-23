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
    flavor: "Opening of the frozen docks.\n\nStrike from beneath a bridge, from behind, before the other has decided there is a fight at all. The docks learned it from the Court's surgeons, who walked the bridges by night with their bags, and always arrived first.\n\nTheir day-books record house calls, but no houses.",
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
    flavor: "Sliver of iron from the rail of the Fourth Bridge.\n\nThe ironwork froze brittle the night the Court Flame died. Dock children say the railings were cast from the Court's melted oath-tokens, and so are worth more than any blade in the right hands.\n\nWhose hands are right, the children will not tell.",
    keywords: ['exhaust'], icon: '🔪',
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }],
    textTemplate: 'Deal {damage} damage. Exhaust.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }] },
  },
  {
    id: 'smokePellet', name: 'Smoke Pellet', class: 'rogue', rarity: 'special', cost: 0, type: 'skill',
    flavor: "Tallow and ash, rolled in a back room on the Chandlers' Stair.\n\nSold as lamp-starters. The chandler says the recipe was his grandmother's, taken from a Court surgeon, though in his telling the surgeon is sometimes a knight.\n\nThe docks buy more of them each winter.",
    keywords: ['exhaust'], icon: '🌫',
    effects: [{ op: 'block', target: 'self', amount: 3 }, prepare()],
    textTemplate: 'Gain {block} Block. Become Prepared. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 5 }, prepare()] },
  },

  // ---- Commons (13) -------------------------------------------------------
  {
    id: 'quickCut', name: 'Quick Cut', class: 'rogue', rarity: 'common', cost: 0, type: 'attack', keywords: [], icon: '╱',
    flavor: "Knife-work of the Tollmouth fence.\n\nHe pays only for quick cuts, holding that a slow cut is a confession and a quick one an accident. Before the Decree, a dock child caught with a knife was hanged, not branded.\n\nThe fence considers that the better age.",
    effects: [{ op: 'damage', target: 'enemy', amount: 3 }, { op: 'damage', target: 'enemy', amount: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'damage', target: 'enemy', amount: 4, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'feint', name: 'Feint', class: 'rogue', rarity: 'common', cost: 0, type: 'skill', keywords: [], icon: '↝',
    flavor: "Oldest trick of the frozen docks.\n\nEyes on the purse, hand on the knife. The docks say the Court's knights were easily taken, for they had sworn to look wherever a threat was declared.\n\nNo such clause appears in their oath-book. The knights wrote the oath-book.",
    effects: [prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Become Prepared. Draw {draw} card.',
    upgrade: { effects: [prepare(), { op: 'draw', amount: 1 }, { op: 'block', target: 'self', amount: 3 }], textTemplate: 'Become Prepared. Draw {draw} card. Gain {block} Block.' },
  },
  {
    id: 'backstep', name: 'Backstep', class: 'rogue', rarity: 'common', cost: 1, staminaCost: 1, type: 'skill', keywords: [], icon: '👣',
    flavor: "Retreat of the lower-river ice-cutters.\n\nThe cutters know which ice beneath the bridges holds and which only seems to, and sell the knowledge by the season. Their map is drawn inside a cutter's coat and passed down with it.\n\nIts present wearer says it has been wrong since the second winter.",
    effects: [{ op: 'block', target: 'self', amount: 6 }, prepare()],
    textTemplate: 'Gain {block} Block. Become Prepared.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 9 }, prepare()] },
  },
  {
    id: 'twinPrick', name: 'Twin Prick', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '†',
    flavor: "Two small wounds, set close together.\n\nThe Court's surgeons recorded them as bites when they found them upon bodies along the bridges. Their receipts give the hour, the bridge and the fee for the inquest. Not one case was closed.\n\nThe dock children call it the Surgeon's Signature.",
    effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 2 }, { op: 'damage', target: 'enemy', amount: 2, hits: 2, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage {hits} times. Prepared: deal {damage.2} damage {hits.2} times. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 2 }, { op: 'damage', target: 'enemy', amount: 2, hits: 2, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'pocketSand', name: 'Pocket Sand', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '✺',
    flavor: "Kiln ash, carried in a coat lining.\n\nFrom the south-bank lime kilns, where the dock poor laboured for the Court's builders. The Court paid in lime and taxed in coin; the ash was the one thing given freely.\n\nThe kilns went cold with the Court Flame. The ash has not run out.",
    effects: [{ op: 'block', target: 'self', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 }] },
  },
  {
    id: 'hamstringRogue', name: 'Hamstring', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '🦵',
    flavor: "Cut behind the knee.\n\nThe docks' answer to the stitched knights, who cannot kneel, and once fallen cannot rise. The surgeons called the knights unbending. On the docks, the word is taken as written.\n\nThe Fourth Bridge rail bears a tally of knights left upon the ice.",
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 }],
    textTemplate: 'Deal {damage} damage. Apply {vulnerable} Vulnerable.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 9 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 }] },
  },
  {
    id: 'serratedShiv', name: 'Serrated Shiv', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '🩸',
    flavor: "Shiv sawn from a Marionette's spine-rod.\n\nThe Court's surgeons set steel rods in the spines of their dancers, to keep them upright through the dance. Dock thieves call the taking of one a mercy.\n\nThe surgeons who fitted them took their reasons beneath the ice.",
    effects: [{ op: 'damage', target: 'enemy', amount: 5 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed. Prepared: apply {bleed.2} more. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 7 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'smokeVeil', name: 'Smoke Veil', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '🌁',
    flavor: "River fog, thickened with ash.\n\nThe fog rose off the water the night the Court Flame died, and has not lifted. The Court's lamplighters, paid to burn it away, were the first to be lost in it.\n\nTheir guild-book ends with a list of lamps to be relit. None are marked done.",
    effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak to ALL enemies.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'ricochet', name: 'Ricochet', class: 'rogue', rarity: 'common', cost: 1, staminaCost: 1, type: 'attack', keywords: [], icon: '➶',
    flavor: "Blade skipped across the ice.\n\nA children's game on the frozen river, played with pebbles by the young and knives by the old. The ice keeps no witnesses, they say.\n\nIt is said the Marrow Organist, beneath it, hears every throw.",
    effects: [{ op: 'damage', target: 'allEnemies', amount: 4 }],
    textTemplate: 'Deal {damage} damage to ALL enemies.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 7 }] },
  },
  {
    id: 'lowBlow', name: 'Low Blow', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '↘',
    flavor: "Strike below the belt.\n\nForbidden by the Court's code of arms, which hangs upon the Citadel gate in frost-bitten gilt. The children of the docks read it aloud to one another in jest.\n\nIts final clause, on the treatment of the unmarked, has been chipped from the stone.",
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'poiseDamage', target: 'enemy', amount: 4 }, { op: 'poiseDamage', target: 'enemy', amount: 5, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. Prepared: deal {poiseDamage.2} more Poise damage. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 8 }, { op: 'poiseDamage', target: 'enemy', amount: 5 }, { op: 'poiseDamage', target: 'enemy', amount: 6, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'pilfer', name: 'Pilfer', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '🖐',
    flavor: "Lift worked in the crowds upon the bridges.\n\nThe Court counted wrists and kept careful rolls, but never counted purses. Old Keel, the Tollmouth fence, taught that to rob a courtier sewn to his post was salvage, not theft.\n\nHe claimed to have been a courtier once. His wrist bears the brand.",
    effects: [{ op: 'draw', amount: 2 }, { op: 'discard', amount: 1, random: true }],
    textTemplate: 'Draw {draw} cards. Discard 1 card at random.',
    upgrade: { effects: [{ op: 'draw', amount: 3 }, { op: 'discard', amount: 1, random: true }] },
  },
  {
    id: 'vanish', name: 'Vanish', class: 'rogue', rarity: 'common', cost: 1, staminaCost: 1, type: 'skill', keywords: ['exhaust'], icon: '◌',
    flavor: "Art of the unmarked beneath the bridges.\n\nTaught to the docks by those who lived under the Citadel's bridges before the Decree, when to be seen was to be entered on a roll. Under the bridges there is nothing but ice.\n\nMost of those teachers vanished in the end. Where to, the docks cannot agree.",
    effects: [{ op: 'block', target: 'self', amount: 8 }, prepare(), { op: 'addCard', card: 'smokePellet', pile: 'hand' }],
    textTemplate: 'Gain {block} Block. Become Prepared. Add a Smoke Pellet to your hand. Exhaust.',
    upgrade: { keywords: [], effects: [{ op: 'block', target: 'self', amount: 8 }, prepare(), { op: 'addCard', card: 'smokePellet', pile: 'hand' }], textTemplate: 'Gain {block} Block. Become Prepared. Add a Smoke Pellet to your hand.' },
  },
  {
    id: 'cheapShot', name: 'Cheap Shot', class: 'rogue', rarity: 'common', cost: 2, type: 'attack', keywords: [], icon: '✹',
    flavor: "Blow at the already wounded.\n\nThe Tollmouth fence calls it the only honest bargain on the river, and charges for lessons in teeth. He says he learned the practice from a Court magistrate who levied fines the same way.\n\nThe jar upon his counter is nearly full.",
    effects: [{ op: 'damage', target: 'enemy', amount: 10 }, { op: 'damage', target: 'enemy', amount: 6, if: TARGET_WEAK }],
    textTemplate: 'Deal {damage} damage. If the target is Weak, deal {damage.2} more.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 13 }, { op: 'damage', target: 'enemy', amount: 8, if: TARGET_WEAK }] },
  },

  // ---- Uncommons (13) -----------------------------------------------------
  {
    id: 'bladeDanceRogue', name: 'Blade Dance', class: 'rogue', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'attack', keywords: [], icon: '⚔',
    flavor: "Cuts in the figure of the Marionettes' dance.\n\nThe surgeons stitched the Court's dancers to their dance when the Court Flame died, and they perform upon the frozen river for no one. The dance was meant to end at dawn.\n\nA small Marionette on the Fourth Bridge waits for the ending. Thieves leave her coins.",
    effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }, { op: 'damage', target: 'enemy', amount: 1, hits: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage {hits} times. Prepared: deal {damage.2} damage {hits.2} times. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 3 }, { op: 'damage', target: 'enemy', amount: 1, hits: 3, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'garrote', name: 'Garrote', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '➰',
    flavor: "Loop of the Court tailors' gilt thread.\n\nBought cheap on the docks once the tailors had no more use for it. The Court's surgeons bought the same thread, for purposes never shared with the tailors.\n\nThe surgeons and the stranglers were ever its best customers.",
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 5 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed and {weak} Weak.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 6 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'fanOfKnives', name: 'Fan of Knives', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '🗡',
    flavor: "Surgeon's roll of scalpels, thrown as one.\n\nThe rolls reach the docks more often than their owners, sold by ice-cutters who find them frozen into the river, the coat still about them. The surgeons tried to flee the Citadel on the night of the Burning.\n\nThe ice closed over those who ran.",
    effects: [{ op: 'damage', target: 'allEnemies', amount: 5 }, { op: 'draw', amount: 1 }],
    textTemplate: 'Deal {damage} damage to ALL enemies. Draw {draw} card.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 7 }, { op: 'draw', amount: 1 }] },
  },
  {
    id: 'setupRogue', name: 'Setup', class: 'rogue', rarity: 'uncommon', cost: 0, type: 'skill', keywords: ['exhaust'], icon: '⚙',
    flavor: "Preparation of a dock job.\n\nA window left open on the Lantern Bridge, a lamp turned low, a guard paid to cough. The method is credited to a thief called the Wick, who planned the first robbery of the Regent's hall in the years of the Mark Trade.\n\nIt is said the Court itself paid her to rob it.",
    effects: [prepare(), { op: 'gainEnergy', amount: 1 }, { op: 'addCard', card: 'rogueShiv', pile: 'hand' }],
    textTemplate: 'Become Prepared. Gain {gainEnergy} Energy. Add a Shiv to your hand. Exhaust.',
    upgrade: { effects: [prepare(), { op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 1 }, { op: 'addCard', card: 'rogueShiv', pile: 'hand' }], textTemplate: 'Become Prepared. Gain {gainEnergy} Energy. Draw {draw} card. Add a Shiv to your hand. Exhaust.' },
  },
  {
    id: 'acrobaticsRogue', name: 'Acrobatics', class: 'rogue', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'skill', keywords: [], icon: '🤸',
    flavor: "The rooftop road of the frozen docks.\n\nBridge rail, lamp post, gutter, never the street. The Court's watch walked only the paved ways, for the paving had been blessed at the Founding and the rooftops had not.\n\nWhether the watch was pious or idle is not agreed.",
    effects: [{ op: 'block', target: 'self', amount: 7 }, { op: 'draw', amount: 2 }, { op: 'discard', amount: 1, random: true }],
    textTemplate: 'Gain {block} Block. Draw {draw} cards. Discard 1 at random.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 9 }, { op: 'draw', amount: 3 }, { op: 'discard', amount: 1, random: true }] },
  },
  {
    id: 'disorient', name: 'Disorient', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '💫',
    flavor: "Spin practised in the Hall of Mirrors.\n\nThe Glass Regent's mirrors are the frozen river beneath the bridges, and they show more than stands before them. Thieves who went in for the silver learned to turn a courtier until he lost the throne.\n\nIt is said the Regent herself now reigns from the wrong side of the glass.",
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 }],
    textTemplate: 'Apply {weak} Weak and {vulnerable} Vulnerable. Exhaust.',
    upgrade: { keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 }], textTemplate: 'Apply {weak} Weak and {vulnerable} Vulnerable.' },
  },
  {
    id: 'coupDeGrace', name: 'Coup de Grace', class: 'rogue', rarity: 'uncommon', cost: 2, type: 'attack', keywords: [], icon: '☠',
    flavor: "Finishing thrust of the Court's surgeons.\n\nThey called it a courtesy and billed it as a procedure, listed between stitching and funeral in their fee schedule. The docks learned it watching the surgeons at work upon the bridges after the Burning.\n\nThe schedule has since been amended by hand. The price has risen.",
    effects: [{ op: 'damage', target: 'enemy', amount: 10 }, { op: 'damage', target: 'enemy', amount: 10, if: TARGET_VULNERABLE }],
    textTemplate: 'Deal {damage} damage. If the target is Vulnerable, deal {damage.2} more.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 13 }, { op: 'damage', target: 'enemy', amount: 13, if: TARGET_VULNERABLE }] },
  },
  {
    id: 'sap', name: 'Sap', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '♠',
    flavor: "Sand-weighted cosh of the docks.\n\nMeant to fell without killing. It does not work upon the Marionettes, who dance on with slack strings. One thief used it upon a girl at the foot of the Stitched Throne, a dancer no older than a dock child.\n\nHe returned asking whether anyone knew the tune she hummed.",
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'poiseDamage', target: 'enemy', amount: 4 }],
    textTemplate: 'Deal {damage} damage. Apply {weak} Weak. Deal {poiseDamage} Poise damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 }, { op: 'poiseDamage', target: 'enemy', amount: 5 }] },
  },
  {
    id: 'shadowstep', name: 'Shadowstep', class: 'rogue', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'skill', keywords: [], icon: '◐',
    flavor: "Step through a pier's shadow.\n\nThe shadows beneath the bridges are let by the season, and rent is owed to whoever held the pier before. Tenancies pass down like a trade.\n\nThe oldest belongs to one not seen since the Decree. The rent is always paid.",
    effects: [{ op: 'block', target: 'self', amount: 5 }, prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Gain {block} Block. Become Prepared. Draw {draw} card.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 7 }, prepare(), { op: 'draw', amount: 1 }] },
  },
  {
    id: 'afterimageCard', name: 'Afterimage', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'power', keywords: [], icon: '👤',
    flavor: "Reflection left in the Regent's glass.\n\nThe mirrors of the Hall held a thief's image a heartbeat longer than they should. The Regent's stewards recorded it as the Hall's loyalty.\n\nThe glass has grown slower with each winter since the Burning.",
    effects: [{ op: 'applyStatus', target: 'self', status: 'afterimage', stacks: one }],
    textTemplate: 'Every third card you play grants 3 Block.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodletterRogue', name: 'Bloodletter', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '🩸',
    flavor: "Bleeding, as the Citadel's surgeons practised it.\n\nTheir receipts name the patient, the measure drawn, and the patient's satisfaction, marked on every surviving copy. The surgeons held that bleeding balanced a courtier's humours before an oath.\n\nReceipts from the last month before the Burning bear no names.",
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: { f: 'stacks', status: 'bleed', of: 'target' } }],
    textTemplate: "Double the target's Bleed. Exhaust.",
    upgrade: { keywords: [], textTemplate: "Double the target's Bleed." },
  },
  {
    id: 'venomcoat', name: 'Venomcoat', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: [], icon: '🐍',
    flavor: "Sedative paste of the Court's surgeons.\n\nSold by the vial to courtiers who could not sleep in the weeks before the Decree. The docks found it served a blade as well as a cup of wine.\n\nThe label promises a dreamless night.",
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'venom', stacks: 4 }, prepare()],
    textTemplate: 'Apply {venom} Venom. Become Prepared.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'venom', stacks: 6 }, prepare()] },
  },
  {
    id: 'misdirect', name: 'Misdirect', class: 'rogue', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'skill', keywords: [], icon: '↪',
    flavor: "Art of leading the watch astray.\n\nPerfected on the night of the Courtly Decree, when the brand-men came down to the river to mark the last of the unmarked by dawn, and the ice-cutters paid the bridge watch to lead them in circles.\n\nThe Decree said dawn. On that side of the river, dawn came late.",
    effects: [{ op: 'block', target: 'self', amount: 6 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }, prepare()],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak to ALL enemies. Become Prepared.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 9 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }, prepare()] },
  },

  // ---- Rares (10) ---------------------------------------------------------
  {
    id: 'assassinate', name: 'Assassinate', class: 'rogue', rarity: 'rare', cost: 2, staminaCost: 1, type: 'attack', keywords: ['exhaust'], icon: '🗡',
    flavor: "Killing blow, struck after a single question.\n\nThe way of a dock thief who hunts one particular Court surgeon. The question has been told upon the docks; the surgeon's name has not. Some believe the question concerns a stitching. Others, that the surgeon is kin.\n\nThe docks have learned not to ask twice.",
    effects: [{ op: 'damage', target: 'enemy', amount: 14 }, { op: 'damage', target: 'enemy', amount: 14, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Consume Prepared. Exhaust.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 18 }, { op: 'damage', target: 'enemy', amount: 18, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'thousandCutsRogue', name: 'Thousand Cuts', class: 'rogue', rarity: 'rare', cost: 2, staminaCost: 1, type: 'attack', keywords: [], icon: '✣',
    flavor: "Many small cuts, each undoing a stitch.\n\nThe surgeons called it the procedure run backward, and forbade it, for a courtier sewn to his post had sworn an oath. The winter after the Burning, a surgeon was found unstitching his own wife from the palace stair.\n\nThe surgeons' day-book records only a failed stitching.",
    effects: [{ op: 'damage', target: 'enemy', amount: 2, hits: 6 }, { op: 'damage', target: 'enemy', amount: 1, hits: 6, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage {hits} times. Prepared: deal {damage.2} damage {hits.2} times. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 6 }, { op: 'damage', target: 'enemy', amount: 1, hits: 6, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'deadlyTempoCard', name: 'Deadly Tempo', class: 'rogue', rarity: 'rare', cost: 2, type: 'power', keywords: [], icon: '⏱',
    flavor: "Rhythm of the frozen docks.\n\nThe dock clock froze at the Burning, its hands upon the King's Hour. Before, thieves timed their work by it, and the Court timed its watch by the same.\n\nSince then the docks keep time by their own pulses, and no two agree.",
    effects: [{ op: 'applyStatus', target: 'self', status: 'deadlyTempo', stacks: one }],
    textTemplate: 'At the start of your turn, become Prepared and draw a card.',
    upgrade: { cost: 1 },
  },
  {
    id: 'opportunistCard', name: 'Opportunist', class: 'rogue', rarity: 'rare', cost: 1, type: 'power', keywords: [], icon: '◎',
    flavor: "First law of the frozen docks.\n\nWhen the knight stumbles, the purse swings. The stitched knights stumble often in their sewn armour, and the docks have prospered by it.\n\nMany of those knights are the fathers and brothers of the docks. This is not spoken of.",
    effects: [{ op: 'applyStatus', target: 'self', status: 'opportunist', stacks: one }],
    textTemplate: 'Whenever an enemy Staggers, become Prepared and draw a card.',
    upgrade: { cost: 0 },
  },
  {
    id: 'envenomCard', name: 'Envenom', class: 'rogue', rarity: 'rare', cost: 2, type: 'power', keywords: [], icon: '☣',
    flavor: "Poison from a surgeon's second shelf.\n\nThe second shelf held what the first could not treat. Thieves who entered the surgeons' houses after the Burning found the second shelves full and the first bare.\n\nThe apprentices will not say which was emptied first.",
    effects: [{ op: 'applyStatus', target: 'self', status: 'envenom', stacks: one }],
    textTemplate: 'Your attacks apply 1 Venom per stack.',
    upgrade: { cost: 1 },
  },
  {
    id: 'toxicVolley', name: 'Toxic Volley', class: 'rogue', rarity: 'rare', cost: 2, type: 'skill', keywords: [], icon: '🏹',
    flavor: "Sedative vials, broken into the river fog.\n\nLoosed upwind of the bridge watch, which slept through three robberies. The river smelled of it for weeks.\n\nThe watch ledger records those weeks as quiet, and commends the men for their vigilance.",
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'venom', stacks: 5 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }],
    textTemplate: 'Apply {venom} Venom and {weak} Weak to ALL enemies.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'venom', stacks: 7 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'smokeBomb', name: 'Smoke Bomb', class: 'rogue', rarity: 'rare', cost: 1, staminaCost: 1, type: 'skill', keywords: ['exhaust'], icon: '💨',
    flavor: "Pig's bladder of kiln ash.\n\nSplit upon the stones, it raises a fog the bridge watch reports as a haunting. The ash is from the south-bank kilns, which in the Court's last years were fired with something other than lime.\n\nThe reports are not wholly wrong.",
    effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 3 }],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 10 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 4 }] },
  },
  {
    id: 'executionWindow', name: 'Execution Window', class: 'rogue', rarity: 'rare', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '⌛',
    flavor: "The moment the watch looks away.\n\nEvery guard has one. In the years of the Mark Trade, the watch's were written into the roster for a fee: the hours each bridge would stand unguarded, and beside each hour, a name.\n\nNone of those names appear in any Court record.",
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 3 }, prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Apply {vulnerable} Vulnerable. Become Prepared. Draw {draw} card. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 4 }, prepare(), { op: 'draw', amount: 1 }] },
  },
  {
    id: 'perfectHeist', name: 'Perfect Heist', class: 'rogue', rarity: 'rare', cost: 0, staminaCost: 1, type: 'skill', keywords: ['exhaust'], icon: '💎',
    flavor: "Theft of the Glass Regent's mirrors.\n\nEvery mirror is entered in the Hall's inventory, and every one is gone. The older thieves credit the Wick.\n\nThe Hall of Mirrors is full of glass to this day. That is how the docks know it was perfect.",
    effects: [{ op: 'draw', amount: 3 }, { op: 'gainEnergy', amount: 1 }],
    textTemplate: 'Draw {draw} cards. Gain {gainEnergy} Energy. Exhaust.',
    upgrade: { effects: [{ op: 'draw', amount: 4 }, { op: 'gainEnergy', amount: 1 }] },
  },
  {
    id: 'deathblow', name: 'Deathblow', class: 'rogue', rarity: 'rare', cost: 3, type: 'attack', keywords: [], icon: '☠',
    flavor: "Killing stroke of the frozen docks.\n\nStruck where the river keeps what the surgeons leave. The river does not thaw, the docks say, because it is full, and the Court built more bridges rather than ask why.\n\nBeneath the ice the Marrow Organist plays the funeral service. He has never reached its end.",
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
    flavor: "Hands warmed before the work.\n\nCold hands drop knives. Dock children learn to warm their hands before they learn to steal, and never at a fire another has lit.\n\nThe fires on the Citadel side burn more than wood.",
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
