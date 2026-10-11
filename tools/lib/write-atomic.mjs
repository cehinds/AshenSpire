// tools/lib/write-atomic.mjs — write a file so a reader sees the old bytes or the whole new ones.
//
// The bytes go to a temp file in the SAME folder, which is then renamed over the target. A rename
// within one folder replaces the file in one step, so Visual Review's accept never copies a
// half-written PNG. A failed write removes its temp file and leaves the target as it was.
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The temp name for `file`: a dot-file beside it, unique to this process and moment. */
export function tempBeside(file) {
  return path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now().toString(36)}.tmp`);
}

/** Writes `bytes` to `file` through a temp file beside it, then renames it over `file`. */
export function writeFileAtomic(file, bytes) {
  const tmp = tempBeside(file);
  try {
    writeFileSync(tmp, bytes);
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
