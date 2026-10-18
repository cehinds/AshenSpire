// tools/size-budget.mjs — measured byte counts of the build against budgets, so a
// size PR can show before/after numbers.
//
//   node tools/size-budget.mjs [--build] [--json] [--budget]
//
// --build   run `node tools/launch.mjs --build-only` first (it refreshes build/
//           and dist/); without it the folders are read as they are.
// --json    print one JSON document on stdout instead of the SIZE lines.
// --budget  exit 1 when a GATED row exceeds its budget by more than 25%
//           (a gated row whose file is missing counts as a failure). The default
//           run exits 0.
//
// Prints one line per item: `SIZE <item> bytes=<n> budget=<n> gate=yes|no`.
//
//   build/AshenSpire.html            budget 4,000,000   gate=no   INFORMATIONAL.
//        The target is that the code on the critical path is about 4 MB; the
//        build is not there yet, so the row is a number to watch, not a gate.
//   dist/download/AshenSpire.html    budget 60,000,000  gate=yes  the single file.
//   dist/ (every file, summed)       budget 150,000,000 gate=yes
//   build/packs/light-*.json         budget 1,000,000   gate=no   (one row each)
//   the ten largest data URIs in the single file, by decoded size: `SIZE
//        datauri.<rank> bytes=<decoded> budget=- gate=no mime=<type> key=<key>`;
//        `key` is the `"key":` the URI sits behind when one can be recovered,
//        else `idx<n>` (its position among all the data URIs in the file).
//        The single file read is dist/download/AshenSpire.html, falling back to
//        build/download/AshenSpire.html, then build/AshenSpire.html.
//
// WHERE THE NUMBERS COME FROM. The owner's targets come from the performance
// review of origin/dev a0b54c60e: the single file should be at most 60 MB, and
// 50 MB is preferred (the budget row is the ceiling, 50 MB is the aim). The gate
// is the budget plus 25%, so it trips on a real regression, not on a few kB.
//
// Needs only node. It changes nothing.

import { existsSync, readdirSync, lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

export const SLACK = 0.25;
export const TOP_URIS = 10;

/** The fixed rows: item label, path under the repo, how to size it, budget, gate. */
export const ROWS = [
  { item: 'build/AshenSpire.html', path: 'build/AshenSpire.html', budget: 4_000_000, gate: false },
  { item: 'dist/download/AshenSpire.html', path: 'dist/download/AshenSpire.html', budget: 60_000_000, gate: true },
  { item: 'dist/', path: 'dist', budget: 150_000_000, gate: true, tree: true },
];
export const LIGHT_PACK_BUDGET = 1_000_000;

/** A row is over when bytes > budget * 1.25. A gated row with no bytes is `missing` and fails. */
export function evaluateRow(row, slack = SLACK) {
  if (row.bytes == null) return { ...row, status: row.gate ? 'missing' : 'absent' };
  if (row.budget == null) return { ...row, status: 'info' };
  return { ...row, status: row.bytes > row.budget * (1 + slack) ? 'over' : 'ok' };
}

/** Exit 1 only on a gated row that is over or missing. */
export function budgetFailed(rows, slack = SLACK) {
  return rows.some((r) => r.gate && ['over', 'missing'].includes(evaluateRow(r, slack).status));
}

/** Decoded byte size of a base64 run of `chars` characters, '=' padding not counted. */
export const decodedSize = (chars) => Math.floor((chars * 3) / 4);

const HEADER = /data:([a-z0-9][a-z0-9.+\/-]*)((?:;[a-z0-9._+=-]+)*);base64,/gi;
const BODY = /[A-Za-z0-9+\/]*(={0,2})/y;
const KEY_BEHIND = /"([^"\\\n]{1,120})"\s*:\s*\[?\s*["'`]?$/;

/**
 * Every `data:<mime>;base64,<run>` in a string: [{ index, mime, bytes, key }]
 * (`index` is the offset of the `data:`; `bytes` the decoded size; `key` the
 * `"key":` just before it, else null). Order is file order.
 */
export function findDataUris(text) {
  const out = [];
  HEADER.lastIndex = 0;
  let m;
  while ((m = HEADER.exec(text))) {
    BODY.lastIndex = HEADER.lastIndex;
    const b = BODY.exec(text);
    const run = b ? b[0].length - b[1].length : 0;
    const look = text.slice(Math.max(0, m.index - 200), m.index);
    const k = KEY_BEHIND.exec(look);
    if (run > 0) out.push({ index: m.index, mime: m[1].toLowerCase(), bytes: decodedSize(run), key: k ? k[1] : null }); // an empty run is prose, not a URI
    if (b && BODY.lastIndex > HEADER.lastIndex) HEADER.lastIndex = BODY.lastIndex;
  }
  return out;
}

/** The n largest by decoded size, labelled by key or by position in the file. */
export function topDataUris(uris, n = TOP_URIS) {
  return uris
    .map((u, pos) => ({ ...u, label: u.key || `idx${pos}` }))
    .sort((a, b) => b.bytes - a.bytes || a.index - b.index)
    .slice(0, n);
}

function treeBytes(dir) {
  let sum = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isDirectory()) sum += treeBytes(p);
    else if (st.isFile()) sum += st.size;
  }
  return sum;
}

const sizeOf = (p, tree) => {
  if (!existsSync(p)) return null;
  return tree ? treeBytes(p) : lstatSync(p).size;
};

/** Read the folders and return the evaluated rows plus the data-URI rows. */
export function collect(root = ROOT) {
  const rows = ROWS.map((r) => ({ item: r.item, bytes: sizeOf(join(root, r.path), r.tree), budget: r.budget, gate: r.gate }));
  const packs = join(root, 'build', 'packs');
  if (existsSync(packs)) {
    for (const name of readdirSync(packs).filter((n) => /^light-.*\.json$/.test(n)).sort()) {
      rows.push({ item: `build/packs/${name}`, bytes: sizeOf(join(packs, name)), budget: LIGHT_PACK_BUDGET, gate: false });
    }
  } else {
    rows.push({ item: 'build/packs/light-*.json', bytes: null, budget: LIGHT_PACK_BUDGET, gate: false });
  }
  const single = ['dist/download/AshenSpire.html', 'build/download/AshenSpire.html', 'build/AshenSpire.html']
    .map((p) => join(root, p)).find((p) => existsSync(p));
  const uris = single
    ? topDataUris(findDataUris(readFileSync(single, 'utf8'))).map((u, i) => ({ item: `datauri.${i + 1}`, bytes: u.bytes, budget: null, gate: false, mime: u.mime, key: u.label }))
    : [];
  return { rows: rows.concat(uris).map((r) => evaluateRow(r)), single: single ? single.slice(root.length + 1) : null };
}

export function formatRow(r) {
  const base = `SIZE ${r.item} bytes=${r.bytes ?? 'missing'} budget=${r.budget ?? '-'} gate=${r.gate ? 'yes' : 'no'}`;
  return r.mime ? `${base} mime=${r.mime} key=${r.key}` : base;
}

export function parseArgs(argv) {
  const out = { build: false, json: false, budget: false };
  for (const a of argv) {
    if (a === '--build') out.build = true;
    else if (a === '--json') out.json = true;
    else if (a === '--budget') out.budget = true;
    else throw new Error(`size-budget: unknown argument ${a}`);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (opts.build) {
    const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'launch.mjs'), '--build-only'], { cwd: ROOT, stdio: opts.json ? ['ignore', 2, 2] : 'inherit' });
    if (r.status !== 0) { console.error('size-budget: the build failed'); process.exit(2); }
  }
  const { rows, single } = collect();
  const failed = budgetFailed(rows);
  if (opts.json) console.log(JSON.stringify({ singleFile: single, rows, failed: opts.budget ? failed : undefined }, null, 2));
  else {
    for (const r of rows) console.log(formatRow(r));
    if (opts.budget) console.log(failed ? 'BUDGET FAILED: a gated row is over budget by more than 25% (or missing).' : 'BUDGET OK: no gated row is over budget by more than 25%.');
  }
  process.exit(opts.budget && failed ? 1 : 0);
}
