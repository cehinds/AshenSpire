// workbench/core/review.mjs — the Visual Review store. Captures are written by the
// Visual capture job (tools/screenshot.mjs) into <project state dir>/review/captures;
// baselines are the captures a person accepted, in <project state dir>/review/baselines.
// Both live outside the repo tree, so no PNG is ever committed by accident.
//
// Every name is checked against the allowlist of capture files (one per screen
// and device, from workbench/modules/review/model.mjs) before any path is built,
// and the path is confirmed to be a plain file directly inside its folder.
import fs from 'node:fs/promises';
import path from 'node:path';
import { rowsFor, captureFile, deviceById, screenById } from '../modules/review/model.mjs';

export const SETS = ['captures', 'baselines'];
const KNOWN = new Set(rowsFor().map((r) => r.file));
const MAX_ACCEPT = 200;

const httpError = (status, message) => Object.assign(Error(message), { status });

/** The two folders under a project state dir. */
export function reviewDirs(stateDir) {
  const base = path.join(stateDir, 'review');
  return { captures: path.join(base, 'captures'), baselines: path.join(base, 'baselines') };
}

/** The folder and file for one request, both allowlisted; throws a 400 otherwise. */
function locate(dirs, set, file) {
  if (!SETS.includes(set)) throw httpError(400, `Unknown set: ${String(set).slice(0, 40)}`);
  if (!KNOWN.has(file)) throw httpError(400, `Not a review file: ${String(file).slice(0, 60)}`);
  const dir = dirs[set];
  const full = path.join(dir, file);
  if (path.dirname(full) !== dir || path.basename(full) !== file) throw httpError(400, 'Not a review file');
  return full;
}

/** The path when it is a plain file (not a link or a folder), null when there is none. */
async function plainFile(full) {
  const st = await fs.lstat(full).catch(() => null);
  if (!st) return null;
  if (!st.isFile()) throw httpError(400, 'Not a plain file');
  return full;
}

export function createReviewStore({ stateDir }) {
  const dirs = reviewDirs(stateDir);
  return {
    dirs,

    /** The files each folder holds, with size and modified time, for the grid's cache keys. */
    async list() {
      const out = {};
      for (const set of SETS) {
        const names = await fs.readdir(dirs[set]).catch(() => []);
        const files = [];
        for (const file of names.filter((n) => KNOWN.has(n)).sort()) {
          const st = await fs.lstat(path.join(dirs[set], file)).catch(() => null);
          if (st?.isFile()) files.push({ file, size: st.size, mtime: Math.round(st.mtimeMs) });
        }
        out[set] = files;
      }
      return { ...out, dirs: { ...dirs } };
    },

    /** The PNG bytes of one capture or baseline. */
    async image(set, file) {
      const full = await plainFile(locate(dirs, set, file));
      if (!full) throw httpError(404, `No ${set === 'baselines' ? 'baseline' : 'capture'} for ${file} yet`);
      return fs.readFile(full);
    },

    /**
     * Copies each named capture over its baseline. An item names a device and a
     * screen, never a path. A capture that is not there is reported in `missing`.
     */
    async accept(items) {
      if (!Array.isArray(items) || !items.length) throw httpError(400, 'Choose at least one capture to accept');
      if (items.length > MAX_ACCEPT) throw httpError(400, `At most ${MAX_ACCEPT} captures at a time`);
      const files = new Set();
      for (const it of items) {
        if (!deviceById(it?.device) || !screenById(it?.screen)) throw httpError(400, 'Unknown device or screen');
        files.add(captureFile(it.device, it.screen));
      }
      await fs.mkdir(dirs.baselines, { recursive: true });
      const accepted = [];
      const missing = [];
      for (const file of [...files].sort()) {
        const src = await plainFile(locate(dirs, 'captures', file));
        if (!src) { missing.push(file); continue; }
        const dst = locate(dirs, 'baselines', file);
        const tmp = `${dst}.${process.pid}.tmp`;
        await fs.copyFile(src, tmp);
        await fs.rename(tmp, dst);
        accepted.push(file);
      }
      return { accepted, missing };
    },
  };
}
