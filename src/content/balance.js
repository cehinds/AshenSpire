import { expansionStatuses } from './combatStatusRules.js';
// src/content/balance.js — every global tuning constant (SPEC §3.1(4))
//
// Code never embeds a balance number; a balance change is a one-file diff here.

import { tooltipHelp } from './tooltipHelp.js';
import { progressionGearRequirements } from './progression/gear.js';
import { combatMatchups, combatIntent } from './combatMatchups.js';
import { enemyKnowledgeTuning } from './enemyKnowledge.js';
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

const PROGRESSION_CONTRACT_DESCRIPTION = 'The progression contract version saved for new characters, preserving the rules chosen at creation.';

export const balance = {
  combatMatchups,
  combatIntent,
  enemyKnowledge: enemyKnowledgeTuning,
  progression: {
    version: 1,
    gearRequirements: progressionGearRequirements,
    cadence: { cards: [2,4,6,8,10,12,14,16,18,20], feat: [1,4,8,12,16,20], armory: [3,6,9,12,15,18], relic: [5,8,11,14,17,20], attribute: [5,10,15,20] },
    skillBonusXp: 25,
    ability: { base: 100, growthPerLevel: 50, maxLevel: 10, ranksAt: [1,2,4,6,8,10], xp: { magical: 2, spell: 3, manaSpell: 1, technique: 2, maneuver: 5 }, draftSize: 3, intelligenceChance: 0.05, bonusRankDepth: 3 },
    classSkills: { reaver: ['combatManeuvers','item:blade','item:shield','armour:heavy'], starseer: ['item:magic-focus','item:blade','armour:light','armour:medium'], rogue: ['combatManeuvers','item:blade','dualWield','armour:light'], herald: ['item:magic-focus','item:blade','item:shield','armour:medium'] },
    classAttributes: { reaver: ['strength','constitution','dexterity'], starseer: ['intelligence','wisdom','dexterity'], rogue: ['dexterity','strength','wisdom'], herald: ['wisdom','constitution','intelligence'] },
    lessons: { 'item:magic-focus': ['cometFragment','crystalBarrier','scholarsInsight','ashenMote','emberVigil','readTheAsh','cinderSigil','starstoneArc','blightTouch','penance'], combatManeuvers: ['crimsonCleave','shieldBash','quickstep','guardCounter','riposte','rend','quickCut','backstep','stomp','lowBlow'] },
    respec: { enabled: true, cost: null },
    [NOTE]: {
      version: PROGRESSION_CONTRACT_DESCRIPTION,
      ...Object.fromEntries(progressionGearRequirements.map((row,index)=>[`gearRequirements.${index}.level`, `${row.ref} — the minimum ${row.classId} class level for this gear option; existing discovery and attribute requirements also apply.`])),
      ...Object.fromEntries(Object.entries({cards:10,feat:6,armory:6,relic:6,attribute:4}).flatMap(([kind,count])=>Array.from({length:count},(_,index)=>[`cadence.${kind}.${index}`, `The class level for ${kind} reward number ${index+1}; every earned milestone keeps its own saved grant.`]))),
      skillBonusXp: 'XP banked in each of the four class-related skills when a new class level is claimed; respec cannot replay this award.',
      'ability.base': 'XP required to advance an ability skill from its first activated level.',
      'ability.growthPerLevel': 'Additional XP required for each successive Spellcraft or Combat Maneuvers skill level.',
      'ability.maxLevel': 'The highest available Spellcraft or Combat Maneuvers skill level.',
      ...Object.fromEntries(Array.from({length:6},(_,rank)=>[`ability.ranksAt.${rank}`, `The ability skill level that makes rank ${rank} card profiles available in normal offers.`])),
      'ability.xp.magical': 'Spellcraft XP awarded once when a card resolves a magical effect.',
      'ability.xp.spell': 'Additional Spellcraft XP awarded once for playing a Spell, including a Cantrip.',
      'ability.xp.manaSpell': 'Additional Spellcraft XP per printed Mana point on a Spell; discounts do not reduce this award.',
      'ability.xp.technique': 'Combat Maneuvers XP awarded once for a physical Technique with no printed Mana cost.',
      'ability.xp.maneuver': 'Combat Maneuvers XP awarded once for a physical maneuver with a printed Mana cost.',
      'ability.draftSize': 'Distinct card families shown at the normal available rank in each saved ability offer.',
      'ability.intelligenceChance': 'Chance per Intelligence point for a fourth, higher-rank card option, capped at certainty.',
      'ability.bonusRankDepth': 'Maximum number of ranks above the normal offer for the Intelligence bonus option, capped at rank five.',
      'respec.enabled': 'Allows a class respec preview and atomic exchange of eligible choices through the current class level.',
    },
  },
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

  // ---- presentation config (read by the UI layer, never by the engine) ----
  // Same rule as the tuning above: code never embeds these numbers. Keeping the
  // audio defaults here in particular means the engine fallback and the settings
  // slider can't drift apart — they previously lived in two files and silently
  // disagreed.
  ui: {
    // How every rendered <img> is handed to the browser. Both of these are
    // decode-path settings, not network settings, and that distinction is the
    // whole reason this block exists rather than sixteen literal attributes
    // scattered through the render sites.
    //
    // The shipped build inlines its art as data: URIs (see ui/assetmap.js), so
    // there is no request to defer — the cost that remains is DECODE, and on a
    // phone decoding a 350x490 WebP synchronously on the main thread is a
    // dropped frame every time a card mounts. `decoding: 'async'` is the fix
    // and it is safe everywhere, because the only thing it gives up is the
    // guarantee that the image is painted in the same frame as its parent.
    //
    // `lazy` is NOT safe everywhere, and it is off by default for that reason.
    // A `loading="lazy"` image inside a container that is display:none, or
    // translated off-screen, or opacity:0 may never load at all — which is
    // exactly the shape of every combat effect overlay in this codebase. It is
    // opted into per call site, and only for images that sit in a scrollable
    // list where being below the fold is the normal case.
    imageHints: {
      decoding: 'async',
      lazy: true,
    },
    touchFlick: { enabled: true, distance: { min: 32, max: 160, def: 64 }, minVelocity: 300, velocityWindowMs: 120 },
    // HUD resource bars, per surface (content/resources.js holds the rows).
    //
    // `scaleByMax` is HIS RULE — "the size of that bar should scale depending on
    // the max total ... with the max size filling up the full top row". It is on
    // for the main HUD, which is the surface he said it about.
    //
    // It is OFF under the character models, and that is a call worth stating
    // rather than burying: he assigned that surface its CONTENTS ("really just
    // health and poise"), not a scaling rule. Turning it on there is defensible
    // and informative — the act-3 boss is authored at 250 HP (550 met at tier 3,
  // balance.bossTiers) against a 12 HP wisp —
    // but the under-model track is 84.6 px at 390x844, so most of the roster
    // lands on the 16 px floor and stops encoding anything.
    //
    // MEASURED, all 19 enemies, `node tools/hudbars.mjs --model-scale`:
    // 15 of 38 bars (39 %) sit ON the floor, and 13 of the 19 HP bars (68 %) do
    // — every enemy at or under 60 HP renders the same length as every other.
    // A scale two thirds of whose values are pinned to its minimum is not a
    // scale. That is the reason for the false, and it is a number rather than
    // a preference.
    //
    // Flipping either boolean is a one-number data edit and needs no code.
    hudBars: {
      // The shared map/combat resource reference track may occupy at most this
      // share of the visual viewport. main.js projects it to one CSS variable;
      // the stylesheet carries no second numeric copy.
      // The shared solo HUD uses this share of the room left after its action
      // cells. The old 40vw cap typed a viewport answer before those controls
      // had taken their space; 82% keeps a deliberate gutter without making a
      // second breakpoint. Co-op still consumes maxViewportPct below.
      main: { scaleByMax: true, maxViewportPct: 40, availableWidthPct: 82 },
      model: { scaleByMax: false },
    },
    // Shared HUD presentation tokens. These are screen-pixel intentions;
    // main.js projects them through --ui-zoom so Map and Combat consume the
    // same answer. Component backgrounds are transparent by current design,
    // while borders and the contents inside each panel remain visible.
    hudPresentation: {
      componentBackgroundOpacityPct: 0,
      metadataFontPx: 11,
      beltItemGapPx: 2,
      // Shared HUD spacing/scale tokens. Portraits shrink to 70% of the
      // legacy badge; the primary row, control grid, and vital rows each own
      // their own gap so responsive layouts do not hide a second copy.
      portraitScale: 0.58,
      primaryRowGapPx: 4,
      controlGapPx: 0,
      resourceRowGapPx: 3,
      panelPadPx: 0,
      mobilePanelPadPx: 0,
      mobileControlGapPx: 1,
      mobileOuterPadPx: 4,
      mobileRowGapPx: 3,
      // Header columns negotiate inside one grid: the center Cinders track and
      // right metadata trail each cap at 30% of the viewport. Act/Floor show
      // their current values by default; totals remain an opt-in.
      cindersMaxWidthPct: 30,
      metadataMaxWidthPct: 30,
      metadataShowTotals: false,
    },
    // The two always-nearby comfort controls are one shared component on the
    // title, map, and combat surfaces. Places and spacing are authored here so
    // a future surface or denser theme does not require another renderer.
    hudQuickSettings: {
      places: ['title', 'map', 'combat'],
      edgeGapPx: 4,
      stackGapPx: 0,
      // One visual card on every device. The 40px face sits inside the shared
      // tap floor, while its 28px icon occupies 70% of the authored face.
      cardSizePx: 40,
      glyphSizePx: 28,
      stateDotPx: 6,
      activeTintPct: 14,
      showCardBackground: true,
      showLabels: false,
    },
    // BattlefieldStageModel owns the protected vertical corridor between the
    // shared run HUD and the hand. Percentages are viewport-height shares on
    // the glass; intentGapPx is the visible device-pixel attachment distance.
    combatantStage: {
      hudClearanceViewportPct: 3,
      actionClearanceViewportPct: 3,
      intentGapPx: 6,
      centerPct: 50,
    },
    // Contextual explanations point back toward the readable centre instead of
    // blindly choosing the first side with room. Combatants add a persistent,
    // foldable edge inspector while the shared floating tooltip remains the
    // short-lived hover/tap explanation.
    // THE EQUIPMENT CARD FACE, SIZED BY WHAT THE INFORMATION IS WORTH.
    //
    // The face used to be seven hard-coded pixel rows. Whatever did not fit was
    // cut wherever the row happened to end, and because flavour and the footer
    // sat in rows of their own, the thing that got cut was the MECHANICS: a
    // player could read "Grey wood, warm at the grip." in full while
    // "Class power: +1 Potency" was sliced through the middle.
    //
    // Rows are now declared with a PRIORITY and a floor. Every region states
    // what it must never shrink below and how willingly it gives space up:
    // higher `priority` keeps its room longer, and `grow` says who absorbs the
    // slack when there is any. Nothing here is a magic constant in a
    // stylesheet — the numbers are data, and the face is composed from them.
    //
    // The ordering is the claim, and it is deliberate: what the item DOES
    // (bonuses) outranks what it IS (type, tags), which outranks what it is
    // LIKE (flavour). Flavour is lore and says so in its own tooltip; it is the
    // first thing to give up room and the first thing to ellipsis.
    equipmentCard: {
      // Face geometry. The frame lays out at this size and is then scaled to
      // whatever box it is dropped into, so these are design pixels, not
      // device pixels.
      frameWidthPx: 350,
      frameHeightPx: 490,
      paddingPx: 19,
      gapPx: 3,
      // Regions, in visual order. `minPx` is the floor; `priority` breaks ties
      // when there is not enough room; `grow` shares out anything left over.
      regions: {
        art:     { minPx: 270, priority: 7, grow: 0 },
        type:    { minPx: 22,  priority: 5, grow: 0 },
        facts:   { minPx: 40,  priority: 6, grow: 0 },
        tags:    { minPx: 18,  priority: 4, grow: 0 },
        effects: { minPx: 54,  priority: 7, grow: 2 },
        flavor:  { minPx: 18,  priority: 1, grow: 0 },
        footer:  { minPx: 16,  priority: 2, grow: 0 },
      },
      // Text sizing. Every face value is a clamp: it may shrink to `minPx` so a
      // long line stays on the card, and never grows past `maxPx` so a short
      // one does not shout. `idealCh` is the width the size is derived from, so
      // the type scales with the card rather than with the viewport.
      // `floorPx` is a PHYSICAL floor, and it is the one that matters on a
      // phone. The frame lays out at frameWidthPx and is then transform-scaled
      // into whatever box holds it, so a 13px line inside a face scaled to 0.6
      // reaches the glass at 7.8px. The floor is divided by that scale — the
      // same compensation the rest of the kit applies against `--ui-zoom` — so
      // authored type shrinks with the card only until it would stop being
      // readable, and then stops shrinking. The priority solver above is what
      // affords this: the regions that hold text now have room to take it.
      text: {
        name:    { minPx: 13, idealCh: 5.2, maxPx: 20, floorPx: 15 },
        type:    { minPx: 9,  idealCh: 2.9, maxPx: 11, floorPx: 10 },
        fact:    { minPx: 9,  idealCh: 2.7, maxPx: 10, floorPx: 10 },
        factValue: { minPx: 13, idealCh: 4.2, maxPx: 16, floorPx: 15 },
        tag:     { minPx: 9,  idealCh: 2.6, maxPx: 10, floorPx: 10 },
        heading: { minPx: 9,  idealCh: 2.6, maxPx: 10, floorPx: 10 },
        bonus:   { minPx: 11, idealCh: 3.4, maxPx: 13, floorPx: 13 },
        flavor:  { minPx: 10, idealCh: 3.1, maxPx: 12, floorPx: 11 },
        footer:  { minPx: 9,  idealCh: 2.6, maxPx: 10, floorPx: 10 },
      },
      // How many lines a single bonus may wrap to before it ellipsises. One
      // line was the old behaviour and it truncated real numbers mid-word.
      bonusMaxLines: 2,
      // The information button. It appears on the FIRST press of a card, not
      // the second: a control nobody can find is a control nobody uses. The
      // fade keeps it from snapping into place under the thumb. Its reveal
      // delay (wireframeUi.selection) and size (wireframeUi.inspect) are the
      // shared WCF3/WCB1 ones every card and combatant uses.
      info: { fadeMs: 120, insetPx: 6 },
    },
    tooltipPlacement: {
      hoverDelayMs: tooltipHelp.delays[tooltipHelp.settings.find(row => row.key === 'tooltipDelay').def],
      autoFadeMs: 5000,
      topBandViewportPct: 25,
      sideBandViewportPct: 30,
    },
    combatantInspector: {
      widthRem: 20,
      mobileWidthViewportPct: 62,
    },
    // Shrine options default to one vertical list. `grid` preserves the
    // horizontal wide-screen composition as an authored alternative; narrow
    // screens still collapse it to a list for touch and readable labels.
    shrinePresentation: {
      optionLayout: 'list', // list | grid
      // The six option faces share one folded footprint. Percentages own the
      // responsive size; the bounds preserve the interaction floor, keep a
      // wide monitor from turning a choice into a banner, and let the complete
      // collapsed menu fit before its body becomes a scrollport.
      foldedCardWidthViewportPct: 88,
      foldedCardMaxWidthRem: 44,
      foldedCardHeightViewportPct: 10,
      foldedCardMaxHeightRem: 6.5,
    },
    // Accent themes → --gold plus its rgb form (focus glow / halos).
    accents: {
      gold: { hex: '#c9a227', rgb: '201, 162, 39' },
      crimson: { hex: '#c1453a', rgb: '193, 69, 58' },
      frost: { hex: '#7fa8c9', rgb: '127, 168, 201' },
      verdant: { hex: '#8bae54', rgb: '139, 174, 84' },
      violet: { hex: '#a06cc8', rgb: '160, 108, 200' },
    },
    // UI size → whole-app zoom (--ui-zoom). 'Auto' flexes against the design
    // baseline below and is clamped so it never gets unusably tiny/huge.
    uiScale: {
      named: { s: 0.85, m: 1, l: 1.2, xl: 1.45 },
      designW: 1200,
      designH: 730,
      min: 0.62,
      max: 1.7,
      // PROTOTYPE (EldenSpire#23, track B). A SECOND design baseline, for the
      // narrow layout in styles/combat.css. #23 reads as a clamp bug — the
      // floor of 0.62 winning on every phone — and it is not: lowering the
      // floor to 0.325 fits a 1200px layout onto a 390px screen and gives you
      // glyphs you can read on a board you still cannot use. The wrong number
      // is the BASELINE, which says every screen is 1200x730. Auto picks
      // whichever of the two baselines wants the LARGER zoom, so nothing here
      // decides "is this a phone" — the fit does, and the floor stops binding
      // on its own without being touched.
      //
      // 430x780 is a portrait-phone board: at 390x844 it wants 0.907 (local
      // 430x930), at 412x915 0.958, at 360x640 0.821 (local 438x780).
      //
      // narrowMax is the viewport width, in visual px, at or below which the
      // narrow layout is used. Height may change the zoom, never this mode.
      //
      // It used to live in styles/combat.css as a container query. main.js now
      // owns the width decision and writes `data-layout` on <html>; the
      // stylesheets follow it and measure nothing. Height can change the zoom,
      // but cannot make a browser-chrome or keyboard resize flip the mode.
      narrowW: 430,
      narrowH: 780,
      narrowMax: 520,
      // The compact wide composition's rendered lower edge. Text XL is the
      // tallest cell: at 844x340 its complete HUD, combatants, cards, hint row
      // and action controls are on glass; at 844x339 at least one required
      // region crosses its owning row. Derived at one-pixel resolution by
      // tools/short-landscape-support.mjs before this value is consulted, so
      // moving the number without moving the rendered premise goes red.
      shortWideMinH: 340,
      // THE SHORT-WIDE BAND'S UPPER EDGE (src/main.js, #27). At or above this
      // viewport height, the established wide composition remains. Below it,
      // main.js selects the compact composition down through shortWideMinH;
      // only heights below that rendered floor are refused. Thus the complete
      // current answer is:
      //
      //   h >= 465                 standard wide composition
      //   340 <= h < 465           compact wide composition (when width fits)
      //   h < 340                  truthful upright/resize refusal
      //
      // IT IS A MEASUREMENT, NOT A TASTE, and it is in data because it is a
      // layout fact that will move when the board does.
      //
      // HISTORICAL PRE-#27 RECORD BELOW. It explains why 465 was originally
      // derived as the refusal threshold. #27 keeps that exact measured upper
      // edge but inserts a supported composition below it; statements below
      // about 368..464 being refused describe the former runtime, not today.
      //
      // THE MEASUREMENT IS A DERIVATION OVER AN ENUMERATED SET, AND SAYING THAT
      // OUT LOUD IS WHY THIS NUMBER SURVIVED HAVING ITS QUESTION CHANGED. It was
      // 432 on 2026-08-15 under a different predicate; the predicate was ruled
      // wrong on 2026-08-16 and the number was RE-RUN rather than re-investigated
      // — a threshold with a domain can be re-derived when the question changes,
      // a remembered one cannot.
      //
      // ===================================================================
      // WHAT IT ANSWERS TO: THE WALL (Marina, MR-142, 2026-08-16)
      // ===================================================================
      //
      // Two predicates were on the table and they name different sets of screens:
      //   `whole`   — all five required controls whole. A QUALITY question:
      //               is this screen good?
      //   the WALL  — `.end-turn` UNREACHABLE: not one pixel on glass and no
      //               gesture to it. A SAFETY question: can this player continue?
      // They part by 64-109 px at every text size (Vira, 2026-08-15). MARINA
      // RULED THE WALL, for three reasons and the third decides it alone:
      //   1. the gate's cost is TOTAL — it removes the shape and says rotate —
      //      and a total hammer should fire on a total condition;
      //   2. a refusal removes the player's choice, a degraded screen leaves it.
      //      At 67.3% of the hand a player can rotate, page or accept. Behind the
      //      gate they cannot opt out;
      //   3. `whole` CAN BE SATISFIED BY THE VERY INTERACTION THAT STRANDS THE
      //      PLAYER — one flask gesture at 844x390 scrolls `.combat` 162.9 px and
      //      takes the screen from 2/5 + UNREACHABLE to 5/5 + onscreen, carrying
      //      the topbar off the top with no gesture back. A refusal predicate the
      //      trap itself satisfies is the wrong question.
      //
      // ===================================================================
      // THE DERIVATION: max(wall h) + 1, NEVER min(good h) (MR-143)
      // ===================================================================
      //
      // Sunna, 2026-08-16, `?shot=combat`, wide layout, auto UI size, headless
      // Chromium at width 800, EXHAUSTIVE 1 px sweep of h 360..600 per text size
      // (964 cells), tree at HEAD `sunna/the-ladder-and-the-number`:
      //   `CHROME=/usr/bin/chromium node tools/uprightgate.mjs --ladder --ladder-from 360`
      //
      //   text size                 S     M     L     XL
      //   last WALLED h           367   394   423   464      <- the derivation
      //   max(wall)+1             368   395   424   465
      //   all five whole from     432   495   533   571      <- the COST column
      //
      //   THE XL WALL IS NOT AN INTERVAL: h 360..450 AND 464 (92 cells), with
      //   451..463 not walled at all. The auto-zoom steps 0.63 -> 0.64 at 464 and
      //   the board grows faster than the window, so END TURN goes 13.37% on
      //   screen at 460, 0% AT 464, 19.76% at 470. Found by Vira, 2026-08-15;
      //   re-derived here.
      //
      //   THE LOWER BOUND READ `390` UNTIL 2026-08-16 AND 390 WAS NEVER MEASURED
      //   — it is `--ladder-from`'s DEFAULT (uprightgate.mjs, `argOf(...) ?? 390`).
      //   A run that takes the default cannot see below its own floor, so the
      //   floor comes back in the output looking exactly like an edge. It printed
      //   as one, was copied here as one, and understated this wall by 30 cells.
      //   Re-measured from 360 (Bjorn, 2026-08-16): XL is walled at every swept
      //   cell from the floor to 450.
      //
      //   AND 360 IS THE NEW FLOOR, NOT A NEW EDGE. The wall's LOWER edge is
      //   still unestablished — at 360 all four text sizes are walled, so each
      //   run's bottom is the sweep's, not the board's. Writing `360` as though
      //   it were measured is the same mistake one floor down. IT DOES NOT
      //   MATTER TO THE NUMBER: the derivation is max(wall)+1 and needs only the
      //   wall's TOP edge, which is inside the sweep at every text size. That is
      //   why a wrong lower bound sat here harmlessly and why it still had to go
      //   — a bound that costs nothing today is read as measured tomorrow.
      //
      // 465 IS ONE PAST THE LAST WALL — max(368, 395, 424, 465). NOT the first
      // height that stops being a wall, WHICH WOULD BE 451 AND WOULD BE WRONG BY
      // FOURTEEN. `min(good)` is a monotonic idea and this ground is not
      // monotonic; I measured the non-monotonicity myself (97.13% at h 485, 94.4%
      // at 486), used it to justify sweeping exhaustively, and still derived with
      // `min(good)`. One past the last bad cell is the only form that survives a
      // hole, and the hole is real.
      //
      // AND I CHECKED THE SAME QUESTION AGAINST THE COST COLUMN, because a
      // corrected derivation that leaves its neighbour uncorrected is the same
      // defect at a new address: at all four text sizes `min(whole)` and
      // `max(not-whole)+1` COINCIDE (432/495/533/571 either way). The whole set
      // is contiguous above its first cell; the wall set is not. That is a
      // measurement, not an assumption, and it is why only one column moved.
      //
      // ===================================================================
      // THE COST OF ONE NUMBER, AND IT IS MINE (MR-142's division)
      // ===================================================================
      //
      // MAXIMUM, NOT MINIMUM, AND THE DIRECTION FLIPPED WITH THE PREDICATE.
      // Under `whole` the binding constraint was "refuse no working screen", so
      // the constant was the SMALLEST of the four. Under the wall it is COVERAGE
      // — a wall the gate does not stand on is a player who cannot end their turn
      // and is not told why — so it is the LARGEST. One number cannot serve both
      // ends of the dial, and it now serves the one where the player has no way
      // out.
      //
      // WHAT 465 BUYS: every wall at every text size is covered, including the
      // Text XL band 432..450 and the one-pixel wall at 464 that no shipped
      // instrument could see. THE XL CARD DOES NOT GET RE-CARDED, IT CLOSES.
      //
      // WHAT 465 COSTS, COUNTED — `--ladder` prints this table on every run:
      //   Text S : h 368..464 refused, NOT ONE OF THEM A WALL, and h 432..464
      //            (33 heights) are FULLY WHOLE — a perfect screen, refused.
      //            (This read `390..464` and carried THE SAME sweep-floor default
      //            as the XL wall above — one defect, two addresses, one comment
      //            block. 368 is max(wall)+1 at Text S and is floor-independent,
      //            which is why the M and L rows below were right all along.)
      //   Text M : h 395..464 refused and not walled.
      //   Text L : h 424..464 refused and not walled.
      //   h 451..463 refuses NOBODY at any text size — the gap the Text XL wall
      //   jumps, which a downward-closed threshold cannot jump with it.
      // A Text S player on a 800x440 window is refused a board that works. That
      // is the price of one number and it is stated here rather than discovered.
      //
      // THE OPTION I MEASURED AND DID NOT INSTALL, because the shape of the
      // threshold is a design ruling and not mine: a per-text-size TABLE on the
      // premise — {S 368, M 395, L 424, XL 465} — is better on BOTH edges at
      // once. It covers every wall AND refuses no reachable screen at any text
      // size except the 451..463 gap at XL. My Law 4 objection to a table
      // ("an accessibility setting that takes screens away as you turn it up")
      // was true of a table on `whole` and is FALSE of a table on the premise:
      // it refuses a large-text player only the heights where that player is
      // actually walled. Vira found the step I generalised over; the objection
      // was a property of the predicate, not of the shape. What it costs is the
      // thing the single number hides: at Text S a landscape phone is handed a
      // board with 67.3% of the hand and 86.4% of the orb, both CLIPPED WITH NO
      // SCROLL PATH, and nothing refuses it. Whether that board is playable is a
      // player-experience finding and it is filed with this act.
      //
      // Re-derive with `node tools/uprightgate.mjs --ladder --ladder-from 360` —
      // it sweeps every cell at 1 px and goes red BOTH ways: a constant at or
      // below the last wall (LEAVES A WALL UNGATED — what 432 was) and one above
      // it (REFUSES ABOVE ITS OWN PREMISE). `node tools/uprightgate.mjs
      // --predicates` is the standing check that every wall has a gate on it, and
      // `--text S` is the standing check on what this number costs.
      gateBelowH: 465,
      // THE HUD FORM FACTOR (docs/hud-layout-tokens.md). applyUiScale writes
      // <html data-form-factor> from these, in the window's CSS px, so the
      // combat HUD picks content/hud-layout/<form-factor>.json. First match
      // wins: widescreen (w / h >= widescreenMinAspect, or w >=
      // widescreenMinWidth), mobile (w <= mobileMaxWidth), tablet (w <=
      // tabletMaxWidth), else desktop. It chooses styling only — never the
      // layout mode, the zoom or the gate above.
      formFactor: {
        widescreenMinAspect: 2.0,
        widescreenAspectMinWidth: 1600,
        widescreenMinWidth: 2400,
        mobileMaxWidth: 600,
        tabletMaxWidth: 1100,
      },
    },
    // Text size → root font-size %. Auto owns the browser stylesheet baseline;
    // M remains a legacy data alias for old saves and geometry tools. It scales
    // readable type and line metrics; component and sprite geometry is separate.
    textSize: { S: '56.25%', M: '62.5%', L: '68.75%', XL: '75%' },
    // MINIMUM TAP SIZE (Settings → Accessibility). THE ONE HOME OF THE 44.
    //
    // It used to be the literal `44px` inside `--tap-floor` in styles/base.css.
    // Constantine: "just make the tabs about 20% smaller or the size
    // configurable or scalable with UI or both" — and then, on the 44 floor,
    // "actually, I think it should be able to go smaller than 44px." Sunna
    // measured why the second half of the first sentence could never answer
    // him: `calc(44px / var(--ui-zoom))` under `body { zoom }` renders
    // 44 x zoom / zoom, so the floored controls are the one part of the
    // interface UI size cannot reach — 44.00 device px in all 20 UI-size x
    // shape cells, zero variance. So it is configurable, and this is the data.
    //
    // `sizes` IS THE CLOSED SET, largest first — that order is the order the
    // chips draw in and the order the row reads. The settings row derives its
    // `choices` and its `def` from here; nothing restates them.
    //
    // `missRate` is what the RESEARCH says, and ONLY where it says anything.
    // Two points exist: WCAG 2.1 AAA (SC 2.5.5) is 44x44 CSS px, WCAG 2.2 AA
    // (SC 2.5.8) is 24x24. 36 and 30 sit between them and carry no entry ON
    // PURPOSE — an interpolated statistic is a fabricated one, and the cost
    // line below 44 says less about them rather than inventing a number
    // (Sunna's ruling; Law 0 clause 5 is the same sentence about derivation).
    //
    // ADDING A FIFTH SIZE IS A ROW HERE AND NOTHING ELSE: it appears as a chip,
    // it applies, and it gets a cost line with no percentage unless someone
    // adds one. Removing `missRate` for a size removes the percentage and keeps
    // the sentence. That is the falsifier for Law 0 on this control.
    tapSize: {
      def: 44,
      sizes: [44, 36, 30, 24],
      missRate: { 44: '1 in 30', 24: '1 tap in 7' },
    },
    // HOLD TO CONFIRM (Settings → Advanced). THE ONE HOME OF THE DURATIONS.
    //
    // WHAT IT IS FOR, and the number that made it necessary. The event screen's
    // three choice bars are 44/44/44 across sixteen cells — the size is fixed
    // and it did not help, because THE GAPS ARE 9-9.7 px at every dial setting
    // and nothing in this game reads a gap. Targets grow, the space between
    // them does not, so a thumb that lands 9 px low lands on the NEIGHBOUR —
    // and on this screen the neighbour is "permanent curse", with no confirm
    // and no undo. Constantine, asked: "yes press and hold".
    //
    // WHY BOTH FORMS SHIP. A short activation opens the shared review modal so
    // the player sees the exact result and optional cost. A deliberate hold
    // fills on the original control and commits without the modal for players
    // who already know the result. Releasing the hold early remains an abort.
    //
    // `steps` IS THE CLOSED SET, in dial order, and `off` is first because it
    // is the A/B — the same "let me try each and decide" he asked for on the
    // map. The Advanced row derives its `choices` and its `def` from these keys
    // and nothing restates them; ADDING A FIFTH SPEED IS A ROW HERE AND NOTHING
    // ELSE. That is the falsifier for Law 0 on this control, and it is the same
    // sentence tapSize above already ships.
    //
    // `normal` is the default: state-changing option controls now use a short
    // press to review and a deliberate hold to approve without the modal.
    // 600 ms sits just past the familiar ~400-500 ms long-press threshold
    // ms (Android's own threshold) and a CONFIRM wants to sit just past reflex
    // without becoming a chore. `short` is for players who find the wait
    // irritating, `long` for hands that need the room. `off` is 0 and disables
    // only the shortcut; the short activation still opens the review modal.
    // THE VICTORY BEAT (Constantine's review, 2026-09-11): when the last enemy
    // falls, the fight's title stands over the battlefield for this long
    // before the spoils door opens — a breath between the blow and the loot.
    // Reduced motion skips it entirely (ui/components/victoryBeat.js).
    victoryBeat: { ms: 600 },
    holdConfirm: {
      def: 'normal',
      steps: { off: 0, short: 350, normal: 600, long: 1000 },
      // THE SETTLE WINDOW — A PRESS IS NOT A HOLD UNTIL IT HAS STAYED PUT.
      //
      // The fill used to arm on `pointerdown` and only cancel once the finger
      // passed the slop. On any surface that also drags — the map camera, the
      // Armoury tray, an inventory card you can drag — that meant every drag
      // began with a hold animation flashing and dying under the thumb. The
      // gesture was correct and the feedback was a lie.
      //
      // Nothing is dressed, painted or announced until the pointer has held
      // still inside the slop for `settleMs`. Move first and this press is a
      // drag: the hold never existed, so it has nothing to take back.
      //
      // `settleMs` is time BEFORE the hold, and the hold's own duration starts
      // when the settle ends — a `long` hold on a dragging surface is
      // 1000 + 1000. That ordering is deliberate: the fill should represent the
      // whole of the commitment, not resume a bar that already crept while the
      // player was deciding whether to scroll. Setting `settleMs: 0` restores
      // the old immediate arm exactly, and a surface may override it per call.
      //
      // WHY IT IS NOT ON EVERY CONTROL. A control with no drag beneath it has
      // nothing to disambiguate, and a safety beat that waits a second before
      // it even begins to look like it is working reads as a broken button.
      // `settleMs` is opt-in per call site; `dragSettleMs` is the value those
      // sites use so the delay is authored once rather than eleven times.
      dragSettleMs: 1000,
      // How far the finger may drift during the settle and still be judged
      // still. Kept apart from the hold's own slop so "did they mean to drag"
      // and "did they wander off mid-hold" can be tuned independently.
      settleSlopPx: 8,
    },
    // TITLE SAVE SLOT QUICK LOAD. This is a pointer/touch convenience gesture,
    // not the irreversible-action safety dial above: a short activation still
    // selects/reviews the save, while a stationary hold loads it directly.
    // Keeping the duration here lets the interaction be tuned without changing
    // the title screen's event wiring.
    titleLoadHold: {
      ms: 600,
    },
    // THE HOLD'S BEAT — WHERE IN THE FILL A SOUND LANDS. One home for the
    // fractions; the sounds themselves are recipes in content/sfx.js and the
    // durations are holdConfirm above. Three facts, three homes, none restated.
    //
    // WHY THE HOLD NEEDS ONE AT ALL, and it is a measurement rather than a
    // taste. The fill is the only feedback the hold has, and on the event
    // screen it works: the bar is 378x44 at 390x844 and a thumb covers a
    // fraction of it. END TURN IS 190.2x50.4 AT y=784.6 OF AN 844 px VIEWPORT
    // — a control roughly the size of the contact patch, in the bottom 60 px,
    // approached from below. The hand that presses it is on top of the only
    // thing telling the player the press was received. A hold with no beat is
    // then indistinguishable from a tap that did not register, and the player
    // presses again — so the guard fires the thing twice.
    //
    // `at` IS THE CLOSED SET, as fractions of the fill, ascending, and 1.0 is
    // NOT in it: the arrival is `holdCommit`, a different sound with a
    // different job, and putting it here would give the landing two homes.
    //
    // THE SPACING IS THE MESSAGE, not decoration. The gaps shorten (0.42,
    // 0.36, 0.22) so the train ACCELERATES toward the commit: a player hears
    // "approaching" without counting anything, and an abort at 0.5 has heard a
    // train that was speeding up and then stopped, which is the true sentence
    // about what happened. An evenly spaced train is a metronome, and a
    // metronome says only "time is passing".
    //
    // ACCELERATION AND NOT PITCH, which is a composition decision with a
    // maintenance reason. A rising train would need one recipe per tick
    // (`holdTick_1..3`), and the day someone adds a fourth fraction here the
    // fourth tick has no row and the rise breaks — the row edit this comment
    // promises would stop being enough. Identical ticks getting closer
    // together is the same signal, and a fourth fraction just works.
    //
    // WHY THREE. One tick cannot rise. Two can, barely. Four plus a commit is
    // five sounds on every confirmation and this fires many times a run — the
    // cost of a charming sound is paid at hold #200, not hold #1. Three is the
    // fewest that reads as a gesture. TUNING IS THIS ROW: an empty array is
    // legal and means the ticks are off with the commit intact.
    //
    // The first tick is at 0.00 on purpose — it is the "pressed" report, and a
    // report that arrives at 180 ms has already let the player wonder.
    holdBeat: {
      at: [0, 0.42, 0.78],
    },
    // HOLD TO INSPECT (the hand). THE ONE HOME OF THE DURATION.
    //
    // Constantine, 2026-08-08: press-and-hold a card and it "expands" and comes
    // "in front". This is the gesture half of that ask; the layout half (how
    // the hand itself is arranged) is HELD on C2 and no number for it lives
    // here or anywhere.
    //
    // WHY THIS IS NOT holdConfirm's DIAL, though both are a stationary press
    // with a timer. Two different jobs (Law 4's shape, applied to time): the
    // confirm hold is a SHORTCUT around the review modal — its length is a
    // protection preference, and `off` means "review only". The inspect
    // hold is how a player READS a card — turning the safety dial off must not
    // take reading away, and a hand that needs a longer confirm does not
    // thereby need slower reading. One dial answering both would break the
    // weaker job the day anyone tunes the stronger one.
    //
    // 400 ms: the bottom of the long-press convention players already know
    // (Android's own threshold is ~400-500), BELOW the confirm's 600 default
    // because reading is cheaper than committing and fires far more often —
    // and above any tap: the slow edge of a deliberate tap is ~250 ms, and a
    // stationary press that outlives 400 was not going to become one. The
    // known cost, stated rather than hidden: a tap slower than this becomes an
    // inspect, whose release then does nothing — the card visibly expanding IS
    // the feedback that says why. `ms: 0` is the off position: no inspect,
    // pre-gesture behaviour byte for byte.
    inspectHold: {
      ms: 400,
    },
    // REWARD COLLECTION (E11, #256). THE ONE HOME OF THE WORD.
    //
    // Constantine, 2026-08-15 (the E11 card): Continue on the reward menu is
    // ALWAYS pressable and a setting decides what it means — "auto-collect ON
    // takes everything, picking at random where there is a choice; OFF gives
    // only what was chosen, no nagging".
    //
    // Manual collection is the default; stored preferences can still select auto.
    rewardCollect: {
      def: 'manual',
      modes: ['auto', 'manual'],
    },
    // HAND LAYOUT (C2). THE ONE HOME OF THE WORD.
    //
    // Constantine, 2026-08-13: "overlap and paging (maybe a toggleable
    // feature)" — BOTH modes, one knob. His "maybe" hedges the TOGGLE, not the
    // modes (directions.md D19), so both modes exist now behind this word and
    // the player-facing control waits for his eye on a picture. No Settings row
    // derives from this yet, on purpose — adding one later is a data edit in
    // settings.js, not a redesign.
    //
    // 'paging' names the SHIPPED narrow hand: the horizontal card strip
    // (styles/combat.css, the narrow reflow) — F1 of the approved hybrid.
    // Selecting it changes nothing, byte for byte; it is the default because
    // the shipped behaviour keeps its seat until his picture says otherwise.
    //
    // 'overlap' lays the whole hand inside the strip's width: each card
    // overlapped by the next, the overlap DERIVED per render from hand size
    // and measured width (renderHand, combat.js) — no number for it lives
    // here or anywhere, which is why this row is a word and not a px value.
    //
    // The renderer derives from this word alone (via data-hand-layout on
    // <html>, written by applyDisplaySettings beside cardMotif's attribute).
    // A stored settings.handLayout outside `handLayoutModes` lands on this
    // default and says so in the debug log; a garbage value HERE fails loud
    // in model/validate.js — the two halves of "validated loud, garbage lands
    // on default".
    handLayout: 'paging',
    handLayoutModes: ['paging', 'overlap'],
    // Sprite display tiers an enemy def's `size` selects. px-magnitude; the
    // renderer emits them as rem (÷10).
    spriteTiers: {
      small: { w: 92, h: 128, font: 44 },
      medium: { w: 132, h: 168, font: 58 },
      large: { w: 194, h: 206, font: 78 },
    },
    // How many act backdrop plates exist (assets/bg/bg_act*.webp). Endless acts
    // past this cycle back through them.
    backdropActs: 3,
    // How many map-parchment plates exist (assets/map/parchment_act*.webp) — the
    // undiscovered ground the fog map draws on. Same rule as backdropActs, its
    // own row because the two sets are authored separately and one may grow
    // first. A row, so a fourth plate is a file plus this number and no code.
    parchmentActs: 3,
    // Card colour motif (Settings → Display). Cards carry two independent
    // colour axes: the owning class (each class def's cardTint) and the
    // player's accent. `cardMotif` picks how the class one is expressed;
    // `cardMotifStrength` is the wash depth for each choice.
    // Card TYPE presentation. Geometry carries the type (attack squarest,
    // power roundest, skill between) and each type owns its banner colour.
    // label is display-only — the engine keys on the id (CARD_TYPES is frozen
    // and the Bulwark stance matches 'skill'), so renaming here is safe.
    cardTypes: {
      stance: { label: 'STANCE', color: '#c9502e', radius: 3, art: 0 },
      consumable: { label: 'CONSUMABLE', color: '#7fa8c9', radius: 10, art: 6 },
      attack: { label: 'ATTACK', color: '#c9502e', radius: 3, art: 0 },
      skill: { label: 'SKILL', color: '#7fa8c9', radius: 10, art: 6 },
      power: { label: 'POWER', color: '#c9a227', radius: 20, art: 16 },
      curse: { label: 'CURSE', color: '#6a3a7a', radius: 10, art: 6 },
      status: { label: 'STATUS', color: '#7a6f5a', radius: 10, art: 6 },
    },
    cardMotif: 'wash',
    cardMotifModes: ['off', 'wash', 'accent', 'band'],
    cardMotifStrength: { subtle: 0.06, normal: 0.10, strong: 0.17 },
    // Default audio levels for a profile that has never touched the sliders.
    // Music ships at 50, deliberately under SFX's 75: the score is ambience,
    // the SFX are information, and the hit-confirm must read over any swell.
    // The beds carry their own gain staging on top of this bus (music.js,
    // gains 0.34–0.6), so 50 is clearly audible from first boot without
    // crowding the feedback layer.
    audio: { musicEnabled: true, musicVolume: 50, sfxVolume: 75 },
  },

  costs: balanceCosts,
  classTree: balanceClassTree,
  powers: balancePowers,
  sigils: balanceSigils,
  equipment: balanceEquipment,
  progressionFeats: balanceProgressionFeats,


};
