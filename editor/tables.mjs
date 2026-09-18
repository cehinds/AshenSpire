// AshenSpire CSV is line oriented; match the content compiler's comments and cells.
export function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const comments = lines.filter(line => line.trim().startsWith('#'));
  const data = lines.filter(line => line.trim() && !line.trim().startsWith('#'));
  function cells(line) {
    let value = '', quoted = false;
    const result = [];
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) { result.push(value.trim()); value = ''; }
      else value += char;
    }
    if (quoted) throw Error('Unclosed CSV quote. Multiline cells are not supported by the game compiler.');
    result.push(value.trim());
    return result;
  }
  if (!data.length) throw Error('CSV needs a header');
  const columns = cells(data[0]);
  if (columns.some(c => !c) || new Set(columns).size !== columns.length) throw Error('CSV headers must be unique and nonempty');
  const rows = data.slice(1).map((line, i) => {
    const values = cells(line);
    if (values.length !== columns.length) throw Error(`CSV row ${i + 2} has ${values.length} cells; expected ${columns.length}`);
    return Object.fromEntries(columns.map((key, index) => [key, values[index]]));
  });
  return { columns, rows, comments };
}
export function stringifyCSV({ columns, rows, comments = [] }) {
  const cell = value => {
    const s = String(value ?? '');
    if (/[\r\n]/.test(s)) throw Error('CSV cells cannot contain line breaks');
    return /[,"#]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [...comments, columns.map(cell).join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\n') + '\n';
}
export function tableData(name, text) {
  if (name.endsWith('.csv')) return { format: 'csv', ...parseCSV(text) };
  const document = JSON.parse(text);
  const key = Array.isArray(document) ? null : Object.keys(document).find(k => Array.isArray(document[k]));
  const rows = Array.isArray(document) ? document : key ? document[key] : null;
  const tabular = rows && rows.every(row => row && typeof row === 'object' && !Array.isArray(row));
  return { format: 'json', document, key, rows: tabular ? rows : null, columns: tabular ? [...new Set(rows.flatMap(Object.keys))] : [] };
}
