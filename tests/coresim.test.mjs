// tools/coresim.mjs: the headless Core 2 Act 1 simulator. Five seeded Reaver runs finish without a crash or a stalemate,
// two identical invocations print identical JSON, and HP never exceeds max HP or rises across a non-rest node except by a
// logged heal (a flask or healing effect in the fight, the after-combat recovery, a node refill).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL = fileURLToPath(new URL('../tools/coresim.mjs', import.meta.url));
const ARGS = ['--class', 'reaver', '--runs', '5', '--seed-base', '1000', '--policy', 'greedy', '--records'];

function invoke(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TOOL, ...ARGS, '--json', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

test('coresim: 5 seeded Reaver runs finish clean, identical invocations print identical JSON, HP stays lawful', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'coresim-'));
  try {
    const [a, b] = await Promise.all([invoke(join(dir, 'a.json')), invoke(join(dir, 'b.json'))]);
    assert.equal(a.code, 0, a.err);
    assert.equal(b.code, 0, b.err);
    assert.equal(a.out, b.out, 'the printed report is identical');
    const first = readFileSync(join(dir, 'a.json'), 'utf8');
    assert.equal(first, readFileSync(join(dir, 'b.json'), 'utf8'), 'the JSON is identical');
    const row = JSON.parse(first).results['greedy:reaver'];
    assert.equal(row.runs, 5);
    assert.equal(row.records.length, 5);
    assert.equal(row.stalemates, 0, 'no stalemate');
    assert.equal(row.crashes, 0);
    assert.ok(row.meanFightsPerRun >= 1, 'the runs fought');
    for (const run of row.records) {
      assert.ok(run.win || run.death, `run ${run.seed} ends in a win or a death`);
      assert.ok(run.trace.length > 0, `run ${run.seed} walked nodes`);
      for (const step of run.trace) {
        const at = `run ${run.seed} ${step.kind} ${step.nodeId}`;
        assert.ok(step.hpOut <= step.maxHp, `${at}: HP ${step.hpOut} above max ${step.maxHp}`);
        assert.ok(step.hpOut >= 0, `${at}: HP below 0`);
        if (step.kind === 'rest') continue;
        assert.ok(step.hpOut <= step.hpIn + step.healed, `${at}: HP rose ${step.hpIn} -> ${step.hpOut} with only ${step.healed} logged healing`);
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('coresim: --selftest passes and a bad argument exits non-zero', async () => {
  const run = (args) => new Promise((resolve) => {
    const child = spawn(process.execPath, [TOOL, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, err }));
  });
  const [ok, bad] = await Promise.all([run(['--selftest']), run(['--class', 'nobody'])]);
  assert.equal(ok.code, 0, ok.err);
  assert.notEqual(bad.code, 0);
});
