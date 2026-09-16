// src/ui/components/stature.js — a combatant's STATURE, derived, never authored.
//
// Constantine, 2026-09-03: "combatant cards should be uniform but come in 3
// sizes, normal (most enemies and player), large (elites), Huge (bosses)".
// The encounter table already says which enemies are elites and bosses
// (`pool`), and each enemy appears in exactly one pool — so the stature is
// read off that table, and there is no second field to drift. If content
// ever puts one enemy in two pools this fails LOUDLY: that is a content
// question, not a rendering one.

const BY_POOL = Object.freeze({ normal: 'normal', elite: 'large', boss: 'huge' });

/** statureFor(registries, enemyId) → 'normal' | 'large' | 'huge' */
export function statureFor(registries, enemyId) {
  const rows = registries?.encounters?.all ? registries.encounters.all() : [];
  const pools = new Set();
  for (const row of rows) if ((row.enemies || []).includes(enemyId)) pools.add(row.pool);
  if (pools.size > 1) throw new Error(`stature: ${enemyId} is in ${[...pools].join(' and ')} pools — one enemy, one pool`);
  const pool = [...pools][0];
  return BY_POOL[pool] || 'normal';
}
