import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { perspectiveCellContains } from '../src/ui/models/AlternativeFormationModel.js';

const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const gridSource = stage.slice(stage.indexOf('const gridTargetingFields = new WeakSet();'));
class ProxyEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
}
function fixture({ dead = false, inert = false } = {}) {
  const events = [], listeners = new Map();
  const frame = { inert, classList: { contains: value => value === 'dead' && dead },
    dispatchEvent: event => { events.push(event); return true; },
    click() { throw new Error('HTMLElement.click discards the native gesture'); } };
  const field = { formationPlan: { plan: { slots: [{ side: 'enemy', cell: 'E1' }],
    cells: [{ cell: 'E1', box: { left: 100, top: 100, width: 200, height: 200, skew: .2 } }] } },
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    querySelector: () => ({}), querySelectorAll: () => [frame],
    classList: { toggle() {}, remove() {} },
    addEventListener(type, fn) { listeners.set(type, fn); } };
  const wire = runInNewContext(`${gridSource}\nwireGridTargeting`, {
    perspectiveCellContains, CSS: { escape: value => value }, PointerEvent: ProxyEvent, MouseEvent: ProxyEvent,
  });
  wire(field);
  const fire = (type, overrides = {}) => {
    const event = { type, target: { closest: () => null }, detail: 1, clientX: 210, clientY: 220,
      screenX: 250, screenY: 260, button: 0, buttons: 1, pointerId: 42, pointerType: 'touch',
      isPrimary: true, width: 8, height: 9, pressure: .6, ctrlKey: false, shiftKey: true,
      altKey: false, metaKey: false, stopped: false, prevented: false,
      stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; }, ...overrides };
    listeners.get(type)(event);
    return event;
  };
  return { events, fire };
}

test('occupied perspective cells forward the active pointer identity for native hold and cancellation tracking', () => {
  const { events, fire } = fixture();
  const original = fire('pointerdown');
  assert.equal(events.length, 1);
  const forwarded = events[0];
  assert.equal(forwarded.type, 'pointerdown');
  for (const key of ['pointerId', 'pointerType', 'isPrimary', 'button', 'buttons', 'clientX', 'clientY', 'width', 'height', 'pressure'])
    assert.equal(forwarded[key], original[key], key);
  assert.equal(original.stopped, true, 'only the forwarded frame press propagates');
  assert.equal(original.prevented, false, 'native release/click synthesis remains available');
});

test('cell fallback clicks retain double-click detail and coordinates exactly once', () => {
  const { events, fire } = fixture();
  for (const type of ['click', 'dblclick']) {
    const original = fire(type, { detail: 2 });
    assert.equal(events.length, type === 'click' ? 1 : 2);
    const forwarded = events.at(-1);
    for (const key of ['type', 'detail', 'clientX', 'clientY', 'screenX', 'screenY', 'shiftKey'])
      assert.equal(forwarded[key], original[key], key);
    assert.equal(original.stopped, true);
    assert.equal(original.prevented, true);
  }
});

test('bodies, HUD controls, vacant cells, inert/dead enemies and secondary presses retain their own routing', () => {
  for (const type of ['pointerdown', 'click', 'dblclick']) {
    const { events, fire } = fixture();
    const hud = fire(type, { target: { closest: () => ({}) } });
    const empty = fire(type, { clientX: 900, clientY: 900 });
    assert.equal(events.length, 0);
    assert.equal(hud.stopped, false);
    assert.equal(empty.prevented, false);
    for (const state of [{ dead: true }, { inert: true }]) {
      const disabled = fixture(state);
      disabled.fire(type);
      assert.equal(disabled.events.length, 0);
    }
  }
  const { events, fire } = fixture();
  fire('pointerdown', { button: 2 });
  fire('pointerdown', { isPrimary: false });
  assert.equal(events.length, 0);
});
