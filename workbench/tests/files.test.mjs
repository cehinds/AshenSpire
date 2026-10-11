// node --test workbench/tests/files.test.mjs — the Workbench file service over
// HTTP, against a disposable project under os.tmpdir(), children off.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWorkbench, projectStateDir } from '../server.mjs';
import { allowedKind, lineDiff } from '../core/files.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');

async function project(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'wb-files-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const d of ['content/source', 'content/config/ui', 'src/engine', 'src/content/generated', 'styles', '.git']) await fs.mkdir(path.join(root, d), { recursive: true });
  await fs.writeFile(path.join(root, 'content/source/items.csv'), 'id,name\nsword,Sword\nbow,Bow\n');
  await fs.writeFile(path.join(root, 'content/source/data.json'), '{"rows":[{"id":"a"}]}\n');
  await fs.writeFile(path.join(root, 'src/engine/rules.js'), 'export const x = 1;\n');
  await fs.writeFile(path.join(root, 'src/content/generated/out.js'), 'export const g = 1;\n');
  await fs.writeFile(path.join(root, 'styles/main.css'), 'body{}\n');
  await fs.writeFile(path.join(root, '.git/config'), '[core]\n');
  await fs.writeFile(path.join(root, 'package.json'), '{}\n');
  return root;
}

async function boot(t, root, { settings } = {}) {
  const stateDir = path.join(root, '.wb-state');
  if (settings) { await fs.mkdir(stateDir, { recursive: true }); await fs.writeFile(path.join(stateDir, 'settings.json'), JSON.stringify(settings)); }
  const app = await createWorkbench({ root, port: 0, children: false, stateDir, debounceMs: 120 });
  t.after(() => app.close());
  const call = (p, init = {}) => fetch(`${app.url}${p}`, {
    ...init,
    headers: { 'x-studio-token': app.token, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const post = (p, body) => call(p, { method: 'POST', body: JSON.stringify(body) });
  return { app, call, post, stateDir };
}

test('allowlist: editable sources only; traversal, generated files, .git and other trees refused', async (t) => {
  const root = await project(t);
  const { call } = await boot(t, root);
  for (const p of ['../secret.json', '.git/config', 'content/source/../../package.json', 'src/content/generated/out.js', 'package.json', 'content/source/notes.txt', 'build/x.json', 'content/source/.hidden.json', 'src\\x.js', '']) {
    assert.equal(allowedKind(p), null, p);
    const res = await call(`/api/files/read?path=${encodeURIComponent(p)}`);
    assert.ok(res.status === 403 || res.status === 400 || res.status === 404, `${p} → ${res.status}`);
    assert.equal(res.ok, false, p);
  }
  const ok = await call('/api/files/read?path=content%2Fsource%2Fitems.csv');
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(await ok.json()).sort(), ['hash', 'kind', 'path', 'text']);
  assert.equal(allowedKind('content/config/ui/tokens.json'), 'json');
  assert.equal(allowedKind('styles/main.css'), 'css');
  assert.equal(allowedKind('src/engine/rules.js'), 'js');
});

test('read returns text, hash and kind; list returns only allowlisted files', async (t) => {
  const root = await project(t);
  const { call } = await boot(t, root);
  const body = await (await call('/api/files/read?path=src%2Fengine%2Frules.js')).json();
  assert.equal(body.kind, 'js');
  assert.equal(body.hash, sha('export const x = 1;\n'));
  const listed = await (await call('/api/files/list?dir=content&ext=.json,.csv')).json();
  assert.deepEqual(listed.files, ['content/source/data.json', 'content/source/items.csv']);
  const all = await (await call('/api/files/list?dir=src')).json();
  assert.deepEqual(all.files, ['src/engine/rules.js']);
});

test('save refuses invalid JSON, CSV, duplicate ids, JS syntax and a broken config tree with 422 and writes nothing', async (t) => {
  const root = await project(t);
  const { post } = await boot(t, root);
  const cases = [
    ['content/source/data.json', '{"rows": [', 'json'],
    ['content/source/items.csv', 'id,name\n"open,Sword\n', 'csv'],
    ['content/source/items.csv', 'id,name\nsword,A\nsword,B\n', 'csv'],
    ['src/engine/rules.js', 'export const = ;\n', 'js'],
    ['content/config/ui/tokens.json', '{"bogus": {}}', 'config'],
  ];
  for (const [file, text, label] of cases) {
    const before = await fs.readFile(path.join(root, file), 'utf8').catch(() => null);
    const res = await post('/api/files/save', { changes: [{ path: file, text, baseHash: sha(before ?? '') }] });
    assert.equal(res.status, 422, label);
    const body = await res.json();
    assert.ok(body.problems.length >= 1, label);
    assert.equal(body.problems[0].path, file, label);
    assert.equal(await fs.readFile(path.join(root, file), 'utf8').catch(() => null), before, label);
  }
});

test('save accepts the real outfits.csv (id repeats across classes) and refuses a true duplicate', async (t) => {
  const root = await project(t);
  const { post } = await boot(t, root);
  const real = await fs.readFile(new URL('../../content/source/outfits.csv', import.meta.url), 'utf8');
  const file = 'content/source/outfits.csv';
  await fs.writeFile(path.join(root, file), real);
  const edited = real.replace('The armour you were buried in.', 'The armour you were buried in!');
  const ok = await post('/api/files/save', { changes: [{ path: file, text: edited, baseHash: sha(real) }] });
  assert.equal(ok.status, 200);
  assert.equal(await fs.readFile(path.join(root, file), 'utf8'), edited);
  const firstReaver = edited.split('\n').find((line) => line.startsWith('default,reaver,'));
  const dupe = `${edited}${firstReaver}\n`;
  const res = await post('/api/files/save', { changes: [{ path: file, text: dupe, baseHash: sha(edited) }] });
  assert.equal(res.status, 422);
  assert.match((await res.json()).problems[0].message, /duplicate id: default/);
  assert.equal(await fs.readFile(path.join(root, file), 'utf8'), edited);
});

test('save: hash mismatch is a 409 with the current hash, and the disk is untouched', async (t) => {
  const root = await project(t);
  const { post } = await boot(t, root);
  const read = await (await post('/api/files/save', { changes: [{ path: 'styles/main.css', text: 'a{}\n', baseHash: sha('body{}\n') }] })).json();
  assert.ok(read.backup);
  await fs.writeFile(path.join(root, 'styles/main.css'), 'external{}\n');
  const res = await post('/api/files/save', { changes: [{ path: 'styles/main.css', text: 'mine{}\n', baseHash: sha('a{}\n') }] });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.deepEqual(body.conflicts, [{ path: 'styles/main.css', hash: sha('external{}\n') }]);
  assert.equal(await fs.readFile(path.join(root, 'styles/main.css'), 'utf8'), 'external{}\n');
});

test('save writes atomically, returns new hashes, creates a backup set, and holds the build lock during the write', async (t) => {
  const root = await project(t);
  const stateDir = path.join(root, '.wb-state');
  // The fileFault seam runs just before the rename: the build lock must be held by this process then.
  let heldDuringWrite = null;
  const app = await createWorkbench({
    root, port: 0, children: false, stateDir, debounceMs: 120,
    fileFault: (rel) => { if (rel === 'content/source/data.json') heldDuringWrite = JSON.parse(fsSync.readFileSync(path.join(root, '.build-lock'), 'utf8')); },
  });
  t.after(() => app.close());
  const res = await fetch(`${app.url}/api/files/save`, {
    method: 'POST',
    headers: { 'x-studio-token': app.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: [{ path: 'content/source/data.json', text: '{"rows":[{"id":"b"}]}\n', baseHash: sha('{"rows":[{"id":"a"}]}\n') }] }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.files[0].hash, sha('{"rows":[{"id":"b"}]}\n'));
  assert.equal(heldDuringWrite?.pid, process.pid, 'the lock was held by this process during the write');
  assert.equal(heldDuringWrite?.holder, 'Workbench file save');
  const dir = path.join(projectStateDir(root, stateDir), 'backups', body.backup);
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.files[0].oldHash, sha('{"rows":[{"id":"a"}]}\n'));
  assert.equal(await fs.readFile(path.join(dir, '0.bak'), 'utf8'), '{"rows":[{"id":"a"}]}\n');
  assert.deepEqual((await fs.readdir(path.join(root, 'content/source'))).filter((f) => f.endsWith('.tmp')), []);
  assert.equal(await fs.stat(path.join(root, '.build-lock')).then(() => true, () => false), false, 'released after the save');
});

test('a save under styles/ waits for a foreign build lock; on timeout it writes nothing', async (t) => {
  const root = await project(t);
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  t.after(() => child.kill());
  await fs.writeFile(path.join(root, '.build-lock'), JSON.stringify({ pid: child.pid, holder: 'UI Studio config compile', startedAt: Date.now(), token: 'theirs' }));
  const app = await createWorkbench({ root, port: 0, children: false, stateDir: path.join(root, '.wb-state'), debounceMs: 120, lockWaitMs: 300 });
  t.after(() => app.close());
  const res = await fetch(`${app.url}/api/files/save`, {
    method: 'POST',
    headers: { 'x-studio-token': app.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: [{ path: 'styles/x.css', text: 'x{}\n', baseHash: null }] }),
  });
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /UI Studio config compile is running/);
  assert.equal(await fs.stat(path.join(root, 'styles/x.css')).then(() => true, () => false), false, 'nothing written');
  assert.equal(JSON.parse(await fs.readFile(path.join(root, '.build-lock'), 'utf8')).token, 'theirs', 'their lock stands');
});

test('save with a bad second change writes nothing; a write failure rolls the first file back', async (t) => {
  const root = await project(t);
  const first = { path: 'styles/main.css', text: 'one{}\n', baseHash: sha('body{}\n') };
  const second = { path: 'src/engine/rules.js', text: 'export const = ;\n', baseHash: sha('export const x = 1;\n') };
  {
    const { post } = await boot(t, root);
    const res = await post('/api/files/save', { changes: [first, second] });
    assert.equal(res.status, 422);
    assert.equal(await fs.readFile(path.join(root, 'styles/main.css'), 'utf8'), 'body{}\n');
  }
  // Valid pair, but the second file's write fails: the first must be put back.
  const failing = await createWorkbench({
    root, port: 0, children: false, stateDir: path.join(root, '.wb-state2'), debounceMs: 120,
    fileFault: (rel) => { if (rel === 'src/engine/rules.js') throw Error('disk full (simulated)'); },
  });
  t.after(() => failing.close());
  const res = await fetch(`${failing.url}/api/files/save`, {
    method: 'POST',
    headers: { 'x-studio-token': failing.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: [first, { ...second, text: 'export const x = 2;\n' }] }),
  });
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /rolled back/);
  assert.equal(await fs.readFile(path.join(root, 'styles/main.css'), 'utf8'), 'body{}\n');
  assert.equal(await fs.readFile(path.join(root, 'src/engine/rules.js'), 'utf8'), 'export const x = 1;\n');
});

test('a save that fails with 409 after its backup set was written leaves backups() unchanged', async (t) => {
  const root = await project(t);
  const stateDir = path.join(root, '.wb-state');
  // The first file's write also changes the second file on disk, so the second file's check
  // fails after the backup set exists. The first file is rolled back.
  const app = await createWorkbench({
    root, port: 0, children: false, stateDir, debounceMs: 120,
    fileFault: (rel) => { if (rel === 'styles/main.css') fsSync.writeFileSync(path.join(root, 'src/engine/rules.js'), 'export const x = 3;\n'); },
  });
  t.after(() => app.close());
  const list = async () => (await (await fetch(`${app.url}/api/files/backups`, { headers: { 'x-studio-token': app.token } })).json()).backups;
  const before = await list();
  const res = await fetch(`${app.url}/api/files/save`, {
    method: 'POST',
    headers: { 'x-studio-token': app.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: [
      { path: 'styles/main.css', text: 'one{}\n', baseHash: sha('body{}\n') },
      { path: 'src/engine/rules.js', text: 'export const x = 2;\n', baseHash: sha('export const x = 1;\n') },
    ] }),
  });
  assert.equal(res.status, 409);
  assert.equal(await fs.readFile(path.join(root, 'styles/main.css'), 'utf8'), 'body{}\n', 'rolled back');
  assert.deepEqual(await list(), before, 'the failed save left no backup set');
  assert.deepEqual((await fs.readdir(stateDir, { recursive: true })).filter((f) => /manifest\.json$/.test(f)), [], 'no manifest on disk');
});

test('a symlink inside an allowlisted directory that points outside the project is refused for read and save', async (t) => {
  const root = await project(t);
  const outside = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'wb-outside-')));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.writeFile(path.join(outside, 'secret.css'), 'secret{}\n');
  await fs.symlink(path.join(outside, 'secret.css'), path.join(root, 'styles/link.css'));
  const { call, post } = await boot(t, root);
  const read = await call('/api/files/read?path=styles%2Flink.css');
  assert.equal(read.ok, false);
  assert.doesNotMatch(await read.text(), /secret/);
  const save = await post('/api/files/save', { changes: [{ path: 'styles/link.css', text: 'pwned{}\n', baseHash: sha('secret{}\n') }] });
  assert.equal(save.ok, false);
  assert.equal(await fs.readFile(path.join(outside, 'secret.css'), 'utf8'), 'secret{}\n', 'the file outside is untouched');
});

test('backups are listed and pruned to keepBackups sets', async (t) => {
  const root = await project(t);
  const { post, call } = await boot(t, root, { settings: { keepBackups: 2 } });
  let text = 'body{}\n';
  for (let i = 1; i <= 3; i++) {
    const next = `v${i}{}\n`;
    const res = await post('/api/files/save', { changes: [{ path: 'styles/main.css', text: next, baseHash: sha(text) }] });
    assert.equal(res.status, 200);
    text = next;
  }
  const listed = await (await call('/api/files/backups')).json();
  assert.equal(listed.backups.length, 2);
  assert.equal(listed.backups[0].files[0].savedHash, sha('v3{}\n'));
});

test('diff: a small edit gives one hunk with context and +/- lines, and writes nothing', async (t) => {
  const root = await project(t);
  const original = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
  await fs.writeFile(path.join(root, 'styles/main.css'), original);
  const { post } = await boot(t, root);
  const edited = original.replace('line 6', 'line six');
  const res = await post('/api/files/diff', { path: 'styles/main.css', text: edited });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.hunks.length, 1);
  const hunk = body.hunks[0];
  assert.equal(hunk.oldStart, 3);
  assert.equal(hunk.oldLines, 7);
  assert.equal(hunk.newLines, 7);
  const changed = hunk.lines.filter((l) => l.op !== ' ');
  assert.deepEqual(changed, [{ op: '-', text: 'line 6' }, { op: '+', text: 'line six' }]);
  assert.equal(await fs.readFile(path.join(root, 'styles/main.css'), 'utf8'), original);
});

test('lineDiff: identical texts have no hunks; insertions and deletions count correctly', () => {
  assert.deepEqual(lineDiff('a\nb\n', 'a\nb\n').hunks, []);
  assert.deepEqual([lineDiff('', 'a\nb').added, lineDiff('a\nb\n', '').removed], [2, 2]);
  const many = Array.from({ length: 3000 }, (_, i) => `l${i}`).join('\n');
  assert.equal(lineDiff(many, `${many}\nz`).added, 1);
});

test('restore puts a backed-up version back through the same save path, and is itself backed up', async (t) => {
  const root = await project(t);
  const { post, call } = await boot(t, root);
  const v1 = 'body{}\n';
  const saved = await (await post('/api/files/save', { changes: [{ path: 'styles/main.css', text: 'v2{}\n', baseHash: sha(v1) }] })).json();
  const restored = await post('/api/files/restore', { set: saved.backup });
  assert.equal(restored.status, 200);
  const body = await restored.json();
  assert.deepEqual(body.restored, ['styles/main.css']);
  assert.equal(await fs.readFile(path.join(root, 'styles/main.css'), 'utf8'), v1);
  const listed = await (await call('/api/files/backups')).json();
  assert.equal(listed.backups.length, 2);
  assert.equal((await post('/api/files/restore', { set: '2000-01-01T00-00-00-000Z-000000' })).status, 404);
  assert.equal((await post('/api/files/restore', { set: '../x' })).status, 400);
});
