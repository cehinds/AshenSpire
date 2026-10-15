import test from 'node:test';
import assert from 'node:assert/strict';
import { bindCombatantInspectionGesture } from '../src/ui/components/combatantInspectionGesture.js';

function fixture(t, { selected = true } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = globalThis.window;
  const win = new EventTarget(); globalThis.window = win;
  t.after(() => { gesture.release(); globalThis.window = previous; t.mock.timers.reset(); });
  const frame = new EventTarget(); frame.isConnected = true;
  frame.closest = () => null;
  let plays = 0, inspections = 0, hud = false, live = true;
  frame.closest = selector => hud && selector.includes('.nm') ? frame : null;
  const gesture = bindCombatantInspectionGesture(frame, {
    isSelected: () => selected, canInspect: () => live, canActivate: () => live,
    open: () => inspections++, activate: () => plays++, holdMs: 600, movePx: 8,
  });
  function emit(target, type, attrs = {}) {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({ pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0, button: 0, detail: 1, ...attrs })) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event); return event;
  }
  return { frame, win, emit, gesture, hud: value => { hud = value; }, live: value => { live = value; },
    selected: value => { selected = value; }, counts: () => ({ plays, inspections }), tick: ms => t.mock.timers.tick(ms) };
}

test('selected armed double click inspects without dispatching a play', t => {
  const f = fixture(t);
  assert.equal(f.emit(f.frame, 'click').defaultPrevented, true);
  f.tick(100);
  f.emit(f.frame, 'click', { detail: 2 }); f.emit(f.frame, 'dblclick', { detail: 2 });
  f.tick(500);
  assert.deepEqual(f.counts(), { plays: 0, inspections: 1 });
});
test('selected genuine single click activates exactly once after the bounded window', t => {
  const f = fixture(t); f.emit(f.frame, 'click'); f.tick(499);
  assert.equal(f.counts().plays, 0); f.tick(1); f.tick(400);
  assert.equal(f.counts().plays, 1);
});
test('HUD click and keyboard inspection cancel pending activation', t => {
  const f = fixture(t); f.emit(f.frame, 'click'); f.hud(true);
  f.emit(f.frame, 'click'); f.emit(f.frame, 'keydown', { key: 'Enter' }); f.tick(700);
  assert.deepEqual(f.counts(), { plays: 0, inspections: 2 });
});
test('stationary hold inspects and consumes its trailing click', t => {
  const f = fixture(t); f.emit(f.frame, 'pointerdown'); f.tick(600);
  f.emit(f.win, 'pointerup'); f.emit(f.frame, 'click'); f.tick(500);
  assert.deepEqual(f.counts(), { plays: 0, inspections: 1 });
});
for (const reason of ['movement', 'pointercancel', 'scroll', 'blur', 'second touch', 'release']) {
  test(`hold cancels on ${reason} and never opens later`, t => {
    const f = fixture(t); f.emit(f.frame, 'pointerdown'); f.tick(200);
    if (reason === 'movement') f.emit(f.win, 'pointermove', { clientX: 20 });
    if (reason === 'pointercancel') f.emit(f.win, 'pointercancel');
    if (reason === 'scroll') f.emit(f.win, 'scroll');
    if (reason === 'blur') f.emit(f.win, 'blur');
    if (reason === 'second touch') f.emit(f.win, 'pointerdown', { pointerId: 2 });
    if (reason === 'release') f.gesture.release();
    f.tick(1000); assert.deepEqual(f.counts(), { plays: 0, inspections: 0 });
  });
}
test('deferred activation rechecks live state and cancel invalidates it', t => {
  const f = fixture(t); f.emit(f.frame, 'click'); f.live(false); f.tick(500);
  assert.equal(f.counts().plays, 0); f.live(true); f.emit(f.frame, 'click'); f.gesture.cancel(); f.tick(500);
  assert.equal(f.counts().plays, 0);
});
test('unselected single click remains immediate through existing target handler', t => {
  const f = fixture(t, { selected: false });
  assert.equal(f.emit(f.frame, 'click').defaultPrevented, false);
  f.tick(500); assert.deepEqual(f.counts(), { plays: 0, inspections: 0 });
});


test('a second press cancels pending single activation before a hold completes', t => {
  const f = fixture(t); f.emit(f.frame, 'click'); f.tick(300);
  f.emit(f.frame, 'pointerdown'); f.tick(600); f.emit(f.win, 'pointerup'); f.emit(f.frame, 'click'); f.tick(700);
  assert.deepEqual(f.counts(), { plays: 0, inspections: 1 });
});
