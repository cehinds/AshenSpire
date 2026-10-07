import { nodeIcon } from '../uiContent.js';

// One vector face for traditional, co-op and geographically positioned nodes.
export function mapNodeInk({ type, x = 0, y = 0, radius, reachable = false }) {
  const halo = reachable ? `<circle class="node-halo" cx="${x}" cy="${y}" r="${radius + 6}"/>` : '';
  return `${halo}<circle cx="${x}" cy="${y}" r="${radius}"/><text x="${x}" y="${y}">${nodeIcon(type)}</text>`;
}
