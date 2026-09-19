// node --test ui-studio/tests/server.test.mjs — the local half of UI Studio,
// against a disposable checkout planted under os.tmpdir().
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createUiStudio, Workspace, safePath, hash } from '../server.mjs';
import { SKETCH_SCHEMA } from '../model.mjs';

const TOKENS = '{\n  "vars": { "targetPx": 44 }\n}\n';
const W4A = '{\n  "sizing": {\n    "bands": { "hud": 10, "scene": 55, "context": 30, "footer": 5 },\n    "hand": { "exposedTargetPx": "$targetPx" }\n  }\n}\n';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-studio-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/config/ui/scenes'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/config/ui/tokens.json'), TOKENS);
  await fs.writeFile(path.join(root, 'content/config/ui/scenes/w4a-combat.json'), W4A);
  const stateDir = path.join(root, 'state');
  return { root, stateDir, workspace: new Workspace(await fs.realpath(root), stateDir) };
}

test('safePath refuses traversal, hidden segments, absolute paths, streams and symlinks', async (t) => {
  const { root } = await fixture(t);
  const real = await fs.realpath(root);
  for (const p of ['../secret', '.git/config', 'content/../secret', 'content\\secret', 'file.txt:stream', '/absolute', '', 'content/./x']) await assert.rejects(safePath(real, p, { creating: true }), p || '(empty)');
  await fs.symlink(path.join(real, 'content'), path.join(real, 'linked'), 'dir');
  await assert.rejects(safePath(real, 'linked/config/ui/tokens.json'), /Linked/);
  await assert.rejects(safePath(real, 'content/config/ui/missing.json'), /Not found/);
  assert.equal(await safePath(real, 'content/config/ui/scenes/new.json', { creating: true }), path.join(real, 'content/config/ui/scenes/new.json'));
});

test('config lists every file with its hash, and validate runs the game compiler', async (t) => {
  const { workspace } = await fixture(t);
  const files = await workspace.config();
  assert.deepEqual(files.map((f) => f.rel), ['ui/scenes/w4a-combat.json', 'ui/tokens.json']);
  assert.equal(files[1].hash, hash(TOKENS));
  assert.deepEqual((await workspace.validate([])).errors, []);
  const bad = await workspace.validate([{ rel: 'ui/scenes/w4a-combat.json', text: W4A.replace('"hud": 10', '"hud": 20') }]);
  assert.match(bad.errors.join('\n'), /sizing\.bands sum to 110, not 100/);
  const unknown = await workspace.validate([{ rel: 'ui/scenes/w4a-combat.json', text: W4A.replace('$targetPx', '$nope') }]);
  assert.match(unknown.errors.join('\n'), /unknown variable "\$nope"/);
  await assert.rejects(workspace.validate([{ rel: 'ui/../evil.json', text: '{}' }]), /Not a config file/);
});

test('save refuses a tree the compiler refuses, a stale hash, and keeps the previous bytes', async (t) => {
  const { root, workspace } = await fixture(t);
  const [w4a] = await workspace.config();
  const edited = W4A.replace('"hud": 10, "scene": 55', '"hud": 12, "scene": 53');
  await assert.rejects(workspace.save([{ rel: w4a.rel, text: W4A.replace('"hud": 10', '"hud": 20'), hash: w4a.hash }]), /compiler refuses/);
  assert.equal(await fs.readFile(path.join(root, 'content/config', w4a.rel), 'utf8'), W4A, 'a refused save writes nothing');
  await assert.rejects(workspace.save([{ rel: w4a.rel, text: edited, hash: 'stale' }]), /changed on disk/);
  const result = await workspace.save([{ rel: w4a.rel, text: edited, hash: w4a.hash }]);
  assert.equal(await fs.readFile(path.join(root, 'content/config', w4a.rel), 'utf8'), edited);
  assert.equal(result.files[0].hash, hash(edited));
  const backups = await workspace.backups();
  assert.equal(backups.length, 1);
  assert.equal(backups[0].id, result.backup);
  assert.equal(backups[0].files[0].oldHash, hash(W4A));
  const staged = await workspace.backup(result.backup);
  assert.deepEqual(staged.changes.map((c) => [c.rel, c.text, c.hash]), [[w4a.rel, W4A, hash(edited)]]);
  await assert.rejects(workspace.backup('../x'), /Invalid backup/);
  // The second save must carry the new hash.
  await assert.rejects(workspace.save([{ rel: w4a.rel, text: W4A, hash: w4a.hash }]), /changed on disk/);
  await workspace.save([{ rel: w4a.rel, text: W4A, hash: hash(edited) }]);
  assert.equal(await fs.readFile(path.join(root, 'content/config', w4a.rel), 'utf8'), W4A);
});

test('concurrent saves serialize: exactly one of two competing writes lands', async (t) => {
  const { workspace } = await fixture(t);
  const [w4a] = await workspace.config();
  const a = W4A.replace('"hud": 10, "scene": 55', '"hud": 11, "scene": 54');
  const b = W4A.replace('"hud": 10, "scene": 55', '"hud": 12, "scene": 53');
  const results = await Promise.allSettled([workspace.save([{ rel: w4a.rel, text: a, hash: w4a.hash }]), workspace.save([{ rel: w4a.rel, text: b, hash: w4a.hash }])]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
});

test('settings merge over the defaults and refuse a broken shape; sketches validate by name and schema', async (t) => {
  const { workspace } = await fixture(t);
  const before = await workspace.settings();
  assert.equal(before.grid.sizePx, 8);
  await assert.rejects(workspace.saveSettings({ ...before, grid: { ...before.grid, sizePx: -1 } }), /grid\.sizePx/);
  const dir = path.join(path.dirname(fileURLToPath(new URL('../server.mjs', import.meta.url))), 'workspace');
  const settingsFile = path.join(dir, 'settings.json');
  const had = await fs.readFile(settingsFile, 'utf8').catch(() => null);
  t.after(async () => { if (had === null) await fs.rm(settingsFile, { force: true }); else await fs.writeFile(settingsFile, had); });
  await workspace.saveSettings({ ...before, grid: { ...before.grid, sizePx: 12 } });
  assert.equal((await workspace.settings()).grid.sizePx, 12);
  await assert.rejects(workspace.saveSketch('Bad Name', {}), /lower-case/);
  await assert.rejects(workspace.saveSketch('ok', { schema: 'x' }), /Sketch refused/);
  const sketchFile = path.join(dir, 'sketches', 'ui-studio-test-sketch.json');
  t.after(() => fs.rm(sketchFile, { force: true }));
  const sketch = { schema: SKETCH_SCHEMA, name: 'T', unit: 'percent', breakpoints: [], boxes: [{ id: 'a', label: 'A', x: 1, y: 1, w: 10, h: 10 }] };
  const saved = await workspace.saveSketch('ui-studio-test-sketch', sketch);
  assert.equal(saved.name, 'ui-studio-test-sketch');
  const listed = await workspace.sketches();
  assert.ok(listed.some((s) => s.name === 'ui-studio-test-sketch' && s.boxes === 1));
  assert.deepEqual((await workspace.sketch('ui-studio-test-sketch')).sketch, sketch);
});

test('HTTP: token, origin and host checks; the preview origin cannot reach the API; static allowlist', async (t) => {
  const { root, stateDir } = await fixture(t);
  const app = await createUiStudio({ root, port: 0, stateDir });
  t.after(() => app.close());
  const { token } = await (await fetch(`${app.url}/api/session`)).json();
  assert.equal((await fetch(`${app.url}/api/config`)).status, 403, 'no token');
  assert.equal((await fetch(`${app.url}/api/session`, { headers: { Origin: 'https://untrusted.example' } })).status, 403, 'cross origin');
  assert.equal((await fetch(`${app.url.replace('127.0.0.1', 'localhost')}/api/session`)).status, 403, 'preview host');
  assert.equal((await fetch(`${app.url}/api/config`, { headers: { Host: 'evil.example' } })).status, 403, 'other host');
  const files = await (await fetch(`${app.url}/api/config`, { headers: { 'x-studio-token': token } })).json();
  assert.equal(files.length, 2);
  const validated = await (await fetch(`${app.url}/api/validate`, { method: 'POST', headers: { 'x-studio-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: [{ rel: 'ui/tokens.json', text: '{ "vars": { "targetPx": 44, "unused": 1 } }' }] }) })).json();
  assert.match(validated.errors.join('\n'), /"\$unused" is defined but never used/);
  assert.equal((await fetch(`${app.url}/index.html`)).status, 200);
  assert.equal((await fetch(`${app.url}/server.mjs`)).status, 404, 'the server is not served');
  assert.equal((await fetch(`${app.url}/tests/server.test.mjs`)).status, 404);
  const redirected = await fetch(`${app.url}/game/content/config/ui/tokens.json`, { redirect: 'manual' });
  assert.equal(redirected.status, 302, 'game assets redirect to the preview origin');
  assert.match(redirected.headers.get('location'), /^http:\/\/localhost:\d+\/game\//);
  const preview = await fetch(`${app.url.replace('127.0.0.1', 'localhost')}/game/content/config/ui/tokens.json`);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await fetch(`${app.url.replace('127.0.0.1', 'localhost')}/game/tools/config-build.mjs`)).status, 400, 'not a preview asset');
  assert.equal((await fetch(`${app.url}/api/config`, { method: 'DELETE', headers: { 'x-studio-token': token } })).status, 404);
});
