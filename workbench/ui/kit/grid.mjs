// workbench/ui/kit/grid.mjs — the DOM half of the data grid. All data rules live
// in grid-model.mjs; this file only draws, routes input and calls the model.
//
//   const grid = createGrid(el, { columns, rows, rules, refs, onChange, readOnly, density });
//   createCheckPanel(panelEl, grid);
//
// Rows are virtualized at a fixed height (24px compact, 34px comfortable). Frozen
// columns (the row-number gutter plus any column with frozen:true, else the first
// column) stay in view while scrolling sideways. Every change goes through the
// model, so each gesture is one undoable change, reported via onChange.

import * as M from './grid-model.mjs';

const GUTTER = 48, HEAD = 32, OVERSCAN = 8, DENSITY = { compact: 24, comfortable: 34 };
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function createGrid(el, options = {}) {
  let rules = options.rules ?? [], refs = options.refs ?? {};
  const readOnly = !!options.readOnly, onChange = options.onChange ?? null;
  let H = DENSITY[options.density] ?? DENSITY.compact;
  let doc = { columns: (options.columns ?? []).map(c => M.normalizeColumn(c)), rows: options.rows ?? [] };
  if (doc.columns.length && !doc.columns.some(c => c.frozen)) doc.columns[0] = { ...doc.columns[0], frozen: true };
  let issues = [], issueMap = new Map(), order = [], sortKeys = [], search = '';
  let sel = M.createSelection(), editing = null, menu = null, dragging = false;
  const history = { undo: [], redo: [] }, listeners = new Set();

  el.classList.add('gk-root');
  el.innerHTML = `<div class="gk-bar"><input type="search" class="gk-search" placeholder="Search rows (/)" aria-label="Search rows"><span class="gk-count"></span><span class="gk-spacer"></span><button type="button" class="gk-density"></button><button type="button" class="gk-undo" aria-label="Undo">Undo</button><button type="button" class="gk-redo" aria-label="Redo">Redo</button></div><div class="gk-scroll" tabindex="0" role="grid" aria-readonly="${readOnly}"><div class="gk-head"></div><div class="gk-body"><div class="gk-rows"></div></div></div>`;
  const $ = s => el.querySelector(s);
  const scroll = $('.gk-scroll'), head = $('.gk-head'), body = $('.gk-body'), rowsEl = $('.gk-rows');
  const searchEl = $('.gk-search'), countEl = $('.gk-count'), densityBtn = $('.gk-density');

  // ---------- layout ----------
  const widths = () => doc.columns.map(c => c.width ?? 140);
  function colLefts() {
    const w = widths(); const lefts = []; let x = GUTTER;
    w.forEach(v => { lefts.push(x); x += v; });
    return { lefts, widths: w, total: x };
  }
  function frozenOffsets() {
    let x = GUTTER; const out = new Map();
    doc.columns.forEach((c, i) => { if (c.frozen) { out.set(i, x); x += c.width ?? 140; } });
    return out;
  }

  // ---------- derived state ----------
  function recompute() {
    const filtered = M.filterIndices(doc.rows, doc.columns, { text: search });
    const sub = M.sortIndices(filtered.map(i => doc.rows[i]), doc.columns, sortKeys);
    order = sub.map(k => filtered[k]);
    issues = M.validate(doc, rules, { refs });
    issueMap = new Map();
    for (const is of issues) {
      const k = `${is.row}|${is.key ?? ''}`;
      const list = issueMap.get(k) ?? []; list.push(is); issueMap.set(k, list);
    }
  }
  const viewPos = () => { const m = new Map(); order.forEach((r, p) => m.set(r, p)); return m; };

  // ---------- rendering ----------
  function renderHead() {
    const { lefts, widths: w, total } = colLefts();
    const frozen = frozenOffsets();
    const sortIdx = new Map(sortKeys.map((s, i) => [s.key, { i, dir: s.dir }]));
    let html = `<div class="gk-hrow" style="width:${total}px"><div class="gk-hcell gk-gutter gk-frozen" style="left:0;width:${GUTTER}px">#</div>`;
    doc.columns.forEach((c, i) => {
      const s = sortIdx.get(c.key);
      const ind = s ? `${s.dir === 'desc' ? '▼' : '▲'}${sortKeys.length > 1 ? s.i + 1 : ''}` : '';
      const fz = frozen.has(i) ? ' gk-frozen' : '';
      html += `<div class="gk-hcell${fz}" data-c="${i}" style="left:${frozen.has(i) ? frozen.get(i) : lefts[i]}px;width:${w[i]}px" title="${esc(c.label)} · ${c.type}${c.ref ? ' → ' + esc(c.ref) : ''}"><span class="gk-label">${esc(c.label)}</span><span class="gk-sort" aria-hidden="true">${ind}</span><span class="gk-rz" data-c="${i}"></span></div>`;
    });
    head.innerHTML = html + '</div>';
  }
  function renderRows() {
    const { lefts, widths: w, total } = colLefts();
    const frozen = frozenOffsets();
    body.style.height = `${order.length * H}px`;
    body.style.width = `${total}px`;
    const first = Math.max(0, Math.floor(scroll.scrollTop / H) - OVERSCAN);
    const last = Math.min(order.length, Math.ceil((scroll.scrollTop + scroll.clientHeight - HEAD) / H) + OVERSCAN);
    const selCells = selSet();
    const pos = viewPos();
    let html = '';
    for (let p = first; p < last; p++) {
      const r = order[p], row = doc.rows[r];
      const rowIssues = issueMap.get(`${r}|`) ?? [];
      html += `<div class="gk-row${rowIssues.length ? ' gk-row-bad' : ''}" data-r="${r}" style="top:${p * H}px;height:${H}px;width:${total}px"><div class="gk-cell gk-num gk-frozen${sel.ranges.some(g => g.r0 <= r && r <= g.r1 && g.c0 === 0 && g.c1 === doc.columns.length - 1) ? ' gk-sel' : ''}" data-r="${r}" style="left:0;width:${GUTTER}px" title="${rowIssues.map(i => esc(i.message)).join('; ')}">${r + 1}</div>`;
      doc.columns.forEach((c, i) => {
        const cls = [];
        if (frozen.has(i)) cls.push('gk-frozen');
        if (selCells.has(r * 100000 + i)) cls.push('gk-sel');
        if (sel.active && sel.active.r === r && sel.active.c === i) cls.push('gk-active');
        const is = issueMap.get(`${r}|${c.key}`) ?? [];
        if (is.some(x => x.level === 'error')) cls.push('gk-bad'); else if (is.length) cls.push('gk-warn');
        const left = frozen.has(i) ? frozen.get(i) : lefts[i];
        html += `<div class="gk-cell gk-t-${c.type} ${cls.join(' ')}" data-r="${r}" data-c="${i}" style="left:${left}px;width:${w[i]}px" title="${esc(is.map(x => x.message).join('; ') || M.formatValue(row[c.key], c.type))}">${esc(M.formatValue(row[c.key], c.type))}</div>`;
      });
      html += '</div>';
    }
    rowsEl.innerHTML = html;
    applyFreeze();
  }
  function selSet() {
    const s = new Set();
    for (const g of sel.ranges) for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) s.add(r * 100000 + c);
    return s;
  }
  function applyFreeze() {
    // Frozen cells track horizontal scroll so they stay visible.
    const t = `translateX(${scroll.scrollLeft}px)`;
    el.querySelectorAll('.gk-frozen').forEach(n => { n.style.transform = t; });
  }
  function updateBar() {
    countEl.textContent = `${order.length} of ${doc.rows.length} rows · ${issues.filter(i => i.level === 'error').length} errors`;
    densityBtn.textContent = H === DENSITY.compact ? 'Comfortable' : 'Compact';
    $('.gk-undo').disabled = !history.undo.length; $('.gk-redo').disabled = !history.redo.length;
  }
  function render({ full = true } = {}) {
    if (full) renderHead();
    renderRows(); updateBar();
    listeners.forEach(fn => fn(api));
  }

  // ---------- mutations through the model ----------
  function commit(res, { history: track = true } = {}) {
    doc = { columns: res.columns, rows: res.rows };
    if (track && res.change) { history.undo.push(res.change); history.redo = []; }
    recompute(); render();
    if (onChange) onChange({ rows: doc.rows, columns: doc.columns, change: res.change, errors: res.errors ?? [] });
  }
  function step(direction) {
    const from = direction === 'undo' ? history.undo : history.redo;
    const to = direction === 'undo' ? history.redo : history.undo;
    if (!from.length) return;
    const change = from.pop(); to.push(change);
    const snap = M.applyChange(change, direction);
    doc = { columns: snap.columns, rows: snap.rows };
    recompute(); render();
    if (onChange) onChange({ rows: doc.rows, columns: doc.columns, change, direction, errors: [] });
  }
  const selectedRows = () => M.selectedCells(sel, order, doc.columns).rows;
  // The selected cells as {r, c} indices, in view order (for the model's cell-level ops).
  const selectedTargets = () => {
    const colIdx = new Map(doc.columns.map((c, i) => [c.key, i]));
    return M.selectedCells(sel, order, doc.columns).cells.map(([r, key]) => ({ r, c: colIdx.get(key) }));
  };
  function setActive(r, c, opts = {}) {
    sel = M.selectCell(sel, { r, c }, opts);
  }

  // ---------- editing ----------
  function startEdit(r, c, seed = null) {
    if (readOnly || !doc.columns[c] || r < 0 || r >= doc.rows.length) return;
    cancelEdit();
    const col = doc.columns[c];
    const { lefts, widths: w } = colLefts();
    const input = document.createElement('input');
    input.className = 'gk-editor';
    input.setAttribute('aria-label', `${col.label} row ${r + 1}`);
    input.value = seed ?? M.formatValue(doc.rows[r][col.key], col.type);
    const frozen = frozenOffsets();
    input.style.top = `${order.indexOf(r) * H}px`;
    input.style.left = `${frozen.has(c) ? frozen.get(c) : lefts[c]}px`;
    input.style.width = `${w[c]}px`; input.style.height = `${H}px`;
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(r, c, 'down'); }
      else if (ev.key === 'Tab') { ev.preventDefault(); finish(r, c, ev.shiftKey ? 'left' : 'right'); }
      else if (ev.key === 'Escape') { ev.preventDefault(); cancelEdit(); scroll.focus(); }
    });
    input.addEventListener('blur', () => { if (editing && editing.input === input) finish(r, c, null); });
    body.appendChild(input);
    editing = { r, c, input };
    input.focus(); input.select();
  }
  function finish(r, c, move) {
    if (!editing) return;
    const input = editing.input;
    const col = doc.columns[c];
    let typed;
    try { typed = M.parseValue(input.value, col.type); }
    catch (e) { input.classList.add('gk-invalid'); input.title = e.message; return; }
    const same = M.formatValue(doc.rows[r][col.key], col.type) === input.value;
    cancelEdit();
    if (!same) commit(M.setCells(doc, [{ r, c }], typed, 'Edit cell'));
    setActive(r, c);
    if (move) moveActive(move === 'down' ? 1 : 0, move === 'right' ? 1 : move === 'left' ? -1 : 0);
    else render({ full: false });
    scroll.focus();
  }
  function cancelEdit() {
    if (!editing) return;
    const input = editing.input; editing = null; input.remove();
  }
  function moveActive(dr, dc, extend = false) {
    const cur = sel.active ?? { r: 0, c: 0 };
    const pos = viewPos().get(cur.r);
    let p = pos ?? 0;
    if (dr) p = Math.min(Math.max(p + dr, 0), Math.max(order.length - 1, 0));
    const nr = order.length ? order[p] : 0;
    const nc = Math.min(Math.max(cur.c + dc, 0), Math.max(doc.columns.length - 1, 0));
    sel = M.selectCell(sel, { r: nr, c: nc }, { shift: extend, order });
    ensureVisible(p, nc);
    render({ full: false });
  }
  function ensureVisible(p, c) {
    const top = p * H, bottom = top + H, view = scroll.clientHeight - HEAD;
    if (top < scroll.scrollTop) scroll.scrollTop = top;
    else if (bottom > scroll.scrollTop + view) scroll.scrollTop = bottom - view;
    const { lefts, widths: w } = colLefts();
    const x = lefts[c];
    if (x < scroll.scrollLeft + GUTTER) scroll.scrollLeft = Math.max(0, x - GUTTER);
    else if (x + w[c] > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = x + w[c] - scroll.clientWidth;
  }

  // ---------- clipboard and bulk actions ----------
  function copySelection() {
    if (!selectedRows().length) return;
    const text = M.copyVisible(doc.rows, doc.columns, order, sel);
    try { navigator.clipboard?.writeText(text).catch(() => {}); } catch { /* clipboard blocked */ }
    lastCopied = text;
  }
  let lastCopied = '';
  // Atomic: a bad value anywhere commits nothing; the errors are reported (event) and the grid is unchanged.
  function pasteText(text) {
    if (readOnly || !text) return;
    const anchor = sel.active ?? { r: 0, c: 0 };
    const res = M.pasteVisible(doc.rows, doc.columns, order, anchor, text, sel);
    if (res.errors.length) { el.dispatchEvent(new CustomEvent('gk-paste-errors', { detail: res.errors })); return; }
    if (res.change) commit(res);
  }
  function clearSelection() {
    if (readOnly) return;
    const cells = selectedTargets();
    if (cells.length) commit(M.clearCells(doc, cells));
  }
  // Every selected row (all runs), in the order the view shows them, and every selected column.
  function fillDownSel() {
    if (readOnly) return;
    const { rows: visibleRows, cols } = M.selectedCells(sel, order, doc.columns);
    commit(M.fillDownVisible(doc.rows, doc.columns, visibleRows, cols));
  }
  function rowMenu(x, y, rowIdx) {
    closeMenu();
    if (!sel.ranges.some(g => g.r0 <= rowIdx && rowIdx <= g.r1)) sel = M.selectRows(sel, rowIdx, {}, doc.columns.length);
    const rows = selectedRows();
    const items = readOnly ? [['Copy', copySelection]] : [
      ['Insert row above', () => commit(M.addRow(doc, rows[0]))],
      ['Insert row below', () => commit(M.addRow(doc, rows.at(-1) + 1))],
      ['Duplicate row' + (rows.length > 1 ? 's' : ''), () => commit(M.duplicateRows(doc, rows))],
      ['Delete row' + (rows.length > 1 ? 's' : ''), () => { sel = M.createSelection(); commit(M.deleteRows(doc, rows)); }],
      ['Clear cells', clearSelection],
      ['Fill down', fillDownSel],
      ['Copy', copySelection],
    ];
    menu = document.createElement('div');
    menu.className = 'gk-menu'; menu.setAttribute('role', 'menu');
    menu.style.left = `${x - el.getBoundingClientRect().left}px`; menu.style.top = `${y - el.getBoundingClientRect().top}px`;
    menu.innerHTML = items.map(([label], i) => `<button type="button" role="menuitem" data-i="${i}">${esc(label)}</button>`).join('');
    menu.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; const fn = items[Number(b.dataset.i)][1]; closeMenu(); fn(); });
    el.appendChild(menu);
  }
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }

  // ---------- events ----------
  scroll.addEventListener('scroll', () => {
    if (editing) cancelEdit();
    applyFreeze();
    requestAnimationFrame(() => renderRows());
  });
  scroll.addEventListener('mousedown', ev => {
    closeMenu();
    const cell = ev.target.closest('.gk-cell');
    if (!cell || cell.classList.contains('gk-num')) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    sel = M.selectCell(sel, { r, c }, { shift: ev.shiftKey, ctrl: ev.ctrlKey || ev.metaKey, order });
    dragging = true; render({ full: false });
  });
  scroll.addEventListener('mouseover', ev => {
    if (!dragging) return;
    const cell = ev.target.closest('.gk-cell');
    if (cell && !cell.classList.contains('gk-num')) { sel = M.selectCell(sel, { r: Number(cell.dataset.r), c: Number(cell.dataset.c) }, { shift: true, order }); render({ full: false }); }
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  scroll.addEventListener('mousedown', ev => {
    const num = ev.target.closest('.gk-num');
    if (num) { sel = M.selectRows(sel, Number(num.dataset.r), { shift: ev.shiftKey, ctrl: ev.ctrlKey || ev.metaKey, order }, doc.columns.length); render({ full: false }); }
  });
  scroll.addEventListener('dblclick', ev => {
    const cell = ev.target.closest('.gk-cell');
    if (cell && !cell.classList.contains('gk-num')) startEdit(Number(cell.dataset.r), Number(cell.dataset.c));
  });
  scroll.addEventListener('contextmenu', ev => {
    const cell = ev.target.closest('.gk-num, .gk-cell');
    if (!cell) return;
    ev.preventDefault();
    rowMenu(ev.clientX, ev.clientY, Number(cell.dataset.r));
  });
  head.addEventListener('click', ev => {
    if (ev.target.closest('.gk-rz')) return;
    const cell = ev.target.closest('.gk-hcell[data-c]'); if (!cell) return;
    const key = doc.columns[Number(cell.dataset.c)].key;
    const i = sortKeys.findIndex(s => s.key === key);
    if (!ev.shiftKey) sortKeys = i >= 0 && sortKeys.length === 1 ? (sortKeys[0].dir === 'asc' ? [{ key, dir: 'desc' }] : []) : [{ key, dir: 'asc' }];
    else if (i < 0) sortKeys = [...sortKeys, { key, dir: 'asc' }];
    else sortKeys = sortKeys.map((s, j) => (j === i ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : s)).filter(Boolean);
    recompute(); render();
  });
  head.addEventListener('pointerdown', ev => {
    const rz = ev.target.closest('.gk-rz'); if (!rz) return;
    ev.preventDefault();
    // The drag previews on a copy; the document is only changed by one commit on pointer-up,
    // made from the document as it was at pointer-down, so the change is undoable and reported.
    const base = doc, c = Number(rz.dataset.c), key = base.columns[c].key, startX = ev.clientX, startW = base.columns[c].width ?? 140;
    let w = startW;
    const move = e => {
      w = Math.max(M.MIN_COLUMN_WIDTH, startW + e.clientX - startX);
      const cols = base.columns.slice(); cols[c] = { ...cols[c], width: w }; doc = { ...base, columns: cols }; render();
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      doc = base;
      if (w !== startW) commit(M.resizeColumn(base, key, w));
      else render();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
  scroll.addEventListener('keydown', ev => {
    if (editing) return;
    const k = ev.key, mod = ev.ctrlKey || ev.metaKey;
    if (mod && k.toLowerCase() === 'c') { ev.preventDefault(); copySelection(); }
    else if (mod && k.toLowerCase() === 'd') { ev.preventDefault(); fillDownSel(); }
    else if (mod && k.toLowerCase() === 'z') { ev.preventDefault(); step(ev.shiftKey ? 'redo' : 'undo'); }
    else if (mod && k.toLowerCase() === 'y') { ev.preventDefault(); step('redo'); }
    else if (k === 'ArrowDown') { ev.preventDefault(); moveActive(1, 0, ev.shiftKey); }
    else if (k === 'ArrowUp') { ev.preventDefault(); moveActive(-1, 0, ev.shiftKey); }
    else if (k === 'ArrowRight') { ev.preventDefault(); moveActive(0, 1, ev.shiftKey); }
    else if (k === 'ArrowLeft') { ev.preventDefault(); moveActive(0, -1, ev.shiftKey); }
    else if (k === 'Tab') { ev.preventDefault(); moveActive(0, ev.shiftKey ? -1 : 1); }
    else if (k === 'Enter' || k === 'F2') {
      ev.preventDefault();
      if (sel.active) startEdit(sel.active.r, sel.active.c);
    } else if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); clearSelection(); }
    else if (k === 'Escape') closeMenu();
    else if (k === 'Home' && mod) { ev.preventDefault(); sel = M.selectCell(sel, { r: order[0] ?? 0, c: 0 }, {}); ensureVisible(0, 0); render({ full: false }); }
  });
  // Paste: a paste that lands while this grid has focus.
  const onPaste = ev => {
    if (editing || !el.contains(document.activeElement) || document.activeElement.tagName === 'INPUT') return;
    ev.preventDefault();
    pasteText(ev.clipboardData?.getData('text/plain') ?? '');
  };
  document.addEventListener('paste', onPaste);
  // Keyboard: "/" focuses search; the grid's own shortcuts ignore inputs.
  const onGlobalKey = ev => {
    if (ev.key === '/' && !editing && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && el.isConnected) {
      ev.preventDefault(); searchEl.focus();
    }
  };
  document.addEventListener('keydown', onGlobalKey);
  document.addEventListener('mousedown', ev => { if (menu && !menu.contains(ev.target)) closeMenu(); });
  searchEl.addEventListener('input', () => { search = searchEl.value; recompute(); render(); });
  searchEl.addEventListener('keydown', ev => { if (ev.key === 'Escape') { searchEl.value = ''; search = ''; recompute(); render(); scroll.focus(); } });
  densityBtn.addEventListener('click', () => { api.setDensity(H === DENSITY.compact ? 'comfortable' : 'compact'); });
  $('.gk-undo').addEventListener('click', () => step('undo'));
  $('.gk-redo').addEventListener('click', () => step('redo'));

  // ---------- public API ----------
  const api = {
    getData: () => ({ rows: doc.rows, columns: doc.columns }),
    getIssues: () => issues.slice(),
    subscribe(fn) { listeners.add(fn); fn(api); return () => listeners.delete(fn); },
    setData({ columns, rows }) {
      doc = { columns: (columns ?? doc.columns).map(c => M.normalizeColumn(c)), rows: rows ?? doc.rows };
      history.undo = []; history.redo = []; sel = M.createSelection(); cancelEdit();
      recompute(); render();
    },
    setRules(next, nextRefs = refs) { rules = next; refs = nextRefs; recompute(); render(); },
    setSearch(text) { searchEl.value = search = text; recompute(); render(); },
    setSort(keys) { sortKeys = keys.slice(); recompute(); render(); },
    setDensity(name) {
      H = DENSITY[name] ?? DENSITY.compact; el.dataset.density = name in DENSITY ? name : 'compact';
      cancelEdit(); render();
    },
    focusCell(r, c) {
      const p = viewPos().get(r);
      if (p === undefined) { search = ''; searchEl.value = ''; recompute(); render(); }
      const pos = viewPos().get(r) ?? 0;
      sel = M.selectCell(M.createSelection(), { r, c }, {});
      ensureVisible(pos, c); render({ full: false }); scroll.focus();
    },
    undo: () => step('undo'),
    redo: () => step('redo'),
    addRow: (index) => commit(M.addRow(doc, index ?? doc.rows.length)),
    deleteRows: (indices) => commit(M.deleteRows(doc, indices)),
    importText: (text, opts) => commit(M.importRows(doc, text, opts)),
    apply: (res) => commit(res),
    destroy() { cancelEdit(); closeMenu(); document.removeEventListener('paste', onPaste); document.removeEventListener('keydown', onGlobalKey); el.innerHTML = ''; el.classList.remove('gk-root'); listeners.clear(); },
  };
  el.dataset.density = options.density === 'comfortable' ? 'comfortable' : 'compact';
  recompute(); render();
  return api;
}

/** Check panel: lists the grid's issues; clicking one jumps to its cell. */
export function createCheckPanel(el, grid) {
  el.classList.add('gk-check');
  el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-issue]'); if (!b) return;
    const { row, col } = JSON.parse(b.dataset.issue);
    grid.focusCell(row, col);
  });
  return grid.subscribe(() => {
    const { columns } = grid.getData();
    const list = grid.getIssues();
    el.innerHTML = `<h3>Check · ${list.length} issue${list.length === 1 ? '' : 's'}</h3>` + (list.length ? `<ul>${list.map(i => {
      const c = Math.max(0, columns.findIndex(x => x.key === i.key));
      return `<li class="gk-issue gk-${i.level}"><button type="button" data-issue='${JSON.stringify({ row: i.row, col: c })}'><span class="gk-where">Row ${i.row + 1}${i.key ? ' · ' + esc(i.key) : ''}</span> ${esc(i.message)}</button></li>`;
    }).join('')}</ul>` : '<p class="gk-ok">No issues.</p>');
  });
}
