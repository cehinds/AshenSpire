// src/ui/components/sceneBackdrop.js — WGS1, the environment plate of a W4
// scene: WGS6 skyline behind, WGS7 floor at the bottom.
//
// One fitter for every W4 screen. Combat (battlefieldStage.js) passes its
// battlefield, which is both the window the plate is fitted to and the box it
// is drawn in. The quest dialogue passes its whole frame and the scene WINDOW
// between its HUD and context bands: the plate is fitted to the window and
// runs on behind the other bands (SceneLayerModel.sceneWindowLayers). The
// model owns every number; this only writes the result.
import { sceneLayers, sceneWindowLayers } from '../models/SceneLayerModel.js';
import { ENVIRONMENTS } from '../../content/environments.js';
import { LEGACY_SCENES } from '../../model/legacyDungeon.js';

const sceneById = (id) => [...LEGACY_SCENES, ...ENVIRONMENTS.flatMap(region => region.scenes)].find(scene => scene.id === id) || null;

/**
 * fitSceneBackdrop(backdrop, { width, height, zoom, windowTop, windowHeight, config })
 *   → the layers, or null when there is no plate.
 *
 * `backdrop` is the `.environment-backdrop` combatBackdropHtml() drew; width
 * and height are the box it is drawn in, in local (pre-zoom) px; zoom is the
 * UI zoom. windowTop/windowHeight name the scene window inside that box
 * (default: the whole box, as combat has it). `config` overrides
 * wireframeUi.scene (the dialogue's floor fraction). Crops the painted plate
 * so its ground line meets the floor band and its sky fills the rest. Feet and
 * portraits are not moved.
 */
export function fitSceneBackdrop(backdrop, { width, height, zoom = 1, windowTop = 0, windowHeight = height, config } = {}) {
  const art = backdrop?.querySelector(':scope > svg');
  if (!art) return null;
  const scene = sceneById(backdrop.dataset.scene);
  const framed = windowTop !== 0 || windowHeight !== height;
  const layers = framed
    ? sceneWindowLayers({ width, height, windowTop, windowHeight, scene, config })
    : sceneLayers({ width, height, scene, config });
  const viewBox = framed ? layers.frame.viewBox : layers.skyline.viewBox;
  if (viewBox) art.setAttribute('viewBox', viewBox.join(' '));
  backdrop.dataset.sceneFit = layers.aligned ? 'floor' : 'cover';
  backdrop.dataset.skyline = layers.skyline.visible ? 'on' : 'off';
  backdrop.dataset.floor = layers.floor.visible ? 'on' : 'off';
  // Screen px below the drawn box's top edge (relative, so it cannot go stale
  // when the whole board shifts without resizing).
  backdrop.dataset.floorTop = String((framed ? layers.frame.floorLine : layers.floor.top) * zoom);
  return layers;
}
