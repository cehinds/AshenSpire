import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
// A fight created before the 2026-11-14 ruling (attacks always hit, intents always read) keeps rolling: its snapshotted rules lack
// `accuracy.hitRoll` and `perception.roll`. Tests that assert the d20 or the perception check hand their fight through here.

// Owner, 2026-11-15 (Wave 2 batch 5): the Counter-stack keys (`counter.stackSource`, `returnPerStack`, ...) are newer than every earlier fight.
// Every wrapper below removes them from the shipped defaults while it builds, and puts them back after.
const COUNTER_STACK_KEYS = ['stackSource', 'returnPerStack', 'consumePerHit', 'decayPerTurn', 'advantageShare', 'stacksPerCard', 'stacksUpgradeBonus', 'stacksMax', 'stacksByCard'];
function stripCounterStacks() {
  const held = Object.fromEntries(COUNTER_STACK_KEYS.map(key => [key, fixCoreMechanics.counter[key]]));
  for (const key of COUNTER_STACK_KEYS) delete fixCoreMechanics.counter[key];
  // ...and the Counter stance still returns 25% of the HP a hit cost it (stanceBenefits.counter.hpReturnFraction), which the same ruling dropped.
  const stance = fixCoreMechanics.stanceBenefits?.counter;
  if (stance) stance.hpReturnFraction = 0.25;
  return () => { Object.assign(fixCoreMechanics.counter, held); if (stance) delete stance.hpReturnFraction; };
}
function guarded(build) { const restore = stripCounterStacks(); try { return build(); } finally { restore(); } }
/** The rules of a fight saved before the 2026-11-14 ruling: the perception key is absent, so intents roll. */
export function legacyPerceptionRules(rules = fixCoreMechanics) {
  const out = structuredClone(rules);
  delete out.perception.roll;
  return out;
}
export function legacyHitRoll(combat) {
  const rules = structuredClone(combat.fixCoreRules || combat.gameProfile?.fixCoreRules);
  delete rules.accuracy.hitRoll; delete rules.accuracy.evadeStacksPerCard;
  combat.fixCoreRules = rules;
  return combat;
}
export function legacyPerceptionRoll(combat) {
  const rules = structuredClone(combat.fixCoreRules || combat.gameProfile?.fixCoreRules);
  delete rules.perception.roll;
  combat.fixCoreRules = rules;
  return combat;
}
export const legacyRolls = combat => legacyPerceptionRoll(legacyHitRoll(combat));
/** The same, for a bare rules object: no hitRoll, no evadeStacksPerCard, no perception.roll. Returns a copy. */
export function legacyRules(rules) {
  const out = structuredClone(rules);
  delete out.accuracy.hitRoll; delete out.accuracy.evadeStacksPerCard; delete out.perception.roll;
  return out;
}
/**
 * Runs `build` while the shipped default rules read as a fight saved before the 2026-11-14 ruling (no hitRoll, evadeStacksPerCard or
 * perception.roll). A fight snapshots its rules when it is created, so build the fight inside and play it outside. Restores the keys after.
 */
export function withLegacyDefaults(build) { return guarded(() => withLegacyDefaultsInner(build)); }
function withLegacyDefaultsInner(build) {
  const held = { wardRouting: fixCoreMechanics.ward.routing, spellCosts: fixCoreMechanics.spellCosts, elementFlux: fixCoreMechanics.elementFlux, stanceBenefits: fixCoreMechanics.stanceBenefits, elements: fixCoreMechanics.elements, ratings: fixCoreMechanics.ratings, hitRoll: fixCoreMechanics.accuracy.hitRoll, evadeStacksPerCard: fixCoreMechanics.accuracy.evadeStacksPerCard, roll: fixCoreMechanics.perception.roll };
  delete fixCoreMechanics.ward.routing; // W25-W: Ward's block-first routing is newer than every earlier fight
  delete fixCoreMechanics.accuracy.hitRoll; delete fixCoreMechanics.accuracy.evadeStacksPerCard; delete fixCoreMechanics.perception.roll; delete fixCoreMechanics.stanceBenefits; delete fixCoreMechanics.elements; delete fixCoreMechanics.ratings; delete fixCoreMechanics.spellCosts; delete fixCoreMechanics.elementFlux;
  try { return build(); } finally {
    fixCoreMechanics.ward.routing = held.wardRouting;
    fixCoreMechanics.spellCosts = held.spellCosts; fixCoreMechanics.elementFlux = held.elementFlux; // W25-F: spell costs and elemental flux are absent from an earlier fight too
    fixCoreMechanics.elements = held.elements; fixCoreMechanics.ratings = held.ratings; // the element identities and PR from max(INT, WIS) (batch 2) are absent from an earlier fight too
    fixCoreMechanics.stanceBenefits = held.stanceBenefits; // the 2026-11-14 stance benefits (Wave 2.5) are also absent from a fight saved earlier
    fixCoreMechanics.accuracy.hitRoll = held.hitRoll; fixCoreMechanics.accuracy.evadeStacksPerCard = held.evadeStacksPerCard; fixCoreMechanics.perception.roll = held.roll;
  }
}

/** Runs `build` while the shipped default rules lack only `stanceBenefits`: a fight created between the 2026-11-14 exact-hits ruling and the stance benefits (Wave 2.5). */
export function withoutStanceBenefitDefaults(build) { return guarded(() => withoutStanceBenefitDefaultsInner(build)); }
function withoutStanceBenefitDefaultsInner(build) {
  const held = fixCoreMechanics.stanceBenefits;
  delete fixCoreMechanics.stanceBenefits;
  try { return build(); } finally { fixCoreMechanics.stanceBenefits = held; }
}

/**
 * Runs `build` while the shipped default rules lack every Wave 2.5 key (`stanceBenefits`, `elements`, `ratings`): a fight created before batch 2. Only these
 * keys are removed, so a shipped-rules fight played this way must reproduce the digests taken before batch 2.
 */
export function withoutBatch2Rules(build) { return guarded(() => withoutBatch2RulesInner(build)); }
function withoutBatch2RulesInner(build) {
  const held = { spellCosts: fixCoreMechanics.spellCosts, elementFlux: fixCoreMechanics.elementFlux, stanceBenefits: fixCoreMechanics.stanceBenefits, elements: fixCoreMechanics.elements, ratings: fixCoreMechanics.ratings };
  const wardRouting = fixCoreMechanics.ward.routing; delete fixCoreMechanics.ward.routing; // W25-W: newer than batch 2
  delete fixCoreMechanics.stanceBenefits; delete fixCoreMechanics.elements; delete fixCoreMechanics.ratings; delete fixCoreMechanics.spellCosts; delete fixCoreMechanics.elementFlux; // W25-F keys are newer than batch 2
  try { return build(); } finally { Object.assign(fixCoreMechanics, held); fixCoreMechanics.ward.routing = wardRouting; }
}

/** Runs `build` while the shipped default rules lack only the W25-F keys (`spellCosts`, `elementFlux`): a fight created before the spell cost and flux ruling. */
export function withoutSpellCostRules(build) { return guarded(() => withoutSpellCostRulesInner(build)); }
function withoutSpellCostRulesInner(build) {
  const held = { spellCosts: fixCoreMechanics.spellCosts, elementFlux: fixCoreMechanics.elementFlux }, wardRouting = fixCoreMechanics.ward.routing;
  delete fixCoreMechanics.spellCosts; delete fixCoreMechanics.elementFlux; delete fixCoreMechanics.ward.routing; // W25-W: Ward routing is newer than the spell cost ruling's base
  try { return build(); } finally { Object.assign(fixCoreMechanics, held); fixCoreMechanics.ward.routing = wardRouting; }
}

/** Runs `build` while the shipped default rules lack the Counter-stack keys (batch 5, 2026-11-15): a fight or card face from before the ruling. */
export function withoutCounterStackDefaults(build) { return guarded(build); }
