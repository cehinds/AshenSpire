// A fight created before the 2026-11-14 stance benefits (Wave 2.5) snapshots fix-core rules without `stanceBenefits` and plays today's arithmetic.
// Suites whose numbers pin that arithmetic (Poise absorption, face = raw hit, Block previews) build their fight through this, so they keep testing
// their own rule; tests/stance-benefits.test.mjs owns the benefit arithmetic.
export function withoutStanceBenefits(combat) {
  if (combat?.fixCoreRules) { const { stanceBenefits, ...rest } = combat.fixCoreRules; combat.fixCoreRules = rest; }
  return withoutCounterStacks(combat);
}

// A fight created before the 2026-11-15 Counter-stack ruling (Wave 2 batch 5) snapshots a `counter` block without `stackSource` and plays the
// Block-as-stacks rule: stacks = the Block held, 10% of each hit per stack, 2 stacks fade a turn, one return a cycle, +25% advantage share.
// Suites that pin that arithmetic build their fight through this; tests/counter-card-stacks.test.mjs owns the new rule.
export function withoutCounterStacks(combat) {
  if (combat?.fixCoreRules?.counter) {
    const counter = { ...combat.fixCoreRules.counter };
    for (const key of ['stackSource', 'returnPerStack', 'consumePerHit', 'decayPerTurn', 'decayClock', 'advantageShare', 'stacksPerCard', 'stacksUpgradeBonus', 'stacksMax', 'stacksByCard']) delete counter[key];
    combat.fixCoreRules = { ...combat.fixCoreRules, counter };
  }
  return combat;
}
