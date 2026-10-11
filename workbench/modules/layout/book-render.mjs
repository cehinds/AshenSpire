// workbench/modules/layout/book-render.mjs — Layout Studio's Book recipes render page. Served by
// the GAME server (the Workbench origin cannot import /src/*), it draws the skill books with the
// game's own book renderer (src/ui/components/bookArt.js) and talks to the Workbench module over
// postMessage. Both directions are origin-checked: the parent origin comes from ?po=, and only
// messages from window.parent at that origin are obeyed.
//
// Page -> parent:  { source:'ashen-book-render', type:'ready', protocol, catalog }
//                  { source:'ashen-book-render', type:'pick', id }                 a book was clicked
//                  { source:'ashen-book-render', type:'choose', field, value }     a choice was clicked
// Parent -> page:  { source:'ashen-book-module', type:'set', bookId, recipes: { id: recipe } }

import { renderBookArt } from '../../../src/ui/components/bookArt.js';
import { BOOK_COVERS, BOOK_SYMBOLS, BOOK_TREATMENTS, BOOK_TRIMS, BOOK_PALETTE } from '../../../src/content/bookArt.js';
import { consumables } from '../../../src/content/consumables.js';
import { BOOK_RENDER_PROTOCOL, BOOK_RENDER_SOURCE, BOOK_MODULE_SOURCE, recipeProblems } from './book-model.mjs';

const params = new URLSearchParams(location.search);
const parentOrigin = params.get('po') || '';
const stage = document.getElementById('stage');
const note = stage.querySelector('.bkr-note');
const SIZES = [64, 120, 200];
const TREATMENT_LABELS = { solid: 'Raised relief', line: 'Aged relief', seal: 'Medallion' };

const books = consumables.filter((row) => row.kind === 'skillBook').map((row) => ({ id: row.id, name: row.name }));
const catalog = {
  books,
  cover: [...BOOK_COVERS],
  symbol: [...BOOK_SYMBOLS],
  treatment: [...BOOK_TREATMENTS],
  trim: [...BOOK_TRIMS],
  palette: [...BOOK_PALETTE],
};

let current = { bookId: null, recipes: {} };

const post = (msg) => { if (parentOrigin) window.parent.postMessage({ source: BOOK_RENDER_SOURCE, ...msg }, parentOrigin); };

function button(attrs, children) {
  const b = document.createElement('button');
  b.type = 'button';
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, String(v));
  b.append(...children);
  return b;
}

/**
 * A recipe the game's renderer can draw: every field is a valid value. An incomplete one (a field
 * the file lacks, or a value the game would refuse) is not drawn; the Workbench inspector lists it.
 */
const drawable = (recipe) => Boolean(recipe) && recipeProblems(recipe, catalog).length === 0;

/** Draw the selected book large and small, the book shelf, and the choices its recipe takes. */
function draw() {
  const book = books.find((b) => b.id === current.bookId);
  const recipe = book ? current.recipes[book.id] : null;
  if (!book || !recipe) {
    stage.replaceChildren(note);
    note.hidden = false;
    note.textContent = parentOrigin ? 'No book is selected.' : 'Open this page from the Workbench.';
    return;
  }
  note.hidden = true;
  const complete = drawable(recipe);
  const wrap = document.createElement('section');
  wrap.className = 'bkr';
  if (complete) {
    const big = document.createElement('div');
    big.className = 'bkr-stage';
    big.append(renderBookArt(book, { recipe }));
    const sizes = document.createElement('div');
    sizes.className = 'bkr-sizes';
    sizes.setAttribute('aria-label', 'Preview sizes');
    for (const px of SIZES) {
      const cell = document.createElement('figure');
      cell.className = 'bkr-size';
      cell.style.width = `${px}px`;
      cell.append(renderBookArt(book, { recipe }));
      const cap = document.createElement('figcaption');
      cap.textContent = `${px}px`;
      cell.append(cap);
      sizes.append(cell);
    }
    wrap.append(big, sizes);
  } else {
    const warn = document.createElement('p');
    warn.className = 'bkr-note';
    warn.textContent = `${book.name}: the recipe is incomplete (${recipeProblems(recipe, catalog).join(' ')}). Set the missing values in the Workbench inspector.`;
    wrap.append(warn);
  }
  const shelf = document.createElement('div');
  shelf.className = 'bkr-shelf';
  shelf.setAttribute('role', 'listbox');
  shelf.setAttribute('aria-label', 'Books');
  for (const b of books) {
    const r = current.recipes[b.id];
    if (!r) continue;
    // An incomplete recipe shows its name where its art would be, so the shelf still works.
    const art = drawable(r) ? renderBookArt(b, { recipe: r }) : Object.assign(document.createElement('span'), { textContent: b.name });
    const btn = button({ 'data-pick': b.id, 'aria-selected': b.id === book.id, title: b.name, 'aria-label': b.name }, [art]);
    btn.className = 'bkr-book';
    shelf.append(btn);
  }
  if (complete) wrap.append(group('Covers', 'cover', catalog.cover, recipe, book, (v) => v), group('Symbols', 'symbol', catalog.symbol, recipe, book, (v) => v), group('Treatment', 'treatment', catalog.treatment, recipe, book, (v) => `${v} · ${TREATMENT_LABELS[v] || v}`), group('Trim', 'trim', catalog.trim, recipe, book, (v) => v));
  wrap.append(shelfBlock(shelf));
  stage.replaceChildren(wrap);
  // The parent sizes the frame to the page, so every row shows without a scrollbar inside it.
  post({ type: 'size', height: Math.ceil(stage.getBoundingClientRect().height) });
}

function shelfBlock(shelf) {
  const box = document.createElement('div');
  box.className = 'bkr-group';
  const h = document.createElement('h3');
  h.textContent = 'Books';
  box.append(h, shelf);
  return box;
}

/** One choice row: each value drawn with this book's art, the current one marked. */
function group(title, field, values, recipe, book, label) {
  const box = document.createElement('div');
  box.className = 'bkr-group';
  const h = document.createElement('h3');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'bkr-choices';
  for (const v of values) {
    const caption = document.createElement('span');
    caption.textContent = label(v);
    const btn = button({ 'data-field': field, 'data-value': v, 'aria-pressed': recipe[field] === v, 'aria-label': `${title}: ${label(v)}` }, [renderBookArt(book, { recipe: { ...recipe, [field]: v } }), caption]);
    btn.className = 'bkr-choice';
    row.append(btn);
  }
  box.append(h, row);
  return box;
}

stage.addEventListener('click', (e) => {
  const pick = e.target.closest('[data-pick]');
  if (pick) { post({ type: 'pick', id: pick.dataset.pick }); return; }
  const choice = e.target.closest('[data-field]');
  if (choice) post({ type: 'choose', field: choice.dataset.field, value: choice.dataset.value });
});

window.addEventListener('message', (ev) => {
  if (!parentOrigin || ev.origin !== parentOrigin || ev.source !== window.parent) return;
  const d = ev.data;
  if (!d || d.source !== BOOK_MODULE_SOURCE) return;
  if (d.type === 'set') {
    current = { bookId: typeof d.bookId === 'string' ? d.bookId : current.bookId, recipes: d.recipes && typeof d.recipes === 'object' ? d.recipes : {} };
    draw();
  }
});

if (parentOrigin) post({ type: 'ready', protocol: BOOK_RENDER_PROTOCOL, catalog });
else { note.hidden = false; note.textContent = 'Open this page from the Workbench.'; }
