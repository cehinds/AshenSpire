import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFeaturePages, EXPECTED_SANDBOX } from '../tools/check-feature-pages.mjs';
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
