import { BOOK_ART_PRESETS } from '../../../../src/content/bookArtPresets.js';
import { BOOK_COVERS, BOOK_SYMBOLS, BOOK_TREATMENTS, BOOK_TRIMS, BOOK_PALETTE, bookArtProblems } from '../../../../src/content/bookArt.js';
import { consumables } from '../../../../src/content/consumables.js';
import { renderBookArt } from '../../../../src/ui/components/bookArt.js';
const $ = (id) => document.getElementById(id);
const books = consumables.filter((row) => row.kind === 'skillBook');
const key = 'ashenspire-book-atelier-v1';
let recipes = structuredClone(BOOK_ART_PRESETS);
function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a recipes object.');
  for (const book of books) if (bookArtProblems(value[book.id]).length) throw new Error(`Invalid recipe for ${book.name}.`);
  for (const id of Object.keys(value)) if (!books.some((book) => book.id === id)) throw new Error(`Unknown book: ${id}`);
  return value;
}
try { const draft = localStorage.getItem(key); if (draft) recipes = validate(JSON.parse(draft)); } catch { $('status').textContent = 'Invalid or unavailable browser draft; showing game defaults.'; }
let selected = books[0];
for (const [id, options] of Object.entries({ cover: BOOK_COVERS, symbol: BOOK_SYMBOLS, treatment: BOOK_TREATMENTS, trim: BOOK_TRIMS })) {
  for (const value of options) { const option = document.createElement('option'); option.value = value; option.textContent = value[0].toUpperCase() + value.slice(1); $(id).append(option); }
}
function draw() {
  const recipe = recipes[selected.id];
  $('name').textContent = selected.name;
  for (const field of Object.keys(recipe)) $(field).value = recipe[field];
  $('stage').replaceChildren(renderBookArt(selected, { recipe }));
  $('library').replaceChildren(...books.map((book) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.book = book.id; button.setAttribute('aria-pressed', String(book.id === selected.id));
    button.append(renderBookArt(book, { recipe: recipes[book.id] }), document.createTextNode(book.name));
    button.addEventListener('click', () => { selected = book; draw(); }); return button;
  }));
  $('variations').replaceChildren(...BOOK_COVERS.map((cover) => {
    const button = document.createElement('button'); button.className = 'variation'; button.append(renderBookArt(selected, { recipe: { ...recipe, cover } }), document.createElement('br'), document.createTextNode(cover)); button.addEventListener('click', () => update('cover', cover)); return button;
  }));
  $('symbols').replaceChildren(...BOOK_SYMBOLS.map((symbol) => {
    const button = document.createElement('button'); button.className = 'symbol-cell'; button.setAttribute('aria-label', `Use ${symbol} symbol`); const img = document.createElement('img'); img.src = `assets/shop/layers/symbols/${symbol}-${recipe.treatment}.svg`; img.alt = ''; button.append(img, document.createElement('br'), document.createTextNode(symbol)); button.addEventListener('click', () => update('symbol', symbol)); return button;
  }));
}
function save() { try { localStorage.setItem(key, JSON.stringify(recipes)); $('status').textContent = 'Draft saved in this browser.'; } catch { $('status').textContent = 'Browser storage unavailable. Export to keep your changes.'; } }
function update(field, value) { recipes[selected.id][field] = value; save(); draw(); }
for (const id of ['cover', 'color', 'ink', 'symbol', 'treatment', 'trim']) $(id).addEventListener('input', () => update(id, $(id).value));
for (const color of BOOK_PALETTE) { const button = document.createElement('button'); button.setAttribute('aria-label', `Use leather color ${color}`); button.style.setProperty('--swatch', color); button.addEventListener('click', () => update('color', color)); $('colors').append(button); }
$('reset').addEventListener('click', () => { recipes[selected.id] = { ...BOOK_ART_PRESETS[selected.id] }; save(); draw(); });
function download(name, body, type) { const url = URL.createObjectURL(new Blob([body], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('export').addEventListener('click', () => {
  validate(recipes); download('bookArtPresets.js', '// Authored in Book Atelier. Replace src/content/bookArtPresets.js and rebuild.\nexport const BOOK_ART_PRESETS = ' + JSON.stringify(recipes, null, 2) + ';\n', 'text/javascript');
  download('book-art-recipes.json', JSON.stringify(recipes, null, 2), 'application/json');
  $('status').textContent = 'Exported game module and editable JSON recipes.';
});
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async () => { try { const file = $('file').files[0]; if (!file) return; const next = validate(JSON.parse(await file.text())); recipes = structuredClone(next); save(); draw(); } catch (error) { $('status').textContent = `Import kept your draft unchanged: ${error.message}`; } finally { $('file').value = ''; } });
draw();
