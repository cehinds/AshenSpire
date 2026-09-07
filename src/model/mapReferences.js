// Read-only validation at both save-loading boundaries. Old singular maps
// without encounter IDs keep their explicit legacy boss mapping.
export function assertSavedBossReferences(registries, graph, act) {
  if (!graph) return;
  const ids = new Set([
    ...(Array.isArray(graph.bossIds) ? graph.bossIds : []),
    ...Object.entries(graph.nodes || {}).filter(([, node]) => node?.type === 'boss').map(([id]) => id),
  ]);
  for (const id of ids) {
    const node = graph.nodes?.[id];
    if (!node || node.type !== 'boss') throw new Error(`Saved boss destination '${id}' is not a boss node`);
    if (!graph.bossIds && graph.bossId === id && !Object.hasOwn(node, 'encounterId')) continue;
    const encounter = typeof node.encounterId === 'string' && registries.encounters.has(node.encounterId)
      ? registries.encounters.get(node.encounterId) : null;
    if (!encounter || encounter.pool !== 'boss' || (encounter.act || 1) !== act) {
      throw new Error(`Saved boss destination '${id}' references invalid encounter '${node.encounterId}' for act ${act}`);
    }
  }
}
