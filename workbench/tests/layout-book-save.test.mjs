// node --test workbench/tests/layout-book-save.test.mjs — a Book recipes edit saved through the
// Workbench file service (the same path the review dialog uses) lands byte for byte, changes only
// the edited value, and an invalid recipe is refused by the service's own checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createFileService } from '../core/files.mjs';
import * as K from '../modules/layout/book-model.mjs';
import { consumables } from '../../src/content/consumables.js';
import { BOOK_COVERS, BOOK_SYMBOLS, BOOK_TREATMENTS, BOOK_TRIMS, BOOK_PALETTE } from '../../src/content/bookArt.js';

const CATALOG = K.catalogOf({ books: consumables.filter((r) => r.kind === 'skillBook'), cover: BOOK_COVERS, symbol: BOOK_SYMBOLS, treatment: BOOK_TREATMENTS, trim: BOOK_TRIMS, palette: BOOK_PALETTE });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha = (text) => createHash('sha256').update(text).digest('hex');

async function project(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'wb-book-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src/content'), { recursive: true });
  await fs.mkdir(path.join(root, 'content'), { recursive: true });
  await fs.copyFile(path.join(ROOT, K.RECIPES_FILE), path.join(root, K.RECIPES_FILE));
  return root;
}

test('a recipe edit saved through the file service changes only its value on disk', async (t) => {
  const root = await project(t);
  const service = createFileService({ root, stateDir: path.join(root, '.wb-state') });
  const real = await fs.readFile(path.join(root, K.RECIPES_FILE), 'utf8');
  const { hash } = await service.read(K.RECIPES_FILE);
  const next = K.setRecipeField(real, 'focusTreatise', 'ink', '#ffffff', CATALOG);
  const saved = await service.save([{ path: K.RECIPES_FILE, text: next, baseHash: hash }]);
  assert.equal(saved.files[0].path, K.RECIPES_FILE);
  assert.equal(await fs.readFile(path.join(root, K.RECIPES_FILE), 'utf8'), next);
  assert.deepEqual(K.changedBooks(next, real), ['focusTreatise']);
  // The saved module is the game's: it imports, and the edited recipe is what it exports.
  const mod = await import(`${pathToFileURL(path.join(root, K.RECIPES_FILE)).href}?v=${sha(next).slice(0, 8)}`);
  assert.equal(mod.BOOK_ART_PRESETS.focusTreatise.ink, '#ffffff');
  assert.equal(mod.BOOK_ART_PRESETS.focusTreatise.color, '#346e9f', 'the other fields are unchanged');
});

test('the service refuses a recipe whose syntax the file no longer has', async (t) => {
  const root = await project(t);
  const service = createFileService({ root, stateDir: path.join(root, '.wb-state') });
  const real = await fs.readFile(path.join(root, K.RECIPES_FILE), 'utf8');
  const broken = real.replace("trim: 'arcane' },", "trim: 'arcane' ,,");
  const problems = await service.validate([{ path: K.RECIPES_FILE, kind: 'js', text: broken }]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].path, K.RECIPES_FILE);
  assert.deepEqual(await service.validate([{ path: K.RECIPES_FILE, kind: 'js', text: real }]), []);
});

test('a save against a stale hash is a conflict, and the file is left as it was', async (t) => {
  const root = await project(t);
  const service = createFileService({ root, stateDir: path.join(root, '.wb-state') });
  const real = await fs.readFile(path.join(root, K.RECIPES_FILE), 'utf8');
  const next = K.setRecipeField(real, 'focusTreatise', 'trim', 'frame', CATALOG);
  await assert.rejects(
    service.save([{ path: K.RECIPES_FILE, text: next, baseHash: 'stale' }]),
    (err) => err.status === 409,
  );
  assert.equal(await fs.readFile(path.join(root, K.RECIPES_FILE), 'utf8'), real);
});
