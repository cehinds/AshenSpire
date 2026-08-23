import { componentModel } from './ComponentModel.js';
import { behaviorModel } from './BehaviorModel.js';
import { panelModel } from './HudPrimitiveModels.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export function vitalsPanelModel() {
  return panelModel(UI.vitalsPanel, 'vitals', [
    componentModel(UI.resourceMeter, {
      variant: 'main',
      accessibility: { label: 'Health, mana, and stamina' },
      behaviors: [behaviorModel('mount-resource-meters')],
    }),
  ]);
}
