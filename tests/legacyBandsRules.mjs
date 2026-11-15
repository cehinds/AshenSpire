// A fight created before the 2026-11-15 front/back rows (W25-BANDS) snapshots fix-core rules without a `bands` block and plays the older range arithmetic
// (no rows, a paid Advance closes the pair for good). Suites whose goldens pin that arithmetic build their fight inside this, so they keep testing their own rule;
// tests/bands-rows.test.mjs owns the rows. The shipped rules object is restored whatever the builder does.
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
export function withoutBands(build) {
  const saved = fixCoreMechanics.bands;
  delete fixCoreMechanics.bands;
  try { return build(); } finally { if (saved !== undefined) fixCoreMechanics.bands = saved; }
}
