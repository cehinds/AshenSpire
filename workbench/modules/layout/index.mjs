// workbench/modules/layout/index.mjs — Layout Studio. The first mode is "UI
// config": the wireframes of content/config/ui drawn as regions on the shared
// canvas kit, at a chosen device and orientation. The other modes (Sketch,
// Battlefield, Deck row, SP orb, Book recipes, Card layers) are listed and
// disabled until their work lands. Rules and the mapping from a canvas edit to
// config values are in config-model.mjs; this file is the view and the gestures.
import { icon } from '../../ui/icons.mjs';
import { createCanvas, createLayersPanel, createInspector } from '../../ui/kit/canvas.mjs';
import * as C from './config-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = ['/ui/kit/canvas.css', '/modules/layout/layout.css'];
const ZOOM_STEP = 1.25;
const ALIGN = [['left', 'Align left'], ['center', 'Align centre'], ['right', 'Align right'], ['top', 'Align top'], ['middle', 'Align middle'], ['bottom', 'Align bottom']];
const MODES = [
  { id: 'config', label: 'UI config' },
  { id: 'sketch', label: 'Sketch' },
  { id: 'battlefield', label: 'Battlefield' },
  { id: 'deck-row', label: 'Deck row' },
  { id: 'sp-orb', label: 'SP orb' },
  { id: 'book-recipes', label: 'Book recipes' },
  { id: 'card-layers', label: 'Card layers' },
];

function ensureCss() {
  for (const href of CSS) {
    if (document.querySelector(`link[data-href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.href = href;
    document.head.append(link);
  }
}

const SHELL = `<div class="lay">
  <div class="lay-modes" role="tablist" aria-label="Layout Studio modes">${MODES.map((m) => `<button type="button" role="tab" data-mode="${m.id}" aria-selected="${m.id === 'config'}"${m.id === 'config' ? '' : ' disabled title="Coming next"'}>${esc(m.label)}${m.id === 'config' ? '' : '<span class="lay-soon">coming next</span>'}</button>`).join('')}</div>
  <div class="lay-bar">
    <label class="lay-field">Wireframe <select data-act="wireframe"></select></label>
    <label class="lay-field">Device <select data-act="device"></select></label>
    <button type="button" class="btn btn-sm btn-ghost" data-act="rotate" title="Rotate the device">${icon('reload')}Rotate</button>
    <span class="lay-sep"></span>
    <button type="button" class="btn btn-sm btn-ghost" data-act="zoom-out" title="Zoom out (-)">−</button>
    <button type="button" class="btn btn-sm btn-ghost" data-act="fit" title="Fit to the page (0)">Fit</button>
    <button type="button" class="btn btn-sm btn-ghost" data-act="zoom-in" title="Zoom in (+)">+</button>
    <label class="lay-check"><input type="checkbox" data-act="snap"> Snap</label>
    <label class="lay-check"><input type="checkbox" data-act="grid"> Grid</label>
    <span class="lay-sep"></span>
    <span class="lay-align">${ALIGN.map(([edge, label]) => `<button type="button" class="btn btn-sm btn-ghost" data-align="${edge}" title="${label}" disabled>${esc(label.replace('Align ', ''))}</button>`).join('')}
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="horizontal" title="Distribute horizontally" disabled>Dist H</button>
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="vertical" title="Distribute vertically" disabled>Dist V</button></span>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm" data-act="preview" title="Show the game's preview at this wireframe">Preview at this device</button>
    <button type="button" class="btn btn-sm btn-primary" data-act="review" disabled>Review changes</button>
  </div>
  <div class="lay-body">
    <aside class="lay-left"><div class="lay-layers"></div></aside>
    <main class="lay-center"><div class="lay-canvas"><p class="lay-hint">Loading the UI config files…</p></div><div class="lay-status" aria-live="polite"></div></main>
    <aside class="lay-right"><div class="lay-insp"></div><div class="lay-fields"></div></aside>
  </div>
</div>`;

export default {
  mount(el, ctx) {
    ensureCss();
    el.innerHTML = SHELL;
    const $ = (sel) => el.querySelector(sel);
    const settings = C.defaultSettings();
    const st = {
      settings,
      wireframeId: settings.wireframes[0].id,
      deviceId: 'desk-1280',
      orientation: 'auto',
      freeSize: { width: 1024, height: 768 },
      files: null,
      canvas: null,
      layers: null,
      inspector: null,
      view: null,
      loadError: null,
    };
    const wireframe = () => C.wireframeById(st.settings, st.wireframeId);
    const device = () => st.settings.devices.find((d) => d.id === st.deviceId) || st.settings.devices[0];
    const viewport = () => C.viewportOf(device(), { orientation: st.orientation, freeSize: st.freeSize });
    const activeFile = () => (st.files ? st.files.get(wireframe().file) || null : null);
    const dirtyCount = () => (st.files ? C.changesFor(st.files).length : 0);

    // ---- drawing -------------------------------------------------------

    function computeView() {
      const vp = viewport();
      const { regions, layout, breakpoint } = st.files
        ? C.regionsFor({ wireframe: wireframe(), files: st.files, viewport: vp, settings: st.settings })
        : { regions: [], layout: null, breakpoint: null };
      st.view = { vp, regions, layout, breakpoint };
      return st.view;
    }

    /** Rebuild the canvas from the config (after a load, a pick, or any config change). */
    function rebuild({ fit = false } = {}) {
      const v = computeView();
      if (!st.canvas) return;
      st.canvas.setDoc(C.canvasDocFor(v.vp, v.regions));
      if (fit) st.canvas.fit();
      paintBar();
      paintStatus();
    }

    function paintBar() {
      const wfSel = $('[data-act="wireframe"]');
      wfSel.innerHTML = st.settings.wireframes.map((w) => {
        const f = st.files ? st.files.get(w.file) : null;
        const mark = f && C.isDirty(f) ? ' •' : '';
        const missing = st.files && !f ? ' (missing)' : '';
        return `<option value="${esc(w.id)}"${w.id === st.wireframeId ? ' selected' : ''}>${esc(w.label)}${mark}${missing}</option>`;
      }).join('');
      const devSel = $('[data-act="device"]');
      const enabled = st.settings.devices.filter((d) => d.enabled !== false || d.id === st.deviceId);
      devSel.innerHTML = enabled.map((d) => `<option value="${esc(d.id)}"${d.id === st.deviceId ? ' selected' : ''}>${esc(d.label)}</option>`).join('');
      const snap = $('[data-act="snap"]'), grid = $('[data-act="grid"]');
      if (st.canvas) { snap.checked = st.settings.grid.snap; grid.checked = st.settings.grid.show; }
      const n = dirtyCount();
      const review = $('[data-act="review"]');
      review.disabled = n === 0;
      review.textContent = `Review changes (${n})`;
      const hasSel = st.canvas ? st.canvas.getSelection().length : 0;
      for (const b of el.querySelectorAll('[data-align]')) b.disabled = hasSel < 1;
      for (const b of el.querySelectorAll('[data-distribute]')) b.disabled = hasSel < 3;
    }

    function paintStatus() {
      const v = st.view || computeView();
      const lay = v.layout;
      const parts = [`${v.vp.width}×${v.vp.height}`, lay ? `game ${lay.mode}, zoom ${lay.zoom}` : '', v.breakpoint ? `breakpoint ${v.breakpoint.label}` : 'no breakpoint'];
      if (st.loadError) parts.unshift(st.loadError);
      $('.lay-status').textContent = parts.filter(Boolean).join(' · ');
    }

    // ---- gestures (config edits arrive in the next step) ----------------

    function onCanvasChange() {
      // Until the config mapping lands, a canvas gesture is reverted to the config.
      rebuild();
    }

    function ensureCanvas() {
      if (st.canvas) return;
      const host = $('.lay-canvas');
      host.innerHTML = '';
      st.canvas = createCanvas(host, {
        doc: { width: 800, height: 600, items: [] },
        snap: st.settings.grid.snap,
        grid: { size: st.settings.grid.sizePx, subdivisions: st.settings.grid.subdivisions, show: st.settings.grid.show },
        rulers: st.settings.canvas.showRulers !== false,
        onChange: onCanvasChange,
        onSelect: () => { paintBar(); paintStatus(); },
      });
      st.layers = createLayersPanel($('.lay-layers'), st.canvas);
      st.inspector = createInspector($('.lay-insp'), st.canvas, []);
      st.canvas.subscribe(() => paintBar());
    }

    // ---- toolbar -------------------------------------------------------

    function onBarChange(e) {
      const act = e.target.dataset.act;
      if (act === 'wireframe') { st.wireframeId = e.target.value; rebuild({ fit: true }); }
      else if (act === 'device') { st.deviceId = e.target.value; st.orientation = 'auto'; rebuild({ fit: true }); }
      else if (act === 'snap') { st.settings.grid.snap = e.target.checked; st.canvas?.setSnap(e.target.checked); }
      else if (act === 'grid') { st.settings.grid.show = e.target.checked; st.canvas?.setGrid(e.target.checked); }
    }

    function onBarClick(e) {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled || !st.canvas) return;
      if (btn.dataset.align) { st.canvas.align(btn.dataset.align); return; }
      if (btn.dataset.distribute) { st.canvas.distribute(btn.dataset.distribute); return; }
      const act = btn.dataset.act;
      if (act === 'zoom-in') st.canvas.zoomTo(st.canvas.getZoom() * ZOOM_STEP);
      else if (act === 'zoom-out') st.canvas.zoomTo(st.canvas.getZoom() / ZOOM_STEP);
      else if (act === 'fit') st.canvas.fit();
      else if (act === 'rotate') rotate();
    }

    function rotate() {
      const d = device();
      if (d.resizable) st.freeSize = { width: st.freeSize.height, height: st.freeSize.width };
      else {
        const now = st.orientation === 'auto' ? C.naturalOrientation(d) : st.orientation;
        st.orientation = now === 'portrait' ? 'landscape' : 'portrait';
      }
      rebuild({ fit: true });
    }

    el.querySelector('.lay-bar').addEventListener('change', onBarChange);
    el.querySelector('.lay-bar').addEventListener('click', onBarClick);

    // ---- load ------------------------------------------------------------

    async function load() {
      try {
        const { files, truncated } = await C.loadWorkspace(ctx.api);
        st.files = files;
        if (truncated) st.loadError = 'The file list was cut short';
        const bad = [...files.values()].filter((f) => f.error);
        if (bad.length) st.loadError = `${bad.length} file(s) are not valid JSON: ${bad.map((f) => f.rel).join(', ')}`;
        ensureCanvas();
        rebuild({ fit: true });
        if (!st.view.regions.length && !activeFile()) {
          $('.lay-canvas').insertAdjacentHTML('afterbegin', `<p class="lay-hint">${esc(C.configPath(wireframe().file))} was not found. Pick another wireframe.</p>`);
        }
      } catch (err) {
        $('.lay-canvas').innerHTML = `<p class="lay-hint is-error">Could not load the UI config files: ${esc(err.message)}</p>`;
        ctx.toast({ kind: 'error', title: 'Layout Studio did not load', detail: err.message });
      }
    }

    load();

    return {
      onShow() { if (st.canvas) { paintBar(); paintStatus(); } },
      commands: () => [
        { title: 'Fit the wireframe to the page', sub: '0', run: () => st.canvas?.fit() },
        { title: 'Rotate the device', sub: 'Layout Studio', run: () => rotate() },
      ],
    };
  },
};
