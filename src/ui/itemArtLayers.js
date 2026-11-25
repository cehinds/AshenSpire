// src/ui/itemArtLayers.js — DOM/HTML renderer for layered weapon, armour, and relic art.
//
// Parallels src/ui/cardArtLayers.js: composites tinted atmospheric glow, approved cutout PNGs
// (via cardCutoutUrl), crisp SVG trait motifs, and rarity rim accents inside `.epc-art`.

import { cardCutoutUrl } from './layeredCardArt.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeColor = (v) => (/^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? String(v) : '#c9a227');

const ITEM_MOTIFS = Object.freeze({
  flame: '<path d="M16 78c4-11 1-20 8-30-1 8 4 11 4 19 0 5-3 9-7 12m62-6c-4-11-1-20-8-30 1 8-4 11-4 19 0 5 3 9 7 12"/>',
  frost: '<path d="M16 26h14m-7-7v14m-5-12 10 10m0-10-10 10M70 74h14m-7-7v14m-5-12 10 10m0-10-10 10"/>',
  bleed: '<path d="M19 30c-3 7-5 11-5 14a5 5 0 0 0 10 0c0-3-2-7-5-14Zm62 32c-3 6-4 10-4 12a4 4 0 0 0 8 0c0-2-1-6-4-12Z"/>',
  shock: '<path d="M18 18 11 38h10l-7 22M82 36l-7 18h10l-8 22"/>',
  rot: '<path d="M18 76c3-7 0-14 6-20 6-6 2-12 6-18m52 38c-3-7 0-14-6-20-6-6-2-12-6-18"/>',
  venom: '<path d="M20 72c5-6 3-14 8-18m52 18c-5-6-3-14-8-18M24 30a4 4 0 1 0 0 .1M76 30a4 4 0 1 0 0 .1"/>',
  impact: '<path d="M16 50h12M72 50h12M24 32l8 8M76 32l-8 8M24 68l8-8M76 68l-8-8"/>',
  bastion: '<path d="M14 20h10v60H14M86 20H76v60h10M18 34h6M76 34h6M18 66h6M76 66h6"/>',
  shield: '<path d="M20 20h60v26c0 18-13 30-30 36-17-6-30-18-30-36Z" stroke-dasharray="6 5"/>',
  wind: '<path d="M12 32c14-6 26-2 36 4M52 68c12 4 24 2 36-6M14 62c10-2 18 0 26 4"/>',
  counter: '<path d="M22 26l14 14m-14 0l14-14M64 60l14 14m-14 0l14-14"/>',
  pierce: '<path d="M14 84 36 62M64 38 86 16M74 16h12v12"/>',
  thorns: '<path d="M14 26l8 6-8 6 8 6-8 6M86 50l-8 6 8 6-8 6 8 6"/>',
  sprouts: '<path d="M18 78V62q-9-5-9-11 10 0 9 11 0-10 10-12 0 10-10 15m64-37v16q-8-3-9-9 9-1 9 9 0-9 8-11 1 7-8 11"/>',
  arcane: '<circle cx="50" cy="50" r="36" stroke-dasharray="4 6"/><circle cx="50" cy="50" r="26" stroke-dasharray="2 8"/>',
  might: '<path d="M16 74 26 56l10 18M64 74l10-18 10 18"/>',
  stars: '<path d="m19 26 1 5 5 1-5 1-1 5-1-5-5-1 5-1Zm62 42 1 5 5 1-5 1-1 5-1-5-5-1 5-1Z"/>',
  weak: '<path d="M18 30v18m-5-6 5 6 5-6M82 52v18m-5-6 5 6 5-6"/>',
  halo: '<circle cx="50" cy="48" r="38" stroke-dasharray="10 6"/>',
});

function renderLayerList(layers, band) {
  return (layers || []).map((layer) => {
    const pieces = [];
    if (layer.glow) {
      const g = safeColor(layer.glow);
      pieces.push(`<span data-item-art-glow="${esc(layer.id)}" style="position:absolute;inset:0;background:radial-gradient(ellipse at ${layer.x}% ${layer.y}%,${g}40,transparent 64%);mix-blend-mode:screen;pointer-events:none"></span>`);
    }
    if (layer.path) {
      const style = [
        'position:absolute',
        `left:${layer.x}%`,
        `top:${layer.y}%`,
        `width:${layer.scale}%`,
        `height:${layer.scale}%`,
        'transform:translate(-50%,-50%)',
        'object-fit:contain',
        'padding:0',
        `opacity:${Math.max(0, Math.min(1, layer.opacity / 100))}`,
        `mix-blend-mode:${esc(layer.blendMode || 'screen')}`,
        'pointer-events:none',
        'filter:none',
      ].join(';');
      pieces.push(`<img data-item-art-layer-img="${esc(layer.assetId)}" data-item-art-layer="${esc(layer.id)}" data-item-art-band="${band}" alt="" aria-hidden="true" draggable="false" src="${esc(cardCutoutUrl(layer.path))}" style="${style}" />`);
    }
    if (layer.motif && Object.hasOwn(ITEM_MOTIFS, layer.motif)) {
      const tint = safeColor(layer.color);
      pieces.push(`<svg data-item-art-motif="${esc(layer.motif)}" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;color:${tint};opacity:0.34;pointer-events:none" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ITEM_MOTIFS[layer.motif]}</svg>`);
    }
    return pieces.join('');
  }).join('');
}

/** Render under-layers (behind base item image) and stack-layers (in front of base item image). */
export function ItemArtLayersParts(composition) {
  if (!composition || composition.kind !== 'item') return { under: '', over: '' };
  const rim = safeColor(composition.rimColor || composition.glow);
  const rimAlpha = Math.round(Math.max(0, Math.min(1, Number(composition.rimOpacity) || 0.2)) * 255).toString(16).padStart(2, '0');
  const ambient = `<span data-item-art-ambient style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,${safeColor(composition.glow)}2c,transparent 72%);box-shadow:inset 0 0 14px ${rim}${rimAlpha};pointer-events:none"></span>`;
  const underBody = renderLayerList(composition.under, 'under');
  const overBody = renderLayerList(composition.stack, 'stack');
  return {
    under: `<span data-item-art-layers="under" aria-hidden="true" style="position:absolute;inset:0;z-index:1;display:block;overflow:hidden;pointer-events:none;border-radius:inherit">${ambient}${underBody}</span>`,
    over: overBody
      ? `<span data-item-art-layers="over" aria-hidden="true" style="position:absolute;inset:0;z-index:3;display:block;overflow:hidden;pointer-events:none;border-radius:inherit">${overBody}</span>`
      : '',
  };
}

/** Combined overlay helper (useful when appending on top of an existing image host). */
export function ItemArtLayersHtml(composition) {
  const { under, over } = ItemArtLayersParts(composition);
  return `${under}${over}`;
}

/** Hide any missing cutout PNG cleanly so a missing optional art pack never leaves a broken icon. */
export function BindItemArtLayerFailures(host) {
  if (!host?.querySelectorAll) return;
  for (const img of host.querySelectorAll('[data-item-art-layer-img]')) {
    img.addEventListener('error', () => { img.hidden = true; img.style.display = 'none'; }, { once: true });
  }
}
