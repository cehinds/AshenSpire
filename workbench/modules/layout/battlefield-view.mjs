// workbench/modules/layout/battlefield-view.mjs — Layout Studio's Battlefield mode:
// the formation slots of the combat battlefield on the canvas kit, edited through
// battlefield-model.mjs. The data file is src/content/formationPositioningPresets.js.
// index.mjs mounts this view into its own root and supplies the host (the API,
// history, preview, devices and the scene size of a device).
import { createCanvas, createLayersPanel } from '../../ui/kit/canvas.mjs';
import * as B from './battlefield-model.mjs';
import * as C from './config-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ZOOM_STEP = 1.25;
/** The device UI config opens on, so the two modes start at the same size. */
const DEFAULT_DEVICE = 'desk-1280';
/** The slot marker on the canvas, in battlefield px. */
export const SLOT_PX = 26;
const ALIGN = [['left', 'Align left'], ['center', 'Align centre'], ['right', 'Align right'], ['top', 'Align top'], ['middle', 'Align middle'], ['bottom', 'Align bottom']];

const SHELL = `<div class="mode-bar bf-bar">
    <label class="lay-field">Layout <select data-bf="layout" title="The supplied layout the edits change: 2x2 or 1x1"></select></label>
    <label class="lay-field">Device <select data-bf="device"></select></label>
    <button type="button" class="btn btn-sm btn-ghost" data-bf="rotate">Rotate</button>
    <span class="lay-sep"></span>
    <button type="button" class="btn btn-sm btn-ghost" data-bf="zoom-out" title="Zoom out (-)">−</button>
    <button type="button" class="btn btn-sm btn-ghost" data-bf="fit" title="Fit to the page (0)">Fit</button>
    <button type="button" class="btn btn-sm btn-ghost" data-bf="zoom-in" title="Zoom in (+)">+</button>
    <label class="lay-check"><input type="checkbox" data-bf="snap"> Snap</label>
    <label class="lay-check"><input type="checkbox" data-bf="grid"> Grid</label>
    <span class="lay-sep"></span>
    <span class="lay-align">${ALIGN.map(([edge, label]) => `<button type="button" class="btn btn-sm btn-ghost" data-align="${edge}" title="${label} (needs a slot selected)" disabled>${esc(label.replace('Align ', ''))}</button>`).join('')}
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="horizontal" title="Distribute horizontally (needs three slots)" disabled>Dist H</button>
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="vertical" title="Distribute vertically (needs three slots)" disabled>Dist V</button></span>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="layers" aria-expanded="false" aria-controls="bf-layers-pane">Layers</button>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="props" aria-expanded="false" aria-controls="bf-props-pane">Inspector</button>
    <button type="button" class="btn btn-sm" data-bf="preview" title="Show the game's combat preview">Preview in combat</button>
  </div>
  <div class="mode-body">
    <aside class="lay-left" id="bf-layers-pane"><div class="lay-panel-head"><span>Layers</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="bf-layers"></div></aside>
    <main class="lay-center"><div class="bf-canvas"><p class="lay-hint">Loading the battlefield…</p></div><div class="lay-status bf-status" aria-live="polite"></div></main>
    <aside class="lay-right" id="bf-props-pane"><div class="lay-panel-head"><span>Inspector</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="bf-insp"></div></aside>
  </div>`;

/** The slot a canvas item stands for, from its data. */
const slotOf = (it) => (it && it.data && it.data.kind === 'slot' ? it.data : null);
const idOf = (cell) => `slot:${cell.side}:${cell.row}:${cell.column}`;

/**
 * The Battlefield view. host: { api(path), history, preview, toast(opts), devices(), viewportOf(device, orientation, freeSize),
 * sceneSize(viewport) → { width, height }, settings: { grid } }. Returns the view's controller.
 */
export function createBattlefieldView(root, host) {
  root.innerHTML = SHELL;
  const $ = (sel) => root.querySelector(sel);
  const st = {
    parts: null, data: null, original: null, hash: null, error: null,
    layoutKey: null, deviceId: null, orientation: 'auto', freeSize: { width: 1024, height: 768 },
    canvas: null, layers: null, geo: [], size: null, vp: null, autoFit: true, fitPending: false,
    snap: host.settings.grid.snap !== false, grid: host.settings.grid.show === true,
    /** Preview values at other player settings: drawn and never saved. */
    preview: {},
  };
  const device = () => host.devices().find((d) => d.id === st.deviceId) || host.devices()[0];
  const viewport = () => host.viewportOf(device(), st.orientation, st.freeSize);
  /** The layout's presentation as drawn: the file's values with the preview applied. */
  const presentation = () => (st.data && st.layoutKey ? B.previewPresentation(st.data, st.layoutKey, st.preview) : null);
  /** True when the preview differs from the file's own values: slots cannot be moved then, since the file's geometry is not the one drawn. */
  const previewing = () => {
    if (!st.data || !st.layoutKey) return false;
    const stored = st.data[st.layoutKey].presentation, shown = presentation();
    return B.PREVIEW_FIELDS.some((f) => shown[f] !== stored[f]);
  };
  const cellOfItem = (it) => { const d = slotOf(it); return d ? st.geo.find((c) => c.side === d.side && c.row === d.row && c.column === d.column) || null : null; };
  const selectedCells = () => (st.canvas ? st.canvas.getSelection().map((id) => st.canvas.getDoc().items.find((it) => it.id === id)).map(cellOfItem).filter(Boolean) : []);
  const isDirty = () => Boolean(st.parts && st.data && B.serializePresets(st.parts, st.data) !== st.original);

  // ---- drawing -------------------------------------------------------

  /** The canvas document: the battlefield, its depth rows and ground line (locked), and one marker per slot. */
  function docFor(geo, size, pres) {
    const { width, height } = size;
    const items = [];
    const rows = pres.formationRows;
    for (let r = 0; r < rows; r++) {
      const ys = geo.filter((c) => c.row === r).map((c) => c.ground);
      const y = ys.reduce((a, b) => a + b, 0) / Math.max(1, ys.length);
      items.push({ id: `lane:${r}`, x: 0, y: y - 1, w: width, h: 2, z: 0, locked: true, label: `Row ${B.FORMATION_ROWS[r]}`, data: { kind: 'lane', row: r } });
    }
    const ground = height - Math.max(0, height * B.GRID.bottomClearanceFraction);
    items.push({ id: 'ground', x: 0, y: ground - 1, w: width, h: 2, z: 0, locked: true, label: 'Ground line', data: { kind: 'ground' } });
    for (const c of geo) {
      items.push({ id: idOf(c), x: c.x - SLOT_PX / 2, y: c.ground - SLOT_PX / 2, w: SLOT_PX, h: SLOT_PX, z: 2, label: c.cell,
        data: { kind: 'slot', side: c.side, row: c.row, column: c.column, cell: c.cell } });
    }
    return { width, height, items };
  }

  function rebuild({ fit = false } = {}) {
    if (!st.data || !st.canvas) return;
    const pres = presentation();
    st.vp = viewport();
    st.size = host.sceneSize(st.vp);
    st.geo = B.battlefieldGeometry(pres, st.size);
    st.canvas.setDoc(docFor(st.geo, st.size, pres));
    if (fit) { if (root.clientWidth) st.canvas.fit(); else st.fitPending = true; }
    paintAll();
  }

  function paintAll() { paintBar(); paintStatus(); paintInspector(); }

  function paintBar() {
    const layoutSel = $('[data-bf="layout"]');
    layoutSel.innerHTML = B.layoutKeys(st.data || {}).map((k) => `<option value="${esc(k)}"${k === st.layoutKey ? ' selected' : ''}>${esc(k)} (supplied)</option>`).join('');
    const devSel = $('[data-bf="device"]');
    const list = host.devices().filter((d) => d.enabled !== false || d.id === st.deviceId);
    devSel.innerHTML = list.map((d) => `<option value="${esc(d.id)}"${d.id === st.deviceId ? ' selected' : ''}>${esc(d.label)}</option>`).join('');
    const n = selectedCells().length;
    for (const b of root.querySelectorAll('[data-align]')) b.disabled = n < 1 || Boolean(st.error);
    for (const b of root.querySelectorAll('[data-distribute]')) b.disabled = n < 3 || Boolean(st.error);
    $('[data-bf="snap"]').checked = st.snap;
    $('[data-bf="grid"]').checked = st.grid;
    const preview = $('[data-bf="preview"]');
    if (preview) preview.disabled = Boolean(st.error);
  }

  function paintStatus() {
    const parts = [];
    if (st.error) parts.push(st.error);
    if (st.size) parts.push(`${Math.round(st.size.width)}×${Math.round(st.size.height)} battlefield`);
    if (st.layoutKey) parts.push(`layout ${st.layoutKey}, ${st.geo.length} slots`);
    if (st.data) parts.push(isDirty() ? 'unsaved changes' : 'saved');
    if (previewing()) parts.push('previewing player settings (not saved)');
    $('.bf-status').textContent = parts.join(' · ');
    if (host.changed) host.changed();
  }

  /** The numeric inspector: the layout's values always, and the selected slot's position and group. */
  function paintInspector() {
    const box = $('.bf-insp');
    if (!st.data || !st.layoutKey) { box.innerHTML = ''; return; }
    const pres = presentation();
    const stored = st.data[st.layoutKey].presentation;
    const previewFields = B.FIELDS.filter((f) => !B.LAYOUT_KEY_FIELDS.includes(f.key)).map((f) => `<div class="lay-row"><code title="${esc(f.key)}">${esc(f.label)}</code><span><input type="number" step="1" data-bf-preview="${esc(f.key)}" value="${esc(pres[f.key] ?? f.def)}"> <span class="lay-unit">${esc(f.suffix || '')}</span></span></div>`).join('');
    const preset = `<div class="lay-row"><code title="formationPreset">Preset</code><span><select data-bf-preview="formationPreset">${B.PRESETS.map((p) => `<option value="${esc(p)}"${p === pres.formationPreset ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select></span></div>`;
    const preview = `<h3>Preview at player settings (not saved)</h3>
      <p class="lay-note">The game takes these from the player's settings. Changing them shows the layout at those settings; the file is not changed.</p>
      ${previewFields}${preset}
      <button type="button" class="btn btn-sm btn-ghost" data-bf-preview-reset${previewing() ? '' : ' disabled'}>Reset preview to the file's values</button>`;
    const cells = selectedCells();
    let slot = '';
    if (previewing()) {
      slot = '<p class="lay-note">Reset the preview to the file\'s values to move slots.</p>';
    } else if (cells.length === 1) {
      const c = cells[0];
      const gid = B.slotGroupId(c);
      const g = (stored.formationGroups || []).find((x) => x && x.id === gid) || { x: 0, y: 0, scale: 1 };
      slot = `<h3>Slot ${esc(c.cell)} · ${esc(c.side)}</h3>
        <div class="lay-row"><code>X (px)</code><span><input type="number" step="0.5" data-bf-slot="x" value="${round1(c.x)}"></span></div>
        <div class="lay-row"><code>Ground (px)</code><span><input type="number" step="0.5" data-bf-slot="ground" value="${round1(c.ground)}"></span></div>
        <div class="lay-row"><code>Group X (%)</code><span><input type="number" step="0.01" data-bf-group="x" data-group="${esc(gid)}" value="${round2(g.x)}"></span></div>
        <div class="lay-row"><code>Group Y (%)</code><span><input type="number" step="0.01" data-bf-group="y" data-group="${esc(gid)}" value="${round2(g.y)}"></span></div>
        <div class="lay-row"><code>Scale</code><span><input type="number" step="0.05" data-bf-group="scale" data-group="${esc(gid)}" value="${round2(g.scale ?? 1)}"></span></div>
        <p class="lay-note">A slot's group offset is stored in the presets file as ${esc(gid)}.</p>`;
    } else if (cells.length > 1) {
      slot = `<p class="lay-note">${cells.length} slots selected. Select one to see its position.</p>`;
    } else {
      slot = '<p class="lay-note">Select a slot to see its position. Drag a slot, or type its position here.</p>';
    }
    box.innerHTML = `<h3>Layout values</h3>${layoutKeyRowsHtml(stored)}${preview}${slot}`;
  }

  // ---- edits ---------------------------------------------------------

  /** Set the presets draft as one history step. The data is replaced, never mutated. */
  function setData(raw, label) {
    const prev = st.data;
    if (!raw) return false;
    // The layout's supplied anchors follow its presentation, so the repo's reproduction test keeps passing.
    const next = B.refreshAnchors(raw, st.layoutKey, prev);
    if (JSON.stringify(prev) === JSON.stringify(next)) return false;
    const put = (d) => { st.data = d; st.parts.data = d; rebuild(); };
    put(next);
    host.history.push({ label, before: prev, after: next, undo: () => put(prev), redo: () => put(next) });
    return true;
  }

  /** A finished canvas gesture (drag, nudge, align, distribute): each slot that moved takes its move through its group. */
  function onCanvasChange(doc, change) {
    if (!st.data) { rebuild(); return; }
    if (previewing()) { host.toast({ kind: 'warn', title: 'Reset the preview to move slots', detail: 'The preview is not the file\'s geometry, so a move is not taken.', record: false }); rebuild(); return; }
    const moves = [];
    for (const it of doc.items) {
      const cell = cellOfItem(it);
      if (!cell) continue;
      const dx = it.x + it.w / 2 - cell.x, dy = it.y + it.h / 2 - cell.ground;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) continue;
      moves.push({ groupId: B.slotGroupId(cell), dx, dy, name: B.slotGroupName({ ...cell, columns: st.data[st.layoutKey].presentation.formationColumns }) });
    }
    if (moves.length) setData(B.moveSlots(st.data, st.layoutKey, moves, st.size), change?.label || 'Move slots');
    rebuild();
  }

  function onInspectorChange(e) {
    const t = e.target;
    if (!st.data) return;
    if (t.dataset.bfPreview) {
      // A preview value is drawn, never saved, and never enters the history.
      const field = t.dataset.bfPreview;
      try { st.preview = { ...st.preview, [field]: field === 'formationPreset' ? t.value : Number(t.value) }; B.previewPresentation(st.data, st.layoutKey, st.preview); }
      catch (err) { host.toast({ kind: 'warn', title: err.message, record: false }); delete st.preview[field]; }
      rebuild();
      return;
    }
    const cells = selectedCells();
    if (previewing()) { paintInspector(); return; }
    if (t.dataset.bfSlot && cells.length === 1) {
      const c = cells[0], v = Number(t.value);
      if (!Number.isFinite(v)) { paintInspector(); return; }
      const d = t.dataset.bfSlot === 'x' ? { dx: v - c.x, dy: 0 } : { dx: 0, dy: v - c.ground };
      if (Math.abs(d.dx) < 0.05 && Math.abs(d.dy) < 0.05) { paintInspector(); return; }
      setData(B.moveSlots(st.data, st.layoutKey, [{ groupId: B.slotGroupId(c), ...d, name: B.slotGroupName({ ...c, columns: presentation().formationColumns }) }], st.size), `Move slot ${c.cell}`);
      rebuild();
      return;
    }
    if (t.dataset.bfGroup) {
      const v = Number(t.value);
      if (!Number.isFinite(v)) { paintInspector(); return; }
      const key = t.dataset.bfGroup, gid = t.dataset.group;
      const cell = cells[0];
      const patch = key === 'scale' ? { scale: v } : key === 'x' ? { x: v } : { y: v };
      setData(B.withGroup(st.data, st.layoutKey, gid, patch, { name: cell ? B.slotGroupName({ ...cell, columns: presentation().formationColumns }) : gid }), `Set group ${key}`);
      rebuild();
    }
  }

  function onBarChange(e) {
    const act = e.target.dataset.bf;
    if (act === 'layout') { st.layoutKey = e.target.value; st.preview = {}; rebuild({ fit: true }); }
    else if (act === 'device') { st.deviceId = e.target.value; st.orientation = 'auto'; rebuild({ fit: true }); }
    else if (act === 'snap') { st.snap = e.target.checked; st.canvas?.setSnap(st.snap); }
    else if (act === 'grid') { st.grid = e.target.checked; st.canvas?.setGrid(st.grid); }
  }

  function onBarClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || !st.canvas) return;
    if (btn.dataset.align) { st.canvas.align(btn.dataset.align); return; }
    if (btn.dataset.distribute) { st.canvas.distribute(btn.dataset.distribute === 'horizontal' ? 'horizontal' : 'vertical'); return; }
    const act = btn.dataset.bf;
    if (act === 'zoom-in') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() * ZOOM_STEP); }
    else if (act === 'zoom-out') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() / ZOOM_STEP); }
    else if (act === 'fit') { st.autoFit = true; st.canvas.fit(); }
    else if (act === 'rotate') rotate();
    else if (act === 'preview') previewHere();
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

  /**
   * The game's combat fixture in the dock (?shot=combat on the game server; the game
   * reads its own query, not the Workbench's wb.* overrides). The dock's size is the user's to set.
   */
  async function previewHere() {
    let base = null;
    try { base = gameBaseOf(await host.api('tools')); } catch { base = null; }
    if (!base) { host.toast({ kind: 'warn', title: 'The game server is not up', detail: 'Start the Workbench server; the preview needs the game.', record: false }); return; }
    host.preview.showUrl(`${base}index.html?shot=combat`);
    host.toast({ kind: 'info', title: 'Previewing the combat battlefield', detail: 'The combat fixture, with the saved presets. Set the dock to the device size to compare; Back returns to the game.', record: false });
  }

  function ensureCanvas() {
    if (st.canvas) return;
    const host0 = $('.bf-canvas');
    host0.innerHTML = '';
    st.canvas = createCanvas(host0, {
      doc: { width: 800, height: 600, items: [] },
      snap: host.settings.grid.snap,
      grid: { size: host.settings.grid.sizePx, subdivisions: host.settings.grid.subdivisions, show: host.settings.grid.show },
      rulers: host.settings.canvas?.showRulers !== false,
      onChange: onCanvasChange,
      onSelect: () => paintAll(),
    });
    st.autoFit = true;
    new ResizeObserver(() => { if (st.autoFit && st.canvas && $('.bf-canvas').clientWidth) st.canvas.fit(); }).observe($('.bf-canvas'));
    st.layers = createLayersPanel($('.bf-layers'), st.canvas);
    st.canvas.subscribe(() => paintBar());
    root.querySelector('.bf-bar').addEventListener('change', onBarChange);
    root.querySelector('.bf-bar').addEventListener('click', onBarClick);
    $('.bf-insp').addEventListener('change', onInspectorChange);
    $('.bf-insp').addEventListener('click', (e) => {
      if (!e.target.closest('[data-bf-preview-reset]') || !st.data) return;
      st.preview = {};
      rebuild();
    });
  }

  // ---- load and the controller ----------------------------------------

  async function load() {
    try {
      // The scene size comes from the UI config files, so the first drawing waits for them.
      if (host.ready) await host.ready();
      const r = await host.api(`files/read?path=${encodeURIComponent(B.PRESETS_FILE)}`);
      const parts = B.parsePresets(r.text);
      // Saving writes the presets back in this form; a file in another form would show a diff that no edit made.
      if (B.serializePresets(parts, parts.data) !== r.text) throw Error(`${B.PRESETS_FILE} is not in the form Layout Studio saves; edit it in the file`);
      st.parts = parts; st.data = parts.data; st.original = r.text; st.hash = r.hash;
      st.layoutKey = B.layoutKeys(st.data)[0];
      st.deviceId = host.devices().some((d) => d.id === DEFAULT_DEVICE) ? DEFAULT_DEVICE : host.devices()[0]?.id ?? null;
      ensureCanvas();
      rebuild({ fit: true });
    } catch (err) {
      st.error = `Could not load the battlefield: ${err.message}`;
      $('.bf-canvas').innerHTML = `<p class="lay-hint is-error">${esc(st.error)}</p>`;
      paintStatus();
    }
  }

  let loading = null;
  return {
    /** Load on first show, and fit when the view appears. */
    show() {
      if (!loading) loading = load();
      if (st.canvas && st.fitPending) { st.fitPending = false; st.canvas.fit(); }
      if (st.canvas) paintAll();
    },
    /** The files this view would save, as the review dialog and the save path take them. */
    changes() {
      if (!st.parts || !st.data || st.error) return [];
      const text = B.serializePresets(st.parts, st.data);
      return text === st.original ? [] : [{ path: B.PRESETS_FILE, text, baseHash: st.hash }];
    },
    /** A save went through: the new hash and text become the file the draft is compared with. */
    saved(files) {
      for (const f of files) {
        if (f.path !== B.PRESETS_FILE || !st.parts) continue;
        st.original = B.serializePresets(st.parts, st.data);
        st.hash = f.hash;
      }
      paintStatus();
    },
    /**
     * Reload the file from disk after a conflict: the draft and its history go. A presets
     * file deleted on disk (a 404) is the disk state: the draft goes, the canvas clears and
     * the view stays read-only until the file exists again. It reports missing.
     */
    async reload(path) {
      if (path !== B.PRESETS_FILE || !st.parts) return undefined;
      let r;
      try {
        r = await host.api(`files/read?path=${encodeURIComponent(B.PRESETS_FILE)}`);
      } catch (err) {
        if (err.status !== 404) throw err;
        st.parts = null; st.data = null; st.original = null; st.hash = null; st.layoutKey = null;
        host.history.clear();
        st.canvas?.setDoc({ width: 800, height: 600, items: [] });
        st.error = `${B.PRESETS_FILE} was deleted on disk`;
        paintAll();
        return { missing: true };
      }
      const parts = B.parsePresets(r.text);
      st.parts = parts; st.data = parts.data; st.original = r.text; st.hash = r.hash;
      st.preview = {};
      host.history.clear();
      rebuild();
      return undefined;
    },
    /** The hash the page last read or saved, for the conflict dialog. */
    hashOf(path) { return path === B.PRESETS_FILE ? st.hash : undefined; },
    /** "Keep my version" in the conflict dialog: the draft is saved over the disk copy, so it takes the disk hash. */
    keep(path, hash) { if (path === B.PRESETS_FILE && st.parts) { st.hash = hash; paintStatus(); } },
    layoutKey: () => st.layoutKey,
    selectLayout(key) { if (st.data && st.data[key]) { st.layoutKey = key; st.preview = {}; rebuild({ fit: true }); } },
    commands: () => [
      { title: 'Battlefield: fit to the page', sub: '0', run: () => st.canvas?.fit() },
      { title: 'Battlefield: align selected slots left', sub: 'Layout Studio', run: () => st.canvas?.align('left') },
    ],
  };
}

/** The game server's base URL from the Workbench's tools list, or null when it is not up. */
function gameBaseOf(tools = []) {
  const game = (Array.isArray(tools) ? tools : []).find((t) => t && t.id === 'game');
  return game && game.status === 'up' && game.url ? String(game.url).replace(/\/?$/, '/') : null;
}

/** The columns and rows as read-only values: the game picks the layout by its key, so these are not inputs. */
export function layoutKeyRowsHtml(pres) {
  return B.LAYOUT_KEY_FIELDS.map((key) => {
    const spec = B.FIELDS.find((f) => f.key === key);
    return `<div class="lay-row"><code title="${esc(key)}">${esc(spec.label)}</code><span><output data-bf-field="${esc(key)}" aria-readonly="true">${esc(pres[key] ?? spec.def)}</output> <span class="lay-note">Set by the layout key</span></span></div>`;
  }).join('');
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
