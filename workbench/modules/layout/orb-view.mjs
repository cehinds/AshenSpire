// workbench/modules/layout/orb-view.mjs — Layout Studio's SP orb mode: the combat footer's
// SP group (the orb, frame, sigil, number, label and the mana sockets) on the canvas kit,
// edited through orb-model.mjs. The data file is content/config/ui/presentation/footerLayout.json.
// The rest of the footer is drawn as locked context. index.mjs mounts this view into its own
// root and supplies the host (the API, history, preview, toast and the canvas settings).
import { createCanvas, createLayersPanel } from '../../ui/kit/canvas.mjs';
import { footerBounds } from '../../../src/ui/models/FooterLayoutModel.js';
import { footerFonts } from '../../../src/content/footerLayout.js';
import { staminaOrb } from '../../../src/content/staminaOrb.js';
import { assetUrl } from '../../../src/ui/assetmap.js';
import * as O from './orb-model.mjs';
import * as C from './config-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ZOOM_STEP = 1.25;
const ALIGN = [['left', 'Align left'], ['center', 'Align centre'], ['right', 'Align right'], ['top', 'Align top'], ['middle', 'Align middle'], ['bottom', 'Align bottom']];
const round2 = (v) => Math.round(v * 100) / 100;

const SHELL = `<div class="mode-bar orb-bar">
    <label class="lay-check"><input type="checkbox" data-orb="snap"> Snap</label>
    <label class="lay-check"><input type="checkbox" data-orb="grid"> Grid</label>
    <span class="lay-sep"></span>
    <button type="button" class="btn btn-sm btn-ghost" data-orb="zoom-out" title="Zoom out (-)">−</button>
    <button type="button" class="btn btn-sm btn-ghost" data-orb="fit" title="Fit to the page (0)">Fit</button>
    <button type="button" class="btn btn-sm btn-ghost" data-orb="zoom-in" title="Zoom in (+)">+</button>
    <span class="lay-sep"></span>
    <span class="lay-align">${ALIGN.map(([edge, label]) => `<button type="button" class="btn btn-sm btn-ghost" data-align="${edge}" title="${label} (needs an SP item selected)" disabled>${esc(label.replace('Align ', ''))}</button>`).join('')}
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="horizontal" title="Distribute horizontally (needs three SP items)" disabled>Dist H</button>
      <button type="button" class="btn btn-sm btn-ghost" data-distribute="vertical" title="Distribute vertically (needs three SP items)" disabled>Dist V</button></span>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="layers" aria-expanded="false" aria-controls="orb-layers-pane">Layers</button>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="props" aria-expanded="false" aria-controls="orb-props-pane">Inspector</button>
    <button type="button" class="btn btn-sm" data-orb="png" title="Download the SP group as a transparent PNG (not saved to the repo)">Export PNG</button>
    <button type="button" class="btn btn-sm" data-orb="preview" title="Show the game's combat footer">Preview in combat</button>
  </div>
  <div class="mode-body">
    <aside class="lay-left" id="orb-layers-pane"><div class="lay-panel-head"><span>Layers</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="orb-layers"></div></aside>
    <main class="lay-center"><div class="orb-canvas"><p class="lay-hint">Loading the combat footer…</p></div><div class="lay-status orb-status" aria-live="polite"></div></main>
    <aside class="lay-right" id="orb-props-pane"><div class="lay-panel-head"><span>Inspector</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="orb-insp"></div></aside>
  </div>`;

/**
 * The SP orb view. host: { api(path), history, preview, toast(opts), changed?(), settings: { grid, canvas } }.
 * Returns the view's controller (show, changes, saved, reload, keep, hashOf, commands).
 */
export function createOrbView(root, host) {
  root.innerHTML = SHELL;
  const $ = (sel) => root.querySelector(sel);
  const st = {
    data: null, original: null, hash: null, error: null,
    canvas: null, layers: null, autoFit: true, fitPending: false,
    snap: host.settings.grid.snap !== false, grid: host.settings.grid.show === true,
  };
  const spSet = () => new Set(st.data ? O.spIds(st.data) : []);
  const itemOf = (id) => (st.data ? st.data.components.layout.items.find((n) => n.id === id) : null);
  const selection = () => (st.canvas ? st.canvas.getSelection() : []);
  const selectedSp = () => { const sp = spSet(); return selection().filter((id) => sp.has(id)); };
  const isDirty = () => Boolean(st.data && O.changedText(st.original, st.data) !== null);

  // ---- drawing -------------------------------------------------------

  function rebuild({ fit = false } = {}) {
    if (!st.data || !st.canvas) return;
    st.canvas.setDoc(O.toCanvasDoc(st.data));
    if (fit) { if (root.clientWidth) st.canvas.fit(); else st.fitPending = true; }
    paintAll();
  }

  function paintAll() { paintBar(); paintStatus(); paintInspector(); }

  function paintBar() {
    const n = selectedSp().length, all = selection().length;
    const onlySp = all > 0 && n === all;
    for (const b of root.querySelectorAll('[data-align]')) b.disabled = !onlySp || Boolean(st.error);
    for (const b of root.querySelectorAll('[data-distribute]')) b.disabled = !onlySp || n < 3 || Boolean(st.error);
    $('[data-orb="snap"]').checked = st.snap;
    $('[data-orb="grid"]').checked = st.grid;
    const png = $('[data-orb="png"]'), preview = $('[data-orb="preview"]');
    if (png) png.disabled = !st.data;
    if (preview) preview.disabled = Boolean(st.error);
  }

  function paintStatus() {
    const parts = [];
    if (st.error) parts.push(st.error);
    if (st.data) {
      const { width, height } = O.toCanvasDoc(st.data);
      parts.push(`${width}×${height} footer`, `SP group ${spSet().size} items`, isDirty() ? 'unsaved changes' : 'saved');
    }
    $('.orb-status').textContent = parts.join(' · ');
    if (host.changed) host.changed();
  }

  /** The numeric inspector: an SP item's values, editable; a context item names itself and says where it is edited. */
  function paintInspector() {
    const box = $('.orb-insp');
    if (!st.data) { box.innerHTML = ''; return; }
    const ids = selection();
    if (ids.length !== 1) {
      box.innerHTML = ids.length
        ? `<p class="lay-note">${ids.length} items selected. Select one to see its values.</p>`
        : `<p class="lay-note">Select an SP item to see its values. Drag it, nudge it with the arrow keys, or type a value here. Slots are the mana sockets; the ring follows their order.</p>`;
      return;
    }
    const it = itemOf(ids[0]);
    if (!it) { box.innerHTML = ''; return; }
    if (!spSet().has(it.id)) {
      box.innerHTML = `<h3>${esc(it.name || it.id)}</h3><p class="lay-note">This art belongs to another footer group (${esc(it.group || 'none')}). It is drawn here for context and is not edited in this mode.</p>`;
      return;
    }
    const row = (field, label, value) => `<div class="lay-row"><code title="${esc(field)}">${esc(label)}</code><span><input type="number" step="any" data-orb-field="${esc(field)}" data-orb-id="${esc(it.id)}" value="${esc(round2(value))}"></span></div>`;
    const fields = [
      row('x', 'X (px)', it.x), row('y', 'Y (px)', it.y), row('w', 'Width (px)', it.w), row('h', 'Height (px)', it.h),
      row('opacity', 'Opacity (0–1)', it.opacity ?? 1),
      `<div class="lay-row"><code title="visible">Visible</code><span><input type="checkbox" data-orb-field="visible" data-orb-id="${esc(it.id)}"${it.visible !== false ? ' checked' : ''}></span></div>`,
    ];
    if (it.asset === 'text') fields.push(row('fontSize', 'Font size (px)', it.fontSize));
    box.innerHTML = `<h3>${esc(it.name || it.id)}</h3><p class="lay-note">${esc(it.id)} · ${esc(it.asset)}${it.asset === 'text' ? ` · ${esc(it.text || '')}` : ''}</p>${fields.join('')}`;
  }

  // ---- edits ---------------------------------------------------------

  /** Set the footer draft as one history step. The data is replaced, never mutated. */
  function setData(next, label) {
    const prev = st.data;
    if (!next || next === prev) return false;
    const put = (d) => { st.data = d; rebuild(); };
    put(next);
    host.history.push({ label, before: prev, after: next, undo: () => put(prev), redo: () => put(next) });
    return true;
  }

  /** A finished canvas gesture (drag, nudge, align, distribute) becomes one history step. */
  function onCanvasChange(doc, change) {
    if (!st.data) { rebuild(); return; }
    const next = O.fromCanvasDoc(st.data, doc);
    setData(next, change?.label || 'Move SP items');
    rebuild();
  }

  function onInspectorChange(e) {
    const t = e.target;
    const field = t.dataset.orbField, id = t.dataset.orbId;
    if (!st.data || !field || !id) return;
    if (field !== 'visible' && t.value === '') { paintInspector(); return; }
    try {
      const value = field === 'visible' ? t.checked : Number(t.value);
      setData(O.setItemField(st.data, id, field, value), `Set ${id} ${field}`);
    } catch (err) {
      host.toast({ kind: 'warn', title: err.message, record: false });
    }
    rebuild();
  }

  function onBarChange(e) {
    const act = e.target.dataset.orb;
    if (act === 'snap') { st.snap = e.target.checked; st.canvas?.setSnap(st.snap); }
    else if (act === 'grid') { st.grid = e.target.checked; st.canvas?.setGrid(st.grid); }
  }

  function onBarClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || !st.canvas) return;
    if (btn.dataset.align) { st.canvas.align(btn.dataset.align); return; }
    if (btn.dataset.distribute) { st.canvas.distribute(btn.dataset.distribute); return; }
    const act = btn.dataset.orb;
    if (act === 'zoom-in') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() * ZOOM_STEP); }
    else if (act === 'zoom-out') { st.autoFit = false; st.canvas.zoomTo(st.canvas.getZoom() / ZOOM_STEP); }
    else if (act === 'fit') { st.autoFit = true; st.canvas.fit(); }
    else if (act === 'preview') previewHere();
    else if (act === 'png') exportPng();
  }

  /**
   * The game's combat footer in the dock (?shot=combat on the game server). The dock shows the
   * saved file, so save a draft first to see it; the dock's size is the user's to set.
   */
  async function previewHere() {
    let base = null;
    try { base = gameBaseOf(await host.api('tools')); } catch { base = null; }
    if (!base) { host.toast({ kind: 'warn', title: 'The game server is not up', detail: 'Start the Workbench server; the preview needs the game.', record: false }); return; }
    host.preview.showUrl(`${base}index.html?shot=combat`);
    host.toast({ kind: 'info', title: 'Previewing the combat footer', detail: 'The combat fixture with the saved footer. Set the dock to a desktop size to compare; Back returns to the game.', record: false });
  }

  /**
   * The SP group as a transparent PNG at 2x, drawn in file order from the same art the game
   * paints (staminaOrb.assets). An export for the owner, not a save: nothing is written to the repo.
   */
  async function exportPng() {
    if (!st.data) return;
    const layout = st.data.components.layout;
    const sp = spSet();
    const items = layout.items.filter((n) => sp.has(n.id) && n.visible !== false);
    if (!items.length) { host.toast({ kind: 'warn', title: 'No SP item is visible', record: false }); return; }
    const b = footerBounds(items), scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(b.w * scale); canvas.height = Math.ceil(b.h * scale);
    const g = canvas.getContext('2d');
    g.scale(scale, scale);
    const images = await loadImages(items.filter((n) => n.asset !== 'text').map((n) => n.asset));
    for (const n of items) {
      g.save();
      g.globalAlpha = n.opacity ?? 1;
      if (n.asset === 'text') {
        g.font = `${n.fontWeight || 400} ${n.fontStyle && n.fontStyle !== 'normal' ? `${n.fontStyle} ` : ''}${n.fontSize}px ${footerFonts[n.fontFamily] || footerFonts.serif}`;
        g.fillStyle = n.color || '#e7dcc0';
        g.textAlign = n.textAlign === 'left' ? 'left' : n.textAlign === 'right' ? 'right' : 'center';
        g.textBaseline = 'middle';
        const x = n.x + (g.textAlign === 'right' ? n.w : g.textAlign === 'center' ? n.w / 2 : 0);
        // The authored sample ({value} shows the item's name, e.g. 3 and SP), as the footer's own draw does with its binding.
        g.fillText(String(n.text ?? '').replaceAll('{value}', n.name || ''), x - b.x, n.y + n.h / 2 - b.y);
      } else if (images[n.asset]) {
        g.drawImage(images[n.asset], n.x - b.x, n.y - b.y, n.w, n.h);
      }
      g.restore();
    }
    canvas.toBlob((blob) => {
      if (!blob) { host.toast({ kind: 'error', title: 'The PNG could not be made', record: false }); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ashenspire-sp-orb.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      host.toast({ kind: 'success', title: 'PNG downloaded', detail: 'Exported from the saved draft. Nothing was written to the repo.', record: false });
    }, 'image/png');
  }

  async function loadImages(assets) {
    const out = {};
    await Promise.all([...new Set(assets)].map(async (asset) => {
      const path = staminaOrb.assets[asset];
      if (!path) return;
      const img = new Image();
      img.src = assetUrl(path);
      try { await img.decode(); out[asset] = img; } catch { /* a missing art is drawn as nothing */ }
    }));
    return out;
  }

  function ensureCanvas() {
    if (st.canvas) return;
    const host0 = $('.orb-canvas');
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
    new ResizeObserver(() => { if (st.autoFit && st.canvas && $('.orb-canvas').clientWidth) st.canvas.fit(); }).observe($('.orb-canvas'));
    st.layers = createLayersPanel($('.orb-layers'), st.canvas);
    st.canvas.subscribe(() => paintBar());
    root.querySelector('.orb-bar').addEventListener('change', onBarChange);
    root.querySelector('.orb-bar').addEventListener('click', onBarClick);
    $('.orb-insp').addEventListener('change', onInspectorChange);
  }

  // ---- load and the controller ----------------------------------------

  async function load() {
    try {
      const r = await host.api(`files/read?path=${encodeURIComponent(O.FOOTER_FILE)}`);
      const data = O.parseFooter(r.text);
      // Saving writes the file back in this form; a file in another form would show a diff that no edit made.
      if (O.serializeFooter(data) !== r.text) throw Error(`${O.FOOTER_FILE} is not in the form Layout Studio saves; edit it in the file`);
      const problems = O.footerProblems(data);
      if (problems.length) throw Error(`${O.FOOTER_FILE}: ${problems[0]}`);
      st.data = data; st.original = r.text; st.hash = r.hash;
      ensureCanvas();
      rebuild({ fit: true });
    } catch (err) {
      st.error = `Could not load the SP orb: ${err.message}`;
      $('.orb-canvas').innerHTML = `<p class="lay-hint is-error">${esc(st.error)}</p>`;
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
      if (!st.data || st.error) return [];
      const text = O.changedText(st.original, st.data);
      return text === null ? [] : [{ path: O.FOOTER_FILE, text, baseHash: st.hash }];
    },
    /** A save went through: the text that was sent and the new hash become the file the draft is compared with. */
    saved(files, sent) {
      const base = C.savedBase(files, sent, O.FOOTER_FILE);
      if (base) { st.original = base.original; st.hash = base.hash; }
      paintStatus();
    },
    /** Reload from disk after a conflict: the draft and its history go. A file deleted on disk reports missing. */
    async reload(path) {
      if (path !== O.FOOTER_FILE || !st.data) return undefined;
      let r;
      try {
        r = await host.api(`files/read?path=${encodeURIComponent(O.FOOTER_FILE)}`);
      } catch (err) {
        if (err.status !== 404) throw err;
        st.data = null; st.original = null; st.hash = null;
        host.history.clear();
        st.canvas?.setDoc({ width: 800, height: 600, items: [] });
        st.error = `${O.FOOTER_FILE} was deleted on disk`;
        paintAll();
        return { missing: true };
      }
      st.data = O.parseFooter(r.text); st.original = r.text; st.hash = r.hash;
      host.history.clear();
      rebuild();
      return undefined;
    },
    /** The hash the page last read or saved, for the conflict dialog. */
    hashOf(path) { return path === O.FOOTER_FILE ? st.hash : undefined; },
    /** "Keep my version": the draft is saved over the disk copy, so it takes the disk hash. */
    keep(path, hash) { if (path === O.FOOTER_FILE && st.data) { st.hash = hash; paintStatus(); } },
    commands: () => [
      { title: 'SP orb: fit to the page', sub: '0', run: () => st.canvas?.fit() },
      { title: 'SP orb: align selected SP items left', sub: 'Layout Studio', run: () => st.canvas?.align('left') },
      { title: 'SP orb: export PNG', sub: 'Layout Studio', run: () => exportPng() },
    ],
  };
}

/** The game server's base URL from the Workbench's tools list, or null when it is not up. */
function gameBaseOf(tools = []) {
  const game = (Array.isArray(tools) ? tools : []).find((t) => t && t.id === 'game');
  return game && game.status === 'up' && game.url ? String(game.url).replace(/\/?$/, '/') : null;
}
