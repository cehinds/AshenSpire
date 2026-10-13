// tools/balance-intent.mjs — per-enemy intent DPS and self-heal, as printed by
// tools/balance.mjs (docs/BALANCE.md section 1). Kept out of balance.mjs so a
// test can drive it without importing that tool (which runs a 300-seed sim at load).

// Weighted intent DPS over base-phase (non-locked) moves; also self-heal/turn.
export function intentStats(def) {
  const moves = Object.values(def.moves).filter((m) => !m.locked);
  const totalW = moves.reduce((a, m) => a + m.weight, 0) || 1;
  let dps = 0;
  let heal = 0;
  for (const m of moves) {
    const p = m.weight / totalW;
    if (m.intent === 'attack') dps += p * (m.damage || 0) * (m.hits || 1);
    heal += p * (m.effects || []).filter((e) => e.op === 'heal').reduce((a, e) => a + (e.amount || 0), 0);
  }
  return { dps, heal };
}
