// tests/qa-evidence-size.test.mjs — bulk QA evidence JSON stays out of the tree.
//
// Owner's ruling, 2026-10-10: raw machine-generated evidence (browser-run
// results, geometry dumps, browser-health logs) goes to CI workflow artifacts,
// not into git. #1781 committed ~1.1M lines of it and `.git` reached 1.9 GB.
// This gate fails when a TRACKED JSON file under an evidence directory is larger
// than LIMIT_BYTES, unless ALLOWED names it with the reason it must stay.
// CONTRIBUTING.md, "QA evidence goes to CI artifacts", is the rule in prose.
//
// It reads `git ls-files` and the checked-out sizes, so it measures the tree a
// pull request would merge. It does not see untracked files, history, or JSON
// outside the evidence directories (docs/design rig packages, for example).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export const LIMIT_BYTES = 256 * 1024;

// Evidence directories: where QA and review runs drop their output.
const EVIDENCE_PREFIXES = ['docs/qa/', 'docs/evidence/', 'docs/art-evidence/', 'docs/preview/', 'docs/screenshots/'];
const EVIDENCE_SEGMENTS = ['/receipts/', '/evidence/'];

export function isEvidenceJson(path) {
  if (!path.endsWith('.json') || !path.startsWith('docs/')) return false;
  return EVIDENCE_PREFIXES.some((p) => path.startsWith(p)) || EVIDENCE_SEGMENTS.some((s) => path.includes(s));
}

// Exact paths only, each with the reader that needs it in the tree. An entry
// whose file is no longer tracked fails, so the list cannot rot.
export const ALLOWED = new Map([
  ['docs/preview/hybrid-input-parity-manifest.json', 'read by tools/hybrid-input-parity.mjs (--verify-manifests)'],
  ['docs/preview/hybrid-input-parity-root-manifest.json', 'read by tools/hybrid-input-parity.mjs (--verify-manifests)'],
  ['docs/qa/combat-art-runtime-2026-10-06/ground-contact.json', 'linked as the measurements from its README'],
]);

export function oversized(entries, limit = LIMIT_BYTES, allowed = ALLOWED) {
  return entries.filter(({ path, size }) => isEvidenceJson(path) && size > limit && !allowed.has(path));
}

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

test('the evidence matcher covers the evidence directories and nothing else', () => {
  assert.equal(isEvidenceJson('docs/qa/run/results.json'), true);
  assert.equal(isEvidenceJson('docs/evidence/a.json'), true);
  assert.equal(isEvidenceJson('docs/art-evidence/b/c.json'), true);
  assert.equal(isEvidenceJson('docs/design/pack/receipts/r.json'), true);
  assert.equal(isEvidenceJson('docs/qa/run/shot.png'), false);
  assert.equal(isEvidenceJson('docs/design/pack/hero.rig.json'), false);
  assert.equal(isEvidenceJson('tests/fixtures/big.json'), false);
});

test('the gate flags a large evidence JSON and spares allowlisted, small and non-evidence files', () => {
  const big = LIMIT_BYTES + 1;
  const found = oversized([
    { path: 'docs/qa/run/default-native-results.json', size: big },
    { path: 'docs/qa/run/summary.json', size: LIMIT_BYTES },
    { path: 'docs/preview/hybrid-input-parity-manifest.json', size: big },
    { path: 'art-manifest.json', size: big },
  ]);
  assert.deepEqual(found.map((f) => f.path), ['docs/qa/run/default-native-results.json']);
});

test(`no tracked evidence JSON exceeds ${LIMIT_BYTES / 1024} KiB unless allowlisted`, (t) => {
  const files = trackedFiles();
  if (!files) return t.skip('no git checkout');
  const tracked = new Set(files);
  const entries = [];
  for (const path of files) {
    if (!isEvidenceJson(path)) continue;
    let size;
    try { size = statSync(join(root, path)).size; } catch { continue; } // sparse or partial checkout
    entries.push({ path, size });
  }
  const bad = oversized(entries);
  assert.deepEqual(
    bad.map(({ path, size }) => `${path} (${size} bytes)`),
    [],
    'bulk QA evidence belongs in a CI workflow artifact (actions/upload-artifact), not the tree; ' +
      'commit a small curated summary, or add the path to ALLOWED in tests/qa-evidence-size.test.mjs with the tool or test that reads it',
  );
  const stale = [...ALLOWED.keys()].filter((p) => !tracked.has(p));
  assert.deepEqual(stale, [], 'ALLOWED names files that are no longer tracked; remove them from the list');
  // An exemption that no longer exempts anything would let that path grow back unchecked.
  const sizes = new Map(entries.map(({ path, size }) => [path, size]));
  const needless = [...ALLOWED.keys()].filter((p) => tracked.has(p) && !(sizes.get(p) > LIMIT_BYTES));
  assert.deepEqual(needless, [], `ALLOWED names files that are now ${LIMIT_BYTES / 1024} KiB or less (or no longer evidence JSON); remove them from the list`);
});
