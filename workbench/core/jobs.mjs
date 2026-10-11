// workbench/core/jobs.mjs — the allowlisted build and check jobs.
//
// Only the ids in JOBS can run; a request names an id, never a command. Each
// id runs at most once at a time. A run streams its output line by line to
// `onEvent`, and the last HISTORY runs are kept in memory and in
// workbench/.state/jobs.json (logs trimmed) so a restart keeps the history.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { tryAcquire as tryFileLock, acquire as waitFileLock, busyMessage, lockEnv } from '../../tools/lib/build-lock.mjs';
import { STOP_GRACE_MS, stopGroup, groupAlive } from '../../tools/lib/process-tree.mjs';
import { SCREENS, screenById, deviceById } from '../modules/review/model.mjs';

export const HISTORY = 30;
const LOG_CAP = 400 * 1024;
const DISK_LOG_CAP = 48 * 1024;
/** How long a stopping job's process may take to exit after SIGTERM before it is killed (SIGKILL). */
export { STOP_GRACE_MS };
const STOPPED = 'The Workbench stopped while this ran';

const testFiles = (root) => ['editor/tests', 'ui-studio/tests', 'workbench/tests'].flatMap((dir) => {
  try { return fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith('.test.mjs')).sort().map((n) => `${dir}/${n}`); } catch { return []; }
});

/** Jobs in one lock group write the same generated trees (src/content/generated,
 *  src/framework/data, src/config/generated), so only one of them runs at a time.
 *  The group is also held across processes through <root>/.build-lock
 *  (tools/lib/build-lock.mjs), which the editor and UI Studio take too. */
export const GENERATED = 'generated-sources';
/** The tag model jobs share one group: they regenerate and check the same docs/tag-model tables. */
export const TAG_MODEL = 'tag-model';
/** Groups held in this process only. The tag model writes docs/tag-model, which no game build reads, so it
 *  never takes the cross-process .build-lock (tools/lib/build-lock.mjs) that the game's builds hold. Its
 *  saves and jobs still exclude each other through the in-process group. */
export const PROCESS_ONLY_GROUPS = new Set([TAG_MODEL]);
export const TAG_MODEL_MISSING = 'docs/tag-model is not on this branch yet. It lands with feature/TagRefactor.';

/** A job's params: absent or null means the defaults ({}); any other non-object is a 400. */
export function jobParams(params) {
  if (params === undefined || params === null) return {};
  if (typeof params !== 'object' || Array.isArray(params)) throw Object.assign(Error('Job params must be an object'), { status: 400 });
  return params;
}

/**
 * The screens and device a Visual capture run takes, checked against the
 * allowlist (workbench/modules/review/model.mjs). Anything else is a 400, so a
 * request names a screen id, never a path or a flag.
 */
export function reviewCaptureParams(input) {
  const params = jobParams(input);
  const device = params.device ?? 'desk';
  if (!deviceById(device)) throw Object.assign(Error(`Unknown device: ${String(device).slice(0, 40)}`), { status: 400 });
  const asked = params.screens ?? SCREENS.map((s) => s.id);
  if (!Array.isArray(asked) || !asked.length) throw Object.assign(Error('Choose at least one screen'), { status: 400 });
  for (const id of asked) if (!screenById(id)) throw Object.assign(Error(`Unknown screen: ${String(id).slice(0, 40)}`), { status: 400 });
  const wanted = new Set(asked);
  return { device, screens: SCREENS.map((s) => s.id).filter((id) => wanted.has(id)) };
}

/** id → { label, description, lock?, steps(root, { params?, stateDir? }) → [{ args, optional?, missing? }] } */
export const JOBS = {
  'content-build': {
    lock: GENERATED, label: 'Content build', description: 'Compile content/source and content/framework into the generated modules under src/.',
    steps: () => [{ args: ['tools/framework-data-build.mjs'], optional: true }, { args: ['tools/content-build.mjs'] }],
  },
  'config-build': {
    lock: GENERATED, label: 'Config build', description: 'Compile content/config (UI tokens, scenes, screens) into src/config/generated/ui.js.',
    steps: () => [{ args: ['tools/config-build.mjs'] }],
  },
  'build-only': {
    lock: GENERATED, label: 'Build bundle', description: 'Build the single-file game (tools/launch.mjs --build-only) without opening it.',
    steps: () => [{ args: ['tools/launch.mjs', '--build-only'] }],
  },
  'engine-export': {
    lock: GENERATED, label: 'Engine export', description: 'Export the game data as JSON tables and schemas for Unity / Unreal into build/engine-export.',
    steps: () => [{ args: ['tools/engine-export.mjs', '--out', 'build/engine-export'], missing: 'tools/engine-export.mjs is not in this checkout yet. Pull the branch that adds the engine exporter, then run this again.' }],
  },
  // The tag model proposal (docs/tag-model, from feature/TagRefactor). It is not a game build input:
  // these jobs only regenerate and check its own tables. Both share one lock group so they never overlap.
  'tag-model': {
    lock: TAG_MODEL, label: 'Tag model: build, check, compile', description: 'Regenerate the tag model tables, check their integrity, and write compile-report.md under docs/tag-model.',
    steps: () => [
      { args: ['docs/tag-model/tools/build.mjs'], missing: TAG_MODEL_MISSING },
      { args: ['docs/tag-model/tools/check.mjs'], missing: TAG_MODEL_MISSING },
      { args: ['docs/tag-model/tools/compile.mjs'], missing: TAG_MODEL_MISSING },
    ],
  },
  'tag-model-check': {
    lock: TAG_MODEL, label: 'Tag model: check', description: 'Check the tag model tables under docs/tag-model for integrity, without rebuilding them.',
    steps: () => [{ args: ['docs/tag-model/tools/check.mjs'], missing: TAG_MODEL_MISSING }],
  },
  'tool-tests': {
    label: 'Tool tests', description: 'Run the editor, UI Studio and Workbench test suites (node --test).',
    steps: (root) => [{ args: ['--test', ...testFiles(root)] }],
  },
  // The game's own screenshot tool (tools/screenshot.mjs) at one device size. Captures go to
  // <project state dir>/review/captures, never into the repo tree; Visual Review reads them there.
  'review-capture': {
    label: 'Visual capture', description: 'Photograph the chosen game screens at one device size into the project state folder, for Visual Review.',
    steps: (root, { params = {}, stateDir = path.join(root, 'workbench', '.state') } = {}) => {
      const { device, screens } = reviewCaptureParams(params);
      const { width, height } = deviceById(device);
      return [{ args: ['tools/screenshot.mjs', '--out', path.join(stateDir, 'review', 'captures'), '--viewport', `${width}x${height}`, '--prefix', `${device}-`, '--only', screens.join(','), '--exact'] }];
    },
  },
};

export const commandLine = (step) => `node ${step.args.join(' ')}`;

export class JobRunner {
  constructor({ root, stateFile, onEvent = () => {} }) {
    Object.assign(this, { root, stateFile, onEvent });
    this.runs = []; this.active = new Map(); // id → run
    this.locks = new Map(); // lock group → label of whoever holds it (a job or a live-reload build)
    this.lockWaiters = [];
    this.fileLocks = new Map(); // lock group → release() of the cross-process lock
    this.stopping = new Set(); // runs stopAll() asked to stop: they start no further step
    this.slotWaiters = []; // checks run whenever a job slot is freed (see slotFreed)
    this.groups = new Map(); // run → process group id (the step's pid) of the step it is running
    try { this.runs = JSON.parse(fs.readFileSync(stateFile, 'utf8')).slice(0, HISTORY).map((r) => (r.status === 'running' ? { ...r, status: 'cancelled', message: STOPPED } : r)); } catch { /* no history yet */ }
  }

  defs() {
    return Object.entries(JOBS).map(([id, job]) => {
      const steps = job.steps(this.root, { stateDir: path.dirname(this.stateFile) });
      const missing = steps.find((s) => s.missing && !fs.existsSync(path.join(this.root, s.args[0])));
      return { id, label: job.label, description: job.description, commands: steps.map(commandLine), available: !missing, note: missing ? missing.missing : '', running: this.active.has(id) };
    });
  }

  summary(run) { const { log, child, ...rest } = run; return { ...rest, logBytes: log.length }; }
  list() { return this.runs.map((r) => this.summary(r)); }
  get(runId) { const run = this.runs.find((r) => r.runId === runId); if (!run) return null; const { child, ...rest } = run; return rest; }

  persist() {
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      const slim = this.runs.map(({ child, log, ...r }) => ({ ...r, log: log.length > DISK_LOG_CAP ? `… (earlier output trimmed)\n${log.slice(-DISK_LOG_CAP)}` : log }));
      fs.writeFileSync(this.stateFile, `${JSON.stringify(slim, null, 1)}\n`);
    } catch { /* history is a convenience; a read-only state dir must not fail a job */ }
  }

  /** Starts an allowlisted job. `params` go to its steps (checked there: a bad value throws a 400 before anything runs). */
  start(id, params = {}) {
    const job = Object.hasOwn(JOBS, id) ? JOBS[id] : null;
    if (!job) throw Object.assign(Error(`Unknown job: ${String(id).slice(0, 60)}`), { status: 400 });
    if (this.active.has(id)) throw Object.assign(Error(`${job.label} is already running`), { status: 409 });
    const steps = job.steps(this.root, { params: jobParams(params), stateDir: path.dirname(this.stateFile) });
    if (job.lock && this.locks.has(job.lock)) throw Object.assign(Error(PROCESS_ONLY_GROUPS.has(job.lock) ? `${this.locks.get(job.lock)} is running; ${job.label} can start when it finishes` : `${this.locks.get(job.lock)} is running and writes the same generated files; ${job.label} can start when it finishes`), { status: 409 });
    if (job.lock) {
      // A process-only group (the tag model) takes no cross-process lock: the game's .build-lock never blocks it.
      let got = null;
      if (!PROCESS_ONLY_GROUPS.has(job.lock)) {
        got = tryFileLock(this.root, `${job.label} (Workbench)`);
        if (typeof got !== 'function') throw Object.assign(Error(`${busyMessage(got.heldBy)} (it writes the same generated files as ${job.label})`), { status: 409, heldBy: got.heldBy });
        this.fileLocks.set(job.lock, got);
      }
      this.locks.set(job.lock, job.label);
    }
    const run = { runId: `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`, id, label: job.label, status: 'running', startedAt: Date.now(), endedAt: null, durationMs: null, exitCode: null, message: '', log: '' };
    this.runs.unshift(run); this.runs.length = Math.min(this.runs.length, HISTORY);
    this.active.set(id, run);
    // Persist the new run before it executes: a crash leaves a 'running' record, which the constructor reads back as 'cancelled'.
    this.persist();
    this.onEvent('job', this.summary(run));
    this.execute(run, steps).catch((e) => this.finish(run, 'failed', e.message));
    return this.summary(run);
  }

  append(run, text) {
    run.log = (run.log + text).slice(-LOG_CAP);
    this.onEvent('job-log', { runId: run.runId, text });
  }

  async execute(run, steps) {
    for (const step of steps) {
      if (run.status !== 'running') return;
      if (this.stopping.has(run)) return this.finish(run, 'cancelled', STOPPED);
      const script = step.args[0].startsWith('--') ? null : path.join(this.root, step.args[0]);
      if (script && !fs.existsSync(script)) {
        if (step.optional) { this.append(run, `· skipped ${step.args[0]} (not in this checkout)\n`); continue; }
        this.append(run, `${step.missing || `${step.args[0]} is not in this checkout.`}\n`);
        return this.finish(run, 'failed', step.missing || `${step.args[0]} is missing`);
      }
      this.append(run, `> ${commandLine(step)}\n`);
      const code = await new Promise((resolve) => {
        // Its own process group on POSIX, so a cancel also stops what the step started.
        // The step's builders run under this job's hold on the cross-process lock.
        const held = JOBS[run.id]?.lock ? lockEnv(this.fileLocks.get(JOBS[run.id].lock)) : {};
        const child = spawn(process.execPath, step.args, { cwd: this.root, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...held }, windowsHide: true, detached: process.platform !== 'win32' });
        run.child = child;
        this.groups.set(run, child.pid);
        child.stdout.on('data', (d) => this.append(run, d.toString()));
        child.stderr.on('data', (d) => this.append(run, d.toString()));
        child.on('error', (e) => { this.append(run, `${e.message}\n`); resolve(-1); });
        child.on('close', (c, signal) => resolve(signal ? signal : c));
      });
      delete run.child;
      // The step's own process has exited, but a background process it left in the group still
      // runs under this job's lock: wait for the group before the next step or the release.
      await settleGroup(this.groups.get(run), { signalled: this.stopping.has(run) || run.status !== 'running' });
      if (run.status !== 'running') return;
      if (this.stopping.has(run)) return this.finish(run, 'cancelled', STOPPED);
      if (code !== 0) { run.exitCode = code; return this.finish(run, 'failed', `${step.args[0]} exited with ${code}`); }
    }
    this.finish(run, 'passed', '');
  }

  finish(run, status, message) {
    if (run.status !== 'running') return;
    Object.assign(run, { status, message, endedAt: Date.now(), durationMs: Date.now() - run.startedAt });
    if (status === 'passed') run.exitCode = 0;
    // A cancelled step keeps the job's slot until its process has really exited,
    // so a re-run cannot write the same output alongside it.
    const child = run.child;
    const pgid = this.groups.get(run);
    const free = () => {
      if (this.active.get(run.id) !== run) return;
      this.active.delete(run.id);
      this.groups.delete(run);
      if (JOBS[run.id]?.lock) this.release(JOBS[run.id].lock);
      for (const check of [...this.slotWaiters]) check();
    };
    if (pgid != null && process.platform !== 'win32') settleGroup(pgid, { signalled: status === 'cancelled' || this.stopping.has(run) }).then(free);
    else if (child && child.exitCode === null && child.signalCode === null) child.once('close', free);
    else free();
    this.persist();
    this.onEvent('job', this.summary(run));
  }

  /** The env that lets a builder run under the cross-process lock this runner holds for `lock`. */
  lockEnv(lock) { return lockEnv(this.fileLocks.get(lock)); }

  /** Wait for a lock group to be free here and in other processes, then hold
   *  it as `label`; pair with release(). Rejects if another process keeps the
   *  cross-process lock past `timeoutMs`. */
  async acquire(lock, label, { timeoutMs, pollMs, signal } = {}) {
    // The in-process wait honours timeoutMs too: past it the wait rejects with a 409 that names the holder.
    const deadline = Number.isFinite(timeoutMs) ? Date.now() + timeoutMs : null;
    // An aborted signal ends either wait at once, and the lock is then never taken.
    for (;;) {
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Aborted');
      if (!this.locks.has(lock)) break;
      if (deadline !== null && Date.now() >= deadline) throw Object.assign(Error(`${this.locks.get(lock)} is running; try again when it finishes`), { status: 409 });
      await new Promise((resolve) => {
        const wake = () => { clearTimeout(timer); signal?.removeEventListener('abort', wake); resolve(); };
        const timer = deadline === null ? null : setTimeout(wake, Math.max(1, deadline - Date.now()));
        this.lockWaiters.push(wake);
        signal?.addEventListener('abort', wake, { once: true });
      });
    }
    this.locks.set(lock, label);
    if (PROCESS_ONLY_GROUPS.has(lock)) return;
    try { this.fileLocks.set(lock, await waitFileLock(this.root, `${label} (Workbench)`, { timeoutMs, pollMs, signal })); } catch (e) { this.release(lock); throw e; }
  }

  release(lock) {
    const releaseFile = this.fileLocks.get(lock);
    this.fileLocks.delete(lock);
    if (releaseFile) releaseFile();
    this.locks.delete(lock);
    const waiters = this.lockWaiters.splice(0);
    for (const wake of waiters) wake();
  }

  cancel(runId) {
    const run = this.runs.find((r) => r.runId === runId);
    if (!run) throw Object.assign(Error('Unknown run'), { status: 404 });
    if (run.status !== 'running') throw Object.assign(Error('That run has already finished'), { status: 409 });
    killTree(run.child);
    this.append(run, '\n· cancelled\n');
    this.finish(run, 'cancelled', 'Cancelled');
    return this.summary(run);
  }

  /** Resolves once `run` no longer holds its job slot, that is once its process has exited and its lock is released. */
  slotFreed(run) {
    return new Promise((resolve) => {
      const check = () => { if (this.active.get(run.id) !== run) { this.slotWaiters.splice(this.slotWaiters.indexOf(check), 1); resolve(); } };
      this.slotWaiters.push(check);
      check();
    });
  }

  /** Stop every running job and resolve once each has exited and freed its slot and file lock.
   *  SIGTERM first; a process still alive after graceMs gets SIGKILL. */
  stopAll({ graceMs = STOP_GRACE_MS } = {}) {
    const runs = [...this.active.values()];
    return Promise.all(runs.map((run) => {
      this.stopping.add(run);
      const freed = this.slotFreed(run);
      const pgid = this.groups.get(run);
      // POSIX: the group is SIGTERMed now and SIGKILLed after graceMs, whatever the step's own
      // process does; the wait is bounded and does not depend on the step's close event.
      if (pgid != null && process.platform !== 'win32') return Promise.all([freed, stopGroup(pgid, { graceMs })]);
      const child = run.child;
      killTree(child);
      if (child && child.exitCode === null && child.signalCode === null) {
        const timer = setTimeout(() => killTree(child, { signal: 'SIGKILL' }), graceMs);
        freed.then(() => clearTimeout(timer));
      }
      return freed;
    })).then(() => {});
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves once no process is left in the step's group `pgid` (POSIX). A signalled group has
 *  already been asked to stop, so it gets the grace at once; otherwise leftover background
 *  processes get the grace to finish on their own first. Either way the group is SIGTERMed and
 *  SIGKILLed after the grace, and the wait is bounded (stopGroup). */
export async function settleGroup(pgid, { signalled = false, graceMs = STOP_GRACE_MS } = {}) {
  if (pgid == null || process.platform === 'win32') return;
  if (!signalled) {
    const until = Date.now() + graceMs;
    while (groupAlive(pgid) && Date.now() < until) await delay(50);
  }
  if (groupAlive(pgid)) await stopGroup(pgid, { graceMs });
}

/** Stop a step and everything it started: the process group on POSIX, the
 *  process tree on Windows (taskkill /T waits until the tree is gone, so the
 *  step's close event, which frees the lock, comes after its builders exit). */
export function killTree(child, { platform = process.platform, run = spawnSync, signal = 'SIGTERM', force = true } = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (platform === 'win32') {
      // force: false asks the tree to close first (taskkill /T), without /F.
      const r = run('taskkill', ['/pid', String(child.pid), '/T', ...(force ? ['/F'] : [])], { windowsHide: true, stdio: 'ignore' });
      if (r.error || r.status !== 0) child.kill();
    } else process.kill(-child.pid, signal);
  } catch { try { child.kill(signal); } catch { /* already gone */ } }
}
