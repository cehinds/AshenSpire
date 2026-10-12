// src/model/actionCosts.js — the action-cost rules (owner decisions, 2026-10-12; SPEC §4.3a, §4.6a, §4.11).
//
// Pure model. Player cards: the per-resource cost formula (cardCostBudget). Enemy moves: their own `sp`, else the stance
// table (enemyMoveSpOf). Enemy SP pool: stat-driven (enemyPoolOf). registries.resolveCard calls applyActionCosts once
// per resolved card, so the hand, the affordability check, the rounds queue, the reactions and the framework cost profile
// all read one derived cost.
//
// Player card layering (first match wins):
//   1. Opt-out: `costRule: 'fixed'`, a curse or status (by type), or a cost that is not a number (X). Authored cost stands.
//   2. Otherwise SP = floor(S_sp / D) and MP = floor(S_mp / P); if both are 0 the larger side pays 1 (SP on a tie).
//   3. A derived SP of 2 or more scales the card's effect amounts (SCALED_EFFECT_OPS) by twoCostMultiplier.
import {
  ACTION_COST_TABLE, CAST_TAGS, COST_BUDGET, COST_TAGS, DRAWBACK_OPS, KEYWORD_TAGS, RANGE_TAGS, RANGE_WEIGHTS,
  RESTORE_MANA_OPS, RESTORE_STAMINA_OPS, SCALED_EFFECT_OPS, STATUS_STACK_CAP, STATUS_WEIGHT, STATUS_WEIGHTS,
} from '../content/actionCosts.js';
import { derivedStatRules } from '../content/derivedStats.js';
import { statRowValue } from './derivedStats.js';
import { stanceFor } from '../engine/combatRounds/stance.js';

export const ACTION_STANCES = Object.freeze(['attack', 'block', 'smash', 'counter', 'cast', 'sweep']);
export const COST_SIDES = Object.freeze(['sp', 'mp']);
const FIXED_TYPES = Object.freeze(['status', 'curse']);
const BUDGET_NUMBERS = Object.freeze(['spDivisor', 'mpDivisor', 'damageWeight', 'rankWeight', 'castingEffortWeight',
  'restoreWeight', 'twoCostMultiplier']);

/** The shipped cost configuration, one object, so a test or a calibration can pass a variant through `config`. */
export const COST_CONFIG = Object.freeze({
  budget: COST_BUDGET,
  tags: COST_TAGS,
  ranges: RANGE_WEIGHTS,
  rangeTags: RANGE_TAGS,
  statusWeight: STATUS_WEIGHT,
  statusWeights: STATUS_WEIGHTS,
  statusStackCap: STATUS_STACK_CAP,
});

validateActionCostTable(ACTION_COST_TABLE);
validateCostConfig(COST_CONFIG);

/** Refuses a stance table that is missing a stance, or has a price that is not a whole number of SP, by name. */
export function validateActionCostTable(table = ACTION_COST_TABLE) {
  if (!table || typeof table !== 'object') throw new TypeError('actionCosts: the cost table must be an object');
  for (const stance of ACTION_STANCES) {
    if (!Object.hasOwn(table, stance)) throw new TypeError(`actionCosts: the cost table has no price for "${stance}"`);
    const price = table[stance];
    if (!Number.isInteger(price) || price < 0) throw new TypeError(`actionCosts: "${stance}" costs ${price}; a price is a whole number of SP, 0 or more`);
  }
  for (const stance of Object.keys(table)) {
    if (!ACTION_STANCES.includes(stance)) throw new TypeError(`actionCosts: unknown stance "${stance}" in the cost table`);
  }
  return table;
}

/**
 * Refuses a cost configuration the formula cannot read, naming the offending key: a tag weight outside -3..3 or not a
 * whole number, a positive-only tag priced below 0 (only lifecycle.exhaust and drawback:* tags may), a side that is not
 * sp or mp, a range weight outside 1..3, a status weight below 2 or above 3, and a budget number that is not positive.
 */
export function validateCostConfig(config = COST_CONFIG) {
  for (const [tag, row] of Object.entries(config.tags)) {
    const w = row?.weight;
    if (!Number.isInteger(w) || w < -3 || w > 3) throw new TypeError(`actionCosts: tag "${tag}" weighs ${w}; a tag weight is a whole number -3..3`);
    if (w < 0 && !(tag === 'lifecycle.exhaust' || tag.startsWith('drawback:'))) throw new TypeError(`actionCosts: tag "${tag}" weighs ${w}; only drawbacks weigh less than 0`);
    if (!COST_SIDES.includes(row.side)) throw new TypeError(`actionCosts: tag "${tag}" counts on side "${row.side}"; a side is sp or mp`);
  }
  for (const [range, w] of Object.entries(config.ranges)) {
    if (!Number.isInteger(w) || w < 1 || w > 3) throw new TypeError(`actionCosts: range "${range}" weighs ${w}; a range weight is 1..3`);
  }
  for (const [status, w] of Object.entries({ '(default)': config.statusWeight, ...config.statusWeights })) {
    if (!Number.isInteger(w) || w < 2 || w > 3) throw new TypeError(`actionCosts: status "${status}" weighs ${w}; every status weighs 2..3`);
  }
  const steps = config.budget.damageSteps;
  if (steps !== undefined && !(Array.isArray(steps) && steps.every((t, i) => Number.isFinite(t) && t > 0 && (i === 0 || t > steps[i - 1])))) {
    throw new TypeError('actionCosts: budget "damageSteps" must be an ascending list of positive damage thresholds (or empty)');
  }
  if (!(Number.isInteger(config.statusStackCap) && config.statusStackCap >= 1)) throw new TypeError('actionCosts: the status stack cap must be a whole number, 1 or more');
  for (const key of BUDGET_NUMBERS) {
    if (!(Number.isFinite(config.budget[key]) && config.budget[key] > 0)) throw new TypeError(`actionCosts: budget "${key}" is ${config.budget[key]}; it must be a positive number`);
  }
  return true;
}

/** The SP price of a stance, or null when the table does not price it. */
export function stanceCost(stance, table = ACTION_COST_TABLE) {
  if (!stance || !Object.hasOwn(table, stance)) return null;
  return table[stance];
}

/** The stance of an action from its timeline kind and tags (enemy moves). */
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

const count = (value) => (Number.isFinite(value) ? value : 1);

/**
 * The cost receipt of a player card (owner, 2026-10-12; SPEC §4.3a):
 *   S_sp = damageWeight × physical damage + rankWeight × rank + Σ SP-side tag weights + range weight
 *          + castingEffort (cast tags) + SP-side statuses + restoreWeight × Mana restored + drawbacks (negative)
 *   S_mp = damageWeight × magical damage + Σ MP-side tag weights + MP-side statuses + restoreWeight × Stamina restored
 *   SP = floor(S_sp / spDivisor), MP = floor(S_mp / mpDivisor), each S floored at 0 first.
 *   If both are 0, the larger side pays 1 (SP on a tie).
 * A card is magical when it carries any MP-side tag; its damage and statuses then count on the MP side.
 * `rank` is the card's rank above the base (a base card is 0). Returns { sp, mp, sSp, sMp, magic, cast, parts }.
 */
export function cardCostBudget(def, { rank = 0, config = COST_CONFIG } = {}) {
  const { budget, tags: weights } = config;
  const authoredTags = Array.isArray(def?.tags) ? def.tags : (Array.isArray(def?.cardTags) ? def.cardTags : []);
  const effects = Array.isArray(def?.effects) ? def.effects : [];
  const derivedTags = new Set();
  for (const keyword of def?.keywords || []) if (KEYWORD_TAGS[keyword]) derivedTags.add(KEYWORD_TAGS[keyword]);

  let damage = 0;
  let restoreStamina = 0;
  let restoreMana = 0;
  let statusPoints = 0;
  for (const e of effects) {
    if (!e || typeof e !== 'object') continue;
    const drawback = DRAWBACK_OPS[e.op];
    // A card added to the player's own piles is a drawback; a discard counts when the player chooses or loses a card.
    if (drawback && (e.op !== 'addCard' || e.pile !== undefined)) derivedTags.add(drawback);
    if (e.op === 'damage' && typeof e.amount === 'number') damage += e.amount * count(e.hits);
    if (RESTORE_STAMINA_OPS.includes(e.op) && typeof e.amount === 'number') restoreStamina += e.amount;
    if (RESTORE_MANA_OPS.includes(e.op) && typeof e.amount === 'number') restoreMana += e.amount;
    if ((e.op === 'applyStatus' || e.op === 'buildup') && e.status) {
      const stacks = e.op === 'buildup' ? 1 : Math.max(0, count(e.stacks));
      statusPoints += (config.statusWeights[e.status] ?? config.statusWeight) * Math.min(stacks, config.statusStackCap);
    }
  }

  const allTags = [...new Set([...authoredTags, ...derivedTags])];
  const magic = allTags.some((t) => weights[t]?.side === 'mp');
  const cast = allTags.some((t) => CAST_TAGS.includes(t));
  let tagSp = 0;
  let tagMp = 0;
  for (const tag of allTags) {
    const row = weights[tag];
    if (!row) continue;
    if (row.side === 'mp') tagMp += row.weight; else tagSp += row.weight;
  }
  const range = Math.max(0, ...allTags.map((t) => config.ranges[config.rangeTags[t]] ?? 0));
  // The damage term: damageWeight × damage, or × the number of damageSteps thresholds the damage reaches.
  const steps = Array.isArray(budget.damageSteps) && budget.damageSteps.length ? budget.damageSteps : null;
  const damagePoints = budget.damageWeight * (steps ? steps.filter((t) => damage >= t).length : damage);
  const parts = Object.freeze({
    damage: damagePoints,
    rank: budget.rankWeight * Math.max(0, rank),
    tagSp, tagMp, range,
    castingEffort: cast ? budget.castingEffortWeight : 0,
    status: statusPoints,
    restoreMana: budget.restoreWeight * restoreMana,
    restoreStamina: budget.restoreWeight * restoreStamina,
  });
  const sSp = Math.max(0, (magic ? 0 : damagePoints) + parts.rank + tagSp + range + parts.castingEffort
    + (magic ? 0 : statusPoints) + parts.restoreMana);
  const sMp = Math.max(0, (magic ? damagePoints : 0) + tagMp + (magic ? statusPoints : 0) + parts.restoreStamina);
  let sp = Math.floor(sSp / budget.spDivisor);
  let mp = Math.floor(sMp / budget.mpDivisor);
  if (sp === 0 && mp === 0) {
    if (sMp > sSp) mp = 1; else sp = 1;
  }
  return { sp, mp, sSp, sMp, magic, cast, tags: allTags, parts };
}

/** True when a card keeps its authored cost: costRule 'fixed', a curse or a status, or an X (non-number) cost. */
export function isCostOptOut(def) {
  return !def || typeof def !== 'object' || def.costRule === 'fixed' || FIXED_TYPES.includes(def.type) || typeof def.cost !== 'number';
}

function scaleEffect(effect, multiplier) {
  if (!SCALED_EFFECT_OPS.includes(effect?.op) || typeof effect.amount !== 'number') return effect;
  return Object.freeze({ ...effect, amount: Math.round(effect.amount * multiplier) });
}

/**
 * Derives a resolved player card's SP (`cost`) and Mana (`manaCost`) and, at SP 2 or more, scales its effect amounts.
 * `rank` is the card's rank above the base. Returns `def` itself when the card opts out or nothing changes.
 */
export function applyActionCosts(def, _authored = def, { rank = 0, config = COST_CONFIG } = {}) {
  if (isCostOptOut(def)) return def;
  const { sp, mp } = cardCostBudget(def, { rank, config });
  const scaled = sp >= 2;
  if (sp === def.cost && mp === (def.manaCost || 0) && !scaled) return def;
  const effects = scaled && Array.isArray(def.effects)
    ? Object.freeze(def.effects.map((e) => scaleEffect(e, config.budget.twoCostMultiplier))) : def.effects;
  return Object.freeze({ ...def, cost: sp, manaCost: mp, ...(effects ? { effects } : {}) });
}

/**
 * An enemy's SP pool per turn (owner, 2026-10-12; SPEC §4.6a): the stamina row of the derived-stat ruleset read on the
 * enemy's `attributes` (each attribute term floored, as for the player), plus its `equipmentSp`, floored at 0. An enemy
 * with no authored stats gets the row's base, 3. `level` is the row's perLevel term; the engine reads level 1, so an
 * enemy's pool is its attributes and equipment only.
 */
export function enemyPoolOf(def, { level = 1 } = {}) {
  // A fixed `spPool` (test fixtures) replaces the stat pool outright.
  if (Number.isInteger(def?.spPool) && def.spPool >= 0) return def.spPool;
  const row = derivedStatRules.rules.stamina;
  const attributes = def?.attributes && typeof def.attributes === 'object' ? def.attributes : {};
  const fromStats = statRowValue(row, { attributes, level: Math.max(1, Number(level) || 1), lenientAttributes: true, statId: 'stamina' }).value;
  const equipment = Number.isFinite(def?.equipmentSp) ? def.equipmentSp : 0;
  return Math.max(0, Math.floor(fromStats + equipment));
}
export const enemySpOf = enemyPoolOf;

/** A move's SP: its own `sp` when it names one, else the table price of its stance, else `fallback` (1 SP). */
export function enemyMoveSpOf(move, kind, fallback) {
  if (Number.isFinite(Number(move?.sp)) && move?.sp !== null && move?.sp !== undefined) return Math.max(0, Number(move.sp));
  return stanceCost(actionStance({ kind, tags: move?.tags })) ?? fallback;
}
