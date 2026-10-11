// workbench/core/watch.mjs — notice source edits and batch them.
//
// fs.watch with { recursive: true } where the platform has it (Windows, macOS,
// Linux on Node 20+); a 1 s mtime poll where it throws. Changes are collected
// into one batch per quiet period (`debounceMs`) and handed to `onBatch` as
// project-relative paths. `mute()` drops events while a build writes its
// generated output, so a rebuild never triggers itself.
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

export function createWatcher({ root, dirs, debounceMs = 250, onBatch, forcePoll = false }) {
  const pending = new Set();
  const watchers = []; const polls = [];
  let timer = null; let mutedUntil = 0; let muted = false; let closed = false;
  const rel = (abs) => path.relative(root, abs).split(path.sep).join('/');

  function note(abs) {
    if (closed || muted || Date.now() < mutedUntil) return;
    const r = rel(abs);
    if (!r || r.startsWith('..') || IGNORED(r)) return;
    pending.add(r);
    clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }
  function flush() {
    if (!pending.size || closed) return;
    const files = [...pending].sort(); pending.clear();
    onBatch(files);
  }

  function poll(dir) {
    let known = walk(dir);
    const t = setInterval(() => {
      const now = walk(dir);
      for (const [f, m] of now) if (known.get(f) !== m) note(f);
      for (const f of known.keys()) if (!now.has(f)) note(f);
      known = now;
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
    mute() { muted = true; clearTimeout(timer); pending.clear(); },
    /** Resume after `graceMs`: late events from the build's own writes still land in the muted window. */
    unmute(graceMs = 600) { muted = false; mutedUntil = Date.now() + graceMs; },
    close() { closed = true; clearTimeout(timer); for (const w of watchers) w.close(); for (const t of polls) clearInterval(t); },
  };
}

/** What a batch needs before the preview reloads: the content compiler, the config compiler, or nothing. */
export function buildsFor(files, root) {
  const steps = [];
  if (files.some((f) => /^content\/(source|framework)\//.test(f))) {
    steps.push('tools/content-build.mjs');
    if (fs.existsSync(path.join(root, 'tools/framework-data-build.mjs'))) steps.push('tools/framework-data-build.mjs');
  }
  if (files.some((f) => /^content\/config\//.test(f))) steps.push('tools/config-build.mjs');
  return steps;
}
