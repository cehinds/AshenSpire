// tools/lib/process-tree.mjs — stop a step's whole process group on POSIX and wait until
// it is empty. A step that is a process group leader (spawned with detached: true) can
// leave descendants behind after the leader exits; they keep the step's work, and any lock
// the step holds, until they exit too.

import fs from 'node:fs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Linux only: the /proc entries whose process group is `pgid`, as { pid, state }. State is the
 * one-letter /proc state; Z is an unreaped zombie. Null when /proc cannot be read.
 */
export function procGroupMembers(pgid, { readdir = fs.readdirSync, readFile = fs.readFileSync } = {}) {
  let names;
  try { names = readdir('/proc'); } catch { return null; }
  const members = [];
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue;
    let stat;
    try { stat = readFile(`/proc/${name}/stat`, 'utf8'); } catch { continue; } // exited meanwhile
    // "pid (comm) state ppid pgrp ..." — comm may hold spaces or parentheses, so split after the last ')'.
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    if (Number(fields[2]) === pgid) members.push({ pid: Number(name), state: fields[0] });
  }
  return members;
}

/**
 * True while any process that is not a zombie is in group `pgid`. EPERM counts as alive.
 * On Linux the members come from /proc: an unreaped zombie keeps the group id alive, so
 * kill(-pgid, 0) would keep succeeding forever under an init that does not reap orphans.
 * Elsewhere kill(-pgid, 0) decides.
 */
export function groupAlive(pgid, kill = process.kill, { platform = process.platform, members = procGroupMembers } = {}) {
  const listed = platform === 'linux' ? members(pgid) : null;
  if (listed) return listed.some((m) => m.state !== 'Z' && m.state !== 'X');
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
