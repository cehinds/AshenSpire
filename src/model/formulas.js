// src/model/formulas.js — structured formula evaluator (SPEC §3.5)
//
// Every dynamic number in content is either a plain number or a formula
// object { f: '<op>', ... }. No string parsing — formulas are validatable
// data. The closed op set below is contractual; extending it is an engine PR.
//
// Flooring: every evaluation floors its FINAL result once (StS integer math).
// The single deliberate exception is `stacks` with `per`, which floors the
// division immediately so "per N stacks" means whole chunks of N.
//
// The same evaluator computes card-preview numbers for the UI (SPEC §3.13, §4.2).
//
// Headless: no document/window/localStorage/timers.

export const FORMULA_OPS = Object.freeze([
  'add',
  'mul',
  'percentMaxHp',
  'missingHp',
  'stacks',
  'energySpent',
  'blockOf',
  'hpOf',
  'cardsPlayedThisTurn',
]);

// Entity references usable in a formula's `of` field.
export const FORMULA_OF = Object.freeze([
  'self',
  'owner',
  'target',
  'enemy',
  'player',
  'allEnemies',
]);

export function isFormula(v) {
  return v !== null && typeof v === 'object' && typeof v.f === 'string';
}

/**
 * evaluate(formula, ctx) → integer.
 *
 * ctx = {
 *   entities: { self, owner, target, enemy, player, allEnemies: [] },
 *              // each entity: { hp, maxHp, block, statuses: {} } or null
 *   energySpent: number,         // for X-cost scaling
 *   cardsPlayedThisTurn: number,
 * }
 *
 * `formula` may be a plain number (returned floored) or a formula object.
 * Optional `min` / `max` clamps are honored on any node (applied before the
 * final floor). Throws on unknown ops, unresolvable `of` refs, or NaN.
 */
export function evaluate(formula, ctx = {}) {
  const raw = evalNode(formula, ctx);
  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    throw new Error(`Formula evaluated to a non-number: ${JSON.stringify(formula)}`);
  }
  return Math.floor(raw);
}

function evalNode(node, ctx) {
  if (typeof node === 'number') return node;
  if (!isFormula(node)) {
    throw new Error(`Not a number or formula: ${JSON.stringify(node)}`);
  }
  let v;
  switch (node.f) {
    case 'add': {
      v = argsOf(node).reduce((acc, a) => acc + evalNode(a, ctx), 0);
      break;
    }
    case 'mul': {
      v = argsOf(node).reduce((acc, a) => acc * evalNode(a, ctx), 1);
      break;
    }
    case 'percentMaxHp': {
      const ent = resolveOne(ctx, node.of, node.f);
      v = (ent.maxHp * numField(node, 'pct')) / 100;
      break;
    }
    case 'missingHp': {
      const ent = resolveOne(ctx, node.of, node.f);
      v = Math.max(0, ent.maxHp - ent.hp);
      break;
    }
    case 'stacks': {
      const ents = resolveMany(ctx, node.of, node.f);
      let total = 0;
      for (const ent of ents) total += stacksOf(ent, node.status);
      v = node.per != null ? Math.floor(total / node.per) : total;
      break;
    }
    case 'energySpent': {
      const spent = ctx.energySpent != null ? ctx.energySpent : 0;
      v = spent * (node.per != null ? node.per : 1);
      break;
    }
    case 'blockOf': {
      const ent = resolveOne(ctx, node.of, node.f);
      v = ent.block;
      break;
    }
    case 'hpOf': {
      const ent = resolveOne(ctx, node.of, node.f);
      v = ent.hp;
      break;
    }
    case 'cardsPlayedThisTurn': {
      const n = ctx.cardsPlayedThisTurn != null ? ctx.cardsPlayedThisTurn : 0;
      v = n * (node.per != null ? node.per : 1);
      break;
    }
    default:
      throw new Error(`Unknown formula op '${node.f}'`);
  }
  if (node.min != null && v < node.min) v = node.min;
  if (node.max != null && v > node.max) v = node.max;
  return v;
}

function argsOf(node) {
  if (!Array.isArray(node.args)) {
    throw new Error(`Formula '${node.f}' requires an args array`);
  }
  return node.args;
}

function numField(node, field) {
  const v = node[field];
  if (typeof v !== 'number') {
    throw new Error(`Formula '${node.f}' requires numeric field '${field}'`);
  }
  return v;
}

function resolveRef(ctx, of, op) {
  if (of == null) throw new Error(`Formula '${op}' requires an 'of' entity ref`);
  const entities = ctx.entities || {};
  const ent = entities[of];
  if (ent == null) {
    throw new Error(`Formula '${op}': entity ref '${of}' did not resolve in this context`);
  }
  return ent;
}

function resolveOne(ctx, of, op) {
  const ent = resolveRef(ctx, of, op);
  if (Array.isArray(ent)) {
    throw new Error(`Formula '${op}' cannot target '${of}' (a group); use a single entity ref`);
  }
  return ent;
}

function resolveMany(ctx, of, op) {
  const ent = resolveRef(ctx, of, op);
  return Array.isArray(ent) ? ent : [ent];
}

// Status stacks of an entity; meter statuses report their meter value
// (their build-up points) as their "stacks" (SPEC §3.5, §3.7).
function stacksOf(entity, statusId) {
  if (typeof statusId !== 'string') {
    throw new Error("Formula 'stacks' requires a 'status' id");
  }
  const inst = entity && entity.statuses ? entity.statuses[statusId] : null;
  if (!inst) return 0;
  return inst.meter ? inst.meter.value : inst.stacks || 0;
}
