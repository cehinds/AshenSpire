// The branches/ section of the Pages site: feature-branch builds for open PRs into
// dev. Pure functions and a temp directory only; no git history, no build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { safeBranchDir, readBranchPreviews, publishBranchPreviews, branchPreviewSection, rootIndex, previewWrapperHtml, PREVIEW_SCRIPT, PREVIEW_SANDBOX } from '../tools/pages-site.mjs';

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pages-branches-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// One PR build as the workflow lays it out: <dir>/<safe>/AshenSpire-dev-preview.html.
function stage(dir, branch, body = '<!doctype html><title>preview</title>') {
  const safe = safeBranchDir(branch);
  mkdirSync(join(dir, safe), { recursive: true });
  writeFileSync(join(dir, safe, 'AshenSpire-dev-preview.html'), body);
  return { branch, dir: safe, pr: 7, sha: 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0' };
}

test('a normal branch name is its own site path', () => {
  assert.equal(safeBranchDir('chore/CdCiPipelines'), 'chore/CdCiPipelines');
  assert.equal(safeBranchDir('feature/m1-combat_slice.2'), 'feature/m1-combat_slice.2');
});

test('a branch name that is not a plain path is refused, never rewritten', () => {
  assert.throws(() => safeBranchDir('feature/m1 combat+slice'), /cannot be published/);
  assert.throws(() => safeBranchDir('fix/🎮emoji'), /cannot be published/);
  assert.throws(() => safeBranchDir('feature/../etc'), /cannot be published/);
  assert.throws(() => safeBranchDir('feature/./x'), /cannot be published/);
  assert.throws(() => safeBranchDir('feature//x'), /cannot be published/);
  assert.throws(() => safeBranchDir('/feature/x'), /cannot be published/);
  assert.throws(() => safeBranchDir('feature/x/'), /cannot be published/);
});

test('the --branch-dir mode prints the name it accepts and refuses the rest, on stdout only', () => {
  const tool = fileURLToPath(new URL('../tools/pages-site.mjs', import.meta.url));
  const run = (name) => spawnSync(process.execPath, [tool, '--branch-dir', name], { encoding: 'utf8', input: '' });
  const ok = run('feature/m1-combat');
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, 'feature/m1-combat\n');
  const bad = run('fix/🎮emoji');
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, '');
  assert.match(bad.stderr, /cannot be published/);
});

test('the manifest is read, and an entry that cannot be served is skipped and named', (t) => {
  const dir = scratch(t);
  const good = stage(dir, 'feature/good');
  mkdirSync(join(dir, 'fix', 'empty'), { recursive: true });
  const skipped = [];
  writeFileSync(join(dir, 'previews.json'), JSON.stringify({ previews: [
    good,
    { branch: 'fix/empty', dir: 'fix/empty', pr: 9, sha: 'ffffff1' },
    { branch: 'chore/x', dir: 'chore/wrong', pr: 10, sha: 'ffffff1' },
  ] }));
  const served = readBranchPreviews(dir, skipped);
  assert.deepEqual(served.map((p) => p.path), ['feature/good']);
  assert.equal(skipped.length, 2);
  assert.match(skipped[0].reason, /found 0/);
  assert.match(skipped[1].reason, /not the branch's site path/);
});

test('a branch name that is not a plain path is withheld with its PR named, and no folder is read for it', (t) => {
  const dir = scratch(t);
  const good = stage(dir, 'feature/good');
  // The workflow never downloads for such a branch; a folder under its sanitised name would be ignored.
  mkdirSync(join(dir, 'feature', 'a-b'), { recursive: true });
  writeFileSync(join(dir, 'feature', 'a-b', 'AshenSpire-dev-preview.html'), '<!doctype html>');
  writeFileSync(join(dir, 'previews.json'), JSON.stringify({ previews: [
    good,
    { branch: 'feature/a+b', dir: 'feature/a-b', pr: 7, sha: 'a1b2c3d4' },
    { branch: 'fix/🎮emoji', dir: 'fix/-emoji', pr: 8, sha: 'a1b2c3d4' },
  ] }));
  const skipped = [];
  const warnings = [];
  const warn = console.warn;
  console.warn = (msg) => warnings.push(String(msg));
  let served;
  try { served = readBranchPreviews(dir, skipped); } finally { console.warn = warn; }
  assert.deepEqual(served.map((p) => p.path), ['feature/good']);
  assert.equal(skipped.length, 2);
  assert.ok(skipped.some((s) => s.branch === 'feature/a+b' && /cannot be published/.test(s.reason)));
  assert.ok(skipped.some((s) => s.branch === 'fix/🎮emoji' && /cannot be published/.test(s.reason)));
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /PR #7 \(feature\/a\+b\)/);
  assert.match(warnings[1], /PR #8 \(fix\/🎮emoji\)/);
});

test('no manifest means no previews', (t) => {
  assert.deepEqual(readBranchPreviews(scratch(t), []), []);
});

test('a preview is published at branches/<branch>/latest/ as text, behind a sandboxed wrapper', (t) => {
  const dir = scratch(t);
  const out = scratch(t);
  const entry = stage(dir, 'feature/m2-map-gen', '<!doctype html><title>map</title>');
  writeFileSync(join(dir, 'previews.json'), JSON.stringify({ previews: [entry] }));
  const [prev] = readBranchPreviews(dir, []);
  publishBranchPreviews(out, [prev]);
  const latest = join(out, 'branches', 'feature/m2-map-gen', 'latest');
  assert.equal(readFileSync(join(latest, 'build.txt'), 'utf8'), '<!doctype html><title>map</title>');
  assert.match(readFileSync(join(latest, 'index.html'), 'utf8'), /<iframe id="preview"/);
  assert.equal(readFileSync(join(latest, 'preview.js'), 'utf8'), PREVIEW_SCRIPT);
});

test('the wrapper sandboxes the build without allow-same-origin, and the only HTML on the branch is the wrapper', (t) => {
  const dir = scratch(t);
  const out = scratch(t);
  const entry = stage(dir, 'feature/sandbox', '<!doctype html><head></head><script>x()</script>');
  writeFileSync(join(dir, 'previews.json'), JSON.stringify({ previews: [entry] }));
  publishBranchPreviews(out, readBranchPreviews(dir, []));
  const latest = join(out, 'branches', 'feature/sandbox', 'latest');
  const wrapper = readFileSync(join(latest, 'index.html'), 'utf8');
  const sandbox = wrapper.match(/sandbox="([^"]*)"/);
  assert.ok(sandbox, 'the iframe has a sandbox attribute');
  assert.equal(sandbox[1], PREVIEW_SANDBOX);
  assert.ok(sandbox[1].split(' ').includes('allow-scripts'));
  assert.ok(!sandbox[1].includes('allow-same-origin'), 'allow-same-origin must never be granted');
  assert.match(wrapper, /Content-Security-Policy/);
  assert.match(wrapper, /script-src &#39;self&#39;/); // esc() quotes the CSP; the browser decodes it
  const htmlFiles = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.html?$/i.test(f)) htmlFiles.push(p);
    }
  };
  walk(join(out, 'branches', 'feature/sandbox'));
  assert.deepEqual(htmlFiles, [join(latest, 'index.html')]);
});

test('a branch name carrying markup is escaped in the wrapper', () => {
  const html = previewWrapperHtml('feature/<script>alert(1)</script>&"x"');
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /feature\/&lt;script&gt;alert\(1\)&lt;\/script&gt;&amp;&quot;x&quot;/);
});

test('the preview script injects the dev channel flag right after <head> and sets it as srcdoc', async () => {
  const build = '<!doctype html><html><head><title>g</title></head><body>game</body></html>';
  const saved = { document: globalThis.document, fetch: globalThis.fetch };
  const frame = { srcdoc: null };
  const status = { textContent: 'loading' };
  globalThis.document = { getElementById: (id) => (id === 'preview' ? frame : status) };
  globalThis.fetch = async (url) => {
    assert.equal(url, 'build.txt');
    return { ok: true, text: async () => build };
  };
  try {
    new Function(PREVIEW_SCRIPT)();
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setImmediate(r));
  } finally {
    globalThis.document = saved.document;
    globalThis.fetch = saved.fetch;
  }
  assert.equal(frame.srcdoc, "<!doctype html><html><head><script>window.__ASHEN_PREVIEW_CHANNEL__ = 'dev';</script><title>g</title></head><body>game</body></html>");
  assert.equal(status.textContent, '');
});

test('the index section lists each open-PR build and says so when there are none', () => {
  const none = branchPreviewSection([]);
  assert.match(none, /id="branch-builds"/);
  assert.match(none, /No open pull request into/);

  const html = branchPreviewSection([{ branch: 'feature/x', path: 'feature/x', pr: 12, sha: 'a1b2c3d4e5f6', file: 'AshenSpire-dev-preview.html' }]);
  assert.match(html, /open pull request #12 into dev/);
  assert.match(html, /Sandboxed preview of feature\/x/);
  assert.match(html, /href="branches\/feature\/x\/latest\/"/);
  assert.match(html, /href="branches\/feature\/x\/latest\/build\.txt" download="AshenSpire-dev-preview\.html"/);
  assert.match(html, /commit <a href="https:\/\/github\.com\/cehinds\/AshenSpire\/commit\/a1b2c3d4e5f6">a1b2c3d4e5/);
});

test('the root index carries the branches section only when previews are passed', () => {
  const data = [{ branch: 'dev', builds: [], headTracksBuild: false, headOrdinal: null }];
  assert.doesNotMatch(rootIndex(data, 'now', []), /branch-builds/);
  const withSection = rootIndex(data, 'now', [], [{ branch: 'fix/y', path: 'fix/y', pr: 3, sha: '', file: 'AshenSpire-dev-preview.html' }]);
  assert.match(withSection, /id="branch-builds"/);
  assert.match(withSection, /branches\/fix\/y\/latest\//);
});
