// src/model/seats.js — reading the seats a run climbs (SPEC §13).
//
// Headless and id-free (DEVELOPER.md layer rule 1): every seat id here comes
// from the registries or from the run, never from a literal. The default order
// is DERIVED — seats sorted by their authored baseline tier — which is the order
// every save written before §13 was already climbing (§13.4 migration).

/** defaultSeatOrder(registries) → seat ids by ascending baseTier. */
export function defaultSeatOrder(registries) {
  return registries.seats.all()
    .slice()
    .sort((a, b) => a.baseTier - b.baseTier || (a.id < b.id ? -1 : 1))
    .map((seat) => seat.id);
}

/**
 * seatOrderProblems(order, registries?) → string[]. The SHAPE (three distinct
 * non-empty strings) is checkable without registries — validateRunShape has
 * none; the IDS resolve only with them — the load door has them.
 */
export function seatOrderProblems(order, registries = null) {
  if (!Array.isArray(order)) return ['seatOrder must be an array of seat ids'];
  const problems = [];
  if (order.some((id) => typeof id !== 'string' || !id)) problems.push('seatOrder entries must be non-empty strings');
  if (new Set(order).size !== order.length) problems.push('seatOrder must not repeat a seat');
  if (registries) {
    const known = new Set(registries.seats.all().map((seat) => seat.id));
    if (order.length !== known.size) problems.push(`seatOrder must name every seat once (${known.size} seats, got ${order.length})`);
    for (const id of order) if (!known.has(id)) problems.push(`seatOrder names unknown seat '${id}'`);
  } else if (order.length < 1) {
    problems.push('seatOrder must not be empty');
  }
  return problems;
}

/** The tier a content act is: 1..cycle, looping for Endless. */
export function tierOf(contentAct, cycle) {
  const n = Math.max(1, Math.trunc(Number(contentAct) || 1));
  const len = Math.max(1, Math.trunc(Number(cycle) || 1));
  return ((n - 1) % len) + 1;
}

/** seatAtTier(seatOrder, tier) → the seat id climbed at that tier (loops). */
export function seatAtTier(seatOrder, tier) {
  if (!Array.isArray(seatOrder) || !seatOrder.length) throw new Error('seatAtTier requires a non-empty seatOrder');
  return seatOrder[tierOf(tier, seatOrder.length) - 1];
}

/** The tier that hosts the causeway (SPEC §13.5): the last tier of a cycle. */
export function finalTier(registries) {
  return registries.balance.endless.actsPerCycle;
}

/**
 * seatTierHpMult(registries, seatId, tier) → seatTiers[tier] / seatTiers[baseTier]
 * (SPEC §13.3). Exactly 1 when the seat is climbed at its authored baseline.
 */
export function seatTierHpMult(registries, seatId, tier) {
  const seat = registries.seats.get(seatId);
  const table = registries.balance.seatTiers;
  const at = table[tierOf(tier, finalTier(registries))];
  const base = table[seat.baseTier];
  if (!(at > 0) || !(base > 0)) throw new Error(`seatTiers has no multiplier for tier ${tier} or baseline ${seat.baseTier}`);
  return at === base ? 1 : at / base;
}

/**
 * bossEncounterFitsSeat(encounter, { seat, tier, finalTier }) → whether a boss
 * row may be a destination for this seat at this tier: the seat's own rows, or
 * the one null-seat row (the Valkyrie) at the final tier (SPEC §13.5).
 */
export function encounterFitsSeat(encounter, { seat, tier, finalTier: last }) {
  if (!encounter) return false;
  if (encounter.seat === seat) return true;
  return encounter.seat === null && tierOf(tier, last) === last;
}
