// tools/lib/build-lock.mjs — one writer of the generated trees across processes.
//
// content-build, framework-data-build, config-build, launch --build-only and
// engine-export all write src/content/generated, src/framework/data or
// src/config/generated. The Workbench, the editor and UI Studio run in separate
// processes and can each start one, so they share <root>/.build-lock: a file
// created exclusively ('wx') holding { pid, holder, startedAt, token }. A lock
// whose pid is gone, or that is older than STALE_MS, is broken and taken over.
// Release removes the file only while it still holds our pid and token.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const LOCK_NAME = '.build-lock';
export const STALE_MS = 30 * 60 * 1000;
// A lock file another process has created but not written yet reads as empty;
// it is only treated as abandoned once it is this old.
const UNWRITTEN_MS = 10 * 1000;

export const lockPath = (root) => path.join(path.resolve(root), LOCK_NAME);

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
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
  const started = Number(lock.info.startedAt) || lock.mtimeMs;
  return !pidAlive(lock.info.pid) || now - started > STALE_MS;
}

/** Remove a stale lock without removing a fresh one another process just took:
 *  move it aside, check it is the one judged stale, and put it back if not. */
function breakStale(file, seen) {
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
  const info = { pid: process.pid, holder: String(holder || 'A build'), startedAt: Date.now(), token };
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
    return function release() {
      if (released) return; released = true;
      const lock = readLock(file);
      if (lock?.info && lock.info.pid === info.pid && lock.info.token === token) {
        try { fs.unlinkSync(file); } catch { /* already gone */ }
      }
    };
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
