// node --test workbench/tests/ui.test.mjs — the page's DOM-free helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fuzzyScore, fuzzyFilter, DEVICES, fitDevice, duration, manifestTables } from '../ui/logic.mjs';

test('fuzzy matching keeps letter order and prefers word starts and whole runs', () => {
  assert.equal(fuzzyScore('xyz', 'Content Editor'), null);
  assert.ok(fuzzyScore('ce', 'Content Editor') > fuzzyScore('ce', 'Pose & FX preview'));
  const titles = ['Build & Checks', 'Content Editor', 'UI Studio', 'Reload preview', 'Engine Export'];
  assert.equal(fuzzyFilter(titles.map((title) => ({ title })), 'ui')[0].title, 'UI Studio');
  assert.equal(fuzzyFilter(titles.map((title) => ({ title })), 'rel')[0].title, 'Reload preview');
  assert.equal(fuzzyFilter(titles.map((title) => ({ title })), 'expo')[0].title, 'Engine Export');
  assert.equal(fuzzyFilter(titles.map((title) => ({ title })), '  ').length, titles.length, 'an empty query keeps everything in order');
});

test('device presets fit the stage without upscaling and stay centred', () => {
  const phone = DEVICES.find((d) => d.id === 'phone');
  assert.deepEqual([phone.width, phone.height], [390, 844]);
  const fit = fitDevice(phone, { width: 460, height: 766 });
  assert.ok(fit.scale < 1 && fit.scale > 0.8);
  assert.equal(fit.width, 390);
  assert.ok(Math.abs(fit.left - (460 - 390 * fit.scale) / 2) <= 1);
  assert.equal(fitDevice(phone, { width: 4000, height: 4000 }).scale, 1, 'never upscaled');
  const fill = fitDevice(DEVICES[0], { width: 500, height: 300 });
  assert.deepEqual([fill.width, fill.height, fill.scale], [500, 300, 1]);
});

test('formatting and a tolerant manifest reader', () => {
  assert.equal(duration(420), '420 ms');
  assert.equal(duration(5400), '5.4 s');
  assert.equal(duration(125000), '2 m 5 s');
  assert.deepEqual(manifestTables({ tables: [{ name: 'cards', rows: 3, schema: 'cards.schema.json', json: 'cards.json' }] }), [{ name: 'cards', rows: 3, schema: 'cards.schema.json', json: 'cards.json', description: '' }]);
  assert.deepEqual(manifestTables({ tables: { enemies: { rowCount: 2, dataFile: 'enemies.json' } } })[0], { name: 'enemies', rows: 2, schema: '', json: 'enemies.json', description: '' });
  assert.deepEqual(manifestTables(null), []);
});
