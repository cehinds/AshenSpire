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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collect, report } from '../tools/closedsets.mjs';

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
    // "readdir saw it, then it was unlinked", staged the same way on every OS:
    // the file is on disk so readdir lists it, and the reader throws ENOENT for
    // it as if the writer had won the race. (A dangling symlink did this too,
    // but needs elevated rights on Windows, where CI runs this file.)
    writeFileSync(join(root, 'src/model/vanished.js'), "export const GONE_SET = Object.freeze(['g']);\n");
    const readFile = (f) => {
      if (f.endsWith('vanished.js')) throw Object.assign(new Error(`ENOENT: ${f}`), { code: 'ENOENT' });
      return readFileSync(f, 'utf8');
    };
    const r = collect(root, { readFile });
    assert.deepEqual(r.sets.map((s) => [s.name, s.readers.length]), [['REAL_SET', 1]]);
    assert.deepEqual(r.vanished, ['src/model/vanished.js']);

    // ...but a scan that lost a file is INCOMPLETE, and an incomplete scan is
    // never a pass: the vanished file's sets silently left the population. The
    // verdict is unknown (exit 2), and the file is named ON the RESULT line,
    // because that one line is all tests/run-node.mjs shows for rung 53.
    const lines = [];
    const log = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    let out;
    try { out = report(root, { readFile }); } finally { console.log = log; }
    assert.equal(out.code, 2);
    const result = lines.filter((l) => l.startsWith('RESULT:'));
    assert.equal(result.length, 1);
    assert.match(result[0], /INCOMPLETE/);
    assert.match(result[0], /src\/model\/vanished\.js/);
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
