import { mobileFloorLayer } from './models/MobileFloorModel.js';
import { uiConfig } from '../config/generated/ui.js';
import { alternativeArtCatalog } from './alternativeArtCatalog.js';
import { assetUrl } from './assetmap.js';
import { markArtPlaceholder } from './artFallback.js';
import { armourById } from '../content/equipment.js';
import { classicAppearance } from './displayAppearance.js';
import { reducedMotionRequested } from './motion.js';
import { displaySceneryTier } from './artTier.js';
import { ART_SOURCE_EVENT } from './highResArt.js';
import { isWideFormFactor } from './models/FormFactorModel.js';

/* ALTERNATIVE_ART_START */
const alternativeArtMap = {};
/* ALTERNATIVE_ART_END */
export const alternativeArtUrl = path => alternativeArtMap[path] || assetUrl(path);
const phoneArt = () => typeof document !== 'undefined' && document.documentElement.dataset.layout === 'narrow';

// Scenery detail changes the image source, never its authored canvas or framing.
function sceneArtPath(art, narrow = phoneArt()) {
  const factor = globalThis.document?.documentElement?.dataset.formFactor;
  const desktop = !narrow && (!factor || isWideFormFactor(factor));
  return art[desktop && displaySceneryTier() === 'high' ? 'path' : 'mobilePath'];
}

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
    placeholder.textContent = side === 'player' ? 'Player' : 'Enemy';
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
  const layers = combatSceneLayers(device);
  // The fill's sources are set when the backdrop is fitted (first paint loads each file once).
  const image = (layer, attr) => `<image ${attr}="${layer.id}" ${attr === 'data-layer' ? `href="${alternativeArtUrl(sceneArtPath(alternativeArtCatalog.sceneLayers[layer.id], mobile))}" ` : ''}x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}"/>`;
  // Zooming the art out can leave bare edges. `fill` repeats the far sky and the
  // ground at the old, closer framing, blurred once and static, behind the sharp
  // layers; `edge` feathers the sharp layers into it only where an edge shows.
  const fill = layers.filter(layer => ['far', 'ground'].includes(alternativeArtCatalog.sceneLayers[layer.id].kind));
  return `<div class="backdrop alternative-backdrop" data-region="${scene.region}" data-scene="${sceneId}" aria-hidden="true">
    <svg class="alternative-scene" viewBox="0 0 ${device.width} ${device.height}" focusable="false">
      <defs><filter id="alternative-scene-fill-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="alternative-scene-edge-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
        <mask id="alternative-scene-edge" maskUnits="userSpaceOnUse" x="-6000" y="-6000" width="14000" height="14000"><rect class="alternative-scene-edge" x="-5000" y="-5000" width="12000" height="12000" fill="#fff" filter="url(#alternative-scene-edge-blur)"/></mask></defs>
      <g class="alternative-scene-fill" display="none" filter="url(#alternative-scene-fill-blur)">${fill.map(layer => image(layer, 'data-fill-layer')).join('')}</g>
      <g class="alternative-scene-main">${layers.map(layer => `<g class="alternative-scene-layer" data-depth="${layer.depth}">${image(layer, 'data-layer')}</g>`).join('')}</g>
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
export function fitAlternativeBackdrop(combat, { width, height, fieldTop, ground, standGround, narrow, coverFloor = false, floorShadowTop, floorTop, zoom = 1 }) {
  const backdrop = combat.querySelector('.alternative-backdrop');
  if (backdrop) {
    delete backdrop.dataset.mobileFloorPaintTop;
    delete backdrop.dataset.mobileFloorShadowTop;
  }
  const scene = alternativeArtCatalog.scenes[backdrop?.dataset.scene];
  if (!scene || width <= 0 || height <= 0) return;
  const key = narrow ? 'phone' : 'desktop';
  const device = scene.devices[key];
  const svg = backdrop.querySelector('svg');
  const framing = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.scene;
  const previewTop = narrow ? fieldTop * .5 : combat.clientHeight * framing.topHeightFraction;
  const coverScale = Math.max(width / device.width, (coverFloor ? fieldTop + height - previewTop : height) / device.height);
  // Combat zooms the art out (owner 2026-11-01: too close, looks pixelated) about
  // the ground anchor, so the floor stays under the grid where it was.
  const scale = coverScale * (coverFloor ? framing.backdropZoom ?? 1 : 1);
  // Combat follows the fitted enemies while keeping the floor canvas beneath
  // the entire battlefield; moving it farther up exposes its lower edge.
  // Other callers (dialogue) keep their own floor line.
  // `standGround`, when given, is the farthest-back foot line: the camera never
  // frames so low that those feet rise above the scene's standing area.
  const standingTop = device.standingArea?.y ?? device.groundAnchor;
  const framed = Number.isFinite(standGround)
    ? Math.min(ground, standGround + (device.groundAnchor - standingTop) * device.height * scale) : ground;
  const cameraGround = coverFloor
    ? Math.max(framed, height - (1 - device.groundAnchor) * device.height * scale) : framed;
  const top = document.documentElement.dataset.wireframeSceneFloor === 'off'
    ? fieldTop + (height - device.height * scale) / 2
    : coverFloor ? previewTop + device.groundAnchor * device.height * (coverScale - scale) : fieldTop + cameraGround - device.groundAnchor * device.height * scale;
  svg.setAttribute('viewBox', `0 0 ${device.width} ${device.height}`);
  svg.style.cssText = `width:${device.width * scale}px;height:${device.height * scale}px;left:${(width - device.width * scale) / 2}px;top:${top}px`;
  backdrop.dataset.device = key;
  let groundBottom = Infinity, fillGround = null;
  [...svg.querySelectorAll('.alternative-scene-layer')].forEach((group, index) => {
    let layer = combatSceneLayers(device)[index];
    if (coverFloor && Number.isFinite(floorShadowTop)) {
      const floor = framing.mobileFloor;
      const paintStart = floor.paintStarts[layer.id];
      if (paintStart) {
        group.style.transform = '';
        // The ground never starts below the back rank's cell top (`floorTop`, owner 2026-10-31): the grid's back edge
        // stands on painted ground, not in the sky. The shadow rule still wins where the shadows rise higher.
        const paintCeiling = Number.isFinite(floorTop) ? Math.min(floorShadowTop - floor.shadowClearancePx / zoom, floorTop) : floorShadowTop - floor.shadowClearancePx / zoom;
        // Continue only the authored ground behind the hand to the footer;
        // its painted horizon remains constrained by the back-row shadows.
        const fitFloor = (frameTop, frameScale) => mobileFloorLayer(layer, { paintStart, maximumPaintTop: (paintCeiling - frameTop) / frameScale,
          minimumBottom: (combat.clientHeight - frameTop) / frameScale });
        // The ground is sized by the screen (horizon to footer), not by the canvas
        // scale, so the backdrop zoom shrinks the fitted ground about its horizon.
        const closer = fitFloor(previewTop, coverScale);
        if (scale < coverScale) fillGround = closer;
        layer = scale < coverScale ? zoomOutFloor(closer, { paintStart, device, width, coverScale, scale, top, previewTop })
          : fitFloor(top, scale);
        groundBottom = top + (layer.y + layer.height) * scale;
        backdrop.dataset.mobileFloorPaintTop = String((top + (layer.y + layer.height * paintStart) * scale) * zoom);
        backdrop.dataset.mobileFloorShadowTop = String(floorShadowTop * zoom);
      }
    }
    const art = alternativeArtCatalog.sceneLayers[layer.id];
    const image = group.firstElementChild;
    group.dataset.depth = String(layer.depth);
    image.dataset.layer = layer.id;
    for (const prop of ['x', 'y', 'width', 'height']) image.setAttribute(prop, layer[prop]);
    const href = alternativeArtUrl(sceneArtPath(art, narrow));
    if (image.getAttribute('href') !== href) image.setAttribute('href', href);
    group.style.visibility = ['far', 'landmark'].includes(art.kind) && document.documentElement.dataset.wireframeSceneSkyline === 'off' ? 'hidden' : '';
  });
  fitBackdropFill(svg, { device, scale, coverScale, left: (width - device.width * scale) / 2, top, width, bottom: combat.clientHeight || fieldTop + height, groundBottom, fillGround, narrow });
  const fade = combat.querySelector('.alternative-card-fade');
  if (fade) fade.style.backgroundImage = `url('${alternativeArtUrl((narrow ? alternativeArtCatalog.mobileLayers : alternativeArtCatalog.layers)['card-section-texture'])}')`;
}

function zoomOutFloor(fitted, { paintStart, device, width, coverScale, scale, top, previewTop }) {
  const k = scale / coverScale;
  const centre = (width - device.width * coverScale) / 2 + (fitted.x + fitted.width / 2) * coverScale;
  const horizon = previewTop + (fitted.y + fitted.height * paintStart) * coverScale;
  const w = fitted.width * coverScale * k, h = fitted.height * coverScale * k;
  return { ...fitted, x: (centre - w / 2 - (width - device.width * scale) / 2) / scale, width: w / scale,
    y: (horizon - h * paintStart - top) / scale, height: h / scale };
}

// The blurred fill is the old, closer framing (zoomed about the ground anchor);
// the sharp layers fade into it along each edge that no longer reaches the screen.
function fitBackdropFill(svg, { device, scale, coverScale, left, top, width, bottom, groundBottom, fillGround, narrow }) {
  const fill = svg.querySelector?.(':scope > .alternative-scene-fill');
  if (!fill) return;
  const grow = coverScale / scale;
  const bare = grow > 1.001;
  fill.setAttribute('display', bare ? '' : 'none');
  svg.querySelector(':scope > .alternative-scene-main')?.removeAttribute('mask');
  if (!bare) return;
  const anchor = device.groundAnchor * device.height;
  fill.setAttribute('transform', `translate(${device.width * (1 - grow) / 2} ${anchor * (1 - grow)}) scale(${grow})`);
  for (const image of fill.querySelectorAll('image')) {
    // Same ground as the sharp layer had before the zoom: its horizon stays level across the seam.
    const place = fillGround?.id === image.dataset.fillLayer ? fillGround : combatSceneLayers(device).find(layer => layer.id === image.dataset.fillLayer);
    for (const prop of ['x', 'y', 'width', 'height']) image.setAttribute(prop, place[prop]);
    const href = alternativeArtUrl(sceneArtPath(alternativeArtCatalog.sceneLayers[image.dataset.fillLayer], narrow));
    if (image.getAttribute('href') !== href) image.setAttribute('href', href);
  }
  const fade = 72 / scale, far = 5000;
  const exposed = [left > .5, top > .5, left + device.width * scale < width - .5, Math.min(top + device.height * scale, groundBottom) < bottom - .5];
  if (!exposed.some(Boolean)) return;
  const edge = svg.querySelector('.alternative-scene-edge');
  const x0 = exposed[0] ? fade : -far, y0 = exposed[1] ? fade : -far;
  const x1 = exposed[2] ? device.width - fade : far, y1 = exposed[3] ? (Math.min(top + device.height * scale, groundBottom) - top) / scale - fade : far;
  for (const [name, value] of [['x', x0], ['y', y0], ['width', x1 - x0], ['height', y1 - y0]]) edge.setAttribute(name, value);
  svg.querySelector('#alternative-scene-edge-blur feGaussianBlur')?.setAttribute('stdDeviation', String(fade / 2));
  svg.querySelector(':scope > .alternative-scene-main').setAttribute('mask', 'url(#alternative-scene-edge)');
}

export function wireAlternativeBackdrop(combat) {
  const layers = [...combat.querySelectorAll('.alternative-scene-layer')];
  if (!layers.length) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const move = event => {
    // The in-game Reduced motion setting counts as much as the OS preference.
    const off = reducedMotionRequested() || document.documentElement.dataset.ambient === 'off' || event.pointerType === 'touch';
    if (off) { reset(); return; }
    const bounds = combat.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    const y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    for (const layer of layers) {
      const id = layer.firstElementChild?.dataset.layer;
      const groundedFloor = combat.querySelector('.alternative-backdrop')?.dataset.mobileFloorPaintTop !== undefined
        && alternativeArtCatalog.sceneLayers[id]?.kind === 'ground';
      const depth = groundedFloor ? 0 : Number(layer.dataset.depth);
      layer.style.transform = `translate(${x * depth * 9}px,${y * depth * 3}px)`;
    }
  };
  const reset = () => layers.forEach(layer => { if (layer.style.transform) layer.style.transform = ''; });
  const refreshSources = () => {
    const narrow = combat.querySelector('.alternative-backdrop')?.dataset.device === 'phone' || phoneArt();
    for (const layer of layers) {
      const image = layer.firstElementChild;
      const art = alternativeArtCatalog.sceneLayers[image?.dataset.layer];
      if (!art) continue;
      const href = alternativeArtUrl(sceneArtPath(art, narrow));
      if (image.getAttribute('href') !== href) image.setAttribute('href', href);
    }
  };
  document.addEventListener?.(ART_SOURCE_EVENT, refreshSources);
  combat.addEventListener('pointermove', move);
  combat.addEventListener('pointerleave', reset);
  reduced.addEventListener('change', reset);
  // Turning on the in-game setting toggles a body class; settle at once rather
  // than leaving the layers offset until the next pointer move snaps them.
  const setting = typeof MutationObserver === 'function'
    ? new MutationObserver(() => { if (reducedMotionRequested()) reset(); }) : null;
  setting?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return () => { document.removeEventListener?.(ART_SOURCE_EVENT, refreshSources); combat.removeEventListener('pointermove', move); combat.removeEventListener('pointerleave', reset); reduced.removeEventListener('change', reset); setting?.disconnect(); };
}
