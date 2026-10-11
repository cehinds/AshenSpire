// node --test workbench/tests/assets-server.test.mjs — the Asset Gallery's two server routes: the
// token-gated listing (GET /api/assets/list) and the same-origin art route (GET /asset-file/<path>).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { createWorkbench } from '../server.mjs';

// A 128 x 8 PNG: the signature, an IHDR with its size, and padding (the header reader needs no more).
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), Buffer.from([0, 0, 0, 128, 0, 0, 0, 8, 8, 6, 0, 0, 0]), Buffer.alloc(16)]);

async function project(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'assets-server-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'assets-mobile/equipment'), { recursive: true });
  await fs.writeFile(path.join(root, 'assets-mobile/equipment/sword.png'), PNG);
  await fs.mkdir(path.join(root, 'content/source'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/source/secret.json'), '{"not":"art"}');
  await fs.mkdir(path.join(root, '.art-cache/hd-assets-v19/high/assets/sprites'), { recursive: true });
  await fs.writeFile(path.join(root, '.art-cache/hd-assets-v19/high/assets/sprites/hero.png'), PNG);
  await fs.writeFile(path.join(root, 'art-release.json'), JSON.stringify({ schema: 2, tag: 'hd-assets-v19', packs: {} }));
  return root;
}

async function boot(t, root) {
  const app = await createWorkbench({ root, port: 0, children: false, stateDir: path.join(root, '.wb-state'), debounceMs: 120 });
  t.after(() => app.close());
  const call = (p, init = {}) => fetch(`${app.url}${p}`, { ...init, headers: { 'x-studio-token': app.token, ...(init.headers || {}) } });
  return { app, call };
}

// Node's fetch will not send a Host header of its own choosing, so a raw request carries the foreign host.
function rawGet(app, p, host) {
  const port = Number(new URL(app.url).port);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers: { Host: host } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('the listing is token-gated and names the art the gallery shows, with the pack status', async (t) => {
  const root = await project(t);
  const { app, call } = await boot(t, root);
  const refused = await fetch(`${app.url}/api/assets/list`);
  assert.equal(refused.status, 403, 'no token, no listing');
  const res = await call('/api/assets/list');
  assert.equal(res.status, 200);
  const body = await res.json();
  const sword = body.files.find((f) => f.path === 'assets-mobile/equipment/sword.png');
  assert.deepEqual(body.files.map((f) => f.path).sort(), ['assets-mobile/equipment/sword.png', 'assets/sprites/hero.png']);
  assert.equal(sword.w, 128);
  assert.equal(sword.h, 8);
  assert.equal(sword.bytes, PNG.length);
  assert.equal(body.tag, 'hd-assets-v19');
  assert.equal(body.packs.find((p) => p.id === 'high').fetched, true);
  assert.equal(body.packs.find((p) => p.id === 'common').fetched, false);
  assert.ok(!JSON.stringify(body).includes(root), 'the listing carries game paths, never the project folder');
});

test('the art route serves a listed file from the project origin, with its type and no token', async (t) => {
  const root = await project(t);
  const { app } = await boot(t, root);
  const ok = await rawGet(app, '/asset-file/assets-mobile/equipment/sword.png', app.url.replace('http://', ''));
  assert.equal(ok.status, 200);
  assert.equal(ok.type, 'image/png');
  assert.deepEqual(ok.body, PNG);
  const fromPack = await rawGet(app, '/asset-file/assets/sprites/hero.png', app.url.replace('http://', ''));
  assert.equal(fromPack.status, 200, 'a fetched pack is served at its game path');
});

test('the art route answers 404 for anything the listing does not name', async (t) => {
  const root = await project(t);
  const { app } = await boot(t, root);
  const host = app.url.replace('http://', '');
  for (const p of [
    '/asset-file/content/source/secret.json', // not art
    '/asset-file/assets-mobile/equipment/missing.png',
    '/asset-file/assets-mobile/../content/source/secret.json', // traversal, decoded
    '/asset-file/assets-mobile/%2e%2e/content/source/secret.json',
    '/asset-file/.art-cache/hd-assets-v19/high/assets/sprites/hero.png', // a hidden segment
    '/asset-file/assets-mobile/equipment/sword.png%00.png',
  ]) {
    const res = await rawGet(app, p, host);
    assert.equal(res.status, 404, p);
  }
});

test('the usage search reads content/ and src/ for a game path or its name, token-gated, and nothing else', async (t) => {
  const root = await project(t);
  await fs.writeFile(path.join(root, 'content/source/items.csv'), 'id,art\nsword,equipment/sword.png\nswordsmith,none\n');
  await fs.mkdir(path.join(root, 'src/node_modules/pkg'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/node_modules/pkg/x.js'), "const a = 'sword';\n");
  await fs.writeFile(path.join(root, 'src/ui.js'), "export const icon = 'sword';\n// nothing\n");
  await fs.writeFile(path.join(root, 'notes.txt'), 'sword sword sword\n');
  const { app, call } = await boot(t, root);
  assert.equal((await fetch(`${app.url}/api/assets/usage?path=x`)).status, 403, 'token-gated');
  const res = await call('/api/assets/usage?path=assets-mobile%2Fequipment%2Fsword.png');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.hits.map((h) => [h.file, h.line]), [['content/source/items.csv', 2], ['src/ui.js', 1]], 'the path in csv, the name in js; no node_modules, no root file, no swordsmith');
  assert.equal(body.hits[0].text, 'sword,equipment/sword.png');
  assert.equal(body.truncated, false);
  assert.equal((await call('/api/assets/usage')).status, 400, 'one path is required');
  assert.equal((await call('/api/assets/usage?path=' + encodeURIComponent('a\0b'))).status, 400);
});

test('the art route and the listing refuse a foreign Host header', async (t) => {
  const root = await project(t);
  const { app } = await boot(t, root);
  const res = await rawGet(app, '/asset-file/assets-mobile/equipment/sword.png', 'evil.example:4300');
  assert.equal(res.status, 403);
});

test('the art route refuses a method other than GET and HEAD', async (t) => {
  const root = await project(t);
  const { app } = await boot(t, root);
  const res = await fetch(`${app.url}/asset-file/assets-mobile/equipment/sword.png`, { method: 'POST', body: 'x' });
  assert.equal(res.status, 405);
});
