// src/model/balanceNotes.js — what each authored balance dial does, in a sentence.
//
// Settings → Advanced generates one row per leaf of `balance`
// (model/advancedConfig.js `leafRows`). Every one of those rows used to carry
// the SAME note — "Authored balance value: <path>. Applies to a new run." —
// so 325 dials described themselves identically and the description said
// nothing the key had not already said. The owner's words, 2026-09-21: "the
// description for most of the settings say the same thing and aren't very
// helpful descriptions".
//
// A sentence here IS that row's description. Two rules hold it honest:
//
//   NAMES ARE DERIVED, NEVER TRANSCRIBED. A relic's name comes from the relic,
//   a talent's from its node, a class's from the class, an array row's from
//   the row's own id/tag/label. Renaming content renames the note; a relic
//   added to `balance.powers` gets a real sentence with no edit here.
//
//   A PATTERN BEFORE A LIST. Families that repeat — rarity weights, price
//   bands, drop odds, relic powers, class talents — are one rule, so the
//   fifteenth member of a family cannot be the one nobody wrote a note for.
//
// `balanceNote` returns null for a path no rule covers, and the caller keeps
// its old fallback sentence. tests/advanced-config.test.mjs asserts the
// shipped bundle needs that fallback nowhere, and that no two generated rows
// describe themselves with the same words.

const word = (value) => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[._-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

// "a uncommon card" is the sort of seam a reader trips on, and the noun is a
// pattern's capture rather than a word anyone typed, so the article derives.
const an = (noun) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

// A POOL IS A DOOR, and the sentence reads better naming the door than the id.
const POOL = Object.freeze({
  normal: 'a normal fight',
  elite: 'an elite fight',
  boss: 'a boss fight',
  treasure: 'a treasure node',
  shop: 'a merchant',
  shrine: 'a shrine',
  merchant: 'a merchant',
});
// EVERY TABLE IS READ BY OWN PROPERTY. A bare `TABLE[key]` walks the
// prototype chain, so a balance path or a node variable named `toString` or
// `constructor` would answer with a function — truthy, and printed into the
// row. Nothing in the shipped bundle is named that; a row read off authored
// content should not have to be lucky.
const look = (table, key) => (Object.hasOwn(table, key) ? table[key] : undefined);
const pool = (id) => look(POOL, id) || an(`${word(id).toLowerCase()} node`);

// The low/high end of an authored [min, max] band.
const END = Object.freeze(['low end', 'high end']);
const band = (index) => END[Number(index)] || `entry ${Number(index) + 1}`;

// An enemy stat reads as the game writes it, not as the key spells it.
const STAT = Object.freeze({ hp: 'HP', damage: 'damage', block: 'Block', poise: 'Poise' });
const stat = (id) => look(STAT, id) || word(id).toLowerCase();

// What a relic's or a talent's variable NAMES. One phrase per variable, shared
// by both families because the vocabulary is one vocabulary — the nodes that
// read these rows (content/source/nodeEffects.json) draw from the same set.
const EFFECT_PHRASES = Object.freeze({
  block: 'how much Block it grants',
  draw: 'how many cards it draws',
  heal: 'how much HP it heals',
  strength: 'how much Strength it grants',
  damage: 'how much damage it deals',
  poiseDamage: 'how much Poise damage it deals',
  gainEnergy: 'how many actions it gives back',
  restoreMana: 'how much Mana it restores',
  restoreStamina: 'how much Stamina it restores',
  starstoneCharge: 'how many Starstone Charges it grants',
  bleed: 'how many stacks of Bleed it applies',
  venom: 'how many stacks of Venom it applies',
  crimsonBlight: 'how many stacks of Crimson Blight it applies',
  prepared: 'how many stacks of Prepared it grants',
  madness: 'how many stacks of Madness it costs you',
  frail: 'how many stacks of Frail it costs you',
  weak: 'how many stacks of Weak it applies to the foe',
  vulnerable: 'how many stacks of Vulnerable it applies to the foe',
  loseHp: 'how much HP it costs you',
  n: 'how many cards you play per trigger: it fires on every Nth card of the fight, not after N quiet ones',
});
const effectPhrase = (variable) => look(EFFECT_PHRASES, variable)
  || `the ${word(variable).toLowerCase()} it uses`;

// Lookups derived from the bundle, once per bundle. advancedConfigRows runs
// over 2,700 leaves and is called from several screens; a linear scan of the
// relic list per leaf is the kind of cost that only shows up on a phone.
const INDEXES = new WeakMap();
function indexes(bundle) {
  if (!bundle || typeof bundle !== 'object') return { relics: new Map(), nodes: new Map(), classes: new Map(), talents: new Map() };
  const cached = INDEXES.get(bundle);
  if (cached) return cached;
  const built = {
    relics: new Map((bundle.relics || []).map((relic) => [relic.id, relic])),
    nodes: new Map((bundle.nodes || []).map((node) => [node.id, node])),
    classes: new Map((bundle.classes || []).map((classDef) => [classDef.id, classDef])),
    talents: (bundle.classTree || []).reduce((map, row) => {
      // A LIST PER NODE, not a row per node. `new Map(rows.map(...))` let the
      // last tree that claimed a node win in silence, so a talent shared by
      // two classes would have named one of them and read as settled.
      if (!map.has(row.nodeId)) map.set(row.nodeId, []);
      map.get(row.nodeId).push(row);
      return map;
    }, new Map()),
  };
  INDEXES.set(bundle, built);
  return built;
}

const relicName = (bundle, id) => (indexes(bundle).relics.get(id) || {}).name || word(id);
const nodeLabel = (bundle, id) => (indexes(bundle).nodes.get(id) || {}).label || word(id);
const className = (bundle, id) => (indexes(bundle).classes.get(id) || {}).name || word(id);

/** A talent's own sentence: whose tree it sits in, and at which tier. */
function talentPlace(bundle, nodeId) {
  const rows = indexes(bundle).talents.get(nodeId) || [];
  if (!rows.length) return 'a class talent';
  const names = [...new Set(rows.map((row) => className(bundle, row.classId)))];
  const tiers = [...new Set(rows.map((row) => row.tier))];
  const whose = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return tiers.length === 1 ? `a tier-${tiers[0]} ${whose} talent` : `a ${whose} talent`;
}

// A node's blurb is the authored one-liner beside it in the tree, and only the
// talent sentences read one — every talent node in the shipped tree has an
// authored blurb, and the relic sentences ask for none. The guard below is for
// the OTHER blurb: 52 nodes (all of them relics, today) carry one generated
// line, "What <name> does when the fight gives it its moment", which says
// nothing a reader does not already have. It does not fire on the shipped
// bundle and is not claimed to; it is here so that the day a talent node
// acquires that generated line, it does not become the one sentence on many
// rows that this file exists to remove.
function blurbOf(bundle, nodeId) {
  const blurb = (indexes(bundle).nodes.get(nodeId) || {}).blurb;
  if (typeof blurb !== 'string' || !blurb.trim()) return '';
  if (/^What .+ does when the fight gives it its moment\.?$/.test(blurb.trim())) return '';
  return blurb.trim().replace(/\.?$/, '.');
}

// A ROW NOTHING READS SAYS SO, and these two clauses are why it can be said
// once. The failure they answer is worse than the boilerplate this file
// replaces: a sentence that describes a dial as live invites a player to move
// it and watch nothing happen, where "Authored balance value" at least
// promised nothing. `balance.levels` is authored for #238 and consumed only by
// its own validator (model/levels.js is imported by validate.js alone, and the
// level planner is called from nowhere); `energy`, `draw` and
// `graceRefillAtRunStart` have no reader left at all.
const INERT_LEVELS = 'Authored and not yet read: nothing resolves an enemy level, so moving this changes no fight today.';

// A ROW LIKE THAT DOES NOT "APPLY TO A NEW RUN" EITHER, and every generated
// note used to end saying it did — a clause appended unconditionally, which
// on these sixteen rows contradicted the sentence in front of it. A rule marks
// its sentence inert instead of the composer sniffing the text for a phrase,
// which is the trick this file has just finished removing from settings.js.
const inert = (text) => ({ text, inert: true });
export const NEW_RUN_CLAUSE = 'Applies to a new run.';

// ---- the families ---------------------------------------------------------
// Ordered: the first rule whose pattern matches owns the path. `parent` is the
// object or array the leaf sits in, so a row inside an authored list can name
// itself by its own id, tag or label instead of by its index.
//
// AN AUTHORED ID IS A SEGMENT, NOT A WORD. Every capture that stands for a
// content id reads `[^.]+`, not `\w+`: `schemas.js` types a relic id as a bare
// string, so `sun-eater` is legal, and a `\w+` capture would have dropped it
// through to the fallback — in a file whose whole promise is that a relic
// added to `balance.powers` describes itself with no edit here. The dot is the
// only character a path segment cannot hold, so it is the only one excluded.
const PATTERNS = Object.freeze([
  [/^arcaneExposure\.schoolBuildupMultipliers\.(\w+)$/, ([, school]) =>
    `Multiplies the Arcane Exposure ${an(`${school} card`)} builds on its target. 0 means ${school} damage never builds Exposure at all.`],

  [/^powers\.([^.]+)\.([^.]+)$/, ([, relic, variable], { bundle }) =>
    `${relicName(bundle, relic)} — ${effectPhrase(variable)}.`],

  [/^classTree\.([^.]+)\.([^.]+)$/, ([, node, variable], { bundle }) =>
    `${nodeLabel(bundle, node)}, ${talentPlace(bundle, node)} — ${effectPhrase(variable)}.`
    + (blurbOf(bundle, node) ? ` ${blurbOf(bundle, node)}` : '')],

  [/^costs\.(\w+)$/, ([, resource]) =>
    `The ${resource} a card pays when it carries ${an(`${resource} cost`)} with no amount of its own.`],

  [/^rewards\.cinders\.(\w+)\.(\d+)$/, ([, kind, index]) =>
    `The ${band(index)} of the cinders that ${pool(kind)} pays.`],

  [/^rewards\.rarityWeights\.(\w+)\.(\w+)$/, ([, kind, rarity]) =>
    `How often ${pool(kind)} offers ${an(rarity)} card, weighed against the other rarities in its row. Classes with a table of their own use that instead.`],

  [/^rewards\.rarityWeightsByClass\.([^.]+)\.(\w+)\.(\w+)$/, ([, classId, kind, rarity], { bundle }) =>
    `The ${className(bundle, classId)}'s own reward odds: how often ${pool(kind)} offers ${an(rarity)} card, weighed against the other rarities in its row.`],

  [/^shop\.(card|relic|armament|weaponArt|flask)Cost(?:\.(\w+))?\.(\d+)$/, ([, kind, rarity, index]) => {
    const noun = { card: 'card', relic: 'relic', armament: 'armament', weaponArt: 'weapon art', flask: 'flask' }[kind];
    return `The ${band(index)} of what the merchant charges for ${an(rarity ? `${rarity} ${noun}` : noun)}.`;
  }],

  [/^shop\.(\w+)Stock$/, ([, kind]) =>
    `How many ${word(kind).toLowerCase()}s the merchant puts on the shelf each visit.`],

  [/^smithing\.rewardByPool\.(\w+)$/, ([, kind]) =>
    `How many Smithing Stones ${pool(kind)} pays out.`],

  [/^smithing\.services\.offeredAt\.(\w+)\.chance$/, ([, place]) =>
    `Percent chance ${pool(place)} offers the smith's services on a visit. 100 is always and rolls nothing; 0 is never.`],

  [/^smithing\.services\.(extract|install)\.cost$/, ([, service]) =>
    service === 'extract'
      ? 'Smithing Stones to pull a card out of an item\'s mount so it becomes the run\'s own.'
      : 'Smithing Stones to fit a run-owned card into an open or emptied mount.'],

  [/^levels\.enemyScaling\.(\w+)\.perLevel$/, ([, statId]) =>
    inert(`How much ${stat(statId)} an enemy would gain per level of enemy level. ${INERT_LEVELS}`)],

  [/^levels\.enemyScaling\.(\w+)\.(min|max)$/, ([, statId, bound]) =>
    inert(`The ${bound === 'min' ? 'lowest' : 'highest'} ${stat(statId)} that scaling may produce, whatever the level. ${INERT_LEVELS}`)],

  [/^xp\.kill\.(\w+)$/, ([, kind]) =>
    `Character XP for killing an enemy out of the roster ${pool(kind)} draws from.`],

  [/^skill\.rarityUnlock\.(\w+)$/, ([, rarity]) =>
    `The skill-track level at which ${rarity} cards start appearing in that track's drafts.`],

  [/^skill\.class\.tierAt\.(\d+)$/, ([, index]) =>
    `The class level at which tier ${Number(index) + 1} of the class tree opens.`],

  [/^gauntlet\.rarityWeights\.(\w+)$/, ([, rarity]) =>
    `Headless gauntlet only: how often its reward is ${an(rarity)} card, weighed against the other rarities.`],

  [/^seatTiers\.(\d+)$/, ([, tier]) =>
    `Enemy HP multiplier for a tier-${tier} seat. A fight scales by this over the tier its roster was authored at, so a seat at its own tier is exactly 1.`],

  [/^equipment\.roleCopies\.(\w+)$/, ([, role]) =>
    `Copies of the ${role} card a starting deck holds. It decides the deck only while the composed starting deck below is off, and must then sum to the starting deck size by hand; the Armoury reads it either way.`],

  [/^equipment\.startingDeck\.classes\.([^.]+)\.strikeBias$/, ([, classId], { bundle }) =>
    `The ${className(bundle, classId)}'s filler split: the share of its base cards that are attacks, the rest guards. 0.5 is even.`],

  [/^equipment\.rarityBonuses\.(\w+)\.(\w+)$/, ([, rarity, role]) =>
    `Added to the ${role} value of a card minted from ${an(rarity)} piece, on top of the profile's base and attribute tier.`],

  [/^equipment\.limits\.min(\w+)$/, ([, field]) =>
    `The lowest ${word(field).toLowerCase()} a modded card may be pushed to, so a piece cannot be authored past the point where its card stops making sense.`],

  [/^equipment\.drops\.chance\.(\w+)$/, ([, kind]) =>
    `Percent chance ${pool(kind)} yields an armament.`],

  [/^equipment\.drops\.rarityWeights\.(\w+)\.(\w+)$/, ([, kind, rarity]) =>
    `How often an armament from ${pool(kind)} is ${rarity}, weighed against the other rarities in its row.`],

  [/^equipment\.swapCostRules\.(\d+)\.gear$/, (match, { parent }) =>
    `The ${(parent && (parent.label || parent.id)) || `rule ${match[1]}`} pricing rule: whether talismans and relics adjust the swap cost it arrives at.`],

  [/^equipment\.swapCostByCategory\.(\d+)\.cost$/, (match, { parent }) =>
    `What a swap costs when the drawn weapon is ${parent && parent.tag ? `tagged ${parent.tag}` : `in category ${match[1]}`}. Read only under the Weapon category rule, and the first matching row wins.`],

  [/^equipment\.views\.(\d+)\.figure$/, (match, { parent }) =>
    `Whether the ${(parent && parent.id) || `view ${match[1]}`} Armoury view draws the dressed class figure beside the slots.`],

  [/^flaskGrowth\.(\d+)\.amount$/, (match, { parent, bundle }) => {
    const kind = parent && parent.kind === 'mana' ? 'Azure' : 'Crimson';
    const carrier = parent && parent.source === 'relic' ? relicName(bundle, parent.id) : word((parent && parent.id) || 'the carrier');
    return `How many extra ${kind} flask charges carrying ${carrier} adds to the run's capacity.`;
  }],

  [/^poise\.onFill\.(\d+)\.stacks$/, (match, { parent }) =>
    `Stacks of ${word((parent && parent.status) || 'the status')} that ${(parent && parent.target) === 'self' ? 'an enemy takes itself' : `an enemy's fill applies to ${(parent && parent.target) || 'its target'}`} when its Poise meter fills. The player's own fill runs no row from this list — it reads Stagger · Player instead.`],

  [/^stagger\.player\.statuses\.(\w+)$/, ([, status]) =>
    `Stacks of ${word(status)} the player takes when their own Poise meter fills.`],
]);

// ---- the one-offs ---------------------------------------------------------
// Everything with no family. Where a sentence states a mechanism rather than a
// magnitude, it is the mechanism the reader cannot get from the key.
const EXPLICIT = Object.freeze({
  'exposure.siphonRefund': 'Mana the Siphon focus property hands back when you break a foe\'s Arcane Exposure.',
  'exposure.siphonRefundMastered': 'Mana Siphon hands back instead, once the focus skill reaches the mastery level below.',
  'exposure.siphonMasteryLevel': 'The focus skill level at which Siphon starts paying its mastered refund.',
  'exposure.overchargeBuildupMult': 'Multiplies the Arcane Exposure each hit builds while a focus carries Overcharge.',
  'exposure.staggerBreakPoise': 'Poise damage Stagger Break deals to a foe whose Arcane Exposure you break.',
  'exposure.resonanceSpreadPct': 'Percent of a broken foe\'s Exposure threshold that Resonance pours into every OTHER foe.',
  'exposure.buildupPerManaSpell': 'The least Arcane Exposure a card that costs Mana must build per hit, so a Mana spell always works toward a break faster than an action-only one.',

  energy: inert('The authored actions a turn starts with, and nothing reads it: a run derives Actions from Dexterity, and Progression › Stat conversions is the row that moves them. It survives because the engine still spells actions "energy" — that rename is its own piece of work.'),
  draw: inert('The authored cards drawn each turn, and nothing reads it: a run derives Draw from Intelligence, and Progression › Stat conversions is the row that moves it.'),
  handMax: 'Fallback hand capacity, for a fight handed no hand rules. A solo fight always has them, so its capacity is Hand & Draw → Hand capacity → Base hand capacity; a co-op fight reads this row whatever they say. A card drawn past the limit goes to the discard rather than being lost.',
  flaskCapacity: 'Crimson and Azure charges a run carries between them, before any growth row adds to it. They share this one pool.',
  flaskSlots: 'Inventory slots for utility consumables. Separate from flask charges, which have their own capacity above.',
  startingCinders: 'Cinders a new run opens with.',
  startingDeckSize: 'How many cards a new character\'s deck holds, the class ability and signature included.',

  'poise.growthMult': 'How much a Poise threshold grows each time the meter fills, so the second stagger of a fight is dearer than the first.',
  'poise.playerImpactPerHit': 'Poise the player loses per enemy hit that lands, outside a ruleset that states its own weapon impact.',
  'stagger.player.actionLoss': 'Actions taken off the player\'s NEXT turn when their Poise meter fills.',

  'mana.minActionCost': 'The least action a card that costs Mana must also cost — Mana is the third cost line, never the first.',
  'mana.minStaminaCost': 'The least Stamina a card that costs Mana must also cost.',

  'deck.minimum': 'The fewest cards a run may leave the Armoury holding, at character level 0.',
  'deck.minimumStepLevels': 'How many character levels apart each rise in that deck floor sits.',
  'deck.minimumPerStep': 'How far the deck floor rises at each of those steps.',

  'skill.xp.base': 'Weapon, armour, focus and dual-wield tracks: what the first level step costs. Each step is round(base × growth^n) to the rounding below.',
  'skill.xp.growth': 'Those tracks: how much dearer each level step is than the one before it.',
  'skill.xp.roundTo': 'Those tracks: every step cost is rounded to a multiple of this.',
  'skill.xp.perHit': 'Skill XP for a hit or block a track\'s card lands on a live target.',
  'skill.xp.perWinEquipped': 'Skill XP each equipped track earns for a won fight.',
  'skill.xp.killMult': 'Multiplies that win award for the one track that landed the killing blow.',
  'skill.xp.impactPerXp': 'Impact a heavy-armoured wearer must absorb per point of armour skill XP. Medium armour earns half as fast; light earns none this way.',
  'skill.xp.evadeXp': 'Armour skill XP for evading a hit in light armour. Medium armour earns half.',
  'skill.xp.buildupPerXp': 'Arcane Exposure buildup a caster must deal per point of focus skill XP.',
  'skill.class.xp.base': 'The class track: what its first level step costs. Deliberately slower than the equipment tracks.',
  'skill.class.xp.growth': 'The class track: how much dearer each of its level steps is than the last.',
  'skill.class.xp.roundTo': 'The class track: every step cost is rounded to a multiple of this.',
  'skill.class.xp.perWin': 'Class XP for a won fight.',
  'skill.class.xp.bossKill': 'Class XP for killing an act boss, on top of the win.',
  'skill.class.xp.perQuest': 'Class XP for a completed quest.',
  'skill.draftSize': 'How many cards a skill draft lays out for you to take one of.',
  'skill.draftsPerCombat': 'The most drafts one track may hand out at a single reward door. The rest queue for later doors.',
  'skill.upgradeAt': 'The track level at which every card of that track\'s schools in your deck is upgraded.',
  'skill.favoredXpMult': 'Multiplies skill XP in the weapon groups your class card leans toward.',

  'rewards.cardChoices': 'How many cards a reward door lays out to choose from.',
  'rewards.flaskDropBasePct': 'The chance a fight drops a flask charge, before the run\'s running adjustment.',
  'rewards.flaskDropStepPct': 'How far that chance falls after a drop, and rises after a miss.',

  'shop.removeBase': 'What the first card removal of a run costs at the merchant.',
  'shop.removeStep': 'How much each further removal adds to that price.',
  'shop.sellFraction': 'What the merchant pays for a relic, flask or armament of yours, as a fraction of the cheapest he would sell that kind for, so the same piece fetches the same cinders every visit. Below 1 selling always loses on the trade, which is the point of it; at 1 or above a relic or flask sells for at least what he charges, while armaments stop selling altogether. 0 takes every buy-back to nothing.',

  'rest.hpSmallPct': 'Percent of max HP a rough camp\'s small rest hands back.',
  'rest.hpPartialPct': 'Percent of max HP a shrine\'s rest hands back.',
  'rest.mana.flat': 'Mana a flat-mode rest restores, as a fixed number of points.',
  'rest.mana.floorPct': 'The percent of max Mana a floor-mode rest tops you up TO. Already at or above it, you go to full instead.',

  'atlas.townsPerActMax': 'The most towns — start and city nodes — a generated act may hold. A route over it is rejected and rolled again, so attrition between towns is the run\'s tension.',

  'levels.playerStartingLevel': inert('The character level a run would begin at. Authored and not yet read: the level planner that would consult it is called from nowhere, and a climb takes its level from the levels it has earned instead.'),
  'level.xp.base': 'The character level curve: what the step from level 1 costs. Each later step is round(base × growth^n) to the rounding below.',
  'level.xp.growth': 'The character level curve: how much dearer each step is than the one before it.',
  'level.xp.roundTo': 'The character level curve: every step cost is rounded to a multiple of this.',
  'xp.combatWin': 'Character XP for winning a fight, before any kill awards.',
  'xp.quest': 'Character XP for a completed quest.',

  'levelUp.pointsPerLevelMin': 'The lowest attribute points per level the Progression field and its slider will accept. It is the domain of the control, not a ladder.',
  'levelUp.pointsPerLevelMax': 'The highest attribute points per level those controls accept. An experimental bound — raise it here and the field and slider follow.',
  'levelUp.tierSizeMin': 'The lowest points-per-tier those controls accept. 1 is arithmetic, not taste: the tier is floor(points ÷ tier size), so 0 divides by zero.',
  'levelUp.tierSizeMax': 'The highest points-per-tier those controls accept.',

  graceRefillAtRunStart: inert('A retired flag: it once refilled flask charges the moment a run started, as though a grace had already been touched. Nothing reads it now.'),

  'gauntlet.healPct': 'Headless gauntlet only: percent of max HP healed between its fights.',
  'gauntlet.rewardChoices': 'Headless gauntlet only: how many cards its reward lays out.',

  'coop.headcountHpFactor': 'Co-op: enemy HP is multiplied by 1 + this × (party size − 1), so each extra body at the table adds one more share of the same fight. 0 leaves a four-hander reading exactly like a solo climb.',
  'coop.mendHealPct': 'Co-op: percent of an ally\'s max HP that Mend at a shrine restores.',
  'coop.reviveHp': 'Co-op: the HP a downed-but-not-dead member comes back at on the next floor.',

  'endless.hpPerLoop': 'Endless Spire: the fraction of extra enemy HP each completed cycle adds.',
  'endless.strPerLoop': 'Endless Spire: Strength enemies gain per completed cycle.',
  'endless.actsPerCycle': 'Endless Spire: acts before the spire loops. It is also the act count of an ordinary climb.',

  'customMods.toughElitesHpMult': 'Custom Climb, Tough Elites: multiplies elite and boss HP.',
  'customMods.bigBossesHpMult': 'Custom Climb, Dread Bosses: multiplies act boss HP.',
  'customMods.hoarderCinders': 'Custom Climb, Hoarder: bonus cinders the run starts with.',
  'customMods.expensiveShopsMult': 'Custom Climb, Greedy Merchants: multiplies every shop price.',
  'customMods.hoarderShopMult': 'Custom Climb, Hoarder: multiplies every shop price, the other half of its bargain.',
  'customMods.lessHealingMult': 'Custom Climb, Scarce Embers: multiplies all healing — shrine rests and the between-act refill alike.',

  'equipment.startingKitDiscovery.receiptLimit': 'How many armament-discovery receipts a profile keeps. Past it the oldest are dropped; the discoveries themselves are kept forever.',
  'equipment.startingDeck.enabled': 'Compose the starting deck from granted cards plus filler. Off falls back to the fixed role copies above, which must sum to the deck size by hand.',
  'equipment.startingDeck.defaultStrikeBias': 'The filler split for a class with no bias of its own: the share of base cards that are attacks, the rest guards.',
  'equipment.cardMounts.extraMounts.enabled': 'Open mounts on an item beyond the ones it was authored with — the seam a later rune feature needs. Off is the shipped game.',
  'equipment.cardMounts.extraMounts.perItem': 'How many extra mounts each item gets when that is on.',
  'equipment.enabled': 'The armament system itself. Off takes the Armoury out of combat.',
  'equipment.swapCost': 'What switching prepared weapon sets costs mid-fight, in actions — the base price every rule starts from.',
  'equipment.swapAllowancePerTurn': 'A separate per-turn swap budget that actions never touch. Consulted only when the swap cost is paid from an allowance rather than from the turn\'s actions.',
  'equipment.swapEndsTurn': 'A swap ends your turn outright.',
  'equipment.allowChangesInCombat': 'The Armoury stays actionable during your combat turn: replacing, moving or unequipping a carried piece is priced like a set swap.',
  'equipment.restampHand': 'A swap rewrites the Strikes and Defends already in your hand. Off, only cards drawn after the swap carry the new numbers.',
  'equipment.storageSlots': 'Pieces you may carry unslotted. Hand slots lock in combat; storage is what you carry beside them.',
  'equipment.limits.maxHits': 'The most hits a modded attack card may be pushed to.',
  'equipment.drops.enabled': 'Whether nodes drop armaments at all.',
  'equipment.drops.requireFound': 'A piece must be found before it can be equipped. Off makes every authored armament available from the start — a sandbox for testing the mod system without playing for it.',
  'equipment.drops.permanentOnFind': 'A found piece is remembered across runs, so a climb that ends badly still widens the wardrobe.',
  'equipment.drops.preferUnfound': 'Drops prefer a piece you have never held, a duplicate being a non-event.',
  'equipment.drops.consolationCinders': 'Cinders handed over instead when there is nothing new left for a drop to give.',
});

/**
 * balanceNote(path, { bundle, parent }) → the row's whole description, or null
 * for a path no rule here covers.
 *
 * `path` is the dotted balance path without the `gameConfig.balance.` prefix.
 * `parent` is the object or array the leaf sits in, which is how a row inside
 * an authored list names itself by its own id, tag or label.
 *
 * A rule returns its sentence, or `inert(sentence)` for a dial the game does
 * not read — which is the whole of the difference: an inert row does not go on
 * to promise that it applies to a new run.
 */
export function balanceNote(path, { bundle = null, parent = null } = {}) {
  if (typeof path !== 'string' || !path) return null;
  const written = Object.hasOwn(EXPLICIT, path) ? EXPLICIT[path] : describe(path, { bundle, parent });
  if (written == null) return null;
  if (typeof written === 'string') return `${written} ${NEW_RUN_CLAUSE}`;
  return written.text;
}

function describe(path, { bundle, parent }) {
  for (const [pattern, write] of PATTERNS) {
    const match = pattern.exec(path);
    if (match) return write(match, { bundle, parent, path });
  }
  return null;
}
