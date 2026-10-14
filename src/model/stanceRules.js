import { stanceRules } from '../content/stanceRules.js';
import { combatProfileFor } from './combatCardProfile.js';

export function stanceRulesFor(ctx) { return { ...stanceRules, ...(ctx?.stanceRules || ctx?.registries?.balance?.stanceRules || {}) }; }
export function stanceOf(carrier, entity = null) {
  if (!carrier) return null;
  const profile = carrier.combatProfile || (carrier.camp ? carrier : combatProfileFor(carrier));
  if (profile.stanceTrigger === false || !profile.maneuver) return null;
  const camp = ['spell', 'spells', 'magic', 'magical'].includes(profile.camp) ? 'spell' : 'physical';
  let maneuver = profile.maneuver;
  if (maneuver === 'defense' || maneuver === 'block') maneuver = 'defend';
  if (maneuver === 'spell' || maneuver === 'cast') maneuver = 'casting';
  const evade = profile.evade && profile.evadeEligible !== false
    && (!profile.evade.whileStatus || profile.evadeEligible === true || entity?.statuses?.[profile.evade.whileStatus]?.stacks > 0);
  if ((evade && ['defend', 'counter'].includes(maneuver)) || maneuver === 'evade') maneuver = 'evade';
  if (camp === 'spell' && !['defend', 'counter', 'evade'].includes(maneuver)
    && (profile.range || (profile.projectile || maneuver === 'ranged' ? 'ranged' : 'melee')) !== 'melee') maneuver = 'casting';
  if (maneuver === 'ranged') maneuver = 'attack';
  return { maneuver, camp, range: profile.range || 'melee', ...(profile.school ? { school: profile.school } : {}) };
}
export function sameStance(entity, carrier) {
  const active = stanceOf(entity?.combatStance), next = stanceOf(carrier, entity);
  return !!active && !!next && active.maneuver === next.maneuver && active.camp === next.camp;
}
export function stanceStaminaCost(base, entity, carrier, ctx = null) {
  if (ctx?.combatExpansionVersion !== 2 || !sameStance(entity, carrier)) return base;
  const cfg = stanceRulesFor(ctx), magical = stanceOf(carrier).camp === 'spell';
  return Math.max(magical ? cfg.magicalMinimumSp : cfg.physicalMinimumSp, base - cfg.sameStanceDiscount);
}
export function stanceRatingBonus(ctx, entity, id) {
  if (ctx?.combatExpansionVersion !== 2) return 0;
  const stance = stanceOf(entity?.combatStance);
  if (!stance) return 0;
  const cfg = stanceRulesFor(ctx), offensive = ['attack', 'smash', 'sweep', 'counter', 'casting'].includes(stance.maneuver);
  const defensive = ['defend', 'counter', 'evade'].includes(stance.maneuver);
  const offensiveId = stance.maneuver === 'casting' || (stance.maneuver === 'counter' && stance.camp === 'spell') ? 'pr' : 'ar';
  return (offensive && id === offensiveId ? cfg.offensiveRating : 0)
    + (defensive && id === (stance.camp === 'spell' ? 'ward' : 'dr') ? cfg.defensiveRating : 0);
}
export function stanceEntryBonuses(carrier, ctx = null) {
  const stance = stanceOf(carrier);
  if (!stance) return { precision: 0, evade: 0, block: 0, barrier: 0 };
  const cfg = stanceRulesFor(ctx), offensive = ['attack', 'smash', 'sweep', 'counter', 'casting'].includes(stance.maneuver);
  const defensive = ['defend', 'counter', 'evade'].includes(stance.maneuver);
  const amount = defensive ? cfg.entryProtection : 0;
  const share = cfg.schoolBlockShares?.[stance.school] ?? cfg.spellBlockShare;
  const block = stance.camp === 'spell' ? Math.round(amount * share) : amount;
  const profile = carrier.combatProfile || carrier;
  const auxiliaryEvade = profile.evade && profile.evadeEligible !== false
    && (!profile.evade.whileStatus || profile.evadeEligible === true);
  return { precision: offensive ? cfg.offensivePrecision : 0, evade: stance.maneuver === 'evade' || auxiliaryEvade ? cfg.evadeStacks : 0,
    block, barrier: amount - block };
}
