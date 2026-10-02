import { feats } from '../content/feats.js';

const byId = new Map(feats.map((feat) => [feat.id, feat]));
export const featById = (id) => byId.get(id) || null;
export const featIds = Object.freeze(feats.map((feat) => feat.id));

export function featStacks(run, id) {
  return Array.isArray(run?.feats) ? run.feats.filter((owned) => owned === id).length : 0;
}

export function featMultiplier(run, bonus) {
  return 1 + feats.filter((feat) => feat.bonus === bonus)
    .reduce((total, feat) => total + featStacks(run, feat.id), 0) * 0.1;
}

export function rollFeatOptions(rng, count = 3) {
  const available = [...featIds];
  const chosen = [];
  while (chosen.length < count && available.length) {
    const index = rng ? rng.int('cardRewards', 0, available.length - 1) : 0;
    chosen.push(available.splice(index, 1)[0]);
  }
  return chosen;
}

export function chooseFeat(run, id) {
  if (!featById(id)) return false;
  if (!Array.isArray(run.feats)) run.feats = [];
  run.feats.push(id);
  return true;
}
