// workbench/lib/safe-path.mjs — a project-relative path that cannot leave its root.
//
// The same rules editor/core.mjs and ui-studio/server.mjs enforce, kept in one
// shareable module: no traversal, no hidden segments, no absolute or Windows
// paths, no NTFS streams, and no symlink anywhere between the root and the
// file (a linked directory half-way down is the one that escapes).
import fs from 'node:fs/promises';
import path from 'node:path';

export function refusedPath(rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0') || rel.includes('\\') || path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) return true;
  return rel.split('/').some((p) => !p || p === '.' || p === '..' || p.startsWith('.') || p.includes(':'));
}

/**
 * The absolute path of `rel` under `root` (which must already be a realpath).
 * Throws `Refused path` for anything that could escape, `Not found` (code
 * ENOENT) for a missing file unless `creating` is set.
 */
export async function safePath(root, rel, { creating = false } = {}) {
  if (refusedPath(rel)) throw Object.assign(Error(`Refused path: ${rel}`), { code: 'EREFUSED' });
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) throw Object.assign(Error(`Refused path: ${rel}`), { code: 'EREFUSED' });
  let probe = root;
  for (const part of rel.split('/')) {
    probe = path.join(probe, part);
    try {
      if ((await fs.lstat(probe)).isSymbolicLink()) throw Object.assign(Error(`Linked path refused: ${rel}`), { code: 'EREFUSED' });
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      if (!creating) throw Object.assign(Error(`Not found: ${rel}`), { code: 'ENOENT' });
      break;
    }
  }
  return abs;
}
