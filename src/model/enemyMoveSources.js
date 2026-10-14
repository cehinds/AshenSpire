// Derived move tables are views of nested authored moves. Provenance belongs
// outside the game payload, so a reused view cannot mask a nested override and
// serialization never gains implementation markers.
const derivedViews = new WeakSet();

export function deriveEnemyMoves(enemies = []) {
  const rows = enemies.flatMap(enemy => Object.entries(enemy.moves || {})
    .map(([id, move]) => ({ ...move, id, enemyId: enemy.id })));
  derivedViews.add(rows);
  return rows;
}

/**
 * Reusing a derived array means nested moves still own the payload. Replacing
 * that array explicitly makes its scoped rows authoritative, including when
 * both sides were replaced. Standalone flat bundles follow the same rule.
 */
export function resolveEnemyMoveSources(bundle) {
  if (bundle.enemyMoves && !derivedViews.has(bundle.enemyMoves)) return bundle;
  return { ...bundle, enemyMoves: deriveEnemyMoves(bundle.enemies || []) };
}
