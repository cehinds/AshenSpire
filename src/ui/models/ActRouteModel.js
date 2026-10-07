// Fixed route positions come from the graph, never from the number of visits.
// Only committed visits disclose encounter kinds; previewing a node is not travel.
import { nodeReading } from '../../model/mapknowledge.js';

export function actRouteModel({ graph, path = [], current = null } = {}) {
  const nodes = graph?.nodes || {};
  const bosses = new Set([graph?.bossId, ...(graph?.bossIds || [])].filter(Boolean));
  const floors = [...new Set(Object.values(nodes)
    .filter((node) => !bosses.has(node.id) && node.type !== 'boss')
    .map((node) => node.floor).filter(Number.isFinite))].sort((a, b) => a - b);
  const visited = new Map();
  for (const id of [...path, current]) {
    const node = nodes[id];
    if (node && !bosses.has(id) && node.type !== 'boss') visited.set(node.floor, node);
  }
  return {
    steps: floors.map((floor) => {
      const node = visited.get(floor);
      return { floor, id: node?.id || null, type: node ? nodeReading(node, { reveal: true }).shownType : null, current: !!node && node.id === current };
    }),
    bossVisited: [...path, current].some((id) => bosses.has(id) || nodes[id]?.type === 'boss'),
  };
}
