// workbench/modules/layout/book-view.mjs — Layout Studio's "Book recipes" mode. The
// ten skill books are drawn by the game's own book renderer (src/ui/components/bookArt.js),
// so the preview is the game's art at the sizes the book is shown. The recipe fields
// (cover, leather colour, symbol, treatment, metal ink, trim) are edited in the inspector and
// written through book-model.mjs, which changes only the values edited. Edits are a draft
// until the shared review saves them to src/content/bookArtPresets.js. index.mjs mounts this
// view and supplies the host, the same way it mounts the sketch view.
import { renderBookArt } from '../../../src/ui/components/bookArt.js';
import { consumables } from '../../../src/content/consumables.js';
import * as K from './book-model.mjs';
import * as C from './config-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = '/modules/layout/book-view.css';
const SIZES = [64, 120, 200];

const SHELL = `<div class="mode-bar bk-bar">
    <label class="lay-field">Book <select data-bk="pick" title="The skill books the game shows"></select></label>
    <button type="button" class="btn btn-sm btn-ghost" data-bk="revert" disabled title="Put this book's recipe back to the saved file">Revert this book</button>
    <span class="spacer"></span>
    <span class="bk-file" data-bk="file"></span>
  </div>
  <div class="mode-body bk-body">
    <aside class="lay-left" aria-label="Books"><div class="lay-panel-head"><span>Books</span></div><div class="bk-library"></div></aside>
    <main class="lay-center bk-main">
      <div class="bk-stage" data-bk="stage"></div>
      <div class="bk-sizes" data-bk="sizes" aria-label="Preview sizes"></div>
      <h3 class="bk-h">Covers</h3><div class="bk-row" data-bk="covers"></div>
      <h3 class="bk-h">Symbols</h3><div class="bk-grid" data-bk="symbols"></div>
      <h3 class="bk-h">Leather colour</h3><div class="bk-row" data-bk="palette"></div>
      <div class="lay-status bk-status" aria-live="polite"></div>
    </main>
    <aside class="lay-right" aria-label="Inspector"><div class="lay-panel-head"><span>Inspector</span></div><div class="bk-insp"></div></aside>
  </div>`;

function ensureCss() {
  if (document.querySelector(`link[data-href="${CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS;
  link.dataset.href = CSS;
  document.head.append(link);
}

const books = () => consumables.filter((row) => row.kind === 'skillBook');

/**
 * The Book recipes view. host: { api(path), history, toast(opts), changed() }.
 * Returns the view's controller (show, changes, saved, reload, keep, hashOf, commands).
 */
export function createBookView(root, host) {
  ensureCss();
  root.innerHTML = SHELL;
  root.addEventListener('change', (e) => onRootChange(e));
  root.addEventListener('click', (e) => onRootClick(e));
  const $ = (sel) => root.querySelector(sel);
  const st = { text: null, original: null, hash: null, parsed: null, bookId: null, error: null, loading: null };

  const book = () => books().find((b) => b.id === st.bookId) || null;
  const recipe = () => (st.parsed && st.bookId ? st.parsed.data[st.bookId] : null);
  const dirtyIds = () => (st.text !== null && st.original !== null ? K.changedBooks(st.text, st.original) : []);

  function parse(text) {
    try { return K.parseRecipes(text); } catch (err) { st.error = err.message; return null; }
  }

  // ---- drawing -------------------------------------------------------

  function paintAll() {
    paintBar(); paintLibrary(); paintStage(); paintInspector(); paintStatus();
    if (host.changed) host.changed();
  }

  function paintBar() {
    const list = st.parsed ? books().filter((b) => st.parsed.data[b.id]) : [];
    const pick = $('[data-bk="pick"]');
    pick.innerHTML = list.map((b) => `<option value="${esc(b.id)}"${b.id === st.bookId ? ' selected' : ''}>${esc(b.name)}${dirtyIds().includes(b.id) ? ' •' : ''}</option>`).join('');
    pick.disabled = !list.length;
    const r = recipe();
    $('[data-bk="revert"]').disabled = !r || !dirtyIds().includes(st.bookId);
    $('[data-bk="file"]').textContent = K.RECIPES_FILE;
  }

  function paintLibrary() {
    const lib = $('.bk-library');
    if (!st.parsed) { lib.innerHTML = ''; return; }
    lib.innerHTML = books().map((b) => {
      const has = Boolean(st.parsed.data[b.id]);
      const dirty = dirtyIds().includes(b.id);
      return `<button type="button" class="bk-book" data-book="${esc(b.id)}" aria-pressed="${b.id === st.bookId}"${has ? '' : ' disabled'}>`
        + `<span class="bk-thumb" data-thumb="${esc(b.id)}"></span><span class="bk-name">${esc(b.name)}${dirty ? ' <span class="bk-dirty" title="Unsaved change">•</span>' : ''}${has ? '' : ' <span class="lay-note">no recipe</span>'}</span></button>`;
    }).join('');
    for (const b of books()) {
      const r = st.parsed.data[b.id];
      if (!r) continue;
      lib.querySelector(`[data-thumb="${b.id}"]`).append(renderBookArt(b, { recipe: r }));
    }
  }

  function paintStage() {
    const stage = $('[data-bk="stage"]'), sizes = $('[data-bk="sizes"]');
    const b = book(), r = recipe();
    if (!b || !r) { stage.innerHTML = ''; sizes.innerHTML = ''; $('[data-bk="covers"]').innerHTML = ''; $('[data-bk="symbols"]').innerHTML = ''; $('[data-bk="palette"]').innerHTML = ''; return; }
    stage.replaceChildren(renderBookArt(b, { recipe: r }));
    sizes.replaceChildren(...SIZES.map((px) => {
      const cell = document.createElement('span');
      cell.className = 'bk-size';
      cell.style.width = `${px}px`;
      cell.append(renderBookArt(b, { recipe: r }));
      const label = document.createElement('small');
      label.textContent = `${px}px`;
      const wrap = document.createElement('span');
      wrap.className = 'bk-size-wrap';
      wrap.append(cell, label);
      return wrap;
    }));
    // Each choice is a button drawn with the game's art, so a click is a visible preview.
    const covers = $('[data-bk="covers"]');
    covers.replaceChildren(...K.CHOICES.cover.map((cover) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bk-choice';
      btn.dataset.bkSet = 'cover';
      btn.dataset.value = cover;
      btn.setAttribute('aria-pressed', String(r.cover === cover));
      btn.append(renderBookArt(b, { recipe: { ...r, cover } }), document.createElement('br'), document.createTextNode(cover));
      return btn;
    }));
    const symbols = $('[data-bk="symbols"]');
    symbols.replaceChildren(...K.CHOICES.symbol.map((symbol) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bk-choice';
      btn.dataset.bkSet = 'symbol';
      btn.dataset.value = symbol;
      btn.setAttribute('aria-pressed', String(r.symbol === symbol));
      btn.setAttribute('aria-label', `Use the ${symbol} symbol`);
      btn.append(renderBookArt(b, { recipe: { ...r, symbol } }), document.createTextNode(symbol));
      return btn;
    }));
    const palette = $('[data-bk="palette"]');
    palette.replaceChildren(...K.CHOICES.color.map((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bk-swatch';
      btn.dataset.bkSet = 'color';
      btn.dataset.value = color;
      btn.style.setProperty('--swatch', color);
      btn.setAttribute('aria-label', `Use leather colour ${color}`);
      btn.setAttribute('aria-pressed', String(r.color.toLowerCase() === color.toLowerCase()));
      return btn;
    }));
  }

  /** The inspector: each recipe field of the book, as the control that matches its kind. */
  function paintInspector() {
    const box = $('.bk-insp');
    const b = book(), r = recipe();
    if (!b || !r) { box.innerHTML = st.error ? `<p class="lay-hint is-error">${esc(st.error)}</p>` : '<p class="lay-note">Pick a book to edit its recipe.</p>'; return; }
    const selectOf = (field, options, label = (v) => v) => `<div class="lay-row"><code>${esc(field)}</code><span><select data-bk-field="${field}">${options.map((o) => `<option value="${esc(o)}"${o === r[field] ? ' selected' : ''}>${esc(label(o))}</option>`).join('')}</select></span></div>`;
    const colourOf = (field) => `<div class="lay-row"><code>${esc(field)}</code><span><input type="color" data-bk-colour="${field}" value="${esc(r[field].toLowerCase())}" aria-label="${esc(field)} colour"> <input type="text" data-bk-field="${field}" value="${esc(r[field])}" size="8" maxlength="7" pattern="#[0-9a-fA-F]{6}"></span></div>`;
    box.innerHTML = `<h3>${esc(b.name)}</h3>
      <p class="lay-note">${esc(K.RECIPES_FILE)} · ${esc(b.id)}</p>
      ${selectOf('cover', K.CHOICES.cover)}
      ${colourOf('color')}
      ${selectOf('symbol', K.CHOICES.symbol)}
      ${selectOf('treatment', K.CHOICES.treatment, (v) => `${v} (${K.TREATMENT_LABELS[v] || v})`)}
      ${colourOf('ink')}
      ${selectOf('trim', K.CHOICES.trim)}
      <p class="lay-note">Only the values you change are written. Save with Review changes.</p>`;
  }

  function paintStatus() {
    const parts = [];
    if (st.error) parts.push(st.error);
    if (st.parsed) {
      const n = dirtyIds().length;
      parts.push(`${books().filter((b) => st.parsed.data[b.id]).length} books`, n ? `${n} unsaved` : 'saved');
    }
    $('.bk-status').textContent = parts.join(' · ');
  }

  // ---- edits ---------------------------------------------------------

  /** Set the file text as one history step (the text is replaced, never mutated). */
  function setText(next, label) {
    const prev = st.text;
    if (next === prev) return;
    const put = (t) => { st.text = t; st.parsed = parse(t); paintAll(); };
    put(next);
    host.history.push({ label, before: prev, after: next, undo: () => put(prev), redo: () => put(next) });
  }

  /** One field of the selected book. An invalid value is refused with a reason and nothing changes. */
  function edit(field, value) {
    if (!st.bookId || !st.parsed) return;
    let next;
    try { next = K.setRecipeField(st.text, st.bookId, field, value); } catch (err) {
      host.toast({ kind: 'warn', title: `${book()?.name || st.bookId}: ${field} not changed`, detail: err.message, record: false });
      paintInspector();
      return;
    }
    setText(next, `Set ${st.bookId} ${field}`);
  }

  function selectBook(id) {
    if (!st.parsed || !st.parsed.data[id]) return;
    st.bookId = id;
    paintAll();
  }

  function onRootChange(e) {
    const t = e.target;
    if (t.dataset.bk === 'pick') { selectBook(t.value); return; }
    const field = t.dataset.bkField;
    if (field) { edit(field, t.value.trim()); return; }
    const colour = t.dataset.bkColour;
    if (colour) edit(colour, t.value);
  }

  function onRootClick(e) {
    const bookBtn = e.target.closest('[data-book]');
    if (bookBtn && !bookBtn.disabled) { selectBook(bookBtn.dataset.book); return; }
    const choice = e.target.closest('[data-bk-set]');
    if (choice) { edit(choice.dataset.bkSet, choice.dataset.value); return; }
    const revert = e.target.closest('[data-bk="revert"]');
    if (revert && !revert.disabled && st.bookId && st.original !== null) {
      setText(K.revertRecipe(st.text, st.original, st.bookId), `Revert ${st.bookId}`);
    }
  }

  // ---- files ---------------------------------------------------------

  /** Read the recipe file: its text, its disk hash. A fresh load clears the draft and its history. */
  async function fetchRecipes() {
    const r = await host.api(`files/read?path=${encodeURIComponent(K.RECIPES_FILE)}`);
    return r;
  }

  function install(text, hash) {
    st.original = text;
    st.text = text;
    st.hash = hash;
    st.parsed = parse(text);
    st.error = st.parsed ? null : st.error;
    if (st.parsed && (!st.bookId || !st.parsed.data[st.bookId])) st.bookId = Object.keys(st.parsed.data)[0] || null;
    host.history.clear();
  }

  async function load() {
    try {
      const r = await fetchRecipes();
      install(r.text, r.hash);
    } catch (err) {
      st.error = `Could not load ${K.RECIPES_FILE}: ${err.message}`;
    }
    paintAll();
  }

  return {
    show() {
      if (!st.loading) st.loading = load();
      if (st.parsed) paintAll();
    },
    /** The one file this view saves: the draft, sent with the hash it was read at. */
    changes() {
      if (st.text === null || st.original === null || st.error || st.text === st.original) return [];
      return [{ path: K.RECIPES_FILE, text: st.text, baseHash: st.hash }];
    },
    /** A save went through: the saved text is the new base; edits made while it ran stay unsaved. */
    saved(files, sent) {
      const base = C.savedBase(files, sent, K.RECIPES_FILE);
      if (!base) return;
      st.original = base.original;
      st.hash = base.hash;
      paintAll();
    },
    /** Reload the file after a conflict: the draft and its history go. A file deleted on disk reads as missing. */
    async reload(path) {
      if (path !== K.RECIPES_FILE) return undefined;
      try {
        const r = await fetchRecipes();
        install(r.text, r.hash);
      } catch (err) {
        if (err.status !== 404) throw err;
        st.text = null; st.original = null; st.parsed = null; st.hash = null;
        st.error = `${K.RECIPES_FILE} was deleted on disk`;
        host.history.clear();
        paintAll();
        return { missing: true };
      }
      paintAll();
      return undefined;
    },
    hashOf(path) { return path === K.RECIPES_FILE ? st.hash : undefined; },
    /** "Keep my version" in the conflict dialog: the draft is saved over the disk copy, so it takes the disk hash. */
    keep(path, hash) { if (path === K.RECIPES_FILE && st.text !== null) { st.hash = hash; paintStatus(); } },
    commands: () => [],
  };
}
