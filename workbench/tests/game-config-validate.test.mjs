// node --test workbench/tests/game-config-validate.test.mjs — a Workbench save of a game-profile input
// is validated by tools/game-config.mjs against a candidate copy of the tree, not only parsed as JSON.
// Runs against the real repo root; validate() and a refused save write nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createFileService } from '../core/files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GROUPS = 'games/ashenspire/packs/base-cards/groups.json';

async function service(t) {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-gcv-state-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  return createFileService({ root, stateDir });
}

test('an unchanged re-save of the base-card groups passes', async (t) => {
  const files = await service(t);
  const { text } = await files.read(GROUPS);
  assert.deepEqual(await files.validate([{ path: GROUPS, kind: 'json', text }]), []);
});

test('a group naming a nonexistent card is refused, and nothing is written', async (t) => {
  const files = await service(t);
  const before = await files.read(GROUPS);
  const groups = JSON.parse(before.text);
  const first = Object.keys(groups)[0];
  groups[first].members = [...groups[first].members, 'base.no-such-card-xyz'];
  const text = JSON.stringify(groups, null, 2) + '\n';
  const problems = await files.validate([{ path: GROUPS, kind: 'json', text }]);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].path, GROUPS);
  assert.match(problems[0].message, /unknown card 'base\.no-such-card-xyz'/, 'the compiler must reject authored content, not fail to import its dependencies');
  await assert.rejects(files.save([{ path: GROUPS, text, baseHash: before.hash }]), (err) => err.status === 422);
  assert.equal(await fs.readFile(path.join(root, GROUPS), 'utf8'), before.text);
});
