import { applyStatus, getAdd } from './statuses.js';
import { GearReceiptAdd, GearMeleeHit } from './gearReceipt.js';
import { ItemHandBonus, QueueItemStanceEntry, ItemIncomingPercent, ItemPoiseExtra } from './itemPropertyHooks.js';
import { attackHitPreview, precisionEntryGrant } from './stanceHit.js';
import { ChannelLabel, ChannelWeight } from '../model/damageChannels.js';
import { SpellTraditionsActive, SpellTraditionLabel, TraditionSpellPower, CardSpellTraditions } from '../model/spellTraditions.js';
import { sourceRatingValue, magicShareOf, splitContactParts, PacketSplit, PacketWeights, isMagicalAttack, canonicalDamageType, finesseRatingView, carrierHasTag, SourceWeaponHasTag, IsFinesseHit } from '../model/combatRatings.js';
import { core2MultiHitRulesEnabled } from '../model/core2ActionPolicy.js';
import { ScaleCardBaseDamage, ScalePhysicalDamage, isSpellCard } from '../model/combatCardProfile.js';
import { sameStance, stanceEntryBonuses, stanceStaminaCost, stanceManaCost, stanceEffectiveness } from '../model/stanceRules.js';
import { fixCoreEnabled, fixCorePierceRules, fixCoreSmashVsDefensiveRules, protectionReceipt, damageReceipt, fixCoreWardDisabled, FixCoreWardBlockFirst, FixCoreWardHpBuffer, EffectiveWardHp, FixCoreBrokenRules, FixCoreWeaponPoiseRules, ReceiptPoiseLoss } from '../model/fixCoreMechanics.js';
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
  const rules = fixCorePierceRules(fixCoreRules(ctx, target));
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
  const rules = fixCorePierceRules(fixCoreRules(ctx, target));
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
  return SpellPoiseFinish(ctx, source, target, carrier, ApplyDefendPoiseFloor(ctx, target, carrier, ElementReceiptFinish(ctx, carrier, receipt, view, { value: real })));
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
export function PhysicalDamageMultiplier(effects) {
  const value = effects?.physicalDamageMultiplier;
  return Number.isFinite(value) && value >= 0 ? value : 1;
}
/** The effects module's per-side damage factor (1 when unset): enemies read `enemyDamageMultiplier`, the player `playerDamageMultiplier`. */
export function SideDamageMultiplier(effects, source) {
  const value = source?.kind === 'enemy' ? effects?.enemyDamageMultiplier : source?.kind === 'player' ? effects?.playerDamageMultiplier : 1;
  return Number.isFinite(value) && value >= 0 ? value : 1;
}
/** An element packet hit (owner, 2026-11-19): a player's physical-camp card with a magic share between 0 and 1 and no rating of its own. */
export const IsPacketHit = (ctx, source, carrier, profile, share) => fixCoreEnabled(ctx) && source?.kind === 'player' && carrier?.ratingId === undefined
  && profile?.camp === 'physical' && Number.isFinite(carrier?.magicShare) && share > 0 && share < 1;
/**
 * PacketFaceSplit(ctx, source, carrier, authoredBase, total) → { physical, magic } for the face number `total` of a packet hit, or null for any
 * other hit: the same two channels the receipt reads (STR / AR for the physical part, INT / Power for the magic part).
 */
export function PacketFaceSplit(ctx, source, carrier, authoredBase, total) {
  const profile = { ...(carrier?.combatProfile || {}), ...(Number.isFinite(carrier?.magicShare) ? { magicShare: carrier.magicShare } : {}) };
  const share = FightMagicShare(ctx, profile);
  if (!IsPacketHit(ctx, source, carrier, profile, share) || carrier.skipRatingBonus) return null;
  const effects = configuredModule(ctx, 'effects');
  const finesse = IsFinesseHit(ctx, source, carrier, 'ar');
  const channel = (id, entity) => Math.max(0, Math.floor(sourceRatingValue(ctx, entity, id, carrier.sourceArmamentId, carrier.equipmentScoped, carrier) * ChannelWeight(effects, id)));
  return PacketSplit({ base: ScaleCardBaseDamage(authoredBase, effects?.baseDamageMultiplier), share, physicalBonus: channel('ar', finesse ? finesseRatingView(source) : source), magicBonus: channel('pr', source),
    magicMultiplier: PacketMagicMultiplier(FluxMultiplier(ctx, source, carrier)),
    physicalMultiplier: carrier.counterReturnAttack || carrier.reflectedHit || carrier.proposalReactive ? 1 : PhysicalDamageMultiplier(effects), total });
}
/** The factor only a packet's magic part takes: elemental flux (owner ruling, 2026-11-20). Burn, element Vulnerable and the other element stages scale the whole hit. */
export const PacketMagicMultiplier = (flux) => (Number.isFinite(flux) ? flux : 1);
function profileDamageReceiptCore(ctx, source, target, base, carrier = {}, { roll = null, proposal = true, forecast = false } = {}) {
  const pierceOut = { spent: 0 };
  const effects = configuredModule(ctx, 'effects');
  const stances = configuredModule(ctx, 'stances');
  const defenses = configuredModule(ctx, 'defenses');
  const attacking = configuredStance(carrier);
  const defending = configuredStance(defensiveCombatStance(ctx,target,carrier));
  const advantage = !!stances?.include?.includes(attacking)
    && !!stances?.matchups?.[attacking]?.includes(defending);
  const modern = fixCoreEnabled(ctx);
  const flatReturn = modern && carrier.counterReturnAttack;
  // Owner, 2026-11-17: a profile's `effects.baseDamageMultiplier` scales every card's base damage (the Core bundle halves it), rounded up, before AR or
  // PR adds. A return computed from damage already dealt (a Counter return, a reflected hit, a proposal's reactive return such as
  // base.reflect's 50%) is final damage and is not scaled again (#2820 review).
  const authoredBase = base, baseMultiplier = carrier.counterReturnAttack || carrier.reflectedHit || carrier.proposalReactive ? 1 : effects?.baseDamageMultiplier;
  base = ScaleCardBaseDamage(base, baseMultiplier);
  const sources = [{id:'base',label:'Card damage (including enhancements)',amount:authoredBase,stage:'offense',operation:'set'}];
  if (base !== authoredBase) sources.push({id:'base-damage-scale',label:'Base damage scale',amount:base-authoredBase,requested:authoredBase,effective:base,stage:'offense',operation:'multiply',multiplier:baseMultiplier});
  // The chain keeps full precision and is floored once where it is applied (the quantity-rounding step);
  // receipt lines show the running floor so every shown number is whole (owner, 2026-10-18 16:05).
  const whole = value => modern ? Math.max(0, Math.floor(value)) : value;
  const transition = (id,label,before,after,stage='offense',multiplier) => {
    if (before !== after) sources.push({id,label,amount:whole(after)-whole(before),requested:whole(before),effective:whole(after),stage,operation:multiplier === undefined ? 'add' : 'multiply',...(multiplier === undefined ? {} : {multiplier})});
    return after;
  };
  const profile = {...(carrier.combatProfile || {}), ...(Number.isFinite(carrier.magicShare) ? {magicShare:carrier.magicShare} : {})};
  const share = FightMagicShare(ctx, profile);
  // Owner, 2026-10-19: spell effectiveness uses PR; a spell (camp spell or magic school, whatever its Barrier split) reads PR where a physical attack reads AR.
  // A hit with any magic share (a school-only technique included, as magicShareOf reads it) reads PR.
  // Enemies keep AR for their spells: their PR is 0 in data, so reading it would zero their spell damage.
  // Owner, 2026-11-19 (an element upgrade's packet): a player's physical-camp card with a magic share between 0 and 1 and no rating of its own deals a
  // physical part and a magic part on one hit. The physical part keeps its STR / AR channel and the magic part adds INT / Power (Arcane tradition) as its own
  // stage, so neither is lost to the other. A lent staff or sceptre card names its `ratingId`, and an enemy move reads its own, so both keep their one channel.
  const packetHit = IsPacketHit(ctx, source, carrier, profile, share);
  const ratingId = !packetHit && modern && (source?.kind !== 'enemy' || SpellTraditionsActive(ctx)) && (profile.camp === 'spell' || share > 0 || isMagicalAttack(ctx, carrier)) ? 'pr' : 'ar';
  const ratingLabel = ratingId === 'pr' && SpellTraditionsActive(ctx) ? SpellTraditionLabel(carrier) : ChannelLabel(ratingId);
  // A finesse hit scales with Dexterity instead of Strength (owner, 2026-10-25; Core 2 rules version 2).
  const finesse = modern && IsFinesseHit(ctx, source, carrier, ratingId);
  const rated = finesse ? finesseRatingView(source) : source;
  const ar = modern ? sourceRatingValue(ctx, rated, ratingId, carrier.sourceArmamentId, carrier.equipmentScoped, carrier) : rating(source,'ar');
  const ratingBonus = modern && carrier.skipRatingBonus ? 0 : ar * ChannelWeight(effects,ratingId);
  let raw = base;
  const applicable = (rated?.ratingSources || []).filter(row => row.kind !== 'equipment' || !carrier.sourceArmamentId && !carrier.equipmentScoped
    || row.slot === 'armor' || row.sourceId?.startsWith('armor/') || row.sourceId === carrier.sourceArmamentId || row.sourceId === `armament/${carrier.sourceArmamentId}`);
  const contributionValue = row => row.kind === 'attribute' && ratingId === 'pr' && SpellTraditionsActive(ctx)
    ? TraditionSpellPower(ctx, rated, carrier, row[ratingId] || 0) : row[ratingId] || 0;
  const sourceAR = applicable.reduce((sum,row)=>sum+contributionValue(row),0);
  if (modern && sourceAR > 0 && ratingBonus > 0) {
    for (const [index,row] of applicable.entries()) {
      const contribution = contributionValue(row) * ChannelWeight(effects,ratingId);
      raw = transition(`${ratingId}:${row.sourceId || index}`,`${row.name || row.kind}: ${ratingLabel}`,raw,raw+contribution);
    }
    raw = transition('ar:adjustments',`${ratingLabel} stance/status modifiers (including Weak)`,raw,base+ratingBonus);
  } else raw = transition('ar',ratingLabel,raw,raw+ratingBonus);
  // The packet's magic part reads Power on top: its own stage, counted into the magic part of the final split below.
  const packetPower = packetHit && !carrier.skipRatingBonus ? Math.max(0, Math.floor(sourceRatingValue(ctx, source, 'pr', carrier.sourceArmamentId, carrier.equipmentScoped, carrier) * ChannelWeight(effects,'pr'))) : 0;
  if (packetPower > 0) raw = transition('pr:packet',`${ChannelLabel('pr')} (magic part)`,raw,raw+packetPower);
  // Owner, 2026-11-18: gear that adds DEX to a hit (Katana, a Bow against a Retreat-stacked target), STR a second time (Greatsword Smash) and damage
  // against a target (a Pike against the front row) is one receipt stage, so the quote equals the hit. A triggered one is a fight effect for the face.
  const gearAdd = modern && !carrier.skipRatingBonus && source?.kind === 'player' ? GearReceiptAdd(ctx, source, target, carrier, { ratingId, ar, effects }) : 0;
  if (gearAdd) raw = transition('gear', 'Gear', raw, raw + gearAdd);
  // A `dexDamage` tag (on the card or on a weapon without cardAddDex) strictly adds DEX on top of existing damage scaling.
  const dexTagAdd = modern && !carrier.skipRatingBonus && ratingId === 'ar'
    && (carrierHasTag(ctx, carrier, 'dexDamage') || (SourceWeaponHasTag(ctx, source, carrier, 'dexDamage') && !(carrier?.gear?.addDex > 0)))
    ? sourceRatingValue(ctx, source, 'dr', carrier.sourceArmamentId, carrier.equipmentScoped, carrier) * ChannelWeight(effects, 'dr') : 0;
  if (dexTagAdd > 0) raw = transition('dex-add', 'DEX (Deft)', raw, raw + dexTagAdd);
  // A Core 2 Counter return is final pre-protection damage (SPEC §17): no matching-stance or defensive-stance stage.
  const stanceMultiplier = flatReturn ? 1 : stanceEffectiveness(ctx,source,carrier);
  raw = transition('matching-stance','Matching stance effectiveness',raw,raw*stanceMultiplier,'offense',stanceMultiplier);
  // Owner, 2026-11-14: a Broken target (Poise break under `poise.breakRule: "broken"`) takes the Broken multiplier from every hit.
  const brokenRule = modern && !flatReturn && target?.broken ? FixCoreBrokenRules(ctx) : null;
  if (brokenRule) raw = transition('broken','Broken',raw,raw*brokenRule.damageMultiplier,'offense',brokenRule.damageMultiplier);
  // Owner, 2026-11-14 (Wave 2.5): the attacker's own stance benefit (Attack +20%, Prepared +25%), then a Sweep splash hit's share of that damage.
  const benefitMultiplier = flatReturn ? 1 : AttackDamageMultiplier(ctx,source,carrier);
  raw = transition('stance-benefit','Stance benefit',raw,raw*benefitMultiplier,'offense',benefitMultiplier);
  // Owner, 2026-11-15 (W25-F): the player's elemental flux lifts the next card of its element by x1.25 (engine/elementFlux.js), in the same chain as Prepared's bonus so the quote equals the hit.
  const fluxMultiplier = flatReturn ? 1 : FluxMultiplier(ctx,source,carrier);
  // Owner ruling, 2026-11-20: on a packet hit flux lifts the magic part only, so the chain carries it as a factor on the magic share of the hit.
  const packetWeights = packetHit ? PacketWeights({base,share,physicalBonus:ratingBonus,magicBonus:packetPower}) : null;
  const fluxFactor = packetWeights && fluxMultiplier !== 1 ? 1 + (fluxMultiplier - 1) * packetWeights.magic / Math.max(1, packetWeights.magic + packetWeights.physical) : fluxMultiplier;
  raw = transition('element-flux','Elemental flux',raw,raw*fluxFactor,'offense',fluxFactor);
  const splashMultiplier = flatReturn ? 1 : carrier.stanceSplash > 0 && carrier.stanceSplash < 1 ? carrier.stanceSplash : 1;
  raw = transition('sweep-splash','Sweep splash',raw,raw*splashMultiplier,'offense',splashMultiplier);
  // Owner, 2026-11-17 (theme B): the target's stance weakness, Prepared x1.25 from melee and Idle x1.25 from everything.
  // An un-aimed face (no target) names no stance, so it takes no weakness.
  const weaknessMultiplier = flatReturn || !target ? 1 : StanceWeaknessMultiplier(ctx,carrier,defending,profile,target);
  raw = transition('stance-weakness','Stance weakness',raw,raw*weaknessMultiplier,'offense',weaknessMultiplier);
  // Owner, 2026-11-18: a wearer Vulnerable to melee (robes, a bow) takes the Vulnerable amount from melee physical attacks, Smashes and Sweeps.
  if (modern && !flatReturn && target?.itemProps?.vulnMelee && GearMeleeHit(profile, carrier)) raw = transition('vulnerable-melee', 'Vulnerable to melee (gear)', raw, raw * fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier, 'offense', fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier);
  if (modern && !flatReturn && target?.statuses?.vulnerable?.stacks > 0) raw=transition('vulnerable','Vulnerable',raw,raw*fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier,'offense',fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier);
  // Owner, 2026-10-31 (SPEC 5.3): each enemy weakness the hit matches multiplies its damage, after Vulnerable.
  const weaknesses = modern && !flatReturn && target?.kind === 'enemy' ? matchingHitWeaknesses(target, hitWeaknessTriggers(ctx, source, carrier, profile, share)) : [];
  for (const row of weaknesses) if (row.effect === 'damage') raw = transition(`weakness:${row.hidden ? 'unknown' : row.to}`,weaknessLabel(row.to,row.hidden),raw,raw*(1+row.amount/100),'offense',1+row.amount/100);
  // Element identity (W25): the deterministic element multipliers (Burn, Shock, Brittle, Chill, spread, chain, undead) are receipt stages, so a quote equals the hit.
  const element = modern && !flatReturn ? ElementReceiptStages(ctx, source, target, carrier, raw) : null;
  for (const stage of element?.stages || []) raw = transition(stage.id, stage.label, raw, raw * stage.multiplier, 'offense', stage.multiplier);
  const packetMagicMultiplier = packetHit ? PacketMagicMultiplier(fluxMultiplier) : 1;
  // Owner, 2026-11-18: one stage scales every hit by its side (`effects.playerDamageMultiplier` / `enemyDamageMultiplier`), after the element stages and
  // before Block and Poise absorb it, so the face, the intent and the hit read the same number. Final returns (a Counter return, a reflected hit, a
  // proposal's reactive return) are not scaled again. A positive hit never rounds to 0.
  // Owner, 2026-11-18: the physical share of the hit (the receipt's own physical/magical split) takes `effects.physicalDamageMultiplier` for both sides,
  // on top of the side scale, with the same exemptions for final returns. A positive physical part never rounds to 0.
  const physicalMultiplier = flatReturn || carrier.counterReturnAttack || carrier.reflectedHit || carrier.proposalReactive ? 1 : PhysicalDamageMultiplier(effects);
  if (physicalMultiplier !== 1 && raw > 0) {
    const split = packetHit ? PacketSplit({base,share,physicalBonus:ratingBonus,magicBonus:packetPower,magicMultiplier:packetMagicMultiplier,total:raw}) : splitContactParts({amount:raw,base,ratingBonus,share,ratingPart:ratingId === 'pr' || share >= 1 ? 'magic' : 'physical',primary:share >= 1 ? 'magic' : 'physical'});
    const physicalFraction = split.physical + split.magic > 0 ? split.physical / (split.physical + split.magic) : 0;
    if (physicalFraction > 0) raw = transition('physical-damage-scale','Physical damage scale',raw,ScalePhysicalDamage(raw,physicalFraction,physicalMultiplier),'offense',physicalMultiplier);
  }
  const sideMultiplier = flatReturn || carrier.counterReturnAttack || carrier.reflectedHit || carrier.proposalReactive ? 1 : SideDamageMultiplier(effects, source);
  if (sideMultiplier !== 1 && raw > 0) raw = transition('side-damage-scale',`${source?.kind === 'enemy' ? 'Enemy' : 'Player'} damage scale`,raw,Math.max(raw >= 1 && sideMultiplier > 0 ? 1 : 0,raw*sideMultiplier),'offense',sideMultiplier);
  // Stat-adding buff statuses on the attacker (+1 per stack, never shrunk by side/physical multipliers):
  // STR (`attackDamageAdd`) on physical/attack hits; WIS (`divineDamageAdd`) on Divine hits; INT (`magicDamageAdd` + `arcaneDamageAdd`) on magic/Arcane hits.
  if (modern && !flatReturn) {
    const strBuff = ratingId === 'ar' || share < 1 ? getAdd(ctx, source, 'attackDamageAdd') : 0;
    if (strBuff) raw = transition('status:strength', 'Strength buff', raw, raw + strBuff);
    const traditions = CardSpellTraditions(carrier);
    const magicHit = isSpellCard(carrier) || isMagicalAttack(ctx, carrier) || share > 0 || packetHit;
    const divineHit = (magicHit && traditions.includes('divine')) || carrierHasTag(ctx, carrier, 'tradition:divine') || carrierHasTag(ctx, carrier, 'school:divine') || carrierHasTag(ctx, carrier, 'damage:sacred');
    const arcaneHit = (magicHit && traditions.includes('arcane')) || carrierHasTag(ctx, carrier, 'tradition:arcane') || carrierHasTag(ctx, carrier, 'damage:arcane') || carrierHasTag(ctx, carrier, 'damage.arcane');
    const wisBuff = divineHit ? getAdd(ctx, source, 'divineDamageAdd') : 0;
    if (wisBuff) raw = transition('status:wisdom', 'Wisdom buff', raw, raw + wisBuff);
    const intMagic = magicHit ? getAdd(ctx, source, 'magicDamageAdd') : 0;
    const intArcane = arcaneHit ? getAdd(ctx, source, 'arcaneDamageAdd') : 0;
    // ChangeAttribute is already included in the effective attributes read by spell power.
    if (intMagic + intArcane) raw = transition('status:intelligence', 'Intelligence buff', raw, raw + intMagic + intArcane);
  }
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
  const smashRule = modern && advantage && attacking === 'smash' ? fixCoreSmashVsDefensiveRules(fixCoreRules(ctx, target)) : null;
  // Core 2 Counter returns carry their advantage in the return itself (SPEC §17), so the chain does not multiply it again.
  const smashMultiplier = smashRule && defending === 'defend'
    ? smashRule.defendDamageMultiplier ?? smashRule.damageMultiplier : smashRule?.damageMultiplier;
  const matchupMultiplier = smashRule ? smashMultiplier : advantage && !flatReturn ? stances.advantageMultiplier ?? 1 : 1;
  // Owner, 2026-11-17 (stance decisions): a stance advantage and the target's stance weakness (Attack or Smash beating Prepared, and Prepared's melee
  // weakness) never stack: the hit takes the larger of the two. The weakness already sits in `raw`, so the advantage stage adds only what it exceeds.
  const advantageMultiplier = matchupMultiplier > 1 && weaknessMultiplier > 1 ? Math.max(matchupMultiplier, weaknessMultiplier) / weaknessMultiplier : matchupMultiplier;
  let amount=smashRule ? transition('smash-vs-defensive','Smash vs defensive stance',raw,raw*advantageMultiplier,'stance',advantageMultiplier)
    : transition('stance-advantage','Offensive stance advantage',raw,raw*advantageMultiplier,'stance',advantageMultiplier);
  // Owner, 2026-11-03: the number shown ahead of a hit is the raw hit, changed only by stances and statuses (attacker Strength/Weak, defender
  // Vulnerable, stance matchups) and damage-type weakness/resistance, never by what the defender does about it (defensive stance, Reflect, Block,
  // Poise, Ward, Barrier, Counter, Evade, AC, an ally's Guard interception, owner 2026-11-04). Display only: `amount`/`hpLoss` below still drive resolution unchanged.
  const rawHit = Math.max(0, Math.floor(amount + guardIntercepted * advantageMultiplier));
  amount=transition('stance-defense','Defensive stance advantage',amount,amount*(flatReturn?1:defense.multiplier),'stance',flatReturn?1:defense.multiplier);
  amount=modern ? Math.max(0,Math.floor(amount)) : transition('quantity-rounding','Damage quantity rounding',amount,Math.max(0,Math.floor(amount)),'rounding');
  const targeting=proposalTargetPlan(ctx,source,target,carrier);
  // Owner 2026-11-01: Evade is a tag and a status, not a stance, so no stance rolls the configured hit chance any more.
  let hitChance = 1;
  hitChance=targeting.unavoidable ? 1 : Math.max(0.05,Math.min(1,hitChance+targeting.accuracyDelta/100));
  if (fixCoreEnabled(ctx)) hitChance = (attackHitPreview(ctx, source, target, carrier, forecast ? { assumeInRange: true } : {})?.hitChance ?? 100) / 100;
  const evaded = roll !== null ? roll >= hitChance : forecast && fixCoreEnabled(ctx) && hitChance === 0;
  if (evaded) amount = 0;
  let smashBlockBonus = 0;
  if (smashRule && !evaded && target) {
    // Read from the Block held before this hit's own absorption.
    smashBlockBonus = Math.floor(smashRule.blockFraction * Math.max(0, target.block || 0));
    if (smashBlockBonus > 0) { sources.push({id:'smash-block-bonus',label:'Smash vs defensive stance: bonus from target Block',amount:smashBlockBonus,requested:amount,effective:amount+smashBlockBonus,stage:'stance',operation:'add'}); amount += smashBlockBonus; }
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
  // Ward health buffer: Block > Poise (base + temp Bonus Poise) > Ward (temp health) > HP.
  const wardHpMode = modern && FixCoreWardHpBuffer(ctx);
  const wardHpPool = wardHpMode ? EffectiveWardHp(ctx, target) : 0;
  const weaponPoiseRules = modern ? FixCoreWeaponPoiseRules(ctx) : null;
  // Legacy Ward (owner, 2026-11-01 / 2026-11-15): saved fights without `routing: "hpBuffer"` route through Poise.
  const wardRouted = modern && !wardHpMode && (target?.statuses?.ward?.stacks || 0) > 0;
  const wardBlockFirst = wardRouted && FixCoreWardBlockFirst(ctx);
  if (wardBlockFirst) {
    const total = physical + magical;
    const poisePool = Math.max(0, target?.persistentPoise?.value || 0);
    const blockSoak = Math.min(Math.max(0, target?.block || 0), total);
    blockSpent = blockSoak;
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
    const blockSoak = Math.min(Math.max(0, target?.block || 0), total - toPoise);
    blockSpent = blockSoak;
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
    // - Card damage hits Block -> Poise (ONLY when countering/preparing/smashing: reduces by 50% of current Poise, costs floor(0.5*damage)+1 Poise) -> Ward -> HP.
    // - Poise damage comes from the attacking weapon (1-3 base, +20% for sceptres/bows/staves, 1.25x Smash, 2x Smash vs Guarding), plus any card poiseDamage effects.
    const total = physical + magical;
    const blockSoak = Math.min(Math.max(0, target?.block || 0), total);
    blockSpent = blockSoak;
    const bypassAmount = PierceBlockIgnored(ctx, target, carrier, profile, total, blockSoak, pierceOut);
    pierceBypassed = Math.min(bypassAmount, blockSoak);
    blocked = blockSoak - pierceBypassed;
    const afterBlock = total - blocked;
    transition('block', 'Block', total, afterBlock, 'mitigation');
    const poisePool = Math.max(0, target?.persistentPoise?.value || 0);
    const mitigates = afterBlock > 0 && poisePool > 0 && StanceHasPoiseMitigation(weaponPoiseRules, defending);
    if (mitigates) {
      poiseMitigated = Math.min(afterBlock, Math.floor(poisePool * (weaponPoiseRules.mitigationPoiseFraction ?? 0.5)));
      poiseMitigationCost = Math.min(poisePool, Math.floor(afterBlock * (weaponPoiseRules.mitigationDrainDamageFraction ?? 0.5)) + (weaponPoiseRules.mitigationDrainFlat ?? 1));
      if (poiseMitigated > 0) {
        sources.push({ id: 'poise-mitigation', label: 'Poise reduction', amount: -poiseMitigated, requested: afterBlock, effective: afterBlock - poiseMitigated, stage: 'mitigation', operation: 'add' });
      }
    } else {
      poiseMitigated = 0;
      poiseMitigationCost = 0;
    }
    const postPoise = afterBlock - poiseMitigated;
    if (wardHpMode && wardHpPool > 0 && postPoise > 0) {
      wardHpAbsorbed = Math.min(postPoise, wardHpPool);
      wardMitigated = wardHpAbsorbed;
      const afterWard = postPoise - wardHpAbsorbed;
      transition('ward-hp', 'Ward (health buffer)', postPoise, afterWard, 'mitigation');
      amount = afterWard;
    } else {
      wardHpAbsorbed = 0;
      wardMitigated = 0;
      amount = postPoise;
    }
    if (!evaded && !flatReturn && incoming > 0) {
      weaponPoiseDamage = WeaponPoiseDamage(ctx, source, target, carrier, { attacking, defending, rules: weaponPoiseRules }).amount;
      const remainingPoise = Math.max(0, poisePool - poiseMitigationCost);
      poiseDrain = Math.min(remainingPoise, weaponPoiseDamage);
    }
  } else if (wardHpMode && wardHpPool > 0) {
    const total = physical + magical;
    const blockSoak = Math.min(Math.max(0, target?.block || 0), total);
    blockSpent = blockSoak;
    const bypassAmount = PierceBlockIgnored(ctx, target, carrier, profile, total, blockSoak, pierceOut);
    pierceBypassed = Math.min(bypassAmount, blockSoak);
    blocked = blockSoak - pierceBypassed;
    const afterBlock = total - blocked;
    transition('block', 'Block', total, afterBlock, 'mitigation');
    if (afterBlock > 0) {
      const remPhysical = Math.max(0, physical - blocked);
      const remMagical = Math.max(0, afterBlock - remPhysical);
      const poisePool = Math.max(0, target?.persistentPoise?.value || 0);
      const forceShare = smashRule ? null : ForcePoiseShare(ctx, carrier);
      const normalPoise = smashRule ? { amount: remPhysical, reduced: 0, sources: [] } : protectionReceipt(ctx, target, 'physical', remPhysical);
      const poise = forceShare === null ? normalPoise : ForcePoiseReceipt(target, remPhysical, forceShare, normalPoise);
      const poiseMeetsMagic = fixCoreWardDisabled(ctx);
      magicPoise = poiseMeetsMagic && !smashRule ? Math.min(remMagical, Math.max(0, poisePool - poise.reduced)) : 0;
      const magicToHp = remMagical - magicPoise;
      poiseDrain = smashRule && !evaded ? Math.min(poisePool, Math.floor(smashRule.poiseFraction * afterBlock)) : 0;
      poiseMitigated = poise.reduced + magicPoise;
      sources.push(...poise.sources);
      if (magicPoise > 0) sources.push({ id: 'poise-magic', label: 'Poise meets the spell', amount: -magicPoise, requested: remMagical, effective: magicToHp, stage: 'mitigation', operation: 'add' });
      const postPoise = poise.amount + magicToHp;
      wardHpAbsorbed = Math.min(postPoise, wardHpPool);
      wardMitigated = wardHpAbsorbed;
      const afterWard = postPoise - wardHpAbsorbed;
      transition('ward-hp', 'Ward (health buffer)', postPoise, afterWard, 'mitigation');
      amount = afterWard;
    } else {
      poiseMitigated = 0;
      poiseDrain = 0;
      wardHpAbsorbed = 0;
      wardMitigated = 0;
      amount = 0;
    }
  } else if (modern) {
    // Owner: Block soaks the whole hit (physical first, then magic); the magic Block leaves meets Barrier, then Ward.
    // Block is spent exactly as the same hit without pierce would spend it (so the invariant holds over a whole action). A pierce hit then
    // lets up to floor(fraction x its damage) of what Block soaked go through instead (owner, 2026-10-26); a reaction carries none.
    const blockPool = Math.max(0,target?.block || 0);
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
    blockSpent = plainPhysicalBlocked+plainMagicBlocked;
    const bypassAmount = PierceBlockIgnored(ctx,target,carrier,profile,physical+magical, blockSpent, pierceOut);
    pierceBypassed = Math.min(bypassAmount,blockSpent);
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
  return { ...(pierceOut.spent > 0 ? { skinSpent: pierceOut.spent } : {}), raw, rawHit, weaknesses, ...(element ? { element: { id: element.element, heal: element.heal } } : {}), pierceBypassed, piercePoise, magicPoise, wardMitigated, barrierMitigated,
    damageReceipt: damageReceipt(target?.id, [{incoming,physical,magical,blocked,barrierReduced:barrierMitigated,wardReduced:wardMitigated,poiseReduced:poiseMitigated,...(pierceBypassed ? {pierced:pierceBypassed,piercePoise} : {}),...(magicPoise ? {magicPoise} : {}),...(poiseDrain ? {poiseDamage:poiseDrain} : {}),hpLoss:amount,sources}]),
    ...(reflect ? { reflect } : {}),
    ...(wardHpMode && wardHpAbsorbed > 0 ? { wardHpBuffer: true, wardHpAbsorbed } : {}),
    ...(wardRouted ? { wardRouted: true } : {}), ...(wardBlockFirst ? { wardBlockFirst: true } : {}),
    hitChance, uncertain: (fixCoreEnabled(ctx) && hitChance < 1) && roll === null && !evaded,
    hpLossBounds: (fixCoreEnabled(ctx) && hitChance < 1 && !evaded) ? [0, amount] : [amount, amount], amount: amount + blocked, hpLoss: amount, blocked, poiseMitigated, poiseDrain, ...(poiseMitigationCost !== undefined ? { poiseMitigationCost } : {}), ...(weaponPoiseDamage > 0 ? { weaponPoiseDamage } : {}), ...(poiseSpared ? { poiseSpared } : {}),
    blockRemaining: Math.max(0, (target?.block || 0) - (blockSpent ?? blocked)), evaded, advantage,
    ...(smashRule ? { smashVsDefensive: { blockBonus: smashBlockBonus, poiseDamage: poiseDrain } } : {}),
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
