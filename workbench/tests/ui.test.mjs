// node --test workbench/tests/ui.test.mjs — the page's DOM-free helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fuzzyScore, fuzzyFilter, DEVICES, fitDevice, duration, manifestTables, manifestSummary, EXPORT_FORMAT, apiError, saveFailure } from '../ui/logic.mjs';

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
  assert.deepEqual(manifestTables({ tables: [{ name: 'cards', rows: 3, schema: 'cards.schema.json', json: 'cards.json' }] }), [{ name: 'cards', rows: 3, schema: 'cards.schema.json', json: 'cards.json', description: '', omitted: 0 }]);
  assert.deepEqual(manifestTables({ tables: { enemies: { rowCount: 2, dataFile: 'enemies.json' } } })[0], { name: 'enemies', rows: 2, schema: '', json: 'enemies.json', description: '', omitted: 0 });
  assert.deepEqual(manifestTables(null), []);
});

test('the engine exporter manifest (ashenspire.engine-export/1) reads as id, file, schema and rows', () => {
  const manifest = {
    format: EXPORT_FORMAT, version: '0.7.1', release: '0.7.1', buildOrdinal: 1280, gitSha: '0123456789abcdef', rowKey: 'Name',
    tables: [
      { id: 'content.cards', file: 'tables/content.cards.json', schema: 'schemas/content.cards.schema.json', rows: 292, sha256: 'x', omittedFunctions: ['0.effect'] },
      { id: 'framework.races', file: 'tables/framework.races.json', schema: 'schemas/framework.races.schema.json', rows: 8, sha256: 'y', omittedFunctions: [] },
    ],
    config: [{ id: 'content.balance', file: 'config/content.balance.json', sha256: 'z', omittedFunctions: [] }],
    art: [{ source: 'art-manifest.json', file: 'art/art-manifest.json', sha256: 'w' }],
  };
  assert.deepEqual(manifestTables(manifest)[0], { name: 'content.cards', rows: 292, schema: 'schemas/content.cards.schema.json', json: 'tables/content.cards.json', description: '', omitted: 1 });
  assert.deepEqual(manifestSummary(manifest), { format: EXPORT_FORMAT, known: true, version: '0.7.1', buildOrdinal: 1280, gitSha: '012345678', tables: 2, rows: 300, config: 1, art: 1 });
  assert.equal(manifestSummary({ format: 'other/2', tables: [] }).known, false);
  assert.equal(manifestSummary(null), null);
});

test('an API failure carries its HTTP status and parsed body', () => {
  const conflict = apiError(409, { error: 'Changed on disk', conflicts: [{ path: 'content/config/ui/a.json', hash: 'h1' }] });
  assert.ok(conflict instanceof Error);
  assert.equal(conflict.message, 'Changed on disk');
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflict.body.conflicts, [{ path: 'content/config/ui/a.json', hash: 'h1' }]);
  const bare = apiError(500, null);
  assert.equal(bare.message, 'HTTP 500', 'no body: the message is the status');
  assert.equal(bare.status, 500);
  assert.equal(bare.body, null);
  assert.equal(apiError(404, { error: 'No such file' }).message, 'No such file');
});

test('a failed save is read from the api error: 422 problems, 409 conflicts, anything else an error message', () => {
  const problems = [{ path: 'content/config/ui/scenes/w4.json', message: 'bad band' }];
  assert.deepEqual(saveFailure(Object.assign(new Error('x'), { status: 422, body: { problems } })), { kind: 'problems', problems });
  const conflicts = [{ path: 'content/config/ui/tokens.json', hash: 'h2' }];
  assert.deepEqual(saveFailure(Object.assign(new Error('x'), { status: 409, body: { conflicts } })), { kind: 'conflicts', conflicts });
  assert.deepEqual(saveFailure(new TypeError('Failed to fetch')), { kind: 'error', message: 'Failed to fetch' });
  assert.deepEqual(saveFailure(Object.assign(new Error('HTTP 500'), { status: 500, body: null })), { kind: 'error', message: 'HTTP 500' });
});
