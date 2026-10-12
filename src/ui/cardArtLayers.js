import { CARD_ART_ELEMENTS } from './cardArtComposition.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const color = value => typeof value === 'string' && /^(#[\da-f]{3,8}|var\(--[a-z][a-z\d-]*\))$/i.test(value) ? value : '#c9d2dc';
// Hand-authored, deterministic marks stay around the perimeter; no SVG IDs,
// scripts, external resources, animation or generated geometry on each render.
const MOTIFS = Object.freeze({
  rings: '<ellipse cx="50" cy="51" rx="40" ry="34"/><path d="M13 54a37 30 0 0 1 28-32M61 82a38 31 0 0 0 27-25"/>',
  embers: '<path d="M17 73q-5-6 0-12 4 6 0 12ZM82 39q-4-5 0-10 3 5 0 10Z"/><path d="m23 48 1-4m53 29 1-4m-59 8 1-3m63-23 1-3m-53-29 1-3"/>',
  bolts: '<path d="m18 27 5 12-8 6 8 10-6 7m65-30-7 12 8 5-7 13 6 7m-62 11 7-5m49-53-5 5"/>',
  shards: '<path d="m12 66 6-9 7 14-10 4Zm61-34 8-8 5 12-10 4ZM73 79l8-8 5 8-6 5M18 32l4-8 5 10Z"/>',
  crystals: '<path d="M17 35v14m-6-10 12 6m-12 0 12-6M79 65v16m-7-12 14 8m-14 0 14-8M24 77l3-6 3 6-3 6Zm51-50 3-6 3 6-3 6Z"/>',
  ripples: '<path d="M22 26q-19 22 0 46m5-40q-12 16 0 33m51-32q18 22 0 43m-5-36q11 15 0 29"/><circle cx="25" cy="80" r="2"/>',
  orbits: '<ellipse cx="50" cy="54" rx="39" ry="28" transform="rotate(-28 50 54)"/><path d="m18 64 4-4 4 4-4 4Zm54-32 4-4 4 4-4 4Z"/>',
  rays: '<path d="M18 30 25 37m-13 8 9 3m62-18-7 7m12 8-9 3M22 77l6-7m49 7-6-7M45 19h10m-5-5v10"/><path d="M19 60a33 29 0 0 0 63 0"/>',
  wisps: '<path d="M14 73q13-9 4-21t5-26M82 29q-12 12-3 25t-4 28M24 80q9-5 5-11"/><circle cx="14" cy="41" r="1"/><circle cx="86" cy="68" r="1.5"/>',
  drops: '<path d="M20 30q-9 12 0 12t0-12ZM79 68q-7 10 0 10t0-10Z"/>',
  fractures: '<path d="m17 34 5 8-6 4 8 8-5 7m60 0-5 7 8 5-6 7"/>',
  stars: '<path d="m19 31 1 5 5 1-5 1-1 5-1-5-5-1 5-1Zm61 39 1 5 5 1-5 1-1 5-1-5-5-1 5-1Z"/>',
  sprouts: '<path d="M20 75V61q-9-5-9-11 10 0 9 11 0-10 10-12 0 10-10 15m59-35v15q-8-3-9-9 9-1 9 9 0-9 8-11 1 7-8 11"/>',
});

export function cardArtLayersHtml(composition) {
  if (composition?.kind !== 'simple' || !Array.isArray(composition.layers) || !composition.layers.length) return '';
  const layers = composition.layers.slice(0, 4).map((layer, index) => {
    const theme = layer.kind === 'element' && Object.hasOwn(CARD_ART_ELEMENTS, layer.id) && CARD_ART_ELEMENTS[layer.id];
    const motif = Object.hasOwn(MOTIFS, layer.motif) && MOTIFS[layer.motif];
    if (!motif) return '';
    const tint = color(theme?.color || layer.color);
    const glow = theme ? `<span style="position:absolute;inset:0;background:radial-gradient(ellipse at 15% 65%,${color(theme.glow)}24,transparent 42%),radial-gradient(ellipse at 85% 30%,${color(theme.glow)}1c,transparent 40%)"></span>` : '';
    return `${glow}<svg data-art-${theme ? 'element' : 'status'}="${esc(layer.id)}" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:hidden;color:${tint};opacity:${theme ? '.34' : '.42'}" fill="none" stroke="currentColor" stroke-width="${theme ? '.55' : '.8'}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><g${!theme && index > 1 ? ` transform="translate(0 ${index % 2 ? 7 : -7})"` : ''}>${motif}</g></svg>`;
  }).join('');
  return layers ? `<span data-card-art-layers aria-hidden="true" style="position:absolute;inset:0;display:block;overflow:hidden;pointer-events:none;border-radius:inherit">${layers}</span>` : '';
}
