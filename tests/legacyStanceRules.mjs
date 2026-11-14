// A fight created before the 2026-11-14 stance benefits (Wave 2.5) snapshots fix-core rules without `stanceBenefits` and plays today's arithmetic.
// Suites whose numbers pin that arithmetic (Poise absorption, face = raw hit, Block previews) build their fight through this, so they keep testing
// their own rule; tests/stance-benefits.test.mjs owns the benefit arithmetic.
export function withoutStanceBenefits(combat) {
  if (combat?.fixCoreRules) { const { stanceBenefits, ...rest } = combat.fixCoreRules; combat.fixCoreRules = rest; }
  return combat;
}
