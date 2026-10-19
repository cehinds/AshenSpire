import { fixCoreEnabled, fixCoreRules } from '../model/fixCoreMechanics.js';
import { stanceMitigation } from './stanceMitigation.js';
import { proposalTargetPlan } from './proposalStatusRuntime.js';
// One seeded Accuracy decision gates an entire committed hostile action.
import { attackAccuracy, counterBaseEvasion, attributesOf, levelOf } from './counterReturn.js';
import * as Statuses from './statuses.js';
import { RANGES } from '../model/combatRanges.js';
import { proposalIntentRevealUntil } from '../model/proposalIntentReveal.js';
import { stanceRulesFor, stanceOf, effectiveManeuver, sameStance, stanceEntryBonuses } from '../model/stanceRules.js';

function hitMode(source, target, { evadeDisabled = false } = {}) {
  const pending = eligibleEvadeMode(target), prepared = eligiblePreparedEvade(target);
  const advantage = !!(source?.accuracyAdvantage || (!evadeDisabled && (target?.evadeDisadvantage || prepared?.disadvantage || pending?.disadvantage)));
  const disadvantage = !!(source?.accuracyDisadvantage || (!evadeDisabled && (target?.evadeAdvantage || prepared?.advantage || pending?.advantage)));
  return advantage === disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage';
}
function diceHit(dice, need, mode, strictNatural = false) {
  // A natural twenty always connects, including against advantaged Evasion.
  if (!strictNatural && dice.includes(20)) return true;
  const die = mode === 'disadvantage' ? Math.min(...dice) : Math.max(...dice);
  return die === 20 || die !== 1 && die >= need;
}
/** FixCore opposed roll (owner, 2026-10-19): d20 + Precision against d20 + Evasion; the attacker's natural 20 hits and natural 1 misses. */
function opposedHit(die, evasionDie, accuracy, evasion) {
  return die === 20 || die !== 1 && die + accuracy >= evasionDie + evasion;
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
  if (fixCoreEnabled(ctx)) {
    const cfg = fixCoreRules(ctx, entity).accuracy;
    const dex = Number(attributesOf(ctx, baseEntity)?.dexterity) || 0;
    // Evasion = base + stacks × (baseAC + gear Evasion + DEX) (owner, 2026-10-19); there is no stance factor.
    const perStack = cfg.baseAC + (Number(baseEntity?.baseEvasionBonus) || 0) + dex;
    return cfg.evasionBase + (evadeDisabled ? 0 : perStack * stacks(entity, 'evade') + (prepared ? Number(prepared.bonus) || 0 : 0));
  }
  const preparedBonus = prepared ? stanceRulesFor(ctx).evasionPerStack + (Number.isFinite(prepared.bonus) ? prepared.bonus : 0) : 0;
  return counterBaseEvasion(ctx, baseEntity) + (evadeDisabled ? 0 : stanceRulesFor(ctx).evasionPerStack * stacks(entity, 'evade') + preparedBonus);
}

/** Perception gate for the hit-% preview: only an exact read of the enemy shows odds that depend on its telegraphed stance. */
export function hitReadExact(enemy, observerId = 'player', { turn, legacySolo = false } = {}) {
  // An active Read Intent reveal exposes the exact intent and stance, so it counts as an exact read.
  return enemy?.knowledgeAction?.reads?.[observerId]?.visibility === 'exact'
    || proposalIntentRevealUntil(enemy, observerId, turn, { legacySolo }) !== null;
}
/** The target the preview prices: itself on an exact read, else a stance-neutral shallow copy so the badge cannot leak the telegraph. Preview only; execution never calls this. */
export function previewTargetFor(target, observerId = 'player', reveal = {}) {
  if (!target || hitReadExact(target, observerId, reveal)) return target;
  const blind = { ...target, combatStance: { maneuver: 'neutral', camp: 'physical', range: 'melee' }, matchingStanceCardMultiplier: 0 };
  delete blind.stanceAdvantageRating;
  return blind;
}

export function attackHitPreview(ctx, source, target, carrier, options = {}) {
  if (ctx.combatExpansionVersion !== 2 || !source || !target || source === target || source.kind === target.kind) return null;
  const profile = carrier?.combatProfile || {};
  const tags = carrier?.authoredTags || carrier?.tags || [];
  const spell = ['spell', 'spells', 'magic', 'magical'].includes(profile.camp);
  // Explicit Target identity is different from an effect's target selector.
  const proposal=proposalTargetPlan(ctx,source,target,carrier);
  const bypass = proposal.unavoidable || spell && tags.includes('target');
  const range = profile.range || 'melee';
  // A spell stance at Reach is delivery (how the caster casts), not a held distance, so melee still connects (owner bug, 2026-10-18).
  // A physical Reach stance (Crawling Shot) and any Far stance still hold distance.
  const stance = target?.combatStance, delivery = stance?.camp === 'spell' && stance.range === 'reach';
  const requiredRange = carrier?.counterRequiredRange || (delivery ? 'melee' : stance?.range) || 'melee';
  const override = profile.rangeOverride === true || profile.adequateReach === true || profile.traits?.includes('adequateReach');
  // Target bypasses Evasion only; its spell still needs sufficient reach.
  const inRange = override || (RANGES.includes(range) && RANGES.includes(requiredRange) && RANGES.indexOf(range) >= RANGES.indexOf(requiredRange));
  const maneuver = effectiveManeuver({ combatProfile: profile, mirrors: carrier?.mirrors });
  const precision = stacks(source, 'precision');
  const rules = stanceRulesFor(ctx);
  const sweep = maneuver === 'sweep' ? rules.sweepPrecisionBase + rules.sweepPerAdditionalTarget * Math.max(0, options.additionalTargets ?? carrier?.additionalTargets ?? 0) : 0;
  const cfg = fixCoreRules(ctx, source, carrier).accuracy;
  // Under FixCore, Precision and Evasion are whole numbers, rounded down (owner, 2026-10-18); the roll is opposed (owner, 2026-10-19).
  const attrs = fixCoreEnabled(ctx) ? attributesOf(ctx, source) || {} : null, wt = cfg.precisionWeights;
  const precisionMultiplier = fixCoreEnabled(ctx) ? Math.floor(wt.dex * (Number(attrs.dexterity) || 0) + wt.str * (Number(attrs.strength) || 0)
    + wt.wis * (Number(attrs.wisdom) || 0) + wt.int * (Number(attrs.intelligence) || 0) + wt.level * levelOf(ctx, source)) * (precision + 1) : 0;
  const accuracy = fixCoreEnabled(ctx)
    ? Math.floor(cfg.precisionBase + precisionMultiplier + (Number(source.basePrecisionBonus) || 0) + (cfg.maneuverPrecision[maneuver] || 0) + proposal.accuracyDelta/5)
    : attackAccuracy(ctx, source, carrier) + precision + sweep + proposal.accuracyDelta/5;
  const evadeStacks = options.evadeDisabled ? 0 : stacks(target, 'evade');
  const evasion = fixCoreEnabled(ctx) ? Math.floor(effectiveEvasion(ctx, target, options)) : effectiveEvasion(ctx, target, options);
  const need = fixCoreEnabled(ctx) ? evasion - accuracy : Math.max(2, Math.min(20, 8 + evasion - accuracy));
  const evadeAttempted = inRange && !bypass && !options.evadeDisabled && (evadeStacks > 0 || !!eligiblePreparedEvade(target));
  const mode = hitMode(source, target, options);
  let hits = 0, outcomes = mode === 'normal' ? 20 : 400;
  if (inRange && fixCoreEnabled(ctx)) {
    // Opposed roll: every attacker die outcome against all twenty defender faces, exact.
    outcomes *= 20;
    const faces = [];
    for (let first = 1; first <= 20; first++) {
      if (mode === 'normal') faces.push(first);
      else for (let second = 1; second <= 20; second++) faces.push(mode === 'disadvantage' ? Math.min(first, second) : Math.max(first, second));
    }
    for (const die of faces) for (let evasionDie = 1; evasionDie <= 20; evasionDie++) if (bypass || opposedHit(die, evasionDie, accuracy, evasion)) hits++;
  } else if (inRange) for (let first = 1; first <= 20; first++) {
    if (mode === 'normal') { if (bypass || diceHit([first], need, mode, false)) hits++; }
    else for (let second = 1; second <= 20; second++) if (bypass || diceHit([first, second], need, mode, false)) hits++;
  }
  // Under FixCore a shown percentage is whole, rounded down (owner, 2026-10-18); advantage and disadvantage give quarters.
  const hitChance = fixCoreEnabled(ctx) ? Math.floor(100 * hits / outcomes) : 100 * hits / outcomes;
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
  // FixCore: the defender rolls its own d20 after the attacker's dice (owner, 2026-10-19).
  const rollDie = () => typeof ctx.rng.int === 'function' ? ctx.rng.int('combatAvoidance', 1, 20) : 1 + Math.floor(ctx.rng.float('combatAvoidance') * 20);
  const opposed = fixCoreEnabled(ctx) && dice.length > 0;
  const evasionDie = opposed ? rollDie() : null;
  const attackDie = opposed ? (preview.mode === 'disadvantage' ? Math.min(...dice) : Math.max(...dice)) : null;
  const hit = preview.inRange && (preview.bypass || (opposed ? opposedHit(attackDie, evasionDie, preview.accuracy, preview.evasion) : diceHit(dice, preview.need, preview.mode)));
  if (dice.length && preview.evadeAttempted) {
    if (eligibleEvadeMode(target)) delete target.nextEvadeMode;
    // Prepared charges from v2 saves and dodgeRoll use the same Accuracy decision.
    const prepared = eligiblePreparedEvade(target);
    if (prepared) prepared.charges--;
  }
  const result = { ...preview, d20, dice, hit, ...(opposed ? { evasionDie, attackTotal: attackDie + preview.accuracy, evasionTotal: evasionDie + preview.evasion } : {}), ...(source?.knowledgeAction ? { enemyActionSerial: source.knowledgeAction.serial } : {}), ...(!hit ? { missReason: preview.inRange ? 'accuracy' : 'range' } : {}) };
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
