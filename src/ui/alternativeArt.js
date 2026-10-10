import { alternativeArtCatalog } from './alternativeArtCatalog.js';
import { assetUrl } from './assetmap.js';
import { markArtPlaceholder } from './artFallback.js';
import { armourById } from '../content/equipment.js';
import { classicAppearance } from './displayAppearance.js';
import { reducedMotionRequested } from './motion.js';

/* ALTERNATIVE_ART_START */
const alternativeArtMap = {};
/* ALTERNATIVE_ART_END */
export const alternativeArtUrl = path => alternativeArtMap[path] || assetUrl(path);
const phoneArt = () => typeof document !== 'undefined' && document.documentElement.dataset.layout === 'narrow';

// Dedicated canonical appearances win over legacy painted-rig aliases. Shared
// armor keeps the package's explicit visual-class mapping until dedicated art lands.
export function alternativePlayerId(classId, armourId = 'default') {
  const piece = armourById(classId, armourId);
  return [`${classId}-${armourId}`, `${piece?.artClassId || classId}-${piece?.artKey || armourId}`, `${classId}-default`]
    .find(id => alternativeArtCatalog.sprites[id]) || null;
}

function actorPicture(art, onError = null) {
  const picture = document.createElement('picture');
  const mobile = document.createElement('source');
  mobile.media = '(max-width: 599px)';
  const image = new Image();
  image.alt = art.name;
  image.draggable = false;
  if (onError) image.addEventListener('error', () => onError({ picture, mobile, image }));
  mobile.srcset = alternativeArtUrl(art.mobilePath);
  image.src = alternativeArtUrl(art.path);
  picture.append(mobile, image);
  return { picture, image };
}

// This is an idle envelope, never an animation or weapon contact anchor.
export function alternativeSprite(id, side = 'enemy') {
  if (classicAppearance()) return null;
  const art = alternativeArtCatalog.sprites[id];
  if (!art) return null;
  const [w, h] = art.size, [x0, y0, x1, y1] = art.bounds;
  const height = 190, scale = height / (y1 - y0), width = (x1 - x0) * scale;
  const root = document.createElement('div');
  root.className = 'alternative-figure';
  root.dataset.alternativeSprite = id;
  root.dataset.poseCoverage = 'idle';
  if (side === 'enemy') root.dataset.enemyId = id;
  root.style.cssText = `width:${width}px;height:${height}px;position:relative;flex:none`;
  const stage = document.createElement('div');
  stage.className = 'painted-stage alternative-silhouette';
  stage.dataset.idleHeightRatio = '1';
  stage.dataset.idleWidthRatio = String(width / height);
  const crop = document.createElement('div');
  crop.className = 'alternative-crop';
  const { picture, image } = actorPicture(art, ({ picture, mobile, image }) => {
    // Keep the frame and authored crop in place while the failed image is
    // absent. Retry restores this same responsive picture at its newly resolved URLs.
    const placeholder = document.createElement('span');
    placeholder.textContent = side === 'player' ? '⚔' : '☠';
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', art.name);
    placeholder.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
      + 'border:2px solid var(--line-soft);border-radius:10px;background:var(--panel);font-size:48px';
    picture.remove();
    root.append(placeholder);
    markArtPlaceholder(root, () => {
      placeholder.remove();
      crop.append(picture);
      mobile.srcset = alternativeArtUrl(art.mobilePath);
      image.src = alternativeArtUrl(art.path);
    });
  });
  image.style.cssText = `position:absolute;width:${w * scale}px;height:${h * scale}px;left:${-x0 * scale}px;top:${-y0 * scale}px;max-width:none`;
  crop.append(picture); stage.append(crop); root.append(stage);
  return root;
}

export function alternativeCompanionIcon(id) {
  const art = alternativeArtCatalog.sprites[id];
  if (art?.family !== 'companion') return null;
  const { picture, image } = actorPicture(art);
  picture.className = 'alternative-companion-icon';
  picture.dataset.alternativeSprite = id;
  picture.setAttribute('aria-hidden', 'true');
  image.alt = '';
  return picture;
}

export function alternativeBackdropHtml(sceneId = 'hollow-weald-1') {
  if (classicAppearance()) return null;
  const scene = alternativeArtCatalog.scenes[sceneId];
  if (!scene) return null;
  const mobile = phoneArt();
  const device = scene.devices[mobile ? 'phone' : 'desktop'];
  return `<div class="backdrop alternative-backdrop" data-region="${scene.region}" data-scene="${sceneId}" aria-hidden="true">
    <svg class="alternative-scene" viewBox="0 0 ${device.width} ${device.height}" focusable="false">
      ${combatSceneLayers(device).map(layer => `<g class="alternative-scene-layer" data-depth="${layer.depth}"><image data-layer="${layer.id}" href="${alternativeArtUrl(alternativeArtCatalog.sceneLayers[layer.id][mobile ? 'mobilePath' : 'path'])}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}"/></g>`).join('')}
    </svg></div>${alternativeCardFadeHtml()}`;
}

// Option C opens the battlefield edges by omitting the near-camera side trees.
const combatSceneLayers = device => device.layers.filter(layer => alternativeArtCatalog.sceneLayers[layer.id].kind !== 'foreground');

export function alternativeCardFadeHtml() {
  if (classicAppearance()) return '';
  return `<div class="alternative-card-fade" aria-hidden="true" style="background-image:url('${alternativeArtUrl((phoneArt() ? alternativeArtCatalog.mobileLayers : alternativeArtCatalog.layers)['card-section-texture'])}')"></div>`;
}

// Fit the art canvas to the actual battlefield, keeping its measured ground
// aligned with the current formation. HUD/cards/footer and actor slots stay owned
// by their existing models. Never stretch a layer independently of its canvas.
export function fitAlternativeBackdrop(combat, { width, height, fieldTop, ground, narrow }) {
  const backdrop = combat.querySelector('.alternative-backdrop');
  const scene = alternativeArtCatalog.scenes[backdrop?.dataset.scene];
  if (!scene || width <= 0 || height <= 0) return;
  const key = narrow ? 'phone' : 'desktop';
  const device = scene.devices[key];
  const svg = backdrop.querySelector('svg');
  const scale = Math.max(width / device.width, height / device.height);
  const top = document.documentElement.dataset.wireframeSceneFloor === 'off'
    ? fieldTop + (height - device.height * scale) / 2
    : fieldTop + ground - device.groundAnchor * device.height * scale;
  svg.setAttribute('viewBox', `0 0 ${device.width} ${device.height}`);
  svg.style.cssText = `width:${device.width * scale}px;height:${device.height * scale}px;left:${(width - device.width * scale) / 2}px;top:${top}px`;
  backdrop.dataset.device = key;
  [...svg.children].forEach((group, index) => {
    const layer = combatSceneLayers(device)[index];
    const art = alternativeArtCatalog.sceneLayers[layer.id];
    const image = group.firstElementChild;
    group.dataset.depth = String(layer.depth);
    image.dataset.layer = layer.id;
    for (const prop of ['x', 'y', 'width', 'height']) image.setAttribute(prop, layer[prop]);
    const href = alternativeArtUrl(narrow ? art.mobilePath : art.path);
    if (image.getAttribute('href') !== href) image.setAttribute('href', href);
    group.style.visibility = ['far', 'landmark'].includes(art.kind) && document.documentElement.dataset.wireframeSceneSkyline === 'off' ? 'hidden' : '';
  });
  const fade = combat.querySelector('.alternative-card-fade');
  if (fade) fade.style.backgroundImage = `url('${alternativeArtUrl((narrow ? alternativeArtCatalog.mobileLayers : alternativeArtCatalog.layers)['card-section-texture'])}')`;
}

export function wireAlternativeBackdrop(combat) {
  const layers = [...combat.querySelectorAll('.alternative-scene-layer')];
  if (!layers.length) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const move = event => {
    // The in-game Reduced motion setting counts as much as the OS preference.
    const off = reducedMotionRequested() || document.documentElement.dataset.ambient === 'off' || event.pointerType === 'touch';
    const bounds = combat.getBoundingClientRect();
    const x = off ? 0 : (event.clientX - bounds.left) / bounds.width * 2 - 1;
    const y = off ? 0 : (event.clientY - bounds.top) / bounds.height * 2 - 1;
    for (const layer of layers) {
      const depth = Number(layer.dataset.depth);
      layer.style.transform = `translate(${x * depth * 9}px,${y * depth * 3}px)`;
    }
  };
  const reset = () => layers.forEach(layer => { layer.style.transform = ''; });
  combat.addEventListener('pointermove', move);
  combat.addEventListener('pointerleave', reset);
  reduced.addEventListener('change', reset);
  return () => { combat.removeEventListener('pointermove', move); combat.removeEventListener('pointerleave', reset); reduced.removeEventListener('change', reset); };
}
