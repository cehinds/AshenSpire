import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const workflow = name => readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');

test('rear evidence publication requires successful capture; diagnostics remain always-uploaded', () => {
  const source = workflow('enemy-back-artifact-evidence');
  const commit = source.slice(source.indexOf('      - name: Commit evidence'), source.indexOf('      - uses: actions/upload-artifact'));
  assert.match(commit, /if: success\(\)/);
  assert.doesNotMatch(commit, /if: always\(\)|--force/);
  assert.match(commit, /test "\$GITHUB_REF_NAME" = worker\/EnemyBackSprites\/artifact-evidence/);
  assert.match(commit, /git push origin HEAD:worker\/EnemyBackSprites\/artifact-evidence/);
  assert.match(source.slice(source.indexOf('      - uses: actions/upload-artifact')), /if: always\(\)/);
});

test('bounds workflow validates all 13 actors and refuses missing actors or changed frame bytes', () => {
  const source = workflow('enemy-back-schema');
  const body = source.match(/          python - <<'PY'\n([\s\S]*?)          PY/);
  assert.ok(body, 'execute the actual workflow contract, not a parallel implementation');
  const script = body[1].split('\n').map(line => line.slice(10)).join('\n');
  const run = cwd => spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', script], { cwd, encoding: 'utf8' });
  const bytes = Buffer.from('fixture frame bytes'), sha = createHash('sha256').update(bytes).digest('hex');
  for (const count of [13, 11]) {
    const root = mkdtempSync(join(tmpdir(), 'enemy-back-contract-'));
    try {
      for (let i = 0; i < count; i++) {
        const relative = `art/enemy-back-proposals/actor${i}`, dir = join(root, relative);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'source.png'), bytes);
        const variants = Array.from({ length: 10 }, (_, n) => ({ id: `v${n}`, boundsAnchor: [256, 464], sha256: sha }));
        for (const v of variants) writeFileSync(join(dir, v.id+'.png'), bytes);
        writeFileSync(join(dir, 'normalized.json'), JSON.stringify({ output: { boundsAnchor: [256, 464] }, qa: { errors: [] }, source: { path: relative+'/source.png', sha256: sha }, variants }));
      }
      const result = run(root);
      if (count === 11) {
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Expected reviewed 13 actors/);
      } else {
        assert.equal(result.status, 0, result.stdout+result.stderr);
        assert.match(result.stdout, /13 actors \/ 130 unchanged frame files/);
        writeFileSync(join(root, 'art/enemy-back-proposals/actor0/v0.png'), 'corrupt');
        assert.notEqual(run(root).status, 0, 'a changed frame must still fail');
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
