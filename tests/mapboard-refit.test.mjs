// #1142: the map camera re-fits when the scrollport's box changes AFTER the
// first settle, not only when a window `resize` happens to arrive with it.
// `watchViewport` is the standing observer mountMapBoard starts on settle; it
// is driven here with a fake ResizeObserver and fake timers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { watchViewport } from '../src/ui/components/mapboard.js';

function harness(initial) {
  const el = { size: { ...initial } };
  const observers = [];
  class FakeRO {
    constructor(cb) { this.cb = cb; this.live = false; observers.push(this); }
    observe(target) { assert.equal(target, el); this.live = true; }
    disconnect() { this.live = false; }
  }
  const timers = new Map();
  let nextId = 1;
  const setTimer = (fn, ms) => { const id = nextId++; timers.set(id, { fn, ms }); return id; };
  const clearTimer = (id) => { timers.delete(id); };
  const flush = () => { for (const [id, t] of [...timers]) { timers.delete(id); t.fn(); } };
  const resize = (w, h) => { el.size = { width: w, height: h }; for (const o of observers) if (o.live) o.cb([]); };
  const fits = [];
  const stop = watchViewport(el, {
    read: () => ({ ...el.size }),
    onChange: (v) => fits.push(`${v.width}x${v.height}`),
    delayMs: 100, RO: FakeRO, setTimer, clearTimer,
  });
  return { el, observers, timers, flush, resize, fits, stop };
}

test('a later scrollport change re-fits once, debounced to the last size', () => {
  const h = harness({ width: 390, height: 405 });
  h.resize(390, 405); h.flush(); // the observe-time callback: no change, no fit
  assert.deepEqual(h.fits, []);
  h.resize(410, 520); h.resize(433, 600); h.resize(433, 643);
  assert.equal(h.timers.size, 1, 'a burst of observations arms one timer');
  assert.equal([...h.timers.values()][0].ms, 100);
  h.flush();
  assert.deepEqual(h.fits, ['433x643']);
  h.resize(433, 643); h.flush();
  assert.deepEqual(h.fits, ['433x643'], 'the same size again is not a change');
  h.resize(433, 300); h.flush();
  assert.deepEqual(h.fits, ['433x643', '433x300'], 'the watch is standing, not one-shot');
});

test('sub-pixel jitter within the restore tolerance does not re-fit', () => {
  const h = harness({ width: 433, height: 643 });
  h.resize(433.6, 643.8); h.flush();
  assert.deepEqual(h.fits, []);
});

test('a hidden (zero) box keeps the baseline and never fits', () => {
  const h = harness({ width: 433, height: 643 });
  h.resize(0, 0); h.flush();
  assert.deepEqual(h.fits, []);
  h.resize(433, 643); h.flush();
  assert.deepEqual(h.fits, [], 'coming back to the same size is still no change');
});

test('stop() disconnects the observer and cancels a pending fit', () => {
  const h = harness({ width: 390, height: 405 });
  h.resize(433, 643);
  assert.equal(h.timers.size, 1);
  h.stop();
  assert.equal(h.observers[0].live, false);
  assert.equal(h.timers.size, 0);
  h.flush();
  assert.deepEqual(h.fits, []);
});

test('no ResizeObserver means no watch and no throw', () => {
  const stop = watchViewport({}, { read: () => ({ width: 1, height: 1 }), onChange: () => assert.fail(), RO: null });
  assert.equal(typeof stop, 'function');
  stop();
});

// While the destination tray is open on a selected node the camera is a LOOK at
// that node (map.js: `centerOnNode(selection.selectedId, { inset })`). A later
// scrollport change re-fits the frame and must then look at the same node again
// with the same inset — re-centring on the current node dropped the selection's
// framing out from under an open tray.
import { refitCamera } from '../src/ui/components/mapboard.js';

function spyCamera() {
  const calls = [];
  return {
    calls,
    centerOnCurrent: () => calls.push('current'),
    centerOnNode: (id, opts) => calls.push(`node:${id}:${opts.inset}`),
  };
}

test('no look: a re-fit centres on the current node', () => {
  const c = spyCamera();
  refitCamera({ look: null, ...c });
  assert.deepEqual(c.calls, ['current']);
});

test('an open tray: a re-fit solves the frame, then keeps the selected node framed', () => {
  const c = spyCamera();
  refitCamera({ look: { id: 'f3c2', inset: 188 }, ...c });
  assert.deepEqual(c.calls, ['current', 'node:f3c2:188']);
});
