import { componentModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { runHeaderModel } from '../models/RunHeaderModel.js';
import { vitalsPanelModel } from '../models/VitalsPanelModel.js';
import { quickAccessPanelModel } from '../models/QuickAccessPanelModel.js';
import { inventoryBeltModel } from '../models/InventoryBeltModel.js';
import { hudModeGripModel, normalizeHudMode } from '../models/HudModeModel.js';

// Presentation projection only: callers provide a domain snapshot and command
// ids; the result is a frozen tree with no callbacks or mutable run objects.
export function runHudViewModel({
  place,
  headerClass = '',
  cinders,
  act,
  actTotal = null,
  floor,
  floorTotal = null,
  seed,
  identity,
  controls,
  quickSettings,
  overlayHtml = '',
} = {}) {
  const hudMode = normalizeHudMode(quickSettings?.settings?.runHudMode);
  return componentModel(UI.sharedRunHud, {
    variant: place,
    properties: { place, headerClass, overlayHtml, hudMode },
    children: [
      runHeaderModel({ place, cinders, act, actTotal, floor, floorTotal, seed, identity }),
      componentModel(UI.primaryHudRow, {
        children: [vitalsPanelModel(), quickAccessPanelModel(controls)],
      }),
      inventoryBeltModel(place),
      // NO QUICK-SETTINGS CHILD. The fullscreen/music pair left the run HUD on
      // 2026-09-05 ("the full screen and music buttons don't need to be there
      // since we have it in the quick and main menu settings"), so the band has
      // no such component to model. `hudQuickSettingsModel` is still the title
      // screen's, which is the main menu that keeps the pair.
      //
      // `quickSettings` SURVIVES AS A PARAMETER and that is not residue: the bag
      // carries `settings`, and `runHudMode` inside it is what decides whether
      // this band draws compact or expanded (see `hudMode` above). It is the
      // settings bag, not the pair's model.
      hudModeGripModel({ mode: hudMode }),
    ],
  });
}
