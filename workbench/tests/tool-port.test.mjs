// node --test workbench/tests/tool-port.test.mjs — a child tool whose default port is held by
// another checkout's Workbench (or by a non-tool) starts on a free port, and the tools listing shows it.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Tool, portFree, pickPort } from '../core/tools.mjs';

const HERE = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));

/** Holds a port with a server that answers like a Workbench serving another checkout. */
function holdPort(port, body = { root: '/some/other/checkout' }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/** A free port number, found by listening on 0 and releasing it. */
async function freePort() {
  const server = await holdPort(0);
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** A fake child tool: serves /api/session with the checkout it was started in (its cwd). */
const FAKE_CHILD = `
  const http = require('http'); const fs = require('fs');
  const port = Number(process.argv[1]); const root = fs.realpathSync(process.cwd());
  http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ root })); }).listen(port, '127.0.0.1');
`;

function fakeTool(port) {
  return new Tool({
    id: 'editor', name: 'Fake editor', blurb: '', port, host: '127.0.0.1', path: '/', health: '/api/session', sessionRoot: true,
    command: (p) => ['-e', FAKE_CHILD, String(p)],
  }, { root: HERE, origin: 'http://127.0.0.1:4300' });
}

async function waitFor(predicate, ms = 10000) {
  const until = Date.now() + ms;
  while (Date.now() < until) { if (predicate()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return predicate();
}

test('a default port held by another checkout: the child starts on a free port and the listing shows it', async (t) => {
  const base = await freePort();
  const holder = await holdPort(base);
  const tool = fakeTool(base);
  t.after(async () => { await tool.stop(); await new Promise((r) => holder.close(r)); });
  await tool.start();
  assert.ok(await waitFor(() => tool.status === 'up'), `tool is up, was ${tool.status}: ${tool.message}`);
  const listed = tool.toJSON();
  assert.notEqual(listed.port, base, 'not the port the other checkout holds');
  assert.equal(listed.url, `http://127.0.0.1:${listed.port}/`, 'the listing carries the real URL');
  assert.equal(listed.owned, true, 'the Workbench started it');
  const res = await fetch(listed.url + 'api/session');
  assert.equal((await res.json()).root, HERE, 'the child serves this checkout');
});

test('a free default port is kept as before', async (t) => {
  const base = await freePort();
  const tool = fakeTool(base);
  t.after(() => tool.stop());
  await tool.start();
  assert.ok(await waitFor(() => tool.status === 'up'), `tool is up, was ${tool.status}: ${tool.message}`);
  assert.equal(tool.toJSON().port, base);
});

test('pickPort returns the base when free, else the next candidate ten ports up', async (t) => {
  const base = await freePort();
  assert.equal(await pickPort(base), base);
  const holder = await holdPort(base);
  t.after(() => new Promise((r) => holder.close(r)));
  const picked = await pickPort(base);
  assert.notEqual(picked, base);
  assert.equal((picked - base) % 10, 0, 'a candidate on the step from the base');
  assert.equal(await portFree(picked), true);
});
