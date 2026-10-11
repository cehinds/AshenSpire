#!/usr/bin/env node
// tools/engine-export.mjs — the game's data as engine-ready JSON.
//
// Writes every content table the game reads (the composed content bundle, the
// authored content/source files, the framework JSON, the compiled UI config)
// plus the art manifests, in a shape Unity and Unreal Engine import without
// knowing anything about this repository: one JSON array of row objects per
// table, every row keyed by a string `Name` (the Unreal DataTable row key),
// a JSON Schema per table, and one manifest that lists them all with hashes.
// docs/ENGINE-EXPORT.md documents the format and the engine-side importers.
//
//   node tools/engine-export.mjs                       write build/engine-export/
//   node tools/engine-export.mjs --out <dir>           write somewhere else
//   node tools/engine-export.mjs --check               regenerate in a temp dir and
//                                                      compare with --out; exit 1 on drift
//   node tools/engine-export.mjs --only content.cards,framework
//                                                      only these tables (an id, or a
//                                                      prefix ending at a dot boundary)
//   node tools/engine-export.mjs --no-build            do not run the builders first;
//                                                      fail if their output is stale
//
// The export reads the generated modules (src/content/generated, src/framework/
// data, src/config/generated) next to the authored files they are compiled
// from. So that it never mixes the two at different edits, it first runs the
// builders that own those modules (each rewrites only what changed); with
// --no-build it runs their --check instead and stops when one is stale.
//
// The output is deterministic: no timestamps, keys sorted, arrays in authored
// order, 2-space indent, trailing newline. Two runs at one commit are
// byte-identical. build/engine-export/ is ignored by git; never commit it.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, mkdtempSync, statSync } from 'node:fs';
import { join, dirname, relative, sep, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { holdForCli } from './lib/build-lock.mjs';

export const FORMAT = 'ashenspire.engine-export/1';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';
const ENUM_MAX = 12;
const ENUM_MIN_ROWS = 5;
const NAME_FIELDS = ['id', 'key', 'name'];

// ---------------------------------------------------------------------------
// Plain-data conversion: functions dropped (and reported), cycles → {$ref},
// Map/Set → object/array, non-finite numbers → null, keys sorted.
// ---------------------------------------------------------------------------

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Map) && !(v instanceof Set);

/** Deep-convert `value` to plain JSON data; `omitted` collects function paths. */
export function toPlain(value, path = '$', omitted = [], stack = []) {
  if (typeof value === 'function') { omitted.push(path); return undefined; }
  if (value === undefined || typeof value === 'symbol') return undefined;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || typeof value !== 'object') return value;
  if (stack.includes(value)) {
    const id = isPlainObject(value) && (typeof value.id === 'string' || typeof value.id === 'number') ? String(value.id) : path;
    return { $ref: id };
  }
  stack.push(value);
  let out;
  if (Array.isArray(value) || value instanceof Set) {
    out = [];
    [...value].forEach((item, i) => {
      const v = toPlain(item, `${path}[${i}]`, omitted, stack);
      out.push(v === undefined ? null : v);
    });
  } else {
    const entries = value instanceof Map ? [...value.entries()].map(([k, v]) => [String(k), v]) : Object.keys(value).map((k) => [k, value[k]]);
    out = {};
    for (const [k, v] of entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const pv = toPlain(v, `${path}.${k}`, omitted, stack);
      if (pv !== undefined) out[k] = pv;
    }
  }
  stack.pop();
  return out;
}

/** JSON text with keys in sorted order, except `Name` first in a row. */
export function stableStringify(value) {
  const order = (v, isRow) => {
    if (Array.isArray(v)) return v.map((x) => order(x, false));
    if (!isPlainObject(v)) return v;
    const keys = Object.keys(v).sort();
    const out = {};
    if (isRow && 'Name' in v) out.Name = v.Name;
    for (const k of keys) if (!(isRow && k === 'Name')) out[k] = order(v[k], false);
    return out;
  };
  const top = Array.isArray(value) ? value.map((row) => order(row, true)) : order(value, false);
  return `${JSON.stringify(top, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Shaping: decide whether a value is a table (rows), a container to split, or
// a config object.
// ---------------------------------------------------------------------------

const isRowArray = (v) => Array.isArray(v) && v.length > 0 && v.every(isPlainObject);

/** True when an object's values are records sharing most of their keys. */
function isRecordMap(obj) {
  const values = Object.values(obj);
  if (values.length < 3 || !values.every(isPlainObject)) return false;
  const freq = new Map();
  for (const v of values) for (const k of Object.keys(v)) freq.set(k, (freq.get(k) || 0) + 1);
  if (!freq.size) return false;
  const common = [...freq.values()].filter((n) => n >= values.length / 2).length;
  // Homogeneous records, or a long keyed list (nodeEffects: 173 entries that
  // mostly carry `triggers`, a few `passives`) whose rows share some field.
  return common / freq.size >= 0.5 || (values.length >= 8 && common >= 1);
}

// Every value an array (sfx: recipe → layers; eventChoiceIds: event → ids):
// one row per key with the array in `Value`.
const isArrayMap = (obj) => Object.keys(obj).length > 0 && Object.values(obj).every(Array.isArray);

function pickName(rows) {
  for (const field of NAME_FIELDS) {
    const names = rows.map((r) => r[field]);
    if (names.every((n) => (typeof n === 'string' && n !== '') || typeof n === 'number') && new Set(names.map(String)).size === names.length) {
      return names.map(String);
    }
  }
  return rows.map((_, i) => String(i));
}

/** Row objects from an array of records: `Name` added, a clashing `Name` field kept as `Name_`. */
function rowsFromArray(array) {
  if (!isRowArray(array)) return array.map((value, i) => ({ Name: String(i), Value: value }));
  const names = pickName(array);
  return array.map((row, i) => {
    const out = { Name: names[i] };
    for (const [k, v] of Object.entries(row)) out[k === 'Name' ? 'Name_' : k] = v;
    return out;
  });
}

function rowsFromMap(obj) {
  return Object.keys(obj).sort().map((key) => {
    const v = obj[key];
    if (!isPlainObject(v)) return { Name: key, Value: v };
    const out = { Name: key };
    for (const [k, x] of Object.entries(v)) out[k === 'Name' ? 'Name_' : k] = x;
    return out;
  });
}

/**
 * Classify `value` under `id` into the sink. Returns nothing; pushes
 * {kind:'table', id, rows} or {kind:'config', id, data}.
 */
function shape(id, value, sink, depth = 0) {
  if (Array.isArray(value)) { sink.push({ kind: 'table', id, rows: rowsFromArray(value) }); return; }
  if (!isPlainObject(value)) { sink.push({ kind: 'config', id, data: { value } }); return; }
  if (isRecordMap(value)) { sink.push({ kind: 'table', id, rows: rowsFromMap(value) }); return; }
  if (isArrayMap(value)) { sink.push({ kind: 'table', id, rows: rowsFromMap(value) }); return; }
  const tableish = Object.entries(value).filter(([, v]) => isRowArray(v) || (isPlainObject(v) && (isRecordMap(v) || Object.values(v).some(isRowArray))));
  if (tableish.length && depth < 3) {
    const rest = {};
    for (const [k, v] of Object.entries(value)) {
      if (isRowArray(v) || (isPlainObject(v) && (isRecordMap(v) || Object.values(v).some(isRowArray)))) shape(`${id}.${k}`, v, sink, depth + 1);
      else rest[k] = v;
    }
    if (Object.keys(rest).length) sink.push({ kind: 'config', id, data: rest });
    return;
  }
  sink.push({ kind: 'config', id, data: value });
}

// ---------------------------------------------------------------------------
// Sources.
// ---------------------------------------------------------------------------

// The CSV dialect of tools/content-build.mjs (kept in step with its
// splitCsvLine/coerce/parseCsv; that tool is the authority on content/source).
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else if (ch === '\\' && line[i + 1] === 'n') { cur += '\n'; i++; } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
function coerce(raw) {
  if (raw === '') return '';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.includes('|')) return raw.split('|').map((s) => coerce(s.trim()));
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d*\.\d+$/.test(raw)) return Number(raw);
  return raw;
}
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'));
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    header.forEach((h, i) => { row[h] = coerce(cells[i] ?? ''); });
    return row;
  });
}

const listDir = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)).sort() : []);

function walkJson(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Generated modules: current before they are read.
// ---------------------------------------------------------------------------

/** The builders whose output collect() imports. content-build last: it refuses a framework or config JSON whose generated mirror is not current yet. */
export const BUILDERS = ['tools/framework-data-build.mjs', 'tools/config-build.mjs', 'tools/content-build.mjs'];

/**
 * Run each builder under `root` (write mode, or `--check` when `build` is
 * false). Returns the ones that failed — when checking, the ones whose
 * generated output is stale — with their output; an empty list means current.
 */
export function staleGenerated({ root = ROOT, build = true, builders = BUILDERS } = {}) {
  const failed = [];
  for (const script of builders) {
    if (!existsSync(join(root, script))) continue;
    const r = spawnSync(process.execPath, [join(root, script), ...(build ? [] : ['--check'])], { cwd: root, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } });
    if (r.status !== 0) failed.push({ script, status: r.status, output: `${r.stdout || ''}${r.stderr || ''}${r.error ? r.error.message : ''}`.trim() });
  }
  return failed;
}

async function collect() {
  const raw = []; // [id, value]
  const { contentBundle } = await import('../src/content/index.js');
  for (const key of Object.keys(contentBundle).sort()) {
    if (key === 'version') continue;
    raw.push([`content.${key}`, contentBundle[key]]);
  }
  const sourceDir = join(ROOT, 'content', 'source');
  for (const file of listDir(sourceDir, /\.(csv|json)$/)) {
    const text = readFileSync(join(sourceDir, file), 'utf8');
    raw.push([`source.${basename(file, extname(file))}`, file.endsWith('.csv') ? parseCsv(text) : JSON.parse(text)]);
  }
  const frameworkDir = join(ROOT, 'content', 'framework');
  for (const file of listDir(frameworkDir, /\.json$/)) {
    raw.push([`framework.${basename(file, '.json')}`, JSON.parse(readFileSync(join(frameworkDir, file), 'utf8'))]);
  }
  const { uiConfig } = await import('../src/config/generated/ui.js');
  for (const section of Object.keys(uiConfig).sort()) {
    const v = uiConfig[section];
    if (section === 'tokens' || !isPlainObject(v)) raw.push([`ui.${section}`, v]);
    else for (const name of Object.keys(v).sort()) raw.push([`ui.${section}.${name}`, v[name]]);
  }
  return { raw, version: contentBundle.version };
}

// ---------------------------------------------------------------------------
// Schema inference (JSON Schema 2020-12).
// ---------------------------------------------------------------------------

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v);

export function inferSchema(values) {
  const types = new Set(values.map(typeOf));
  if (types.has('integer') && types.has('number')) types.delete('integer');
  const schema = {};
  const list = [...types].sort();
  if (list.length === 1) schema.type = list[0];
  else if (list.length > 1) schema.type = list;
  if (types.has('string')) {
    const strings = values.filter((v) => typeof v === 'string');
    const distinct = [...new Set(strings)].sort();
    if (values.length >= ENUM_MIN_ROWS && distinct.length <= ENUM_MAX && distinct.length < strings.length && list.length === 1) schema.enum = distinct;
  }
  if (types.has('object')) {
    const objs = values.filter(isPlainObject);
    const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))].sort();
    schema.properties = {};
    for (const k of keys) schema.properties[k] = inferSchema(objs.filter((o) => k in o).map((o) => o[k]));
    const required = keys.filter((k) => objs.every((o) => k in o));
    if (required.length) schema.required = required;
  }
  if (types.has('array')) {
    const items = values.filter(Array.isArray).flat();
    if (items.length) schema.items = inferSchema(items);
  }
  return schema;
}

function tableSchema(id, rows) {
  const items = rows.length ? inferSchema(rows) : { type: 'object' };
  items.properties = { ...(items.properties || {}), Name: { type: 'string' } };
  items.required = [...new Set(['Name', ...(items.required || [])])].sort();
  return { $schema: SCHEMA_DIALECT, $id: `ashenspire/${id}.schema.json`, title: id, type: 'array', items };
}

// ---------------------------------------------------------------------------
// Export.
// ---------------------------------------------------------------------------

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

function matchesOnly(id, only) {
  if (!only) return true;
  return only.some((o) => id === o || id.startsWith(`${o}.`));
}

/** Build the whole export in memory: Map<relativePath, text> plus a summary. */
export async function buildExport({ only = null } = {}) {
  const { raw, version } = await collect();
  const files = new Map();
  const tables = [];
  const configs = [];
  const omittedPaths = []; // dotted full paths, e.g. content.scripts.wondrousDraught
  for (const [id, value] of raw) {
    if (only && !only.some((o) => matchesOnly(id, [o]) || o.startsWith(`${id}.`))) continue;
    const omitted = [];
    const plain = toPlain(value, '$', omitted);
    omittedPaths.push(...omitted.map((p) => `${id}${p.slice(1)}`));
    const sink = [];
    shape(id, plain, sink);
    for (const item of sink) {
      if (!matchesOnly(item.id, only)) continue;
      if (item.kind === 'table') {
        const file = `tables/${item.id}.json`;
        const schemaFile = `schemas/${item.id}.schema.json`;
        const text = stableStringify(item.rows);
        files.set(file, text);
        files.set(schemaFile, stableStringify(tableSchema(item.id, item.rows)));
        tables.push({ id: item.id, file, schema: schemaFile, rows: item.rows.length, sha256: sha256(text), omittedFunctions: [] });
      } else {
        const file = `config/${item.id}.json`;
        const text = stableStringify(item.data);
        files.set(file, text);
        configs.push({ id: item.id, file, sha256: sha256(text), omittedFunctions: [] });
      }
    }
  }
  // Each dropped function is listed on the table or config file whose id is
  // the longest dot-boundary prefix of its path.
  for (const path of omittedPaths) {
    const owner = [...tables, ...configs]
      .filter((e) => path === e.id || path.startsWith(`${e.id}.`) || path.startsWith(`${e.id}[`))
      .sort((x, y) => y.id.length - x.id.length)[0];
    if (owner) owner.omittedFunctions.push(path);
  }

  // Art: the art manifest and every asset-data JSON, copied verbatim.
  const art = [];
  if (matchesOnly('art', only) || !only) {
    const artFiles = [];
    if (existsSync(join(ROOT, 'art-manifest.json'))) artFiles.push(['art-manifest.json', 'art/art-manifest.json']);
    for (const full of walkJson(join(ROOT, 'asset-data'))) {
      const rel = relative(ROOT, full).split(sep).join('/');
      artFiles.push([rel, `art/${rel}`]);
    }
    for (const [from, to] of artFiles) {
      const text = readFileSync(join(ROOT, from), 'utf8');
      files.set(to, text);
      art.push({ source: from, file: to, sha256: sha256(text) });
    }
  }

  let buildOrdinal = null;
  let release = null;
  try {
    const bo = JSON.parse(readFileSync(join(ROOT, 'buildordinal.json'), 'utf8'));
    buildOrdinal = bo.ordinal ?? null;
    release = bo.release ?? null;
  } catch { /* absent in a partial checkout */ }

  const manifest = {
    format: FORMAT,
    version,
    release,
    buildOrdinal,
    gitSha: gitSha(),
    rowKey: 'Name',
    tables: tables.sort((a, b) => (a.id < b.id ? -1 : 1)),
    config: configs.sort((a, b) => (a.id < b.id ? -1 : 1)),
    art,
  };
  files.set('manifest.json', stableStringify(manifest));
  const rows = tables.reduce((n, t) => n + t.rows, 0);
  return { files, manifest, summary: { tables: tables.length, rows, config: configs.length, art: art.length, files: files.size } };
}

export function writeExport(files, outDir) {
  if (existsSync(outDir)) {
    const entries = readdirSync(outDir);
    if (entries.length) {
      let ours = false;
      try { ours = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')).format === FORMAT; } catch { /* not ours */ }
      if (!ours) throw new Error(`${outDir} is not empty and holds no ${FORMAT} manifest; refusing to clear it`);
      rmSync(outDir, { recursive: true, force: true });
    }
  }
  for (const [rel, text] of [...files.entries()].sort()) {
    const full = join(outDir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out.sort();
}

/** Compare two export directories; returns a list of difference lines. */
export function compareDirs(expectedDir, actualDir) {
  if (!existsSync(actualDir) || !statSync(actualDir).isDirectory()) return [`${actualDir} is absent`];
  const want = listFiles(expectedDir);
  const have = new Set(listFiles(actualDir));
  const diffs = [];
  for (const rel of want) {
    if (!have.has(rel)) diffs.push(`missing  ${rel}`);
    else if (!readFileSync(join(expectedDir, rel)).equals(readFileSync(join(actualDir, rel)))) diffs.push(`changed  ${rel}`);
    have.delete(rel);
  }
  for (const rel of have) diffs.push(`extra    ${rel}`);
  return diffs;
}

function parseArgs(argv) {
  const opts = { out: join(ROOT, 'build', 'engine-export'), check: false, only: null, build: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = resolve(argv[++i] ?? '');
    else if (a === '--check') opts.check = true;
    else if (a === '--no-build') opts.build = false;
    else if (a === '--only') opts.only = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--help' || a === '-h') { opts.help = true; } else throw new Error(`unknown argument '${a}'`);
  }
  if (opts.only && !opts.only.length) throw new Error('--only needs a comma-separated list of table ids');
  return opts;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`engine-export: ${e.message}`);
    process.exit(2);
  }
  if (opts.help) {
    console.log('usage: node tools/engine-export.mjs [--out <dir>] [--check] [--only <table,...>] [--no-build]');
    return;
  }
  // Rebuilding the generated modules (any run without --no-build, --check too)
  // holds the shared lock; the builders it spawns run under it (tools/lib/build-lock.mjs).
  if (opts.build) await holdForCli(ROOT, 'engine-export');
  const started = Date.now();
  const failed = staleGenerated({ build: opts.build });
  if (failed.length) {
    const names = failed.map((f) => f.script).join(', ');
    console.error(opts.build
      ? `engine-export: FAIL — ${names} failed, so the generated modules may not match the authored files; fix it and run again`
      : `engine-export: FAIL — generated modules are stale; run ${failed.map((f) => `node ${f.script}`).join(' && ')} (or drop --no-build)`);
    for (const f of failed) console.error(`  ${f.script}:\n    ${f.output.split('\n').slice(-8).join('\n    ')}`);
    process.exit(1);
  }
  const { files, summary } = await buildExport({ only: opts.only });
  if (opts.only && summary.tables + summary.config + summary.art === 0) {
    console.error(`engine-export: --only ${opts.only.join(',')} matched nothing`);
    process.exit(2);
  }
  const relOut = relative(ROOT, opts.out);
  const rel = !relOut ? '.' : relOut.startsWith('..') ? opts.out : relOut;
  if (opts.check) {
    const tmp = mkdtempSync(join(tmpdir(), 'engine-export-'));
    try {
      writeExport(files, tmp);
      const diffs = compareDirs(tmp, opts.out);
      if (diffs.length) {
        console.error(`engine-export --check: FAIL — ${rel} differs from a fresh export in ${diffs.length} file(s); run node tools/engine-export.mjs${opts.out === join(ROOT, 'build', 'engine-export') ? '' : ` --out ${rel}`}`);
        for (const d of diffs.slice(0, 20)) console.error(`  ${d}`);
        if (diffs.length > 20) console.error(`  … and ${diffs.length - 20} more`);
        process.exit(1);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`engine-export --check: OK — ${rel} matches (${summary.tables} tables, ${summary.rows} rows, ${summary.config} config, ${summary.art} art files)`);
    return;
  }
  try {
    writeExport(files, opts.out);
  } catch (e) {
    console.error(`engine-export: ${e.message}`);
    process.exit(2);
  }
  console.log(`engine-export: OK — ${summary.tables} tables, ${summary.rows} rows, ${summary.config} config, ${summary.art} art files → ${rel} (${Date.now() - started} ms)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
