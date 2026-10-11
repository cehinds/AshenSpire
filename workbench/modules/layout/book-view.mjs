// workbench/modules/layout/book-view.mjs — Layout Studio's "Book recipes" mode. The skill books
// are drawn by the game's own book renderer on the game server (book-render.html, an iframe
// that talks over postMessage, origin-checked both ways), because this page cannot import
// /src/*. The recipe fields are edited in the inspector and written through book-model.mjs,
// which changes only the values edited. Edits are a draft until the shared review saves them
// to src/content/bookArtPresets.js. index.mjs mounts this view and supplies the host.
import * as K from './book-model.mjs';
import * as C from './config-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = '/modules/layout/book-view.css';
const SERVER_HINT = 'The books are drawn by the game server. Start it from the Library or Home, then reopen this mode.';

const SHELL = `<div class="mode-bar bk-bar">
    <label class="lay-field">Book <select data-bk="pick" title="The skill books the game shows"></select></label>
    <button type="button" class="btn btn-sm btn-ghost" data-bk="revert" disabled title="Put this book's recipe back to the saved file">Revert this book</button>
    <span class="spacer"></span>
    <span class="bk-file" data-bk="file"></span>
  </div>
  <div class="mode-body bk-body">
    <main class="lay-center bk-main">
      <div class="bk-frame-wrap">
        <iframe class="bk-frame" title="Skill books rendered by the game" hidden></iframe>
        <p class="lay-hint bk-setup" hidden></p>
      </div>
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

/**
 * The Book recipes view. host: { api(path), history, toast(opts), changed(), tools() }.
 * Returns the view's controller (show, changes, saved, reload, keep, hashOf, commands).
 */
export function createBookView(root, host) {
  ensureCss();
  root.innerHTML = SHELL;
  const $ = (sel) => root.querySelector(sel);
  const frame = $('.bk-frame');
  const st = {
    text: null, original: null, hash: null, parsed: null, bookId: null, error: null, loading: null,
    catalog: null, game: null, ready: false, connecting: null, serverId: null, framed: false, nonce: 0,
  };
  let offReload = null;

  const recipe = () => (st.parsed && st.bookId ? st.parsed.data[st.bookId] : null);
  const dirtyIds = () => (st.text !== null && st.original !== null ? K.changedBooks(st.text, st.original) : []);
  const editable = () => K.catalogReady(st.catalog) && Boolean(st.parsed) && !st.error;

  function parse(text) {
    try { return K.parseRecipes(text); } catch (err) { st.error = err.message; return null; }
  }

  // ---- the game render page ---------------------------------------------

  /** Send the book, its recipes and the page's current state to the render page. */
  function sendSet() {
    if (!st.ready || !st.game || !frame.contentWindow || !st.parsed) return;
    frame.contentWindow.postMessage({ source: K.BOOK_MODULE_SOURCE, type: 'set', bookId: st.bookId, recipes: st.parsed.data }, st.game.origin);
  }

  /**
   * Resolve the game server and point the frame at its render page, as the connect plan says:
   * keep a ready frame of this server, load the page again (a first show, a restart, a rebuild),
   * or show the setup note while no server is up. Concurrent calls share one lookup, and a
   * forced request that arrives during it is kept for that lookup's plan.
   */
  async function connect({ force = false } = {}) {
    if (st.connecting) { st.connecting.force = st.connecting.force || force; return; }
    const job = { force };
    st.connecting = job;
    let tools = null;
    try { tools = await host.api('tools'); } catch { tools = null; }
    st.connecting = null;
    const base = K.gameBaseOf(tools);
    const serverId = K.gameStartOf(tools);
    const plan = K.connectPlan({ base, currentOrigin: st.game?.origin ?? null, ready: st.ready, force: job.force, serverId, currentServerId: st.serverId });
    if (plan === 'setup') { showSetup('The game server is not running.'); return; }
    if (plan === 'keep') return;
    st.game = { base, origin: new URL(base).origin };
    st.serverId = serverId;
    st.ready = false;
    frame.hidden = false;
    $('.bk-setup').hidden = true;
    // A frame that already loaded gets a new nonce, so the same page is navigated to again.
    frame.src = K.renderUrl(base, { parentOrigin: location.origin, nonce: st.framed ? ++st.nonce : 0 });
    st.framed = true;
    clearTimeout(st.readyTimer);
    st.readyTimer = setTimeout(() => { if (!st.ready) showSetup(SERVER_HINT); }, 12000);
  }

  /** Subscribe to the host's game-start and content-reload notices while the view shows. */
  function subscribe() {
    if (offReload || typeof host.onReload !== 'function') return;
    offReload = host.onReload((ev) => { connect({ force: ev?.kind === 'reload' }); });
  }

  function unsubscribe() { if (offReload) { offReload(); offReload = null; } }

  function showSetup(message) {
    st.ready = false;
    frame.hidden = true;
    const p = $('.bk-setup');
    p.hidden = false;
    p.textContent = message;
    paintAll();
  }

  function onMessage(ev) {
    if (!st.game || ev.origin !== st.game.origin || ev.source !== frame.contentWindow) return;
    const d = ev.data;
    if (!d || d.source !== K.BOOK_RENDER_SOURCE) return;
    if (d.type === 'ready') {
      if (d.protocol !== K.BOOK_RENDER_PROTOCOL) { clearTimeout(st.readyTimer); showSetup('This checkout\'s book render page is a different version. Update the checkout to this branch.'); return; }
      st.catalog = K.catalogOf(d.catalog);
      st.ready = true;
      clearTimeout(st.readyTimer);
      paintAll();
      sendSet();
      return;
    }
    if (d.type === 'size') {
      const h = Number(d.height);
      if (Number.isFinite(h) && h > 0) frame.style.height = `${Math.min(Math.ceil(h) + 4, 4000)}px`;
      return;
    }
    if (d.type === 'pick') { selectBook(d.id); return; }
    if (d.type === 'choose') edit(d.field, d.value);
  }

  // ---- drawing -------------------------------------------------------

  function paintAll() {
    paintBar(); paintPalette(); paintInspector(); paintStatus();
    sendSet();
    if (host.changed) host.changed();
  }

  function paintBar() {
    const list = st.parsed ? (st.catalog?.books || []).filter((b) => st.parsed.data[b.id]) : [];
    const pick = $('[data-bk="pick"]');
    pick.innerHTML = list.map((b) => `<option value="${esc(b.id)}"${b.id === st.bookId ? ' selected' : ''}>${esc(b.name)}${dirtyIds().includes(b.id) ? ' •' : ''}</option>`).join('');
    pick.disabled = !list.length;
    $('[data-bk="revert"]').disabled = !recipe() || !dirtyIds().includes(st.bookId);
    $('[data-bk="file"]').textContent = K.RECIPES_FILE;
  }

  function paintPalette() {
    const row = $('[data-bk="palette"]');
    const r = recipe();
    const colour = r ? r.color.toLowerCase() : null;
    row.replaceChildren(...((st.catalog?.palette) || []).map((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bk-swatch';
      btn.dataset.bkSet = 'color';
      btn.dataset.value = color;
      btn.style.setProperty('--swatch', color);
      btn.setAttribute('aria-label', `Use leather colour ${color}`);
      btn.setAttribute('aria-pressed', String(colour === color.toLowerCase()));
      btn.disabled = !editable();
      return btn;
    }));
  }

  /** The inspector: each recipe field of the book, as the control that matches its kind. */
  function paintInspector() {
    const box = $('.bk-insp');
    const r = recipe();
    const book = st.catalog?.books.find((b) => b.id === st.bookId);
    if (!r) { box.innerHTML = st.error ? `<p class="lay-hint is-error">${esc(st.error)}</p>` : '<p class="lay-note">Pick a book to edit its recipe.</p>'; return; }
    const dis = editable() ? '' : ' disabled';
    const selectOf = (field, options, label = (v) => v) => `<div class="lay-row"><code>${esc(field)}</code><span><select data-bk-field="${field}"${dis}>${options.map((o) => `<option value="${esc(o)}"${o === r[field] ? ' selected' : ''}>${esc(label(o))}</option>`).join('')}</select></span></div>`;
    const colourOf = (field) => `<div class="lay-row"><code>${esc(field)}</code><span><input type="color" data-bk-colour="${field}" value="${esc(r[field].toLowerCase())}" aria-label="${esc(field)} colour"${dis}> <input type="text" data-bk-field="${field}" value="${esc(r[field])}" size="8" maxlength="7"${dis}></span></div>`;
    const cat = st.catalog || K.catalogOf({});
    box.innerHTML = `<h3>${esc(book?.name || st.bookId)}</h3>
      <p class="lay-note">${esc(st.bookId)} in ${esc(K.RECIPES_FILE)}</p>
      ${selectOf('cover', cat.cover)}
      ${colourOf('color')}
      ${selectOf('symbol', cat.symbol)}
      ${selectOf('treatment', cat.treatment, (v) => `${v} (${K.TREATMENT_LABELS[v] || v})`)}
      ${colourOf('ink')}
      ${selectOf('trim', cat.trim)}
      <p class="lay-note">${editable() ? 'Only the values you change are written. Save with Review changes.' : 'Edits are off until the game server answers.'}</p>`;
  }

  function paintStatus() {
    const parts = [];
    if (st.error) parts.push(st.error);
    if (st.parsed) {
      const n = dirtyIds().length;
      parts.push(`${Object.keys(st.parsed.data).length} books`, n ? `${n} unsaved` : 'saved');
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
    if (!st.bookId || !editable()) return;
    let next;
    try { next = K.setRecipeField(st.text, st.bookId, field, value, st.catalog); } catch (err) {
      host.toast({ kind: 'warn', title: `${st.bookId}: ${field} not changed`, detail: err.message, record: false });
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
    const swatch = e.target.closest('[data-bk-set]');
    if (swatch && !swatch.disabled) { edit(swatch.dataset.bkSet, swatch.dataset.value); return; }
    const revert = e.target.closest('[data-bk="revert"]');
    if (revert && !revert.disabled && st.bookId && st.original !== null) {
      setText(K.revertRecipe(st.text, st.original, st.bookId), `Revert ${st.bookId}`);
    }
  }

  // ---- files ---------------------------------------------------------

  function install(text, hash) {
    st.original = text;
    st.text = text;
    st.hash = hash;
    st.parsed = parse(text);
    if (st.parsed) st.error = null;
    if (st.parsed && (!st.bookId || !st.parsed.data[st.bookId])) st.bookId = Object.keys(st.parsed.data)[0] || null;
    host.history.clear();
  }

  async function fetchRecipes() {
    return host.api(`files/read?path=${encodeURIComponent(K.RECIPES_FILE)}`);
  }

  async function load() {
    try {
      const r = await fetchRecipes();
      install(r.text, r.hash);
    } catch (err) {
      st.error = `Could not load ${K.RECIPES_FILE}: ${err.message}`;
    }
    paintAll();
    await connect();
  }

  window.addEventListener('message', onMessage);
  root.addEventListener('change', onRootChange);
  root.addEventListener('click', onRootClick);

  return {
    show() {
      subscribe();
      // Every show re-resolves the server: a frame that is still ready for it is kept.
      if (!st.loading) st.loading = load();
      else connect();
      if (st.parsed) paintAll();
    },
    /** The view leaves the screen: its host notices stop, and a show subscribes again. Drafts stay. */
    hide() { unsubscribe(); },
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
