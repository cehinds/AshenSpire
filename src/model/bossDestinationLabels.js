import { BOSS_LOCATIONS } from '../content/bossDestinations.js';
import { LEGACY_ACT_BOSSES } from '../content/mapconfig.js';

export function bossDestinationLabel(registries, encounterId) {
  const encounter = registries.encounters.get(encounterId);
  const enemies = encounter.enemies.map((id) => registries.enemies.get(id).name).join(' & ');
  return [BOSS_LOCATIONS[encounterId], enemies].filter(Boolean).join(' · ');
}

// Run after reference validation. Change presentation only, without touching
// the caller's saved object, terminal identities, paths, selection or RNG.
export function refreshBossDestinationLabels(registries, graph, act) {
  if (!graph) return graph;
  let nodes = null;
  for (const [id, node] of Object.entries(graph.nodes || {})) {
    if (node.type !== 'boss') continue;
    // Original unnamed singular graphs retain their old shape. If a legacy
    // graph does carry a label, refresh it through the same explicit mapping.
    const encounterId = node.encounterId || (node.destinationLabel && !graph.bossIds && graph.bossId === id
      ? LEGACY_ACT_BOSSES[act] : null);
    if (!encounterId) continue;
    const destinationLabel = bossDestinationLabel(registries, encounterId);
    if (destinationLabel === node.destinationLabel) continue;
    nodes ||= { ...graph.nodes };
    nodes[id] = { ...node, destinationLabel };
  }
  return nodes ? { ...graph, nodes } : graph;
}
