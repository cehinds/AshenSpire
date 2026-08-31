// Dependency-free validation for the balance-owned Smithing economy.
// Both the content boot door and the runtime transaction model consume this
// one normalizer, so malformed authoring cannot pass boot and fail later.

function ownObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function integer(value, label, { minimum = 0 } = {}) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be an integer >= ${minimum}`);
  return value;
}

/** Validate and freeze the balance-owned Smithing rules. */
export function normalizeSmithingRules(raw) {
  const source = ownObject(raw, 'smithing rules');
  const maxArmamentLevel = integer(source.maxArmamentLevel, 'smithing.maxArmamentLevel', { minimum: 1 });
  const costs = ownObject(source.costByNextLevel, 'smithing.costByNextLevel');
  const rewards = ownObject(source.rewardByPool, 'smithing.rewardByPool');
  const costByNextLevel = {};
  for (let level = 1; level <= maxArmamentLevel; level += 1) {
    const value = costs[level];
    integer(value, `smithing.costByNextLevel.${level}`, { minimum: 1 });
    costByNextLevel[level] = value;
  }
  for (const key of Object.keys(costs)) {
    if (!/^\d+$/.test(key) || Number(key) < 1 || Number(key) > maxArmamentLevel) {
      throw new Error(`smithing.costByNextLevel.${key}: level is outside 1..${maxArmamentLevel}`);
    }
  }
  const rewardByPool = {};
  for (const pool of ['normal', 'elite', 'boss', 'treasure']) {
    rewardByPool[pool] = integer(rewards[pool], `smithing.rewardByPool.${pool}`);
  }
  for (const key of Object.keys(rewards)) {
    if (!Object.hasOwn(rewardByPool, key)) throw new Error(`smithing.rewardByPool.${key}: unknown pool`);
  }
  return Object.freeze({
    maxArmamentLevel,
    costByNextLevel: Object.freeze(costByNextLevel),
    rewardByPool: Object.freeze(rewardByPool),
  });
}
