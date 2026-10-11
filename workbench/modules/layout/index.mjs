// workbench/modules/layout/index.mjs — Layout Studio. The first mode is "UI
// config": the wireframes of content/config/ui drawn as regions on the shared
// canvas kit, at a chosen device and orientation. The other modes (Sketch,
// Battlefield, Deck row, SP orb, Book recipes, Card layers) are listed and
// disabled until their work lands. Rules and the mapping from a canvas edit to
// config values are in config-model.mjs; this file is the view and the gestures.
import { icon } from '../../ui/icons.mjs';
import { saveFailure } from '../../ui/logic.mjs';
import { createCanvas, createLayersPanel, createInspector } from '../../ui/kit/canvas.mjs';
import * as C from './config-model.mjs';
import * as M from './studio-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// The kit stylesheet is linked by index.html; only the module's own sheet is injected here.
const CSS = ['/modules/layout/layout.css'];
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
    <button type="button" class="btn btn-sm lay-toggle" data-panel="layers" aria-expanded="false" aria-controls="lay-layers-pane">Layers</button>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="props" aria-expanded="false" aria-controls="lay-props-pane">Inspector</button>
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
    <span class="lay-align" title="Off in UI config: the layout places regions, so align and distribute would not save">${ALIGN.map(([edge, label]) => `<button type="button" class="btn btn-sm btn-ghost" data-align="${edge}" title="${label}" disabled>${esc(label.replace('Align ', ''))}</button>`).join('')}
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="horizontal" title="Distribute horizontally" disabled>Dist H</button>
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="vertical" title="Distribute vertically" disabled>Dist V</button></span>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm" data-act="preview" title="Show the game's preview at this wireframe">Preview at this device</button>
    <button type="button" class="btn btn-sm btn-primary" data-act="review" disabled>Review changes</button>
  </div>
  <div class="lay-body">
    <aside class="lay-left" id="lay-layers-pane"><div class="lay-panel-head"><span>Layers</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="lay-layers"></div></aside>
    <main class="lay-center"><div class="lay-canvas"><p class="lay-hint">Loading the UI config files…</p></div><div class="lay-status" aria-live="polite"></div></main>
    <aside class="lay-right" id="lay-props-pane"><div class="lay-panel-head"><span>Inspector</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="lay-insp"></div><div class="lay-fields"></div></aside>
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
      // A hidden view measures as zero, so a fit waits until the module shows.
      if (fit) { if (el.clientWidth) st.canvas.fit(); else st.fitPending = true; }
      paintBar();
      paintStatus();
      paintFields();
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
      // UI config: the layout places regions, so align and distribute are off (they would move regions).
      for (const b of el.querySelectorAll('[data-align], [data-distribute]')) b.disabled = true;
    }

    /** The config values the selected region owns, each editable in place; a $name shows its value as a chip. */
    function paintFields() {
      const box = $('.lay-fields');
      const f = activeFile(), v = st.view;
      const ids = st.canvas ? st.canvas.getSelection() : [];
      if (!f || !f.data || !v) { box.innerHTML = ''; return; }
      if (ids.length !== 1) {
        box.innerHTML = `<p class="lay-note">${ids.length ? `${ids.length} regions selected. Select one to see its config values.` : 'Select a region to see the config values it owns.'}</p>`;
        return;
      }
      const region = v.regions.find((r) => r.id === ids[0]);
      if (!region) { box.innerHTML = ''; return; }
      const tokens = (st.files.get(C.TOKENS)?.data?.vars) || {};
      const paths = C.pathsOf(region, f.data);
      const rows = paths.map((path) => {
        const value = M.getPath(f.data, path);
        const key = esc(path);
        let control;
        if (typeof value === 'number') control = `<span><input type="number" step="any" data-path="${key}" value="${esc(value)}"> <span class="lay-unit">${esc(M.unitOf(path))}</span></span>`;
        else if (M.isFraction(value)) control = `<span class="lay-note">fraction ${esc(value.numerator)}/${esc(value.denominator)}, edit in the file</span>`;
        else if (M.isRef(value)) {
          const ref = C.refInfo(value, f.data, tokens);
          const chip = ref.from === 'missing' ? 'unknown' : `= ${Number.isFinite(ref.value) ? ref.value : 'NaN'} (${ref.from})`;
          control = `<span><input type="text" data-path="${key}" value="${esc(value)}"> <span class="lay-chip${ref.from === 'missing' ? ' is-missing' : ''}">${esc(chip)}</span></span>`;
        } else if (typeof value === 'string') control = `<span><input type="text" data-path="${key}" value="${esc(value)}"></span>`;
        else control = `<span class="lay-note">${esc(M.leafKind(value))}</span>`;
        return `<div class="lay-row"><code title="${key}">${esc(path)}</code>${control}</div>`;
      }).join('');
      const note = region.edit ? 'Drag its edge on the canvas, or type a value here.' : 'No config value drags here. Its size follows the others.';
      box.innerHTML = `<h3>${esc(region.label)}</h3><p class="lay-note">${esc(note)}</p>${rows || '<p class="lay-note">This region owns no config value.</p>'}`;
    }

    function onFieldChange(e) {
      const input = e.target;
      const path = input.dataset ? input.dataset.path : null;
      const f = activeFile();
      if (!path || !f || !f.data) return;
      if (input.value === '') { paintFields(); return; }
      const value = input.type === 'number' ? Number(input.value) : C.fieldValue(input.value, M.getPath(f.data, path));
      if (typeof value === 'number' && !Number.isFinite(value)) { paintFields(); return; }
      setFileData(f.rel, C.setConfigValue(f.data, path, value), `Set ${path}`);
    }

    function paintStatus() {
      const v = st.view || computeView();
      const lay = v.layout;
      const parts = [`${v.vp.width}×${v.vp.height}`, lay ? `game ${lay.mode}, zoom ${lay.zoom}` : '', v.breakpoint ? `breakpoint ${v.breakpoint.label}` : 'no breakpoint'];
      if (st.loadError) parts.unshift(st.loadError);
      $('.lay-status').textContent = parts.filter(Boolean).join(' · ');
    }

    // ---- gestures (config edits arrive in the next step) ----------------

    /**
     * Set a file's draft data as one history step. The data is replaced, never
     * mutated, so the step can hold the old and the new tree; undo and redo put
     * the file back and redraw from it.
     */
    function setFileData(rel, next, label) {
      const f = st.files.get(rel);
      if (!f || !f.data) return false;
      const prev = f.data;
      if (JSON.stringify(prev) === JSON.stringify(next)) return false;
      const put = (data) => { f.data = data; rebuild(); };
      put(next);
      ctx.history.push({ label, before: prev, after: next, undo: () => put(prev), redo: () => put(next) });
      return true;
    }

    /** One finished canvas gesture: map its geometry back to the config and record one step. */
    function onCanvasChange(doc, change) {
      const f = activeFile();
      const v = st.view;
      if (!f || !f.data || !v) { rebuild(); return; }
      const report = C.canvasEditReport({ data: f.data, regions: v.regions, items: doc.items, viewport: v.vp, grid: st.settings.grid });
      setFileData(f.rel, report.data, change.label);
      rebuild();
      if (report.notes.length) placedByLayout(report.notes);
    }

    /** A gesture that maps to no config change: the region snaps back (rebuild) and the user is told why. */
    function placedByLayout(notes) {
      ctx.toast({ kind: 'warn', title: 'Regions in UI config are positioned by the layout; drag an edge to resize', detail: notes.map((n) => n.label).join(', ') });
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
        onSelect: () => { paintBar(); paintStatus(); paintFields(); },
      });
      // Until the user zooms by hand, the page stays fitted as the panels and the dock resize.
      st.autoFit = true;
      new ResizeObserver(() => { if (st.autoFit && st.canvas && $('.lay-canvas').clientWidth) st.canvas.fit(); }).observe($('.lay-canvas'));
      st.layers = createLayersPanel($('.lay-layers'), st.canvas);
      st.inspector = createInspector($('.lay-insp'), st.canvas, []);
      $('.lay-fields').addEventListener('change', onFieldChange);
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
      if (!btn || btn.disabled) return;
      if (btn.dataset.act === 'review') { openReview(); return; }
      if (btn.dataset.act === 'preview') { previewHere(); return; }
      if (!st.canvas) return;
      if (btn.dataset.align) { st.canvas.align(btn.dataset.align); return; }
      if (btn.dataset.distribute) { st.canvas.distribute(btn.dataset.distribute); return; }
      const act = btn.dataset.act;
      if (act === 'zoom-in') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() * ZOOM_STEP); }
      else if (act === 'zoom-out') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() / ZOOM_STEP); }
      else if (act === 'fit') { st.autoFit = true; st.canvas.fit(); }
      else if (act === 'rotate') rotate();
    }

    /** The game preview shows this wireframe's ?shot fixture; the dock device is the user's to set. */
    function previewHere() {
      const wf = wireframe();
      const v = viewport();
      ctx.preview.setOverride('shot', wf.shot || null);
      ctx.preview.reload();
      ctx.toast({ kind: 'info', title: `Previewing ${wf.label}`, detail: `Fixture ${wf.shot || 'default'}. Set the dock to ${v.width}×${v.height} to match this device; a module cannot set the dock size.`, record: false });
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

    // ---- review and save -------------------------------------------------
    // ctx.api throws an Error with err.status and err.body, so a 422's
    // problems and a 409's conflicts reach the dialog.
    let saving = false;

    let dlg = null;
    function ensureDialog() {
      if (dlg) return dlg;
      dlg = document.createElement('dialog');
      dlg.className = 'lay-dlg';
      dlg.innerHTML = '<div class="lay-dlg-head"><h2>Review changes</h2><button type="button" class="btn btn-sm btn-ghost" data-dlg="close">Close</button></div><div class="lay-dlg-body"></div>';
      el.querySelector('.lay').append(dlg);
      dlg.addEventListener('click', onDialogClick);
      dlg.addEventListener('close', () => { dlg.querySelector('.lay-dlg-body').innerHTML = ''; });
      return dlg;
    }
    const body = () => dlg.querySelector('.lay-dlg-body');

    function hunksHtml(d) {
      if (!d.hunks || !d.hunks.length) return '<p class="lay-note">No line changes.</p>';
      return d.hunks.map((h) => `<div class="lay-hunk"><div class="lay-hunk-head">@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@</div>${h.lines.map((l) => `<div class="lay-ln ${l.op === '+' ? 'is-add' : l.op === '-' ? 'is-del' : ''}"><span class="lay-op">${esc(l.op === ' ' ? ' ' : l.op)}</span>${esc(l.text)}</div>`).join('')}</div>`).join('');
    }

    async function openReview(notice = '') {
      const changes = C.changesFor(st.files);
      if (!changes.length) { ctx.toast({ kind: 'info', title: 'Nothing to save', record: false }); return; }
      ensureDialog();
      body().innerHTML = '<p class="lay-note">Building the diff…</p>';
      if (!dlg.open) dlg.showModal();
      let diffs;
      try {
        diffs = await Promise.all(changes.map((c) => ctx.api('files/diff', { path: c.path, text: c.text })));
      } catch (err) {
        body().innerHTML = `<p class="lay-hint is-error">Could not build the diff: ${esc(err.message)}</p>`;
        return;
      }
      const files = diffs.map((d) => `<section class="lay-file"><h3>${esc(d.path)} <span class="lay-stat">+${d.added} −${d.removed}</span></h3>${hunksHtml(d)}</section>`).join('');
      body().innerHTML = `${notice}<p class="lay-note">${changes.length} file(s) under content/config. Saved through the same validation as the other studios: the content compiler checks the whole tree first.</p>${files}`
        + `<div class="lay-dlg-actions"><button type="button" class="btn btn-sm btn-ghost" data-dlg="close">Cancel</button><button type="button" class="btn btn-sm btn-primary" data-dlg="save" data-label="Save ${changes.length} file(s)"${saving ? ' disabled' : ''}>${saving ? 'Saving…' : `Save ${changes.length} file(s)`}</button></div>`;
    }

    /**
     * Save the dirty files. The Save button is disabled while the request is in
     * flight. A 422 lists the compiler's problems, a 409 offers a choice per file,
     * and any other failure (a network error included) is shown in the dialog.
     */
    async function save() {
      const changes = C.changesFor(st.files);
      if (!changes.length || saving) return;
      const sent = new Map(changes.map((c) => [c.path, c]));
      saving = true;
      setSaveBusy(true);
      let data;
      try {
        data = await ctx.api('files/save', { changes });
      } catch (err) {
        saving = false;
        setSaveBusy(false);
        const failure = saveFailure(err);
        if (failure.kind === 'problems') {
          const list = failure.problems.map((p) => `<li><code>${esc(p.path)}</code> ${esc(p.message)}</li>`).join('');
          await openReview(`<div class="lay-problems"><p><strong>Nothing saved.</strong> The compiler found problems:</p><ul>${list}</ul></div>`);
        } else if (failure.kind === 'conflicts') {
          const rows = failure.conflicts.map((c) => `<li><code>${esc(c.path)}</code> <button type="button" class="btn btn-sm" data-dlg="reload" data-path="${esc(c.path)}">Reload from disk</button> <button type="button" class="btn btn-sm" data-dlg="keep" data-path="${esc(c.path)}" data-hash="${esc(c.hash || '')}">Keep my version</button></li>`).join('');
          await openReview(`<div class="lay-problems is-conflict"><p><strong>Changed on disk since it was opened.</strong> Choose per file:</p><ul>${rows}</ul><p class="lay-note">Reload drops your edits to that file. Keep my version overwrites the change made on disk.</p></div>`);
        } else {
          await openReview(`<div class="lay-problems"><p><strong>Not saved:</strong> ${esc(failure.message)}. Your edits are still here; try again.</p></div>`);
        }
        return;
      }
      saving = false;
      for (const saved of data.files) {
        const f = [...st.files.values()].find((x) => x.path === saved.path);
        const c = sent.get(saved.path);
        if (f && c) { f.original = c.text; f.hash = saved.hash; }
      }
      dlg.close();
      rebuild();
      ctx.toast({ kind: 'success', title: `Saved ${data.files.length} file(s)`, detail: `Backup ${data.backup}`, record: false });
      ctx.preview.reloadAfterBuild(data.files.map((f) => f.path));
    }

    /** Disable the dialog's Save button while a save is in flight (openReview redraws it enabled). */
    function setSaveBusy(busy) {
      const btn = dlg && dlg.querySelector('[data-dlg="save"]');
      if (btn) { btn.disabled = busy; btn.textContent = busy ? 'Saving…' : btn.dataset.label; }
    }

    async function onDialogClick(e) {
      const btn = e.target.closest('[data-dlg]');
      if (!btn) return;
      const act = btn.dataset.dlg;
      if (act === 'close') { dlg.close(); return; }
      if (act === 'save') { await save(); return; }
      const f = [...st.files.values()].find((x) => x.path === btn.dataset.path);
      if (!f) return;
      if (act === 'keep') { f.hash = btn.dataset.hash || null; await openReview(); return; }
      if (act === 'reload') {
        const r = await ctx.api(`files/read?path=${encodeURIComponent(f.path)}`);
        Object.assign(f, C.fileState(f.rel, r.text, r.hash));
        // The disk copy replaces the edits, so the steps that hold them must go: undo would write them back.
        ctx.history.clear();
        rebuild();
        await openReview();
      }
    }

    ctx.shortcuts.register('Mod+S', 'Review and save layout changes', () => { openReview(); }, { inInput: true });

    // Below 1100px the Layers and Inspector overlays open one at a time from their toggles.
    const lay = $('.lay');
    const setPanel = (name) => {
      for (const p of ['layers', 'props']) lay.classList.toggle(`${p}-open`, p === name);
      for (const b of el.querySelectorAll('[data-panel]')) b.setAttribute('aria-expanded', String(b.dataset.panel === name));
    };
    lay.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-panel]');
      if (toggle) { const name = toggle.dataset.panel; setPanel(lay.classList.contains(`${name}-open`) ? null : name); return; }
      if (e.target.closest('[data-panel-close]')) setPanel(null);
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPanel(null); });
    el.querySelector('.lay-bar').addEventListener('change', onBarChange);
    el.querySelector('.lay-bar').addEventListener('click', onBarClick);
    // UI config: arrow keys would nudge a region, which the layout places. The capture listener
    // stops them before the canvas kit sees them, and says why when something is selected.
    const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
    el.addEventListener('keydown', (e) => {
      if (!ARROW_KEYS.has(e.key) || !e.target.closest?.('.lay-canvas')) return;
      e.preventDefault();
      e.stopPropagation();
      if (st.canvas && st.canvas.getSelection().length) placedByLayout([{ label: 'the selected region', outcome: 'move' }]);
    }, true);

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
      onShow() {
        if (!st.canvas) return;
        if (st.fitPending) { st.fitPending = false; st.canvas.fit(); }
        paintBar(); paintStatus();
      },
      commands: () => [
        { title: 'Fit the wireframe to the page', sub: '0', run: () => st.canvas?.fit() },
        { title: 'Rotate the device', sub: 'Layout Studio', run: () => rotate() },
      ],
    };
  },
};
