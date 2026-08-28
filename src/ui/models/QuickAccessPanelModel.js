import { componentModel } from './ComponentModel.js';
import { behaviorModel } from './BehaviorModel.js';
import { actionControlModel, panelModel } from './HudPrimitiveModels.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export function quickAccessPanelModel(controls) {
  return panelModel(UI.quickAccessPanel, 'quick-access', [
    actionControlModel(UI.armouryControl, {
      id: controls.armouryId,
      label: 'Armoury',
      glyph: '⚒',
      hint: 'Armoury',
      command: 'open-armoury',
    }),
    actionControlModel(UI.quickMenuControl, {
      id: controls.menuId,
      label: 'Quick menu',
      glyph: '☰',
      hint: controls.menuHint,
      command: 'open-quick-menu',
    }),
    componentModel(UI.crimsonFlaskControl, { variant: 'hp', behaviors: [behaviorModel('mount-charge-flask', { payload: { kind: 'hp' } })] }),
    componentModel(UI.azureFlaskControl, { variant: 'mana', behaviors: [behaviorModel('mount-charge-flask', { payload: { kind: 'mana' } })] }),
  ]);
}
