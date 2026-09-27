// tests/closedsets.test.mjs — rung 53 (tools/closedsets.mjs) must give the same
// verdict on the same tree, whatever else is writing next to it.
//
// THE FAILURE THIS PINS, reproduced rather than called a flake: rung 53 reads
// the live checkout, and `tools/weapon-card-packages.mjs --selftest` (rung 77,
// the --selftests-only lane) writes a copy of src/model/loadout.js to
// src/model/.weapon-card-package-mutant-<pid>.mjs and unlinks it a moment
// later. When the two lanes run over one checkout at once, closedsets could
// list that file and then fail to read it: ENOENT, no RESULT line, FAIL 53.
// Observed on dev 1b4241b2 with a loop that writes and unlinks such a file
// every 30 ms: 11 of 28 runs died with ENOENT at collect(). And when the read
// did win the race, the mutant's lines counted as READERS of loadout.js's sets,
// so a transient copy could hide a real orphan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collect } from '../tools/closedsets.mjs';

function tree() {
  const root = mkdtempSync(join(tmpdir(), 'closedsets-test-'));
  for (const d of ['src/model', 'tools', 'tests']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'src/model/sets.js'), "export const REAL_SET = Object.freeze(['a']);\n");
  writeFileSync(join(root, 'src/model/use.js'), "import { REAL_SET } from './sets.js';\nexport const n = REAL_SET.length;\n");
  return root;
}

test('a file that is listed but gone by the time it is read does not crash the scan', () => {
  const root = tree();
  try {
    // A dangling link is the deterministic form of "readdir saw it, then it was
    // unlinked": readdir lists the name and readFileSync throws ENOENT.
    symlinkSync(join(root, 'src/model/never-existed.js'), join(root, 'src/model/vanished.js'));
    const r = collect(root);
    assert.deepEqual(r.sets.map((s) => [s.name, s.readers.length]), [['REAL_SET', 1]]);
    assert.deepEqual(r.vanished, ['src/model/vanished.js']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a dot-file (a tool\'s transient mutant) is neither population nor reader', () => {
  const root = tree();
  try {
    // The mutant weapon-card-packages writes is a dot-file copy of real source.
    // It must not add sets, and it must not keep an orphan alive by mentioning it.
    writeFileSync(join(root, 'src/model/orphan.js'), "export const LONELY_SET = Object.freeze(['x']);\n");
    writeFileSync(join(root, 'src/model/.tool-mutant-123.mjs'),
      "export const MUTANT_SET = Object.freeze(['m']);\nexport const k = LONELY_SET.length;\n");
    const r = collect(root);
    assert.deepEqual(r.sets.map((s) => s.name).sort(), ['LONELY_SET', 'REAL_SET']);
    assert.deepEqual(r.sets.find((s) => s.name === 'LONELY_SET').readers, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
