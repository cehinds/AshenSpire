// tests/doorplant-shard.test.mjs — a sharded known-bad corpus still runs every
// plant exactly once, and every sharded CI job lists every shard of its count.
//
// WHY (owner rule, 2026-10-02: every CI job finishes in 20 minutes or less).
// startup-gate's 26 browser plants took 41-46 minutes as one serial step, so
// tools/doorplant.mjs grew `--shard i/n` and ci.yml spreads the corpus over a
// matrix. A shard rule that dropped or doubled a plant, or a matrix that forgot
// a leg, would turn coverage into a smaller corpus that still reads green —
// the silent-shrink defect doorplant's header names. This pins both edges.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseShard, resolveShard, selectShard } from '../tools/doorplant.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('the union of the shards is the whole corpus, and no plant runs twice', () => {
  for (let size = 0; size <= 40; size++) {
    const corpus = Array.from({ length: size }, (_, i) => ({ name: `plant ${i}` }));
    for (let count = 1; count <= 9; count++) {
      const seen = new Map();
      for (let index = 0; index < count; index++) {
        const picked = selectShard(corpus, { index, count });
        // Each shard keeps corpus order — a reader comparing a shard's log to
        // the corpus reads it top to bottom.
        const positions = picked.map((p) => corpus.indexOf(p));
        assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `shard ${index}/${count} reorders the corpus`);
        // Balanced by count: no shard carries more than one plant over another.
        assert.ok(picked.length === Math.floor(size / count) || picked.length === Math.ceil(size / count),
          `shard ${index}/${count} of ${size} runs ${picked.length} plants`);
        for (const p of picked) seen.set(p, (seen.get(p) || 0) + 1);
      }
      assert.equal(seen.size, size, `${count} shards of ${size} plants miss ${size - seen.size}`);
      assert.ok([...seen.values()].every((n) => n === 1), `${count} shards of ${size} plants run a plant twice`);
    }
  }
});

test('unsharded runs every plant, as before', () => {
  const corpus = ['a', 'b', 'c'];
  assert.deepEqual(selectShard(corpus, null), corpus);
  assert.notEqual(selectShard(corpus, null), corpus, 'a copy, so a caller cannot mutate the corpus through it');
  assert.equal(resolveShard(['node', 'tool.mjs', '--selftest'], {}), null);
  assert.equal(resolveShard(['node', 'tool.mjs', '--selftest', '--shard', 'all'], {}), null);
  assert.equal(resolveShard(['node', 'tool.mjs', '--selftest'], { DOORPLANT_SHARD: 'all' }), null);
});

test('the shard comes from --shard first, then DOORPLANT_SHARD', () => {
  assert.deepEqual(resolveShard(['node', 't', '--shard', '1/4'], {}), { index: 1, count: 4 });
  assert.deepEqual(resolveShard(['node', 't'], { DOORPLANT_SHARD: '2/3' }), { index: 2, count: 3 });
  assert.deepEqual(resolveShard(['node', 't', '--shard', '0/2'], { DOORPLANT_SHARD: '2/3' }), { index: 0, count: 2 });
});

test('a malformed shard is refused, never read as "run everything" or "run nothing"', () => {
  for (const bad of ['', '4/4', '5/4', '0/0', '-1/2', '1', '1/', '/2', 'a/b', '1/2/3', ' 1/2']) {
    assert.throws(() => parseShard(bad), /shard must be/, `accepted ${JSON.stringify(bad)}`);
  }
  assert.throws(() => resolveShard(['node', 't', '--shard'], {}), /shard must be/);
});

// THE WORKFLOW HALF. Read as text (the repo carries no YAML parser): for each
// job whose step passes `--shard ${{ matrix.shard }}`, the job's matrix must
// list i/n for every i in 0..n-1, once — per runner OS when the matrix is an
// `include:` list naming one.
function jobs(text) {
  const out = new Map();
  const body = text.slice(text.indexOf('\njobs:\n'));
  const re = /^ {2}([A-Za-z0-9_-]+):\n/gm;
  const marks = [...body.matchAll(re)];
  marks.forEach((m, i) => out.set(m[1], body.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : body.length)));
  return out;
}

function shardLegs(job) {
  const legs = [];
  for (const m of job.matchAll(/\{([^}\n]*\bshard:[^}\n]*)\}/g)) {
    const os = /\bos:\s*([\w.-]+)/.exec(m[1])?.[1] ?? '*';
    legs.push({ os, shard: /\bshard:\s*'?([^',\s}]+)/.exec(m[1])?.[1] });
  }
  const list = /^\s+shard:\s*\[([^\]]*)\]/m.exec(job);
  if (list) for (const s of list[1].matchAll(/'([^']+)'/g)) legs.push({ os: '*', shard: s[1] });
  return legs;
}

test('every sharded job in ci.yml runs every shard of its count, each once', () => {
  const text = readFileSync(`${ROOT}.github/workflows/ci.yml`, 'utf8').replace(/\r\n/g, '\n');
  const sharded = [...jobs(text)].filter(([, job]) => /--shard \$\{\{ matrix\.shard \}\}/.test(job));
  assert.ok(sharded.length >= 4, `expected the startup-gate, hintstrip, about-changelog and buildversion shards; found ${sharded.map(([n]) => n).join(', ')}`);
  for (const [name, job] of sharded) {
    const byOs = new Map();
    for (const { os, shard } of shardLegs(job)) {
      if (shard === 'all') continue;
      const parsed = parseShard(shard);
      if (!byOs.has(os)) byOs.set(os, []);
      byOs.get(os).push(parsed);
    }
    assert.ok(byOs.size, `${name} passes --shard but its matrix lists no shards`);
    for (const [os, legs] of byOs) {
      const counts = new Set(legs.map((l) => l.count));
      assert.equal(counts.size, 1, `${name} (${os}) mixes shard counts ${[...counts].join(', ')}`);
      const [count] = counts;
      const indices = legs.map((l) => l.index).sort((a, b) => a - b);
      assert.deepEqual(indices, Array.from({ length: count }, (_, i) => i), `${name} (${os}) runs shards ${indices.join(', ')} of ${count}`);
    }
  }
});

test('doorSelftest shards only when its caller passes a shard, never from a stray env', () => {
  // A tool that never opted in (its corpus count is a literal, or it prints
  // "N plants, N caught" over the whole corpus) must not be silently cut to a
  // shard because DOORPLANT_SHARD happened to be set in the environment. The
  // opted-in tools (startup-gate, hintstrip) resolve the shard themselves and
  // pass it, so the default of doorSelftest's `shard` is "every plant".
  const src = readFileSync(`${ROOT}tools/doorplant.mjs`, 'utf8');
  const sig = /export async function doorSelftest\(\{(.*)\}\)\s*\{/.exec(src);
  assert.ok(sig, 'doorSelftest signature not found in tools/doorplant.mjs');
  const dflt = /\bshard\s*=\s*([^,]+?)\s*(,|$)/.exec(sig[1]);
  assert.ok(dflt, 'doorSelftest takes no `shard` option');
  assert.equal(dflt[1], 'null', `doorSelftest's shard defaults to ${dflt[1]}, so an unrelated tool shards from the environment`);
  for (const tool of ['startup-gate.mjs', 'hintstrip.mjs']) {
    assert.match(readFileSync(`${ROOT}tools/${tool}`, 'utf8'), /doorSelftest\(\{\s*\.\.\.SELFTEST,\s*shard\s*\}\)/, `${tool} no longer passes its shard to doorSelftest`);
  }
});
