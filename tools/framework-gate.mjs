// tools/framework-gate.mjs — the cutover gate runner (framework contract:
// Cutover gate). Builds the complete replacement candidate against the real
// content bundle, runs every machine-checkable required gate, and prints one
// PASS/FAIL/NOT_RUN line per gate — the run's own output names its boundary.
//
//   node tools/framework-gate.mjs             report mode: exit 0 when every
//                                             machine-checkable gate passes
//                                             (cutover gates may be FAIL/NOT_RUN
//                                             and are printed honestly)
//   node tools/framework-gate.mjs --cutover   exit 0 ONLY on full SUCCESS —
//                                             the one command a recorded
//                                             cutover decision may rely on
//
// A FAILURE from this tool preserves the current runtime by construction:
// nothing in the legacy game imports src/framework, so a failed candidate
// changes nothing a player can reach.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cutoverMode = process.argv.includes('--cutover');

function run(label, args) {
  try {
    execFileSync(process.execPath, args, { cwd: root, stdio: 'pipe' });
    console.log(`PASS     ${label}`);
    return true;
  } catch (e) {
    console.log(`FAIL     ${label}`);
    const out = `${e.stdout || ''}${e.stderr || ''}`.trim();
    if (out) console.log(out.split('\n').map((l) => `         ${l}`).join('\n'));
    return false;
  }
}

console.log('framework cutover gate\n');

// Generated data drift, the candidate's own suite, and the legacy suite (the
// baseline the candidate must not disturb) run first — real invocations, not
// assumptions.
const dataInSync = run('generated framework data in sync', ['tools/framework-data-build.mjs', '--check']);
const frameworkSuite = run('framework suite (tests/framework.test.mjs)', ['tests/framework.test.mjs']);
const legacySuite = run('legacy suite untouched (tests/run-node.mjs)', ['tests/run-node.mjs']);

const { contentBundle } = await import('../src/content/index.js');
const { buildReplacementCandidate } = await import('../src/framework/candidate.js');

const result = buildReplacementCandidate(contentBundle, {
  assetExists: (rel) => existsSync(resolve(root, rel)),
  regressionSuite: frameworkSuite && legacySuite,
});

console.log('');
for (const gate of result.gates) {
  console.log(`${gate.status.padEnd(8)} ${gate.name}${gate.detail ? ` — ${gate.detail}` : ''}`);
}

const machineCheckable = result.gates.filter((g) => !['approved new-mechanics acceptance', 'proof that legacy runtime authority is unreachable'].includes(g.name));
const machineOk = dataInSync && frameworkSuite && legacySuite && machineCheckable.every((g) => g.status === 'PASS');

console.log('');
if (result.status === 'SUCCESS') {
  console.log('SUCCESS: every required gate passed. Cutover may be recorded.');
} else {
  console.log('FAILURE: current runtime preserved. Open gates:');
  for (const gate of result.gates.filter((g) => g.status !== 'PASS')) {
    console.log(`  - ${gate.name} (${gate.status})`);
  }
  console.log('See docs/framework-cutover-report.md for the standing boundary.');
}

process.exit(cutoverMode ? (result.status === 'SUCCESS' ? 0 : 1) : (machineOk ? 0 : 1));
