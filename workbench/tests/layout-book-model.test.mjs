// node --test workbench/tests/layout-book-model.test.mjs — Layout Studio's Book recipes model
// against the game's real file (src/content/bookArtPresets.js): the file parses, a value edit
// changes only its own quoted value, and an unedited file comes back byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from '../modules/layout/book-model.mjs';
import { consumables } from '../../src/content/consumables.js';
import { BOOK_ART_PRESETS } from '../../src/content/bookArtPresets.js';
import { BOOK_COVERS, BOOK_SYMBOLS, BOOK_TREATMENTS, BOOK_TRIMS, BOOK_PALETTE, bookArtProblems } from '../../src/content/bookArt.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const real = readFileSync(join(ROOT, B.RECIPES_FILE), 'utf8');
const lines = (t) => t.split('\n');
// The game's own catalog, as the render page sends it to the Workbench.
const CATALOG = B.catalogOf({ books: consumables.filter((r) => r.kind === 'skillBook'), cover: BOOK_COVERS, symbol: BOOK_SYMBOLS, treatment: BOOK_TREATMENTS, trim: BOOK_TRIMS, palette: BOOK_PALETTE });
const differingLines = (a, b) => lines(a).map((l, i) => (l === lines(b)[i] ? -1 : i)).filter((i) => i >= 0);

test('the game\'s real recipe file parses, and every recipe is valid', () => {
  const parsed = B.parseRecipes(real);
  assert.deepEqual(B.fileProblems(real, CATALOG), []);
  assert.deepEqual(parsed.ids, Object.keys(BOOK_ART_PRESETS));
  for (const id of parsed.ids) assert.deepEqual(parsed.data[id], BOOK_ART_PRESETS[id], `${id} matches the game module`);
});

test('every skill book in the game has a recipe in the file', () => {
  const books = consumables.filter((row) => row.kind === 'skillBook').map((row) => row.id);
  const parsed = B.parseRecipes(real);
  for (const id of books) assert.ok(parsed.data[id], `${id} has a recipe`);
});

test('an unedited file is returned byte for byte, and so is a no-op edit', () => {
  const same = B.setRecipeField(real, 'spellbook', 'color', BOOK_ART_PRESETS.spellbook.color, CATALOG);
  assert.equal(same, real);
  assert.deepEqual(B.changedBooks(same, real), []);
});

test('a colour edit changes one line and one quoted value', () => {
  const next = B.setRecipeField(real, 'spellbook', 'color', '#112233', CATALOG);
  const diff = differingLines(next, real);
  assert.equal(diff.length, 1);
  assert.match(lines(next)[diff[0]], /^ {2}spellbook: \{ cover: 'scholar', color: '#112233', symbol: 'spell', treatment: 'solid', ink: '#efccff', trim: 'arcane' \},$/);
  assert.deepEqual(B.changedBooks(next, real), ['spellbook']);
  assert.equal(next.length, real.length, 'same-length hex keeps the file size');
});

test('a choice edit (cover, symbol, treatment, trim) keeps the rest of the recipe', () => {
  const next = B.setRecipeField(real, 'bladeManual', 'treatment', 'seal', CATALOG);
  assert.equal(B.parseRecipes(next).data.bladeManual.treatment, 'seal');
  assert.deepEqual({ ...B.parseRecipes(next).data.bladeManual, treatment: 'solid' }, BOOK_ART_PRESETS.bladeManual);
  assert.deepEqual(differingLines(next, real).length, 1);
  assert.equal(B.revertRecipe(next, real, 'bladeManual'), real);
});

test('the last recipe in the file (no trailing comma) is editable too', () => {
  const next = B.setRecipeField(real, 'heraldClassBook', 'ink', '#ffffff', CATALOG);
  assert.equal(B.parseRecipes(next).data.heraldClassBook.ink, '#ffffff');
  assert.equal(B.revertRecipe(next, real, 'heraldClassBook'), real);
});

test('the model checks a recipe the way the game does, and imports nothing from the game', () => {
  for (const id of Object.keys(BOOK_ART_PRESETS)) {
    assert.deepEqual(B.recipeProblems(BOOK_ART_PRESETS[id], CATALOG), bookArtProblems(BOOK_ART_PRESETS[id]), `${id} agrees with bookArt.js`);
  }
  const bad = { ...BOOK_ART_PRESETS.spellbook, cover: 'gold', color: 'red', extra: 1 };
  assert.deepEqual(B.recipeProblems(bad, CATALOG), bookArtProblems(bad));
  // The Workbench origin cannot import /src/*, so the model must stay free of game imports.
  const source = readFileSync(join(ROOT, 'workbench/modules/layout/book-model.mjs'), 'utf8');
  assert.doesNotMatch(source, /from '[./]*src\//);
});

test('invalid edits are refused and the text is never changed', () => {
  assert.throws(() => B.setRecipeField(real, 'spellbook', 'cover', 'gold', CATALOG), /Unknown cover/);
  assert.throws(() => B.setRecipeField(real, 'spellbook', 'color', '#12345', CATALOG), /six-digit/);
  assert.throws(() => B.setRecipeField(real, 'spellbook', 'color', "#11'2233", CATALOG), /quotes/);
  assert.throws(() => B.setRecipeField(real, 'nope', 'cover', 'classic', CATALOG), /Unknown book/);
  assert.throws(() => B.setRecipeField(real, 'spellbook', 'name', 'x', CATALOG), /Unknown field/);
  assert.throws(() => B.setRecipeField(real, 'spellbook', 'color', '#112233', B.catalogOf({})), /catalog is not loaded/);
});

test('reverting a book restores only that book, and other edits stay', () => {
  let text = B.setRecipeField(real, 'spellbook', 'color', '#112233', CATALOG);
  text = B.setRecipeField(text, 'rogueClassBook', 'trim', 'frame', CATALOG);
  assert.deepEqual(B.changedBooks(text, real).sort(), ['rogueClassBook', 'spellbook']);
  const back = B.revertRecipe(text, real, 'spellbook');
  assert.deepEqual(B.changedBooks(back, real), ['rogueClassBook']);
  assert.equal(B.revertRecipe(back, real, 'rogueClassBook'), real);
});

test('a file without the recipe header is refused, not parsed', () => {
  assert.throws(() => B.parseRecipes('export const OTHER = {};\n'), /BOOK_ART_PRESETS was not found/);
  assert.deepEqual(B.fileProblems('export const OTHER = {};\n').length, 1);
});

test('the render page is found on the game server, and only a running server counts', () => {
  assert.equal(B.gameBaseOf([{ id: 'game', status: 'up', url: 'http://127.0.0.1:4320' }]), 'http://127.0.0.1:4320/');
  assert.equal(B.gameBaseOf([{ id: 'game', status: 'starting', url: 'http://127.0.0.1:4320' }]), null);
  assert.equal(B.gameBaseOf([]), null);
  assert.equal(B.renderUrl('http://127.0.0.1:4320/', { parentOrigin: 'http://127.0.0.1:4300' }),
    'http://127.0.0.1:4320/workbench/modules/layout/book-render.html?po=http%3A%2F%2F127.0.0.1%3A4300');
});

test('the catalog keeps only the lists the game sent, and editing needs all four choices', () => {
  const partial = B.catalogOf({ cover: ['classic'], books: [{ id: 'x' }] });
  assert.equal(B.catalogReady(partial), false);
  assert.deepEqual(partial.books, [{ id: 'x', name: 'x' }]);
  assert.equal(B.catalogReady(CATALOG), true);
});
