// src/content/actionCosts.js — the action-cost tunables (owner decisions, 2026-10-12).
//
// WHAT IS JSON, AND WHAT STAYS HERE. Every number a card's Stamina (SP) and Mana (MP) cost reads, and every number an
// enemy move's SP and an enemy's SP pool read, is authored in content/source/actionCosts.json (one object, a key per
// export below); content-build compiles it to src/content/generated/actionCosts.js. Edit the JSON, not this file. The
// comments that lived here are in content/source/CONTENT-NOTES.md, under "Action costs".
//
// What stays JS is the part JSON cannot say: Object.freeze at the depth each constant always had, and
// TWO_COST_EFFECT_MULTIPLIER, which is read off COST_BUDGET rather than typed twice. src/model/actionCosts.js validates
// these tables and derives the costs; docs/alternative-combat-rounds/COST-WEIGHTS.md gives the reason for every weight,
// and tests/action-costs-weights-doc.test.mjs fails when the doc and the JSON disagree.
import { actionCosts as source } from './generated/actionCosts.js';

const freeze = Object.freeze;

export const COST_BUDGET = freeze({ ...source.COST_BUDGET, damageSteps: freeze(source.COST_BUDGET.damageSteps) });
// Top level frozen only: each tag's { weight, side } row was never frozen.
export const COST_TAGS = freeze(source.COST_TAGS);
export const KEYWORD_TAGS = freeze(source.KEYWORD_TAGS);
export const DRAWBACK_KEYWORD_TAGS = freeze(source.DRAWBACK_KEYWORD_TAGS);
export const DRAWBACK_OPS = freeze(source.DRAWBACK_OPS);
export const RANGE_WEIGHTS = freeze(source.RANGE_WEIGHTS);
export const RANGE_TAGS = freeze(source.RANGE_TAGS);
export const CAST_TAGS = freeze(source.CAST_TAGS);
export const STATUS_WEIGHT = source.STATUS_WEIGHT;
export const STATUS_WEIGHTS = freeze(source.STATUS_WEIGHTS);
export const STATUS_STACK_CAP = source.STATUS_STACK_CAP;
export const RESTORE_STAMINA_OPS = freeze(source.RESTORE_STAMINA_OPS);
export const RESTORE_MANA_OPS = freeze(source.RESTORE_MANA_OPS);
export const MANEUVER_SP_FLOORS = freeze(source.MANEUVER_SP_FLOORS);
export const SWEEP_UNSCALED_OPS = freeze(source.SWEEP_UNSCALED_OPS);
export const SCALED_EFFECT_OPS = freeze(source.SCALED_EFFECT_OPS);
export const TWO_COST_EFFECT_MULTIPLIER = COST_BUDGET.twoCostMultiplier;
export const ENEMY_SP_ROW = freeze(source.ENEMY_SP_ROW);
export const ENEMY_SP_BANDS = freeze({
  normal: freeze(source.ENEMY_SP_BANDS.normal),
  elite: freeze(source.ENEMY_SP_BANDS.elite),
  boss: freeze(source.ENEMY_SP_BANDS.boss),
});
export const ENEMY_BLIGHT_SHIFT = freeze(source.ENEMY_BLIGHT_SHIFT);
export const ACTION_COST_TABLE = freeze(source.ACTION_COST_TABLE);
