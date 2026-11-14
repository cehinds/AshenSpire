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
