// Enemy weaknesses at run time (owner, 2026-10-31; SPEC 5.3). Headless. The authored rows live on the enemy
// entity (`weaknesses`, model/enemyWeaknessRules.js); this module classifies a hit and answers what it triggers.
import { canonicalDamageType, componentPartsOf, magicShareOf, schoolOf, splitDamageTypesOf } from '../model/combatRatings.js';
import { combatRules as damageTypeRules } from '../content/combatRules.js';
import { weaknessAmount, WEAKNESS_ELEMENTS, WEAKNESS_PHYSICAL, WEAKNESS_STATUS_EFFECTS } from '../model/enemyWeaknessRules.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { proposalContext } from './proposalStatusRuntime.js';
import { proposalRuleEnabled } from '../model/proposalStatusRules.js';

/** Weaknesses belong to Core combat (SPEC 5.3): a legacy or expanded fight neither carries nor applies them. */
export const weaknessesActive = ctx => fixCoreEnabled(ctx);
/** The weaknesses an enemy of this definition starts a fight with: the definition's under Core, none otherwise. */
export const startingWeaknesses = (ctx, def) => weaknessesActive(ctx) ? def?.weaknesses : undefined;
/** A fight saved before weaknesses has none on its enemies: they take their definition's (solo and co-op restore share this). */
export function refillWeaknesses(ctx, enemies, registries) {
  return (enemies || []).map(enemy => enemy.weaknesses === undefined && weaknessesActive(ctx) && registries.enemies.get(enemy.enemyId)?.weaknesses
    ? { ...enemy, weaknesses: structuredClone(registries.enemies.get(enemy.enemyId).weaknesses) } : enemy);
}

const add = (set, type) => { const t = canonicalDamageType(type); if (t && (WEAKNESS_PHYSICAL.includes(t) || WEAKNESS_ELEMENTS.includes(t))) set.add(t); };

/** The elements a status on the attacker adds to its weapon attacks (a `weaponBonus` behavior), for a direct weapon hit. */
function imbuedElements(ctx, source, carrier) {
  const out = [];
  if (!source?.statuses || carrier?.proposalReactive || carrier?.combatReaction) return out;
  const rules = ctx?.registries?.proposalStatusRules?.rules || ctx?.registries?.proposalStatusRules || {};
  const capabilities = proposalContext(ctx).capabilities;
  const tags = carrier?.cardTags ?? carrier?.tags ?? [];
  for (const [status, instance] of Object.entries(source.statuses)) {
    const rule = rules[status];
    if (!(instance?.stacks > 0) || !proposalRuleEnabled(rule, capabilities)) continue;
    for (const b of rule.behaviors || []) {
      if (b.kind === 'weaponBonus' && b.damageType && (!b.requiredTags?.length || b.requiredTags.some(tag => tags.includes(tag)))) out.push(b.damageType);
    }
  }
  return out;
}

/**
 * hitWeaknessTriggers(ctx, source, carrier, profile?, share?) -> the triggers a hit carries: its physical type(s)
 * (the wielded weapon's, via the carrier's resolved profile), `magic` when any of it is magic, and each element
 * (its school or damage type, its damage components, an element an attacker status adds to weapon attacks).
 */
export function hitWeaknessTriggers(ctx, source, carrier = {}, profile = carrier.combatProfile || {}, share = magicShareOf(profile, ctx?.ratingsRules)) {
  const triggers = new Set();
  const types = [profile.damageType, carrier.damageType, profile.physicalDamageType, carrier.physicalDamageType, ...(profile.damageComponents || []).map(row => row?.type)];
  for (const type of types) add(triggers, type);
  const parts = componentPartsOf(profile);
  // A hit with a physical part and no stated type is the wielded weapon's blow, else bare-handed Blunt (splitDamageTypesOf).
  if (share < 1 && ![...triggers].some(t => WEAKNESS_PHYSICAL.includes(t))) add(triggers, splitDamageTypesOf(profile).physical);
  if (share > 0) {
    triggers.add('magic');
    const school = damageTypeRules.schools?.[schoolOf(profile)];
    add(triggers, school?.magicType || schoolOf(profile));
    if (!parts && ![...triggers].some(t => WEAKNESS_ELEMENTS.includes(t))) add(triggers, splitDamageTypesOf(profile).magic);
  }
  for (const element of imbuedElements(ctx, source, carrier)) { add(triggers, element); triggers.add('magic'); }
  return [...triggers];
}

/** The target's weaknesses a hit's triggers match, as [{ to, effect, amount }] with the amount resolved. */
export function matchingHitWeaknesses(target, triggers) {
  if (!Array.isArray(target?.weaknesses) || !triggers?.length) return [];
  return target.weaknesses
    .filter(row => !WEAKNESS_STATUS_EFFECTS.includes(row.effect) && triggers.includes(row.to))
    .map(row => ({ to: row.to, effect: row.effect, amount: weaknessAmount(row) }));
}

const titled = word => word.charAt(0).toUpperCase() + word.slice(1);
export const weaknessLabel = to => `Weak to ${titled(to)}`;

/** Extra stacks a status gets when applied to a target weak to it (0 for a self- or ally-applied status). */
export function weaknessStackBonus(ctx, target, statusId, source) {
  if (!weaknessesActive(ctx) || target?.kind !== 'enemy' || !Array.isArray(target.weaknesses) || !source || source.kind === target.kind) return 0;
  return target.weaknesses.filter(row => row.effect === 'stacks' && row.to === statusId).reduce((sum, row) => sum + weaknessAmount(row), 0);
}

/** The multiplier on a status's own damage (burn or venom tick, bleed or frost burst) for a weak target. */
export function weaknessTickMultiplier(ctx, target, statusId) {
  if (!weaknessesActive(ctx) || target?.kind !== 'enemy' || !Array.isArray(target.weaknesses)) return 1;
  return target.weaknesses.filter(row => row.effect === 'tick' && row.to === statusId)
    .reduce((product, row) => product * (1 + weaknessAmount(row) / 100), 1);
}
