import { projectGameCard } from './gameProfile.js';
import { cardManaPolicy } from '../content/generated/cardManaPolicy.js';
import { combatProfileFor } from './combatCardProfile.js';

// The JSON policy prices base faces. Combat charges, item mods and explicit
// discounts run later; they may still reduce what is actually paid.
export function validateCardManaPolicy(policy = cardManaPolicy) {
  if (!Number.isSafeInteger(policy.minimumMana) || policy.minimumMana < 0) throw new Error('cardManaPolicy.minimumMana must be a nonnegative integer');
  for (const key of ['weaponArtTags', 'excludedSpellTypes', 'equipmentBasicRoles']) {
    if (!Array.isArray(policy[key]) || policy[key].some(value => typeof value !== 'string')) throw new Error(`cardManaPolicy.${key} must be an array of strings`);
  }
  return policy;
}
validateCardManaPolicy();
const artIds = new WeakMap();
const configuredCosts = new WeakMap();
function hasConfiguredResourceCosts(registries, def) {
  if (registries.gameProfile?.foundation?.mode !== 'configured'
    || registries.gameProfile.modules.cards?.mode !== 'configured') return false;
  let costs = configuredCosts.get(registries);
  if (!costs) { costs = new Map(); configuredCosts.set(registries, costs); }
  if (!costs.has(def.id)) costs.set(def.id, !!projectGameCard(registries, def.id)?.resourceCosts);
  return costs.get(def.id);
}
function weaponArtIds(registries) {
  if (!artIds.has(registries)) artIds.set(registries, new Set((registries.equipment?.armaments || [])
    .flatMap(piece => piece.weaponCardPackage?.weaponArtDefaults || [])));
  return artIds.get(registries);
}

export function cardManaCategory(registries, def, policy = cardManaPolicy) {
  const tags = def.cardTags ?? def.tags ?? [];
  // Real weapon-art identity takes precedence over its card type: a mounted
  // art can itself be a Power. An unarmed fallback assigned a UI mount is not
  // enough to turn a basic Dodge/Strike into a weapon art.
  if (weaponArtIds(registries).has(def.id) || policy.weaponArtTags.some(tag => tags.includes(tag))) return 'weaponArt';
  if (policy.excludedSpellTypes.includes(def.type)) return null;
  if (def.equipmentProfileId && policy.equipmentBasicRoles.includes(def.equipmentRole)) return null;
  if (def.abilityKind === policy.spellAbilityKind || combatProfileFor(def).camp === policy.spellCamp) return 'spell';
  return null;
}

export function applyBaseManaPolicy(registries, def, policy = cardManaPolicy) {
  if (policy.respectDisabledMana && registries.gameProfile?.foundation?.mode === 'configured'
    && !registries.gameProfile.modules.resources?.include?.includes('mp')) return def;
  if (!cardManaCategory(registries, def, policy) || (def.manaCost || 0) >= policy.minimumMana) return def;
  // Configured cards own explicit resource costs, including zero. The legacy
  // spell minimum must not make their printed face disagree with live payment.
  if (hasConfiguredResourceCosts(registries, def)) return def;
  return Object.freeze({ ...def, manaCost: policy.minimumMana });
}
