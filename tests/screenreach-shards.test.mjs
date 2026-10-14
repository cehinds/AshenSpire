import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseShard, selectShard } from '../tools/doorplant.mjs';

// Execute the real CLI branch with only its expensive browser harness replaced.
// This checks the declared corpus, handoff and verdict, without claiming a render.
const source = readFileSync(new URL('../tools/screenreach.mjs', import.meta.url), 'utf8');
const begin = source.indexOf("if (process.argv.includes('--selftest')) {");
const end = source.indexOf('\nconst ROOT =', begin);
const branch = source.slice(begin, end).replace(
  "await import('./doorplant.mjs')", 'harness');
assert.ok(begin >= 0 && end > begin && branch.includes('harness'));

async function run(shardText = 'all', code = 0) {
  let received;
  let exitCode;
  const lines = [];
  const shard = parseShard(shardText);
  const harness = {
    resolveShard: () => shard,
    selectShard,
    doorSelftest: async (corpus) => { received = corpus; return code; },
  };
  await new Function('harness', 'process', 'console',
    `return (async () => { ${branch} })();`)(harness, {
    argv: ['node', 'screenreach.mjs', '--selftest'],
    exit: (value) => { exitCode = value; },
  }, { log: (line) => lines.push(line) });
  return { received, exitCode, lines };
}

test('screenreach CLI hands every original plant to exactly one of its four shards', async () => {
  const whole = await run();
  const names = whole.received.plants.map((plant) => plant.name);
  assert.ok(names.length >= 14);
  assert.equal(whole.received.shard, null);
  const observed = [];
  for (let index = 0; index < 4; index++) {
    const result = await run(`${index}/4`);
    assert.equal(result.exitCode, 0);
    const selected = selectShard(result.received.plants, result.received.shard);
    observed.push(...selected.map((plant) => plant.name));
    assert.ok(result.lines.includes(
      `screenreach-selftest: OK — ${selected.length} plants, ${selected.length} caught`));
    assert.deepEqual(result.received.args, whole.received.args);
    assert.equal(result.received.timeoutMs, whole.received.timeoutMs);
    assert.deepEqual(result.received.plants, whole.received.plants);
  }
  assert.deepEqual(observed.sort(), [...names].sort());
  assert.equal(new Set(observed).size, names.length);
});

test('screenreach CLI preserves red and unknown exits and never prints success for either', async () => {
  for (const code of [1, 2]) {
    const result = await run('2/4', code);
    assert.equal(result.exitCode, code);
    assert.equal(result.lines.some((line) => line.includes(': OK')), false);
  }
});
