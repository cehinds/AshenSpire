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
  return Object.freeze({ ...def, manaCost: policy.minimumMana });
}
