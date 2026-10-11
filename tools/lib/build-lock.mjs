// tools/lib/build-lock.mjs — one writer of the generated trees across processes.
//
// content-build, framework-data-build, config-build, launch --build-only and
// engine-export all write src/content/generated, src/framework/data or
// src/config/generated. The Workbench, the editor and UI Studio run in separate
// processes and can each start one, so they share <root>/.build-lock: a file
// created exclusively ('wx') holding { pid, holder, startedAt, token }. A lock
// whose pid is gone is broken and taken over; a lock whose file is empty or
// unparseable is broken once it is UNWRITTEN_MS old. Age alone never overrides
// a live owner: a build that runs for hours keeps its lock.
// Release removes the file only while it still holds our pid and token.
//
// THE WRITER CLIs TAKE IT THEMSELVES (holdForCli). Each builder run directly
// waits for the lock, so two terminals, or a terminal and a studio, never write
// the trees at once. Nesting does not deadlock: a holder passes its lock's
// token to the builders it spawns in ASHEN_BUILD_LOCK_TOKEN (lockEnv), and a
// builder whose token matches the live lock file runs under its parent's hold.
// --check modes only read, and take no lock.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const LOCK_NAME = '.build-lock';
// A lock file another process has created but not written yet reads as empty;
// it is only treated as abandoned once it is this old.
const UNWRITTEN_MS = 10 * 1000;
// A lock whose owner's identity cannot be verified (no procStart: not on Linux,
// or written without one) is abandoned once it is this old. A verified live
// owner never expires.
const UNVERIFIED_CEILING_MS = 6 * 60 * 60 * 1000;

export const lockPath = (root) => path.join(path.resolve(root), LOCK_NAME);

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** The start time of `pid` (field 22 of /proc/<pid>/stat), or null where it cannot be read.
 *  A pid reused by another process starts at a different time, so this tells the owners apart. */
export function procStartOf(pid) {
  if (process.platform !== 'linux' || !Number.isInteger(pid) || pid <= 0) return null;
  try {
    const text = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    // The command name is in parentheses and may hold spaces: fields resume after the last ')'.
    const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
    const start = fields[19];
    return start && /^\d+$/.test(start) ? start : null;
  } catch { return null; }
}

function readLock(file) {
  let text; let stat;
  try { text = fs.readFileSync(file, 'utf8'); stat = fs.statSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  let info = null;
  try { info = JSON.parse(text); } catch { /* being written, or torn */ }
  return { text, info, mtimeMs: stat.mtimeMs };
}

function isStale(lock, now) {
  if (!lock.info || typeof lock.info !== 'object') return now - lock.mtimeMs > UNWRITTEN_MS;
  const { pid, startedAt, procStart } = lock.info;
  if (!pidAlive(pid)) return true;
  const current = procStart != null ? procStartOf(pid) : null;
  // Identity verified: the pid is still the same process (stale only if the pid was reused).
  if (procStart != null && current != null) return String(procStart) !== current;
  // Identity unverified: only the age ceiling applies.
  const started = Number.isFinite(startedAt) ? startedAt : lock.mtimeMs;
  return now - started > UNVERIFIED_CEILING_MS;
}

/** Test seam: `beforeRecheck(file)` runs between the stale judgement and the re-check that guards the unlink. */
export const testHooks = { beforeRecheck: null };

/** Remove a stale lock without removing a fresh one another process just took:
 *  move it aside, check it is the one judged stale, and put it back if not. */
function breakStale(file, seen) {
  testHooks.beforeRecheck?.(file);
  const aside = `${file}.stale-${process.pid}-${randomBytes(4).toString('hex')}`;
  try { fs.renameSync(file, aside); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  let text = null;
  try { text = fs.readFileSync(aside, 'utf8'); } catch { /* gone */ }
  if (text === seen.text) { try { fs.unlinkSync(aside); } catch { /* gone */ } return; }
  // We moved a lock that is not the stale one: restore it unless someone took the slot meanwhile.
  try { fs.linkSync(aside, file); } catch { /* the slot is taken again; that holder keeps it */ }
  try { fs.unlinkSync(aside); } catch { /* gone */ }
}

/**
 * Take the lock now, or report who holds it.
 * @returns {Function | {heldBy: {pid, holder, startedAt}}} a release function, or the holder.
 */
export function tryAcquire(root, holder) {
  const file = lockPath(root);
  const token = randomBytes(8).toString('hex');
  const info = { pid: process.pid, holder: String(holder || 'A build'), startedAt: Date.now(), token, procStart: procStartOf(process.pid) };
  for (let attempt = 0; attempt < 5; attempt++) {
    let fd;
    try { fd = fs.openSync(file, 'wx'); } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const lock = readLock(file);
      if (!lock) continue; // released between open and read
      if (isStale(lock, Date.now())) { breakStale(file, lock); continue; }
      const held = lock.info || {};
      return { heldBy: { pid: held.pid ?? null, holder: held.holder || 'Another build', startedAt: held.startedAt ?? null } };
    }
    try { fs.writeSync(fd, JSON.stringify(info)); } finally { fs.closeSync(fd); }
    let released = false;
    return Object.assign(function release() {
      if (released) return; released = true;
      const lock = readLock(file);
      if (lock?.info && lock.info.pid === info.pid && lock.info.token === token) {
        try { fs.unlinkSync(file); } catch { /* already gone */ }
      }
    }, { token });
  }
  const lock = readLock(file);
  return { heldBy: { pid: lock?.info?.pid ?? null, holder: lock?.info?.holder || 'Another build', startedAt: lock?.info?.startedAt ?? null } };
}

/** Wait for the lock (polling), then hold it; rejects with `heldBy` after timeoutMs. */
export async function acquire(root, holder, { timeoutMs = 10 * 60 * 1000, pollMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const got = tryAcquire(root, holder);
    if (typeof got === 'function') return got;
    if (Date.now() >= deadline) throw Object.assign(Error(`${got.heldBy.holder} is running; try again when it finishes`), { status: 409, heldBy: got.heldBy });
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, Math.min(pollMs, deadline - Date.now()))));
  }
}

/** The 409 message for a refused start. */
export const busyMessage = (heldBy) => `${heldBy.holder} is running; try again when it finishes`;

/** The variable a holder passes its lock token to its children in. */
export const TOKEN_ENV = 'ASHEN_BUILD_LOCK_TOKEN';

/** The env entries a holder gives the builders it spawns, so they run under its hold. */
export const lockEnv = (release) => (release && release.token ? { [TOKEN_ENV]: release.token } : {});

/** True when `env` carries the token of the lock now held at `root` by a live process: a parent holds it for us. */
export function heldByParent(root, env = process.env) {
  const token = env[TOKEN_ENV];
  if (!token) return false;
  const lock = readLock(lockPath(root));
  return Boolean(lock?.info && lock.info.token === token && pidAlive(lock.info.pid));
}

export const CLI_WAIT_MS = 5 * 60 * 1000;

/**
 * The lock for a writer CLI run directly (content-build, config-build,
 * framework-data-build, engine-export, launch). Runs under a parent's hold when
 * the env token matches; otherwise waits for the lock (saying who holds it),
 * holds it until the process exits, and puts its token in `env` so the builders
 * it spawns run under it. On timeout it exits 1 naming the holder.
 * @returns {Function} release (a no-op under a parent's hold).
 */
export async function holdForCli(root, holder, { env = process.env, timeoutMs = Number(env.ASHEN_BUILD_LOCK_WAIT_MS) || CLI_WAIT_MS, pollMs = 250, log = (line) => console.error(line), exit = (code) => process.exit(code) } = {}) {
  if (heldByParent(root, env)) return () => {};
  let release = tryAcquire(root, holder);
  if (typeof release !== 'function') {
    const { heldBy } = release;
    log(`${holder}: waiting for ${heldBy.holder}${heldBy.pid ? ` (pid ${heldBy.pid})` : ''} to finish writing the generated files…`);
    try { release = await acquire(root, holder, { timeoutMs, pollMs }); } catch (e) {
      log(`${holder}: gave up after ${Math.round(timeoutMs / 1000)} s — ${e.message}. If no build is running, delete ${lockPath(root)}.`);
      exit(1);
      throw e;
    }
  }
  const token = release.token;
  env[TOKEN_ENV] = token;
  const done = () => { release(); if (env[TOKEN_ENV] === token) delete env[TOKEN_ENV]; process.removeListener('exit', done); };
  process.on('exit', done);
  return done;
}
