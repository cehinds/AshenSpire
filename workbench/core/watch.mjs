// workbench/core/watch.mjs — notice source edits and batch them.
//
// fs.watch with { recursive: true } where the platform has it (Windows, macOS,
// Linux on Node 20+); a 1 s mtime poll where it throws. Changes are collected
// into one batch per quiet period (`debounceMs`) and handed to `onBatch` as
// project-relative paths. `mute()` drops events under the builds' generated
// output (BUILD_OUTPUTS) while a build runs and for a short grace after, so a
// rebuild never triggers itself; any other edit made meanwhile is kept and
// lands in the next batch.
import fs from 'node:fs';
import path from 'node:path';

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
};
export const isBuildOutput = (rel) => Object.values(BUILD_OUTPUTS).some((dirs) => dirs.some((d) => rel.startsWith(d) || `${rel}/` === d));

export function createWatcher({ root, dirs, debounceMs = 250, onBatch, forcePoll = false, isOutput = isBuildOutput }) {
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
    onBatch(files);
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

  const modes = {};
  for (const d of dirs) {
    const abs = path.join(root, d);
    if (!fs.existsSync(abs)) continue;
    if (!forcePoll) {
      try {
        const w = fs.watch(abs, { recursive: true }, (_event, name) => { if (name) note(path.join(abs, String(name))); });
        w.on('error', () => { try { w.close(); } catch { /* closed */ } poll(abs); modes[d] = 'poll'; });
        watchers.push(w); modes[d] = 'watch';
        continue;
      } catch { /* recursive watch unsupported here: poll below */ }
    }
    poll(abs); modes[d] = 'poll';
  }

  return {
    modes,
    /** While a build runs: its generated output is ignored; other edits still batch (onBatch queues them after the build). */
    mute() { muted = true; },
    /** Resume after `graceMs`: late events from the build's own writes still land in the muted window. */
    unmute(graceMs = 600) { muted = false; mutedUntil = Date.now() + graceMs; },
    close() { closed = true; clearTimeout(timer); for (const w of watchers) w.close(); for (const t of polls) clearInterval(t); },
  };
}

/** What a batch needs before the preview reloads, in the order the builders require:
 *  framework mirrors first (content-build rejects a framework file without its
 *  src/framework/data mirror), then the config compiler, then the content compiler. */
export function buildsFor(files, root) {
  const content = files.some((f) => /^content\/(source|framework)\//.test(f));
  const framework = files.some((f) => /^content\/framework\//.test(f));
  const config = files.some((f) => /^content\/config\//.test(f));
  const steps = [];
  if (framework && fs.existsSync(path.join(root, 'tools/framework-data-build.mjs'))) steps.push('tools/framework-data-build.mjs');
  if (config) steps.push('tools/config-build.mjs');
  if (content) steps.push('tools/content-build.mjs');
  return steps;
}
