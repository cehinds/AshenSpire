// node --test workbench/tests/layout-book-inspect.test.mjs — the Book recipes inspector draws a
// recipe the file lacks a field for (no color, no ink) without throwing: an empty swatch and a
// "missing" badge show the gap, the banner lists the game's problems, and nothing is filled in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as I from '../modules/layout/book-inspect.mjs';
import * as B from '../modules/layout/book-model.mjs';
import { consumables } from '../../src/content/consumables.js';
import { BOOK_ART_PRESETS } from '../../src/content/bookArtPresets.js';
import { BOOK_COVERS, BOOK_SYMBOLS, BOOK_TREATMENTS, BOOK_TRIMS, BOOK_PALETTE, bookArtProblems } from '../../src/content/bookArt.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOG = B.catalogOf({ books: consumables.filter((r) => r.kind === 'skillBook'), cover: BOOK_COVERS, symbol: BOOK_SYMBOLS, treatment: BOOK_TREATMENTS, trim: BOOK_TRIMS, palette: BOOK_PALETTE });
const withoutField = (field) => { const r = { ...BOOK_ART_PRESETS.spellbook }; delete r[field]; return r; };
const show = (recipe, extra = {}) => I.inspectorHtml({ bookId: 'spellbook', bookName: 'Spellbook', recipe, catalog: CATALOG, editable: true, ...extra });

test('a recipe with no color renders without throwing, with an empty swatch and a missing badge', () => {
  const html = show(withoutField('color'));
  assert.match(html, /data-bk-field="color" value="" placeholder="#rrggbb"/);
  assert.match(html, /<input type="color" data-bk-colour="color" value="#000000"/, 'the picker starts black and writes nothing');
  assert.match(html, /aria-label="No colour set"/);
  assert.match(html, /<em class="lay-hint is-error">missing<\/em>/);
  assert.doesNotMatch(html, /undefined/);
});

test('a recipe with no ink renders without throwing, and its problem is listed', () => {
  const recipe = withoutField('ink');
  const html = show(recipe);
  assert.match(html, /<div class="lay-row"><code>ink<\/code>/);
  assert.match(html, /<em class="lay-hint is-error">missing<\/em>/);
  assert.doesNotMatch(html, /undefined/);
  assert.match(html, /1 problem in this recipe/);
  assert.match(html, /<li>ink must be a six-digit hex color\.<\/li>/);
});

test('the banner lists the game\'s own problems for an incomplete recipe, in bookArtProblems wording', () => {
  const recipe = { ...withoutField('color'), ink: undefined };
  const html = show(recipe);
  assert.match(html, /2 problems in this recipe/);
  for (const p of bookArtProblems(recipe)) assert.ok(html.includes(`<li>${p}</li>`), `lists: ${p}`);
});

test('a missing choice shows a disabled placeholder, not the first choice', () => {
  const html = show(withoutField('cover'));
  assert.match(html, /<option value="" selected disabled>Choose one<\/option>/);
  const cover = /<select data-bk-field="cover">([\s\S]*?)<\/select>/.exec(html)[1];
  assert.doesNotMatch(cover, /selected>/, 'no real choice is marked as the value');
  assert.equal(I.fieldStateOf(withoutField('cover'), 'cover', CATALOG), 'missing');
});

test('a value the game would refuse is marked invalid and shown as it is, escaped', () => {
  const html = show({ ...BOOK_ART_PRESETS.spellbook, cover: '<b>gold</b>' });
  assert.match(html, /&lt;b&gt;gold&lt;\/b&gt;: not a choice/);
  assert.match(html, /<em class="lay-hint is-error">invalid<\/em>/);
  assert.doesNotMatch(html, /<b>gold/);
});

test('a complete recipe has no banner and no badge', () => {
  const html = show(BOOK_ART_PRESETS.spellbook);
  assert.doesNotMatch(html, /bk-banner/);
  assert.doesNotMatch(html, /is-error">(missing|invalid)</);
  assert.match(html, new RegExp(`<input type="color" data-bk-colour="color" value="${BOOK_ART_PRESETS.spellbook.color}"`));
});

test('without a catalog the banner waits for the game, and nothing throws', () => {
  const html = I.inspectorHtml({ bookId: 'spellbook', recipe: withoutField('color'), catalog: B.catalogOf({}), editable: false });
  assert.match(html, /checked once the game server answers/);
  assert.match(html, /disabled/);
});

test('no recipe is a note, or the load error', () => {
  assert.match(I.inspectorHtml({ bookId: null, recipe: null, catalog: CATALOG }), /Pick a book/);
  assert.match(I.inspectorHtml({ bookId: 'x', recipe: null, catalog: CATALOG, error: 'Could not load' }), /Could not load/);
});

test('the view draws its inspector through the pure builder, and never calls toLowerCase on a value it may not have', () => {
  const src = readFileSync(join(ROOT, 'workbench/modules/layout/book-view.mjs'), 'utf8');
  assert.match(src, /I\.inspectorHtml\(\{/);
  assert.match(src, /import \* as I from '\.\/book-inspect\.mjs';/);
  assert.doesNotMatch(src, /r\[field\]\.toLowerCase\(\)/);
  assert.match(src, /typeof r\?\.color === 'string' \? r\.color\.toLowerCase\(\) : null/, 'the palette guards a missing colour');
});

test('the swatch is the colour only when it is a six-digit hex colour', () => {
  assert.match(I.swatchHtml('#112233'), /--swatch: #112233/);
  assert.doesNotMatch(I.swatchHtml('red'), /--swatch/);
  assert.doesNotMatch(I.swatchHtml(undefined), /--swatch/);
});
