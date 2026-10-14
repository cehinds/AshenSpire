import test from 'node:test';
import assert from 'node:assert/strict';
import { mountQuitScreen } from '../src/ui/quitGame.js';

function harness(options = {}) {
  const status = { textContent: '' };
  let click, tick, cancelled, returned = 0, closes = 0;
  const back = { addEventListener: (_, fn) => { click = fn; }, focus() {} };
  const app = { innerHTML: '', querySelector: (s) => s === '#farewell-status' ? status : back };
  mountQuitScreen(app, { onBack: () => { returned++; }, closeWindow: () => { closes++; }, windowClosed: () => false,
    schedule: (fn, ms) => { assert.equal(ms, 120); tick = fn; return 4; }, cancel: (id) => { cancelled = id; }, ...options });
  return { app, status, tick: () => tick(), back: () => click(), counters: () => ({ cancelled, returned, closes }) };
}
test('a silent browser refusal is visible and the player can return', () => {
  const h = harness(); h.tick();
  assert.match(h.status.textContent, /browser kept this window open/);
  assert.doesNotMatch(h.status.textContent, /climb is saved/);
  h.back(); assert.deepEqual(h.counters(), { cancelled: 4, returned: 1, closes: 1 });
});
test('a throwing browser close has the same recoverable fallback', () => {
  const h = harness({ savedRun: true, closeWindow: () => { throw new Error('denied'); } }); h.tick();
  assert.match(h.status.textContent, /Your climb is saved/);
  assert.match(h.status.textContent, /browser kept this window open/);
});
test('desktop or script-opened close does not claim refusal', () => {
  const h = harness({ windowClosed: () => true }); h.tick();
  assert.equal(h.status.textContent, ''); assert.equal(h.counters().closes, 1);
});
test('return cancels the pending window-close attempt', () => {
  const h = harness(); h.back();
  assert.deepEqual(h.counters(), { cancelled: 4, returned: 1, closes: 0 });
});
