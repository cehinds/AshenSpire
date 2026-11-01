import { fixCoreEnabled, fixCoreReactionRules } from './fixCoreMechanics.js';
import { fixCoreRules } from './fixCoreRulesCache.js';
import { stanceRules } from '../content/stanceRules.js';
import { cardPreparationCategory } from './cardClassification.js';
import { combatProfileFor, isSpellCard } from './combatCardProfile.js';
import { core2ActionPolicyEnabled } from './core2ActionPolicy.js';
import { gameContent } from './gameProfile.js';
import { characterTags } from '../../engine/kernel/gameConfig.js';
import { mirroredManeuver, MIRRORED_TYPES } from './profileStance.js';
export { mirroredManeuver };

export function stanceRulesFor(ctx) { return { ...stanceRules, ...(ctx?.stanceRules || ctx?.registries?.balance?.stanceRules || {}) }; }

// Shared by execution and read-only move cards; authored pressure always wins.
export function enemySmashFallbackPoise(move, profile, ctx) {
  if (ctx?.combatExpansionVersion !== 2 || profile?.maneuver !== 'smash'
    || !(move.damage != null || move.effects?.some(effect => effect.op === 'damage'))
    || move.effects?.some(effect => effect.op === 'poiseDamage')) return null;
  return stanceRulesFor(ctx).fallbackPoise;
}

// Counter execution and catalogs must agree on authored lanes and fallback.
export function enemyCounterPoiseDamage(move, profile, ctx) {
  if (ctx?.combatExpansionVersion !== 2) return move.counterPoiseDamage || 0;
  const authored = profile?.counterPayload?.poise ?? move.counterPoiseDamage ?? 0;
  return authored > 0 || move.effects?.some(effect => effect.op === 'poiseDamage')
    ? authored : stanceRulesFor(ctx).fallbackPoise;
}
/** The maneuver a carrier is priced and recorded as: the mirrored basic's when it mirrors one, else its combat profile's. One source for stance, hit preview, live hit and mitigation. */
export function effectiveManeuver(carrier) { return mirroredManeuver(carrier) ?? carrier?.combatProfile?.maneuver; }
export function stanceOf(carrier, entity = null) {
  if (!carrier) return null;
  const tags = carrier.cardTags ?? carrier.tags;
  const normalized = tags ? { ...carrier, cardTags: tags.map(tag => typeof tag === 'string' ? tag : tag.id) } : carrier;
  const profile = carrier.combatProfile || (carrier.camp ? carrier : combatProfileFor(normalized));
  if (profile.stanceTrigger === false) return null;
  const preparation = cardPreparationCategory(carrier);
  if (!preparation && !profile.maneuver) return null;
  const camp = ['spell', 'spells', 'magic', 'magical'].includes(profile.camp) ? 'spell' : 'physical';
  // A Spell that mirrors a basic card (owner 2026-10-18) takes that basic's stance type; it stays a Spell.
  const mirrored = camp === 'spell' && (MIRRORED_TYPES.has(profile.mirrors) || profile.mirrored === true && MIRRORED_TYPES.has(profile.maneuver));
  let maneuver = mirrored ? (profile.mirrors || profile.maneuver) : preparation ? 'casting' : carrier.stanceTrigger?.stance || profile.stanceTrigger?.stance || profile.maneuver;
  if (maneuver === 'defense' || maneuver === 'block') maneuver = 'defend';
  if (maneuver === 'spell' || maneuver === 'cast' || maneuver === 'prepared') maneuver = 'casting';
  const evade = profile.evade && profile.evadeEligible !== false
    && (!profile.evade.whileStatus || profile.evadeEligible === true || entity?.statuses?.[profile.evade.whileStatus]?.stacks > 0);
  if (!preparation && ((evade && ['defend', 'counter'].includes(maneuver)) || maneuver === 'evade')) maneuver = 'evade';
  if (camp === 'spell' && !mirrored && !['defend', 'counter', 'evade'].includes(maneuver)
    && (profile.range || (profile.projectile || maneuver === 'ranged' ? 'ranged' : 'melee')) !== 'melee') maneuver = 'casting';
  if (maneuver === 'ranged') maneuver = 'attack';
  // Evade remains the stance identity; retain authored Counter offense across snapshots.
  const counterStance = maneuver === 'evade' && (profile.maneuver === 'counter' || profile.counterStance === true);
  return { maneuver, camp, ...(mirrored ? { mirrored: true } : {}), ...(counterStance ? { counterStance: true } : {}), range: profile.range || 'melee', ...(profile.school ? { school: profile.school } : {}) };
}
export function sameStance(entity, carrier) {
  const active = stanceOf(entity?.combatStance), next = stanceOf(carrier, entity);
  return !!next && [...(entity?.concurrentStances || []),active].some(row=>row && row.maneuver===next.maneuver && row.camp===next.camp);
}
function hasAdept(ctx, entity, tag) {
  if (entity?.kind === 'enemy' || entity?.classUnequipped) return false;
  const character = gameContent(ctx, 'characters')?.find(row => row.id === entity?.classId);
  return !!character && characterTags(character).includes(tag);
}
function adeptMinimum(ctx, carrier, ownTurnMinimum) {
  const tags = carrier?.cardTags || carrier?.tags || [];
  return ctx.phase === 'enemy' && tags.some(tag => (typeof tag === 'string' ? tag : tag?.id) === 'trait:reaction')
    ? 0 : ownTurnMinimum;
}
function isCounterReaction(ctx, entity, carrier) {
  if (ctx.phase !== 'enemy' || entity?.kind === 'enemy' || entity?.combatStance?.maneuver !== 'counter') return false;
  const tags = (carrier?.cardTags || carrier?.tags || []).map(tag => typeof tag === 'string' ? tag : tag?.id);
  return tags.includes('trait:reaction') && (tags.includes('maneuver:counter') || carrier?.combatProfile?.maneuver === 'counter');
}
// New fights use class-entitled resource lanes; existing active fights retain their accepted pricing.
export function stanceStaminaCost(base, entity, carrier, ctx = null, mpBase = 0) {
  if (ctx?.combatExpansionVersion !== 2 || !sameStance(entity, carrier)) return base;
  if (fixCoreEnabled(ctx)) {
    // Authored enemy plans budget moves through their existing one-lane rule.
    // The player's hand-card reaction restriction must not reprice that plan.
    if (entity?.kind === 'enemy') {
      if (!(base > 0) || mpBase > 0) return base;
      const cfg = fixCoreRules(ctx, entity, carrier).stance;
      return Math.max(cfg.minimumCost, base - cfg.discount);
    }
    if (core2ActionPolicyEnabled(ctx)) {
      // Owner 2026-10-31 (SPEC §17): a Counter reaction played from Counter stance on the enemy's turn costs one less SP
      // (never below 0) whether or not the class is an Adept; every other card keeps the Adept gate below.
      if (isCounterReaction(ctx, entity, carrier) && base > 0 && carrier?.cost !== 'X') {
        return Math.max(0, base - fixCoreReactionRules(fixCoreRules(ctx, entity, carrier)).handCostDiscount);
      }
      if (!(base > 0) || carrier?.cost === 'X' || isSpellCard(carrier) || !hasAdept(ctx, entity, 'training.basic')) return base;
      const cfg = fixCoreRules(ctx, entity, carrier).stance;
      return Math.max(adeptMinimum(ctx, carrier, cfg.minimumCost), base - cfg.discount);
    }
    const tags = carrier?.cardTags || carrier?.tags || [];
    if (!(base > 0) || carrier?.cost === 'X' || ctx.phase !== 'enemy'
      || !tags.some(tag => (typeof tag === 'string' ? tag : tag?.id) === 'trait:reaction')) return base;
    return Math.max(0, base - fixCoreReactionRules(fixCoreRules(ctx, entity, carrier)).handCostDiscount);
  }
  const cfg = stanceRulesFor(ctx), magical = stanceOf(carrier).camp === 'spell';
  return Math.max(magical ? cfg.magicalMinimumSp : cfg.physicalMinimumSp, base - cfg.sameStanceDiscount);
}
export function stanceRatingBonus(ctx, entity, id) {
  if (ctx?.combatExpansionVersion !== 2) return 0;
  const stance = stanceOf(entity?.combatStance);
  if (!stance) return 0;
  const cfg = stanceRulesFor(ctx), offensive = stance.counterStance || ['attack', 'smash', 'sweep', 'counter', 'casting'].includes(stance.maneuver);
  const defensive = ['defend', 'counter', 'evade'].includes(stance.maneuver);
  const offensiveId = stance.maneuver === 'casting' || stance.mirrored || ((stance.maneuver === 'counter' || stance.counterStance) && stance.camp === 'spell') ? 'pr' : 'ar';
  return (offensive && id === offensiveId ? cfg.offensiveRating : 0)
    + (defensive && id === (stance.camp === 'spell' ? 'ward' : 'dr') ? cfg.defensiveRating : 0);
}
export function stanceEntryBonuses(carrier, ctx = null) {
  const stance = stanceOf(carrier);
  if (!stance) return { precision: 0, evade: 0, block: 0, barrier: 0 };
  const cfg = stanceRulesFor(ctx), offensive = stance.counterStance || ['attack', 'smash', 'sweep', 'counter', 'casting'].includes(stance.maneuver);
  const defensive = ['defend', 'counter', 'evade'].includes(stance.maneuver);
  const amount = defensive ? cfg.entryProtection : 0;
  const share = cfg.schoolBlockShares?.[stance.school] ?? cfg.spellBlockShare;
  const block = stance.camp === 'spell' ? (fixCoreEnabled(ctx) ? Math.floor(amount * share) : Math.round(amount * share)) : amount;
  const profile = carrier.combatProfile || carrier;
  const auxiliaryEvade = profile.evade && profile.evadeEligible !== false
    && (!profile.evade.whileStatus || profile.evadeEligible === true);
  // Core 2 reads the entry grant from its own rules (the Evade card's evadeStackBase: 3, or a resumed fight's snapshot value);
  // the global stanceRules.evadeStacks stays 1 for the non-Core expanded path.
  return { precision: offensive ? cfg.offensivePrecision : 0, evade: stance.maneuver === 'evade' || auxiliaryEvade ? (fixCoreEnabled(ctx) ? fixCoreRules(ctx).accuracy.evadeStackBase : cfg.evadeStacks) : 0,
    block, barrier: amount - block };
}

// Successive Spells cut each other's Mana: a mirrored cantrip plays in its basic's stance but is still a
// Spell, so a Spell after it (or it after a Spell) takes the same-stance Mana discount.
export function spellChain(entity, carrier) {
  const next = stanceOf(carrier, entity);
  return !!next && next.camp === 'spell'
    && [...(entity?.concurrentStances || []), stanceOf(entity?.combatStance)].some(row => row && row.camp === 'spell' && (row.mirrored || next.mirrored));
}
export function stanceManaCost(base, entity, carrier, ctx) {
  if (!fixCoreEnabled(ctx) || !(base > 0)) return base;
  if (core2ActionPolicyEnabled(ctx) && entity?.kind !== 'enemy') {
    const adept = isSpellCard(carrier) && hasAdept(ctx, entity, 'training.graduate') && sameStance(entity, carrier);
    if (!adept && !spellChain(entity, carrier)) return base;
    const cfg = fixCoreRules(ctx, entity, carrier).stance;
    return Math.max(adept ? adeptMinimum(ctx, carrier, cfg.minimumCost) : cfg.minimumCost, base - cfg.discount);
  }
  if (!(sameStance(entity, carrier) || spellChain(entity, carrier))) return base;
  const cfg = fixCoreRules(ctx, entity, carrier).stance;
  return Math.max(cfg.minimumCost, base - cfg.discount);
}
export function stanceEffectiveness(ctx, source, carrier) {
  return fixCoreEnabled(ctx) && (carrier?.fixCoreSameStance ?? sameStance(source, carrier)) ? fixCoreRules(ctx, source, carrier).stance.effectivenessMultiplier : 1;
}
