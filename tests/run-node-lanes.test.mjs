import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { COOP_TESTS_ENABLED, COOP_TEST_SKIP_REASON } from './feature-scopes.js';
import { parseRunNodeOptions, discoveryShardFiles, discoverySpeedFiles, discoveryFeatureFiles, isCoopTestFile, SLOW_DISCOVERED, selftestInGroup, shardSummaryCounts } from './run-node-lanes.mjs';

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
  mkdirSync(join(dir, 'src/config/generated'), { recursive: true });
  copyFileSync(join(ROOT, 'tests/feature-scopes.js'), join(dir, 'tests/feature-scopes.js'));
  writeFileSync(join(dir, 'src/config/generated/ui.js'), 'export const uiConfig = {screens:{title:{behavior:{coopEnabled:false}}}};');
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
    // CI keeps the complete corpus: Windows moves the four slow files to
    // dedicated runners; Linux/macOS retain full shards. Dev excludes slow files;
    // its discovered-slow, selftests and parse-gate jobs moved to ci.yml's test
    // stage, so they must not come back here.
    if (file === 'ci.yml') {
      assert.match(discovery, /--discovered-only --shard \$\{\{ matrix\.shard \}\}/);
      assert.match(discovery, /if: runner\.os != 'Windows'\n        run: node tools\/verdict\.mjs -- node tests\/run-node\.mjs --discovered-only --shard/);
      assert.match(discovery, /if: runner\.os == 'Windows'\n        run: node tools\/verdict\.mjs -- node tests\/run-node\.mjs --discovered-only --no-slow --shard/);
      assert.doesNotMatch(discovery, /--slow-only/);
    } else {
      assert.match(discovery, /--discovered-only --no-slow --shard \$\{\{ matrix\.shard \}\}/);
      for (const gone of ['discovered-slow', 'selftests', 'parse-gate']) {
        assert.doesNotMatch(workflow, new RegExp(`^  ${gone}:\\r?$`, 'm'), `${gone} is in ci.yml's test stage, not tests.yml`);
      }
    }
    const shards = [...discovery.matchAll(/['"](\d+\/\d+)['"]/g)].map(match => match[1]);
    assert.deepEqual(shards, ['0/4', '1/4', '2/4', '3/4']);
    assert.match(discovery, /fetch-art/);
    assert.match(discovery, /Pillow==11\.1\.0/);
    if (file === 'ci.yml') assert.match(discovery, /os: \[ubuntu-latest, windows-latest, macos-latest\]/);
    if (file === 'ci.yml') {
      const corpus = job(workflow, selftests);
      assert.match(corpus, /timeout-minutes: 20/);
      assert.match(corpus, /fail-fast: false/);
      assert.match(corpus, /group: \['?link'?, '?other'?\]/);
      assert.match(corpus, /--selftests-only --selftest-group \$\{\{ matrix\.group \}\}/);
    }
    assert.match(job(workflow, core), /--no-selftests --no-discovered/);
    if (file === 'ci.yml') assert.match(job(workflow, 'boundary'), /needs: \[[^\]]*test-discovered[^\]]*test-selftests/);
  }
});


test('Windows fast shards and isolated slow jobs cover the real discovered corpus exactly once', () => {
  const workflow = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const isolated = job(workflow, 'test-discovered-slow-windows');
  assert.match(isolated, /runs-on: windows-latest/);
  assert.match(isolated, /timeout-minutes: 20/);
  assert.match(isolated, /fail-fast: false/);
  assert.match(isolated, /run: node --test --test-reporter=spec "\$\{\{ matrix\.file \}\}"/);
  assert.doesNotMatch(isolated, /run-node\.mjs|--test-(?:skip|name)-pattern|continue-on-error/);
  assert.match(isolated, /actions\/checkout@/);
  assert.match(isolated, /\.\/\.github\/actions\/setup-node/);
  // These headless simulations read only repository source/data and Markdown.
  assert.doesNotMatch(isolated, /fetch-art|Pillow/);
  const slow = [...isolated.matchAll(/'(tests\/[^'\n]+\.test\.mjs)'/g)].map(match => match[1]);
  assert.deepEqual(slow.slice().sort(), [...SLOW_DISCOVERED.keys()].sort(), 'matrix is the existing closed slow set, without duplicates');
  const skipped = new Set(['node_modules', 'dist', 'build', 'scratch']);
  const elsewhere = new Set([...RUNNER.slice(RUNNER.indexOf('const NOT_SPAWNED ='), RUNNER.indexOf('const found =')).matchAll(/\['([^']+\.test\.mjs)'/g)].map(match => match[1]));
  assert.equal(elsewhere.size, 4, 'the census retains every runner exclusion');
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipped.has(entry.name) && (!entry.name.startsWith('.') || entry.name === '.github')) walk(join(dir, entry.name));
      } else if (entry.name.endsWith('.test.mjs')) {
        const file = relative(ROOT, join(dir, entry.name)).split(sep).join('/');
        if (!elsewhere.has(file)) files.push(file);
      }
    }
  };
  walk(ROOT); files.sort();
  const eligible = discoveryFeatureFiles(files, { coopEnabled: COOP_TESTS_ENABLED });
  const fast = discoverySpeedFiles(eligible, 'exclude');
  const windows = [...Array.from({ length: 4 }, (_, index) => discoveryShardFiles(fast, { index, count: 4 })).flat(), ...slow];
  assert.deepEqual(windows.slice().sort(), eligible, 'Windows runs the complete active-feature corpus');
  assert.equal(new Set(windows).size, windows.length, 'no file runs twice');
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

test('shard summary counts name a time stop, a missing count, or print the normal counts', () => {
  const normal = 'ℹ tests 812\nℹ suites 40\nℹ pass 811\nℹ fail 1\nℹ duration_ms 1200\n';
  assert.equal(shardSummaryCounts({ out: normal, timedOut: false, limitMinutes: 15, files: 149 }), '149 files, 812 tests, 1 failed');
  // A stopped shard prints no summary, so the counts are unknown even if partial output is present.
  assert.equal(shardSummaryCounts({ out: '', timedOut: true, limitMinutes: 15, files: 149 }), '149 files, stopped after 15 minutes (timed out; no test summary)');
  assert.equal(shardSummaryCounts({ out: normal, timedOut: true, limitMinutes: 15, files: 149 }), '149 files, stopped after 15 minutes (timed out; no test summary)');
  // Not timed out, but the summary is missing a count: never print NaN.
  assert.equal(shardSummaryCounts({ out: 'ℹ tests 5\n', timedOut: false, limitMinutes: 15, files: 3 }), '3 files, counts unavailable');
  assert.equal(shardSummaryCounts({ out: '', timedOut: false, limitMinutes: 15, files: 3 }), '3 files, counts unavailable');
  assert.doesNotMatch(shardSummaryCounts({ out: '', timedOut: false, limitMinutes: 15, files: 3 }), /NaN/);
});

test('the discovered summary line uses the shard counts helper, so a time stop never prints NaN', () => {
  assert.match(RUNNER, /shardSummaryCounts\(\{ out, timedOut: result\.error\?\.code === 'ETIMEDOUT'/);
  assert.match(RUNNER, /\$\{counts\}/);
  assert.doesNotMatch(RUNNER, /\$\{count\('tests'\)\} tests/);
});


test('co-op scope excludes only dedicated files and always retains the parked contract', () => {
  const dedicated = ['tests/coop-hit-preview.test.mjs', 'tests/coop-range-preview.test.mjs',
    'tests/enemy-pile-ops-coop.test.mjs', 'tests/enemy-card-injections-coop.test.mjs',
    'tests/core-coop-constructor.test.mjs', 'tests/session-card-receipt.test.mjs',
    'tests/session-reaction-rules-party.test.mjs', 'tests/session-range-preview.test.mjs',
    'tests/party-range-context.test.mjs', 'tests/lan-intent-privacy.test.mjs', 'tests/lobby-storage-guard.test.mjs',
    'tests/enemy-knowledge-lan.test.mjs'];
  const retained = ['tests/coop-parked.test.mjs', 'tests/combat-reactions.test.mjs',
    'tests/range-preview.test.mjs', 'tests/run-node-lanes.test.mjs', 'tests/wireframe-possession-variants.test.mjs',
    'tests/seats.test.mjs'];
  const files = [...dedicated, ...retained].sort();
  assert.deepEqual(discoveryFeatureFiles(files, { coopEnabled: false }), retained.sort());
  assert.deepEqual(discoveryFeatureFiles(files, { coopEnabled: true }), files);
  assert.notEqual(discoveryFeatureFiles(files, { coopEnabled: true }), files);
  for (const file of dedicated) assert.equal(isCoopTestFile(file), true, file);
  for (const file of retained) assert.equal(isCoopTestFile(file), false, file);
  const source = JSON.parse(readFileSync(join(ROOT, 'content/config/ui/screens/title.json'), 'utf8'));
  assert.equal(COOP_TESTS_ENABLED, source.behavior.coopEnabled, 'generated switch matches authoritative source');
  assert.match(COOP_TEST_SKIP_REASON, /content\/config\/ui\/screens\/title\.json.*coopEnabled=false/);
});

test('actual discovery parks co-op with a reason and enabling configuration restores it', () => fixture(dir => {
  const probe = (name, id) => writeFileSync(join(dir, `tests/${name}.test.mjs`),
    `import test from 'node:test'; import {appendFileSync} from 'node:fs'; test('${id}',()=>appendFileSync('visited.txt','${id}\\n'));`);
  probe('coop-hit-preview', 'coop');
  probe('enemy-pile-ops-coop', 'enemyCoop');
  probe('core-coop-constructor', 'coreCoop');
  probe('session-range-preview', 'session');
  probe('party-range-context', 'party');
  probe('lan-intent-privacy', 'lan');
  probe('lobby-storage-guard', 'lobby');
  probe('wireframe-possession-variants', 'soloPossession');
  probe('coop-parked', 'parked');
  probe('solo-probe', 'solo');
  const receipt = join(dir, 'visited.txt');
  let result = invoke(dir, ['--discovered-only']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /SKIP 7 dedicated co-op files:.*coopEnabled=false/);
  assert.deepEqual(readFileSync(receipt, 'utf8').trim().split('\n').sort(), ['parked', 'solo', 'soloPossession']);
  writeFileSync(receipt, '');
  writeFileSync(join(dir, 'src/config/generated/ui.js'), 'export const uiConfig = {screens:{title:{behavior:{coopEnabled:true}}}};');
  result = invoke(dir, ['--discovered-only']);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /SKIP.*co-op/);
  assert.deepEqual(readFileSync(receipt, 'utf8').trim().split('\n').sort(), ['coop', 'coreCoop', 'enemyCoop', 'lan', 'lobby', 'parked', 'party', 'session', 'solo', 'soloPossession']);
}));

test('direct co-op workflows read the feature switch without disabling non-co-op checks', () => {
  const workflow = readFileSync(join(ROOT, '.github/workflows/coop-hud.yml'), 'utf8');
  const stage = job(workflow, 'stage');
  const hudtop = job(workflow, 'hudtop');
  assert.match(stage, /sparse-checkout:[\s\S]*\/content\/config\/ui\/screens\/title\.json/);
  assert.match(stage, /typeof config\.behavior\?\.coopEnabled !== "boolean"/);
  assert.match(stage, /if \[ "\$coop" = false \]; then[\s\S]*SKIP co-op HUD[\s\S]*run=0/);
  assert.match(hudtop, /if: needs\.stage\.outputs\.run == 'true'/);
  assert.doesNotMatch(stage, /fetch-art|which-browser/);
  const ward = readFileSync(join(ROOT, '.github/workflows/ward-to-block-cards.yml'), 'utf8');
  const targeted = ward.split('- name: Targeted card and combat tests')[1].split('- name: Read authored co-op test scope')[0];
  assert.match(targeted, /tests\/stance-hit\.test\.mjs/);
  assert.doesNotMatch(targeted, /coop-hit-preview/);
  assert.match(ward, /import \{ COOP_TESTS_ENABLED, COOP_TEST_SKIP_REASON \} from '\.\/tests\/feature-scopes\.js'/);
  assert.match(ward, /id: coopTests\n        if: steps\.coop\.outputs\.enabled == 'true'[\s\S]*run: node --test tests\/coop-hit-preview\.test\.mjs/);
  assert.match(ward, /COOP_TEST_RESULT: \$\{\{ steps\.coopTests\.outcome \}\}/);
  assert.match(ward, /test "\$COOP_TEST_RESULT" = skipped \|\| test "\$COOP_TEST_RESULT" = success/);
});


test('the actual lightweight HUD gate skips disabled co-op and restores enabled co-op', () => fixture(dir => {
  // Exercise the real Actions shell, not a duplicate decision implementation.
  if (process.platform === 'win32') return; // bash gate runs only on ubuntu-latest
  const workflow = readFileSync(join(ROOT, '.github/workflows/coop-hud.yml'), 'utf8');
  const body = job(workflow, 'stage').split('        run: |\n')[1]
    .split('\n').map(line => line.replace(/^          /, '')).join('\n');
  const configDir = join(dir, 'content/config/ui/screens');
  mkdirSync(configDir, { recursive: true });
  const output = join(dir, 'gate-output');
  const run = value => {
    writeFileSync(join(configDir, 'title.json'), JSON.stringify({ behavior: { coopEnabled: value } }));
    writeFileSync(output, '');
    return spawnSync('bash', ['-e', '-c', body], { cwd: dir, encoding: 'utf8',
      env: { ...process.env, EVENT_NAME: 'workflow_dispatch', REF_NAME: 'test', GITHUB_OUTPUT: output } });
  };
  let result = run(false);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SKIP co-op HUD/);
  assert.equal(readFileSync(output, 'utf8').trim(), 'run=false');
  result = run(true);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /SKIP/);
  assert.equal(readFileSync(output, 'utf8').trim(), 'run=true');
  result = run('false');
  assert.notEqual(result.status, 0, 'malformed config must fail rather than silently skip');
  assert.match(result.stderr, /coopEnabled must be boolean/);
  assert.equal(readFileSync(output, 'utf8'), '');
}));


test('the source test census loses exactly the reviewed dedicated co-op scope while disabled', () => {
  const files = readdirSync(join(ROOT, 'tests')).filter(file => file.endsWith('.test.mjs')).map(file => `tests/${file}`).sort();
  const parked = files.filter(isCoopTestFile);
  assert.equal(parked.length, 32, 'review any newly dedicated co-op suite and update this census');
  const enabled = discoveryFeatureFiles(files, { coopEnabled: true });
  const disabled = discoveryFeatureFiles(files, { coopEnabled: false });
  assert.deepEqual([...disabled, ...parked].sort(), enabled);
  assert.equal(new Set([...disabled, ...parked]).size, enabled.length);
  assert.ok(disabled.includes('tests/coop-parked.test.mjs'));
  assert.ok(disabled.includes('tests/wireframe-possession-variants.test.mjs'));
});

test('the actual Ward verdict refuses failed or absent scope reads even when co-op is skipped', () => {
  if (process.platform === 'win32') return; // Actions job runs on ubuntu-latest
  const ward = readFileSync(join(ROOT, '.github/workflows/ward-to-block-cards.yml'), 'utf8');
  const verdict = ward.split('- name: Require tests and all requested captures')[1];
  assert.match(verdict, /COOP_SCOPE_RESULT: \$\{\{ steps\.coop\.outcome \}\}/);
  const body = verdict.split('        run: ')[1].trim();
  const run = (scope, coop, source = body) => spawnSync('bash', ['-c', source], { encoding: 'utf8', env: {
    ...process.env, TEST_RESULT: 'success', TEXT_RESULT: 'success', CAPTURE_RESULT: 'success',
    STANCE_RESULT: 'success', COOP_SCOPE_RESULT: scope, COOP_TEST_RESULT: coop,
  } }).status;
  assert.equal(run('success', 'skipped'), 0);
  assert.equal(run('success', 'success'), 0);
  for (const scope of ['failure', 'cancelled', 'skipped', '']) assert.notEqual(run(scope, 'skipped'), 0, scope);
  assert.notEqual(run('success', 'failure'), 0);
  const mutant = body.replace('test "$COOP_SCOPE_RESULT" = success && ', '');
  assert.notEqual(mutant, body, 'negative plant removes the scope guard');
  assert.equal(run('failure', 'skipped', mutant), 0, 'the old verdict incorrectly accepts this failed scope read');
});
