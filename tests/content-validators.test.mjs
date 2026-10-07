// The content validators under tools/ that nothing else runs. Each had gone red
// unseen — hard-coded counts from an older roster, a retired `encounter.act` —
// because no suite spawned it. This file is discovered by tests/run-node.mjs,
// so a validator that goes red now fails the suite, naming its FAIL lines.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function runTool(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  const failures = out.split('\n').filter((line) => /^FAIL\b/.test(line));
  return { code: result.status, out, failures };
}

const VALIDATORS = [
  ['tools/rogue-parity.mjs', [], /^rogue-parity: (\d+) passed, 0 failed$/m],
  ['tools/enemy-level-content.mjs', [], /^enemy level content: (\d+)\/\1$/m],
  ['tools/enemy-level-content.mjs', ['--selftest'], /^enemy level content selftest: (\d+)\/\1 plants caught$/m],
];

for (const [script, args, verdict] of VALIDATORS) {
  test(`${[script, ...args].join(' ')} passes every check`, () => {
    const { code, out, failures } = runTool(script, args);
    assert.deepEqual(failures, [], `${script} reported failures:\n${failures.join('\n')}`);
    assert.equal(code, 0, `${script} exited ${code}:\n${out}`);
    assert.match(out, verdict, `${script} printed no all-green verdict line:\n${out}`);
  });
}
