function frozenRecord(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(frozenRecord));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = frozenRecord(child);
    return Object.freeze(out);
  }
  return value;
}

export function behaviorModel(name, {
  event = 'mount',
  command = name,
  policy = '',
  payload = {},
} = {}) {
  if (typeof name !== 'string' || !name) throw new Error('Behavior name is required');
  if (typeof event !== 'string' || !event) throw new Error(`${name} event is required`);
  if (typeof command !== 'string' || !command) throw new Error(`${name} command is required`);
  return Object.freeze({ name, event, command, policy, payload: frozenRecord(payload) });
}

export function isBehaviorModel(value) {
  return !!value && typeof value === 'object'
    && typeof value.name === 'string' && !!value.name
    && typeof value.event === 'string' && !!value.event
    && typeof value.command === 'string' && !!value.command;
}
