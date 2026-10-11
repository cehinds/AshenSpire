// node --test tests/build-steps.test.mjs — a CLI's builder step runs in its own process group: the step
// is not reported finished while a grandchild that ignores SIGTERM is alive, and stop() waits for it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStepRunner } from '../tools/lib/build-steps.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = (file) => fs.access(file).then(() => true, () => false);

// A builder whose grandchild ignores SIGTERM, writes `late` 700 ms after it starts, and writes its pid to `pidFile`.
// `then` is the builder's own body after it starts the grandchild.
function builder(late, pidFile, then) {
  const grandchild = `process.on('SIGTERM', () => {}); require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(late)}, 'late'), 700); setInterval(() => {}, 1000);`;
  return `import { spawn } from 'node:child_process';\nimport fs from 'node:fs';\nspawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' });\n${then}\n`;
}

async function readPid(file) {
  for (let i = 0; i < 200; i++) {
    try { return Number(await fs.readFile(file, 'utf8')); } catch { await delay(10); }
  }
  throw new Error('the grandchild did not start');
}

// Dead, or an unreaped zombie that can no longer run or write.
async function deadOrZombie(pid) {
  try { process.kill(pid, 0); } catch (e) { return e.code === 'ESRCH'; }
  return fs.readFile(`/proc/${pid}/stat`, 'utf8').then((s) => /\) Z /.test(s), () => true);
}

test('a step that exits 0 with a SIGTERM-ignoring grandchild left behind is not reported done until the group is empty', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ashenspire-build-steps-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const late = path.join(dir, 'late.txt');
  const pidFile = path.join(dir, 'grandchild.pid');
  const script = path.join(dir, 'builder.mjs');
  // The builder exits once the grandchild has written its pid, so the grandchild is left behind.
  await fs.writeFile(script, builder(late, pidFile, `const w = setInterval(() => { if (fs.existsSync(${JSON.stringify(pidFile)})) { clearInterval(w); process.exit(0); } }, 10);`));
  const runner = createStepRunner();
  const result = await runner.run(script, [], { graceMs: 300 });
  assert.equal(result.code, 0, 'the builder exited with 0');
  assert.equal(await deadOrZombie(await readPid(pidFile)), true, 'the grandchild was stopped before the step was reported done');
  const atDone = await exists(late);
  await delay(1000);
  assert.equal(await exists(late), atDone, 'nothing was written after the step was reported done');
});

test('stop() ends a running step and its SIGTERM-ignoring grandchild before it resolves', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ashenspire-build-steps-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const late = path.join(dir, 'late.txt');
  const pidFile = path.join(dir, 'grandchild.pid');
  const script = path.join(dir, 'builder.mjs');
  // The builder itself runs until it is stopped.
  await fs.writeFile(script, builder(late, pidFile, 'setInterval(() => {}, 1000);'));
  const runner = createStepRunner();
  const running = runner.run(script, [], { graceMs: 300 });
  const pid = await readPid(pidFile);
  await runner.stop();
  assert.equal(await deadOrZombie(pid), true, 'the grandchild is dead once stop() resolves');
  const atStop = await exists(late);
  await delay(1000);
  assert.equal(await exists(late), atStop, 'nothing was written after stop() resolved');
  const result = await running;
  assert.notEqual(result.code, 0, 'the stopped step did not report success');
});

test('run(capture) collects the step output and resolves its exit code', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process groups');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ashenspire-build-steps-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const script = path.join(dir, 'says.mjs');
  await fs.writeFile(script, "console.log('built'); console.error('warned'); process.exit(4);\n");
  const result = await createStepRunner().run(script, [], { capture: true });
  assert.equal(result.code, 4);
  assert.match(result.output, /built/);
  assert.match(result.output, /warned/);
});
