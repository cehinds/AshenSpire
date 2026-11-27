// DIAGNOSTIC BRANCH ONLY. Imported by Node's original six-test invocation.
// Rewrites modules in memory; it never writes runtime sources or test inputs.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir, cpus } from 'node:os';
import { threadId } from 'node:worker_threads';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const symbol = 'AshenSpire.coldDiagnostic';
const artifactDir = process.env.ASHEN_COLD_DIAGNOSTIC_DIR || join(tmpdir(), 'ashenspire-cold-diagnostics');
const processKey = `${process.pid}-${threadId}`;
const dry = process.argv.includes('--dry');
const originalInputs = [
  'src/model/cardMechanicalProjection.js', 'src/model/cardUpgradeService.js',
  'src/model/cardUpgradeLimits.js', 'src/model/cardUpgradeSteps.js',
  'src/model/cardUpgradeCp.js', 'src/model/combatPower.js', 'src/model/state.js',
  'src/model/gameProfile.js', 'src/model/verifiedProfiles.js', 'src/model/playingCard.js',
  'src/model/combatMechanics.js', 'src/ui/models/CardUpgradeModel.js',
  'src/content/generated/gameProfiles.js', 'src/content/generated/scoring.js',
  'src/content/generated/combatMechanics.js', 'tests/helpers/fixcore-combat-rules.mjs',
];
const additionalInputs = ['src/model/actSeedSchedule.js', 'src/model/combatCardProfile.js', 'tests/seed-driven-schedule-and-perf.test.mjs'];
const sha = value => createHash('sha256').update(value).digest('hex');
const inputHashes = () => Object.fromEntries([...originalInputs, ...additionalInputs].map(path => [path, sha(readFileSync(join(root, path)))]));
const sources = new Map(), originalHashes = {}, instrumentedHashes = {};
const diagRead = path => readFileSync(join(root, path), 'utf8');
function replaceOnce(source, before, after, label) {
  let needle = before;
  if (!source.includes(needle)) needle = before.replaceAll('\n', '\r\n');
  const at = source.indexOf(needle);
  if (at < 0 || source.indexOf(needle, at + needle.length) >= 0) throw new Error(`Diagnostic anchor is missing or ambiguous: ${label}`);
  return source.slice(0, at) + after + source.slice(at + needle.length);
}
function saveSource(path, source) {
  originalHashes[path] = sha(readFileSync(join(root, path)));
  instrumentedHashes[path] = sha(source);
  sources.set(pathToFileURL(join(root, path)).href, source);
}

// Only coarse Act segments are instrumented. The standard CPU profile locates
// picker costs without changing its runtime functions or sampling per probe.
const resourceKeys = ['minorPageFault', 'majorPageFault', 'fsRead', 'fsWrite', 'voluntaryContextSwitches', 'involuntaryContextSwitches'];
function start(detailed) {
  const counters = detailed ? { cpu: process.cpuUsage(), resource: process.resourceUsage() } : {};
  return { ...counters, wall: performance.now() };
}
function elapsed(before) {
  const wallMs = performance.now() - before.wall;
  if (!before.cpu) return { wallMs };
  const cpu = process.cpuUsage(before.cpu), resource = process.resourceUsage();
  return { wallMs, cpuMs: (cpu.user + cpu.system) / 1000,
    resources: Object.fromEntries(resourceKeys.map(key => [key, resource[key] - before.resource[key]])) };
}
const diagnostic = {
  active: null, scopes: [], localeCalls: 0, firstLocale: null,
  begin(name) {
    if (this.active) this.active.unfinished = true;
    this.active = { name, localeCallsBefore: this.localeCalls, resourcesBefore: process.resourceUsage(), segments: [] };
    this.scopes.push(this.active);
  },
  end(name, timing) {
    if (!this.active || this.active.name !== name) throw new Error('Diagnostic scope mismatch');
    const after = process.resourceUsage();
    Object.assign(this.active, { originalTiming: timing, localeCallsAfter: this.localeCalls,
      resources: Object.fromEntries(resourceKeys.map(key => [key, after[key] - this.active.resourcesBefore[key]])) });
    delete this.active.resourcesBefore;
    if (this.active.nodeRows) {
      this.active.nodeIds = this.active.nodeRows.map(node => node?.id);
      delete this.active.nodeRows;
    }
    this.active = null;
  },
  segment(name, before, nodeRows) {
    if (this.active) {
      this.active.segments.push({ name, ...elapsed(before) });
      if (nodeRows) this.active.nodeRows = nodeRows;
    }
  },
  start,
};

let schedule = diagRead('src/model/actSeedSchedule.js');
const helper = `const __coldDiagnostic = globalThis[Symbol.for('${symbol}')];\n`;
for (const [name, endMarker, label] of [
  ['ActUpgradeSchedule', 'const DEFAULT_RARE_RANK_BOOST_CHANCE', 'upgrade'],
  ['ActRewardSchedule', '/** Clear internal', 'reward'],
]) {
  const from = schedule.indexOf(`export function ${name}(`), to = schedule.indexOf(endMarker, from);
  if (from < 0 || to < 0) throw new Error(`Diagnostic schedule boundary: ${name}`);
  let body = schedule.slice(from, to);
  const sort = "const sorted = [...rawNodes].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));";
  body = replaceOnce(body, sort,
    `const __sortStart = __coldDiagnostic.active ? __coldDiagnostic.start(true) : null;\n  ${sort}\n` +
    `  if (__sortStart) __coldDiagnostic.segment('${label}-sort', __sortStart, rawNodes);\n` +
    `  const __workStart = __coldDiagnostic.active ? __coldDiagnostic.start(true) : null;`, name + ' sort');
  body = replaceOnce(body, '  return Object.freeze({',
    `  if (__workStart) __coldDiagnostic.segment('${label}-stock-or-reward-work', __workStart);\n  return Object.freeze({`, name + ' work');
  schedule = schedule.slice(0, from) + body + schedule.slice(to);
}
saveSource('src/model/actSeedSchedule.js', helper + schedule);

const originalTest = diagRead('tests/seed-driven-schedule-and-perf.test.mjs');
if ((originalTest.match(/^test\(/gm) || []).length !== 6) throw new Error('Diagnostic expects the original six timing tests');
let test = originalTest;
for (const [variable, scope] of [['upgSchedA', 'act'], ['m1', 'picker']]) {
  const beginning = `  const cpuStart = process.cpuUsage();\n  const t0 = performance.now();\n  const ${variable}`;
  test = replaceOnce(test, beginning, `  __coldDiagnostic.begin('${scope}');\n${beginning}`, scope + ' original timer');
}
test = replaceOnce(test, '  assert.ok(elapsed < 50,',
  "  __coldDiagnostic.end('act', { wallMs: elapsed, cpuMs });\n  assert.ok(elapsed < 50,", 'Act original assertion');
test = replaceOnce(test, '  assert.ok(m1.rows.length >= 40,',
  "  __coldDiagnostic.end('picker', { wallMs: coldMs, cpuMs });\n  assert.ok(m1.rows.length >= 40,", 'picker original assertion');
saveSource('tests/seed-driven-schedule-and-perf.test.mjs', helper + test);

const beforeHashes = inputHashes();
if (dry) {
  for (const [url, source] of sources) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Instrumented source syntax failed: ${url}\n${result.stderr}`);
  }
  console.log(JSON.stringify({ dry: true, rewrittenModules: sources.size, original16InputHashes: Object.fromEntries(originalInputs.map(path => [path, beforeHashes[path]])), originalHashes, instrumentedHashes }, null, 2));
} else {
  mkdirSync(artifactDir, { recursive: true });
  const selectedEnv = ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_REF', 'RUNNER_OS', 'RUNNER_ARCH',
    'ImageOS', 'ImageVersion', 'NODE_OPTIONS', 'NODE_ICU_DATA', 'UV_THREADPOOL_SIZE', 'LANG', 'LC_ALL'];
  const manifest = {
    diagnosticOnly: true, neverMerge: true, processId: process.pid, threadId,
    node: { execPath: process.execPath, execArgv: process.execArgv, argv: process.argv, versions: process.versions,
      platform: process.platform, arch: process.arch },
    environment: Object.fromEntries(selectedEnv.map(key => [key, process.env[key] ?? null])),
    cpus: cpus().map(({ model, speed }) => ({ model, speed })),
    original16InputHashes: Object.fromEntries(originalInputs.map(path => [path, beforeHashes[path]])),
    additionalInputHashes: Object.fromEntries(additionalInputs.map(path => [path, beforeHashes[path]])),
    originalHashes, instrumentedHashes,
    notes: ['All six original tests, clocks, assertions and workload remain active.',
      'Counter capture and instrumentation between segments remain in the unchanged original total, so segment sums need not match it; the CPU profile locates picker costs.',
      'Resource counter semantics/support are platform dependent; zero does not prove no scheduling or I/O.',
      'No warmup, retry, budget adjustment or source-file modification is performed.'],
  };
  writeFileSync(join(artifactDir, `manifest-${processKey}.json`), JSON.stringify(manifest, null, 2));
  for (const [url, source] of sources) {
    const relative = fileURLToPath(url).slice(root.length);
    const target = join(artifactDir, 'instrumented-sources', processKey, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  globalThis[Symbol.for(symbol)] = diagnostic;
  const nativeLocaleCompare = String.prototype.localeCompare;
  String.prototype.localeCompare = function (...args) {
    diagnostic.localeCalls++;
    if (diagnostic.firstLocale) return Reflect.apply(nativeLocaleCompare, this, args);
    const before = start(true);
    try { return Reflect.apply(nativeLocaleCompare, this, args); } finally {
      diagnostic.firstLocale = { phase: diagnostic.active?.name ?? 'outside-measured-scopes',
        left: typeof this === 'string' ? this : typeof this, right: typeof args[0] === 'string' ? args[0] : typeof args[0], ...elapsed(before) };
    }
  };
  registerHooks({ load(url, context, nextLoad) {
    return sources.has(url) ? { format: 'module', source: sources.get(url), shortCircuit: true } : nextLoad(url, context);
  } });
  process.once('exit', exitCode => {
    const afterHashes = inputHashes();
    const unchanged = Object.keys(beforeHashes).every(path => beforeHashes[path] === afterHashes[path]);
    const report = { processId: process.pid, threadId, exitCode, sourceInputsUnchanged: unchanged, afterHashes,
      firstLocaleCompare: diagnostic.firstLocale, totalLocaleCalls: diagnostic.localeCalls,
      unfinishedScope: diagnostic.active?.name ?? null,
      scopes: diagnostic.scopes.map(({ nodeRows, ...scope }) => ({ ...scope, ...(nodeRows ? { nodeIds: nodeRows.map(node => node?.id) } : {}) })) };
    writeFileSync(join(artifactDir, `measurements-${processKey}.json`), JSON.stringify(report, null, 2));
    console.log('COLD_DIAGNOSTIC', JSON.stringify(report));
    if (!unchanged) {
      console.error('Diagnostic source input hashes changed; evidence is not a fixed-source measurement.');
      process.exitCode = exitCode || 1;
    }
  });
}
