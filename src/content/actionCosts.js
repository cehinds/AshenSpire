// src/content/actionCosts.js — the action-cost tunables (owner decision, 2026-10-12).
//
// Every number a card's or an enemy move's Stamina/SP cost reads, and the balance rule for 2-cost cards,
// lives here. src/model/actionCosts.js validates the table and derives the costs; this file is data only.
//
// "Action costs apply to everyone, player and enemies: attack 1 SP, defend/block 1 SP, smash 2, counter 2,
// cast/spell 2, sweep 2." Attacking and defending usually cost 1; the 2-cost stances are the buffed ones.
//
// The stance names are the timeline stances of combatRoundsAdapter.js (`stanceFor`), plus `cast` for a
// spell or a casting maneuver. A stance that is not in this table (evade: the dodge keeps its weight-class
// price) keeps the authored cost of the card or move.

// SP cost per stance. Integers, 0 or more. A card's derived cost is this number plus its authored upgrade
// delta (see model/actionCosts.js), then the live relic and discount rules apply on top.
export const ACTION_COST_TABLE = Object.freeze({
  attack: 1,
  block: 1,
  smash: 2,
  counter: 2,
  cast: 2,
  sweep: 2,
});

// Enemy SP per turn (owner decision, 2026-10-12: configurable, default 2; enemies spend until the pool is empty).
// A per-enemy override is a `spPool` field on the enemy's content definition.
export const ENEMY_SP_POOL = 2;

// PROVISIONAL DEFAULT, OWNER TO TUNE (owner decision, 2026-10-12): a card whose derived cost is 2 has its
// numeric effect amounts (SCALED_EFFECT_OPS) multiplied by this and rounded to a whole number. A card whose derived
// cost is 1 keeps its base values, so a cost-1 card is the weaker option.
export const TWO_COST_EFFECT_MULTIPLIER = 1.8;

// The effect ops whose `amount` scales with a 2-cost card. Costs, card counts (draw, discard, addCard), turns and
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
