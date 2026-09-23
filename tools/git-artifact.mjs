// Read a committed artifact regardless of whether Git stores its bytes or an
// LFS pointer. Only the requested historical object is downloaded when absent.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export function resolveArtifactBytes(bytes, hydrate) {
  const prefix = 'version https://git-lfs.github.com/spec/v1';
  if (!bytes.subarray(0, prefix.length).equals(Buffer.from(prefix))) return bytes;
  const pointer = bytes.toString('utf8');
  const oid = /^oid sha256:([a-f0-9]{64})$/m.exec(pointer)?.[1];
  const size = /^size ([0-9]+)$/m.exec(pointer)?.[1];
  if (!oid || !size || !Number.isSafeInteger(Number(size))) throw new Error('Malformed LFS artifact pointer');
  const content = hydrate(bytes);
  if (content.length !== Number(size) || createHash('sha256').update(content).digest('hex') !== oid) {
    throw new Error('LFS artifact content does not match its committed SHA256 and size');
  }
  return content;
}

export function readGitArtifact(root, ref, path) {
  const options = { cwd: root, maxBuffer: 1 << 30 };
  const bytes = execFileSync('git', ['show', `${ref}:${path}`], options);
  return resolveArtifactBytes(bytes, pointer => {
    const env = { ...process.env };
    delete env.GIT_LFS_SKIP_SMUDGE;
    return execFileSync('git', ['-c', 'lfs.fetchinclude=', '-c', 'lfs.fetchexclude=', 'lfs', 'smudge', path], {
      ...options, input: pointer, env,
    });
  });
}
