// src/model/encounterTier.js — WHICH TIER IS THIS ENCOUNTER AUTHORED AT?
//
// An act is a seat at a tier (SPEC §13.1): `run.actNumber` is the tier and
// `run.seatOrder[tier - 1]` the seat, so a run's "act 2" is whichever seat its
// drawn order put there. A seat's `baseTier` is the tier its numbers were
// WRITTEN for — the act it used to be — and that is the only tier an encounter
// row can be graded against.
//
// WHY THIS IS A MODULE AND NOT A LOCAL HELPER. `tools/balance.mjs` read
// `enc.act || 1` long after the seat refactor removed `act` from every
// encounter row, so all 35 encounters read `undefined` and were graded as
// Act 1 — including the final boss. The rule is small enough to have been
// inlined and wrong for months; here it has one home, and a test can drive it
// without importing a tool that runs a 300-seed simulation at module load.
//
// EVERY UNKNOWN IS LOUD. A seat the content does not declare throws by name; an
// encounter that is simply absent is `null`, not a tier, because inventing a
// plausible one is the defect this module exists to prevent.

/** seatTiers(registries) → Map<seatId, baseTier>. */
export function seatTiers(registries) {
  return new Map(registries.seats.all().map((seat) => [seat.id, seat.baseTier]));
}

/** lastTier(tiers) → the highest tier any seat is authored at. */
export function lastTier(tiers) {
  return Math.max(...tiers.values());
}

/**
 * encounterTier(enc, tiers) → the tier this encounter's numbers were authored
 * at. THE ONE NULL SEAT (SPEC §13.5) — the Blighted Valkyrie, the last tier's
 * extra terminal whatever seat holds it — belongs to the last tier. An unknown
 * seat id throws; a missing encounter is a caller error and throws too.
 */
export function encounterTier(enc, tiers) {
  if (!enc || typeof enc !== 'object') throw new Error('encounterTier requires an encounter row');
  const last = lastTier(tiers);
  if (enc.seat == null) return last;
  const tier = tiers.get(enc.seat);
  if (tier == null) throw new Error(`encounterTier: encounter '${enc.id}' names seat '${enc.seat}', which is not a declared seat`);
  return tier;
}

/**
 * enemyTier(enemyId, encounters, tiers) → the tier of the first encounter that
 * fields this enemy, or NULL when no encounter does. Null is the honest answer:
 * an enemy nothing fights has no tier, and reporting the last one (or the
 * first) would be the same silent invention that made every fight in the game
 * read as Act 1.
 */
export function enemyTier(enemyId, encounters, tiers) {
  const enc = encounters.find((row) => row.enemies.includes(enemyId));
  return enc ? encounterTier(enc, tiers) : null;
}
