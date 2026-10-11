// node --test workbench/tests/review-model.test.mjs — the Visual Review model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCREENS, DEVICES, screenById, deviceById, captureFile, rowsFor,
  diffPixels, diffImage, judge, percentLabel, DEFAULT_TOLERANCE,
  filterRows, summarizeRows, parseDeepLink, deepLinkOf,
} from '../modules/review/model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** A synthetic RGBA image: `px` is a list of [r,g,b,a] in reading order. */
const img = (width, px) => ({ width, height: px.length / width, data: Uint8ClampedArray.from(px.flat()) });
const grey = (n, v = 10) => Array.from({ length: n }, () => [v, v, v, 255]);

test('the screen list is the ?shot= table of tools/screenshot.mjs, name for name and query for query', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools/screenshot.mjs'), 'utf8');
  const table = [...src.matchAll(/\{ name: '([^']+)', query: '([^']+)'/g)].map((m) => [m[1], m[2]]);
  assert.ok(table.length >= 20, 'the SHOTS table is found');
  assert.deepEqual(SCREENS.map((s) => [s.id, s.query]), table);
});

test('device presets are the three review shapes, with the desk at 1280x800 and the phone at 390x844', () => {
  assert.deepEqual(DEVICES.map((d) => d.id), ['desk', 'tablet', 'phone']);
  assert.deepEqual([deviceById('desk').width, deviceById('desk').height], [1280, 800]);
  assert.deepEqual([deviceById('phone').width, deviceById('phone').height], [390, 844]);
  assert.equal(deviceById('watch'), null);
  assert.equal(screenById('nope'), null);
});

test('capture file names are device-screen.png, and rows are one per screen x device, screen-major', () => {
  assert.equal(captureFile('phone', 'boss-intro'), 'phone-boss-intro.png');
  const rows = rowsFor(SCREENS.slice(0, 2), DEVICES);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.slice(0, 3).map((r) => r.key), ['desk/startup', 'tablet/startup', 'phone/startup']);
  assert.equal(rows[5].file, 'phone-title.png');
});

test('diffPixels counts changed pixels on a 4x2 image: one pixel off in eight is 12.5%', () => {
  const a = img(4, grey(8));
  const b = img(4, grey(8).map((p, i) => (i === 3 ? [200, 10, 10, 255] : p)));
  const s = diffPixels(a, b);
  assert.deepEqual({ total: s.total, changed: s.changed, percent: s.percent, sizeMismatch: s.sizeMismatch }, { total: 8, changed: 1, percent: 12.5, sizeMismatch: false });
});

test('diffPixels ignores a channel gap within the tolerance, and counts one beyond it', () => {
  const a = img(2, grey(2, 100));
  const near = img(2, grey(2, 100 + DEFAULT_TOLERANCE));
  const far = img(2, grey(2, 100 + DEFAULT_TOLERANCE + 1));
  assert.equal(diffPixels(a, near).changed, 0);
  assert.equal(diffPixels(a, far).changed, 2);
  assert.equal(diffPixels(a, far, { tolerance: 0 }).changed, 2);
  assert.equal(diffPixels(a, near, { tolerance: 0 }).changed, 2);
});

test('diffPixels reads the alpha channel too, and identical images have no change', () => {
  const a = img(2, [[1, 2, 3, 255], [4, 5, 6, 255]]);
  assert.equal(diffPixels(a, img(2, [[1, 2, 3, 255], [4, 5, 6, 255]])).percent, 0);
  assert.equal(diffPixels(a, img(2, [[1, 2, 3, 255], [4, 5, 6, 0]])).changed, 1);
});

test('diffPixels on two images of different sizes is a size change, one hundred percent', () => {
  const s = diffPixels(img(2, grey(2)), img(4, grey(4)));
  assert.deepEqual({ sizeMismatch: s.sizeMismatch, percent: s.percent, changed: s.changed }, { sizeMismatch: true, percent: 100, changed: null });
  assert.equal(diffImage(img(2, grey(2)), img(4, grey(4))), null);
  assert.equal(judge(s).status, 'size');
  assert.equal(judge(s).changed, true);
});

test('diffImage paints a changed pixel red and an unchanged one as a faded grey of the current image', () => {
  const a = img(2, [[0, 0, 0, 255], [255, 255, 255, 255]]);
  const b = img(2, [[0, 0, 0, 255], [0, 255, 255, 255]]);
  const out = diffImage(a, b);
  assert.deepEqual([...out.data.slice(0, 4)], [178, 178, 178, 255]);
  assert.deepEqual([...out.data.slice(4, 8)], [255, 0, 80, 255]);
  assert.equal(out.width, 2);
  assert.equal(out.height, 1);
});

test('judge flags a screen only when its changed share is over the threshold', () => {
  assert.equal(judge({ percent: 0.04, sizeMismatch: false }, { thresholdPercent: 0.05 }).status, 'unchanged');
  assert.equal(judge({ percent: 0.05, sizeMismatch: false }, { thresholdPercent: 0.05 }).changed, false);
  assert.equal(judge({ percent: 0.06, sizeMismatch: false }, { thresholdPercent: 0.05 }).status, 'changed');
  assert.equal(judge(null).status, 'none');
});

const row = (screen, device, extra = {}) => ({ key: `${device}/${screen}`, screen, device, hasCapture: true, hasBaseline: true, changed: false, ...extra });

test('filters: changed only, by screen and by device, combined', () => {
  const rows = [
    row('title', 'desk', { changed: true }),
    row('title', 'phone', { changed: false }),
    row('map', 'desk', { changed: true }),
    row('map', 'phone', { changed: null, hasBaseline: false }),
  ];
  assert.deepEqual(filterRows(rows).length, 4);
  assert.deepEqual(filterRows(rows, { changedOnly: true }).map((r) => r.key), ['desk/title', 'desk/map']);
  assert.deepEqual(filterRows(rows, { screen: 'title' }).map((r) => r.key), ['desk/title', 'phone/title']);
  assert.deepEqual(filterRows(rows, { device: 'phone' }).map((r) => r.key), ['phone/title', 'phone/map']);
  assert.deepEqual(filterRows(rows, { changedOnly: true, device: 'desk', screen: 'map' }).map((r) => r.key), ['desk/map']);
  assert.deepEqual(filterRows(rows, { screen: 'nope' }), []);
});

test('summarizeRows counts changed, unchanged, unbaselined and uncaptured rows', () => {
  const rows = [
    row('a', 'desk', { changed: true }),
    row('a', 'tablet', { changed: false }),
    row('b', 'desk', { changed: null, hasBaseline: false }),
    row('b', 'tablet', { changed: null, hasCapture: false, hasBaseline: false }),
  ];
  assert.deepEqual(summarizeRows(rows), { total: 4, changed: 1, unchanged: 1, noBaseline: 1, noCapture: 1 });
});

test('the deep link reads screen and device, drops unknown values, and round-trips', () => {
  assert.deepEqual(parseDeepLink({ screen: 'title', device: 'phone' }), { screen: 'title', device: 'phone' });
  assert.deepEqual(parseDeepLink({ screen: 'nope', device: 'watch' }), { screen: null, device: null });
  assert.deepEqual(parseDeepLink({}), { screen: null, device: null });
  assert.deepEqual(deepLinkOf({ screen: 'map', device: null }), { screen: 'map' });
  assert.deepEqual(deepLinkOf({ screen: 'bogus', device: 'tablet' }), { device: 'tablet' });
  assert.deepEqual(deepLinkOf(parseDeepLink({ screen: 'shop', device: 'desk' })), { screen: 'shop', device: 'desk' });
});

test('percentLabel shows 0%, <0.01% for a trace, and two places otherwise', () => {
  assert.deepEqual([percentLabel(0), percentLabel(0.004), percentLabel(12.5), percentLabel(NaN)], ['0%', '<0.01%', '12.50%', '0%']);
});
