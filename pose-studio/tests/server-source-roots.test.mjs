import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handler } from '../server.mjs';

test('Studio serves its shared engine import while keeping tools and private files outside the allowlist', async () => {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const kernel = await fetch(base + '/engine/kernel/gameConfig.js');
    assert.equal(kernel.status, 200);
    assert.match(kernel.headers.get('content-type'), /javascript/);
    assert.match(await kernel.text(), /export function resolveGameAuthor/);
    for (const path of ['/tools/pose-studio-capture.mjs', '/.git/config']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
