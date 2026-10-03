import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { consumables } from '../src/content/consumables.js';
import { BOOK_ART_PRESETS } from '../src/content/bookArtPresets.js';
import { BOOK_COVERS, BOOK_SYMBOLS, BOOK_TREATMENTS, BOOK_TRIMS, DEFAULT_BOOK_ART, bookArtRecipe, bookArtProblems, bookArtLayers } from '../src/content/bookArt.js';
const root = fileURLToPath(new URL('..', import.meta.url));
test('every shipped book has a valid independent artwork recipe', () => {
  const books = consumables.filter((row) => row.kind === 'skillBook');
  assert.deepEqual(Object.keys(BOOK_ART_PRESETS).sort(), books.map((row) => row.id).sort());
  for (const book of books) assert.deepEqual(bookArtProblems(BOOK_ART_PRESETS[book.id]), [], book.id);
  assert.equal(new Set(books.map((row) => bookArtRecipe(row).symbol)).size, books.length);
});
test('all selectable layers have high and mobile assets, and SVGs have no external dependencies', () => {
  for (const cover of BOOK_COVERS) for (const symbol of BOOK_SYMBOLS) for (const treatment of BOOK_TREATMENTS) for (const trim of BOOK_TRIMS) {
    for (const path of Object.values(bookArtLayers({ cover, symbol, treatment, trim })).filter(Boolean)) {
      assert.ok(existsSync(`${root}/${path}`), path);
      const twin = path.replace(/^assets\//, 'assets-mobile/');
      assert.ok(existsSync(`${root}/${twin}`), twin);
      if (path.endsWith('.svg')) {
        const text = readFileSync(`${root}/${path}`, 'utf8');
        assert.equal(text, readFileSync(`${root}/${twin}`, 'utf8'));
        assert.doesNotMatch(text, /<script|<foreignObject|\bhref\s*=|\bon\w+\s*=/i);
      }
    }
  }
});
test('unknown books get a complete neutral fallback without mutating defaults', () => {
  const recipe = bookArtRecipe({ id: 'futureManual' }); recipe.color = '#000000';
  assert.deepEqual(bookArtRecipe({}), DEFAULT_BOOK_ART);
  assert.deepEqual(bookArtRecipe({}, { ...DEFAULT_BOOK_ART, color: 'url(https://bad)' }), DEFAULT_BOOK_ART);
});
test('recipes reject unsafe colors, paths and unknown keys', () => {
  for (const bad of [null, [], { ...DEFAULT_BOOK_ART, cover: '../escape' }, { ...DEFAULT_BOOK_ART, ink: 'red;display:none' }, { ...DEFAULT_BOOK_ART, surprise: true }]) assert.ok(bookArtProblems(bad).length);
  assert.equal(bookArtLayers({ ...DEFAULT_BOOK_ART, trim: 'none' }).trim, null);
});
