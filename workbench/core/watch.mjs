// workbench/core/watch.mjs — notice source edits and batch them.
//
// On Linux, one non-recursive fs.watch per folder, so a rename-into-place does not
// silence later edits; folders that appear get watches, and folders that are removed
// or renamed away have theirs closed. On Windows and macOS, one fs.watch with
// { recursive: true } (a per-folder handle on Windows would block renaming the parent).
// A 1 s mtime poll where a watch throws. Changes are collected
// into one batch per quiet period (`debounceMs`) and handed to `onBatch` as
// project-relative paths. `mute()` drops events under the builds' generated
// output (BUILD_OUTPUTS) while a build runs and for a short grace after, so a
// rebuild never triggers itself; any other edit made meanwhile is kept and
// lands in the next batch.
import fs from 'node:fs';
import path from 'node:path';

/**
 * How a platform watches a source folder: 'folders' is one non-recursive watch per
 * folder (Linux, where a recursive watch goes silent after a rename-into-place);
 * 'recursive' is one { recursive: true } watch for the whole tree (win32, darwin,
 * and any other platform, as before the per-folder change).
 */
export function watchModeFor(platform = process.platform) {
  return platform === 'linux' ? 'folders' : 'recursive';
}

const IGNORED = (rel) => rel.split('/').some((p) => p.startsWith('.') || p === 'node_modules') || /(~|\.swp|\.swx|\.tmp|\.crdownload)$/.test(rel);

function walk(dir, out = new Map()) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (e.isFile()) { try { out.set(abs, fs.statSync(abs).mtimeMs); } catch { /* raced a delete */ } }
  }
  return out;
}

/**
 * What each build step in buildsFor() writes (content-build's OUT and its
 * framework views, framework-data-build's outDir, config-build's GENERATED).
 * Only these paths are ignored while a build runs.
 */
export const BUILD_OUTPUTS = {
  'tools/content-build.mjs': ['src/content/generated/', 'src/framework/data/'],
  'tools/framework-data-build.mjs': ['src/framework/data/'],
  'tools/config-build.mjs': ['src/config/generated/'],
  'tools/card-components.mjs': ['src/content/cardComponents.generated.js'],
};
export const isBuildOutput = (rel) => Object.values(BUILD_OUTPUTS).some((dirs) => dirs.some((d) => rel.startsWith(d) || `${rel}/` === d));

/**
 * The files the Workbench itself has just written, each with the size and mtime
 * it left them with. isOwn(abs) is true while the file still matches that stat,
 * so the watcher can drop the echo of a save. An edit made after the save has a
 * newer mtime (or a new size), so it is still a change and reloads.
 */
export function createOwnWrites() {
  const written = new Map();
  return {
    record(abs, stat) { written.set(path.resolve(abs), { size: stat.size, mtimeMs: stat.mtimeMs }); },
    isOwn(abs) {
      const w = written.get(path.resolve(abs));
      if (!w) return false;
      let now;
      try { now = fs.statSync(abs); } catch { return false; }
      return now.size === w.size && now.mtimeMs <= w.mtimeMs;
    },
  };
}

/** The platforms whose recursive watch also reports folders: a save inside a folder reports the folder too. */
const FOLDER_EVENTS = new Set(['darwin', 'win32']);

/**
 * The paths a recursive watch event names. macOS (FSEvents) and Windows also report folders,
 * and reports an event on the watched folder itself under that folder's own name
 * (content/content, macOS only). The self-named event names nothing. A folder that
 * was already there (`isNewFolder` false) names nothing either: its files are
 * reported one by one, and a save inside it also reports the folder. A folder new
 * since the watch began names the files under it, since a folder moved in is
 * reported only as the folder (the batch is a Set, so a file reported twice counts
 * once). Elsewhere the event's path is kept as it is.
 */
export function recursiveEventPaths(abs, name, platform = process.platform, { exists = fs.existsSync, isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } }, isNewFolder = () => true, filesUnder = (p) => [...walk(p).keys()], since = 0, presentAtStart = () => false, changedAt = (p) => { try { const st = fs.statSync(p); return Math.max(st.mtimeMs, st.ctimeMs); } catch { return null; } } } = {}) {
  if (!name) return [];
  const base = String(name);
  const target = path.join(abs, base);
  if (!FOLDER_EVENTS.has(platform)) return [target];
  // An ignored folder (hidden, node_modules) names nothing: note() would drop its files anyway,
  // and a large one moved in must not be walked.
  if (base.split(/[\\/]/).some((p) => p.startsWith('.') || p === 'node_modules')) return [];
  if (platform === 'darwin' && base === path.basename(abs) && !exists(target)) return []; // the watched folder itself
  if (!isDir(target)) {
    // FSEvents also replays events from just before the watch began: a file that was at this
    // path when the watch began (same inode) and is untouched since (both its modification and
    // its change time older) is a replay. A file moved in keeps its old times but was not there,
    // so it is kept; so is a gone file.
    const at = platform === 'darwin' && presentAtStart(target) ? changedAt(target) : null;
    return at !== null && at < since ? [] : [target];
  }
  return isNewFolder(target) ? filesUnder(target) : [];
}

/**
 * Every folder under abs (abs included) into `out`, as path -> inode, skipping hidden
 * ones and node_modules. The inode tells a folder replaced at the same path (deleted,
 * then another moved in) from the one that was there.
 */
function foldersUnder(abs, out = new Map()) {
  let st;
  try { st = fs.statSync(abs); } catch { return out; }
  out.set(abs, st.ino);
  let entries = [];
  try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') foldersUnder(path.join(abs, e.name), out);
  return out;
}

/**
 * isOwnWrite(abs) says a file's events are the echo of a save the Workbench made
 * (see createOwnWrites); those events are dropped when the batch is flushed.
 */
export function createWatcher({ root, dirs, debounceMs = 250, onBatch, forcePoll = false, platform = process.platform, isOutput = isBuildOutput, isOwnWrite = () => false }) {
  const pending = new Set();
  const watchers = []; const polls = [];
  let timer = null; let mutedUntil = 0; let muted = false; let closed = false;
  const rel = (abs) => path.relative(root, abs).split(path.sep).join('/');

  function note(abs) {
    if (closed) return;
    const r = rel(abs);
    if (!r || r.startsWith('..') || IGNORED(r)) return;
    if ((muted || Date.now() < mutedUntil) && isOutput(r)) return;
    pending.add(r);
    clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }
  function flush() {
    if (!pending.size || closed) return;
    const files = [...pending].sort(); pending.clear();
    // A file the Workbench just wrote is already in the batch its save sent: drop its echo here.
    const external = files.filter((r) => !isOwnWrite(path.join(root, r)));
    if (external.length) onBatch(external);
  }

  // One interval scans every polled folder in the same tick, so files written
  // together land in one batch rather than splitting across folders' ticks.
  const polled = new Map();
  function poll(dir) {
    polled.set(dir, walk(dir));
    if (polls.length) return;
    const t = setInterval(() => {
      for (const [d, known] of polled) {
        const now = walk(d);
        for (const [f, m] of now) if (known.get(f) !== m) note(f);
        for (const f of known.keys()) if (!now.has(f)) note(f);
        polled.set(d, now);
      }
    }, 1000);
    t.unref?.();
    polls.push(t);
  }

  // One non-recursive fs.watch per folder, not one recursive watch: on Linux a
  // recursive watch goes silent for a file once a write has renamed it into place,
  // and every Workbench save is such a write, so a later edit would never reload.
  const watchedDirs = new Map(); // folder -> its fs watcher
  // folder -> the files directly in it when last seen, so a removal can report them.
  const folderFiles = new Map();
  const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
  function snapshotFolder(abs) {
    let names = [];
    try { names = fs.readdirSync(abs, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.join(abs, e.name)); } catch { /* gone */ }
    folderFiles.set(abs, new Set(names));
  }
  // Closes the watch on abs and on every folder below it: they went away or were renamed.
  function unwatchTree(abs) {
    for (const [dir, w] of [...watchedDirs]) {
      if (dir !== abs && !dir.startsWith(abs + path.sep)) continue;
      watchedDirs.delete(dir);
      try { w.close(); } catch { /* closed */ }
    }
  }
  // abs (and every folder below it) went away or was renamed: report the files they held and
  // the folder itself, then close their watches. Each folder's files come from its last snapshot.
  function forgetTree(abs) {
    for (const [dir, files] of [...folderFiles]) {
      if (dir !== abs && !dir.startsWith(abs + path.sep)) continue;
      folderFiles.delete(dir);
      for (const f of files) note(f);
    }
    note(abs);
    unwatchTree(abs);
  }
  function watchFolder(abs) {
    if (watchedDirs.has(abs)) return true;
    let w;
    try {
      w = fs.watch(abs, (_event, name) => {
        if (!isDir(abs)) { forgetTree(abs); return; } // removed or renamed away: its watch is stale
        if (!name) return;
        const base = String(name);
        const child = path.join(abs, base);
        if (!isDir(child)) {
          // A watched folder that went away reported its own files as they were removed.
          if (watchedDirs.has(child)) { forgetTree(child); return; }
          const files = folderFiles.get(abs);
          if (files) { if (fs.existsSync(child)) files.add(child); else files.delete(child); }
          note(child); return;
        }
        // A folder that appeared while watching: its files are new, and it gets watches of its own.
        if (base.startsWith('.') || base === 'node_modules') return;
        if (watchedDirs.has(child)) forgetTree(child); // a watch left under this name by a folder renamed away
        for (const f of walk(child).keys()) note(f);
        if (!watchTree(child)) poll(child);
      });
    } catch { return false; }
    watchedDirs.set(abs, w);
    snapshotFolder(abs);
    w.on('error', () => { try { w.close(); } catch { /* closed */ } if (watchedDirs.get(abs) === w) watchedDirs.delete(abs); folderFiles.delete(abs); poll(abs); });
    return true;
  }
  // A folder and, below it, every folder: each gets its own watch, or a poll where a watch throws.
  function watchTree(abs) {
    if (!watchFolder(abs)) return false;
    watchSubfolders(abs);
    return true;
  }
  function watchSubfolders(abs) {
    let entries = [];
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; /* removed while walking */ }
    for (const e of entries.filter((x) => x.isDirectory())) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const sub = path.join(abs, e.name);
      if (!watchTree(sub)) poll(sub);
    }
  }

  // One { recursive: true } watch per source folder where the platform has one.
  // The folders there when the watch began, and those seen since, with their inodes:
  // on macOS only a folder not among them is walked for its files (see recursiveEventPaths).
  const knownFolders = new Map(); // folder -> inode
  const startedAt = Date.now(); // on macOS, a file not changed since then is a replayed event
  const startFiles = new Map(); // macOS: file -> inode when the watch began (see presentAtStart)
  const presentAtStart = (p) => { try { return startFiles.get(p) === fs.statSync(p).ino; } catch { return false; } };
  const isNewFolder = (p) => {
    let ino;
    try { ino = fs.statSync(p).ino; } catch { return false; }
    if (knownFolders.get(p) === ino) return false;
    foldersUnder(p, knownFolders); // new, or a different folder now at a known path
    return true;
  };
  // A known folder that is gone (deleted or moved out) is forgotten with all below it, so the
  // same folder moved back later counts as new and its files are reloaded.
  // The event's path and each folder above it up to the watched root are checked: macOS may
  // report a moved-out folder by its files alone.
  const forgetGone = (root, target) => {
    for (let p = target; p.length > root.length && p.startsWith(root + path.sep); p = path.dirname(p)) {
      if (!knownFolders.has(p) || fs.existsSync(p)) continue;
      for (const k of [...knownFolders.keys()]) if (k === p || k.startsWith(p + path.sep)) knownFolders.delete(k);
    }
  };
  function watchRecursive(abs, d) {
    let w;
    try {
      w = fs.watch(abs, { recursive: true }, (_event, name) => {
        if (FOLDER_EVENTS.has(platform) && name) forgetGone(abs, path.join(abs, String(name)));
        for (const target of recursiveEventPaths(abs, name, platform, { isNewFolder, since: startedAt, presentAtStart })) note(target);
      });
    } catch { return false; /* recursive watch unsupported here: poll below */ }
    // The tree is scanned after the watch is installed, so a change made during the scan still
    // has its event; the events wait until this synchronous scan is done.
    if (FOLDER_EVENTS.has(platform)) foldersUnder(abs, knownFolders);
    if (platform === 'darwin') for (const f of walk(abs).keys()) { try { startFiles.set(f, fs.statSync(f).ino); } catch { /* raced a delete */ } }
    w.on('error', () => { try { w.close(); } catch { /* closed */ } poll(abs); modes[d] = 'poll'; });
    watchers.push(w);
    return true;
  }

  const modes = {};
  const mode = watchModeFor(platform);
  for (const d of dirs) {
    const abs = path.join(root, d);
    if (!fs.existsSync(abs)) continue;
    const watched = !forcePoll && (mode === 'recursive' ? watchRecursive(abs, d) : watchTree(abs));
    if (watched) modes[d] = 'watch';
    else { poll(abs); modes[d] = 'poll'; }
  }

  return {
    modes,
    /** While a build runs: its generated output is ignored; other edits still batch (onBatch queues them after the build). */
    mute() { muted = true; },
    /** Resume after `graceMs`: late events from the build's own writes still land in the muted window. */
    unmute(graceMs = 600) { muted = false; mutedUntil = Date.now() + graceMs; },
    close() { closed = true; clearTimeout(timer); folderFiles.clear(); for (const w of [...watchers, ...watchedDirs.values()]) w.close(); for (const t of polls) clearInterval(t); },
  };
}

/** What a batch needs before the preview reloads, in the order the builders require:
 *  framework mirrors first (content-build rejects a framework file without its
 *  src/framework/data mirror), then the config compiler, then the content compiler,
 *  then the card components the card layout compiles to (src/content/card-layout.json). */
export function buildsFor(files, root) {
  const content = files.some((f) => /^content\/(source|framework)\//.test(f));
  const framework = files.some((f) => /^content\/framework\//.test(f));
  const config = files.some((f) => /^content\/config\//.test(f));
  const cardLayout = files.includes('src/content/card-layout.json');
  const steps = [];
  if (framework && fs.existsSync(path.join(root, 'tools/framework-data-build.mjs'))) steps.push('tools/framework-data-build.mjs');
  if (config) steps.push('tools/config-build.mjs');
  if (content) steps.push('tools/content-build.mjs');
  if (cardLayout && fs.existsSync(path.join(root, 'tools/card-components.mjs'))) steps.push('tools/card-components.mjs');
  return steps;
}
