// tools/lib/process-tree.mjs — stop a step's whole process group on POSIX and wait until
// it is empty. A step that is a process group leader (spawned with detached: true) can
// leave descendants behind after the leader exits; they keep the step's work, and any lock
// the step holds, until they exit too.

import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

/** How long a stopping group gets after SIGTERM before it is SIGKILLed. */
export const STOP_GRACE_MS = 5000;
/** How long stopGroup waits after the SIGKILL before it resolves anyway (zombies left behind). */
export const KILL_WAIT_MS = 2000;

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
 * The one-letter /proc state of `pid` (R, S, D, T, Z, X, ...), or null where /proc cannot be read.
 */
export function procState(pid, { readFile = fs.readFileSync } = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  let text;
  try { text = readFile(`/proc/${pid}/stat`, 'utf8'); } catch { return null; }
  // Fields resume after the last ')' (the command name may hold spaces or parentheses).
  return text.slice(text.lastIndexOf(')') + 2, text.lastIndexOf(')') + 3) || null;
}

/**
 * True while process `pid` is alive. On Linux the /proc state decides: a zombie (Z) or dead (X)
 * process has exited but is not reaped, and kill(pid, 0) still succeeds for it under an init that
 * does not reap orphans, so it is not alive. Elsewhere, or where /proc cannot be read, kill(pid, 0)
 * decides; EPERM counts as alive.
 */
export function processAlive(pid, { platform = process.platform, readFile = fs.readFileSync, kill = process.kill } = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (platform === 'linux') {
    const state = procState(pid, { readFile });
    if (state) return state !== 'Z' && state !== 'X';
  }
  try { kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
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
 * Resolves once the group is empty, or killWaitMs after the SIGKILL, whichever comes first.
 * The result says whether the group was SIGKILLed, whether anything is still alive, and which
 * members are unreaped zombies (they cannot run or write; their parent or init has to reap them).
 */
export async function stopGroup(pgid, { graceMs = STOP_GRACE_MS, killWaitMs = KILL_WAIT_MS, pollMs = 50, kill = process.kill, platform = process.platform, members = procGroupMembers } = {}) {
  const opts = { platform, members };
  const send = (signal) => { try { kill(-pgid, signal); } catch { /* already gone */ } };
  send('SIGTERM');
  const deadline = Date.now() + graceMs;
  let killedAt = null;
  while (groupAlive(pgid, kill, opts)) {
    const now = Date.now();
    if (killedAt === null && now >= deadline) { killedAt = now; send('SIGKILL'); }
    else if (killedAt !== null && now - killedAt >= killWaitMs) break;
    await delay(pollMs);
  }
  return {
    forced: killedAt !== null,
    stillAlive: groupAlive(pgid, kill, opts),
    zombies: platform === 'linux' ? (members(pgid) || []).filter((m) => m.state === 'Z').map((m) => m.pid) : [],
  };
}

/** How long spawnGroup's done waits for stdio to close after the leader exited (a stray holder of a pipe must not hang it). */
const CLOSE_WAIT_MS = 1000;

/** Resolves true once `child` has exited, false if it is still running after ms. */
async function exitedWithin(child, ms) {
  const until = Date.now() + ms;
  while (child.exitCode === null && child.signalCode === null) {
    if (Date.now() >= until) return false;
    await delay(50);
  }
  return true;
}

/**
 * Spawn a step that may start builders of its own, as the leader of its own process group on
 * POSIX (detached), so stopping it reaches everything it started. Returns:
 * - child: the ChildProcess; attach stdout/stderr listeners to it as usual.
 * - stop(graceMs?): SIGTERM the group now, SIGKILL it after the grace, and resolve once the group
 *   is empty (bounded and zombie-aware: stopGroup). On win32 it runs `taskkill /T`, then `/T /F`
 *   after the grace. Repeated calls share one stop.
 * - done: resolves { code, signal, error } once the leader has exited AND nothing is left in its
 *   group. A leftover group gets the grace to finish on its own, then is stopped. Hold a build
 *   lock until done resolves, so no orphan can write after the lock is released.
 * On win32 descendants cannot be followed once the leader has exited; there done resolves at the exit.
 */
export function spawnGroup(cmd, args, opts = {}) {
  const { graceMs = STOP_GRACE_MS, ...spawnOpts } = opts;
  const win = process.platform === 'win32';
  const child = spawn(cmd, args, { ...spawnOpts, detached: !win });
  const hasPid = Number.isInteger(child.pid);
  const closed = new Promise((resolve) => child.once('close', resolve));

  let stopping = null;
  const stop = (ms = graceMs) => {
    stopping ||= (async () => {
      if (!hasPid) return;
      if (!win) { await stopGroup(child.pid, { graceMs: ms }); return; }
      if (child.exitCode !== null || child.signalCode !== null) return;
      const taskkill = (force) => {
        const r = spawnSync('taskkill', ['/pid', String(child.pid), '/T', ...(force ? ['/F'] : [])], { windowsHide: true, stdio: 'ignore' });
        if (r.error || r.status !== 0) { try { child.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch { /* already gone */ } }
      };
      taskkill(false);
      if (await exitedWithin(child, ms)) return;
      taskkill(true);
      await exitedWithin(child, KILL_WAIT_MS);
    })();
    return stopping;
  };

  const done = new Promise((resolve) => {
    let finished = false;
    const finish = (result) => { if (!finished) { finished = true; resolve(result); } };
    child.once('error', (error) => finish({ code: -1, signal: null, error }));
    child.once('exit', async (code, signal) => {
      try {
        if (!win && hasPid) {
          const until = Date.now() + graceMs;
          while (groupAlive(child.pid) && Date.now() < until) await delay(50);
          if (groupAlive(child.pid)) await stop(graceMs);
        }
      } finally {
        // stdio closes with the group; a stray holder of a pipe must not keep done waiting.
        await Promise.race([closed, delay(CLOSE_WAIT_MS)]);
        finish({ code, signal, error: null });
      }
    });
  });

  return { child, stop, done };
}

/** Run a step to completion under spawnGroup; resolves { code, signal, error } once its group is empty (bounded). */
export function runGroup(cmd, args, opts = {}) {
  return spawnGroup(cmd, args, opts).done;
}
