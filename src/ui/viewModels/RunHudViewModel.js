import { componentModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { runHeaderModel } from '../models/RunHeaderModel.js';
import { vitalsPanelModel } from '../models/VitalsPanelModel.js';
import { quickAccessPanelModel } from '../models/QuickAccessPanelModel.js';
import { inventoryBeltModel } from '../models/InventoryBeltModel.js';

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
  return componentModel(UI.sharedRunHud, {
    variant: place,
    properties: { place, headerClass, overlayHtml },
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
      // NO MODE GRIP EITHER. The fold control that snapped this band compact
      // went on 2026-09-11 ("this stray button can go too"); `quickSettings`
      // stays a parameter so the callers' shape is unchanged, and it is read
      // by nothing here now.
    ],
  });
}
