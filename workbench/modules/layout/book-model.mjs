// workbench/modules/layout/book-model.mjs — the pure model of Layout Studio's
// "Book recipes" mode. No DOM, no fetch, no game imports: the Workbench origin cannot
// import /src/*, so the game's catalogs (the choices each field takes) arrive as data
// from the render page, and the tests pass the real ones from src/content/bookArt.js.
//
// The data the game reads is src/content/bookArtPresets.js: BOOK_ART_PRESETS maps
// each skill book id to one recipe (cover, color, ink, symbol, treatment, trim). The
// game's book renderer reads every field, so each one is editable here. The file is
// not JSON (bare keys, single-quoted strings), so the model never re-serializes it: it
// finds each value's place in the text and replaces only that value. Unchanged text
// stays byte for byte, and an edit changes exactly the quoted value it touches.

export const RECIPES_FILE = 'src/content/bookArtPresets.js';
/** The render page's protocol: a page from another checkout with another number is not drawn. */
export const BOOK_RENDER_PROTOCOL = 1;
export const BOOK_RENDER_SOURCE = 'ashen-book-render';
export const BOOK_MODULE_SOURCE = 'ashen-book-module';
const HEADER = 'export const BOOK_ART_PRESETS = {';
export const FIELDS = Object.freeze(['cover', 'color', 'ink', 'symbol', 'treatment', 'trim']);
const CHOICE_FIELDS = Object.freeze(['cover', 'symbol', 'treatment', 'trim']);
const HEX = /^#[0-9a-fA-F]{6}$/;
export const TREATMENT_LABELS = Object.freeze({ solid: 'Raised relief', line: 'Aged relief', seal: 'Medallion' });

// One recipe per line: `  id: { cover: 'classic', color: '#277348', … },` (the last one has no comma).
const RECIPE_LINE = /^ {2}([A-Za-z]\w*): \{ ([^\n]*) \},?$/gm;
const FIELD = /(\w+): '([^'\n]*)'/g;

/**
 * The catalog the game gives the Workbench: the choices each field takes and the books
 * the game shows. Missing lists are empty, so an edit with no catalog is refused, not guessed.
 */
export function catalogOf(raw = {}) {
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const books = Array.isArray(raw.books) ? raw.books.filter((b) => b && typeof b.id === 'string').map((b) => ({ id: b.id, name: String(b.name ?? b.id) })) : [];
  return Object.freeze({
    books,
    cover: Object.freeze(list(raw.cover)),
    symbol: Object.freeze(list(raw.symbol)),
    treatment: Object.freeze(list(raw.treatment)),
    trim: Object.freeze(list(raw.trim)),
    palette: Object.freeze(list(raw.palette)),
  });
}

/** Whether a catalog holds what editing needs: the four choice lists are present. */
export const catalogReady = (catalog) => Boolean(catalog) && CHOICE_FIELDS.every((f) => catalog[f].length > 0);

/** The game server's base URL from the Workbench tool list, or null while it is not up. */
export function gameBaseOf(tools = []) {
  const game = (Array.isArray(tools) ? tools : []).find((t) => t && t.id === 'game');
  return game && game.status === 'up' && game.url ? String(game.url).replace(/\/?$/, '/') : null;
}

/** The URL of the render page on the game server (the page imports the game's own renderer). */
export function renderUrl(gameBase, { parentOrigin = '' } = {}) {
  const base = String(gameBase || '').replace(/\/?$/, '/');
  const q = new URLSearchParams();
  if (parentOrigin) q.set('po', parentOrigin);
  return `${base}workbench/modules/layout/book-render.html?${q}`;
}

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

/**
 * Problems with one recipe, worded as the game's own check words them (bookArt.js
 * bookArtProblems). An empty list means the recipe is valid.
 */
export function recipeProblems(recipe, catalog) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return ['Expected a book artwork recipe.'];
  const errors = [];
  for (const key of CHOICE_FIELDS) if (!catalog[key].includes(recipe[key])) errors.push(`Unknown ${key}: ${recipe[key]}`);
  for (const key of ['color', 'ink']) if (!HEX.test(recipe[key])) errors.push(`${key} must be a six-digit hex color.`);
  for (const key of Object.keys(recipe)) if (!FIELDS.includes(key)) errors.push(`Unknown artwork field: ${key}`);
  return errors;
}

/** The values a field may take: the catalog's list for a choice, or any hex colour for color and ink. */
export function choicesFor(field, catalog) {
  return CHOICE_FIELDS.includes(field) ? [...catalog[field]] : null;
}

/**
 * Set one field of one book. Returns the new text; the input is not changed. Throws for an
 * unknown book or field, a value outside the field's choices, or a value that would break the
 * quoted string, so only a valid edit ever reaches the file.
 */
export function setRecipeField(text, id, field, value, catalog) {
  if (!catalogReady(catalog)) throw Error('The game\'s book catalog is not loaded, so the edit is not checked');
  const parsed = parseRecipes(text);
  if (!parsed.data[id]) throw Error(`Unknown book: ${id}`);
  if (!FIELDS.includes(field)) throw Error(`Unknown field: ${field}`);
  const slot = parsed.slots[id][field];
  if (!slot) throw Error(`${id} has no ${field} in ${RECIPES_FILE}`);
  const next = String(value);
  if (/['\n\r\\]/.test(next)) throw Error(`${field} must not contain quotes, backslashes or line breaks`);
  const recipe = { ...parsed.data[id], [field]: next };
  const problems = recipeProblems(recipe, catalog);
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

/** Problems with the whole file before the server's own checks: every recipe must be valid. */
export function fileProblems(text, catalog) {
  let parsed;
  try { parsed = parseRecipes(text); } catch (err) { return [err.message]; }
  return parsed.ids.flatMap((id) => recipeProblems(parsed.data[id], catalog).map((p) => `${id}: ${p}`));
}
