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
  RESTORE_MANA_OPS, RESTORE_STAMINA_OPS, SCALED_EFFECT_OPS, STATUS_STACK_CAP, MANEUVER_SP_FLOORS, SWEEP_UNSCALED_OPS,
  ENEMY_SP_ROW, ENEMY_BLIGHT_SHIFT, STATUS_WEIGHT, STATUS_WEIGHTS,
} from '../content/actionCosts.js';
import { DRAWBACK_KEYWORD_TAGS } from '../content/actionCosts.js';
import { stanceFor } from '../engine/combatRounds/stance.js';
import { spellCardCostSurcharge } from './combatCardProfile.js';

export const ACTION_STANCES = Object.freeze(['attack', 'block', 'smash', 'counter', 'cast', 'sweep']);
export const COST_SIDES = Object.freeze(['sp', 'mp']);
const FIXED_TYPES = Object.freeze(['status', 'curse']);
const BUDGET_NUMBERS = Object.freeze(['spDivisor', 'mpDivisor', 'damageWeight', 'rankWeight', 'rankWeightMp', 'castingEffortWeight',
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
  maneuverFloors: MANEUVER_SP_FLOORS,
  sweepUnscaledOps: SWEEP_UNSCALED_OPS,
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
    if (w < 0 && !(DRAWBACK_KEYWORD_TAGS.includes(tag) || tag.startsWith('drawback:'))) throw new TypeError(`actionCosts: tag "${tag}" weighs ${w}; only drawbacks weigh less than 0`);
    if (!COST_SIDES.includes(row.side)) throw new TypeError(`actionCosts: tag "${tag}" counts on side "${row.side}"; a side is sp or mp`);
  }
  for (const [range, w] of Object.entries(config.ranges)) {
    if (!Number.isInteger(w) || w < 1 || w > 3) throw new TypeError(`actionCosts: range "${range}" weighs ${w}; a range weight is 1..3`);
  }
  for (const [status, w] of Object.entries({ '(default)': config.statusWeight, ...config.statusWeights })) {
    if (!Number.isInteger(w) || w < 2 || w > 3) throw new TypeError(`actionCosts: status "${status}" weighs ${w}; every status weighs 2..3`);
  }
  for (const [tag, floor] of Object.entries(config.maneuverFloors)) {
    if (!Number.isInteger(floor) || floor < 0) throw new TypeError(`actionCosts: the SP floor of "${tag}" is ${floor}; a floor is a whole number of SP, 0 or more`);
  }
  if (!(Number.isFinite(config.budget.smashPoiseBase) && config.budget.smashPoiseBase >= 0)) throw new TypeError('actionCosts: budget "smashPoiseBase" must be a number, 0 or more');
  const steps = config.budget.damageSteps;
  if (steps !== undefined && !(Array.isArray(steps) && steps.every((t, i) => Number.isFinite(t) && t > 0 && (i === 0 || t > steps[i - 1])))) {
    throw new TypeError('actionCosts: budget "damageSteps" must be an ascending list of positive damage thresholds (or empty)');
  }
  if (!(config.statusStackCap === null || (Number.isInteger(config.statusStackCap) && config.statusStackCap >= 1))) throw new TypeError('actionCosts: the status stack cap must be null (no cap) or a whole number, 1 or more');
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
 *          + castingEffort (cast tags) + SP-side statuses + drawbacks (negative)
 *   S_mp = damageWeight × magical damage + Σ MP-side tag weights + MP-side statuses
 *   SP = floor(S_sp / spDivisor), MP = floor(S_mp / mpDivisor), each S floored at 0 first.
 *   If both are 0, the larger side pays 1 (SP on a tie; SP for a Mana-restoring card).
 *   Restores break even (owner, 2026-10-13): a card then costs restoreWeight × what it restores on top, in the same
 *   pool, and that part is funded by its own restore (`funded`), so it needs none of that pool to cast and changes it
 *   by 0. Returns { sp, mp, funded: { sp, mp }, ... }; sp and mp are the gross prices the card face shows.
 * A card is magical when it carries any MP-side tag; its damage and statuses then count on the MP side.
 * `rank` is the card's rank above the base (a base card is 0). Returns { sp, mp, sSp, sMp, magic, cast, parts }.
 */
export function cardCostBudget(def, { rank = 0, config = COST_CONFIG, upgradeDelta = 0 } = {}) {
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
      const capped = config.statusStackCap === null ? stacks : Math.min(stacks, config.statusStackCap);
      statusPoints += (config.statusWeights[e.status] ?? config.statusWeight) * capped;
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
    rankMp: magic ? budget.rankWeightMp * Math.max(0, rank) : 0,
    tagSp, tagMp, range,
    castingEffort: cast ? budget.castingEffortWeight : 0,
    status: statusPoints,
    restoreMana: Math.round(budget.restoreWeight * restoreMana),
    restoreStamina: Math.round(budget.restoreWeight * restoreStamina),
  });
  const sSp = Math.max(0, (magic ? 0 : damagePoints) + parts.rank + tagSp + range + parts.castingEffort
    + (magic ? 0 : statusPoints));
  const sMp = Math.max(0, (magic ? damagePoints : 0) + parts.rankMp + tagMp + (magic ? statusPoints : 0));
  const rawSp = Math.floor(sSp / budget.spDivisor);
  const rawMp = Math.floor(sMp / budget.mpDivisor);
  let sp = rawSp;
  let mp = rawMp;
  // The maneuver floor (owner, 2026-10-13): a base (rank 0) smash or sweep costs at least its floor (2 SP). A higher rank
  // has no floor, and an authored upgrade that lowers the cost lowers the floor by as much. It applies before the
  // minimum-1 rule below, so a floored card that already pays SP is not also charged 1 MP (a mixed physical/magic smash
  // such as Ruinous Blow would otherwise cost more with Exhaust than without it).
  const floor = rank === 0 ? Math.max(0, ...allTags.map((t) => config.maneuverFloors[t] ?? 0)) - Math.max(0, upgradeDelta) : 0;
  if (sp < floor) sp = floor;
  // Both 0: the larger side pays 1 (SP on a tie). A Mana-restoring card pays Stamina: it buys Mana with Stamina, so a
  // player with no Mana can always cast it.
  if (sp === 0 && mp === 0) {
    if (restoreMana > 0 || !(sMp > sSp)) sp = 1; else mp = 1;
  }
  // Restores break even (owner, 2026-10-13): the restore is priced in its own pool and pays that part itself.
  const funded = Object.freeze({ sp: Math.min(parts.restoreStamina, restoreStamina), mp: Math.min(parts.restoreMana, restoreMana) });
  sp += parts.restoreStamina;
  mp += parts.restoreMana;
  return { sp, mp, funded, sSp, sMp, rawSp, rawMp, magic, cast, tags: allTags, parts };
}

/** True when a card keeps its authored cost: costRule 'fixed', a curse or a status, or an X (non-number) cost. */
export function isCostOptOut(def) {
  return !def || typeof def !== 'object' || def.costRule === 'fixed' || FIXED_TYPES.includes(def.type) || typeof def.cost !== 'number';
}

function scaleEffect(effect, multiplier, unscaled = []) {
  if (!SCALED_EFFECT_OPS.includes(effect?.op) || unscaled.includes(effect.op) || typeof effect.amount !== 'number') return effect;
  return Object.freeze({ ...effect, amount: Math.round(effect.amount * multiplier) });
}

/**
 * The 2-SP effects (owner, 2026-10-12 and 2026-10-13): a card at 2 SP or more multiplies its effect amounts by
 * twoCostMultiplier. A sweep pays for its area, so its damage stays normal (SWEEP_UNSCALED_OPS) while its other riders
 * scale; a smash pays for its impact, so its damage and Poise damage scale.
 */
function twoCostEffects(effects, tags, config) {
  const sweep = tags.includes('maneuver:sweep');
  return effects.map((e) => scaleEffect(e, config.budget.twoCostMultiplier, sweep ? config.sweepUnscaledOps : []));
}

/**
 * All smashes deal Poise damage (owner, 2026-10-13): a smash's Poise damage is smashPoiseBase plus its own (scaled at
 * 2 SP or more). The base is added to its first Poise damage effect, or, with none, a Poise damage effect is added on
 * its first damage target.
 */
function withSmashPoise(effects, tags, config) {
  const base = config.budget.smashPoiseBase;
  if (!tags.includes('maneuver:smash') || !(base > 0)) return effects;
  const at = effects.findIndex((e) => e?.op === 'poiseDamage' && typeof e.amount === 'number');
  if (at >= 0) return effects.map((e, i) => (i === at ? Object.freeze({ ...e, amount: e.amount + base }) : e));
  const hit = effects.find((e) => e?.op === 'damage');
  return [...effects, Object.freeze({ op: 'poiseDamage', target: hit?.target ?? 'enemy', amount: base })];
}

/**
 * Derives a resolved player card's SP (`cost`) and Mana (`manaCost`) and, at SP 2 or more, scales its effect amounts.
 * `rank` is the card's rank above the base. Returns `def` itself when the card opts out or nothing changes.
 */
export function applyActionCosts(def, authored = def, { rank = 0, config = COST_CONFIG } = {}) {
  if (isCostOptOut(def)) return def;
  // An authored upgrade that lowers the cost lowers the maneuver floor by as much (owner, 2026-10-13).
  // (An ability grade's own action cost is not an upgrade: grades are priced at their rank.)
  const upgradeDelta = !Array.isArray(authored?.gradeProfiles) && typeof authored?.cost === 'number' && typeof def.cost === 'number' ? authored.cost - def.cost : 0;
  const { sp, mp, funded, tags } = cardCostBudget(def, { rank, config, upgradeDelta });
  const scaled = sp - funded.sp >= 2;
  const smash = tags.includes('maneuver:smash') && config.budget.smashPoiseBase > 0;
  const funds = funded.sp > 0 || funded.mp > 0;
  if (sp === def.cost && mp === (def.manaCost || 0) && !scaled && !smash && !funds) return def;
  let effects = def.effects;
  if (Array.isArray(effects)) {
    if (scaled) effects = twoCostEffects(effects, tags, config);
    effects = withSmashPoise(effects, tags, config);
    if (funds) effects = withFundedRestores(effects, funded);
    effects = Object.freeze(effects);
  }
  // The face says the Poise damage every smash deals: a template that names none gains the sentence.
  const poiseLine = smash && typeof def.textTemplate === 'string' && !def.textTemplate.includes('{poiseDamage}')
    && effects?.some((e) => e?.op === 'poiseDamage');
  const textTemplate = poiseLine ? `${def.textTemplate.trim()} Deal {poiseDamage} Poise damage.` : def.textTemplate;
  return Object.freeze({ ...def, cost: sp, manaCost: mp, ...(effects ? { effects } : {}), ...(textTemplate !== undefined ? { textTemplate } : {}) });
}

// Marks the part of each restore that pays the card's own price (`funded`): the engine charges the price less that
// part (ownRestoreFunds) and the restore gives back only the rest, so the restored pool changes by 0 (owner, 2026-10-13).
function withFundedRestores(effects, funded) {
  const left = { sp: funded.sp, mp: funded.mp };
  return effects.map((e) => {
    const side = RESTORE_STAMINA_OPS.includes(e?.op) ? 'sp' : RESTORE_MANA_OPS.includes(e?.op) ? 'mp' : null;
    if (!side || typeof e.amount !== 'number' || left[side] <= 0) return e;
    const part = Math.min(left[side], e.amount);
    left[side] -= part;
    return Object.freeze({ ...e, funded: part });
  });
}

/**
 * The part of a card's price its own restores pay (owner, 2026-10-13): { stamina, mana }. The engine's one card
 * pricing (combat.js resolvedCardPlayCosts, coopCombat.js) charges the price less this, and the restore op gives back
 * its amount less its `funded` part, so a break-even restore card is castable at 0 of that pool and changes it by 0.
 */
export function ownRestoreFunds(def) {
  let stamina = 0;
  let mana = 0;
  for (const e of Array.isArray(def?.effects) ? def.effects : []) {
    const part = Number.isFinite(e?.funded) ? Math.max(0, e.funded) : 0;
    if (RESTORE_STAMINA_OPS.includes(e?.op)) stamina += part;
    else if (RESTORE_MANA_OPS.includes(e?.op)) mana += part;
  }
  return { stamina, mana };
}

/** An enemy's attributes as its SP reads them: authored, shifted by ENEMY_BLIGHT_SHIFT when it is `blighted`. */
export function enemyAttributesOf(def) {
  const authored = def?.attributes && typeof def.attributes === 'object' ? def.attributes : {};
  if (!def?.blighted) return { ...authored };
  const out = { ...authored };
  for (const [id, shift] of Object.entries(ENEMY_BLIGHT_SHIFT)) out[id] = Math.max(0, (Number(out[id]) || 0) + shift);
  return out;
}

/**
 * An enemy's SP pool per turn (owner, 2026-10-13; SPEC §4.6a): ENEMY_SP_ROW read on its attributes (each term floored on
 * its own) plus its `equipmentSp`, floored at 0. A fixed `spPool` (test fixtures) replaces it outright.
 */
export function enemyPoolOf(def, { row = ENEMY_SP_ROW } = {}) {
  if (Number.isInteger(def?.spPool) && def.spPool >= 0) return def.spPool;
  const attributes = enemyAttributesOf(def);
  let sp = row.base;
  for (const [id, weight] of Object.entries(row)) if (id !== 'base') sp += Math.floor((Number(attributes[id]) || 0) * weight);
  const equipment = Number.isFinite(def?.equipmentSp) ? def.equipmentSp : 0;
  return Math.max(0, Math.floor(sp + equipment));
}
export const enemySpOf = enemyPoolOf;

/**
 * A move's SP: its own `sp` when it names one, else the table price of its stance, else `fallback` (1 SP). With an
 * `entity` (the enemy paying, expanded combat only), a spell-camp move adds the Silenced surcharge the player's cards pay
 * (model/combatCardProfile.js spellCardCostSurcharge, one SP per stack); `enemyId` and `moveId` find its authored tags.
 */
export function enemyMoveSpOf(move, kind, fallback, { entity = null, enemyId, moveId } = {}) {
  const own = Number.isFinite(Number(move?.sp)) && move?.sp !== null && move?.sp !== undefined;
  const base = own ? Math.max(0, Number(move.sp)) : stanceCost(actionStance({ kind, tags: move?.tags })) ?? fallback;
  return base + (entity ? spellCardCostSurcharge(entity, { ...move, enemyId, moveId }) : 0);
}
