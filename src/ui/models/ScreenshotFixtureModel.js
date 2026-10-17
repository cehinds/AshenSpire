// Screenshot poses must retain one connected route through the authored graph.
// This helper is used only by the ?shot fixture setup in main.js.
export function screenshotRoutePath(graph, targetId) {
  const queue = graph.startIds.map(id => [id]);
  const visited = new Set();
  for (let at = 0; at < queue.length; at++) {
    const path = queue[at];
    const id = path.at(-1);
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === targetId) return path;
    for (const next of graph.nodes[id]?.next || []) queue.push([...path, next]);
  }
  throw new Error(`Screenshot target '${targetId}' is not reachable from a start node`);
}
