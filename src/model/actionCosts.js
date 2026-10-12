// src/model/actionCosts.js — the action-cost rules (owner decision, 2026-10-12; SPEC §4 Action costs).
//
// Pure model: the table in content/actionCosts.js goes in, validated, and every card and enemy move is classified
// under one stance and priced from it. registries.resolveCard calls applyActionCosts as its last step, so the hand,
// the affordability check, the rounds queue, the reactions and the framework cost profile all read one derived cost.
//
// Layering for a card (first match wins at each step):
//   1. A fixed-cost card keeps its authored cost and numbers: `costRule: 'fixed'` (explicit opt-out in content),
//      a curse or a status, or a cost that is not a number (X).
//   2. A stance the table does not price (evade: the weight-class dodge) keeps its authored cost.
//   3. Otherwise the cost is the table price for the stance, plus the authored upgrade delta (upgraded cost minus
//      base cost), floored at 0. Relic and discount rules still apply on top, in the engine, as before.
//   4. A derived cost of 2 scales the card's effect amounts (SCALED_EFFECT_OPS) by TWO_COST_EFFECT_MULTIPLIER.
// Mana is never derived.
import { ACTION_COST_TABLE, SCALED_EFFECT_OPS, TWO_COST_EFFECT_MULTIPLIER, ENEMY_SP_POOL } from '../content/actionCosts.js';
import { combatProfileFor } from './combatCardProfile.js';
import { playerKind, stanceFor } from '../engine/combatRounds/stance.js';

export const ACTION_STANCES = Object.freeze(['attack', 'block', 'smash', 'counter', 'cast', 'sweep']);
const FIXED_TYPES = Object.freeze(['status', 'curse']);
const TWO = 2;

validateActionCostTable(ACTION_COST_TABLE);

/** Refuses a table that is missing a stance, or has a price that is not a whole number of SP, by name. */
export function validateActionCostTable(table = ACTION_COST_TABLE) {
  if (!table || typeof table !== 'object') throw new TypeError('actionCosts: the cost table must be an object');
  for (const stance of ACTION_STANCES) {
    if (!Object.hasOwn(table, stance)) throw new TypeError(`actionCosts: the cost table has no price for stance "${stance}"`);
    const price = table[stance];
    if (!Number.isInteger(price) || price < 0) throw new TypeError(`actionCosts: ${stance} costs ${price}; a price is a whole number of SP, 0 or more`);
  }
  for (const key of Object.keys(table)) {
    if (!ACTION_STANCES.includes(key)) throw new TypeError(`actionCosts: unknown stance "${key}" in the cost table`);
  }
  return table;
}

/** The SP price of a stance, or null when the table does not price it. */
export function stanceCost(stance, table = ACTION_COST_TABLE) {
  if (!stance || !Object.hasOwn(table, stance)) return null;
  return table[stance];
}

/**
 * The stance of an action from its timeline kind and tags. A spell or a casting maneuver is a cast whatever its
 * kind; a maneuver tag names its stance before the kind does; otherwise the kind decides (stanceFor).
 */
export function actionStance({ kind = 'other', tags = [] } = {}) {
  const list = Array.isArray(tags) ? tags : [];
  if (list.includes('camp:spell') || list.includes('maneuver:casting')) return 'cast';
  if (list.includes('maneuver:smash')) return 'smash';
  if (list.includes('maneuver:sweep')) return 'sweep';
  if (list.includes('maneuver:counter')) return 'counter';
  if (list.includes('maneuver:defend')) return 'block';
  if (list.includes('maneuver:attack') || list.includes('maneuver:ranged')) return 'attack';
  return stanceFor(kind, list);
}

/** The stance of a player card: its maneuver and camp tags, and its effects decide the kind (playerKind). */
export function cardActionStance(def) {
  const profile = combatProfileFor(def);
  const tags = [profile.camp && `camp:${profile.camp}`, profile.maneuver && `maneuver:${profile.maneuver}`].filter(Boolean);
  const kind = playerKind({ isAttack: def?.type === 'attack', effects: def?.effects ?? [], maneuver: profile.maneuver });
  return actionStance({ kind, tags });
}

function scaleEffect(effect) {
  if (!SCALED_EFFECT_OPS.includes(effect?.op) || typeof effect.amount !== 'number') return effect;
  return Object.freeze({ ...effect, amount: Math.round(effect.amount * TWO_COST_EFFECT_MULTIPLIER) });
}

/**
 * Derives a resolved card's SP cost and, at cost 2, scales its effect amounts. `authored` is the registry card the
 * resolved one came from; its cost is the base the upgrade delta is measured against. Returns `def` itself when
 * nothing changes.
 */
export function applyActionCosts(def, authored = def) {
  if (!def || typeof def !== 'object') return def;
  if (def.costRule === 'fixed' || FIXED_TYPES.includes(def.type) || typeof def.cost !== 'number') return def;
  const price = stanceCost(cardActionStance(def));
  if (price === null) return def;
  const delta = typeof authored?.cost === 'number' ? def.cost - authored.cost : 0;
  const cost = Math.max(0, price + delta);
  if (cost === def.cost && cost !== TWO) return def;
  const effects = cost === TWO && Array.isArray(def.effects) ? Object.freeze(def.effects.map(scaleEffect)) : def.effects;
  return Object.freeze({ ...def, cost, ...(effects ? { effects } : {}) });
}

/** An enemy's SP pool per turn: its own spPool override, else the shipped default (ENEMY_SP_POOL). */
export function enemyPoolOf(def) {
  const own = def?.spPool;
  return Number.isFinite(own) && own >= 0 ? own : ENEMY_SP_POOL;
}

/** A move's SP: its own `sp` when it names one, else the table price of its stance, else `fallback` (1 SP). */
export function enemyMoveSpOf(move, kind, fallback) {
  if (Number.isFinite(Number(move?.sp)) && move?.sp !== null && move?.sp !== undefined) return Math.max(0, Number(move.sp));
  return stanceCost(actionStance({ kind, tags: move?.tags })) ?? fallback;
}
