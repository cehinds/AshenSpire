// node --test workbench/tests/card-layers-save.test.mjs — the card layout file is one allowlisted
// JSON file. A save runs the schema check first (a bad layout is refused, nothing is written), and
// a good one lands byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { allowedKind, createFileService } from '../core/files.mjs';
import { LAYOUT_FILE } from '../modules/layout/card-layers-model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function project(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'wb-card-layers-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src/content'), { recursive: true });
  await fs.copyFile(path.join(ROOT, LAYOUT_FILE), path.join(root, LAYOUT_FILE));
  return root;
}

test('the card layout is an allowlisted JSON file, and nothing beside it is', () => {
  assert.equal(allowedKind(LAYOUT_FILE), 'json');
  assert.equal(allowedKind('src/content/card-layout.json.bak'), null);
});

test('a valid layout saves byte for byte and reads back with its hash', async (t) => {
  const root = await project(t);
  const service = createFileService({ root, stateDir: path.join(root, '.wb-state') });
  const before = await service.read(LAYOUT_FILE);
  assert.equal(before.kind, 'json');
  const edited = JSON.parse(before.text);
  edited.layers[0].rotation = 0.5;
  const text = JSON.stringify(edited, null, 2) + '\n';
  const saved = await service.save([{ path: LAYOUT_FILE, text, baseHash: before.hash }]);
  assert.equal(saved.files[0].path, LAYOUT_FILE);
  assert.equal(await fs.readFile(path.join(root, LAYOUT_FILE), 'utf8'), text);
});

test('a layout the game cannot compile is refused with the problems, and the file is untouched', async (t) => {
  const root = await project(t);
  const service = createFileService({ root, stateDir: path.join(root, '.wb-state') });
  const before = await service.read(LAYOUT_FILE);
  const broken = JSON.parse(before.text);
  broken.layers = [];
  const text = JSON.stringify(broken, null, 2) + '\n';
  const problems = await service.validate([{ path: LAYOUT_FILE, kind: 'json', text }]);
  assert.deepEqual(problems, [{ path: LAYOUT_FILE, message: 'layers must be a non-empty list' }]);
  await assert.rejects(
    service.save([{ path: LAYOUT_FILE, text, baseHash: before.hash }]),
    (err) => err.status === 422 && err.problems[0].path === LAYOUT_FILE,
  );
  assert.equal(await fs.readFile(path.join(root, LAYOUT_FILE), 'utf8'), before.text);
});

test('invalid JSON is refused before any schema check', async (t) => {
  const root = await project(t);
  const service = createFileService({ root, stateDir: path.join(root, '.wb-state') });
  const problems = await service.validate([{ path: LAYOUT_FILE, kind: 'json', text: '{"layers":' }]);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /^Invalid JSON/);
});
