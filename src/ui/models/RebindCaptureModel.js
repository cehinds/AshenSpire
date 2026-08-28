/** Pure model for keyboard/gamepad conflict detection and replacement. */
export function rebindConflictModel({ kind, actionId, value, bindings, actions }) {
  const comparable = (candidate) => kind === 'key' && typeof candidate === 'string'
    ? candidate.toLocaleLowerCase()
    : candidate;
  const wanted = comparable(value);
  const conflictingId = Object.keys(bindings || {}).find((id) => (
    id !== actionId && comparable(bindings[id]) === wanted
  )) || null;
  const action = actions.find((item) => item.id === actionId);
  const conflicting = actions.find((item) => item.id === conflictingId);
  return {
    kind,
    actionId,
    value: kind === 'key' && typeof value === 'string' && value.length === 1
      ? value.toLocaleLowerCase()
      : value,
    conflictingId,
    label: action?.label || actionId,
    conflictingLabel: conflicting?.label || conflictingId || '',
    hasConflict: !!conflictingId,
  };
}

export function applyRebind(model, bindings, { replace = false } = {}) {
  const next = { ...(bindings || {}) };
  if (model.hasConflict && !replace) return next;
  // Replace means swap, not silently unbind. Every action remains reachable
  // and a default cannot spring back into the just-resolved conflict.
  if (model.hasConflict) next[model.conflictingId] = next[model.actionId];
  next[model.actionId] = model.value;
  return next;
}
