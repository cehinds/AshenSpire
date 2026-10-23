// The shared layout-constants cache (src/ui/layoutMetrics.js) and the shared
// read-then-write frame pass (src/ui/layoutFrame.js). Perf pass 2026-10-19: a
// card play made ~120 forced layouts, most of them computed-style reads of the
// page zoom / rem / tokens after a style write.
import test from 'node:test';
import assert from 'node:assert/strict';

// ---- a stand-in page -------------------------------------------------------
let styleReads = 0;
let bodyZoom = '2', rootFont = '10px';
const tokens = { '--hud-tools-dy': ' 4px' };
const records = [];
let observerCallback = null;
globalThis.MutationObserver = class { constructor(cb) { observerCallback = cb; } observe() {} takeRecords() { return records.splice(0); } };
globalThis.document = { documentElement: { tag: 'html' }, body: { tag: 'body' } };
globalThis.getComputedStyle = (node) => { styleReads++; return node.tag === 'body' ? { zoom: bodyZoom, fontSize: '16px' }
  : { fontSize: rootFont, getPropertyValue: name => tokens[name] ?? '' }; };
const frames = [];
globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };

const { layoutMetrics, rootCssVar, rootStyle, invalidateLayoutMetrics } = await import('../src/ui/layoutMetrics.js');
const { scheduleLayoutPass, cancelLayoutPass } = await import('../src/ui/layoutFrame.js');

test('layoutMetrics reads computed style once and serves the cache', () => {
  invalidateLayoutMetrics(); styleReads = 0;
  const first = layoutMetrics();
  assert.deepEqual({ zoom: first.zoom, rem: first.rem, fontSize: first.fontSize }, { zoom: 2, rem: 10, fontSize: '10px' });
  const reads = styleReads;
  for (let i = 0; i < 20; i++) layoutMetrics();
  assert.equal(styleReads, reads, 'no further computed-style reads');
});

test('rem keeps the 16 physical px floor', () => {
  invalidateLayoutMetrics(); rootFont = '6px'; bodyZoom = '2';
  assert.equal(layoutMetrics().rem, 8, 'max(16 / zoom, font size)');
  rootFont = '10px';
});

test('a write to <html> or <body> not yet delivered still invalidates', () => {
  invalidateLayoutMetrics(); bodyZoom = '1'; rootFont = '10px';
  assert.equal(layoutMetrics().zoom, 1);
  bodyZoom = '3';
  assert.equal(layoutMetrics().zoom, 1, 'unchanged until a mutation is recorded');
  records.push({ type: 'attributes' });
  assert.equal(layoutMetrics().zoom, 3, 'takeRecords() saw the queued write');
  bodyZoom = '2';
});

test('the delivered observer callback invalidates too', () => {
  invalidateLayoutMetrics(); bodyZoom = '2'; layoutMetrics(); bodyZoom = '5';
  observerCallback([{ type: 'attributes' }]);
  assert.equal(layoutMetrics().zoom, 5);
  bodyZoom = '2';
});

test('rootCssVar and rootStyle cache custom properties per name', () => {
  invalidateLayoutMetrics(); styleReads = 0;
  assert.equal(rootCssVar('--hud-tools-dy'), '4px', 'trimmed');
  assert.equal(rootStyle.getPropertyValue('--hud-tools-dy'), '4px');
  assert.equal(rootCssVar('--missing'), '');
  assert.equal(styleReads, 2, 'one read per distinct name');
  tokens['--hud-tools-dy'] = ' 9px';
  assert.equal(rootCssVar('--hud-tools-dy'), '4px');
  invalidateLayoutMetrics();
  assert.equal(rootCssVar('--hud-tools-dy'), '9px');
  tokens['--hud-tools-dy'] = ' 4px';
});

test('layout passes: every read runs before any write, one frame, latest job per key wins', () => {
  frames.length = 0;
  const log = [];
  const a = {}, b = {};
  scheduleLayoutPass(a, () => { log.push('read a1'); return () => log.push('write a1'); });
  scheduleLayoutPass(a, () => { log.push('read a2'); return () => log.push('write a2'); });
  scheduleLayoutPass(b, () => { log.push('read b'); return () => log.push('write b'); });
  assert.equal(frames.length, 1, 'one animation frame for the whole batch');
  frames.shift()();
  assert.deepEqual(log, ['read a2', 'read b', 'write a2', 'write b']);
});

test('a cancelled pass never runs, and a read with nothing to write is fine', () => {
  frames.length = 0;
  const log = [], a = {}, b = {};
  scheduleLayoutPass(a, () => { log.push('read a'); return () => log.push('write a'); });
  scheduleLayoutPass(b, () => { log.push('read b'); });
  cancelLayoutPass(a);
  frames.shift()();
  assert.deepEqual(log, ['read b']);
});
