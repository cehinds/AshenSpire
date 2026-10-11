// workbench/ui/kit/canvas.mjs — the DOM view over canvas-model.mjs. Nothing
// here runs at import time, so the module loads headless; the functions need
// a document when called.
//
// createCanvas(el, { doc, onChange(doc, change), onSelect(ids), snap, grid, rulers, renderItem })
//   Renders the document into `el` and owns the gestures: select, shift-click,
//   marquee, drag-move with snap guides (Alt = free), resize handles (Shift =
//   keep aspect, Alt = from centre), Space+drag pan, Ctrl+wheel zoom, +/-/0,
//   rulers, grid, and keys: arrows nudge (Shift = 10), Delete, Ctrl+D, Ctrl+A,
//   Escape, G toggles the grid. Keys never fire while focus is in a text field.
//   Each finished gesture calls onChange once with the model's change record,
//   so the host can push one History step per gesture.
//   renderItem(node, item, { zoom }) lets a visual module paint item content.
//
// Returned controller: getDoc, setDoc, getSelection, select, getScope, drill,
//   apply(result), update(ids, patch, label), align, distribute, group, ungroup,
//   reorder, stackMove, duplicate, remove, nudge, selectAll, setGrid, setSnap,
//   setRulers, zoomTo, fit, subscribe(fn) → unsubscribe, destroy.
//
// createLayersPanel(el, canvas): list with show/lock toggles, drag reorder,
//   right-click menu (duplicate, delete, group, ungroup, bring forward/back,
//   drill into group / exit group).
// createInspector(el, canvas, fields): x/y/w/h/rot, name, locked, hidden, plus
//   custom fields (item.data[key] unless top:true). Multi-select shows shared
//   values and leaves mixed ones blank.
import * as M from './canvas-model.mjs';

export { createLayersPanel, createInspector } from './canvas-panels.mjs';

const PAD = 24;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const TOP_KEYS = ['x', 'y', 'w', 'h', 'rot', 'label', 'locked', 'hidden', 'z'];
// A region on screen narrower than SMALL_W or shorter than SMALL_H (px) is "small": its label shows on hover or selection.
const SMALL_W = 120, SMALL_H = 30;
const RULER_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isTyping = (t) => !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!t.isContentEditable);
const sameDoc = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const uniq = (ids) => [...new Set(ids)];

function normGrid(g) {
  const base = { size: 20, subdivisions: 1, show: false };
  if (typeof g === 'boolean') return { ...base, show: g };
  if (g && typeof g === 'object') return { ...base, ...g, show: g.show === true };
  return base;
}

export function createCanvas(el, opts = {}) {
  if (!el || !el.ownerDocument) throw new Error('createCanvas needs a host element');
  const doc0 = globalThis.document;
  const listeners = new Set();
  const state = {
    doc: M.createDocument(opts.doc || { width: 800, height: 600 }),
    selection: [],
    scope: null,
    zoom: clamp(opts.zoom ?? 1, MIN_ZOOM, MAX_ZOOM),
    snap: opts.snap !== false,
    grid: normGrid(opts.grid),
    rulers: opts.rulers !== false,
    guides: [],
    marquee: null,
    space: false,
    gesture: null,
  };
  const onChange = opts.onChange || (() => {});
  const onSelect = opts.onSelect || (() => {});
  const renderItem = opts.renderItem || null;

  el.classList.add('ck-host');
  el.classList.toggle('no-rulers', !state.rulers);
  el.innerHTML = '<div class="ck-corner"></div>'
    + '<div class="ck-ruler ck-ruler-top"><div class="ck-track"></div></div>'
    + '<div class="ck-ruler ck-ruler-left"><div class="ck-track"></div></div>'
    + '<div class="ck-view" tabindex="0"><div class="ck-stage"><div class="ck-page"></div></div></div>'
    + '<div class="ck-zoom" aria-live="polite"></div>';
  const view = el.querySelector('.ck-view');
  const stage = el.querySelector('.ck-stage');
  const page = el.querySelector('.ck-page');
  const rulerTop = el.querySelector('.ck-ruler-top .ck-track');
  const rulerLeft = el.querySelector('.ck-ruler-left .ck-track');
  const zoomEl = el.querySelector('.ck-zoom');

  // ---- rendering ----------------------------------------------------------

  function rulerTicks(axis, length) {
    const s = RULER_STEPS.find((v) => v * state.zoom >= 8) ?? 1000;
    const lab = RULER_STEPS.find((v) => v >= s && v * state.zoom >= 56) ?? 1000;
    let out = '';
    for (let v = 0; v <= length; v += s) {
      const p = r3(PAD + v * state.zoom);
      const major = v % lab === 0;
      const pos = axis === 'x' ? `left:${p}px` : `top:${p}px`;
      out += `<span class="ck-tick${major ? ' major' : ''}" style="${pos}"></span>`;
      if (major && axis === 'x') out += `<span class="ck-rlabel" style="left:${r3(p + 2)}px">${v}</span>`;
    }
    return out;
  }

  function renderRulers(W, H) {
    if (!state.rulers) return;
    rulerTop.style.width = `${W + 2 * PAD}px`;
    rulerLeft.style.height = `${H + 2 * PAD}px`;
    rulerTop.innerHTML = rulerTicks('x', state.doc.width);
    rulerLeft.innerHTML = rulerTicks('y', state.doc.height);
  }

  function render() {
    const { doc, zoom, selection, scope } = state;
    const W = r3(doc.width * zoom), H = r3(doc.height * zoom);
    stage.style.width = `${W}px`;
    stage.style.height = `${H}px`;
    page.style.width = `${W}px`;
    page.style.height = `${H}px`;
    const g = state.grid;
    page.classList.toggle('grid', g.show);
    page.classList.toggle('minor', g.show && g.subdivisions > 1);
    page.style.setProperty('--ck-grid-px', `${r3(g.size * zoom)}px`);
    page.style.setProperty('--ck-minor-px', `${r3((g.size / Math.max(1, g.subdivisions)) * zoom)}px`);
    page.textContent = '';
    const sel = new Set(selection);
    for (const it of M.sortedByZ(doc)) {
      if (it.hidden) continue;
      const n = doc0.createElement('div');
      const dim = scope !== null && it.group !== scope;
      // A small region cannot hold its label: the label then shows on hover or selection only (CSS).
      const small = it.w * zoom < SMALL_W || it.h * zoom < SMALL_H;
      n.className = `ck-item${sel.has(it.id) ? ' selected' : ''}${it.locked ? ' locked' : ''}${it.group ? ' in-group' : ''}${dim ? ' dim' : ''}${small ? ' tiny' : ''}`;
      n.dataset.id = it.id;
      n.style.left = `${r3(it.x * zoom)}px`;
      n.style.top = `${r3(it.y * zoom)}px`;
      n.style.width = `${r3(it.w * zoom)}px`;
      n.style.height = `${r3(it.h * zoom)}px`;
      if (it.rot) n.style.transform = `rotate(${it.rot}deg)`;
      const label = doc0.createElement('span');
      label.className = 'ck-label';
      label.textContent = it.label;
      n.append(label);
      if (renderItem) renderItem(n, it, { zoom });
      page.append(n);
    }
    if (selection.length === 1) {
      const it = M.byId(doc, selection[0]);
      if (it && !it.locked && !(scope !== null && it.group !== scope)) {
        for (const h of M.HANDLES) {
          const hx = h.includes('w') ? 0 : h.includes('e') ? it.w : it.w / 2;
          const hy = h.includes('n') ? 0 : h.includes('s') ? it.h : it.h / 2;
          const b = doc0.createElement('div');
          b.className = 'ck-handle';
          b.dataset.handle = h;
          b.style.left = `${r3((it.x + hx) * zoom)}px`;
          b.style.top = `${r3((it.y + hy) * zoom)}px`;
          page.append(b);
        }
      }
    }
    for (const gd of state.guides) {
      const b = doc0.createElement('div');
      b.className = `ck-guide ${gd.axis}`;
      if (gd.axis === 'x') b.style.left = `${r3(gd.at * zoom)}px`; else b.style.top = `${r3(gd.at * zoom)}px`;
      page.append(b);
    }
    if (state.marquee) {
      const m = state.marquee;
      const b = doc0.createElement('div');
      b.className = 'ck-marquee';
      b.style.left = `${r3(Math.min(m.x, m.x + m.w) * zoom)}px`;
      b.style.top = `${r3(Math.min(m.y, m.y + m.h) * zoom)}px`;
      b.style.width = `${r3(Math.abs(m.w) * zoom)}px`;
      b.style.height = `${r3(Math.abs(m.h) * zoom)}px`;
      page.append(b);
    }
    renderRulers(W, H);
    zoomEl.textContent = `${Math.round(zoom * 100)}%  ${doc.width}×${doc.height}`;
    el.classList.toggle('no-rulers', !state.rulers);
    view.classList.toggle('ck-pan', state.space);
  }

  function notify() { for (const fn of listeners) fn(api); }
  function emit() { render(); notify(); }

  // ---- state helpers ------------------------------------------------------

  const pointDoc = (e) => {
    const r = page.getBoundingClientRect();
    return { x: (e.clientX - r.left) / state.zoom, y: (e.clientY - r.top) / state.zoom };
  };

  // `from` is the selection the change starts from (a marquee drag passes its pre-drag snapshot,
  // since its live selection is already in state.selection); onSelect fires only when it differs.
  function setSelection(ids, from = state.selection) {
    const next = uniq(ids.filter((id) => M.byId(state.doc, id)));
    const changed = M.selectionChanged(from, next);
    state.selection = next;
    if (changed) onSelect(next.slice());
    emit();
  }

  function snapConfig() {
    if (!state.snap) return null;
    return {
      grid: { enabled: state.grid.size > 0, size: state.grid.size, subdivisions: state.grid.subdivisions },
      threshold: 6,
      viewport: true,
      items: true,
      safeArea: true,
    };
  }

  /** Commit a model result against `base`. One call is one onChange (one History step). */
  function commit(result, base = state.doc) {
    state.guides = [];
    if (sameDoc(result.doc, base)) { state.doc = base; emit(); return false; }
    state.doc = result.doc;
    state.selection = state.selection.filter((id) => M.byId(state.doc, id));
    onChange(state.doc, result.change);
    emit();
    return true;
  }

  /** Run a gesture: move/up listeners on window so the drag survives re-renders. */
  function track(onMove, onEnd) {
    const up = () => { cleanup(); onEnd(true); };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      state.gesture = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    state.gesture = { cancel() { cleanup(); onEnd(false); } };
  }

  // ---- pointer ------------------------------------------------------------

  function startMove(e, p0) {
    const base = state.doc;
    const ids = state.selection.slice();
    let moved = false, result = null;
    const onMove = (ev) => {
      const p = pointDoc(ev);
      const dx = p.x - p0.x, dy = p.y - p0.y;
      if (!moved && Math.hypot(dx, dy) * state.zoom < 3) return;
      moved = true;
      result = M.moveSelection(base, ids, dx, dy, { snap: ev.altKey ? null : snapConfig() });
      state.guides = result.guides;
      state.doc = result.doc;
      render();
    };
    track(onMove, (ok) => {
      if (ok && moved && result) commit(result, base);
      else { state.doc = base; state.guides = []; emit(); }
    });
  }

  function startResize(e, handle) {
    const id = state.selection[0];
    const base = state.doc;
    const p0 = pointDoc(e);
    let result = null;
    const onMove = (ev) => {
      const p = pointDoc(ev);
      result = M.resizeItem(base, id, handle, p.x - p0.x, p.y - p0.y, { shift: ev.shiftKey, alt: ev.altKey, snap: snapConfig() });
      state.guides = result.guides;
      state.doc = result.doc;
      render();
    };
    track(onMove, (ok) => {
      if (ok && result) commit(result, base);
      else { state.doc = base; state.guides = []; emit(); }
    });
  }

  function startMarquee(e, p0) {
    const base = state.selection.slice();
    const snapshot = state.doc;
    const onMove = (ev) => {
      const p = pointDoc(ev);
      state.marquee = { x: p0.x, y: p0.y, w: p.x - p0.x, h: p.y - p0.y };
      const hits = M.marqueeHit(snapshot, state.marquee, { scope: state.scope });
      state.selection = uniq([...base, ...hits]);
      render();
    };
    track(onMove, () => {
      state.marquee = null;
      setSelection(state.selection, base);
    });
  }

  function startPan(e) {
    const sx = view.scrollLeft, sy = view.scrollTop, cx = e.clientX, cy = e.clientY;
    track((ev) => {
      view.scrollLeft = sx - (ev.clientX - cx);
      view.scrollTop = sy - (ev.clientY - cy);
    }, () => {});
  }

  function onDown(e) {
    if (e.button !== 0) return;
    view.focus({ preventScroll: true });
    if (state.space) { e.preventDefault(); startPan(e); return; }
    const handle = e.target && e.target.closest ? e.target.closest('.ck-handle') : null;
    if (handle) { e.preventDefault(); startResize(e, handle.dataset.handle); return; }
    e.preventDefault();
    const p = pointDoc(e);
    const hit = M.hitTest(state.doc, p, { scope: state.scope });
    if (hit) {
      const members = state.scope === null ? M.expandSelection(state.doc, [hit]) : [hit];
      if (e.shiftKey) {
        const all = members.every((id) => state.selection.includes(id));
        setSelection(all ? state.selection.filter((id) => !members.includes(id)) : [...state.selection, ...members]);
        return;
      }
      if (!state.selection.includes(hit)) setSelection(members);
      startMove(e, p);
      return;
    }
    if (!e.shiftKey) setSelection([]);
    startMarquee(e, p);
  }

  function onWheel(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const doc = pointDoc(e);
    setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { clientX: e.clientX, clientY: e.clientY, doc });
  }

  function setZoom(z, anchor = null) {
    state.zoom = clamp(r3(z), MIN_ZOOM, MAX_ZOOM);
    render();
    if (anchor) {
      const vr = view.getBoundingClientRect();
      const px = anchor.clientX - vr.left, py = anchor.clientY - vr.top;
      view.scrollLeft = PAD + anchor.doc.x * state.zoom - px;
      view.scrollTop = PAD + anchor.doc.y * state.zoom - py;
    }
  }

  function fit() {
    const vw = view.clientWidth - 2 * PAD, vh = view.clientHeight - 2 * PAD;
    const z = Math.min(vw / state.doc.width, vh / state.doc.height);
    setZoom(Math.floor(clamp(z, MIN_ZOOM, MAX_ZOOM) * 1000) / 1000);
    view.scrollLeft = 0;
    view.scrollTop = 0;
  }

  // ---- keyboard -----------------------------------------------------------

  const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

  function onKeyDown(e) {
    if (!el.contains(doc0.activeElement) || isTyping(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) { state.space = true; view.classList.add('ck-pan'); }
      return;
    }
    if (mod && k.toLowerCase() === 'a') { e.preventDefault(); setSelection(M.selectableIds(state.doc, { scope: state.scope })); return; }
    if (mod && k.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (mod) return;
    if (k === 'Delete' || k === 'Backspace') { if (!state.selection.length) return; e.preventDefault(); remove(); return; }
    if (k === 'Escape') {
      if (state.gesture) { state.gesture.cancel(); return; }
      if (state.scope !== null) { drill(null); return; }
      setSelection([]);
      return;
    }
    if (ARROWS[k]) { e.preventDefault(); nudge(ARROWS[k], e.shiftKey); return; }
    if (k === '+' || k === '=') { e.preventDefault(); setZoom(state.zoom * 1.25); return; }
    if (k === '-' || k === '_') { e.preventDefault(); setZoom(state.zoom / 1.25); return; }
    if (k === '0') { e.preventDefault(); fit(); return; }
    if (k.toLowerCase() === 'g') setGrid(!state.grid.show);
  }

  function onKeyUp(e) {
    if (e.key === ' ' && state.space) { state.space = false; view.classList.remove('ck-pan'); }
  }

  function onBlur() {
    if (state.space) { state.space = false; view.classList.remove('ck-pan'); }
  }

  // ---- commands -----------------------------------------------------------

  function apply(result) { return commit(result); }

  function update(ids, patch, label) { return commit(M.updateItems(state.doc, ids, patch, { label })); }

  function nudge(dir, large = false) {
    if (!state.selection.length) return false;
    return commit(M.nudge(state.doc, state.selection, dir, { large }));
  }

  function duplicate() {
    if (!state.selection.length) return false;
    const r = M.duplicate(state.doc, state.selection, { dx: 10, dy: 10 });
    const ok = commit(r);
    if (ok) setSelection(r.ids);
    return ok;
  }

  function remove() {
    if (!state.selection.length) return false;
    const ok = commit(M.removeItems(state.doc, state.selection));
    setSelection([]);
    return ok;
  }

  function group() {
    if (state.selection.length < 2) return false;
    return commit(M.group(state.doc, state.selection));
  }

  function ungroup() {
    if (!state.selection.length) return false;
    return commit(M.ungroup(state.doc, state.selection));
  }

  function align(edge) {
    if (!state.selection.length) return false;
    return commit(M.align(state.doc, state.selection, edge));
  }

  function distribute(axis) {
    if (state.selection.length < 3) return false;
    return commit(M.distribute(state.doc, state.selection, axis));
  }

  function reorder(dir) {
    if (!state.selection.length) return false;
    return commit(M.reorder(state.doc, state.selection, dir));
  }

  function stackMove(id, targetId, placement) {
    return commit(M.stackMove(state.doc, id, targetId, placement));
  }

  function drill(groupId) {
    state.scope = groupId ?? null;
    state.selection = [];
    emit();
  }

  function select(ids, { add = false } = {}) {
    const list = state.scope === null ? M.expandSelection(state.doc, ids) : ids;
    setSelection(add ? [...state.selection, ...list] : list);
  }

  function selectAll() { setSelection(M.selectableIds(state.doc, { scope: state.scope })); }

  function setGrid(on) { state.grid.show = !!on; emit(); }
  function setSnap(on) { state.snap = !!on; emit(); }
  function setRulers(on) { state.rulers = !!on; render(); }

  // ---- wiring -------------------------------------------------------------

  // The region under the pointer gets .hover, so a small region's label can show.
  function markHover(e) {
    const id = M.hitTest(state.doc, pointDoc(e), { scope: state.scope });
    page.querySelectorAll('.ck-item.hover').forEach((n) => n.classList.remove('hover'));
    if (id) page.querySelector(`.ck-item[data-id="${CSS.escape(id)}"]`)?.classList.add('hover');
  }
  view.addEventListener('pointerdown', onDown);
  view.addEventListener('pointermove', markHover);
  view.addEventListener('pointerleave', () => page.querySelectorAll('.ck-item.hover').forEach((n) => n.classList.remove('hover')));
  view.addEventListener('scroll', () => {
    if (rulerTop) rulerTop.style.transform = `translateX(${-view.scrollLeft}px)`;
    if (rulerLeft) rulerLeft.style.transform = `translateY(${-view.scrollTop}px)`;
  });
  view.addEventListener('wheel', onWheel, { passive: false });
  doc0.addEventListener('keydown', onKeyDown);
  doc0.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const api = {
    getDoc: () => state.doc,
    setDoc(raw) {
      state.doc = M.createDocument(raw);
      state.selection = state.selection.filter((id) => M.byId(state.doc, id));
      emit();
    },
    getSelection: () => state.selection.slice(),
    getScope: () => state.scope,
    getZoom: () => state.zoom,
    select, selectAll, drill, apply, update, nudge, duplicate, remove, group, ungroup,
    align, distribute, reorder, stackMove, setGrid, setSnap, setRulers, fit,
    zoomTo: (z) => setZoom(z),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    destroy() {
      view.removeEventListener('pointerdown', onDown);
      view.removeEventListener('wheel', onWheel);
      doc0.removeEventListener('keydown', onKeyDown);
      doc0.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      listeners.clear();
      state.gesture?.cancel?.();
      el.innerHTML = '';
      el.classList.remove('ck-host', 'no-rulers');
    },
  };

  render();
  return api;
}
