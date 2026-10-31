import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { rewardDom } from './helpers/reward-dom.mjs';

// Run the actual hold and pointer-lifecycle owners. Only DOM and the animation
// clock are replaced; pointerdown/move/up/cancel drive the production handlers.
function fixture(options = {}) {
  const holdSource = readFileSync(new URL('../src/ui/components/holdconfirm.js', import.meta.url), 'utf8');
  const start = holdSource.indexOf('export function armHold('), end = holdSource.indexOf('\n// ---------------------------------------------------------------------------', start);
  const gestureSource = readFileSync(new URL('../src/ui/gesture.js', import.meta.url), 'utf8');
  const gestureStart = gestureSource.indexOf('export function armPress(');
  assert.ok(start >= 0 && end > start && gestureStart >= 0);
  const dom = rewardDom(), frames = new Map(), taps = [], confirms = [];
  let now = 0, serial = 0, release;
  const scope = { ...dom, performance: { now: () => now }, SLOP: 12, SETTLE_SLOP: 8,
    PRESS_EVENT: 'gppress', RELEASE_EVENT: 'gprelease', t: value => value,
    requestAnimationFrame: fn => { frames.set(++serial, fn); return serial; },
    cancelAnimationFrame: id => frames.delete(id), setTimeout, clearTimeout,
  };
  const source = gestureSource.slice(gestureStart) + '\n' + holdSource.slice(start, end);
  const armHold = runInNewContext(source.replaceAll('export function ', 'function ') + '\narmHold', scope);
  const button = dom.document.createElement('button'); dom.document.body.append(button);
  const bind = overrides => {
    release?.();
    release = armHold(button, { ms: 600, tapOnEarlyRelease: true, tapOnPointerRelease: true,
      showHint: false, onTap: () => taps.push('tap'), onConfirm: () => confirms.push('confirm'), ...options, ...overrides });
  };
  bind();
  const emit = (type, fields = {}) => {
    const target = ['pointerup', 'pointercancel', 'pointermove'].includes(type) ? dom.window : button;
    const event = new dom.Event(type, { bubbles: true, cancelable: true, detail: type === 'click' ? 1 : 0,
      pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 10, clientY: 10, ...fields });
    target.dispatchEvent(event); return event;
  };
  const advance = ms => { now += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now)); };
  return { emit, advance, bind, taps, confirms, dispose: () => release() };
}

test('a fresh release-owned binding ignores a native click without its pointer press', () => {
  const f = fixture();
  try {
    assert.equal(f.emit('click').defaultPrevented, true);
    assert.deepEqual(f.taps, []); assert.deepEqual(f.confirms, []);
    f.emit('click', { detail: 0 }); assert.deepEqual(f.taps, ['tap'], 'keyboard/controller synthetic activation remains available');
  } finally { f.dispose(); }
});

test('a card rebound during pointer release does not consume the trailing click as another action', () => {
  const f = fixture();
  try {
    f.bind({ onTap: () => { f.taps.push('tap'); f.bind(); } });
    f.emit('pointerdown'); f.advance(100); f.emit('pointerup');
    assert.deepEqual(f.taps, ['tap']);
    assert.equal(f.emit('click').defaultPrevented, true);
    assert.deepEqual(f.taps, ['tap']); assert.deepEqual(f.confirms, []);
    f.emit('pointerdown'); f.advance(100); f.emit('pointerup'); f.emit('click');
    assert.deepEqual(f.taps, ['tap', 'tap'], 'a genuinely new pointer press still works after rebinding');
    assert.deepEqual(f.confirms, []);
  } finally { f.dispose(); }
});

test('a normal press, early release and native click invoke onTap exactly once', () => {
  const f = fixture();
  try {
    f.emit('pointerdown'); f.advance(100); f.emit('pointerup'); f.emit('click');
    assert.deepEqual(f.taps, ['tap']); assert.deepEqual(f.confirms, []);
  } finally { f.dispose(); }
});

test('a completed hold and its release click invoke onConfirm exactly once', () => {
  const f = fixture();
  try {
    f.emit('pointerdown'); f.advance(600); f.emit('pointerup'); f.emit('click');
    assert.deepEqual(f.confirms, ['confirm']); assert.deepEqual(f.taps, []);
  } finally { f.dispose(); }
});

test('the off setting still delivers one tap on release and consumes the click', () => {
  const f = fixture({ ms: 0 });
  try {
    f.emit('pointerdown'); f.emit('pointerup'); f.emit('click');
    assert.deepEqual(f.taps, ['tap']); assert.deepEqual(f.confirms, []);
  } finally { f.dispose(); }
});

for (const cancel of ['movement', 'pointercancel', 'carddragstart']) test(`${cancel} never becomes a card action`, () => {
  const f = fixture();
  try {
    f.emit('pointerdown');
    if (cancel === 'movement') f.emit('pointermove', { clientX: 40 });
    else f.emit(cancel);
    f.advance(700);
    // A browser pointercancel has no subsequent pointerup/click. Drag/movement
    // may retain a native release click, which the existing abort guard owns.
    if (cancel !== 'pointercancel') { f.emit('pointerup'); f.emit('click'); }
    assert.deepEqual(f.taps, []); assert.deepEqual(f.confirms, []);
    f.bind(); f.emit('click', { detail: 0 });
    assert.deepEqual(f.taps, ['tap'], 'a later keyboard/controller activation is independent');
  } finally { f.dispose(); }
});

test('ordinary controls retain their click fallback when release ownership is off', () => {
  const f = fixture({ tapOnPointerRelease: false });
  try {
    f.emit('click'); assert.deepEqual(f.confirms, ['confirm']); assert.deepEqual(f.taps, []);
  } finally { f.dispose(); }
});
