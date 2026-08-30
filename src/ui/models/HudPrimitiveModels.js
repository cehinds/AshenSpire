import { componentModel } from './ComponentModel.js';
import { behaviorModel } from './BehaviorModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export function metadataFieldModel(kind, label, value, total = null) {
  return componentModel(UI.metadataField, {
    variant: kind,
    properties: { label, value, total },
  });
}

export function actionControlModel(component, { id, label, glyph, hint, command }) {
  return componentModel(component, {
    properties: { id, label, glyph, hint },
    accessibility: { label, hint },
    behaviors: [behaviorModel(command, { event: 'activate', command })],
    children: [componentModel(UI.actionControl, { variant: command, properties: { label } })],
  });
}

export function itemTrayModel(component, kind, behavior) {
  return componentModel(component, {
    variant: kind,
    accessibility: { label: `${kind}s` },
    behaviors: [behaviorModel(behavior)],
    children: [componentModel(UI.itemTray, { variant: kind })],
  });
}

export function panelModel(component, variant, children) {
  return componentModel(component, {
    variant,
    children: [componentModel(UI.panel, {
      variant,
      children: [componentModel(UI.componentBackground, { variant })],
    }), ...children],
  });
}
