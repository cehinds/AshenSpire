// Reaction rules version 2: the card trait projection (docs/combat-card-traits-contract.md,
// "Tags" and "Card picks"). A pure function of a card definition. It is applied
// only when reaction rules version 2 is active; version 1 never sees these tags.
import { combatProfileFor } from '../model/combatCardProfile.js';
import { objectTagIds } from './tags.js';

// Tier T: the authored ability rank for graded (progression) cards, otherwise
// min(5, floor(rank / 2)) of the card's resolved rank (1 when unranked, so T 0).
export function cardTier(def) {
  if (Array.isArray(def.gradeProfiles)) return Number.isInteger(def.abilityRank) ? def.abilityRank : 0;
  const rank = Number.isInteger(def.rank) ? def.rank : 0;
  return Math.min(5, Math.floor(rank / 2));
}

const SWEEP_ANY_TIER = new Set(['whirlingGuard', 'sweepingBlow']);
const SWEEP_T3 = new Set(['crimsonCleave', 'progression-ashen-cleaver']);
const DEFEND_REACTION_T4 = new Set(['bracingStance', 'smokeBomb', 'vanish', 'progression-cinder-guard',
  'progression-warbound-defiance', 'progression-pocket-coil', 'crystalBarrier', 'blightward',
  'progression-lunar-aegis', 'progression-firmament-ward']);
const COUNTER_NO_STRIKE = new Set(['dodgeRoll', 'evasiveGuard', 'backstep', 'acrobaticsRogue', 'nockAndWait', 'barrageCounter']);
const SWEEP_STRIKE_T4 = new Set(['crimsonCleave', 'progression-ashen-cleaver']);
const COUNTER_IMPACT_SPELL = new Set(['frostCounter', 'forceCounter', 'alterationCounter', 'illusionCounter',
  'umbralWard', 'progression-rime-mirror']);
const COUNTER_IMPACT_EXCLUDED = new Set(['dodgeRoll', 'evasiveGuard']);
const DEFEND_IMPACT_T4 = new Set(['bracingStance', 'progression-cinder-guard', 'progression-warbound-defiance',
  'progression-red-standard', 'progression-crown-of-cinders']);
const COUNTER_FLUX_WARD = new Set(['umbralWard', 'wardingStar', 'frostCounter', 'fireCounter', 'lightningCounter',
  'alterationCounter', 'illusionCounter', 'divineCounter', 'decayCounter', 'barrageCounter', 'progression-rime-mirror']);
const FLUX_T2 = new Set(['hex', 'contagion', 'butterflyPlague', 'gravityWell', 'blightBloom']);
const DEFEND_BARRIER_EFFECTS = new Set(['block', 'gainBarrier', 'gainWard']);
const ENEMY_DAMAGE_TARGETS = new Set(['enemy', 'allEnemies']);

function hasEffect(def, ops, targets = null) {
  return (def.effects || []).some(effect => ops.has(effect.op) && (!targets || targets.has(effect.target)));
}

// Pick rules. Returns { reaction, counterstrike, impact, flux } where impact and
// flux are the N values (undefined when the card does not carry them).
function picks(def, profile, tier) {
  const id = def.id;
  const maneuver = profile.maneuver;
  const camp = profile.camp;
  const type = def.type;
  const out = {};

  // Reaction
  if (maneuver === 'counter' || def.evade != null) out.reaction = true;
  if (maneuver === 'sweep' && (SWEEP_ANY_TIER.has(id) || (SWEEP_T3.has(id) && tier >= 3))) out.reaction = true;
  if (maneuver === 'defend' && DEFEND_REACTION_T4.has(id) && tier >= 4) out.reaction = true;

  // Counterstrike
  if (maneuver === 'counter' && !COUNTER_NO_STRIKE.has(id)) out.counterstrike = true;
  if (SWEEP_STRIKE_T4.has(id) && tier >= 4) out.counterstrike = true;

  // Impact
  let impactBase = 0;
  if (maneuver === 'smash') impactBase = 2;
  else if (maneuver === 'counter' && camp === 'physical' && !COUNTER_IMPACT_EXCLUDED.has(id)) impactBase = 1;
  else if (COUNTER_IMPACT_SPELL.has(id)) impactBase = 1;
  else if (maneuver === 'attack' && camp === 'physical' && tier >= 3) impactBase = 1;
  else if (maneuver === 'sweep' && tier >= 2) impactBase = 1;
  else if (maneuver === 'defend' && camp === 'spell' && hasEffect(def, DEFEND_BARRIER_EFFECTS)) impactBase = 1;
  else if (maneuver === 'defend' && DEFEND_IMPACT_T4.has(id) && tier >= 4) impactBase = 1;
  if (impactBase) out.impact = impactBase + Math.floor(tier / 2);

  // Flux
  let flux = false;
  if (camp === 'spell' && hasEffect(def, new Set(['damage']), ENEMY_DAMAGE_TARGETS)) flux = true;
  if (COUNTER_FLUX_WARD.has(id)) flux = true;
  if (FLUX_T2.has(id) && tier >= 2) flux = true;
  if (maneuver === 'attack' && camp === 'physical' && tier >= 3 && ['fire', 'arcane'].includes(profile.damageType)) flux = true;
  if (camp === 'spell' && type === 'power' && tier >= 4) flux = true;
  if (flux) out.flux = 1 + Math.floor(tier / 2);

  return out;
}

const TRAIT_TAG = { reaction: 'trait:reaction', counterstrike: 'trait:counterstrike', impact: 'trait:impact', flux: 'trait:flux' };

/**
 * applyCardTraits(def) -> def with the trait tags and values, or def unchanged
 * when no trait applies. The input is never mutated.
 */
export function applyCardTraits(def) {
  const profile = combatProfileFor(def);
  const found = picks(def, profile, cardTier(def));
  const keys = Object.keys(TRAIT_TAG).filter(key => found[key] !== undefined && found[key] !== false);
  if (!keys.length) return def;
  const ids = keys.map(key => TRAIT_TAG[key]);
  const baseTags = def.tags ?? objectTagIds('card', def.id);
  const tags = [...baseTags, ...ids.filter(tag => !baseTags.includes(tag))];
  const next = { ...def, tags };
  if (def.cardTags) next.cardTags = [...def.cardTags, ...ids.filter(tag => !def.cardTags.includes(tag))];
  const traitValues = {};
  for (const key of keys) traitValues[key] = found[key] === true ? true : found[key];
  next.traitValues = traitValues;
  return next;
}
