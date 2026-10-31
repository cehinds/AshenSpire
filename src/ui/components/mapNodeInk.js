import { uiIconGlyph } from '../../content/uiIcons.js';
import { engravedIconUrl } from './engravedIcon.js';
import { nodeIcon } from '../uiContent.js';

// Original node glyphs stay inline so map type/reachable/current text tints
// apply. Explicit custom vector IDs retain their existing asset path.
const xmlText = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function mapNodeInk({ type, x = 0, y = 0, radius, reachable = false }) {
  const halo = reachable ? `<circle class="node-halo" cx="${x}" cy="${y}" r="${radius + 6}"/>` : '';
  const id = nodeIcon(type), glyph = uiIconGlyph(id);
  const iconUrl = glyph ? null : engravedIconUrl(id);
  const face = glyph ? `<text x="${x}" y="${y}">${xmlText(glyph)}</text>` : iconUrl ? `<image href="${iconUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" x="${x-radius*0.55}" y="${y-radius*0.55}" width="${radius*1.1}" height="${radius*1.1}"/>` : `<text x="${x}" y="${y}">?</text>`;
  return `${halo}<circle cx="${x}" cy="${y}" r="${radius}"/>${face}`;
}
