// DOM-free read model for a rebind collision. The model names the two actions
// and the candidate input; the Controls screen owns mutation only after the
// player explicitly chooses Replace.
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

const sameKey = (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase();
const keyName = (value) => {
  if (value === 'Escape') return 'Esc';
  if (value === ' ') return 'Space';
  const text = String(value || '');
  return text.length === 1 ? text.toUpperCase() : text;
};

export function bindingConflictModel({
  family,
  actionId,
  value,
  bindings,
  actions,
  candidateLabel = '',
}) {
  if (family !== 'keyboard' && family !== 'controller') {
    throw new Error(`Unknown binding family: ${family}`);
  }
  const target = actions.find((action) => action.id === actionId);
  if (!target) throw new Error(`Unknown binding action: ${actionId}`);
  const conflict = actions.find((action) => action.id !== actionId
    && (family === 'keyboard'
      ? sameKey(bindings[action.id], value)
      : bindings[action.id] === value));
  if (!conflict) return null;

  const label = candidateLabel || (family === 'keyboard' ? keyName(value) : `Button ${value}`);
  const inputKind = family === 'keyboard' ? 'key' : 'controller button';
  return componentModel(UI.bindingConflictDialog, {
    variant: family,
    properties: {
      family,
      actionId,
      actionLabel: target.label,
      conflictActionId: conflict.id,
      conflictActionLabel: conflict.label,
      candidateValue: value,
      candidateLabel: label,
      title: 'Binding conflict',
      message: `${label} is already assigned to ${conflict.label}.`,
      consequence: `Replace gives this ${inputKind} to ${target.label} and leaves ${conflict.label} unbound.`,
      chooseLabel: 'Choose another',
      replaceLabel: 'Replace',
      cancelLabel: 'Cancel',
    },
    accessibility: {
      role: 'dialog',
      modal: true,
      label: `Resolve ${label} binding conflict`,
      description: `${label} is assigned to ${conflict.label} and was requested for ${target.label}.`,
    },
  });
}
