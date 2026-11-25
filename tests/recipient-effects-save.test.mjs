import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { once } from 'node:events';
import test from 'node:test';
import { compileEntries, generate, GENERATED, readConfigTree } from '../tools/config-build.mjs';
import { serve } from '../tools/serve.mjs';

const root = resolve(import.meta.dirname, '..');
const source = 'content/config/ui/presentation/recipientEffects.json';
const page = '/tools/recipient-effects-runtime-preview.html';
const route = '/__editor/recipient-effects';
const tuning = { scope: 'recipient', maxConcurrent: 3, gapMs: 0, overlapMs: 23, opacity: 0.52 };

async function fixture(t, editorWrite) {
  const dir = await mkdtemp(join(tmpdir(), 'recipient-timing-'));
  const generated = join(dir, GENERATED);
  await cp(join(root, 'content/config'), join(dir, 'content/config'), { recursive: true });
  await mkdir(dirname(generated), { recursive: true });
  await cp(join(root, GENERATED), generated);
  await mkdir(join(dir, 'tools'), { recursive: true });
  await cp(join(root, page), join(dir, page));
  const { server, port } = await serve({ root: dir, host: '127.0.0.1', port: 0, open: false, quiet: true, editorWrite });
  t.after(async () => {
    server.close();
    await once(server, 'close');
    await rm(dir, { recursive: true, force: true });
  });
  return { dir, generated, origin: 'http://127.0.0.1:' + port, path: join(dir, source) };
}

function post(origin, body, requestOrigin = origin, contentType = 'application/json; charset=utf-8') {
  return fetch(origin + route, {
    method: 'POST',
    headers: { Origin: requestOrigin, 'Content-Type': contentType },
    body: JSON.stringify(body),
  });
}

test('effect timing endpoint reads the revision and saves only the five timing values', async t => {
  const { dir, origin, path, generated } = await fixture(t, true);
  assert.match(await (await fetch(origin + page)).text(), /data-editor-write="on"/);
  const response = await fetch(origin + route);
  assert.equal(response.status, 200);
  const before = await response.json();
  assert.equal(before.file, source);
  assert.match(before.revision, /^[a-f0-9]{64}$/);
  const original = await readFile(path, 'utf8');

  const written = await post(origin, { revision: before.revision, timing: tuning });
  assert.equal(written.status, 200, await written.clone().text());
  const saved = await written.json();
  assert.deepEqual(saved.timing, tuning);
  assert.notEqual(saved.revision, before.revision);

  const mutableLines = /^\s*"(resultQueueScope|resultMaxConcurrent|resultGapMs|resultOverlapMs|global)"\s*:[^\n]*$/gm;
  const current = await readFile(path, 'utf8');
  assert.equal(current.replace(mutableLines, ''), original.replace(mutableLines, ''), 'unrelated bytes are preserved');
  const compiled = compileEntries(readConfigTree(join(dir, 'content')), { requireInteractionConfigs: true });
  assert.deepEqual(compiled.errors, []);
  assert.equal(await readFile(generated, 'utf8'), generate(compiled), 'canonical output matches the current JSON');

  assert.equal((await post(origin, { revision: before.revision, timing: tuning })).status, 409);
  assert.deepEqual(await (await fetch(origin + route)).json(), saved);
  assert.equal(await readFile(path, 'utf8'), current);
});

test('effect timing refuses malformed, cross-origin, oversized and nonlocal requests', async t => {
  const { origin, path } = await fixture(t, true);
  const { revision } = await (await fetch(origin + route)).json();
  const current = await readFile(path, 'utf8');
  for (const timing of [
    { ...tuning, maxConcurrent: 1 },
    { ...tuning, gapMs: 10 },
    { ...tuning, opacity: 1.1 },
    { ...tuning, unsupported: true },
    { ...tuning, gapMs: '0' },
  ]) {
    assert.equal((await post(origin, { revision, timing })).status, 400);
  }
  assert.equal((await post(origin, { revision, timing: tuning }, 'http://example.test')).status, 403);
  assert.equal((await post(origin, { revision, timing: tuning }, origin, 'text/plain')).status, 403);
  assert.equal((await post(origin, 'x'.repeat(5000))).status, 413);
  assert.equal((await fetch(origin + route, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal(await readFile(path, 'utf8'), current);
});

test('read-only servers leave preview available and refuse save requests', async t => {
  const { origin } = await fixture(t, false);
  const preview = await fetch(origin + page);
  assert.equal(preview.status, 200);
  assert.doesNotMatch(await preview.text(), /data-editor-write="on"/);
  assert.equal((await fetch(origin + route)).status, 403);
  assert.equal((await post(origin, { revision: '0'.repeat(64), timing: tuning })).status, 403);
});

test('compiler failure keeps both authored JSON and generated output intact', async t => {
  const { dir, origin, path, generated } = await fixture(t, true);
  const before = await (await fetch(origin + route)).json();
  const sourceBefore = await readFile(path);
  const generatedBefore = await readFile(generated);
  await writeFile(join(dir, 'content/config/ui/presentation/editor-invalid.json'), '{"notASection":true}');
  const result = await post(origin, { revision: before.revision, timing: tuning });
  assert.equal(result.status, 422, await result.clone().text());
  assert.match((await result.json()).error, /editor-invalid/);
  assert.deepEqual(await readFile(path), sourceBefore);
  assert.deepEqual(await readFile(generated), generatedBefore);
});
