// node --test workbench/tests/server.test.mjs — the Workbench server against a
// disposable project planted under os.tmpdir(), started with children off.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWorkbench, listPreviews } from '../server.mjs';
import { safePath, refusedPath, createGate } from '../lib/index.mjs';
import { JOBS } from '../core/jobs.mjs';
import { buildsFor } from '../core/watch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function project(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const d of ['content/source', 'content/config/ui', 'src', 'styles']) await fs.mkdir(path.join(root, d), { recursive: true });
  await fs.writeFile(path.join(root, 'styles/main.css'), 'body{}\n');
  await fs.writeFile(path.join(root, 'cards-preview.html'), '<!doctype html><title>Cards &amp; more</title>');
  await fs.writeFile(path.join(root, 'tooltip-review-x.html'), '<!doctype html><title>Tips</title>');
  await fs.writeFile(path.join(root, 'notes.html'), '<!doctype html><title>Not a preview</title>');
  return root;
}

async function boot(t, root, extra = {}) {
  const app = await createWorkbench({ root, port: 0, children: false, stateDir: path.join(root, '.wb-state'), debounceMs: 120, ...extra });
  t.after(() => app.close());
  const call = (p, init = {}) => fetch(`${app.url}${p}`, { ...init, headers: { 'x-studio-token': app.token, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) } });
  return { app, call };
}

test('safePath refuses traversal, hidden segments, absolute and Windows paths, streams and symlinks', async (t) => {
  const root = await project(t);
  for (const p of ['../secret', '.git/config', 'content/../x', 'content\\x', 'a.txt:stream', '/etc/passwd', 'C:/x', '', 'content/./x']) {
    assert.equal(refusedPath(p), true, p || '(empty)');
    await assert.rejects(safePath(root, p, { creating: true }), /Refused/, p || '(empty)');
  }
  await fs.symlink(path.join(root, 'styles'), path.join(root, 'linked'), 'dir');
  await assert.rejects(safePath(root, 'linked/main.css'), /Linked/);
  await assert.rejects(safePath(root, 'styles/missing.css'), /Not found/);
  assert.equal(await safePath(root, 'styles/main.css'), path.join(root, 'styles/main.css'));
});

test('the gate checks host, origin, cross-site fetches and the token', () => {
  const check = createGate({ token: 't0k', hosts: ['127.0.0.1:1'], origins: ['http://127.0.0.1:1'], open: ['/api/session'], queryTokenPaths: ['/api/events'] });
  const req = (headers) => ({ headers: { host: '127.0.0.1:1', ...headers } });
  const u = (p) => new URL(`http://127.0.0.1:1${p}`);
  assert.equal(check(req({}), u('/api/session')), null);
  assert.equal(check(req({ host: 'evil.example' }), u('/api/session')).status, 403);
  assert.equal(check(req({ origin: 'http://evil.example' }), u('/api/session')).status, 403);
  assert.equal(check(req({ 'sec-fetch-site': 'cross-site' }), u('/api/session')).status, 403);
  assert.equal(check(req({}), u('/api/tools')).status, 403);
  assert.equal(check(req({ 'x-studio-token': 'nope' }), u('/api/tools')).status, 403);
  assert.equal(check(req({ 'x-studio-token': 't0k' }), u('/api/tools')), null);
  assert.equal(check(req({}), u('/api/tools?token=t0k')).status, 403, 'query tokens only where allowed');
  assert.equal(check(req({}), u('/api/events?token=t0k')), null);
});

test('HTTP: token, origin and host are enforced; only the page files are served', async (t) => {
  const root = await project(t);
  const { app, call } = await boot(t, root);
  const session = await (await fetch(`${app.url}/api/session`)).json();
  assert.equal(session.token, app.token);
  assert.equal(session.children, false);
  assert.equal((await fetch(`${app.url}/api/tools`)).status, 403, 'no token');
  assert.equal((await call('/api/tools', { headers: { Origin: 'http://evil.example' } })).status, 403, 'cross origin');
  assert.equal((await fetch(`${app.url.replace('127.0.0.1', 'localhost')}/api/session`)).status, 403, 'other host');
  const tools = await (await call('/api/tools')).json();
  assert.deepEqual(tools.map((x) => x.id).sort(), ['editor', 'game', 'pose', 'ui-studio']);
  assert.ok(tools.every((x) => x.status === 'down' && x.url.startsWith('http://')));
  assert.equal((await call('/api/tools/editor/restart', { method: 'POST', body: '{}' })).status, 409, 'no children to restart');
  assert.equal((await call('/api/tools/nope/restart', { method: 'POST', body: '{}' })).status, 404);
  const page = await fetch(`${app.url}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  for (const p of ['/server.mjs', '/tests/server.test.mjs', '/.state/jobs.json', '/lib/gate.mjs', '/../package.json', '/%2e%2e/server.mjs']) assert.equal((await fetch(`${app.url}${p}`)).status, 404, p);
  assert.equal((await fetch(`${app.url}/export/manifest.json`)).status, 404, 'no export yet');
  assert.equal((await call('/api/doc?path=../SPEC.md')).status, 400);
});

test('jobs: only allowlisted ids run, one at a time, and history is kept', async (t) => {
  const root = await project(t);
  const { app, call } = await boot(t, root);
  for (const id of ['rm', '../x', 'constructor', '__proto__', '']) {
    const res = await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id }) });
    assert.equal(res.status, 400, `refused: ${id}`);
    assert.match((await res.json()).error, /Unknown job/);
  }
  const { defs } = await (await call('/api/jobs')).json();
  assert.deepEqual(defs.map((d) => d.id), Object.keys(JOBS));
  assert.equal(defs.find((d) => d.id === 'engine-export').available, false, 'missing exporter is reported, not hidden');
  // The exporter is missing in this project: the run fails gracefully with a message.
  const started = await (await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'engine-export' }) })).json();
  for (let i = 0; i < 50 && app.jobs.active.size; i++) await new Promise((r) => setTimeout(r, 20));
  const run = await (await call(`/api/jobs/runs/${started.runId}`)).json();
  assert.equal(run.status, 'failed');
  assert.match(run.log, /engine-export\.mjs is not in this checkout/);
  // A real step that runs: config-build exists nowhere here either, so plant a tiny one.
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), 'setTimeout(() => console.log("built"), 300);\n');
  const first = await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'config-build' }) });
  assert.equal(first.status, 200);
  const second = await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'config-build' }) });
  assert.equal(second.status, 409, 'one run per id at a time');
  for (let i = 0; i < 100 && app.jobs.active.size; i++) await new Promise((r) => setTimeout(r, 30));
  const { runs } = await (await call('/api/jobs')).json();
  assert.equal(runs[0].status, 'passed');
  assert.equal(runs[0].log, undefined, 'the list carries summaries, not logs');
  const saved = JSON.parse(await fs.readFile(path.join(root, '.wb-state/jobs.json'), 'utf8'));
  assert.equal(saved.length, 2);
  assert.match(saved[0].log, /built/);
});

test('/api/previews lists root preview pages with their titles', async (t) => {
  const root = await project(t);
  const { call } = await boot(t, root);
  const previews = await (await call('/api/previews')).json();
  assert.deepEqual(previews, [
    { file: 'cards-preview.html', title: 'Cards & more', kind: 'preview' },
    { file: 'tooltip-review-x.html', title: 'Tips', kind: 'review' },
  ]);
  assert.deepEqual(await listPreviews(root), previews);
  const lib = await (await call('/api/library')).json();
  assert.ok(lib.entries.some((e) => e.path === 'cards-preview.html' && e.unregistered), 'an unregistered root preview still shows');
  assert.ok(lib.entries.some((e) => e.path === 'editor/index.html' && e.exists === false), 'registry entries say whether they exist here');
});

async function nextEvent(app, name, timeoutMs = 6000) {
  const res = await fetch(`${app.url}/api/events?token=${app.token}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const deadline = Date.now() + timeoutMs;
  let pending = null; // one outstanding read: a read abandoned by the race below would swallow its chunk
  try {
    while (Date.now() < deadline) {
      pending ||= reader.read();
      const result = await Promise.race([pending, new Promise((r) => setTimeout(() => r(null), 200))]);
      if (result) pending = null;
      if (result && result.done) break;
      if (result && result.value) buffer += decoder.decode(result.value, { stream: true });
      const frames = buffer.split('\n\n');
      for (const frame of frames) {
        const ev = frame.match(/^event: (.+)$/m); const data = frame.match(/^data: (.+)$/m);
        if (ev && ev[1] === name && data) return JSON.parse(data[1]);
      }
      if (nextEvent.onOpen) { const fn = nextEvent.onOpen; nextEvent.onOpen = null; await fn(); }
    }
    throw Error(`no ${name} event within ${timeoutMs} ms`);
  } finally { reader.cancel().catch(() => {}); }
}

for (const mode of ['watch', 'poll']) {
  test(`SSE emits reload after a watched file changes (${mode})`, async (t) => {
    const root = await project(t);
    const { app } = await boot(t, root, { forcePoll: mode === 'poll' });
    nextEvent.onOpen = async () => {
      await new Promise((r) => setTimeout(r, 300));
      await fs.writeFile(path.join(root, 'styles/main.css'), 'body{color:red}\n');
      await fs.writeFile(path.join(root, 'src/new.js'), 'export {};\n');
    };
    const event = await nextEvent(app, 'reload');
    assert.deepEqual(event.files, ['src/new.js', 'styles/main.css']);
    assert.equal(event.count, 2);
    assert.deepEqual(event.built, []);
  });
}

test('a content/config change runs the config compiler before the reload; a failing build reports instead', async (t) => {
  const root = await project(t);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), "import fs from 'node:fs'; fs.mkdirSync('src/config/generated', { recursive: true }); fs.writeFileSync('src/config/generated/ui.js', 'export default 1;\\n');\n");
  assert.deepEqual(buildsFor(['content/config/ui/tokens.json'], root), ['tools/config-build.mjs']);
  assert.deepEqual(buildsFor(['styles/a.css'], root), []);
  const { app } = await boot(t, root);
  nextEvent.onOpen = async () => { await new Promise((r) => setTimeout(r, 300)); await fs.writeFile(path.join(root, 'content/config/ui/tokens.json'), '{}\n'); };
  const event = await nextEvent(app, 'reload');
  assert.deepEqual(event.files, ['content/config/ui/tokens.json'], 'the generated output does not trigger a second batch');
  assert.deepEqual(event.built, ['tools/config-build.mjs']);
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), "console.error('bad config'); process.exit(1);\n");
  nextEvent.onOpen = async () => { await new Promise((r) => setTimeout(r, 900)); await fs.writeFile(path.join(root, 'content/config/ui/tokens.json'), '{"x":1}\n'); };
  const failed = await nextEvent(app, 'reload-failed');
  assert.match(failed.output, /bad config/);
});

test('settings: checkouts are validated; the art checkout is served read-only on the preview origin only', async (t) => {
  const root = await project(t);
  const art = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-art-')));
  t.after(() => fs.rm(art, { recursive: true, force: true }));
  await fs.mkdir(path.join(art, 'enemy-poses'), { recursive: true });
  await fs.writeFile(path.join(art, 'enemy-poses/index.html'), '<!doctype html><title>Poses</title>');
  await fs.writeFile(path.join(root, 'secret.txt'), 'no');
  const { app, call } = await boot(t, root, { env: {} });
  const post = (body) => call('/api/settings', { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await post({ artCheckout: 'relative/path' })).status, 400);
  assert.equal((await post({ artCheckout: path.join(art, 'missing') })).status, 400);
  assert.equal((await post({ editorUrl: 'https://example.com' })).status, 400, 'only loopback URLs can be framed');
  const lib0 = await (await call('/api/library')).json();
  const unset = lib0.entries.find((e) => e.id === 'art-enemy-poses');
  assert.equal(unset.configured, false); assert.equal(unset.exists, false);
  assert.equal((await post({ artCheckout: art })).status, 200);
  const saved = await (await call('/api/settings')).json();
  assert.equal(saved.artCheckout, art);
  const entry = (await (await call('/api/library')).json()).entries.find((e) => e.id === 'art-enemy-poses');
  assert.equal(entry.exists, true, 'art/ prefix is optional inside the checkout');
  assert.match(entry.url, /^http:\/\/localhost:\d+\/ext\/art\/enemy-poses\/index\.html$/);
  const redirect = await fetch(`${app.url}/ext/art/enemy-poses/index.html`, { redirect: 'manual' });
  assert.equal(redirect.status, 302, 'never served on the Workbench origin');
  const page = await fetch(entry.url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await fetch(`${entry.url.replace(/ext\/art\/.*/, '')}ext/art/..%2Fsecret.txt`)).status, 403);
  assert.equal((await fetch(`${entry.url.replace(/ext\/art\/.*/, '')}api/session`)).status, 403, 'the preview origin cannot reach the API');
});

test('the CLI starts with --no-children and --no-open on a free port and exits on SIGTERM', async (t) => {
  const root = await project(t);
  const child = spawn(process.execPath, [path.join(HERE, '../server.mjs'), '--project', root, '--port', '0', '--no-children', '--no-open'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGKILL'));
  const url = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (d) => { out += d; const m = out.match(/Workbench: (http:\/\/127\.0\.0\.1:\d+)/); if (m) resolve(m[1]); });
    child.on('exit', (c) => reject(Error(`exited ${c}`)));
  });
  assert.equal((await fetch(`${url}/api/session`)).status, 200);
  const exited = new Promise((r) => child.on('exit', r));
  child.kill('SIGTERM');
  await exited;
});
