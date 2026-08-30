import { componentModel } from './ComponentModel.js';
import { itemTrayModel } from './HudPrimitiveModels.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export function inventoryBeltModel(place) {
  return componentModel(UI.inventoryBelt, {
    variant: place,
    children: [
      itemTrayModel(UI.relicTray, 'relic', 'mount-relic-items'),
      itemTrayModel(UI.potionTray, 'potion', 'mount-potion-items'),
    ],
  });
}
