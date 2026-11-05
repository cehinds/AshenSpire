// Three-band mechanics (Advance over two bands, a Throw's one-band extension, a Ranged start) are exercised on a
// policy with no maxRange, the shape of a run saved before the Reach cap (owner, 2026-11-05). Core itself caps at
// Reach; tests/range-cap-reach.test.mjs covers that.
export function uncappedRun(run) {
  delete run.rangePolicy.maxRange;
  return run;
}
export function uncappedCombat(combat) {
  delete combat.rangeState.policy.maxRange;
  return combat;
}
