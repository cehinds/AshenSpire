// workbench/modules/assets/index.mjs — Asset Gallery: every game art file, one virtualised grid.
//
// Left: the filters (folder, format, sort). Top: the kind chips, search and the thumbnail size.
// Centre: the grid. Only the tiles on screen are drawn; each tile's image is the file the Workbench serves at
// /asset-file/<game path>. Right: the detail drawer for the selected file: a zoomable preview, its facts and
// its path. A missing pack is said once, with the command that fetches it.
// The rules, the listing and the deep link are in model.mjs; this file is the DOM and the events.

import {
  KINDS, SORTS, DEFAULT_SORT, rowsOf, kindCounts, facetsOf, filterRows, sortRows, parseDeepLink, deepLinkOf,
  assetUrl, missingPacks, gridMetrics, visibleItems, formatOf, sizeLabel, dimsLabel, clampZoom,
} from './model.mjs';

const TILE_MIN = 64;
const TILE_MAX = 256;
const TILE_DEFAULT = 128;
const GAP = 8;
const PAD = 12;
const IMAGE_EXT = ['webp', 'png', 'jpg', 'jpeg', 'gif', 'svg'];
const BACKDROPS = [['checker', 'Checker'], ['light', 'Light'], ['dark', 'Dark']];

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
        <aside class="ast-drawer" aria-label="Selected asset" hidden>
          <div class="ast-drawer-head"><h2 class="ast-title"></h2><button type="button" class="ast-drawer-close">Close</button></div>
          <div class="ast-viewport bg-checker" tabindex="0" aria-label="Preview: wheel or buttons to zoom, drag to pan">
            <img class="ast-img" alt="" draggable="false">
            <audio class="ast-audio" controls preload="none"></audio>
          </div>
          <div class="ast-zoombar">
            <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
            <span class="ast-zlabel">100%</span>
            <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
            <button type="button" data-zoom="fit">Fit</button>
            <button type="button" data-zoom="1">1:1</button>
            <label class="ast-field">Backdrop<select class="ast-backdrop">${BACKDROPS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
          </div>
          <dl class="ast-facts">
            <dt>Format</dt><dd class="ast-f-format"></dd>
            <dt>Size</dt><dd class="ast-f-size"></dd>
            <dt>Dimensions</dt><dd class="ast-f-dims"></dd>
            <dt>From</dt><dd class="ast-f-from"></dd>
            <dt>Path</dt><dd class="ast-f-path"><code></code> <button type="button" class="ast-copy">Copy path</button></dd>
          </dl>
        </aside>
      </div></div>`;
    const $ = (s) => el.querySelector(s);
    const kinds = $('.ast-kinds'), q = $('.ast-q'), size = $('.ast-size'), count = $('.ast-count');
    const packsBox = $('.ast-packs'), grid = $('.ast-grid'), spacer = $('.ast-spacer'), tiles = $('.ast-tiles'), empty = $('.ast-empty');
    const root = $('.ast'), body = $('.ast-body'), drawer = $('.ast-drawer');
    const viewport = $('.ast-viewport'), img = $('.ast-img'), audio = $('.ast-audio'), zlabel = $('.ast-zlabel');

    const st = { kind: '', q: '', folder: '', format: '', sort: DEFAULT_SORT, path: '', size: clampTile(ctx.settings.get('size', TILE_DEFAULT)) };
    let all = [], byPath = new Map(), view = [], packs = [], missing = null, loadError = '', imageMisses = 0, metrics = null, raf = 0, seenParams = null;
    // `userZoomed` is false while the picture is fitted to the viewport, so a resize refits it; a zoom or pan keeps its place.
    let zoom = { scale: 1, x: 0, y: 0 }, drag = null, userZoomed = false;
    size.value = String(st.size);

    // ---------- loading ----------
    async function load() {
      try {
        const r = await ctx.api('assets/list');
        all = rowsOf(r.files);
        byPath = new Map(all.map((row) => [row.path, row]));
        packs = r.packs || [];
        missing = missingPacks(packs);
        loadError = '';
      } catch (err) {
        all = []; byPath = new Map(); packs = []; missing = null;
        loadError = err.message || 'The art listing failed.';
      }
      renderKinds(); renderFacets(); renderBanner(); refresh(); renderDrawer();
    }

    // ---------- chips, facets, banner ----------
    function renderKinds() {
      const counts = kindCounts(all);
      kinds.innerHTML = [{ id: '', label: 'All', count: all.length }, ...counts].map((k) => `<button type="button" data-kind="${esc(k.id)}" aria-pressed="${String(k.id === st.kind)}"><span>${esc(k.label)}</span><span class="ast-n">${k.count}</span></button>`).join('');
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
      const isImage = !row.audio && IMAGE_EXT.includes(row.format);
      const media = isImage
        ? `<img src="${assetUrl(row.path)}" alt="" loading="lazy" decoding="async">`
        : `<span class="ast-noimg">${esc((row.audio ? 'audio' : row.format || 'file').toUpperCase())}</span>`;
      const active = row.path === st.path;
      return `<div class="ast-tile${active ? ' is-active' : ''}" data-i="${i}" role="button" tabindex="-1" aria-label="${esc(row.name)}" title="${esc(row.path)}" style="${at}">
        <span class="ast-thumb">${media}</span>
        <span class="ast-cap">${esc(row.name)}</span>
      </div>`;
    }

    // ---------- the drawer ----------
    function select(p) {
      st.path = byPath.has(p) ? p : '';
      renderDrawer();
      renderGrid();
      writeHash();
    }
    function renderDrawer() {
      const row = byPath.get(st.path);
      root.classList.toggle('has-sel', Boolean(row));
      drawer.hidden = !row;
      if (!row) { img.removeAttribute('src'); audio.removeAttribute('src'); return; }
      $('.ast-title').textContent = row.name;
      $('.ast-f-format').textContent = row.format ? row.format.toUpperCase() : '—';
      $('.ast-f-size').textContent = sizeLabel(row.bytes);
      $('.ast-f-dims').textContent = dimsLabel(row.w, row.h);
      $('.ast-f-from').textContent = row.from === 'tree' ? 'Tracked in this repository' : `Fetched pack: ${row.from}`;
      $('.ast-f-path code').textContent = row.path;
      img.hidden = row.audio;
      audio.hidden = !row.audio;
      if (row.audio) { audio.src = assetUrl(row.path); zoomBar(false); }
      else {
        audio.removeAttribute('src'); zoomBar(true);
        userZoomed = false;
        img.src = assetUrl(row.path);
        if (img.complete && img.naturalWidth) fit();
      }
    }
    function zoomBar(on) { el.querySelectorAll('.ast-zoombar button, .ast-zoombar select').forEach((c) => { c.disabled = !on; }); }
    // The image is drawn at its own size and moved by a transform, so zoom and pan never reflow the page.
    function applyZoom() {
      const s = zoom.scale;
      img.style.width = img.naturalWidth ? `${img.naturalWidth}px` : '';
      img.style.height = img.naturalHeight ? `${img.naturalHeight}px` : '';
      img.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${s})`;
      img.style.imageRendering = s >= 2 ? 'pixelated' : 'auto';
      zlabel.textContent = `${Math.round(s * 100)}%`;
    }
    function fit() {
      const vw = viewport.clientWidth, vh = viewport.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !nh || !vw || !vh) return;
      const s = clampZoom(Math.min(vw / nw, vh / nh));
      zoom = { scale: s, x: (vw - nw * s) / 2, y: (vh - nh * s) / 2 };
      applyZoom();
    }
    // Zoom about a point of the viewport, so the pixel under the pointer stays put.
    function zoomAt(px, py, next) {
      const s = clampZoom(next);
      const k = s / zoom.scale;
      zoom = { scale: s, x: px - (px - zoom.x) * k, y: py - (py - zoom.y) * k };
      userZoomed = true;
      applyZoom();
    }
    function zoomBy(factor) { zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, zoom.scale * factor); }
    img.addEventListener('load', () => { if (!img.hidden && !userZoomed) fit(); });
    new ResizeObserver(() => { if (!drawer.hidden && !userZoomed) fit(); }).observe(viewport);
    viewport.addEventListener('wheel', (ev) => {
      if (img.hidden) return;
      ev.preventDefault();
      const rect = viewport.getBoundingClientRect();
      zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, zoom.scale * (ev.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
    viewport.addEventListener('pointerdown', (ev) => {
      if (img.hidden || ev.target === audio) return;
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, ox: zoom.x, oy: zoom.y };
      viewport.setPointerCapture(ev.pointerId);
      viewport.classList.add('is-panning');
    });
    viewport.addEventListener('pointermove', (ev) => {
      if (!drag || drag.id !== ev.pointerId) return;
      userZoomed = true;
      zoom = { ...zoom, x: drag.ox + ev.clientX - drag.x, y: drag.oy + ev.clientY - drag.y };
      applyZoom();
    });
    const endDrag = (ev) => { if (drag && drag.id === ev.pointerId) { drag = null; viewport.classList.remove('is-panning'); } };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    el.querySelector('.ast-zoombar').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-zoom]');
      if (!b || b.disabled) return;
      if (b.dataset.zoom === 'in') zoomBy(1.25);
      else if (b.dataset.zoom === 'out') zoomBy(1 / 1.25);
      else if (b.dataset.zoom === 'fit') { userZoomed = false; fit(); }
      else zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1);
    });
    $('.ast-backdrop').addEventListener('change', (ev) => {
      for (const [v] of BACKDROPS) viewport.classList.toggle(`bg-${v}`, ev.target.value === v);
    });
    $('.ast-copy').addEventListener('click', async () => {
      const p = st.path;
      if (!p) return;
      try {
        await navigator.clipboard.writeText(p);
        ctx.toast({ title: 'Path copied', detail: p, record: false, timeout: 1600 });
      } catch {
        ctx.toast({ kind: 'warn', title: 'Could not copy the path', detail: p, record: false });
      }
    });
    $('.ast-drawer-close').addEventListener('click', () => select(''));

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
    grid.addEventListener('click', (ev) => {
      const t = ev.target.closest('.ast-tile');
      if (t) select(view[Number(t.dataset.i)]?.path || '');
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
      renderKinds(); renderFacets(); refresh(); renderDrawer(); writeHash();
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
