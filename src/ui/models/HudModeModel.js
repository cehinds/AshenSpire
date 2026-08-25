import { behaviorModel } from './BehaviorModel.js';
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export function normalizeHudMode(value) {
  return value === 'compact' ? 'compact' : 'expanded';
}

export function hudModeGripModel({ mode } = {}) {
  const current = normalizeHudMode(mode);
  const next = current === 'compact' ? 'expanded' : 'compact';
  return componentModel(UI.hudModeGrip, {
    variant: current,
    properties: { mode: current, next },
    accessibility: {
      role: 'button',
      label: current === 'compact' ? 'Expand run HUD' : 'Compact run HUD',
      hint: 'Click, press Enter, or drag vertically. The HUD remembers this snap state.',
    },
    behaviors: [behaviorModel('snap-run-hud', {
      event: 'click-or-drag', command: 'set-run-hud-mode', payload: { mode: next },
    })],
  });
}
