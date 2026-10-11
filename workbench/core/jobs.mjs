// workbench/core/jobs.mjs — the allowlisted build and check jobs.
//
// Only the ids in JOBS can run; a request names an id, never a command. Each
// id runs at most once at a time. A run streams its output line by line to
// `onEvent`, and the last HISTORY runs are kept in memory and in
// workbench/.state/jobs.json (logs trimmed) so a restart keeps the history.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const HISTORY = 30;
const LOG_CAP = 400 * 1024;
const DISK_LOG_CAP = 48 * 1024;

const testFiles = (root) => ['editor/tests', 'ui-studio/tests', 'workbench/tests'].flatMap((dir) => {
  try { return fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith('.test.mjs')).sort().map((n) => `${dir}/${n}`); } catch { return []; }
});

/** Jobs in one lock group write the same generated trees (src/content/generated,
 *  src/framework/data, src/config/generated), so only one of them runs at a time. */
export const GENERATED = 'generated-sources';

/** id → { label, description, lock?, steps(root) → [{ args, optional?, missing? }] } */
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
  'tool-tests': {
    label: 'Tool tests', description: 'Run the editor, UI Studio and Workbench test suites (node --test).',
    steps: (root) => [{ args: ['--test', ...testFiles(root)] }],
  },
};

export const commandLine = (step) => `node ${step.args.join(' ')}`;

export class JobRunner {
  constructor({ root, stateFile, onEvent = () => {} }) {
    Object.assign(this, { root, stateFile, onEvent });
    this.runs = []; this.active = new Map(); // id → run
    this.locks = new Map(); // lock group → label of whoever holds it (a job or a live-reload build)
    this.lockWaiters = [];
    try { this.runs = JSON.parse(fs.readFileSync(stateFile, 'utf8')).slice(0, HISTORY).map((r) => (r.status === 'running' ? { ...r, status: 'cancelled', message: 'The Workbench stopped while this ran' } : r)); } catch { /* no history yet */ }
  }

  defs() {
    return Object.entries(JOBS).map(([id, job]) => {
      const steps = job.steps(this.root);
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

  start(id) {
    const job = Object.hasOwn(JOBS, id) ? JOBS[id] : null;
    if (!job) throw Object.assign(Error(`Unknown job: ${String(id).slice(0, 60)}`), { status: 400 });
    if (this.active.has(id)) throw Object.assign(Error(`${job.label} is already running`), { status: 409 });
    if (job.lock && this.locks.has(job.lock)) throw Object.assign(Error(`${this.locks.get(job.lock)} is running and writes the same generated files; ${job.label} can start when it finishes`), { status: 409 });
    if (job.lock) this.locks.set(job.lock, job.label);
    const run = { runId: `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`, id, label: job.label, status: 'running', startedAt: Date.now(), endedAt: null, durationMs: null, exitCode: null, message: '', log: '' };
    this.runs.unshift(run); this.runs.length = Math.min(this.runs.length, HISTORY);
    this.active.set(id, run);
    this.onEvent('job', this.summary(run));
    this.execute(run, job.steps(this.root)).catch((e) => this.finish(run, 'failed', e.message));
    return this.summary(run);
  }

  append(run, text) {
    run.log = (run.log + text).slice(-LOG_CAP);
    this.onEvent('job-log', { runId: run.runId, text });
  }

  async execute(run, steps) {
    for (const step of steps) {
      if (run.status !== 'running') return;
      const script = step.args[0].startsWith('--') ? null : path.join(this.root, step.args[0]);
      if (script && !fs.existsSync(script)) {
        if (step.optional) { this.append(run, `· skipped ${step.args[0]} (not in this checkout)\n`); continue; }
        this.append(run, `${step.missing || `${step.args[0]} is not in this checkout.`}\n`);
        return this.finish(run, 'failed', step.missing || `${step.args[0]} is missing`);
      }
      this.append(run, `> ${commandLine(step)}\n`);
      const code = await new Promise((resolve) => {
        // Its own process group on POSIX, so a cancel also stops what the step started.
        const child = spawn(process.execPath, step.args, { cwd: this.root, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }, windowsHide: true, detached: process.platform !== 'win32' });
        run.child = child;
        child.stdout.on('data', (d) => this.append(run, d.toString()));
        child.stderr.on('data', (d) => this.append(run, d.toString()));
        child.on('error', (e) => { this.append(run, `${e.message}\n`); resolve(-1); });
        child.on('close', (c, signal) => resolve(signal ? signal : c));
      });
      delete run.child;
      if (run.status !== 'running') return;
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
    const free = () => { if (this.active.get(run.id) === run) { this.active.delete(run.id); if (JOBS[run.id]?.lock) this.release(JOBS[run.id].lock); } };
    if (child && child.exitCode === null && child.signalCode === null) child.once('close', free);
    else free();
    this.persist();
    this.onEvent('job', this.summary(run));
  }

  /** Wait for a lock group to be free, then hold it as `label`; pair with release(). */
  async acquire(lock, label) {
    while (this.locks.has(lock)) await new Promise((resolve) => this.lockWaiters.push(resolve));
    this.locks.set(lock, label);
  }

  release(lock) {
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

  stopAll() { for (const run of this.active.values()) killTree(run.child); }
}

/** Stop a step and everything it started: the whole process group on POSIX. */
function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
    else child.kill();
  } catch { try { child.kill(); } catch { /* already gone */ } }
}
