// workbench/modules/data/model.mjs — the Data Studio's DOM-free table model.
//
// A table is one repo file: content/source/*.csv, content/source/*.json (arrays
// of objects) or content/framework/*.json (arrays of objects). parseTable turns
// the text into { columns, rows } for the grid kit; serializeTable turns the
// grid's { columns, rows } back into text.
//
// Round trips are exact. Lines the table does not own (CSV comment and blank
// lines) are kept where they were, and each row that is unchanged is written
// back as the same bytes it was read from. A JSON table that is unchanged is
// written back as the same text. Only edited rows take the canonical form.
//
// The CSV reader follows editor/tables.mjs (the content compiler's rules: '#'
// lines are comments, quoted cells, no multiline cells). It is ported rather
// than imported because the Workbench server serves only workbench/ to the page.

export const SOURCE_DIR = 'content/source';
export const FRAMEWORK_DIR = 'content/framework';
const KEY_NAMES = ['id', 'key', 'name'];
/**
 * Tables whose id is unique only within a scope column (file path -> scope column). Every other table's id is
 * unique on its own. Listed explicitly, not inferred: a duplicate id under another *Id column is still an error.
 * content/source/outfits.csv: a refs of the form armor/<classId>/<id>, so (classId, id) is the identity.
 */
export const KEY_SCOPES = Object.freeze({ 'content/source/outfits.csv': 'classId' });

/** The scope column for a table path from KEY_SCOPES, or null. */
export function keyScopeFor(path) {
  return Object.hasOwn(KEY_SCOPES, path) ? KEY_SCOPES[path] : null;
}
// The content compiler's number grammar (tools/content-build.mjs coerce): integers and plain decimals.
// Exponents ('1e3') and trailing dots ('1.') stay strings, so a round trip never rewrites them.
const NUMBER = /^-?(\d+|\d*\.\d+)$/;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isEmpty = (v) => v === undefined || v === null || v === '';

/** The table files among repo paths: Source (csv and json) and Framework (json), each sorted by name. */
export function listTables(paths = []) {
  const out = [];
  for (const path of paths) {
    const m = /^(content\/(source|framework))\/([^/]+)\.(csv|json)$/.exec(String(path));
    if (!m) continue;
    const group = m[2] === 'source' ? 'Source' : 'Framework';
    const format = m[4];
    if (group === 'Framework' && format !== 'json') continue;
    out.push({ path, name: m[3], group, format });
  }
  return out.sort((a, b) => (a.group === b.group ? a.name.localeCompare(b.name) : a.group === 'Source' ? -1 : 1));
}

/** The key column: the first column named id, key or name. None means no key rules. */
export function keyColumnOf(columns) {
  return columns.find((c) => KEY_NAMES.includes(c.key)) ?? null;
}

/**
 * The deep link's `match` param: `col:value` pairs separated by commas, e.g. `classId:reaver`.
 * Returns [{ col, value }]; a blank or malformed piece is dropped. Empty input gives [].
 */
export function parseMatch(text) {
  if (!text) return [];
  const out = [];
  for (const piece of String(text).split(',')) {
    const at = piece.indexOf(':');
    if (at <= 0) continue;
    out.push({ col: piece.slice(0, at).trim(), value: piece.slice(at + 1).trim() });
  }
  return out;
}

/**
 * The index of the first row whose key column equals `row` and whose columns named in `match` equal their
 * values, or -1. A row with no match requirement is found by its key alone. Values compare as text.
 */
export function findRow(rows, keyCol, row, match = '') {
  if (!keyCol || row == null) return -1;
  const wanted = parseMatch(match);
  return rows.findIndex((r) => String(r[keyCol] ?? '') === String(row)
    && wanted.every((m) => String(r[m.col] ?? '') === m.value));
}

/**
 * Validation rules for the grid: the key is required and unique; every value fits its column type.
 * `path` is the table's repo path; KEY_SCOPES decides whether its key is unique within a scope column.
 */
export function tableRules(columns, path = null) {
  const key = keyColumnOf(columns);
  const rules = [];
  if (key) {
    const scope = keyScopeFor(path);
    rules.push({ kind: 'required', key: key.key });
    rules.push(scope ? { kind: 'unique', keys: [scope, key.key] } : { kind: 'unique', key: key.key });
  }
  for (const c of columns) rules.push({ kind: 'type', key: c.key });
  return rules;
}

// ---------- typed values ----------

/** The column type that fits every non-empty value: number, boolean, string, or json for anything mixed or nested. */
export function inferType(values) {
  const vs = values.filter((v) => !isEmpty(v));
  if (!vs.length) return 'string';
  if (vs.every((v) => typeof v === 'number')) return 'number';
  if (vs.every((v) => typeof v === 'boolean')) return 'boolean';
  if (vs.every((v) => typeof v === 'string')) return 'string';
  return 'json';
}

/** Text of one cell, as CSV writes it (no quoting). */
function cellText(v, type) {
  if (v === undefined || v === null) return '';
  if (type === 'json' || typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function csvCell(s) {
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) || s.startsWith('#') ? `"${s.replaceAll('"', '""')}"` : s;
}

// ---------- CSV ----------

/** One CSV line into raw cells (quotes as the content compiler reads them). */
function splitCsvLine(line, lineNo) {
  const cells = [];
  let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { cells.push(value); value = ''; }
    else value += ch;
  }
  if (quoted) throw Error(`Unclosed CSV quote on line ${lineNo}. Multiline cells are not supported by the game compiler.`);
  cells.push(value);
  return cells;
}

const isCommentOrBlank = (line) => { const t = line.trim(); return !t || t.startsWith('#'); };

function inferCsvType(cells) {
  const vs = cells.map((c) => c.trim()).filter((c) => c !== '');
  if (!vs.length) return 'string';
  if (vs.every((v) => v === 'true' || v === 'false')) return 'boolean';
  if (vs.every((v) => NUMBER.test(v))) return 'number';
  if (vs.every((v) => /^[[{]/.test(v) && jsonOrNull(v) !== undefined)) return 'json';
  return 'string';
}
function jsonOrNull(text) { try { return JSON.parse(text); } catch { return undefined; } }

function typedCell(raw, type) {
  if (type === 'string') return raw;
  const t = raw.trim();
  if (t === '') return null;
  if (type === 'number') return Number(t);
  if (type === 'boolean') return t === 'true';
  return JSON.parse(t);
}

function csvLine(row, columns, types) {
  return columns.map((c) => csvCell(cellText(row[c.key], types[c.key]))).join(',');
}

function parseCsv(text) {
  const bom = text.startsWith('﻿');
  const body = bom ? text.slice(1) : text;
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const lines = body.split(/\r?\n/);
  const trailingNewline = lines.length > 1 && lines.at(-1) === '';
  if (trailingNewline) lines.pop();
  const headerAt = lines.findIndex((l) => !isCommentOrBlank(l));
  if (headerAt < 0) throw Error('CSV needs a header');
  const headerLine = lines[headerAt];
  const names = splitCsvLine(headerLine, headerAt + 1).map((c) => c.trim());
  if (names.some((n) => !n) || new Set(names).size !== names.length) throw Error('CSV headers must be unique and nonempty');
  const cellRows = [], lead = [];
  let pending = [];
  lines.slice(headerAt + 1).forEach((line, i) => {
    if (isCommentOrBlank(line)) { pending.push(line); return; }
    const cells = splitCsvLine(line, headerAt + i + 2);
    if (cells.length !== names.length) throw Error(`CSV row ${headerAt + i + 2} has ${cells.length} cells; expected ${names.length}`);
    cellRows.push(cells); lead.push({ line, before: pending }); pending = [];
  });
  const columns = names.map((key, j) => {
    const type = inferCsvType(cellRows.map((r) => r[j]));
    return { key, label: key, type };
  });
  const types = Object.fromEntries(columns.map((c) => [c.key, c.type]));
  const rows = cellRows.map((cells) => Object.fromEntries(columns.map((c, j) => [c.key, typedCell(cells[j], c.type)])));
  // Each read row keeps its line, the comment and blank lines above it, and its canonical text.
  const leads = rows.map((row, i) => ({ ...lead[i], text: csvLine(row, columns, types), row }));
  return {
    columns, rows,
    meta: { format: 'csv', bom, eol, trailingNewline, pre: lines.slice(0, headerAt), headerLine, names, leads, tail: pending },
  };
}

/**
 * The identity of a row for pairing: its key column's text, with the scope column first when the table's path
 * is in KEY_SCOPES. null when the table has no key column.
 */
function rowKey(row, keyName, scope) {
  if (!keyName) return null;
  return JSON.stringify([scope ? row[scope] : null, row[keyName]].map((v) => String(v ?? '')));
}

/**
 * Pairs each saved row with the read row it came from, or -1 for a new row.
 * `read` and `saved` are arrays of { text, key }: canonical text and row key
 * (null when the table has none). Identity, not order: a read row pairs at
 * most once. Pass 1 pairs equal text, first to first in read order. Pass 2
 * pairs the same key. Pass 3 pairs the rows left over, in order. Read rows
 * nothing pairs with were deleted. O(n) with maps.
 */
function alignRows(read, saved) {
  const at = new Array(saved.length).fill(-1);
  const taken = new Uint8Array(read.length);
  // Each pass pairs saved rows, in saved order, with the untaken read rows that share its value.
  // Read rows are pushed last to first, so pop() yields the earliest one.
  const pass = (readValue, savedValue) => {
    const queues = new Map();
    for (let i = read.length - 1; i >= 0; i--) {
      const v = readValue(read[i]);
      if (taken[i] || v === null) continue;
      const list = queues.get(v);
      if (list) list.push(i); else queues.set(v, [i]);
    }
    saved.forEach((s, j) => {
      const v = savedValue(s);
      const list = at[j] < 0 && v !== null ? queues.get(v) : undefined;
      if (list?.length) { at[j] = list.pop(); taken[at[j]] = 1; }
    });
  };
  pass((r) => r.text, (s) => s.text);
  pass((r) => r.key, (s) => s.key);
  const freeSaved = [], freeRead = [];
  at.forEach((i, j) => { if (i < 0) freeSaved.push(j); });
  for (let i = 0; i < read.length; i++) if (!taken[i]) freeRead.push(i);
  freeSaved.forEach((j, k) => { if (k < freeRead.length) { at[j] = freeRead[k]; taken[freeRead[k]] = 1; } });
  return at;
}

function serializeCsv(meta, { columns, rows }, path) {
  const types = Object.fromEntries(columns.map((c) => [c.key, c.type]));
  const keys = columns.map((c) => c.key);
  const sameNames = keys.length === meta.names.length && keys.every((k, i) => k === meta.names[i]);
  const out = [...meta.pre, sameNames ? meta.headerLine : columns.map((c) => csvCell(c.key)).join(',')];
  const keyName = keyColumnOf(columns)?.key ?? null, scope = keyScopeFor(path);
  const read = meta.leads.map((l) => ({ text: l.text, key: rowKey(l.row, keyName, scope) }));
  const saved = rows.map((row) => ({ text: csvLine(row, columns, types), key: rowKey(row, keyName, scope) }));
  const at = alignRows(read, saved);
  const paired = new Uint8Array(meta.leads.length);
  for (const i of at) if (i >= 0) paired[i] = 1;
  // Leading lines of deleted rows wait for the next kept row in file order, or the end of the file.
  const inherited = [];
  let pending = [];
  meta.leads.forEach((lead, i) => {
    if (paired[i]) { inherited[i] = pending; pending = []; }
    else pending.push(...lead.before);
  });
  saved.forEach(({ text }, j) => {
    const i = at[j];
    if (i < 0) { out.push(text); return; }
    const lead = meta.leads[i];
    out.push(...inherited[i], ...lead.before, text === lead.text ? lead.line : text);
  });
  out.push(...pending, ...meta.tail);
  return (meta.bom ? '﻿' : '') + out.join(meta.eol) + (meta.trailingNewline ? meta.eol : '');
}

// ---------- JSON ----------

function parseJson(text) {
  let document;
  try { document = JSON.parse(text); } catch (e) { throw Error(`Invalid JSON: ${e.message}`); }
  if (!document || typeof document !== 'object') throw Error('Not a table: the JSON needs an array of objects');
  const arrayKey = Array.isArray(document) ? null : Object.keys(document).find((k) => Array.isArray(document[k])) ?? null;
  const list = Array.isArray(document) ? document : arrayKey ? document[arrayKey] : null;
  if (!list || !list.every(isObject)) throw Error('Not a table: the JSON needs an array of objects');
  const names = [...new Set(list.flatMap(Object.keys))];
  const columns = names.map((key) => ({ key, label: key, type: inferType(list.map((r) => r[key])) }));
  return { columns, rows: list, meta: { format: 'json', arrayKey, document, canonical: JSON.stringify(document), text } };
}

function serializeJson(meta, { rows }) {
  const out = meta.arrayKey === null ? rows : { ...meta.document, [meta.arrayKey]: rows };
  if (JSON.stringify(out) === meta.canonical) return meta.text;
  return JSON.stringify(out, null, 2) + '\n';
}

// ---------- tables ----------

/**
 * Parse a table file. Returns { path, format, columns, rows, baseHash, text, meta }.
 * Throws Error with a user message when the text is not a table.
 */
export function parseTable(path, text, { hash = null } = {}) {
  const format = /\.csv$/.test(path) ? 'csv' : 'json';
  const parsed = format === 'csv' ? parseCsv(text) : parseJson(text);
  return { path, format, columns: parsed.columns, rows: parsed.rows, baseHash: hash, text, meta: parsed.meta };
}

/** The text a table's { columns, rows } would be saved as. Unchanged data gives the original text. */
export function serializeTable(table, doc = { columns: table.columns, rows: table.rows }) {
  return table.format === 'csv' ? serializeCsv(table.meta, doc, table.path) : serializeJson(table.meta, doc);
}

/** True when the grid's document differs from the file as read. */
export function isDirty(table, doc) {
  return serializeTable(table, doc) !== table.text;
}

/** A save entry for the Workbench files API: { path, text, baseHash }. */
export function changeFor(table, doc) {
  return { path: table.path, text: serializeTable(table, doc), baseHash: table.baseHash };
}

/**
 * The changes rebased on the disk hashes a 409 reported. A file deleted on
 * disk reports hash null, and Overwrite then saves with baseHash null, which
 * creates it; a file that changed keeps its new hash.
 */
export function rebaseChanges(changes, conflicts) {
  const disk = new Map(conflicts.map((c) => [c.path, c.hash ?? null]));
  return changes.map((c) => (disk.has(c.path) ? { ...c, baseHash: disk.get(c.path) } : c));
}
