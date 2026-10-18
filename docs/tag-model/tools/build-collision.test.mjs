// build.mjs must refuse an authored tag whose id is also a generated node id,
// instead of dropping the authored row silently. The test runs the build on a
// temporary copy of the repo, never the real tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function copyRepo() {
  const tmp = mkdtempSync(join(tmpdir(), 'tag-collide-'));
  for (const d of ['src', 'content', 'styles', join('docs', 'tag-model')]) {
    cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
  }
  return tmp;
}

function runBuild(tmp) {
  return spawnSync(process.execPath, [join(tmp, 'docs', 'tag-model', 'tools', 'build.mjs')], { encoding: 'utf8', timeout: 120000 });
}

test('build refuses an authored tag whose id is a generated node id', () => {
  const tmp = copyRepo();
  try {
    const tools = join(tmp, 'docs', 'tag-model', 'tools');
    // meta.presentation.layout is a generated node. Give it an authored legacy
    // snapshot entry, which makes it an authored tag too.
    const id = 'meta.presentation.layout';
    const legacy = JSON.parse(readFileSync(join(tools, 'legacy-status.json'), 'utf8'));
    assert.equal(legacy[id], undefined, 'precondition: the generated id has no legacy entry');
    legacy[id] = 'new';
    writeFileSync(join(tools, 'legacy-status.json'), JSON.stringify(legacy, null, 1));
    const res = runBuild(tmp);
    assert.notEqual(res.status, 0, 'build should fail');
    assert.match(res.stderr, /authored tag id meta\.presentation\.layout collides with a generated node id/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('build of the unmodified copy does not report a collision', () => {
  const tmp = copyRepo();
  try {
    const res = runBuild(tmp);
    assert.equal(res.status, 0, res.stderr);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
