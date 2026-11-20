// tests/qa-evidence-size.test.mjs — bulk QA evidence stays out of the tree.
//
// Owner's ruling, 2026-10-10: raw machine-generated evidence (browser-run
// results, geometry dumps, browser-health logs) goes to CI workflow artifacts,
// not into git. #1781 committed ~1.1M lines of it and `.git` reached 1.9 GB.
// This gate fails when a TRACKED file larger than LIMIT_BYTES is
//   - a JSON file under an evidence directory (docs/qa/, docs/art-evidence/,
//     docs/preview/, any receipts/ or evidence/ folder) or anywhere under tools/;
//   - an image (png/jpg/jpeg/webp/gif) anywhere under tools/ (H5, review of
//     2026-11-06: tools/results/ held 7.8 MB of screenshots);
// unless ALLOWED names it with the reason it must stay.
// Images under the docs/ evidence directories are NOT gated yet: 61 are over the
// limit today (docs/art-evidence, docs/qa/releases) and need their own cleanup;
// add them to isEvidenceImage once that lands.
// CONTRIBUTING.md, "QA evidence goes to CI artifacts", is the rule in prose.
//
// It reads `git ls-files` and current worktree bytes, so uncommitted growth is
// included. Explicit Git text files are measured with CRLF converted to LF,
// matching their committed size; -text JSON and images retain their raw size.
// It does not see untracked files, history, or JSON outside those places
// (docs/design rig packages, for example).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export const LIMIT_BYTES = 256 * 1024;

// Evidence directories: where QA and review runs drop their output.
const EVIDENCE_PREFIXES = ['docs/qa/', 'docs/art-evidence/', 'docs/preview/'];
const EVIDENCE_SEGMENTS = ['/receipts/', '/evidence/'];

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

export function isEvidenceJson(path) {
  if (!path.endsWith('.json')) return false;
  if (path.startsWith('tools/')) return true;
  if (!path.startsWith('docs/')) return false;
  return EVIDENCE_PREFIXES.some((p) => path.startsWith(p)) || EVIDENCE_SEGMENTS.some((s) => path.includes(s));
}

export function isEvidenceImage(path) {
  return IMAGE_EXT.test(path) && path.startsWith('tools/');
}

export const isEvidenceFile = (path) => isEvidenceJson(path) || isEvidenceImage(path);

// Exact paths only, each with the reader that needs it in the tree. An entry
// whose file is no longer tracked fails, so the list cannot rot.
export const ALLOWED = new Map([
  ['tools/card-art/cutout-manifest.json', 'approved card-art compositions; tests/layered-card-art.test.mjs and the layered-art generator read it'],
  ['tools/hud-component-studio/projects/character-creation/component-manifest.json', 'the component library catalog; tools/hud-component-studio/library.js loads it'],
  ['tools/hud-component-studio/projects/character-creation/scene.json', 'the character-creation scene; library.js (through the manifest scene records), render.mjs and layer-icons.py read it'],
  ['tools/hud-component-studio/projects/character-creation/scene-mobile.json', 'the mobile scene the Studio library loads'],
  ['tools/hud-component-studio/projects/character-creation/scene-mobile-noncaster.json', 'the mobile non-caster scene the Studio library loads'],
  ['tools/hud-component-studio/projects/character-creation/source-desktop.json', 'the preserved desktop seed build-components.py regenerates the package from'],
]);

export function oversized(entries, limit = LIMIT_BYTES, allowed = ALLOWED) {
  return entries.filter(({ path, size }) => isEvidenceFile(path) && size > limit && !allowed.has(path));
}

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

export function measureEvidenceEntries(repoRoot, files) {
  const evidence = files.filter(isEvidenceFile);
  const jsonPaths = evidence.filter(isEvidenceJson);
  const textPaths = new Set();
  if (jsonPaths.length) {
    // NUL-delimited stdin and output preserve spaces and other legal path
    // characters, and one batch avoids a Git process for every artifact.
    const attributes = execFileSync('git', ['check-attr', '-z', '--stdin', 'text'], {
      cwd: repoRoot, encoding: 'utf8', input: jsonPaths.join('\0') + '\0', maxBuffer: 1 << 28,
    }).split('\0');
    for (let at = 0; at + 2 < attributes.length; at += 3) {
      if (attributes[at + 2] === 'set') textPaths.add(attributes[at]);
    }
  }
  const entries = [];
  for (const path of evidence) {
    try {
      const absolute = join(repoRoot, path);
      let size;
      if (textPaths.has(path)) {
        const bytes = readFileSync(absolute);
        size = bytes.length;
        // Count bytes directly: no UTF-8 decoding, trimming, BOM removal, or
        // lone-CR conversion may hide evidence that exceeds the limit.
        for (let at = 0; at + 1 < bytes.length; at++) {
          if (bytes[at] === 13 && bytes[at + 1] === 10) size--;
        }
      } else size = statSync(absolute).size;
      entries.push({ path, size });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error; // missing in a sparse or partial checkout
    }
  }
  return entries;
}

function evidenceFixture(t) {
  const scratch = realpathSync.native(tmpdir());
  const dir = realpathSync.native(mkdtempSync(join(scratch, 'evidence-size-')));
  t.after(() => {
    assert.equal(dirname(dir), scratch);
    assert.equal(realpathSync.native(dir), dir, 'cleanup still owns the original fixture');
    rmSync(dir, { recursive: true, force: true });
  });
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  git('init', '-q');
  git('config', 'user.name', 'Evidence size regression');
  git('config', 'user.email', 'evidence@example.invalid');
  git('config', 'core.autocrlf', 'false');
  writeFileSync(join(dir, '.gitattributes'), '*.json text eol=lf\ndocs/design/combat-depth-2026-10-05/** -text\n');
  const put = (path, bytes) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), bytes);
  };
  return { dir, git, put };
}

test('LF and CRLF text evidence have the same exact boundary, preserving BOM and lone CR bytes', t => {
  const { dir, git, put } = evidenceFixture(t);
  const prefix = Buffer.from('\ufeff{\n  "value": "'), suffix = Buffer.from('"\r}\n');
  const boundary = Buffer.concat([prefix, Buffer.alloc(LIMIT_BYTES - prefix.length - suffix.length, 120), suffix]);
  const lf = 'docs/qa/run/boundary-lf.json', crlf = 'docs/qa/run/boundary crlf.json';
  const over = 'docs/qa/run/over.json', overCrlf = 'docs/qa/run/over crlf.json';
  put(lf, boundary);
  put(crlf, Buffer.from(boundary.toString('utf8').replace(/\n/g, '\r\n')));
  put(over, Buffer.concat([boundary, Buffer.from(' ')]));
  put(overCrlf, Buffer.from(boundary.toString('utf8').replace(/\n/g, '\r\n') + ' '));
  git('add', '.');
  const entries = measureEvidenceEntries(dir, [lf, crlf, over, overCrlf]);
  assert.deepEqual(entries, [{ path: lf, size: LIMIT_BYTES }, { path: crlf, size: LIMIT_BYTES },
    { path: over, size: LIMIT_BYTES + 1 }, { path: overCrlf, size: LIMIT_BYTES + 1 }]);
  assert.deepEqual(oversized(entries).map(({ path }) => path), [over, overCrlf]);
  // Independently confirm the byte count against Git's clean-filtered index.
  for (const { path, size } of entries) assert.equal(Number(git('cat-file', '-s', `:${path}`).trim()), size);
});

test('binary images and explicitly -text JSON retain all CRLF bytes', t => {
  const { dir, git, put } = evidenceFixture(t);
  const image = 'tools/results/run/raw.png';
  const raw = 'docs/design/combat-depth-2026-10-05/evidence/raw.json';
  const bytes = Buffer.concat([Buffer.from([0, 0xff]), Buffer.from('\r\n'.repeat(LIMIT_BYTES / 2))]);
  put(image, bytes);
  put(raw, bytes);
  git('add', '.');
  const entries = measureEvidenceEntries(dir, [image, raw]);
  assert.deepEqual(entries, [{ path: image, size: bytes.length }, { path: raw, size: bytes.length }]);
  assert.deepEqual(oversized(entries).map(({ path }) => path), [image, raw]);
  for (const { path, size } of entries) assert.equal(Number(git('cat-file', '-s', `:${path}`).trim()), size);
});

test('tracked evidence growth is measured from unstaged worktree bytes rather than HEAD or the index', t => {
  const { dir, git, put } = evidenceFixture(t);
  const path = 'docs/qa/run/growing.json';
  put(path, '{}\n');
  git('add', '.');
  git('commit', '-qm', 'Small tracked evidence');
  put(path, Buffer.concat([Buffer.alloc(LIMIT_BYTES, 120), Buffer.from('\r\n')]));
  assert.equal(Number(git('cat-file', '-s', `HEAD:${path}`).trim()), 3);
  assert.equal(Number(git('cat-file', '-s', `:${path}`).trim()), 3);
  assert.deepEqual(oversized(measureEvidenceEntries(dir, [path])), [{ path, size: LIMIT_BYTES + 1 }]);
});

test('the evidence matcher covers the evidence directories and nothing else', () => {
  assert.equal(isEvidenceJson('docs/qa/run/results.json'), true);
  assert.equal(isEvidenceJson('docs/evidence/a.json'), true);
  assert.equal(isEvidenceJson('docs/art-evidence/b/c.json'), true);
  assert.equal(isEvidenceJson('docs/design/pack/receipts/r.json'), true);
  assert.equal(isEvidenceJson('docs/qa/run/shot.png'), false);
  assert.equal(isEvidenceJson('tools/hud-component-studio/projects/x/scene.json'), true);
  assert.equal(isEvidenceJson('tools/results/run/receipt.json'), true);
  assert.equal(isEvidenceJson('tools/results/run/shot.png'), false);
  assert.equal(isEvidenceImage('tools/results/run/shot.png'), true);
  assert.equal(isEvidenceImage('tools/x/y/shot.JPG'), true);
  assert.equal(isEvidenceImage('tools/results/notes.txt'), false);
  assert.equal(isEvidenceImage('docs/design/pack/hero.png'), false);
  // Deferred: docs evidence images (61 over the limit today) are not gated yet.
  assert.equal(isEvidenceImage('docs/qa/run/shot.png'), false);
  assert.equal(isEvidenceImage('assets/art/hero.png'), false);
  assert.equal(isEvidenceJson('docs/design/pack/hero.rig.json'), false);
  assert.equal(isEvidenceJson('tests/fixtures/big.json'), false);
});

test('the gate flags a large evidence JSON, a large tools image and spares allowlisted, small and non-evidence files', () => {
  const big = LIMIT_BYTES + 1;
  const found = oversized([
    { path: 'docs/qa/run/default-native-results.json', size: big },
    { path: 'docs/qa/run/summary.json', size: LIMIT_BYTES },
    { path: 'docs/qa/run/allowed-manifest.json', size: big },
    { path: 'art-manifest.json', size: big },
    { path: 'tools/results/run/receipt.json', size: big },
    { path: 'tools/results/run/shot.png', size: big },
    { path: 'tools/results/run/small.png', size: LIMIT_BYTES },
    { path: 'docs/design/pack/hero.png', size: big },
  ], LIMIT_BYTES, new Map([['docs/qa/run/allowed-manifest.json', 'fixture']]));
  assert.deepEqual(found.map((f) => f.path), ['docs/qa/run/default-native-results.json', 'tools/results/run/receipt.json', 'tools/results/run/shot.png']);
});

test(`no tracked evidence JSON or tools image exceeds ${LIMIT_BYTES / 1024} KiB unless allowlisted`, (t) => {
  const files = trackedFiles();
  if (!files) return t.skip('no git checkout');
  const tracked = new Set(files);
  const entries = measureEvidenceEntries(root, files);
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
  assert.deepEqual(needless, [], `ALLOWED names files that are now ${LIMIT_BYTES / 1024} KiB or less (or no longer evidence); remove them from the list`);
});
