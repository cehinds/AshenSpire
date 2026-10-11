// workbench/ui/logic.mjs — the Workbench page's DOM-free helpers (tested in
// workbench/tests/ui.test.mjs): fuzzy matching, device fitting, formatting.

/**
 * Fuzzy score of `query` against `text`: null when the letters of the query do
 * not all appear in order; otherwise higher is better. Word starts, runs of
 * consecutive letters and an early first match score more.
 */
export function fuzzyScore(query, text) {
  const q = String(query || '').toLowerCase().replace(/\s+/g, '');
  const t = String(text || '').toLowerCase();
  if (!q) return 0;
  let score = 0; let ti = 0; let run = 0; let first = -1;
  for (const ch of q) {
    const at = t.indexOf(ch, ti);
    if (at < 0) return null;
    if (first < 0) first = at;
    const boundary = at === 0 || /[\s\-_/.·:&(]/.test(t[at - 1]);
    run = at === ti ? run + 1 : 0;
    score += 1 + (boundary ? 6 : 0) + run * 3;
    ti = at + 1;
  }
  if (t.includes(q)) score += 10 + (t.startsWith(q) ? 10 : 0);
  return score - first * 0.2 - t.length * 0.01;
}

/** Rank `items` by fuzzy score over `keyOf(item)`; the query matches title words first. */
export function fuzzyFilter(items, query, keyOf = (x) => x.title) {
  if (!String(query || '').trim()) return items.slice();
  return items.map((item, i) => ({ item, i, s: fuzzyScore(query, keyOf(item)) }))
    .filter((r) => r.s !== null)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.item);
}

export const DEVICES = [
  { id: 'fill', label: 'Fill', width: 0, height: 0 },
  { id: 'desktop', label: 'Desktop', width: 1280, height: 720 },
  { id: 'tablet', label: 'Tablet', width: 1024, height: 768 },
  { id: 'phone', label: 'Phone', width: 390, height: 844 },
];

/** Scale and offset that fit a device viewport inside a stage box (never upscaled). */
export function fitDevice(device, stage, pad = 16) {
  if (!device || !device.width) return { scale: 1, width: stage.width, height: stage.height, left: 0, top: 0 };
  const availW = Math.max(40, stage.width - pad * 2); const availH = Math.max(40, stage.height - pad * 2);
  const scale = Math.min(availW / device.width, availH / device.height, 1);
  const w = device.width * scale; const h = device.height * scale;
  return { scale, width: device.width, height: device.height, left: Math.round((stage.width - w) / 2), top: Math.round((stage.height - h) / 2) };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function duration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  return `${Math.floor(s / 60)} m ${Math.round(s % 60)} s`;
}

export function ago(t, now = Date.now()) {
  if (!t) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

/** The manifest format tools/engine-export.mjs writes (docs/ENGINE-EXPORT.md). */
export const EXPORT_FORMAT = 'ashenspire.engine-export/1';

/**
 * The tables of build/engine-export/manifest.json. The exporter's format is
 * `tables: [{ id, file, schema, rows, sha256, omittedFunctions }]`; older or
 * hand-written shapes (name/json/rowCount, or an object keyed by name) are
 * still read so the page never goes blank on them.
 */
export function manifestTables(manifest) {
  if (!manifest) return [];
  const raw = Array.isArray(manifest) ? manifest : manifest.tables || manifest.files || manifest.entries || [];
  const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([name, v]) => ({ name, ...(typeof v === 'object' ? v : { rows: v }) }));
  return list.map((t) => ({
    name: t.id || t.name || t.table || '(unnamed)',
    rows: t.rows ?? t.rowCount ?? t.count ?? (Array.isArray(t.data) ? t.data.length : null),
    schema: t.schema || t.schemaPath || t.schemaFile || '',
    json: t.file || t.json || t.data || t.path || t.dataFile || '',
    description: t.description || '',
    omitted: Array.isArray(t.omittedFunctions) ? t.omittedFunctions.length : 0,
  })).map((t) => ({ ...t, json: typeof t.json === 'string' ? t.json : '' }));
}

/** The header facts of an export manifest: format, version, build, commit and counts. */
export function manifestSummary(manifest) {
  if (!manifest || Array.isArray(manifest)) return null;
  const tables = manifestTables(manifest);
  return {
    format: manifest.format || '',
    known: manifest.format === EXPORT_FORMAT,
    version: manifest.version || '',
    buildOrdinal: manifest.buildOrdinal ?? null,
    gitSha: typeof manifest.gitSha === 'string' ? manifest.gitSha.slice(0, 9) : '',
    tables: tables.length,
    rows: tables.reduce((n, t) => n + (Number(t.rows) || 0), 0),
    config: Array.isArray(manifest.config) ? manifest.config.length : 0,
    art: Array.isArray(manifest.art) ? manifest.art.length : 0,
  };
}

/**
 * The error `api()` throws for a non-OK response. `status` is the HTTP status;
 * `body` is the parsed JSON body, or null when the reply had none. The message
 * is the body's `error`, or `HTTP <status>` when there is none.
 */
export function apiError(status, body) {
  const err = new Error((body && body.error) || `HTTP ${status}`);
  err.status = status;
  err.body = body ?? null;
  return err;
}
