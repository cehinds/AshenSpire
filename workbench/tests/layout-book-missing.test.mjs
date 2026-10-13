// node --test workbench/tests/layout-book-missing.test.mjs — a Book recipe the file lacks a field
// for (no color, no ink) parses without a crash, its problems are the game's own, the user can add
// the value they choose, and a revert takes an added field back out. Nothing is written by default.
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
const CATALOG = B.catalogOf({ books: consumables.filter((r) => r.kind === 'skillBook'), cover: BOOK_COVERS, symbol: BOOK_SYMBOLS, treatment: BOOK_TREATMENTS, trim: BOOK_TRIMS, palette: BOOK_PALETTE });
const lines = (t) => t.split('\n');
const withoutColor = () => { const r = { ...BOOK_ART_PRESETS.spellbook }; delete r.color; return r; };

/** The file with one book's fields dropped from its line, as the file would read if the field were absent. */
function without(text, id, fields) {
  return lines(text).map((l) => {
    if (!l.startsWith(`  ${id}: { `)) return l;
    const body = l.slice(`  ${id}: { `.length).replace(/ \},?$/, '');
    const kept = body.split(', ').filter((f) => !fields.some((k) => f.startsWith(`${k}: `)));
    return `  ${id}: { ${kept.join(', ')} }${l.endsWith(',') ? ',' : ''}`;
  }).join('\n');
}

test('a recipe with no color parses, reports the game\'s problem, and has no color key', () => {
  const text = without(real, 'spellbook', ['color']);
  const parsed = B.parseRecipes(text);
  assert.equal('color' in parsed.data.spellbook, false, 'nothing is invented for the missing field');
  assert.equal(parsed.data.spellbook.cover, BOOK_ART_PRESETS.spellbook.cover);
  assert.deepEqual(B.recipeProblems(parsed.data.spellbook, CATALOG), bookArtProblems(parsed.data.spellbook));
  assert.ok(B.recipeProblems(parsed.data.spellbook, CATALOG).includes('color must be a six-digit hex color.'));
  assert.deepEqual(B.fileProblems(text, CATALOG), ['spellbook: color must be a six-digit hex color.']);
});

test('a recipe with no ink parses, and its problem is listed', () => {
  const text = without(real, 'rogueClassBook', ['ink']);
  assert.equal('ink' in B.parseRecipes(text).data.rogueClassBook, false);
  assert.deepEqual(B.fileProblems(text, CATALOG), ['rogueClassBook: ink must be a six-digit hex color.']);
});

test('the user adds the missing colour, and only that value is written', () => {
  const text = without(real, 'spellbook', ['color']);
  const next = B.setRecipeField(text, 'spellbook', 'color', '#112233', CATALOG);
  const parsed = B.parseRecipes(next);
  assert.equal(parsed.data.spellbook.color, '#112233');
  assert.deepEqual(B.fileProblems(next, CATALOG), []);
  const changed = lines(next).map((l, i) => (l === lines(text)[i] ? -1 : i)).filter((i) => i >= 0);
  assert.equal(changed.length, 1, 'one line changes');
  assert.deepEqual(B.changedBooks(next, text), ['spellbook']);
});

test('a missing ink is added the same way, and reverting takes it back out', () => {
  const text = without(real, 'spellbook', ['ink']);
  const next = B.setRecipeField(text, 'spellbook', 'ink', '#ffffff', CATALOG);
  assert.equal(B.parseRecipes(next).data.spellbook.ink, '#ffffff');
  assert.equal(B.revertRecipe(next, text, 'spellbook'), text, 'the saved copy has no ink, so revert removes it');
});

test('a recipe with no fields at all takes the user\'s first value', () => {
  const text = without(real, "spellbook", ["cover", "color", "symbol", "treatment", "ink", "trim"]);
  assert.deepEqual(B.parseRecipes(text).data.spellbook, {});
  const next = B.setRecipeField(text, 'spellbook', 'color', '#112233', CATALOG);
  assert.equal(B.parseRecipes(next).data.spellbook.color, '#112233');
  assert.equal(B.revertRecipe(next, text, 'spellbook'), text);
});

test('reverting a book whose saved copy has a field the draft lost puts it back', () => {
  const draft = without(real, 'spellbook', ['trim']);
  const back = B.revertRecipe(draft, real, 'spellbook');
  assert.equal(B.parseRecipes(back).data.spellbook.trim, BOOK_ART_PRESETS.spellbook.trim);
  assert.equal(back, real);
});

test('a recipe missing two colours takes one, and the other is still listed as a problem', () => {
  const text = without(real, 'spellbook', ['color', 'ink']);
  const next = B.setRecipeField(text, 'spellbook', 'color', '#112233', CATALOG);
  assert.equal(B.parseRecipes(next).data.spellbook.color, '#112233');
  assert.deepEqual(B.fileProblems(next, CATALOG), ['spellbook: ink must be a six-digit hex color.']);
});

test('a value is checked on its own, with the same words as the recipe check', () => {
  assert.deepEqual(B.fieldProblems('cover', 'gold', CATALOG), ['Unknown cover: gold']);
  assert.deepEqual(B.fieldProblems('ink', '#12345', CATALOG), ['ink must be a six-digit hex color.']);
  assert.deepEqual(B.fieldProblems('ink', '#12345G', CATALOG), B.recipeProblems({ ...BOOK_ART_PRESETS.spellbook, ink: '#12345G' }, CATALOG).filter((p) => p.startsWith('ink')));
  assert.deepEqual(B.fieldProblems('trim', 'frame', CATALOG), []);
});

test('the render page draws only complete recipes, and lists the rest instead of throwing', () => {
  // book-render.mjs needs the page DOM, so this suite checks its source: every drawing call is behind the guard.
  const src = readFileSync(join(ROOT, 'workbench/modules/layout/book-render.mjs'), 'utf8');
  assert.match(src, /const drawable = \(recipe\) => Boolean\(recipe\) && recipeProblems\(recipe, catalog\)\.length === 0;/);
  assert.match(src, /const complete = drawable\(recipe\);/);
  assert.match(src, /if \(complete\) wrap\.append\(group\('Covers'/);
  assert.match(src, /drawable\(r\) \? renderBookArt\(b, \{ recipe: r \}\)/);
  assert.doesNotMatch(src, /\.toLowerCase\(\)/);
  // The same recipe the page would refuse is the one the inspector lists.
  assert.deepEqual(B.recipeProblems(withoutColor(), CATALOG), ['color must be a six-digit hex color.']);
});

test('a field added and then reverted leaves the saved file byte for byte', () => {
  const saved = without(real, 'spellbook', ['color']);
  const draft = B.setRecipeField(saved, 'spellbook', 'color', '#abcdef', CATALOG);
  assert.equal(B.revertRecipe(draft, saved, 'spellbook'), saved);
});

