// workbench/modules/layout/sketch-view.mjs — Layout Studio's Sketch mode: a free
// wireframe over a device for planning, on the canvas kit, edited through
// sketch-model.mjs. Sketches live where UI Studio keeps them:
// ui-studio/workspace/sketches/<name>.json. Export is a PNG (the drawing plan,
// painted here) and the sketch's JSON. index.mjs mounts this view and supplies the host.
import { createCanvas, createLayersPanel } from '../../ui/kit/canvas.mjs';
import * as S from './sketch-model.mjs';
import * as M from './studio-model.mjs';
import * as C from './config-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ZOOM_STEP = 1.25;
const ALIGN = [['left', 'Align left'], ['center', 'Align centre'], ['right', 'Align right'], ['top', 'Align top'], ['middle', 'Align middle'], ['bottom', 'Align bottom']];

const SHELL = `<div class="mode-bar sk-bar">
    <label class="lay-field">Sketch <select data-sk="pick" title="The sketches in ui-studio/workspace/sketches"></select></label>
    <label class="lay-field">New <input type="text" data-sk="newname" placeholder="name" size="14" pattern="[a-z0-9][a-z0-9-]*"></label>
    <button type="button" class="btn btn-sm btn-ghost" data-sk="create">Create</button>
    <label class="lay-field">Device <select data-sk="device"></select></label>
    <button type="button" class="btn btn-sm btn-ghost" data-sk="rotate">Rotate</button>
    <span class="lay-sep"></span>
    <button type="button" class="btn btn-sm btn-ghost" data-sk="zoom-out" title="Zoom out (-)">−</button>
    <button type="button" class="btn btn-sm btn-ghost" data-sk="fit" title="Fit to the page (0)">Fit</button>
    <button type="button" class="btn btn-sm btn-ghost" data-sk="zoom-in" title="Zoom in (+)">+</button>
    <label class="lay-check"><input type="checkbox" data-sk="snap"> Snap</label>
    <label class="lay-check"><input type="checkbox" data-sk="grid"> Grid</label>
    <span class="lay-sep"></span>
    <button type="button" class="btn btn-sm btn-ghost" data-sk="add" title="Add a box">Add box</button>
    <button type="button" class="btn btn-sm btn-ghost" data-sk="delete" title="Delete the selected boxes (Delete)" disabled>Delete</button>
    <span class="lay-align">${ALIGN.map(([edge, label]) => `<button type="button" class="btn btn-sm btn-ghost" data-align="${edge}" title="${label}" disabled>${esc(label.replace('Align ', ''))}</button>`).join('')}
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="horizontal" title="Distribute horizontally (three boxes)" disabled>Dist H</button>
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="vertical" title="Distribute vertically (three boxes)" disabled>Dist V</button></span>
    <span class="spacer"></span>
    <label class="lay-field">Edits go to <select data-sk="scope"><option value="base">all sizes</option><option value="breakpoint">this size only</option></select></label>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="layers" aria-expanded="false" aria-controls="sk-layers-pane">Layers</button>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="props" aria-expanded="false" aria-controls="sk-props-pane">Inspector</button>
    <button type="button" class="btn btn-sm" data-sk="png">Export PNG</button>
    <button type="button" class="btn btn-sm" data-sk="json">Export JSON</button>
  </div>
  <div class="mode-body">
    <aside class="lay-left" id="sk-layers-pane"><div class="lay-panel-head"><span>Boxes</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="sk-layers"></div></aside>
    <main class="lay-center"><div class="sk-canvas"><p class="lay-hint">Loading the sketches…</p></div><div class="lay-status sk-status" aria-live="polite"></div></main>
    <aside class="lay-right" id="sk-props-pane"><div class="lay-panel-head"><span>Inspector</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="sk-insp"></div></aside>
  </div>`;

const pathOf = (name) => S.sketchRel(name);

/**
 * The Sketch view. host: { api(path), history, preview, toast(opts), devices(), viewportOf(device, orientation, freeSize),
 * settings: { grid } }. Returns the view's controller.
 */
export function createSketchView(root, host) {
  root.innerHTML = SHELL;
  const $ = (sel) => root.querySelector(sel);
  const st = {
    name: null, sketch: null, original: null, hash: null, error: null, problems: [], names: [],
    deviceId: null, orientation: 'auto', freeSize: { width: 1024, height: 768 }, scope: 'base',
    canvas: null, layers: null, vp: null, autoFit: true, fitPending: false,
    snap: host.settings.grid.snap !== false, grid: host.settings.grid.show === true,
  };
  const device = () => host.devices().find((d) => d.id === st.deviceId) || host.devices()[0];
  const viewport = () => host.viewportOf(device(), st.orientation, st.freeSize);
  const bpOf = () => (st.sketch && st.vp ? S.breakpointOf(st.sketch, st.vp) : null);
  const selectedIds = () => (st.canvas ? st.canvas.getSelection() : []);
  const isNew = () => st.original === null;
  const isDirty = () => Boolean(st.sketch) && (isNew() || S.serializeSketch(st.sketch, st.original) !== st.original);

  // ---- drawing -------------------------------------------------------

  function rebuild({ fit = false } = {}) {
    if (!st.sketch || !st.canvas) return;
    st.vp = viewport();
    st.canvas.setDoc({ width: Math.round(st.vp.width), height: Math.round(st.vp.height), items: S.canvasItems(st.sketch, st.vp) });
    if (fit) { if (root.clientWidth) st.canvas.fit(); else st.fitPending = true; }
    paintAll();
  }

  function paintAll() { paintBar(); paintStatus(); paintInspector(); }

  function paintBar() {
    $('[data-sk="pick"]').innerHTML = st.names.map((n) => `<option value="${esc(n)}"${n === st.name ? ' selected' : ''}>${esc(n)}</option>`).join('')
      + (st.name && !st.names.includes(st.name) ? `<option value="${esc(st.name)}" selected>${esc(st.name)} (new)</option>` : '');
    const devSel = $('[data-sk="device"]');
    const list = host.devices().filter((d) => d.enabled !== false || d.id === st.deviceId);
    devSel.innerHTML = list.map((d) => `<option value="${esc(d.id)}"${d.id === st.deviceId ? ' selected' : ''}>${esc(d.label)}</option>`).join('');
    const locked = Boolean(st.error) || !st.sketch;
    const n = selectedIds().length;
    $('[data-sk="delete"]').disabled = locked || n < 1;
    $('[data-sk="add"]').disabled = locked;
    $('[data-sk="png"]').disabled = locked;
    $('[data-sk="json"]').disabled = locked;
    for (const b of root.querySelectorAll('[data-align]')) b.disabled = locked || n < 1;
    for (const b of root.querySelectorAll('[data-distribute]')) b.disabled = locked || n < 3;
    $('[data-sk="snap"]').checked = st.snap;
    $('[data-sk="grid"]').checked = st.grid;
    $('[data-sk="scope"]').value = st.scope;
  }

  function paintStatus() {
    const parts = [];
    if (st.error) parts.push(st.error);
    if (st.sketch) {
      parts.push(`${st.name}.json`, `${st.sketch.boxes.length} boxes`);
      const bp = bpOf();
      if (bp) parts.push(`breakpoint ${bp.label || bp.id}`);
      parts.push(isNew() ? 'new, not saved' : isDirty() ? 'unsaved changes' : 'saved');
    }
    $('.sk-status').textContent = parts.join(' · ');
    if (host.changed) host.changed();
  }

  /** The inspector: the sketch's name and notes, and the selected box's label, layer, flags and geometry. */
  function paintInspector() {
    const box = $('.sk-insp');
    if (!st.sketch) { box.innerHTML = ''; return; }
    const sk = st.sketch;
    const head = `<h3>Sketch</h3>
      <div class="lay-row"><code>Title</code><span><input type="text" data-sk-field="name" value="${esc(sk.name)}"></span></div>
      <div class="lay-row"><code>Notes</code><span><textarea data-sk-field="notes" rows="4">${esc(sk.notes || '')}</textarea></span></div>`;
    const ids = selectedIds();
    if (ids.length !== 1) {
      box.innerHTML = head + `<p class="lay-note">${ids.length ? `${ids.length} boxes selected. Select one to edit its label and size.` : 'Select a box to edit its label, layer, size and flags. Add one with Add box.'}</p>`;
      return;
    }
    const b = sk.boxes.find((x) => x.id === ids[0]);
    if (!b) { box.innerHTML = head; return; }
    const bp = bpOf();
    const r = bp ? M.resolveBox(b, bp.id) : b;
    const over = bp && b.overrides && b.overrides[bp.id];
    const geo = ['x', 'y', 'w', 'h'].map((k) => `<div class="lay-row"><code>${k}${sk.unit === 'px' ? ' px' : ' %'}</code><span><input type="number" step="${sk.unit === 'px' ? 1 : 0.5}" data-sk-box="${k}" value="${esc(r[k])}"></span></div>`).join('');
    const scopeNote = st.scope === 'breakpoint' && bp ? `<p class="lay-note">Geometry edits land in the ${esc(bp.label || bp.id)} override.</p>` : '';
    const reset = over ? `<p class="lay-note">Overridden at ${esc(bp.label || bp.id)}. <button type="button" class="btn btn-sm" data-sk-reset="${esc(b.id)}">Reset to base</button></p>` : '';
    box.innerHTML = head + `<h3>Box ${esc(b.id)}</h3>
      <div class="lay-row"><code>Label</code><span><input type="text" data-sk-box-field="label" value="${esc(b.label || '')}"></span></div>
      <div class="lay-row"><code>Layer</code><span><input type="number" step="1" data-sk-box-field="layer" value="${esc(b.layer ?? 0)}"></span></div>
      <div class="lay-row"><code>Locked</code><span><input type="checkbox" data-sk-box-field="locked"${b.locked ? ' checked' : ''}></span></div>
      <div class="lay-row"><code>Hidden</code><span><input type="checkbox" data-sk-box-field="hidden"${b.hidden ? ' checked' : ''}></span></div>
      ${geo}${scopeNote}${reset}`;
  }

  // ---- edits ---------------------------------------------------------

  /** Set the sketch as one history step. The sketch is replaced, never mutated. */
  function setSketch(next, label) {
    const prev = st.sketch;
    if (!next || JSON.stringify(prev) === JSON.stringify(next)) return false;
    const put = (s) => { st.sketch = s; rebuild(); };
    put(next);
    host.history.push({ label, before: prev, after: next, undo: () => put(prev), redo: () => put(next) });
    return true;
  }

  function scopeOpts() { const bp = bpOf(); return { breakpointId: bp ? bp.id : null, scope: st.scope === 'breakpoint' && bp ? 'breakpoint' : 'base' }; }

  function onCanvasChange(doc, change) {
    if (!st.sketch) { rebuild(); return; }
    const next = S.applyCanvasItems(st.sketch, doc.items, st.vp, { scope: st.scope });
    setSketch(next, change?.label || 'Move boxes');
    rebuild();
  }

  function onInspectorChange(e) {
    const t = e.target;
    if (!st.sketch) return;
    if (t.dataset.skField === 'name') { setSketch({ ...M.clone(st.sketch), name: t.value }, 'Rename the sketch'); return; }
    if (t.dataset.skField === 'notes') { setSketch(S.setNotes(st.sketch, t.value), 'Edit notes'); return; }
    const id = selectedIds()[0];
    if (!id) return;
    if (t.dataset.skBoxField) {
      const f = t.dataset.skBoxField;
      const v = f === 'locked' || f === 'hidden' ? t.checked : f === 'layer' ? Number(t.value) : t.value;
      if (f === 'layer' && !Number.isFinite(v)) { paintInspector(); return; }
      setSketch(S.updateBox(st.sketch, id, { [f]: v }), `Set ${f}`);
      rebuild();
      return;
    }
    if (t.dataset.skBox) {
      const v = Number(t.value);
      if (!Number.isFinite(v)) { paintInspector(); return; }
      setSketch(S.updateBox(st.sketch, id, { [t.dataset.skBox]: v }, scopeOpts()), `Set ${t.dataset.skBox}`);
      rebuild();
    }
  }

  function onInspectorClick(e) {
    const btn = e.target.closest('[data-sk-reset]');
    if (!btn || !st.sketch) return;
    const bp = bpOf();
    if (!bp) return;
    setSketch(M.clearOverride(st.sketch, btn.dataset.skReset, bp.id), 'Reset to base');
    rebuild();
  }

  function addBox() {
    if (!st.sketch || !st.vp) return;
    const u = st.sketch.unit === 'px';
    const w = u ? Math.round(st.vp.width * 0.3) : 30, h = u ? Math.round(st.vp.height * 0.2) : 20;
    const { sketch, id } = S.addBox(st.sketch, { x: u ? 20 : 10, y: u ? 20 : 10, w, h, label: 'Box' });
    setSketch(sketch, 'Add box');
    st.canvas.select([id]);
    rebuild();
  }

  function deleteSelected() {
    const ids = selectedIds();
    if (!ids.length || !st.sketch) return;
    const next = S.removeBoxes(st.sketch, ids);
    if (next.boxes.length === st.sketch.boxes.length) { host.toast({ kind: 'warn', title: 'Locked boxes stay', detail: 'Unlock a box to delete it.', record: false }); return; }
    st.canvas.select([]);
    setSketch(next, 'Delete boxes');
    rebuild();
  }

  function onBarChange(e) {
    const act = e.target.dataset.sk;
    if (act === 'pick') { pick(e.target.value); return; }
    if (act === 'device') { st.deviceId = e.target.value; st.orientation = 'auto'; rebuild({ fit: true }); }
    else if (act === 'scope') { st.scope = e.target.value; paintAll(); }
    else if (act === 'snap') { st.snap = e.target.checked; st.canvas?.setSnap(st.snap); }
    else if (act === 'grid') { st.grid = e.target.checked; st.canvas?.setGrid(st.grid); }
  }

  function onBarClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.sk === 'create') { create(); return; }
    if (btn.dataset.sk === 'png') { exportPng(); return; }
    if (btn.dataset.sk === 'json') { exportJsonFile(); return; }
    if (btn.dataset.sk === 'add') { addBox(); return; }
    if (btn.dataset.sk === 'delete') { deleteSelected(); return; }
    if (btn.dataset.align) { st.canvas.align(btn.dataset.align); return; }
    if (btn.dataset.distribute) { st.canvas.distribute(btn.dataset.distribute); return; }
    if (!st.canvas) return;
    const act = btn.dataset.sk;
    if (act === 'zoom-in') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() * ZOOM_STEP); }
    else if (act === 'zoom-out') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() / ZOOM_STEP); }
    else if (act === 'fit') { st.autoFit = true; st.canvas.fit(); }
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

  // ---- files ---------------------------------------------------------

  /** Load a sketch by name. A file that UI Studio would refuse is shown, not edited. */
  async function open(name) {
    const r = await host.api(`files/read?path=${encodeURIComponent(pathOf(name))}`);
    const parsed = S.parseSketch(r.text);
    st.name = name; st.sketch = parsed.data; st.original = r.text; st.hash = r.hash;
    st.problems = parsed.problems;
    st.error = parsed.problems.length ? `Not editable here: ${parsed.problems.join('; ')}` : null;
    host.history.clear();
  }

  function startNew(name) {
    st.name = name; st.sketch = S.newSketch(name); st.original = null; st.hash = null; st.error = null; st.problems = [];
    host.history.clear();
  }

  async function pick(name) {
    if (name === st.name) return;
    if (isDirty() && !window.confirm(`Leave ${st.name} with unsaved changes?`)) { paintBar(); return; }
    try { await open(name); } catch (err) { st.error = `Could not open ${name}: ${err.message}`; }
    st.canvas.select([]);
    rebuild({ fit: true });
  }

  function create() {
    const input = $('[data-sk="newname"]');
    const name = String(input.value || '').trim();
    if (!S.validSketchName(name)) { host.toast({ kind: 'warn', title: 'Sketch names use lower-case letters, digits and dashes', record: false }); return; }
    if (st.names.includes(name)) { host.toast({ kind: 'warn', title: `${name} already exists`, record: false }); return; }
    if (isDirty() && !window.confirm(`Leave ${st.name} with unsaved changes?`)) return;
    startNew(name);
    input.value = '';
    st.canvas.select([]);
    rebuild({ fit: true });
  }

  async function listNames() {
    const r = await host.api(`files/list?dir=${encodeURIComponent(S.SKETCH_DIR)}&ext=json`);
    st.names = (r.files || []).map((p) => p.split('/').pop().replace(/\.json$/, '')).filter(S.validSketchName).sort();
  }

  // ---- export --------------------------------------------------------

  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJsonFile() {
    download(`${st.name}.json`, new Blob([S.exportJson(st.sketch, st.original)], { type: 'application/json' }));
    host.toast({ kind: 'success', title: `Exported ${st.name}.json`, detail: 'The sketch as UI Studio stores it.', record: false });
  }

  /** The PNG: the drawing plan painted on a canvas at the device size, then downloaded. */
  function exportPng() {
    const plan = S.drawingFor(st.sketch, st.vp);
    const c = document.createElement('canvas');
    c.width = plan.width; c.height = plan.height;
    const g = c.getContext('2d');
    g.fillStyle = '#14161b';
    g.fillRect(0, 0, c.width, c.height);
    g.font = '13px system-ui, sans-serif';
    for (const r of plan.rects) {
      g.fillStyle = r.overridden ? 'rgba(180,140,255,0.16)' : 'rgba(122,167,255,0.14)';
      g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = r.locked ? '#8a8f9c' : r.overridden ? '#b48cff' : '#7aa7ff';
      g.lineWidth = 2;
      g.strokeRect(r.x + 1, r.y + 1, Math.max(0, r.w - 2), Math.max(0, r.h - 2));
      g.fillStyle = '#e7eaf0';
      g.fillText(r.label, r.x + 6, r.y + 18);
    }
    g.fillStyle = '#9aa1ad';
    g.fillText(plan.title, 10, c.height - 10 - plan.notes.length * 16);
    plan.notes.forEach((line, i) => g.fillText(line, 10, c.height - 10 - (plan.notes.length - 1 - i) * 16));
    c.toBlob((blob) => { if (blob) download(`${st.name}.png`, blob); }, 'image/png');
  }

  function ensureCanvas() {
    if (st.canvas) return;
    const host0 = $('.sk-canvas');
    host0.innerHTML = '';
    st.canvas = createCanvas(host0, {
      doc: { width: 800, height: 600, items: [] },
      snap: st.snap,
      grid: { size: host.settings.grid.sizePx, subdivisions: host.settings.grid.subdivisions, show: st.grid },
      rulers: host.settings.canvas?.showRulers !== false,
      onChange: onCanvasChange,
      onSelect: () => paintAll(),
    });
    st.autoFit = true;
    new ResizeObserver(() => { if (st.autoFit && st.canvas && $('.sk-canvas').clientWidth) st.canvas.fit(); }).observe($('.sk-canvas'));
    st.layers = createLayersPanel($('.sk-layers'), st.canvas);
    st.canvas.subscribe(() => paintBar());
    root.querySelector('.sk-bar').addEventListener('change', onBarChange);
    root.querySelector('.sk-bar').addEventListener('click', onBarClick);
    $('.sk-insp').addEventListener('change', onInspectorChange);
    $('.sk-insp').addEventListener('click', onInspectorClick);
    $('[data-sk="newname"]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
  }

  let loading = null;
  async function load() {
    try {
      await listNames();
      ensureCanvas();
      const first = st.names[0];
      if (first) await open(first); else startNew('wireframe-1');
      st.deviceId = host.devices()[0]?.id ?? null;
      rebuild({ fit: true });
    } catch (err) {
      st.error = `Could not load the sketches: ${err.message}`;
      $('.sk-canvas').innerHTML = `<p class="lay-hint is-error">${esc(st.error)}</p>`;
      paintStatus();
    }
  }

  return {
    show() {
      if (!loading) loading = load();
      if (st.canvas && st.fitPending) { st.fitPending = false; st.canvas.fit(); }
      if (st.canvas) paintAll();
    },
    /** The sketch file this view would save: a new sketch is a new file (baseHash null). */
    changes() {
      if (!st.sketch || st.error || !isDirty()) return [];
      return [{ path: pathOf(st.name), text: S.serializeSketch(st.sketch, st.original), baseHash: st.hash }];
    },
    /** A save went through: the sketch is now that file, and its list gains the name. */
    async saved(files) {
      const f = files.find((x) => x.path === pathOf(st.name));
      if (!f) return;
      st.original = S.serializeSketch(st.sketch, st.original);
      st.hash = f.hash;
      await listNames();
      paintAll();
    },
    /** Reload the open sketch from disk after a conflict: the draft and its history go. */
    async reload(path) {
      if (path !== pathOf(st.name)) return;
      await open(st.name);
      rebuild();
    },
    hashOf(path) { return path === pathOf(st.name) ? st.hash : undefined; },
    /** "Keep my version" in the conflict dialog: the draft is saved over the disk copy, so it takes the disk hash. */
    keep(path, hash) { if (path === pathOf(st.name) && st.sketch) { st.hash = hash; paintStatus(); } },
    commands: () => [
      { title: 'Sketch: add a box', sub: 'Layout Studio', run: () => addBox() },
      { title: 'Sketch: export as PNG', sub: 'Layout Studio', run: () => exportPng() },
    ],
  };
}
