// workbench/core/files.mjs — the one safe file service every Workbench module uses.
//
// Reads, lists, diffs, saves and restores repo files the same way:
//   * an allowlist (allowedKind) decides which paths may be touched at all;
//   * every save validates the whole change set first (JSON, CSV, JS syntax,
//     duplicate ids, and the content/config compiler), then checks each file's
//     hash against the hash the page read (409 on a mismatch);
//   * the previous bytes go to workbench/.state/backups/<set>/ first, then each
//     file is written atomically (tmp + rename); any failure rolls every file
//     of the set back;
//   * a save that touches content/, src/ or styles/ holds the cross-process build
//     lock (tools/lib/build-lock.mjs) from validation through the last rename, so
//     no build reads a half-written or unvalidated tree.
// Restore is a save of the backed-up bytes through the same path.
//
// The allowlist and the editable/duplicate-id rules are reused from the Content
// Editor (editor/core.mjs `editable`, `validateText`, `hash`) and its CSV reader
// (editor/tables.mjs). The content/config compiler is tools/config-build.mjs
// compileEntries, the same one UI Studio uses. Path rules are workbench/lib/safe-path.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { refusedPath, safePath } from '../lib/safe-path.mjs';
import { editable, validateText, hash } from '../../editor/core.mjs';
import { tableData } from '../../editor/tables.mjs';
import { compileEntries, readConfigTree } from '../../tools/config-build.mjs';
import { acquire } from '../../tools/lib/build-lock.mjs';
import { LAYOUT_FILE, layoutProblems } from '../modules/layout/card-layers-model.mjs';

export const MAX_TEXT = 4 * 1024 * 1024;
export const MAX_CHANGES = 100;
const MAX_LIST = 5000;
const MAX_WALK = 20000;
const SET_ID = /^\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9]{6}$/;

// Workbench additions to the editor's rules (the editor's editable() is kept as is).
const JSON_TREE = /^(?:content\/config|pose-studio\/renewal|docs\/design)\/(?:[\w.-]+\/)*[\w.-]+\.json$/;
// One named file the game reads through tools/card-components.mjs (Layout Studio's Card layers mode).
const JSON_FILES = new Set([LAYOUT_FILE]);
const TEXT_TREE = /^(?:pose-studio\/stances|workbench\/workspace|ui-studio\/workspace)\/(?:[\w.-]+\/)*[\w.-]+$/;
const TEXT_EXT = /\.(json|csv|js|mjs|css|html|md|txt|svg)$/i;
// The trees a build reads: a save under any of them holds the build lock.
const BUILD_INPUT = /^(?:content|src|styles)\//;

const fail = (status, message, extra = {}) => Object.assign(Error(message), { status, ...extra });

function kindOf(rel) {
  if (/\.json$/i.test(rel)) return 'json';
  if (/\.csv$/i.test(rel)) return 'csv';
  if (/\.m?js$/i.test(rel)) return 'js';
  if (/\.css$/i.test(rel)) return 'css';
  return 'text';
}

/** The kind of an allowlisted path ('json' | 'csv' | 'js' | 'css' | 'text'), or null when it may not be touched. */
export function allowedKind(rel) {
  if (typeof rel !== 'string' || refusedPath(rel)) return null;
  if (!(editable(rel) || JSON_TREE.test(rel) || JSON_FILES.has(rel) || (TEXT_TREE.test(rel) && TEXT_EXT.test(rel)))) return null;
  return kindOf(rel);
}

// ---------------------------------------------------------------------------
// Line diff: common prefix/suffix trimmed, then Myers' O(ND) on the middle.
// Past MAX_EDITS the middle is shown as one replacement (documented fallback).
const MAX_EDITS = 2000;
const splitLines = (text) => (text === '' ? [] : (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n'));

function myers(a, b) {
  const n = a.length, m = b.length, max = n + m;
  if (max === 0) return [];
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = [];
  for (let d = 0; d <= Math.min(max, MAX_EDITS); d++) {
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) return backtrack(trace, a, b, n, m);
    }
  }
  return null;
}

function backtrack(trace, a, b, n, m) {
  const out = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const s = trace[d];
    const get = (k) => s[k + d + 1]; // s holds k in [-d-1, d+1]
    const k = x - y;
    const prevK = (k === -d || (k !== d && get(k - 1) < get(k + 1))) ? k + 1 : k - 1;
    const prevX = get(prevK), prevY = prevX - prevK;
    while (x > prevX && y > prevY) { out.push({ op: ' ', text: a[x - 1] }); x--; y--; }
    if (d > 0) {
      if (x === prevX) out.push({ op: '+', text: b[prevY] }); else out.push({ op: '-', text: a[prevX] });
    }
    x = prevX; y = prevY;
  }
  return out.reverse();
}

/** Line diff of two texts as unified-style hunks with `context` lines around each change. */
export function lineDiff(oldText, newText, { context = 3 } = {}) {
  const a = splitLines(oldText), b = splitLines(newText);
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const midA = a.slice(pre, a.length - suf), midB = b.slice(pre, b.length - suf);
  let middle = myers(midA, midB);
  if (!middle) middle = [...midA.map((text) => ({ op: '-', text })), ...midB.map((text) => ({ op: '+', text }))];
  const script = [
    ...a.slice(0, pre).map((text) => ({ op: ' ', text })),
    ...middle,
    ...a.slice(a.length - suf).map((text) => ({ op: ' ', text })),
  ];
  // Position of each entry: lines of old and new consumed before it.
  let o = 0, nn = 0;
  const ops = script.map((e) => {
    const at = { ...e, o, n: nn };
    if (e.op !== '+') o++;
    if (e.op !== '-') nn++;
    return at;
  });
  const changed = ops.map((e, i) => (e.op !== ' ' ? i : -1)).filter((i) => i >= 0);
  const hunks = [];
  let i = 0;
  while (i < changed.length) {
    let last = changed[i];
    let j = i;
    while (j + 1 < changed.length && changed[j + 1] - last <= 2 * context) { j++; last = changed[j]; }
    const start = Math.max(0, changed[i] - context), end = Math.min(ops.length - 1, last + context);
    const lines = ops.slice(start, end + 1);
    const oldLines = lines.filter((e) => e.op !== '+').length;
    const newLines = lines.filter((e) => e.op !== '-').length;
    hunks.push({
      oldStart: oldLines ? lines[0].o + 1 : lines[0].o,
      oldLines,
      newStart: newLines ? lines[0].n + 1 : lines[0].n,
      newLines,
      lines: lines.map(({ op, text }) => ({ op, text })),
    });
    i = j + 1;
  }
  return {
    hunks,
    added: script.filter((e) => e.op === '+').length,
    removed: script.filter((e) => e.op === '-').length,
  };
}

// ---------------------------------------------------------------------------

async function readOrNull(abs) {
  try { return await fs.readFile(abs); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

/** `node --check` on the text as an ES module, from a temp copy outside the project. */
async function checkJs(rel, text) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-check-'));
  try {
    const file = path.join(dir, 'check.mjs');
    await fs.writeFile(file, text);
    await new Promise((resolve, reject) => {
      execFile(process.execPath, ['--check', file], { timeout: 20000 }, (error, _out, stderr) => {
        if (!error) return resolve();
        const detail = String(stderr || error.message).split(file).join(rel).split(dir).join('').trim();
        reject(Error(`JavaScript does not parse: ${detail.split('\n').slice(0, 6).join('\n')}`));
      });
    });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

/**
 * createFileService({ root, stateDir, keepBackups, onSaved, lockWaitMs, fileFault })
 * root must be a realpath. stateDir receives backups/. onSaved(paths) runs after
 * a successful save or restore (the server sends the live-reload batch).
 * onWritten(abs, stat) runs after each file is renamed into place (saves and rollbacks),
 * with the stat the file was left with: the server uses it to drop the watcher's echo.
 * fileFault(rel) is a test seam: it may await or throw before a file is renamed into place.
 * pruneFault() is a test seam: it may throw where old backup sets are pruned.
 */
export function createFileService({ root, stateDir, keepBackups = () => 50, onSaved = () => {}, onWritten = () => {}, lockWaitMs = 10 * 60 * 1000, fileFault = null, pruneFault = null, signal = undefined }) {
  let tail = Promise.resolve();
  const serialize = (task) => { const run = tail.then(task, task); tail = run.catch(() => {}); return run; };
  const backupsDir = path.join(stateDir, 'backups');

  async function absFor(rel, creating = false) {
    return safePath(root, rel, { creating });
  }

  function requireKind(rel) {
    const kind = allowedKind(rel);
    if (!kind) throw fail(403, `${String(rel)} is not an editable file in the Workbench`);
    return kind;
  }

  async function read(rel) {
    const kind = requireKind(rel);
    const buf = await readOrNull(await absFor(rel));
    if (buf === null) throw fail(404, `Not found: ${rel}`, { code: 'ENOENT' });
    return { path: rel, text: buf.toString('utf8'), hash: hash(buf), kind };
  }

  async function list(dir = '', exts = '') {
    const rel = String(dir || '').replace(/\/+$/, '');
    if (rel && refusedPath(rel)) throw fail(403, 'Refused path');
    const wanted = exts ? new Set(String(exts).split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).map((e) => (e.startsWith('.') ? e : `.${e}`))) : null;
    let start;
    try { start = rel ? await absFor(rel) : root; } catch { return { dir: rel, files: [], truncated: false }; }
    const out = [];
    let seen = 0, truncated = false;
    async function visit(relDir, absDir) {
      const entries = await fs.readdir(absDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries.sort((x, y) => (x.name < y.name ? -1 : 1))) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
        if (++seen > MAX_WALK) { truncated = true; return; }
        const child = relDir ? `${relDir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await visit(child, path.join(absDir, entry.name));
        else if (allowedKind(child) && (!wanted || wanted.has(path.extname(child).toLowerCase()))) {
          if (out.length >= MAX_LIST) { truncated = true; return; }
          out.push(child);
        }
      }
    }
    await visit(rel, start);
    return { dir: rel, files: out, truncated };
  }

  async function diff(rel, text) {
    requireKind(rel);
    if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_TEXT) throw fail(400, `${rel}: text must be a string under 4 MB`);
    const buf = await readOrNull(await absFor(rel, true));
    const result = lineDiff(buf === null ? '' : buf.toString('utf8'), text);
    return { path: rel, exists: buf !== null, ...result };
  }

  /** Problems with a change set: [{ path, message }]. Config files compile as one tree, as UI Studio does. */
  async function validate(changes) {
    const problems = [];
    for (const c of changes) {
      try {
        if (c.kind === 'json') {
          let parsed;
          try { parsed = JSON.parse(c.text); } catch (e) { throw Error(`Invalid JSON: ${e.message}`); }
          validateText(c.path, c.text);
          // The card layout is a schema the game compiler reads: each problem is listed on its own.
          if (c.path === LAYOUT_FILE) for (const message of layoutProblems(parsed)) problems.push({ path: c.path, message });
        } else if (c.kind === 'csv') {
          tableData(c.path, c.text);
          validateText(c.path, c.text);
        } else if (c.kind === 'js') {
          await checkJs(c.path, c.text);
        }
      } catch (e) { problems.push({ path: c.path, message: e.message }); }
    }
    const configChanges = changes.filter((c) => c.path.startsWith('content/config/') && c.kind === 'json');
    if (configChanges.length) {
      const tree = readConfigTree(path.join(root, 'content'));
      for (const c of configChanges) {
        const rel = c.path.slice('content/config/'.length);
        const i = tree.findIndex((e) => e.rel === rel);
        if (i < 0) tree.push({ rel, text: c.text }); else tree[i] = { rel, text: c.text };
      }
      let errors = [];
      try { errors = compileEntries(tree).errors; } catch (e) { errors = [e.message]; }
      for (const message of errors) {
        const owner = configChanges.find((c) => message.startsWith(`content/config/${c.path.slice('content/config/'.length)}`));
        problems.push({ path: owner ? owner.path : 'content/config', message });
      }
    }
    return problems;
  }

  const backupId = () => `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;

  async function writeAtomic(abs, bytes, rel) {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const temp = `${abs}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp, bytes, { flag: 'wx' });
      if (fileFault) await fileFault(rel);
      // The temp file is the same inode after the rename, so its stat is abs's stat.
      const stat = await fs.stat(temp);
      await fs.rename(temp, abs);
      onWritten(abs, stat);
    } finally { await fs.rm(temp, { force: true }); }
  }

  async function rollback(written) {
    for (const f of [...written].reverse()) {
      try {
        const now = await readOrNull(f.abs);
        // Never undo another writer's change: only put back what this save wrote.
        if (now !== null && hash(now) !== hash(f.bytes)) continue;
        if (f.old === null) await fs.rm(f.abs, { force: true });
        else await writeAtomic(f.abs, f.old, f.path);
      } catch { /* best effort: the save's own error is what the caller sees */ }
    }
  }

  async function prune(keep) {
    if (pruneFault) pruneFault();
    const ids = (await fs.readdir(backupsDir).catch(() => [])).filter((id) => SET_ID.test(id)).sort();
    for (const id of ids.slice(0, Math.max(0, ids.length - keep))) await fs.rm(path.join(backupsDir, id), { recursive: true, force: true });
  }

  /** Validate, check hashes, back up, write, roll back on failure. Must run inside serialize(). */
  async function commitLocked(input, { resolveBase = false } = {}) {
    if (!Array.isArray(input) || !input.length || input.length > MAX_CHANGES) throw fail(400, `Choose 1–${MAX_CHANGES} files to save`);
    const seen = new Set();
    const changes = [];
    for (const c of input) {
      if (!c || typeof c !== 'object') throw fail(400, 'Each change needs a path and text');
      const kind = requireKind(c.path);
      if (seen.has(c.path)) throw fail(400, `Duplicate file in save: ${c.path}`);
      seen.add(c.path);
      if (typeof c.text !== 'string' || Buffer.byteLength(c.text) > MAX_TEXT) throw fail(400, `${c.path}: text must be a string under 4 MB`);
      if (!resolveBase && c.baseHash !== null && typeof c.baseHash !== 'string') throw fail(400, `${c.path}: baseHash is required (the hash the page read, or null for a new file)`);
      changes.push({ path: c.path, kind, text: c.text, baseHash: c.baseHash });
    }
    // A change under a build's input tree holds the build lock, and validation (which reads the
    // config tree) runs under it, so no build reads the tree while it is being checked or written.
    // An aborted signal (the Workbench is closing) ends the wait: the save answers 503 and writes nothing.
    let release = null;
    if (changes.some((c) => BUILD_INPUT.test(c.path))) {
      try { release = await acquire(root, 'Workbench file save', { timeoutMs: lockWaitMs, signal }); } catch (error) {
        if (signal?.aborted) throw fail(503, 'The Workbench is closing');
        throw error;
      }
    }
    try {
      const problems = await validate(changes);
      if (problems.length) throw fail(422, 'Nothing saved: some files do not validate', { problems });
      const prepared = [];
      const conflicts = [];
      for (const c of changes) {
        const abs = await absFor(c.path, true);
        const old = await readOrNull(abs);
        const current = old === null ? null : hash(old);
        if (resolveBase) c.baseHash = current;
        if (current !== c.baseHash) conflicts.push({ path: c.path, hash: current });
        prepared.push({ path: c.path, abs, old, bytes: Buffer.from(c.text), baseHash: c.baseHash });
      }
      if (conflicts.length) throw fail(409, 'Changed on disk since it was opened. Reload before saving.', { conflicts });

      const id = backupId();
      const dir = path.join(backupsDir, id);
      try {
        await fs.mkdir(dir, { recursive: true });
        const files = [];
        for (const [i, f] of prepared.entries()) {
          if (f.old !== null) await fs.writeFile(path.join(dir, `${i}.bak`), f.old);
          files.push({ index: i, path: f.path, oldHash: f.old === null ? null : hash(f.old), savedHash: hash(f.bytes) });
        }
        await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), files }, null, 2));

        const written = [];
        try {
          for (const f of prepared) {
            const now = await readOrNull(f.abs);
            if ((now === null ? null : hash(now)) !== f.baseHash) throw fail(409, `${f.path} changed while saving`, { conflicts: [{ path: f.path, hash: now === null ? null : hash(now) }] });
            await writeAtomic(f.abs, f.bytes, f.path);
            written.push(f);
          }
        } catch (error) {
          await rollback(written);
          if (!error.status) error = fail(500, `Save rolled back: ${error.message}`);
          throw error;
        }
      } catch (error) {
        // A save that did not land leaves no backup set behind: backups() lists only saves that happened.
        await fs.rm(dir, { recursive: true, force: true });
        throw error;
      }
      const keep = Number.isInteger(keepBackups()) && keepBackups() >= 1 ? keepBackups() : 50;
      // The save has landed: pruning old backup sets is housekeeping, so a failure there is logged, not reported as a failed save.
      try { await prune(keep); } catch (error) { console.warn(`Workbench: could not prune old backups: ${error.message}`); }
      return { backup: id, files: prepared.map((f) => ({ path: f.path, hash: hash(f.bytes) })) };
    } finally { if (release) release(); }
  }

  async function save(changes) {
    const result = await serialize(() => commitLocked(changes));
    onSaved(result.files.map((f) => f.path));
    return result;
  }

  async function backups() {
    const ids = (await fs.readdir(backupsDir).catch(() => [])).filter((id) => SET_ID.test(id)).sort().reverse().slice(0, 50);
    return {
      backups: await Promise.all(ids.map(async (id) => {
        const manifest = JSON.parse(await fs.readFile(path.join(backupsDir, id, 'manifest.json'), 'utf8'));
        return { id, at: manifest.at, files: manifest.files.map(({ path: p, oldHash, savedHash }) => ({ path: p, oldHash, savedHash })) };
      })),
    };
  }

  async function restore(set, paths) {
    if (typeof set !== 'string' || !SET_ID.test(set)) throw fail(400, 'Invalid backup id');
    const dir = path.join(backupsDir, set);
    let manifest;
    try { manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8')); } catch { throw fail(404, 'Backup not found'); }
    const want = Array.isArray(paths) ? new Set(paths) : null;
    const skipped = [];
    const changes = [];
    for (const e of manifest.files) {
      if (want && !want.has(e.path)) continue;
      if (e.oldHash === null) { skipped.push({ path: e.path, reason: 'created by that save; there is no earlier version' }); continue; }
      if (!allowedKind(e.path)) { skipped.push({ path: e.path, reason: 'no longer editable' }); continue; }
      changes.push({ path: e.path, text: (await fs.readFile(path.join(dir, `${e.index}.bak`))).toString('utf8') });
    }
    if (want) for (const p of want) if (!manifest.files.some((e) => e.path === p)) skipped.push({ path: p, reason: 'not in that backup' });
    if (!changes.length) throw fail(400, 'Nothing to restore from that backup');
    // The base hash is taken from disk under the queue, so a restore never conflicts with a read it did not make.
    const result = await serialize(() => commitLocked(changes, { resolveBase: true }));
    onSaved(result.files.map((f) => f.path));
    return { ...result, restored: changes.map((c) => c.path), skipped };
  }

  return { read, list, diff, save, backups, restore, validate };
}
