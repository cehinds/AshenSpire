// workbench/modules/layout/deck-view.mjs — Layout Studio's Deck row mode. Two parts, kept apart:
//
//  - Cost badges (SAVED): the groups the deck editor shows for MP and SP, in
//    content/config/ui/presentation/deckEditorCosts.json. Reorder, relabel, combine and split,
//    through deck-model.mjs. Saving goes through the shared review, and the game reads the file.
//  - Card row (PREVIEW ONLY): the reference card row from the Deck row tool, on the canvas kit,
//    through deck-row-model.mjs. The game does not read it, so it is never saved; it is drawn
//    with a note that says so.
//
// index.mjs mounts this view into its own root and supplies the host (the API, history, preview,
// toast and the canvas settings).
import { createCanvas, createLayersPanel } from '../../ui/kit/canvas.mjs';
import * as D from './deck-model.mjs';
import * as R from './deck-row-model.mjs';
import * as C from './config-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ZOOM_STEP = 1.25;
const ALIGN = [['left', 'Align left'], ['center', 'Align centre'], ['right', 'Align right'], ['top', 'Align top'], ['middle', 'Align middle'], ['bottom', 'Align bottom']];
/** The sample the badges are previewed with (the game's own badge rules, D.badgesFor, do the sums). */
const SAMPLE = Object.freeze({ action: 2, mana: 3, stamina: 2, variable: false });
const RESOURCE_NAME = Object.freeze({ mana: 'MP', stamina: 'SP', action: 'Action (legacy alias of SP)' });

const SHELL = `<div class="mode-bar dk-bar">
    <label class="lay-check"><input type="checkbox" data-dk="snap"> Snap</label>
    <label class="lay-check"><input type="checkbox" data-dk="grid"> Grid</label>
    <label class="lay-field">Row width <input type="number" min="200" max="1600" step="1" data-dk="row-width" class="dk-num"></label>
    <label class="lay-field">Height <input type="number" min="48" max="400" step="1" data-dk="row-height" class="dk-num"></label>
    <span class="lay-sep"></span>
    <button type="button" class="btn btn-sm btn-ghost" data-dk="zoom-out" title="Zoom out (-)">−</button>
    <button type="button" class="btn btn-sm btn-ghost" data-dk="fit" title="Fit to the page (0)">Fit</button>
    <button type="button" class="btn btn-sm btn-ghost" data-dk="zoom-in" title="Zoom in (+)">+</button>
    <span class="lay-sep"></span>
    <span class="lay-align">${ALIGN.map(([edge, label]) => `<button type="button" class="btn btn-sm btn-ghost" data-align="${edge}" title="${label} (needs a component selected)" disabled>${esc(label.replace('Align ', ''))}</button>`).join('')}
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="horizontal" title="Distribute horizontally (needs three components)" disabled>Dist H</button>
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="vertical" title="Distribute vertically (needs three components)" disabled>Dist V</button></span>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="layers" aria-expanded="false" aria-controls="dk-layers-pane">Layers</button>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="props" aria-expanded="false" aria-controls="dk-props-pane">Inspector</button>
    <button type="button" class="btn btn-sm" data-dk="preview" title="Open the map in the game preview with deck editing on: Deck, then Edit deck">Preview in game</button>
  </div>
  <div class="mode-body">
    <aside class="lay-left" id="dk-layers-pane"><div class="lay-panel-head"><span>Layers</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="dk-layers"></div></aside>
    <main class="lay-center"><p class="lay-note dk-note">${esc(R.ROW_NOTE)}</p><div class="dk-canvas"><p class="lay-hint">Loading the card row…</p></div><div class="lay-status dk-status" aria-live="polite"></div></main>
    <aside class="lay-right" id="dk-props-pane"><div class="lay-panel-head"><span>Inspector</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="dk-insp"></div></aside>
  </div>`;

/**
 * The Deck row view. host: { api(path), history, preview, toast(opts), changed?(), settings: { grid, canvas } }.
 * Returns the view's controller (show, changes, saved, reload, keep, hashOf, commands).
 */
export function createDeckView(root, host) {
  root.innerHTML = SHELL;
  const $ = (sel) => root.querySelector(sel);
  const st = {
    groups: null, original: null, hash: null, error: null,
    row: R.defaultRow(), selected: 'title',
    canvas: null, layers: null, autoFit: true, fitPending: false,
    snap: host.settings.grid.snap !== false, grid: host.settings.grid.show === true,
  };
  const groupsDoc = () => (st.groups ? { components: { resourceGroups: st.groups } } : null);
  const isDirty = () => Boolean(st.groups && D.changedText(st.original, groupsDoc()) !== null);

  // ---- drawing -------------------------------------------------------

  function rebuild({ fit = false } = {}) {
    if (!st.canvas) return;
    st.canvas.setDoc(R.toCanvasDoc(st.row));
    if (fit) { if (root.clientWidth) st.canvas.fit(); else st.fitPending = true; }
    paintAll();
  }

  function paintAll() { paintBar(); paintStatus(); paintInspector(); }

  function paintBar() {
    const sel = st.canvas ? st.canvas.getSelection().length : 0;
    for (const b of root.querySelectorAll('[data-align]')) b.disabled = sel < 1;
    for (const b of root.querySelectorAll('[data-distribute]')) b.disabled = sel < 3;
    $('[data-dk="snap"]').checked = st.snap;
    $('[data-dk="grid"]').checked = st.grid;
    $('[data-dk="row-width"]').value = st.row.row.width;
    $('[data-dk="row-height"]').value = st.row.row.height;
    const preview = $('[data-dk="preview"]');
    if (preview) preview.disabled = Boolean(st.error);
  }

  function paintStatus() {
    const parts = [];
    if (st.error) parts.push(st.error);
    parts.push(`card row ${st.row.row.width}×${st.row.row.height} (preview)`);
    if (st.groups) parts.push(`${st.groups.length} cost badge${st.groups.length === 1 ? '' : 's'}`, isDirty() ? 'unsaved changes' : 'saved');
    $('.dk-status').textContent = parts.join(' · ');
    if (host.changed) host.changed();
  }

  /** The inspector: the saved cost badges first (their order is what the game shows), then the selected component (preview). */
  function paintInspector() {
    const box = $('.dk-insp');
    const groups = st.groups || [];
    const preview = groups.length ? D.badgesFor(SAMPLE, groups).map((b) => `${esc(b.label)} ${esc(b.value)}`).join(' · ') : '';
    const groupRows = groups.map((g, i) => {
      const others = groups.map((o, j) => (j === i ? '' : `<option value="${j}">${esc(o.label)}</option>`)).join('');
      const resources = g.resources.map((r) => `<div class="lay-row"><code title="${esc(r)}">${esc(RESOURCE_NAME[r] || r)}</code><span class="dk-actions">
        ${groups.length > 1 && others ? `<select data-dk-move="${esc(r)}" aria-label="Show ${esc(r)} in"><option value="">Combine into…</option>${others}</select>` : ''}
        ${g.resources.length > 1 ? `<button type="button" class="btn btn-sm btn-ghost" data-dk-split="${esc(r)}">Split off</button>` : ''}</span></div>`).join('');
      return `<section class="dk-group"><div class="lay-row"><code>${i + 1}. ${esc(g.id)}</code><span class="dk-actions">
        <button type="button" class="btn btn-sm btn-ghost" data-dk-up="${i}" title="Show earlier"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="btn btn-sm btn-ghost" data-dk-down="${i}" title="Show later"${i === groups.length - 1 ? ' disabled' : ''}>↓</button></span></div>
        <div class="lay-row"><code title="label">Label</code><span><input type="text" data-dk-label="${i}" value="${esc(g.label)}"></span></div>
        ${resources}</section>`;
    }).join('');
    const costs = `<h3>Cost badges (saved)</h3>
      <p class="lay-note">The deck editor shows these in this order. Combine a resource to show two pools as one badge; split it to show them apart.</p>
      ${st.groups ? groupRows : '<p class="lay-note">The cost file was not loaded.</p>'}
      ${preview ? `<p class="lay-note">Sample (3 MP, 2 SP): ${preview}</p>` : ''}`;
    const sel = st.canvas ? st.canvas.getSelection() : [];
    let component = '';
    if (sel.length === 1 && R.COMPONENTS.includes(sel[0])) {
      const id = sel[0], b = st.row.elements[id];
      component = `<h3>${esc(R.LABELS[id])} (preview)</h3>
        <div class="lay-row"><code>X</code><span><input type="number" step="1" data-dk-field="x" data-dk-id="${id}" value="${Math.round(b.x * 100) / 100}"></span></div>
        <div class="lay-row"><code>Y</code><span><input type="number" step="1" data-dk-field="y" data-dk-id="${id}" value="${Math.round(b.y * 100) / 100}"></span></div>
        <div class="lay-row"><code>Width</code><span><input type="number" step="1" data-dk-field="width" data-dk-id="${id}" value="${Math.round(b.width * 100) / 100}"></span></div>
        <div class="lay-row"><code>Height</code><span><input type="number" step="1" data-dk-field="height" data-dk-id="${id}" value="${Math.round(b.height * 100) / 100}"></span></div>
        <div class="lay-row"><code>Font size</code><span><input type="number" step="1" data-dk-field="fontSize" data-dk-id="${id}" value="${b.fontSize}"></span></div>
        <div class="lay-row"><code>Visible</code><span><input type="checkbox" data-dk-field="visible" data-dk-id="${id}"${b.visible ? ' checked' : ''}></span></div>`;
    } else {
      component = `<h3>Card row (preview)</h3><p class="lay-note">Select a component to see its values. Copy or import the row as JSON below; it is a reference, not a saved value.</p>`;
    }
    box.innerHTML = `${costs}${component}
      <h3>Row JSON (preview)</h3>
      <textarea data-dk-json rows="6" aria-label="Card row JSON">${esc(R.rowJson(st.row))}</textarea>
      <div class="dk-actions"><button type="button" class="btn btn-sm" data-dk-import>Import JSON</button><button type="button" class="btn btn-sm btn-ghost" data-dk-copy>Copy JSON</button></div>`;
  }

  // ---- edits ---------------------------------------------------------

  /** Set the cost badges as one history step. The data is replaced, never mutated. */
  function setGroups(next, label) {
    const prev = st.groups;
    if (!next || next === prev) return false;
    const put = (g) => { st.groups = g; paintAll(); };
    put(next);
    host.history.push({ label, before: prev, after: next, undo: () => put(prev), redo: () => put(next) });
    return true;
  }

  /** Run one of the model's group edits; a refused edit says why and changes nothing. */
  function groupEdit(label, edit) {
    if (!st.groups) return;
    try {
      const next = edit(groupsDoc());
      setGroups(next.components.resourceGroups, label);
    } catch (err) {
      host.toast({ kind: 'warn', title: err.message, record: false });
      paintAll();
    }
  }

  /** Set the row (preview) as one history step. */
  function setRow(next, label) {
    const prev = st.row;
    if (next === prev) return;
    const put = (r) => { st.row = r; rebuild(); };
    put(next);
    host.history.push({ label, before: prev, after: next, undo: () => put(prev), redo: () => put(next) });
  }

  function onCanvasChange(doc, change) {
    setRow(R.fromCanvasDoc(st.row, doc), change?.label || 'Move card row component');
    rebuild();
  }

  function onInspectorChange(e) {
    const t = e.target;
    if (t.dataset.dkLabel !== undefined) {
      groupEdit('Relabel cost badge', (d) => D.setLabel(d, Number(t.dataset.dkLabel), t.value));
      return;
    }
    if (t.dataset.dkMove !== undefined) {
      if (t.value === '') return;
      // The target is the group's index in the row as drawn.
      groupEdit('Combine cost badges', (d) => D.moveResource(d, t.dataset.dkMove, Number(t.value)));
      return;
    }
    if (t.dataset.dkId) {
      if (t.dataset.dkField === 'visible') {
        setRow(R.setField(st.row, t.dataset.dkId, 'visible', t.checked), `Show ${R.LABELS[t.dataset.dkId]}`);
      } else if (t.value !== '') {
        try { setRow(R.setField(st.row, t.dataset.dkId, t.dataset.dkField, Number(t.value)), `Set ${R.LABELS[t.dataset.dkId]} ${t.dataset.dkField}`); }
        catch (err) { host.toast({ kind: 'warn', title: err.message, record: false }); }
      }
      rebuild();
      return;
    }
  }

  function onInspectorClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.dkUp !== undefined) { const i = Number(btn.dataset.dkUp); groupEdit('Reorder cost badges', (d) => D.reorderGroup(d, i, i - 1)); return; }
    if (btn.dataset.dkDown !== undefined) { const i = Number(btn.dataset.dkDown); groupEdit('Reorder cost badges', (d) => D.reorderGroup(d, i, i + 1)); return; }
    if (btn.dataset.dkSplit !== undefined) { const r = btn.dataset.dkSplit; groupEdit('Split cost badge', (d) => D.splitResource(d, r)); return; }
    if (btn.hasAttribute('data-dk-copy')) {
      const text = R.rowJson(st.row);
      const area = $('[data-dk-json]');
      area.value = text;
      navigator.clipboard?.writeText(text).then(
        () => host.toast({ kind: 'success', title: 'Row JSON copied', detail: 'A reference only: nothing was saved.', record: false }),
        () => { area.focus(); area.select(); host.toast({ kind: 'info', title: 'Select-all is ready', detail: 'Press Ctrl+C to copy the row JSON.', record: false }); },
      );
      return;
    }
    if (btn.hasAttribute('data-dk-import')) {
      try { setRow(R.validateRow(JSON.parse($('[data-dk-json]').value)), 'Import card row'); rebuild(); host.toast({ kind: 'success', title: 'Card row imported', detail: 'Preview only; nothing was saved.', record: false }); }
      catch (err) { host.toast({ kind: 'warn', title: `Import refused: ${err.message}`, record: false }); }
    }
  }

  function onBarChange(e) {
    const act = e.target.dataset.dk;
    if (act === 'snap') { st.snap = e.target.checked; st.canvas?.setSnap(st.snap); }
    else if (act === 'grid') { st.grid = e.target.checked; st.canvas?.setGrid(st.grid); }
    else if (act === 'row-width' || act === 'row-height') {
      const width = act === 'row-width' ? Number(e.target.value) : st.row.row.width;
      const height = act === 'row-height' ? Number(e.target.value) : st.row.row.height;
      if (!Number.isFinite(width) || !Number.isFinite(height)) { paintBar(); return; }
      setRow(R.setSize(st.row, { width, height }), 'Resize card row');
      rebuild({ fit: true });
    }
  }

  function onBarClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || !st.canvas) return;
    if (btn.dataset.align) { st.canvas.align(btn.dataset.align); return; }
    if (btn.dataset.distribute) { st.canvas.distribute(btn.dataset.distribute); return; }
    const act = btn.dataset.dk;
    if (act === 'zoom-in') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() * ZOOM_STEP); }
    else if (act === 'zoom-out') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() / ZOOM_STEP); }
    else if (act === 'fit') { st.autoFit = true; st.canvas.fit(); }
    else if (act === 'preview') previewHere();
  }

  /**
   * The map in the dock with deck editing on (a shot boot's settings): Deck, then Edit deck,
   * opens the editor with the cost badges. The dock shows the saved file, so save a draft first.
   */
  async function previewHere() {
    let base = null;
    try { base = gameBaseOf(await host.api('tools')); } catch { base = null; }
    if (!base) { host.toast({ kind: 'warn', title: 'The game server is not up', detail: 'Start the Workbench server; the preview needs the game.', record: false }); return; }
    const settings = encodeURIComponent(JSON.stringify({ deckEditing: true, deckEditingWhere: 'free' }));
    host.preview.showUrl(`${base}index.html?shot=map&shotSettings=${settings}`);
    host.toast({ kind: 'info', title: 'Previewing the map with deck editing on', detail: 'Tap Deck, then Edit deck, to see the cost badges. The dock shows the saved file; the card row here is not drawn in the game.', record: false });
  }

  function ensureCanvas() {
    if (st.canvas) return;
    const host0 = $('.dk-canvas');
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
    new ResizeObserver(() => { if (st.autoFit && st.canvas && $('.dk-canvas').clientWidth) st.canvas.fit(); }).observe($('.dk-canvas'));
    st.layers = createLayersPanel($('.dk-layers'), st.canvas);
    st.canvas.subscribe(() => paintBar());
    root.querySelector('.dk-bar').addEventListener('change', onBarChange);
    root.querySelector('.dk-bar').addEventListener('click', onBarClick);
    $('.dk-insp').addEventListener('change', onInspectorChange);
    $('.dk-insp').addEventListener('click', onInspectorClick);
  }

  // ---- load and the controller ----------------------------------------

  async function load() {
    try {
      const r = await host.api(`files/read?path=${encodeURIComponent(D.DECK_FILE)}`);
      const data = D.parseDeck(r.text);
      const problems = D.groupProblems(data);
      if (problems.length) throw Error(problems[0]);
      st.groups = data.components.resourceGroups; st.original = r.text; st.hash = r.hash;
      ensureCanvas();
      rebuild({ fit: true });
    } catch (err) {
      st.error = `Could not load the cost badges: ${err.message}`;
      ensureCanvas();
      rebuild({ fit: true });
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
    /** The files this view would save: only the cost badges, and only when they changed. */
    changes() {
      if (!st.groups || st.error) return [];
      const text = D.changedText(st.original, groupsDoc());
      return text === null ? [] : [{ path: D.DECK_FILE, text, baseHash: st.hash }];
    },
    /** A save went through: the text that was sent and the new hash become the file the draft is compared with. */
    saved(files, sent) {
      const base = C.savedBase(files, sent, D.DECK_FILE);
      if (base) { st.original = base.original; st.hash = base.hash; }
      paintStatus();
    },
    /** Reload from disk after a conflict: the draft and its history go. */
    async reload(path) {
      if (path !== D.DECK_FILE || !st.groups) return undefined;
      let r;
      try {
        r = await host.api(`files/read?path=${encodeURIComponent(D.DECK_FILE)}`);
      } catch (err) {
        if (err.status !== 404) throw err;
        st.groups = null; st.original = null; st.hash = null;
        host.history.clear();
        st.error = `${D.DECK_FILE} was deleted on disk`;
        paintAll();
        return { missing: true };
      }
      st.groups = D.parseDeck(r.text).components.resourceGroups; st.original = r.text; st.hash = r.hash;
      host.history.clear();
      paintAll();
      return undefined;
    },
    /** The hash the page last read or saved, for the conflict dialog. */
    hashOf(path) { return path === D.DECK_FILE ? st.hash : undefined; },
    /** "Keep my version": the draft is saved over the disk copy, so it takes the disk hash. */
    keep(path, hash) { if (path === D.DECK_FILE && st.groups) { st.hash = hash; paintStatus(); } },
    commands: () => [
      { title: 'Deck row: fit to the page', sub: '0', run: () => st.canvas?.fit() },
      { title: 'Deck row: copy the row JSON', sub: 'Layout Studio', run: () => $('[data-dk-copy]')?.click() },
    ],
  };
}

/** The game server's base URL from the Workbench's tools list, or null when it is not up. */
function gameBaseOf(tools = []) {
  const game = (Array.isArray(tools) ? tools : []).find((t) => t && t.id === 'game');
  return game && game.status === 'up' && game.url ? String(game.url).replace(/\/?$/, '/') : null;
}
