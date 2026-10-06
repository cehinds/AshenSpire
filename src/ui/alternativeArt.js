import { alternativeArtCatalog } from './alternativeArtCatalog.js';

/* ALTERNATIVE_ART_START */
const alternativeArtMap = {};
/* ALTERNATIVE_ART_END */
export const alternativeArtUrl = path => alternativeArtMap[path] || path;

// A tight, known alpha envelope keeps the intent directly above the head.
// The original master canvas remains intact inside this clipped viewport.
export function alternativeSprite(id, side = 'enemy') {
  const art = alternativeArtCatalog.sprites[id];
  if (!art) return null;
  const [w, h] = art.size, [x0, y0, x1, y1] = art.bounds;
  const height = 190, scale = height / (y1 - y0), width = (x1 - x0) * scale;
  const root = document.createElement('div');
  root.className = 'alternative-figure';
  root.dataset.alternativeSprite = id;
  if (side === 'enemy') root.dataset.enemyId = id;
  root.style.cssText = `width:${width}px;height:${height}px;position:relative;flex:none`;
  const stage = document.createElement('div');
  stage.className = 'painted-stage alternative-silhouette';
  stage.dataset.idleHeightRatio = '1';
  stage.dataset.idleWidthRatio = String(width / height);
  const crop = document.createElement('div');
  crop.className = 'alternative-crop';
  const image = new Image();
  image.alt = art.name;
  image.draggable = false;
  image.src = alternativeArtUrl(art.path);
  image.style.cssText = `position:absolute;width:${w * scale}px;height:${h * scale}px;left:${-x0 * scale}px;top:${-y0 * scale}px;max-width:none`;
  crop.append(image); stage.append(crop); root.append(stage);
  return root;
}

export function alternativeBackdropHtml() {
  return `<div class="backdrop alternative-backdrop" aria-hidden="true">${['far','ruins','ground','foreground'].map((id, i) =>
    `<img class="alternative-scene-layer" data-depth="${i}" src="${alternativeArtUrl(alternativeArtCatalog.layers[id])}" alt="" draggable="false">`).join('')}</div>
    ${alternativeCardFadeHtml()}`;
}

export function alternativeCardFadeHtml() {
  return `<div class="alternative-card-fade" aria-hidden="true" style="background-image:url('${alternativeArtUrl(alternativeArtCatalog.layers['card-section-texture'])}')"></div>`;
}

export function wireAlternativeBackdrop(combat) {
  const layers = [...combat.querySelectorAll('.alternative-scene-layer')];
  if (!layers.length) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const move = event => {
    const off = reduced.matches || document.documentElement.dataset.ambient === 'off' || event.pointerType === 'touch';
    const bounds = combat.getBoundingClientRect();
    const x = off ? 0 : (event.clientX - bounds.left) / bounds.width * 2 - 1;
    const y = off ? 0 : (event.clientY - bounds.top) / bounds.height * 2 - 1;
    for (const layer of layers) {
      const depth = (Number(layer.dataset.depth) + 1) / 4;
      layer.style.transform = `translate(${x * depth * 9}px,${y * depth * 3}px)`;
    }
  };
  const reset = () => layers.forEach(layer => { layer.style.transform = ''; });
  combat.addEventListener('pointermove', move);
  combat.addEventListener('pointerleave', reset);
  reduced.addEventListener('change', reset);
  return () => { combat.removeEventListener('pointermove', move); combat.removeEventListener('pointerleave', reset); reduced.removeEventListener('change', reset); };
}
