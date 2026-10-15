// node --test workbench/tests/server.test.mjs — the Workbench server against a
// disposable project planted under os.tmpdir(), started with children off.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createWorkbench, listPreviews, projectStateDir, migrateLegacyState } from '../server.mjs';
import { safePath, refusedPath, createGate } from '../lib/index.mjs';
import { JOBS, JobRunner, GENERATED, killTree } from '../core/jobs.mjs';
import { Settings } from '../core/settings.mjs';
import { Tool, toolDefs } from '../core/tools.mjs';
import { buildsFor, isBuildOutput } from '../core/watch.mjs';
import { resolveExternal } from '../core/settings.mjs';
import { serve } from '../../tools/serve.mjs';
import { manifestTables, manifestSummary, EXPORT_FORMAT } from '../ui/logic.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// t.after hooks run in the order they were added, and a hook that throws skips the rest. A process
// or watcher that holds a project folder (on Windows, a child whose cwd is in it) is stopped with
// beforeRemove, so it is gone before project() removes the folder, and a failed removal cannot
// skip the stop and leave it running (the test file would then never exit).
const stopsFor = new WeakMap();
function beforeRemove(t, stop) {
  const stops = stopsFor.get(t);
  if (stops) stops.push(stop); else t.after(stop);
}

async function project(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-test-')));
  if (!stopsFor.has(t)) {
    const stops = [];
    stopsFor.set(t, stops);
    t.after(async () => { for (const stop of stops.splice(0).reverse()) await stop(); });
  }
  // Windows can hold the folder for a moment after a watcher or child closes: retry the removal.
  t.after(() => fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
  for (const d of ['content/source', 'content/config/ui', 'src', 'styles']) await fs.mkdir(path.join(root, d), { recursive: true });
  await fs.writeFile(path.join(root, 'styles/main.css'), 'body{}\n');
  await fs.writeFile(path.join(root, 'cards-preview.html'), '<!doctype html><title>Cards &amp; more</title>');
  await fs.writeFile(path.join(root, 'tooltip-review-x.html'), '<!doctype html><title>Tips</title>');
  await fs.writeFile(path.join(root, 'notes.html'), '<!doctype html><title>Not a preview</title>');
  return root;
}

async function boot(t, root, extra = {}) {
  const app = await createWorkbench({ root, port: 0, children: false, stateDir: path.join(root, '.wb-state'), debounceMs: 120, ...extra });
  beforeRemove(t, () => app.close());
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

test('profile validation uses the shared resolver and reports author path errors', async (t) => {
  const root = await project(t);
  const { call } = await boot(t, root);
  const author = JSON.parse(await fs.readFile(new URL('../../games/ashenspire/game.json', import.meta.url), 'utf8'));
  const post = (path, data) => call(path, { method: 'POST', body: JSON.stringify(data) });
  const valid = await post('/api/game-profile/validate', { author });
  assert.equal(valid.status, 200);
  const resolved = await valid.json();
  assert.equal(resolved.valid, true);
  assert.equal(resolved.id, 'core');
  assert.match(resolved.hash, /^sha256:/);
  assert.ok(resolved.modules.cards);

  const invalid = await post('/api/game-profile/validate', { author: { formatVersion: 1, core: 'missing.bundle@1', modules: {} } });
  assert.equal(invalid.status, 422);
  const problem = await invalid.json();
  assert.ok(problem.problems[0].message);
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
  assert.deepEqual(JOBS['content-build'].steps(root).map((st) => st.args[0]), ['tools/framework-data-build.mjs', 'tools/content-build.mjs']);
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
  const saved = JSON.parse(await fs.readFile(path.join(projectStateDir(root, path.join(root, '.wb-state')), 'jobs.json'), 'utf8'));
  assert.equal(saved.length, 2);
  assert.match(saved[0].log, /built/);
});

test('engine export: the real exporter runs as a job, and its manifest and files are served read-only', async (t) => {
  const root = await project(t);
  // The job runs tools/engine-export.mjs in the project. Plant a shim that runs
  // the repository's real exporter, narrowed to two tables so it stays fast.
  const exporter = path.resolve(HERE, '../../tools/engine-export.mjs');
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/engine-export.mjs'), `import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, [${JSON.stringify(exporter)}, ...process.argv.slice(2), '--only', 'content.cards,content.enemies'], { stdio: 'inherit' });
process.exit(r.status ?? 1);\n`);
  const { app, call } = await boot(t, root);
  const { defs } = await (await call('/api/jobs')).json();
  assert.equal(defs.find((d) => d.id === 'engine-export').available, true);
  const started = await (await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'engine-export' }) })).json();
  for (let i = 0; i < 600 && app.jobs.active.size; i++) await new Promise((r) => setTimeout(r, 50));
  const run = await (await call(`/api/jobs/runs/${started.runId}`)).json();
  assert.equal(run.status, 'passed', run.log);
  assert.match(run.log, /engine-export: OK — 2 tables/);

  const body = await (await call('/api/export/manifest')).json();
  assert.equal(body.exists, true);
  const m = body.manifest;
  assert.equal(m.format, EXPORT_FORMAT);
  const tables = manifestTables(m);
  assert.deepEqual(tables.map((x) => x.name), ['content.cards', 'content.enemies']);
  assert.equal(manifestSummary(m).known, true);
  for (const table of tables) {
    assert.ok(table.rows > 0, `${table.name} has rows`);
    const data = await fetch(`${app.url}/export/${table.json}`);
    assert.equal(data.status, 200, table.json);
    assert.match(data.headers.get('content-type'), /json/);
    assert.match(data.headers.get('content-security-policy'), /sandbox/);
    assert.equal((await data.json()).length, table.rows);
    const schema = await fetch(`${app.url}/export/${table.schema}`);
    assert.equal(schema.status, 200, table.schema);
    assert.equal((await schema.json()).type, 'array');
  }
  assert.equal((await fetch(`${app.url}/export/manifest.json`)).status, 200);
  for (const p of ['../package.json', '%2e%2e/package.json', 'tables/../../x.json']) assert.notEqual((await fetch(`${app.url}/export/${p}`)).status, 200, p);
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
    const files = (evs) => [...new Set(evs.flatMap((e) => e.files))].sort();
    const reloads = await collectEvents(app, 'reload', (evs) => files(evs).length >= 2, {
      onOpen: async () => {
        await new Promise((r) => setTimeout(r, 300));
        await fs.writeFile(path.join(root, 'styles/main.css'), 'body{color:red}\n');
        await fs.writeFile(path.join(root, 'src/new.js'), 'export {};\n');
      },
    });
    assert.deepEqual(files(reloads), ['src/new.js', 'styles/main.css']);
    // On macOS each watched folder has its own FSEvents stream, and one can deliver after the
    // debounce, so the two writes may land in two batches. Elsewhere they are one batch.
    if (process.platform !== 'darwin') assert.equal(reloads.length, 1, 'both writes are one batch');
    const event = reloads[0];
    assert.equal(event.count, event.files.length);
    assert.deepEqual(event.built, []);
    // When the batch's file set was fixed: a save sent after this cannot be the save this build answers.
    assert.equal(typeof event.startedAt, 'number');
    assert.ok(event.startedAt <= event.at);
  });
}

test('a file renamed into place keeps reloading on later in-place edits (watch)', async (t) => {
  // Regression: a recursive fs.watch went silent for a file once a rename had written it.
  const root = await project(t);
  const { app } = await boot(t, root);
  let edited = false;
  const reloads = await collectEvents(app, 'reload', (evs) => evs.length >= 2, {
    onOpen: async () => {
      await new Promise((r) => setTimeout(r, 300));
      await fs.writeFile(path.join(root, 'styles/tmp-source.css'), 'a{}\n');
      await fs.rename(path.join(root, 'styles/tmp-source.css'), path.join(root, 'styles/main.css'));
    },
    onEvent: async (name) => {
      if (name !== 'reload' || edited) return;
      edited = true;
      await new Promise((r) => setTimeout(r, 400));
      await fs.writeFile(path.join(root, 'styles/main.css'), 'body{color:green}\n');
    },
  });
  // macOS may deliver the renamed-away name late, into the next batch; it is no longer on disk.
  assert.deepEqual(reloads.at(-1).files.filter((f) => f !== 'styles/tmp-source.css'), ['styles/main.css'], 'the in-place edit after the rename is its own batch');
});

test('a content/config change runs the config compiler before the reload; a failing build reports instead', async (t) => {
  const root = await project(t);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), "import fs from 'node:fs'; fs.mkdirSync('src/config/generated', { recursive: true }); fs.writeFileSync('src/config/generated/ui.js', 'export default 1;\\n');\n");
  assert.deepEqual(buildsFor(['content/config/ui/tokens.json'], root), ['tools/config-build.mjs']);
  assert.deepEqual(buildsFor(['styles/a.css'], root), []);
  await fs.writeFile(path.join(root, 'tools/framework-data-build.mjs'), '\n');
  assert.deepEqual(buildsFor(['content/source/a.csv', 'content/framework/new.json', 'content/config/ui/tokens.json'], root),
    ['tools/framework-data-build.mjs', 'tools/config-build.mjs', 'tools/content-build.mjs'], 'framework mirrors and config before the content compiler');
  assert.deepEqual(buildsFor(['content/source/a.csv'], root), ['tools/content-build.mjs']);
  await fs.writeFile(path.join(root, 'tools/game-config.mjs'), '');
  assert.deepEqual(buildsFor(['games/ashenspire/game.json'], root), ['tools/game-config.mjs build']);
  assert.deepEqual(buildsFor(['games/ashenspire/presets/current.json'], root), ['tools/game-config.mjs build']);
  await fs.rm(path.join(root, 'tools/framework-data-build.mjs'));
  const { app } = await boot(t, root);
  nextEvent.onOpen = async () => { await new Promise((r) => setTimeout(r, 300)); await fs.writeFile(path.join(root, 'content/config/ui/tokens.json'), '{}\n'); };
  const event = await nextEvent(app, 'reload');
  assert.deepEqual(event.files, ['content/config/ui/tokens.json'], 'the generated output does not trigger a second batch');
  assert.deepEqual(event.built, ['tools/config-build.mjs']);
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), "console.error('bad config'); process.exit(1);\n");
  nextEvent.onOpen = async () => { await new Promise((r) => setTimeout(r, 900)); await fs.writeFile(path.join(root, 'content/config/ui/tokens.json'), '{"x":1}\n'); };
  const failed = await nextEvent(app, 'reload-failed');
  assert.match(failed.output, /bad config/);
  assert.equal(typeof failed.startedAt, 'number');
});

/** Every `name` event until `done(events)` is true; `onEvent(name, data)` sees each event of any name as it arrives. */
async function collectEvents(app, name, done, { onEvent, onOpen, timeoutMs = 8000 } = {}) {
  const res = await fetch(`${app.url}/api/events?token=${app.token}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  const events = []; let buffer = ''; let pending = null; let opened = false;
  try {
    while (Date.now() < deadline) {
      pending ||= reader.read();
      const result = await Promise.race([pending, new Promise((r) => setTimeout(() => r(null), 100))]);
      if (result) pending = null;
      if (result && result.done) break;
      if (result && result.value) buffer += decoder.decode(result.value, { stream: true });
      const frames = buffer.split('\n\n'); buffer = frames.pop();
      for (const frame of frames) {
        const ev = frame.match(/^event: (.+)$/m); const data = frame.match(/^data: (.+)$/m);
        if (!ev || !data) continue;
        const parsed = JSON.parse(data[1]);
        if (onEvent) await onEvent(ev[1], parsed);
        if (ev[1] === name) { events.push(parsed); if (done(events)) return events; }
      }
      if (!opened && onOpen) { opened = true; await onOpen(); }
    }
    throw Error(`${name} events so far: ${JSON.stringify(events)}`);
  } finally { reader.cancel().catch(() => {}); }
}

test('an edit made while a build runs is kept for the next reload; only the build output is ignored', async (t) => {
  assert.equal(isBuildOutput('src/config/generated/ui.js'), true);
  assert.equal(isBuildOutput('src/content/generated/cards.js'), true);
  assert.equal(isBuildOutput('src/framework/data/properties.js'), true);
  assert.equal(isBuildOutput('src/config/generated'), true);
  assert.equal(isBuildOutput('src/game.js'), false);
  assert.equal(isBuildOutput('content/config/ui/tokens.json'), false);
  const root = await project(t);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  // A slow config build: the second edit lands while it is still running.
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), "import fs from 'node:fs'; await new Promise((r) => setTimeout(r, 1200)); fs.mkdirSync('src/config/generated', { recursive: true }); fs.writeFileSync('src/config/generated/ui.js', 'export default ' + Date.now() + ';\\n');\n");
  const { app } = await boot(t, root);
  let edited = false;
  const reloads = await collectEvents(app, 'reload', (evs) => evs.some((e) => e.files.includes('styles/second.css')), {
    onOpen: async () => { await new Promise((r) => setTimeout(r, 300)); await fs.writeFile(path.join(root, 'content/config/ui/tokens.json'), '{}\n'); },
    onEvent: async (name) => {
      if (name !== 'building' || edited) return;
      edited = true;
      await new Promise((r) => setTimeout(r, 300));
      await fs.writeFile(path.join(root, 'styles/second.css'), 'p{}\n');
    },
  });
  assert.equal(edited, true);
  assert.deepEqual(reloads[0].files, ['content/config/ui/tokens.json']);
  assert.deepEqual(reloads[0].built, ['tools/config-build.mjs']);
  assert.ok(reloads.at(-1).files.includes('styles/second.css'), 'the edit made during the build reloads');
  for (const r of reloads) assert.ok(!r.files.some(isBuildOutput), `no batch carries the build's own output: ${r.files}`);
});

test('generated output written by another process reloads once that process frees the build lock, not before', async (t) => {
  const root = await project(t);
  const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  t.after(() => other.kill());
  const lock = path.join(root, '.build-lock');
  await fs.writeFile(lock, JSON.stringify({ pid: other.pid, holder: 'Editor content build', startedAt: Date.now(), token: 'x' }));
  const gen = path.join(root, 'src/content/generated');
  await fs.mkdir(gen, { recursive: true });
  const { app } = await boot(t, root);
  let freedAt = 0;
  const reloads = await collectEvents(app, 'reload', (evs) => evs.length >= 1, {
    onOpen: async () => {
      await new Promise((r) => setTimeout(r, 300));
      await fs.writeFile(path.join(gen, 'cards.js'), 'export const cards = [];\n');
      await new Promise((r) => setTimeout(r, 800));
      await fs.writeFile(path.join(gen, 'enemies.js'), 'export const enemies = [];\n'); // the writer is still going
      await new Promise((r) => setTimeout(r, 800));
      assert.equal(app.reloads, 0, 'no reload while the writer holds the lock');
      freedAt = Date.now();
      await fs.rm(lock);
    },
  });
  assert.ok(freedAt > 0 && reloads[0].at >= freedAt, 'reloaded after the lock was freed');
  assert.deepEqual(reloads[0].files, ['src/content/generated/cards.js', 'src/content/generated/enemies.js'], 'one reload for the whole write');
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(app.reloads, 1);
});

test('a reload waiting on a build lock that is never freed reports reload-failed', async (t) => {
  const root = await project(t);
  const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  t.after(() => other.kill());
  await fs.writeFile(path.join(root, '.build-lock'), JSON.stringify({ pid: other.pid, holder: 'UI Studio config compile', startedAt: Date.now(), token: 'x' }));
  await fs.mkdir(path.join(root, 'src/config/generated'), { recursive: true });
  const { app } = await boot(t, root, { lockWaitMs: 600 });
  nextEvent.onOpen = async () => {
    await new Promise((r) => setTimeout(r, 300));
    await fs.writeFile(path.join(root, 'src/config/generated/ui.js'), 'export default 1;\n');
  };
  const failed = await nextEvent(app, 'reload-failed');
  assert.deepEqual(failed.files, ['src/config/generated/ui.js']);
  assert.match(failed.output, /UI Studio config compile is running/);
  assert.equal(app.reloads, 0);
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
  assert.equal((await fetch(entry.url, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403, 'another website cannot load art files');
});

test('art files under /ext/art/: an SVG, PNG or JSON gets the strict CSP; an HTML page keeps its own headers', async (t) => {
  const root = await project(t);
  const art = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-art-csp-')));
  t.after(() => fs.rm(art, { recursive: true, force: true }));
  await fs.mkdir(path.join(art, 'icons'), { recursive: true });
  await fs.mkdir(path.join(art, 'enemy-poses'), { recursive: true });
  await fs.writeFile(path.join(art, 'enemy-poses/index.html'), '<!doctype html><title>Poses</title>');
  await fs.writeFile(path.join(art, 'icons/bad.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  await fs.writeFile(path.join(art, 'icons/pic.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  await fs.writeFile(path.join(art, 'icons/data.json'), '{"a":1}\n');
  await fs.writeFile(path.join(art, 'icons/page.html'), '<!doctype html><title>Tool</title><script src="tool.js"></script>');
  const { call } = await boot(t, root, { env: {} });
  assert.equal((await call('/api/settings', { method: 'POST', body: JSON.stringify({ artCheckout: art }) })).status, 200);
  const entry = (await (await call('/api/library')).json()).entries.find((e) => e.id === 'art-enemy-poses');
  const base = entry.url.replace(/ext\/art\/.*/, 'ext/art/');
  const strict = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  for (const name of ['icons/bad.svg', 'icons/pic.png', 'icons/data.json']) {
    const res = await fetch(`${base}${name}`);
    assert.equal(res.status, 200, name);
    assert.equal(res.headers.get('content-security-policy'), strict, `${name} gets the strict policy`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', `${name} is nosniff`);
  }
  const page = await fetch(`${base}icons/page.html`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /^sandbox allow-scripts allow-same-origin /, 'the HTML page keeps its sandbox');
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'self' http:\/\/127\.0\.0\.1:\d+/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
});

test('a cancelled job keeps its slot until its process, and what it started, has exited', async (t) => {
  const root = await project(t);
  const { app, call } = await boot(t, root);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  // The step ignores SIGTERM for a moment and starts a grandchild, as launch.mjs does.
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), "import { spawn } from 'node:child_process'; import fs from 'node:fs'; const g = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); fs.writeFileSync('grandchild.pid', String(g.pid)); process.on('SIGTERM', () => setTimeout(() => process.exit(0), 300)); setInterval(() => {}, 1000);\n");
  const started = await (await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'config-build' }) })).json();
  for (let i = 0; i < 100; i++) { try { await fs.access(path.join(root, 'grandchild.pid')); break; } catch { await new Promise((r) => setTimeout(r, 30)); } }
  const pid = Number(await fs.readFile(path.join(root, 'grandchild.pid'), 'utf8'));
  const cancelled = app.jobs.cancel(started.runId);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(app.jobs.active.has('config-build'), true, 'the slot is held while the step is still exiting');
  for (let i = 0; i < 100 && app.jobs.active.size; i++) await new Promise((r) => setTimeout(r, 30));
  assert.equal(app.jobs.active.size, 0, 'freed once the step exited');
  if (process.platform !== 'win32') {
    let alive = true;
    for (let i = 0; i < 50 && alive; i++) { try { process.kill(pid, 0); await new Promise((r) => setTimeout(r, 30)); } catch { alive = false; } }
    assert.equal(alive, false, 'the grandchild was stopped with its group');
  }
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

test('two Restart presses at once spawn one child, not an orphaned second', async () => {
  const tool = new Tool({ id: 'x', name: 'X', port: 1, host: '127.0.0.1', path: '/' }, { root: '.' });
  let spawned = 0;
  tool.probe = async () => { await new Promise((r) => setTimeout(r, 20)); return false; };
  tool.spawn = () => { spawned++; tool.child = { kill() {}, once() {} }; };
  await Promise.all([tool.restart(), tool.restart(), tool.start()]);
  assert.equal(spawned, 1);
});

test('Pose & FX is started on the Workbench project, and serves that project', async (t) => {
  const root = await project(t);
  const pose = toolDefs({ repo: path.resolve(HERE, '../..'), root, origin: 'http://127.0.0.1:1' }).find((d) => d.id === 'pose');
  const args = pose.command(4318);
  assert.equal(args[0], path.resolve(HERE, '../../pose-studio/server.mjs'));
  assert.deepEqual(args.slice(1), ['--project', root]);
  assert.deepEqual(pose.env(4318), { POSE_STUDIO_PORT: '4318' });
  await fs.mkdir(path.join(root, 'pose-studio'), { recursive: true });
  await fs.writeFile(path.join(root, 'pose-studio/index.html'), '<!doctype html><title>project copy</title>');
  const child = spawn(process.execPath, [...args], { env: { ...process.env, ...pose.env(0) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGKILL'));
  const url = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (d) => { out += d; const m = out.match(/ready: (http:\/\/127\.0\.0\.1:\d+\/pose-studio\/index\.html)/); if (m) resolve(m[1]); });
    child.on('exit', (c) => reject(Error(`exited ${c}`)));
  });
  assert.match(await (await fetch(url)).text(), /project copy/);
});

test('start.sh reuses a running Workbench only for the same project', { skip: process.platform === 'win32' || spawnSync('curl', ['--version']).status !== 0 }, async (t) => {
  const root = await project(t);
  const other = await project(t);
  const { app } = await boot(t, root);
  const port = String(new URL(app.url).port);
  const start = (...args) => new Promise((resolve) => {
    const child = spawn('sh', [path.join(HERE, '../start.sh'), '--port', port, '--no-open', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => resolve({ code, out }));
  });
  const same = await start('--project', root);
  assert.equal(same.code, 0, same.out);
  assert.match(same.out, /already running/);
  const mismatch = await start('--project', other);
  assert.equal(mismatch.code, 1, mismatch.out);
  assert.match(mismatch.out, /another project/);
  assert.ok(mismatch.out.includes(root), 'names the project it is serving');
});

test('the game server is reused only when it names this project as its root', async (t) => {
  const root = await project(t);
  const other = await project(t);
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><title>game</title>');
  await fs.writeFile(path.join(other, 'index.html'), '<!doctype html><title>other game</title>');
  const game = toolDefs({ repo: path.resolve(HERE, '../..'), root, origin: 'http://127.0.0.1:1' }).find((d) => d.id === 'game');
  const probeOn = async (port) => {
    const tool = new Tool({ ...game, port }, { root, origin: 'http://127.0.0.1:1' });
    return { ok: await tool.probe(), conflict: tool.conflict };
  };
  // tools/serve.mjs says which folder it serves, to loopback clients only.
  const mine = await serve({ root, port: 0, open: false, quiet: true });
  const theirs = await serve({ root: other, port: 0, open: false, quiet: true });
  t.after(() => { mine.server.close(); theirs.server.close(); });
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${mine.port}/__serve/info`)).json(), { root });
  const { createServer, get: httpGet } = await import('node:http');
  const foreignHost = await new Promise((resolve, reject) => httpGet({ host: '127.0.0.1', port: mine.port, path: '/__serve/info', headers: { host: 'evil.example' } }, (r) => { r.resume(); resolve(r.statusCode); }).on('error', reject));
  assert.equal(foreignHost, 403, 'a rebinding host name is refused');
  assert.deepEqual(await probeOn(mine.port), { ok: true, conflict: null });
  const mismatch = await probeOn(theirs.port);
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.conflict, /serving another checkout/);
  assert.ok(mismatch.conflict.includes(other));
  // A server that answers /index.html but does not identify itself is not reused either.
  const anon = createServer((req, res) => { res.writeHead(req.url === '/index.html' ? 200 : 404); res.end('ok'); });
  await new Promise((r) => anon.listen(0, '127.0.0.1', r));
  t.after(() => anon.close());
  const unknown = await probeOn(anon.address().port);
  assert.equal(unknown.ok, false);
  assert.match(unknown.conflict, /does not say which checkout/);
});

test('the game server the Workbench starts listens on loopback only, never on the LAN', async (t) => {
  const root = await project(t);
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><title>game</title>');
  const game = toolDefs({ repo: path.resolve(HERE, '../..'), root, origin: 'http://127.0.0.1:1' }).find((d) => d.id === 'game');
  const args = game.command(0);
  const at = args.indexOf('--host');
  assert.ok(at > 0, 'the command line passes --host');
  assert.equal(args[at + 1], 'localhost');
  // Run the Workbench's own command line and read the port from its log, as the supervisor does.
  const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  beforeRemove(t, async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const gone = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await gone;
  });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (d) => { out += d; const m = out.match(game.portFrom); if (m) resolve(Number(m[1])); });
    child.on('exit', (code) => reject(Error(`serve exited ${code}: ${out}`)));
  });
  for (const host of ['127.0.0.1', 'localhost']) assert.equal((await fetch(`http://${host}:${port}/index.html`)).status, 200, host);
  const lan = Object.values(os.networkInterfaces()).flat().find((a) => a && !a.internal && a.family === 'IPv4');
  if (!lan) { t.diagnostic('no non-loopback IPv4 interface: LAN reachability not checked'); return; }
  const reached = await fetch(`http://${lan.address}:${port}/index.html`, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);
  assert.equal(reached, false, `not reachable on ${lan.address}`);
  // Without --host serve.mjs still listens everywhere (LAN play and existing callers rely on it).
  const open = await serve({ root, port: 0, open: false, quiet: true });
  t.after(() => open.server.close());
  assert.equal((await fetch(`http://${lan.address}:${open.port}/index.html`)).status, 200, 'the default bind is unchanged');
});

test('the Content Editor and Pose Studio are reused only when they name this project', async (t) => {
  const root = await project(t);
  const other = await project(t);
  const defs = toolDefs({ repo: path.resolve(HERE, '../..'), root, origin: 'http://127.0.0.1:1' });
  const { createServer } = await import('node:http');
  const stub = async (handler) => { const s = createServer(handler); await new Promise((r) => s.listen(0, '127.0.0.1', r)); t.after(() => s.close()); return s.address().port; };
  const probeOn = async (id, port) => { const tool = new Tool({ ...defs.find((d) => d.id === id), port }, { root, origin: 'http://127.0.0.1:1' }); return { ok: await tool.probe(), conflict: tool.conflict }; };
  const editorFor = (r) => stub((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r === undefined ? { token: 't' } : { token: 't', root: r })); });
  assert.equal((await probeOn('editor', await editorFor(root))).ok, true);
  assert.match((await probeOn('editor', await editorFor(other))).conflict, /serving another checkout/);
  assert.match((await probeOn('editor', await editorFor(undefined))).conflict, /does not say which checkout/);
  const poseFor = (r) => stub((req, res) => { if (req.url === '/__serve/info') { if (r === undefined) { res.writeHead(404); return res.end(); } res.writeHead(200); return res.end(JSON.stringify({ root: r })); } res.writeHead(200); res.end('ok'); });
  assert.equal((await probeOn('pose', await poseFor(root))).ok, true);
  assert.match((await probeOn('pose', await poseFor(other))).conflict, /serving another checkout/);
  assert.match((await probeOn('pose', await poseFor(undefined))).conflict, /does not say which checkout/);
  // The real Pose Studio server says which checkout it serves, to loopback clients only.
  const { handler } = await import('../../pose-studio/server.mjs');
  const port = await stub(handler);
  const info = await (await fetch(`http://127.0.0.1:${port}/__serve/info`)).json();
  assert.equal(typeof info.root, 'string');
});

test('external entries resolve under a checkout given with a trailing separator', async (t) => {
  const art = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-art-')));
  t.after(() => fs.rm(art, { recursive: true, force: true }));
  await fs.mkdir(path.join(art, 'enemy-poses'), { recursive: true });
  await fs.writeFile(path.join(art, 'enemy-poses/index.html'), '<!doctype html>');
  const entry = { path: 'art/enemy-poses/index.html', pathPrefixOptional: 'art/' };
  assert.equal(resolveExternal(entry, art), 'enemy-poses/index.html');
  assert.equal(resolveExternal(entry, `${art}${path.sep}`), 'enemy-poses/index.html');
  assert.equal(resolveExternal({ path: '../outside.html' }, `${art}${path.sep}`), null);
});

test('jobs that write the same generated files never run at the same time', async (t) => {
  const root = await project(t);
  const { app, call } = await boot(t, root);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), 'setTimeout(() => {}, 400);\n');
  await fs.writeFile(path.join(root, 'tools/content-build.mjs'), '\n');
  assert.equal((await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'config-build' }) })).status, 200);
  const blocked = await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'content-build' }) });
  assert.equal(blocked.status, 409);
  assert.match((await blocked.json()).error, /Config build is running/);
  for (const id of ['engine-export', 'build-only']) assert.equal((await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id }) })).status, 409, id);
  for (let i = 0; i < 100 && app.jobs.active.size; i++) await new Promise((r) => setTimeout(r, 30));
  assert.equal((await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'content-build' }) })).status, 200, 'free once it finishes');
});

test('a port conflict clears once the foreign server stops, so Restart can recover', async () => {
  const tool = new Tool({ id: 'x', name: 'X', port: 1, host: '127.0.0.1', path: '/', health: '/' }, { root: '.' });
  tool.conflict = 'Port 1 is serving another checkout (/elsewhere)';
  assert.equal(await tool.probe(), false, 'nothing answers on port 1');
  assert.equal(tool.conflict, null);
});

test('a live-reload build waits for a job holding the generated-files lock, and blocks one in turn', async (t) => {
  const root = await project(t);
  const runner = new JobRunner({ root, stateFile: path.join(root, '.wb-state/jobs.json') });
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), 'setTimeout(() => {}, 300);\n');
  runner.start('config-build');
  let acquired = false;
  const waiting = runner.acquire(GENERATED, 'A live-reload build').then(() => { acquired = true; });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(acquired, false, 'waits while the job runs');
  await waiting;
  assert.equal(runner.active.size, 0, 'acquired only after the job finished');
  assert.throws(() => runner.start('content-build'), /A live-reload build is running/);
  runner.release(GENERATED);
  await fs.writeFile(path.join(root, 'tools/content-build.mjs'), '\n');
  const rerun = runner.start('content-build');
  assert.equal(rerun.status, 'running');
  // The run persists .wb-state/jobs.json when it ends. Wait for that: a write that lands while the
  // teardown removes the temp dir makes rmdir fail with ENOTEMPTY.
  for (let i = 0; i < 200 && runner.active.size; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(runner.get(rerun.runId).status, 'passed', runner.get(rerun.runId).log);
});

test('a job\'s builder that takes the lock itself runs under the job\'s hold, not into a deadlock', async (t) => {
  const root = await project(t);
  const runner = new JobRunner({ root, stateFile: path.join(root, '.wb-state/jobs.json') });
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  const lib = pathToFileURL(path.resolve(HERE, '../../tools/lib/build-lock.mjs')).href;
  // A writer CLI as the real ones are: it holds the lock while it writes, waiting at most 1 s.
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), `import { holdForCli } from ${JSON.stringify(lib)};\nprocess.env.ASHEN_BUILD_LOCK_WAIT_MS = '1000';\nawait holdForCli(process.cwd(), 'config-build');\nconsole.log('built');\n`);
  const run = runner.start('config-build');
  for (let i = 0; i < 200 && runner.active.size; i++) await new Promise((r) => setTimeout(r, 20));
  const done = runner.get(run.runId);
  assert.equal(done.status, 'passed', done.log);
  assert.doesNotMatch(done.log, /waiting for/);
});

test('a setting saved empty stays empty instead of falling back to its default', async (t) => {
  const root = await project(t);
  const settings = new Settings(path.join(root, '.wb-state/settings.json'), { ASHEN_ART_CHECKOUT: root });
  assert.equal(settings.read().artCheckout, root, 'the environment fills it by default');
  settings.save({ artCheckout: '', editorUrl: '' });
  const again = new Settings(path.join(root, '.wb-state/settings.json'), { ASHEN_ART_CHECKOUT: root }).read();
  assert.equal(again.artCheckout, '');
  assert.equal(again.editorUrl, '');
});

test('on Windows a cancel kills the whole process tree with taskkill /T', () => {
  const calls = []; let killed = false;
  const child = { pid: 4242, exitCode: null, signalCode: null, kill() { killed = true; } };
  killTree(child, { platform: 'win32', run: (cmd, args) => { calls.push([cmd, ...args]); return { status: 0 }; } });
  assert.deepEqual(calls, [['taskkill', '/pid', '4242', '/T', '/F']]);
  assert.equal(killed, false);
  killTree(child, { platform: 'win32', run: () => ({ status: 128 }) });
  assert.equal(killed, true, 'falls back to killing the step itself');
});

test('a generated-files lock held by another process (the editor, UI Studio) refuses generated jobs with 409 naming it', async (t) => {
  const root = await project(t);
  const { app, call } = await boot(t, root);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), '\n');
  const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  t.after(() => other.kill());
  const lock = path.join(root, '.build-lock');
  await fs.writeFile(lock, JSON.stringify({ pid: other.pid, holder: 'UI Studio config compile', startedAt: Date.now(), token: 'x' }));
  for (const id of ['content-build', 'config-build', 'build-only', 'engine-export']) {
    const blocked = await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id }) });
    assert.equal(blocked.status, 409, id);
    assert.match((await blocked.json()).error, /^UI Studio config compile is running; try again when it finishes/, id);
  }
  assert.equal(app.jobs.locks.size, 0, 'a refused start holds nothing');
  // A live-reload build waits for it, then holds the file lock itself.
  let acquired = false;
  const waiting = app.jobs.acquire(GENERATED, 'A live-reload build', { pollMs: 20 }).then(() => { acquired = true; });
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(acquired, false, 'waits while the other process holds it');
  await fs.rm(lock);
  await waiting;
  assert.equal(JSON.parse(await fs.readFile(lock, 'utf8')).holder, 'A live-reload build (Workbench)');
  app.jobs.release(GENERATED);
  await assert.rejects(fs.stat(lock), /ENOENT/);
  // A Workbench job holds the file lock while it runs and frees it after.
  assert.equal((await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'config-build' }) })).status, 200);
  assert.equal(JSON.parse(await fs.readFile(lock, 'utf8')).holder, 'Config build (Workbench)');
  for (let i = 0; i < 100 && app.jobs.active.size; i++) await new Promise((r) => setTimeout(r, 30));
  await assert.rejects(fs.stat(lock), /ENOENT/, 'released when the job finishes');
});

test('close() ends a live-reload build waiting for a foreign build lock at once; it starts nothing and takes no lock', async (t) => {
  const root = await project(t);
  const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  t.after(() => other.kill());
  const lock = path.join(root, '.build-lock');
  await fs.writeFile(lock, JSON.stringify({ pid: other.pid, holder: 'Editor content build', startedAt: Date.now(), token: 'theirs' }));
  await fs.mkdir(path.join(root, 'content/source'), { recursive: true });
  // A builder that leaves a marker when it runs: none may run while the lock is foreign.
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/content-build.mjs'), "import fs from 'node:fs'; fs.writeFileSync('built.marker', 'ran');\n");
  const { app } = await boot(t, root, { lockWaitMs: 60 * 1000 });
  // An authored source changed: the live-reload build is announced, then waits for the foreign lock.
  await collectEvents(app, 'building', () => true, {
    onOpen: async () => { await new Promise((r) => setTimeout(r, 200)); await fs.writeFile(path.join(root, 'content/source/items.csv'), 'id,name\nsword,Sword\n'); },
  });
  const started = Date.now();
  await app.close();
  assert.ok(Date.now() - started < 1000, 'close() did not wait out the build-lock wait');
  assert.equal(JSON.parse(await fs.readFile(lock, 'utf8')).token, 'theirs', 'their lock stands; no lock of ours was written');
  assert.equal(await fs.stat(path.join(root, 'built.marker')).then(() => true, () => false), false, 'the build never started');
});

test('JobRunner.acquire with an aborted signal ends an in-process or a cross-process wait at once, taking nothing', async (t) => {
  const root = await project(t);
  const runner = new JobRunner({ root, stateFile: path.join(root, '.wb-state/jobs.json') });
  await runner.acquire(GENERATED, 'A job');
  const ctl = new AbortController();
  const waiting = runner.acquire(GENERATED, 'A live-reload build', { timeoutMs: 60 * 1000, signal: ctl.signal });
  setTimeout(() => ctl.abort(new Error('The Workbench is closing')), 50);
  await assert.rejects(waiting, /The Workbench is closing/);
  assert.equal(runner.locks.get(GENERATED), 'A job', 'the in-process hold is still the job\'s');
  runner.release(GENERATED);
  // Free in this process, held by a foreign process: the file-lock wait ends the same way and leaves no lock of ours.
  const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  t.after(() => other.kill());
  await fs.writeFile(path.join(root, '.build-lock'), JSON.stringify({ pid: other.pid, holder: 'UI Studio config compile', startedAt: Date.now(), token: 'theirs' }));
  const ctl2 = new AbortController();
  const waiting2 = runner.acquire(GENERATED, 'A live-reload build', { timeoutMs: 60 * 1000, pollMs: 5000, signal: ctl2.signal });
  setTimeout(() => ctl2.abort(new Error('The Workbench is closing')), 50);
  await assert.rejects(waiting2, /The Workbench is closing/);
  assert.equal(runner.locks.has(GENERATED), false, 'nothing held here');
  assert.equal(JSON.parse(await fs.readFile(path.join(root, '.build-lock'), 'utf8')).token, 'theirs', 'their lock stands');
});

test('close() ends a save waiting for a foreign build lock at once: 503, nothing written, no lock of ours', async (t) => {
  const root = await project(t);
  const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  t.after(() => other.kill());
  const lock = path.join(root, '.build-lock');
  await fs.writeFile(lock, JSON.stringify({ pid: other.pid, holder: 'UI Studio config compile', startedAt: Date.now(), token: 'theirs' }));
  const { app } = await boot(t, root, { lockWaitMs: 60 * 1000 });
  const saving = fetch(`${app.url}/api/files/save`, {
    method: 'POST', headers: { 'x-studio-token': app.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: [{ path: 'styles/x.css', text: 'x{}\n', baseHash: null }] }),
  });
  await new Promise((r) => setTimeout(r, 200));
  const started = Date.now();
  await app.close();
  assert.ok(Date.now() - started < 1000, 'close() did not wait out the lock wait');
  assert.equal((await saving).status, 503);
  assert.equal(await fs.stat(path.join(root, 'styles/x.css')).then(() => true, () => false), false, 'nothing written');
  assert.equal(JSON.parse(await fs.readFile(lock, 'utf8')).token, 'theirs', 'their lock stands; ours was never taken');
});

test('close() waits for a save still writing, so its file is on disk when close resolves', async (t) => {
  const root = await project(t);
  const styles = path.join(root, 'styles/main.css');
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  let app = null; let closing = null; let onDiskAtClose = null; let enter = null;
  const entered = new Promise((resolve) => { enter = resolve; });
  // The save holds at its write seam while the Workbench is closed, as a save in flight would.
  app = await createWorkbench({
    root, port: 0, children: false, stateDir: path.join(root, '.wb-state'), debounceMs: 120,
    fileFault: async (rel) => {
      if (rel !== 'styles/main.css' || closing) return;
      enter();
      closing = app.close().then(async () => { onDiskAtClose = await fs.readFile(styles, 'utf8'); });
      await new Promise((r) => setTimeout(r, 150));
    },
  });
  beforeRemove(t, () => app.close());
  const saved = fetch(`${app.url}/api/files/save`, {
    method: 'POST', headers: { 'x-studio-token': app.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: [{ path: 'styles/main.css', text: 'body{color:red}\n', baseHash: sha('body{}\n') }] }),
  }).then((r) => r.status, (e) => e.message);
  await entered;
  await closing;
  assert.equal(onDiskAtClose, 'body{color:red}\n', 'the save landed before close resolved');
  assert.equal(await saved, 200);
});

test('closing the Workbench stops a live-reload build it started, so the build writes nothing after close resolves', async (t) => {
  const root = await project(t);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.mkdir(path.join(root, 'src/config'), { recursive: true });
  // The build announces itself, then would write its output a while later.
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), "import fs from 'node:fs'; fs.writeFileSync('started.txt', '1'); await new Promise((r) => setTimeout(r, 800)); fs.writeFileSync('src/config/late.js', 'export default 1;\\n');\n");
  const { app } = await boot(t, root);
  // macOS (FSEvents) starts delivering a moment after a watch is created: a write made at once can go unseen.
  await new Promise((r) => setTimeout(r, 500));
  await fs.writeFile(path.join(root, 'content/config/ui/tokens.json'), '{}\n');
  const exists = (rel) => fs.stat(path.join(root, rel)).then(() => true, () => false);
  for (let i = 0; i < 200 && !(await exists('started.txt')); i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(await exists('started.txt'), true, 'the live-reload build started');
  await app.close();
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(await exists('src/config/late.js'), false, 'the build was stopped before it could write');
});

test('close() stops a live-reload build whose grandchild ignores SIGTERM: it is dead, and writes nothing, once close resolves', { skip: process.platform === 'win32' }, async (t) => {
  const root = await project(t);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  // The build starts a grandchild that ignores SIGTERM and writes late.txt 700 ms in; the build itself dies on SIGTERM.
  const grandchild = "process.on('SIGTERM', () => {}); require('node:fs').writeFileSync('grandchild.pid', String(process.pid)); setTimeout(() => require('node:fs').writeFileSync('late.txt', 'late'), 700); setInterval(() => {}, 1000);";
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), `import { spawn } from 'node:child_process';\nspawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' });\nsetInterval(() => {}, 1000);\n`);
  const { app } = await boot(t, root);
  // macOS (FSEvents) starts delivering a moment after a watch is created: a write made at once can go unseen.
  await new Promise((r) => setTimeout(r, 500));
  await fs.writeFile(path.join(root, 'content/config/ui/tokens.json'), '{}\n');
  const exists = (rel) => fs.stat(path.join(root, rel)).then(() => true, () => false);
  for (let i = 0; i < 200 && !(await exists('grandchild.pid')); i++) await new Promise((r) => setTimeout(r, 20));
  const pid = Number(await fs.readFile(path.join(root, 'grandchild.pid'), 'utf8'));
  assert.ok(pid > 0, 'the live-reload build started its grandchild');
  await app.close();
  // Dead, or an unreaped zombie that can no longer run or write.
  const state = await fs.readFile(`/proc/${pid}/stat`, 'utf8').then((s) => (/\) Z /.test(s) ? 'zombie' : 'running'), () => 'gone');
  assert.notEqual(state, 'running', 'the grandchild is dead once close() resolves');
  const atClose = await exists('late.txt');
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(await exists('late.txt'), atClose, 'nothing was written after close() resolved');
  assert.equal(await exists('.build-lock'), false, 'the build lock is released once close() resolves');
});

test('a started job is persisted at once, so a restart before it finishes lists it as cancelled', async (t) => {
  const root = await project(t);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), 'setInterval(() => {}, 1000);\n');
  const stateFile = path.join(root, '.wb-state/jobs.json');
  const first = new JobRunner({ root, stateFile });
  beforeRemove(t, () => first.stopAll());
  const started = first.start('config-build');
  // The record is on disk while the job still runs.
  const onDisk = JSON.parse(await fs.readFile(stateFile, 'utf8'));
  assert.equal(onDisk[0].runId, started.runId);
  assert.equal(onDisk[0].status, 'running');
  // A new runner on the same state file (the Workbench restarted) reads it back as cancelled.
  const second = new JobRunner({ root, stateFile });
  const run = second.list().find((r) => r.runId === started.runId);
  assert.equal(run.status, 'cancelled');
  assert.equal(run.message, 'The Workbench stopped while this ran');
});

test('two projects that share a state dir keep separate backups and job history', async (t) => {
  const shared = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'wb-shared-')));
  t.after(() => fs.rm(shared, { recursive: true, force: true }));
  const stateDir = path.join(shared, 'state');
  const rootA = await project(t);
  const rootB = await project(t);
  for (const root of [rootA, rootB]) {
    await fs.mkdir(path.join(root, 'tools'), { recursive: true });
    await fs.writeFile(path.join(root, 'tools/config-build.mjs'), 'console.log("built");\n');
  }
  const appA = await createWorkbench({ root: rootA, port: 0, children: false, stateDir, debounceMs: 120 });
  const appB = await createWorkbench({ root: rootB, port: 0, children: false, stateDir, debounceMs: 120 });
  beforeRemove(t, () => appA.close());
  beforeRemove(t, () => appB.close());
  const get = (app, p) => fetch(`${app.url}${p}`, { headers: { 'x-studio-token': app.token } }).then((r) => r.json());
  const post = (app, p, body) => fetch(`${app.url}${p}`, { method: 'POST', headers: { 'x-studio-token': app.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // A saves a file and runs a job; B does neither.
  const save = await post(appA, '/api/files/save', { changes: [{ path: 'styles/main.css', text: 'a{}\n', baseHash: createHash('sha256').update('body{}\n').digest('hex') }] });
  assert.equal(save.status, 200);
  appA.jobs.start('config-build');
  for (let i = 0; i < 100 && appA.jobs.active.size; i++) await new Promise((r) => setTimeout(r, 20));

  assert.notEqual(projectStateDir(rootA, stateDir), projectStateDir(rootB, stateDir));
  assert.equal((await get(appA, '/api/files/backups')).backups.length, 1);
  assert.equal((await get(appB, '/api/files/backups')).backups.length, 0, 'B does not list A\'s backup');
  assert.equal((await get(appA, '/api/jobs')).runs.length, 1);
  assert.equal((await get(appB, '/api/jobs')).runs.length, 0, 'B does not list A\'s job history');
  assert.equal(await fs.readFile(path.join(rootB, 'styles/main.css'), 'utf8'), 'body{}\n', 'B\'s project is untouched');
});

test('legacy jobs.json and backups/ move into the project state dir once, and only when it is new', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-legacy-'));
  const root = path.join(base, 'project');
  const stateDir = path.join(base, 'state');
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(path.join(stateDir, 'backups', 'set-1'), { recursive: true });
  await fs.writeFile(path.join(stateDir, 'jobs.json'), '{"runs":[]}\n');
  await fs.writeFile(path.join(stateDir, 'backups', 'set-1', 'a.json'), '{}\n');
  await fs.writeFile(path.join(stateDir, 'settings.json'), '{}\n');
  const realRoot = await fs.realpath(root);
  const target = projectStateDir(realRoot, stateDir);

  assert.deepEqual(await migrateLegacyState(stateDir, target), ['jobs.json', 'backups']);
  assert.equal(await fs.readFile(path.join(target, 'jobs.json'), 'utf8'), '{"runs":[]}\n');
  assert.equal(await fs.readFile(path.join(target, 'backups', 'set-1', 'a.json'), 'utf8'), '{}\n');
  assert.equal(await fs.readFile(path.join(stateDir, 'settings.json'), 'utf8'), '{}\n', 'settings.json stays in stateDir');
  await assert.rejects(fs.stat(path.join(stateDir, 'jobs.json')), 'the legacy file moved, not copied');

  // Once the project has its own dir, a legacy file left behind is not moved in.
  await fs.writeFile(path.join(stateDir, 'jobs.json'), '{"runs":["other"]}\n');
  assert.deepEqual(await migrateLegacyState(stateDir, target), []);
  assert.equal(await fs.readFile(path.join(target, 'jobs.json'), 'utf8'), '{"runs":[]}\n', 'the project keeps its own history');
  await fs.rm(base, { recursive: true, force: true });
});

/** Saves styles/main.css through the file service, as the page does. */
async function saveStyles(call, text) {
  const read = await (await call('/api/files/read?path=styles%2Fmain.css')).json();
  const res = await call('/api/files/save', { method: 'POST', body: JSON.stringify({ changes: [{ path: 'styles/main.css', text, baseHash: read.hash }] }) });
  assert.equal(res.status, 200, await res.clone().text());
}

for (const mode of ['watch', 'poll']) {
  test(`one save makes one reload batch, not two: the watcher drops the save's own events (${mode})`, async (t) => {
    const root = await project(t);
    const { app, call } = await boot(t, root, { forcePoll: mode === 'poll' });
    const seen = [];
    await collectEvents(app, 'never', () => false, {
      timeoutMs: 1500,
      onEvent: (name, data) => { if (name === 'reload') seen.push(data); },
      onOpen: () => saveStyles(call, 'body{color:blue}\n'),
    }).catch(() => {});
    assert.equal(seen.length, 1, `reload batches after one save: ${JSON.stringify(seen)}`);
    assert.deepEqual(seen[0].files, ['styles/main.css']);
  });

  test(`an external edit after a save still reloads (${mode})`, async (t) => {
    const root = await project(t);
    const { app, call } = await boot(t, root, { forcePoll: mode === 'poll' });
    let edited = false;
    const reloads = await collectEvents(app, 'reload', (evs) => evs.length >= 2, {
      onOpen: () => saveStyles(call, 'body{color:blue}\n'),
      onEvent: async (name) => {
        if (name !== 'reload' || edited) return;
        edited = true;
        await new Promise((r) => setTimeout(r, 400));
        await fs.writeFile(path.join(root, 'styles/main.css'), 'body{color:green}\n');
      },
    });
    assert.deepEqual(reloads[0].files, ['styles/main.css']);
    assert.deepEqual(reloads[1].files, ['styles/main.css'], 'the later external edit is its own batch');
  });
}

test('closing the Workbench waits for a running job to exit, then frees its slot and the lock', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX signals: Windows stops a job with taskkill, so there is no SIGTERM to ignore (the win32 test below checks the stop)');
  const root = await project(t);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  // The builder ignores SIGTERM for about 1 s, then exits. It writes 'exited' just before it exits.
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), `
    import fs from 'node:fs';
    process.on('SIGTERM', () => {});
    fs.writeFileSync('started', '');
    setTimeout(() => { fs.writeFileSync('exited', ''); process.exit(0); }, 1000);
  `);
  const exists = (p) => fs.stat(p).then(() => true, () => false);
  const { app } = await boot(t, root);
  const started = app.jobs.start('config-build');
  for (let i = 0; i < 200 && !(await exists(path.join(root, 'started'))); i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(await exists(path.join(root, 'started')), true, 'the builder started');
  await app.close();
  assert.equal(await exists(path.join(root, 'exited')), true, 'close() resolved only after the builder exited');
  assert.equal(app.jobs.active.size, 0, 'the job slot is free');
  assert.equal(app.jobs.get(started.runId).status, 'cancelled');
  await assert.rejects(fs.stat(path.join(root, '.build-lock')), /ENOENT/, 'the file lock is free');
});

test('stopAll escalates to SIGKILL after the grace period for a builder that ignores SIGTERM, and resolves after it is gone', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX signals: Windows stops a job with taskkill, so there is no SIGTERM to ignore (the win32 test below checks the stop)');
  const root = await project(t);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), `
    import fs from 'node:fs';
    process.on('SIGTERM', () => {});
    fs.writeFileSync('started', '');
    setInterval(() => {}, 1000);
  `);
  const runner = new JobRunner({ root, stateFile: path.join(root, '.wb-state/jobs.json') });
  beforeRemove(t, () => runner.stopAll({ graceMs: 0 }));
  runner.start('config-build');
  for (let i = 0; i < 200 && !(await fs.stat(path.join(root, 'started')).then(() => true, () => false)); i++) await new Promise((r) => setTimeout(r, 20));
  const began = Date.now();
  await runner.stopAll({ graceMs: 200 });
  assert.ok(Date.now() - began >= 150, 'waited for the grace period before escalating');
  assert.equal(runner.active.size, 0, 'resolved only once the job slot was freed');
  await assert.rejects(fs.stat(path.join(root, '.build-lock')), /ENOENT/, 'the file lock is free');
});

test('on Windows, closing the Workbench ends a running job\'s builder before it resolves, and frees the lock', async (t) => {
  if (process.platform !== 'win32') return t.skip('Windows stop path (taskkill); POSIX is covered by the two tests above');
  const root = await project(t);
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/config-build.mjs'), `
    import fs from 'node:fs';
    fs.writeFileSync('pid', String(process.pid));
    setInterval(() => {}, 1000);
  `);
  const { app } = await boot(t, root);
  app.jobs.start('config-build');
  const pidFile = path.join(root, 'pid');
  for (let i = 0; i < 200 && !(await fs.stat(pidFile).then(() => true, () => false)); i++) await new Promise((r) => setTimeout(r, 20));
  const pid = Number(await fs.readFile(pidFile, 'utf8'));
  await app.close();
  const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
  assert.equal(alive(), false, 'the builder is gone once close() resolves');
  assert.equal(app.jobs.active.size, 0, 'the job slot is free');
  await assert.rejects(fs.stat(path.join(root, '.build-lock')), /ENOENT/, 'the file lock is free');
});
