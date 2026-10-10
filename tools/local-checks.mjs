#!/usr/bin/env node
// Shared finite local QA payload. Run in an owned background worker when needed.
// Tests use a separate Git checkout so later edits cannot mix heads.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile, readFile, readdir, rm, cp, access, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--suite', '--output', '--ref'].includes(args[i]) || !args[i + 1]) throw new Error('Use --suite combat|core|tools|build --output <new D: directory> [--ref <commit>]');
  options[args[i].slice(2)] = args[i + 1];
}
const suite = options.suite || 'combat';
if (!['combat', 'core', 'tools', 'build'].includes(suite)) throw new Error('Unknown suite');
if (!options.output || !path.isAbsolute(options.output)) throw new Error('An absolute, new output directory is required');
const output = path.resolve(options.output);
if (process.platform === 'win32' && !/^D:[\\/]/i.test(output)) throw new Error('Local QA storage must stay on D:');
const normalized = value => process.platform === 'win32' ? value.toLowerCase() : value;
if (normalized(output) === normalized(root) || normalized(output).startsWith(normalized(root + path.sep))) throw new Error('Outputs must be outside the checkout');
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output); // Exclusive: never overwrite another session's evidence.

async function capture(command, argv, cwd = root, input) {
  const child = spawn(command, argv, { cwd, windowsHide: true,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });
  let stdout = '', stderr = '', inputError;
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  if (input !== undefined) {
    child.stdin.once('error', error => { inputError = error; });
    child.stdin.end(input);
  }
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  if (code !== 0 || inputError) throw new Error(`${command} failed (${code}): ${stderr || inputError?.message}`);
  return stdout.trim();
}
const head = await capture('git', ['rev-parse', '--verify', `${options.ref || 'HEAD'}^{commit}`]);
const refFormat = '--format=%(refname)%09%(objectname)%09%(symref)';
const readOriginRefs = async cwd => (await capture('git', ['for-each-ref', refFormat, 'refs/remotes/origin/'], cwd))
  .split('\n').filter(Boolean).map(line => {
    const [ref, sha, symbolic] = line.split('\t');
    return { ref, sha, symbolic: symbolic || null };
  });
// A local clone maps author *local branches* into origin/*. Freeze the actual
// author remote-tracking context separately, including absent dev/test refs.
const originRefs = await readOriginRefs(root);
const report = { suite, head, originRefs, startedAt: new Date().toISOString(), status: 'running', checks: [], output, snapshot: path.join(output, 'source') };
const save = async () => {
  await writeFile(path.join(output, 'result.json.tmp'), JSON.stringify(report, null, 2) + '\n');
  await rename(path.join(output, 'result.json.tmp'), path.join(output, 'result.json'));
};
await save();
let nativeLock, ownsNativeLock = false;
try {
  // Own index/history for Git-dependent gates; object sharing is read-only.
  // Set checkout policy locally before the first checkout. Author-repository
  // configuration is not inherited by clones; a global Windows autocrlf=true
  // otherwise changes LF source and breaks format-sensitive production tests.
  await capture('git', ['clone', '--config', 'core.autocrlf=false', '--config', 'core.eol=lf', '--shared', '--no-checkout', '--', root, report.snapshot]);
  const clonedRefs = await readOriginRefs(report.snapshot);
  const frozenRefs = new Map(originRefs.map(record => [record.ref, record]));
  const refUpdates = [...new Set([...clonedRefs.map(record => record.ref), ...frozenRefs.keys()])].map(ref => {
    const record = frozenRefs.get(ref);
    return record && !record.symbolic ? `update ${ref} ${record.sha}` : `delete ${ref}`;
  });
  // Only the private snapshot's refs change. No-deref prevents deleting the
  // clone's origin/HEAD from deleting the branch that symbolic ref points at.
  if (refUpdates.length) await capture('git', ['update-ref', '--no-deref', '--stdin'], report.snapshot, refUpdates.join('\n') + '\n');
  for (const { ref, symbolic } of originRefs) {
    if (symbolic) await capture('git', ['symbolic-ref', ref, symbolic], report.snapshot);
  }
  if (JSON.stringify(await readOriginRefs(report.snapshot)) !== JSON.stringify(originRefs)) {
    throw new Error('Snapshot origin refs differ from the frozen author context');
  }
  await capture('git', ['-c', 'core.fscache=false', '-c', 'core.preloadIndex=false', '-c', 'index.threads=1', 'checkout', '--detach', head], report.snapshot);
  if (suite !== 'combat') {
    const pin = JSON.parse(await readFile(path.join(report.snapshot, 'art-release.json'), 'utf8'));
    if (!/^hd-assets-v\d+$/.test(pin.tag)) throw new Error('Unsupported art cache tag');
    const originalPin = JSON.parse(await readFile(path.join(root, 'art-release.json'), 'utf8'));
    if (JSON.stringify(pin) === JSON.stringify(originalPin)) {
      const sourceCache = path.join(root, '.art-cache', pin.tag);
      if (await access(sourceCache).then(() => true, () => false)) {
        await cp(sourceCache, path.join(report.snapshot, '.art-cache', pin.tag), { recursive: true, dereference: true, force: false, errorOnExist: true });
      }
    }
    // Validate copied cache with the frozen checkout's pin/manifest, or fetch
    // missing packs into its own cache. Never junction to a writable shared cache.
  }
  // Self-tests can own Chromium. Keep them serialized across sessions; do not
  // remove unknown/stale locks automatically. Source/core checks need no lock.
  if (suite === 'tools') {
    nativeLock = process.platform === 'win32' ? 'D:/repos/.codex/tmp/shared-native-qa.lock' : path.join(path.dirname(output), 'shared-native-qa.lock');
    await mkdir(path.dirname(nativeLock), { recursive: true });
    await mkdir(nativeLock);
    ownsNativeLock = true;
    await writeFile(path.join(nativeLock, 'owner.json'), JSON.stringify({ head, pid: process.pid, output }));
  }
  const files = (await readdir(path.join(report.snapshot, 'tests'))).filter(name => /(?:pointer-target|quick-start-tutorial-input|motion-probe-(?:alternative|boundary|fixed-rest)|alternative-branches|default-combat-perspective|alternative-composition|local-checks-snapshot|combat-expansion|combat-matchups|counter|power-lifecycle|blight|enemy-knowledge|combat-card|class-sprite-combat-presentation|combat-render-geometry-order|combat-target-hud-1209|combat-attached-hand-envelope|combat-frame-reach|combat-target-layers|combat-overhead-anchor|player-details-placement|hand-controls|upcast).*\.test\.mjs$/.test(name)).sort();
  const commands = suite === 'combat' ? [['combat', ['--test', ...files.map(name => `tests/${name}`)]]]
    : suite === 'core' ? [['core', ['tests/run-node.mjs', '--no-selftests']]]
    : suite === 'tools' ? [['tools', ['tests/run-node.mjs', '--selftests-only']]]
    : [['build', ['tools/launch.mjs', '--build-only']], ['identity', ['tools/buildversion.mjs', '--check']], ['shipping', ['tools/verify-shipped.mjs']]];
  if (suite !== 'combat') commands.unshift(['art', ['tools/fetch-art.mjs', '--pack', 'all']]);
  if (suite === 'combat' && files.length === 0) throw new Error('No combat test files discovered');
  for (const [name, argv] of commands) {
    const log = path.join(output, `${name}.log`);
    const stream = createWriteStream(log, { flags: 'wx' });
    const child = spawn(process.execPath, argv, { cwd: report.snapshot, windowsHide: true, env: { ...process.env, ASHEN_ART_SOURCE: process.env.ASHEN_ART_SOURCE || 'cache' } });
    child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    await new Promise(resolve => stream.end(resolve));
    report.checks.push({ name, argv, exitCode: code, log });
    await save();
    if (code !== 0) { report.status = 'failed'; report.nextAction = 'Fix the failing check in a normal patch PR, rerun this suite at its new head, then merge/promote after required checks pass.'; break; }
  }
  if (report.status === 'running') report.status = 'passed';
} catch (error) {
  report.status = error.code === 'EEXIST' && nativeLock && !ownsNativeLock ? 'blocked' : 'failed'; report.error = error.message;
  report.nextAction = 'Resolve the recorded failure; preserve this evidence and launch a new output folder on the corrected head.';
} finally {
  if (ownsNativeLock) await rm(nativeLock, { recursive: true });
  report.finishedAt = new Date().toISOString(); await save();
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === 'passed' ? 0 : 1;
