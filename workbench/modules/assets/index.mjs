// workbench/modules/assets/index.mjs — Asset Gallery: every game art file, one virtualised grid.
//
// Left: the filters (folder, format, sort). Top: the kind chips, search and the thumbnail size.
// Centre: the grid. Only the tiles on screen are drawn; each tile's image is the file the Workbench serves at
// /asset-file/<game path>. Right: the detail drawer for the selected file: a zoomable preview, its facts and
// its path. A missing pack is said once, with the command that fetches it.
// The rules, the listing and the deep link are in model.mjs; this file is the DOM and the events.

import {
  KINDS, SORTS, DEFAULT_SORT, rowsOf, tileLabelsOf, kindCounts, facetsOf, filterRows, sortRows, parseDeepLink, deepLinkOf,
  assetUrl, missingPacks, gridMetrics, visibleItems, sizeLabel, dimsLabel, clampZoom, clampOpacity, frameSetOf, groupUsage,
  entityLinkOf, exportOf,
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
          <button type="button" class="ast-compare-btn" disabled>Compare</button>
          <button type="button" class="ast-export" disabled title="Pick files to export them">Export list</button>
        </div>
      </header>
      <section class="ast-compare" aria-label="Compare two assets" hidden>
        <div class="ast-cmp-bar">
          <div class="ast-seg" role="group" aria-label="Compare mode">
            <button type="button" data-mode="side" aria-pressed="true">Side by side</button>
            <button type="button" data-mode="onion" aria-pressed="false">Onion skin</button>
          </div>
          <label class="ast-field ast-onion-field" hidden>Opacity<input type="range" class="ast-onion-op" min="0" max="1" step="0.05" value="0.5"></label>
          <button type="button" class="ast-cmp-close">Close</button>
        </div>
        <div class="ast-cmp-stage" data-mode="side">
          <figure class="ast-cmp-a"><img alt="" draggable="false"><figcaption></figcaption></figure>
          <figure class="ast-cmp-b"><img alt="" draggable="false"><figcaption></figcaption></figure>
        </div>
      </section>
      <div class="ast-packs" hidden></div>
      <div class="ast-narrowbar"><button type="button" class="ast-filter-toggle" aria-expanded="false" aria-controls="ast-filters-pane">Filters</button></div>
      <div class="ast-body">
        <aside class="ast-filters" id="ast-filters-pane" aria-label="Filters">
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
          <div class="ast-actions">
            <button type="button" class="ast-open-entity" hidden>Open in Entity Browser</button>
            <button type="button" class="ast-reveal" title="Show this file's folder in the grid and scroll to it">Reveal path</button>
          </div>
          <section class="ast-frames" aria-label="Frames" hidden>
            <h3>Frames</h3>
            <div class="ast-frame-bar">
              <button type="button" class="ast-frame-prev" aria-label="Previous frame">‹</button>
              <button type="button" class="ast-frame-play" aria-pressed="false">Play</button>
              <button type="button" class="ast-frame-next" aria-label="Next frame">›</button>
              <input type="range" class="ast-frame-range" min="0" value="0" aria-label="Frame">
            </div>
            <p class="ast-frame-label"></p>
          </section>
          <section class="ast-uses" aria-label="Where it is used">
            <h3>Used in</h3>
            <div class="ast-uses-body"><p class="faint">Select a file to search content/ and src/.</p></div>
          </section>
        </aside>
      </div></div>`;
    const $ = (s) => el.querySelector(s);
    const kinds = $('.ast-kinds'), q = $('.ast-q'), size = $('.ast-size'), count = $('.ast-count');
    const packsBox = $('.ast-packs'), grid = $('.ast-grid'), spacer = $('.ast-spacer'), tiles = $('.ast-tiles'), empty = $('.ast-empty');
    const root = $('.ast'), body = $('.ast-body'), drawer = $('.ast-drawer');
    const viewport = $('.ast-viewport'), img = $('.ast-img'), audio = $('.ast-audio'), zlabel = $('.ast-zlabel');

    const st = { kind: '', q: '', folder: '', format: '', sort: DEFAULT_SORT, path: '', size: clampTile(ctx.settings.get('size', TILE_DEFAULT)) };
    // The files picked for comparison, in the order they were picked (exactly two compare).
    const picks = [];
    const compareBtn = $('.ast-compare-btn'), compareBox = $('.ast-compare'), exportBtn = $('.ast-export');
    let all = [], byPath = new Map(), labels = new Map(), view = [], packs = [], missing = null, loadError = '', imageMisses = 0, metrics = null, raf = 0, seenParams = null;
    // `userZoomed` is false while the picture is fitted to the viewport, so a resize refits it; a zoom or pan keeps its place.
    let zoom = { scale: 1, x: 0, y: 0 }, drag = null, userZoomed = false;
    size.value = String(st.size);

    // ---------- loading ----------
    async function load() {
      try {
        const r = await ctx.api('assets/list');
        all = rowsOf(r.files);
        byPath = new Map(all.map((row) => [row.path, row]));
        const tags = tileLabelsOf(all);
        labels = new Map(all.map((row, i) => [row.path, tags[i]]));
        packs = r.packs || [];
        missing = missingPacks(packs);
        loadError = '';
      } catch (err) {
        all = []; byPath = new Map(); labels = new Map(); packs = []; missing = null;
        loadError = err.message || 'The art listing failed.';
      }
      renderKinds(); renderFacets(); renderBanner(); renderPicks(); refresh(); renderDrawer();
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
      // A redraw (a scroll, a resize) replaces the tiles; a focused tile keeps the focus it had.
      const held = document.activeElement?.closest?.('.ast-tile') ? Number(document.activeElement.dataset.i) : null;
      tiles.innerHTML = html;
      tiles.style.transform = `translate(${PAD}px, ${PAD}px)`;
      if (held !== null) tiles.querySelector(`[data-i="${held}"]`)?.focus({ preventScroll: true });
    }
    function tileOf(row, i) {
      const col = i % metrics.cols, rowIdx = Math.floor(i / metrics.cols);
      const at = `left:${col * metrics.rowHeight}px;top:${rowIdx * metrics.rowHeight}px;width:${metrics.cell}px;height:${metrics.cell}px`;
      const isImage = !row.audio && IMAGE_EXT.includes(row.format);
      const media = isImage
        ? `<img src="${assetUrl(row.path)}" alt="" loading="lazy" decoding="async">`
        : `<span class="ast-noimg">${esc((row.audio ? 'audio' : row.format || 'file').toUpperCase())}</span>`;
      const active = row.path === st.path;
      const picked = picks.includes(row.path);
      const label = labels.get(row.path) || row.name;
      return `<div class="ast-tile${active ? ' is-active' : ''}${picked ? ' is-picked' : ''}" data-i="${i}" role="button" tabindex="-1" aria-label="${esc(label)}" title="${esc(row.path)}" style="${at}">
        <span class="ast-thumb">${media}</span>
        <span class="ast-cap">${esc(label)}</span>
        <label class="ast-pick" title="Pick to compare"><input type="checkbox" data-pick="${esc(row.path)}"${picked ? ' checked' : ''}><span class="ast-sr">Pick ${esc(row.name)} to compare</span></label>
      </div>`;
    }

    // ---------- the drawer ----------
    function select(p) {
      st.path = byPath.has(p) ? p : '';
      renderDrawer();
      renderGrid();
      writeHash();
    }
    // Below 1100px (assets.css) the filters and the drawer are overlays: the drawer slides in on a selection.
    const filterToggle = $('.ast-filter-toggle');
    const setFilters = (open) => { root.classList.toggle('filters-open', open); filterToggle.setAttribute('aria-expanded', String(open)); };
    filterToggle.addEventListener('click', () => setFilters(!root.classList.contains('filters-open')));
    function renderDrawer() {
      const row = byPath.get(st.path);
      root.classList.toggle('has-sel', Boolean(row));
      root.classList.toggle('drawer-open', Boolean(row));
      drawer.hidden = !row;
      stopPlay();
      if (!row) { img.removeAttribute('src'); audio.removeAttribute('src'); return; }
      renderUses(row.path);
      renderFrames(row);
      $('.ast-title').textContent = row.name;
      $('.ast-f-format').textContent = row.format ? row.format.toUpperCase() : '—';
      $('.ast-f-size').textContent = sizeLabel(row.bytes);
      $('.ast-f-dims').textContent = dimsLabel(row.w, row.h);
      $('.ast-f-from').textContent = row.from === 'tree' ? 'Tracked in this repository' : `Fetched pack: ${row.from}`;
      $('.ast-f-path code').textContent = row.path;
      el.querySelector('.ast-open-entity').hidden = !entityLinkOf(row.path);
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

    // ---------- frames: a run of numbered files in one folder (an animation strip), stepped and played ----------
    const framesBox = $('.ast-frames'), frameRange = $('.ast-frame-range'), frameLabel = $('.ast-frame-label'), playBtn = $('.ast-frame-play');
    let frames = [], frameAt = 0, playTimer = 0;
    function renderFrames(row) {
      frames = row.audio ? [] : frameSetOf(row.path, all);
      framesBox.hidden = frames.length < 2;
      if (framesBox.hidden) return;
      frameAt = Math.max(0, frames.findIndex((f) => f.path === row.path));
      frameRange.max = String(frames.length - 1);
      showFrame(frameAt);
    }
    function showFrame(i) {
      frameAt = Math.min(frames.length - 1, Math.max(0, i));
      frameRange.value = String(frameAt);
      const f = frames[frameAt];
      frameLabel.textContent = `${frameAt + 1} of ${frames.length} · ${f.name}`;
      img.src = assetUrl(f.path);
    }
    function stopPlay() {
      clearInterval(playTimer); playTimer = 0;
      playBtn.textContent = 'Play'; playBtn.setAttribute('aria-pressed', 'false');
    }
    // Eight frames a second: an animation strip reads as motion at a pace a reader can follow and stop.
    function togglePlay() {
      if (playTimer) { stopPlay(); return; }
      playBtn.textContent = 'Pause'; playBtn.setAttribute('aria-pressed', 'true');
      playTimer = setInterval(() => showFrame((frameAt + 1) % frames.length), 125);
    }
    framesBox.addEventListener('click', (ev) => {
      if (ev.target.closest('.ast-frame-play')) togglePlay();
      else if (ev.target.closest('.ast-frame-prev')) { stopPlay(); showFrame(frameAt - 1); }
      else if (ev.target.closest('.ast-frame-next')) { stopPlay(); showFrame(frameAt + 1); }
    });
    frameRange.addEventListener('input', () => { stopPlay(); showFrame(Number(frameRange.value)); });

    // ---------- used in: where the file's path or name is named in content/ and src/ ----------
    const usesBody = $('.ast-uses-body');
    const usesCache = new Map();
    let usesSeq = 0;
    async function renderUses(p) {
      const seq = ++usesSeq;
      usesBody.innerHTML = '<p class="faint">Searching content/ and src/…</p>';
      let res = usesCache.get(p);
      if (!res) {
        try { res = await ctx.api(`assets/usage?path=${encodeURIComponent(p)}`); usesCache.set(p, res); }
        catch (err) { if (seq === usesSeq) usesBody.innerHTML = `<p class="ast-warn">The search failed: ${esc(err.message)}</p>`; return; }
      }
      if (seq !== usesSeq) return; // a newer selection has taken over
      const groups = groupUsage(res.hits);
      if (!groups.length) { usesBody.innerHTML = '<p class="faint">Not named in content/ or src/.</p>'; return; }
      const lines = groups.reduce((n, g) => n + g.hits.length, 0);
      usesBody.innerHTML = `<p class="faint">${lines} line${lines === 1 ? '' : 's'} in ${groups.length} file${groups.length === 1 ? '' : 's'}${res.truncated ? ' (first 200 shown)' : ''}.</p>` + groups.map((g) => `
        <details class="ast-use"><summary><code>${esc(g.file)}</code> <span class="faint">${g.hits.length}</span></summary>
          <ol>${g.hits.map((h) => `<li><span class="ast-ln">${h.line}</span> <code>${esc(h.text)}</code></li>`).join('')}</ol>
        </details>`).join('');
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
    grid.addEventListener('click', (ev) => {
      const box = ev.target.closest('input[data-pick]');
      if (box) { togglePick(box.dataset.pick, box.checked); grid.focus({ preventScroll: true }); return; }
      if (ev.target.closest('.ast-pick')) return;
      const t = ev.target.closest('.ast-tile');
      // The tiles are redrawn on a selection, so focus goes to the grid, where the arrow keys and Escape are heard.
      if (t) { select(view[Number(t.dataset.i)]?.path || ''); grid.focus({ preventScroll: true }); }
    });

    // ---------- compare: two picked images, side by side or one over the other ----------
    function togglePick(p, on) {
      const at = picks.indexOf(p);
      if (on && at < 0) picks.push(p);
      if (!on && at >= 0) picks.splice(at, 1);
      renderPicks();
      renderGrid();
    }
    function renderPicks() {
      const ok = picks.length === 2 && picks.every((p) => byPath.get(p) && !byPath.get(p).audio);
      compareBtn.disabled = !ok;
      compareBtn.textContent = picks.length ? `Compare (${picks.length})` : 'Compare';
      compareBtn.title = ok ? 'Compare the two picked images' : 'Pick two images (tick their boxes) to compare';
      exportBtn.disabled = picks.length === 0;
      exportBtn.textContent = picks.length ? `Export list (${picks.length})` : 'Export list';
    }
    // The picked files as JSON (path, kind, format, dimensions), the list Unity and Unreal import.
    function exportPicks() {
      const rows = picks.map((p) => byPath.get(p)).filter(Boolean);
      if (!rows.length) return;
      const data = exportOf(rows, { exported: new Date().toISOString() });
      const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'ashen-assets.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ctx.toast({ title: `Exported ${rows.length} file${rows.length === 1 ? '' : 's'}`, record: false, timeout: 1800 });
    }
    exportBtn.addEventListener('click', exportPicks);
    // Scrolls the grid until the tile at view index `at` is on screen, draws it, and focuses it.
    function focusIndex(at) {
      if (!metrics || at < 0 || at >= view.length) return;
      const top = PAD + Math.floor(at / metrics.cols) * metrics.rowHeight;
      const bottom = top + metrics.cell;
      if (top < grid.scrollTop) grid.scrollTop = top - PAD;
      else if (bottom > grid.scrollTop + grid.clientHeight) grid.scrollTop = bottom - grid.clientHeight + PAD;
      renderGrid();
      tiles.querySelector(`[data-i="${at}"]`)?.focus({ preventScroll: true });
    }
    // Reveal path: the file's folder becomes the folder filter, the grid scrolls to its tile and focuses it.
    function reveal(p) {
      const row = byPath.get(p);
      if (!row) return;
      if (!filterRows([row], st).length) { st.kind = ''; st.q = ''; st.format = ''; q.value = ''; }
      st.folder = row.folder;
      renderKinds(); renderFacets(); refresh();
      focusIndex(view.findIndex((r) => r.path === p));
      writeHash();
    }
    // Arrow keys move the focus through the grid a tile at a time (a row at a time up and down); Enter selects it.
    grid.addEventListener('keydown', (ev) => {
      const cur = document.activeElement?.closest?.('.ast-tile') ? Number(document.activeElement.dataset.i) : -1;
      if ((ev.key === 'Enter' || ev.key === ' ') && cur >= 0) {
        ev.preventDefault();
        select(view[cur].path);
        grid.focus({ preventScroll: true }); // the tile is redrawn by the selection; focus stays in the grid
        return;
      }
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: metrics?.cols || 1, ArrowUp: -(metrics?.cols || 1) }[ev.key];
      if (!step || !view.length) return;
      ev.preventDefault();
      // From the grid itself (no tile focused yet), the first arrow lands on the selected tile, or the first one.
      const from = cur >= 0 ? cur + step : Math.max(0, view.findIndex((r) => r.path === st.path));
      focusIndex(Math.min(view.length - 1, Math.max(0, from)));
    });
    // Escape closes the open overlay: the compare view, then the filters, then the drawer.
    root.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape' || !compareBox.hidden) return;
      if (root.classList.contains('filters-open')) { setFilters(false); filterToggle.focus(); }
      else if (root.classList.contains('drawer-open')) select('');
    });
    el.querySelector('.ast-reveal').addEventListener('click', () => reveal(st.path));
    // Equipment art maps to its entity: the Entity Browser opens on it (its own deep link: kind and id).
    el.querySelector('.ast-open-entity').addEventListener('click', () => {
      const link = entityLinkOf(st.path);
      if (link) ctx.openModule('entities', link);
    });
    function openCompare() {
      if (picks.length !== 2) return;
      const [a, b] = picks.map((p) => byPath.get(p));
      const figs = compareBox.querySelectorAll('figure');
      figs[0].querySelector('img').src = assetUrl(a.path);
      figs[1].querySelector('img').src = assetUrl(b.path);
      figs[0].querySelector('figcaption').textContent = `${a.name} · ${a.w && a.h ? `${a.w}×${a.h}` : 'size unknown'}`;
      figs[1].querySelector('figcaption').textContent = `${b.name} · ${b.w && b.h ? `${b.w}×${b.h}` : 'size unknown'}`;
      compareBox.hidden = false;
      compareBox.querySelector('.ast-cmp-close').focus();
    }
    function closeCompare() { compareBox.hidden = true; }
    compareBtn.addEventListener('click', openCompare);
    compareBox.querySelector('.ast-cmp-close').addEventListener('click', closeCompare);
    compareBox.querySelector('.ast-seg').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-mode]');
      if (!b) return;
      const mode = b.dataset.mode;
      compareBox.querySelector('.ast-cmp-stage').dataset.mode = mode;
      compareBox.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mode === mode)));
      compareBox.querySelector('.ast-onion-field').hidden = mode !== 'onion';
    });
    const onionOp = compareBox.querySelector('.ast-onion-op');
    const setOnion = () => { compareBox.querySelector('.ast-cmp-b img').style.opacity = String(clampOpacity(onionOp.value)); };
    onionOp.addEventListener('input', setOnion);
    setOnion();
    // Escape closes the compare view alone: the event stops here, so the drawer and the filters keep their state.
    compareBox.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); closeCompare(); } });
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
      // The host calls onHide when another module opens: the audio stops and the frame timer is cleared.
      onHide() {
        audio.pause();
        stopPlay();
      },
      commands: () => [
        ...KINDS.map((k) => ({ title: `Show ${k.label}`, sub: 'Asset Gallery', run: () => { ctx.openModule('assets', { kind: k.id }); } })),
        { title: 'Clear asset filters', sub: 'Asset Gallery', run: () => { Object.assign(st, { kind: '', q: '', folder: '', format: '', sort: DEFAULT_SORT }); q.value = ''; renderKinds(); renderFacets(); refresh(); writeHash(); } },
      ],
    };
  },
};
