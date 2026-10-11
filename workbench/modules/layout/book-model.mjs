// workbench/modules/layout/book-model.mjs — the pure model of Layout Studio's
// "Book recipes" mode. No DOM and no fetch.
//
// The data the game reads is src/content/bookArtPresets.js: BOOK_ART_PRESETS maps
// each skill book id to one recipe (cover, color, ink, symbol, treatment, trim).
// bookArt.js and the game's book renderer read every field, so each one is
// editable here. The file is not JSON (keys are bare identifiers and strings use
// single quotes), so the model never re-serializes it: it finds each value's
// place in the text and replaces only that value. Unchanged text stays byte for
// byte, and an edit changes exactly the quoted value it touches.

import { bookArtProblems, BOOK_COVERS, BOOK_SYMBOLS, BOOK_TREATMENTS, BOOK_TRIMS, BOOK_PALETTE } from '../../../src/content/bookArt.js';

export const RECIPES_FILE = 'src/content/bookArtPresets.js';
const HEADER = 'export const BOOK_ART_PRESETS = {';
export const FIELDS = Object.freeze(['cover', 'color', 'ink', 'symbol', 'treatment', 'trim']);
/** The choices each field takes; colors are free hex values (the palette is a shortcut). */
export const CHOICES = Object.freeze({ cover: BOOK_COVERS, symbol: BOOK_SYMBOLS, treatment: BOOK_TREATMENTS, trim: BOOK_TRIMS, color: BOOK_PALETTE, ink: null });
export const TREATMENT_LABELS = Object.freeze({ solid: 'Raised relief', line: 'Aged relief', seal: 'Medallion' });

// One recipe per line: `  id: { cover: 'classic', color: '#277348', … },` (the last one has no comma).
const RECIPE_LINE = /^ {2}([A-Za-z]\w*): \{ ([^\n]*) \},?$/gm;
const FIELD = /(\w+): '([^'\n]*)'/g;

/**
 * Parse the module text. Returns { data, slots, ids }: data is { id: { field: value } } and
 * slots is { id: { field: { start, end } } }, the character span of each quoted value.
 * Throws when the header is missing, so a file the model cannot read is never edited.
 */
export function parseRecipes(text) {
  if (typeof text !== 'string' || !text.includes(HEADER)) throw Error(`${RECIPES_FILE}: BOOK_ART_PRESETS was not found`);
  const data = {}, slots = {};
  for (const line of text.matchAll(RECIPE_LINE)) {
    const id = line[1];
    const base = line.index + id.length + 6; // `  ${id}: { ` is id.length + 6 characters
    data[id] = {};
    slots[id] = {};
    for (const f of line[2].matchAll(FIELD)) {
      const end = base + f.index + f[0].length - 1; // the closing quote
      const start = end - f[2].length;
      data[id][f[1]] = f[2];
      slots[id][f[1]] = { start, end };
    }
  }
  return { data, slots, ids: Object.keys(data) };
}

/** The recipe for one book with its field values, or null when the file has no such book. */
export function recipeOf(parsed, id) {
  return parsed.data[id] ? { ...parsed.data[id] } : null;
}

/** Problems with one recipe, in bookArt.js's words (empty when the recipe is valid). */
export function recipeProblems(recipe) {
  return bookArtProblems(recipe);
}

/**
 * Set one field of one book. Returns the new text; the input is not changed. Throws for an
 * unknown book or field, a value outside the field's choices, or a value that would break the
 * quoted string, so only a valid edit ever reaches the file.
 */
export function setRecipeField(text, id, field, value) {
  const parsed = parseRecipes(text);
  if (!parsed.data[id]) throw Error(`Unknown book: ${id}`);
  if (!FIELDS.includes(field)) throw Error(`Unknown field: ${field}`);
  const slot = parsed.slots[id][field];
  if (!slot) throw Error(`${id} has no ${field} in ${RECIPES_FILE}`);
  const next = String(value);
  if (/['\n\r\\]/.test(next)) throw Error(`${field} must not contain quotes, backslashes or line breaks`);
  const recipe = { ...parsed.data[id], [field]: next };
  const problems = recipeProblems(recipe);
  if (problems.length) throw Error(problems.join(' '));
  if (next === parsed.data[id][field]) return text;
  return text.slice(0, slot.start) + next + text.slice(slot.end);
}

/**
 * Put one book's recipe back to the value it has in another copy of the file (the saved one).
 * Only that book's fields change; every other byte stays as it is.
 */
export function revertRecipe(text, original, id) {
  const from = parseRecipes(original);
  if (!from.data[id]) return text;
  let out = text;
  for (const field of FIELDS) {
    if (from.data[id][field] === undefined) continue;
    const cur = parseRecipes(out);
    if (!cur.data[id] || cur.data[id][field] === from.data[id][field]) continue;
    out = out.slice(0, cur.slots[id][field].start) + from.data[id][field] + out.slice(cur.slots[id][field].end);
  }
  return out;
}

/** The book ids whose recipe differs between two copies of the file. */
export function changedBooks(text, original) {
  if (text === original) return [];
  const a = parseRecipes(original).data, b = parseRecipes(text).data;
  return Object.keys(a).filter((id) => JSON.stringify(a[id]) !== JSON.stringify(b[id]));
}

/** The whole-file problems a save would meet before the server's own checks: every recipe must be valid. */
export function fileProblems(text) {
  let parsed;
  try { parsed = parseRecipes(text); } catch (err) { return [err.message]; }
  return parsed.ids.flatMap((id) => recipeProblems(parsed.data[id]).map((p) => `${id}: ${p}`));
}
