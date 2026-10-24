import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkFeaturePages, capturePrimaryChannels, EXPECTED_SANDBOX } from '../tools/check-feature-pages.mjs';
import { previewWrapperHtml, PREVIEW_SCRIPT, PREVIEW_SANDBOX, branchPreviewSection } from '../tools/pages-site.mjs';
const sha = 'a'.repeat(40);
const target = { dir: 'Feature/example', sha };
const baseUrl = 'https://example.github.io/AshenSpire/';
function fixture(change = () => {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), ...options });
    let body = '', status = 200;
    const headers = new Headers();
    if (url.pathname === '/AshenSpire/') body = branchPreviewSection([{ ...target, path: target.dir, branch: target.dir, file: 'game.html' }]);
    else if (url.pathname.endsWith('/preview.js')) body = PREVIEW_SCRIPT;
    else if (url.pathname.endsWith('/build.txt')) { headers.set('content-length', '78000000'); headers.set('content-type', 'text/plain; charset=utf-8'); }
    else body = previewWrapperHtml(target.dir);
    const response = { status, headers, text: async () => body };
    change({ url, options, response, setBody: (value) => { body = value; } });
    return response;
  };
  return { baseUrl, targets: [target], fetchImpl, attempts: 1, calls };
}
test('checks public index, sandbox and loader; requests only HEAD for large build', async () => {
  const setup = fixture();
  assert.equal(EXPECTED_SANDBOX, PREVIEW_SANDBOX);
  assert.equal(await checkFeaturePages(setup), 1);
  assert.equal(setup.calls.length, 4);
  assert.equal(setup.calls.at(-1).method, 'HEAD');
  assert.ok(setup.calls.every((call) => call.signal instanceof AbortSignal));
});
for (const [name, change, expected] of [
  ['non-200 route', ({ response }) => { response.status = 404; }, /HTTP 404/],
  ['stale SHA', ({ url, setBody }) => { if (url.pathname === '/AshenSpire/') setBody(branchPreviewSection([{ path: target.dir, branch: target.dir, sha: 'b'.repeat(40) }])); }, /stale or missing/],
  ['branch path mismatch', ({ url, setBody }) => { if (url.pathname === '/AshenSpire/') setBody(branchPreviewSection([{ path: 'feature/other', branch: 'feature/other', sha }])); }, /stale or missing/],
  ['unsafe sandbox', ({ url, setBody }) => { if (url.pathname.endsWith('/latest/')) setBody(previewWrapperHtml(target.dir).replace(EXPECTED_SANDBOX, `${EXPECTED_SANDBOX} allow-same-origin`)); }, /sandbox/],
  ['missing loader', ({ url, setBody }) => { if (url.pathname.endsWith('/preview.js')) setBody(''); }, /loader/],
  ['empty build', ({ url, response }) => { if (url.pathname.endsWith('/build.txt')) response.headers.set('content-length', '0'); }, /empty/],
]) test(`rejects ${name}`, async () => { await assert.rejects(checkFeaturePages(fixture(change)), expected); });
test('rejects traversal before issuing requests', async () => {
  const setup = fixture();
  await assert.rejects(checkFeaturePages({ ...setup, targets: [{ dir: 'feature/../other', sha }] }), /Invalid preview path/);
  assert.equal(setup.calls.length, 0);
});
test('retries propagation failures at bounded three-second intervals', async () => {
  let failed = false;
  const waits = [];
  const setup = fixture(({ response }) => { if (!failed) { response.status = 404; failed = true; } });
  assert.equal(await checkFeaturePages({ ...setup, attempts: 5, delay: async (ms) => waits.push(ms) }), 1);
  assert.deepEqual(waits, [3000]);
  const absent = fixture(({ response }) => { response.status = 404; });
  await assert.rejects(checkFeaturePages({ ...absent, attempts: 5, delay: async () => {} }), /404/);
  assert.equal(absent.calls.length, 5);
});

function primaryFixture(change = {}) {
  const html = '<!doctype html><title>Test channel</title><script>notExecuted()</script>';
  const metadata = { branch: 'test', commit: 'c'.repeat(40), ordinal: 1802, version: '0.7.1',
    digest: '1e23e92920', stamp: 'BUILD 0.7.1.1802 · src 1e23e92920' };
  const target = { ...metadata, pageBytes: Buffer.byteLength(html), pageSha256: createHash('sha256').update(html).digest('hex') };
  const card = (row = metadata) => `<section class="card"><h3>${row.branch}</h3><p class="stamp">${row.stamp}</p><a href="https://github.com/cehinds/AshenSpire/commit/${row.commit}">${row.commit.slice(0, 10)}</a><a href="${row.branch}/${row.ordinal}/">Play ${row.branch}</a></section>`;
  const calls = [], reports = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), ...options });
    let body = '', status = 200;
    if (url.pathname === '/AshenSpire/') body = change.index ?? card();
    else if (url.pathname.endsWith('/test/latest/build.json')) body = JSON.stringify({ ...metadata, ...change.metadata });
    else if (url.pathname.endsWith('/test/latest/index.html')) body = change.html ?? html;
    else status = 404;
    if (change.response) ({ body, status } = change.response({ url, body, status }));
    return new Response(body, { status, headers: { age: '120', etag: '"cached"', 'last-modified': 'Fri, 23 Oct 2026 23:26:00 GMT' } });
  };
  return { baseUrl, targets: [], primaryTargets: [target], fetchImpl, attempts: 1, calls, reports,
    report: (message) => reports.push(message), html, metadata, target, card };
}

test('verifies the public Test metadata and actual page bytes against the assembly snapshot', async () => {
  const setup = primaryFixture();
  assert.equal(await checkFeaturePages(setup), 0, 'the feature count remains separate');
  assert.deepEqual(setup.calls.map(row => new URL(row.url).pathname), [
    '/AshenSpire/', '/AshenSpire/test/latest/build.json', '/AshenSpire/test/latest/index.html',
  ]);
  assert.ok(setup.calls.every(row => row.cache === 'no-store' && row.signal instanceof AbortSignal));
  assert.match(setup.reports.join('\n'), /test.*1802.*cccccccccc.*sha256/);
});

for (const [name, change, expected] of [
  ['stale commit', { metadata: { commit: 'd'.repeat(40) } }, /test.*metadata.*cccccccccc.*dddddddddd/],
  ['same version with a different digest', { metadata: { digest: 'bbbbbbbbbb' } }, /test.*metadata.*1e23e92920.*bbbbbbbbbb/],
  ['different page bytes', { html: '<!doctype html><title>Tost channel</title><script>notExecuted()</script>' }, /test.*page SHA256/],
]) test(`public primary verification refuses ${name}`, async () => {
  await assert.rejects(checkFeaturePages(primaryFixture(change)), expected);
});

test('requires the Test source and version inside its own root-index card', async () => {
  const setup = primaryFixture();
  const other = { ...setup.metadata, commit: 'd'.repeat(40) };
  setup.fetchImpl = primaryFixture({ index: setup.card(other) + `<section><h3>dev</h3>${setup.card()}</section>` }).fetchImpl;
  await assert.rejects(checkFeaturePages(setup), /test.*public index.*dddddddddd.*Age=120/);
});

test('rejects a missing required Test target and path traversal before any HTTP request', async () => {
  const target = primaryFixture().target;
  for (const primaryTargets of [[], [{ ...target, branch: '../test' }], [{ ...target, branch: 'https://evil.example' }],
    [{ ...target, pageSha256: 'invalid' }], [{ ...target, ordinal: 1.5 }], [{ ...target, url: 'https://evil.example' }], [target, target]]) {
    const setup = primaryFixture();
    await assert.rejects(checkFeaturePages({ ...setup, primaryTargets }), /required Test|Invalid primary/);
    assert.equal(setup.calls.length, 0);
  }
});

test('retries primary propagation failures with the existing bounded retry policy', async () => {
  let stale = true;
  const waits = [];
  const setup = primaryFixture({ response: ({ url, body, status }) => {
    if (url.pathname.endsWith('/build.json') && stale) {
      stale = false;
      body = body.replace('c'.repeat(40), 'd'.repeat(40));
    }
    return { body, status };
  } });
  await checkFeaturePages({ ...setup, attempts: 5, delay: async (ms) => waits.push(ms) });
  assert.deepEqual(waits, [3000]);
  const absent = primaryFixture({ metadata: { commit: 'd'.repeat(40) } });
  const failures = [];
  await assert.rejects(checkFeaturePages({ ...absent, attempts: 5, delay: async (ms) => failures.push(ms) }), /metadata.*Age=120.*ETag=/);
  assert.equal(absent.calls.filter(row => row.url.endsWith('/build.json')).length, 5);
  assert.deepEqual(failures, [3000, 3000, 3000, 3000]);
});


test('captures all assembled primary aliases and freezes their identities without consulting live refs', () => {
  const site = mkdtempSync(join(tmpdir(), 'pages-primary-'));
  const { metadata, target, html } = primaryFixture();
  try {
    const expected = [];
    for (const branch of ['dev', 'test', 'release', 'main']) {
      const dir = join(site, branch, 'latest');
      mkdirSync(dir, { recursive: true });
      const legacy = branch === 'release' ? { version: null, digest: '', stamp: 'BUILD ·1802 · src ' } : {};
      const row = { ...metadata, ...legacy, branch, pageBytes: target.pageBytes, pageSha256: target.pageSha256 };
      writeFileSync(join(dir, 'build.json'), JSON.stringify(row));
      writeFileSync(join(dir, 'index.html'), html);
      expected.push({ ...target, ...legacy, branch });
    }
    const snapshot = capturePrimaryChannels(site);
    assert.deepEqual(snapshot, expected);
    const cli = execFileSync(process.execPath, [fileURLToPath(new URL('../tools/check-feature-pages.mjs', import.meta.url)), '--capture-primary', site], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(cli), expected);
    writeFileSync(join(site, 'test/latest/build.json'), JSON.stringify({ ...metadata, commit: 'd'.repeat(40) }));
    assert.equal(snapshot.find(row => row.branch === 'test').commit, metadata.commit, 'later refs or publications cannot rewrite the captured expectation');
  } finally { rmSync(site, { recursive: true, force: true }); }
});

test('capture refuses missing Test and an assembled page that no longer matches its metadata', () => {
  const site = mkdtempSync(join(tmpdir(), 'pages-primary-'));
  const { metadata, target, html } = primaryFixture();
  try {
    assert.throws(() => capturePrimaryChannels(site), /required Test/);
    const dir = join(site, 'test/latest');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'build.json'), JSON.stringify({ ...metadata, pageSha256: target.pageSha256 }));
    writeFileSync(join(dir, 'index.html'), html.replace('Test', 'Tost'));
    assert.throws(() => capturePrimaryChannels(site), /assembled page differs/);
  } finally { rmSync(site, { recursive: true, force: true }); }
});


test('checks each primary channel against its own captured source and page', async () => {
  const setup = primaryFixture(), dev = { ...setup.target, branch: 'dev', commit: 'd'.repeat(40) };
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), ...options });
    if (url.pathname === '/AshenSpire/') return new Response(setup.card(dev) + setup.card());
    const row = url.pathname.includes('/dev/') ? dev : setup.target;
    return new Response(url.pathname.endsWith('build.json') ? JSON.stringify(row) : setup.html);
  };
  await checkFeaturePages({ ...setup, primaryTargets: [dev, setup.target], fetchImpl });
  assert.equal(calls.length, 5);
  assert.equal(setup.reports.length, 2);
  assert.match(setup.reports[0], /dev.*dddddddddd/);
  assert.match(setup.reports[1], /test.*cccccccccc/);
});
