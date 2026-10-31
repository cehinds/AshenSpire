// Shared authored reward policy. Empty legacy groups preserve uniform selection;
// nonempty groups must partition the enabled categories exactly once.
export function rewardGroupProblems(groups, categories) {
  if (!Array.isArray(groups)) return ['rewardGroups must be an array'];
  if (!groups.length) return [];
  const problems = [], ids = new Set(), assigned = new Set();
  for (const [index, group] of groups.entries()) {
    const at = `rewardGroups/${index}`;
    if (!group || typeof group.id !== 'string' || !group.id || ids.has(group.id)) problems.push(`${at}/id must be unique and nonempty`);
    ids.add(group?.id);
    if (!Number.isFinite(group?.weight) || group.weight < 0) problems.push(`${at}/weight must be finite and nonnegative`);
    if (!Array.isArray(group?.categories) || !group.categories.length) { problems.push(`${at}/categories must be nonempty`); continue; }
    for (const category of group.categories) {
      if (!categories.includes(category) || assigned.has(category)) problems.push(`${at}/categories contains an unknown or repeated category '${category}'`);
      assigned.add(category);
    }
  }
  if (!groups.some(group => group?.weight > 0)) problems.push('rewardGroups must contain a positive weight');
  for (const category of categories) if (!assigned.has(category)) problems.push(`rewardGroups omits category '${category}'`);
  return problems;
}

// Exhausted groups are removed before the draw, renormalizing their remaining
// positive weights. Zero-weight groups stay disabled even if everything else is empty.
export function pickRewardCategory(rng, stream, categories, groups = []) {
  if (!categories.length) return null;
  if (!groups.length) return rng.pick(stream, categories);
  const eligible = groups.map(group => ({ ...group, categories: group.categories.filter(kind => categories.includes(kind)) }))
    .filter(group => group.weight > 0 && group.categories.length);
  if (!eligible.length) return null;
  let roll = rng.float(stream) * eligible.reduce((total, group) => total + group.weight, 0);
  for (const group of eligible) {
    roll -= group.weight;
    if (roll < 0) return rng.pick(stream, group.categories);
  }
  return rng.pick(stream, eligible.at(-1).categories);
}
