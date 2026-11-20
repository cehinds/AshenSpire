// tests/helpers/run-node-fixtures.mjs — the files tests/run-node.mjs hands to
// runTests() because engine.test.js also runs in tests/index.html, where there
// is no `fs`, and an import of `node:fs` in that file would take the browser
// harness down entirely. One loader, one warning shape: a missing file warns
// and the test that needs it skips loudly.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Read one repository file as text, or null with a warning naming the test that skips.
function readFixture(rel, missing) {
  try {
    return readFileSync(resolve(ROOT, rel), 'utf8');
  } catch {
    if (missing) console.warn(missing);
    return null;
  }
}

// Returns { artManifest, assetExists, legacyRunSave, preE6RunSave }, each null
// when its source is unavailable (the matching test then skips).
export async function loadRunNodeFixtures() {
  // The art manifest is written by tools/equipment-blender.py and records the
  // fields the renderer ACTUALLY read.
  // A missing or unparsable manifest returns null; tests/run-node.mjs prints the
  // warning, which names the tool (tools/gatelist.mjs reads run-node's text).
  const manifestText = readFixture('asset-data/equipment/manifest.json', null);
  let artManifest = null;
  if (manifestText !== null) {
    try { artManifest = JSON.parse(manifestText); } catch { /* reported by the caller */ }
  }

  // Test 49 asks whether a path the game CONSTRUCTS resolves to a real file.
  // Since step 12 (docs/EXTERNAL-ASSETS-PLAN.md) "real" means an id
  // art-manifest.json lists — what the pinned packs carry.
  let assetExists = null;
  try {
    const { manifestIds } = await import('../../tools/art-source.mjs');
    const shipped = manifestIds();
    assetExists = (rel) => shipped.has(rel);
  } catch {
    console.warn('  (no filesystem — test 49 will skip)');
  }

  // Test 50c: real bytes saveRun wrote at dev = acb8ffe, when the HP attribute
  // was still spelled 'constitution'.
  const legacyRunSave = readFixture('tests/fixtures/run-save-constitution-acb8ffe.json',
    '  (no legacy run-save fixture — test 50c will skip)');
  // Test 50e: real bytes saveRun wrote at dev = 5597166, the commit before HP
  // became 50 + floor(CON/5) + tagged bonuses.
  const preE6RunSave = readFixture('tests/fixtures/run-save-hp-5597166.json',
    '  (no pre-E6 run-save fixture — test 50e will skip)');

  return { artManifest, assetExists, legacyRunSave, preE6RunSave };
}
