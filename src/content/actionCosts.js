// src/content/actionCosts.js — the action-cost tunables (owner decisions, 2026-10-12).
//
// Every number a card's Stamina (SP) and Mana (MP) cost reads, and every number an enemy move's SP and an enemy's SP
// pool read, lives here. src/model/actionCosts.js validates these tables and derives the costs; this file is data only.
// docs/alternative-combat-rounds/COST-WEIGHTS.md gives the reason for every weight, and
// tests/action-costs-weights-doc.test.mjs fails when the doc and this file disagree.
//
// PLAYER CARDS (owner, 2026-10-12, SPEC §4.3a). Each resource is priced on its own side:
//   S_sp = damageWeight × physical damage + rankWeight × rank + Σ SP-side tag weights × stacks + range weight
//          + castingEffort (cast cards) + restoreWeight × Mana restored + drawback weights (negative)
//   S_mp = damageWeight × magical damage + rankWeightMp × rank (magical cards) + Σ MP-side tag weights × stacks
//          + restoreWeight × Stamina restored
//   SP = floor(S_sp / spDivisor) − Stamina restored, MP = floor(S_mp / mpDivisor) − Mana restored, each at least 0.
//   If both are 0, the larger side pays 1 (SP on a tie); a Mana-restoring card pays SP.
// Opt-outs keep the authored cost and numbers: costRule 'fixed', curses and statuses (by type), and X costs.
//
// ENEMIES (owner, 2026-10-13, SPEC §4.6a). An enemy's SP pool is its stats: ENEMY_SP_ROW read on its `attributes`
// (shifted by ENEMY_BLIGHT_SHIFT when it is `blighted`), plus its `equipmentSp`. A move's SP is its own `sp`, else the
// stance price below.

// ---- Player cards: the budget tunables -------------------------------------------------------------------------
export const COST_BUDGET = Object.freeze({
  spDivisor: 6,           // D: S_sp points per Stamina (the owner's ruling, 2026-10-12: "use D as 6")
  mpDivisor: 8,           // P: S_mp points per Mana (raised from 6: at 6, rank 1-3 spells and rank 1-2 cards miss 80%)
  damageWeight: 1.5,      // points per damage step reached (damageSteps); raw damage would swamp the tags
  damageSteps: Object.freeze([1, 3, 5, 8, 12]), // damage thresholds (hits counted); empty = linear damage × damageWeight
  rankWeight: 1,          // points per rank above the base (a base card, rank 0, adds nothing); SP side
  rankWeightMp: 4,        // points per rank on the MP side of a magical card (owner, 2026-10-12: rank counts on the Mana side too)
  castingEffortWeight: 6, // points on any cast card (camp:spell or maneuver:casting); SP side
  restoreWeight: 1,       // points per Mana restored (SP side) or Stamina restored (MP side)
  smashPoiseBase: 3,      // Poise damage every smash adds to its own (owner, 2026-10-13: "All smashes deal poise damage")
  twoCostMultiplier: 1.8, // a card whose derived SP is 2 or more multiplies its effect amounts by this
});

// Combat tag weights (-3..3) and the side each counts on. A tag counts once per card at its weight. A tag the card
// does not carry, or that this table does not list, adds nothing. Range tags are priced by RANGE_WEIGHTS instead.
export const COST_TAGS = Object.freeze({
  // Damage types
  'damage:slashing': { weight: 2, side: 'sp' },
  'damage:piercing': { weight: 2, side: 'sp' },
  'damage:blunt': { weight: 2, side: 'sp' },
  'damage:fire': { weight: 0, side: 'mp' },
  'damage:frost': { weight: 0, side: 'mp' },
  'damage:lightning': { weight: 0, side: 'mp' },
  'damage:arcane': { weight: 0, side: 'mp' },
  'damage:sacred': { weight: 0, side: 'mp' },
  'damage:decay': { weight: 0, side: 'mp' },
  'damage:poison': { weight: 2, side: 'sp' },
  'damage:psychic': { weight: 0, side: 'mp' },
  'damage:earth': { weight: 0, side: 'mp' },
  // Camps and sources
  'camp:physical': { weight: 2, side: 'sp' },
  'camp:spell': { weight: 1, side: 'mp' },
  'source:weapon': { weight: 0, side: 'sp' },
  'source:spell': { weight: 0, side: 'mp' },
  'source:unarmed': { weight: 0, side: 'sp' },
  // Maneuvers
  'maneuver:attack': { weight: 0, side: 'sp' },
  'maneuver:defend': { weight: 0, side: 'sp' },
  'maneuver:ranged': { weight: 0, side: 'sp' },
  'maneuver:counter': { weight: 0, side: 'sp' },
  'maneuver:smash': { weight: 0, side: 'sp' },
  'maneuver:sweep': { weight: 0, side: 'sp' },
  'maneuver:casting': { weight: 0, side: 'mp' },
  'counter:melee': { weight: 0, side: 'sp' },
  'counter:ranged': { weight: 1, side: 'sp' },
  'counter:spell': { weight: 1, side: 'mp' },
  // Targeting
  'targeting:single': { weight: 0, side: 'sp' },
  'targeting:area': { weight: 2, side: 'sp' },
  'targeting.self': { weight: 0, side: 'sp' },
  'targeting.enemy': { weight: 0, side: 'sp' },
  'targeting.ally': { weight: 0, side: 'sp' },
  'targeting.randomEnemy': { weight: 1, side: 'sp' },
  'targeting.allEnemies': { weight: 2, side: 'sp' },
  // Magic schools
  'school:fire': { weight: 1, side: 'mp' },
  'school:frost': { weight: 1, side: 'mp' },
  'school:lightning': { weight: 1, side: 'mp' },
  'school:force': { weight: 1, side: 'mp' },
  'school:alteration': { weight: 1, side: 'mp' },
  'school:illusion': { weight: 1, side: 'mp' },
  'school:divine': { weight: 1, side: 'mp' },
  'school:decay': { weight: 1, side: 'mp' },
  'school:earth': { weight: 1, side: 'mp' },
  // Weapon and theme chips (card domain)
  blade: { weight: 1, side: 'sp' },
  heavy: { weight: 0, side: 'sp' },
  pierce: { weight: 1, side: 'sp' },
  precision: { weight: 1, side: 'sp' },
  guard: { weight: 0, side: 'sp' },
  bow: { weight: 0, side: 'sp' },
  ranged: { weight: 0, side: 'sp' },
  flourish: { weight: 0, side: 'sp' },
  guile: { weight: 0, side: 'sp' },
  venom: { weight: 0, side: 'sp' },
  blood: { weight: 0, side: 'sp' },
  gorefire: { weight: 0, side: 'sp' },
  oath: { weight: 0, side: 'sp' },
  ash: { weight: 0, side: 'sp' },
  basic: { weight: 0, side: 'sp' },
  extractable: { weight: 0, side: 'sp' },
  starstone: { weight: 0, side: 'sp' },
  ritual: { weight: 0, side: 'sp' },
  blight: { weight: 0, side: 'sp' },
  // Techniques
  'technique:heavy': { weight: 0, side: 'sp' },
  'technique:cleave': { weight: 1, side: 'sp' },
  'technique:precision': { weight: 1, side: 'sp' },
  'technique:counter': { weight: 1, side: 'sp' },
  'technique:flourish': { weight: 0, side: 'sp' },
  // Traits
  'trait:adequateReach': { weight: 0, side: 'sp' },
  'trait:closing': { weight: 1, side: 'sp' },
  'trait:conductive': { weight: 0, side: 'sp' },
  'trait:grounded': { weight: 1, side: 'sp' },
  'trait:insulated': { weight: 0, side: 'sp' },
  'trait:mental': { weight: 0, side: 'sp' },
  'trait:projectile': { weight: 0, side: 'sp' },
  'trait:reveal': { weight: 0, side: 'sp' },
  'trait:shattering': { weight: 1, side: 'sp' },
  'trait:unavoidable': { weight: 1, side: 'sp' },
  'trait:unreflectable': { weight: 1, side: 'sp' },
  // Reaction rules version 2 traits (docs/combat-card-traits-contract.md). Combat adds them after the cost is derived
  // (engine/combatExpansion.js applyCardTraits), so today these weights price no shipped card.
  'trait:counterstrike': { weight: 1, side: 'sp' },
  'trait:impact': { weight: 1, side: 'sp' },
  'trait:flux': { weight: 1, side: 'sp' },
  'trait:reaction': { weight: 0, side: 'sp' },
  // Keywords
  'lifecycle.retain': { weight: 1, side: 'sp' },
  'lifecycle.innate': { weight: 1, side: 'sp' },
  'lifecycle.ethereal': { weight: -1, side: 'sp' },
  'lifecycle.recall': { weight: 1, side: 'sp' },
  'lifecycle.recall.afterUse': { weight: 1, side: 'sp' },
  'lifecycle.recall.afterTurnDraw': { weight: 1, side: 'sp' },
  'lifecycle.recall.afterCardPlay': { weight: 1, side: 'sp' },
  'lifecycle.seal': { weight: 0, side: 'sp' },
  // Drawbacks (owner, 2026-10-12: negative weights). Read from the card's keywords and effects (DRAWBACK_SOURCES).
  'lifecycle.exhaust': { weight: -1, side: 'sp' },
  'drawback:selfDeck': { weight: -2, side: 'sp' },
  'drawback:hpCost': { weight: -2, side: 'sp' },
  'drawback:discard': { weight: -1, side: 'sp' },
  'drawback:delayed': { weight: -1, side: 'sp' },
});

// Where a card's drawback and keyword tags come from: a keyword it carries, or an effect it makes the player pay.
export const KEYWORD_TAGS = Object.freeze({
  exhaust: 'lifecycle.exhaust',
  retain: 'lifecycle.retain',
  innate: 'lifecycle.innate',
  ethereal: 'lifecycle.ethereal',
});
// Keyword tags that are drawbacks (owner, 2026-10-12): they may weigh below 0.
export const DRAWBACK_KEYWORD_TAGS = Object.freeze(['lifecycle.exhaust', 'lifecycle.ethereal']);
export const DRAWBACK_OPS = Object.freeze({
  loseHp: 'drawback:hpCost',       // an HP (or other resource) cost
  discard: 'drawback:discard',     // a discard the player pays
  grantCardCharge: 'drawback:delayed', // takes several turns to cast (a charge the player builds first)
  addCard: 'drawback:selfDeck',    // a curse or status added to the player's own piles
});

// Range weights (owner, 2026-10-12: melee 1, reach 2, ranged 3). A card takes the largest range it carries. SP side.
export const RANGE_WEIGHTS = Object.freeze({ melee: 1, reach: 2, ranged: 3 });
export const RANGE_TAGS = Object.freeze({
  'delivery:melee': 'melee',
  'range:melee': 'melee',
  'range:reach': 'reach',
  'delivery:area': 'reach',
  'range:ranged': 'ranged',
  'delivery:projectile': 'ranged',
  'maneuver:ranged': 'ranged',
});

// Tags that mark a cast (the casting-effort weight).
export const CAST_TAGS = Object.freeze(['camp:spell', 'maneuver:casting']);

// Statuses the card applies (applyStatus or buildup): weight × stacks (a buildup counts as 1 stack). Every status weighs
// 2 or more (owner). A status counts on the card's side: MP on a card with any MP-side tag, else SP.
export const STATUS_WEIGHT = 2;
export const STATUS_WEIGHTS = Object.freeze({});
// Stacks above this count as this many; null counts every stack (owner, 2026-10-12: status stacks count).
export const STATUS_STACK_CAP = null;

// The effect ops that restore Stamina (priced on the MP side) and Mana (priced on the SP side).
export const RESTORE_STAMINA_OPS = Object.freeze(['gainEnergy']);
export const RESTORE_MANA_OPS = Object.freeze(['restoreMana']);

// The maneuver floor (owner, 2026-10-13: "basic ones are 2sp"): at rank 0 a card with this tag costs at least this SP.
// A higher rank has no floor ("some higher rank ones could cost 1 sp"); an authored upgrade that lowers the cost lowers
// the floor by as much.
export const MANEUVER_SP_FLOORS = Object.freeze({ 'maneuver:smash': 2, 'maneuver:sweep': 2 });

// A sweep pays for its area, so these ops stay unscaled on a 2-SP sweep (owner, 2026-10-13: "AoE for sweeps but normal
// damage"); its other riders (Block, buildup, Poise) scale.
export const SWEEP_UNSCALED_OPS = Object.freeze(['damage']);

// The effect ops whose `amount` scales on a 2-SP card. Costs, card counts (draw, discard, addCard), turns and
// durations (applyStatus.duration), stack counts and hit counts are never scaled.
export const SCALED_EFFECT_OPS = Object.freeze([
  'damage',
  'block',
  'buildup',
  'heal',
  'gainBarrier',
  'gainPoise',
  'gainWard',
  'poiseDamage',
  'wardDamage',
]);
export const TWO_COST_EFFECT_MULTIPLIER = COST_BUDGET.twoCostMultiplier;

// ---- Enemies ---------------------------------------------------------------------------------------------------
// The enemy SP row (owner, 2026-10-13: "enemies are essentially characters with cards, at about 2 SP"; minions usually
// 1-2 SP, elites 2-3, bosses 3-4, all from stats and equipment). SP = base + Σ floor(attribute × weight) + equipmentSp,
// each attribute term floored on its own. Enemy attributes are inflated next to a player's 1-4.
export const ENEMY_SP_ROW = Object.freeze({ base: 1, dexterity: 0.25, constitution: 0.25, wisdom: 0.2, intelligence: 0.2 });
// The SP band an enemy's pool (normal, elite, boss) must land in; a test holds every enemy to it.
export const ENEMY_SP_BANDS = Object.freeze({ normal: Object.freeze([1, 2]), elite: Object.freeze([2, 3]), boss: Object.freeze([3, 4]) });
// Blight (owner, 2026-10-13): "blight lowers INT, WIS and DEX and raises STR and CON". A `blighted` enemy's attributes
// shift by these amounts (floored at 0) wherever its stats are read.
export const ENEMY_BLIGHT_SHIFT = Object.freeze({ intelligence: -2, wisdom: -2, dexterity: -2, strength: 2, constitution: 2 });

// SP per stance for an enemy move that does not name its own `sp`.
export const ACTION_COST_TABLE = Object.freeze({
  attack: 1,
  block: 1,
  smash: 2,
  counter: 2,
  cast: 2,
  sweep: 2,
});
