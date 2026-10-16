import { combatProfileFor } from './combatCardProfile.js';

export function actualCardRank(def) {
  return Array.isArray(def.gradeProfiles) ? def.abilityRank ?? 0 : def.rank ?? 1;
}

const tagIds = def => (def.cardTags ?? def.tags)?.map(tag => typeof tag === 'string' ? tag : tag.id);
const profileFor = def => def.combatProfile || (def.camp ? def : combatProfileFor(tagIds(def) ? { ...def, cardTags: tagIds(def) } : def));
function martialStanceType(def, profile) {
  let stance = def.evade != null ? 'evade'
    : ({ smash: 'smash', attack: 'attack', sweep: 'sweep', counter: 'counter', defend: 'defense' })[profile.maneuver];
  if (!stance && (def.type === 'attack' || ['casting', 'ranged'].includes(profile.maneuver)
    && (def.effects || []).some(effect => effect.op === 'damage'))) stance = 'attack';
  return stance;
}

// Public kinds are independent of the legacy Attack/Skill effect buckets.
export function cardPreparationCategory(def = {}) {
  if (['consumable', 'status', 'curse'].includes(def.type) || ['skillBook', 'revive', 'CONSUMABLE'].includes(def.kind)) return null;
  const profile = profileFor(def), tags = tagIds(def) || [];
  const kinds = [...(def.kindIds || []), ...tags];
  if (def.type === 'power' || kinds.includes('classification.power')) return 'power';
  const explicitSpell = kinds.includes('classification.spell') || tags.includes('source:spell')
    || def.abilityKind === 'spell' || def.type === 'spell';
  const cardKind = ['attack', 'skill', 'power', 'spell'].includes(def.type)
    || kinds.some(kind => ['classification.attack', 'classification.skill', 'classification.power'].includes(kind));
  // A spell camp changes a card's public category; untyped enemy moves keep
  // their authored roles even when they carry casting or defensive maneuvers.
  if (explicitSpell || profile.camp === 'spell' && cardKind) return 'spell';
  const skill = def.type === 'skill' || kinds.includes('classification.skill');
  if (skill && (profile.maneuver === 'casting' || !martialStanceType(def, profile))) return 'skill';
  return null;
}

// Derived public taxonomy. Authored type remains the engine/save-compatible kind.
export function cardClassification(def) {
  if (['skillBook', 'revive', 'CONSUMABLE'].includes(def.kind))
    return { cardCategory: 'consumable', stanceType: null, stanceGroups: [] };
  const preparation = cardPreparationCategory(def);
  if (preparation) return { cardCategory: preparation, stanceType: 'prepare', stanceGroups: [] };
  if (['consumable', 'status', 'curse'].includes(def.type)) {
    return { cardCategory: def.type, stanceType: null, stanceGroups: [] };
  }
  const profile = profileFor(def);
  const stanceType = martialStanceType(def, profile);
  if (!stanceType) return { cardCategory: 'skill', stanceType: 'prepare', stanceGroups: [] };
  const stanceGroups = ['defense', 'evade'].includes(stanceType) ? ['defensive']
    : stanceType === 'counter' || stanceType === 'sweep' && (actualCardRank(def) >= 2 || def.defensiveReaction === true)
      ? ['offense', 'defensive'] : ['offense'];
  return { cardCategory: 'stance', stanceType, stanceGroups };
}
