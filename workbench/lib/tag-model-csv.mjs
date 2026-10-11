// workbench/lib/tag-model-csv.mjs — the CSV reader and writer for docs/tag-model tables.
//
// RFC 4180: a quoted cell may hold commas, doubled quotes ("") and line breaks, and a
// record ends at a line break outside quotes. The tag-model tables use these (for example
// presentation/animations.csv, effects.csv and settings.csv hold multiline cells). The
// content and source CSVs keep editor/tables.mjs, which is line oriented; this reader is
// used ONLY for docs/tag-model tables, on the server (core/files.mjs, core/tag-model.mjs)
// and in Data Studio (modules/data/model.mjs).
//
// Pure: no Node or DOM APIs, so both sides import this one file.
//
// The reader keeps every cell's text as written (no trimming), and it reports the file's
// line ending, its trailing newline and its byte-order mark, so writeTagCSV can give the
// same file shape back. A malformed file throws with a message the save refuses with.

const BOM = '﻿';

/**
 * Parses RFC 4180 text into { columns, rows, eol, trailingNewline, bom }.
 * rows are objects keyed by column name. Blank records are skipped, as the content reader does.
 * Throws for an unclosed quote, a duplicate or empty header name, or a row with the wrong cell count.
 */
export function parseTagCSV(text) {
  if (typeof text !== 'string') throw Error('CSV text must be a string');
  const bom = text.startsWith(BOM);
  const body = bom ? text.slice(1) : text;
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const records = []; // each: { cells, line }
  let cells = [], value = '', quoted = false, startLine = 1, line = 1, recordText = '';
  const endRecord = () => {
    cells.push(value);
    if (!(cells.length === 1 && cells[0] === '' && recordText === '')) records.push({ cells, line: startLine });
    cells = []; value = ''; recordText = '';
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') { value += '"'; i++; recordText += '""'; continue; }
        quoted = false; recordText += '"'; continue;
      }
      if (ch === '\n') line++;
      value += ch; recordText += ch; continue;
    }
    if (ch === '"' && value === '') { quoted = true; recordText += ch; continue; }
    if (ch === ',') { cells.push(value); value = ''; recordText += ch; continue; }
    if (ch === '\r' && body[i + 1] === '\n') { i++; endRecord(); line++; startLine = line; continue; }
    if (ch === '\n') { endRecord(); line++; startLine = line; continue; }
    value += ch; recordText += ch;
  }
  if (quoted) throw Error(`Unclosed CSV quote at line ${startLine}.`);
  const trailingNewline = body.length > 0 && body.endsWith('\n');
  if (!trailingNewline && (value !== '' || cells.length || recordText !== '')) endRecord();
  if (!records.length) throw Error('CSV needs a header');
  const columns = records[0].cells;
  if (columns.some((c) => !c.trim()) || new Set(columns).size !== columns.length) throw Error('CSV headers must be unique and nonempty');
  const rows = records.slice(1).map(({ cells: row, line: at }) => {
    if (row.length !== columns.length) throw Error(`CSV row at line ${at} has ${row.length} cells; expected ${columns.length}`);
    return Object.fromEntries(columns.map((key, index) => [key, row[index]]));
  });
  return { columns, rows, eol, trailingNewline, bom };
}

/** One cell as RFC 4180 writes it: quoted when it holds a comma, a quote, a line break, or starts or ends with a space. */
export function tagCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/**
 * Writes { columns, rows } as text. The shape defaults to LF, a trailing newline and no BOM;
 * pass the reader's eol, trailingNewline and bom to keep a file's own shape.
 */
export function writeTagCSV({ columns, rows }, { eol = '\n', trailingNewline = true, bom = false } = {}) {
  const lines = [columns.map(tagCell).join(','), ...rows.map((row) => columns.map((key) => tagCell(row[key])).join(','))];
  return (bom ? BOM : '') + lines.join(eol) + (trailingNewline && lines.length ? eol : '');
}
