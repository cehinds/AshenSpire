import { fitLayeredEnvironment } from './layeredEnvironment.js';
// src/ui/components/sceneBackdrop.js — WGS1, the environment plate of a W4
// scene: WGS6 skyline behind, WGS7 floor at the bottom.
//
// One fitter for every W4 screen. Combat (battlefieldStage.js) fits the plate
// from the HUD's top to the battlefield's bottom, then continues behind the
// hand. The quest dialogue passes its whole frame and the scene WINDOW
// between its HUD and context bands: the plate is fitted to the window and
// runs on behind the other bands (SceneLayerModel.sceneWindowLayers). The
// model owns every number; this only writes the result.
import { sceneLayers, sceneWindowLayers } from '../models/SceneLayerModel.js';
import { resolveSceneConfig } from '../models/WireframeChoiceModel.js';
import { activeWireframeChoices } from '../wireframeChoices.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { ENVIRONMENTS } from '../../content/environments.js';

const sceneById = (id) => ENVIRONMENTS.flatMap(region => region.scenes).find(scene => scene.id === id) || null;

/**
 * fitSceneBackdrop(backdrop, { width, height, zoom, windowTop, windowHeight, config })
 *   → the layers, or null when there is no plate.
 *
 * `backdrop` is the `.environment-backdrop` combatBackdropHtml() drew; width
 * and height are the box it is drawn in, in local (pre-zoom) px; zoom is the
 * UI zoom. windowTop/windowHeight name the scene window inside that box
 * (default: the whole box). `config` overrides
 * wireframeUi.scene (the dialogue's floor fraction). Crops the painted plate
 * so its ground line meets the floor band and its sky fills the rest. Feet and
 * portraits are not moved.
 */
export function fitSceneBackdrop(backdrop, { width, height, zoom = 1, windowTop = 0, windowHeight = height, config, groundY } = {}) {
  if (backdrop?.classList.contains('layered-environment')) {
    const chosen = resolveSceneConfig(config || wireframeUi.scene, activeWireframeChoices());
    const floorLine = groundY ?? windowTop + windowHeight * (1 - chosen.floorFraction);
    const effects = backdrop.parentElement?.querySelector(`[data-layered-effects="${backdrop.dataset.layeredKey}"]`) ?? null;
    const fitKey = JSON.stringify([backdrop.dataset.layeredKey, width, height, zoom, windowTop, windowHeight, floorLine, chosen]);
    const unchanged = UnchangedBackdropFit(backdrop, fitKey, effects);
    if (unchanged) return unchanged;
    const geometry = fitLayeredEnvironment(backdrop, { width, height, groundY: floorLine });
    if (!geometry) return null;
    backdrop.dataset.floorTop = String(floorLine * zoom);
    backdrop.dataset.skyline = chosen.skyline ? 'on' : 'off';
    backdrop.dataset.floor = chosen.floor ? 'on' : 'off';
    return RememberBackdropFit(backdrop, fitKey, effects, { geometry, aligned: true, skyline: { visible: !!chosen.skyline },
      floor: { visible: !!chosen.floor, top: floorLine, height: height - floorLine },
      frame: { floorLine, windowTop, windowHeight, height } });
  }
  const art = backdrop?.querySelector(':scope > svg');
  if (!art) return null;
  const scene = sceneById(backdrop.dataset.scene);
  const framed = windowTop !== 0 || windowHeight !== height;
  // WGS6 and WGS7 are the two switches a player can answer (Settings →
  // Advanced → Wireframes → Scenes). Only those two are taken: the caller's
  // config is otherwise its own — the dialogue fits the plate to a window with
  // its own floor fraction, and an answer about the skyline must not flatten
  // that back to combat's.
  const chosen = resolveSceneConfig(config || wireframeUi.scene, activeWireframeChoices());
  const fitKey = JSON.stringify([backdrop.dataset.scene, width, height, zoom, windowTop, windowHeight, chosen]);
  const unchanged = UnchangedBackdropFit(backdrop, fitKey, art);
  if (unchanged) return unchanged;
  const layers = framed
    ? sceneWindowLayers({ width, height, windowTop, windowHeight, scene, config: chosen })
    : sceneLayers({ width, height, scene, config: chosen });
  const viewBox = framed ? layers.frame.viewBox : layers.skyline.viewBox;
  if (viewBox) art.setAttribute('viewBox', viewBox.join(' '));
  // A window-fitted atlas cell can end before the full frame. Fade into the
  // board at that edge instead of exposing the next cell or a hard seam.
  const paintBottom = viewBox && scene?.box
    ? Math.max(0, Math.min(height, (scene.box[1] + scene.box[3] - viewBox[1]) * height / viewBox[3]))
    : height;
  backdrop.style.setProperty('--scene-paint-bottom', `${paintBottom}px`);
  backdrop.dataset.sceneFit = layers.aligned ? 'floor' : 'cover';
  backdrop.dataset.skyline = layers.skyline.visible ? 'on' : 'off';
  backdrop.dataset.floor = layers.floor.visible ? 'on' : 'off';
  // Screen px below the drawn box's top edge (relative, so it cannot go stale
  // when the whole board shifts without resizing).
  backdrop.dataset.floorTop = String((framed ? layers.frame.floorLine : layers.floor.top) * zoom);
  return RememberBackdropFit(backdrop, fitKey, art, layers);
}

// A refit with the same inputs would write the same values: it returns the last
// fit and writes nothing. `part` is the other node the fit wrote (the plate or the
// effects layer); a re-rendered one is fitted afresh.
function UnchangedBackdropFit(backdrop, key, part) {
  const last = backdrop.lastBackdropFit;
  return last && last.key === key && last.part === part ? last.result : null;
}

function RememberBackdropFit(backdrop, key, part, result) {
  backdrop.lastBackdropFit = { key, part, result };
  return result;
}
