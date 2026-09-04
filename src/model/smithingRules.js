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

/** The closed set of things a smith does. `upgrade` is the tier promotion; the other two move cards between an item's mounts and the run. */
export const SMITH_SERVICES = Object.freeze(['upgrade', 'extract', 'install']);

/**
 * The inert service table: the Shrine upgrades, nobody extracts or installs,
 * nothing costs anything. What a bundle without `smithing.services` gets, so
 * a hand-built fixture keeps the Shrine it had before services were a table.
 */
export const INERT_SMITH_SERVICES = Object.freeze({
  offeredAt: Object.freeze({ shrine: Object.freeze({ chance: 100, services: Object.freeze(['upgrade']) }) }),
  extract: Object.freeze({ cost: 0 }),
  install: Object.freeze({ cost: 0 }),
});

function normalizeServices(raw) {
  if (raw == null) return INERT_SMITH_SERVICES;
  const source = ownObject(raw, 'smithing.services');
  const offeredRaw = ownObject(source.offeredAt, 'smithing.services.offeredAt');
  const offeredAt = {};
  for (const [nodeKind, row] of Object.entries(offeredRaw)) {
    const label = `smithing.services.offeredAt.${nodeKind}`;
    if (!nodeKind) throw new Error('smithing.services.offeredAt: empty node kind');
    const spec = ownObject(row, label);
    const chance = integer(spec.chance, `${label}.chance`);
    if (chance > 100) throw new Error(`${label}.chance must be 0..100`);
    if (!Array.isArray(spec.services) || !spec.services.length) throw new Error(`${label}.services must be a non-empty array`);
    const seen = new Set();
    for (const service of spec.services) {
      if (!SMITH_SERVICES.includes(service)) throw new Error(`${label}.services names unknown service '${service}' (known: ${SMITH_SERVICES.join(', ')})`);
      if (seen.has(service)) throw new Error(`${label}.services lists '${service}' twice`);
      seen.add(service);
    }
    offeredAt[nodeKind] = Object.freeze({ chance, services: Object.freeze([...spec.services]) });
  }
  const priced = {};
  for (const service of ['extract', 'install']) {
    const row = ownObject(source[service], `smithing.services.${service}`);
    priced[service] = Object.freeze({ cost: integer(row.cost, `smithing.services.${service}.cost`) });
  }
  for (const key of Object.keys(source)) {
    if (!['offeredAt', 'extract', 'install'].includes(key)) throw new Error(`smithing.services.${key}: unknown key`);
  }
  return Object.freeze({ offeredAt: Object.freeze(offeredAt), ...priced });
}

/** Validate and freeze the balance-owned Smithing rules. */
export function normalizeSmithingRules(raw) {
  const source = ownObject(raw, 'smithing rules');
  const rewards = ownObject(source.rewardByPool, 'smithing.rewardByPool');
  const rewardByPool = {};
  for (const pool of ['normal', 'elite', 'boss', 'treasure']) {
    rewardByPool[pool] = integer(rewards[pool], `smithing.rewardByPool.${pool}`);
  }
  for (const key of Object.keys(rewards)) {
    if (!Object.hasOwn(rewardByPool, key)) throw new Error(`smithing.rewardByPool.${key}: unknown pool`);
  }
  return Object.freeze({
    rewardByPool: Object.freeze(rewardByPool),
    services: normalizeServices(source.services),
  });
}
