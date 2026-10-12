import test from 'node:test';
import assert from 'node:assert/strict';
import { wireCombatLayout } from '../src/ui/components/combatLayout.js';

// A fake DOM for wireCombatLayout: one root element, a documentElement that
// carries data-form-factor, and observers that record what they watch. The
// form-factor observer is driven the way a browser drives it: setting the
// attribute delivers to every live observer whose attributeFilter names it.

const ORIGINAL = {};
const GLOBALS = ['document', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', 'MutationObserver'];

let frames = [];
let mutationObservers = [];
let resizeObservers = [];
let documentElement;

function element(extra = {}) {
  const props = {};
  return {
    isConnected: true,
    dataset: {},
    clientWidth: 1200,
    clientHeight: 730,
    props,
    style: { setProperty(key, value) { props[key] = value; } },
    getBoundingClientRect: () => ({ width: 1200, height: 730 }),
    querySelector: () => null,
    ...extra,
  };
}

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; this.options = null; this.connected = false; mutationObservers.push(this); }
  observe(target, options) { this.target = target; this.options = options; this.connected = true; }
  disconnect() { this.connected = false; }
  takeRecords() { return []; }
}

class FakeResizeObserver {
  constructor(callback) { this.callback = callback; this.connected = false; resizeObservers.push(this); }
  observe() { this.connected = true; }
  unobserve() {}
  disconnect() { this.connected = false; }
}

// Sets the root attribute and delivers the mutation to each connected observer
// that filters on it, as a browser would.
function setFormFactor(value) {
  documentElement.dataset.formFactor = value;
  for (const mo of mutationObservers) {
    if (!mo.connected) continue;
    const filter = mo.options?.attributeFilter || [];
    if (mo.options?.attributes && filter.includes('data-form-factor')) mo.callback([{ type: 'attributes', attributeName: 'data-form-factor' }], mo);
  }
}

function flushFrames() {
  const pending = frames;
  frames = [];
  for (const [, fn] of pending) fn(0);
}

function installFakes() {
  for (const key of GLOBALS) ORIGINAL[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  documentElement = { dataset: {} };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement } });
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: () => ({ fontSize: '16px', paddingLeft: '0px', paddingRight: '0px' }) });
  let nextId = 1;
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (fn) => { const id = nextId++; frames.push([id, fn]); return id; } });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: (id) => { frames = frames.filter(([i]) => i !== id); } });
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: FakeResizeObserver });
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: FakeMutationObserver });
}

function restoreFakes() {
  for (const key of GLOBALS) {
    if (ORIGINAL[key]) Object.defineProperty(globalThis, key, ORIGINAL[key]);
    else delete globalThis[key];
  }
}

function withFakes(fn) {
  installFakes();
  try { return fn(); } finally { restoreFakes(); frames = []; mutationObservers = []; resizeObservers = []; }
}

test('wireCombatLayout watches data-form-factor on the root and mirrors it on mount', () => withFakes(() => {
  documentElement.dataset.formFactor = 'tablet';
  const combatEl = element();
  const layout = wireCombatLayout(combatEl);
  const formObserver = mutationObservers.find(mo => mo.options?.attributeFilter?.includes('data-form-factor'));
  assert.ok(formObserver, 'a form-factor MutationObserver is attached');
  assert.equal(formObserver.target, documentElement);
  assert.deepEqual(formObserver.options, { attributes: true, attributeFilter: ['data-form-factor'] });
  assert.equal(combatEl.dataset.formFactor, 'tablet');
  layout.release();
}));

test('a form-factor change from tablet to desktop re-runs apply, updating the mirror and the plan', () => withFakes(() => {
  documentElement.dataset.formFactor = 'tablet';
  const combatEl = element();
  const layout = wireCombatLayout(combatEl);
  assert.equal(combatEl.dataset.formFactor, 'tablet');
  flushFrames();

  setFormFactor('desktop');
  assert.equal(frames.length, 1, 'the change schedules one frame');
  assert.equal(combatEl.dataset.formFactor, 'tablet', 'nothing is written until the frame runs');
  flushFrames();
  assert.equal(combatEl.dataset.formFactor, 'desktop', 'the mirror follows the root');

  // The plan matches a fresh mount at desktop, so the bands were recomputed.
  const fresh = element();
  documentElement.dataset.formFactor = 'desktop';
  const freshLayout = wireCombatLayout(fresh);
  assert.deepEqual(combatEl.props, fresh.props, 'bands and overlay geometry match a desktop mount');
  freshLayout.release();
  layout.release();
}));

test('an attribute change does not schedule apply twice while a frame is pending', () => withFakes(() => {
  documentElement.dataset.formFactor = 'tablet';
  const layout = wireCombatLayout(element());
  flushFrames();
  setFormFactor('desktop');
  setFormFactor('widescreen');
  assert.equal(frames.length, 1);
  flushFrames();
  layout.release();
}));

test('release disconnects the form-factor observer with the resize observer', () => withFakes(() => {
  documentElement.dataset.formFactor = 'tablet';
  const combatEl = element();
  const layout = wireCombatLayout(combatEl);
  const formObserver = mutationObservers[mutationObservers.length - 1];
  const resize = resizeObservers[resizeObservers.length - 1];
  assert.equal(formObserver.connected, true);
  assert.equal(resize.connected, true);

  layout.release();
  assert.equal(formObserver.connected, false, 'form-factor observer disconnected');
  assert.equal(resize.connected, false, 'resize observer disconnected');

  // After teardown a form-factor change schedules nothing and writes nothing.
  setFormFactor('desktop');
  assert.equal(frames.length, 0);
  assert.equal(combatEl.dataset.formFactor, 'tablet');
}));

test('release cancels a pending frame so a late apply cannot run', () => withFakes(() => {
  documentElement.dataset.formFactor = 'tablet';
  const combatEl = element();
  const layout = wireCombatLayout(combatEl);
  flushFrames();
  setFormFactor('desktop');
  assert.equal(frames.length, 1);
  layout.release();
  assert.equal(frames.length, 0, 'the pending frame is cancelled');
  assert.equal(combatEl.dataset.formFactor, 'tablet');
}));
