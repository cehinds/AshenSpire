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
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
