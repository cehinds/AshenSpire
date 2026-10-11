// node --test workbench/tests/review-model.test.mjs — the Visual Review model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREENS, DEVICES, screenById, deviceById, captureFile, rowsFor } from '../modules/review/model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

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
