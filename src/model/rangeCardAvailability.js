import { RANGES } from './combatRanges.js';

// Range-off runs keep mixed defensive cards, but can only acquire and add
// cards whose required distance is available. Existing instances remain removable.
export const pureEngagementMovement = def => Boolean(def?.effects?.length)
  && def.effects.every(effect => effect.op === 'moveEngagement');
export function rangeCardAvailable(run, def) {
  const policy = run?.rangePolicy;
  if (policy?.enabled === false && pureEngagementMovement(def)) return false;
  if (def?.playIf?.p !== 'atRange') return true;
  const max = policy?.enabled === false ? 'melee' : policy?.maxRange ?? 'ranged';
  return RANGES.indexOf(def.playIf.range) <= RANGES.indexOf(max);
}
