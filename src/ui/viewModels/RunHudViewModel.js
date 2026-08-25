import { componentModel } from '../models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { runHeaderModel } from '../models/RunHeaderModel.js';
import { vitalsPanelModel } from '../models/VitalsPanelModel.js';
import { quickAccessPanelModel } from '../models/QuickAccessPanelModel.js';
import { inventoryBeltModel } from '../models/InventoryBeltModel.js';
import { hudQuickSettingsModel } from '../models/HudQuickSettingsModel.js';

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
  const hudMode = quickSettings?.settings?.runHudMode === 'compact' ? 'compact' : 'expanded';
  return componentModel(UI.sharedRunHud, {
    variant: place,
    properties: { place, headerClass, overlayHtml, hudMode },
    children: [
      runHeaderModel({ place, cinders, act, actTotal, floor, floorTotal, seed, identity }),
      componentModel(UI.primaryHudRow, {
        children: [vitalsPanelModel(), quickAccessPanelModel(controls)],
      }),
      inventoryBeltModel(place),
      hudQuickSettingsModel({ place, ...quickSettings }),
    ],
  });
}
