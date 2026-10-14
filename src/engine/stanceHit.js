// One seeded Accuracy decision gates an entire committed hostile action.
import { attackAccuracy, counterBaseEvasion } from './counterReturn.js';
import * as Statuses from './statuses.js';
import { RANGES } from '../model/combatRanges.js';
import { stanceRulesFor, stanceOf, sameStance, stanceEntryBonuses } from '../model/stanceRules.js';

function hitMode(source, target, { evadeDisabled = false } = {}) {
  const pending = eligibleEvadeMode(target), prepared = eligiblePreparedEvade(target);
  const advantage = !!(source?.accuracyAdvantage || (!evadeDisabled && (target?.evadeDisadvantage || prepared?.disadvantage || pending?.disadvantage)));
  const disadvantage = !!(source?.accuracyDisadvantage || (!evadeDisabled && (target?.evadeAdvantage || prepared?.advantage || pending?.advantage)));
  return advantage === disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage';
}
function diceHit(dice, need, mode) {
  // A natural twenty always connects, including against advantaged Evasion.
  if (dice.includes(20)) return true;
  const die = mode === 'disadvantage' ? Math.min(...dice) : Math.max(...dice);
  return die !== 1 && die >= need;
}
const stacks = (entity, id) => Math.max(0, Number(entity?.statuses?.[id]?.stacks) || 0);
function eligiblePreparedEvade(entity) {
  const prepared = entity?.combatEvade;
  return prepared?.charges > 0 && (prepared.expiresOnOwnerCycle == null || (entity.combatOwnerCycle || 0) < prepared.expiresOnOwnerCycle) && (!prepared.whileStatus || stacks(entity, prepared.whileStatus) > 0) ? prepared : null;
}
function eligibleEvadeMode(entity) {
  const mode = entity?.nextEvadeMode;
  const eligible = stacks(entity, 'evade') > 0 || eligiblePreparedEvade(entity);
  return eligible && mode && (!mode.whileStatus || stacks(entity, mode.whileStatus) > 0) ? mode : null;
}
export function effectiveEvasion(ctx, entity, { evadeDisabled = false, baseEntity = entity } = {}) {
  const prepared = !evadeDisabled && eligiblePreparedEvade(entity);
  const preparedBonus = prepared ? stanceRulesFor(ctx).evasionPerStack + (Number.isFinite(prepared.bonus) ? prepared.bonus : 0) : 0;
  return counterBaseEvasion(ctx, baseEntity) + (evadeDisabled ? 0 : stanceRulesFor(ctx).evasionPerStack * stacks(entity, 'evade') + preparedBonus);
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
  // Target bypasses Evasion only; its spell still needs sufficient reach.
  const inRange = override || (RANGES.includes(range) && RANGES.includes(requiredRange) && RANGES.indexOf(range) >= RANGES.indexOf(requiredRange));
  const precision = stacks(source, 'precision');
  const rules = stanceRulesFor(ctx);
  const sweep = profile.maneuver === 'sweep' ? rules.sweepPrecisionBase + rules.sweepPerAdditionalTarget * Math.max(0, options.additionalTargets ?? carrier?.additionalTargets ?? 0) : 0;
  const accuracy = attackAccuracy(ctx, source, carrier) + precision + sweep;
  const evadeStacks = options.evadeDisabled ? 0 : stacks(target, 'evade');
  const evasion = effectiveEvasion(ctx, target, options);
  const need = Math.max(2, Math.min(20, 8 + evasion - accuracy));
  const evadeAttempted = inRange && !bypass && !options.evadeDisabled && (evadeStacks > 0 || !!eligiblePreparedEvade(target));
  const mode = hitMode(source, target, options);
  let hits = 0, outcomes = mode === 'normal' ? 20 : 400;
  if (inRange) for (let first = 1; first <= 20; first++) {
    if (mode === 'normal') { if (bypass || diceHit([first], need, mode)) hits++; }
    else for (let second = 1; second <= 20; second++) if (bypass || diceHit([first, second], need, mode)) hits++;
  }
  const hitChance = 100 * hits / outcomes;
  const evadeActive = evadeAttempted;
  return { range, requiredRange, inRange, accuracy, evasion, need, bypass, mode, advantage: mode === 'advantage', disadvantage: mode === 'disadvantage', evadeStacks, evadeActive, evadeAttempted, hitChance, chance: hitChance,
    ...(!inRange ? { missReason: 'range' } : {}) };
}

export function resolveAttackHit(ctx, source, target, carrier, options = {}) {
  const preview = attackHitPreview(ctx, source, target, carrier, options);
  if (!preview) return null;
  const d20 = preview.inRange && !preview.bypass ? (typeof ctx.rng.int === 'function' ? ctx.rng.int('combatAvoidance', 1, 20) : 1 + Math.floor(ctx.rng.float('combatAvoidance') * 20)) : null;
  const dice = d20 == null ? [] : [d20];
  if (dice.length && preview.mode !== 'normal') dice.push(typeof ctx.rng.int === 'function' ? ctx.rng.int('combatAvoidance', 1, 20) : 1 + Math.floor(ctx.rng.float('combatAvoidance') * 20));
  const hit = preview.inRange && (preview.bypass || diceHit(dice, preview.need, preview.mode));
  if (dice.length && preview.evadeAttempted) {
    if (eligibleEvadeMode(target)) delete target.nextEvadeMode;
    // Prepared charges from v2 saves and dodgeRoll use the same Accuracy decision.
    const prepared = eligiblePreparedEvade(target);
    if (prepared) prepared.charges--;
  }
  const result = { ...preview, d20, dice, hit, ...(source?.knowledgeAction ? { enemyActionSerial: source.knowledgeAction.serial } : {}), ...(!hit ? { missReason: preview.inRange ? 'accuracy' : 'range' } : {}) };
  if (!hit && preview.inRange && !preview.bypass && preview.evadeStacks > 0) Statuses.removeStatus(ctx, target, 'evade', { amount: 1, reason: 'consumed' });
  const label = hit ? preview.evadeActive && !preview.bypass ? 'Hit — Evade Failed' : 'Hit' : 'Missed';
  if (!options.suppressOutcomeEvent) ctx.emit?.(hit ? 'attackHit' : 'attackMissed', { sourceId: source.id, targetId: target.id, cardId: carrier?.cardId, moveId: carrier?.moveId,
    ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source), targetPlayerId: ctx.playerIdForEntity(target) } : {}), ...result, label });
  return result;
}

/** Selected-card Accuracy after its accepted stance entry, without changing live state. */
export function previewCardAttackHit(ctx, source, target, carrier, options = {}) {
  if (ctx.combatExpansionVersion !== 2 || !source || carrier?.counterReturnAttack) return attackHitPreview(ctx, source, target, carrier, options);
  const profile = { ...carrier?.combatProfile };
  if (profile.evade?.whileStatus) profile.evadeEligible = source.statuses?.[profile.evade.whileStatus]?.stacks > 0;
  const selected = { ...carrier, combatProfile: profile };
  const next = stanceOf(selected, source);
  if (!next) return attackHitPreview(ctx, source, target, carrier, options);
  const grants = !sameStance(source, selected) ? stanceEntryBonuses(selected, ctx) : { precision: 0 };
  const projected = { ...source, combatStance: next, statuses: { ...source.statuses } };
  if (grants.precision > 0) projected.statuses.precision = { ...source.statuses?.precision, stacks: stacks(source, 'precision') + grants.precision };
  const entity = value => value === projected ? source : value;
  const local = { ...ctx, ...(ctx.player === source ? { player: projected } : {}),
    ...(ctx.playerIdForEntity ? { playerIdForEntity: value => ctx.playerIdForEntity(entity(value)) } : {}),
    ...(ctx.attributesForEntity ? { attributesForEntity: value => ctx.attributesForEntity(entity(value)) } : {}) };
  return attackHitPreview(local, projected, target, selected, options);
}
