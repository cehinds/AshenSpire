import { wireframeUi } from '../../content/wireframeUi.js';

const freeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

// A painting may continue behind the hand, but its ground belongs to the
// battlefield window. Fitting against half the entire screen can place the
// painted horizon BELOW the combatants' feet when the footer grows.
export function battlefieldBackdropConfig({ height, fieldTop, fieldHeight, formation, appearance = 'classic' }, config = wireframeUi.scene) {
  // Use all possible cells, not just living actors: deaths must not pan the
  // painting. Classic plates leave half a row above the furthest feet to keep
  // the skyline clear of the HUD; layered scenery uses its authored ground.
  const cells = formation?.cells || [];
  const groundTop = cells.length
    ? Math.max(0, Math.min(...cells.map(cell => cell.ground)) - (appearance === 'classic' ? (formation.rowSpacing || 0) / 2 : 0))
    : fieldHeight * (1 - config.floorFraction);
  const floorTop = fieldTop + groundTop;
  return freeze({ ...config, floorFraction: 1 - Math.max(0, Math.min(height, floorTop)) / height });
}

// WGS1 background composition: WGS6 skyline behind, WGS7 floor at the bottom.
// The environment art is one painted plate per scene (content/environments.js),
// so the two layers are two regions of that plate rather than two assets. The
// plate covers the whole battlefield without distortion, and its authored
// ground line (`scene.floorStart`, a fraction of the painting's height) is
// drawn exactly at the floor band's top edge: the battlefield is
// `floorFraction` ground and the rest sky. Formation feet are placed by
// CombatFormationModel and are not moved by this model or by its toggles.
//
// Input sizes are the battlefield's local px. The result's viewBox is in
// atlas units and has the battlefield's aspect ratio, so a sliced SVG shows
// exactly this crop.
export function sceneLayers({ width, height, scene, config = wireframeUi.scene }) {
  const floorTop = height * (1 - config.floorFraction);
  const floor = { visible: !!config.floor, top: floorTop, height: height - floorTop };
  if (!scene?.box || !(width > 0) || !(height > 0)) {
    return freeze({ skyline: { visible: !!config.skyline, viewBox: scene?.box ? [...scene.box] : null, scale: 1 }, floor, aligned: false });
  }
  const [x, y, w, h] = scene.box;
  const start = scene.floorStart;
  // With the floor layer off, the plate is centred as a plain cover crop.
  const aligned = floor.visible && start > 0 && start < 1;
  let scale = Math.max(width / w, height / h);
  // Both halves of the plate must reach their band: the sky above the ground
  // line fills floorTop, the ground below it fills the floor band.
  if (aligned) scale = Math.max(scale, floorTop / (start * h), floor.height / ((1 - start) * h));
  scale *= 1 + config.bleedFraction;
  const offsetX = (width - w * scale) / 2;
  const offsetY = aligned ? floorTop - start * h * scale : (height - h * scale) / 2;
  return freeze({
    skyline: { visible: !!config.skyline, viewBox: [x - offsetX / scale, y - offsetY / scale, width / scale, height / scale], scale },
    floor: { ...floor, paintedTop: offsetY + (start > 0 ? start : 0) * h * scale },
    aligned,
  });
}

// W4c: the plate fitted to a scene WINDOW inside a taller frame (the band
// between the HUD and the context), then continued behind the frame's other
// bands. sceneLayers fits the window exactly as it fits combat's battlefield;
// the frame's viewBox keeps that scale and horizontal crop and only extends
// the crop up and down, so the floor line stays where the window put it.
// Sizes are the frame's local px; `frame.floorLine` is from the frame's top.
export function sceneWindowLayers({ width, height, windowTop = 0, windowHeight = height, scene, config = wireframeUi.scene }) {
  const layers = sceneLayers({ width, height: windowHeight, scene, config });
  const box = layers.skyline.viewBox;
  const fitted = !!box && !!scene?.box && width > 0 && windowHeight > 0 && height > 0;
  const scale = layers.skyline.scale;
  const viewBox = fitted ? [box[0], box[1] - windowTop / scale, box[2], height / scale] : box;
  return freeze({
    ...layers,
    frame: { viewBox, floorLine: windowTop + layers.floor.top, windowTop, windowHeight, height },
  });
}
