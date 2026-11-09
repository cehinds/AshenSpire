import { ComponentModel } from './ComponentModel.js';
import { behaviorModel } from './BehaviorModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

// `detail` is a second semantic value printed after the first (the act's seat
// name); null when the field has none.
export function metadataFieldModel(kind, label, value, total = null, detail = null) {
  return ComponentModel(UI.metadataField, {
    variant: kind,
    properties: { label, value, total, detail },
  });
}

export function actionControlModel(component, { id, label, glyph, hint, command }) {
  return ComponentModel(component, {
    properties: { id, label, glyph, hint },
    accessibility: { label, hint },
    behaviors: [behaviorModel(command, { event: 'activate', command })],
    children: [ComponentModel(UI.actionControl, { variant: command, properties: { label } })],
  });
}

export function itemTrayModel(component, kind, behavior) {
  return ComponentModel(component, {
    variant: kind,
    accessibility: { label: `${kind}s` },
    behaviors: [behaviorModel(behavior)],
    children: [ComponentModel(UI.itemTray, { variant: kind })],
  });
}

export function panelModel(component, variant, children) {
  return ComponentModel(component, {
    variant,
    children: [ComponentModel(UI.panel, {
      variant,
      children: [ComponentModel(UI.componentBackground, { variant })],
    }), ...children],
  });
}
