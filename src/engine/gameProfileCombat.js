import * as Offense from '../model/profileDamageOffense.js';
import { applyStatus, getAdd } from './statuses.js';

import { ItemHandBonus, QueueItemStanceEntry, ItemIncomingPercent, ItemPoiseExtra } from './itemPropertyHooks.js';
import { attackHitPreview, precisionEntryGrant } from './stanceHit.js';
import { ChannelWeight } from '../model/damageChannels.js';

import { sourceRatingValue, splitContactParts, PacketSplit, canonicalDamageType, finesseRatingView, IsFinesseHit } from '../model/combatRatings.js';
import { core2MultiHitRulesEnabled } from '../model/core2ActionPolicy.js';
import { ScaleCardBaseDamage, isSpellCard } from '../model/combatCardProfile.js';
import { sameStance, stanceEntryBonuses, stanceStaminaCost, stanceManaCost } from '../model/stanceRules.js';
import { fixCoreEnabled, fixCorePierceRules, fixCoreSmashVsDefensiveRules, protectionReceipt, damageReceipt, fixCoreWardDisabled, FixCoreWardBlockFirst, FixCoreWardHpBuffer, EffectiveWardHp, FixCoreWeaponPoiseRules, ReceiptPoiseLoss } from '../model/fixCoreMechanics.js';
import {
  EffectivePierceRules,
  EffectiveSmashGuardRules,
  EffectiveBlockBreakAmount,
  EffectivePoiseBreakAmount,
  EffectiveProtectionPipeline,
} from '../model/combatMechanics.js';
import { WeaponPoiseDamage, StanceHasPoiseMitigation } from '../model/weaponPoise.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { mirroredStance, configuredStance, armsAsCoreCounter, isSpellCounter } from '../model/profileStance.js';
import { stanceMitigation } from './stanceMitigation.js';
import { TriangleRules } from '../model/stanceTriangle.js';
import { rememberCombatStance, defensiveCombatStance } from './concurrentStances.js';
import { proposalHitPlan, proposalTargetPlan } from './proposalStatusRuntime.js';
import { hitWeaknessTriggers, matchingHitWeaknesses, weaknessLabel } from './weaknesses.js';

// Configured combat adapter. All rules are scoped to the saved resolved profile;
// a missing/current profile leaves the existing interpreter untouched.
import { gameContent } from '../model/gameProfile.js';
import { ConfiguredCombat as configuredCombat, configuredModule } from '../model/profileModule.js';
import { mechanics } from '../framework/data/mechanics.js';
import { reflectStackCount, reflectCut, reflectReducePct } from './guardStacks.js';
import { AttackDamageMultiplier, PoiseLossAdjust, ApplyDefendPoiseFloor, DefendPoiseFloor, StanceWeaknessMultiplier } from './stanceBenefits.js';
import { FluxMultiplier } from './elementFlux.js';
import { FightMagicShare } from '../model/elementIdentityRules.js';
import { ElementReceiptStages, ElementProtectionView, ElementReceiptFinish, ForcePoiseShare } from './elementIdentity.js';

// A pierce hit: the card tag `pierce` or `damage:piercing`, or a piercing damage type (content/source/tagging.csv, combatRules.js).
// It lets floor(blockBypassFraction x that hit's damage) past Block (fixCoreMechanics.json pierce; owner, 2026-10-26: "pierce should be
// about floor(.2 * damage)"), per hit, after stance and Smash bonuses and before Block; Block soaks the rest. Precision is a hit-roll status in Core, so it is not a pierce tag here.
export function isPierceHit(profile, carrier) {
  const tags = [...(carrier?.authoredTags || []), ...(carrier?.tags || []), ...(carrier?.cardTags || []), ...(profile?.tags || [])];
  return tags.includes('pierce') || tags.includes('damage:piercing')
    || [profile?.damageType, profile?.physicalDamageType].some(type => canonicalDamageType(type) === 'piercing');
}
/** PierceStacks is the shared, pure Pierce count for live hits and forecasts. Stone Skin cancels one stack per stack. */
export function PierceStacks(ctx, target, carrier, profile = carrier?.combatProfile || {}, out = null, maxSpend = Infinity) {
  if (carrier?.combatReaction) return 0;
  const effectivePierce = EffectivePierceRules(fixCoreRules(ctx, target), ctx);
  if (!effectivePierce) return 0;
  const rules = { ...fixCorePierceRules(fixCoreRules(ctx, target)), ...effectivePierce };
  const tags = [...(carrier?.authoredTags || []), ...(carrier?.tags || []), ...(carrier?.cardTags || []), ...(profile?.tags || [])];
  const builtIn = (rules.builtInElements || []).some(element => tags.includes(`school:${element}`) || canonicalDamageType(profile?.damageType) === element || carrier?.damageType === element);
  const tagged = isPierceHit(profile, carrier);
  const intrinsic = tagged || builtIn ? (Number.isFinite(carrier?.pierceStacks) ? Math.max(0, Math.floor(carrier.pierceStacks)) : 1) : 0;
  const stacks = intrinsic + Math.max(0, Math.floor(carrier?.gear?.pierce || 0));
  const skin = rules.skinStatus ? Math.max(0, target?.statuses?.[rules.skinStatus]?.stacks || 0) : 0;
  // Stone Skin is spent only against Pierce that Block actually soaked (`maxSpend`): Block 0 spends none.
  const spent = Math.min(stacks, skin, Math.max(0, maxSpend));
  if (out) out.spent = spent;
  return stacks - spent;
}
/** Each current Pierce stack ignores configured Block. A saved fraction-based fight retains its original pricing and Poise split. */
export function PierceBlockIgnored(ctx, target, carrier, profile, total, blockSoak = Infinity, out = null) {
  if (carrier?.combatReaction || !(total > 0)) return 0;
  const effectivePierce = EffectivePierceRules(fixCoreRules(ctx, target), ctx);
  if (!effectivePierce) return 0;
  const rules = { ...fixCorePierceRules(fixCoreRules(ctx, target)), ...effectivePierce };
  const ignored = Math.max(0, carrier?.gear?.ignoreBlock || 0);
  let bypass;
  if (rules.blockIgnoredPerStack > 0) {
    bypass = Math.floor(PierceStacks(ctx, target, carrier, profile, out, Math.ceil(Math.max(0, blockSoak) / rules.blockIgnoredPerStack)) * rules.blockIgnoredPerStack);
  } else {
    // The old fraction belongs to the saved fight, and gear Pierce remains a flat grant.
    const tags = [...(carrier?.authoredTags || []), ...(carrier?.tags || []), ...(carrier?.cardTags || []), ...(profile?.tags || [])];
    const builtIn = (rules.builtInElements || []).some(element => tags.includes(`school:${element}`) || canonicalDamageType(profile?.damageType) === element || carrier?.damageType === element);
    bypass = isPierceHit(profile, carrier) || builtIn ? Math.floor(rules.blockBypassFraction * total) : 0;
    bypass += Math.max(0, carrier?.gear?.pierce || 0);
    const skin = rules.skinStatus ? target?.statuses?.[rules.skinStatus]?.stacks || 0 : 0;
    const spent = Math.min(bypass, skin, Math.max(0, blockSoak));
    if (out) out.spent = spent;
    bypass -= spent;
  }
  // Only built-in elemental Pierce is stopped by Earth-sourced Block; an explicit Pierce tag/gear grant still works.
  if (!isPierceHit(profile, carrier) && !(carrier?.gear?.pierce > 0) && rules.earthSource) bypass = Math.min(bypass, Math.max(0, blockSoak - Math.min(target?.earthBlock || 0, target?.block || 0)));
  return bypass + ignored;
}

export { configuredCombat, configuredModule };
// configuredStance / mirroredStance / armsAsCoreCounter live in the model layer (profileStance.js) so the card inspector shares them.
export { mirroredStance, configuredStance, armsAsCoreCounter, isSpellCounter };
export function setProfileStance(ctx, entity, carrier) {
  if (!configuredCombat(ctx)) return false;
  if (fixCoreEnabled(ctx) && carrier && carrier.fixCoreSameStance === undefined) carrier.fixCoreSameStance = sameStance(entity, carrier);
  if (fixCoreEnabled(ctx)) entity.matchingStanceCardMultiplier = carrier?.fixCoreSameStance ? fixCoreRules(ctx, entity, carrier).stance.effectivenessMultiplier - 1 : 0;
  const previous=entity.combatStance;
  const entering = entity?.itemProps && !sameStance(entity,carrier);
  // A registry stance entry (enterStance) is a stance-only change: no maneuver entry grant, which the card face does not quote.
  const grants = !carrier?.registryStanceEntry && fixCoreEnabled(ctx) && !sameStance(entity,carrier) ? stanceEntryBonuses(carrier,ctx) : null;
  // Under the triangle its own include list holds, so skill stays skill.
  const rule = TriangleRules(ctx) || configuredModule(ctx, 'stances');
  const stance = configuredStance(carrier, ctx);
  entity.combatStance = rule?.include?.includes(stance)
    ? { maneuver: stance, camp: carrier?.combatProfile?.camp || 'physical', range: carrier?.combatProfile?.range || 'melee',
      ...(mirroredStance(carrier) ? { mirrored: true, camp: 'spell' } : {}) }
    : { maneuver: 'neutral', camp: 'physical', range: 'melee' };
  if (grants?.precision > 0) applyStatus(ctx,entity,'precision',precisionEntryGrant(ctx,entity,grants.precision,carrier),entity,
    { tags: carrier.cardTags || carrier.tags || [] });
  if (grants?.evade > 0 && !carrier?.appliedStatuses?.includes('evade')) applyStatus(ctx,entity,'evade',grants.evade,entity);
  rememberCombatStance(ctx,entity,previous);
  ctx.emit?.('combatStanceChanged', { targetId: entity.id, maneuver: entity.combatStance.maneuver,
    ...(carrier?.stanceFromEffect ? { cardInstanceId: carrier.instanceId } : {}) });
  if (entering && entity.combatStance.maneuver !== 'neutral') QueueItemStanceEntry(ctx, entity); // W25 step 6

  return true;
}
function rating(entity, name) {
  const value = entity?.ratings?.[name] ?? entity?.[name] ?? 0;
  return Number.isFinite(value) ? value : 0;
}
function hasPoise(target) {
  return (target?.gameProfilePoise ?? target?.poise ?? target?.ratings?.poise
    ?? target?.poiseMax ?? target?.poiseMeter?.max ?? 0) > 0;
}

// Pure probability/receipt math: execution supplies a transactional RNG roll. No RNG,
// source mutation, legacy elemental/rank riders, or protection-pool depletion.
// Reflect cuts and returns hits that come from another body and are neither reactive returns nor unreflectable.
function reflectApplies(target, source, carrier, profile) {
  if (!(reflectStackCount(target) > 0) || !source || source === target) return false;
  if (carrier?.reflectedHit || carrier?.counterReturnAttack || carrier?.proposalReactive) return false;
  return !(profile?.traits?.includes('unreflectable') || profile?.combatTraits?.unreflectable === true || (Array.isArray(profile?.combatTraits) && profile.combatTraits.includes('unreflectable')) || (carrier?.tags || []).includes(mechanics.reflect.unreflectableTag));
}
// `forecast`: a preview of an attack that will certainly be avoided (Evade, out of range, hit roll off) prices 0 HP, as the play will; the landed receipt never sets it.
/** A Force hit's Poise share of what Block left (`poiseIn`): Poise absorbs that share (never more than it holds) and HP takes the rest, rounded down. Keeps the normal absorption if that is larger. */
function ForcePoiseReceipt(target, poiseIn, share, normal) {
  const held = Math.max(0, target?.persistentPoise?.value || 0);
  const reduced = Math.min(held, poiseIn - Math.floor(poiseIn * (1 - share)));
  if (reduced <= normal.reduced) return normal;
  return { ...normal, amount: poiseIn - reduced, reduced,
    sources: [{ id: 'force-poise-share', label: 'Force: a share of the hit goes to Poise', stage: 'mitigation', operation: 'multiply', multiplier: 1 - share, amount: -reduced, requested: poiseIn, effective: poiseIn - reduced }] };
}
export function profileDamageReceipt(ctx, source, target, base, carrier = {}, options = {}) {
  // Element identity (W25): Necrotic ignores Poise and Fire ignores some of it, so the hit meets a smaller pool (restored below, never kept);
  // Force and Fire then take extra Poise. Without `elements` rules the view is null and this is exactly the receipt below.
  // Owner, 2026-11-17 (theme B): a Defend-stance target holding Block keeps at least 1 Poise against what the hit costs it (ApplyDefendPoiseFloor).
  const view = ElementProtectionView(ctx, source, target, carrier);
  if (!view) return SpellPoiseFinish(ctx, source, target, carrier, ApplyDefendPoiseFloor(ctx, target, carrier, ElementReceiptFinish(ctx, carrier, profileDamageReceiptCore(ctx, source, target, base, carrier, options), null, target?.persistentPoise)));
  const real = target.persistentPoise.value;
  target.persistentPoise.value = view.value;
  let receipt;
  try { receipt = profileDamageReceiptCore(ctx, source, target, base, carrier, options); } finally { target.persistentPoise.value = real; }
  // An active HP buffer stops the whole hit's Poise damage when there is no overflow,
  // including Fire's additional drain at this later receipt stage.
  const wardProtected = FixCoreWardHpBuffer(ctx) && EffectiveWardHp(ctx, target) > 0
    && receipt.damageReceipt.hits[0].incoming <= receipt.blocked + (receipt.wardHpAbsorbed ?? 0);
  const finished = ElementReceiptFinish(ctx, carrier, receipt, wardProtected ? null : view, { value: real });
  return SpellPoiseFinish(ctx, source, target, carrier, ApplyDefendPoiseFloor(ctx, target, carrier, finished));
}
/**
 * Owner, 2026-11-18: a player's spell takes `effects.spellPoiseDamageMultiplier` times the Poise it costs an enemy. Applied last, to the completed net loss
 * (absorbed + Poise damage + the element's ignored or Force Poise, less what a Defend target spared), never past the pool the hit leaves; HP is unchanged.
 * The one place for the live hit and the preview, so the quote equals the play. actions.js drainFixCorePoise and combatDamagePreview.js read the same factor for explicit Poise effects.
 */
function SpellPoiseFinish(ctx, source, target, carrier, receipt) {
  if (!receipt || receipt.evaded || !fixCoreEnabled(ctx) || carrier?.counterReturnAttack) return receipt;
  // Weapon-poise rules handle sceptre/staff/bow poise scaling natively (+20% weaponTypePoiseMultiplier).
  if (FixCoreWeaponPoiseRules(ctx)) return receipt;
  const m = SpellPoiseMultiplier(configuredModule(ctx, 'effects'), source, target, carrier);
  if (!(m > 1)) return receipt;
  const net = ReceiptPoiseLoss(receipt);
  // A Defend target's Poise floor holds against the extra whether or not the base hit reached it: the same predicate ApplyDefendPoiseFloor reads.
  const pool = Math.max(0, Math.floor(target?.persistentPoise?.value || 0));
  const keep = Math.min(pool, DefendPoiseFloor(ctx, target, carrier, receipt.defenseStance));
  const left = Math.max(0, pool - net - keep);
  const extra = Math.max(0, Math.min(Math.floor((m - 1) * net), left));
  if (extra > 0) {
    receipt.poiseDrain = (receipt.poiseDrain || 0) + extra;
    // The nested damage receipt (log, inspector breakdown) shows the doubled Poise damage too.
    const hit = receipt.damageReceipt?.hits?.[0];
    if (hit) hit.poiseDamage = (hit.poiseDamage || 0) + extra;
  }
  return receipt;
}
/** The factor a player's spell-camp card puts on the Poise it takes from an enemy (1 otherwise); `carrier` is the card or its hit carrier. */
export function SpellPoiseMultiplier(effects, source, target, carrier) {
  const m = effects?.spellPoiseDamageMultiplier;
  return source?.kind === 'player' && target?.kind === 'enemy' && Number.isFinite(m) && m > 1 && (isSpellCard(carrier) || carrier?.combatProfile?.camp === 'spell') ? m : 1;
}
/** The effects module's physical-damage factor (1 when unset), applied to the physical share of a hit for both sides. */
export function PhysicalDamageMultiplier(effects) { return Offense.PhysicalDamageMultiplier(effects); }
export function SideDamageMultiplier(effects, source) { return Offense.SideDamageMultiplier(effects, source); }
export const IsPacketHit = (ctx, source, carrier, profile, share) => Offense.IsPacketHit(ctx, source, carrier, profile, share);
/**
 * PacketFaceSplit(ctx, source, carrier, authoredBase, total) → { physical, magic } for the face number `total` of a packet hit, or null for any
 * other hit: the same two channels the receipt reads (STR / AR for the physical part, INT / Power for the magic part).
 */
export function PacketFaceSplit(ctx, source, carrier, authoredBase, total) {
  const profile = { ...(carrier?.combatProfile || {}), ...(Number.isFinite(carrier?.magicShare) ? { magicShare: carrier.magicShare } : {}) };
  const share = FightMagicShare(ctx, profile);
  if (!IsPacketHit(ctx, source, carrier, profile, share) || carrier.skipRatingBonus) return null;
  const effects = configuredModule(ctx, 'effects');
  const finesse = core2MultiHitRulesEnabled(ctx) && IsFinesseHit(ctx, source, carrier, 'ar');
  const channel = (id, entity) => Math.max(0, Math.floor(sourceRatingValue(ctx, entity, id, carrier.sourceArmamentId, carrier.equipmentScoped, carrier) * ChannelWeight(effects, id)));
  return PacketSplit({ base: ScaleCardBaseDamage(authoredBase, effects?.baseDamageMultiplier), share, physicalBonus: channel('ar', finesse ? finesseRatingView(source) : source), magicBonus: channel('pr', source),
    magicMultiplier: PacketMagicMultiplier(FluxMultiplier(ctx, source, carrier)),
    physicalMultiplier: carrier.counterReturnAttack || carrier.reflectedHit || carrier.proposalReactive ? 1 : PhysicalDamageMultiplier(effects), total });
}
/** The factor only a packet's magic part takes: elemental flux (owner ruling, 2026-11-20). Burn, element Vulnerable and the other element stages scale the whole hit. */
export const PacketMagicMultiplier = flux => Offense.PacketMagicMultiplier(flux);
const BREAK_BLOCK_SOURCE_ID = 'break-block';
const BREAK_POISE_SOURCE_ID = 'break-poise';

/** Return a carrier copy without flat break fields, or the original if none were set. */
export function StripFlatBreakCarrier(carrier)
{
  if (!carrier)
  {
    return carrier;
  }

  const hasFlatBreak = Boolean(carrier.breakBlock || carrier.blockBreak || carrier.breakPoise);
  if (!hasFlatBreak)
  {
    return carrier;
  }

  const {
    breakBlock,
    blockBreak,
    breakPoise,
    ...rest
  } = carrier;

  return rest;
}

/** Flat Block/Poise break capped by target's pools, or null if none. */
export function HitBreakAmounts(target, carrier, context = null)
{
  const requestedBlock = EffectiveBlockBreakAmount(carrier, 0, null, context);
  const requestedPoise = EffectivePoiseBreakAmount(carrier, context);
  const targetBlock = Math.max(0, target?.block || 0);
  const targetPoise = Math.max(0, target?.persistentPoise?.value || 0);

  const block = Math.min(targetBlock, requestedBlock);
  const poise = Math.min(targetPoise, requestedPoise);

  return block > 0 || poise > 0
    ? { block, poise }
    : null;
}

/** Carrier with flat break attached on the first hit per target only. */
export function HitBreakCarrier(carrier, effect, hitIndex = 0)
{
  const stripped = StripFlatBreakCarrier(carrier);
  const flatBlock = effect?.breakBlock ?? effect?.blockBreak;
  const hasBreak = Boolean(effect && (flatBlock > 0 || effect.breakPoise > 0));

  if (hitIndex > 0 || !hasBreak)
  {
    return stripped;
  }

  const nextCarrier = { ...stripped };

  if (flatBlock > 0)
  {
    nextCarrier.breakBlock = flatBlock;
  }

  if (effect.breakPoise > 0)
  {
    nextCarrier.breakPoise = effect.breakPoise;
  }

  return nextCarrier;
}

function resolveFlatBreak(target, carrier, requestedBlockBreak, context, isModern, isEvaded, isFlatReturn)
{
  const initialBlockPool = Math.max(0, target?.block || 0);
  const canBreakBlock = !isEvaded && !isFlatReturn && requestedBlockBreak > 0;
  const flatBlockBroken = canBreakBlock
    ? Math.min(initialBlockPool, requestedBlockBreak)
    : 0;

  const requestedPoiseBreak = isModern && !isFlatReturn
    ? EffectivePoiseBreakAmount(carrier, context)
    : 0;
  const canBreakPoise = !isEvaded && !isFlatReturn && requestedPoiseBreak > 0;
  const currentPoise = Math.max(0, target?.persistentPoise?.value || 0);
  const flatPoiseBroken = canBreakPoise
    ? Math.min(currentPoise, requestedPoiseBreak)
    : 0;

  const broken = flatBlockBroken > 0 || flatPoiseBroken > 0
    ? { block: flatBlockBroken, poise: flatPoiseBroken }
    : null;
  const effectiveBlockPool = Math.max(0, initialBlockPool - flatBlockBroken);
  const breakSources = [];
  let targetAfterBreak = target;

  if (flatBlockBroken > 0)
  {
    breakSources.push({
      id: BREAK_BLOCK_SOURCE_ID,
      label: 'Break Block',
      amount: flatBlockBroken,
      requested: initialBlockPool,
      effective: effectiveBlockPool,
      stage: 'mitigation',
      operation: 'subtract',
    });
  }

  if (flatPoiseBroken > 0)
  {
    const remainingPoise = target.persistentPoise.value - flatPoiseBroken;

    breakSources.push({
      id: BREAK_POISE_SOURCE_ID,
      label: 'Break Poise',
      amount: flatPoiseBroken,
      requested: target.persistentPoise.value,
      effective: remainingPoise,
      stage: 'mitigation',
      operation: 'subtract',
    });

    targetAfterBreak = {
      ...target,
      persistentPoise: {
        ...target.persistentPoise,
        value: remainingPoise,
      },
    };
  }

  return {
    broken,
    flatBlockBroken,
    effectiveBlockPool,
    targetAfterBreak,
    breakSources,
  };
}

function attachOptionalFields(targetObject, fieldEntries)
{
  for (const [shouldInclude, key, value] of fieldEntries)
  {
    if (shouldInclude)
    {
      targetObject[key] = value;
    }
  }

  return targetObject;
}

function buildDamageReceiptHitEntry(fields)
{
  const hitEntry = {
    incoming: fields.incoming,
    physical: fields.physical,
    magical: fields.magical,
    blocked: fields.blocked,
    barrierReduced: fields.barrierMitigated,
    wardReduced: fields.wardMitigated,
    poiseReduced: fields.poiseMitigated,
    hpLoss: fields.amount,
    sources: fields.sources,
  };

  return attachOptionalFields(hitEntry, [
    [Boolean(fields.broken?.block), 'blockBroken', fields.broken?.block],
    [Boolean(fields.broken?.poise), 'poiseBroken', fields.broken?.poise],
    [Boolean(fields.pierceBypassed), 'pierced', fields.pierceBypassed],
    [Boolean(fields.pierceBypassed), 'piercePoise', fields.piercePoise],
    [Boolean(fields.magicPoise), 'magicPoise', fields.magicPoise],
    [Boolean(fields.poiseDrain), 'poiseDamage', fields.poiseDrain],
  ]);
}

function selectProtectionPipelineId(flags)
{
  if (flags.wardBlockFirst)
  {
    return 'protection.wardBlockFirst';
  }

  if (flags.wardRouted)
  {
    return 'protection.wardPoiseFirst';
  }

  if (flags.weaponPoiseRules)
  {
    return 'protection.weaponPoise';
  }

  if (flags.wardHpMode && flags.wardHpPool > 0)
  {
    return 'protection.wardHpBuffer';
  }

  if (flags.isModern)
  {
    return 'protection.standard';
  }

  return null;
}

const PROTECTION_STAGE_HANDLERS = Object.freeze({
  block(state, pipeline)
  {
    const before = state.amount;
    const blockSoak = Math.min(state.effectiveBlockPool, before);
    state.blockSpent = state.flatBlockBroken + blockSoak;

    const bypassAmount = pipeline.pierceApplies !== false
      ? PierceBlockIgnored(
          state.context,
          state.target,
          state.carrier,
          state.profile,
          state.totalIncoming,
          blockSoak,
          state.pierceOut,
        )
      : 0;
    state.pierceBypassed = Math.min(bypassAmount, blockSoak);
    state.blocked = blockSoak - state.pierceBypassed;
    state.amount = before - state.blocked;

    const label = state.wardPoiseRan
      ? 'Block (after Poise)'
      : 'Block';
    state.transition('block', label, before, state.amount, 'mitigation');
  },

  wardPoise(state, pipeline)
  {
    const before = state.amount;
    const poisePool = Math.max(0, state.target?.persistentPoise?.value || 0);
    const skipAbsorption = Boolean(state.smashRule && pipeline.smashSkipsPoiseAbsorption !== false);
    const toPoise = skipAbsorption
      ? 0
      : Math.min(before, poisePool);

    if (state.smashRule && !state.evaded)
    {
      state.poiseDrain = Math.min(poisePool, Math.floor(state.smashRule.poiseFraction * state.incoming));
    }

    state.poiseMitigated = toPoise;
    state.amount = before - toPoise;
    state.wardPoiseRan = true;

    const label = state.blockSpent !== null
      ? 'Poise (Ward: absorbs the whole rest)'
      : 'Poise (Ward: all damage meets Poise first)';
    state.transition('ward-poise', label, before, state.amount, 'mitigation');
  },

  wardHp(state)
  {
    const before = state.amount;
    state.wardHpAbsorbed = Math.min(before, state.wardHpPool);
    state.wardMitigated = state.wardHpAbsorbed;
    state.amount = before - state.wardHpAbsorbed;
    state.amountAfterWard = state.amount;
    state.transition('ward-hp', 'Ward (health buffer)', before, state.amount, 'mitigation');
  },

  stancePoise(state)
  {
    const before = state.amount;
    const rules = state.weaponPoiseRules;
    const poisePool = Math.max(0, state.target?.persistentPoise?.value || 0);
    const canMitigate = before > 0
      && poisePool > 0
      && StanceHasPoiseMitigation(rules, state.defending);

    if (canMitigate)
    {
      const poiseFraction = rules.mitigationPoiseFraction ?? 0.5;
      const drainFraction = rules.mitigationDrainDamageFraction ?? 0.5;
      const drainFlat = rules.mitigationDrainFlat ?? 1;

      state.poiseMitigated = Math.min(before, Math.floor(poisePool * poiseFraction));
      state.poiseMitigationCost = Math.min(poisePool, Math.floor(before * drainFraction) + drainFlat);
      state.amount = before - state.poiseMitigated;
      state.transition('poise-mitigation', 'Poise reduction', before, state.amount, 'mitigation');
    }
    else
    {
      state.poiseMitigationCost = 0;
    }
  },

  weaponPoiseDrain(state, pipeline)
  {
    const afterWard = state.amountAfterWard ?? state.amount;
    const wardAllowsDrain = pipeline.wardShieldsPoise === false
      || state.wardHpPool === 0
      || afterWard > 0;
    const canDrain = !state.evaded && !state.flatReturn && state.incoming > 0 && wardAllowsDrain;

    if (!canDrain)
    {
      return;
    }

    const poisePool = Math.max(0, state.target?.persistentPoise?.value || 0);
    const weaponResult = WeaponPoiseDamage(
      state.context,
      state.source,
      state.target,
      state.carrier,
      {
        attacking: state.attacking,
        defending: state.defending,
        rules: state.weaponPoiseRules,
      },
    );
    state.weaponPoiseDamage = weaponResult.amount;

    const remainingPoise = Math.max(0, poisePool - (state.poiseMitigationCost || 0));
    state.poiseDrain = Math.min(remainingPoise, state.weaponPoiseDamage);
  },

  standardPoiseAfterWard(state, pipeline)
  {
    const afterWard = state.amount;
    if (!(afterWard > 0))
    {
      state.amount = 0;
      return;
    }

    const remPhysical = Math.max(0, state.physical - state.blocked - state.wardHpAbsorbed);
    const remMagical = Math.max(0, afterWard - remPhysical);
    const poisePool = Math.max(0, state.target?.persistentPoise?.value || 0);
    const skipAbsorption = Boolean(state.smashRule && pipeline.smashSkipsPoiseAbsorption !== false);

    const forceShare = skipAbsorption
      ? null
      : ForcePoiseShare(state.context, state.carrier);
    const normalPoise = skipAbsorption
      ? { amount: remPhysical, reduced: 0, sources: [] }
      : protectionReceipt(state.context, state.target, 'physical', remPhysical);
    const poise = forceShare === null
      ? normalPoise
      : ForcePoiseReceipt(state.target, remPhysical, forceShare, normalPoise);

    const poiseMeetsMagic = fixCoreWardDisabled(state.context);
    state.magicPoise = poiseMeetsMagic && !skipAbsorption
      ? Math.min(remMagical, Math.max(0, poisePool - poise.reduced))
      : 0;
    const magicToHp = remMagical - state.magicPoise;

    if (state.smashRule && !state.evaded)
    {
      state.poiseDrain = Math.min(poisePool, Math.floor(state.smashRule.poiseFraction * afterWard));
    }

    state.poiseMitigated = poise.reduced + state.magicPoise;
    state.sources.push(...poise.sources);

    if (state.magicPoise > 0)
    {
      state.sources.push({
        id: 'poise-magic',
        label: 'Poise meets the spell',
        amount: -state.magicPoise,
        requested: remMagical,
        effective: magicToHp,
        stage: 'mitigation',
        operation: 'add',
      });
    }

    state.amount = poise.amount + magicToHp;
  },

  standardSplit(state, pipeline)
  {
    const blockPool = state.effectiveBlockPool;
    const poiseMeetsMagic = fixCoreWardDisabled(state.context);
    const skipAbsorption = Boolean(state.smashRule && pipeline.smashSkipsPoiseAbsorption !== false);
    const plainPhysicalBlocked = Math.min(blockPool, state.physical);

    let plainMagicBlocked;
    if (poiseMeetsMagic)
    {
      const poisePoolFull = Math.max(0, state.target?.persistentPoise?.value || 0);
      const plainPoise = skipAbsorption
        ? { reduced: 0 }
        : protectionReceipt(state.context, state.target, 'physical', state.physical - plainPhysicalBlocked);
      const plainMagicPoise = skipAbsorption
        ? 0
        : Math.min(state.magical, Math.max(0, poisePoolFull - plainPoise.reduced));
      plainMagicBlocked = Math.min(blockPool - plainPhysicalBlocked, state.magical - plainMagicPoise);
    }
    else
    {
      plainMagicBlocked = Math.min(blockPool - plainPhysicalBlocked, state.magical);
    }

    const plainSoaked = plainPhysicalBlocked + plainMagicBlocked;
    state.blockSpent = state.flatBlockBroken + plainSoaked;

    const bypassAmount = pipeline.pierceApplies !== false
      ? PierceBlockIgnored(
          state.context,
          state.target,
          state.carrier,
          state.profile,
          state.totalIncoming,
          plainSoaked,
          state.pierceOut,
        )
      : 0;
    state.pierceBypassed = Math.min(bypassAmount, plainSoaked);

    const piercedPhysicalPart = Math.min(state.pierceBypassed, plainPhysicalBlocked);
    const physicalBlocked = plainPhysicalBlocked - piercedPhysicalPart;
    const magicBypass = state.pierceBypassed - piercedPhysicalPart;
    let magicBlocked = plainMagicBlocked - magicBypass;

    const poisePool = Math.max(0, state.target?.persistentPoise?.value || 0);
    const stackPierce = fixCorePierceRules(fixCoreRules(state.context, state.target)).blockIgnoredPerStack > 0;
    const piercePhysical = skipAbsorption || stackPierce
      ? 0
      : piercedPhysicalPart;

    state.piercePoise = Math.min(piercePhysical, poisePool);
    const pierceToHp = piercePhysical - state.piercePoise;
    const afterPierce = state.piercePoise > 0
      ? {
          ...state.target,
          persistentPoise: {
            ...state.target.persistentPoise,
            value: poisePool - state.piercePoise,
          },
        }
      : state.target;

    const poiseIn = state.physical - piercePhysical - physicalBlocked;
    const forceShare = skipAbsorption
      ? null
      : ForcePoiseShare(state.context, state.carrier);
    const normalPoise = skipAbsorption
      ? { amount: poiseIn, reduced: 0, sources: [] }
      : protectionReceipt(state.context, afterPierce, 'physical', poiseIn);
    const poise = forceShare === null
      ? normalPoise
      : ForcePoiseReceipt(afterPierce, poiseIn, forceShare, normalPoise);

    state.magicPoise = poiseMeetsMagic && !skipAbsorption
      ? Math.min(state.magical, Math.max(0, poisePool - state.piercePoise - poise.reduced))
      : 0;
    const magicAfterPoise = state.magical - state.magicPoise;

    if (poiseMeetsMagic)
    {
      magicBlocked = Math.min(magicBlocked, magicAfterPoise);
    }

    state.blocked = physicalBlocked + magicBlocked;
    const magicAfterBlock = magicAfterPoise - magicBlocked;
    state.barrierMitigated = 0;

    const magicToHp = poiseMeetsMagic
      ? magicAfterBlock - state.barrierMitigated
      : 0;
    const wardInput = poiseMeetsMagic
      ? 0
      : magicAfterBlock - state.barrierMitigated;
    const ward = protectionReceipt(state.context, state.target, 'magical', wardInput);

    if (state.smashRule && !state.evaded)
    {
      state.poiseDrain = Math.min(
        poisePool - state.piercePoise,
        Math.floor(state.smashRule.poiseFraction * state.incoming),
      );
    }

    state.poiseMitigated = poise.reduced + state.piercePoise + state.magicPoise;
    state.wardMitigated = ward.reduced;

    if (poiseMeetsMagic)
    {
      state.transition('block', 'Block', state.physical, state.physical - physicalBlocked, 'mitigation');
      state.sources.push(...poise.sources);

      if (state.magicPoise > 0)
      {
        state.sources.push({
          id: 'poise-magic',
          label: 'Poise meets the spell',
          amount: -state.magicPoise,
          requested: state.magical,
          effective: magicAfterPoise,
          stage: 'mitigation',
          operation: 'add',
        });
      }

      if (magicBlocked > 0)
      {
        state.sources.push({
          id: 'block-magic',
          label: 'Block (after Poise)',
          amount: -magicBlocked,
          requested: magicAfterPoise,
          effective: magicAfterBlock,
          stage: 'mitigation',
          operation: 'add',
        });
      }

      state.transition('barrier', 'Bonus Poise', magicAfterBlock, magicAfterBlock - state.barrierMitigated, 'mitigation');
    }
    else
    {
      state.transition('block', 'Block', state.totalIncoming, state.totalIncoming - state.blocked, 'mitigation');
      state.transition('barrier', 'Bonus Poise', magicAfterBlock, magicAfterBlock - state.barrierMitigated, 'mitigation');
      state.sources.push(...poise.sources);
    }

    state.sources.push(...ward.sources);
    state.amount = poise.amount + ward.amount + pierceToHp + magicToHp;
  },
});

function runProtectionPipeline(pipeline, state)
{
  const order = Array.isArray(pipeline?.order)
    ? pipeline.order
    : [];

  for (const stageId of order)
  {
    const handler = PROTECTION_STAGE_HANDLERS[stageId];
    if (handler)
    {
      handler(state, pipeline);
    }
  }
}
function profileDamageReceiptCore(ctx, source, target, base, carrier = {}, { roll = null, proposal = true, forecast = false } = {}) {
  const pierceOut = { spent: 0 };
  const offense = Offense.ProfileDamageOffense(ctx, source, target, base, carrier,
    { getAdd, AttackDamageMultiplier, FluxMultiplier, StanceWeaknessMultiplier, ElementReceiptStages, defensiveCombatStance, hitWeaknessTriggers, matchingHitWeaknesses, weaknessLabel });
  base = offense.base;
  let { raw } = offense;
  const { effects, stances, defenses, attacking, defending, advantage, modern, flatReturn, authoredBase, sources, transition, profile, share, packetHit, ratingId, ratingBonus, packetPower, weaknessMultiplier, weaknesses, element, packetMagicMultiplier, physicalMultiplier } = offense;
  if (!modern) raw=Math.max(0,Math.floor(raw));
  // An ally's Guard interception lowers `raw` here; kept so the displayed raw hit can add it back (Guard is a defense, owner 2026-11-04).
  let guardIntercepted = 0;
  if(proposal && target && !flatReturn) {
    const statusPlan = proposalHitPlan(ctx,source,target,raw,carrier,{roundDamage:!modern});
    guardIntercepted = Math.max(0, Number(statusPlan.redirect?.amount) || 0);
    raw=transition('status-rules','Other status modifiers',raw,statusPlan.amount);
  }
  // An item property's resistance or immunity to this damage type (W25 step 6) scales the hit like a status modifier does.
  const itemPercent = target?.itemProps ? ItemIncomingPercent(target, canonicalDamageType(profile.damageType), (carrier?.tags || []).find(tag => typeof tag === 'string' && tag.startsWith('school:'))?.slice(7)) : 0;
  if (itemPercent) raw = transition('item-resist', itemPercent <= -100 ? 'Immunity (item)' : 'Resistance (item)', raw, Math.max(0, raw * (100 + itemPercent) / 100), 'offense', Math.max(0, (100 + itemPercent) / 100));
  const defense = stanceMitigation(ctx, attacking, defending);
  // Owner, 2026-10-19: a Smash that beats the target's stance (Defend or Prepared) deals the configured multiplier of its normal damage in place of the
  // generic advantage multiplier, plus a share of the target's Block (below), and costs Poise by a share of the total instead of the 25% absorption.
  // Controlled via content/source/mechanics/guardInteraction.json (`smashVsDefensive.mode`: "multiplier" | "flatBreak" | "both").
  // The triangle's winner takes only winnerMultiplier: no Smash guard rule, no weakness max.
  const triangle = TriangleRules(ctx);
  const smashGuard = !triangle && modern && advantage && attacking === 'smash';
  const rawSmashRule = smashGuard
    ? EffectiveSmashGuardRules(fixCoreRules(ctx, target), ctx)
    : null;
  const smashRule = rawSmashRule ? { ...fixCoreSmashVsDefensiveRules(fixCoreRules(ctx, target)), ...rawSmashRule } : null;
  const smashFlatOnly = smashRule?.mode === 'flatBreak';
  const flatBlockBreakRequested = modern ? EffectiveBlockBreakAmount(carrier, raw, smashRule, ctx) : 0;
  if (smashFlatOnly && smashRule.flatBreak && Number.isFinite(smashRule.flatBreak.damageScale) && smashRule.flatBreak.damageScale !== 1) {
    raw = transition('smash-flat-scale', 'Smash flat-break damage scale', raw, raw * smashRule.flatBreak.damageScale, 'stance', smashRule.flatBreak.damageScale);
  }
  // Core 2 Counter returns carry their advantage in the return itself (SPEC §17), so the chain does not multiply it again.
  const smashMultiplier = smashRule && !smashFlatOnly
    ? (defending === 'defend' ? smashRule.defendDamageMultiplier ?? smashRule.damageMultiplier : smashRule.damageMultiplier)
    : 1;
  const winnerMultiplier = triangle
    ? triangle.winnerMultiplier
    : stances?.advantageMultiplier;
  const winnerApplies = advantage && !flatReturn;
  const matchupMultiplier = smashRule
    ? smashMultiplier
    : winnerApplies
      ? winnerMultiplier ?? 1
      : 1;
  // Owner, 2026-11-17 (stance decisions): a stance advantage and the target's stance weakness (Attack or Smash beating Prepared, and Prepared's melee
  // weakness) never stack: the hit takes the larger of the two. The weakness already sits in `raw`, so the advantage stage adds only what it exceeds.
  const sharesWeakness = !triangle && matchupMultiplier > 1 && weaknessMultiplier > 1;
  const advantageMultiplier = sharesWeakness
    ? Math.max(matchupMultiplier, weaknessMultiplier) / weaknessMultiplier
    : matchupMultiplier;
  let amount=smashRule ? transition('smash-vs-defensive','Smash vs defensive stance',raw,raw*advantageMultiplier,'stance',advantageMultiplier)
    : transition('stance-advantage','Offensive stance advantage',raw,raw*advantageMultiplier,'stance',advantageMultiplier);
  // Owner, 2026-11-03: the number shown ahead of a hit is the raw hit, changed only by stances and statuses (attacker Strength/Weak, defender
  // Vulnerable, stance matchups) and damage-type weakness/resistance, never by what the defender does about it (defensive stance, Reflect, Block,
  // Poise, Ward, Barrier, Counter, Evade, AC, an ally's Guard interception, owner 2026-11-04). Display only: `amount`/`hpLoss` below still drive resolution unchanged.
  const rawHit = Offense.DamageIncoming(amount + guardIntercepted * advantageMultiplier);
  amount=transition('stance-defense','Defensive stance advantage',amount,amount*(flatReturn?1:defense.multiplier),'stance',flatReturn?1:defense.multiplier);
  amount=modern ? Math.max(0,Math.floor(amount)) : transition('quantity-rounding','Damage quantity rounding',amount,Math.max(0,Math.floor(amount)),'rounding');
  const targeting=proposalTargetPlan(ctx,source,target,carrier);
  // Owner 2026-11-01: Evade is a tag and a status, not a stance, so no stance rolls the configured hit chance any more.
  let hitChance = 1;
  hitChance=targeting.unavoidable ? 1 : Math.max(0.05,Math.min(1,hitChance+targeting.accuracyDelta/100));
  if (fixCoreEnabled(ctx)) hitChance = (attackHitPreview(ctx, source, target, carrier, forecast ? { assumeInRange: true } : {})?.hitChance ?? 100) / 100;
  const evaded = roll !== null ? roll >= hitChance : forecast && fixCoreEnabled(ctx) && hitChance === 0;
  if (evaded) amount = 0;
  // Flat Block & Poise break (destroys before normal mitigation; never touches Ward).
  const flatBreak = resolveFlatBreak(
    target,
    carrier,
    flatBlockBreakRequested,
    ctx,
    modern,
    evaded,
    flatReturn,
  );
  const {
    broken,
    flatBlockBroken,
    effectiveBlockPool,
  } = flatBreak;

  sources.push(...flatBreak.breakSources);
  target = flatBreak.targetAfterBreak;
  // Reflect (owner 2026-10-31, SPEC §17): the target's Reflect stacks cut this hit before Block; the stacks and the pre-cut
  // figure ride on the receipt so the landed hit can send its share back. A reflected, countered or unreflectable hit is not cut.
  let reflect = null;
  if (modern && amount > 0 && !evaded && reflectApplies(target, source, carrier, profile)) {
    const stacks = reflectStackCount(target);
    reflect = { stacks, original: amount };
    amount = transition('reflect','Reflect',amount,reflectCut(amount,stacks),'mitigation',(100-reflectReducePct(stacks))/100);
  }
  let blocked = 0, poiseMitigated = 0, wardMitigated = 0, poiseDrain = 0;
  let poiseMitigationCost = undefined, weaponPoiseDamage = 0;
  const incoming = amount;
  const parts = packetHit ? PacketSplit({base,share,physicalBonus:ratingBonus,magicBonus:packetPower,magicMultiplier:packetMagicMultiplier,physicalMultiplier,total:incoming}) : splitContactParts({amount:incoming,base,ratingBonus,share,ratingPart:ratingId === 'pr' || share >= 1 ? 'magic' : 'physical',primary:share >= 1 ? 'magic' : 'physical'});
  let physical = modern ? parts.physical : incoming, magical = modern ? parts.magic : 0;
  let barrierMitigated = 0, pierceBypassed = 0, piercePoise = 0, magicPoise = 0, blockSpent = null, wardHpAbsorbed = 0;
  // Mitigation pipeline configured by content/source/mechanics/protection.json.
  const wardHpMode = modern && FixCoreWardHpBuffer(ctx);
  const wardHpPool = wardHpMode
    ? EffectiveWardHp(ctx, target)
    : 0;
  const weaponPoiseRules = modern
    ? FixCoreWeaponPoiseRules(ctx)
    : null;
  const wardRouted = modern && !wardHpMode && (target?.statuses?.ward?.stacks || 0) > 0;
  const wardBlockFirst = wardRouted && FixCoreWardBlockFirst(ctx);

  const pipelineId = selectProtectionPipelineId({
    isModern: modern,
    wardBlockFirst,
    wardRouted,
    weaponPoiseRules,
    wardHpMode,
    wardHpPool,
  });
  const activePipeline = EffectiveProtectionPipeline(pipelineId, ctx);

  if (activePipeline)
  {
    const mitigationState = {
      context: ctx,
      source,
      target,
      carrier,
      profile,
      sources,
      transition,
      pierceOut,
      smashRule,
      weaponPoiseRules,
      attacking,
      defending,
      evaded,
      flatReturn,
      incoming,
      physical,
      magical,
      totalIncoming: physical + magical,
      amount: physical + magical,
      effectiveBlockPool,
      flatBlockBroken,
      wardHpPool,
      blocked,
      blockSpent,
      pierceBypassed,
      piercePoise,
      magicPoise,
      barrierMitigated,
      wardMitigated,
      wardHpAbsorbed,
      poiseMitigated,
      poiseDrain,
      poiseMitigationCost,
      weaponPoiseDamage,
      wardPoiseRan: false,
      amountAfterWard: null,
    };

    runProtectionPipeline(activePipeline, mitigationState);

    amount = mitigationState.amount;
    blocked = mitigationState.blocked;
    blockSpent = mitigationState.blockSpent;
    pierceBypassed = mitigationState.pierceBypassed;
    piercePoise = mitigationState.piercePoise;
    magicPoise = mitigationState.magicPoise;
    barrierMitigated = mitigationState.barrierMitigated;
    wardMitigated = mitigationState.wardMitigated;
    wardHpAbsorbed = mitigationState.wardHpAbsorbed;
    poiseMitigated = mitigationState.poiseMitigated;
    poiseDrain = mitigationState.poiseDrain;
    poiseMitigationCost = mitigationState.poiseMitigationCost;
    weaponPoiseDamage = mitigationState.weaponPoiseDamage;
  }
  for (const stage of fixCoreEnabled(ctx) ? [] : defenses?.order || []) {
    if (!defenses.include?.includes(stage)) continue;
    if (stage === 'block') {
      const spent = Math.min(Math.max(0, target?.block || 0), amount);
      blocked += spent; amount -= spent;
    } else if (stage === 'poise' && amount > 0
      && (defenses.poiseActive === 'always' || defenses.poiseActive === 'positive' && hasPoise(target))) {
      const mitigated = Math.max(defenses.minimumPositiveDamage ?? 1,
        Math.floor(amount * (defenses.poiseMultiplier ?? 0.75)));
      poiseMitigated += amount - mitigated; amount = mitigated;
    }
  }
  // +% Poise damage (a magic weapon's Blacksmith pick, W25 step 4): the hit takes that much more of the target's Poise pool.
  const poiseCostBeforeAdjust = (poiseMitigationCost ?? poiseMitigated) + poiseDrain;
  if (source?.itemProps?.poiseDamagePct) poiseDrain += ItemPoiseExtra(source, poiseCostBeforeAdjust, Math.max(0, (target?.persistentPoise?.value || 0) - poiseCostBeforeAdjust));
  // Owner, 2026-11-14: a Smash adds Poise damage (the pool loses it, HP is untouched); a Defend target spares a share of what its pool would lose.
  // Under weaponPoiseRules, Smash's 1.25x / 2x-vs-Guarding multipliers are already applied directly to weapon poise, so skip legacy Smash/Defend scaling.
  let poiseSpared = 0;
  if (modern && !evaded && !flatReturn && !weaponPoiseRules) {
    const poise = PoiseLossAdjust(ctx,source,carrier,defending,{taken:poiseMitigated+poiseDrain,pool:target?.persistentPoise?.value || 0});
    poiseDrain += poise.extra; poiseSpared = poise.spared;
  }
  const hitEntry = buildDamageReceiptHitEntry({
    incoming,
    physical,
    magical,
    blocked,
    barrierMitigated,
    wardMitigated,
    poiseMitigated,
    amount,
    sources,
    broken,
    pierceBypassed,
    piercePoise,
    magicPoise,
    poiseDrain,
  });
  // The receipt lists a flat Poise break once, as Break Poise; the drain still applies it.
  if (broken?.poise > 0)
  {
    poiseDrain += broken.poise;
  }

  const isUncertain = fixCoreEnabled(ctx) && hitChance < 1 && roll === null && !evaded;
  const hasMissRange = fixCoreEnabled(ctx) && hitChance < 1 && !evaded;
  const staggerManeuvers = stances?.staggerManeuvers || ['smash'];
  const isInterrupted = advantage
    && stances?.staggerOnAdvantage === true
    && staggerManeuvers.includes(attacking);
  const blockSpentTotal = blockSpent ?? (flatBlockBroken + blocked);

  const result = {
    raw,
    rawHit,
    weaknesses,
    pierceBypassed,
    piercePoise,
    magicPoise,
    wardMitigated,
    barrierMitigated,
    damageReceipt: damageReceipt(target?.id, [hitEntry]),
    hitChance,
    uncertain: isUncertain,
    hpLossBounds: hasMissRange
      ? [0, amount]
      : [amount, amount],
    amount: amount + blocked,
    hpLoss: amount,
    blocked,
    poiseMitigated,
    poiseDrain,
    blockRemaining: Math.max(0, (target?.block || 0) - blockSpentTotal),
    evaded,
    advantage,
    defenseAdvantage: defense.defenseAdvantage,
    stanceMitigation: defense.mitigation,
    attackStance: attacking,
    defenseStance: defending,
    interrupted: isInterrupted,
  };

  return attachOptionalFields(result, [
    [pierceOut.spent > 0, 'skinSpent', pierceOut.spent],
    [Boolean(element), 'element', element ? { id: element.element, heal: element.heal } : null],
    [Boolean(reflect), 'reflect', reflect],
    [wardHpMode && wardHpAbsorbed > 0, 'wardHpBuffer', true],
    [wardHpMode && wardHpAbsorbed > 0, 'wardHpAbsorbed', wardHpAbsorbed],
    [wardRouted, 'wardRouted', true],
    [wardBlockFirst, 'wardBlockFirst', true],
    [poiseMitigationCost !== undefined, 'poiseMitigationCost', poiseMitigationCost],
    [weaponPoiseDamage > 0, 'weaponPoiseDamage', weaponPoiseDamage],
    [Boolean(poiseSpared), 'poiseSpared', poiseSpared],
    [Boolean(broken), 'broken', broken],
    [flatBlockBroken > 0, 'blockBrokenFlat', flatBlockBroken],
    [Boolean(smashRule), 'smashVsDefensive', { poiseDamage: poiseDrain }],
  ]);
}
export function profileCardCosts(ctx, def) {
  const resources = configuredModule(ctx, 'resources');
  const include = resources?.include || [];
  const authored = def.resourceCosts || def.costs || {};
  const baseSp = def.cost==='X' && include.includes('sp') ? Math.max(0,ctx.player?.stamina ?? ctx.player?.energy ?? 0) : authored.sp ?? def.staminaCost ?? (typeof def.cost === 'number' ? def.cost : 0);
  const baseMp = authored.mp ?? def.manaCost ?? 0;
  // A per-fight rising cost (core.retreat, owner 2026-11-19) is added after the stance discount, so the Nth use costs N-1 whatever stance the player is in.
  const grown = (def.costGrowth?.perCard ? (def.costGrowthApplied?.stamina || 0) : 0) + (def.modeCostGrowthApplied?.stamina || 0);
  const sp = fixCoreEnabled(ctx) ? stanceStaminaCost(baseSp - grown, ctx.player, def, ctx, baseMp) + grown : baseSp;
  const mp = stanceManaCost(baseMp, ctx.player, def, ctx);
  if ((!include.includes('sp') && sp > 0) || (!include.includes('mp') && mp > 0)) {
    throw new Error(`Card ${def.id || 'unknown'} requires an authored disabled-resource variant`);
  }
  return { energy: include.includes('sp') ? Math.max(0, sp) : 0,
    stamina: include.includes('sp') ? Math.max(0, sp) : 0,
    mana: include.includes('mp') ? Math.max(0, mp) : 0 };
}
export function profileHandSize(ctx) {
  const cards = configuredModule(ctx, 'cards');
  if (!cards) return 0;
  const perIncrease = Math.max(1, cards.handPointsPerIncrease || 1);
  return Math.max(0, Math.floor((cards.handBase ?? 4)
    + Math.floor((ctx.attributes?.[cards.handAttribute || 'intelligence'] || 0) / perIncrease)) + ItemHandBonus(ctx)); // + a hand-size item property (W25 step 6)
}
export function profileFallbackDamage(ctx) {
  return gameContent(ctx, 'fallback')?.attackDamage ?? ctx.gameProfile?.foundation?.attackDamage ?? 5;
}
export function refreshProfileRound(ctx, returned) {
  const cards = configuredModule(ctx, 'cards');
  if (!cards || cards.roundShuffle !== 'entireDeck') return false;
  // Exhausted instances stay exhausted. Persistent power application state is
  // retained on entities; never recreate an instance or replay its hooks here.
  ctx.piles.draw.push(...returned, ...ctx.piles.discard);
  ctx.piles.discard = [];
  ctx.piles.draw = ctx.rng.shuffle('shuffle', ctx.piles.draw);
  ctx.emit('deckShuffled', { size: ctx.piles.draw.length, reason: 'configuredRoundRefresh' });
  return true;
}

export function freezeProfile(profile) {
  if (!profile || typeof profile !== 'object' || Object.isFrozen(profile)) return profile;
  for (const value of Object.values(profile)) freezeProfile(value);
  return Object.freeze(profile);
}
