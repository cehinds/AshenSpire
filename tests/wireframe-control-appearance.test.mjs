import test from 'node:test';
import assert from 'node:assert/strict';
import { controlAppearance, resolveControlRole, assertControlException, CONTROL_ROLES, CONTROL_EXCEPTIONS } from '../src/ui/models/ControlAppearance.js';

const STATES = new Set(['absent', 'unavailable', 'neutral', 'neutral-highlighted', 'selected',
  'primary-ready', 'primary-highlighted', 'exit-highlighted', 'destructive', 'destructive-highlighted']);

test('every role and registered exception resolves to a painted state and respects precedence', () => {
  for (const role of CONTROL_ROLES) {
    assert.equal(state({ role, visible: false }), 'absent', role);
    assert.equal(state({ role, busy: true }, hover), 'unavailable', role);
    for (const input of [{}, hover]) assert.ok(STATES.has(state({ role }, input)), role);
  }
  for (const exceptionId of Object.keys(CONTROL_EXCEPTIONS)) {
    assert.equal(assertControlException(exceptionId), exceptionId);
    for (const ready of [false, true]) {
      assert.equal(state({ role: 'primary', exceptionId, ready, canActivate: false }, hover), 'unavailable', exceptionId);
      assert.equal(state({ role: 'primary', exceptionId, ready, visible: false }), 'absent', exceptionId);
      for (const input of [{}, hover]) assert.ok(STATES.has(state({ role: 'primary', exceptionId, ready }, input)), exceptionId);
    }
  }
});

const state = (model, input) => controlAppearance(model, input).state;
const hover = { hovered: true };

test('absent and unavailable resolve before any role colour', () => {
  assert.equal(state({ role: 'primary', visible: false }, hover), 'absent');
  for (const role of ['primary', 'destructive', 'exit']) {
    assert.equal(state({ role, busy: true }, hover), 'unavailable');
    assert.equal(state({ role, canActivate: false }, hover), 'unavailable');
  }
  const focusedUnavailable = controlAppearance({ role: 'primary', canActivate: false }, { focused: true, pressed: true });
  assert.equal(focusedUnavailable.focused, true, 'focus stays visible for explanation');
  assert.equal(focusedUnavailable.pressed, false, 'no pressed effect on an unavailable control');
});

test('destructive is never primary green; exits are red only while highlighted', () => {
  assert.equal(state({ role: 'destructive' }), 'destructive');
  assert.equal(state({ role: 'destructive' }, hover), 'destructive-highlighted');
  assert.equal(state({ role: 'exit' }), 'neutral');
  assert.equal(state({ role: 'exit' }, { focused: true }), 'exit-highlighted');
  assert.equal(state({ role: 'primary' }), 'primary-ready');
  assert.equal(state({ role: 'primary', selected: true }), 'primary-highlighted');
  assert.equal(state({ role: 'selection', selected: true }), 'selected');
  assert.equal(state({ role: 'utility' }, hover), 'neutral-highlighted');
});

test('End Turn guidance: neutral early, green when spent or highlighted, muted when illegal', () => {
  const endTurn = { role: 'primary', exceptionId: 'combatEndTurn' };
  assert.equal(state({ ...endTurn, ready: false }), 'neutral');
  assert.equal(state({ ...endTurn, ready: true }), 'primary-ready');
  assert.equal(state({ ...endTurn, ready: false }, hover), 'primary-highlighted');
  assert.equal(state({ ...endTurn, ready: true, busy: true }, hover), 'unavailable');
});

test('kit weights map to roles and unknown vocabulary is refused', () => {
  assert.equal(resolveControlRole({ weight: 'primary' }), 'primary');
  assert.equal(resolveControlRole({ weight: 'danger' }), 'destructive');
  assert.equal(resolveControlRole({ weight: 'primary', className: 'primary danger' }), 'destructive');
  assert.equal(resolveControlRole({ weight: 'primary', className: 'endangered' }), 'primary');
  assert.equal(resolveControlRole({}), 'utility');
  assert.equal(resolveControlRole({ role: 'exit', weight: 'primary' }), 'exit');
  assert.throws(() => resolveControlRole({ role: 'loud' }), /Unknown control role/);
  assert.throws(() => assertControlException('menuGlow'), /Unknown control exception/);
  assert.throws(() => controlAppearance({ role: 'primary', exceptionId: 'menuGlow' }), /Unknown control exception/);
});
