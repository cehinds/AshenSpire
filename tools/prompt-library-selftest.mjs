#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), 'prompt-library.mjs');
const cases = [];

function plant(name, run) {
  cases.push({ name, run });
}

function invoke(args, options = {}) {
  return spawnSync(process.execPath, [TOOL, ...args], {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

plant('empty environment override uses the home-library default', async (root) => {
  const caller = join(root, 'caller');
  const home = join(root, 'home');
  const sentinel = '# caller README\n';
  await mkdir(caller, { recursive: true });
  await mkdir(home, { recursive: true });
  await writeFile(join(caller, 'README.md'), sentinel);

  const result = invoke(['install'], {
    cwd: caller,
    env: { ...process.env, HOME: home, CONSTANTINE_PROMPT_LIBRARY: '' },
  });

  assert(result.status === 0, result.stderr || `install exited ${result.status}`);
  assert(await readFile(join(caller, 'README.md'), 'utf8') === sentinel, 'caller README was overwritten');
  assert(
    (await readFile(join(home, '.constantine', 'prompt-library', 'manifest.json'), 'utf8')).includes('"schemaVersion": 1'),
    'default prompt library was not installed under HOME',
  );
});

for (const command of ['install', 'list', 'path', 'verify']) {
  plant(`${command} rejects an unsupported prompt id`, async (root) => {
    await mkdir(root, { recursive: true });
    const library = join(root, 'library');
    const result = invoke([command, 'general-game', '--library-dir', library], {
      cwd: root,
      env: process.env,
    });
    assert(result.status === 1, `${command} accepted an unsupported prompt id`);
    assert(result.stderr.includes('Unexpected argument: general-game'), result.stderr);
  });
}

const root = await mkdtemp(join(tmpdir(), 'ashenspire-prompt-library-selftest-'));
let passed = 0;
try {
  for (const testCase of cases) {
    try {
      await testCase.run(join(root, String(passed)));
      passed += 1;
    } catch (error) {
      process.stderr.write(`RED — ${testCase.name}: ${error.message}\n`);
    }
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

if (passed !== cases.length) {
  process.stderr.write(`FAIL — ${passed}/${cases.length} prompt-library safety plants passed.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`prompt-library self-test: OK — ${passed} checks passed\n`);
}
