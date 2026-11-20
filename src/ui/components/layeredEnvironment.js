import { LAYERED_CANVAS, LAYERED_SOURCES } from '../../content/layeredEnvironments.js';
import { layeredArtUrl } from '../layeredArt.js';
import { reducedMotionRequested } from '../motion.js';
import { ART_SOURCE_EVENT } from '../highResArt.js';

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const recipes = new Map();
let sequence = 0;

/** Alpha bounds, rather than transparent image dimensions, own prop placement. */
export function layeredEnvironmentGeometry(scene, { width, height, groundY = height * .63, skyScaleFactor = 0.5, propScaleFactor = 0.5, skyLiftFraction = 0.05, groundScaleFactor = 0.6 }, sources = LAYERED_SOURCES) {
  if (!(width > 0 && height > 0)) return [];
  groundY = Math.max(1, Math.min(height - 1, groundY));
  const ground = sources[scene.layers.find(layer => layer.role === 'ground')?.asset];
  const horizon = ground?.medianCenterHorizonY * LAYERED_CANVAS.height / ground?.height;
  const line = Number.isFinite(horizon) ? horizon : LAYERED_CANVAS.height * .6;
  const scale = Math.max(width / LAYERED_CANVAS.width, groundY / line, (height - groundY) / (LAYERED_CANVAS.height - line));
  const origin = { x: (width - LAYERED_CANVAS.width * scale) / 2, y: groundY - line * scale };
  // Owner 2026-11-13: the ground's scale is set by covering the floor (75% of
  // the screen), which blew the sky and side props up with it. They now draw
  // at skyScaleFactor of the ground's scale (never below what covers the width
  // and the sky), standing on a horizon lifted by skyLiftFraction of the height.
  const skyHorizon = Math.max(1, groundY - height * skyLiftFraction);
  const skyScale = Math.max(width / LAYERED_CANVAS.width, skyHorizon / line, scale * skyScaleFactor);
  const skyOrigin = { x: (width - LAYERED_CANVAS.width * skyScale) / 2, y: skyHorizon - line * skyScale };
  // The ground keeps its horizon at groundY but is drawn at groundScaleFactor
  // of the cover scale (less upscaling, less blur). A vertically mirrored copy
  // continues it below its bottom edge, so the two together must still reach
  // the bottom of the screen and the plate must still span the width.
  const groundScale = Math.max(width / LAYERED_CANVAS.width,
    (height - groundY) / (2 * (LAYERED_CANVAS.height - line)), scale * groundScaleFactor);
  const groundOrigin = { x: (width - LAYERED_CANVAS.width * groundScale) / 2, y: groundY - line * groundScale };
  return scene.layers.map(layer => {
    const source = sources[layer.asset];
    // The filter is a near-uniform tint: the viewport is enough (it used to be a 2x square, a huge layer to composite).
    if (layer.role === 'filter') return { layer, x: 0, y: 0, width, height };
    if (layer.role === 'particles') {
      // The tile scrolls by translating the layer, so it only needs the viewport plus the travel distance, anchored so
      // the viewport stays covered from the start to the end of each loop.
      const dx = layer.motion?.deltaSourcePixels?.x ?? 0, dy = layer.motion?.deltaSourcePixels?.y ?? 0;
      return { layer, x: -Math.max(0, dx), y: -Math.max(0, dy), width: width + Math.abs(dx), height: height + Math.abs(dy) };
    }
    if (layer.role === 'backdrop') return { layer, x: skyOrigin.x, y: skyOrigin.y, width: LAYERED_CANVAS.width * skyScale, height: LAYERED_CANVAS.height * skyScale };
    if (layer.role === 'ground') {
      const w = LAYERED_CANVAS.width * groundScale, h = LAYERED_CANVAS.height * groundScale;
      return { layer, x: groundOrigin.x, y: groundOrigin.y, width: w, height: h, mirror: { x: groundOrigin.x, y: groundOrigin.y + h, width: w, height: h } };
    }
    if (layer.role !== 'prop' || !source?.visibleBoundsAt32) return { layer, x: origin.x, y: origin.y, width: LAYERED_CANVAS.width * scale, height: LAYERED_CANVAS.height * scale };
    const [left, top, right, bottom] = source.visibleBoundsAt32;
    const p = layer.placement, w = right - left, h = bottom - top;
    const occlusion = (p.baseOcclusionPixels || 0) * (p.mode === 'side-framing' ? skyScale : scale);
    let s = height * p.heightFraction / h, x, y;
    if (p.mode === 'side-framing') {
      s *= propScaleFactor;
      x = width * p.innerEdgeU - (p.side === 'left' ? right : left) * s;
    }
    else {
      s = Math.min(s, width * p.visibleWidthFraction / w);
      if (p.mode !== 'floor-surface') s = Math.min(s, Math.max(1, groundY + occlusion - 12) / h);
      else s = Math.min(s, (height - groundY) / h);
      x = width * p.anchorU - (left + right) / 2 * s;
    }
    y = p.mode === 'floor-surface' ? height * p.anchorV - (top + bottom) / 2 * s
      : (p.mode === 'side-framing' ? skyHorizon : groundY) + occlusion - bottom * s;
    if (!p.intentionalViewportCrop) {
      x = Math.max(-left * s, Math.min(width - right * s, x));
      y = Math.max((p.mode === 'floor-surface' ? groundY : 0) - top * s, Math.min(height - bottom * s, y));
    }
    return { layer, x, y, width: source.width * s, height: source.height * s };
  });
}

export function layeredEnvironmentHtml(scene) {
  const key = String(++sequence);
  recipes.set(key, scene);
  // Bound cached recipes across repeated combat mounts; live nodes retain their recipe below.
  if (recipes.size > 64) recipes.delete(recipes.keys().next().value);
  const image = (layer, index) => `<${layer.role === 'particles' ? 'div' : 'img'} class="layered-environment-layer${layer.role === 'particles' ? ' layered-particles' : ''}" data-layer-index="${index}" data-role="${escape(layer.role)}" data-placement="${escape(layer.placement?.mode || '')}" ${layer.role === 'particles' ? `data-layer-asset="${escape(layer.asset)}" style="background-image:url('${escape(layeredArtUrl(layer.asset))}')"` : `src="${escape(layeredArtUrl(layer.asset))}" alt="" draggable="false"`}>${layer.role === 'particles' ? '</div>' : ''}`;
  // The ground is followed by its mirrored continuation (see layeredEnvironmentGeometry).
  const mirror = (layer, i) => image(layer, i).replace('class="layered-environment-layer', 'data-mirror="true" class="layered-environment-layer');
  const rear = scene.layers.map((layer, i) => !['filter', 'particles'].includes(layer.role)
    ? image(layer, i) + (layer.role === 'ground' ? mirror(layer, i) : '') : '').join('');
  const effects = scene.layers.map((layer, i) => ['filter', 'particles'].includes(layer.role) ? image(layer, i) : '').join('');
  return `<div class="backdrop environment-backdrop layered-environment" data-layered-key="${key}" data-scene="${escape(scene.id)}" aria-hidden="true">${rear}</div><div class="layered-environment-effects" data-layered-effects="${key}" aria-hidden="true">${effects}</div>`;
}

export function fitLayeredEnvironment(backdrop, options) {
  // Hidden screens report zero client dimensions during transitions. Keep the
  // last painted geometry until the existing resize lifecycle supplies a box.
  if (!Number.isFinite(options?.width) || !Number.isFinite(options?.height)
    || options.width <= 0 || options.height <= 0) return null;
  const scene = backdrop.layeredRecipe || recipes.get(backdrop.dataset.layeredKey);
  if (!scene) return null;
  backdrop.layeredRecipe = scene;
  const effects = backdrop.parentElement?.querySelector(`[data-layered-effects="${backdrop.dataset.layeredKey}"]`);
  const geometry = layeredEnvironmentGeometry(scene, options);
  for (const root of [backdrop, effects].filter(Boolean)) {
    for (const node of root.querySelectorAll('[data-layer-index]')) {
      const box = geometry[Number(node.dataset.layerIndex)];
      const grade = box.layer.previewAmbientGrade;
      if (box.layer.role === 'particles') {
        const motion = box.layer.motion;
        node.style.setProperty('--layered-weather-duration', `${motion?.durationMs ?? 24000}ms`);
        node.style.setProperty('--layered-weather-dx', `${motion?.deltaSourcePixels?.x ?? 0}px`);
        node.style.setProperty('--layered-weather-dy', `${motion?.deltaSourcePixels?.y ?? 0}px`);
        node.style.setProperty('--layered-weather-tile', `${box.layer.tileSizeSourcePixels ?? 1024}px`);
      }
      const place = node.dataset.mirror === 'true' && box.mirror ? box.mirror : box;
      Object.assign(node.style, { left: `${place.x}px`, top: `${place.y}px`, width: `${place.width}px`, height: `${place.height}px`, opacity: String(box.layer.opacity ?? 1), filter: grade ? `brightness(${grade.brightness}) saturate(${grade.saturation})` : '',
        transform: place === box ? '' : 'scaleY(-1)' });
    }
  }
  backdrop.dataset.sceneFit = 'layered';
  backdrop.dataset.floorTop = String(options.groundY);
  return geometry;
}

/** Art and motion listeners share the battlefield lifecycle; geometry uses its existing fitter. */
export function wireLayeredEnvironment(combat) {
  const effects = combat?.querySelector('.layered-environment-effects');
  if (!effects) return () => {};
  const reconcile = () => { effects.dataset.reducedMotion = String(reducedMotionRequested()); };
  const refreshArt = () => {
    for (const node of effects.querySelectorAll('[data-layer-asset]')) {
      node.style.backgroundImage = `url(${JSON.stringify(layeredArtUrl(node.dataset.layerAsset))})`;
    }
  };
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const observer = new MutationObserver(reconcile);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  media?.addEventListener('change', reconcile);
  document.addEventListener(ART_SOURCE_EVENT, refreshArt);
  reconcile();
  refreshArt();
  return () => { observer.disconnect(); media?.removeEventListener('change', reconcile); document.removeEventListener(ART_SOURCE_EVENT, refreshArt); };
}
