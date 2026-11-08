import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const preview = readFileSync(new URL('../.github/workflows/dev-preview.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const restamp = readFileSync(new URL('../.github/workflows/pr-restamp.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const step = preview.split('      - name: The rebuild changed nothing committed\n')[1]?.split('\n      # #498')[0];
assert.ok(step, 'the preview rebuild gate exists');
const gate = step.split('        run: |\n')[1].split('\n').map(line => line.replace(/^ {10}/, '')).join('\n');
// Execute the actual workflow shell, substituting only the git-status boundary.
const gitPath = process.platform === 'win32' ? execFileSync('where.exe', ['git'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0] : '';
const bash = process.platform === 'win32' ? resolve(dirname(gitPath), '../bin/bash.exe') : 'bash';
function runGate(event, ref, status) {
  return spawnSync(bash, ['--noprofile', '--norc', '-s'], {
    input: 'git() { [ "$1" = status ] || return 97; printf "%s" "$TEST_STATUS"; }\n' + gate,
    encoding: 'utf8',
    env: { ...process.env, EVENT_NAME: event, REF_NAME: ref, TEST_STATUS: status },
  });
}
const derived = ' M buildordinal.json\n M src/content/changelog.generated.js\n';

for (const ref of ['feature/widget', 'Feature/Widget', 'fix/widget', 'FIX/Widget', 'chore/widget', 'Chore/Widget']) {
  test(`restamped ${ref} can build with only regenerated metadata`, () => {
    const result = runGate('workflow_dispatch', ref, derived);
    assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  });
  test(`restamped ${ref} still rejects changed source and untracked output`, () => {
    for (const extra of [' M src/main.js\n', '?? unexpected.txt\n', ' M buildordinal.json.bak\n']) {
      assert.equal(runGate('workflow_dispatch', ref, derived + extra).status, 1);
    }
  });
}

for (const ref of ['review', 'test', 'release', 'main', 'alternative/art/test', 'worker/topic/task', 'featureless/topic']) {
  test(`${ref} retains the strict rebuild gate`, () => {
    assert.equal(runGate('workflow_dispatch', ref, derived).status, 1);
    assert.equal(runGate('workflow_dispatch', ref, '').status, 0);
  });
}

test('PR and dev builds keep their existing metadata exception', () => {
  for (const [event, ref] of [['pull_request', '123/merge'], ['push', 'dev'], ['workflow_dispatch', 'dev'], ['workflow_dispatch', 'alternative/art/dev']]) {
    assert.equal(runGate(event, ref, derived).status, 0);
    assert.equal(runGate(event, ref, derived + ' M src/main.js\n').status, 1);
  }
});

test('a successful restamp dispatches the preview with the other fast checks', () => {
  const success = restamp.split('echo "Pushed the dev merge to $head for #$pr."')[1]?.split('\n              3)')[0];
  assert.ok(success);
  const loop = success.match(/for wf in ([^;]+); do\n([\s\S]*?)\n                done/);
  assert.ok(loop);
  const result = spawnSync(bash, ['--noprofile', '--norc', '-s'], {
    input: 'gh() { printf "%s\\n" "$*"; }\n' + loop[0],
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REPOSITORY: 'example/repo', head: 'Chore/Restamped', pr: '123' },
  });
  assert.equal(result.status, 0, result.stderr);
  const calls = result.stdout.trim().split('\n');
  for (const workflow of ['tests.yml', 'receipts.yml', 'dev-preview.yml', 'quick-start.yml']) {
    assert.ok(calls.includes(`workflow run ${workflow} --repo example/repo --ref Chore/Restamped`), `missing ${workflow}: ${result.stdout}`);
  }
});
