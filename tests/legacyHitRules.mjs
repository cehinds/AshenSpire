import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
// A fight created before the 2026-11-14 ruling (attacks always hit, intents always read) keeps rolling: its snapshotted rules lack
// `accuracy.hitRoll` and `perception.roll`. Tests that assert the d20 or the perception check hand their fight through here.
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
export function withLegacyDefaults(build) {
  const held = { stanceBenefits: fixCoreMechanics.stanceBenefits, elements: fixCoreMechanics.elements, ratings: fixCoreMechanics.ratings, hitRoll: fixCoreMechanics.accuracy.hitRoll, evadeStacksPerCard: fixCoreMechanics.accuracy.evadeStacksPerCard, roll: fixCoreMechanics.perception.roll };
  delete fixCoreMechanics.accuracy.hitRoll; delete fixCoreMechanics.accuracy.evadeStacksPerCard; delete fixCoreMechanics.perception.roll; delete fixCoreMechanics.stanceBenefits; delete fixCoreMechanics.elements; delete fixCoreMechanics.ratings;
  try { return build(); } finally {
    fixCoreMechanics.elements = held.elements; fixCoreMechanics.ratings = held.ratings; // the element identities and PR from max(INT, WIS) (batch 2) are absent from an earlier fight too
    fixCoreMechanics.stanceBenefits = held.stanceBenefits; // the 2026-11-14 stance benefits (Wave 2.5) are also absent from a fight saved earlier
    fixCoreMechanics.accuracy.hitRoll = held.hitRoll; fixCoreMechanics.accuracy.evadeStacksPerCard = held.evadeStacksPerCard; fixCoreMechanics.perception.roll = held.roll;
  }
}

/** Runs `build` while the shipped default rules lack only `stanceBenefits`: a fight created between the 2026-11-14 exact-hits ruling and the stance benefits (Wave 2.5). */
export function withoutStanceBenefitDefaults(build) {
  const held = fixCoreMechanics.stanceBenefits;
  delete fixCoreMechanics.stanceBenefits;
  try { return build(); } finally { fixCoreMechanics.stanceBenefits = held; }
}

/**
 * Runs `build` while the shipped default rules lack every Wave 2.5 key (`stanceBenefits`, `elements`, `ratings`): a fight created before batch 2. Only these
 * keys are removed, so a shipped-rules fight played this way must reproduce the digests taken before batch 2.
 */
export function withoutBatch2Rules(build) {
  const held = { stanceBenefits: fixCoreMechanics.stanceBenefits, elements: fixCoreMechanics.elements, ratings: fixCoreMechanics.ratings };
  delete fixCoreMechanics.stanceBenefits; delete fixCoreMechanics.elements; delete fixCoreMechanics.ratings;
  try { return build(); } finally { Object.assign(fixCoreMechanics, held); }
}
