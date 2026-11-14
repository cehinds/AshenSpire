// A fight created before the 2026-11-14 ruling (attacks always hit, intents always read) keeps rolling: its snapshotted rules lack
// `accuracy.hitRoll` and `perception.roll`. Tests that assert the d20 or the perception check hand their fight through here.
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
