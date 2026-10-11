// workbench/ui/kit/grid-model.mjs — the data grid's DOM-free model.
// Pure functions only: nothing here touches the DOM or mutates its inputs.
// Every mutation returns { rows, columns, change } where change is
// { label, undo, redo } and undo/redo are full { columns, rows } snapshots
// (row objects are shared, never edited in place), so applying either
// restores the exact document. One gesture = one change = one History step.
// Typed parsing is ported from editor/tables.mjs (parseValue).

export const COLUMN_TYPES = ['string', 'number', 'boolean', 'ref', 'json', 'formula'];
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function normalizeColumn(c) {
  const key = String(c?.key ?? '');
  if (!key) throw Error('Columns need a key');
  const type = c.type ?? 'string';
  if (!COLUMN_TYPES.includes(type)) throw Error(`Unknown column type "${type}"`);
  const column = { key, label: c.label ?? key, type };
  if (c.ref !== undefined) column.ref = String(c.ref);
  if (c.width !== undefined) column.width = Number(c.width);
  if (c.frozen) column.frozen = true;
  return column;
}

export function emptyValue(type) {
  return type === 'string' || type === 'ref' || type === 'formula' ? '' : null;
}

function isEmpty(v) { return v === undefined || v === null || v === ''; }

/** null when the value fits the column type, else a message. Empty values always fit. */
export function checkValue(v, type) {
  if (isEmpty(v)) return null;
  if (type === 'number') return typeof v === 'number' && Number.isFinite(v) ? null : 'Not a number';
  if (type === 'boolean') return typeof v === 'boolean' ? null : 'Not true or false';
  if (type === 'json') {
    try { JSON.stringify(v); return null; } catch { return 'Not JSON-serializable'; }
  }
  return typeof v === 'string' ? null : 'Expected text';
}

/** Parse typed text the way the content editor does. Throws Error with a user message. */
export function parseValue(text, type) {
  if (typeof text !== 'string') {
    const problem = checkValue(text, type);
    if (problem) throw Error(problem);
    return text;
  }
  if (type === 'string' || type === 'ref' || type === 'formula') return text;
  if (type === 'number') {
    if (!text.trim() || !Number.isFinite(Number(text))) throw Error('Enter a valid number');
    return Number(text);
  }
  if (type === 'boolean') {
    const t = text.trim().toLowerCase();
    if (t !== 'true' && t !== 'false') throw Error('Enter true or false');
    return t === 'true';
  }
  if (type === 'json') {
    try { return JSON.parse(text); } catch { throw Error('Enter valid JSON'); }
  }
  throw Error(`Cannot parse a ${type} cell`);
}

export function formatValue(v, type) {
  if (v === undefined || v === null) return '';
  if (type === 'json' && typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ---------- sort & filter (views: return row indices, never reorder rows) ----------

/** keys: [{ key, dir: 'asc'|'desc' }]. Empty values sort last in both directions. Stable. */
export function sortIndices(rows, columns, keys = []) {
  const order = Array.from({ length: rows.length }, (_, i) => i);
  if (!keys.length) return order;
  const cols = keys.map(({ key, dir }) => {
    const column = columns.find(c => c.key === key);
    if (!column) throw Error(`No column "${key}"`);
    const values = rows.map(r => r[key]);
    return { values, type: column.type, sign: dir === 'desc' ? -1 : 1 };
  });
  const cmp = (a, b) => {
    for (const { values, type, sign } of cols) {
      const x = values[a], y = values[b];
      const ex = isEmpty(x), ey = isEmpty(y);
      if (ex || ey) { if (ex !== ey) return ex ? 1 : -1; continue; }
      let d;
      if (type === 'number' || type === 'boolean') d = Number(x) - Number(y);
      else if (type === 'json') d = collator.compare(formatValue(x, type), formatValue(y, type));
      else d = collator.compare(String(x), String(y));
      if (d) return d * sign;
    }
    return a - b;
  };
  return order.sort(cmp);
}

/**
 * text: whitespace-separated terms, all must appear somewhere in the row.
 * byColumn: { [key]: text } per-column contains filters, all must match.
 */
export function filterIndices(rows, columns, { text = '', byColumn = {} } = {}) {
  const terms = String(text).toLowerCase().split(/\s+/).filter(Boolean);
  const colFilters = Object.entries(byColumn).map(([k, v]) => [k, String(v).toLowerCase()]).filter(([, v]) => v);
  const typeOf = Object.fromEntries(columns.map(c => [c.key, c.type]));
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (colFilters.some(([k, v]) => !formatValue(row[k], typeOf[k]).toLowerCase().includes(v))) continue;
    if (terms.length) {
      const hay = columns.map(c => formatValue(row[c.key], c.type)).join('\u0001').toLowerCase();
      if (!terms.every(t => hay.includes(t))) continue;
    }
    out.push(i);
  }
  return out;
}

// ---------- selection (ranges of {r0,c0,r1,c1}; last range is active) ----------

export function createSelection() { return { ranges: [], anchor: null, active: null }; }

/** Document row indices from `from` to `to` inclusive, in the VISIBLE order (`order` = the sorted,
 *  filtered row indices). Rows hidden by a filter inside the span are skipped. If `from` is not
 *  visible there is no span to walk: only `to` is returned. */
export function visibleSpan(order, from, to) {
  const a = order.indexOf(from), b = order.indexOf(to);
  if (a < 0 || b < 0) return [to];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** Contiguous runs of document rows: [{ r0, r1 }] over the sorted unique indices. */
export function rowRuns(rows) {
  const sorted = [...new Set(rows)].sort((x, y) => x - y);
  const runs = [];
  for (const r of sorted) {
    const last = runs.at(-1);
    if (last && r === last.r1 + 1) last.r1 = r; else runs.push({ r0: r, r1: r });
  }
  return runs;
}
const rectOf = (a, b) => ({ r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) });

// `order` (the visible row indices) makes a shift range follow the view: it covers the visible rows
// between the anchor and `to`, split into document runs, so rows a filter hides are never selected.
// `columns` ([c0, c1]) overrides the columns of every range the call makes (whole rows).
function selectTo(sel, to, { shift = false, ctrl = false, anchor = sel.anchor ?? to, order = null, columns = null } = {}) {
  const cols = columns ? { c0: columns[0], c1: columns[1] } : {};
  if (shift && sel.anchor) {
    const rect = { ...rectOf(sel.anchor, to), ...cols };
    const runs = order ? rowRuns(visibleSpan(order, sel.anchor.r, to.r)).map(({ r0, r1 }) => ({ ...rect, r0, r1 })) : [rect];
    const ranges = ctrl && sel.ranges.length ? [...sel.ranges.slice(0, -1), ...runs] : runs;
    return { ranges, anchor: sel.anchor, active: to };
  }
  const rect = { ...rectOf(to, to), ...cols };
  return { ranges: ctrl ? [...sel.ranges, rect] : [rect], anchor: to, active: to };
}
export function selectCell(sel, cell, opts) { return selectTo(sel, cell, opts); }
/**
 * The selection after an arrow or Tab step by (dr, dc) from the active cell. Rows move through the VISIBLE
 * order. A hidden active row has no visible position, so it stays on its row: only the column moves, and a
 * paste from it is refused (HIDDEN_ANCHOR_REASON) instead of landing on the first visible row.
 */
export function stepActive(sel, order, dr, dc, { columnCount, extend = false }) {
  const cur = sel.active ?? { r: 0, c: 0 };
  const c = Math.min(Math.max(cur.c + dc, 0), Math.max(columnCount - 1, 0));
  const p = order.indexOf(cur.r);
  let r = cur.r;
  if (p >= 0 && order.length) r = order[Math.min(Math.max(p + dr, 0), order.length - 1)];
  return selectTo(sel, { r, c }, { shift: extend, order });
}
/** Whole-row selection over colCount columns. */
export function selectRows(sel, r, opts, colCount) {
  return selectTo(sel, { r, c: 0 }, { ...opts, columns: [0, Math.max(0, colCount - 1)] });
}
/** Move the active cell by (dr, dc), clamped to bounds; extend keeps the anchor. */
export function moveSelection(sel, dr, dc, { rowCount, colCount, extend = false }) {
  const base = sel.active ?? { r: 0, c: 0 };
  const to = {
    r: Math.min(Math.max(base.r + dr, 0), Math.max(rowCount - 1, 0)),
    c: Math.min(Math.max(base.c + dc, 0), Math.max(colCount - 1, 0)),
  };
  return selectTo({ ...sel, anchor: sel.anchor ?? base, active: base }, to, { shift: extend });
}
/**
 * Every cell of the selection (all ranges, Ctrl-selections included), read in the VISIBLE order.
 * Rows come from `order` (the visible document row indices), so a row a filter hides is never
 * selected, and a sorted view lists its rows in the sorted sequence. Overlapping ranges count a
 * cell once. Column indices are clipped to `columns`.
 * @param selection { ranges }
 * @param order number[] visible document row indices
 * @param columns column objects (only `.key` is read)
 * @returns {{ rows: number[], cols: string[], cells: [number, string][] }}
 *   rows:  selected document rows in view order, each once.
 *   cols:  selected column keys in column order (the union over the selected rows).
 *   cells: [row, key] for each selected cell, row by row in view order, columns in column order.
 */
export function selectedCells(selection, order, columns) {
  const { rows, cols, cells } = coverage(selection, order, columns);
  return { rows, cols: cols.map(c => columns[c].key), cells: cells.map(({ r, c }) => [r, columns[c].key]) };
}
/** Shared walk behind selectedCells and the copy/paste/clear ops: indices, plus has(r, c) membership. */
export function coverage(selection, order, columns) {
  const last = columns.length - 1;
  const ranges = selection.ranges
    .map(g => ({ r0: g.r0, r1: g.r1, c0: Math.max(0, g.c0), c1: Math.min(last, g.c1) }))
    .filter(g => g.c0 <= g.c1);
  const rows = [], colSet = new Set(), inside = new Set(), stride = Math.max(1, columns.length);
  for (const r of order) {
    const hit = ranges.filter(g => g.r0 <= r && r <= g.r1);
    if (!hit.length) continue;
    rows.push(r);
    for (const g of hit) for (let c = g.c0; c <= g.c1; c++) { colSet.add(c); inside.add(r * stride + c); }
  }
  const cols = [...colSet].sort((a, b) => a - b);
  const cells = [];
  for (const r of rows) for (const c of cols) if (inside.has(r * stride + c)) cells.push({ r, c });
  return { rows, cols, cells, has: (r, c) => inside.has(r * stride + c) };
}

// ---------- delimited text (clipboard, CSV/TSV import) ----------

export function parseDelimited(text, delim = ',') {
  const rows = [];
  let row = [], field = '', quoted = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (quoted) throw Error('Unclosed quote in pasted text');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
/** Tabs mean TSV (what spreadsheets copy); otherwise CSV. A trailing newline adds no row. */
export function parseClipboard(text) {
  const delim = String(text).includes('\t') ? '\t' : ',';
  return parseDelimited(text, delim);
}
export function toDelimited(matrix, delim = '\t') {
  const esc = v => {
    const s = v == null ? '' : String(v);
    return s.includes(delim) || /["\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return matrix.map(r => r.map(esc).join(delim)).join('\n');
}
/**
 * TSV for a copy of the selection. Rows run in view order and columns in column order; with several
 * ranges the columns are the union, and a cell no range covers is blank. Empty when nothing is selected.
 */
export function copyVisible(rows, columns, order, selection) {
  const { rows: picked, cols, has } = coverage(selection, order, columns);
  if (!picked.length) return '';
  const matrix = picked.map(r => cols.map(c => (has(r, c) ? formatValue(rows[r][columns[c].key], columns[c].type) : '')));
  return toDelimited(matrix, '\t');
}

// ---------- mutations ----------

const result = (doc, label, next) => {
  const before = { columns: doc.columns, rows: doc.rows };
  const after = { columns: next.columns, rows: next.rows };
  return { rows: after.rows, columns: after.columns, change: { label, undo: before, redo: after } };
};
/** Restores the document for an undo or redo step: returns { rows, columns }. */
export function applyChange(change, direction = 'undo') {
  const snap = direction === 'redo' ? change.redo : change.undo;
  return { rows: snap.rows, columns: snap.columns };
}
function colByKey(doc, key) {
  const c = doc.columns.find(x => x.key === key);
  if (!c) throw Error(`No column "${key}"`);
  return c;
}

/**
 * cells: [{ r, c }]. value: a typed value, or fn(oldValue, column) => newValue.
 * Copy-on-write: touched rows are replaced by new objects.
 */
export function setCells(doc, cells, value, label = 'Set cells') {
  const byRow = new Map();
  for (const { r, c } of cells) {
    const col = doc.columns[c];
    if (!col || r < 0 || r >= doc.rows.length) continue;
    const patch = byRow.get(r) ?? {};
    patch[col.key] = typeof value === 'function' ? value(doc.rows[r][col.key], col) : value;
    byRow.set(r, patch);
  }
  const rows = doc.rows.slice();
  for (const [r, patch] of byRow) rows[r] = { ...doc.rows[r], ...patch };
  return result(doc, label, { columns: doc.columns, rows });
}
/** Bulk edit: parse the text per column type; throws (no change) on a bad value. */
export function bulkEdit(doc, cells, text, label = 'Bulk edit') {
  const typed = new Map();
  for (const { c } of cells) {
    const col = doc.columns[c];
    if (col && !typed.has(col.type)) typed.set(col.type, parseValue(text, col.type));
  }
  return setCells(doc, cells, (old, col) => typed.get(col.type), label);
}
/** Delete clears: each selected cell takes its column's empty value. */
export function clearCells(doc, cells) {
  return setCells(doc, cells, (old, col) => emptyValue(col.type), 'Clear cells');
}
/**
 * Clear every selected cell, all ranges, visible rows only (rows a filter hides are untouched).
 * With no selected cell there is nothing to do: change is null.
 */
export function clearVisible(doc, selection, order) {
  const { cells } = coverage(selection, order, doc.columns);
  if (!cells.length) return { rows: doc.rows, columns: doc.columns, change: null };
  return clearCells(doc, cells);
}
/**
 * Paste a clipboard matrix (text or parsed matrix) with its top-left at `at`.
 * Expands rows past the end. Cells that do not parse are skipped and listed in
 * errors; the rest still apply. fill: when the clipboard is one value, it fills
 * the rect {r0,c0,r1,c1} instead of one cell.
 */
export function pasteRange(doc, at, text, { fill = null } = {}) {
  const matrix = typeof text === 'string' ? parseClipboard(text) : text;
  const errors = [];
  const columns = doc.columns;
  const rows = doc.rows.slice();
  const blank = () => Object.fromEntries(columns.map(c => [c.key, emptyValue(c.type)]));
  const put = (r, c, raw) => {
    const col = columns[c];
    if (!col) return;
    try { rows[r] = { ...rows[r], [col.key]: parseValue(raw, col.type) }; }
    catch (e) { errors.push({ row: r, key: col.key, message: e.message }); }
  };
  if (fill && matrix.length === 1 && matrix[0].length === 1) {
    for (let r = fill.r0; r <= fill.r1; r++) {
      while (r >= rows.length) rows.push(blank());
      for (let c = fill.c0; c <= fill.c1; c++) put(r, c, matrix[0][0]);
    }
  } else {
    matrix.forEach((line, i) => {
      const r = at.r + i;
      while (r >= rows.length) rows.push(blank());
      line.forEach((raw, j) => put(r, at.c + j, raw));
    });
  }
  return { ...result(doc, 'Paste', { columns, rows }), errors };
}
export const HIDDEN_ANCHOR_REASON = 'The active cell is hidden by the filter; select a visible cell and paste again.';
/**
 * Paste through the VISIBLE order. The clipboard's top-left lands on the anchor's visible position:
 * clipboard row i goes to order[pos + i], column j to column anchor.c + j. Past the last visible row,
 * blank rows are appended only when the view is unfiltered and unsorted (order is every row, in
 * document order); otherwise the paste stops there and `overflow.rows` counts the lines that did not
 * fit. Columns past the last column count in `overflow.cols`. A one-value clipboard fills every
 * selected cell (all ranges, visible rows only) when the selection has cells; with none it lands at
 * the anchor like any paste.
 *
 * Atomic: every value is parsed first. If any fails its column type, nothing is committed and the
 * result is `{ rows, columns, change: null, errors }` with the original rows, where each error is
 * { row, key, value, message } (row is the document row index).
 *
 * @param rows document rows (not mutated)
 * @param columns document columns
 * @param order number[] visible document row indices
 * @param anchor { r, c } the active cell
 * @param matrixOrText clipboard text, or a parsed matrix
 * @param selection { ranges } or null
 * A hidden anchor (not in order) refuses the paste: change null, and `reason` holds the message to show.
 * @returns {{ rows, columns, change: object | null, errors: object[], overflow: { rows: number, cols: number }, reason?: string }}
 */
export function pasteVisible(rows, columns, order, anchor, matrixOrText, selection = null) {
  const sel = selection ?? { ranges: [] };
  // An empty string is a blank copied cell; with a selection it is a one-value fill that clears.
  const blankFill = matrixOrText === '' && sel.ranges.length > 0;
  const matrix = blankFill ? [['']] : typeof matrixOrText === 'string' ? parseClipboard(matrixOrText) : matrixOrText;
  const overflow = { rows: 0, cols: 0 };
  const writes = [];
  const targets = matrix.length === 1 && matrix[0].length === 1 && sel.ranges.length
    ? coverage(sel, order, columns).cells : [];
  if (targets.length) {
    for (const { r, c } of targets) writes.push({ r, c, raw: matrix[0][0] });
  } else {
    // A filter can hide the active row. Pasting from a hidden anchor would land on another row, so refuse.
    if (order.indexOf(anchor.r) < 0) {
      return { rows, columns, change: null, errors: [], overflow, reason: HIDDEN_ANCHOR_REASON };
    }
    const identity = order.length === rows.length && order.every((r, i) => r === i);
    const start = order.indexOf(anchor.r);
    const colRoom = Math.max(0, columns.length - anchor.c);
    overflow.cols = matrix.reduce((m, line) => Math.max(m, line.length - colRoom), 0);
    for (let i = 0; i < matrix.length; i++) {
      const idx = start + i;
      const r = idx < order.length ? order[idx] : identity ? idx : null;
      if (r === null) { overflow.rows = matrix.length - i; break; }
      matrix[i].forEach((raw, j) => { if (anchor.c + j < columns.length) writes.push({ r, c: anchor.c + j, raw }); });
    }
  }
  const errors = [];
  const next = rows.slice();
  const blank = () => Object.fromEntries(columns.map(c => [c.key, emptyValue(c.type)]));
  const parsed = [];
  for (const { r, c, raw } of writes) {
    const col = columns[c];
    // A blank value clears the cell instead of failing the column's parse. For number, boolean and json a
    // whitespace-only value is blank. Text-like columns (string, ref, formula) keep what was pasted, so only
    // an exactly empty value clears them: spaces pasted into a text column are kept.
    const textColumn = col.type === 'string' || col.type === 'ref' || col.type === 'formula';
    const isBlank = typeof raw === 'string' && (textColumn ? raw === '' : !raw.trim());
    try { parsed.push({ r, key: col.key, value: isBlank ? emptyValue(col.type) : parseValue(raw, col.type) }); }
    catch (e) { errors.push({ row: r, key: col.key, value: raw, message: e.message }); }
  }
  if (errors.length) return { rows, columns, change: null, errors, overflow };
  for (const { r, key, value } of parsed) {
    while (r >= next.length) next.push(blank());
    next[r] = { ...next[r], [key]: value };
  }
  if (!parsed.length && next.length === rows.length) return { rows, columns, change: null, errors, overflow };
  return { ...result({ columns, rows }, 'Paste', { columns, rows: next }), errors, overflow };
}
/** Fill down: each column of rect takes its top row's value in the rows below. */
export function fillDown(doc, rect) {
  const rows = doc.rows.slice();
  for (let c = rect.c0; c <= rect.c1; c++) {
    const key = doc.columns[c]?.key;
    if (key === undefined) continue;
    const v = doc.rows[rect.r0]?.[key];
    for (let r = rect.r0 + 1; r <= rect.r1 && r < rows.length; r++) rows[r] = { ...rows[r], [key]: v };
  }
  return result(doc, 'Fill down', { columns: doc.columns, rows });
}
/**
 * Fill down over a selection in VISIBLE order. `orderedSelectedRowIndices` lists the selected document
 * rows in the order the view shows them: it need not ascend, and may span several runs a filter split
 * apart. For each column key, the first listed row's value goes to every other listed row. The change
 * is one snapshot, so one undo step; with fewer than two rows or no column there is nothing to do and
 * `change` is null.
 * @returns {{ rows, columns, change: object | null }}
 */
export function fillDownVisible(rows, columns, orderedSelectedRowIndices, keys) {
  const seen = new Set();
  const ordered = [];
  for (const r of orderedSelectedRowIndices) {
    if (Number.isInteger(r) && r >= 0 && r < rows.length && !seen.has(r)) { seen.add(r); ordered.push(r); }
  }
  const colKeys = [...new Set(keys)].filter(k => columns.some(c => c.key === k));
  if (ordered.length < 2 || !colKeys.length) return { rows, columns, change: null };
  const next = rows.slice();
  for (const key of colKeys) {
    const v = rows[ordered[0]][key];
    for (const r of ordered.slice(1)) next[r] = { ...next[r], [key]: v };
  }
  return { rows: next, columns, change: { label: 'Fill down', undo: { columns, rows }, redo: { columns, rows: next } } };
}
export function addRow(doc, index = doc.rows.length, values = {}) {
  const row = Object.fromEntries(doc.columns.map(c => [c.key, c.key in values ? values[c.key] : emptyValue(c.type)]));
  const rows = doc.rows.slice();
  rows.splice(index, 0, row);
  return result(doc, 'Add row', { columns: doc.columns, rows });
}
export function deleteRows(doc, indices) {
  const drop = new Set(indices);
  return result(doc, 'Delete rows', { columns: doc.columns, rows: doc.rows.filter((_, i) => !drop.has(i)) });
}
/**
 * Delete the selected rows (every range, visible rows only). A hidden row inside the selection's span
 * survives. With no selected row there is nothing to do: change is null.
 */
export function deleteVisibleRows(doc, selection, order) {
  const { rows } = coverage(selection, order, doc.columns);
  if (!rows.length) return { rows: doc.rows, columns: doc.columns, change: null };
  return deleteRows(doc, rows);
}
/** Each duplicate lands directly under its source row. */
export function duplicateRows(doc, indices) {
  const want = new Set(indices);
  const rows = [];
  doc.rows.forEach((row, i) => { rows.push(row); if (want.has(i)) rows.push({ ...row }); });
  return result(doc, 'Duplicate rows', { columns: doc.columns, rows });
}
export function addColumn(doc, spec, index = doc.columns.length) {
  const column = normalizeColumn(spec);
  if (doc.columns.some(c => c.key === column.key)) throw Error(`Column "${column.key}" already exists`);
  const columns = doc.columns.slice();
  columns.splice(index, 0, column);
  const rows = doc.rows.map(r => ({ ...r, [column.key]: emptyValue(column.type) }));
  return result(doc, 'Add column', { columns, rows });
}
export function renameColumn(doc, key, newKey, label = newKey) {
  colByKey(doc, key);
  if (!newKey) throw Error('Columns need a key');
  if (newKey !== key && doc.columns.some(c => c.key === newKey)) throw Error(`Column "${newKey}" already exists`);
  const columns = doc.columns.map(c => (c.key === key ? { ...c, key: newKey, label } : c));
  const rows = doc.rows.map(r => {
    if (!(key in r)) return r;
    const { [key]: v, ...rest } = r;
    return { ...rest, [newKey]: v };
  });
  return result(doc, 'Rename column', { columns, rows });
}
/** A column's width in px, at least MIN_COLUMN_WIDTH. A change: undoable like any other. */
export const MIN_COLUMN_WIDTH = 48;
export function resizeColumn(doc, key, width) {
  colByKey(doc, key);
  if (!Number.isFinite(width)) throw Error('Column width must be a number');
  const w = Math.max(MIN_COLUMN_WIDTH, Math.round(width));
  const columns = doc.columns.map(c => (c.key === key ? { ...c, width: w } : c));
  return result(doc, 'Resize column', { columns, rows: doc.rows });
}
export function deleteColumn(doc, key) {
  colByKey(doc, key);
  const columns = doc.columns.filter(c => c.key !== key);
  const rows = doc.rows.map(r => { const { [key]: _gone, ...rest } = r; return rest; });
  return result(doc, 'Delete column', { columns, rows });
}

// ---------- import / export ----------

function inferType(values) {
  const vs = values.filter(v => !isEmpty(v));
  if (vs.length && vs.every(v => typeof v === 'number')) return 'number';
  if (vs.length && vs.every(v => typeof v === 'boolean')) return 'boolean';
  if (vs.some(v => typeof v === 'object')) return 'json';
  return 'string';
}
/**
 * Import text into doc. format: 'auto'|'csv'|'tsv'|'json'. mode: 'merge' updates the
 * rows whose `key` value matches (fields present in the import overwrite; unmatched
 * rows are appended); 'replace' swaps every row. New columns are appended. Throws
 * before changing anything on bad input.
 */
export function importRows(doc, text, { format = 'auto', mode = 'merge', key = null } = {}) {
  const raw = String(text);
  if (format === 'auto') {
    const t = raw.trim();
    format = t.startsWith('[') || t.startsWith('{') ? 'json' : raw.includes('\t') ? 'tsv' : 'csv';
  }
  let incoming, names;
  if (format === 'json') {
    const parsed = JSON.parse(raw.trim());
    const list = Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray);
    if (!Array.isArray(list) || !list.every(r => r && typeof r === 'object' && !Array.isArray(r))) throw Error('JSON needs an array of objects');
    incoming = list;
    names = [...new Set(list.flatMap(Object.keys))];
  } else {
    const matrix = parseDelimited(raw, format === 'tsv' ? '\t' : ',').filter(r => r.some(x => x !== ''));
    if (!matrix.length) throw Error('Import needs a header row');
    names = matrix[0].map(x => x.trim());
    if (names.some(n => !n) || new Set(names).size !== names.length) throw Error('Headers must be unique and nonempty');
    incoming = matrix.slice(1).map((line, i) => {
      if (line.length !== names.length) throw Error(`Row ${i + 2} has ${line.length} cells; expected ${names.length}`);
      return Object.fromEntries(names.map((n, j) => [n, line[j]]));
    });
  }
  const columns = doc.columns.map(c => ({ ...c }));
  for (const n of names) {
    if (!columns.some(c => c.key === n)) {
      const values = incoming.map(r => r[n]);
      columns.push({ key: n, label: n, type: format === 'json' ? inferType(values) : 'string' });
    }
  }
  // Object.fromEntries defines each key as an own property, so an imported "__proto__" key
  // stays data and cannot set the row's prototype.
  // JSON values are checked against the existing column types (as CSV cells are parsed), and a
  // bad value throws before anything changes. A column the import adds takes its type from the data.
  const typed = incoming.map((r, i) => Object.fromEntries(Object.entries(r).map(([k, v]) => {
    const col = columns.find(c => c.key === k);
    if (format !== 'json') return [k, parseValue(v, col.type)];
    const existing = doc.columns.find(c => c.key === k);
    const problem = existing ? checkValue(v, existing.type) : null;
    if (problem) throw Error(`Row ${i + 1}, ${k}: ${problem}`);
    return [k, v];
  })));
  const fill = row => Object.fromEntries(columns.map(c => [c.key, c.key in row ? row[c.key] : emptyValue(c.type)]));
  let rows;
  if (mode === 'replace' || !key) {
    rows = mode === 'replace' ? typed.map(fill) : [...doc.rows, ...typed.map(fill)];
  } else {
    rows = doc.rows.slice();
    const at = new Map();
    rows.forEach((r, i) => { const k = formatValue(r[key], 'string').trim(); if (k && !at.has(k)) at.set(k, i); });
    for (const row of typed) {
      const k = formatValue(row[key], 'string').trim();
      if (k && at.has(k)) rows[at.get(k)] = { ...rows[at.get(k)], ...row };
      else { if (k) at.set(k, rows.length); rows.push(fill(row)); }
    }
  }
  return result(doc, `Import ${typed.length} rows (${mode})`, { columns, rows });
}
export function toCSV(doc) {
  const esc = v => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
  const head = doc.columns.map(c => esc(c.key)).join(',');
  return [head, ...doc.rows.map(r => doc.columns.map(c => esc(formatValue(r[c.key], c.type))).join(','))].join('\n') + '\n';
}
export function toTSV(doc) {
  const matrix = [doc.columns.map(c => c.key), ...doc.rows.map(r => doc.columns.map(c => formatValue(r[c.key], c.type)))];
  return toDelimited(matrix, '\t') + '\n';
}
export function toJSON(doc) { return JSON.stringify(doc.rows, null, 2) + '\n'; }

// ---------- validation ----------

/**
 * rules (each { kind, key?, level?, message? }):
 *   required — empty value
 *   unique   — later duplicates of a non-empty value; `key` names one column, `keys` (an array) names
 *              a compound key: the tuple of those columns, blank key cells skipped, flagged on the last key
 *   type     — value does not fit the column type
 *   ref      — value (or whitespace list when multi) not in the target; the target is
 *              `has(value)`, `ids` (iterable), or options.refs[table] (Set or fn)
 *   custom   — fn(row, index, doc) returns null | string | [{ key?, message, level? }]
 * Returns [{ row, key, level, message }], ordered by row then column. level defaults to 'error'.
 */
export function validate(doc, rules = [], options = {}) {
  const out = [];
  const colIndex = Object.fromEntries(doc.columns.map((c, i) => [c.key, i]));
  const push = (row, key, level, message) => out.push({ row, key, level: level ?? 'error', message });
  const lookupFor = rule => {
    if (typeof rule.has === 'function') return rule.has;
    if (rule.ids) { const set = new Set(rule.ids); return v => set.has(v); }
    const target = options.refs?.[rule.table];
    if (typeof target === 'function') return target;
    if (target) return v => target.has(v);
    throw Error(`ref rule needs a target for "${rule.key}"`);
  };
  for (const rule of rules) {
    if (rule.kind === 'unique' && Array.isArray(rule.keys)) {
      const cols = rule.keys.map(k => doc.columns.find(c => c.key === k));
      const unknown = rule.keys.find((k, j) => !cols[j]);
      if (unknown !== undefined) throw Error(`Rule names unknown column "${unknown}"`);
      const seen = new Set();
      doc.rows.forEach((row, i) => {
        const parts = cols.map(c => formatValue(row[c.key], c.type).trim());
        if (!parts.at(-1)) return;
        const tuple = JSON.stringify(parts);
        if (seen.has(tuple)) push(i, cols.at(-1).key, rule.level, rule.message ?? `Duplicate ${rule.keys.join(' + ')} "${parts.join(' / ')}"`);
        else seen.add(tuple);
      });
      continue;
    }
    if (rule.kind === 'custom') {
      doc.rows.forEach((row, i) => {
        const res = rule.fn(row, i, doc);
        if (res == null) return;
        const list = typeof res === 'string' ? [{ message: res }] : res;
        for (const item of list) push(i, item.key ?? rule.key ?? null, item.level ?? rule.level, item.message);
      });
      continue;
    }
    const col = doc.columns.find(c => c.key === rule.key);
    if (!col) throw Error(`Rule names unknown column "${rule.key}"`);
    if (rule.kind === 'required') {
      doc.rows.forEach((row, i) => { if (isEmpty(row[col.key])) push(i, col.key, rule.level, rule.message ?? `${col.label} is required`); });
    } else if (rule.kind === 'unique') {
      const seen = new Set();
      doc.rows.forEach((row, i) => {
        const v = formatValue(row[col.key], col.type).trim();
        if (!v) return;
        if (seen.has(v)) push(i, col.key, rule.level, rule.message ?? `Duplicate ${col.key} "${v}"`);
        else seen.add(v);
      });
    } else if (rule.kind === 'type') {
      doc.rows.forEach((row, i) => { const m = checkValue(row[col.key], col.type); if (m) push(i, col.key, rule.level, m); });
    } else if (rule.kind === 'ref') {
      const has = lookupFor(rule);
      doc.rows.forEach((row, i) => {
        const v = formatValue(row[col.key], col.type).trim();
        if (!v) return;
        const parts = rule.multi ? v.split(/\s+/) : [v];
        const missing = parts.filter(p => !has(p));
        if (missing.length) push(i, col.key, rule.level, rule.message ?? `Unknown: ${missing.join(', ')}`);
      });
    } else throw Error(`Unknown rule kind "${rule.kind}"`);
  }
  return out.sort((a, b) => a.row - b.row || (colIndex[a.key] ?? -1) - (colIndex[b.key] ?? -1));
}
