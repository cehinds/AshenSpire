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
import { EffectivePierceRules, EffectiveSmashGuardRules, EffectiveBlockBreakAmount, EffectivePoiseBreakAmount } from '../model/combatMechanics.js';
import { WeaponPoiseDamage, StanceHasPoiseMitigation } from '../model/weaponPoise.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { mirroredStance, configuredStance, armsAsCoreCounter, isSpellCounter } from '../model/profileStance.js';
import { stanceMitigation } from './stanceMitigation.js';
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
  const rule = configuredModule(ctx, 'stances');
  const stance = configuredStance(carrier);
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
/** The flat break a hit's carrier holds (`breakBlock`/`blockBreak`, `breakPoise` from its damage effect), capped by what the target has; null when none. */
export function HitBreakAmounts(target, carrier, ctx = null) {
  const blockReq = EffectiveBlockBreakAmount(carrier, 0, null, ctx);
  const poiseReq = EffectivePoiseBreakAmount(carrier, ctx);
  const block = Math.min(Math.max(0, target?.block || 0), blockReq);
  const poise = Math.min(Math.max(0, target?.persistentPoise?.value || 0), poiseReq);
  return block > 0 || poise > 0 ? { block, poise } : null;
}
/** A carrier with its damage effect's flat break (first hit per target only); `hitIndex` > 0 or no break leaves the carrier without one. */
export function HitBreakCarrier(carrier, effect, hitIndex = 0) {
  const { breakBlock, breakPoise, blockBreak, ...rest } = carrier || {};
  const bb = effect?.breakBlock ?? effect?.blockBreak;
  if (hitIndex > 0 || !effect || !(bb > 0 || effect.breakPoise > 0)) return breakBlock || breakPoise || blockBreak ? rest : carrier;
  return { ...rest, ...(bb > 0 ? { breakBlock: bb } : {}), ...(effect.breakPoise > 0 ? { breakPoise: effect.breakPoise } : {}) };
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
  const rawSmashRule = modern && advantage && attacking === 'smash' ? EffectiveSmashGuardRules(fixCoreRules(ctx, target), ctx) : null;
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
  const matchupMultiplier = smashRule ? smashMultiplier : advantage && !flatReturn ? stances.advantageMultiplier ?? 1 : 1;
  // Owner, 2026-11-17 (stance decisions): a stance advantage and the target's stance weakness (Attack or Smash beating Prepared, and Prepared's melee
  // weakness) never stack: the hit takes the larger of the two. The weakness already sits in `raw`, so the advantage stage adds only what it exceeds.
  const advantageMultiplier = matchupMultiplier > 1 && weaknessMultiplier > 1 ? Math.max(matchupMultiplier, weaknessMultiplier) / weaknessMultiplier : matchupMultiplier;
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
  // Flat Block & Poise removal (`guardInteraction` -> `blockBreak`, owner 2026-11-20): destroys flat Block/Poise before normal mitigation (never touches Ward).
  const initialBlockPool = Math.max(0, target?.block || 0);
  const flatBlockBroken = !evaded && !flatReturn && flatBlockBreakRequested > 0 ? Math.min(initialBlockPool, flatBlockBreakRequested) : 0;
  const flatPoiseBreakRequested = modern && !flatReturn ? EffectivePoiseBreakAmount(carrier, ctx) : 0;
  const flatPoiseBroken = !evaded && !flatReturn && flatPoiseBreakRequested > 0 ? Math.min(Math.max(0, target?.persistentPoise?.value || 0), flatPoiseBreakRequested) : 0;
  const broken = flatBlockBroken > 0 || flatPoiseBroken > 0 ? { block: flatBlockBroken, poise: flatPoiseBroken } : null;
  const effectiveBlockPool = Math.max(0, initialBlockPool - flatBlockBroken);
  if (flatBlockBroken > 0) {
    sources.push({ id: 'break-block', label: 'Break Block', amount: flatBlockBroken, requested: initialBlockPool, effective: effectiveBlockPool, stage: 'mitigation', operation: 'subtract' });
  }
  if (flatPoiseBroken > 0) {
    sources.push({ id: 'break-poise', label: 'Break Poise', amount: flatPoiseBroken, requested: target.persistentPoise.value, effective: target.persistentPoise.value - flatPoiseBroken, stage: 'mitigation', operation: 'subtract' });
    target = { ...target, persistentPoise: { ...target.persistentPoise, value: target.persistentPoise.value - flatPoiseBroken } };
  }
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
  // Ward health buffer: Block > Ward > Poise + HP.
  const wardHpMode = modern && FixCoreWardHpBuffer(ctx);
  const wardHpPool = wardHpMode ? EffectiveWardHp(ctx, target) : 0;
  const weaponPoiseRules = modern ? FixCoreWeaponPoiseRules(ctx) : null;
  // Legacy Ward (owner, 2026-11-01 / 2026-11-15): saved fights without `routing: "hpBuffer"` route through Poise.
  const wardRouted = modern && !wardHpMode && (target?.statuses?.ward?.stacks || 0) > 0;
  const wardBlockFirst = wardRouted && FixCoreWardBlockFirst(ctx);
  if (wardBlockFirst) {
    const total = physical + magical;
    const poisePool = Math.max(0, target?.persistentPoise?.value || 0);
    const blockSoak = Math.min(effectiveBlockPool, total);
    blockSpent = flatBlockBroken + blockSoak;
    const bypassAmount = PierceBlockIgnored(ctx, target, carrier, profile, total, blockSoak, pierceOut);
    pierceBypassed = Math.min(bypassAmount, blockSoak);
    blocked = blockSoak - pierceBypassed;
    const afterBlock = total - blocked;
    // A Smash against a defensive stance has no absorption (its Poise loss is Poise damage, below).
    const toPoise = smashRule ? 0 : Math.min(afterBlock, poisePool);
    poiseDrain = smashRule && !evaded ? Math.min(poisePool, Math.floor(smashRule.poiseFraction * incoming)) : 0;
    poiseMitigated = toPoise;
    transition('block', 'Block', total, afterBlock, 'mitigation');
    transition('ward-poise', 'Poise (Ward: absorbs the whole rest)', afterBlock, afterBlock - toPoise, 'mitigation');
    amount = afterBlock - toPoise;
  } else if (wardRouted) {
    const total = physical + magical;
    const poisePool = Math.max(0, target?.persistentPoise?.value || 0);
    // A Smash against a defensive stance has no absorption (its Poise loss is Poise damage, below).
    const toPoise = smashRule ? 0 : Math.min(total, poisePool);
    const blockSoak = Math.min(effectiveBlockPool, total - toPoise);
    blockSpent = flatBlockBroken + blockSoak;
    const bypassAmount = PierceBlockIgnored(ctx, target, carrier, profile, total, blockSoak, pierceOut);
    pierceBypassed = Math.min(bypassAmount, blockSoak);
    blocked = blockSoak - pierceBypassed;
    poiseDrain = smashRule && !evaded ? Math.min(poisePool, Math.floor(smashRule.poiseFraction * incoming)) : 0;
    poiseMitigated = toPoise;
    transition('ward-poise', 'Poise (Ward: all damage meets Poise first)', total, total - toPoise, 'mitigation');
    transition('block', 'Block (after Poise)', total - toPoise, total - toPoise - blocked, 'mitigation');
    amount = total - toPoise - blocked;
  } else if (weaponPoiseRules) {
    // JSON-configured weapon poise & stance-gated Poise mitigation:
    // - After Block and Ward, Poise can mitigate the overflow while Countering, Preparing or Smashing.
    // - Poise damage comes from the attacking weapon (1-3 base, +20% for sceptres/bows/staves, 1.25x Smash, 2x Smash vs Guarding), plus any card poiseDamage effects.
    const total = physical + magical;
    const blockSoak = Math.min(effectiveBlockPool, total);
    blockSpent = flatBlockBroken + blockSoak;
    const bypassAmount = PierceBlockIgnored(ctx, target, carrier, profile, total, blockSoak, pierceOut);
    pierceBypassed = Math.min(bypassAmount, blockSoak);
    blocked = blockSoak - pierceBypassed;
    const afterBlock = total - blocked;
    transition('block', 'Block', total, afterBlock, 'mitigation');
    wardHpAbsorbed = Math.min(afterBlock, wardHpPool);
    wardMitigated = wardHpAbsorbed;
    const afterWard = afterBlock - wardHpAbsorbed;
    transition('ward-hp', 'Ward (health buffer)', afterBlock, afterWard, 'mitigation');

    const poisePool = Math.max(0, target?.persistentPoise?.value || 0);
    if (afterWard > 0 && poisePool > 0 && StanceHasPoiseMitigation(weaponPoiseRules, defending)) {
      poiseMitigated = Math.min(afterWard, Math.floor(poisePool * (weaponPoiseRules.mitigationPoiseFraction ?? 0.5)));
      poiseMitigationCost = Math.min(poisePool, Math.floor(afterWard * (weaponPoiseRules.mitigationDrainDamageFraction ?? 0.5)) + (weaponPoiseRules.mitigationDrainFlat ?? 1));
      transition('poise-mitigation', 'Poise reduction', afterWard, afterWard - poiseMitigated, 'mitigation');
    } else {
      poiseMitigationCost = 0;
    }
    amount = afterWard - poiseMitigated;
    // Inherent Poise damage survives full Block in general. Active Ward
    // shields Poise until some of the hit gets past the health buffer.
    if (!evaded && !flatReturn && incoming > 0 && (wardHpPool === 0 || afterWard > 0)) {
      weaponPoiseDamage = WeaponPoiseDamage(ctx, source, target, carrier, { attacking, defending, rules: weaponPoiseRules }).amount;
      const remainingPoise = Math.max(0, poisePool - poiseMitigationCost);
      poiseDrain = Math.min(remainingPoise, weaponPoiseDamage);
    }
  } else if (wardHpMode && wardHpPool > 0) {
    const total = physical + magical;
    const blockSoak = Math.min(effectiveBlockPool, total);
    blockSpent = flatBlockBroken + blockSoak;
    const bypassAmount = PierceBlockIgnored(ctx, target, carrier, profile, total, blockSoak, pierceOut);
    pierceBypassed = Math.min(bypassAmount, blockSoak);
    blocked = blockSoak - pierceBypassed;
    const afterBlock = total - blocked;
    transition('block', 'Block', total, afterBlock, 'mitigation');
    wardHpAbsorbed = Math.min(afterBlock, wardHpPool);
    wardMitigated = wardHpAbsorbed;
    const afterWard = afterBlock - wardHpAbsorbed;
    transition('ward-hp', 'Ward (health buffer)', afterBlock, afterWard, 'mitigation');
    if (afterWard > 0) {
      const remPhysical = Math.max(0, physical - blocked - wardHpAbsorbed);
      const remMagical = Math.max(0, afterWard - remPhysical);
      const poisePool = Math.max(0, target?.persistentPoise?.value || 0);
      const forceShare = smashRule ? null : ForcePoiseShare(ctx, carrier);
      const normalPoise = smashRule ? { amount: remPhysical, reduced: 0, sources: [] } : protectionReceipt(ctx, target, 'physical', remPhysical);
      const poise = forceShare === null ? normalPoise : ForcePoiseReceipt(target, remPhysical, forceShare, normalPoise);
      const poiseMeetsMagic = fixCoreWardDisabled(ctx);
      magicPoise = poiseMeetsMagic && !smashRule ? Math.min(remMagical, Math.max(0, poisePool - poise.reduced)) : 0;
      const magicToHp = remMagical - magicPoise;
      poiseDrain = smashRule && !evaded ? Math.min(poisePool, Math.floor(smashRule.poiseFraction * afterWard)) : 0;
      poiseMitigated = poise.reduced + magicPoise;
      sources.push(...poise.sources);
      if (magicPoise > 0) sources.push({ id: 'poise-magic', label: 'Poise meets the spell', amount: -magicPoise, requested: remMagical, effective: magicToHp, stage: 'mitigation', operation: 'add' });
      amount = poise.amount + magicToHp;
    } else {
      amount = 0;
    }
  } else if (modern) {
    // Owner: Block soaks the whole hit (physical first, then magic); the magic Block leaves meets Barrier, then Ward.
    // Block is spent exactly as the same hit without pierce would spend it (so the invariant holds over a whole action). A pierce hit then
    // lets up to floor(fraction x its damage) of what Block soaked go through instead (owner, 2026-10-26); a reaction carries none.
    const blockPool = effectiveBlockPool;
    // Owner, 2026-10-31: with Ward off, magic hits Poise FIRST (1:1) and then Block; physical keeps Block first, then Poise.
    const poiseMeetsMagic = fixCoreWardDisabled(ctx);
    const plainPhysicalBlocked = Math.min(blockPool,physical);
    // Ward off: the magic part meets Poise before Block, so what Block soaks of it is decided after Poise (below); Ward on keeps Block-first.
    // Block is spent as the same hit without pierce would spend it, so the Ward-off magic lane reads the non-piercing resolution
    // (physical Block, physical Poise, magic Poise, then magic Block), never the pool a pierce left.
    let plainMagicBlocked;
    if (poiseMeetsMagic) {
      const poisePoolFull = Math.max(0,target?.persistentPoise?.value || 0);
      const plainPoise = smashRule ? {reduced:0} : protectionReceipt(ctx,target,'physical',physical-plainPhysicalBlocked);
      const plainMagicPoise = smashRule ? 0 : Math.min(magical,Math.max(0,poisePoolFull-plainPoise.reduced));
      plainMagicBlocked = Math.min(blockPool-plainPhysicalBlocked,magical-plainMagicPoise);
    } else plainMagicBlocked = Math.min(blockPool-plainPhysicalBlocked,magical);
    const plainSoaked = plainPhysicalBlocked+plainMagicBlocked;
    blockSpent = flatBlockBroken + plainSoaked;
    const bypassAmount = PierceBlockIgnored(ctx,target,carrier,profile,physical+magical, plainSoaked, pierceOut);
    pierceBypassed = Math.min(bypassAmount,plainSoaked);
    const piercedPhysicalPart = Math.min(pierceBypassed,plainPhysicalBlocked);
    const physicalBlocked = plainPhysicalBlocked-piercedPhysicalPart;
    const magicBypass = pierceBypassed-piercedPhysicalPart;
    let magicBlocked = plainMagicBlocked-magicBypass;
    // Saved fraction-based Pierce keeps its 1:1 Poise absorption (owner, 2026-10-26). Stack-based Pierce adds no special Poise damage:
    // everything Block leaves uses the ordinary split, including Force's half-Poise share (owner, 2026-11-18).
    const poisePool = Math.max(0,target?.persistentPoise?.value || 0);
    // A Smash against a defensive stance has no absorption, so its pierced part gets none either.
    const stackPierce = fixCorePierceRules(fixCoreRules(ctx,target)).blockIgnoredPerStack > 0;
    const piercePhysical = smashRule || stackPierce ? 0 : piercedPhysicalPart;
    piercePoise = Math.min(piercePhysical,poisePool);
    const pierceToHp = piercePhysical-piercePoise;
    const afterPierce = piercePoise > 0 ? {...target,persistentPoise:{...target.persistentPoise,value:poisePool-piercePoise}} : target;
    const poiseIn = physical-piercePhysical-physicalBlocked;
    // Smash vs a defensive stance: no 25% absorption; the pool instead loses a share of the whole hit (capped at what it holds).
    // Owner, 2026-11-18: a Force hit sends `elements.force.poiseShare` (half) of what Block left to Poise, the rest to HP, in place of the usual 25%.
    const forceShare = smashRule ? null : ForcePoiseShare(ctx,carrier);
    const normalPoise = smashRule ? {amount:poiseIn,reduced:0,sources:[]} : protectionReceipt(ctx,afterPierce,'physical',poiseIn);
    const poise = forceShare === null ? normalPoise : ForcePoiseReceipt(afterPierce,poiseIn,forceShare,normalPoise);
    // Magic after the physical part: Poise first (1:1, the pool the physical part left), then the Block the physical part left, then Barrier, then HP.
    magicPoise = poiseMeetsMagic && !smashRule ? Math.min(magical,Math.max(0,poisePool-piercePoise-poise.reduced)) : 0;
    const magicAfterPoise = magical-magicPoise;
    // What Poise left of the magic part meets the Block the plan set aside for it; Block itself is spent as planned (blockSpent).
    if (poiseMeetsMagic) magicBlocked = Math.min(magicBlocked,magicAfterPoise);
    blocked = physicalBlocked+magicBlocked;
    const magicAfterBlock = magicAfterPoise-magicBlocked;
    barrierMitigated = 0;
    const magicToHp = poiseMeetsMagic ? magicAfterBlock-barrierMitigated : 0;
    const ward = protectionReceipt(ctx,target,'magical',poiseMeetsMagic ? 0 : magicAfterBlock-barrierMitigated);
    // Smash vs a defensive stance: the pool's loss is Poise damage, not absorption, so poiseMitigated (and the log's "absorbed") stay 0.
    poiseDrain=smashRule && !evaded ? Math.min(poisePool-piercePoise,Math.floor(smashRule.poiseFraction*incoming)) : 0;
    poiseMitigated=poise.reduced+piercePoise+magicPoise;wardMitigated=ward.reduced;
    if (poiseMeetsMagic) {
      transition('block','Block',physical,physical-physicalBlocked,'mitigation');
      sources.push(...poise.sources);
      if (magicPoise > 0) sources.push({id:'poise-magic',label:'Poise meets the spell',amount:-magicPoise,requested:magical,effective:magicAfterPoise,stage:'mitigation',operation:'add'});
      if (magicBlocked > 0) sources.push({id:'block-magic',label:'Block (after Poise)',amount:-magicBlocked,requested:magicAfterPoise,effective:magicAfterBlock,stage:'mitigation',operation:'add'});
      transition('barrier','Bonus Poise',magicAfterBlock,magicAfterBlock-barrierMitigated,'mitigation');
    } else {
      transition('block','Block',physical+magical,physical+magical-blocked,'mitigation');
      transition('barrier','Bonus Poise',magicAfterBlock,magicAfterBlock-barrierMitigated,'mitigation');
      sources.push(...poise.sources);
    }
    sources.push(...ward.sources);
    amount=poise.amount+ward.amount+pierceToHp+magicToHp;
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
  // The broken Poise leaves the pool with the hit's own Poise damage (the live hit subtracts poiseDrain from the real pool).
  if (broken?.poise > 0) poiseDrain += broken.poise;
  return { ...(pierceOut.spent > 0 ? { skinSpent: pierceOut.spent } : {}), raw, rawHit, weaknesses, ...(element ? { element: { id: element.element, heal: element.heal } } : {}), pierceBypassed, piercePoise, magicPoise, wardMitigated, barrierMitigated,
    damageReceipt: damageReceipt(target?.id, [{incoming,physical,magical,blocked,...(broken?.block ? {blockBroken:broken.block} : {}),...(broken?.poise ? {poiseBroken:broken.poise} : {}),barrierReduced:barrierMitigated,wardReduced:wardMitigated,poiseReduced:poiseMitigated,...(pierceBypassed ? {pierced:pierceBypassed,piercePoise} : {}),...(magicPoise ? {magicPoise} : {}),...(poiseDrain ? {poiseDamage:poiseDrain} : {}),hpLoss:amount,sources}]),
    ...(reflect ? { reflect } : {}),
    ...(wardHpMode && wardHpAbsorbed > 0 ? { wardHpBuffer: true, wardHpAbsorbed } : {}),
    ...(wardRouted ? { wardRouted: true } : {}), ...(wardBlockFirst ? { wardBlockFirst: true } : {}),
    hitChance, uncertain: (fixCoreEnabled(ctx) && hitChance < 1) && roll === null && !evaded,
    hpLossBounds: (fixCoreEnabled(ctx) && hitChance < 1 && !evaded) ? [0, amount] : [amount, amount], amount: amount + blocked, hpLoss: amount, blocked, poiseMitigated, poiseDrain, ...(poiseMitigationCost !== undefined ? { poiseMitigationCost } : {}), ...(weaponPoiseDamage > 0 ? { weaponPoiseDamage } : {}), ...(poiseSpared ? { poiseSpared } : {}),
    blockRemaining: Math.max(0, (target?.block || 0) - (blockSpent ?? (flatBlockBroken + blocked))), evaded, advantage,
    ...(broken ? { broken } : {}),
    ...(flatBlockBroken > 0 ? { blockBrokenFlat: flatBlockBroken } : {}),
    ...(smashRule ? { smashVsDefensive: { poiseDamage: poiseDrain } } : {}),
    defenseAdvantage: defense.defenseAdvantage, stanceMitigation: defense.mitigation,
    attackStance: attacking, defenseStance: defending,
    interrupted: advantage && stances?.staggerOnAdvantage === true
      && (stances.staggerManeuvers || ['smash']).includes(attacking) };
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
