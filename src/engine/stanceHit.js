// One seeded Accuracy decision gates an entire committed hostile action.
import { attackAccuracy, counterBaseEvasion } from './counterReturn.js';
import * as Statuses from './statuses.js';
import { RANGES } from '../model/combatRanges.js';

function hitMode(source, target, { evadeDisabled = false } = {}) {
  const advantage = !!(source?.accuracyAdvantage || (!evadeDisabled && (target?.evadeDisadvantage || target?.combatEvade?.disadvantage || target?.nextEvadeMode?.disadvantage)));
  const disadvantage = !!(source?.accuracyDisadvantage || (!evadeDisabled && (target?.evadeAdvantage || target?.combatEvade?.advantage || target?.nextEvadeMode?.advantage)));
  return advantage === disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage';
}
function diceHit(dice, need, mode) {
  // A natural twenty always connects, including against advantaged Evasion.
  if (dice.includes(20)) return true;
  const die = mode === 'disadvantage' ? Math.min(...dice) : Math.max(...dice);
  return die !== 1 && die >= need;
}
const stacks = (entity, id) => Math.max(0, Number(entity?.statuses?.[id]?.stacks) || 0);
export function effectiveEvasion(ctx, entity, { evadeDisabled = false } = {}) {
  return counterBaseEvasion(ctx, entity) + (evadeDisabled ? 0 : 3 * stacks(entity, 'evade'));
}

export function attackHitPreview(ctx, source, target, carrier, options = {}) {
  if (ctx.combatExpansionVersion !== 2 || !source || !target || source === target || source.kind === target.kind) return null;
  const profile = carrier?.combatProfile || {};
  const tags = carrier?.authoredTags || carrier?.tags || [];
  const spell = ['spell', 'spells', 'magic', 'magical'].includes(profile.camp);
  // Explicit Target identity is different from an effect's target selector.
  const bypass = spell && tags.includes('target');
  const range = profile.range || 'melee';
  const requiredRange = carrier?.counterRequiredRange || target?.combatStance?.range || 'melee';
  const override = profile.rangeOverride === true || profile.adequateReach === true || profile.traits?.includes('adequateReach');
  const inRange = bypass || override || (RANGES.includes(range) && RANGES.includes(requiredRange) && RANGES.indexOf(range) >= RANGES.indexOf(requiredRange));
  const precision = stacks(source, 'precision');
  const sweep = profile.maneuver === 'sweep' ? -1 + Math.max(0, options.additionalTargets ?? carrier?.additionalTargets ?? 0) : 0;
  const accuracy = attackAccuracy(ctx, source, carrier) + precision + sweep;
  const evadeStacks = options.evadeDisabled ? 0 : stacks(target, 'evade');
  const evasion = effectiveEvasion(ctx, target, options);
  const need = Math.max(2, Math.min(20, 8 + evasion - accuracy));
  const mode = hitMode(source, target, options);
  let hits = 0, outcomes = mode === 'normal' ? 20 : 400;
  if (inRange) for (let first = 1; first <= 20; first++) {
    if (mode === 'normal') { if (bypass || diceHit([first], need, mode)) hits++; }
    else for (let second = 1; second <= 20; second++) if (bypass || diceHit([first, second], need, mode)) hits++;
  }
  const hitChance = 100 * hits / outcomes;
  const evadeActive = target?.combatStance?.maneuver === 'evade' || !!target?.combatEvade?.charges;
  return { range, requiredRange, inRange, accuracy, evasion, need, bypass, mode, advantage: mode === 'advantage', disadvantage: mode === 'disadvantage', evadeStacks, evadeActive, hitChance, chance: hitChance,
    ...(!inRange ? { missReason: 'range' } : {}) };
}

export function resolveAttackHit(ctx, source, target, carrier, options = {}) {
  const preview = attackHitPreview(ctx, source, target, carrier, options);
  if (!preview) return null;
  const d20 = preview.inRange && !preview.bypass ? (typeof ctx.rng.int === 'function' ? ctx.rng.int('combatAvoidance', 1, 20) : 1 + Math.floor(ctx.rng.float('combatAvoidance') * 20)) : null;
  const dice = d20 == null ? [] : [d20];
  if (dice.length && preview.mode !== 'normal') dice.push(typeof ctx.rng.int === 'function' ? ctx.rng.int('combatAvoidance', 1, 20) : 1 + Math.floor(ctx.rng.float('combatAvoidance') * 20));
  const hit = preview.inRange && (preview.bypass || diceHit(dice, preview.need, preview.mode));
  if (dice.length) delete target.nextEvadeMode;
  const result = { ...preview, d20, dice, hit, ...(!hit ? { missReason: preview.inRange ? 'accuracy' : 'range' } : {}) };
  if (!hit && preview.inRange && !preview.bypass && preview.evadeStacks > 0) Statuses.removeStatus(ctx, target, 'evade', { amount: 1, reason: 'consumed' });
  const label = hit ? preview.evadeActive && !preview.bypass ? 'Hit — Evade Failed' : 'Hit' : 'Missed';
  if (!options.suppressOutcomeEvent) ctx.emit?.(hit ? 'attackHit' : 'attackMissed', { sourceId: source.id, targetId: target.id, cardId: carrier?.cardId, moveId: carrier?.moveId,
    ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source), targetPlayerId: ctx.playerIdForEntity(target) } : {}), ...result, label });
  return result;
}
