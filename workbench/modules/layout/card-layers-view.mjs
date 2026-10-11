// workbench/modules/layout/card-layers-view.mjs — Layout Studio's "Card layers" mode. The card is drawn
// by the game's own card renderer on the game server (card-layers-render.html, an iframe that talks over
// postMessage, origin-checked both ways). Over it, one box per visible layer: click to select, drag to
// move, drag the corner to resize, arrow keys nudge. The inspector edits the numbers; the layer list
// sets the paint order and visibility. Every gesture is one history step and a draft until the shared
// review saves it to src/content/card-layout.json. index.mjs mounts this view and supplies the host.
import * as CL from './card-layers-model.mjs';
import * as K from './book-model.mjs';
import * as C from './config-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = '/modules/layout/card-layers-view.css';
const SERVER_HINT = 'The card is drawn by the game server. Start it from the Library or Home, then reopen this mode.';
const ZOOM_STEP = 1.25;
const NUDGE = 1;
const NUDGE_SHIFT = 10;
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const FIELDS = [['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height'], ['rotation', 'Rotation'], ['opacity', 'Opacity']];

const SHELL = `<div class="mode-bar cl-bar">
    <button type="button" class="btn btn-sm lay-toggle" data-panel="layers" aria-expanded="false" aria-controls="cl-layers-pane">Layers</button>
    <button type="button" class="btn btn-sm lay-toggle" data-panel="props" aria-expanded="false" aria-controls="cl-props-pane">Inspector</button>
    <span class="lay-sep"></span>
    <button type="button" class="btn btn-sm btn-ghost" data-cl="zoom-out" title="Zoom out">−</button>
    <button type="button" class="btn btn-sm btn-ghost" data-cl="fit" title="Fit the card">Fit</button>
    <button type="button" class="btn btn-sm btn-ghost" data-cl="zoom-in" title="Zoom in">+</button>
    <span class="lay-sep"></span>
    <button type="button" class="btn btn-sm btn-ghost" data-cl="revert" disabled title="Put the layout back to the saved file">Revert layout</button>
    <span class="spacer"></span>
    <span class="cl-file" data-cl="file"></span>
  </div>
  <div class="mode-body cl-body">
    <aside class="lay-left" id="cl-layers-pane" aria-label="Layers"><div class="lay-panel-head"><span>Layers</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><ol class="cl-layers" aria-label="Layers, front first"></ol></aside>
    <main class="lay-center cl-main">
      <div class="cl-wrap">
        <div class="cl-stage">
          <iframe class="cl-frame" title="The card, drawn by the game" hidden></iframe>
          <div class="cl-boxes" aria-label="Layer boxes"></div>
        </div>
        <p class="lay-hint cl-setup" hidden></p>
      </div>
      <div class="lay-status cl-status" aria-live="polite"></div>
    </main>
    <aside class="lay-right" id="cl-props-pane" aria-label="Inspector"><div class="lay-panel-head"><span>Inspector</span><button type="button" class="btn btn-sm" data-panel-close>Close</button></div><div class="cl-insp"></div></aside>
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
 * The Card layers view. host: { api(path), history, toast(opts), changed(), onReload }.
 * Returns the view's controller (show, hide, changes, saved, reload, keep, hashOf, commands).
 */
export function createCardLayersView(root, host) {
  ensureCss();
  root.innerHTML = SHELL;
  const $ = (sel) => root.querySelector(sel);
  const frame = $('.cl-frame');
  const boxes = $('.cl-boxes');
  const stageEl = $('.cl-stage');
  const st = {
    text: null, hash: null, data: null, format: null, error: null, problems: [],
    selected: null, zoom: 1, fitted: true, loading: null,
    game: null, ready: false, serverId: null, framed: false, nonce: 0, readyTimer: null, connecting: null,
    gesture: null, note: '',
  };
  let offReload = null;

  const dims = () => ({ width: st.data?.width || 360, height: st.data?.height || 540 });
  const layerOf = (id) => (st.data && id != null ? st.data.layers[CL.indexOfLayer(st.data, id)] || null : null);
  const dirty = () => Boolean(st.data && st.text !== null && CL.changesFor({ original: st.text, data: st.data }).length);

  // ---- the game render page ---------------------------------------------

  /** Send the draft to the render page, which draws it with the game's card renderer. */
  function sendSet() {
    if (!st.ready || !st.game || !frame.contentWindow || !st.data) return;
    frame.contentWindow.postMessage({ source: CL.MODULE_SOURCE, type: 'set', layout: st.data }, st.game.origin);
  }

  /**
   * Resolve the game server and point the frame at its render page: keep a ready frame of this
   * server, load the page again (first show, restart, rebuild), or show the setup note while no
   * server is up. Concurrent calls share one lookup, as book-view does.
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
    $('.cl-setup').hidden = true;
    frame.src = CL.renderUrl(base, { parentOrigin: location.origin, nonce: st.framed ? ++st.nonce : 0 });
    st.framed = true;
    clearTimeout(st.readyTimer);
    st.readyTimer = setTimeout(() => { if (!st.ready) showSetup(SERVER_HINT); }, 12000);
  }

  function subscribe() {
    if (offReload || typeof host.onReload !== 'function') return;
    offReload = host.onReload((ev) => { connect({ force: ev?.kind === 'reload' }); });
  }

  function unsubscribe() { if (offReload) { offReload(); offReload = null; } }

  function showSetup(message) {
    st.ready = false;
    frame.hidden = true;
    const p = $('.cl-setup');
    p.hidden = false;
    p.textContent = message;
    paintStatus();
  }

  function onMessage(ev) {
    if (!st.game || ev.origin !== st.game.origin || ev.source !== frame.contentWindow) return;
    const d = ev.data;
    if (!d || d.source !== CL.RENDER_SOURCE) return;
    if (d.type === 'ready') {
      clearTimeout(st.readyTimer);
      if (d.protocol !== CL.RENDER_PROTOCOL) { showSetup('This checkout\'s card render page is a different version. Update the checkout to this branch.'); return; }
      st.ready = true;
      sendSet();
      paintStatus();
      return;
    }
    if (d.type === 'refused') st.note = 'The game page refused the draft: a layer value is out of range.';
    if (d.type === 'failed') showSetup('The game could not draw the card. Check the game server log.');
    paintStatus();
  }

  // ---- drawing ---------------------------------------------------------

  function paintAll() {
    paintBar(); paintLayers(); paintStage(); paintInspector(); paintStatus();
    sendSet();
    if (host.changed) host.changed();
  }

  function paintBar() {
    $('[data-cl="revert"]').disabled = !dirty();
    $('[data-cl="file"]').textContent = CL.LAYOUT_FILE + (dirty() ? ' •' : '');
  }

  function paintLayers() {
    const rows = st.data ? CL.layerRows(st.data) : [];
    $('.cl-layers').innerHTML = rows.map((r) => `<li class="cl-row${r.id === st.selected ? ' is-selected' : ''}${r.visible ? '' : ' is-hidden'}">
        <button type="button" class="cl-pick" data-cl-select="${esc(r.id)}" aria-pressed="${r.id === st.selected}"><code>${esc(r.id)}</code> <span class="lay-note">${esc(r.type)}</span></button>
        <label class="lay-check"><input type="checkbox" data-cl-flag="visible" data-cl-id="${esc(r.id)}"${r.visible ? ' checked' : ''}> Show</label>
        <label class="lay-check"><input type="checkbox" data-cl-flag="locked" data-cl-id="${esc(r.id)}"${r.locked ? ' checked' : ''}> Lock</label>
      </li>`).join('') || '<li class="lay-note">No layers in the file.</li>';
  }

  /** The stage is the card at the zoom; one box per visible layer sits over it in design units. */
  function paintStage() {
    const { width, height } = dims();
    stageEl.style.width = `${Math.round(width * st.zoom)}px`;
    stageEl.style.height = `${Math.round(height * st.zoom)}px`;
    frame.style.width = '100%';
    frame.style.height = '100%';
    if (!st.data) { boxes.innerHTML = ''; return; }
    boxes.innerHTML = st.data.layers.map((layer) => {
      if (layer.visible === false) return '';
      const sel = layer.id === st.selected;
      const cls = `cl-box${sel ? ' is-selected' : ''}${layer.locked ? ' is-locked' : ''}`;
      const pct = (v, d) => `${(v / d) * 100}%`;
      return `<div class="${cls}" data-cl-box="${esc(layer.id)}" title="${esc(layer.name || layer.id)}"
          style="left:${pct(layer.x, width)};top:${pct(layer.y, height)};width:${pct(layer.w, width)};height:${pct(layer.h, height)}">${sel && !layer.locked ? '<span class="cl-handle" data-cl-handle="se" aria-hidden="true"></span>' : ''}</div>`;
    }).join('');
  }

  /** The inspector: the selected layer's numbers and flags, and its place in the paint order. */
  function paintInspector() {
    const layer = layerOf(st.selected);
    if (!layer) {
      $('.cl-insp').innerHTML = `<p class="lay-note">${st.data ? 'Select a layer on the card or in the list.' : 'The layout file was not loaded.'}</p>`;
      return;
    }
    const rows = FIELDS.map(([key, label]) => `<div class="lay-row"><code>${esc(label)}</code><span><input type="number" step="any" data-cl-field="${key}" value="${esc(layer[key] ?? '')}" aria-label="${esc(label)}"></span></div>`).join('');
    const order = CL.indexOfLayer(st.data, layer.id);
    $('.cl-insp').innerHTML = `<h3>${esc(layer.name || layer.id)}</h3>
      <p class="lay-note">${esc(layer.type)} layer${layer.bind ? ` bound to ${esc(layer.bind)}` : ''}. Paint order ${order + 1} of ${st.data.layers.length}.</p>
      ${rows}
      <div class="lay-row"><code>Show</code><span><input type="checkbox" data-cl-flag="visible" data-cl-id="${esc(layer.id)}"${layer.visible !== false ? ' checked' : ''}></span></div>
      <div class="lay-row"><code>Lock</code><span><input type="checkbox" data-cl-flag="locked" data-cl-id="${esc(layer.id)}"${layer.locked ? ' checked' : ''}></span></div>
      <div class="cl-order"><button type="button" class="btn btn-sm btn-ghost" data-cl-order="-1"${order === 0 ? ' disabled' : ''} title="Draw earlier (further back)">Send back</button>
        <button type="button" class="btn btn-sm btn-ghost" data-cl-order="1"${order === st.data.layers.length - 1 ? ' disabled' : ''} title="Draw later (further front)">Bring forward</button></div>
      <p class="lay-note">Rotation turns the layer in the game; its box on the card is not rotated.</p>`;
  }

  function paintStatus() {
    const parts = [];
    if (st.error) parts.push(st.error);
    if (st.problems.length) parts.push(`${st.problems.length} problem${st.problems.length === 1 ? '' : 's'} in the saved file: ${st.problems[0]}`);
    const { width, height } = dims();
    if (st.data) parts.push(`${st.data.layers.length} layers`, `card ${width}×${height}`, `zoom ${Math.round(st.zoom * 100)}%`, dirty() ? 'unsaved changes' : 'saved');
    if (st.note) parts.push(st.note);
    $('.cl-status').textContent = parts.join(' · ');
  }

  // ---- edits -------------------------------------------------------------

  /** Set the draft as one history step. The document is replaced, never mutated, so undo and redo put it back. */
  function setDraft(next, label) {
    const prev = st.data;
    if (!next || next === prev) return false;
    const put = (d) => { st.data = d; paintAll(); };
    put(next);
    host.history.push({ label, before: prev, after: next, undo: () => put(prev), redo: () => put(next) });
    return true;
  }

  /** Run a model edit; a refused edit says why and changes nothing. */
  function edit(label, run) {
    if (!st.data) return;
    let next;
    try { next = run(st.data); } catch (err) {
      host.toast({ kind: 'warn', title: `${label} not changed`, detail: err.message, record: false });
      paintInspector();
      return;
    }
    setDraft(next, label);
  }

  function select(id) {
    if (!layerOf(id)) return;
    st.selected = id;
    paintLayers(); paintStage(); paintInspector(); paintStatus();
  }

  function onInspectorChange(e) {
    const t = e.target;
    if (!st.selected) return;
    if (t.dataset.clField) {
      if (t.value === '') { paintInspector(); return; }
      const value = Number(t.value);
      edit(`Set ${st.selected} ${t.dataset.clField}`, (d) => CL.setLayerField(d, st.selected, t.dataset.clField, value));
      return;
    }
    if (t.dataset.clFlag) {
      const id = t.dataset.clId || st.selected;
      const flag = t.dataset.clFlag;
      const verb = flag === 'locked' ? (t.checked ? 'Lock' : 'Unlock') : (t.checked ? 'Show' : 'Hide');
      edit(`${verb} ${id}`, (d) => CL.setLayerField(d, id, flag, t.checked));
    }
  }

  function onRootClick(e) {
    const pick = e.target.closest('[data-cl-select]');
    if (pick) { select(pick.dataset.clSelect); return; }
    const order = e.target.closest('[data-cl-order]');
    if (order && !order.disabled && st.selected) {
      const to = CL.indexOfLayer(st.data, st.selected) + Number(order.dataset.clOrder);
      edit(`Reorder ${st.selected}`, (d) => CL.reorderLayer(d, st.selected, to));
      return;
    }
    const zoom = e.target.closest('[data-cl]');
    if (!zoom) return;
    const act = zoom.dataset.cl;
    if (act === 'zoom-in') setZoom(st.zoom * ZOOM_STEP, false);
    else if (act === 'zoom-out') setZoom(st.zoom / ZOOM_STEP, false);
    else if (act === 'fit') fit();
    else if (act === 'revert' && !zoom.disabled && st.text !== null) {
      edit('Revert the layout', () => CL.parseLayout(st.text).data);
    }
  }

  function setZoom(z, fitted) {
    st.zoom = Math.min(4, Math.max(0.2, Math.round(z * 1000) / 1000));
    st.fitted = fitted;
    paintStage(); paintStatus();
  }

  /** Fit the card in the stage area; the stage is measured only while the view is on screen. */
  function fit() {
    const wrap = $('.cl-wrap');
    const { width, height } = dims();
    if (!wrap.clientWidth || !wrap.clientHeight) return;
    setZoom(Math.min((wrap.clientWidth - 40) / width, (wrap.clientHeight - 40) / height), true);
  }

  // ---- pointer gestures on the boxes -------------------------------------

  function onBoxDown(e) {
    const hit = e.target.closest('[data-cl-box]');
    if (!hit || e.button !== 0) return;
    const id = hit.dataset.clBox;
    const handle = Boolean(e.target.closest('[data-cl-handle]'));
    // Selecting redraws the boxes, so the box the gesture moves is looked up after it.
    if (id !== st.selected) select(id);
    const layer = layerOf(id);
    if (!layer || layer.locked) return;
    const el = [...boxes.children].find((b) => b.dataset.clBox === id);
    if (!el) return;
    st.gesture = {
      id, kind: handle ? 'resize' : 'move', pointer: e.pointerId, sx: e.clientX, sy: e.clientY,
      box: { x: layer.x, y: layer.y, w: layer.w, h: layer.h }, el, moved: false, delta: { dx: 0, dy: 0 },
    };
    boxes.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  /** While dragging, only the box follows the pointer (in screen pixels); the card redraws on release. */
  function boxAt(g, dx, dy) {
    const b = g.box;
    const next = g.kind === 'move'
      ? { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }
      : { x: b.x, y: b.y, w: Math.max(1, b.w + dx), h: Math.max(1, b.h + dy) };
    return next;
  }

  function onBoxMove(e) {
    const g = st.gesture;
    if (!g || g.pointer !== e.pointerId) return;
    const dx = (e.clientX - g.sx) / st.zoom, dy = (e.clientY - g.sy) / st.zoom;
    g.delta = { dx, dy };
    const { width, height } = dims();
    const next = boxAt(g, dx, dy);
    g.el.style.left = `${(next.x / width) * 100}%`;
    g.el.style.top = `${(next.y / height) * 100}%`;
    g.el.style.width = `${(next.w / width) * 100}%`;
    g.el.style.height = `${(next.h / height) * 100}%`;
    g.moved = true;
  }

  function onBoxUp(e) {
    const g = st.gesture;
    if (!g || g.pointer !== e.pointerId) return;
    st.gesture = null;
    if (!g.moved) { paintStage(); return; }
    const { dx, dy } = g.delta;
    if (g.kind === 'move') {
      edit(`Move ${g.id}`, (d) => CL.moveLayer(d, g.id, Math.round(dx), Math.round(dy)));
    } else {
      const b = boxAt(g, Math.round(dx), Math.round(dy));
      edit(`Resize ${g.id}`, (d) => CL.resizeLayer(d, g.id, b));
    }
    // A gesture that rounds to no change leaves no step: the box still goes back to the draft's place.
    paintStage();
  }

  function onKey(e) {
    if (!st.selected || e.target.closest?.('input, select, textarea') || !ARROWS[e.key]) return;
    const layer = layerOf(st.selected);
    if (!layer || layer.locked) return;
    e.preventDefault();
    const [ux, uy] = ARROWS[e.key];
    const step = e.shiftKey ? NUDGE_SHIFT : NUDGE;
    const id = st.selected;
    edit(`Move ${id}`, (d) => CL.moveLayer(d, id, ux * step, uy * step));
  }

  // ---- files -------------------------------------------------------------

  /** Take the file's text as the saved base and parse it; a bad file is shown, not edited. */
  function install(text, hash) {
    st.text = text;
    st.hash = hash;
    st.note = '';
    try {
      const parsed = CL.parseLayout(text);
      st.data = parsed.data;
      st.format = parsed.format;
      st.problems = parsed.problems;
      st.error = null;
    } catch (err) {
      st.data = null;
      st.problems = [];
      st.error = `${CL.LAYOUT_FILE}: ${err.message}`;
    }
    if (st.data && !layerOf(st.selected)) st.selected = st.data.layers.at(-1)?.id ?? null;
    host.history.clear();
  }

  async function fetchLayout() {
    return host.api(`files/read?path=${encodeURIComponent(CL.LAYOUT_FILE)}`);
  }

  async function load() {
    try {
      const r = await fetchLayout();
      install(r.text, r.hash);
    } catch (err) {
      st.error = `Could not load ${CL.LAYOUT_FILE}: ${err.message}`;
    }
    paintAll();
    fit();
    await connect();
  }

  window.addEventListener('message', onMessage);
  root.addEventListener('change', onInspectorChange);
  root.addEventListener('click', onRootClick);
  boxes.addEventListener('pointerdown', onBoxDown);
  boxes.addEventListener('pointermove', onBoxMove);
  boxes.addEventListener('pointerup', onBoxUp);
  boxes.addEventListener('pointercancel', onBoxUp);
  root.addEventListener('keydown', onKey);

  return {
    show() {
      subscribe();
      if (!st.loading) st.loading = load();
      else { connect(); if (st.data && st.fitted) fit(); }
      if (st.data) paintAll();
    },
    /** The view leaves the screen: its host notices stop; a show subscribes again. The draft stays. */
    hide() { unsubscribe(); },
    /** The one file this view saves: the draft, sent with the hash it was read at. */
    changes() {
      if (st.text === null || !st.data) return [];
      return CL.changesFor({ original: st.text, data: st.data }).map((c) => ({ ...c, baseHash: st.hash }));
    },
    /** A save went through: the saved text is the new base; edits made while it ran stay unsaved. */
    saved(files, sent) {
      const base = C.savedBase(files, sent, CL.LAYOUT_FILE);
      if (!base) return;
      st.text = base.original;
      st.hash = base.hash;
      paintAll();
    },
    /** Reload after a conflict: the draft and its history go. A file deleted on disk reads as missing. */
    async reload(path) {
      if (path !== CL.LAYOUT_FILE) return undefined;
      try {
        const r = await fetchLayout();
        install(r.text, r.hash);
      } catch (err) {
        if (err.status !== 404) throw err;
        st.text = null; st.data = null; st.hash = null;
        st.error = `${CL.LAYOUT_FILE} was deleted on disk`;
        host.history.clear();
        paintAll();
        return { missing: true };
      }
      paintAll();
      return undefined;
    },
    hashOf(path) { return path === CL.LAYOUT_FILE ? st.hash : undefined; },
    /** "Keep my version" in the conflict dialog: the draft is saved over the disk copy, so it takes the disk hash. */
    keep(path, hash) { if (path === CL.LAYOUT_FILE && st.text !== null) { st.hash = hash; paintStatus(); } },
    commands: () => [],
  };
}
