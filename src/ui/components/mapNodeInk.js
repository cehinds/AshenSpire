import { engravedIconUrl } from './engravedIcon.js';
import { nodeIcon } from '../uiContent.js';

// One vector face for traditional, co-op and geographically positioned nodes.
export function mapNodeInk({ type, x = 0, y = 0, radius, reachable = false }) {
  const halo = reachable ? `<circle class="node-halo" cx="${x}" cy="${y}" r="${radius + 6}"/>` : '';
  const iconUrl = engravedIconUrl(nodeIcon(type));
  const face = iconUrl ? `<image href="${iconUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" x="${x-radius*0.55}" y="${y-radius*0.55}" width="${radius*1.1}" height="${radius*1.1}"/>` : `<text x="${x}" y="${y}">?</text>`;
  return `${halo}<circle cx="${x}" cy="${y}" r="${radius}"/>${face}`;
}
