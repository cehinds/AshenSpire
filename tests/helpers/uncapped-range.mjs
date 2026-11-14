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

// The shipped shortbow reaches the Reach band (owner, 2026-11-14). The three-band tests that need a bow to establish the
// Ranged band run against this legacy bow, the weapon a pre-ruling save carries.
export function withLegacyRangedBow(registries) {
  const equipment = { ...registries.equipment, armaments: registries.equipment.armaments.map(piece => piece.id === 'shortbow' ? { ...piece, range: 'ranged' } : piece) };
  return { ...registries, equipment };
}
