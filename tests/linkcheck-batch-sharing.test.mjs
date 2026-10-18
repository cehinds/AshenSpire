// tools/linkcheck.mjs links every module graph in a batch of entries. The batch
// shares one context and cache (c615f801a), so a module that many entries import
// is parsed ONCE per batch. Without that, each entry re-parses its whole import
// closure: the self-test then runs six full passes at ~190 s each, which is the
// 19-minute "silent" link job on Windows (run 38432707710). This test pins the
// sharing with a counted fact, not a timer: `parsed` is the number of modules the
// batch parsed, and it must equal the number of modules in the fixture.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOL = fileURLToPath(new URL('../tools/linkcheck.mjs', import.meta.url));
const CHAIN = 20;   // modules in the shared import chain
const ENTRIES = 40; // entry modules, each importing the head of the chain

function write(root, rel, text) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text, 'utf8');
}

function fixture({ broken }) {
  const root = mkdtempSync(join(tmpdir(), 'linkcheck-batch-'));
  for (let i = 0; i < CHAIN; i++) {
    write(root, `src/chain/m${i}.js`, i + 1 < CHAIN
      ? `import { v as next } from './m${i + 1}.js';\nexport const v = next;\n`
      : `export const v = 1;\n`);
  }
  for (let i = 0; i < ENTRIES; i++) {
    write(root, `src/entries/e${i}.js`, `import { v } from '../chain/m0.js';\nexport const e${i} = v;\n`);
  }
  if (broken) write(root, 'src/entries/zz-bad.js', `import { nope } from '../chain/m0.js';\nexport const x = nope;\n`);
  return root;
}

function batch(root) {
  const r = spawnSync(process.execPath, ['--experimental-vm-modules', TOOL, `--root=${root}`, '--batch-start=0'],
    { encoding: 'utf8', timeout: 120000 });
  const line = (r.stdout || '').match(/^BATCH_RESULT: (.+)$/m);
  assert.ok(line, `linkcheck batch printed no BATCH_RESULT (status ${r.status}): ${r.stderr || r.stdout}`);
  return JSON.parse(line[1]);
}

test('a shared module is parsed once per batch, not once per entry that imports it', () => {
  const root = fixture({ broken: false });
  try {
    const result = batch(root);
    assert.deepEqual(result.broken, [], 'a clean fixture links with nothing broken');
    const modules = CHAIN + ENTRIES;
    assert.equal(result.total, modules);
    // One parse per module. Re-parsing per entry would be ENTRIES * (CHAIN + 1) = 840.
    assert.equal(result.parsed, modules, `expected ${modules} parses, got ${result.parsed}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a broken entry is still named, the others stay green, and the batch stays bounded', () => {
  const root = fixture({ broken: true });
  try {
    const result = batch(root);
    const bad = result.broken.find((b) => b.file === 'src/entries/zz-bad.js');
    assert.ok(bad, `zz-bad.js must be reported broken: ${JSON.stringify(result.broken)}`);
    assert.match(bad.err, /does not provide an export named 'nope'/);
    assert.equal(result.broken.length, 1, 'only the broken entry is reported');
    // The failing entry is re-linked in isolation, so a few modules are parsed
    // again; the bound is still far below the re-parse-per-entry cost.
    assert.ok(result.parsed < ENTRIES * (CHAIN + 1) / 4, `parsed ${result.parsed} is not bounded`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
