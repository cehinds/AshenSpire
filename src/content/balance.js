import { expansionStatuses } from './combatStatusRules.js';
// src/content/balance.js — every global tuning constant (SPEC §3.1(4))
//
// Code never embeds a balance number; a balance change is a one-file diff here.

import { tooltipHelp } from './tooltipHelp.js';
import { progressionGearRequirements } from './progression/gear.js';
import { combatMatchups, combatIntent } from './combatMatchups.js';
import { enemyKnowledgeTuning } from './enemyKnowledge.js';
import { balanceProgression } from './generated/balanceProgression.js';
import { balanceUi } from './generated/balanceUi.js';
import { balanceProgressionFeats } from './generated/balanceProgressionFeats.js';
import { balanceEquipment } from './generated/balanceEquipment.js';
import { balanceSigils } from './generated/balanceSigils.js';
import { balancePowers } from './generated/balancePowers.js';
import { balanceClassTree } from './generated/balanceClassTree.js';
import { balanceCosts } from './generated/balanceCosts.js';
import { balanceCustomMods } from './generated/balanceCustomMods.js';
import { balanceBossTiers } from './generated/balanceBossTiers.js';
import { balanceSeatTiers } from './generated/balanceSeatTiers.js';
import { balanceEndless } from './generated/balanceEndless.js';
import { balanceCoop } from './generated/balanceCoop.js';
import { balanceGauntlet } from './generated/balanceGauntlet.js';
import { balanceLevelUp } from './generated/balanceLevelUp.js';
import { balanceXp } from './generated/balanceXp.js';
import { balanceLevels } from './generated/balanceLevels.js';
import { balanceSmithing } from './generated/balanceSmithing.js';
import { balanceAtlas } from './generated/balanceAtlas.js';
import { balanceRest } from './generated/balanceRest.js';
import { balanceShop } from './generated/balanceShop.js';
import { balanceRewards } from './generated/balanceRewards.js';
import { balanceTagMechanics } from './generated/balanceTagMechanics.js';
import { balanceSkill } from './generated/balanceSkill.js';
import { balanceClassMastery } from './generated/balanceClassMastery.js';
import { balanceDeck } from './generated/balanceDeck.js';
import { balanceMana } from './generated/balanceMana.js';
import { balanceStagger } from './generated/balanceStagger.js';
import { balancePoise } from './generated/balancePoise.js';
import { balanceExposure } from './generated/balanceExposure.js';
import { balanceArcaneExposure } from './generated/balanceArcaneExposure.js';
import { balanceProgressionRelics } from './generated/balanceProgressionRelics.js';
import { balanceCore } from './generated/balanceCore.js';

// ---- WHAT EACH NUMBER DOES, WRITTEN BESIDE IT (owner, 2026-09-23) ----------
//
// Every object below carries a `[NOTE]` block beside its own numbers: the
// sentence Settings → Advanced shows under each row. They lived in
// model/balanceNotes.js until the owner asked for them here, and the reason
// is the one this file's header gives for the numbers — a description kept in
// a second file drifts from the number it describes, because nobody editing
// the number sees it. Two of the sentences reviewed in #1243 had been copied
// from a comment in this file that the code had since outgrown.
//
// THE KEY IS A SYMBOL, and that is what lets a sentence sit inside an object
// the engine reads as numbers. `Object.keys`, `Object.entries`, JSON and
// structuredClone all skip it, so `validate.js`'s unknown-field checks,
// model/advancedConfig.js's `leafRows` and every engine reader walk past it:
// `balance.shop.sellFraction` is still 0.5 and `balance.shop` still has the
// keys it had. `Symbol.for`, so a second copy of this module shares the key.
//
// HOW TO WRITE ONE. A key names a number by its path under the object that
// holds the block:
//
//   sellFraction: 'What the merchant pays …'           this one number
//   '{kind}Cost.{rarity}.{end}': 'The {band} of …'     every number of a family
//   '{statId}.perLevel': { text: '…', inert: true }    a number nothing reads
//
// `{name}` in a key captures a path segment. In a sentence, `{name}` is a
// blank model/balanceNotes.js fills with a NAME — a relic's from the relic, a
// class's from the class — and `{a name}` fills it with its article too.
// Nothing there writes prose; the phrases it picks between are `balanceWords`
// below. Every note but an inert one ends with `balanceWords.newRun`; an
// inert one says nothing reads it, and does not then promise to apply.
//
// A number with no note falls back to "Authored balance value: <path>", and
// tests/advanced-config.test.mjs fails on it. So does a note naming a number
// that is not here, which is what keeps a sentence and its number together:
// rename the number without moving its sentence and the test says so.
export const NOTE = Symbol.for('ashenspire.balance.note');

// The vocabulary the note blanks are filled from. Words, not rules: a phrase
// here is what a blank reads as, and model/balanceNotes.js only chooses one.
export const balanceWords = Object.freeze({
  newRun: 'Applies to a new run.',
  // What a relic's or a talent's variable NAMES — one vocabulary, because the
  // nodes that read these rows (content/source/nodeEffects.json) share it.
  effects: Object.freeze({
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
    necroticBlight: 'how many stacks of Necrotic Blight it applies',
    prepared: 'how many stacks of Prepared it grants',
    madness: 'how many stacks of Madness it costs you',
    frail: 'how many stacks of Frail it costs you',
    weak: 'how many stacks of Weak it applies to the foe',
    vulnerable: 'how many stacks of Vulnerable it applies to the foe',
    loseHp: 'how much HP it costs you',
    n: 'how many cards you play per trigger: it fires on every Nth card of the fight, not after N quiet ones',
  }),
  // A pool is a door, and a sentence reads better naming the door than the id.
  pools: Object.freeze({
    normal: 'a normal fight',
    elite: 'an elite fight',
    boss: 'a boss fight',
    treasure: 'a treasure node',
    shop: 'a merchant',
    shrine: 'a shrine',
    merchant: 'a merchant',
  }),
  // The two ends of an authored [low, high] band.
  bands: Object.freeze(['low end', 'high end']),
  // An enemy stat as the game writes it, not as the key spells it.
  stats: Object.freeze({ hp: 'HP', damage: 'damage', block: 'Block', poise: 'Poise' }),
  shopNouns: Object.freeze({ card: 'card', relic: 'relic', armament: 'armament', weaponArt: 'weapon art', flask: 'flask' }),
  flaskKinds: Object.freeze({ hp: 'Crimson', mana: 'Azure' }),
  // Where a talent sits. `{tier}` and `{owners}` are filled from the tree.
  talentPlace: Object.freeze({
    tiered: 'a tier-{tier} {owners} talent',
    untiered: 'a {owners} talent',
    unplaced: 'a class talent',
  }),
  // Who takes an enemy's on-fill stacks: itself, or the target a row names.
  onFill: Object.freeze({ self: 'an enemy takes itself', other: "an enemy's fill applies to" }),
  // What each card-value table under `damage` values. model/attackCardDamage.js
  // routes a card by type and school: attack damage and Block through AR, DR or
  // PR, and an attack's impact through Poise or Ward.
  cardValues: Object.freeze({
    attackCards: "a physical attack's damage",
    defenseCards: "a physical card's Block",
    potencyCards: "a magic card's damage and Block",
    poiseCards: "a physical attack's impact, which fills Poise",
    wardCards: "a magical attack's impact, which fills Ward",
  }),
});


const cardValueStatusMultipliers = {
  precision: 1,
  evade: 1,
  ...Object.fromEntries(expansionStatuses.map(status => [status.id, 1])),
  strength: 1,
  dexterity: 1,
  weak: 1,
  vulnerable: 1,
  frail: 1,
  bleed: 1,
  frost: 1,
  insanity: 1,
  bleedResist: 1,
  frostResist: 1,
  insanityResist: 1,
  frostExposed: 1,
  insanityExposed: 1,
  crimsonBlight: 1,
  necroticBlight: 1,
  burn: 1,
  regen: 1,
  madness: 1,
  staggered: 1,
  rallyingStandard: 1,
  rallyingStandardUp: 1,
  unbreakable: 1,
  unbreakableUp: 1,
  goreblood: 1,
  sanguinePact: 1,
  starstoneCharge: 1,
  stargazer: 1,
  astralArmor: 1,
  constellation: 1,
  azureCoil: 1,
  waxingMoon: 1,
  moonlitShield: 1,
  astromancer: 1,
  thornHalo: 1,
  communion: 1,
  lifeTithe: 1,
  stigmata: 1,
  zealotry: 1,
  emberTide: 1,
  harbingerOfBlight: 1,
  bloodUnction: 1,
  ironVow: 1,
  bulwarkEcho: 1,
  prepared: 1,
  venom: 1,
  afterimage: 1,
  deadlyTempo: 1,
  opportunist: 1,
  envenom: 1,
  glassCannon: 1,
  magicVulnerable: 1,
  silenced: 1,
  stanceShifted: 1,
  stoneskin: 1,
};

const cardValueRule = () => ({
  globalMultiplier: 1,
  actionCostMultiplier: 1,
  manaCostMultiplier: 2,
  staminaCostMultiplier: 1,
  statusEffectReductionMultiplier: 1,
  // The card-value model derives applicable preservation bonuses from authored
  // card faces. Keeping this map empty avoids a second hand-maintained roster.
  cardBonuses: {},
  statusMultipliers: { ...cardValueStatusMultipliers },
});

export const balance = {
  combatMatchups,
  combatIntent,
  enemyKnowledge: enemyKnowledgeTuning,
  // progression is JSON except the shared gear table and the sentences computed
  // from its rows: `version` first, the gear table second, then the rest, and the
  // `version` note first with the per-row gear sentences straight after it.
  progression: (() => {
    const { version, [NOTE]: note, ...rest } = balanceProgression;
    const { version: versionNote, ...restNotes } = note;
    return {
      version,
      gearRequirements: progressionGearRequirements,
      ...rest,
      [NOTE]: {
        version: versionNote,
        ...Object.fromEntries(progressionGearRequirements.map((row, index) => [`gearRequirements.${index}.level`, `${row.ref} — the minimum ${row.classId} class level for this gear option; existing discovery and attribute requirements also apply.`])),
        ...restNotes,
      },
    };
  })(),
  progressionRelics: balanceProgressionRelics,
  // Primary card values and physical/magical impact are derived from costs:
  // floor(global × (AP×action + MP×mana + SP×stamina)
  //       − statusEffectReduction × Σ(each distinct applied status))
  // + the value type's card-specific bonus.
  // The registry projects these values from the authored card data, so changing
  // any row here recalculates the whole applicable card corpus deterministically.
  damage: {
    attackCards: cardValueRule(),
    defenseCards: cardValueRule(),
    potencyCards: cardValueRule(),
    poiseCards: cardValueRule(),
    wardCards: cardValueRule(),
    [NOTE]: {
      '{config}.globalMultiplier': 'Multiplies the cost-derived part of {valueOf}: the card\'s action, Mana and Stamina costs, each weighed by its own row, added up and scaled by this before statuses are taken off and the result is rounded down.',
      '{config}.actionCostMultiplier': 'What each Action a card costs is worth toward {valueOf}.',
      '{config}.manaCostMultiplier': 'What each point of Mana a card costs is worth toward {valueOf}.',
      '{config}.staminaCostMultiplier': 'What each point of Stamina a card costs is worth toward {valueOf}.',
      '{config}.statusEffectReductionMultiplier': 'How hard a card\'s statuses weigh against {valueOf}: the weights of every distinct status it applies are added up, multiplied by this, and taken off before rounding down.',
      '{config}.statusMultipliers.{status}': 'The weight {statusLabel} carries against {valueOf} when a card applies it. 0 means applying it costs the card nothing.',
      '{config}.cardBonuses.{cardId}': '{cardName}: a signed bonus added to {valueOf} after the cost-derived value is rounded down. The result never falls below 0.',
    },
  },
  arcaneExposure: balanceArcaneExposure,
  exposure: balanceExposure,
  energy: balanceCore.energy,
  draw: balanceCore.draw,
  flaskCapacity: balanceCore.flaskCapacity,
  flaskGrowth: balanceCore.flaskGrowth,
  flaskSlots: balanceCore.flaskSlots,
  startingCinders: balanceCore.startingCinders,
  startingDeckSize: balanceCore.startingDeckSize,
  [NOTE]: balanceCore[NOTE],

  poise: balancePoise,

  stagger: balanceStagger,

  mana: balanceMana,

  deck: balanceDeck,

  classMastery: balanceClassMastery,
  skill: balanceSkill,

  tagMechanics: balanceTagMechanics,

  rewards: balanceRewards,

  shop: balanceShop,

  rest: balanceRest,

  atlas: balanceAtlas,

  smithing: balanceSmithing,

  levels: balanceLevels,

  level: balanceCore.level,
  xp: balanceXp,
  levelUp: balanceLevelUp,

  graceRefill: balanceCore.graceRefill,
  graceRefillAtRunStart: balanceCore.graceRefillAtRunStart,

  gauntlet: balanceGauntlet,

  coop: balanceCoop,

  endless: balanceEndless,
  seatTiers: balanceSeatTiers,
  bossTiers: balanceBossTiers,
  customMods: balanceCustomMods,

  // ui is JSON except the one number derived from the tooltip settings table
  // (the key sits first in tooltipPlacement, as it always did).
  ui: {
    ...balanceUi,
    tooltipPlacement: {
      hoverDelayMs: tooltipHelp.delays[tooltipHelp.settings.find(row => row.key === 'tooltipDelay').def],
      ...balanceUi.tooltipPlacement,
    },
  },

  costs: balanceCosts,
  classTree: balanceClassTree,
  powers: balancePowers,
  sigils: balanceSigils,
  equipment: balanceEquipment,
  progressionFeats: balanceProgressionFeats,


};
