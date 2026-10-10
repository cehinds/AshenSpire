import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseRunNodeOptions, discoveryShardFiles, discoverySpeedFiles, SLOW_DISCOVERED, selftestInGroup } from './run-node-lanes.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUNNER = readFileSync(join(ROOT, 'tests/run-node.mjs'), 'utf8');

test('default and old lane flags retain their complete original work', () => {
  assert.deepEqual(parseRunNodeOptions([]), { core: true, selftests: true, discovered: true, shard: null, selftestGroup: null, slow: 'include' });
  assert.deepEqual(parseRunNodeOptions(['--no-selftests']), { core: true, selftests: false, discovered: true, shard: null, selftestGroup: null, slow: 'include' });
  assert.deepEqual(parseRunNodeOptions(['--selftests-only']), { core: false, selftests: true, discovered: false, shard: null, selftestGroup: null, slow: 'include' });
  assert.deepEqual(parseRunNodeOptions(['--no-selftests', '--no-discovered']), { core: true, selftests: false, discovered: false, shard: null, selftestGroup: null, slow: 'include' });
  assert.deepEqual(parseRunNodeOptions(['--discovered-only', '--shard', '1/4']), { core: false, selftests: false, discovered: true, shard: { index: 1, count: 4 }, selftestGroup: null, slow: 'include' });
});

test('malformed, duplicate, unknown and incompatible selections are refused', () => {
  const bad = [
    ['--typo'], ['--no-selftests', '--no-selftests'], ['--shard'], ['--shard', '0/2'],
    ['--discovered-only', '--no-discovered'], ['--discovered-only', '--no-selftests'],
    ['--selftests-only', '--discovered-only'], ['--selftests-only', '--no-discovered'],
    ['--selftests-only', '--no-selftests'], ['--selftest-group'], ['--selftest-group', 'link'],
    ['--selftests-only', '--selftest-group', 'typo'],
    ['--selftests-only', '--selftest-group', 'link', '--selftest-group', 'other'],
    ['--no-slow'], ['--slow-only'], ['--no-selftests', '--no-slow'], ['--selftests-only', '--slow-only'],
    ['--discovered-only', '--no-slow', '--slow-only'], ['--discovered-only', '--no-slow', '--no-slow'],
  ];
  for (const value of ['', 'all', '1', '4/4', '0/0', '-1/4', '01/4', '1/04', '1/2/3', ' 1/2', '0/9007199254740992']) {
    bad.push(['--discovered-only', '--shard', value]);
  }
  for (const args of bad) assert.throws(() => parseRunNodeOptions(args), undefined, args.join(' '));
});

test('discovered shards preserve order and cover each original file exactly once', () => {
  for (let size = 1; size <= 80; size++) {
    const files = Array.from({ length: size }, (_, i) => `tests/${i}.test.mjs`);
    assert.deepEqual(discoveryShardFiles(files, null), files);
    assert.notEqual(discoveryShardFiles(files, null), files);
    for (let count = 1; count <= Math.min(size, 9); count++) {
      const picked = Array.from({ length: count }, (_, index) => discoveryShardFiles(files, { index, count }));
      assert.deepEqual(picked.flat().sort(), [...files].sort());
      for (const shard of picked) {
        assert.deepEqual(shard.map(file => files.indexOf(file)), shard.map(file => files.indexOf(file)).sort((a, b) => a - b));
        assert.ok(shard.length === Math.floor(size / count) || shard.length === Math.ceil(size / count));
      }
    }
  }
  assert.throws(() => discoveryShardFiles([], null), /zero-work/);
  assert.throws(() => discoveryShardFiles(['one'], { index: 1, count: 2 }), /zero-work/);
});

test('slow selection splits the discovered corpus exactly in two and composes with shards', () => {
  assert.deepEqual(parseRunNodeOptions(['--discovered-only', '--no-slow', '--shard', '0/4']).slow, 'exclude');
  assert.deepEqual(parseRunNodeOptions(['--discovered-only', '--slow-only']).slow, 'only');
  const files = ['tests/a.test.mjs', ...SLOW_DISCOVERED.keys(), 'tests/z.test.mjs'].sort();
  const fast = discoverySpeedFiles(files, 'exclude');
  const slow = discoverySpeedFiles(files, 'only');
  assert.deepEqual(discoverySpeedFiles(files, 'include'), files);
  assert.deepEqual(slow, [...SLOW_DISCOVERED.keys()].sort());
  assert.deepEqual([...fast, ...slow].sort(), files);
  assert.equal(fast.filter(file => slow.includes(file)).length, 0);
  const sharded = Array.from({ length: 2 }, (_, index) => discoveryShardFiles(fast, { index, count: 2 }));
  assert.deepEqual(sharded.flat().sort(), fast);
  assert.throws(() => discoverySpeedFiles(files, 'typo'), /include, exclude or only/);
});

test('every SLOW_DISCOVERED entry names a discovered test file with a reason', () => {
  for (const [file, reason] of SLOW_DISCOVERED) {
    assert.match(file, /\.test\.mjs$/);
    assert.ok(existsSync(join(ROOT, file)), `${file} is gone; remove its SLOW_DISCOVERED entry`);
    assert.ok(reason.length > 10, `${file} needs its reason`);
  }
});

test('every existing selftest site participates in the exhaustive link/other partition', () => {
  const guards = [...RUNNER.matchAll(/if \(SELFTESTS && selftestInGroup\(options\.selftestGroup, '([^']+)'\)\)/g)].map(match => match[1]);
  assert.equal(guards.length, 18, 'all original selftest call sites are routed');
  assert.equal(new Set(guards).size, guards.length);
  assert.equal((RUNNER.match(/if \(SELFTESTS\b/g) || []).length, guards.length, 'no ungrouped call site');
  const link = guards.filter(tool => selftestInGroup('link', tool));
  const other = guards.filter(tool => selftestInGroup('other', tool));
  assert.deepEqual(link, ['linkcheck']);
  assert.equal(other.length, 17);
  assert.deepEqual([...link, ...other].sort(), [...guards].sort());
  for (const tool of guards) assert.equal(selftestInGroup(null, tool), true);
  assert.throws(() => selftestInGroup('typo', 'linkcheck'));
});

function fixture(run) {
  // Temporary probes remain on the owner's D: checkout volume. No real tools,
  // assets or modules are linked in: an accidentally executed lane fails.
  const parent = join(ROOT, 'scratch');
  mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(join(parent, 'run-node-lanes-'));
  mkdirSync(join(dir, 'tests'));
  mkdirSync(join(dir, 'tools'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  copyFileSync(join(ROOT, 'tests/run-node.mjs'), join(dir, 'tests/run-node.mjs'));
  copyFileSync(join(ROOT, 'tests/run-node-lanes.mjs'), join(dir, 'tests/run-node-lanes.mjs'));
  writeFileSync(join(dir, 'tests/engine.test.js'), 'export function runTests(){throw new Error("ENGINE_LANE_MUST_NOT_RUN")}');
  for (const file of ['confirmation-modal', 'reward-confirm', 'card-removal-flick']) {
    writeFileSync(join(dir, `tests/${file}.test.mjs`), 'throw new Error("EXCLUDED_TEST_MUST_NOT_RUN");');
  }
  writeFileSync(join(dir, 'tools/bundle.test.mjs'), 'throw new Error("EXCLUDED_TEST_MUST_NOT_RUN");');
  const tools = new Set([...RUNNER.matchAll(/['"]tools\/([^'"]+\.mjs)['"]/g)].map(match => match[1]));
  for (const name of tools) {
    if (name !== 'bundle.test.mjs') writeFileSync(join(dir, 'tools', name), 'throw new Error("TOOL_LANE_MUST_NOT_RUN");');
  }
  try { run(dir); }
  finally {
    assert.ok(resolve(dir).startsWith(resolve(parent) + '/'.replace('/', process.platform === 'win32' ? '\\' : '/')));
    rmSync(dir, { recursive: true, force: true });
  }
}

function invoke(dir, args) {
  const env = { ...process.env };
  // This subprocess is an independent CLI invocation, not a nested node:test
  // worker. Node otherwise silently refuses its child --test discovery.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['tests/run-node.mjs', ...args], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.error, undefined, String(result.error));
  return { status: result.status, output: `${result.stdout || ''}${result.stderr || ''}` };
}

test('actual discovery-only subprocess runs its shard without engine, excluded tests or tools', () => fixture(dir => {
  const receipt = join(dir, 'visited.txt');
  for (let i = 0; i < 4; i++) writeFileSync(join(dir, `tests/probe-${i}.test.mjs`), `import test from 'node:test'; import {appendFileSync} from 'node:fs'; test('FILE_${i}',()=>appendFileSync('visited.txt','${i}\\n'));`);
  for (let index = 0; index < 2; index++) {
    writeFileSync(receipt, '');
    const result = invoke(dir, ['--discovered-only', '--shard', `${index}/2`]);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /2 files, 2 tests, 0 failed/);
    assert.deepEqual(readFileSync(receipt, 'utf8').trim().split('\n').sort(), index === 0 ? ['0', '2'] : ['1', '3']);
    assert.doesNotMatch(result.output, /LANE_MUST_NOT_RUN|EXCLUDED_TEST_MUST_NOT_RUN/);
  }
  const empty = invoke(dir, ['--discovered-only', '--shard', '4/5']);
  assert.equal(empty.status, 2, empty.output);
  assert.match(empty.output, /zero-work/);
  assert.doesNotMatch(empty.output, /PASS/);
}));

test('discovery-only keeps failed assertions, syntax errors and stale exclusions red', () => fixture(dir => {
  const probe = join(dir, 'tests/probe.test.mjs');
  writeFileSync(probe, "import test from 'node:test'; import assert from 'node:assert/strict'; test('ASSERTION_SENTINEL',()=>assert.equal(1,2));");
  let result = invoke(dir, ['--discovered-only']);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /ASSERTION_SENTINEL/);
  writeFileSync(probe, 'export const SYNTAX_SENTINEL = ;');
  result = invoke(dir, ['--discovered-only']);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /SyntaxError/);
  writeFileSync(probe, "import test from 'node:test'; test('clean',()=>{});");
  rmSync(join(dir, 'tests/reward-confirm.test.mjs'));
  result = invoke(dir, ['--discovered-only']);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /NOT_SPAWNED names tests\/reward-confirm\.test\.mjs/);
}));

test('actual link group runs only the original link verdict, and unknown remains red', () => fixture(dir => {
  const link = join(dir, 'tools/linkcheck.mjs');
  writeFileSync(link, "if(process.argv.slice(2).join(' ')!=='--selftest') throw Error('BAD_ARGS'); console.log('RESULT: LINK_ONLY_SENTINEL.');");
  let result = invoke(dir, ['--selftests-only', '--selftest-group', 'link']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /LINK_ONLY_SENTINEL/);
  assert.doesNotMatch(result.output, /LANE_MUST_NOT_RUN|every discovered test file/);
  writeFileSync(link, "console.log('UNKNOWN: cannot test'); process.exit(2);");
  result = invoke(dir, ['--selftests-only', '--selftest-group', 'link']);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /FAIL.*45\./);
  writeFileSync(link, "console.log('RESULT: LOOKS_GREEN_BUT_FAILED.'); process.exit(1);");
  result = invoke(dir, ['--selftests-only', '--selftest-group', 'link']);
  assert.equal(result.status, 1, result.output);
  result = invoke(dir, ['--discovered-only', '--shard']);
  assert.equal(result.status, 2, result.output);
}));

function job(text, name) {
  const match = new RegExp(`^  ${name}:\\r?$`, 'm').exec(text);
  assert.ok(match, `missing job ${name}`);
  const tail = text.slice(match.index + match[0].length);
  return tail.split(/\n  [a-zA-Z0-9_-]+:\r?\n/)[0];
}

test('both workflow matrices execute all discovery shards and both selftest groups under unchanged bounds', () => {
  for (const [file, discovered, selftests, core] of [
    ['ci.yml', 'test-discovered', 'test-selftests', 'test'],
    ['tests.yml', 'discovered', 'selftests', 'core'],
  ]) {
    const workflow = readFileSync(join(ROOT, '.github/workflows', file), 'utf8');
    const discovery = job(workflow, discovered);
    assert.match(discovery, /timeout-minutes: 20/);
    assert.match(discovery, /fail-fast: false/);
    assert.match(discovery, /--discovered-only --shard \$\{\{ matrix\.shard \}\}/);
    const shards = [...discovery.matchAll(/['"](\d+\/\d+)['"]/g)].map(match => match[1]);
    assert.deepEqual(shards, ['0/4', '1/4', '2/4', '3/4']);
    assert.match(discovery, /fetch-art/);
    assert.match(discovery, /Pillow==11\.1\.0/);
    if (file === 'ci.yml') assert.match(discovery, /os: \[ubuntu-latest, windows-latest, macos-latest\]/);
    const corpus = job(workflow, selftests);
    assert.match(corpus, /timeout-minutes: 20/);
    assert.match(corpus, /fail-fast: false/);
    assert.match(corpus, /group: \['?link'?, '?other'?\]/);
    assert.match(corpus, /--selftests-only --selftest-group \$\{\{ matrix\.group \}\}/);
    assert.match(job(workflow, core), /--no-selftests --no-discovered/);
    if (file === 'ci.yml') assert.match(job(workflow, 'boundary'), /needs: \[[^\]]*test-discovered[^\]]*test-selftests/);
  }
});

test('browser layout and startup matrices retain every shard with an independent twenty-minute bound', () => {
  const workflow = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  for (const [name, tool, count] of [
    ['browser-layout-plants', 'screenreach', 4],
    ['browser-startup-plants', 'startup-gate', 8],
  ]) {
    const body = job(workflow, name);
    assert.match(body, /timeout-minutes: 20/);
    assert.match(body, /fail-fast: false/);
    assert.match(body, new RegExp(`${tool}\\.mjs --selftest --shard \\$\\{\\{ matrix\\.shard \\}\\}`));
    assert.deepEqual([...body.matchAll(/['"](\d+\/\d+)['"]/g)].map(match => match[1]), Array.from({ length: count }, (_, i) => `${i}/${count}`));
    assert.match(job(workflow, 'boundary'), new RegExp(`needs: \\[[^\\]]*${name}`));
  }
});
