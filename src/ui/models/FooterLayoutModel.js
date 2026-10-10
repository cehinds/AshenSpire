import { footerLayout, footerSizing } from '../../content/footerLayout.js';

// Semantic ownership survives the editor's selection/docking groups.
const assetRoles = { frame: 'sp', orb: 'sp', sigil: 'sp', diamond: 'sp', spent: 'sp', draw: 'draw', plate: 'end', 'spent-cards': 'discard', potions: 'potions' };
const bindingRoles = { sp: 'sp', spLabel: 'sp', draw: 'draw', drawLabel: 'draw', endTurn: 'end', endTurnKey: 'end', discard: 'discard', exhaust: 'discard', potions: 'potions' };
export const FOOTER_ROLES = ['sp', 'draw', 'end', 'discard', 'potions'];
export function footerBounds(items) {
  if (!items.length) return { x: 0, y: 0, w: 1, h: 1 };
  const x = Math.min(...items.map(n => n.x)), y = Math.min(...items.map(n => n.y));
  return { x, y, w: Math.max(1, ...items.map(n => n.x + n.w - x)), h: Math.max(1, ...items.map(n => n.y + n.h - y)) };
}
export function footerLayoutModel(layout) {
  const items = layout.items.filter(n => n.visible !== false);
  const anchors = items.filter(n => assetRoles[n.asset]);
  const role = n => {
    if (assetRoles[n.asset]) return assetRoles[n.asset];
    if (bindingRoles[n.binding]) return bindingRoles[n.binding];
    if (n.asset === 'connector') return 'rail';
    if (FOOTER_ROLES.includes(n.group)) return n.group;
    const nearest = anchors.slice().sort((a, b) => Math.hypot(n.x - a.x, n.y - a.y) - Math.hypot(n.x - b.x, n.y - b.y))[0];
    return assetRoles[nearest?.asset] || 'end';
  };
  const groups = Object.fromEntries(FOOTER_ROLES.map(key => {
    const nodes = items.filter(n => role(n) === key);
    return [key, { items: nodes, bounds: footerBounds(nodes) }];
  }));
  return { bounds: footerBounds(items), groups, rails: items.filter(n => role(n) === 'rail') };
}
export function footerText(item, values) {
  return item.binding && item.binding !== 'static'
    ? item.text.replaceAll('{value}', String(values[item.binding] ?? '')).replaceAll('{label}', String(values[`${item.binding}Label`] ?? '')) : item.text;
}
// The decorated footer gets space without stealing the battlefield's floor.
// Small hosts retain the existing rails and touch-target geometry.
export function footerArtHeight(width, zoom = 1) {
  // Compact controls keep their own artwork faces and readable labels; they
  // do not need the authored desktop rail's full vertical canvas.
  if (width * zoom < 680) return 64 / zoom;
  const bounds = footerLayoutModel(footerLayout).bounds;
  return Math.max(footerSizing.minimumHeightPx / zoom, footerArtWidth(width, zoom) * bounds.h / bounds.w);
}

export function footerArtWidth(width, zoom = 1) {
  return Math.min(width, footerSizing.maximumWidthPx / zoom);
}

// Resample the authored ring around its ordered sockets for the live capacity.
// 3/6/12 mana use every fourth/second/socket; larger capacities interpolate.
// Moving a socket changes the ring, while its text/art never fixes a game value.
export function footerStaminaLayers(layout, resource) {
  const fixed = layout.items.filter(n => ['orb', 'frame', 'sigil'].includes(n.asset) && n.visible !== false);
  // Layer order is only stacking order. Stable socket IDs keep Bring forward
  // from rotating the live-resource sequence.
  const socketIndex = n => /^mana-\d+$/.test(n.id) ? Number(n.id.slice(5)) : Infinity;
  const sockets = layout.items.filter(n => ['diamond', 'spent'].includes(n.asset))
    .sort((a, b) => socketIndex(a) - socketIndex(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const gems = resource.gems.flatMap((gem, i) => {
    if (!sockets.length) return [];
    const at = i * sockets.length / resource.gems.length;
    const a = sockets[Math.floor(at)], b = sockets[(Math.floor(at) + 1) % sockets.length], blend = at % 1;
    if (a.visible === false) return [];
    const lerp = key => a[key] + (b[key] - a[key]) * blend;
    const scale = Math.min(1, sockets.length / resource.gems.length) * (gem.id === 'spent' ? .6 : 1);
    const w = lerp('w') * scale, h = lerp('h') * scale;
    return [{ ...a, asset: gem.id, x: lerp('x') + (lerp('w') - w) / 2, y: lerp('y') + (lerp('h') - h) / 2, w, h }];
  });
  return [...fixed, ...gems];
}
