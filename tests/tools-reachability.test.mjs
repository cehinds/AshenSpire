// tests/tools-reachability.test.mjs — every top-level tools/*.mjs is reachable.
//
// Code review 2026-11-06, finding H5: 115 top-level tools were referenced by no
// root, which contradicts tools/attic/README.md (retired tools live in the
// attic). This gate fails on a tracked top-level `tools/<name>.mjs` that no
// root reaches, directly or through other reached tools.
//
// Roots: package.json, every tracked file under .github/ (workflows and
// composite actions), run.sh, run.bat, and every tracked text file under tests/
// (tests/run-node.mjs runs them). NOT roots: docs/, src/, tools/README.md,
// tools/attic/.
// Edge: a reached file mentions tool `x.mjs` as a whole name, i.e. its text
// matches (^|[^A-Za-z0-9_.-])x\.mjs, so `card.mjs` does not match `foo-card.mjs`.
// Reachability is transitive; the text of tracked files in tools/ subfolders
// (tools/lib/*, tools/combat-audit/*, ...) is scanned once reached, by path
// `tools/<sub>/<file>` or relative `<sub>/<file>` (or `./<file>` within the
// same folder).
//
// KNOWN_ORPHANS is a ratchet: today's orphans, which may only shrink. A new
// orphan fails; so does a stale entry (reachable now, or no longer tracked).
// The "Attic or delete the orphan tools" task empties it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Ceiling on KNOWN_ORPHANS: lower it whenever the list shrinks, never raise it.
export const ORPHAN_CEILING = 39;

export const KNOWN_ORPHANS = new Set([
  'tools/modal-no-reset.mjs',
  'tools/music-bed-gain-probe.mjs',
  'tools/offline-play-qa.mjs',
  'tools/onefold.mjs',
  'tools/overlapreader.mjs',
  'tools/painted-book-browser.mjs',
  'tools/painted-outfits-ship.mjs',
  'tools/painted-poses.mjs',
  'tools/perf-probe.mjs',
  'tools/player-poise-threshold.mjs',
  'tools/profile-surface-drive.mjs',
  'tools/quest-choice-contract.mjs',
  'tools/quicknav-reach.mjs',
  'tools/readiness-poses-ship.mjs',
  'tools/rear-player-qa.mjs',
  'tools/reaver-attack-animation.mjs',
  'tools/rebind-capture.mjs',
  'tools/refusal-audit.mjs',
  'tools/restore-settings-drive.mjs',
  'tools/reward-victory-qa.mjs',
  'tools/scroll-cue-bleed.mjs',
  'tools/settings-defaults.mjs',
  'tools/sfx-loudness.mjs',
  'tools/sigil-medallion.mjs',
  'tools/sound-opening.mjs',
  'tools/starseer-spell-reactions-qa.mjs',
  'tools/starter-card-art-browser.mjs',
  'tools/starting-equipment-qa.mjs',
  'tools/status-presentation-authority.mjs',
  'tools/swap-cost-relic-surface.mjs',
  'tools/swap-row-reads.mjs',
  'tools/text-geometry.mjs',
  'tools/title-new-slot.mjs',
  'tools/tooltip-review-qa.mjs',
  'tools/tray-components.mjs',
  'tools/twin-sword-animation-browser.mjs',
  'tools/ui-sweep.mjs',
  'tools/uniform-stat-foldouts.mjs',
  'tools/weightclass-census.mjs',
]);

const TEXT_EXT = /\.(mjs|js|cjs|json|ya?ml|md|txt|sh|bat|html|css)$/i;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameRe = (rel) => new RegExp(`(^|[^A-Za-z0-9_.-])${escapeRe(rel)}`);

export function isTool(path) {
  return /^tools\/[^/]+\.mjs$/.test(path);
}
function isToolSub(path) {
  return /^tools\/[^/]+\/.+/.test(path) && !path.startsWith('tools/attic/') && TEXT_EXT.test(path);
}
// tests/run-node.mjs discovers and runs every *.test.mjs in the repository,
// skipping node_modules, dist, build, scratch and dot-directories other than
// .github, so such a file is a root wherever it lives (tools/ included).
export function isDiscoveredTest(path) {
  if (!path.endsWith('.test.mjs')) return false;
  const dirs = path.split('/').slice(0, -1);
  return !dirs.some((d) => ['node_modules', 'dist', 'build', 'scratch'].includes(d) || (d.startsWith('.') && d !== '.github'));
}

// This file names every orphan in KNOWN_ORPHANS, so it must not count as a root.
const SELF = 'tests/tools-reachability.test.mjs';

export function isRoot(path) {
  if (path === SELF) return false;
  if (path === 'package.json' || path === 'run.sh' || path === 'run.bat') return true;
  if (isDiscoveredTest(path)) return true;
  return (path.startsWith('.github/') || path.startsWith('tests/')) && TEXT_EXT.test(path);
}

// Returns the Set of tracked top-level tools reachable from the roots.
export function reachableTools(files, readText) {
  const tools = files.filter(isTool);
  const subs = files.filter(isToolSub);
  const reached = new Set();
  const seen = new Set();
  const queue = [];
  const visit = (p) => { if (!seen.has(p)) { seen.add(p); queue.push(p); } };
  for (const r of files.filter(isRoot)) { visit(r); if (isTool(r)) reached.add(r); }
  const toolByName = new Map(tools.map((t) => [t.slice('tools/'.length), t]));
  const subsByBase = new Map();
  for (const s of subs) {
    const base = s.slice(s.lastIndexOf('/') + 1);
    if (!subsByBase.has(base)) subsByBase.set(base, []);
    subsByBase.get(base).push(s);
  }
  while (queue.length) {
    const path = queue.pop();
    let text;
    try { text = readText(path); } catch { continue; }
    if (typeof text !== 'string') continue;
    // Whole-name tokens: maximal runs of [A-Za-z0-9_.-], so `foo-card.mjs` is one token and never `card.mjs`.
    const tokens = new Set();
    for (const m of text.matchAll(/[A-Za-z0-9_.-]+/g)) {
      tokens.add(m[0]);
      tokens.add(m[0].replace(/\.+$/, ''));
    }
    for (const tok of tokens) {
      const t = toolByName.get(tok);
      if (t && !seen.has(t)) { reached.add(t); visit(t); }
    }
    const dir = path.startsWith('tools/') ? path.slice(0, path.lastIndexOf('/')) : null;
    for (const tok of tokens) {
      for (const s of subsByBase.get(tok) || []) {
        if (seen.has(s)) continue;
        const rel = s.slice('tools/'.length);
        let hit = nameRe(rel).test(text);
        if (!hit && dir && s.startsWith(dir + '/')) hit = nameRe('./' + s.slice(dir.length + 1)).test(text);
        if (hit) visit(s);
      }
    }
  }
  return reached;
}

export function orphanTools(files, readText) {
  const reached = reachableTools(files, readText);
  return files.filter(isTool).filter((t) => !reached.has(t)).sort();
}

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function fixture(map) {
  return { files: Object.keys(map), read: (p) => map[p] };
}

test('a transitive chain from a root is reachable', () => {
  const { files, read } = fixture({
    'package.json': '{"scripts":{"a":"node tools/a.mjs"}}',
    'tools/a.mjs': "import './b.mjs'",
    'tools/b.mjs': "import './lib/helper.mjs'",
    'tools/lib/helper.mjs': "import '../c.mjs'",
    'tools/c.mjs': '',
    'tools/lib/unused.mjs': '',
  });
  assert.deepEqual([...reachableTools(files, read)].sort(), ['tools/a.mjs', 'tools/b.mjs', 'tools/c.mjs']);
  assert.deepEqual(orphanTools(files, read), []);
});

test('tool names match whole, so card.mjs is not reached by foo-card.mjs', () => {
  const { files, read } = fixture({
    'run.sh': 'node tools/foo-card.mjs',
    'tools/foo-card.mjs': '',
    'tools/card.mjs': '',
    'tools/ard.mjs': '',
  });
  assert.deepEqual(orphanTools(files, read), ['tools/ard.mjs', 'tools/card.mjs']);
});

test('two tools that only reference each other stay orphaned', () => {
  const { files, read } = fixture({
    'tests/x.test.mjs': 'nothing here',
    'tools/p.mjs': 'see q.mjs',
    'tools/q.mjs': 'see p.mjs',
  });
  assert.deepEqual(orphanTools(files, read), ['tools/p.mjs', 'tools/q.mjs']);
});

test('tools/attic, docs, src and tools/README.md are not roots and not subjects', () => {
  const { files, read } = fixture({
    'tools/attic/old.mjs': 'node tools/a.mjs',
    'docs/guide.md': 'tools/b.mjs',
    'src/x.js': 'tools/c.mjs',
    'tools/README.md': 'tools/d.mjs',
    'tools/a.mjs': '',
    'tools/b.mjs': '',
    'tools/c.mjs': '',
    'tools/d.mjs': '',
  });
  assert.deepEqual(orphanTools(files, read), ['tools/a.mjs', 'tools/b.mjs', 'tools/c.mjs', 'tools/d.mjs']);
});

test('this test file is not a root, so KNOWN_ORPHANS cannot reach its own entries', () => {
  const { files, read } = fixture({
    'tests/tools-reachability.test.mjs': "'tools/o.mjs',",
    'tools/o.mjs': '',
  });
  assert.deepEqual(orphanTools(files, read), ['tools/o.mjs']);
});

test('a *.test.mjs the runner discovers is a root, even under tools/', () => {
  const { files, read } = fixture({
    'tools/x.test.mjs': "import './y.mjs'",
    'tools/y.mjs': '',
    'scratch/z.test.mjs': 'tools/z.mjs',
    'tools/z.mjs': '',
  });
  assert.deepEqual(orphanTools(files, read), ['tools/z.mjs']);
});

test('workflows and composite actions are roots', () => {
  const { files, read } = fixture({
    '.github/workflows/ci.yml': 'run: node tools/w.mjs',
    '.github/actions/x/action.yml': 'run: node tools/v.mjs',
    'tools/w.mjs': '',
    'tools/v.mjs': '',
  });
  assert.deepEqual(orphanTools(files, read), []);
});

test('every top-level tool is reachable from a root, or listed in KNOWN_ORPHANS', (t) => {
  const files = trackedFiles();
  if (!files) return t.skip('git is unavailable; cannot list tracked files');
  const tracked = new Set(files);
  const orphans = orphanTools(files, (p) => { try { return readFileSync(join(root, p), 'utf8'); } catch { return ''; } });
  const fresh = orphans.filter((o) => !KNOWN_ORPHANS.has(o));
  assert.deepEqual(
    fresh,
    [],
    'these tools/*.mjs are reachable from no root (package.json, .github/, run.sh, run.bat, tests/) or other tool: ' +
      'add a caller, or move each to tools/attic/ (see tools/attic/README.md); do not add to KNOWN_ORPHANS',
  );
  assert.ok(KNOWN_ORPHANS.size <= ORPHAN_CEILING, `KNOWN_ORPHANS grew to ${KNOWN_ORPHANS.size} (ceiling ${ORPHAN_CEILING}); it may only shrink`);
  const orphanSet = new Set(orphans);
  const stale = [...KNOWN_ORPHANS].filter((k) => !tracked.has(k) || !orphanSet.has(k));
  assert.deepEqual(stale, [], 'KNOWN_ORPHANS lists tools that are now reachable or no longer tracked; remove them from the list');
});
