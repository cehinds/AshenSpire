// node --test workbench/tests/own-writes.test.mjs — the watcher's record of the
// Workbench's own writes matches a save's echo, and no later edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createOwnWrites } from '../core/watch.mjs';

test('a recorded write is its own echo until the file changes after it', async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'own-writes-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'main.css');
  const own = createOwnWrites();
  assert.equal(own.isOwn(file), false, 'nothing recorded yet');

  await fs.writeFile(file, 'a{}\n');
  own.record(file, await fs.stat(file));
  assert.equal(own.isOwn(file), true, 'the echo of the recorded write');
  assert.equal(own.isOwn(path.join(root, 'other.css')), false, 'another file is not own');

  // Same size, newer mtime: an external edit after the save is still a change.
  await new Promise((r) => setTimeout(r, 20));
  await fs.writeFile(file, 'b{}\n');
  assert.equal(own.isOwn(file), false, 'a later edit is not the save\'s echo');

  await fs.rm(file);
  assert.equal(own.isOwn(file), false, 'a deleted file is not own');
});
