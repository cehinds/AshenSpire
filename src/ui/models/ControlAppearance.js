// Control appearance from COLOR-INTERACTION-CONTRACT §3: one resolver, one
// precedence. Input adapters supply hover/focus/press; models never hold DOM.
// The stylesheet paints each named state from shared palette roles.

export const CONTROL_ROLES = Object.freeze(['primary', 'utility', 'selection', 'exit', 'destructive']);

// Registered exceptions. Each maps its own model facts to a state; none may
// make an unavailable control look actionable (busy/unavailable resolves first).
// A deliberate exception to "models hold records, not callbacks": each entry
// is a pure function of plain model facts, frozen and DOM-free. kit.css paints
// the same precedence by hand from data-control-role/-exception, so this
// resolver is the tested statement of it (tests/wireframe-control-appearance).
export const CONTROL_EXCEPTIONS = Object.freeze({
  // End Turn: a legal early end stays neutral; green once actions are spent,
  // or while the legal action is highlighted. Guidance only, never legality.
  combatEndTurn: (model, highlighted) => {
    if (highlighted) return 'primary-highlighted';
    return model.ready ? 'primary-ready' : 'neutral';
  },
});

/** The kit's weights map onto roles; a danger class is a destructive commit. */
export function resolveControlRole({ role = null, weight = 'secondary', className = '' } = {}) {
  const resolved = role
    || (weight === 'danger' || /(^|\s)danger(\s|$)/.test(className) ? 'destructive'
      : weight === 'primary' ? 'primary' : 'utility');
  if (!CONTROL_ROLES.includes(resolved)) throw new Error(`Unknown control role '${resolved}'`);
  return resolved;
}

export function assertControlException(id, exceptions = CONTROL_EXCEPTIONS) {
  if (id != null && !Object.hasOwn(exceptions, id)) throw new Error(`Unknown control exception '${id}'`);
  return id;
}

export function controlAppearance(model = {}, input = {}, exceptions = CONTROL_EXCEPTIONS) {
  const { visible = true, canActivate = true, busy = false, selected = false, exceptionId = null } = model;
  const role = resolveControlRole({ role: model.role || 'utility' });
  assertControlException(exceptionId, exceptions);
  const focused = !!input.focused;
  const done = (state) => Object.freeze({ state, role, focused, pressed: state !== 'absent' && state !== 'unavailable' && !!input.pressed });
  if (!visible) return done('absent');
  // Unavailable keeps a visible focus outline but no red/green encouragement.
  if (busy || !canActivate) return done('unavailable');
  const highlighted = !!(input.hovered || focused || selected);
  if (exceptionId) return done(exceptions[exceptionId](model, highlighted));
  switch (role) {
    case 'destructive': return done(highlighted ? 'destructive-highlighted' : 'destructive');
    case 'exit': return done(highlighted ? 'exit-highlighted' : 'neutral');
    case 'primary': return done(highlighted ? 'primary-highlighted' : 'primary-ready');
    case 'selection': return done(selected ? 'selected' : highlighted ? 'neutral-highlighted' : 'neutral');
    default: return done(highlighted ? 'neutral-highlighted' : 'neutral');
  }
}
