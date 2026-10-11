// node --test workbench/tests/review-server.test.mjs — the Visual Review API on a
// disposable project: token and origin enforced, names allowlisted, accept copies
// captures to baselines, and a bad capture request never starts a job.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { createWorkbench, projectStateDir } from '../server.mjs';

async function boot(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'review-api-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  const stateDir = path.join(root, '.wb-state');
  const app = await createWorkbench({ root, port: 0, children: false, stateDir, debounceMs: 120 });
  t.after(() => app.close());
  const captures = path.join(projectStateDir(root, stateDir), 'review', 'captures');
  await fs.mkdir(captures, { recursive: true });
  const call = (p, init = {}) => fetch(`${app.url}${p}`, { ...init, headers: { 'x-studio-token': app.token, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) } });
  return { app, call, captures };
}

test('the review state lists captures and baselines, and an image is served as PNG with the token', async (t) => {
  const { call, captures } = await boot(t);
  await fs.writeFile(path.join(captures, 'desk-title.png'), 'PNG1');
  const state = await (await call('/api/review/state')).json();
  assert.deepEqual(state.captures.map((f) => f.file), ['desk-title.png']);
  assert.deepEqual(state.baselines, []);
  const img = await call('/api/review/image?set=captures&file=desk-title.png');
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(await img.text(), 'PNG1');
});

test('the review API refuses a call with no token, a cross-origin call, and a name outside the allowlist', async (t) => {
  const { app, call, captures } = await boot(t);
  await fs.writeFile(path.join(captures, 'desk-title.png'), 'PNG1');
  assert.equal((await fetch(`${app.url}/api/review/state`)).status, 403);
  assert.equal((await fetch(`${app.url}/api/review/image?set=captures&file=desk-title.png`)).status, 403);
  assert.equal((await call('/api/review/state', { headers: { origin: 'http://evil.example' } })).status, 403);
  assert.equal((await call('/api/review/image?set=captures&file=..%2F..%2Fsession.json')).status, 400);
  assert.equal((await call('/api/review/image?set=captures&file=desk-nope.png')).status, 400);
  assert.equal((await call('/api/review/image?set=elsewhere&file=desk-title.png')).status, 400);
  assert.equal((await call('/api/review/image?set=baselines&file=desk-title.png')).status, 404);
  assert.equal((await call('/api/review/accept', { method: 'POST', body: JSON.stringify({ items: [{ device: 'desk', screen: '../x' }] }) })).status, 400);
  assert.equal((await fetch(`${app.url}/api/review/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"items":[]}' })).status, 403);
});

test('the review API answers only the local Workbench host, not a rebinding name, even with the token', async (t) => {
  const { app } = await boot(t);
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: app.server.address().port, path: '/api/review/state', headers: { host: 'evil.example', 'x-studio-token': app.token } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end();
  });
  assert.equal(status, 403);
});

test('accept copies the chosen captures to baselines and reports the ones with no capture', async (t) => {
  const { call, captures } = await boot(t);
  await fs.writeFile(path.join(captures, 'desk-map.png'), 'MAP');
  const res = await call('/api/review/accept', { method: 'POST', body: JSON.stringify({ items: [{ device: 'desk', screen: 'map' }, { device: 'phone', screen: 'map' }] }) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { accepted: ['desk-map.png'], missing: ['phone-map.png'] });
  const state = await (await call('/api/review/state')).json();
  assert.deepEqual(state.baselines.map((f) => f.file), ['desk-map.png']);
  assert.equal(await (await call('/api/review/image?set=baselines&file=desk-map.png')).text(), 'MAP');
});

test('a Visual capture request with a bad device or screen is refused before any job starts', async (t) => {
  const { app, call } = await boot(t);
  for (const params of [{ device: 'watch' }, { screens: ['../../etc/passwd'] }, { screens: [] }]) {
    const res = await call('/api/jobs', { method: 'POST', body: JSON.stringify({ id: 'review-capture', params }) });
    assert.equal(res.status, 400, JSON.stringify(params));
  }
  assert.equal(app.jobs.runs.length, 0);
  assert.equal(app.jobs.active.size, 0);
});
