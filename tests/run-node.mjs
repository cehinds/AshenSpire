// tests/run-node.mjs — Node test runner: `node tests/run-node.mjs`
// Prints one line per test; exits 1 on any failure.

import { runTests } from './engine.test.js';

// The art manifest is written by tools/equipment-blender.py and records the
// fields the renderer ACTUALLY read. Loaded here rather than inside the test so
// the harness can stay synchronous (see the promise guard in runTests).
let artManifest = null;
try {
  const { readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  artManifest = JSON.parse(readFileSync(resolve(root, 'assets/equipment/manifest.json'), 'utf8'));
} catch (e) {
  console.warn('  (no art manifest — test 33 will skip; run tools/equipment-blender.py)');
}

const { passed, failed, results } = await runTests({ artManifest });
for (const r of results) {
  const tag = r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}

// The zoom-unit guard runs HERE, not as a script somebody remembers to run. A
// check nobody reads is not a check: the tutorial lockout it exists to catch
// shipped past this suite while the suite was green the whole time.
// Two lines, because they fail for different reasons and must not be conflated:
//   36 — the check's own integrity (its corpus). Its failure is the check's fault.
//   37 — findings in src/. Its failure is the code's state, not the check's.
// Numbered 36/37, not 35/36: dev's test 35 is Sunna's accessibility-defaults test
// in engine.test.js. Two files, no git conflict, and a suite that would have
// printed "35." twice — the collision a merge cannot see.
let zoomExtra = 0;
let zoomPassed = 0; // counted, because "35 passed" over 37 printed lines is the same
                    // two-homes defect these two lines exist to catch.
{
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const run = (args) => {
    try {
      return { out: execFileSync(process.execPath, ['tools/zoomunits.mjs', ...args], { cwd, encoding: 'utf8' }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
    }
  };
  const grab = (out, re) => (out.match(re) || [])[1] ?? '?';

  const self = run(['--selftest']);
  console.log(
    `${self.code === 0 ? 'PASS' : 'FAIL'}  36. the zoom-unit check still catches its own known-bad corpus` +
      ` — recall ${grab(self.out, /known-bad recall\s+(\S+)/)}, known-good cleared ${grab(self.out, /known-good clear\s+(\S+)/)}`
  );
  if (self.code !== 0) zoomExtra++;
  else zoomPassed++;

  const tree = run([]);
  console.log(
    `${tree.code === 0 ? 'PASS' : 'FAIL'}  37. no inline px geometry write carries a visual pixel into local space` +
      ` — ${grab(tree.out, /(\d+) unconverted/)} unconverted (run \`node tools/zoomunits.mjs\` for file:line)`
  );
  if (tree.code !== 0) zoomExtra++;
  else zoomPassed++;
}

console.log(`\n${passed + zoomPassed} passed, ${failed + zoomExtra} failed`);
console.log('BOUNDARY: 1–35 are engine and content invariants. 36–37 are a CONSISTENCY');
console.log('          check over coordinate spaces — they prove a transform has two');
console.log('          homes, never that a pixel renders wrong. Nothing here opens a');
console.log('          browser, so no test in this file has seen the screen.');
process.exit(failed + zoomExtra > 0 ? 1 : 0);
