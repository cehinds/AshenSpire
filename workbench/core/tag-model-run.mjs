// workbench/core/tag-model-run.mjs — what happens after a save of a tag-model table.
// The save runs the job its rule names (tag-model-check, or tag-model for a table
// the build re-extracts). The job's own result is toasted by the job feed; this
// reports one more event: how many table files the job changed on disk, so the
// Data Studio grid can reload them. A save never triggers the game build.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { TAG_MODEL_DIR, tagModelJobFor } from './tag-model.mjs';

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

/**
 * Runs the job the saved paths need, waits for it to free its slot, and reports
 * { job, runId, label, status, message, updated, files } through send(). When the
 * job is busy, reports status 'busy' instead. Resolves with the report, or null when
 * no tag-model table is in the save.
 */
export async function runAfterTagModelSave({ root, jobs, paths, send = () => {} }) {
  const job = tagModelJobFor(paths);
  if (!job) return null;
  const before = await tableHashes(root);
  let started;
  try { started = jobs.start(job); } catch (error) {
    const report = { job, status: 'busy', message: error.message, updated: 0, files: [] };
    send(report);
    return report;
  }
  const run = jobs.runs.find((r) => r.runId === started.runId);
  if (run) await jobs.slotFreed(run);
  const final = jobs.get(started.runId) ?? started;
  const files = changedTables(before, await tableHashes(root));
  const report = { job, runId: started.runId, label: final.label, status: final.status, message: final.message, updated: files.length, files };
  send(report);
  return report;
}
