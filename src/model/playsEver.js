// Lifetime plays per deck card (SPEC §4.3 "Zero-cost cards and ramp"). A deck instance keeps `playsEver`, the
// number of times that copy has been played in earlier fights; Honed cards read it when they resolve.
// The combat engine copies a fixed list of fields onto its pile instances, so the count is
// re-stamped on the pile copies when a fight opens or is restored, and folded back when it ends.

const piles = (combat) => Object.values(combat?.piles || {}).filter(Array.isArray).flat();

/** A non-negative whole `playsEver` or 0. */
export const instancePlaysEver = (instance) => (Number.isInteger(instance?.playsEver) && instance.playsEver > 0 ? instance.playsEver : 0);

/** Fight opens or is restored: give each pile copy of a deck card the count its deck instance holds. */
export function stampCombatPlaysEver(run, combat) {
  const held = new Map((run?.deck || []).filter((card) => instancePlaysEver(card) > 0).map((card) => [card.instanceId, card.playsEver]));
  if (!held.size) return combat;
  for (const card of piles(combat)) if (held.has(card.instanceId)) card.playsEver = held.get(card.instanceId);
  return combat;
}

/** Fight ends: add this fight's plays of each deck copy to its lifetime count. Safe to call twice for one fight. */
export function foldCombatPlaysEver(run, combat) {
  if (!combat || combat.playsEverFolded) return run;
  const uses = combat.player?.abilityRiders?.instanceUsesCombat || {};
  for (const card of run?.deck || []) {
    const played = Number.isInteger(uses[card.instanceId]) ? uses[card.instanceId] : 0;
    if (played > 0) card.playsEver = instancePlaysEver(card) + played;
  }
  Object.defineProperty(combat, 'playsEverFolded', { value: true, enumerable: false, configurable: true });
  return run;
}
