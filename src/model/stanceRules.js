import { fixCoreEnabled, fixCoreRules } from './fixCoreMechanics.js';
import { stanceRules } from '../content/stanceRules.js';
import { cardPreparationCategory } from './cardClassification.js';
import { combatProfileFor } from './combatCardProfile.js';
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
// Core discounts one lane (owner ruling D6): MP when the card costs MP (`mpBase` > 0), else SP.
export function stanceStaminaCost(base, entity, carrier, ctx = null, mpBase = 0) {
  if (ctx?.combatExpansionVersion !== 2 || !sameStance(entity, carrier)) return base;
  if (fixCoreEnabled(ctx)) {
    if (!(base > 0) || mpBase > 0) return base;
    const cfg = fixCoreRules(ctx, entity, carrier).stance;
    return Math.max(cfg.minimumCost, base - cfg.discount);
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
  return { precision: offensive ? cfg.offensivePrecision : 0, evade: stance.maneuver === 'evade' || auxiliaryEvade ? cfg.evadeStacks : 0,
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
  if (!fixCoreEnabled(ctx) || !(base > 0) || !(sameStance(entity, carrier) || spellChain(entity, carrier))) return base;
  const cfg = fixCoreRules(ctx, entity, carrier).stance;
  return Math.max(cfg.minimumCost, base - cfg.discount);
}
export function stanceEffectiveness(ctx, source, carrier) {
  return fixCoreEnabled(ctx) && (carrier?.fixCoreSameStance ?? sameStance(source, carrier)) ? fixCoreRules(ctx, source, carrier).stance.effectivenessMultiplier : 1;
}
