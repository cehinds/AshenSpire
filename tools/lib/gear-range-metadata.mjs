// Authored weapon metadata only: never recalculate pools, prices or grants.
export function projectGearRangeMetadata(gear, weapons, tagging, nodes, settings) {
  const byId = new Map(weapons.map(row => [row.id, row]));
  const parents = new Map(nodes.map(row => [row.id, row.parentId]));
  const property = id => {
    const seen = new Set();
    while (id && !seen.has(id)) {
      if (id === 'property') return true;
      seen.add(id); id = parents.get(id);
    }
    return false;
  };
  const propertyTags = new Map();
  for (const row of tagging) {
    if (row.family !== 'armament' || !property(row.tagId) || !settings.tags?.[row.tagId]) continue;
    const ids = propertyTags.get(row.objectId) || [];
    ids.push(row.tagId); propertyTags.set(row.objectId, ids);
  }
  return gear.map(item => {
    if (item.kind === 'armor') return item;
    const sourceId = item.source?.id || item.id, source = byId.get(sourceId);
    if (!source) throw new Error(`gear metadata: ${item.id} has no authored weapon '${sourceId}'`);
    if (!['melee', 'reach', 'ranged'].includes(source.range)) throw new Error(`gear metadata: ${item.id} has invalid range '${source.range}'`);
    return { ...item, range: source.range,
      tags: [...new Set([...(item.tags || []), ...(propertyTags.get(sourceId) || [])])] };
  });
}
