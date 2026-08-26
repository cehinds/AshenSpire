#!/usr/bin/env node
// Focused browser acceptance for QA remediation #5 and #18: capture ownership
// stays intact while the shared Settings/Controls host has one scroll owner,
// resets at every view entry, and keeps every rebind target finger-sized.

import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = process.env.QA18_EVIDENCE_DIR
  ? resolve(process.env.QA18_EVIDENCE_DIR)
  : resolve(ROOT, 'docs', 'preview');
const ARTIFACT = process.argv.includes('--artifact');
const CAPTURE_SHOTS = process.argv.includes('--screenshots');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const browserPath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((candidate) => candidate && existsSync(candidate));

// Four viewports x three Settings/Controls cycles, then wheel/touch/focus and
// capture coverage, measured 43-47 seconds per child including scoped cleanup
// on the authoring host.
// The inherited 90-second doorplant ceiling was sized before this matrix and
// became a false-clean under contention. Six minutes is a bounded 8x measured
// allowance; timeout remains a named fatal result rather than a catch.
const SELFTEST_CHILD_TIMEOUT_MS = 360000;
const SELFTEST_CONTROL_TIMEOUT_MS = 30000;
const SELFTEST_COPY_SET = ['src', 'content', 'styles', 'index.html', 'tools', 'assets'];
const SELFTEST_FINAL = /^rebind-capture: \d+\/\d+ checks passed(?: against shipped AshenSpire\.html| against source); \d+ failed$/m;
const activeSelftestRuns = new Set();
const activeSelftestRoots = new Set();

const SELFTEST_PLANTS = [
  {
    name: 'Escape is accepted as the captured binding',
    file: 'src/ui/input.js',
    find: "    if (k === 'Escape') {",
    replace: "    if (false && k === 'Escape') { // rebind-capture selftest plant",
    expectRed: /RED REBIND-(?:WIDE|MOBILE)-ESCAPE-CANCEL/,
  },
  {
    name: 'Escape reaches later capture listeners on the same target',
    file: 'src/ui/input.js',
    find: '    // Controls overlay. Capture owns the whole keydown until it settles.\n    ev.stopImmediatePropagation();\n    const capture = keyCapture;',
    replace: '    // Controls overlay. Capture owns the whole keydown until it settles.\n    ev.stopPropagation(); // rebind-capture selftest plant\n    const capture = keyCapture;',
    expectRed: /RED REBIND-(?:WIDE|MOBILE)-ESCAPE-OWNERSHIP/,
  },
  {
    name: 'cancelled capture leaves the armed UI standing',
    file: 'src/ui/screens/controls.js',
    find: "        reset(btn, 'Key');\n        btn.focus({ preventScroll: true });",
    replace: "        void btn; // rebind-capture selftest plant",
    expectRed: /RED REBIND-(?:WIDE|MOBILE)-ESCAPE-RESET/,
  },
  {
    name: 'a lone modifier is accepted as a binding',
    file: 'src/ui/input.js',
    find: "    if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') return;",
    replace: "    if (false) return; // rebind-capture selftest plant",
    expectRed: /RED REBIND-(?:WIDE|MOBILE)-MODIFIER/,
  },
  {
    name: 'Settings ownership leaks into the Controls host',
    file: 'src/ui/components/overlay.js',
    find: "    body.removeAttribute('data-settings-host');",
    replace: "    void body; // rebind-capture selftest plant: stale Settings host",
    expectRed: /RED REBIND-(?:WIDE|TABLET|MOBILE|NARROW)-CYCLE-1-CONTROLS/,
  },
  {
    name: 'view dispatch leaves a non-zero overlay scroll offset',
    file: 'src/ui/components/overlay.js',
    find: '    body.scrollTop = 0;',
    replace: '    setTimeout(() => { body.scrollTop = 1; }, 0); // rebind-capture selftest plant: stale view offset',
    expectRed: /RED REBIND-(?:WIDE|TABLET|MOBILE|NARROW)-CYCLE-1-(?:SETTINGS|CONTROLS)/,
  },
  {
    name: 'rebind controls lose the shared tap floor',
    file: 'styles/ui.css',
    find: '  min-width: var(--tap-floor); min-height: var(--tap-floor);',
    replace: '  min-width: 0; min-height: 0; /* rebind-capture selftest plant */',
    expectRed: /RED REBIND-(?:WIDE|TABLET|MOBILE|NARROW)-TARGETS/,
  },
  {
    name: 'Controls gains a nested vertical scroll owner',
    file: 'styles/ui.css',
    find: '.rebind-list { display: flex; flex-direction: column; }',
    replace: '.rebind-list { display: flex; flex-direction: column; max-height: 12rem; overflow-y: auto; /* rebind-capture selftest plant */ }',
    expectRed: /RED REBIND-(?:WIDE|TABLET|MOBILE|NARROW)-SCROLL-OWNER/,
  },
];

function removePrivate(path, privateRoot) {
  if (!path || !privateRoot) return;
  const target = resolve(path);
  const root = resolve(privateRoot);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error(`refusing cleanup outside private selftest root: ${target}`);
  }
  rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function powershellPath() {
  const systemRoot = process.env.SystemRoot || 'C:/Windows';
  const legacy = join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return existsSync(legacy) ? legacy : 'powershell.exe';
}

function decodeWindowsCensus(result) {
  if (result.error) return { ok: false, reason: `powershell error: ${result.error.code || result.error.message}` };
  if (result.signal) return { ok: false, reason: `powershell signal: ${result.signal}` };
  if (!Number.isInteger(result.status)) return { ok: false, reason: 'powershell nonterminal status' };
  if (result.status !== 0) return { ok: false, reason: `powershell abnormal status ${result.status}` };
  const stderr = `${result.stderr || ''}`.trim();
  if (stderr) return { ok: false, reason: `powershell stderr: ${stderr.slice(0, 160)}` };
  const stdout = `${result.stdout || ''}`.trim();
  if (!stdout) return { ok: false, reason: 'powershell empty census output' };
  let value;
  try { value = JSON.parse(stdout); } catch { return { ok: false, reason: 'powershell unparsable census output' }; }
  const keys = value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).sort().join(',') : '';
  if (keys !== 'kind,listenerCount,processIds' || value.kind !== 'qa18-resource-census-v1'
    || !Array.isArray(value.processIds) || !Number.isInteger(value.listenerCount) || value.listenerCount < 0
    || value.processIds.some((pid) => !Number.isInteger(pid) || pid <= 0)) {
    return { ok: false, reason: 'powershell unexpected census shape' };
  }
  return {
    ok: true,
    pids: [...new Set(value.processIds)].filter((pid) => pid !== process.pid),
    listeners: value.listenerCount,
  };
}

function scopedResourceSnapshot(scope) {
  if (process.platform === 'win32') {
    // Windows PowerShell 5.1 has String.IndexOf(String, StringComparison), not
    // the two-argument Contains overload. Errors are terminating, and the only
    // accepted stdout is one versioned JSON object; stderr or ambiguity is UNKNOWN.
    const script = [
      "$ErrorActionPreference='Stop'",
      "$ProgressPreference='SilentlyContinue'",
      "$WarningPreference='Stop'",
      '$scope=$env:QA18_SCOPE',
      "if ([String]::IsNullOrWhiteSpace($scope)) { throw 'QA18_SCOPE is empty' }",
      '$ids=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($scope,[System.StringComparison]::OrdinalIgnoreCase) -ge 0 } | ForEach-Object { [int]$_.ProcessId } | Sort-Object -Unique)',
      '$listenerCount=0',
      'if ($ids.Count -gt 0) { $listenerCount=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $ids -contains [int]$_.OwningProcess }).Count }',
      "$answer=[ordered]@{kind='qa18-resource-census-v1';processIds=@($ids);listenerCount=[int]$listenerCount}",
      '$answer | ConvertTo-Json -Compress -Depth 3',
    ].join('; ');
    const result = spawnSync(powershellPath(), ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8', windowsHide: true, env: { ...process.env, QA18_SCOPE: scope }, timeout: 15000,
    });
    return decodeWindowsCensus(result);
  }
  const result = spawnSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8', timeout: 15000 });
  if (result.error || result.signal || result.status !== 0 || `${result.stderr || ''}`.trim()
    || !`${result.stdout || ''}`.trim()) {
    return { ok: false, reason: 'process census command failed or returned no trustworthy output' };
  }
  const pids = `${result.stdout}`.split('\n').filter((line) => line.includes(scope))
    .map((line) => Number(/^\s*(\d+)/.exec(line)?.[1])).filter((pid) => pid > 0 && pid !== process.pid);
  return { ok: true, pids: [...new Set(pids)], listeners: 0 };
}

function resourceCensus(scope) {
  const snapshot = scopedResourceSnapshot(scope);
  const entries = existsSync(scope) ? readdirSync(scope) : [];
  return {
    processes: snapshot.ok ? snapshot.pids.length : null,
    pids: snapshot.ok ? snapshot.pids : [],
    listeners: snapshot.ok ? snapshot.listeners : null,
    profiles: entries.filter((name) => name.startsWith('rebind-capture-')).length,
    entries: entries.length,
    scopeExists: existsSync(scope),
    unknown: snapshot.ok ? null : snapshot.reason,
  };
}

function killTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 15000 });
    return;
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
  try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* already gone */ } }
}

function killScoped(scope) {
  const snapshot = scopedResourceSnapshot(scope);
  if (!snapshot.ok) throw new Error(`scoped resource census UNKNOWN: ${snapshot.reason}`);
  for (const pid of snapshot.pids) {
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 15000 });
    else { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
  }
}

const WATCHDOG_SCRIPT = String.raw`
const { existsSync, rmSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const parentPid = Number(process.env.QA18_WATCH_PARENT);
const childPid = Number(process.env.QA18_WATCH_CHILD);
const scope = process.env.QA18_WATCH_SCOPE;
const privateRoot = process.env.QA18_WATCH_ROOT;
const donePath = process.env.QA18_WATCH_DONE;
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {} };
const kill = () => {
  if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(childPid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else { try { process.kill(-childPid, 'SIGKILL'); } catch { try { process.kill(childPid, 'SIGKILL'); } catch {} } }
};
setInterval(() => {
  if (existsSync(donePath) || !existsSync(privateRoot)) process.exit(0);
  if (alive(parentPid)) return;
  kill();
  sleep(750);
  try { rmSync(privateRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); } catch {}
  // A child that escaped the first tree kill can recreate its profile. Sweep
  // once more after removal, then remove the exact private root again.
  kill();
  sleep(250);
  try { rmSync(privateRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); } catch {}
  process.exit(0);
}, 200);
`;

function startWatchdog(child, scope, privateRoot) {
  const donePath = join(privateRoot, `.watchdog-${child.pid}.done`);
  const watchdog = spawn(process.execPath, ['--input-type=commonjs', '--eval', WATCHDOG_SCRIPT], {
    detached: true, windowsHide: true, stdio: 'ignore',
    env: {
      ...process.env,
      QA18_WATCH_PARENT: String(process.pid), QA18_WATCH_CHILD: String(child.pid),
      QA18_WATCH_SCOPE: scope, QA18_WATCH_ROOT: privateRoot, QA18_WATCH_DONE: donePath,
    },
  });
  watchdog.unref();
  return { watchdog, donePath };
}

function processAlive(child) {
  if (!child?.pid) return false;
  try { process.kill(child.pid, 0); return true; } catch { return false; }
}

async function stopWatchdog(run) {
  if (!run?.watchdog) return false;
  try { writeFileSync(run.donePath, 'done\n'); } catch { /* root may already be gone */ }
  for (let i = 0; i < 10 && processAlive(run.watchdog); i += 1) await wait(100);
  if (processAlive(run.watchdog)) { try { run.watchdog.kill('SIGKILL'); } catch { /* already gone */ } }
  await wait(100);
  return processAlive(run.watchdog);
}

function cleanupActiveSelftests() {
  for (const run of [...activeSelftestRuns]) {
    killTree(run.child);
    try { killScoped(run.scope); } catch { /* watchdog still owns this exact child/root on parent exit */ }
    try { removePrivate(run.scope, run.privateRoot); } catch { /* exit-path receipt cannot throw */ }
  }
  for (const root of [...activeSelftestRoots]) {
    try { removePrivate(root, root); } catch { /* exit-path receipt cannot throw */ }
  }
}

function installSelftestCleanupGuards() {
  process.once('exit', cleanupActiveSelftests);
  const codes = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129, SIGQUIT: 131 };
  for (const [signal, code] of Object.entries(codes)) {
    process.once(signal, () => { cleanupActiveSelftests(); process.exit(code); });
  }
}

async function cleanupRun(run) {
  const before = resourceCensus(run.scope);
  killTree(run.child);
  try { killScoped(run.scope); } catch (error) { run.cleanupError = error; }
  await wait(500);
  try { removePrivate(run.scope, run.privateRoot); } catch (error) { run.cleanupError ||= error; }
  const watchdogAlive = await stopWatchdog(run);
  await wait(250);
  const after = resourceCensus(run.scope);
  return { before, after, watchdogAlive, error: run.cleanupError || null };
}

function runScopedTool({
  root, privateRoot, scope, timeoutMs, env = {}, executable = process.execPath, liveCensusMarker = null,
}) {
  mkdirSync(scope, { recursive: true });
  return new Promise((done) => {
    const started = Date.now();
    const args = executable === process.execPath
      ? [join('tools', 'rebind-capture.mjs'), `--qa18-child-scope=${scope}`]
      : [];
    let child;
    let timedOut = false;
    let terminal = false;
    let spawnError = null;
    let stdout = '';
    let stderr = '';
    let finished = false;
    let liveCensus = null;
    let liveCensusObserved = false;
    let timer;
    let forceTimer;
    const finish = async (code = null, signal = null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      terminal = code != null || signal != null;
      const run = [...activeSelftestRuns].find((item) => item.child === child);
      const cleanup = await cleanupRun(run || { child, scope, privateRoot });
      if (run) activeSelftestRuns.delete(run);
      done({
        code, signal, timedOut, terminal, spawnError, out: `${stdout}\n${stderr}`,
        elapsedMs: Date.now() - started, cleanup, liveCensus, liveCensusObserved,
      });
    };
    try {
      child = spawn(executable, args, {
        // A separate process group keeps terminal signals on the parent, whose
        // synchronous guard can then terminate this exact child tree and scope.
        cwd: root, windowsHide: true, detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env, ...env, TEMP: scope, TMP: scope, TMPDIR: scope,
          QA18_CHILD_SCOPE: scope, BROWSER_LEAK_STRICT: '1',
        },
      });
    } catch (error) {
      spawnError = error;
      void finish();
      return;
    }
    const run = { child, scope, privateRoot, ...(child.pid ? startWatchdog(child, scope, privateRoot) : {}) };
    activeSelftestRuns.add(run);
    child.stdout?.on('data', (data) => {
      stdout += data;
      if (liveCensusMarker && !liveCensusObserved && stdout.includes(liveCensusMarker)) {
        liveCensusObserved = true;
        liveCensus = resourceCensus(scope);
        clearTimeout(timer);
        killTree(child);
        forceTimer = setTimeout(() => { void finish(); }, 10000);
      }
    });
    child.stderr?.on('data', (data) => { stderr += data; });
    child.once('error', (error) => { spawnError = error; void finish(); });
    child.once('close', (code, signal) => { void finish(code, signal); });
    timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
      forceTimer = setTimeout(() => { void finish(); }, 10000);
    }, timeoutMs);
  });
}

function classifyChild(result, expectRed = null) {
  const matched = !!(expectRed && expectRed.test(result.out));
  const final = SELFTEST_FINAL.test(result.out);
  const doorError = /RED REBIND-DOOR/.test(result.out);
  if (result.spawnError) return { kind: 'SPAWN-FAILURE', fatal: true, matched, final };
  if (result.timedOut) return { kind: 'TIMEOUT', fatal: true, matched, final };
  if (result.signal) return { kind: 'SIGNAL', fatal: true, matched, final };
  if (!result.terminal || result.code == null) return { kind: 'NONTERMINAL', fatal: true, matched, final };
  if (!Number.isInteger(result.code) || ![0, 1].includes(result.code)) return { kind: 'ABNORMAL-EXIT', fatal: true, matched, final };
  if (result.code === 1 && matched && final && !doorError) return { kind: 'EXPECTED-RED', fatal: false, matched, final };
  if (result.code === 0 && matched) return { kind: 'RED-NOT-EXIT', fatal: true, matched, final };
  if (result.code === 1 && matched && (!final || doorError)) return { kind: 'INCOMPLETE-RED', fatal: true, matched, final };
  if (result.code === 1) return { kind: 'RED-FOR-WRONG-REASON', fatal: true, matched, final };
  return { kind: 'UNCAUGHT', fatal: true, matched, final };
}

function cleanChild(result) {
  const final = SELFTEST_FINAL.test(result.out);
  return result.code === 0 && result.terminal && !result.signal && !result.timedOut
    && !result.spawnError && final && !/RED REBIND-/.test(result.out);
}

function cleanupIsZero(cleanup) {
  const a = cleanup.after;
  return !cleanup.error && !cleanup.watchdogAlive && !cleanup.before.unknown && !a.unknown
    && a.processes === 0 && a.listeners === 0
    && a.profiles === 0 && a.entries === 0 && !a.scopeExists;
}

function copySelftestTree(privateRoot) {
  const root = join(privateRoot, 'copy');
  mkdirSync(root, { recursive: true });
  for (const entry of SELFTEST_COPY_SET) {
    const from = join(ROOT, entry);
    if (!existsSync(from)) continue;
    cpSync(from, join(root, entry), {
      recursive: true,
      filter: (src) => !/tools[\\/](results|shots)([\\/]|$)/.test(src) && !/\.py$/.test(src),
    });
  }
  return root;
}

function applyPlant(root, plant) {
  const target = join(root, plant.file);
  const pristine = readFileSync(target, 'utf8');
  if (!pristine.includes(plant.find)) throw new Error(`${plant.file} no longer contains its plant find-string`);
  writeFileSync(target, pristine.replace(plant.find, plant.replace));
  return () => writeFileSync(target, pristine);
}

function childLine(label, result, classification) {
  const c = result.cleanup;
  return `${label}: ${classification.kind}; code=${result.code ?? 'null'}; signal=${result.signal || '-'}; `
    + `timeout=${result.timedOut ? 'yes' : 'no'}; terminal=${result.terminal ? 'yes' : 'no'}; ${result.elapsedMs}ms; `
    + `cleanup before p/l/profile=${c.before.processes ?? 'UNKNOWN'}/${c.before.listeners ?? 'UNKNOWN'}/${c.before.profiles}, `
    + `after=${c.after.processes ?? 'UNKNOWN'}/${c.after.listeners ?? 'UNKNOWN'}/${c.after.profiles}; `
    + `watchdog=${c.watchdogAlive ? 'LIVE' : 'gone'}; scope=${c.after.scopeExists ? 'PRESENT' : 'absent'}`;
}

async function selftest() {
  console.log(`rebind-capture.mjs --selftest — bounded same-door corpus (${SELFTEST_PLANTS.length} plants + clean)`);
  console.log(`CHILD TIMEOUT: ${SELFTEST_CHILD_TIMEOUT_MS}ms for the expanded 4-viewports x 3-cycles matrix.`);
  console.log('CAUGHT requires code 1, a completed terminal rebind-capture verdict, the named expected RED, and no door error.');
  console.log('Timeout, nonterminal, signal, spawn failure, and abnormal exit are fatal before expected-RED matching.');
  installSelftestCleanupGuards();
  const privateRoot = mkdtempSync(join(tmpdir(), 'q18-'));
  activeSelftestRoots.add(privateRoot);
  const root = copySelftestTree(privateRoot);
  let passed = 0;
  let failed = 0;
  let childIndex = 0;
  try {
    const fatalFixtures = [
      ['timeout', { code: null, signal: null, timedOut: true, terminal: false, spawnError: null, out: 'RED REBIND-WIDE-TARGETS' }, 'TIMEOUT'],
      ['nonterminal', { code: null, signal: null, timedOut: false, terminal: false, spawnError: null, out: 'RED REBIND-WIDE-TARGETS' }, 'NONTERMINAL'],
      ['signal', { code: null, signal: 'SIGTERM', timedOut: false, terminal: true, spawnError: null, out: 'RED REBIND-WIDE-TARGETS' }, 'SIGNAL'],
      ['spawn failure', { code: null, signal: null, timedOut: false, terminal: false, spawnError: new Error('controlled'), out: 'RED REBIND-WIDE-TARGETS' }, 'SPAWN-FAILURE'],
      ['abnormal exit', { code: 4294967295, signal: null, timedOut: false, terminal: true, spawnError: null, out: 'RED REBIND-WIDE-TARGETS' }, 'ABNORMAL-EXIT'],
    ];
    for (const [name, fixture, expected] of fatalFixtures) {
      const got = classifyChild(fixture, /RED REBIND-WIDE-TARGETS/);
      const ok = got.fatal && got.kind === expected;
      console.log(`${ok ? 'PASS' : 'RED '} CLASSIFIER ${name}: ${got.kind}; expected ${expected}`);
      if (ok) passed++; else failed++;
    }

    const censusGood = {
      error: null, signal: null, status: 0, stderr: '',
      stdout: '{"kind":"qa18-resource-census-v1","processIds":[17],"listenerCount":2}',
    };
    const timeoutError = new Error('controlled timeout');
    timeoutError.code = 'ETIMEDOUT';
    const censusDecoderGuards = [
      decodeWindowsCensus(censusGood).ok,
      !decodeWindowsCensus({ ...censusGood, error: new Error('controlled spawn error') }).ok,
      !decodeWindowsCensus({ ...censusGood, error: timeoutError }).ok,
      !decodeWindowsCensus({ ...censusGood, signal: 'SIGTERM' }).ok,
      !decodeWindowsCensus({ ...censusGood, status: null }).ok,
      !decodeWindowsCensus({ ...censusGood, status: 7 }).ok,
      !decodeWindowsCensus({ ...censusGood, stderr: 'MethodException' }).ok,
      !decodeWindowsCensus({ ...censusGood, stdout: '' }).ok,
      !decodeWindowsCensus({ ...censusGood, stdout: 'not json' }).ok,
      !decodeWindowsCensus({ ...censusGood, stdout: '{"kind":"qa18-resource-census-v1","processIds":"17","listenerCount":0}' }).ok,
    ];
    const censusDecoderOk = censusDecoderGuards.every(Boolean);
    console.log(`${censusDecoderOk ? 'PASS' : 'RED '} CENSUS DECODER: ${censusDecoderGuards.filter(Boolean).length}/${censusDecoderGuards.length} good/error/timeout/signal/nonterminal/abnormal/stderr/empty/unparsable/shape guards held`);

    const spawnScope = join(privateRoot, `r${++childIndex}-spawn-failure`);
    const spawnControl = await runScopedTool({
      root, privateRoot, scope: spawnScope, timeoutMs: 5000,
      executable: join(privateRoot, 'intentionally-missing-node.exe'),
    });
    const spawnClass = classifyChild(spawnControl, /RED REBIND-WIDE-TARGETS/);
    const spawnOk = spawnClass.kind === 'SPAWN-FAILURE' && spawnClass.fatal && cleanupIsZero(spawnControl.cleanup);
    console.log(childLine(`${spawnOk ? 'PASS' : 'RED '} CONTROL spawn-failure`, spawnControl, spawnClass));
    if (spawnOk) passed++; else failed++;

    const censusScope = join(privateRoot, `r${++childIndex}-live-census`);
    const censusControl = await runScopedTool({
      root, privateRoot, scope: censusScope, timeoutMs: SELFTEST_CONTROL_TIMEOUT_MS,
      env: { QA18_REBIND_SELFTEST_CONTROL: 'census-after-browser' },
      liveCensusMarker: 'QA18 CENSUS READY',
    });
    const live = censusControl.liveCensus;
    const liveKnown = censusControl.liveCensusObserved && live && !live.unknown
      && live.processes > 0 && live.listeners > 0 && live.profiles > 0;
    const censusOk = censusDecoderOk && liveKnown && censusControl.terminal
      && !censusControl.spawnError && !censusControl.timedOut && cleanupIsZero(censusControl.cleanup);
    console.log(childLine(`${censusOk ? 'PASS' : 'RED '} CONTROL live-census`, censusControl, { kind: 'LIVE-CENSUS' })
      + `; observed before p/l/profile=${live?.processes ?? 'UNKNOWN'}/${live?.listeners ?? 'UNKNOWN'}/${live?.profiles ?? 'UNKNOWN'}`);
    if (censusOk) passed++; else failed++;

    const controlScope = join(privateRoot, `r${++childIndex}-timeout`);
    const timeoutControl = await runScopedTool({
      root, privateRoot, scope: controlScope, timeoutMs: SELFTEST_CONTROL_TIMEOUT_MS,
      env: { QA18_REBIND_SELFTEST_CONTROL: 'hang-after-browser' },
    });
    const timeoutClass = classifyChild(timeoutControl, /RED REBIND-CONTROL-TIMEOUT/);
    const timeoutOk = timeoutClass.kind === 'TIMEOUT' && timeoutClass.fatal
      && /QA18 CONTROL READY/.test(timeoutControl.out) && cleanupIsZero(timeoutControl.cleanup);
    console.log(childLine(`${timeoutOk ? 'PASS' : 'RED '} CONTROL timeout-after-live-browser`, timeoutControl, timeoutClass));
    if (timeoutOk) passed++; else failed++;

    const abnormalScope = join(privateRoot, `r${++childIndex}-abnormal`);
    const abnormalControl = await runScopedTool({
      root, privateRoot, scope: abnormalScope, timeoutMs: SELFTEST_CONTROL_TIMEOUT_MS,
      env: { QA18_REBIND_SELFTEST_CONTROL: 'abnormal-after-browser' },
    });
    const abnormalClass = classifyChild(abnormalControl, /RED REBIND-CONTROL-ABNORMAL/);
    const abnormalOk = abnormalClass.kind === 'ABNORMAL-EXIT' && abnormalClass.fatal
      && /QA18 CONTROL READY/.test(abnormalControl.out) && cleanupIsZero(abnormalControl.cleanup);
    console.log(childLine(`${abnormalOk ? 'PASS' : 'RED '} CONTROL abnormal-after-live-browser`, abnormalControl, abnormalClass));
    if (abnormalOk) passed++; else failed++;

    for (const [index, plant] of SELFTEST_PLANTS.entries()) {
      let restore;
      try { restore = applyPlant(root, plant); } catch (error) {
        console.error(`RED  PLANT ${index + 1}/8 ${plant.name}: DRIFTED — ${error.message}`);
        failed++;
        continue;
      }
      const scope = join(privateRoot, `r${++childIndex}-plant-${index + 1}`);
      let result;
      try {
        result = await runScopedTool({ root, privateRoot, scope, timeoutMs: SELFTEST_CHILD_TIMEOUT_MS });
      } finally {
        restore();
      }
      const classification = classifyChild(result, plant.expectRed);
      const ok = classification.kind === 'EXPECTED-RED' && cleanupIsZero(result.cleanup);
      console.log(childLine(`${ok ? 'CAUGHT' : 'RED  '} PLANT ${index + 1}/8 "${plant.name}"`, result, classification));
      if (ok) passed++; else {
        failed++;
        console.error(`  expected ${plant.expectRed}; tail: ${result.out.trim().split('\n').slice(-8).join(' | ')}`);
      }
    }

    const cleanScope = join(privateRoot, `r${++childIndex}-clean`);
    const clean = await runScopedTool({ root, privateRoot, scope: cleanScope, timeoutMs: SELFTEST_CHILD_TIMEOUT_MS });
    const cleanClass = { kind: cleanChild(clean) ? 'CLEAN' : classifyChild(clean).kind };
    const cleanOk = cleanChild(clean) && cleanupIsZero(clean.cleanup);
    console.log(childLine(`${cleanOk ? 'CLEAN' : 'RED  '} unplanted copy`, clean, cleanClass));
    if (cleanOk) passed++; else {
      failed++;
      console.error(`  tail: ${clean.out.trim().split('\n').slice(-8).join(' | ')}`);
    }
  } finally {
    cleanupActiveSelftests();
    removePrivate(privateRoot, privateRoot);
    activeSelftestRoots.delete(privateRoot);
  }
  const total = passed + failed;
  console.log(`RESOURCE CENSUS: active children=${activeSelftestRuns.size}; private root absent=${!existsSync(privateRoot)}`);
  console.log(`rebind-capture selftest: ${passed}/${total} cases passed`);
  return failed ? 1 : 0;
}

if (process.argv.includes('--selftest')) process.exit(await selftest());

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method) listeners.forEach((listener) => listener(message));
    if (message.id == null || !pending.has(message.id)) return;
    const { yes, no } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? no(new Error(message.error.message)) : yes(message.result);
  };
  return {
    ready: new Promise((yes, no) => { socket.onopen = yes; socket.onerror = no; }),
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((yes, no) => pending.set(id, { yes, no }));
    },
    onEvent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    close() { socket.close(); },
  };
}

let failures = 0;
let checks = 0;
function check(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`PASS ${code} - ${detail}`);
  else { failures += 1; console.error(`RED ${code} - ${detail}`); }
}

let server;
let cdp;
let closeBrowser = async () => {};
try {
  if (!browserPath) throw new Error('no supported Chrome or Edge binary found');
  const served = await serve({ root: ROOT, port: 8271, open: false });
  server = served.server;
  const launched = await launchBrowser({
    prefix: 'rebind-capture-',
    browser: browserPath,
    headless: '--headless=new',
    timeoutMs: 20000,
  });
  closeBrowser = launched.close;
  cdp = connectCdp(launched.wsUrl);
  await cdp.ready;
  // The validator's own cleanup controls enter only through its private
  // selftest environment. Each waits until the real server, Chrome process
  // tree, DevTools listener and profile exist, so the parent observes cleanup
  // over the same resources the eight copied-tree children use.
  if (process.env.QA18_REBIND_SELFTEST_CONTROL === 'census-after-browser') {
    console.log('QA18 CENSUS READY - server/browser/profile/listener are live');
    await new Promise(() => {});
  }
  if (process.env.QA18_REBIND_SELFTEST_CONTROL === 'hang-after-browser') {
    console.error('RED REBIND-CONTROL-TIMEOUT - controlled expected RED text before a live-child timeout');
    console.log('QA18 CONTROL READY - server/browser/profile/listener are live');
    await new Promise(() => {});
  }
  if (process.env.QA18_REBIND_SELFTEST_CONTROL === 'abnormal-after-browser') {
    console.error('RED REBIND-CONTROL-ABNORMAL - controlled expected RED text before abnormal exit 7');
    console.log('QA18 CONTROL READY - server/browser/profile/listener are live');
    process.exit(7);
  }

  const runViewport = async ({ width, height, mobile, label }) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }, sessionId);
    const diagnostics = { console: [], network: [] };
    const releaseEvents = cdp.onEvent((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
        diagnostics.console.push(`${message.params.type}: ${message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')}`);
      }
      if (message.method === 'Log.entryAdded' && ['warning', 'error'].includes(message.params.entry.level)) {
        diagnostics.console.push(`${message.params.entry.level}: ${message.params.entry.text}`);
      }
      if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
        diagnostics.network.push(`${message.params.response.status} ${message.params.response.url}`);
      }
      if (message.method === 'Network.loadingFailed' && !message.params.canceled) {
        diagnostics.network.push(`${message.params.errorText} ${message.params.requestId}`);
      }
    });
    const ev = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
      return result.result.value;
    };
    const until = async (expression, waitingFor, timeout = 20000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (await ev(expression).catch(() => false)) return;
        await wait(70);
      }
      throw new Error(`timeout waiting for ${label} ${waitingFor}`);
    };
    const click = async (selector) => {
      const clicked = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; e.click(); return true; })()`);
      if (!clicked) throw new Error(`missing ${selector}`);
      await wait(160);
    };
    const key = async (keyName, code = keyName, vk = keyName.length === 1 ? keyName.toUpperCase().charCodeAt(0) : 0) => {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: vk }, sessionId);
      await wait(70);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk }, sessionId);
      await wait(180);
    };
    const tab = async (backward = false) => {
      const modifiers = backward ? 8 : 0;
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers,
      }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers,
      }, sessionId);
      await wait(45);
    };
    const wheel = async (deltaY) => {
      const point = await ev(`(() => { const r=document.querySelector('.overlay-body')?.getBoundingClientRect(); return r&&{x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      if (!point) throw new Error('missing overlay body for wheel');
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y, deltaX: 0, deltaY }, sessionId);
      await wait(120);
    };
    const touchSwipe = async (up = true) => {
      const point = await ev(`(() => { const r=document.querySelector('.overlay-body')?.getBoundingClientRect(); return r&&{x:r.left+r.width/2,top:r.top+20,bottom:r.bottom-20}; })()`);
      if (!point) throw new Error('missing overlay body for touch');
      const startY = up ? point.bottom : point.top;
      const endY = up ? point.top : point.bottom;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: startY }] }, sessionId);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: endY }] }, sessionId);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
      await wait(160);
    };
    const screenshot = async (name) => {
      mkdirSync(SHOT_DIR, { recursive: true });
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId);
      const path = resolve(SHOT_DIR, name);
      writeFileSync(path, Buffer.from(data, 'base64'));
      return path;
    };
    const state = () => ev(`(() => {
      const button=document.querySelector('.rebind-key[data-action="endTurn"]');
      const badge=document.querySelector('.key-btn[data-keyfor="endTurn"]');
      const modal=document.querySelector('.overlay-modal');
      const body=document.querySelector('.overlay-body');
      const rect=button?.getBoundingClientRect();
      const bodyRect=body?.getBoundingClientRect();
      const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      const cleanRect=(r)=>r&&({width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom});
      const controls=[...document.querySelectorAll('.rebind-btn')];
      const controlRects=controls.map((control)=>({
        action:control.dataset.action||'', kind:control.classList.contains('rebind-key')?'key':'pad', rect:cleanRect(control.getBoundingClientRect()),
      }));
      let controlOverlaps=0;
      for(let i=0;i<controlRects.length;i+=1)for(let j=i+1;j<controlRects.length;j+=1)if(overlap(controlRects[i].rect,controlRects[j].rect)>0.5)controlOverlaps+=1;
      const headings=[...document.querySelectorAll('.set-cat')];
      const navigationRect=cleanRect(headings.find((el)=>el.textContent.includes('Navigation'))?.getBoundingClientRect());
      const bindingsRect=cleanRect(headings.find((el)=>el.textContent.includes('Bindings'))?.getBoundingClientRect());
      const nestedScrollOwners=body?[...body.querySelectorAll('*')].filter((el)=>{
        const cs=getComputedStyle(el); return el.scrollHeight>el.clientHeight+1&&['auto','scroll'].includes(cs.overflowY);
      }).map((el)=>el.className||el.tagName):[];
      const settingsPanel=body?.querySelector('.set-panel');
      const firstRect=controlRects[0]?.rect;
      const finalRect=controlRects.at(-1)?.rect;
      const visible=(r)=>!!(r&&bodyRect&&r.top>=bodyRect.top-1&&r.bottom<=bodyRect.bottom+1);
      return {
        overlay:!!modal,
        map:!!document.querySelector('.mapscreen'),
        controls:!!document.querySelector('.rebind-list'),
        activeTab:document.querySelector('.ov-tab.on')?.dataset.member || document.querySelector('#ov-switch')?.textContent || '',
        label:button?.textContent || '',
        listening:button?.classList.contains('listening') || false,
        focused:document.activeElement===button,
        component:button?.dataset.uiComponent || '',
        binding:badge?.textContent || '',
        downstream:window.__qaRebindDownstream || 0,
        buttonRect:cleanRect(rect),
        controlRects,
        controlOverlaps,
        navigationRect,
        bindingsRect,
        headingIntersection:navigationRect&&bindingsRect?overlap(navigationRect,bindingsRect):null,
        settingsHost:body?.hasAttribute('data-settings-host')||false,
        bodyScrollTop:body?.scrollTop||0,
        bodyScrollMax:body?Math.max(0,body.scrollHeight-body.clientHeight):0,
        bodyOverflowY:body?getComputedStyle(body).overflowY:'',
        nestedScrollOwners,
        settingsPanelOverflowY:settingsPanel?getComputedStyle(settingsPanel).overflowY:'',
        settingsPanelScrollMax:settingsPanel?Math.max(0,settingsPanel.scrollHeight-settingsPanel.clientHeight):0,
        pageOverflowX:Math.max(0,document.documentElement.scrollWidth-innerWidth),
        bodyOverflowX:Math.max(0,(body?.scrollWidth||0)-(body?.clientWidth||0)),
        firstVisible:visible(firstRect), finalVisible:visible(finalRect),
        activeControl:document.activeElement?.matches('.rebind-btn')
          ?(document.activeElement.classList.contains('rebind-key')?'key':'pad')+':'+document.activeElement.dataset.action:'',
      };
    })()`);
    const switchView = async (id) => {
      await click(`.ov-tab[data-member="${id}"]`);
      if (id === 'settings') await until(`document.querySelector('.overlay-body')?.hasAttribute('data-settings-host')`, 'Settings host marker');
      else await until(`!!document.querySelector('.rebind-list')`, 'Controls rebind list');
    };
    const geometryOf = (facts) => JSON.stringify({
      navigation: facts.navigationRect,
      bindings: facts.bindingsRect,
      controls: facts.controlRects,
    }, (_key, value) => (typeof value === 'number' ? Math.round(value * 10) / 10 : value));
    const openControls = async () => {
      await click('#open-menu');
      await until(`!!document.querySelector('.qn-row[data-act="tab"][data-tab="controls"]')`, 'Controls quick-nav row');
      await click('.qn-row[data-act="tab"][data-tab="controls"]');
      await until(`!!document.querySelector('.rebind-key[data-action="endTurn"]')`, 'Controls rebind list');
    };

    const entry = ARTIFACT ? 'AshenSpire.html' : '';
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${served.port}/${entry}?shot=map` }, sessionId);
    await until(`!!document.querySelector('#open-menu')`, 'map boot');
    await ev(`window.__qaRebindDownstream=0; addEventListener('keydown',(event)=>{if(event.key==='Escape')window.__qaRebindDownstream+=1;},true); true`);
    await openControls();
    const initial = await state();
    check(initial.controls && initial.component === 'controls-key-rebind-control', `REBIND-${label}-CONTRACT`, `Controls exposes the stable keyboard-rebind control (${JSON.stringify(initial)})`);
    check(initial.pageOverflowX === 0 && initial.bodyOverflowX === 0 && initial.buttonRect?.left >= 0 && initial.buttonRect?.right <= width,
      `REBIND-${label}-LAYOUT`, `${width}x${height} Controls and the rebind target fit horizontally`);
    check(initial.controlRects.length > 0
      && initial.controlRects.every(({ rect: target }) => target.width >= 44 && target.height >= 44)
      && initial.controlOverlaps === 0,
    `REBIND-${label}-TARGETS`, `${initial.controlRects.length} Key/Pad targets are >=44x44 with ${initial.controlOverlaps} overlap(s)`);
    check(initial.headingIntersection === 0,
      `REBIND-${label}-SECTIONS`, `Navigation and Bindings intersect by ${initial.headingIntersection || 0}px²`);
    check(!initial.settingsHost && ['auto', 'scroll'].includes(initial.bodyOverflowY)
      && initial.nestedScrollOwners.length === 0,
    `REBIND-${label}-SCROLL-OWNER`, `Controls uses overlay-body=${initial.bodyOverflowY}; nested owners ${JSON.stringify(initial.nestedScrollOwners)}`);

    const initialGeometry = geometryOf(initial);
    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await ev(`(() => { const body=document.querySelector('.overlay-body'); body.style.paddingBottom='100vh'; body.scrollTop=body.scrollHeight; return body.scrollTop; })()`);
      await until(`document.querySelector('.overlay-body')?.scrollTop>0`, `cycle ${cycle} seeded scroll offset`);
      await switchView('settings');
      const settingsView = await state();
      check(settingsView.settingsHost && settingsView.bodyScrollTop === 0
        && settingsView.bodyOverflowY === 'hidden' && ['auto', 'scroll'].includes(settingsView.settingsPanelOverflowY),
      `REBIND-${label}-CYCLE-${cycle}-SETTINGS`, `Settings owns its marker/panel and view entry is top (${JSON.stringify(settingsView)})`);
      await ev(`(() => { const body=document.querySelector('.overlay-body'); body.scrollTop=body.scrollHeight; return body.scrollTop; })()`);
      await until(`document.querySelector('.overlay-body')?.scrollTop>0`, `cycle ${cycle} Settings seeded scroll offset`);
      await switchView('controls');
      const controlsView = await state();
      await ev(`(() => { const body=document.querySelector('.overlay-body'); body.style.paddingBottom=''; return true; })()`);
      check(!controlsView.settingsHost && controlsView.bodyScrollTop === 0
        && ['auto', 'scroll'].includes(controlsView.bodyOverflowY)
        && controlsView.nestedScrollOwners.length === 0,
      `REBIND-${label}-CYCLE-${cycle}-CONTROLS`, `Controls clears Settings ownership, enters at top, and keeps one scroll owner (${JSON.stringify(controlsView)})`);
      check(controlsView.headingIntersection === 0 && geometryOf(controlsView) === initialGeometry,
        `REBIND-${label}-CYCLE-${cycle}-GEOMETRY`, `Navigation/Bindings intersection ${controlsView.headingIntersection || 0}px² and geometry drift ${geometryOf(controlsView) === initialGeometry ? 0 : 1}`);
    }

    await ev(`document.querySelector('.overlay-body').scrollTop=0; true`);
    for (let i = 0; i < 6; i += 1) await wheel(900);
    const wheelBottom = await state();
    check(wheelBottom.finalVisible && (wheelBottom.bodyScrollMax === 0 || wheelBottom.bodyScrollTop > 0),
      `REBIND-${label}-WHEEL-END`, `wheel reaches the final binding (${JSON.stringify(wheelBottom)})`);
    for (let i = 0; i < 6; i += 1) await wheel(-900);
    const wheelTop = await state();
    check(wheelTop.firstVisible && wheelTop.bodyScrollTop === 0,
      `REBIND-${label}-WHEEL-TOP`, `wheel returns to the first binding (${JSON.stringify(wheelTop)})`);

    if (mobile) {
      for (let i = 0; i < 8; i += 1) await touchSwipe(true);
      const touchBottom = await state();
      check(touchBottom.finalVisible && (touchBottom.bodyScrollMax === 0 || touchBottom.bodyScrollTop > 0),
        `REBIND-${label}-TOUCH-END`, `touch reaches the final binding (${JSON.stringify(touchBottom)})`);
      for (let i = 0; i < 8; i += 1) await touchSwipe(false);
      const touchTop = await state();
      check(touchTop.firstVisible && touchTop.bodyScrollTop === 0,
        `REBIND-${label}-TOUCH-TOP`, `touch returns to the first binding (${JSON.stringify(touchTop)})`);
    }

    const controlCount = initial.controlRects.length;
    const firstControl = `${initial.controlRects[0].kind}:${initial.controlRects[0].action}`;
    const finalControl = `${initial.controlRects.at(-1).kind}:${initial.controlRects.at(-1).action}`;
    await ev(`(() => { const body=document.querySelector('.overlay-body'); body.scrollTop=0; document.querySelectorAll('.rebind-btn')[document.querySelectorAll('.rebind-btn').length-1].focus(); return true; })()`);
    await wait(160);
    const focusEnd = await state();
    check(focusEnd.activeControl === finalControl && focusEnd.finalVisible,
      `REBIND-${label}-FOCUS-END`, `focus auto-scroll reaches ${finalControl} (${JSON.stringify(focusEnd)})`);
    await ev(`document.querySelectorAll('.rebind-btn')[0].focus(); true`);
    await wait(160);
    const focusTop = await state();
    check(focusTop.activeControl === firstControl && focusTop.firstVisible,
      `REBIND-${label}-FOCUS-TOP`, `focus auto-scroll returns to ${firstControl} (${JSON.stringify(focusTop)})`);
    for (let i = 1; i < controlCount; i += 1) await tab(false);
    const tabEnd = await state();
    check(tabEnd.activeControl === finalControl && tabEnd.finalVisible,
      `REBIND-${label}-TAB-END`, `Tab reaches ${finalControl} and keeps it visible (${JSON.stringify(tabEnd)})`);
    for (let i = 1; i < controlCount; i += 1) await tab(true);
    const shiftTabTop = await state();
    check(shiftTabTop.activeControl === firstControl && shiftTabTop.firstVisible,
      `REBIND-${label}-SHIFT-TAB-TOP`, `Shift+Tab returns to ${firstControl} and keeps it visible (${JSON.stringify(shiftTabTop)})`);

    const settled = await state();
    check(settled.pageOverflowX === 0 && settled.bodyOverflowX === 0,
      `REBIND-${label}-OVERFLOW`, `page/body overflowX ${settled.pageOverflowX}/${settled.bodyOverflowX}`);
    if (CAPTURE_SHOTS) await screenshot(`qa18-controls-${ARTIFACT ? 'artifact' : 'source'}-${label.toLowerCase()}-${width}x${height}.png`);

    await click('.rebind-key[data-action="endTurn"]');
    await key('Shift', 'ShiftLeft', 16);
    const modifier = await state();
    check(modifier.overlay && modifier.controls && modifier.listening && modifier.label === 'Press…' && modifier.binding === initial.binding,
      `REBIND-${label}-MODIFIER`, `lone Shift leaves capture armed and binding unchanged (${JSON.stringify(modifier)})`);

    await key('Escape', 'Escape', 27);
    const cancelled = await state();
    check(cancelled.overlay && cancelled.controls && cancelled.binding === initial.binding,
      `REBIND-${label}-ESCAPE-CANCEL`, `armed Escape performs zero visible binding mutation and keeps Controls open (${JSON.stringify(cancelled)})`);
    check(!cancelled.listening && cancelled.label === 'Key' && cancelled.focused,
      `REBIND-${label}-ESCAPE-RESET`, 'armed Escape resets Press… and restores focus to the same rebind control');
    check(cancelled.downstream === 0,
      `REBIND-${label}-ESCAPE-OWNERSHIP`, `armed Escape reached no later capture listener (${cancelled.downstream})`);
    if (CAPTURE_SHOTS) await screenshot(`qa18-rebind-cancel-${ARTIFACT ? 'artifact' : 'source'}-${label.toLowerCase()}-${width}x${height}.png`);

    if (!cancelled.controls) await openControls();
    await click('.rebind-key[data-action="endTurn"]');
    await key('v', 'KeyV', 86);
    const rebound = await state();
    check(rebound.overlay && rebound.controls && !rebound.listening && rebound.binding === 'V' && rebound.focused,
      `REBIND-${label}-REARM`, `re-arm accepts free key V and returns to a settled focused control (${JSON.stringify(rebound)})`);

    await key('Escape', 'Escape', 27);
    const closed = await state();
    check(!closed.overlay && closed.map,
      `REBIND-${label}-UNARMED-ESCAPE`, 'a later unarmed Escape closes exactly the Controls overlay and leaves the map');
    const unexpectedConsole = diagnostics.console.filter((entry) =>
      !entry.includes('The AudioContext was not allowed to start')
      && !entry.includes('Failed to load resource: the server responded with a status of 404'));
    const unexpectedNetwork = diagnostics.network.filter((entry) => !entry.endsWith('/favicon.ico'));
    check(unexpectedConsole.length === 0 && unexpectedNetwork.length === 0,
      `REBIND-${label}-DIAGNOSTICS`, `unexpected console/network events ${unexpectedConsole.length}/${unexpectedNetwork.length}; ignored autoplay/favicon ${diagnostics.console.length - unexpectedConsole.length}/${diagnostics.network.length - unexpectedNetwork.length}`);

    releaseEvents();
    await cdp.send('Target.closeTarget', { targetId });
  };

  await runViewport({ width: 1200, height: 730, mobile: false, label: 'WIDE' });
  await runViewport({ width: 815, height: 1086, mobile: false, label: 'TABLET' });
  await runViewport({ width: 390, height: 844, mobile: true, label: 'MOBILE' });
  await runViewport({ width: 320, height: 640, mobile: true, label: 'NARROW' });
} catch (error) {
  failures += 1;
  console.error(`RED REBIND-DOOR - ${error.stack || error.message}`);
} finally {
  try { cdp?.close(); } catch { /* best effort socket close */ }
  try { await closeBrowser(); } catch (error) { console.error(`BROWSER CLEANUP WARNING ${error.message}`); }
  if (server) await new Promise((done) => server.close(done));
}

console.log(`rebind-capture: ${checks - failures}/${checks} checks passed${ARTIFACT ? ' against shipped AshenSpire.html' : ' against source'}; ${failures} failed`);
process.exit(failures ? 1 : 0);
