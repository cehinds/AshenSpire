// workbench/core/tag-model-run.mjs — what happens after a save of a tag-model table.
// The save runs the job its rule names (tag-model-check, or tag-model for a table
// the build re-extracts). The job's own result is toasted by the job feed; this
// reports one more event: how many table files the job changed on disk, so the
// Data Studio grid can reload them. A save never triggers the game build.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { TAG_MODEL_DIR, tagModelJobFor } from './tag-model.mjs';
import { TAG_MODEL } from './jobs.mjs';

/** sha256 of every CSV under the tag-model tables folder, keyed by repo-relative path. */
export async function tableHashes(root) {
  const out = new Map();
  const walk = async (rel) => {
    const entries = await fs.readdir(path.join(root, rel), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (/\.csv$/i.test(entry.name)) out.set(child, createHash('sha256').update(await fs.readFile(path.join(root, child))).digest('hex'));
    }
  };
  await walk(TAG_MODEL_DIR);
  return out;
}

/** The table paths whose hash differs between two snapshots (added, removed or changed), sorted. */
export function changedTables(before, after) {
  const names = new Set([...before.keys(), ...after.keys()]);
  return [...names].filter((n) => before.get(n) !== after.get(n)).sort();
}

// Per runner and job: the run in progress (`run`) and the one follow-up run queued behind it (`next`).
const slots = new WeakMap();
const slotOf = (jobs, job) => {
  if (!slots.has(jobs)) slots.set(jobs, new Map());
  const byJob = slots.get(jobs);
  if (!byJob.has(job)) byJob.set(job, { run: null, next: null });
  return byJob.get(job);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the job the saved paths need and reports { job, runId, label, status, message, updated, files }
 * through send(). Resolves with the report, or null when no tag-model table is in the save.
 *
 * A save that arrives while a run of its job is in progress is never dropped, and never run alongside
 * it: it is COALESCED. The first such save queues exactly one follow-up run, which starts when the
 * current run ends and covers every save that arrived meanwhile. The follow-up waits for a save that
 * holds the tag-model lock, and for a run started from the Jobs panel, so the two never overlap.
 */
export function runAfterTagModelSave({ root, jobs, paths, send = () => {} }) {
  const job = tagModelJobFor(paths);
  if (!job) return Promise.resolve(null);
  const slot = slotOf(jobs, job);
  if (!slot.run) return startRun({ root, jobs, job, send, slot });
  if (!slot.next) {
    slot.next = slot.run.then(() => {}, () => {}).then(() => { slot.next = null; return startRun({ root, jobs, job, send, slot }); });
  }
  send({ job, status: 'queued', message: 'The tag model job is running. Your save runs it once more when it ends.', updated: 0, files: [] });
  return slot.next;
}

function startRun({ root, jobs, job, send, slot }) {
  const run = execute({ root, jobs, job, send });
  slot.run = run;
  const clear = () => { if (slot.run === run) slot.run = null; };
  run.then(clear, clear);
  return run;
}

async function execute({ root, jobs, job, send }) {
  // Wait for a run of this job, or the tag-model group, held by something else (a save, or a run from the Jobs panel).
  for (;;) {
    const active = jobs.active.get(job);
    if (active) { await jobs.slotFreed(active); continue; }
    if (jobs.locks.has(TAG_MODEL)) { await sleep(20); continue; }
    break;
  }
  const before = await tableHashes(root);
  let started;
  try { started = jobs.start(job); } catch (error) {
    // The group was taken between the check and the start: wait and try again rather than drop the run.
    if (error.status === 409) { await sleep(20); return execute({ root, jobs, job, send }); }
    throw error;
  }
  const run = jobs.runs.find((r) => r.runId === started.runId);
  if (run) await jobs.slotFreed(run);
  const final = jobs.get(started.runId) ?? started;
  const files = changedTables(before, await tableHashes(root));
  const report = { job, runId: started.runId, label: final.label, status: final.status, message: final.message, updated: files.length, files };
  send(report);
  return report;
}
