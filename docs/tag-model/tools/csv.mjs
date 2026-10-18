// RFC 4180 CSV helpers shared by the tag-model tools.
import { readFileSync } from 'node:fs';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let quoted = false;
  const s = text.replace(/\r\n/g, '\n');
  while (i < s.length) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { quoted = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (quoted) throw new Error('unterminated quoted field');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Reads a CSV file: { header, rows } where every row is an array of strings.
// Throws if any row's column count differs from the header.
export function readTable(path) {
  const all = parseCsv(readFileSync(path, 'utf8'));
  const header = all.shift() || [];
  const rows = all.filter(r => !(r.length === 1 && r[0] === ''));
  rows.forEach((r, n) => {
    if (r.length !== header.length) {
      throw new Error(`${path}: row ${n + 2} has ${r.length} columns, header has ${header.length}`);
    }
  });
  return { header, rows };
}

export function quote(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(header, rows) {
  return [header, ...rows].map(r => r.map(quote).join(',')).join('\n') + '\n';
}
