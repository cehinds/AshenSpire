import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';

// A fake ResizeObserver, installed before the fitter first creates its shared one.
const observers = [];
globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; this.observed = new Set(); observers.push(this); }
  observe(n) { this.observed.add(n); } unobserve(n) { this.observed.delete(n); } };
const frames = [];
const raf = cb => { frames.push(cb); return frames.length; };
const { fitIllustratedCards } = await import('../src/ui/components/illustratedCardFitter.js');

// A zero-width face: the fit itself is skipped, only the watching is exercised.
const makeFace = () => ({ nodeType: 1, isConnected: true, clientWidth: 0, dataset: {}, querySelectorAll: () => [], querySelector: () => null });
const makeCard = face => ({ isConnected: true, fits: 0, querySelector() { return face; } });
const flush = () => { const run = frames.splice(0); run.forEach(cb => cb()); };

test('a face removed from the DOM is unobserved and released when a resize fires', () => withKitDom(() => {
  globalThis.requestAnimationFrame = raf;   // the kit DOM installs a no-op one
  const face = makeFace(), card = makeCard(face);
  fitIllustratedCards([card]);
  const ro = observers[0];
  assert.ok(ro.observed.has(face));
  face.isConnected = false;
  ro.cb([{ target: face, contentRect: { width: 0 } }]);
  assert.ok(!ro.observed.has(face), 'unobserved');
  flush();
  // Watching it again (a re-attached face) observes it afresh rather than finding a stale entry.
  face.isConnected = true;
  fitIllustratedCards([card]);
  assert.ok(ro.observed.has(face));
}));

test('a face reused by a new card refits that new card on the next resize', () => withKitDom(() => {
  globalThis.requestAnimationFrame = raf;   // the kit DOM installs a no-op one
  const face = makeFace(), oldCard = makeCard(face), newCard = makeCard(face);
  fitIllustratedCards([oldCard]);
  oldCard.isConnected = false;
  fitIllustratedCards([newCard]);                 // takeOverFace: the same face, a new card element
  const refit = [];
  newCard.querySelector = () => { refit.push('new'); return face; };
  oldCard.querySelector = () => { refit.push('old'); return face; };
  observers[0].cb([{ target: face, contentRect: { width: 100 } }]);
  flush();
  assert.deepEqual(refit, ['new']);
}));
