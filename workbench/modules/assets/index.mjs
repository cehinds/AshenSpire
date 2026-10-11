// workbench/modules/assets/index.mjs — Asset Gallery: every game art file, one virtualised grid.
//
// Left: the filters (folder, format, sort). Top: the kind chips, search and the thumbnail size.
// Centre: the grid. Only the tiles on screen are drawn; each tile's image is the file the Workbench serves at
// /asset-file/<game path>. A missing pack is said once, with the command that fetches it.
// The rules, the listing and the deep link are in model.mjs; this file is the DOM and the events.

import {
  KINDS, SORTS, DEFAULT_SORT, rowsOf, kindCounts, facetsOf, filterRows, sortRows, parseDeepLink, deepLinkOf,
  assetUrl, missingPacks, gridMetrics, visibleItems,
} from './model.mjs';

const TILE_MIN = 64;
const TILE_MAX = 256;
const TILE_DEFAULT = 128;
const GAP = 8;
const PAD = 12;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clampTile = (v) => Math.min(TILE_MAX, Math.max(TILE_MIN, Number(v) || TILE_DEFAULT));

export default {
  mount(el, ctx) {
    el.innerHTML = `<link rel="stylesheet" href="/modules/assets/assets.css"><div class="ast">
      <header class="ast-top">
        <nav class="ast-kinds" aria-label="Kinds"></nav>
        <div class="ast-tools">
          <label class="ast-field ast-search"><span class="ast-sr">Search</span><input type="search" class="ast-q" placeholder="Search path or name" autocomplete="off"></label>
          <label class="ast-field ast-size-field">Size<input type="range" class="ast-size" min="${TILE_MIN}" max="${TILE_MAX}" step="8"></label>
          <p class="ast-count" role="status"></p>
        </div>
      </header>
      <div class="ast-packs" hidden></div>
      <div class="ast-body">
        <aside class="ast-filters" aria-label="Filters">
          <label class="ast-field">Folder<select data-f="folder"></select></label>
          <label class="ast-field">Format<select data-f="format"></select></label>
          <label class="ast-field">Sort<select data-f="sort">${SORTS.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></label>
          <button type="button" class="ast-reset">Clear filters</button>
        </aside>
        <section class="ast-grid" tabindex="0" aria-label="Assets">
          <div class="ast-spacer"><div class="ast-tiles"></div></div>
          <p class="ast-empty" hidden></p>
        </section>
      </div></div>`;
    const $ = (s) => el.querySelector(s);
    const kinds = $('.ast-kinds'), q = $('.ast-q'), size = $('.ast-size'), count = $('.ast-count');
    const packsBox = $('.ast-packs'), grid = $('.ast-grid'), spacer = $('.ast-spacer'), tiles = $('.ast-tiles'), empty = $('.ast-empty');

    const st = { kind: '', q: '', folder: '', format: '', sort: DEFAULT_SORT, path: '', size: clampTile(ctx.settings.get('size', TILE_DEFAULT)) };
    let all = [], view = [], packs = [], missing = null, loadError = '', imageMisses = 0, metrics = null, raf = 0, seenParams = null;
    size.value = String(st.size);
    q.value = '';

    // ---------- loading ----------
    async function load() {
      try {
        const r = await ctx.api('assets/list');
        all = rowsOf(r.files);
        packs = r.packs || [];
        missing = missingPacks(packs);
        loadError = '';
      } catch (err) {
        all = []; packs = []; missing = null;
        loadError = err.message || 'The art listing failed.';
      }
      renderKinds(); renderFacets(); renderBanner(); refresh();
    }

    // ---------- chips, facets, banner ----------
    function renderKinds() {
      const counts = kindCounts(all);
      const total = all.length;
      kinds.innerHTML = [{ id: '', label: 'All', count: total }, ...counts].map((k) => `<button type="button" data-kind="${esc(k.id)}" aria-pressed="${String(k.id === st.kind)}"><span>${esc(k.label)}</span><span class="ast-n">${k.count}</span></button>`).join('');
    }
    function renderFacets() {
      const f = facetsOf(all);
      const fill = (name, values, label, fmt = (v) => v) => {
        const sel = el.querySelector(`[data-f="${name}"]`);
        sel.innerHTML = `<option value="">${label}</option>` + values.map((v) => `<option value="${esc(v.value)}">${esc(fmt(v.value))} (${v.count})</option>`).join('');
        // A value the listing does not carry is dropped, but only once the listing is in: before it, a deep link's value waits.
        if (all.length && !values.some((v) => v.value === st[name])) st[name] = '';
        sel.value = st[name];
      };
      fill('folder', f.folders, 'All folders');
      fill('format', f.formats, 'All formats', (v) => v.toUpperCase());
      el.querySelector('[data-f="sort"]').value = st.sort;
    }
    function renderBanner() {
      const notes = [];
      if (loadError) notes.push(`<p><strong>The art listing failed.</strong> ${esc(loadError)}</p>`);
      if (missing) notes.push(`<p><strong>Art pack not fetched:</strong> ${esc(missing.packs.join(', '))}. Run <code>${esc(missing.command)}</code> in this checkout, then reload.</p>`);
      if (imageMisses) notes.push(`<p><strong>${imageMisses} image${imageMisses === 1 ? '' : 's'} returned 404.</strong> ${missing ? 'The pack that holds them is not fetched; run the command above.' : 'Reload the page; if they stay missing, the file is not in the art tree.'}</p>`);
      packsBox.hidden = notes.length === 0;
      packsBox.innerHTML = notes.join('');
    }
    function renderCount() {
      count.textContent = all.length ? `${view.length} of ${all.length} files` : (loadError ? '' : 'No art files yet');
      empty.hidden = view.length > 0 || !all.length;
      if (!empty.hidden) empty.textContent = 'No file matches these filters.';
    }

    // ---------- grid ----------
    function refresh() {
      view = sortRows(filterRows(all, st), st.sort);
      renderCount();
      renderGrid();
    }
    function renderGrid() {
      const width = Math.max(0, grid.clientWidth - PAD * 2);
      metrics = gridMetrics({ count: view.length, width, tile: st.size, gap: GAP });
      spacer.style.height = `${metrics.height + PAD * 2}px`;
      spacer.style.width = `${metrics.cols * metrics.rowHeight + PAD * 2}px`;
      const win = visibleItems({ count: view.length, metrics, scrollTop: Math.max(0, grid.scrollTop - PAD), viewport: grid.clientHeight, overscan: 2 });
      let html = '';
      for (let i = win.from; i < win.to; i += 1) html += tileOf(view[i], i);
      tiles.innerHTML = html;
      tiles.style.transform = `translate(${PAD}px, ${PAD}px)`;
    }
    function tileOf(row, i) {
      const col = i % metrics.cols, rowIdx = Math.floor(i / metrics.cols);
      const at = `left:${col * metrics.rowHeight}px;top:${rowIdx * metrics.rowHeight}px;width:${metrics.cell}px;height:${metrics.cell}px`;
      const isImage = !row.audio && ['webp', 'png', 'jpg', 'jpeg', 'gif', 'svg'].includes(row.format);
      const media = isImage
        ? `<img src="${assetUrl(row.path)}" alt="" loading="lazy" decoding="async">`
        : `<span class="ast-noimg">${esc((row.audio ? 'audio' : row.format || 'file').toUpperCase())}</span>`;
      const active = row.path === st.path;
      return `<div class="ast-tile${active ? ' is-active' : ''}" data-i="${i}" role="button" tabindex="-1" aria-label="${esc(row.name)}" title="${esc(row.path)}" style="${at}">
        <span class="ast-thumb">${media}</span>
        <span class="ast-cap">${esc(row.name)}</span>
      </div>`;
    }

    // ---------- events ----------
    kinds.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-kind]');
      if (!b) return;
      st.kind = b.dataset.kind;
      renderKinds(); refresh(); writeHash();
    });
    el.querySelectorAll('[data-f]').forEach((sel) => sel.addEventListener('change', () => {
      st[sel.dataset.f] = sel.value;
      refresh(); writeHash();
    }));
    let qTimer = 0;
    q.addEventListener('input', () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { st.q = q.value.trim(); refresh(); writeHash(); }, 120);
    });
    size.addEventListener('input', () => {
      st.size = clampTile(size.value);
      ctx.settings.set('size', st.size);
      renderGrid();
    });
    grid.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(renderGrid);
    });
    // An image that fails to load is counted once (the banner says what to fetch); the tile keeps its place.
    tiles.addEventListener('error', (ev) => {
      if (ev.target.tagName !== 'IMG') return;
      const tile = ev.target.closest('.ast-tile');
      if (tile && !tile.classList.contains('is-missing')) {
        tile.classList.add('is-missing');
        imageMisses += 1;
        renderBanner();
      }
    }, true);
    el.querySelector('.ast-reset').addEventListener('click', () => {
      Object.assign(st, { kind: '', q: '', folder: '', format: '', sort: DEFAULT_SORT });
      q.value = ''; renderKinds(); renderFacets(); refresh(); writeHash();
    });
    const resizer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => renderGrid()) : null;
    resizer?.observe(grid);

    // ---------- deep link ----------
    // The hash names the state a reader needs to come back to it: kind, search, folder, format, sort and path.
    function writeHash() {
      try { history.replaceState(null, '', deepLinkOf(st)); } catch { /* the hash is a convenience */ }
    }
    function applyParams(p) {
      const next = parseDeepLink(p);
      Object.assign(st, { kind: next.kind, q: next.q, folder: next.folder, format: next.format, sort: next.sort, path: next.path });
      q.value = st.q;
      renderKinds(); renderFacets(); refresh(); writeHash();
    }

    load();
    return {
      // The host calls onShow after mount, and again each time the module is opened. A fresh params object
      // is a new visit: its link applies once, and a plain return keeps the state and refreshes the listing.
      onShow() {
        load();
        const p = ctx.params;
        if (!p || p === seenParams) return;
        seenParams = p;
        if (Object.keys(p).length) applyParams(p);
      },
      commands: () => [
        ...KINDS.map((k) => ({ title: `Show ${k.label}`, sub: 'Asset Gallery', run: () => { ctx.openModule('assets', { kind: k.id }); } })),
        { title: 'Clear asset filters', sub: 'Asset Gallery', run: () => { Object.assign(st, { kind: '', q: '', folder: '', format: '', sort: DEFAULT_SORT }); q.value = ''; renderKinds(); renderFacets(); refresh(); writeHash(); } },
      ],
    };
  },
};
