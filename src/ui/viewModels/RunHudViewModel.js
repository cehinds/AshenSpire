import { componentModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { runHeaderModel } from '../models/RunHeaderModel.js';
import { vitalsPanelModel } from '../models/VitalsPanelModel.js';
import { quickAccessPanelModel } from '../models/QuickAccessPanelModel.js';
import { inventoryBeltModel } from '../models/InventoryBeltModel.js';
import { runHudLayers } from '../models/RunHudLayerModel.js';

// Presentation projection only: callers provide a domain snapshot and command
// ids; the result is a frozen tree with no callbacks or mutable run objects.
export function runHudViewModel({
  place,
  headerClass = '',
  cinders,
  act,
  actTotal = null,
  // The act's seat name (SPEC §13.2) as its own field; the view prints it
  // after the act number. Null for a run without a seat.
  seat = null,
  floor,
  floorTotal = null,
  seed,
  identity,
  controls,
  quickSettings,
  overlayHtml = '',
  // A HUD context the host opts into ('map-compact' is W4b's 10 vh header);
  // empty keeps the band combat and the rooms draw. `orientationHtml` is the
  // host's own receipt (the map's route strip) laid out inside the band.
  layout = '',
  orientationHtml = '',
  // WGH0 layers, filtered BEFORE layout (models/RunHudLayerModel.js): a layer
  // that is off contributes no child, so no row, track or gap is reserved.
  layers = runHudLayers(place),
} = {}) {
  const primary = [
    ...(layers.vitality ? [vitalsPanelModel()] : []),
    ...(layers.controls ? [quickAccessPanelModel(controls, layers)] : []),
  ];
  return componentModel(UI.sharedRunHud, {
    variant: place,
    properties: { place, headerClass, overlayHtml, layout, orientationHtml },
    children: [
      ...(layers.header ? [runHeaderModel({ place, cinders, act, actTotal, seat, floor, floorTotal, seed, identity }, layers)] : []),
      ...(primary.length ? [componentModel(UI.primaryHudRow, { children: primary })] : []),
      // WGH6 rail: relics, and potion tiles only where no footer HUD owns
      // Potions (RunHudLayerModel decides; combat never gets them).
      ...(layers.rail ? [inventoryBeltModel(place, layers)] : []),
      // NO QUICK-SETTINGS CHILD. The fullscreen/music pair left the run HUD on
      // 2026-09-05 ("the full screen and music buttons don't need to be there
      // since we have it in the quick and main menu settings"), so the band has
      // no such component to model. `hudQuickSettingsModel` is still the title
      // screen's, which is the main menu that keeps the pair.
      //
      // NO MODE GRIP EITHER. The fold control that snapped this band compact
      // went on 2026-09-11 ("this stray button can go too"); `quickSettings`
      // stays a parameter so the callers' shape is unchanged, and it is read
      // by nothing here now.
    ],
  });
}
