// tools/lib/process-tree.mjs — stop a step's whole process group on POSIX and wait until
// it is empty. A step that is a process group leader (spawned with detached: true) can
// leave descendants behind after the leader exits; they keep the step's work, and any lock
// the step holds, until they exit too.

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True while any process is still in group `pgid`. EPERM counts as alive. */
export function groupAlive(pgid, kill = process.kill) {
  try { kill(-pgid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}

/** Resolves once no process is left in group `pgid`. Sends no signal. */
export async function waitGroupEmpty(pgid, { pollMs = 50, alive = groupAlive } = {}) {
  while (alive(pgid)) await delay(pollMs);
}

/**
 * SIGTERM the group now; if anything is still in it after graceMs, SIGKILL the group.
 * Resolves once the group is empty.
 */
export async function stopGroup(pgid, { graceMs = 5000, pollMs = 50, kill = process.kill } = {}) {
  const send = (signal) => { try { kill(-pgid, signal); } catch { /* already gone */ } };
  send('SIGTERM');
  const deadline = Date.now() + graceMs;
  let forced = false;
  while (groupAlive(pgid, kill)) {
    if (!forced && Date.now() >= deadline) { forced = true; send('SIGKILL'); }
    await delay(pollMs);
  }
}
