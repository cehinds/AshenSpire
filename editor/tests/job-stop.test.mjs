// node --test editor/tests/job-stop.test.mjs — closing the Editor during a build step: the
// build lock is released only after the step's whole process group is gone, including a
// grandchild that ignores SIGTERM for about a second.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createStudio } from '../server.mjs';
import { tryAcquire } from '../../tools/lib/build-lock.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('closing the Editor keeps the build lock until a SIGTERM-ignoring grandchild has exited', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process-group coverage; Windows uses taskkill /T');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ashenspire-job-stop-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const exitMarker = path.join(root, 'grandchild-exited.txt');
  const readyMarker = path.join(root, 'grandchild-ready.txt');
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  // The grandchild writes readyMarker only after it ignores SIGTERM; before that a stop would kill it outright.
  await fs.writeFile(path.join(root, 'tools/launch.mjs'), `
    import fs from 'node:fs';
    import { spawn } from 'node:child_process';
    const grandchild = ${JSON.stringify(`process.on('SIGTERM', () => {}); require('node:fs').writeFileSync(${JSON.stringify(readyMarker)}, 'ready'); setTimeout(() => { require('node:fs').writeFileSync(${JSON.stringify(exitMarker)}, 'exited'); process.exit(0); }, 1000);`)};
    spawn(process.execPath, ['-e', grandchild], { stdio: 'ignore' });
    setInterval(() => {}, 1000);
  `);
  const app = await createStudio({ root, port: 0, stateDir: path.join(root, 'state') });
  const { token } = await (await fetch(`${app.url}/api/session`)).json();
  const started = await fetch(`${app.url}/api/job`, { method: 'POST', headers: { 'x-studio-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'build' }) });
  assert.equal(started.status, 200);
  for (let i = 0; i < 200; i++) {
    try { await fs.access(readyMarker); break; } catch { await delay(20); }
  }
  await assert.doesNotReject(fs.access(readyMarker), 'the grandchild is running');
  // The build holds the lock while its step runs.
  assert.equal(typeof tryAcquire(root, 'probe'), 'object', 'the build holds the lock');

  await app.close();

  await assert.doesNotReject(fs.access(exitMarker), 'the grandchild had exited when the Editor finished closing');
  const probe = tryAcquire(root, 'probe');
  assert.equal(typeof probe, 'function', 'the lock is free once the whole step has exited');
  probe();
});
