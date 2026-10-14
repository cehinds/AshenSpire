import { combatProfileFor } from './combatCardProfile.js';

export function actualCardRank(def) {
  return Array.isArray(def.gradeProfiles) ? def.abilityRank ?? 0 : def.rank ?? 1;
}

// Derived public taxonomy. Authored type remains the engine/save-compatible kind.
export function cardClassification(def) {
  if (['skillBook', 'revive', 'CONSUMABLE'].includes(def.kind))
    return { cardCategory: 'consumable', stanceType: null, stanceGroups: [] };
  if (['power', 'consumable', 'status', 'curse'].includes(def.type)) {
    return { cardCategory: def.type, stanceType: null, stanceGroups: [] };
  }
  const profile = combatProfileFor(def);
  let stanceType = def.evade != null ? 'evade'
    : ({ smash: 'smash', attack: 'attack', sweep: 'sweep', counter: 'counter', defend: 'defense' })[profile.maneuver];
  if (!stanceType && (def.type === 'attack' || ['casting', 'ranged'].includes(profile.maneuver)
    && (def.effects || []).some(effect => effect.op === 'damage'))) stanceType = 'attack';
  if (!stanceType) return { cardCategory: 'skill', stanceType: null, stanceGroups: [] };
  const stanceGroups = ['defense', 'evade'].includes(stanceType) ? ['defensive']
    : stanceType === 'counter' || stanceType === 'sweep' && (actualCardRank(def) >= 2 || def.defensiveReaction === true)
      ? ['offense', 'defensive'] : ['offense'];
  return { cardCategory: 'stance', stanceType, stanceGroups };
}
