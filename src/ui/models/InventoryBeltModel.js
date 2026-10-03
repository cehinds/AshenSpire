import { componentModel } from './ComponentModel.js';
import { itemTrayModel } from './HudPrimitiveModels.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

// WGH6 rail below the primary row: relics on the left. The potion tray exists
// only where RunHudLayerModel allows it, never in combat, whose footer owns
// the one Potions control (WGC11 listing WGH8).
export function inventoryBeltModel(place, layers = { relics: true, potions: true }) {
  return componentModel(UI.inventoryBelt, {
    variant: place,
    children: [
      ...(layers.relics ? [itemTrayModel(UI.relicTray, 'relic', 'mount-relic-items')] : []),
      ...(layers.potions ? [itemTrayModel(UI.potionTray, 'potion', 'mount-potion-items')] : []),
    ],
  });
}
